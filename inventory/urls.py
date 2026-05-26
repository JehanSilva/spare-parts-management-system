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
    path('parts/bulk-upload/', views.bulk_upload_parts, name='bulk_upload_parts'),
    path('parts/<uuid:pk>/update/', views.update_part, name='update_part'),
    path('parts/<uuid:pk>/delete/', views.delete_part, name='delete_part'),
    path('parts/<uuid:pk>/restock/', views.restock_part, name='restock_part'),

    # Sales
    path('sales/create/', views.create_sale, name='create_sale'),
    path('sales/', views.get_all_sales, name='get_all_sales'),
    path('sales/<uuid:pk>/update/', views.update_sale, name='update_sale'),
    path('sales/<uuid:pk>/cancel/', views.cancel_sale, name='cancel_sale'),

    # Reports
    path('dashboard/', views.dashboard_stats, name='dashboard_stats'),

    # Vehicles
    path('vehicles/', views.get_vehicles, name='get_vehicles'),
    path('vehicles/add/', views.add_vehicle, name='add_vehicle'),
    path('vehicles/<int:pk>/update/', views.update_vehicle, name='update_vehicle'),
    path('vehicles/<int:pk>/delete/', views.delete_vehicle, name='delete_vehicle'),

    # Dashboard Stats
    path('dashboard/stats/', views.get_dashboard_stats, name='dashboard_stats'),
    
    # Daily Report
    path('reports/daily/', views.daily_report, name='daily_report'),

    # Active Carts (POS Sync)
    path('active-carts/', views.get_active_carts, name='get_active_carts'),
    path('active-carts/sync/', views.sync_active_carts, name='sync_active_carts'),

    # Employees
    path('employees/', views.get_employees, name='get_employees'),
    path('employees/add/', views.add_employee, name='add_employee'),
    path('employees/<int:pk>/update/', views.update_employee, name='update_employee'),
    path('employees/<int:pk>/delete/', views.delete_employee, name='delete_employee'),

    # Attendance
    path('attendance/', views.get_attendance_sheet, name='get_attendance_sheet'),
    path('attendance/mark/', views.mark_attendance_sheet, name='mark_attendance_sheet'),

    # Payroll
    path('payroll/', views.get_payroll_list, name='get_payroll_list'),
    path('payroll/generate/', views.generate_payroll_drafts, name='generate_payroll_drafts'),
    path('payroll/<int:pk>/update/', views.update_payroll_record, name='update_payroll_record'),
    path('payroll/<int:pk>/pay/', views.pay_payroll_record, name='pay_payroll_record'),
]