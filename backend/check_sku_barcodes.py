import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU, SKUBarcode

print("\n" + "="*70)
print("CHECKING BARCODE ASSIGNMENTS")
print("="*70)

# Check the specific SKUs from the screenshot
sku_codes = [
    'MMW-1071-S-MAXI',
    'MMW-1073-L-MAXI',
    'MMW-1074-XL-MAXI'
]

print("\nChecking specific SKUs:")
print("-" * 70)

for sku_code in sku_codes:
    try:
        sku = SKU.objects.get(code=sku_code)
        barcodes = SKUBarcode.objects.filter(sku=sku)
        
        print(f"\nSKU: {sku.code}")
        print(f"Product: {sku.product.name if sku.product else 'N/A'}")
        print(f"Price: ₹{sku.base_price}")
        print(f"Barcodes assigned: {barcodes.count()}")
        
        if barcodes.exists():
            for barcode in barcodes:
                print(f"  - Barcode: {barcode.barcode_value}")
                print(f"    Type: {barcode.barcode_type}")
                print(f"    Primary: {barcode.is_primary}")
        else:
            print(f"  ✗ No barcodes assigned")
            
    except SKU.DoesNotExist:
        print(f"\n✗ SKU {sku_code} not found in database")

# Overall statistics
print("\n" + "="*70)
print("OVERALL STATISTICS")
print("="*70)

total_skus = SKU.objects.count()
skus_with_barcodes = SKU.objects.filter(barcodes__isnull=False).distinct().count()
skus_without_barcodes = total_skus - skus_with_barcodes
total_barcodes = SKUBarcode.objects.count()

print(f"\nTotal SKUs: {total_skus}")
print(f"SKUs with barcodes: {skus_with_barcodes}")
print(f"SKUs without barcodes: {skus_without_barcodes}")
print(f"Total barcodes: {total_barcodes}")
print(f"Coverage: {(skus_with_barcodes/total_skus*100):.1f}%")

# Check Shopify SKUs specifically
shopify_skus = SKU.objects.filter(code__startswith='MMW-')
shopify_with_barcodes = shopify_skus.filter(barcodes__isnull=False).distinct().count()

print(f"\nShopify SKUs (MMW-*): {shopify_skus.count()}")
print(f"Shopify SKUs with barcodes: {shopify_with_barcodes}")
print(f"Shopify SKUs without barcodes: {shopify_skus.count() - shopify_with_barcodes}")

print("\n" + "="*70 + "\n")
