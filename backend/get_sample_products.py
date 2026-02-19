import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU
import json

print("\n" + "="*70)
print("GETTING SAMPLE REAL PRODUCTS FOR QUICK SEARCH")
print("="*70)

# Get 4 diverse products with different prices
skus = SKU.objects.filter(
    code__startswith='MMW-',
    status='active'
).select_related('product').order_by('base_price')[:50]

# Select 4 products with different price ranges
selected = []
price_ranges = [
    (0, 800),      # Low price
    (800, 1200),   # Medium-low price
    (1200, 1700),  # Medium-high price
    (1700, 3000),  # High price
]

for min_price, max_price in price_ranges:
    for sku in skus:
        price = float(sku.base_price)
        if min_price <= price < max_price and sku not in selected:
            selected.append(sku)
            break

print("\nSelected products for Quick Search:")
print("-" * 70)

for i, sku in enumerate(selected, 1):
    print(f"{i}. SKU: {sku.code}")
    print(f"   Product: {sku.product.name if sku.product else 'N/A'}")
    print(f"   Price: ₹{sku.base_price}")
    print("-" * 70)

# Generate TypeScript code
print("\n" + "="*70)
print("TYPESCRIPT CODE FOR QUICK SEARCH CHIPS:")
print("="*70)
print()

for sku in selected:
    product_name = sku.product.name if sku.product else 'Unknown'
    # Shorten product name for chip display
    short_name = product_name.split(' - ')[0] if ' - ' in product_name else product_name
    if len(short_name) > 30:
        short_name = short_name[:27] + '...'
    
    print(f"  <Chip")
    print(f"    label=\"{short_name} • ₹{sku.base_price}\"")
    print(f"    onClick={{() => handleQuickSearch('{sku.code}')}}")
    print(f"    size=\"small\"")
    print(f"    variant=\"outlined\"")
    print(f"  />")

print("\n" + "="*70 + "\n")
