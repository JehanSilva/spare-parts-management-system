import uuid
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db.models.functions import TruncDate
from rest_framework import status
from django.db.models import Sum, F
from .models import Part, Supplier, Sale, SaleItem, ActiveCart, Employee, Attendance, Payroll, Holiday, RestockRecord, Customer, CustomerVehicle, Estimate
from .serializers import PartSerializer, SupplierSerializer, SaleSerializer, PartMinimalSerializer, ActiveCartSerializer, EmployeeSerializer, AttendanceSerializer, PayrollSerializer, HolidaySerializer, RestockEntrySerializer, RestockRecordSerializer, CustomerSerializer, CustomerVehicleSerializer, EstimateSerializer, build_vehicle_registry_context
from decimal import Decimal, InvalidOperation
from .models import Vehicle
from .serializers import VehicleSerializer
from django.shortcuts import get_object_or_404
from django.db.models import Sum, F
from django.db import transaction
from django.db.models import Q

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
    POS cart — actually linked to this customer.
    """
    customer = get_object_or_404(Customer, pk=pk)
    old_name = customer.name

    serializer = CustomerSerializer(customer, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        serializer.save()
        new_name = customer.name
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
    
    # Subquery to calculate total_cost: Sum(part__buy_price * quantity)
    cost_subquery = SaleItem.objects.filter(
        part=OuterRef('pk'),
        sale__status='COMPLETED'
    ).values('part').annotate(
        total=Sum(ExpressionWrapper(
            F('part__buy_price') * F('quantity'),
            output_field=FloatField()
        ))
    ).values('total')
    
    parts = Part.objects.all().annotate(
        total_sold=Coalesce(Subquery(sold_subquery), 0),
        total_revenue=Coalesce(Subquery(revenue_subquery, output_field=FloatField()), 0.0),
        total_cost=Coalesce(Subquery(cost_subquery, output_field=FloatField()), 0.0)
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

@api_view(['DELETE'])
def delete_part(request, pk):
    part = get_object_or_404(Part, pk=pk)
    # Check if part has sales history to prevent breaking reports
    if part.saleitem_set.exists():
        return Response({"error": "Cannot delete part with sales history."}, status=status.HTTP_400_BAD_REQUEST)
    part.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

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

    # --- Weighted Average Cost Calculation ---
    # Start with existing stock value
    old_qty = part.stock_qty
    running_value = old_qty * float(part.buy_price)
    total_added_qty = 0

    records_to_create = []
    latest_supplier = None  # the part's primary supplier follows the newest restock
    for entry in validated_entries:
        supplier_id = entry.get('supplier_id')
        qty = entry['quantity']
        price = float(entry['buy_price'])
        notes = entry.get('notes', '')

        # Resolve supplier
        supplier_obj = None
        if supplier_id:
            try:
                supplier_obj = Supplier.objects.get(pk=supplier_id)
            except Supplier.DoesNotExist:
                return Response(
                    {"error": f"Supplier with id {supplier_id} does not exist."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            latest_supplier = supplier_obj

        running_value += qty * price
        total_added_qty += qty

        records_to_create.append(RestockRecord(
            part=part,
            supplier=supplier_obj,
            quantity=qty,
            buy_price=entry['buy_price'],
            notes=notes,
        ))

    # Bulk create all restock records
    RestockRecord.objects.bulk_create(records_to_create)

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

    return Response({
        "part": PartSerializer(part).data,
        "records_created": len(records_to_create),
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
    Edit the quantity and/or buy_price on a restock record.
    Adjusts part.stock_qty and recalculates the weighted average buy price.

    Payload: { "quantity": <int>, "buy_price": "<decimal>" }
    """
    part = get_object_or_404(Part, pk=part_pk)
    record = get_object_or_404(RestockRecord, pk=record_pk, part=part)

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
@api_view(['POST'])
@transaction.atomic # <--- 1. This Decorator makes the entire function safe
def create_sale(request):
    data = request.data
    customer_name = data.get('customer_name')
    vehicle_number = data.get('vehicle_number', '')
    customer_id = data.get('customer') or None
    items_data = data.get('items', [])
    mileage = data.get('mileage') or None
    force_mileage_update = bool(data.get('force_mileage_update', False))
    notes = data.get('notes', '')

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
    Update Sale header details (Customer Name, Vehicle Number)
    """
    sale = get_object_or_404(Sale, pk=pk)
    
    # We only allow updating customer_name and vehicle_number
    data = request.data
    if 'customer_name' in data:
        sale.customer_name = data['customer_name']
    if 'vehicle_number' in data:
        sale.vehicle_number = data['vehicle_number']
        
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

    cart = ActiveCart.objects.create(
        id=f"cart_reversed_{uuid.uuid4().hex[:12]}",
        customer_name=sale.customer_name,
        vehicle_number=sale.vehicle_number or '',
        items=cart_items,
        mileage=sale.mileage,
        notes=sale.notes,
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
    
    # Calculate Profit: (Sell Price - Buy Price) * Qty Sold
    # Note: This is a simplified calculation based on current part buy_price
    # For exact historical profit, you should store 'buy_price' in SaleItem too.
    profit = 0
    sale_items = SaleItem.objects.all()
    for item in sale_items:
        # Profit = (Revenue with discount) - (Cost)
        # item.unit_price is the marked sell price. item.discount is the deduction.
        # item.part.buy_price is the purchase cost.
        actual_revenue = (item.unit_price - item.discount) * item.quantity
        total_cost = item.part.buy_price * item.quantity
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
        total_profit=Sum((F('unit_price') - F('discount') - F('part__buy_price')) * F('quantity'))
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
        .annotate(daily_profit=Sum((F('unit_price') - F('discount') - F('part__buy_price')) * F('quantity')))\
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

# Daily Report View
@api_view(['GET'])
def daily_report(request):
    """
    Generate comprehensive daily sales report for a specific date (defaults to today).
    """
    date_str = request.query_params.get('date')
    
    if date_str:
        try:
            from datetime import datetime
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_date = timezone.make_aware(datetime.combine(target_date, datetime.min.time()))
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
    else:
        now = timezone.now()
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        target_date = start_date.date()
        
    end_date = start_date + timedelta(days=1)

    # Filter target date's sales and items
    target_sales = Sale.objects.filter(status='COMPLETED', created_at__gte=start_date, created_at__lt=end_date)
    target_items = SaleItem.objects.filter(sale__status='COMPLETED', sale__created_at__gte=start_date, sale__created_at__lt=end_date)

    # Calculate metrics
    sales_data = target_sales.aggregate(total=Sum('total_amount'))
    target_revenue = sales_data['total'] or 0

    profit_cost_data = target_items.aggregate(
        total_profit=Sum((F('unit_price') - F('discount') - F('part__buy_price')) * F('quantity')),
        total_cost=Sum(F('part__buy_price') * F('quantity'))
    )
    target_profit = profit_cost_data['total_profit'] or 0
    total_investment = profit_cost_data['total_cost'] or 0 # Investment of the items sold that day

    target_sales_count = target_sales.count()

    # Percentage comparison to all-time average daily revenue
    first_sale = Sale.objects.filter(status='COMPLETED').order_by('created_at').first()
    all_time_revenue = Sale.objects.filter(status='COMPLETED').aggregate(total=Sum('total_amount'))['total'] or 0
    
    avg_daily_revenue = 0
    percentage_change = 0
    
    if first_sale and all_time_revenue > 0:
        now_date = timezone.now().date()
        days_active = (now_date - first_sale.created_at.date()).days
        if days_active < 1:
            days_active = 1
        avg_daily_revenue = float(all_time_revenue) / days_active
        
        if avg_daily_revenue > 0:
            percentage_change = ((float(target_revenue) - avg_daily_revenue) / avg_daily_revenue) * 100

    # List of target's sales items
    items_list = []
    for item in target_items:
        # Net Profit = ((Sell Price - Discount) - Buy Price) * Quantity
        item_profit = (item.unit_price - item.discount - item.part.buy_price) * item.quantity
        items_list.append({
            "part_name": item.part.name,
            "part_number": item.part.part_number,
            "unit_price": item.unit_price,
            "quantity": item.quantity,
            "discount": item.discount,
            "total_price": item.total_price,
            "profit": item_profit
        })

    # Chart Data (Sales by hour)
    hours = {i: {"hour": f"{i:02d}:00", "revenue": 0, "profit": 0} for i in range(8, 20)}
    
    for sale in target_sales:
        hour = sale.created_at.astimezone(timezone.get_current_timezone()).hour
        if hour not in hours:
            hours[hour] = {"hour": f"{hour:02d}:00", "revenue": 0, "profit": 0}
        hours[hour]["revenue"] += sale.total_amount
        
    for item in target_items:
        hour = item.sale.created_at.astimezone(timezone.get_current_timezone()).hour
        profit = (item.unit_price - item.discount - item.part.buy_price) * item.quantity
        if hour in hours:
            hours[hour]["profit"] += profit

    chart_data = [hours[h] for h in sorted(hours.keys())]

    # Calculate ROI on COGS percentage
    roi_percentage = (float(target_profit) / float(total_investment) * 100) if total_investment > 0 else 0.0

    return Response({
        "today_revenue": target_revenue,
        "today_profit": target_profit,
        "today_sales_count": target_sales_count,
        "total_investment": total_investment,
        "roi_percentage": round(roi_percentage, 2),
        "percentage_change": round(percentage_change, 2),
        "avg_daily_revenue": round(avg_daily_revenue, 2),
        "items": items_list,
        "chart_data": chart_data
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
                                v_obj = Vehicle.objects.filter(
                                    make__iexact=parsed['make'],
                                    model__iexact=parsed['model'],
                                    year=parsed['year']
                                ).first()
                                
                                if not v_obj:
                                    v_obj = Vehicle.objects.create(
                                        make=parsed['make'],
                                        model=parsed['model'],
                                        year=parsed['year']
                                    )
                                    if parsed['make'] not in existing_makes:
                                        existing_makes.append(parsed['make'])
                                        
                                vehicle_objs.append(v_obj)
                                
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
                    v_obj = Vehicle.objects.filter(
                        make__iexact=parsed['make'],
                        model__iexact=parsed['model'],
                        year=parsed['year']
                    ).first()
                    if not v_obj:
                        v_obj = Vehicle.objects.create(
                            make=parsed['make'],
                            model=parsed['model'],
                            year=parsed['year']
                        )
                        if parsed['make'] not in existing_makes:
                            existing_makes.append(parsed['make'])
                    vehicle_objs.append(v_obj)
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

@api_view(['GET'])
def get_holidays(request):
    """List all global holidays"""
    holidays = Holiday.objects.all().order_by('date')
    serializer = HolidaySerializer(holidays, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_holiday(request):
    """Add a new holiday"""
    serializer = HolidaySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def delete_holiday(request, pk):
    """Delete a holiday"""
    holiday = get_object_or_404(Holiday, pk=pk)
    holiday.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- ATTENDANCE VIEWS ---

@api_view(['GET'])
def get_attendance_sheet(request):
    """
    Get the attendance list for a specific date.
    If no records exist in DB for some active employees for that date,
    returns placeholder/default records with status='PRESENT' as a template.
    """
    date_str = request.query_params.get('date')
    if not date_str:
        return Response({"error": "Date parameter is required (YYYY-MM-DD)"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from datetime import datetime
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

    # Fetch active employees
    active_employees = Employee.objects.filter(is_active=True).order_by('first_name')
    
    # Get existing records for this date
    existing_attendances = {
        att.employee_id: att for att in Attendance.objects.filter(date=target_date)
    }

    results = []
    for emp in active_employees:
        if emp.id in existing_attendances:
            results.append(existing_attendances[emp.id])
        else:
            # Return unsaved template record
            results.append(Attendance(
                employee=emp,
                date=target_date,
                status='PRESENT'
            ))

    serializer = AttendanceSerializer(results, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@transaction.atomic
def mark_attendance_sheet(request):
    """
    Save or update attendance in bulk for a specific date.
    """
    data = request.data
    date_str = data.get('date')
    attendances_data = data.get('attendances', [])

    if not date_str:
        return Response({"error": "Date is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from datetime import datetime
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

    for att in attendances_data:
        emp_id = att.get('employee')
        status_val = att.get('status', 'PRESENT')
        notes = att.get('notes', '')
        
        if not emp_id:
            continue
            
        Attendance.objects.update_or_create(
            employee_id=emp_id,
            date=target_date,
            defaults={
                'status': status_val,
                'notes': notes
            }
        )

    return Response({"message": "Attendance marked successfully"}, status=status.HTTP_200_OK)


# --- PAYROLL VIEWS ---

@api_view(['GET'])
def get_payroll_list(request):
    """List payroll records for a selected month and year"""
    month = request.query_params.get('month')
    year = request.query_params.get('year')
    
    if not month or not year:
        return Response({"error": "Month and Year parameters are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    payroll_records = Payroll.objects.filter(month=month, year=year).order_by('employee__first_name')
    serializer = PayrollSerializer(payroll_records, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@transaction.atomic
def generate_payroll_drafts(request):
    """
    Calculate and generate draft payroll records for a given month/year.
    """
    month = request.data.get('month')
    year = request.data.get('year')
    
    if not month or not year:
        return Response({"error": "Month and Year are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        month = int(month)
        year = int(year)
    except ValueError:
        return Response({"error": "Month and Year must be integers"}, status=status.HTTP_400_BAD_REQUEST)

    active_employees = Employee.objects.filter(is_active=True)
    payroll_records = []
    
    for emp in active_employees:
        # Calculate attendance counts for this month/year
        attendances = Attendance.objects.filter(
            employee=emp,
            date__month=month,
            date__year=year
        )
        
        # Present: 1.0, Half-day: 0.5, Paid Leave: 1.0, Absent: 0.0
        days_present = Decimal('0.0')
        days_paid_leave = Decimal('0.0')
        days_absent = Decimal('0.0')
        
        for att in attendances:
            if att.status == 'PRESENT':
                days_present += Decimal('1.0')
            elif att.status == 'HALF_DAY':
                days_present += Decimal('0.5')
            elif att.status == 'PAID_LEAVE':
                days_paid_leave += Decimal('1.0')
            elif att.status == 'ABSENT':
                days_absent += Decimal('1.0')

        # Calculate base salary depending on salary_type
        if emp.salary_type == 'DAILY':
            base_salary = (days_present + days_paid_leave) * emp.salary_rate
        else: # MONTHLY paid
            base_salary = emp.salary_rate

        # Get or create payroll record
        payroll, created = Payroll.objects.get_or_create(
            employee=emp,
            month=month,
            year=year,
            defaults={
                'days_present': days_present,
                'days_paid_leave': days_paid_leave,
                'days_absent': days_absent,
                'base_salary': base_salary,
                'allowances': Decimal('0.00'),
                'deductions': Decimal('0.00'),
                'status': 'DRAFT'
            }
        )
        
        if not created:
            # Update dynamic fields but preserve manually added allowances/deductions
            if payroll.status != 'PAID':
                payroll.days_present = days_present
                payroll.days_paid_leave = days_paid_leave
                payroll.days_absent = days_absent
                payroll.base_salary = base_salary
                payroll.save()
                
        payroll_records.append(payroll)
        
    serializer = PayrollSerializer(payroll_records, many=True)
    return Response(serializer.data)

@api_view(['PUT'])
def update_payroll_record(request, pk):
    """Update allowances or deductions on a draft payroll record"""
    payroll = get_object_or_404(Payroll, pk=pk)
    
    if payroll.status == 'PAID':
        return Response({"error": "Cannot update a paid payroll record"}, status=status.HTTP_400_BAD_REQUEST)
        
    allowances = request.data.get('allowances')
    deductions = request.data.get('deductions')
    
    if allowances is not None:
        payroll.allowances = allowances
    if deductions is not None:
        payroll.deductions = deductions
        
    payroll.save()
    return Response(PayrollSerializer(payroll).data)

@api_view(['POST'])
def pay_payroll_record(request, pk):
    """Mark a payroll record as Paid"""
    payroll = get_object_or_404(Payroll, pk=pk)
    
    if payroll.status == 'PAID':
        return Response({"error": "Payroll record is already paid"}, status=status.HTTP_400_BAD_REQUEST)
        
    payroll.status = 'PAID'
    payroll.paid_date = timezone.now().date()
    payroll.save()
    
    return Response(PayrollSerializer(payroll).data)