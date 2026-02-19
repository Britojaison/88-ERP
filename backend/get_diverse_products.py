import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU
from decimal import Decimal

print("\n" + "="*70)
print("GETTING DIVERSE REAL PRODUCTS")
print("="*70)

# Get all active Shopify SKUs
skus = list(SKU.objects.filter(
    code__startswith='MMW-',
    status='active'
).select_related('product').order_by('base_price'))

print(f"\nTotal SKUs available: {len(skus)}")

# Select 4 products with different prices
selected = []

# Get products at different percentiles
percentiles = [10, 35, 65, 90]  # Low, Medium-Low, Medium-High, High

for percentile in percentiles:
    index = int(len(skus) * percentile / 100)
    if index < len(skus):
        selected.append(skus[index])

print("\nSelected products for Quick Search:")
print("-" * 70)

for i, sku in enumerate(selected, 1):
    product_name = sku.product.name if sku.product else 'N/A'
    print(f"{i}. SKU: {sku.code}")
    print(f"   Product: {product_name}")
    print(f"   Price: ₹{sku.base_price}")
    
    # Shorten for display
    short_name = product_name.split(' - ')[0] if ' - ' in product_name else product_name
    short_name = short_name.replace('Maternity', '').replace('Feeding', '').strip()
    if len(short_name) > 25:
        short_name = short_name[:22] + '...'
    
    print(f"   Display: {short_name} • ₹{sku.base_price}")
    print("-" * 70)

# Generate TypeScript code
print("\n" + "="*70)
print("TYPESCRIPT CODE:")
print("="*70)
print()

for sku in selected:
    product_name = sku.product.name if sku.product else 'Unknown'
    short_name = product_name.split(' - ')[0] if ' - ' in product_name else product_name
    short_name = short_name.replace('Maternity', '').replace('Feeding', '').replace('Zipless', '').replace('Loungewear', 'Lounge').strip()
    if len(short_name) > 25:
        short_name = short_name[:22] + '...'
    
    print(f"  <Chip")
    print(f"    label=\"{short_name} • ₹{int(float(sku.base_price))}\"")
    print(f"    onClick={{() => handleQuickSearch('{sku.code}')}}")
    print(f"    size=\"small\"")
    print(f"    variant=\"outlined\"")
    print(f"  />")

print("\n" + "="*70 + "\n")
