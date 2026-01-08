from django.urls import path
from . import views

urlpatterns = [
    # Suppliers
    path('suppliers/', views.supplier_list, name='supplier_list'),
    path('suppliers/<int:pk>/update/', views.update_supplier, name='update_supplier'),
    path('suppliers/<int:pk>/delete/', views.delete_supplier, name='delete_supplier'),

    # Parts
    path('parts/', views.get_parts, name='get_parts'),
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