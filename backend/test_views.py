import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.integrations.shopify_models import ShopifyOrder
from apps.sales.models import SalesTransaction
from django.db.models import Count, Sum

def test_dates(date_from, date_to):
    print(f"Testing From: {date_from} To: {date_to}")

    # Shopify Orders
    shopify_qs = ShopifyOrder.objects.filter(
        store__company_id=1
    )
    if date_from:
         shopify_qs = shopify_qs.filter(processed_at__gte=date_from)
    if date_to:
         shopify_qs = shopify_qs.filter(processed_at__lte=date_to)
    
    res1 = shopify_qs.aggregate(
            total_sales=Sum('total_price'),
            total_transactions=Count('id'),
    )
    print(f"Shopify: {res1}")

    # POS Transactions
    pos_qs = SalesTransaction.objects.filter(
        company_id=1,
        status='active'
    )
    if date_from:
        pos_qs = pos_qs.filter(transaction_date__gte=date_from)
    if date_to:
        pos_qs = pos_qs.filter(transaction_date__lte=date_to)
    
    res2 = pos_qs.aggregate(
            total_sales=Sum('total_amount'),
            total_transactions=Count('id'),
    )
    print(f"POS: {res2}")

test_dates(None, None)
from django.utils import timezone
now = timezone.now()
startOfToday = now.replace(hour=0, minute=0, second=0, microsecond=0)
endOfToday = now.replace(hour=23, minute=59, second=59, microsecond=999999)
print(f"Timezone now: {now}")
print(f"startOfToday: {startOfToday}")
test_dates(startOfToday, endOfToday)
test_dates("2026-03-11T18:30:00.000Z", "2026-03-12T18:29:59.999Z")

