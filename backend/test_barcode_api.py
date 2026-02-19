import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKUBarcode
from apps.mdm.serializers import SKUBarcodeSerializer

print("\n" + "="*70)
print("TESTING BARCODE API SERIALIZER")
print("="*70)

# Get first 5 barcodes
barcodes = SKUBarcode.objects.select_related('sku', 'sku__product')[:5]

print(f"\nFound {barcodes.count()} barcodes to test\n")

for barcode in barcodes:
    serializer = SKUBarcodeSerializer(barcode)
    data = serializer.data
    
    print(f"Barcode ID: {data['id']}")
    print(f"SKU Code: {data.get('sku_code', 'N/A')}")
    print(f"Product Name: {data.get('product_name', 'N/A')}")
    print(f"Barcode Value: {data['barcode_value']}")
    print(f"Label Title: {data['label_title']}")
    print("-" * 70)

print("\n" + "="*70 + "\n")
