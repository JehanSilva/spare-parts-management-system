from django.urls import path
from . import views

urlpatterns = [
    # Customers
    path('customers/', views.get_customers, name='get_customers'),
    path('customers/add/', views.add_customer, name='add_customer'),
    path('customers/<int:pk>/update/', views.update_customer, name='update_customer'),
    path('customers/<int:pk>/delete/', views.delete_customer, name='delete_customer'),
    path('customers/<int:pk>/history/', views.get_customer_history, name='get_customer_history'),
    path('customers/<int:pk>/vehicles/add/', views.add_vehicle_to_customer, name='add_vehicle_to_customer'),
    path('customers/vehicles/<int:vehicle_pk>/delete/', views.delete_customer_vehicle, name='delete_customer_vehicle'),
    path('customers/vehicles/<int:vehicle_pk>/update/', views.update_customer_vehicle, name='update_customer_vehicle'),

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
    path('parts/bulk-upload/resolve/', views.resolve_bulk_upload_conflicts, name='resolve_bulk_upload_conflicts'),
    path('parts/bulk-upload/cancel/', views.cancel_bulk_upload, name='cancel_bulk_upload'),
    path('parts/<uuid:pk>/update/', views.update_part, name='update_part'),
    path('parts/<uuid:pk>/delete/', views.delete_part, name='delete_part'),
    path('parts/<uuid:pk>/restock/', views.restock_part, name='restock_part'),
    path('parts/<uuid:pk>/restock-history/', views.get_restock_history, name='get_restock_history'),
    path('parts/<uuid:part_pk>/restock/<int:record_pk>/return/', views.return_restock_record, name='return_restock_record'),
    path('parts/<uuid:part_pk>/restock/<int:record_pk>/edit/', views.edit_restock_record, name='edit_restock_record'),

    # Sales
    path('sales/create/', views.create_sale, name='create_sale'),
    path('sales/', views.get_all_sales, name='get_all_sales'),
    path('sales/<uuid:pk>/update/', views.update_sale, name='update_sale'),
    path('sales/<uuid:pk>/cancel/', views.cancel_sale, name='cancel_sale'),
    path('sales/<uuid:pk>/reverse/', views.reverse_sale, name='reverse_sale'),
    path('sales/<uuid:pk>/mark-paid/', views.mark_sale_paid, name='mark_sale_paid'),

    # Estimates (insurance claim repair estimates)
    path('estimates/', views.get_estimates, name='get_estimates'),
    path('estimates/create/', views.create_estimate, name='create_estimate'),
    path('estimates/<uuid:pk>/', views.get_estimate, name='get_estimate'),
    path('estimates/<uuid:pk>/update/', views.update_estimate, name='update_estimate'),
    path('estimates/<uuid:pk>/delete/', views.delete_estimate, name='delete_estimate'),

    # Reports
    path('dashboard/', views.dashboard_stats, name='dashboard_stats'),

    # Vehicles (parts-compatibility catalog — make/model/year, no plate)
    path('vehicles/', views.get_vehicles, name='get_vehicles'),
    path('vehicles/add/', views.add_vehicle, name='add_vehicle'),
    path('vehicles/<int:pk>/update/', views.update_vehicle, name='update_vehicle'),
    path('vehicles/<int:pk>/delete/', views.delete_vehicle, name='delete_vehicle'),

    # Vehicle Registry (real registered plates — independent master data)
    path('vehicles/registry/', views.get_customer_vehicles, name='get_customer_vehicles'),
    path('vehicles/registry/add/', views.add_customer_vehicle, name='add_customer_vehicle'),
    path('vehicles/registry/lookup/', views.lookup_vehicle, name='lookup_vehicle'),
    path('vehicles/registry/<int:pk>/history/', views.get_vehicle_history, name='get_vehicle_history'),
    path('vehicles/registry/<int:pk>/estimates/', views.get_vehicle_estimates, name='get_vehicle_estimates'),

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
    path('employees/<int:pk>/attendance/', views.get_employee_attendance, name='get_employee_attendance'),

    # Attendance
    path('attendance/', views.get_attendance_sheet, name='get_attendance_sheet'),
    path('attendance/mark/', views.mark_attendance_sheet, name='mark_attendance_sheet'),

    # Holidays
    path('holidays/', views.get_holidays, name='get_holidays'),
    path('holidays/add/', views.add_holiday, name='add_holiday'),
    path('holidays/<int:pk>/delete/', views.delete_holiday, name='delete_holiday'),

    # Payroll
    path('payroll/', views.get_payroll_list, name='get_payroll_list'),
    path('payroll/generate/', views.generate_payroll_drafts, name='generate_payroll_drafts'),
    path('payroll/<int:pk>/update/', views.update_payroll_record, name='update_payroll_record'),
    path('payroll/<int:pk>/pay/', views.pay_payroll_record, name='pay_payroll_record'),
]