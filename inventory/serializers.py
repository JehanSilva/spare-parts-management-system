from rest_framework import serializers
from .models import Supplier, Part, Vehicle, Customer, CustomerVehicle, Sale, SaleItem, ActiveCart, Employee, Attendance, Payroll, Holiday, RestockRecord

# --- 1. SUPPLIER ---
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

# --- 2. VEHICLE (Parts Compatibility Catalog) ---
class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'


# --- 2b. CUSTOMER VEHICLE (Real registered plates per customer) ---
class CustomerVehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerVehicle
        fields = '__all__'


# --- 2c. CUSTOMER ---
class CustomerSerializer(serializers.ModelSerializer):
    vehicles = CustomerVehicleSerializer(many=True, read_only=True)
    total_sales = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'address', 'created_at', 'updated_at', 'vehicles', 'total_sales']

    def get_total_sales(self, obj):
        return obj.sales.filter(status='COMPLETED').count()

# --- 3. PART ---
class PartSerializer(serializers.ModelSerializer):
    # Read-only nested supplier details for display
    supplier_details = SupplierSerializer(source='supplier', read_only=True)
    total_sold = serializers.IntegerField(read_only=True)
    total_revenue = serializers.FloatField(read_only=True)
    total_cost = serializers.FloatField(read_only=True)

    class Meta:
        model = Part
        fields = '__all__'

    def to_representation(self, instance):
        response = super().to_representation(instance)
        if instance.compatible_vehicles.exists():
            response['compatible_vehicles'] = VehicleSerializer(instance.compatible_vehicles.all(), many=True).data
        return response

class PartMinimalSerializer(serializers.ModelSerializer):
    """
    Serializer for fetching minimal part details:
    - Image Name
    - Part Number
    - Compatible Vehicles
    """
    class Meta:
        model = Part
        fields = ['id', 'part_number', 'image', 'compatible_vehicles', 'name', 'stock_qty']

    def to_representation(self, instance):
        """
        Custom representation to show full Vehicle objects in the API response
        instead of just IDs, making it easier for the frontend to display tags.
        """
        data = super().to_representation(instance)
        # Replace list of IDs with actual Vehicle objects
        if instance.compatible_vehicles.exists():
            data['compatible_vehicles'] = VehicleSerializer(instance.compatible_vehicles.all(), many=True).data
        return data

# --- 4. SALE ITEM ---
class SaleItemSerializer(serializers.ModelSerializer):
    # Read-only fields to show part details on the receipt without fetching the part again
    part_name = serializers.ReadOnlyField(source='part.name')
    part_brand = serializers.ReadOnlyField(source='part.brand')
    part_number = serializers.ReadOnlyField(source='part.part_number')

    class Meta:
        model = SaleItem
        fields = [
            'id', 
            'part', 
            'part_name', 
            'part_brand', 
            'part_number', 
            'quantity', 
            'unit_price', 
            'discount',      # <--- CRITICAL: Allows discount to be saved
            'total_price',   # <--- Calculated field from model
            'warranty_period_months'
        ]

# --- 5. SALE (THE HEADER) ---
class SaleSerializer(serializers.ModelSerializer):
    # We allow writing items here now so we can send the whole cart in one JSON
    items = SaleItemSerializer(many=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'customer', 'customer_name', 'vehicle_number', 'created_at', 'total_amount', 'items',
            'status', 'cancel_reason', 'payment_status', 'credit_note', 'credit_settled_at',
        ]
        read_only_fields = ['credit_settled_at']

    def create(self, validated_data):
        """
        Custom Create Logic to handle the 'Cart' structure.
        1. Creates the Sale (Receipt Header).
        2. Loops through items to create SaleItems.
        3. Updates Stock Levels.
        """
        # Pop the items data from the main payload
        items_data = validated_data.pop('items')
        
        # 1. Create the Sale instance
        sale = Sale.objects.create(**validated_data)
        
        grand_total = 0

        # 2. Process each item in the cart
        for item_data in items_data:
            part = item_data['part']
            quantity = item_data['quantity']
            
            # Stock Check (Optional safety)
            if part.stock_qty < quantity:
                raise serializers.ValidationError(f"Not enough stock for {part.name}. Available: {part.stock_qty}")

            # Deduct Stock
            part.stock_qty -= quantity
            part.save()

            # Create the SaleItem
            # The 'save()' method in models.py will auto-calculate 'total_price'
            # using the 'discount' provided in item_data
            sale_item = SaleItem.objects.create(sale=sale, **item_data)
            
            # Add to grand total
            grand_total += sale_item.total_price

        # 3. Update the total amount on the Sale header
        sale.total_amount = grand_total
        sale.save()

        return sale

class ActiveCartSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActiveCart
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'

class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_role = serializers.ReadOnlyField(source='employee.role')

    class Meta:
        model = Attendance
        fields = '__all__'

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

class PayrollSerializer(serializers.ModelSerializer):
    employee_details = EmployeeSerializer(source='employee', read_only=True)

    class Meta:
        model = Payroll
        fields = '__all__'

class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = '__all__'

# --- RESTOCK ---
class RestockEntrySerializer(serializers.Serializer):
    """
    Represents a single supplier entry within a bulk restock request.
    """
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1)
    buy_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class RestockRecordSerializer(serializers.ModelSerializer):
    supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = RestockRecord
        fields = [
            'id', 'part', 'supplier', 'supplier_name',
            'quantity', 'buy_price', 'restocked_at', 'notes',
            'status', 'returned_quantity', 'return_reason', 'returned_at',
        ]

    def get_supplier_name(self, obj):
        return obj.supplier.name if obj.supplier else 'Unknown / No Supplier'