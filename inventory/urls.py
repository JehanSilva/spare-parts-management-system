from django.urls import path
from . import views

urlpatterns = [
    # Suppliers
    path('suppliers/', views.get_suppliers, name='get_suppliers'),      # GET only
    path('suppliers/add/', views.add_supplier, name='add_supplier'),    # POST only
    path('suppliers/<int:pk>/update/', views.update_supplier, name='update_supplier'),
    path('suppliers/<int:pk>/delete/', views.delete_supplier, name='delete_supplier'),
    
    # Parts
    path('parts/', views.get_parts, name='get_parts'),
    path('parts/minimal/', views.get_parts_minimal, name='get_parts_minimal'),
    path('parts/add/', views.add_part, name='add_part'),
    path('parts/<uuid:pk>/update/', views.update_part, name='update_part'),
    path('parts/<uuid:pk>/delete/', views.delete_part, name='delete_part'),

    # Sales
    path('sales/create/', views.create_sale, name='create_sale'),
    path('sales/', views.get_all_sales, name='get_all_sales'),

    # Reports
    path('dashboard/', views.dashboard_stats, name='dashboard_stats'),

    # Vehicles
    path('vehicles/', views.get_vehicles, name='get_vehicles'),
    path('vehicles/add/', views.add_vehicle, name='add_vehicle'),
    path('vehicles/<int:pk>/update/', views.update_vehicle, name='update_vehicle'),
    path('vehicles/<int:pk>/delete/', views.delete_vehicle, name='delete_vehicle'),

    # Dashboard Stats
    path('dashboard/stats/', views.get_dashboard_stats, name='dashboard_stats'),
]