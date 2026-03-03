import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore, ShopifyOrder
from apps.integrations.shopify_service import ShopifyService

# Find active store
store = ShopifyStore.objects.filter(status='active').first()
if not store:
    print("No active Shopify store found!")
else:
    print(f"Found store: {store.name} ({store.shop_domain})")
    
    # Check existing orders
    order_count = ShopifyOrder.objects.filter(store=store).count()
    print(f"Current ShopifyOrder count in DB: {order_count}")
    
    # Try to sync for the range
    start_date = "2026-02-01"
    end_date = "2026-03-03"
    print(f"Manually triggering sync for {start_date} to {end_date}...")
    
    # Use sync_orders
    try:
        ShopifyService.sync_orders(store, start_date=start_date, end_date=end_date)
    except Exception as e:
        import traceback
        traceback.print_exc()
    
    new_count = ShopifyOrder.objects.filter(store=store).count()
    print(f"New ShopifyOrder count in DB: {new_count}")
    
    # Check range specifically
    from datetime import datetime
    range_orders = ShopifyOrder.objects.filter(
        store=store,
        processed_at__date__range=[start_date, end_date]
    )
    print(f"Orders in range {start_date} to {end_date}: {range_orders.count()}")
    
    # List a few orders with company info
    orders = range_orders.order_by('-processed_at')[:5]
    for o in orders:
        print(f"Order #{o.order_number}: {o.total_price} {o.currency} at {o.processed_at} (Store Company: {o.store.company_id})")
        
    # Check current user company (just for reference, though we're running as script)
    print(f"Store company ID: {store.company_id}")
