import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU
from apps.integrations.shopify_models import ShopifyProduct
from django.db import transaction

print("\n" + "="*70)
print("FIXING SKU CODES - REMOVING VARIANT ID SUFFIX")
print("="*70)

# Find all SKUs with variant ID suffix
skus_with_variant = SKU.objects.filter(code__contains='-V5')
total = skus_with_variant.count()

print(f"\nFound {total} SKUs with variant ID suffix")

if total == 0:
    print("No SKUs to fix!")
    exit()

# Ask for confirmation
print("\nThis will update SKU codes to remove the variant ID suffix.")
print("Example: MMW-2110-M-ZML-V51158999433380 → MMW-2110-M-ZML")
response = input("\nDo you want to proceed? (yes/no): ")

if response.lower() != 'yes':
    print("Operation cancelled.")
    exit()

updated = 0
errors = 0
skipped = 0

print("\nProcessing...")

for sku in skus_with_variant:
    try:
        # Find the corresponding Shopify product
        shopify_product = ShopifyProduct.objects.filter(erp_sku=sku).first()
        
        if not shopify_product:
            print(f"  - Skipped {sku.code}: No Shopify product found")
            skipped += 1
            continue
        
        # Get the clean SKU code from Shopify
        if shopify_product.shopify_sku:
            new_code = shopify_product.shopify_sku
        else:
            # Keep the variant ID for products without Shopify SKU
            print(f"  - Skipped {sku.code}: No Shopify SKU available")
            skipped += 1
            continue
        
        # Check if new code already exists
        if SKU.objects.filter(code=new_code).exclude(id=sku.id).exists():
            print(f"  - Skipped {sku.code}: New code {new_code} already exists")
            skipped += 1
            continue
        
        # Update the SKU code
        old_code = sku.code
        sku.code = new_code
        sku.save()
        
        updated += 1
        if updated % 100 == 0:
            print(f"  Progress: {updated}/{total} ({(updated/total*100):.1f}%)")
        
    except Exception as e:
        errors += 1
        print(f"  X Error updating {sku.code}: {str(e)[:100]}")

print("\n" + "="*70)
print("FIX COMPLETE")
print("="*70)
print(f"Updated: {updated}")
print(f"Skipped: {skipped}")
print(f"Errors: {errors}")
print("="*70 + "\n")
