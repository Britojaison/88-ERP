import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Product
from apps.integrations.shopify_models import ShopifyProduct

print("\n" + "="*70)
print("REAL SHOPIFY DATA IN ERP MASTER DATA")
print("="*70)

products = Product.objects.filter(code__startswith='SHOP-')[:10]
print(f"\nShowing 10 sample products from {Product.objects.filter(code__startswith='SHOP-').count()} total synced products:\n")

for i, p in enumerate(products, 1):
    sp = ShopifyProduct.objects.filter(erp_product=p).first()
    if sp:
        print(f"{i}. Product: {p.name[:50]}")
        print(f"   ERP Code: {p.code}")
        print(f"   Shopify ID: {sp.shopify_product_id}")
        print(f"   Shopify SKU: {sp.shopify_sku or 'N/A'}")
        print(f"   Price: ₹{sp.shopify_price}")
        print(f"   Inventory: {sp.shopify_inventory_quantity} units")
        print(f"   Type: {sp.shopify_product_type or 'N/A'}")
        print(f"   Vendor: {sp.shopify_vendor or 'N/A'}")
        print("-" * 70)

print("\n" + "="*70)
print("DUMMY DATA CHECK")
print("="*70)

dummy_products = Product.objects.exclude(code__startswith='SHOP-')
print(f"\nDummy/Test products remaining: {dummy_products.count()}")
if dummy_products.count() > 0:
    print("\nDummy products:")
    for p in dummy_products[:5]:
        print(f"  - {p.code}: {p.name}")

print("\n" + "="*70)
print("SUMMARY")
print("="*70)
print(f"✓ Real Shopify Products: {Product.objects.filter(code__startswith='SHOP-').count()}")
print(f"✓ Shopify Orders: {ShopifyProduct.objects.filter(sync_status='synced').count()}")
print(f"✓ Total Products in Master Data: {Product.objects.count()}")
print("="*70 + "\n")
