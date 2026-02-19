import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU

print("\n" + "="*70)
print("CHECKING SKU DISPLAY DATA")
print("="*70)

# Get first 10 SKUs
skus = SKU.objects.select_related('product')[:10]

print("\nFirst 10 SKUs in database:")
print("-" * 70)
for i, sku in enumerate(skus, 1):
    print(f"{i}. SKU Code: {sku.code}")
    print(f"   SKU ID: {sku.id}")
    print(f"   Product ID: {sku.product.id if sku.product else 'N/A'}")
    print(f"   Product Code: {sku.product.code if sku.product else 'N/A'}")
    print(f"   Product Name: {sku.product.name if sku.product else 'N/A'}")
    print(f"   Status: {sku.status}")
    print("-" * 70)

# Check if there are SKUs with numeric codes
numeric_skus = SKU.objects.filter(code__regex=r'^\d+$')[:5]
print(f"\nSKUs with purely numeric codes: {numeric_skus.count()}")
if numeric_skus.exists():
    print("Sample numeric SKUs:")
    for sku in numeric_skus:
        print(f"  - {sku.code} -> {sku.product.name if sku.product else 'N/A'}")

print("\n" + "="*70 + "\n")
