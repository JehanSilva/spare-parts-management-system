from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, F
from .models import Part, Supplier, Sale, SaleItem
from .serializers import PartSerializer, SupplierSerializer, SaleSerializer

# --- SUPPLIER VIEWS ---
@api_view(['GET', 'POST'])
def supplier_list(request):
    """
    GET: List all suppliers.
    POST: Add a new supplier.
    """
    if request.method == 'GET':
        suppliers = Supplier.objects.all()
        serializer = SupplierSerializer(suppliers, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = SupplierSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- PART VIEWS ---
@api_view(['GET'])
def get_parts(request):
    """
    GET parts with optional filtering.
    Usage: /api/parts/?search=Toyota&brand=Genuine
    """
    parts = Part.objects.all()

    # Filter by general search term (Name or Part Number)
    search_query = request.query_params.get('search', None)
    if search_query:
        parts = parts.filter(name__icontains=search_query) | \
                parts.filter(part_number__icontains=search_query)

    # Filter by Brand
    brand_query = request.query_params.get('brand', None)
    if brand_query:
        parts = parts.filter(brand__icontains=brand_query)

    # Filter by Supplier ID
    supplier_id = request.query_params.get('supplier', None)
    if supplier_id:
        parts = parts.filter(supplier_id=supplier_id)

    serializer = PartSerializer(parts, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_part(request):
    serializer = PartSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- SALES & BILLING VIEWS ---
@api_view(['POST'])
def create_sale(request):
    """
    Creates a new Bill/Invoice and updates stock quantity.
    Expected JSON:
    {
        "customer_name": "John Doe",
        "items": [
            {"part_id": "uuid-here", "quantity": 2, "unit_price": 1500.00, "warranty": 6}
        ]
    }
    """
    data = request.data
    customer_name = data.get('customer_name')
    items_data = data.get('items', [])

    if not items_data:
        return Response({"error": "No items in sale"}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Create the Sale Record
    # Calculate total first (optional, but good for validation)
    total_amount = sum(item['quantity'] * item['unit_price'] for item in items_data)
    
    sale = Sale.objects.create(
        customer_name=customer_name,
        total_amount=total_amount
    )

    # 2. Process Items and Deduct Stock
    for item in items_data:
        try:
            part = Part.objects.get(id=item['part_id'])
            
            # Check Stock
            if part.stock_qty < item['quantity']:
                sale.delete() # Rollback
                return Response(
                    {"error": f"Not enough stock for {part.name}. Available: {part.stock_qty}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Deduct Stock
            part.stock_qty -= item['quantity']
            part.save()

            # Create Sale Item
            SaleItem.objects.create(
                sale=sale,
                part=part,
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                warranty_period_months=item.get('warranty', 0)
            )

        except Part.DoesNotExist:
            sale.delete() # Rollback
            return Response({"error": f"Part ID {item['part_id']} not found"}, status=404)

    return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

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