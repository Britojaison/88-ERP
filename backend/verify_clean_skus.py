import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU

print("\n" + "="*70)
print("VERIFYING CLEAN SKU CODES")
print("="*70)

# Check for any remaining variant IDs
skus_with_variant = SKU.objects.filter(code__contains='-V5').count()
print(f"\nSKUs with variant ID suffix: {skus_with_variant}")

# Show sample clean SKUs
print("\nSample clean SKU codes (first 10):")
print("-" * 70)
for i, sku in enumerate(SKU.objects.select_related('product')[:10], 1):
    print(f"{i}. {sku.code}")
    print(f"   Product: {sku.product.name if sku.product else 'N/A'}")
    print(f"   Price: ₹{sku.base_price}")

# Search for the specific product
print("\n" + "="*70)
print("SEARCHING FOR: Mira Zipless Feeding Pant Set")
print("="*70)
skus = SKU.objects.filter(product__name__icontains='Mira Zipless Feeding')
print(f"Found {skus.count()} SKU(s)")
for sku in skus[:5]:
    print(f"  - SKU Code: {sku.code}")
    print(f"    Product: {sku.product.name}")
    print(f"    Price: ₹{sku.base_price}")

print("\n" + "="*70 + "\n")
