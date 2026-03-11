import sys
import django
from django.utils import timezone
from datetime import timedelta
from apps.integrations.shopify_models import ShopifyOrder

now = timezone.now()
limit = now - timedelta(days=3)
orders = ShopifyOrder.objects.filter(processed_at__gte=limit)

total_orders = orders.count()
total_revenue = 0.0
total_quantity = 0

for o in orders:
    total_revenue += float(o.total_price)
    items = o.shopify_data.get('line_items', [])
    for item in items:
        total_quantity += int(item.get('quantity', 0))

print(f"Stats for last 3 days (since {limit}):")
print(f"Total Orders: {total_orders}")
print(f"Total Revenue: {total_revenue}")
print(f"Total Quantity: {total_quantity}")
