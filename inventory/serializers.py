from rest_framework import serializers
from .models import Supplier, Part, Vehicle, Sale, SaleItem
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'

class PartSerializer(serializers.ModelSerializer):
    # This allows us to see the Supplier details when reading, 
    # but use the Supplier ID when writing/creating a part.
    supplier_details = SupplierSerializer(source='supplier', read_only=True)

    class Meta:
        model = Part
        fields = [
            'id', 'name', 'part_number', 'brand', 'supplier', 'supplier_details',
            'description', 'buy_price', 'sell_price', 'stock_qty', 
            'min_stock_level', 'rack_location', 'image_url', 'compatible_vehicles'
        ]

class SaleItemSerializer(serializers.ModelSerializer):
    part_name = serializers.ReadOnlyField(source='part.name')
    part_brand = serializers.ReadOnlyField(source='part.brand')

    class Meta:
        model = SaleItem
        # CHANGE 'warranty' TO 'warranty_period_months'
        fields = ['id', 'part', 'part_name', 'part_brand', 'quantity', 'unit_price', 'warranty_period_months']

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = ['id', 'customer_name', 'vehicle_number', 'created_at', 'total_amount', 'items']