import io
import pandas as pd
from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from .models import Part, Vehicle, Supplier, Sale, SaleItem, ActiveCart, Employee, Attendance, Payroll, Holiday, RestockRecord, CustomerVehicle, Estimate

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
        self.assertEqual(response.data['created'], 1)

        # A part number that already exists must NOT be auto-merged — it should
        # come back as a conflict for the user to resolve, and stay untouched in the DB.
        self.assertEqual(len(response.data['conflicts']), 1)
        conflict = response.data['conflicts'][0]
        self.assertEqual(conflict['part_number'], 'B110G0131')
        self.assertEqual(conflict['existing']['name'], 'Old Name')
        self.assertEqual(conflict['existing']['brand'], 'Old Brand')
        self.assertEqual(float(conflict['existing']['buy_price']), 500.00)
        self.assertEqual(conflict['existing']['stock_qty'], 10)
        self.assertEqual(conflict['new']['name'], 'Cworks Oil Filter')
        self.assertEqual(conflict['new']['brand'], 'Cworks')
        self.assertEqual(float(conflict['new']['buy_price']), 750.00)
        self.assertEqual(conflict['new']['stock_qty'], 6)
        self.assertEqual(conflict['new']['compatible_vehicles'], ['Toyota Corolla (2020)'])

        self.existing_part.refresh_from_db()
        self.assertEqual(self.existing_part.name, 'Old Name')
        self.assertEqual(self.existing_part.stock_qty, 10)
        self.assertEqual(self.existing_part.compatible_vehicles.count(), 0)

        # Verify new part created (no conflict, so this goes in immediately)
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

        # Verify purchase history was recorded for the newly created part
        new_part_records = RestockRecord.objects.filter(part=new_part)
        self.assertEqual(new_part_records.count(), 1)
        self.assertEqual(new_part_records.first().quantity, 4)
        self.assertEqual(float(new_part_records.first().buy_price), 150.00)

        # The conflicting part wasn't touched, so no purchase history yet either
        self.assertEqual(RestockRecord.objects.filter(part=self.existing_part).count(), 0)

    def test_resolve_bulk_upload_conflicts(self):
        resolve_url = reverse('resolve_bulk_upload_conflicts')
        resolutions = [{
            'part_number': 'B110G0131',
            'name': 'Cworks Oil Filter',       # take "new" value
            'brand': 'Old Brand',              # keep "existing" value
            'supplier': 'Toyotsu Lanka (Pvt) Ltd',
            'buy_price': 750.00,
            'sell_price': 1000.00,
            'stock_qty': 999,                  # custom value (neither existing nor new)
            'rack_location': 'Oil Filter Rack',
            'compatible_vehicles': ['Toyota Corolla (2020)'],
        }]

        response = self.client.post(resolve_url, {'resolutions': resolutions}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 1)

        self.existing_part.refresh_from_db()
        self.assertEqual(self.existing_part.name, 'Cworks Oil Filter')
        self.assertEqual(self.existing_part.brand, 'Old Brand')
        self.assertEqual(float(self.existing_part.buy_price), 750.00)
        self.assertEqual(float(self.existing_part.sell_price), 1000.00)
        self.assertEqual(self.existing_part.stock_qty, 999)
        self.assertEqual(self.existing_part.rack_location, 'Oil Filter Rack')
        self.assertEqual(self.existing_part.supplier.name, 'Toyotsu Lanka (Pvt) Ltd')
        self.assertEqual(self.existing_part.compatible_vehicles.count(), 1)
        v1 = self.existing_part.compatible_vehicles.first()
        self.assertEqual(v1.make, "Toyota")
        self.assertEqual(v1.model, "Corolla")
        self.assertEqual(v1.year, 2020)

        # Stock went from 10 -> 999, so the 989-unit increase should show up
        # in Purchase History just like a manual restock would.
        records = RestockRecord.objects.filter(part=self.existing_part)
        self.assertEqual(records.count(), 1)
        record = records.first()
        self.assertEqual(record.quantity, 989)
        self.assertEqual(float(record.buy_price), 750.00)
        self.assertEqual(record.supplier.name, 'Toyotsu Lanka (Pvt) Ltd')

    def test_resolve_bulk_upload_conflicts_no_stock_increase_skips_purchase_history(self):
        resolve_url = reverse('resolve_bulk_upload_conflicts')
        resolutions = [{
            'part_number': 'B110G0131',
            'name': 'Old Name',
            'brand': 'Old Brand',
            'supplier': '',
            'buy_price': 500.00,
            'sell_price': 800.00,
            'stock_qty': 10,  # unchanged from existing
            'rack_location': 'Old Location',
        }]

        response = self.client.post(resolve_url, {'resolutions': resolutions}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(RestockRecord.objects.filter(part=self.existing_part).count(), 0)


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

class HolidayAndCalendarAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        
        self.employee = Employee.objects.create(
            first_name="Jane",
            last_name="Doe",
            role="Accountant",
            salary_type="MONTHLY",
            salary_rate=60000.00,
            working_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        )
        
    def test_employee_working_days(self):
        self.assertEqual(self.employee.working_days, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
        
    def test_get_employee_attendance(self):
        Attendance.objects.create(
            employee=self.employee,
            date="2026-05-01",
            status="PRESENT",
            notes="On time"
        )
        url = reverse('get_employee_attendance', kwargs={'pk': self.employee.pk})
        response = self.client.get(url, {"month": 5, "year": 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['status'], 'PRESENT')
        
    def test_holiday_crud(self):
        list_url = reverse('get_holidays')
        add_url = reverse('add_holiday')
        
        # 1. List
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
        
        # 2. Add
        add_payload = {
            "date": "2026-05-01",
            "name": "May Day"
        }
        response = self.client.post(add_url, add_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Holiday.objects.count(), 1)
        holiday_id = response.data['id']
        
        # 3. List again
        response = self.client.get(list_url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "May Day")
        
        # 4. Delete
        delete_url = reverse('delete_holiday', kwargs={'pk': holiday_id})
        response = self.client.delete(delete_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Holiday.objects.count(), 0)


class SalePaymentAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)

        self.part = Part.objects.create(
            name="Brake Pad",
            part_number="BP-100",
            buy_price=500,
            sell_price=1000,
            stock_qty=10,
        )

    def _sale_payload(self, **overrides):
        payload = {
            "customer_name": "John Doe",
            "vehicle_number": "ABC-1234",
            "items": [
                {"part_id": str(self.part.id), "quantity": 2, "unit_price": 1000, "discount": 0}
            ],
        }
        payload.update(overrides)
        return payload

    def test_full_payment_sale(self):
        response = self.client.post(reverse('create_sale'), self._sale_payload(payment_status="PAID"), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(pk=response.data['id'])
        self.assertEqual(sale.payment_status, "PAID")
        self.assertEqual(sale.amount_paid, sale.total_amount)

    def test_full_credit_sale(self):
        response = self.client.post(
            reverse('create_sale'),
            self._sale_payload(payment_status="CREDIT", credit_note="Pay next week"),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(pk=response.data['id'])
        self.assertEqual(sale.payment_status, "CREDIT")
        self.assertEqual(sale.amount_paid, 0)

    def test_partial_payment_sale(self):
        response = self.client.post(
            reverse('create_sale'),
            self._sale_payload(payment_status="PARTIAL", amount_paid="800.00", credit_note="Rest by Friday"),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(pk=response.data['id'])
        self.assertEqual(sale.payment_status, "PARTIAL")
        self.assertEqual(float(sale.amount_paid), 800.0)
        self.assertEqual(float(sale.total_amount), 2000.0)

    def test_partial_payment_rejects_invalid_amount(self):
        # Amount paid must be > 0 and < total (2000)
        response = self.client.post(
            reverse('create_sale'),
            self._sale_payload(payment_status="PARTIAL", amount_paid="2000.00"),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            reverse('create_sale'),
            self._sale_payload(payment_status="PARTIAL", amount_paid="0"),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mark_partial_sale_as_paid_settles_balance(self):
        create_resp = self.client.post(
            reverse('create_sale'),
            self._sale_payload(payment_status="PARTIAL", amount_paid="800.00"),
            format='json',
        )
        sale_id = create_resp.data['id']

        mark_paid_resp = self.client.post(reverse('mark_sale_paid', kwargs={'pk': sale_id}))
        self.assertEqual(mark_paid_resp.status_code, status.HTTP_200_OK)

        sale = Sale.objects.get(pk=sale_id)
        self.assertEqual(sale.payment_status, "PAID")
        self.assertEqual(sale.amount_paid, sale.total_amount)
        self.assertIsNotNone(sale.credit_settled_at)


class SaleMileageSyncAPITest(TestCase):
    """
    Completing a POS sale should keep CustomerVehicle.current_mileage in sync:
    normally only advancing it forward, but overwriting it when the frontend
    confirms the user explicitly chose to override a lower reading.
    """
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)

        self.part = Part.objects.create(
            name="Brake Pad",
            part_number="BP-100",
            buy_price=500,
            sell_price=1000,
            stock_qty=10,
        )
        self.vehicle = CustomerVehicle.objects.create(vehicle_number="ABC-1234", current_mileage=50000)

    def _sale_payload(self, **overrides):
        payload = {
            "customer_name": "John Doe",
            "vehicle_number": "ABC-1234",
            "items": [
                {"part_id": str(self.part.id), "quantity": 1, "unit_price": 1000, "discount": 0}
            ],
        }
        payload.update(overrides)
        return payload

    def test_higher_mileage_updates_vehicle_registry(self):
        response = self.client.post(reverse('create_sale'), self._sale_payload(mileage=55000), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.current_mileage, 55000)

    def test_lower_mileage_without_force_is_ignored(self):
        response = self.client.post(reverse('create_sale'), self._sale_payload(mileage=40000), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.current_mileage, 50000)

    def test_lower_mileage_with_force_overrides_vehicle_registry(self):
        response = self.client.post(
            reverse('create_sale'),
            self._sale_payload(mileage=40000, force_mileage_update=True),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.current_mileage, 40000)

    def test_recording_a_reading_stamps_when_it_was_taken(self):
        registered_at = self.vehicle.mileage_updated_at
        self.assertIsNotNone(registered_at)  # stamped when the vehicle was created

        self.client.post(reverse('create_sale'), self._sale_payload(mileage=55000), format='json')
        self.vehicle.refresh_from_db()
        self.assertGreater(self.vehicle.mileage_updated_at, registered_at)

    def test_ignored_reading_does_not_restamp_the_date(self):
        # A lower reading is discarded, so the recorded date must stay put —
        # otherwise the bill would claim a stale figure was just taken.
        self.client.post(reverse('create_sale'), self._sale_payload(mileage=55000), format='json')
        self.vehicle.refresh_from_db()
        first_stamp = self.vehicle.mileage_updated_at

        self.client.post(reverse('create_sale'), self._sale_payload(mileage=40000), format='json')
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.mileage_updated_at, first_stamp)
        self.assertEqual(self.vehicle.current_mileage, 55000)

    def test_editing_the_registry_stamps_the_reading_but_other_edits_do_not(self):
        url = reverse('update_customer_vehicle', kwargs={'vehicle_pk': self.vehicle.pk})

        self.client.patch(url, {"current_mileage": 60000}, format='json')
        self.vehicle.refresh_from_db()
        stamped = self.vehicle.mileage_updated_at
        self.assertIsNotNone(stamped)

        # Changing something unrelated must leave the reading's date alone.
        self.client.patch(url, {"color": "Pearl White"}, format='json')
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.mileage_updated_at, stamped)


class SaleVehicleDetailsTest(TestCase):
    """
    The printed bill needs the vehicle's make/model and last known odometer
    reading, none of which live on Sale — it only stores the plate as free text.
    """
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)

        self.part = Part.objects.create(
            name="Brake Pad", part_number="BP-100", buy_price=500, sell_price=1000, stock_qty=10,
        )
        self.vehicle = CustomerVehicle.objects.create(
            vehicle_number="KT-8352", make="Perodua", model="Viva Elite", current_mileage=50120,
        )

    def _create_sale(self, **overrides):
        payload = {
            "customer_name": "John Doe",
            "vehicle_number": "KT-8352",
            "items": [
                {"part_id": str(self.part.id), "quantity": 1, "unit_price": 1000, "discount": 0}
            ],
        }
        payload.update(overrides)
        return self.client.post(reverse('create_sale'), payload, format='json')

    def test_create_response_carries_the_vehicle_for_the_printed_bill(self):
        response = self._create_sale()
        details = response.data['vehicle_details']
        self.assertEqual(details['make'], "Perodua")
        self.assertEqual(details['model'], "Viva Elite")
        self.assertEqual(details['current_mileage'], 50120)

    def test_sales_list_resolves_the_plate_case_insensitively(self):
        self._create_sale(vehicle_number="kt-8352")
        response = self.client.get(reverse('get_all_sales'))
        self.assertEqual(response.data[0]['vehicle_details']['make'], "Perodua")

    def test_unregistered_plate_has_no_details(self):
        self._create_sale(vehicle_number="ZZZ-9999")
        response = self.client.get(reverse('get_all_sales'))
        self.assertIsNone(response.data[0]['vehicle_details'])

    def test_a_job_without_a_reading_still_exposes_the_last_known_one(self):
        # The bill falls back to this, dated mileage_updated_at.
        self._create_sale()

        response = self.client.get(reverse('get_all_sales'))
        sale = response.data[0]
        self.assertIsNone(sale['mileage'])
        self.assertEqual(sale['vehicle_details']['current_mileage'], 50120)
        self.assertIsNotNone(sale['vehicle_details']['mileage_updated_at'])

    def test_the_registry_is_resolved_in_one_query_for_the_whole_list(self):
        for _ in range(4):
            self._create_sale()

        with CaptureQueriesContext(connection) as captured:
            self.client.get(reverse('get_all_sales'))

        registry_queries = [
            q for q in captured.captured_queries if 'inventory_customervehicle' in q['sql']
        ]
        self.assertEqual(len(registry_queries), 1, "vehicle_details must not query per sale")


class RestockPrimarySupplierTest(TestCase):
    """The part's supplier should track whoever it was most recently bought from."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="restockuser", password="password")
        self.client.force_authenticate(user=self.user)
        self.old_supplier = Supplier.objects.create(name="Old Supplier")
        self.new_supplier = Supplier.objects.create(name="New Supplier")
        self.part = Part.objects.create(
            name="Radiator Cap",
            part_number="DN-RC004",
            brand="Denso",
            buy_price=750.00,
            sell_price=1100.00,
            stock_qty=10,
            supplier=self.old_supplier,
        )
        self.url = reverse('restock_part', args=[self.part.id])

    def test_restock_updates_primary_supplier(self):
        response = self.client.post(self.url, {
            "entries": [{"supplier_id": self.new_supplier.id, "quantity": 5, "buy_price": "800.00"}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.part.refresh_from_db()
        self.assertEqual(self.part.supplier, self.new_supplier)

    def test_last_entry_with_a_supplier_wins(self):
        response = self.client.post(self.url, {
            "entries": [
                {"supplier_id": self.old_supplier.id, "quantity": 3, "buy_price": "790.00"},
                {"supplier_id": self.new_supplier.id, "quantity": 2, "buy_price": "810.00"},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.part.refresh_from_db()
        self.assertEqual(self.part.supplier, self.new_supplier)

    def test_unknown_supplier_leaves_existing_one_intact(self):
        response = self.client.post(self.url, {
            "entries": [{"quantity": 5, "buy_price": "800.00"}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.part.refresh_from_db()
        self.assertEqual(self.part.supplier, self.old_supplier)

    def test_restock_still_updates_stock_and_average_cost(self):
        response = self.client.post(self.url, {
            "entries": [{"supplier_id": self.new_supplier.id, "quantity": 10, "buy_price": "850.00"}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.part.refresh_from_db()
        self.assertEqual(self.part.stock_qty, 20)
        # (10 × 750 + 10 × 850) / 20 = 800
        self.assertEqual(float(self.part.buy_price), 800.00)


class SupplierPrimaryPhoneTest(TestCase):
    """The default call number is stored on the supplier and survives edits."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="supplieruser", password="password")
        self.client.force_authenticate(user=self.user)
        self.contacts = [
            {"name": "Nimal Perera", "phones": ["0771234567", "0112233445"]},
            {"name": "Sunil Fernando", "phones": ["0719987766"]},
        ]

    def test_primary_phone_saved_on_create(self):
        response = self.client.post(reverse('add_supplier'), {
            "name": "AutoParts LK",
            "contacts": self.contacts,
            "primary_phone": "0719987766",
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        supplier = Supplier.objects.get(name="AutoParts LK")
        self.assertEqual(supplier.primary_phone, "0719987766")

    def test_primary_phone_updated_on_edit(self):
        supplier = Supplier.objects.create(
            name="AutoParts LK", contacts=self.contacts, primary_phone="0771234567"
        )
        response = self.client.put(reverse('update_supplier', args=[supplier.id]), {
            "name": "AutoParts LK",
            "contacts": self.contacts,
            "primary_phone": "0112233445",
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        supplier.refresh_from_db()
        self.assertEqual(supplier.primary_phone, "0112233445")

    def test_primary_phone_is_exposed_by_the_list_endpoint(self):
        Supplier.objects.create(
            name="AutoParts LK", contacts=self.contacts, primary_phone="0719987766"
        )
        response = self.client.get(reverse('get_suppliers'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["primary_phone"], "0719987766")

    def test_defaults_to_blank_when_not_supplied(self):
        response = self.client.post(reverse('add_supplier'), {
            "name": "No Default Supplier",
            "contacts": self.contacts,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Supplier.objects.get(name="No Default Supplier").primary_phone, "")


class EstimateAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        self.existing_vehicle = CustomerVehicle.objects.create(
            vehicle_number="CAB-1122", make="Toyota", model="Corolla"
        )
        self.list_url = reverse('get_estimates')
        self.create_url = reverse('create_estimate')

    def _payload(self, **overrides):
        payload = {
            "date": "2026-08-10",
            "insurance_company": "Amana Takaful",
            "vehicle_number": "dea-0778",
            "make_model": "TATA Ace",
            "validity_days": 30,
            "sections": {
                # 2 x 1500 = 3000
                "removing": [{"description": "Remove bumper", "hours": "2", "rate": "1500"}],
                # blank hours => flat 5000
                "repair": [{"description": "Panel beating", "hours": "", "rate": "5000"}],
                "paint": [],
                "replacing": [{"description": "Headlamp", "hours": "2", "rate": "8000"}],
            },
        }
        payload.update(overrides)
        return payload

    def test_create_registers_unknown_plate_and_links_it(self):
        response = self.client.post(self.create_url, self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        estimate = Estimate.objects.get(pk=response.data['id'])
        # Plate is normalized to upper case and auto-registered.
        self.assertEqual(estimate.vehicle_number, "DEA-0778")
        vehicle = CustomerVehicle.objects.get(vehicle_number="DEA-0778")
        self.assertEqual(estimate.vehicle, vehicle)
        self.assertEqual(vehicle.make, "TATA")
        self.assertEqual(vehicle.model, "Ace")
        self.assertEqual(estimate.estimate_number, "EST-0001")

    def test_total_is_computed_from_the_lines(self):
        response = self.client.post(self.create_url, self._payload(), format='json')
        # 3000 (2 x 1500) + 5000 (flat) + 16000 (2 x 8000)
        self.assertEqual(Estimate.objects.get(pk=response.data['id']).total_amount, 24000)

    def test_existing_plate_is_reused_not_duplicated(self):
        response = self.client.post(
            self.create_url, self._payload(vehicle_number="cab-1122"), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomerVehicle.objects.filter(vehicle_number="CAB-1122").count(), 1)
        self.assertEqual(Estimate.objects.get(pk=response.data['id']).vehicle, self.existing_vehicle)

    def test_estimate_numbers_are_sequential(self):
        self.client.post(self.create_url, self._payload(), format='json')
        second = self.client.post(
            self.create_url, self._payload(vehicle_number="CAB-1122"), format='json'
        )
        self.assertEqual(second.data['estimate_number'], "EST-0002")

    def test_list_and_search(self):
        self.client.post(self.create_url, self._payload(), format='json')
        self.client.post(
            self.create_url,
            self._payload(vehicle_number="CAB-1122", insurance_company="SLIC"),
            format='json',
        )

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        response = self.client.get(self.list_url, {'search': 'slic'})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['insurance_company'], "SLIC")

    def test_retrieve_returns_the_sections(self):
        created = self.client.post(self.create_url, self._payload(), format='json')
        response = self.client.get(reverse('get_estimate', kwargs={'pk': created.data['id']}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['sections']['removing']), 1)
        self.assertEqual(response.data['vehicle_details']['vehicle_number'], "DEA-0778")

    def test_update_recomputes_total_and_repoints_the_vehicle(self):
        created = self.client.post(self.create_url, self._payload(), format='json')
        url = reverse('update_estimate', kwargs={'pk': created.data['id']})

        response = self.client.patch(url, {
            "vehicle_number": "cab-1122",
            "sections": {"removing": [{"description": "Remove bumper", "hours": "2", "rate": "2000"}]},
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        estimate = Estimate.objects.get(pk=created.data['id'])
        self.assertEqual(estimate.vehicle, self.existing_vehicle)
        self.assertEqual(estimate.vehicle_number, "CAB-1122")
        self.assertEqual(estimate.total_amount, 4000)
        # Untouched fields survive the partial update, and the reference is stable.
        self.assertEqual(estimate.insurance_company, "Amana Takaful")
        self.assertEqual(estimate.estimate_number, "EST-0001")

    def test_delete(self):
        created = self.client.post(self.create_url, self._payload(), format='json')
        response = self.client.delete(
            reverse('delete_estimate', kwargs={'pk': created.data['id']})
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Estimate.objects.count(), 0)

    def test_vehicle_estimates_endpoint_is_scoped_to_that_vehicle(self):
        self.client.post(self.create_url, self._payload(), format='json')
        self.client.post(self.create_url, self._payload(vehicle_number="CAB-1122"), format='json')

        response = self.client.get(
            reverse('get_vehicle_estimates', kwargs={'pk': self.existing_vehicle.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['vehicle_number'], "CAB-1122")

    def test_deleting_a_vehicle_keeps_its_estimates(self):
        created = self.client.post(
            self.create_url, self._payload(vehicle_number="CAB-1122"), format='json'
        )
        self.existing_vehicle.delete()

        estimate = Estimate.objects.get(pk=created.data['id'])
        self.assertIsNone(estimate.vehicle)
        self.assertEqual(estimate.vehicle_number, "CAB-1122")
