import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Product, SKU, SKUBarcode

print("\n" + "="*70)
print("SKU AND BARCODE DATA CHECK")
print("="*70)

# Check total SKUs
total_skus = SKU.objects.count()
print(f"\nTotal SKUs in system: {total_skus}")

# Check SKUs from Shopify products
shopify_products = Product.objects.filter(code__startswith='SHOP-')
shopify_skus = SKU.objects.filter(product__in=shopify_products)
print(f"SKUs from Shopify products: {shopify_skus.count()}")

# Check existing barcodes
total_barcodes = SKUBarcode.objects.count()
print(f"Total barcodes assigned: {total_barcodes}")

# Show sample SKUs
print(f"\n{'='*70}")
print("SAMPLE SKUs (first 10):")
print("="*70)
for i, sku in enumerate(SKU.objects.select_related('product')[:10], 1):
    barcode_count = sku.barcodes.count()
    print(f"{i}. SKU Code: {sku.code}")
    print(f"   Product: {sku.product.name if sku.product else 'N/A'}")
    print(f"   Size: {sku.size or 'N/A'}")
    print(f"   Price: ₹{sku.base_price}")
    print(f"   Barcodes: {barcode_count}")
    print("-" * 70)

# Show sample barcodes if any exist
if total_barcodes > 0:
    print(f"\n{'='*70}")
    print("SAMPLE BARCODES (first 5):")
    print("="*70)
    for i, barcode in enumerate(SKUBarcode.objects.select_related('sku', 'sku__product')[:5], 1):
        print(f"{i}. Barcode: {barcode.barcode_value}")
        print(f"   SKU: {barcode.sku.code}")
        print(f"   Product: {barcode.sku.product.name if barcode.sku.product else 'N/A'}")
        print(f"   Type: {barcode.barcode_type}")
        print(f"   Label: {barcode.label_title}")
        print("-" * 70)

print("\n" + "="*70 + "\n")
