
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore, ShopifyProduct, ShopifySyncJob
from apps.integrations.shopify_service import ShopifyService

def run_sync():
    store = ShopifyStore.objects.first()
    if not store:
        print("No store found")
        return

    print(f"Running Quick Sync for {store.name}...")
    try:
        ShopifyService.sync_products_delta(store)
        print("Products Delta complete.")
        ShopifyService.sync_inventory_delta(store)
        print("Inventory Delta complete.")
        ShopifyService.cleanup_deleted_products(store)
        print("Cleanup complete.")
    except Exception as e:
        print(f"Error during sync: {e}")

if __name__ == "__main__":
    run_sync()
