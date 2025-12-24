from django.contrib import admin
from .models import Part, Vehicle, Supplier, Sale, SaleItem

admin.site.register(Part)
admin.site.register(Vehicle)
admin.site.register(Supplier) # <--- Added this
admin.site.register(Sale)
admin.site.register(SaleItem)