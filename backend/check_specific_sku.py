import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Product, SKU, SKUBarcode
from apps.integrations.shopify_models import ShopifyProduct

search_value = "V51158999433380"

print("\n" + "="*70)
print(f"SEARCHING FOR: {search_value}")
print("="*70)

# Search in SKU codes
print("\n1. Searching in SKU codes...")
skus = SKU.objects.filter(code__icontains=search_value)
print(f"   Found {skus.count()} SKU(s)")
for sku in skus:
    print(f"   - SKU Code: {sku.code}")
    print(f"     Product: {sku.product.name if sku.product else 'N/A'}")
    print(f"     Size: {sku.size or 'N/A'}")
    print(f"     Price: ₹{sku.base_price}")

# Search in Product codes
print("\n2. Searching in Product codes...")
products = Product.objects.filter(code__icontains=search_value)
print(f"   Found {products.count()} Product(s)")
for product in products:
    print(f"   - Product Code: {product.code}")
    print(f"     Name: {product.name}")

# Search in Shopify variant IDs
print("\n3. Searching in Shopify variant IDs...")
shopify_products = ShopifyProduct.objects.filter(shopify_variant_id__icontains=search_value)
print(f"   Found {shopify_products.count()} Shopify Product(s)")
for sp in shopify_products:
    print(f"   - Shopify Variant ID: {sp.shopify_variant_id}")
    print(f"     Shopify Product ID: {sp.shopify_product_id}")
    print(f"     SKU: {sp.shopify_sku}")
    print(f"     Product Name: {sp.erp_product.name if sp.erp_product else 'N/A'}")
    print(f"     Price: ₹{sp.shopify_price}")

# Search in Shopify SKUs
print("\n4. Searching in Shopify SKUs...")
shopify_by_sku = ShopifyProduct.objects.filter(shopify_sku__icontains=search_value)
print(f"   Found {shopify_by_sku.count()} Shopify Product(s) by SKU")
for sp in shopify_by_sku:
    print(f"   - Shopify SKU: {sp.shopify_sku}")
    print(f"     Variant ID: {sp.shopify_variant_id}")
    print(f"     Product Name: {sp.erp_product.name if sp.erp_product else 'N/A'}")

# Search in barcodes
print("\n5. Searching in Barcodes...")
barcodes = SKUBarcode.objects.filter(barcode_value__icontains=search_value)
print(f"   Found {barcodes.count()} Barcode(s)")
for barcode in barcodes:
    print(f"   - Barcode Value: {barcode.barcode_value}")
    print(f"     SKU: {barcode.sku.code}")
    print(f"     Product: {barcode.sku.product.name if barcode.sku.product else 'N/A'}")

print("\n" + "="*70)
print("SEARCH COMPLETE")
print("="*70 + "\n")
