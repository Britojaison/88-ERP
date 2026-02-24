import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.serializers import SKUSerializer
from apps.mdm.models import Product

# Get first product for foreign key
product = Product.objects.first()
product_id = product.id if product else 1

payload = {
  "code": "TEST-SKU-001",
  "name": "Test SKU",
  "product": product_id,
  "size": "M",
  "base_price": "100.00",
  "cost_price": "150.00",
  "weight": "",
  "is_serialized": False,
  "is_batch_tracked": False
}

print(f"Testing SKUSerializer with payload: {payload}")

serializer = SKUSerializer(data=payload)
if serializer.is_valid():
    print("Serializer is VALID")
    print("Validated data:", serializer.validated_data)
else:
    print("Serializer is INVALID")
    print("Errors:", serializer.errors)
