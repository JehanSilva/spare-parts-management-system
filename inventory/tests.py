import io
import pandas as pd
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from .models import Part, Vehicle, Supplier, Sale, SaleItem, ActiveCart, Employee, Attendance, Payroll

class PartMinimalAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.vehicle = Vehicle.objects.create(make="Toyota", model="Corolla", year=2020)
        self.part = Part.objects.create(
            name="Test Part",
            part_number="TP-123",
            brand="TestBrand",
            buy_price=10.00,
            sell_price=15.00,
            stock_qty=10,
            min_stock_level=5,
            rack_location="A1"
        )
        self.part.compatible_vehicles.add(self.vehicle)
        self.url = reverse('get_parts_minimal')

    def test_get_parts_minimal(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check structure
        self.assertTrue(len(response.data) > 0)
        item = response.data[0]
        self.assertIn('part_number', item)
        self.assertIn('image', item)
        self.assertIn('compatible_vehicles', item)
        self.assertEqual(item['part_number'], "TP-123")
        self.assertEqual(len(item['compatible_vehicles']), 1)
        self.assertEqual(item['compatible_vehicles'][0]['make'], "Toyota")


class BulkUploadAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create a user and authenticate
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        
        self.url = reverse('bulk_upload_parts')
        # Create an existing part to test update logic
        self.existing_part = Part.objects.create(
            name="Old Name",
            part_number="B110G0131",
            brand="Old Brand",
            buy_price=500.00,
            sell_price=800.00,
            stock_qty=10,
            min_stock_level=5,
            rack_location="Old Location"
        )
        
    def test_bulk_upload_excel(self):
        # Create a mock Excel sheet in memory
        data = {
            'Part Name': ['Cworks Oil Filter', 'New Part Test'],
            'Part Number': ['B110G0131', 'B16019120'],
            'Brand': ['Cworks', 'TestBrand'],
            'Supplier': ['Toyotsu Lanka (Pvt) Ltd', 'Test Supplier'],
            'Cost Price': [750.00, 150.00],
            'Selling Price': [1000.00, 200.00],
            'Current Stock': [6, 4],
            'Rack/Bin Location': ['Oil Filter Rack', 'Rack B'],
            'Fits Vehicles': ['Toyota Corolla (2020)', 'Toyota Corolla (2020), Honda Civic 2021']
        }
        df = pd.DataFrame(data)
        
        # Write to BytesIO
        excel_file = io.BytesIO()
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        excel_file.seek(0)
        excel_file.name = 'test_parts.xlsx'
        
        # Upload
        response = self.client.post(self.url, {'file': excel_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify existing part updated
        self.existing_part.refresh_from_db()
        self.assertEqual(self.existing_part.name, 'Cworks Oil Filter')
        self.assertEqual(self.existing_part.brand, 'Cworks')
        self.assertEqual(float(self.existing_part.buy_price), 593.75) # weighted average: (10*500 + 6*750) / 16 = 593.75
        self.assertEqual(float(self.existing_part.sell_price), 1000.00)
        self.assertEqual(self.existing_part.stock_qty, 16) # accumulated: 10 + 6 = 16
        self.assertEqual(self.existing_part.rack_location, 'Oil Filter Rack')
        
        # Verify supplier created and assigned
        self.assertIsNotNone(self.existing_part.supplier)
        self.assertEqual(self.existing_part.supplier.name, 'Toyotsu Lanka (Pvt) Ltd')
        
        # Verify compatible vehicles updated
        self.assertEqual(self.existing_part.compatible_vehicles.count(), 1)
        v1 = self.existing_part.compatible_vehicles.first()
        self.assertEqual(v1.make, "Toyota")
        self.assertEqual(v1.model, "Corolla")
        self.assertEqual(v1.year, 2020)
        
        # Verify new part created
        new_part = Part.objects.get(part_number='B16019120')
        self.assertEqual(new_part.name, 'New Part Test')
        self.assertEqual(new_part.brand, 'TestBrand')
        self.assertEqual(float(new_part.buy_price), 150.00)
        self.assertEqual(float(new_part.sell_price), 200.00)
        self.assertEqual(new_part.stock_qty, 4)
        self.assertEqual(new_part.rack_location, 'Rack B')
        self.assertEqual(new_part.supplier.name, 'Test Supplier')
        
        # Verify new part compatible vehicles
        self.assertEqual(new_part.compatible_vehicles.count(), 2)
        v_list = list(new_part.compatible_vehicles.all().order_by('make'))
        self.assertEqual(v_list[0].make, "Honda")
        self.assertEqual(v_list[0].model, "Civic")
        self.assertEqual(v_list[0].year, 2021)
        self.assertEqual(v_list[1].make, "Toyota")
        self.assertEqual(v_list[1].model, "Corolla")
        self.assertEqual(v_list[1].year, 2020)


class PartCalculationAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        
        # Create vehicles
        self.vehicle1 = Vehicle.objects.create(make="Toyota", model="Corolla", year=2020)
        self.vehicle2 = Vehicle.objects.create(make="Honda", model="Civic", year=2021)
        
        # Create supplier
        self.supplier = Supplier.objects.create(name="Toyota Parts LK")
        
        # Create parts
        self.part1 = Part.objects.create(
            name="Oil Filter",
            part_number="OF-100",
            brand="Toyota Genuine",
            buy_price=1000.00,
            sell_price=1500.00,
            stock_qty=50,
            supplier=self.supplier
        )
        # Add compatible vehicles to part1 to test join/distinct
        self.part1.compatible_vehicles.add(self.vehicle1, self.vehicle2)
        
        # Create completed sales
        self.sale1 = Sale.objects.create(customer_name="Customer A", status="COMPLETED")
        self.sale_item1 = SaleItem.objects.create(
            sale=self.sale1,
            part=self.part1,
            quantity=2,
            unit_price=1500.00,
            discount=100.00
        )
        self.sale_item1.save()
        
        self.sale2 = Sale.objects.create(customer_name="Customer B", status="COMPLETED")
        self.sale_item2 = SaleItem.objects.create(
            sale=self.sale2,
            part=self.part1,
            quantity=3,
            unit_price=1500.00,
            discount=0.00
        )
        self.sale_item2.save()
        
        # Create cancelled sale (should be ignored)
        self.sale3 = Sale.objects.create(customer_name="Customer C", status="CANCELLED")
        self.sale_item3 = SaleItem.objects.create(
            sale=self.sale3,
            part=self.part1,
            quantity=5,
            unit_price=1500.00,
            discount=0.00
        )
        self.sale_item3.save()
        
        self.url = reverse('get_parts')

    def test_part_calculations(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Find part1 in response
        part_data = next((p for p in response.data if p['part_number'] == "OF-100"), None)
        self.assertIsNotNone(part_data)
        
        # Check total_sold: should be 2 + 3 = 5 (ignores cancelled sale)
        self.assertEqual(part_data['total_sold'], 5)
        
        # Check total_revenue: should be (1500 - 100)*2 + (1500 - 0)*3 = 2800 + 4500 = 7300.00
        self.assertEqual(part_data['total_revenue'], 7300.00)
        
        # Check total_cost: should be 1000*2 + 1000*3 = 2000 + 3000 = 5000.00
        self.assertEqual(part_data['total_cost'], 5000.00)

    def test_part_calculations_with_search(self):
        # Search for Corolla, which joins compatible vehicles
        response = self.client.get(self.url, {'search': 'Corolla'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Find part1 in response
        part_data = next((p for p in response.data if p['part_number'] == "OF-100"), None)
        self.assertIsNotNone(part_data)
        
        # Check that calculations are still correct and not duplicated by the join/distinct
        self.assertEqual(part_data['total_sold'], 5)
        self.assertEqual(part_data['total_revenue'], 7300.00)
        self.assertEqual(part_data['total_cost'], 5000.00)

class ActiveCartAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        
        # Create an initial cart
        self.cart = ActiveCart.objects.create(
            id="cart_test_123",
            customer_name="Test Customer",
            vehicle_number="WP-1234",
            items=[{"id": "part-uuid", "quantity": 1}]
        )
        self.list_url = reverse('get_active_carts')
        self.sync_url = reverse('sync_active_carts')

    def test_get_active_carts(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], "cart_test_123")
        self.assertEqual(response.data[0]['customer_name'], "Test Customer")

    def test_sync_active_carts(self):
        # 1. Update existing and create new cart
        sync_payload = [
            {
                "id": "cart_test_123",
                "customer_name": "Test Customer Updated",
                "vehicle_number": "WP-1234",
                "items": [{"id": "part-uuid", "quantity": 2}]
            },
            {
                "id": "cart_new_456",
                "customer_name": "New Customer",
                "vehicle_number": "WP-5678",
                "items": []
            }
        ]
        
        response = self.client.post(self.sync_url, sync_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(ActiveCart.objects.count(), 2)
        
        # Verify update
        updated_cart = ActiveCart.objects.get(id="cart_test_123")
        self.assertEqual(updated_cart.customer_name, "Test Customer Updated")
        self.assertEqual(updated_cart.items[0]['quantity'], 2)
        
        # Verify creation
        new_cart = ActiveCart.objects.get(id="cart_new_456")
        self.assertEqual(new_cart.customer_name, "New Customer")
        
        # 2. Sync again but omit cart_test_123 (it should be deleted)
        sync_payload_delete = [
            {
                "id": "cart_new_456",
                "customer_name": "New Customer",
                "vehicle_number": "WP-5678",
                "items": []
            }
        ]
        response = self.client.post(self.sync_url, sync_payload_delete, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(ActiveCart.objects.count(), 1)
        self.assertFalse(ActiveCart.objects.filter(id="cart_test_123").exists())


class EmployeeManagementAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)

        self.employee = Employee.objects.create(
            first_name="John",
            last_name="Doe",
            role="Mechanic",
            salary_type="DAILY",
            salary_rate=1500.00
        )
        self.list_url = reverse('get_employees')
        self.add_url = reverse('add_employee')
        self.update_url = reverse('update_employee', kwargs={'pk': self.employee.pk})
        self.delete_url = reverse('delete_employee', kwargs={'pk': self.employee.pk})

    def test_get_employees(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['first_name'], "John")

    def test_add_employee(self):
        payload = {
            "first_name": "Jane",
            "last_name": "Smith",
            "role": "Cashier",
            "salary_type": "MONTHLY",
            "salary_rate": 45000.00
        }
        response = self.client.post(self.add_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Employee.objects.count(), 2)

    def test_update_employee(self):
        payload = {
            "first_name": "John",
            "last_name": "Doe Updated",
            "role": "Senior Mechanic",
            "salary_type": "DAILY",
            "salary_rate": 2000.00
        }
        response = self.client.put(self.update_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.last_name, "Doe Updated")
        self.assertEqual(self.employee.role, "Senior Mechanic")

    def test_delete_employee(self):
        # Simply delete when no attendance
        response = self.client.delete(self.delete_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Employee.objects.count(), 0)

    def test_deactivate_employee_when_has_attendance(self):
        # Create an attendance record
        Attendance.objects.create(
            employee=self.employee,
            date="2026-05-26",
            status="PRESENT"
        )
        response = self.client.delete(self.delete_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.is_active)
        self.assertEqual(Employee.objects.count(), 1)


class AttendanceAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)

        self.employee1 = Employee.objects.create(first_name="John", last_name="Doe", role="Mechanic")
        self.employee2 = Employee.objects.create(first_name="Jane", last_name="Smith", role="Cashier")

        self.sheet_url = reverse('get_attendance_sheet')
        self.mark_url = reverse('mark_attendance_sheet')

    def test_get_attendance_sheet_template(self):
        # Get sheet for a date where no records exist - should return defaults for both employees
        response = self.client.get(self.sheet_url, {"date": "2026-05-26"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Defaults to PRESENT
        self.assertEqual(response.data[0]['status'], 'PRESENT')

    def test_mark_attendance_sheet(self):
        payload = {
            "date": "2026-05-26",
            "attendances": [
                {"employee": self.employee1.id, "status": "PRESENT", "notes": "On time"},
                {"employee": self.employee2.id, "status": "HALF_DAY", "notes": "Left early"}
            ]
        }
        response = self.client.post(self.mark_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Attendance.objects.count(), 2)

        att1 = Attendance.objects.get(employee=self.employee1, date="2026-05-26")
        self.assertEqual(att1.status, 'PRESENT')
        self.assertEqual(att1.notes, 'On time')


class PayrollAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)

        # 1. Daily rate employee
        self.emp_daily = Employee.objects.create(
            first_name="John",
            last_name="Doe",
            role="Mechanic",
            salary_type="DAILY",
            salary_rate=1500.00
        )
        # 2. Monthly fixed employee
        self.emp_monthly = Employee.objects.create(
            first_name="Jane",
            last_name="Smith",
            role="Cashier",
            salary_type="MONTHLY",
            salary_rate=45000.00
        )

        # Setup attendance for month=5, year=2026
        # John (daily) is present 3 times, half-day 1 time, absent 1 time.
        # Present + Paid Leave count = 3 (present) * 1.0 + 1 (half) * 0.5 = 3.5 days.
        # Base Salary should be 3.5 * 1500.00 = 5250.00.
        Attendance.objects.create(employee=self.emp_daily, date="2026-05-01", status="PRESENT")
        Attendance.objects.create(employee=self.emp_daily, date="2026-05-02", status="PRESENT")
        Attendance.objects.create(employee=self.emp_daily, date="2026-05-03", status="PRESENT")
        Attendance.objects.create(employee=self.emp_daily, date="2026-05-04", status="HALF_DAY")
        Attendance.objects.create(employee=self.emp_daily, date="2026-05-05", status="ABSENT")

        # Jane (monthly) is present 2 times.
        # Base Salary should be 45000.00 regardless of attendance.
        Attendance.objects.create(employee=self.emp_monthly, date="2026-05-01", status="PRESENT")
        Attendance.objects.create(employee=self.emp_monthly, date="2026-05-02", status="PRESENT")

        self.list_url = reverse('get_payroll_list')
        self.generate_url = reverse('generate_payroll_drafts')

    def test_generate_payroll_drafts(self):
        payload = {"month": 5, "year": 2026}
        response = self.client.post(self.generate_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Payroll.objects.count(), 2)

        # John (daily) calculations
        payroll_daily = Payroll.objects.get(employee=self.emp_daily, month=5, year=2026)
        self.assertEqual(float(payroll_daily.days_present), 3.5) # 3.0 + 0.5
        self.assertEqual(float(payroll_daily.base_salary), 5250.00) # 3.5 * 1500

        # Jane (monthly) calculations
        payroll_monthly = Payroll.objects.get(employee=self.emp_monthly, month=5, year=2026)
        self.assertEqual(float(payroll_monthly.base_salary), 45000.00) # fixed rate

    def test_update_and_pay_payroll(self):
        payload = {"month": 5, "year": 2026}
        self.client.post(self.generate_url, payload, format='json')

        payroll = Payroll.objects.get(employee=self.emp_daily, month=5, year=2026)
        update_url = reverse('update_payroll_record', kwargs={'pk': payroll.pk})
        pay_url = reverse('pay_payroll_record', kwargs={'pk': payroll.pk})

        # Update allowances/deductions
        update_payload = {"allowances": 1000.00, "deductions": 250.00}
        response = self.client.put(update_url, update_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payroll.refresh_from_db()
        self.assertEqual(float(payroll.net_salary), 6000.00) # 5250 + 1000 - 250

        # Pay
        response = self.client.post(pay_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payroll.refresh_from_db()
        self.assertEqual(payroll.status, 'PAID')
        self.assertIsNotNone(payroll.paid_date)


class DailyReportAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        
        self.part = Part.objects.create(
            name="Test Part",
            part_number="TP-999",
            brand="TestBrand",
            buy_price=100.00,
            sell_price=150.00,
            stock_qty=10
        )
        
        # Complete sale (set total_amount to 280.00 to match sale items total)
        self.sale = Sale.objects.create(customer_name="Test Cust", status="COMPLETED", total_amount=280.00)
        self.sale_item = SaleItem.objects.create(
            sale=self.sale,
            part=self.part,
            quantity=2,
            unit_price=150.00,
            discount=10.00
        )
        
        self.url = reverse('daily_report')

    def test_daily_report_metrics(self):
        from django.utils import timezone
        
        # Test with date parameter first
        date_str = timezone.localdate().strftime('%Y-%m-%d')
        response = self.client.get(self.url, {'date': date_str})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Calculations:
        # total_investment (COGS) = 100 * 2 = 200
        # revenue = (150 - 10) * 2 = 280
        # net profit = revenue - total_investment = 80
        # ROI % = (80 / 200) * 100 = 40.00%
        
        self.assertEqual(float(response.data['today_revenue']), 280.00)
        self.assertEqual(float(response.data['today_profit']), 80.00)
        self.assertEqual(float(response.data['total_investment']), 200.00)
        self.assertEqual(float(response.data['roi_percentage']), 40.00)

        # Also test without date parameter
        response_no_date = self.client.get(self.url)
        self.assertEqual(response_no_date.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response_no_date.data['today_revenue']), 280.00)
        self.assertEqual(float(response_no_date.data['today_profit']), 80.00)
        self.assertEqual(float(response_no_date.data['total_investment']), 200.00)
        self.assertEqual(float(response_no_date.data['roi_percentage']), 40.00)




