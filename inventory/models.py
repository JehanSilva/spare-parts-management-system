from django.db import models
import uuid

class Supplier(models.Model):
    """
    Represents the company/person you buy parts from.
    """
    name = models.CharField(max_length=100)          # e.g., "AutoParts LK Distributors"
    contacts = models.JSONField(default=list, blank=True, null=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    # Which of the contacts' numbers to call by default. Stored as the number
    # itself rather than an index, so reordering or renaming contacts doesn't
    # silently repoint it at someone else. Blank = fall back to the first number.
    primary_phone = models.CharField(max_length=30, blank=True)
    # Where to send payment. All optional — plenty of suppliers are paid in cash,
    # and the ones already on file predate these fields.
    bank_name = models.CharField(max_length=100, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_account_name = models.CharField(max_length=100, blank=True, help_text="Name the account is held under")

    def __str__(self):
        return self.name

class Vehicle(models.Model):
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    year = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('make', 'model', 'year')

    def __str__(self):
        return f"{self.make} {self.model} ({self.year or 'Unknown'})"

class Part(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    part_number = models.CharField(max_length=50, unique=True)
    
    brand = models.CharField(max_length=50, blank=True, help_text="e.g., Toyota Genuine, Bosch, K&N")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, related_name='parts')
    
    description = models.TextField(blank=True)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_qty = models.PositiveIntegerField(default=0)
    min_stock_level = models.PositiveIntegerField(default=5)
    rack_location = models.CharField(max_length=50, blank=True)
    image = models.ImageField(upload_to='parts/', blank=True, null=True)
    
    compatible_vehicles = models.ManyToManyField(Vehicle, related_name='compatible_parts', blank=True)

    def __str__(self):
        return f"{self.name} ({self.brand})"

class Customer(models.Model):
    """
    Represents a real-world customer who brings their vehicle in for service.
    A customer can have multiple registered vehicles (CustomerVehicle).
    """
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class CustomerVehicle(models.Model):
    """
    A specific registered vehicle (by plate number) — independent master data.
    Optionally linked to a Customer; deleting the customer unlinks rather
    than deletes the vehicle (on_delete=SET_NULL), so vehicle history is
    preserved. This is NOT the Vehicle make/model catalog used for parts
    compatibility.
    """
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles')
    vehicle_number = models.CharField(max_length=20, unique=True, help_text="Vehicle registration plate number")
    make = models.CharField(max_length=50, blank=True, help_text="e.g., Toyota")
    model = models.CharField(max_length=50, blank=True, help_text="e.g., Corolla")
    year = models.PositiveIntegerField(null=True, blank=True)
    color = models.CharField(max_length=50, blank=True, help_text="e.g., Pearl White")
    current_mileage = models.PositiveIntegerField(null=True, blank=True, help_text="Current odometer reading in km")
    # When current_mileage was last actually read, which is NOT updated_at —
    # that moves whenever any field changes (colour, notes, customer link).
    # Bills quote the last known reading, so they have to be able to say how
    # old it is.
    mileage_updated_at = models.DateTimeField(null=True, blank=True, help_text="When current_mileage was last recorded")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remember what was loaded so save() can tell a real mileage change
        # from a save that merely touched other fields.
        self._loaded_mileage = self.current_mileage

    def save(self, *args, **kwargs):
        from django.utils import timezone
        # Stamp the reading whenever it actually changes — including the first
        # one, set when the vehicle is registered — but never on a save that
        # only touched other fields.
        mileage_changed = self._state.adding or self.current_mileage != self._loaded_mileage
        if self.current_mileage is not None and mileage_changed:
            self.mileage_updated_at = timezone.now()
        super().save(*args, **kwargs)
        self._loaded_mileage = self.current_mileage

    def __str__(self):
        return f"{self.vehicle_number} ({self.customer.name if self.customer else 'Unlinked'})"



class Sale(models.Model):
    STATUS_CHOICES = [
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partially Paid'),
        ('CREDIT', 'Credit (Pay Later)'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey('Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    customer_name = models.CharField(max_length=100)
    vehicle_number = models.CharField(max_length=20, blank=True, null=True, help_text="Optional vehicle reg number")
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='COMPLETED')
    cancel_reason = models.TextField(blank=True, null=True, help_text="Reason why this sale was cancelled")
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='PAID')
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Amount actually received at time of sale. Equals total_amount unless payment_status is PARTIAL or CREDIT.")
    credit_note = models.TextField(blank=True, null=True, help_text="Note about the credit/partial sale, e.g. when the customer will pay the balance")
    credit_settled_at = models.DateTimeField(null=True, blank=True, help_text="When this credit/partial sale's balance was marked as received")
    mileage = models.PositiveIntegerField(null=True, blank=True, help_text="Vehicle's odometer reading at the time of this job, if known")
    notes = models.TextField(blank=True, help_text="Notes about the repair/job performed")

    def __str__(self):
        return f"Sale {str(self.id)[:8]} - {self.customer_name} ({self.status})"

class SaleItem(models.Model):
    ITEM_TYPE_CHOICES = [
        ('PART', 'Part'),
        ('LABOR', 'Labor'),
    ]
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    part = models.ForeignKey(Part, on_delete=models.PROTECT, null=True, blank=True)
    item_type = models.CharField(max_length=10, choices=ITEM_TYPE_CHOICES, default='PART')
    description = models.CharField(max_length=255, blank=True, help_text="Used for LABOR items, e.g. 'Brake pad replacement'")
    quantity = models.PositiveIntegerField(default=1)

    # SNAPSHOT: The standard price at the moment of sale
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    # NEW: The discount given just for this specific line item
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # NEW: Calculated field: (unit_price - discount) * quantity
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    warranty_period_months = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        # Auto-calculate total before saving
        # Logic: (Unit Price - Discount) * Quantity
        price = self.unit_price or 0
        disc = self.discount or 0
        qty = self.quantity or 1

        self.total_price = (price - disc) * qty
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.part.name if self.part else self.description} (x{self.quantity})"

# The four task groups an estimate is built from — mirrors ESTIMATE_SECTIONS in
# frontend/src/components/EstimateDocument.js.
ESTIMATE_SECTION_KEYS = ['removing', 'repair', 'paint', 'replacing']


def estimate_total(sections):
    """
    Grand total of an estimate's section dict. Mirrors rowTotal/estimateTotal in
    EstimateDocument.js: a line's total is its rate multiplied by hours (or
    quantity), and a blank/zero hours figure prices the line as a flat amount.
    """
    from decimal import Decimal, InvalidOperation

    def to_decimal(value):
        try:
            return Decimal(str(value).strip() or '0')
        except (InvalidOperation, AttributeError, TypeError):
            return Decimal('0')

    total = Decimal('0')
    for key in ESTIMATE_SECTION_KEYS:
        for row in (sections or {}).get(key) or []:
            if not isinstance(row, dict):
                continue
            rate = to_decimal(row.get('rate'))
            units = to_decimal(row.get('hours'))
            total += rate * units if units > 0 else rate
    return total


class Estimate(models.Model):
    """
    A saved insurance-claim repair estimate, printed on the NSS Auto Engineers
    letterhead. Line items live in a JSON `sections` dict keyed by
    ESTIMATE_SECTION_KEYS, the same shape the estimate builder edits — the
    sections are fixed and nothing reports on individual lines, so there is no
    child table (see ActiveCart.items for the same trade-off).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    estimate_number = models.CharField(max_length=20, unique=True, blank=True, help_text="Sequential reference, e.g. EST-0001")
    # SET_NULL, like CustomerVehicle.customer: removing a vehicle from the
    # registry must not destroy the estimates quoted against it.
    vehicle = models.ForeignKey(CustomerVehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name='estimates')
    vehicle_number = models.CharField(max_length=20, help_text="Plate as printed; kept in sync with the linked vehicle")
    make_model = models.CharField(max_length=100, blank=True)
    insurance_company = models.CharField(max_length=150)
    date = models.DateField()
    validity_days = models.PositiveIntegerField(default=30)
    sections = models.JSONField(default=dict, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def save(self, *args, **kwargs):
        # Always derived from the lines, never accepted from the client.
        self.total_amount = estimate_total(self.sections)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.estimate_number or 'Estimate'} - {self.vehicle_number} ({self.insurance_company})"


class ActiveCart(models.Model):
    id = models.CharField(max_length=50, primary_key=True) # Matches the frontend cart.id
    customer_name = models.CharField(max_length=100, blank=True, default='')
    vehicle_number = models.CharField(max_length=20, blank=True, default='')
    customer = models.ForeignKey('Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='active_carts')
    items = models.JSONField(default=list, blank=True)
    mileage = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart {self.id} - {self.customer_name or 'No Name'} ({self.vehicle_number or 'No Vehicle'})"

from django.utils import timezone

def default_working_days():
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

class Employee(models.Model):
    SALARY_TYPE_CHOICES = [
        ('DAILY', 'Daily Paid'),
        ('MONTHLY', 'Monthly Paid'),
    ]
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(blank=True, null=True)
    phone_numbers = models.JSONField(default=list, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    role = models.CharField(max_length=50, help_text="e.g., Mechanic, Cashier, Manager, Storekeeper")
    date_joined = models.DateField(default=timezone.localdate)
    salary_type = models.CharField(max_length=10, choices=SALARY_TYPE_CHOICES, default='DAILY')
    salary_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Daily rate or Monthly salary depending on salary_type")
    working_days = models.JSONField(default=default_working_days, blank=True, null=True, help_text="List of working days of the week")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.role})"

class Holiday(models.Model):
    date = models.DateField(unique=True)
    name = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.date} - {self.name or 'Holiday'}"

class Attendance(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('HALF_DAY', 'Half Day'),
        ('ABSENT', 'Absent'),
        ('PAID_LEAVE', 'Paid Leave'),
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('employee', 'date')

    def __str__(self):
        return f"{self.employee.first_name} - {self.date} - {self.status}"

class Payroll(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PAID', 'Paid'),
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payrolls')
    month = models.PositiveIntegerField() # 1-12
    year = models.PositiveIntegerField()
    days_present = models.DecimalField(max_digits=4, decimal_places=1, default=0.0)
    days_paid_leave = models.DecimalField(max_digits=4, decimal_places=1, default=0.0)
    days_absent = models.DecimalField(max_digits=4, decimal_places=1, default=0.0)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='DRAFT')
    paid_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'month', 'year')

    def save(self, *args, **kwargs):
        from decimal import Decimal
        base = Decimal(str(self.base_salary or 0.00))
        allow = Decimal(str(self.allowances or 0.00))
        deduct = Decimal(str(self.deductions or 0.00))
        self.net_salary = base + allow - deduct
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee.first_name} - {self.year}/{self.month:02d} - {self.status}"


class RestockRecord(models.Model):
    """
    Records a single supplier's contribution to a restock event.
    A single 'Quick Restock' action can generate multiple RestockRecords
    (one per supplier entry). This is the source of truth for purchase history.
    """
    STATUS_ACTIVE = 'ACTIVE'
    STATUS_PARTIALLY_RETURNED = 'PARTIALLY_RETURNED'
    STATUS_FULLY_RETURNED = 'FULLY_RETURNED'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_PARTIALLY_RETURNED, 'Partially Returned'),
        (STATUS_FULLY_RETURNED, 'Fully Returned'),
    ]

    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='restock_records')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='restock_records')
    quantity = models.PositiveIntegerField()
    buy_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Unit buy price from this supplier for this batch")
    restocked_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    invoice_number = models.CharField(max_length=100, blank=True, default='')

    # Return tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    returned_quantity = models.PositiveIntegerField(default=0)
    return_reason = models.TextField(blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-restocked_at']

    def __str__(self):
        supplier_name = self.supplier.name if self.supplier else "Unknown"
        return f"{self.part.name} | {supplier_name} | Qty: {self.quantity} @ {self.buy_price}"