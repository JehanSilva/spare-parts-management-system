from rest_framework import serializers
from django.db.models.functions import Upper
from .models import Supplier, Part, Vehicle, Customer, CustomerVehicle, Sale, SaleItem, ActiveCart, Employee, Attendance, Payroll, Holiday, RestockRecord, Estimate, RepairService, VehicleInspection

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


# --- 2b. CUSTOMER VEHICLE (independent master data, optionally linked to a Customer) ---
class CustomerBasicSerializer(serializers.ModelSerializer):
    """Lightweight Customer view for nesting — avoids circular nesting with
    CustomerSerializer.vehicles (which nests CustomerVehicleSerializer)."""
    # Prefix and name travel separately (initials, sorting and search all want
    # the bare name); display_name is the joined form to show and print.
    display_name = serializers.ReadOnlyField()

    class Meta:
        model = Customer
        fields = ['id', 'name_prefix', 'name', 'display_name', 'phone', 'email', 'address']


class CustomerVehicleSerializer(serializers.ModelSerializer):
    customer_details = CustomerBasicSerializer(source='customer', read_only=True)

    class Meta:
        model = CustomerVehicle
        fields = '__all__'


# --- 2c. CUSTOMER ---
class CustomerSerializer(serializers.ModelSerializer):
    vehicles = CustomerVehicleSerializer(many=True, read_only=True)
    total_sales = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()

    class Meta:
        model = Customer
        fields = ['id', 'name_prefix', 'name', 'display_name', 'phone', 'email', 'address', 'created_at', 'updated_at', 'vehicles', 'total_sales']

    def get_total_sales(self, obj):
        return obj.sales.filter(status='COMPLETED').count()

# --- 3. PART ---
class BlankableDecimalField(serializers.DecimalField):
    """
    DecimalField that treats an empty string as NULL.

    The add/edit part form posts multipart FormData, where an empty number
    input arrives as "" rather than being omitted — plain DecimalField would
    reject that with "A valid number is required."
    """
    def to_internal_value(self, data):
        if data in ("", None):
            return None
        return super().to_internal_value(data)


class PartSerializer(serializers.ModelSerializer):
    # Read-only nested supplier details for display
    supplier_details = SupplierSerializer(source='supplier', read_only=True)
    # Declared explicitly (rather than relying on '__all__') so a cleared input
    # posted as "" clears the limit instead of erroring.
    min_sell_price = BlankableDecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    total_sold = serializers.IntegerField(read_only=True)
    total_revenue = serializers.FloatField(read_only=True)
    total_cost = serializers.FloatField(read_only=True)
    total_invested = serializers.FloatField(read_only=True)
    total_purchased = serializers.IntegerField(read_only=True)

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
        fields = ['id', 'part_number', 'image', 'compatible_vehicles', 'name', 'stock_qty', 'sell_price', 'min_sell_price']

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
    # SerializerMethodField (not ReadOnlyField(source='part.xxx')) so these
    # fall back gracefully for LABOR items, which have no part at all —
    # part_name becomes the labor description instead of raising AttributeError.
    part_name = serializers.SerializerMethodField()
    part_brand = serializers.SerializerMethodField()
    part_number = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = [
            'id',
            'part',
            'item_type',
            'description',
            'part_name',
            'part_brand',
            'part_number',
            'quantity',
            'unit_price',
            'discount',      # <--- CRITICAL: Allows discount to be saved
            'total_price',   # <--- Calculated field from model
            'warranty_period_months'
        ]

    def get_part_name(self, obj):
        return obj.part.name if obj.part else obj.description

    def get_part_brand(self, obj):
        return obj.part.brand if obj.part else ""

    def get_part_number(self, obj):
        return obj.part.part_number if obj.part else ""

# --- 5. SALE (THE HEADER) ---
def build_vehicle_registry_context(sales):
    """
    Serializer context for a *list* of sales: a PLATE -> CustomerVehicle map
    built in one query, so SaleSerializer.vehicle_details doesn't turn into a
    lookup per sale. Matching is by upper-cased plate because Sale.vehicle_number
    is free text with no FK to the registry.
    """
    plates = {s.vehicle_number.strip().upper() for s in sales if s.vehicle_number}
    if not plates:
        return {'vehicle_registry': {}}
    vehicles = CustomerVehicle.objects.annotate(
        plate=Upper('vehicle_number')
    ).filter(plate__in=plates)
    return {'vehicle_registry': {v.plate: v for v in vehicles}}


class SaleSerializer(serializers.ModelSerializer):
    # We allow writing items here now so we can send the whole cart in one JSON
    items = SaleItemSerializer(many=True)
    # Read-only convenience field so the frontend can offer "share receipt to
    # the registered number" without a second lookup per sale.
    customer_phone = serializers.CharField(source='customer.phone', read_only=True, default=None)
    vehicle_details = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'customer', 'customer_name', 'customer_phone', 'vehicle_number',
            'vehicle_details', 'created_at',
            'total_amount', 'items', 'status', 'cancel_reason', 'payment_status', 'amount_paid',
            'credit_note', 'credit_settled_at', 'mileage', 'notes',
        ]
        read_only_fields = ['credit_settled_at']

    def get_vehicle_details(self, obj):
        """
        Registry facts about the plate on this sale — make/model for the printed
        bill, plus the last known odometer reading and when it was taken (a job
        often doesn't record a new one, so the bill has to quote an older).
        Resolved from the context map when one was supplied; see
        build_vehicle_registry_context.
        """
        if not obj.vehicle_number:
            return None

        plate = obj.vehicle_number.strip().upper()
        registry = self.context.get('vehicle_registry')
        if registry is not None:
            vehicle = registry.get(plate)
        else:
            vehicle = CustomerVehicle.objects.filter(vehicle_number__iexact=plate).first()

        if vehicle is None:
            return None
        return {
            'id': vehicle.id,
            'make': vehicle.make,
            'model': vehicle.model,
            'year': vehicle.year,
            'current_mileage': vehicle.current_mileage,
            'mileage_updated_at': vehicle.mileage_updated_at,
        }

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

# --- 5b. ESTIMATE (insurance claim repair estimate) ---
class EstimateSerializer(serializers.ModelSerializer):
    vehicle_details = CustomerVehicleSerializer(source='vehicle', read_only=True)

    class Meta:
        model = Estimate
        fields = [
            'id', 'estimate_number', 'vehicle', 'vehicle_details', 'vehicle_number',
            'make_model', 'insurance_company', 'date', 'validity_days',
            'owner_name', 'owner_phone', 'owner_address', 'sections',
            'total_amount', 'has_pending_quotation', 'created_at', 'updated_at',
        ]
        # All derived server-side: the reference number is allocated on create,
        # the vehicle link is resolved from the plate, and the total (plus the
        # flag saying it's still partial) comes from the lines in Estimate.save().
        read_only_fields = [
            'estimate_number', 'vehicle', 'total_amount', 'has_pending_quotation',
        ]


class RepairServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepairService
        fields = ['id', 'name', 'default_price', 'is_active', 'created_at', 'updated_at']


class ActiveCartSerializer(serializers.ModelSerializer):
    customer_details = CustomerBasicSerializer(source='customer', read_only=True)

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
            'quantity', 'buy_price', 'restocked_at', 'notes', 'invoice_number',
            'status', 'returned_quantity', 'return_reason', 'returned_at',
        ]

    def get_supplier_name(self, obj):
        return obj.supplier.name if obj.supplier else 'Unknown / No Supplier'

# --- VEHICLE INSPECTION ---
# The blob validators below are deliberately shallow. The component catalog
# lives in the frontend (frontend/src/components/inspectionSchema.js) and the
# server stores what it is given, exactly as Estimate.sections does — so these
# check shape and bound size, they do not check that a key is one the catalog
# knows about. Rejecting unknown keys here would mean the catalog existed twice
# and every sheet revision became a coordinated deploy.

# Wide enough for a sheet several times the current size, narrow enough that a
# buggy or hostile client can't park megabytes in a JSON column.
MAX_INSPECTION_CATEGORIES = 40
MAX_INSPECTION_FIELDS_PER_CATEGORY = 120
MAX_DTC_ROWS = 100
MAX_RECOMMENDATION_CHARS = 4000
MAX_CUSTOM_FIELDS_PER_SECTION = 40


def _clean_string_map(value, field_name, max_keys, max_len=120):
    """A flat {key: "text"} map, trimmed, with anything non-scalar rejected."""
    if not isinstance(value, dict):
        raise serializers.ValidationError(f"{field_name} must be an object.")
    if len(value) > max_keys:
        raise serializers.ValidationError(f"{field_name} has too many entries.")
    cleaned = {}
    for key, raw in value.items():
        if raw is None or raw == "":
            continue
        if isinstance(raw, (dict, list)):
            raise serializers.ValidationError(f"{field_name}.{key} must be a single value.")
        cleaned[str(key)[:100]] = str(raw).strip()[:max_len]
    return cleaned


class VehicleInspectionSerializer(serializers.ModelSerializer):
    vehicle_details = CustomerVehicleSerializer(source='vehicle', read_only=True)

    class Meta:
        model = VehicleInspection
        fields = [
            'id', 'inspection_number', 'inspector_name', 'date', 'time', 'customer_name',
            'vehicle', 'vehicle_details', 'vehicle_number', 'chassis_number', 'make_model',
            'year', 'fuel_type', 'mileage', 'front_image', 'rear_image',
            'checklist', 'ratings', 'system_scan', 'dtc_codes', 'recommendations',
            'custom_fields', 'excluded_sections',
            'overall_rating', 'created_at', 'updated_at',
        ]
        # All derived server-side: the reference number is allocated on create,
        # the vehicle link is resolved from the plate, and the headline rating
        # is averaged from the category figures in VehicleInspection.save().
        read_only_fields = ['inspection_number', 'vehicle', 'overall_rating']

    # The JSON fields are not declared explicitly — like Estimate.sections they
    # ride through the field list above, which also means DRF's JSONField
    # parses them out of a JSON string when the form posts its photos in the
    # same multipart request (see rest_framework/fields.py JSONField.get_value).

    def validate_checklist(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("checklist must be an object keyed by category.")
        if len(value) > MAX_INSPECTION_CATEGORIES:
            raise serializers.ValidationError("checklist has too many categories.")
        return {
            str(cat)[:100]: _clean_string_map(
                fields, f"checklist.{cat}", MAX_INSPECTION_FIELDS_PER_CATEGORY
            )
            for cat, fields in value.items()
        }

    def validate_ratings(self, value):
        """Percentages, clamped. A blank stays blank so it can be told apart
        from a deliberate zero — inspection_overall_rating() skips it."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("ratings must be an object keyed by category.")
        cleaned = {}
        for key, raw in value.items():
            if raw is None or raw == "":
                continue
            try:
                cleaned[str(key)[:100]] = min(100, max(0, round(float(raw), 2)))
            except (TypeError, ValueError):
                raise serializers.ValidationError(f"ratings.{key} must be a number.")
        return cleaned

    def validate_system_scan(self, value):
        return _clean_string_map(value, "system_scan", MAX_INSPECTION_CATEGORIES)

    def validate_recommendations(self, value):
        return _clean_string_map(
            value, "recommendations", MAX_INSPECTION_CATEGORIES,
            max_len=MAX_RECOMMENDATION_CHARS,
        )

    def validate_custom_fields(self, value):
        """
        {section_key: [{label, value, free}]}.

        Deliberately not routed through _clean_string_map: that helper rejects
        lists and drops empty values, which would delete a custom field the
        moment its value was left blank — while the inspector could still see
        the row on screen. Only a row with no label is dropped, because a row
        with nothing to name it has nothing to print.
        """
        if not isinstance(value, dict):
            raise serializers.ValidationError("custom_fields must be an object keyed by section.")
        if len(value) > MAX_INSPECTION_CATEGORIES:
            raise serializers.ValidationError("custom_fields has too many sections.")

        cleaned = {}
        for section, rows in value.items():
            if not isinstance(rows, list):
                raise serializers.ValidationError(f"custom_fields.{section} must be a list.")
            if len(rows) > MAX_CUSTOM_FIELDS_PER_SECTION:
                raise serializers.ValidationError(f"custom_fields.{section} has too many rows.")
            kept = []
            for row in rows:
                if not isinstance(row, dict):
                    raise serializers.ValidationError(f"Each custom_fields.{section} row must be an object.")
                label = str(row.get('label') or '').strip()[:100]
                if not label:
                    continue
                kept.append({
                    'label': label,
                    'value': str(row.get('value') or '').strip()[:120],
                    'free': bool(row.get('free')),
                })
            if kept:
                cleaned[str(section)[:100]] = kept
        return cleaned

    def validate_excluded_sections(self, value):
        """Section keys held back from the report, deduplicated, order kept."""
        if not isinstance(value, list):
            raise serializers.ValidationError("excluded_sections must be a list.")
        seen = set()
        cleaned = []
        for raw in value:
            if isinstance(raw, (dict, list)):
                raise serializers.ValidationError("Each excluded_sections entry must be a key.")
            key = str(raw or '').strip()[:100]
            if key and key not in seen:
                seen.add(key)
                cleaned.append(key)
        return cleaned

    def validate_dtc_codes(self, value):
        """
        Reduce each row to exactly the four columns the report prints, so a
        client can't smuggle extra keys into the blob. Rows blank in every
        column are dropped — the editor always keeps one empty row on screen
        and it must not be saved.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("dtc_codes must be a list.")
        if len(value) > MAX_DTC_ROWS:
            raise serializers.ValidationError("dtc_codes has too many rows.")
        cleaned = []
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("Each dtc_codes row must be an object.")
            entry = {
                'code': str(row.get('code') or '').strip()[:30],
                'module': str(row.get('module') or '').strip()[:40],
                'description': str(row.get('description') or '').strip()[:300],
                'status': str(row.get('status') or '').strip()[:20],
            }
            if any(entry[k] for k in ('code', 'module', 'description')):
                cleaned.append(entry)
        return cleaned
