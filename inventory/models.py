from django.db import models
import uuid

class Supplier(models.Model):
    """
    Represents the company/person you buy parts from.
    """
    name = models.CharField(max_length=100)          # e.g., "AutoParts LK Distributors"
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Vehicle(models.Model):
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    year = models.PositiveIntegerField()

    class Meta:
        unique_together = ('make', 'model', 'year')

    def __str__(self):
        return f"{self.year} {self.make} {self.model}"

class Part(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    part_number = models.CharField(max_length=50, unique=True)
    
    # NEW FIELDS ADDED HERE
    brand = models.CharField(max_length=50, blank=True, help_text="e.g., Toyota Genuine, Bosch, K&N")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, related_name='parts')
    
    description = models.TextField(blank=True)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_qty = models.PositiveIntegerField(default=0)
    min_stock_level = models.PositiveIntegerField(default=5)
    rack_location = models.CharField(max_length=50)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    
    compatible_vehicles = models.ManyToManyField(Vehicle, related_name='compatible_parts', blank=True)

    def __str__(self):
        return f"{self.name} ({self.brand})"

class Sale(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_name = models.CharField(max_length=100)
    vehicle_number = models.CharField(max_length=20, blank=True, null=True, help_text="Optional vehicle reg number")
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    part = models.ForeignKey(Part, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    warranty_period_months = models.PositiveIntegerField(default=0)