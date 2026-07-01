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

class Sale(models.Model):
    STATUS_CHOICES = [
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_name = models.CharField(max_length=100)
    vehicle_number = models.CharField(max_length=20, blank=True, null=True, help_text="Optional vehicle reg number")
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='COMPLETED')
    cancel_reason = models.TextField(blank=True, null=True, help_text="Reason why this sale was cancelled")

    def __str__(self):
        return f"Sale {str(self.id)[:8]} - {self.customer_name} ({self.status})"

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    part = models.ForeignKey(Part, on_delete=models.PROTECT)
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
        return f"{self.part.name} (x{self.quantity})"

class ActiveCart(models.Model):
    id = models.CharField(max_length=50, primary_key=True) # Matches the frontend cart.id
    customer_name = models.CharField(max_length=100, blank=True, default='')
    vehicle_number = models.CharField(max_length=20, blank=True, default='')
    items = models.JSONField(default=list, blank=True)
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