import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyOrder
from django.utils import timezone
from django.db.models import Sum, Count

# Check ALL orders using IST-aware range
qs = ShopifyOrder.objects.filter(
    processed_at__gte='2026-03-11T18:30:00Z',
    processed_at__lte='2026-03-12T18:30:00Z',
)
agg = qs.aggregate(total=Sum('total_price'), cnt=Count('id'))
print(f"IST-aware range: Count={agg['cnt']}, Total=Rs{agg['total']}")

# Also check with __date filter
qs2 = ShopifyOrder.objects.filter(processed_at__date='2026-03-12')
agg2 = qs2.aggregate(total=Sum('total_price'), cnt=Count('id'))
print(f"__date filter: Count={agg2['cnt']}, Total=Rs{agg2['total']}")

# Check what Django considers the timezone setting
from django.conf import settings
print(f"TIME_ZONE setting: {settings.TIME_ZONE}")
print(f"USE_TZ: {settings.USE_TZ}")
