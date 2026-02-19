import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU
from apps.mdm.serializers import SKUSerializer

print("\n" + "="*70)
print("TESTING SKU API SERIALIZER")
print("="*70)

# Get first 5 SKUs
skus = SKU.objects.select_related('product')[:5]

print(f"\nFound {skus.count()} SKUs to test\n")

for sku in skus:
    serializer = SKUSerializer(sku)
    data = serializer.data
    
    print(f"SKU Code: {data['code']}")
    print(f"Product ID: {data['product']}")
    print(f"Product Code: {data.get('product_code', 'N/A')}")
    print(f"Product Name: {data.get('product_name', 'N/A')}")
    print(f"Base Price: ₹{data['base_price']}")
    print("-" * 70)

print("\n" + "="*70 + "\n")
