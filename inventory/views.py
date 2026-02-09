from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, F
from .models import Part, Supplier, Sale, SaleItem
from .serializers import PartSerializer, SupplierSerializer, SaleSerializer, PartMinimalSerializer
from .models import Vehicle # <--- Make sure Vehicle is imported at the top!
from .serializers import VehicleSerializer # <--- Make sure this is imported too!
from django.shortcuts import get_object_or_404 # Ensure this is imported        
from django.db.models import Sum, F
from .models import Sale # Ensure Sale is imported
from django.db import transaction
from django.db.models import Q

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

    # 2. Start with all parts
    parts = Part.objects.all().order_by('-id')

    # 3. Apply Search Filter (Name OR Part Number OR Description)
    if search_query:
        parts = parts.filter(
            Q(name__icontains=search_query) | 
            Q(part_number__icontains=search_query) |
            Q(description__icontains=search_query)
        )

    # 4. Apply Brand Filter (Exact match or partial)
    if brand_filter:
        parts = parts.filter(brand__icontains=brand_filter)

    # 5. Serialize and return
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
        
        # Update Prices (Optional: Remove these lines if you don't want to overwrite prices)
        if 'buy_price' in data:
            existing_part.buy_price = data['buy_price']
        if 'sell_price' in data:
            existing_part.sell_price = data['sell_price']
            
        existing_part.save()
        
        return Response({
            "message": f"Part exists. Stock increased by {new_qty}. Total: {existing_part.stock_qty}",
            "id": existing_part.id,
            "stock_qty": existing_part.stock_qty
        }, status=status.HTTP_200_OK)

    # --- CREATE NEW MODE ---
    serializer = PartSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
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

# --- SALES & BILLING VIEWS ---
@api_view(['POST'])
@transaction.atomic # <--- 1. This Decorator makes the entire function safe
def create_sale(request):
    data = request.data
    customer_name = data.get('customer_name')
    vehicle_number = data.get('vehicle_number', '')
    items_data = data.get('items', [])

    if not items_data:
        return Response({"error": "No items in sale"}, status=status.HTTP_400_BAD_REQUEST)

    # 2. Validation First: Check ALL items for stock BEFORE creating the sale
    # This prevents creating a Sale ID and then deleting it immediately (gap in IDs)
    total_amount = 0
    for item in items_data:
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

    # 3. Create the Sale Record
    sale = Sale.objects.create(
        customer_name=customer_name,
        vehicle_number=vehicle_number,
        total_amount=total_amount
    )

    # 4. Process Items (Now safe to deduct)
    for item in items_data:
        part = Part.objects.get(id=item['part_id'])
        
        # Deduct Stock
        part.stock_qty -= item['quantity']
        part.save()

        # Create Sale Item
        SaleItem.objects.create(
            sale=sale,
            part=part,
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
    # Order by creation date descending (newest first)
    sales = Sale.objects.all().order_by('-created_at')
    serializer = SaleSerializer(sales, many=True)
    return Response(serializer.data)

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
        cost = item.part.buy_price * item.quantity
        revenue = item.unit_price * item.quantity
        profit += (revenue - cost)

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
    Calculate financial metrics:
    1. Total Inventory Cost (Money tied up in stock)
    2. Total Revenue (Total Sales)
    3. Net Profit (Revenue - Cost of Goods Sold)
    4. Spending per Supplier
    """
    
    # 1. Total Inventory Value (Current Stock * Buy Price)
    # We use 'aggregate' to sum up the calculated value of every part
    inventory_data = Part.objects.aggregate(
        total_value=Sum(F('buy_price') * F('stock_qty'))
    )
    total_inventory_value = inventory_data['total_value'] or 0

    # 2. Total Sales Revenue
    sales_data = Sale.objects.aggregate(total=Sum('total_amount'))
    total_sales = sales_data['total'] or 0

    # 3. Calculate Profit
    # Profit = Sum of [(Unit Price - Original Buy Price) * Qty Sold] for every sold item
    # Note: We access the related part's buy_price via 'part__buy_price'
    from .models import SaleItem # Ensure SaleItem is imported
    profit_data = SaleItem.objects.aggregate(
        total_profit=Sum((F('unit_price') - F('part__buy_price')) * F('quantity'))
    )
    total_profit = profit_data['total_profit'] or 0

    # 4. Spending per Supplier
    # We group parts by supplier name and sum their total cost (buy_price * stock_qty)
    # Note: This calculates the value of *currently held* stock from each supplier.
    supplier_stats = Part.objects.values('supplier__name').annotate(
        total_spent=Sum(F('buy_price') * F('stock_qty')),
        part_count=Sum('stock_qty')
    ).order_by('-total_spent')

    return Response({
        "total_inventory_value": total_inventory_value,
        "total_sales": total_sales,
        "total_profit": total_profit,
        "supplier_stats": supplier_stats
    })