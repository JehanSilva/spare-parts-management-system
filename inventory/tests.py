import io
import pandas as pd
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from .models import Part, Vehicle, Supplier, Sale, SaleItem, ActiveCart

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
            'Rack/Bin Location': ['Oil Filter Rack', 'Rack B']
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
        
        # Verify new part created
        new_part = Part.objects.get(part_number='B16019120')
        self.assertEqual(new_part.name, 'New Part Test')
        self.assertEqual(new_part.brand, 'TestBrand')
        self.assertEqual(float(new_part.buy_price), 150.00)
        self.assertEqual(float(new_part.sell_price), 200.00)
        self.assertEqual(new_part.stock_qty, 4)
        self.assertEqual(new_part.rack_location, 'Rack B')
        self.assertEqual(new_part.supplier.name, 'Test Supplier')


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


