import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
User = get_user_model()
from apps.mdm.models import Product

client = Client()
# Login as first user
user = User.objects.first()
if not user:
    print("No user found")
    sys.exit(1)
    
client.force_login(user)

product = Product.objects.first()
product_id = product.id if product else 1
product_name = product.name if product else "Test"

# Step 1: getNextSkuCode
response = client.get(f'/api/mdm/products/next-sku-code/?product_name={product_name}&size=M')
print(f"1. Next SKU Code status: {response.status_code}")
try:
    data = response.json()
    print(f"   Data: {data}")
    sku_code = data.get('sku_code', 'TEST-FAIL-001')
except Exception as e:
    print(f"   Error parsing JSON: {e}")
    sku_code = 'TEST-FAIL-001'

# Step 2: createSKU
payload = {
  "code": sku_code,
  "name": f"{product_name} - M",
  "product": product_id,
  "size": "M",
  "base_price": "100.00",
  "cost_price": "150.00",
  "weight": "",
  "is_serialized": False,
  "is_batch_tracked": False
}

print(f"\n2. Creating SKU with payload: {payload}")
response = client.post('/api/mdm/skus/', data=payload, content_type='application/json')
print(f"   Response status: {response.status_code}")
try:
    print(f"   Response data: {response.json()}")
except:
    print(f"   Response content: {response.content}")