from django.db import models
import uuid

class Vehicle(models.Model):
    """
    Represents a specific car model (e.g., Toyota Corolla 2018).
    """
    make = models.CharField(max_length=50)   # e.g., Toyota
    model = models.CharField(max_length=50)  # e.g., Corolla
    year = models.PositiveIntegerField()     # e.g., 2018

    class Meta:
        unique_together = ('make', 'model', 'year')

    def __str__(self):
        return f"{self.year} {self.make} {self.model}"

class Part(models.Model):
    """
    Represents a spare part in your inventory.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)          # e.g., Oil Filter
    part_number = models.CharField(max_length=50, unique=True) # OEM Number
    description = models.TextField(blank=True)
    
    # Pricing & Stock
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_qty = models.PositiveIntegerField(default=0)
    min_stock_level = models.PositiveIntegerField(default=5, help_text="Alert when stock dips below this")
    
    # Logistics
    rack_location = models.CharField(max_length=50, help_text="e.g., Aisle 3, Shelf B")
    image_url = models.URLField(max_length=500, blank=True, null=True) # Link to AWS S3

    # The Magic Link: Many-to-Many Relationship
    # This automatically creates the 'PartCompatibility' table in the background
    compatible_vehicles = models.ManyToManyField(Vehicle, related_name='compatible_parts', blank=True)

    def __str__(self):
        return f"{self.name} ({self.part_number})"

class Sale(models.Model):
    """
    Represents a finalized bill/invoice.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    def __str__(self):
        return f"Inv #{str(self.id)[:8]} - {self.customer_name}"

class SaleItem(models.Model):
    """
    Individual items inside a Sale.
    """
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    part = models.ForeignKey(Part, on_delete=models.PROTECT) # Prevent deleting part if it has sales history
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2) # Price at moment of sale
    
    # Warranty Logic
    warranty_period_months = models.PositiveIntegerField(default=0) 
    
    def total_price(self):
        return self.quantity * self.unit_price