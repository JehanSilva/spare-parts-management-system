import re
import calendar
import uuid
from collections import Counter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from datetime import date, timedelta
from django.db.models.functions import TruncDate, Coalesce, Replace, Upper
from rest_framework import status
from django.db.models import Sum, F, Value, DecimalField
from .models import InterchangeGroup, Part, Supplier, Sale, SaleItem, ActiveCart, Employee, Attendance, Payroll, Holiday, RestockRecord, Customer, CustomerVehicle, Estimate, RepairService, VehicleInspection, INSPECTION_NUMBER_START, PurchaseOrder, PurchaseOrderItem, SupplierInvoice, SupplierCheque, ChequeAllocation
from .serializers import PartSerializer, SupplierSerializer, SaleSerializer, PartMinimalSerializer, ActiveCartSerializer, EmployeeSerializer, AttendanceSerializer, PayrollSerializer, HolidaySerializer, RestockEntrySerializer, RestockRecordSerializer, CustomerSerializer, CustomerVehicleSerializer, EstimateSerializer, RepairServiceSerializer, VehicleInspectionSerializer, build_vehicle_registry_context, PurchaseOrderSerializer, SupplierInvoiceSerializer, SupplierChequeSerializer, invoice_payment_info
from decimal import Decimal, InvalidOperation
from .models import Vehicle, normalize_repair_description
from .text import title_case_name
from .serializers import VehicleSerializer
from django.shortcuts import get_object_or_404
from django.db.models import Sum, F
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q


def buy_price_expr():
    """
    A SaleItem's unit cost. Labour lines carry what the shop paid for the job
    in unit_cost (an outside part, sublet work) — usually 0.

    Prefers the cost snapshotted on the line at sale time (unit_cost); the
    part's current buy_price is only a fallback for a row without one.

    LABOR lines have no `part`, so a bare F('part__buy_price') is NULL and the
    whole profit expression collapses to NULL — which Sum() then skips, quietly
    dropping the row from every profit aggregate. Coalescing to zero keeps
    labour in the totals, at whatever cost (often none) it was recorded with.
    """
    return Coalesce(
        F('unit_cost'),
        F('part__buy_price'),
        Value(0),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )


# --- CUSTOMER VIEWS ---
@api_view(['GET'])
def get_customers(request):
    """List all customers, optionally search by name, phone, or vehicle number."""
    search = request.query_params.get('search', '').strip()
    qs = Customer.objects.prefetch_related('vehicles').order_by('name')
    if search:
        qs = qs.filter(
            Q(name__icontains=search) |
            Q(phone__icontains=search) |
            Q(vehicles__vehicle_number__icontains=search)
        ).distinct()
    serializer = CustomerSerializer(qs, many=True)
    return Response(serializer.data)



@api_view(['POST'])
def add_customer(request):
    """Create a new customer. Vehicles can be added separately."""
    serializer = CustomerSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_customer(request, pk):
    """
    Update a customer's details.

    A sale stores the customer's name as free text taken at checkout (walk-ins
    have no customer FK at all, so the column can't just be dropped), which
    means a corrected name would otherwise leave the sales history reading as a
    different person. So a rename follows through to the sales — and any open
    POS cart — actually linked to this customer. The honorific counts as part
    of that name: adding "Dr." is a correction like any other.
    """
    customer = get_object_or_404(Customer, pk=pk)
    old_name = customer.display_name

    serializer = CustomerSerializer(customer, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        serializer.save()
        new_name = customer.display_name
        if new_name != old_name:
            # Matched on the FK, never on the old text: an unlinked walk-in that
            # happens to share the name may well be somebody else.
            Sale.objects.filter(customer=customer).update(customer_name=new_name)
            ActiveCart.objects.filter(customer=customer).update(customer_name=new_name)

    return Response(serializer.data)


@api_view(['DELETE'])
def delete_customer(request, pk):
    """Delete a customer and their vehicles."""
    customer = get_object_or_404(Customer, pk=pk)
    customer.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def get_customer_vehicles(request):
    """
    GET /vehicles/registry/?search=... — list/search ALL registered vehicles
    (independent master data; customer link is optional).
    """
    search = request.query_params.get('search', '').strip()
    qs = CustomerVehicle.objects.select_related('customer').order_by('-created_at')
    if search:
        qs = qs.filter(
            Q(vehicle_number__icontains=search) |
            Q(make__icontains=search) |
            Q(model__icontains=search) |
            Q(customer__name__icontains=search) |
            Q(customer__phone__icontains=search)
        )
    return Response(CustomerVehicleSerializer(qs, many=True).data)


@api_view(['POST'])
def add_customer_vehicle(request):
    """
    POST /vehicles/registry/add/
    Creates a standalone registered vehicle. The `customer` field is
    optional — a vehicle can be created and used without ever being linked.
    """
    data = {**request.data}
    if 'vehicle_number' in data:
        data['vehicle_number'] = data['vehicle_number'].strip().upper()
    serializer = CustomerVehicleSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Suggestions are a short pick-list, not a search page.
VEHICLE_SUGGESTION_LIMIT = 8


@api_view(['GET'])
def suggest_vehicles(request):
    """
    GET /vehicles/registry/suggest/?q=KT — registered plates starting with what
    has been typed so far, for the POS vehicle-number dropdown. Spaces and
    dashes are ignored on both sides, so "KT8" and "kt-8" both find KT-8352.
    Kept deliberately small: a few fields, at most VEHICLE_SUGGESTION_LIMIT.
    """
    typed = re.sub(r'[\s-]', '', request.query_params.get('q', '')).upper()
    if not typed:
        return Response([])

    vehicles = (CustomerVehicle.objects
                .annotate(plate_key=Upper(Replace(Replace('vehicle_number', Value('-'), Value('')), Value(' '), Value(''))))
                .filter(plate_key__startswith=typed)
                .select_related('customer')
                .order_by('vehicle_number')[:VEHICLE_SUGGESTION_LIMIT])
    return Response([
        {
            "id": v.id,
            "vehicle_number": v.vehicle_number,
            "make": v.make,
            "model": v.model,
            "owner_name": v.customer.display_name if v.customer else None,
        }
        for v in vehicles
    ])


@api_view(['GET'])
def lookup_vehicle(request):
    """
    GET /vehicles/registry/lookup/?vehicle_number=ABC123
    Returns the vehicle (with nested customer_details, which may be null)
    for that plate number, or {found: false} if it doesn't exist yet.
    """
    vehicle_number = request.query_params.get('vehicle_number', '').strip().upper()
    if not vehicle_number:
        return Response({'error': 'vehicle_number query param is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        vehicle = CustomerVehicle.objects.select_related('customer').get(vehicle_number__iexact=vehicle_number)
        return Response({'found': True, 'vehicle': CustomerVehicleSerializer(vehicle).data})
    except CustomerVehicle.DoesNotExist:
        return Response({'found': False}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_vehicle_history(request, pk):
    """
    GET /vehicles/registry/<pk>/history/
    All sales/jobs recorded against this vehicle's plate number, newest first.
    Sale.vehicle_number is free-text (not an FK), so this matches the same
    way lookup_vehicle does — case-insensitive exact match on the plate.
    """
    vehicle = get_object_or_404(CustomerVehicle, pk=pk)
    sales = Sale.objects.filter(vehicle_number__iexact=vehicle.vehicle_number).order_by('-created_at')
    # Every sale here is this one vehicle, so the map is free.
    context = {'vehicle_registry': {vehicle.vehicle_number.upper(): vehicle}}
    return Response(SaleSerializer(sales, many=True, context=context).data)


@api_view(['GET'])
def get_customer_history(request, pk):
    """
    GET /customers/<pk>/history/
    All sales tied to this customer via the Sale.customer FK, whether or not
    each sale had a vehicle attached, newest first.
    """
    customer = get_object_or_404(Customer, pk=pk)
    sales = list(customer.sales.order_by('-created_at'))
    return Response(
        SaleSerializer(sales, many=True, context=build_vehicle_registry_context(sales)).data
    )


@api_view(['POST'])
def add_vehicle_to_customer(request, pk):
    """
    POST /customers/<pk>/vehicles/add/
    Adds a new vehicle registration to an existing customer.
    """
    customer = get_object_or_404(Customer, pk=pk)
    data = {**request.data, 'customer': customer.pk}
    # Normalize vehicle number to uppercase
    if 'vehicle_number' in data:
        data['vehicle_number'] = data['vehicle_number'].strip().upper()
    serializer = CustomerVehicleSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        # Return full customer object with updated vehicles list
        return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def delete_customer_vehicle(request, vehicle_pk):
    """
    DELETE /customers/vehicles/<vehicle_pk>/delete/
    Removes a specific vehicle registration.
    """
    vehicle = get_object_or_404(CustomerVehicle, pk=vehicle_pk)
    vehicle.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['PATCH'])
def update_customer_vehicle(request, vehicle_pk):
    """
    PATCH /customers/vehicles/<vehicle_pk>/update/
    Updates vehicle details (plate number, make, model, year, color, mileage, notes).

    The plate is the join key for everything that only stores it as free text
    (sales, estimates, in-progress carts), so renaming it here cascades to those
    rows in the same transaction — otherwise a corrected plate would orphan the
    vehicle's service history and the make/model printed on old bills.
    """
    vehicle = get_object_or_404(CustomerVehicle, pk=vehicle_pk)
    data = {**request.data}

    old_number = vehicle.vehicle_number
    new_number = None
    if 'vehicle_number' in data:
        new_number = (data['vehicle_number'] or '').strip().upper()
        if not new_number:
            return Response(
                {'vehicle_number': ['Vehicle number cannot be blank.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data['vehicle_number'] = new_number
        # The model's unique=True is case-sensitive, but every lookup here is
        # case-insensitive — so guard the rename the same way we look plates up.
        clash = CustomerVehicle.objects.filter(
            vehicle_number__iexact=new_number
        ).exclude(pk=vehicle.pk).exists()
        if clash:
            return Response(
                {'vehicle_number': ['Another vehicle is already registered with this number.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

    serializer = CustomerVehicleSerializer(vehicle, data=data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    renamed = new_number is not None and new_number.upper() != old_number.upper()
    with transaction.atomic():
        serializer.save()
        if renamed:
            Sale.objects.filter(vehicle_number__iexact=old_number).update(vehicle_number=new_number)
            Estimate.objects.filter(
                Q(vehicle=vehicle) | Q(vehicle_number__iexact=old_number)
            ).update(vehicle_number=new_number)
            ActiveCart.objects.filter(vehicle_number__iexact=old_number).update(vehicle_number=new_number)

    return Response(serializer.data)


# --- VEHICLE VIEWS ---
@api_view(['PUT'])
def update_vehicle(request, pk):
    """Update an existing vehicle"""
    vehicle = get_object_or_404(Vehicle, pk=pk)
    serializer = VehicleSerializer(vehicle, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def delete_vehicle(request, pk):
    """Delete a vehicle"""
    vehicle = get_object_or_404(Vehicle, pk=pk)
    vehicle.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@transaction.atomic
def resolve_vehicle_list(request):
    """
    POST /vehicles/resolve/ {"text": "Toyota Aqua, Honda Vezel 2018"} — turn a
    typed list of compatible vehicles (make then model, optional year; split on
    commas, semicolons or new lines) into catalogue Vehicles, reusing existing
    ones and creating the rest — the same parsing the Excel import uses. Entries
    that aren't a make *and* a model are returned under "skipped" with a reason.
    """
    text = request.data.get('text') or ''
    existing_makes = list(Vehicle.objects.values_list('make', flat=True).distinct())

    vehicles, created, skipped, seen = [], [], [], set()
    for entry in re.split(r'[,;\n]+', text):
        entry = entry.strip()
        if not entry:
            continue
        parsed = parse_vehicle_string(entry, existing_makes)
        # A lone word ("Toyota") parses with an invented model of "Unknown".
        if not parsed or (parsed['model'] == "Unknown" and 'unknown' not in entry.lower()):
            skipped.append({'text': entry, 'reason': 'needs a make and a model'})
            continue
        vehicle, was_created = _get_or_create_vehicle(parsed, existing_makes)
        if was_created:
            created.append(str(vehicle))
        if vehicle.id not in seen:
            seen.add(vehicle.id)
            vehicles.append(vehicle)

    return Response({
        'vehicles': VehicleSerializer(vehicles, many=True).data,
        'created': created,
        'skipped': skipped,
    })


@api_view(['GET'])
def get_vehicles(request):
    """List all vehicles"""
    vehicles = Vehicle.objects.all().order_by('make', 'model', 'year')
    serializer = VehicleSerializer(vehicles, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_vehicle(request):
    """Add a new vehicle"""
    serializer = VehicleSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- SUPPLIER VIEWS ---
@api_view(['GET'])
def get_suppliers(request):
    """
    List all suppliers
    """
    suppliers = Supplier.objects.all()
    serializer = SupplierSerializer(suppliers, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_supplier(request):
    """
    Add a new supplier
    """
    serializer = SupplierSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
def update_supplier(request, pk):
    supplier = get_object_or_404(Supplier, pk=pk)
    serializer = SupplierSerializer(supplier, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def delete_supplier(request, pk):
    supplier = get_object_or_404(Supplier, pk=pk)
    if supplier.invoices.exists() or supplier.cheques.exists():
        return Response(
            {"error": "This supplier has invoices or cheques recorded. Remove those first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    supplier.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# --- PART VIEWS ---
@api_view(['GET'])
def get_parts(request):
    """
    List parts with optional search and brand filtering
    """
    # 1. Get parameters from the URL (e.g., /api/parts/?search=brake&brand=toyota)
    search_query = request.query_params.get('search', '')
    brand_filter = request.query_params.get('brand', '')
    stock_status = request.query_params.get('stock_status', '')
    supplier_filter = request.query_params.get('supplier', '')

    # 2. Start with all parts, annotated with sales stats using Subqueries to avoid Cartesian product joins
    from django.db.models import Sum, F, Q, ExpressionWrapper, FloatField, Subquery, OuterRef
    from django.db.models.functions import Coalesce
    
    # Subquery to calculate total_sold
    sold_subquery = SaleItem.objects.filter(
        part=OuterRef('pk'),
        sale__status='COMPLETED'
    ).values('part').annotate(
        total=Sum('quantity')
    ).values('total')
    
    # Subquery to calculate total_revenue: Sum((unit_price - discount) * quantity)
    revenue_subquery = SaleItem.objects.filter(
        part=OuterRef('pk'),
        sale__status='COMPLETED'
    ).values('part').annotate(
        total=Sum(ExpressionWrapper(
            (F('unit_price') - F('discount')) * F('quantity'),
            output_field=FloatField()
        ))
    ).values('total')
    
    # Subquery to calculate total_cost: Sum(cost at time of sale * quantity)
    cost_subquery = SaleItem.objects.filter(
        part=OuterRef('pk'),
        sale__status='COMPLETED'
    ).values('part').annotate(
        total=Sum(ExpressionWrapper(
            buy_price_expr() * F('quantity'),
            output_field=FloatField()
        ))
    ).values('total')
    
    # Subquery to calculate total_invested: lifetime purchase spend for this
    # part, at the price actually paid on each restock. RestockRecord.quantity
    # is never decremented on a return — the returned units live in
    # returned_quantity — so the units kept (and therefore paid for) are the
    # difference. (Sold-unit cost above comes from SaleItem.unit_cost, the
    # buy price snapshotted at the time of each sale.)
    invested_subquery = RestockRecord.objects.filter(
        part=OuterRef('pk')
    ).values('part').annotate(
        total=Sum(ExpressionWrapper(
            (F('quantity') - F('returned_quantity')) * F('buy_price'),
            output_field=FloatField()
        ))
    ).values('total')

    # Units bought and kept, so the modal can say what the spend bought.
    purchased_subquery = RestockRecord.objects.filter(
        part=OuterRef('pk')
    ).values('part').annotate(
        total=Sum(F('quantity') - F('returned_quantity'))
    ).values('total')

    parts = Part.objects.all().annotate(
        total_sold=Coalesce(Subquery(sold_subquery), 0),
        total_revenue=Coalesce(Subquery(revenue_subquery, output_field=FloatField()), 0.0),
        total_cost=Coalesce(Subquery(cost_subquery, output_field=FloatField()), 0.0),
        total_invested=Coalesce(Subquery(invested_subquery, output_field=FloatField()), 0.0),
        total_purchased=Coalesce(Subquery(purchased_subquery), 0)
    ).order_by('-id')

    # 3. Apply Search Filter — split into keywords, ALL must match (AND logic)
    #    Each keyword must appear in at least one field (name, part_number, description, vehicle make/model)
    if search_query:
        keywords = search_query.split()
        for keyword in keywords:
            parts = parts.filter(
                Q(name__icontains=keyword) | 
                Q(part_number__icontains=keyword) |
                Q(description__icontains=keyword) |
                Q(compatible_vehicles__make__icontains=keyword) |
                Q(compatible_vehicles__model__icontains=keyword)
            )
        parts = parts.distinct()

    # 4. Apply Brand Filter (Exact match or partial)
    if brand_filter:
        parts = parts.filter(brand__icontains=brand_filter)

    # 5. Apply Supplier Filter
    if supplier_filter:
        parts = parts.filter(supplier_id=supplier_filter)

    # 6. Apply Stock Status filter
    if stock_status == 'out':
        parts = parts.filter(stock_qty=0)
    elif stock_status == 'low':
        try:
            threshold = int(request.query_params.get('low_stock_threshold', 2))
            parts = parts.filter(stock_qty__lte=threshold)
        except ValueError:
            parts = parts.filter(stock_qty__lte=2)
    elif stock_status == 'no_price':
        parts = parts.filter(Q(buy_price=0) | Q(sell_price=0) | Q(image__exact='') | Q(image__isnull=True))

    # 7. Serialize and return
    serializer = PartSerializer(parts, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_parts_minimal(request):
    """
    List parts with minimal details (Image, Part Number, Compatible Vehicles)
    Optional: Search by part number or vehicle
    """
    search_query = request.query_params.get('search', '')
    
    parts = Part.objects.all().order_by('-id')

    if search_query:
        parts = parts.filter(
            Q(part_number__icontains=search_query) |
            Q(compatible_vehicles__make__icontains=search_query) |
            Q(compatible_vehicles__model__icontains=search_query)
        ).distinct()

    serializer = PartMinimalSerializer(parts, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_part(request):
    """
    Add a new part OR update stock if part_number already exists.
    """
    data = request.data
    part_number = data.get('part_number')

    # 1. Check if a part with this Part Number already exists
    # We use .filter().first() to avoid crashing if it doesn't exist
    existing_part = Part.objects.filter(part_number=part_number).first()

    if existing_part:
        # --- SMART UPDATE MODE ---
        new_qty = int(data.get('stock_qty', 0))

        # Update Quantity
        existing_part.stock_qty += new_qty

        buy_price_for_record = existing_part.buy_price
        # Update Prices (Optional: Remove these lines if you don't want to overwrite prices)
        if 'buy_price' in data:
            existing_part.buy_price = data['buy_price']
            buy_price_for_record = Decimal(str(data['buy_price']))
        if 'sell_price' in data:
            existing_part.sell_price = data['sell_price']
        if 'min_sell_price' in data:
            # Blank input clears the discount limit rather than erroring.
            raw_min = data['min_sell_price']
            existing_part.min_sell_price = (
                Decimal(str(raw_min)) if raw_min not in (None, '') else None
            )

        existing_part.save()

        if new_qty > 0:
            RestockRecord.objects.create(
                part=existing_part,
                supplier=existing_part.supplier,
                quantity=new_qty,
                buy_price=buy_price_for_record,
                notes="Added via Add Part form (duplicate part number)",
            )

        return Response({
            "message": f"Part exists. Stock increased by {new_qty}. Total: {existing_part.stock_qty}",
            "id": existing_part.id,
            "stock_qty": existing_part.stock_qty
        }, status=status.HTTP_200_OK)

    # --- CREATE NEW MODE ---
    serializer = PartSerializer(data=data)
    if serializer.is_valid():
        part = serializer.save()
        if part.stock_qty > 0:
            RestockRecord.objects.create(
                part=part,
                supplier=part.supplier,
                quantity=part.stock_qty,
                buy_price=part.buy_price,
                notes="Initial stock on item creation",
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
def update_part(request, pk):
    part = get_object_or_404(Part, pk=pk)
    serializer = PartSerializer(part, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- COMPATIBLE (INTERCHANGEABLE) PARTS ---
def _compatible_payload(part):
    """The part's group id and the other parts in its group."""
    others = []
    if part.interchange_group_id:
        others = PartSerializer(
            Part.objects.filter(interchange_group_id=part.interchange_group_id).exclude(pk=part.pk).order_by('name'),
            many=True,
        ).data
    return {"interchange_group": part.interchange_group_id, "compatible": others}


def _dissolve_if_lonely(group_id):
    """A group with one part (or none) links nothing — clear it away."""
    if group_id is None:
        return
    members = Part.objects.filter(interchange_group_id=group_id)
    if members.count() < 2:
        members.update(interchange_group=None)
        InterchangeGroup.objects.filter(pk=group_id).delete()


@api_view(['POST'])
@transaction.atomic
def link_compatible_part(request, pk):
    """
    Link two parts as interchangeable. Body: { "part_id": "<uuid>" }.
    Groups are shared: if either part is already linked, the other joins its
    group, and two existing groups are merged into one.
    """
    part = get_object_or_404(Part.objects.select_for_update(), pk=pk)
    other_id = request.data.get('part_id')
    if not other_id:
        return Response({"error": "part_id is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        other = Part.objects.select_for_update().get(pk=other_id)
    except (Part.DoesNotExist, ValueError, DjangoValidationError):
        return Response({"error": "Part to link was not found."}, status=status.HTTP_404_NOT_FOUND)
    if other.pk == part.pk:
        return Response({"error": "A part can't be linked to itself."}, status=status.HTTP_400_BAD_REQUEST)

    a, b = part.interchange_group_id, other.interchange_group_id
    if a and b and a != b:
        # Merge: everything in this part's group moves to the other's.
        Part.objects.filter(interchange_group_id=a).update(interchange_group_id=b)
        InterchangeGroup.objects.filter(pk=a).delete()
    elif b and not a:
        Part.objects.filter(pk=part.pk).update(interchange_group_id=b)
    elif a and not b:
        Part.objects.filter(pk=other.pk).update(interchange_group_id=a)
    elif not a and not b:
        group = InterchangeGroup.objects.create()
        Part.objects.filter(pk__in=[part.pk, other.pk]).update(interchange_group=group)

    part.refresh_from_db()
    return Response(_compatible_payload(part))


@api_view(['POST'])
@transaction.atomic
def unlink_compatible_part(request, pk):
    """Take this part out of its interchange group."""
    part = get_object_or_404(Part.objects.select_for_update(), pk=pk)
    group_id = part.interchange_group_id
    if group_id:
        Part.objects.filter(pk=part.pk).update(interchange_group=None)
        _dissolve_if_lonely(group_id)
    part.refresh_from_db()
    return Response(_compatible_payload(part))


@api_view(['DELETE'])
def delete_part(request, pk):
    part = get_object_or_404(Part, pk=pk)
    # Check if part has sales history to prevent breaking reports
    if part.saleitem_set.exists():
        return Response({"error": "Cannot delete part with sales history."}, status=status.HTTP_400_BAD_REQUEST)
    group_id = part.interchange_group_id
    part.delete()
    _dissolve_if_lonely(group_id)
    return Response(status=status.HTTP_204_NO_CONTENT)


def _apply_restock(part, entries, sell_price=None, invoice_number=''):
    """
    Add stock to a part: one RestockRecord per entry, the part's weighted
    average buy price recalculated, and its primary supplier moved to whoever it
    was most recently bought from. Shared by Quick Restock and receiving a
    purchase order. `entries` are dicts of supplier (object or None), quantity,
    buy_price and notes. Returns (records, total_added_qty, new_avg_price),
    where `records` are the saved RestockRecords in entry order.
    """
    # --- Weighted Average Cost Calculation ---
    # Start with existing stock value
    old_qty = part.stock_qty
    running_value = old_qty * float(part.buy_price)
    total_added_qty = 0

    records_to_create = []
    latest_supplier = None  # the part's primary supplier follows the newest restock
    for entry in entries:
        qty = entry['quantity']
        price = float(entry['buy_price'])
        if entry['supplier'] is not None:
            latest_supplier = entry['supplier']

        running_value += qty * price
        total_added_qty += qty

        records_to_create.append(RestockRecord(
            part=part,
            supplier=entry['supplier'],
            quantity=qty,
            buy_price=entry['buy_price'],
            notes=entry.get('notes', ''),
            invoice_number=invoice_number,
        ))

    # Bulk create all restock records (Postgres hands back their primary keys)
    records = RestockRecord.objects.bulk_create(records_to_create)

    # Update part stock and weighted avg price
    new_total_qty = old_qty + total_added_qty
    new_avg_price = round(running_value / new_total_qty, 2)

    part.stock_qty = new_total_qty
    part.buy_price = new_avg_price
    if sell_price is not None:
        part.sell_price = sell_price
    # Point the part at whoever it was most recently bought from, so the next
    # restock defaults to that supplier. Entries left as "Unknown / No Supplier"
    # leave the existing one alone rather than clearing it.
    if latest_supplier is not None:
        part.supplier = latest_supplier
    part.save()

    return records, total_added_qty, new_avg_price


@api_view(['POST'])
@transaction.atomic
def restock_part(request, pk):
    """
    Bulk Restock: Accepts one or more supplier entries (supplier, quantity, buy_price)
    and atomically:
      1. Creates a RestockRecord for each entry.
      2. Recalculates the part's weighted average buy price.
      3. Updates the part's stock_qty.
    
    Payload:
    {
        "entries": [
            { "supplier_id": 1, "quantity": 10, "buy_price": 1500.00, "notes": "" },
            { "supplier_id": 2, "quantity": 5,  "buy_price": 1450.00, "notes": "" }
        ],
        "sell_price": 1800.00  # optional; defaults to the part's current sell_price
    }
    """
    part = get_object_or_404(Part, pk=pk)
    entries_data = request.data.get('entries', [])

    if not entries_data:
        return Response({"error": "At least one restock entry is required."}, status=status.HTTP_400_BAD_REQUEST)

    sell_price = request.data.get('sell_price', None)
    if sell_price is not None:
        try:
            sell_price = Decimal(str(sell_price))
        except (InvalidOperation, ValueError):
            return Response({"error": "Invalid sell_price."}, status=status.HTTP_400_BAD_REQUEST)
        if sell_price < 0:
            return Response({"error": "sell_price must be ≥ 0."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate all entries first
    serializer = RestockEntrySerializer(data=entries_data, many=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    validated_entries = serializer.validated_data

    # Resolve every supplier before touching stock, so a bad id fails cleanly.
    entries = []
    for entry in validated_entries:
        supplier_id = entry.get('supplier_id')
        supplier_obj = None
        if supplier_id:
            try:
                supplier_obj = Supplier.objects.get(pk=supplier_id)
            except Supplier.DoesNotExist:
                return Response(
                    {"error": f"Supplier with id {supplier_id} does not exist."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        entries.append({
            'supplier': supplier_obj,
            'quantity': entry['quantity'],
            'buy_price': entry['buy_price'],
            'notes': entry.get('notes', ''),
        })

    records, total_added_qty, new_avg_price = _apply_restock(part, entries, sell_price=sell_price)

    return Response({
        "part": PartSerializer(part).data,
        "records_created": len(records),
        "total_added_qty": total_added_qty,
        "new_avg_buy_price": new_avg_price,
    })


@api_view(['GET'])
def get_restock_history(request, pk):
    """
    Returns the last 20 restock records for a given part.
    """
    part = get_object_or_404(Part, pk=pk)
    records = RestockRecord.objects.filter(part=part).select_related('supplier')[:20]
    serializer = RestockRecordSerializer(records, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@transaction.atomic
def return_restock_record(request, part_pk, record_pk):
    """
    Return some or all stock from a specific restock record.
    Deducts from part.stock_qty and recalculates the weighted average buy price.

    Payload: { "quantity": <int>, "reason": "<str>" }
    """
    part = get_object_or_404(Part, pk=part_pk)
    record = get_object_or_404(RestockRecord, pk=record_pk, part=part)

    return_qty = int(request.data.get('quantity', 0))
    reason = request.data.get('reason', '').strip()

    if return_qty <= 0:
        return Response({"error": "Return quantity must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

    available_to_return = record.quantity - record.returned_quantity
    if return_qty > available_to_return:
        return Response(
            {"error": f"Cannot return {return_qty}. Only {available_to_return} unit(s) available to return."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if return_qty > part.stock_qty:
        return Response(
            {"error": f"Cannot return {return_qty} units. Current stock is only {part.stock_qty}."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not reason:
        return Response({"error": "A return reason is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Recalculate weighted average after removing the returned units
    old_stock_value = float(part.stock_qty) * float(part.buy_price)
    return_value = return_qty * float(record.buy_price)
    new_stock_qty = part.stock_qty - return_qty

    if new_stock_qty > 0:
        part.buy_price = round((old_stock_value - return_value) / new_stock_qty, 2)
    part.stock_qty = new_stock_qty
    part.save()

    # Update the restock record
    record.returned_quantity += return_qty
    record.return_reason = reason
    record.returned_at = timezone.now()
    if record.returned_quantity >= record.quantity:
        record.status = RestockRecord.STATUS_FULLY_RETURNED
    else:
        record.status = RestockRecord.STATUS_PARTIALLY_RETURNED
    record.save()

    return Response(RestockRecordSerializer(record).data)


@api_view(['PUT'])
@transaction.atomic
def edit_restock_record(request, part_pk, record_pk):
    """
    Edit the supplier, quantity and/or buy_price on a restock record.
    Adjusts part.stock_qty and recalculates the weighted average buy price.

    Payload: { "supplier_id": <int|null>, "quantity": <int>, "buy_price": "<decimal>" }

    Re-pointing the supplier only corrects who this batch was bought from — it
    is deliberately left out of the stock and average-price maths below, and
    never touches Part.supplier (the part's default source, which is a separate
    decision from where one batch happened to come from).
    """
    part = get_object_or_404(Part, pk=part_pk)
    record = get_object_or_404(RestockRecord, pk=record_pk, part=part)

    # Absent key = leave the supplier alone; an explicit blank clears it back to
    # "Unknown / No Supplier", the same option the restock form offers.
    new_supplier = record.supplier
    if 'supplier_id' in request.data:
        supplier_id = request.data.get('supplier_id')
        if supplier_id in (None, '', 'null'):
            new_supplier = None
        else:
            new_supplier = Supplier.objects.filter(pk=supplier_id).first()
            if new_supplier is None:
                return Response(
                    {"error": "That supplier no longer exists."},
                    status=status.HTTP_400_BAD_REQUEST
                )

    new_quantity = int(request.data.get('quantity', record.quantity))
    new_buy_price = Decimal(str(request.data.get('buy_price', record.buy_price)))

    if new_quantity < record.returned_quantity:
        return Response(
            {"error": f"Quantity cannot be less than already returned amount ({record.returned_quantity})."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if new_buy_price <= 0:
        return Response({"error": "Buy price must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

    # Active (non-returned) units before and after the edit
    old_active_qty = record.quantity - record.returned_quantity
    new_active_qty = new_quantity - record.returned_quantity
    qty_diff = new_active_qty - old_active_qty

    new_stock_qty = part.stock_qty + qty_diff
    if new_stock_qty < 0:
        return Response(
            {"error": "This edit would result in negative stock. Reduce the quantity difference."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Recalculate weighted average:
    # Remove old contribution, add new contribution
    old_stock_value = float(part.stock_qty) * float(part.buy_price)
    old_contribution = old_active_qty * float(record.buy_price)
    new_contribution = new_active_qty * float(new_buy_price)
    new_stock_value = old_stock_value - old_contribution + new_contribution

    if new_stock_qty > 0:
        part.buy_price = round(new_stock_value / new_stock_qty, 2)
    part.stock_qty = new_stock_qty
    part.save()

    record.supplier = new_supplier
    record.quantity = new_quantity
    record.buy_price = new_buy_price
    # Refresh status based on updated quantity
    if record.returned_quantity == 0:
        record.status = RestockRecord.STATUS_ACTIVE
    elif record.returned_quantity >= new_quantity:
        record.status = RestockRecord.STATUS_FULLY_RETURNED
    else:
        record.status = RestockRecord.STATUS_PARTIALLY_RETURNED
    record.save()

    return Response(RestockRecordSerializer(record).data)


# --- SALES & BILLING VIEWS ---
def _resolve_sale_datetime(value):
    """
    Turn a client-supplied sale date into a timestamp for Sale.created_at.

    Accepts a plain date ("2026-09-01") or a full ISO datetime. A bare date is
    stamped with the current time of day rather than midnight: the sale then
    sorts naturally among that day's others, and the dashboard's busiest-hours
    chart isn't handed a fake midnight spike.

    Returns (datetime, None) or (None, error message). A blank value yields
    (None, None) — the caller keeps the default of "now".
    """
    if value in (None, ''):
        return None, None

    text = value.strip() if isinstance(value, str) else ''
    if not text:
        return None, None

    # Shape first, then parse: parse_datetime happily reads a bare "2026-09-01"
    # as midnight, which is exactly the timestamp this function exists to avoid.
    if 'T' not in text and ':' not in text:
        day = parse_date(text)
        if day is None:
            return None, "Sale date must be a date like 2026-09-01."
        parsed = timezone.localtime().replace(
            year=day.year, month=day.month, day=day.day, microsecond=0
        )
    else:
        parsed = parse_datetime(text)
        if parsed is None:
            return None, "Sale date must be a date like 2026-09-01."

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    if parsed > timezone.now():
        return None, "Sale date cannot be in the future."

    return parsed, None


@api_view(['POST'])
@transaction.atomic # <--- 1. This Decorator makes the entire function safe
def create_sale(request):
    data = request.data
    customer_name = data.get('customer_name')
    vehicle_number = data.get('vehicle_number', '')
    customer_id = data.get('customer') or None

    # The name is stored on the sale as free text (walk-ins have no customer
    # record at all), but when the sale IS linked to one, that record is the
    # authority: a POS cart can be holding a name captured before the customer
    # was renamed, and the invoice must print who they are now. Same rule the
    # rename cascade in update_customer applies from the other direction.
    if customer_id:
        try:
            linked_customer = Customer.objects.filter(pk=customer_id).first()
        except (ValueError, TypeError):
            linked_customer = None
        if linked_customer:
            customer_name = linked_customer.display_name
        else:
            # Unknown or malformed id — keep the typed name and drop the
            # dangling link rather than failing the checkout over it.
            customer_id = None
    items_data = data.get('items', [])
    mileage = data.get('mileage') or None
    force_mileage_update = bool(data.get('force_mileage_update', False))
    notes = data.get('notes', '')

    # Optional backdate, for a job being billed days after it was done. Blank
    # (the normal case) leaves Sale.created_at on its "now" default.
    created_at, date_error = _resolve_sale_datetime(data.get('created_at'))
    if date_error:
        return Response({"error": date_error}, status=status.HTTP_400_BAD_REQUEST)

    payment_status = data.get('payment_status', 'PAID')
    if payment_status not in ('PAID', 'PARTIAL', 'CREDIT'):
        payment_status = 'PAID'
    credit_note = data.get('credit_note', '') if payment_status in ('PARTIAL', 'CREDIT') else ''

    if not items_data:
        return Response({"error": "No items in sale"}, status=status.HTTP_400_BAD_REQUEST)

    # 2. Validation First: Check ALL items for stock BEFORE creating the sale
    # This prevents creating a Sale ID and then deleting it immediately (gap in IDs)
    total_amount = 0
    for item in items_data:
        item_type = item.get('item_type', 'PART')
        if item_type == 'LABOR':
            if not item.get('description', '').strip():
                return Response({"error": "A repair/labor item is missing a description."}, status=status.HTTP_400_BAD_REQUEST)
            # Repairs can be added to a POS cart with the price still to come;
            # those must be priced before the sale is completed.
            if item.get('price_pending'):
                return Response(
                    {"error": f"\"{item['description'].strip()}\" still needs a price before the sale can be completed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Optional: what the shop paid for this job (an outside part,
            # sublet work). Empty means no cost.
            raw_cost = item.get('unit_cost')
            try:
                item['unit_cost'] = Decimal(str(raw_cost)) if raw_cost not in (None, '') else Decimal('0')
            except (InvalidOperation, TypeError, ValueError):
                return Response({"error": "A repair/labor cost is not a valid amount."}, status=status.HTTP_400_BAD_REQUEST)
            if item['unit_cost'] < 0:
                return Response({"error": "A repair/labor cost can't be negative."}, status=status.HTTP_400_BAD_REQUEST)
            unit_price = float(item['unit_price'])
            discount = float(item.get('discount', 0))
            quantity = int(item.get('quantity', 1))
            total_amount += (unit_price - discount) * quantity
            continue

        try:
            part = Part.objects.get(id=item['part_id'])
            if part.stock_qty < item['quantity']:
                return Response(
                    {"error": f"Not enough stock for {part.name}. Available: {part.stock_qty}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Fixed: Calculate total amount respecting the discount
            # Logic: (Unit Price - Discount) * Quantity
            unit_price = float(item['unit_price'])
            discount = float(item.get('discount', 0))
            quantity = int(item['quantity'])

            total_amount += (unit_price - discount) * quantity

        except Part.DoesNotExist:
             return Response({"error": f"Part ID {item['part_id']} not found"}, status=404)

    # 2b. Determine how much was actually received now
    if payment_status == 'PAID':
        amount_paid = total_amount
    elif payment_status == 'CREDIT':
        amount_paid = 0
    else:  # PARTIAL
        try:
            amount_paid = float(data.get('amount_paid', 0))
        except (TypeError, ValueError):
            return Response({"error": "Invalid amount_paid."}, status=status.HTTP_400_BAD_REQUEST)
        if amount_paid <= 0 or amount_paid >= total_amount:
            return Response(
                {"error": "Partial payment amount must be greater than 0 and less than the total amount."},
                status=status.HTTP_400_BAD_REQUEST
            )

    # 3. Create the Sale Record
    sale = Sale.objects.create(
        customer_name=customer_name,
        vehicle_number=vehicle_number,
        customer_id=customer_id,
        total_amount=total_amount,
        payment_status=payment_status,
        amount_paid=amount_paid,
        credit_note=credit_note,
        mileage=mileage,
        notes=notes,
        **({'created_at': created_at} if created_at else {}),
    )

    # 3b. Keep the vehicle registry's "current mileage" in sync with the
    # latest known reading — only advance it forward, never regress it from
    # an out-of-order or mistyped lower value, unless the frontend confirms
    # the user explicitly chose to override a lower reading anyway.
    # These are queryset .update()s, so CustomerVehicle.save() never runs and
    # the reading's timestamp has to be stamped here alongside it.
    if mileage and vehicle_number:
        recorded_at = timezone.now()
        if force_mileage_update:
            CustomerVehicle.objects.filter(vehicle_number__iexact=vehicle_number).update(
                current_mileage=mileage, mileage_updated_at=recorded_at
            )
        else:
            CustomerVehicle.objects.filter(vehicle_number__iexact=vehicle_number).filter(
                Q(current_mileage__isnull=True) | Q(current_mileage__lt=mileage)
            ).update(current_mileage=mileage, mileage_updated_at=recorded_at)

    # 4. Process Items (Now safe to deduct)
    for item in items_data:
        item_type = item.get('item_type', 'PART')
        if item_type == 'LABOR':
            SaleItem.objects.create(
                sale=sale,
                item_type='LABOR',
                description=item.get('description', '').strip(),
                quantity=item.get('quantity', 1),
                unit_price=item['unit_price'],
                unit_cost=item['unit_cost'],
                discount=item.get('discount', 0),
            )
            continue

        part = Part.objects.get(id=item['part_id'])

        # Deduct Stock
        part.stock_qty -= item['quantity']
        part.save()

        # Create Sale Item
        SaleItem.objects.create(
            sale=sale,
            part=part,
            item_type='PART',
            quantity=item['quantity'],
            unit_price=item['unit_price'],
            # Catalog price at the time it was carted; unit_price is higher
            # only when the cashier raised the price for this sale.
            list_price=item.get('list_price') or part.sell_price,
            discount=item.get('discount', 0), # Fixed: Pass discount to model
            # Map 'warranty' (from Frontend) to 'warranty_period_months' (in DB)
            warranty_period_months=item.get('warranty', 0)
        )

    # 5. Return success using the Serializer
    # Ensure your Serializer has 'warranty_period_months' in its fields list!
    return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_all_sales(request):
    # Order by creation date descending (newest first). select_related on the
    # customer keeps SaleSerializer.customer_phone from firing a query per sale.
    sales = list(Sale.objects.select_related('customer').all().order_by('-created_at'))
    # Same idea for the vehicle registry, which has no FK to join on.
    serializer = SaleSerializer(sales, many=True, context=build_vehicle_registry_context(sales))
    return Response(serializer.data)

@api_view(['PATCH'])
def update_sale(request, pk):
    """
    Update Sale header details (Customer Name, Vehicle Number, sale date).

    Moving created_at moves the sale itself — it leaves today's daily report
    and lands on the date given, which is the point: a sale entered on the
    wrong day should count on the right one.
    """
    sale = get_object_or_404(Sale, pk=pk)
    
    # We only allow updating customer_name, vehicle_number and created_at
    data = request.data
    if 'customer_name' in data:
        sale.customer_name = data['customer_name']
    if 'vehicle_number' in data:
        sale.vehicle_number = data['vehicle_number']
    if data.get('created_at'):
        created_at, date_error = _resolve_sale_datetime(data['created_at'])
        if date_error:
            return Response({"error": date_error}, status=status.HTTP_400_BAD_REQUEST)
        sale.created_at = created_at
        
    sale.save()
    return Response(SaleSerializer(sale).data)

@api_view(['POST'])
@transaction.atomic
def cancel_sale(request, pk):
    """
    Cancel a sale and return items to stock
    """
    sale = get_object_or_404(Sale, pk=pk)
    
    if sale.status == 'CANCELLED':
        return Response({"error": "Sale is already cancelled"}, status=status.HTTP_400_BAD_REQUEST)
    
    # 1. Loop through items and add back to stock (labor items have no part to restock)
    for item in sale.items.all():
        if item.part:
            item.part.stock_qty += item.quantity
            item.part.save()


    # 2. Update status and cancellation reason
    cancel_reason = request.data.get('cancel_reason', '')
    sale.cancel_reason = cancel_reason
    sale.status = 'CANCELLED'
    sale.save()

    return Response(SaleSerializer(sale).data)

@api_view(['POST'])
@transaction.atomic
def reverse_sale(request, pk):
    """
    Reverse a sale: restore stock for its items (unless the sale was already
    cancelled and stock was already returned), rebuild those items as a new
    ActiveCart so the POS page can pick it up for editing, then delete the
    sale entirely so it no longer shows up in Sales History.
    """
    sale = get_object_or_404(Sale, pk=pk)

    cart_items = []
    for item in sale.items.all():
        unit_price = float(item.unit_price)
        discount = float(item.discount)
        percent = round((discount / unit_price) * 100, 2) if unit_price else 0

        if item.item_type == 'LABOR':
            cart_items.append({
                'id': f"labor_{uuid.uuid4().hex}",
                'item_type': 'LABOR',
                'name': item.description,
                'sell_price': unit_price,
                'cost': float(item.unit_cost or 0),
                'quantity': item.quantity,
                'discountAmount': discount,
                'discountPercentInput': str(percent) if discount else "",
            })
            continue

        part = item.part
        if sale.status != 'CANCELLED':
            part.stock_qty += item.quantity
            part.save()

        cart_items.append({
            **PartSerializer(part).data,
            # Reflect the sale's original pricing/warranty, not the part's
            # current catalog price, so the reversed cart matches what the
            # customer was actually charged.
            'sell_price': unit_price,
            'quantity': item.quantity,
            'discountAmount': discount,
            'discountPercentInput': str(percent) if discount else "",
            'warranty': item.warranty_period_months,
        })

    # Carry the sale's own day over as the cart's backdate, so the redone sale
    # is recorded when it actually happened rather than on the day it was
    # corrected. Local date: an evening sale is already "tomorrow" in UTC.
    # A sale from today needs no backdate.
    sale_day = timezone.localtime(sale.created_at).date()
    # Likewise the payment decision: a credit or part-paid sale comes back as
    # one, with the amount already received (including any later top-ups) and
    # its note, so redoing it doesn't silently turn it into a paid sale. The
    # amount is kept as the cart stores it — typed text, "5000" not "5000.00".
    payment_mode = sale.payment_status if sale.payment_status in ('PARTIAL', 'CREDIT') else 'PAID'
    partial_amount_paid = ''
    if payment_mode == 'PARTIAL':
        partial_amount_paid = format(Decimal(str(sale.amount_paid)).normalize(), 'f')
    cart = ActiveCart.objects.create(
        id=f"cart_reversed_{uuid.uuid4().hex[:12]}",
        customer_name=sale.customer_name,
        vehicle_number=sale.vehicle_number or '',
        items=cart_items,
        mileage=sale.mileage,
        notes=sale.notes,
        sale_date=sale_day if sale_day != timezone.localdate() else None,
        payment_mode=payment_mode,
        partial_amount_paid=partial_amount_paid,
        credit_note=(sale.credit_note or '') if payment_mode != 'PAID' else '',
    )

    sale.delete()

    return Response(ActiveCartSerializer(cart).data, status=status.HTTP_200_OK)


@api_view(['POST'])
def mark_sale_paid(request, pk):
    """
    Settle a credit (pay-later) or partially-paid sale's outstanding balance.
    POST body: { "amount": <optional> } — an amount less than the remaining
    balance records a further partial payment (status stays/becomes PARTIAL);
    omitting it (or sending the full remaining balance) settles it in full.
    """
    sale = get_object_or_404(Sale, pk=pk)

    if sale.payment_status not in ('CREDIT', 'PARTIAL'):
        return Response({"error": "This sale has no pending balance."}, status=status.HTTP_400_BAD_REQUEST)

    total = Decimal(str(sale.total_amount))
    already_paid = Decimal(str(sale.amount_paid or 0))
    due = total - already_paid

    amount = request.data.get('amount')
    if amount in (None, ''):
        settle_amount = due
    else:
        try:
            settle_amount = Decimal(str(amount))
        except (InvalidOperation, TypeError):
            return Response({"error": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if settle_amount <= 0:
            return Response({"error": "Amount must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
        if settle_amount > due:
            return Response({"error": f"Amount exceeds the outstanding balance of {due}."}, status=status.HTTP_400_BAD_REQUEST)

    new_paid = already_paid + settle_amount
    if new_paid >= total:
        sale.amount_paid = total
        sale.payment_status = 'PAID'
        sale.credit_settled_at = timezone.now()
    else:
        sale.amount_paid = new_paid
        sale.payment_status = 'PARTIAL'
    sale.save()

    return Response(SaleSerializer(sale).data)


# --- REPAIR / LABOUR VIEWS ---
# How many past labour lines to scan when building suggestions. Grouping happens
# in Python rather than in SQL because the bucket key is a normalised string, so
# the window keeps the work bounded on a shop with years of history.
REPAIR_HISTORY_WINDOW = 5000
# Extra rows pulled for the cart's own vehicle, so a repair last done on it years
# ago still shows up even when it falls outside the window above.
REPAIR_VEHICLE_WINDOW = 500
# Past bills shown under a suggestion.
REPAIR_RECENT_LIMIT = 5
# Labour lines read for a Past Charges search — every bill for one repair, but
# bounded for a very common one.
REPAIR_CHARGE_HISTORY_LIMIT = 500


def _most_used_spelling(spellings):
    """
    The wording the shop actually uses for a repair, not whichever typo was
    typed most recently. Rows are counted newest-first, so Counter ties break
    towards the more recent wording.
    """
    return spellings.most_common(1)[0][0]


@api_view(['GET'])
def get_repair_charge_history(request):
    """
    GET /repairs/history/?q=brake pad — what a repair has actually been charged,
    for the Past Charges tab on the Repair Services page. Every word typed must
    start a word in the description (any order, any case) — so "pad" finds
    "Brake pads" but "oil" doesn't drag in "Ignition coil". Matching lines from
    completed sales are grouped the way the POS suggestions group them, each
    group with its price stats and every bill, newest first.
    """
    words = (request.query_params.get('q') or '').split()
    if len(''.join(words)) < 2:
        return Response([])

    lines = (SaleItem.objects
             .filter(item_type='LABOR', sale__status='COMPLETED')
             .exclude(description=''))
    for word in words:
        lines = lines.filter(description__iregex=r'(^|[^a-z0-9])' + re.escape(word.lower()))
    lines = lines.select_related('sale').order_by('-sale__created_at')[:REPAIR_CHARGE_HISTORY_LIMIT]

    groups = {}
    for line in lines:
        key = normalize_repair_description(line.description)
        group = groups.setdefault(key, {'spellings': Counter(), 'bills': []})
        group['spellings'][' '.join(line.description.split())] += 1
        group['bills'].append({
            'sale_id': str(line.sale_id),
            'date': line.sale.created_at,
            'vehicle_number': line.sale.vehicle_number or '',
            'customer_name': line.sale.customer_name or '',
            'quantity': line.quantity,
            'unit_price': line.unit_price,
            'discount': line.discount,
            'total_price': line.total_price,
        })

    catalog = {
        normalize_repair_description(s.name): s.default_price
        for s in RepairService.objects.filter(is_active=True)
    }

    results = []
    for key, group in groups.items():
        bills = group['bills']
        prices = [b['unit_price'] for b in bills]
        results.append({
            'description': _most_used_spelling(group['spellings']),
            'catalog_price': catalog.get(key),
            'times_billed': len(bills),
            'last_price': bills[0]['unit_price'],
            'last_billed_at': bills[0]['date'],
            'min_price': min(prices),
            'max_price': max(prices),
            'average_price': round(sum(prices) / len(prices), 2),
            'bills': bills,
        })
    results.sort(key=lambda g: g['last_billed_at'], reverse=True)
    return Response(results)


@api_view(['GET'])
def get_repair_suggestions(request):
    """
    Every repair/labour description ever billed, with what it was charged at.

    Powers the price-recall dropdown in the POS "Add Repair / Labor" modal:
    descriptions are typed free-hand, so this groups them case- and
    whitespace-insensitively and reports the last price, the range, and the last
    few actual bills. Passing ?vehicle_number= floats that vehicle's own bills to
    the top of each suggestion, since repeat customers notice a price change.
    """
    plate = request.query_params.get('vehicle_number', '').strip()

    base = (
        SaleItem.objects
        .filter(item_type='LABOR', sale__status='COMPLETED')
        .exclude(description='')
        .order_by('-sale__created_at')
        .values('id', 'description', 'unit_price', 'quantity',
                'sale__created_at', 'sale__vehicle_number')
    )

    rows = list(base[:REPAIR_HISTORY_WINDOW])
    if plate:
        rows += list(base.filter(sale__vehicle_number__iexact=plate)[:REPAIR_VEHICLE_WINDOW])

    # The two queries overlap; keep one copy of each line, newest first.
    seen = set()
    unique_rows = []
    for row in rows:
        if row['id'] in seen:
            continue
        seen.add(row['id'])
        unique_rows.append(row)
    unique_rows.sort(key=lambda r: r['sale__created_at'], reverse=True)

    plate_key = plate.lower()
    buckets = {}
    for row in unique_rows:
        key = normalize_repair_description(row['description'])
        if not key:
            continue
        bucket = buckets.get(key)
        if bucket is None:
            bucket = buckets[key] = {
                'spellings': Counter(),
                'last_price': row['unit_price'],
                'min_price': row['unit_price'],
                'max_price': row['unit_price'],
                'times_billed': 0,
                'last_billed_at': row['sale__created_at'],
                'recent': [],
            }
        bucket['times_billed'] += 1
        bucket['spellings'][' '.join(row['description'].split())] += 1
        bucket['min_price'] = min(bucket['min_price'], row['unit_price'])
        bucket['max_price'] = max(bucket['max_price'], row['unit_price'])
        bucket['recent'].append({
            'date': row['sale__created_at'],
            'vehicle_number': row['sale__vehicle_number'] or '',
            'unit_price': row['unit_price'],
            'quantity': row['quantity'],
            'is_this_vehicle': bool(plate) and (row['sale__vehicle_number'] or '').lower() == plate_key,
        })

    suggestions = []
    for bucket in buckets.values():
        # Offer back the spelling the shop actually uses, not whichever typo
        # happened to be typed most recently. Rows were consumed newest-first,
        # so Counter ties already break towards the more recent wording.
        bucket['description'] = _most_used_spelling(bucket.pop('spellings'))
        # This vehicle's own bills first, each group still newest-first.
        bucket['recent'].sort(key=lambda r: (not r['is_this_vehicle'], -r['date'].timestamp()))
        bucket['recent'] = bucket['recent'][:REPAIR_RECENT_LIMIT]
        suggestions.append(bucket)

    # Fold in the priced catalog. A catalog entry that has never been billed
    # still needs to be suggestible, and where one exists its price is the
    # authority — history only says what was charged, the catalog says what the
    # job costs.
    for service in RepairService.objects.filter(is_active=True):
        key = normalize_repair_description(service.name)
        bucket = next((b for b in suggestions if normalize_repair_description(b['description']) == key), None)
        if bucket is None:
            bucket = {
                'description': service.name,
                'last_price': service.default_price,
                'min_price': service.default_price,
                'max_price': service.default_price,
                'times_billed': 0,
                'last_billed_at': None,
                'recent': [],
            }
            suggestions.append(bucket)
        else:
            bucket['description'] = service.name
        bucket['is_catalog'] = True
        bucket['catalog_price'] = service.default_price

    for bucket in suggestions:
        bucket.setdefault('is_catalog', False)
        bucket.setdefault('catalog_price', None)

    # Catalog first, then everything else by how recently it was billed.
    suggestions.sort(
        key=lambda b: (
            not b['is_catalog'],
            -(b['last_billed_at'].timestamp() if b['last_billed_at'] else 0),
        )
    )
    return Response(suggestions)


@api_view(['GET'])
def get_repair_services(request):
    """The priced repair catalog. ?include_inactive=1 to also list retired ones."""
    qs = RepairService.objects.all()
    if request.query_params.get('include_inactive') not in ('1', 'true', 'True'):
        qs = qs.filter(is_active=True)
    return Response(RepairServiceSerializer(qs, many=True).data)


@api_view(['POST'])
def add_repair_service(request):
    serializer = RepairServiceSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    # The case-insensitive unique constraint is enforced in the DB, so check
    # here to answer with a usable message instead of an IntegrityError.
    name = serializer.validated_data.get('name', '')
    if RepairService.objects.filter(name__iexact=name.strip()).exists():
        return Response(
            {"error": f"A repair service named '{name.strip()}' already exists."},
            status=status.HTTP_400_BAD_REQUEST
        )
    serializer.save(name=name.strip())
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'PUT'])
def update_repair_service(request, pk):
    service = get_object_or_404(RepairService, pk=pk)
    serializer = RepairServiceSerializer(service, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    name = serializer.validated_data.get('name')
    if name is not None:
        name = name.strip()
        if RepairService.objects.filter(name__iexact=name).exclude(pk=pk).exists():
            return Response(
                {"error": f"A repair service named '{name}' already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer.save(name=name)
    else:
        serializer.save()
    return Response(serializer.data)


@api_view(['DELETE'])
def delete_repair_service(request, pk):
    service = get_object_or_404(RepairService, pk=pk)
    service.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
def bulk_add_repair_services(request):
    """
    Create or re-price many services at once, from the catalog page's paste box.

    Existing names are re-priced rather than rejected: pasting an updated price
    list over the top of the current one is the obvious way to use this, and
    erroring on every row the shop already has would make that useless.

    Nothing is written unless every row is valid — a half-applied price list is
    worse than a rejected one, because there is no way to tell which half took.
    """
    services = request.data.get('services')
    if not isinstance(services, list) or not services:
        return Response({"error": "No services provided."}, status=status.HTTP_400_BAD_REQUEST)

    errors = []
    cleaned = []
    seen = {}
    for index, entry in enumerate(services):
        row = index + 1
        if not isinstance(entry, dict):
            errors.append({"row": row, "error": "Malformed entry."})
            continue

        name = str(entry.get('name', '')).strip()
        if not name:
            errors.append({"row": row, "error": "Missing a name."})
            continue
        if len(name) > 255:
            errors.append({"row": row, "name": name, "error": "Name is longer than 255 characters."})
            continue

        try:
            price = Decimal(str(entry.get('default_price', '')).strip())
        except (InvalidOperation, TypeError):
            errors.append({"row": row, "name": name, "error": "Price is not a number."})
            continue
        if price < 0:
            errors.append({"row": row, "name": name, "error": "Price cannot be negative."})
            continue

        # Catch names repeated inside the paste itself, which would otherwise
        # resolve to whichever row happened to be applied last.
        key = normalize_repair_description(name)
        if key in seen:
            errors.append({
                "row": row, "name": name,
                "error": f"Listed twice — also on row {seen[key]}.",
            })
            continue
        seen[key] = row
        cleaned.append((name, price))

    if errors:
        return Response(
            {"error": "Nothing was saved — fix these rows and try again.", "rows": errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    created = updated = 0
    with transaction.atomic():
        for name, price in cleaned:
            existing = RepairService.objects.filter(name__iexact=name).first()
            if existing:
                existing.default_price = price
                existing.is_active = True
                existing.save()
                updated += 1
            else:
                RepairService.objects.create(name=name, default_price=price)
                created += 1

    return Response({"created": created, "updated": updated}, status=status.HTTP_201_CREATED)


# --- ESTIMATE VIEWS ---
def _resolve_estimate_vehicle(vehicle_number, make_model):
    """
    Normalize the plate the same way lookup_vehicle does, find it in the
    registry, and register it if it's new — so an estimate's vehicle FK always
    holds and the vehicle page can list it. Returns (vehicle, normalized_plate).
    """
    plate = (vehicle_number or '').strip().upper()
    if not plate:
        return None, ''

    vehicle = CustomerVehicle.objects.filter(vehicle_number__iexact=plate).first()
    if vehicle is None:
        # "TATA Ace" -> make "TATA", model "Ace"; a single word is all make.
        make, _, model = (make_model or '').strip().partition(' ')
        vehicle = CustomerVehicle.objects.create(
            vehicle_number=plate,
            make=make[:50],
            model=model.strip()[:50],
        )
    return vehicle, plate


def _next_estimate_number():
    """Sequential EST-0001, EST-0002, ... derived from the current maximum."""
    highest = 0
    for number in Estimate.objects.exclude(estimate_number='').values_list('estimate_number', flat=True):
        digits = number.rsplit('-', 1)[-1]
        if digits.isdigit():
            highest = max(highest, int(digits))
    return f"EST-{highest + 1:04d}"


@api_view(['GET'])
def get_estimates(request):
    """List saved estimates, optionally searching by reference, plate or insurer."""
    search = request.query_params.get('search', '').strip()
    qs = Estimate.objects.select_related('vehicle__customer')
    if search:
        qs = qs.filter(
            Q(estimate_number__icontains=search) |
            Q(vehicle_number__icontains=search) |
            Q(insurance_company__icontains=search) |
            Q(make_model__icontains=search)
        )
    return Response(EstimateSerializer(qs, many=True).data)


@api_view(['GET'])
def get_estimate(request, pk):
    """A single estimate, for loading it back into the builder."""
    estimate = get_object_or_404(Estimate.objects.select_related('vehicle__customer'), pk=pk)
    return Response(EstimateSerializer(estimate).data)


@api_view(['POST'])
@transaction.atomic
def create_estimate(request):
    """
    Save a new estimate. The plate is auto-registered in the vehicle registry if
    it isn't there yet, so the estimate is always linked to a real vehicle.
    """
    serializer = EstimateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    vehicle, plate = _resolve_estimate_vehicle(
        serializer.validated_data.get('vehicle_number'),
        serializer.validated_data.get('make_model'),
    )
    estimate = serializer.save(
        vehicle=vehicle,
        vehicle_number=plate,
        estimate_number=_next_estimate_number(),
    )
    return Response(EstimateSerializer(estimate).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@transaction.atomic
def update_estimate(request, pk):
    """Edit a saved estimate. Changing the plate re-points the vehicle link."""
    estimate = get_object_or_404(Estimate, pk=pk)
    serializer = EstimateSerializer(estimate, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    extra = {}
    if 'vehicle_number' in serializer.validated_data:
        vehicle, plate = _resolve_estimate_vehicle(
            serializer.validated_data.get('vehicle_number'),
            serializer.validated_data.get('make_model', estimate.make_model),
        )
        extra = {'vehicle': vehicle, 'vehicle_number': plate}

    estimate = serializer.save(**extra)
    return Response(EstimateSerializer(estimate).data)


@api_view(['DELETE'])
def delete_estimate(request, pk):
    estimate = get_object_or_404(Estimate, pk=pk)
    estimate.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def get_vehicle_estimates(request, pk):
    """
    GET /vehicles/registry/<pk>/estimates/
    Every estimate quoted against this vehicle, newest first. Unlike
    get_vehicle_history (which string-matches Sale.vehicle_number), estimates
    carry a real FK, so this traverses the relation.
    """
    vehicle = get_object_or_404(CustomerVehicle, pk=pk)
    return Response(EstimateSerializer(vehicle.estimates.all(), many=True).data)


# --- REPORTING VIEW ---
@api_view(['GET'])
def dashboard_stats(request):
    """
    Returns total sales, total profit, and low stock alerts.
    """
    # Total Revenue
    total_sales = Sale.objects.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    
    # Calculate Profit: (Sell Price - cost at time of sale) * Qty Sold
    profit = 0
    sale_items = SaleItem.objects.all()
    for item in sale_items:
        # Profit = (Revenue with discount) - (Cost)
        # item.unit_price is the marked sell price. item.discount is the deduction.
        # item.cost_price is the cost snapshotted at the time of sale.
        actual_revenue = (item.unit_price - item.discount) * item.quantity
        total_cost = item.cost_price * item.quantity
        profit += (actual_revenue - total_cost)

    # Low Stock Items
    low_stock = Part.objects.filter(stock_qty__lte=F('min_stock_level')).values('name', 'stock_qty')

    return Response({
        "total_revenue": total_sales,
        "total_profit": profit,
        "low_stock_alerts": list(low_stock)
    })


# Dashboard Stats View
@api_view(['GET'])
def get_dashboard_stats(request):
    """
    Calculate financial metrics with date filtering logic
    """
    period = request.query_params.get('period', 'all')
    now = timezone.now()
    
    if period == 'today':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'this_week':
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'this_month':
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = None

    # Base queries
    sales_query = Sale.objects.all()
    sale_items_query = SaleItem.objects.all()
    
    if start_date:
        sales_query = sales_query.filter(created_at__gte=start_date)
        sale_items_query = sale_items_query.filter(sale__created_at__gte=start_date)

    # 1. Total Inventory Value (Current Stock * Buy Price) - UNCHANGED BY DATE
    inventory_data = Part.objects.aggregate(
        total_value=Sum(F('buy_price') * F('stock_qty'))
    )
    total_inventory_value = inventory_data['total_value'] or 0

    # 2. Total Sales Revenue - FILTERED BY DATE
    sales_data = sales_query.aggregate(total=Sum('total_amount'))
    total_sales = sales_data['total'] or 0

    # 3. Calculate Profit - FILTERED BY DATE (Accounts for discounts)
    profit_data = sale_items_query.aggregate(
        total_profit=Sum((F('unit_price') - F('discount') - buy_price_expr()) * F('quantity'))
    )
    total_profit = profit_data['total_profit'] or 0

    # 4. Spending per Supplier - UNCHANGED BY DATE
    supplier_stats = Part.objects.values('supplier__name').annotate(
        total_spent=Sum(F('buy_price') * F('stock_qty')),
        part_count=Sum('stock_qty')
    ).order_by('-total_spent')

    # 5. Stock Alerts Count - UNCHANGED BY DATE
    out_of_stock_count = Part.objects.filter(stock_qty=0).count()
    low_stock_count = Part.objects.filter(stock_qty=1).count()

    # 6. Top Sold Parts - FILTERED BY DATE
    top_parts_ids_query = SaleItem.objects.filter(sale__status='COMPLETED')
    if start_date:
        top_parts_ids_query = top_parts_ids_query.filter(sale__created_at__gte=start_date)
        
    top_parts_ids = top_parts_ids_query.values('part_id')\
        .annotate(total_sold=Sum('quantity'))\
        .order_by('-total_sold')[:5]

    top_sold_parts = []
    for item in top_parts_ids:
        try:
            part = Part.objects.get(id=item['part_id'])
            part_data = PartMinimalSerializer(part, context={'request': request}).data
            part_data['total_sold'] = item['total_sold']
            top_sold_parts.append(part_data)
        except Part.DoesNotExist:
            continue

    # 7. Sales Trend (Revenue and Profit by day)
    trend_query = sales_query.filter(status='COMPLETED')\
        .annotate(date=TruncDate('created_at'))\
        .values('date')\
        .annotate(daily_revenue=Sum('total_amount'))\
        .order_by('date')
        
    profit_trend_query = sale_items_query.filter(sale__status='COMPLETED')\
        .annotate(date=TruncDate('sale__created_at'))\
        .values('date')\
        .annotate(daily_profit=Sum((F('unit_price') - F('discount') - buy_price_expr()) * F('quantity')))\
        .order_by('date')
    
    trend_dict = {}
    for t in trend_query:
        if t['date']:
            trend_dict[t['date']] = {"revenue": t['daily_revenue'], "profit": 0}
            
    for p in profit_trend_query:
        if p['date']:
            if p['date'] not in trend_dict:
                trend_dict[p['date']] = {"revenue": 0, "profit": 0}
            trend_dict[p['date']]["profit"] = p['daily_profit'] or 0

    sales_trend = []
    for d in sorted(trend_dict.keys()):
        sales_trend.append({
            "date": d.strftime('%b %d'),
            "revenue": trend_dict[d]["revenue"],
            "profit": trend_dict[d]["profit"]
        })

    return Response({
        "total_inventory_value": total_inventory_value,
        "total_sales": total_sales,
        "total_profit": total_profit,
        "supplier_stats": supplier_stats,
        "out_of_stock_count": out_of_stock_count,
        "low_stock_count": low_stock_count,
        "top_sold_parts": top_sold_parts,
        "sales_trend": sales_trend
    })

# --- SALES REPORTS (daily & monthly) ---
def _local_midnight(day):
    from datetime import datetime
    return timezone.make_aware(datetime.combine(day, datetime.min.time()), timezone.get_current_timezone())


def _sales_summary(start, end):
    """
    Sales maths shared by the daily and monthly reports, for completed sales
    in [start, end). Profit uses each line's cost snapshotted at the time of
    sale (SaleItem.cost_price). Labour usually costs nothing, but a repair can
    carry what the shop paid for it (outside part, sublet work); that comes
    off profit and is totalled as labor_cost, kept apart from parts COGS.

    Returns (totals, sales, items). Each sale carries a `_local` datetime for
    bucketing by hour/day — strip it before sending.
    """
    tz = timezone.get_current_timezone()
    window = Q(created_at__gte=start, created_at__lt=end)
    completed = (
        Sale.objects.filter(window, status='COMPLETED')
        .order_by('created_at')
        .prefetch_related('items__part')
    )

    zero = Decimal('0')
    t = {
        "revenue": zero, "collected": zero, "profit": zero, "cogs": zero,
        "parts_revenue": zero, "labor_revenue": zero, "labor_cost": zero, "discount_total": zero,
        "units_sold": 0, "raised_lines": 0,
    }
    sales, items = [], []

    for sale in completed:
        local = timezone.localtime(sale.created_at, tz)
        sale_total = sale.total_amount or zero
        paid = min(sale.amount_paid or zero, sale_total)
        t["revenue"] += sale_total
        t["collected"] += paid

        sale_profit = zero
        sale_items = []
        for item in sale.items.all():
            is_labor = item.item_type == 'LABOR' or item.part_id is None
            buy_price = item.cost_price or zero
            line_total = item.total_price
            line_profit = (item.unit_price - item.discount - buy_price) * item.quantity
            line_discount = item.discount * item.quantity
            raised = not is_labor and item.list_price is not None and item.unit_price > item.list_price

            sale_profit += line_profit
            t["discount_total"] += line_discount
            if is_labor:
                t["labor_revenue"] += line_total
                t["labor_cost"] += buy_price * item.quantity
            else:
                t["parts_revenue"] += line_total
                t["cogs"] += buy_price * item.quantity
                t["units_sold"] += item.quantity
            if raised:
                t["raised_lines"] += 1

            row = {
                "sale_id": str(sale.id),
                "time": local.strftime('%H:%M'),
                "vehicle_number": sale.vehicle_number or "",
                "item_type": 'LABOR' if is_labor else 'PART',
                "part_id": None if is_labor else str(item.part_id),
                "part_name": item.description if is_labor else item.part.name,
                "part_number": "" if is_labor else item.part.part_number,
                "unit_price": item.unit_price,
                "list_price": item.list_price,
                "price_raised": raised,
                "quantity": item.quantity,
                "discount": item.discount,
                "discount_total": line_discount,
                "total_price": line_total,
                "unit_cost": buy_price,
                "profit": line_profit,
            }
            items.append(row)
            sale_items.append(row)

        t["profit"] += sale_profit
        sales.append({
            "_local": local,
            "id": str(sale.id),
            "time": local.strftime('%H:%M'),
            "customer_name": sale.customer_name,
            "vehicle_number": sale.vehicle_number or "",
            "payment_status": sale.payment_status,
            "total_amount": sale_total,
            "amount_paid": paid,
            "balance_due": max(sale_total - paid, zero),
            "profit": sale_profit,
            "items": sale_items,
        })

    count = len(sales)
    revenue, profit, cogs = t["revenue"], t["profit"], t["cogs"]
    totals = {
        "today_revenue": revenue,
        "today_profit": profit,
        "today_sales_count": count,
        "total_investment": cogs,
        "roi_percentage": round(float(profit) / float(cogs) * 100, 2) if cogs > 0 else 0.0,
        "margin_percentage": round(float(profit) / float(revenue) * 100, 2) if revenue > 0 else 0.0,
        "average_sale": round(float(revenue) / count, 2) if count else 0,
        "parts_revenue": t["parts_revenue"],
        "labor_revenue": t["labor_revenue"],
        "labor_cost": t["labor_cost"],
        "discount_total": t["discount_total"],
        "collected": t["collected"],
        "balance_due": max(revenue - t["collected"], zero),
        "units_sold": t["units_sold"],
        "price_raised_lines": t["raised_lines"],
        "cancelled_count": Sale.objects.filter(window, status='CANCELLED').count(),
    }
    return totals, sales, items


def _strip_local(sales):
    return [{k: v for k, v in s.items() if k != '_local'} for s in sales]


@api_view(['GET'])
def daily_report(request):
    """End-of-day report for one shop-local date (defaults to today)."""
    from datetime import datetime

    date_str = request.query_params.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
    else:
        # localdate(), not now().replace(hour=0): the latter is UTC midnight,
        # which puts Colombo's 00:00-05:30 sales on the wrong day.
        target_date = timezone.localdate()

    start_date = _local_midnight(target_date)
    totals, sales, items = _sales_summary(start_date, _local_midnight(target_date + timedelta(days=1)))

    # Hourly buckets: shop hours always shown, plus any other hour with sales.
    hours = {h: {"hour": f"{h:02d}:00", "revenue": 0.0, "profit": 0.0, "sales": 0} for h in range(8, 20)}
    for sale in sales:
        h = sale["_local"].hour
        bucket = hours.setdefault(h, {"hour": f"{h:02d}:00", "revenue": 0.0, "profit": 0.0, "sales": 0})
        bucket["revenue"] += float(sale["total_amount"])
        bucket["profit"] += float(sale["profit"])
        bucket["sales"] += 1

    # Compare against the average day *before* the target date: the target
    # day itself (possibly still in progress) shouldn't drag its own baseline.
    tz = timezone.get_current_timezone()
    earlier = Sale.objects.filter(status='COMPLETED', created_at__lt=start_date)
    first_sale = earlier.order_by('created_at').first()
    avg_daily_revenue = None
    percentage_change = None
    if first_sale:
        first_day = timezone.localtime(first_sale.created_at, tz).date()
        days_before = max((target_date - first_day).days, 1)
        earlier_revenue = earlier.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        avg_daily_revenue = float(earlier_revenue) / days_before
        if avg_daily_revenue > 0:
            percentage_change = round((float(totals["today_revenue"]) - avg_daily_revenue) / avg_daily_revenue * 100, 2)
        avg_daily_revenue = round(avg_daily_revenue, 2)

    return Response({
        "date": target_date.isoformat(),
        "is_today": target_date == timezone.localdate(),
        **totals,
        "percentage_change": percentage_change,
        "avg_daily_revenue": avg_daily_revenue,
        "items": items,
        "sales": _strip_local(sales),
        "chart_data": [hours[h] for h in sorted(hours)],
    })


def _month_salary_cost(year, month):
    """
    What the month's wages cost the shop: gross pay (attendance pay +
    allowances - deductions) plus employer EPF 12% and ETF 3%. The employee's
    8% EPF comes out of their gross pay, so it isn't added again; salary
    advances only change when the money goes out, not how much.

    Saved Payroll rows are used where they exist; anyone else currently
    employed is estimated from attendance with the same rules (nothing saved).
    """
    from .payroll import calculate_payroll

    zero = Decimal('0')
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    payrolls = {p.employee_id: p for p in Payroll.objects.filter(year=year, month=month).select_related('employee')}
    employees = list(
        Employee.objects.filter(Q(is_active=True, date_joined__lte=month_end) | Q(id__in=payrolls.keys()))
        .distinct().order_by('first_name', 'last_name')
    )

    holidays = marks = None
    rows, total = [], zero
    for emp in employees:
        p = payrolls.get(emp.id)
        if p:
            gross = (p.earnings or zero) + (p.allowances or zero) - (p.deductions or zero)
            employer = (p.epf_employer or zero) + (p.etf_employer or zero)
            source = 'PAID' if p.status == 'PAID' else 'CALCULATED'
        else:
            if holidays is None:
                holidays = {h.date: h for h in Holiday.objects.filter(date__year=year, date__month=month)}
                marks = {}
                for att in Attendance.objects.filter(date__year=year, date__month=month):
                    marks.setdefault(att.employee_id, {})[att.date] = att
            calc = calculate_payroll(emp, year, month, marks.get(emp.id, {}), holidays)
            gross = calc['earnings']
            employer = calc['epf_employer'] + calc['etf_employer']
            source = 'ESTIMATED'
        cost = gross + employer
        total += cost
        rows.append({
            "employee": emp.id,
            "name": f"{emp.first_name} {emp.last_name}".strip(),
            "role": emp.role,
            "gross_pay": gross,
            "employer_contributions": employer,
            "cost": cost,
            "source": source,
        })

    sources = {r["source"] for r in rows}
    if not rows:
        salary_source = 'none'
    elif sources == {'ESTIMATED'}:
        salary_source = 'estimate'
    elif 'ESTIMATED' in sources:
        salary_source = 'mixed'
    else:
        salary_source = 'payroll'
    return {
        "salary_cost": total,
        "salary_source": salary_source,
        "salaries_paid_count": sum(1 for r in rows if r["source"] == 'PAID'),
        "salary_breakdown": rows,
    }


def _month_cheque_cost(year, month, parts_cost, profit_after_salaries, revenue):
    """
    Supplier cheques dated in the month (cancelled ones excluded). They are paid
    out of revenue: first from the money that went into the parts sold this
    month (cost of parts sold, meant to be reinvested in stock), and only what
    goes beyond that comes out of profit.
    """
    zero = Decimal('0')
    cheques = list(
        SupplierCheque.objects
        .filter(cheque_date__year=year, cheque_date__month=month)
        .exclude(status=SupplierCheque.STATUS_CANCELLED)
        .select_related('supplier')
        .prefetch_related('allocations__invoice')
        .order_by('cheque_date', 'id')
    )
    total = sum((c.amount for c in cheques), zero)
    from_parts = min(total, parts_cost)
    from_profit = max(total - parts_cost, zero)
    after = profit_after_salaries - from_profit
    return {
        "cheque_cost": total,
        "cheque_count": len(cheques),
        "cheques_from_parts_cost": from_parts,
        "cheques_from_profit": from_profit,
        "parts_cost_remaining": max(parts_cost - total, zero),
        "profit_after_cheques": after,
        "profit_after_cheques_margin": round(float(after) / float(revenue) * 100, 2) if revenue > 0 else 0.0,
        "cheque_breakdown": [
            {
                "id": c.id,
                "supplier": c.supplier_id,
                "supplier_name": c.supplier.name,
                "cheque_number": c.cheque_number,
                "bank": c.bank,
                "cheque_date": c.cheque_date,
                "amount": c.amount,
                "status": c.status,
                "invoice_numbers": [a.invoice.invoice_number for a in c.allocations.all()],
            }
            for c in cheques
        ],
    }


@api_view(['GET'])
def monthly_report(request):
    """Month-to-date or whole-month report (?month=&year=, defaults to now)."""
    today = timezone.localdate()
    parsed = _parse_month(request.query_params) if request.query_params.get('month') else (today.year, today.month)
    if not parsed:
        return Response({"error": "month (1-12) and year are required."}, status=status.HTTP_400_BAD_REQUEST)
    year, month = parsed

    days_in_month = calendar.monthrange(year, month)[1]
    first = date(year, month, 1)
    next_first = first + timedelta(days=days_in_month)
    totals, sales, items = _sales_summary(_local_midnight(first), _local_midnight(next_first))
    is_current = (year, month) == (today.year, today.month)

    # Day by day.
    zero = Decimal('0')
    daily = {
        d: {"date": date(year, month, d).isoformat(), "sales": 0, "revenue": zero,
            "profit": zero, "collected": zero, "balance_due": zero}
        for d in range(1, days_in_month + 1)
    }
    for sale in sales:
        row = daily[sale["_local"].day]
        row["sales"] += 1
        row["revenue"] += sale["total_amount"]
        row["profit"] += sale["profit"]
        row["collected"] += sale["amount_paid"]
        row["balance_due"] += sale["balance_due"]
    daily_rows = [daily[d] for d in sorted(daily)]
    trading = [r for r in daily_rows if r["sales"]]
    best_day = max(trading, key=lambda r: r["revenue"]) if trading else None

    # Best sellers by quantity; labour is one line on its own.
    parts = {}
    for row in items:
        if row["item_type"] != 'PART':
            continue
        p = parts.setdefault(row["part_id"], {
            "part_id": row["part_id"], "part_name": row["part_name"], "part_number": row["part_number"],
            "quantity": 0, "revenue": zero, "profit": zero,
        })
        p["quantity"] += row["quantity"]
        p["revenue"] += row["total_price"]
        p["profit"] += row["profit"]
    top_parts = sorted(parts.values(), key=lambda p: (-p["quantity"], -p["revenue"]))[:10]

    # Previous month — up to the same day of the month while this one is
    # still running, so a half month isn't measured against a whole one.
    prev_last = first - timedelta(days=1)
    prev_first = prev_last.replace(day=1)
    prev_end_day = min(today.day, prev_last.day) if is_current else prev_last.day
    prev_totals, _, _ = _sales_summary(
        _local_midnight(prev_first), _local_midnight(prev_first + timedelta(days=prev_end_day))
    )
    has_earlier = Sale.objects.filter(status='COMPLETED', created_at__lt=_local_midnight(first)).exists()

    def change(now_v, before_v):
        if not has_earlier or not before_v:
            return None
        return round((float(now_v) - float(before_v)) / abs(float(before_v)) * 100, 2)

    salaries = _month_salary_cost(year, month)
    after = totals["today_profit"] - salaries["salary_cost"]
    cheques = _month_cheque_cost(year, month, totals["total_investment"], after, totals["today_revenue"])

    return Response({
        "year": year,
        "month": month,
        "is_current_month": is_current,
        **totals,
        "days_with_sales": len(trading),
        "average_per_trading_day": round(float(totals["today_revenue"]) / len(trading), 2) if trading else 0,
        "best_day": best_day,
        "daily": daily_rows,
        "top_parts": top_parts,
        "previous": {
            "year": prev_first.year,
            "month": prev_first.month,
            "through_day": prev_end_day,
            "partial": is_current,
            "revenue": prev_totals["today_revenue"] if has_earlier else None,
            "profit": prev_totals["today_profit"] if has_earlier else None,
            "revenue_change": change(totals["today_revenue"], prev_totals["today_revenue"]),
            "profit_change": change(totals["today_profit"], prev_totals["today_profit"]),
        },
        **salaries,
        "profit_after_salaries": after,
        "profit_after_salaries_margin": (
            round(float(after) / float(totals["today_revenue"]) * 100, 2) if totals["today_revenue"] > 0 else 0.0
        ),
        **cheques,
    })

def parse_vehicle_string(vehicle_str, existing_makes):
    import re
    vehicle_str = vehicle_str.strip()
    if not vehicle_str:
        return None

    # 1. Extract year: look for a 4-digit number starting with 19 or 20
    year_match = re.search(r'\b(19\d{2}|20\d{2})\b', vehicle_str)
    year = None
    if year_match:
        year = int(year_match.group(1))
        span = year_match.span()
        start_idx = span[0]
        end_idx = span[1]
        
        # Check if there is '(' before and ')' after, and remove them
        if start_idx > 0 and vehicle_str[start_idx - 1] == '(':
            start_idx -= 1
        if end_idx < len(vehicle_str) and vehicle_str[end_idx] == ')':
            end_idx += 1
            
        vehicle_str = vehicle_str[:start_idx] + vehicle_str[end_idx:]

    # Clean up spaces
    vehicle_str = re.sub(r'\s+', ' ', vehicle_str).strip()
    if not vehicle_str:
        return None

    # 2. Extract make and model
    # Sort existing makes by length in descending order to match multi-word makes first
    sorted_makes = sorted(existing_makes, key=len, reverse=True)
    make_match = None
    for m in sorted_makes:
        if vehicle_str.lower() == m.lower():
            make_match = m
            vehicle_str = ""
            break
        elif vehicle_str.lower().startswith(m.lower() + ' '):
            make_match = m
            vehicle_str = vehicle_str[len(m):].strip()
            break

    if make_match:
        make = make_match
        model = vehicle_str if vehicle_str else "Unknown"
    else:
        # Fallback: first word is make, rest is model
        parts = vehicle_str.split(' ')
        make = parts[0]
        model = ' '.join(parts[1:]) if len(parts) > 1 else "Unknown"

    # Vehicle.make/model are CharField(max_length=50) — guard against freeform
    # "fits vehicles" text (or a make that failed to match and swallowed the
    # whole remaining string as the model) overflowing the DB column.
    return {
        'make': make.strip()[:50],
        'model': model.strip()[:50],
        'year': year
    }


def _get_or_create_vehicle(parsed, existing_makes):
    """
    The catalogue Vehicle for a parsed "make model (year)", matched
    case-insensitively, or a new one. New entries are title-cased like part
    names, so "toyota aqua" is stored as "Toyota Aqua". `existing_makes` is
    extended in place so later entries in the same batch match the new make.
    Returns (vehicle, created).
    """
    vehicle = Vehicle.objects.filter(
        make__iexact=parsed['make'],
        model__iexact=parsed['model'],
        year=parsed['year'],
    ).first()
    if vehicle is None:
        vehicle = Vehicle.objects.create(
            make=title_case_name(parsed['make']),
            model=title_case_name(parsed['model']),
            year=parsed['year'],
        )
        if vehicle.make not in existing_makes:
            existing_makes.append(vehicle.make)
        return vehicle, True
    return vehicle, False

@api_view(['POST'])
def bulk_upload_parts(request):
    """
    Handle bulk uploading parts from an Excel file.
    """
    if 'file' not in request.FILES:
        return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        
    excel_file = request.FILES['file']
    
    if not excel_file.name.endswith('.xlsx') and not excel_file.name.endswith('.xls'):
        return Response({"error": "Invalid file format. Only Excel files are supported."}, status=status.HTTP_400_BAD_REQUEST)

    invoice_number = str(request.data.get('invoice_number', '')).strip()

    try:
        import pandas as pd
        # Read the Excel file, using the first row (index 0) as column headers (skipping the 1st line as data)
        df = pd.read_excel(excel_file, header=0)
        
        # Clean column names to lowercase and strip whitespace for robust case-insensitive lookup
        df.columns = [str(c).strip().lower() for c in df.columns]
        
        created_count = 0
        created_part_ids = []
        conflicts = []

        # Get all existing unique makes for smart parsing of multi-word makes (e.g. "Land Rover")
        existing_makes = list(Vehicle.objects.values_list('make', flat=True).distinct())
        common_makes = ["Toyota", "Honda", "Nissan", "Mitsubishi", "Suzuki", "Mazda", "Hyundai", "Kia", "BMW", "Mercedes-Benz", "Audi", "Ford", "Chevrolet", "Land Rover", "Range Rover", "Lexus"]
        for make in common_makes:
            if make not in existing_makes:
                existing_makes.append(make)
                
        # Start transaction for safety
        with transaction.atomic():
            for index, row in df.iterrows():
                # Normalize keys of the row to lowercase and strip
                row_dict = {str(k).strip().lower(): v for k, v in row.items()}
                
                # Get and clean part number
                part_number_raw = row_dict.get('part number')
                if pd.isna(part_number_raw):
                    continue
                
                if isinstance(part_number_raw, float) and part_number_raw.is_integer():
                    part_number = str(int(part_number_raw))
                else:
                    part_number = str(part_number_raw).strip()
                    if part_number.endswith('.0'):
                        part_number = part_number[:-2]
                        
                if not part_number or part_number.lower() == 'nan':
                    continue
                
                # Extract values
                name = str(row_dict.get('part name', '')).strip()
                if not name or name.lower() == 'nan':
                    name = "Unnamed Part"
                    
                brand = str(row_dict.get('brand', '')).strip()
                if not brand or brand.lower() == 'nan':
                    brand = ""
                    
                # Handle Supplier
                supplier_name = str(row_dict.get('supplier', '')).strip()
                supplier_obj = None
                if supplier_name and supplier_name.lower() != 'nan':
                    supplier_obj, _ = Supplier.objects.get_or_create(name=supplier_name)
                    
                # Robustly find prices, stock, and location by checking multiple possible name variants
                cost_keys = ['cost price', 'cost_price', 'buy price', 'buy_price', 'cost']
                sell_keys = ['selling price', 'selling_price', 'sell price', 'sell_price', 'price']
                stock_keys = ['current stock', 'current_stock', 'stock qty', 'stock_qty', 'stock', 'qty']
                location_keys = ['rack/bin location', 'rack / bin location', 'rack location', 'rack_location', 'location']
                fits_keys = ['fits vehicles', 'fits_vehicles', 'compatible vehicles', 'compatible_vehicles', 'fits', 'vehicles']
                
                cost_val = next((row_dict[k] for k in cost_keys if k in row_dict), 0)
                sell_val = next((row_dict[k] for k in sell_keys if k in row_dict), 0)
                stock_val = next((row_dict[k] for k in stock_keys if k in row_dict), 0)
                loc_val = next((row_dict[k] for k in location_keys if k in row_dict), "")
                
                try:
                    buy_price = float(cost_val) if pd.notna(cost_val) else 0.0
                except (ValueError, TypeError):
                    buy_price = 0.0
                    
                try:
                    sell_price = float(sell_val) if pd.notna(sell_val) else 0.0
                except (ValueError, TypeError):
                    sell_price = 0.0
                    
                try:
                    stock_qty = int(stock_val) if pd.notna(stock_val) else 0
                except (ValueError, TypeError):
                    stock_qty = 0
                    
                rack_location = str(loc_val).strip() if pd.notna(loc_val) and str(loc_val).lower() != 'nan' else ""
                
                # Check for fits/compatible vehicles
                has_fits_col = any(k in row_dict for k in fits_keys)
                vehicle_objs = []
                if has_fits_col:
                    fits_val = next((row_dict[k] for k in fits_keys if k in row_dict), None)
                    if pd.notna(fits_val) and str(fits_val).strip() != "" and str(fits_val).lower() != 'nan':
                        import re
                        vehicle_strs = re.split(r'[,;]+', str(fits_val))
                        for v_str in vehicle_strs:
                            parsed = parse_vehicle_string(v_str, existing_makes)
                            if parsed:
                                vehicle_objs.append(_get_or_create_vehicle(parsed, existing_makes)[0])
                                
                # Find if part already exists
                existing_part = Part.objects.filter(part_number=part_number).first()

                if existing_part:
                    # Don't merge automatically — collect both versions so the
                    # user can resolve each field (existing / new / custom) on the frontend.
                    supplier_display = supplier_name if supplier_name and supplier_name.lower() != 'nan' else ""
                    conflicts.append({
                        "part_number": part_number,
                        "existing": {
                            "id": str(existing_part.id),
                            "name": existing_part.name,
                            "brand": existing_part.brand,
                            "supplier": existing_part.supplier.name if existing_part.supplier else "",
                            "buy_price": float(existing_part.buy_price),
                            "sell_price": float(existing_part.sell_price),
                            "stock_qty": existing_part.stock_qty,
                            "rack_location": existing_part.rack_location,
                            "compatible_vehicles": [str(v) for v in existing_part.compatible_vehicles.all()],
                        },
                        "new": {
                            "name": name,
                            "brand": brand,
                            "supplier": supplier_display,
                            "buy_price": buy_price,
                            "sell_price": sell_price,
                            "stock_qty": stock_qty,
                            "rack_location": rack_location,
                            "compatible_vehicles": [str(v) for v in vehicle_objs] if has_fits_col else None,
                        },
                    })
                else:
                    # Create new part
                    new_part = Part.objects.create(
                        part_number=part_number,
                        name=name,
                        brand=brand,
                        supplier=supplier_obj,
                        buy_price=buy_price,
                        sell_price=sell_price,
                        stock_qty=stock_qty,
                        rack_location=rack_location,
                    )
                    if has_fits_col:
                        new_part.compatible_vehicles.set(vehicle_objs)
                    if stock_qty > 0:
                        RestockRecord.objects.create(
                            part=new_part,
                            supplier=supplier_obj,
                            quantity=stock_qty,
                            buy_price=buy_price,
                            notes="Initial stock from bulk Excel upload",
                            invoice_number=invoice_number,
                        )
                    created_count += 1
                    created_part_ids.append(str(new_part.id))

        message = f"Successfully processed Excel file. Created {created_count} new parts."
        if conflicts:
            message += f" {len(conflicts)} part(s) already exist and need conflict resolution."

        return Response({
            "message": message,
            "created": created_count,
            "created_part_ids": created_part_ids,
            "conflicts": conflicts,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": f"Error processing file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def resolve_bulk_upload_conflicts(request):
    """
    Apply user-resolved field values for parts that already existed during a
    bulk Excel upload (see bulk_upload_parts). For each conflicting part number,
    the frontend sends the final chosen value per field (existing / new / a
    custom value the user typed in) and this simply writes those values.
    """
    resolutions = request.data.get('resolutions')
    if not isinstance(resolutions, list):
        return Response({"error": "Expected a list of resolutions."}, status=status.HTTP_400_BAD_REQUEST)

    invoice_number = str(request.data.get('invoice_number', '')).strip()

    existing_makes = list(Vehicle.objects.values_list('make', flat=True).distinct())
    updated_count = 0
    errors = []

    with transaction.atomic():
        for res in resolutions:
            part_number = res.get('part_number')
            part = Part.objects.filter(part_number=part_number).first()
            if not part:
                errors.append(f"Part {part_number} not found.")
                continue

            old_qty = part.stock_qty

            part.name = str(res.get('name', part.name)).strip() or part.name
            part.brand = str(res.get('brand', part.brand)).strip()

            supplier_name = str(res.get('supplier', '')).strip()
            if supplier_name:
                supplier_obj, _ = Supplier.objects.get_or_create(name=supplier_name)
                part.supplier = supplier_obj
            else:
                part.supplier = None

            try:
                part.buy_price = float(res.get('buy_price'))
            except (TypeError, ValueError):
                pass

            try:
                part.sell_price = float(res.get('sell_price'))
            except (TypeError, ValueError):
                pass

            try:
                part.stock_qty = int(res.get('stock_qty'))
            except (TypeError, ValueError):
                pass

            part.rack_location = str(res.get('rack_location', part.rack_location)).strip()
            part.save()

            # Record purchase history for any stock increase, same as the
            # "Add Part" duplicate-part-number path — only the delta counts as a purchase.
            added_qty = part.stock_qty - old_qty
            if added_qty > 0:
                RestockRecord.objects.create(
                    part=part,
                    supplier=part.supplier,
                    quantity=added_qty,
                    buy_price=part.buy_price,
                    notes="Added via bulk Excel upload (conflict resolved)",
                    invoice_number=invoice_number,
                )

            vehicle_strs = res.get('compatible_vehicles')
            if vehicle_strs is not None:
                vehicle_objs = []
                for v_str in vehicle_strs:
                    parsed = parse_vehicle_string(str(v_str), existing_makes)
                    if not parsed:
                        continue
                    vehicle_objs.append(_get_or_create_vehicle(parsed, existing_makes)[0])
                part.compatible_vehicles.set(vehicle_objs)

            updated_count += 1

    return Response({
        "message": f"Successfully updated {updated_count} part(s).",
        "updated": updated_count,
        "errors": errors,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@transaction.atomic
def cancel_bulk_upload(request):
    """
    Abort a bulk Excel upload before conflict resolution is finished.

    bulk_upload_parts already commits brand-new parts (and their initial-stock
    RestockRecords) to the DB immediately, before the user resolves any
    conflicting rows. If the user backs out of the conflict-resolution wizard,
    this deletes those brand-new parts (RestockRecords cascade-delete with
    them) so the aborted upload leaves no trace. Conflicting parts are never
    touched here since resolve_bulk_upload_conflicts only writes them once the
    user explicitly submits resolutions — so there's nothing to revert for those.

    Payload: { "created_part_ids": ["<uuid>", ...] }
    """
    part_ids = request.data.get('created_part_ids', [])
    if not isinstance(part_ids, list):
        return Response({"error": "Expected a list of part ids."}, status=status.HTTP_400_BAD_REQUEST)

    deleted_count = 0
    for pid in part_ids:
        part = Part.objects.filter(pk=pid).first()
        if not part:
            continue
        # Safety: never delete a part that already has sales against it.
        if part.saleitem_set.exists():
            continue
        part.delete()
        deleted_count += 1

    return Response({
        "message": f"Upload cancelled. Removed {deleted_count} part(s).",
        "deleted": deleted_count,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_active_carts(request):
    """
    List all active repairs/carts from the database.

    Newest first, matching the POS tab strip — the most recently opened repair
    sits next to the "+" button instead of scrolling off the far end.
    """
    carts = ActiveCart.objects.all().order_by('-created_at')
    serializer = ActiveCartSerializer(carts, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@transaction.atomic
def sync_active_carts(request):
    """
    Synchronize the frontend carts state with the database.
    Deletes any carts not in the incoming list, and inserts/updates the rest.
    """
    carts_data = request.data
    if not isinstance(carts_data, list):
        return Response({"error": "Expected a list of carts"}, status=status.HTTP_400_BAD_REQUEST)

    # Extract all incoming cart IDs
    incoming_ids = [c.get('id') for c in carts_data if c.get('id')]

    # Delete database active carts that are no longer in the frontend list
    ActiveCart.objects.exclude(id__in=incoming_ids).delete()

    # Update or create incoming active carts
    for cart in carts_data:
        cart_id = cart.get('id')
        if not cart_id:
            continue
        ActiveCart.objects.update_or_create(
            id=cart_id,
            defaults={
                'customer_name': cart.get('customer_name', ''),
                'vehicle_number': cart.get('vehicle_number', ''),
                'customer_id': cart.get('customer'),
                'items': cart.get('items', []),
                'mileage': cart.get('mileage'),
                'notes': cart.get('notes', ''),
                'sale_date': cart.get('sale_date') or None,
                'payment_mode': cart.get('payment_mode') or 'PAID',
                'partial_amount_paid': cart.get('partial_amount_paid', ''),
                'credit_note': cart.get('credit_note', ''),
            }
        )

    # Return the full list of synchronized active carts
    updated_carts = ActiveCart.objects.all().order_by('created_at')
    serializer = ActiveCartSerializer(updated_carts, many=True)
    return Response(serializer.data)


# --- EMPLOYEE VIEWS ---

@api_view(['GET'])
def get_employees(request):
    """List all employees"""
    employees = Employee.objects.all().order_by('-created_at')
    serializer = EmployeeSerializer(employees, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_employee(request):
    """Add a new employee"""
    serializer = EmployeeSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
def update_employee(request, pk):
    """Update employee details"""
    employee = get_object_or_404(Employee, pk=pk)
    serializer = EmployeeSerializer(employee, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def delete_employee(request, pk):
    """Deactivate or delete an employee"""
    employee = get_object_or_404(Employee, pk=pk)
    # If the employee has attendance or payroll records, deactivate them rather than deleting
    if employee.attendances.exists() or employee.payrolls.exists():
        employee.is_active = False
        employee.save()
        return Response({"message": "Employee deactivated due to existing historical records."}, status=status.HTTP_200_OK)
    
    employee.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
def get_employee_attendance(request, pk):
    """
    Get attendance records for a single employee for a specific month and year.
    """
    employee = get_object_or_404(Employee, pk=pk)
    month = request.query_params.get('month')
    year = request.query_params.get('year')
    
    if not month or not year:
        return Response({"error": "Month and Year parameters are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        month = int(month)
        year = int(year)
    except ValueError:
        return Response({"error": "Month and Year must be integers"}, status=status.HTTP_400_BAD_REQUEST)
        
    attendances = Attendance.objects.filter(employee=employee, date__month=month, date__year=year).order_by('date')
    serializer = AttendanceSerializer(attendances, many=True)
    return Response(serializer.data)

def _parse_iso_date(value):
    from datetime import datetime
    try:
        return datetime.strptime(value or '', '%Y-%m-%d').date()
    except ValueError:
        return None


def _parse_month(request_data):
    try:
        month = int(request_data.get('month'))
        year = int(request_data.get('year'))
        if not 1 <= month <= 12:
            raise ValueError
        return year, month
    except (TypeError, ValueError):
        return None


def _employee_label(emp):
    return f"{emp.first_name} {emp.last_name}".strip()


# --- HOLIDAYS ---
@api_view(['GET'])
def get_holidays(request):
    """List holidays, optionally for one year (?year=2026)."""
    holidays = Holiday.objects.all().order_by('date')
    year = request.query_params.get('year')
    if year and year.isdigit():
        holidays = holidays.filter(date__year=int(year))
    return Response(HolidaySerializer(holidays, many=True).data)


@api_view(['POST'])
def add_holiday(request):
    """Mark a date as a holiday (Poya, public, mercantile, shop closed...)."""
    serializer = HolidaySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT', 'PATCH'])
def update_holiday(request, pk):
    holiday = get_object_or_404(Holiday, pk=pk)
    serializer = HolidaySerializer(holiday, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def delete_holiday(request, pk):
    get_object_or_404(Holiday, pk=pk).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- ATTENDANCE ---
_ATTENDANCE_STATUSES = {c[0] for c in Attendance.STATUS_CHOICES}
_LEAVE_REASONS = {c[0] for c in Attendance.REASON_CHOICES}


@api_view(['GET'])
def get_attendance_sheet(request):
    """
    One day's attendance: a row per active employee with their mark (or null
    if not marked yet), whether it's their working day, and the holiday on
    that date, if any.
    """
    target_date = _parse_iso_date(request.query_params.get('date'))
    if not target_date:
        return Response({"error": "A valid date (YYYY-MM-DD) is required."}, status=status.HTTP_400_BAD_REQUEST)

    holiday = Holiday.objects.filter(date=target_date).first()
    marks = {a.employee_id: a for a in Attendance.objects.filter(date=target_date)}
    weekday = target_date.strftime('%A')

    rows = []
    for emp in Employee.objects.filter(is_active=True).order_by('first_name', 'last_name'):
        if emp.date_joined and emp.date_joined > target_date:
            continue
        mark = marks.get(emp.id)
        rows.append({
            "employee": emp.id,
            "employee_name": _employee_label(emp),
            "employee_role": emp.role,
            "is_working_day": weekday in (emp.working_days or []),
            "attendance": AttendanceSerializer(mark).data if mark else None,
        })

    return Response({
        "date": target_date.isoformat(),
        "holiday": HolidaySerializer(holiday).data if holiday else None,
        "rows": rows,
    })


@api_view(['POST'])
@transaction.atomic
def mark_attendance_sheet(request):
    """
    Save attendance for one date — one employee or many.
    Body: { date, attendances: [{ employee, status, leave_reason, informed,
            is_paid, notes } | { employee, clear: true }] }
    """
    target_date = _parse_iso_date(request.data.get('date'))
    if not target_date:
        return Response({"error": "A valid date (YYYY-MM-DD) is required."}, status=status.HTTP_400_BAD_REQUEST)

    saved = []
    for item in request.data.get('attendances', []):
        emp_id = item.get('employee')
        if not emp_id:
            continue
        if item.get('clear'):
            Attendance.objects.filter(employee_id=emp_id, date=target_date).delete()
            continue

        status_val = item.get('status', 'PRESENT')
        if status_val not in _ATTENDANCE_STATUSES:
            return Response({"error": f"Unknown status '{status_val}'."}, status=status.HTTP_400_BAD_REQUEST)

        if status_val == 'PRESENT':
            defaults = {'status': 'PRESENT', 'leave_reason': '', 'informed': None, 'is_paid': False}
        else:
            reason = item.get('leave_reason') or ''
            if reason and reason not in _LEAVE_REASONS:
                return Response({"error": f"Unknown leave reason '{reason}'."}, status=status.HTTP_400_BAD_REQUEST)
            informed = item.get('informed')
            defaults = {
                'status': status_val,
                'leave_reason': reason,
                'informed': None if informed is None else bool(informed),
                'is_paid': bool(item.get('is_paid', False)),
            }
        defaults['notes'] = item.get('notes', '') or ''

        att, _ = Attendance.objects.update_or_create(employee_id=emp_id, date=target_date, defaults=defaults)
        saved.append(att)

    return Response({"saved": AttendanceSerializer(saved, many=True).data})


@api_view(['GET'])
def get_attendance_month(request):
    """
    A month at a glance for the calendar grid: every day, the holidays, and
    each employee's marks keyed by date. Includes inactive employees only if
    they have marks that month.
    """
    parsed = _parse_month(request.query_params)
    if not parsed:
        return Response({"error": "month (1-12) and year are required."}, status=status.HTTP_400_BAD_REQUEST)
    year, month = parsed

    from .payroll import month_days
    days = month_days(year, month)
    holidays = Holiday.objects.filter(date__year=year, date__month=month).order_by('date')
    marks = Attendance.objects.filter(date__year=year, date__month=month).select_related('employee')

    by_employee = {}
    for att in marks:
        by_employee.setdefault(att.employee_id, {})[att.date.isoformat()] = AttendanceSerializer(att).data

    employees = Employee.objects.filter(Q(is_active=True) | Q(id__in=by_employee.keys())).order_by('first_name', 'last_name')
    return Response({
        "year": year,
        "month": month,
        "days": [{"date": d.isoformat(), "weekday": d.strftime('%A')} for d in days],
        "holidays": HolidaySerializer(holidays, many=True).data,
        "employees": [{
            "id": emp.id,
            "name": _employee_label(emp),
            "role": emp.role,
            "is_active": emp.is_active,
            "date_joined": emp.date_joined.isoformat() if emp.date_joined else None,
            "working_days": emp.working_days or [],
            "records": by_employee.get(emp.id, {}),
        } for emp in employees],
    })


@api_view(['GET'])
def get_employee_attendance(request, pk):
    """One employee's marks for a month (?month=&year=)."""
    employee = get_object_or_404(Employee, pk=pk)
    parsed = _parse_month(request.query_params)
    if not parsed:
        return Response({"error": "month (1-12) and year are required."}, status=status.HTTP_400_BAD_REQUEST)
    year, month = parsed
    marks = Attendance.objects.filter(employee=employee, date__year=year, date__month=month).order_by('date')
    return Response(AttendanceSerializer(marks, many=True).data)


# --- PAYROLL ---
@api_view(['GET'])
def get_payroll_list(request):
    parsed = _parse_month(request.query_params)
    if not parsed:
        return Response({"error": "month (1-12) and year are required."}, status=status.HTTP_400_BAD_REQUEST)
    year, month = parsed
    records = Payroll.objects.filter(month=month, year=year).select_related('employee').order_by('employee__first_name')
    return Response(PayrollSerializer(records, many=True).data)


@api_view(['POST'])
@transaction.atomic
def generate_payroll_drafts(request):
    """
    (Re)calculate the month's salaries from attendance and holidays for every
    active employee (see inventory/payroll.py). Allowances, advances,
    deductions and notes typed in are kept; paid months are never touched.
    """
    parsed = _parse_month(request.data)
    if not parsed:
        return Response({"error": "month (1-12) and year are required."}, status=status.HTTP_400_BAD_REQUEST)
    year, month = parsed

    from .payroll import calculate_payroll
    holidays = {h.date: h for h in Holiday.objects.filter(date__year=year, date__month=month)}
    marks = {}
    for att in Attendance.objects.filter(date__year=year, date__month=month):
        marks.setdefault(att.employee_id, {})[att.date] = att

    month_end = date(year, month, calendar.monthrange(year, month)[1])
    records = []
    for emp in Employee.objects.filter(is_active=True).order_by('first_name', 'last_name'):
        if emp.date_joined and emp.date_joined > month_end:
            continue
        payroll, _ = Payroll.objects.get_or_create(employee=emp, month=month, year=year)
        if payroll.status != 'PAID':
            for field, value in calculate_payroll(emp, year, month, marks.get(emp.id, {}), holidays).items():
                setattr(payroll, field, value)
            payroll.save()
        records.append(payroll)

    return Response(PayrollSerializer(records, many=True).data)


@api_view(['PUT', 'PATCH'])
def update_payroll_record(request, pk):
    """Edit allowances, advances, deductions or notes on an unpaid payroll."""
    payroll = get_object_or_404(Payroll, pk=pk)
    if payroll.status == 'PAID':
        return Response({"error": "This salary has already been paid."}, status=status.HTTP_400_BAD_REQUEST)

    for field in ('allowances', 'advances', 'deductions'):
        if field in request.data:
            try:
                value = Decimal(str(request.data.get(field) or 0))
            except InvalidOperation:
                return Response({"error": f"Invalid {field}."}, status=status.HTTP_400_BAD_REQUEST)
            if value < 0:
                return Response({"error": f"{field.capitalize()} can't be negative."}, status=status.HTTP_400_BAD_REQUEST)
            setattr(payroll, field, value)
    if 'notes' in request.data:
        payroll.notes = request.data.get('notes') or ''
    payroll.save()
    return Response(PayrollSerializer(payroll).data)


@api_view(['POST'])
def pay_payroll_record(request, pk):
    """Mark a salary as paid; it's frozen from then on."""
    payroll = get_object_or_404(Payroll, pk=pk)
    if payroll.status == 'PAID':
        return Response({"error": "This salary has already been paid."}, status=status.HTTP_400_BAD_REQUEST)
    payroll.status = 'PAID'
    payroll.paid_date = timezone.localdate()
    payroll.save()
    return Response(PayrollSerializer(payroll).data)

# --- VEHICLE INSPECTION VIEWS ---
def _resolve_inspection_vehicle(vehicle_number, make_model, details=None):
    """
    Normalize the plate the way lookup_vehicle does, find it in the registry and
    register it if it's new — so an inspection's vehicle FK always holds and the
    vehicle page can list it. Mirrors _resolve_estimate_vehicle.

    An unregistered plate is filed with everything the sheet carries, so
    inspecting a vehicle for the first time also registers it properly rather
    than leaving a bare plate behind. A plate that is already registered only
    has its blanks filled in: the registry is the standing record of the
    vehicle, and one inspection must not overwrite a detail curated there.
    Mileage is deliberately not handled here — _refresh_vehicle_mileage owns
    it, because it may only ever move upwards.
    """
    plate = (vehicle_number or '').strip().upper()
    if not plate:
        return None, ''

    details = details or {}
    # "Honda Fit" -> make "Honda", model "Fit"; a single word is all make.
    make, _, model = (make_model or '').strip().partition(' ')
    attrs = {
        'make': make[:50],
        'model': model.strip()[:50],
        'year': details.get('year'),
        'chassis_number': (details.get('chassis_number') or '')[:40],
        'fuel_type': details.get('fuel_type') or '',
    }

    vehicle = CustomerVehicle.objects.filter(vehicle_number__iexact=plate).first()
    if vehicle is None:
        return CustomerVehicle.objects.create(vehicle_number=plate, **attrs), plate

    missing = [field for field, value in attrs.items() if value and not getattr(vehicle, field)]
    if missing:
        for field in missing:
            setattr(vehicle, field, attrs[field])
        vehicle.save(update_fields=missing + ['updated_at'])
    return vehicle, plate


def _next_inspection_number():
    """
    Sequential 03795, 03796, ... continuing the shop's paper book from
    INSPECTION_NUMBER_START. Derived from the current maximum the way
    _next_estimate_number is, so deleting a sheet never reissues its number.
    """
    highest = INSPECTION_NUMBER_START
    for number in VehicleInspection.objects.exclude(inspection_number='').values_list('inspection_number', flat=True):
        digits = ''.join(ch for ch in number if ch.isdigit())
        if digits:
            highest = max(highest, int(digits))
    return f"{highest + 1:05d}"


def _refresh_vehicle_mileage(vehicle, mileage):
    """
    An inspection is a real odometer reading, so it updates the registry — but
    only upwards. A mistyped lower figure must not rewrite a vehicle's mileage
    history, since CustomerVehicle.save() stamps mileage_updated_at whenever
    the number moves and bills quote that reading.
    """
    if vehicle is None or not mileage:
        return
    if (vehicle.current_mileage or 0) < mileage:
        vehicle.current_mileage = mileage
        vehicle.save()


@api_view(['GET'])
def get_inspections(request):
    """List saved inspections, optionally searching by reference, plate, customer or inspector."""
    search = request.query_params.get('search', '').strip()
    qs = VehicleInspection.objects.select_related('vehicle__customer')
    if search:
        qs = qs.filter(
            Q(inspection_number__icontains=search) |
            Q(vehicle_number__icontains=search) |
            Q(chassis_number__icontains=search) |
            Q(customer_name__icontains=search) |
            Q(inspector_name__icontains=search) |
            Q(make_model__icontains=search)
        )
    return Response(VehicleInspectionSerializer(qs, many=True).data)


@api_view(['GET'])
def get_inspection(request, pk):
    """A single inspection, for loading it back into the editor."""
    inspection = get_object_or_404(
        VehicleInspection.objects.select_related('vehicle__customer'), pk=pk
    )
    return Response(VehicleInspectionSerializer(inspection).data)


@api_view(['POST'])
@transaction.atomic
def create_inspection(request):
    """
    Save a new inspection. The plate is auto-registered in the vehicle registry
    if it isn't there yet, so the sheet is always linked to a real vehicle.
    Photos ride in the same multipart request as the rest of the form.
    """
    serializer = VehicleInspectionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    vehicle, plate = _resolve_inspection_vehicle(
        serializer.validated_data.get('vehicle_number'),
        serializer.validated_data.get('make_model'),
        serializer.validated_data,
    )
    inspection = serializer.save(
        vehicle=vehicle,
        vehicle_number=plate,
        inspection_number=_next_inspection_number(),
    )
    _refresh_vehicle_mileage(vehicle, inspection.mileage)
    return Response(VehicleInspectionSerializer(inspection).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@transaction.atomic
def update_inspection(request, pk):
    """
    Update a saved inspection. Photos are only touched when the request
    actually carries a file — the editor omits the field entirely when the
    stored image hasn't been changed, so a re-save can't blank it.
    """
    inspection = get_object_or_404(VehicleInspection, pk=pk)
    serializer = VehicleInspectionSerializer(inspection, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    extra = {}
    if 'vehicle_number' in serializer.validated_data:
        vehicle, plate = _resolve_inspection_vehicle(
            serializer.validated_data.get('vehicle_number'),
            serializer.validated_data.get('make_model', inspection.make_model),
            serializer.validated_data,
        )
        extra = {'vehicle': vehicle, 'vehicle_number': plate}

    inspection = serializer.save(**extra)
    _refresh_vehicle_mileage(inspection.vehicle, inspection.mileage)
    return Response(VehicleInspectionSerializer(inspection).data)


@api_view(['DELETE'])
def delete_inspection(request, pk):
    inspection = get_object_or_404(VehicleInspection, pk=pk)
    inspection.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def get_vehicle_inspections(request, pk):
    """Every inspection carried out on one registered vehicle, newest first."""
    vehicle = get_object_or_404(CustomerVehicle, pk=pk)
    qs = vehicle.inspections.select_related('vehicle__customer')
    return Response(VehicleInspectionSerializer(qs, many=True).data)


# --- PURCHASE ORDERS ---

# Orders that can still be edited: items added, quantities and prices changed.
PO_EDITABLE_STATUSES = (PurchaseOrder.STATUS_DRAFT, PurchaseOrder.STATUS_ORDERED)


def _next_po_number():
    """Sequential PO-0001, PO-0002, ... derived from the current maximum."""
    highest = 0
    for number in PurchaseOrder.objects.exclude(po_number='').values_list('po_number', flat=True):
        digits = number.rsplit('-', 1)[-1]
        if digits.isdigit():
            highest = max(highest, int(digits))
    return f"PO-{highest + 1:04d}"


def _purchase_order_qs():
    return PurchaseOrder.objects.select_related('supplier').prefetch_related('items__part')


def _parse_positive_int(value, field):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a whole number.")
    if number < 0:
        raise ValueError(f"{field} cannot be negative.")
    return number


def _parse_price(value, field):
    try:
        price = Decimal(str(value).strip() or '0')
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field} must be a number.")
    if price < 0:
        raise ValueError(f"{field} cannot be negative.")
    return price


@api_view(['GET'])
def get_purchase_orders(request):
    """List purchase orders, optionally filtered by ?status=DRAFT|ORDERED|..."""
    qs = _purchase_order_qs()
    status_filter = request.query_params.get('status', '').strip().upper()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(PurchaseOrderSerializer(qs, many=True).data)


@api_view(['GET'])
def get_purchase_order(request, pk):
    po = get_object_or_404(_purchase_order_qs(), pk=pk)
    return Response(PurchaseOrderSerializer(po).data)


@api_view(['GET'])
def get_part_purchase_order_lines(request, part_pk):
    """
    Where a part is already being ordered: its lines on open (draft or ordered)
    purchase orders, one per supplier order, so the Add to Purchase Order popup
    can show and adjust them. Received and cancelled orders are history.
    """
    items = (PurchaseOrderItem.objects
             .filter(part_id=part_pk, purchase_order__status__in=PO_EDITABLE_STATUSES)
             .select_related('purchase_order')
             .order_by('purchase_order__supplier_name', 'purchase_order__created_at'))
    return Response([
        {
            "item_id": item.id,
            "purchase_order_id": item.purchase_order_id,
            "po_number": item.purchase_order.po_number,
            "status": item.purchase_order.status,
            "supplier_id": item.purchase_order.supplier_id,
            "supplier_name": item.purchase_order.supplier_name,
            "quantity": item.quantity,
        }
        for item in items
    ])


@api_view(['POST'])
@transaction.atomic
def add_purchase_order_item(request):
    """
    Add a part to its supplier's open draft order, creating the draft if the
    supplier has none. Adding a part that's already on the draft increases its
    quantity instead of listing it twice.

    Payload: { "part_id": <uuid>, "supplier_id": <int>, "quantity": <int> }
    """
    part = get_object_or_404(Part, pk=request.data.get('part_id'))
    supplier_id = request.data.get('supplier_id')
    if not supplier_id:
        return Response({"error": "Choose a supplier to order from."}, status=status.HTTP_400_BAD_REQUEST)
    supplier = get_object_or_404(Supplier, pk=supplier_id)
    try:
        quantity = _parse_positive_int(request.data.get('quantity'), "Quantity")
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    if quantity < 1:
        return Response({"error": "Quantity must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)

    # Lock the supplier's drafts so two quick clicks can't open two drafts.
    po = (PurchaseOrder.objects.select_for_update()
          .filter(supplier=supplier, status=PurchaseOrder.STATUS_DRAFT)
          .order_by('created_at').first())
    created = po is None
    if created:
        po = PurchaseOrder.objects.create(
            supplier=supplier,
            supplier_name=supplier.name,
            po_number=_next_po_number(),
        )

    item = po.items.filter(part=part).first()
    if item:
        item.quantity += quantity
        item.save(update_fields=['quantity'])
    else:
        PurchaseOrderItem.objects.create(
            purchase_order=po,
            part=part,
            part_name=part.name,
            part_number=part.part_number,
            brand=part.brand,
            quantity=quantity,
            unit_price=part.buy_price or 0,
        )
    po.save(update_fields=['updated_at'])

    po = _purchase_order_qs().get(pk=po.pk)
    return Response(
        {"purchase_order": PurchaseOrderSerializer(po).data, "created": created},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['PATCH'])
@transaction.atomic
def update_purchase_order(request, pk):
    """
    Edit an order that hasn't been received or cancelled: its notes, and each
    line's quantity and expected unit price.

    Payload: { "notes": "...", "items": [{ "id": 1, "quantity": 5, "unit_price": "1200.00" }] }
    """
    po = get_object_or_404(PurchaseOrder, pk=pk)
    if po.status not in PO_EDITABLE_STATUSES:
        return Response({"error": f"A {po.get_status_display().lower()} order can't be edited."},
                        status=status.HTTP_400_BAD_REQUEST)

    if 'notes' in request.data:
        po.notes = request.data.get('notes') or ''

    items_by_id = {item.id: item for item in po.items.all()}
    for row in request.data.get('items', []):
        item = items_by_id.get(row.get('id'))
        if item is None:
            continue
        try:
            if 'quantity' in row:
                item.quantity = _parse_positive_int(row['quantity'], "Quantity")
                if item.quantity < 1:
                    raise ValueError("Quantity must be at least 1 — remove the item instead.")
            if 'unit_price' in row:
                item.unit_price = _parse_price(row['unit_price'], "Unit price")
        except ValueError as e:
            return Response({"error": f"{item.part_name}: {e}"}, status=status.HTTP_400_BAD_REQUEST)
        item.save(update_fields=['quantity', 'unit_price'])

    po.save()
    return Response(PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data)


@api_view(['DELETE'])
@transaction.atomic
def delete_purchase_order_item(request, item_pk):
    item = get_object_or_404(PurchaseOrderItem.objects.select_related('purchase_order'), pk=item_pk)
    po = item.purchase_order
    if po.status not in PO_EDITABLE_STATUSES:
        return Response({"error": "Items can only be removed from a draft or ordered purchase order."},
                        status=status.HTTP_400_BAD_REQUEST)
    item.delete()
    po.save(update_fields=['updated_at'])
    return Response(PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data)


@api_view(['POST'])
def mark_purchase_order_ordered(request, pk):
    """Close the draft: it's been sent to the supplier. New items start a new draft."""
    po = get_object_or_404(PurchaseOrder, pk=pk)
    if po.status != PurchaseOrder.STATUS_DRAFT:
        return Response({"error": "Only a draft can be marked as ordered."}, status=status.HTTP_400_BAD_REQUEST)
    if not po.items.exists():
        return Response({"error": "Add at least one item before ordering."}, status=status.HTTP_400_BAD_REQUEST)
    po.status = PurchaseOrder.STATUS_ORDERED
    po.ordered_at = timezone.now()
    po.save()
    return Response(PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data)


@api_view(['POST'])
@transaction.atomic
def revert_purchase_order_to_draft(request, pk):
    """
    Reopen an ordered or cancelled purchase order as a draft, e.g. to add more
    items before it's actually placed, or to revive a cancelled one. While it
    was out of draft, new items for the supplier
    started a fresh draft — those drafts are folded into this one (a part on
    both has its quantities combined), so the supplier is back to a single
    open draft. This order survives: it has the older number and may already
    have been sent.
    """
    po = get_object_or_404(PurchaseOrder.objects.select_for_update(), pk=pk)
    if po.status not in (PurchaseOrder.STATUS_ORDERED, PurchaseOrder.STATUS_CANCELLED):
        return Response({"error": "Only an ordered or cancelled purchase order can be sent back to draft."},
                        status=status.HTTP_400_BAD_REQUEST)

    po.status = PurchaseOrder.STATUS_DRAFT
    po.ordered_at = None

    merged_from = []
    other_drafts = (PurchaseOrder.objects.select_for_update()
                    .filter(supplier=po.supplier, status=PurchaseOrder.STATUS_DRAFT)
                    .exclude(pk=po.pk).order_by('created_at'))
    if po.supplier_id is not None:
        for other in other_drafts:
            existing = {item.part_id: item for item in po.items.all() if item.part_id}
            for item in other.items.all():
                match = existing.get(item.part_id) if item.part_id else None
                if match:
                    # Keep this order's unit cost — it may already have been adjusted.
                    match.quantity += item.quantity
                    match.save(update_fields=['quantity'])
                else:
                    item.purchase_order = po
                    item.save(update_fields=['purchase_order'])
            if other.notes.strip():
                po.notes = f"{po.notes}\n{other.notes}".strip()
            merged_from.append(other.po_number)
            other.delete()

    po.save()
    return Response({
        "purchase_order": PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data,
        "merged_from": merged_from,
    })


@api_view(['POST'])
@transaction.atomic
def receive_purchase_order(request, pk):
    """
    Book a delivery into stock. Each line's received quantity and actual unit
    price are confirmed here (deliveries are often short, and prices drift
    from what was expected); every line with a quantity above zero is restocked
    exactly like Quick Restock, tagged with the supplier's invoice number.
    A line may also carry a new selling price for the part — omitted or blank
    leaves the current one alone.

    Payload: { "invoice_number": "...", "items": [{ "id": 1, "received_quantity": 5, "unit_price": "1200.00", "sell_price": "1800.00" }] }
    """
    po = get_object_or_404(PurchaseOrder.objects.select_for_update(), pk=pk)
    # Only an order that was actually placed can arrive — a draft has to be
    # marked as ordered first.
    if po.status != PurchaseOrder.STATUS_ORDERED:
        error = ("Mark this order as ordered before receiving it."
                 if po.status == PurchaseOrder.STATUS_DRAFT
                 else f"This order is already {po.get_status_display().lower()}.")
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

    invoice_number = (request.data.get('invoice_number') or '').strip()
    rows = {row.get('id'): row for row in request.data.get('items', [])}
    items = list(po.items.select_related('part'))

    # Validate everything before any stock moves.
    plan = []
    for item in items:
        row = rows.get(item.id, {})
        try:
            qty = _parse_positive_int(row.get('received_quantity', item.quantity), "Received quantity")
            price = _parse_price(row.get('unit_price', item.unit_price), "Unit price")
            raw_sell = row.get('sell_price')
            sell_price = None if raw_sell in (None, '') else _parse_price(raw_sell, "Selling price")
        except ValueError as e:
            return Response({"error": f"{item.part_name}: {e}"}, status=status.HTTP_400_BAD_REQUEST)
        if qty > 0 and item.part is None:
            return Response({"error": f"{item.part_name} no longer exists in inventory — set its received quantity to 0."},
                            status=status.HTTP_400_BAD_REQUEST)
        plan.append((item, qty, price, sell_price))

    if not any(qty > 0 for _, qty, _, _ in plan):
        return Response({"error": "Nothing to receive — enter a received quantity for at least one item."},
                        status=status.HTTP_400_BAD_REQUEST)

    for item, qty, price, sell_price in plan:
        item.received_quantity = qty
        item.unit_price = price
        item.restock_record = None
        item.previous_sell_price = None
        if item.part_id and (qty > 0 or sell_price is not None):
            part = Part.objects.select_for_update().get(pk=item.part_id)
            # Kept so a revert can put the old price back.
            if sell_price is not None and sell_price != part.sell_price:
                item.previous_sell_price = part.sell_price
            if qty > 0:
                records, _, _ = _apply_restock(
                    part,
                    [{'supplier': po.supplier, 'quantity': qty, 'buy_price': price, 'notes': f"Received on {po.po_number}"}],
                    sell_price=sell_price,
                    invoice_number=invoice_number,
                )
                item.restock_record = records[0]
            elif sell_price is not None:
                # Nothing arrived, but a repricing was still asked for.
                part.sell_price = sell_price
                part.save(update_fields=['sell_price'])
        item.save(update_fields=['received_quantity', 'unit_price', 'restock_record', 'previous_sell_price'])

    po.status = PurchaseOrder.STATUS_RECEIVED
    po.received_at = timezone.now()
    po.invoice_number = invoice_number
    po.save()
    return Response(PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data)


@api_view(['POST'])
@transaction.atomic
def revert_purchase_order(request, pk):
    """
    Undo a receipt that was entered wrong, putting the order back to ORDERED so
    it can be corrected and received again. Each received line's stock comes
    back off the part (same maths as returning a restock record), its restock
    record is deleted — it was a mistake, not a return — and any selling price
    the receipt changed is restored. Refused, with nothing changed, when that
    can't be done cleanly: the record is gone or partly returned, or some of
    the delivery has already been sold.
    """
    po = get_object_or_404(PurchaseOrder.objects.select_for_update(), pk=pk)
    if po.status != PurchaseOrder.STATUS_RECEIVED:
        return Response({"error": "Only a received order can be reverted."}, status=status.HTTP_400_BAD_REQUEST)

    # Check every line before any stock moves.
    plan = []
    for item in po.items.select_related('restock_record'):
        if item.received_quantity == 0:
            plan.append((item, None, None))
            continue
        if item.part_id is None:
            return Response({"error": f"{item.part_name} no longer exists in inventory, so its receipt can't be undone."},
                            status=status.HTTP_400_BAD_REQUEST)
        record = item.restock_record
        if record is None:
            # Orders received before lines were linked to their record are
            # found by the note the receipt left on it.
            record = (RestockRecord.objects
                      .filter(part_id=item.part_id, supplier=po.supplier,
                              notes=f"Received on {po.po_number}", quantity=item.received_quantity)
                      .order_by('-restocked_at').first())
        if record is None:
            return Response({"error": f"{item.part_name}: the purchase history entry for this delivery was removed, so it can't be undone."},
                            status=status.HTTP_400_BAD_REQUEST)
        if record.returned_quantity > 0:
            return Response({"error": f"{item.part_name}: some of this delivery was already returned to the supplier. Undo that return first."},
                            status=status.HTTP_400_BAD_REQUEST)
        part = Part.objects.select_for_update().get(pk=item.part_id)
        if part.stock_qty < record.quantity:
            return Response({"error": f"{item.part_name}: only {part.stock_qty} left in stock but {record.quantity} were received — some have been sold, so this can't be undone."},
                            status=status.HTTP_400_BAD_REQUEST)
        plan.append((item, record, part))

    for item, record, part in plan:
        if record is not None:
            # Take this delivery back out of the weighted average.
            old_stock_value = float(part.stock_qty) * float(part.buy_price)
            new_stock_qty = part.stock_qty - record.quantity
            if new_stock_qty > 0:
                part.buy_price = round((old_stock_value - record.quantity * float(record.buy_price)) / new_stock_qty, 2)
            part.stock_qty = new_stock_qty
            if item.previous_sell_price is not None:
                part.sell_price = item.previous_sell_price
            part.save()
            record.delete()
        elif item.previous_sell_price is not None and item.part_id:
            Part.objects.filter(pk=item.part_id).update(sell_price=item.previous_sell_price)

        item.received_quantity = 0
        item.restock_record = None
        item.previous_sell_price = None
        item.save(update_fields=['received_quantity', 'restock_record', 'previous_sell_price'])

    po.status = PurchaseOrder.STATUS_ORDERED
    po.received_at = None
    po.invoice_number = ''
    po.save()
    return Response(PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data)


@api_view(['POST'])
def cancel_purchase_order(request, pk):
    po = get_object_or_404(PurchaseOrder, pk=pk)
    if po.status not in PO_EDITABLE_STATUSES:
        return Response({"error": f"This order is already {po.get_status_display().lower()}."},
                        status=status.HTTP_400_BAD_REQUEST)
    po.status = PurchaseOrder.STATUS_CANCELLED
    po.save()
    return Response(PurchaseOrderSerializer(_purchase_order_qs().get(pk=po.pk)).data)


@api_view(['DELETE'])
def delete_purchase_order(request, pk):
    """Received orders are stock history and can't be deleted; anything else can."""
    po = get_object_or_404(PurchaseOrder, pk=pk)
    if po.status == PurchaseOrder.STATUS_RECEIVED:
        return Response({"error": "A received order is part of the stock history and can't be deleted."},
                        status=status.HTTP_400_BAD_REQUEST)
    po.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- SUPPLIER INVOICES & CHEQUES ---

def _invoice_queryset():
    return SupplierInvoice.objects.select_related('supplier').prefetch_related('allocations__cheque')


def _cheque_queryset():
    return SupplierCheque.objects.select_related('supplier').prefetch_related('allocations__invoice')


def _money(value):
    """Parse a positive money amount, or None."""
    try:
        amount = Decimal(str(value)).quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return amount if amount > 0 else None


@api_view(['GET'])
def get_supplier_invoices(request):
    """?supplier=<id>&status=unpaid|partial|paid|open|overdue&search=<text>"""
    qs = _invoice_queryset()
    params = request.query_params
    if params.get('supplier'):
        qs = qs.filter(supplier_id=params['supplier'])
    search = (params.get('search') or '').strip()
    if search:
        qs = qs.filter(Q(invoice_number__icontains=search) | Q(supplier__name__icontains=search))

    invoices = list(qs)
    wanted = (params.get('status') or '').lower()
    if wanted:
        today = timezone.localdate()

        def keep(inv):
            info = invoice_payment_info(inv, today)
            inv._payment_info = info
            if wanted == 'overdue':
                return info["is_overdue"]
            if wanted == 'open':
                return info["payment_status"] != 'PAID'
            return info["payment_status"] == wanted.upper()

        invoices = [inv for inv in invoices if keep(inv)]
    return Response(SupplierInvoiceSerializer(invoices, many=True).data)


@api_view(['POST'])
def add_supplier_invoice(request):
    serializer = SupplierInvoiceSerializer(data=request.data)
    if serializer.is_valid():
        invoice = serializer.save()
        return Response(SupplierInvoiceSerializer(_invoice_queryset().get(pk=invoice.pk)).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_supplier_invoice(request, pk):
    invoice = get_object_or_404(_invoice_queryset(), pk=pk)
    serializer = SupplierInvoiceSerializer(invoice, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(SupplierInvoiceSerializer(_invoice_queryset().get(pk=pk)).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def delete_supplier_invoice(request, pk):
    invoice = get_object_or_404(SupplierInvoice, pk=pk)
    if invoice.allocations.exists():
        return Response(
            {"error": "Cheques have been assigned to this invoice. Remove them from the cheques first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    invoice.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def get_supplier_cheques(request):
    """?supplier=<id>&status=PENDING|CLEARED|CANCELLED&month=&year= (by cheque date)"""
    qs = _cheque_queryset()
    params = request.query_params
    if params.get('supplier'):
        qs = qs.filter(supplier_id=params['supplier'])
    if params.get('status'):
        qs = qs.filter(status=params['status'].upper())
    if params.get('month'):
        parsed = _parse_month(params)
        if not parsed:
            return Response({"error": "month (1-12) and year are required."}, status=status.HTTP_400_BAD_REQUEST)
        qs = qs.filter(cheque_date__year=parsed[0], cheque_date__month=parsed[1])
    return Response(SupplierChequeSerializer(qs, many=True).data)


def _save_cheque(data, cheque=None):
    """
    Create or update a cheque and replace its invoice allocations. Returns
    (cheque, None) or (None, error dict). Must run inside a transaction.
    """
    errors = {}
    supplier = None
    supplier_id = data.get('supplier', cheque.supplier_id if cheque else None)
    try:
        supplier = Supplier.objects.get(pk=int(supplier_id))
    except (Supplier.DoesNotExist, TypeError, ValueError):
        errors["supplier"] = "Choose a supplier."

    cheque_number = str(data.get('cheque_number', cheque.cheque_number if cheque else '') or '').strip()
    if not cheque_number:
        errors["cheque_number"] = "Cheque number is required."
    else:
        # A cheque number can only be written once (cancelled ones included —
        # the leaf is gone). Delete the old record to reuse a number.
        taken = SupplierCheque.objects.filter(cheque_number__iexact=cheque_number)
        if cheque is not None:
            taken = taken.exclude(pk=cheque.pk)
        clash = taken.select_related('supplier').first()
        if clash:
            errors["cheque_number"] = (
                f"Cheque number {cheque_number} is already used "
                f"({clash.supplier.name}, {clash.cheque_date:%d %b %Y})."
            )

    raw_date = data.get('cheque_date', cheque.cheque_date.isoformat() if cheque else None)
    cheque_date = parse_date(str(raw_date)) if raw_date else None
    if not cheque_date:
        errors["cheque_date"] = "Cheque date is required."

    raw_issued = data.get('issued_date') or (cheque.issued_date.isoformat() if cheque else None)
    issued_date = parse_date(str(raw_issued)) if raw_issued else timezone.localdate()
    if not issued_date:
        errors["issued_date"] = "Invalid issued date."

    amount = _money(data.get('amount', cheque.amount if cheque else None))
    if amount is None:
        errors["amount"] = "Amount must be greater than zero."

    raw_allocs = data.get('allocations')
    if raw_allocs is None and cheque:
        raw_allocs = [{"invoice": a.invoice_id, "amount": a.amount} for a in cheque.allocations.all()]
    if not isinstance(raw_allocs, list) or not raw_allocs:
        errors["allocations"] = "Assign the cheque to at least one invoice."
    if errors:
        return None, errors

    parsed, seen = [], set()
    for row in raw_allocs:
        try:
            invoice_id = int(row.get('invoice'))
        except (TypeError, ValueError, AttributeError):
            return None, {"allocations": "Invalid invoice in allocations."}
        part = _money(row.get('amount'))
        if part is None:
            # Zero rows are just invoices the user left blank.
            continue
        if invoice_id in seen:
            return None, {"allocations": "The same invoice is listed twice."}
        seen.add(invoice_id)
        parsed.append((invoice_id, part))
    if not parsed:
        return None, {"allocations": "Assign the cheque to at least one invoice."}

    invoices = {
        inv.pk: inv
        for inv in SupplierInvoice.objects.select_for_update().filter(pk__in=seen)
    }
    for invoice_id, part in parsed:
        inv = invoices.get(invoice_id)
        if not inv:
            return None, {"allocations": f"Invoice {invoice_id} not found."}
        if inv.supplier_id != supplier.pk:
            return None, {"allocations": f"Invoice {inv.invoice_number} belongs to a different supplier."}
        # Paid by other cheques; this cheque's old allocations are being replaced.
        others = ChequeAllocation.objects.filter(invoice=inv).exclude(cheque__status=SupplierCheque.STATUS_CANCELLED)
        if cheque is not None:
            others = others.exclude(cheque=cheque)
        paid_elsewhere = others.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        outstanding = inv.amount - paid_elsewhere
        if part > outstanding:
            return None, {"allocations": f"Invoice {inv.invoice_number} only has {outstanding} left to pay."}

    allocated = sum((p for _, p in parsed), Decimal('0'))
    if allocated != amount:
        return None, {"allocations": f"Assigned total ({allocated}) must equal the cheque amount ({amount})."}

    if cheque is None:
        cheque = SupplierCheque(status=SupplierCheque.STATUS_PENDING)
    cheque.supplier = supplier
    cheque.cheque_number = cheque_number
    cheque.bank = str(data.get('bank', cheque.bank or '') or '').strip()
    cheque.cheque_date = cheque_date
    cheque.issued_date = issued_date
    cheque.amount = amount
    cheque.notes = str(data.get('notes', cheque.notes or '') or '')
    cheque.save()

    cheque.allocations.all().delete()
    ChequeAllocation.objects.bulk_create([
        ChequeAllocation(cheque=cheque, invoice_id=invoice_id, amount=part) for invoice_id, part in parsed
    ])
    return cheque, None


@api_view(['POST'])
def add_supplier_cheque(request):
    with transaction.atomic():
        cheque, errors = _save_cheque(request.data)
        if errors:
            transaction.set_rollback(True)
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(SupplierChequeSerializer(_cheque_queryset().get(pk=cheque.pk)).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def add_supplier_cheques_bulk(request):
    """
    Several cheques to one supplier in one go, e.g. four weekly cheques for one
    invoice. Body: {supplier, bank, issued_date, notes, cheques: [{cheque_number,
    cheque_date, amount, allocations: [{invoice, amount}]}]}. All or nothing:
    each cheque is checked against what the earlier ones in the batch already
    paid, and any failure saves none of them.
    """
    rows = request.data.get('cheques')
    if not isinstance(rows, list) or not rows:
        return Response({"error": "Add at least one cheque."}, status=status.HTTP_400_BAD_REQUEST)

    numbers = [str(r.get('cheque_number', '') or '').strip().lower() for r in rows if isinstance(r, dict)]
    if len(numbers) != len(rows):
        return Response({"error": "Invalid cheque rows."}, status=status.HTTP_400_BAD_REQUEST)
    dupes = sorted({n for n in numbers if n and numbers.count(n) > 1})
    if dupes:
        return Response({"error": f"Cheque number {dupes[0]} is used more than once."}, status=status.HTTP_400_BAD_REQUEST)

    shared = {k: request.data.get(k) for k in ('supplier', 'bank', 'issued_date', 'notes') if k in request.data}
    created = []
    with transaction.atomic():
        for index, row in enumerate(rows, start=1):
            cheque, errors = _save_cheque({**shared, **row})
            if errors:
                transaction.set_rollback(True)
                label = str(row.get('cheque_number') or '').strip()
                detail = " ".join(str(v) for v in errors.values())
                return Response(
                    {"error": f"Cheque {index}{f' (#{label})' if label else ''}: {detail}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            created.append(cheque.pk)
    return Response(
        SupplierChequeSerializer(_cheque_queryset().filter(pk__in=created).order_by('cheque_date', 'id'), many=True).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['PUT'])
def update_supplier_cheque(request, pk):
    with transaction.atomic():
        cheque = get_object_or_404(SupplierCheque.objects.select_for_update(), pk=pk)
        if cheque.status == SupplierCheque.STATUS_CANCELLED:
            return Response(
                {"error": "This cheque is cancelled. Set it back to pending before editing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cheque, errors = _save_cheque(request.data, cheque)
        if errors:
            transaction.set_rollback(True)
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(SupplierChequeSerializer(_cheque_queryset().get(pk=pk)).data)


@api_view(['POST'])
def set_supplier_cheque_status(request, pk):
    new_status = str(request.data.get('status', '')).upper()
    if new_status not in dict(SupplierCheque.STATUS_CHOICES):
        return Response({"error": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        cheque = get_object_or_404(SupplierCheque.objects.select_for_update(), pk=pk)
        if cheque.status == SupplierCheque.STATUS_CANCELLED and new_status != SupplierCheque.STATUS_CANCELLED:
            # Bringing a cancelled cheque back pays its invoices again — make
            # sure that doesn't overpay one paid by another cheque meanwhile.
            for alloc in cheque.allocations.select_related('invoice'):
                paid = (
                    ChequeAllocation.objects.filter(invoice=alloc.invoice)
                    .exclude(cheque__status=SupplierCheque.STATUS_CANCELLED)
                    .aggregate(total=Sum('amount'))['total'] or Decimal('0')
                )
                if paid + alloc.amount > alloc.invoice.amount:
                    return Response(
                        {"error": f"Invoice {alloc.invoice.invoice_number} has since been paid by another cheque."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        cheque.status = new_status
        cheque.save(update_fields=['status', 'updated_at'])
    return Response(SupplierChequeSerializer(_cheque_queryset().get(pk=pk)).data)


@api_view(['DELETE'])
def delete_supplier_cheque(request, pk):
    cheque = get_object_or_404(SupplierCheque, pk=pk)
    cheque.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def get_supplier_balances(request):
    """What we owe each supplier, from their invoices and cheques."""
    today = timezone.localdate()
    zero = Decimal('0')
    rows = {
        s.pk: {
            "supplier": s.pk, "supplier_name": s.name,
            "total_invoiced": zero, "total_paid": zero, "outstanding": zero,
            "overdue_amount": zero, "open_invoices": 0, "overdue_invoices": 0,
            "next_due_date": None, "pending_cheques_amount": zero, "invoice_count": 0,
        }
        for s in Supplier.objects.all().order_by('name')
    }
    for inv in _invoice_queryset():
        row = rows.get(inv.supplier_id)
        if row is None:
            continue
        info = invoice_payment_info(inv, today)
        row["invoice_count"] += 1
        row["total_invoiced"] += inv.amount
        row["total_paid"] += info["paid_amount"]
        row["outstanding"] += info["outstanding"]
        if info["outstanding"] > 0:
            row["open_invoices"] += 1
            if row["next_due_date"] is None or inv.due_date < row["next_due_date"]:
                row["next_due_date"] = inv.due_date
        if info["is_overdue"]:
            row["overdue_invoices"] += 1
            row["overdue_amount"] += info["outstanding"]
    pending = (
        SupplierCheque.objects.filter(status=SupplierCheque.STATUS_PENDING)
        .values('supplier_id').annotate(total=Sum('amount'))
    )
    for p in pending:
        if p['supplier_id'] in rows:
            rows[p['supplier_id']]["pending_cheques_amount"] = p['total'] or zero
    return Response(list(rows.values()))
