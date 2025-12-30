from django.urls import path
from . import views

urlpatterns = [
    # Suppliers
    path('suppliers/', views.supplier_list, name='supplier_list'),

    # Parts
    path('parts/', views.get_parts, name='get_parts'),
    path('parts/add/', views.add_part, name='add_part'),

    # Sales
    path('sales/create/', views.create_sale, name='create_sale'),

    # Reports
    path('dashboard/', views.dashboard_stats, name='dashboard_stats'),

    # Vehicles
    path('vehicles/', views.get_vehicles, name='get_vehicles'),
    path('vehicles/add/', views.add_vehicle, name='add_vehicle'),
]