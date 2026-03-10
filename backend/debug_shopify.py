
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore, ShopifyProduct
from apps.integrations.shopify_service import ShopifyAPIClient
from apps.mdm.models import Location
from apps.inventory.models import InventoryBalance

def check_deleted():
    store = ShopifyStore.objects.first()
    if not store:
        print("No store found")
        return

    skus_to_check = ['MMW-4808-L-4', 'MMW-4807-M-4', 'MMW-4806-L-3', 'MMW-4803-XXXXL-TEST2', 'MMW-4800-S-1']
    mappings = ShopifyProduct.objects.filter(shopify_sku__in=skus_to_check, store=store)
    
    print(f"Checking {mappings.count()} mappings...")
    
    client = ShopifyAPIClient(store)
    
    for m in mappings:
        print(f"SKU: {m.shopify_sku} | SP_ID: {m.shopify_product_id} | Status: {m.status}")
        try:
            p = client.get_product(m.shopify_product_id)
            print(f"  -> Product still exists in Shopify: {p.get('title')}")
            # Check if variant exists
            variants = p.get('variants', [])
            found_variant = False
            for v in variants:
                if v.get('id') == m.shopify_variant_id:
                    found_variant = True
                    break
            if not found_variant:
                print(f"  !! Variant {m.shopify_variant_id} is missing from product variants!")
            else:
                print(f"  -> Variant exists.")
        except Exception as e:
            print(f"  !! Error fetching product: {e}")
            if "404" in str(e):
                print("  !! confirmed 404 - Product is deleted on Shopify")

if __name__ == "__main__":
    check_deleted()
