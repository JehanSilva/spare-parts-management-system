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
        fields = '__all__'

    # --- ADD THIS METHOD ---
    def to_representation(self, instance):
        # Get the standard data (ids)
        data = super().to_representation(instance)
        
        # Replace the list of IDs with the list of actual Vehicle objects
        data['compatible_vehicles'] = VehicleSerializer(instance.compatible_vehicles.all(), many=True).data
        
        return data

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