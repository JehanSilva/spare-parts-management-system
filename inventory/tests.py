from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from .models import Part, Vehicle

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
