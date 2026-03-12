import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore, ShopifyOrder
from apps.integrations.shopify_service import ShopifyService, ShopifyAPIClient
from django.core.cache import cache
from django.db.models import Sum, Count

cache.clear()

s = ShopifyStore.objects.first()
client = ShopifyAPIClient(s)

# Use IST timezone offset to get all orders for today in IST
orders = client.get_all_orders(
    created_at_min='2026-03-12T00:00:00+05:30',
    created_at_max='2026-03-12T23:59:59+05:30'
)
print(f"Shopify API returned: {len(orders)} orders")
total_from_api = sum(float(o.get('total_price', 0)) for o in orders)
print(f"Shopify API total_price sum: Rs{total_from_api}")

# Now process each order into the ERP
for order_data in orders:
    try:
        ShopifyService._process_order(s, order_data)
    except Exception as e:
        print(f"  Error processing #{order_data.get('order_number')}: {e}")

# Check what we have now
from django.utils import timezone
today = timezone.localtime().date()
qs = ShopifyOrder.objects.filter(processed_at__date=today)
agg = qs.aggregate(total=Sum('total_price'), cnt=Count('id'))
print(f"\nERP DB now has: {agg['cnt']} orders for today")
print(f"ERP DB total: Rs{agg['total']}")

# Print each for verification 
for o in qs.order_by('processed_at'):
    print(f"  #{o.order_number} | {o.processed_at} | Rs{o.total_price}")
