
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifySyncJob, ShopifyProduct
from apps.inventory.models import InventoryBalance

def check_status():
    print("Recent Sync Jobs:")
    jobs = ShopifySyncJob.objects.all().order_by('-created_at')[:5]
    for j in jobs:
        print(f"Type: {j.job_type} | Status: {j.job_status} | Progress: {j.processed_items}/{j.total_items} | Error: {j.error_log[:50]}")
    
    skus = ['MMW-4808-L-4', 'MMW-4807-M-4', 'MMW-4806-L-3', 'MMW-4803-XXXXL-TEST2', 'MMW-4800-S-1']
    print("\nSKU Balances in Shopify Online Warehouse:")
    balances = InventoryBalance.objects.filter(sku__code__in=skus, location__code='SHOPIFY-WH')
    for b in balances:
        print(f"SKU: {b.sku.code} | Qty: {b.quantity_on_hand} | Location Co: {b.location.company.name}")
        
    print("\nMapping Status:")
    mappings = ShopifyProduct.objects.filter(shopify_sku__in=skus)
    for m in mappings:
        print(f"SKU: {m.shopify_sku} | Status: {m.status} | SP_ID: {m.shopify_product_id}")

if __name__ == "__main__":
    check_status()
