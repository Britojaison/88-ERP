import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU, Location
from apps.mdm.serializers import SKUBarcodeSerializer

sku = SKU.objects.first()

data1 = {
    'sku': str(sku.id) if sku else '',
    'display_code': 'ASDF',
    'label_title': 'Title',
    'selling_price': '10',
    'mrp': '15',
}
data2 = data1.copy()
data2['barcode_value'] = ''

data3 = data1.copy()
data3['barcode_value'] = None

from rest_framework.request import Request
from django.test import RequestFactory
from rest_framework.test import force_authenticate
from apps.mdm.views import SKUBarcodeViewSet

factory = RequestFactory()
user = sku.company.users.first()

import json

for idx, data in enumerate([data1, data2, data3]):
    print(f"\n--- Testing data{idx+1} ---")
    req = factory.post('/api/mdm/sku-barcodes/', data=json.dumps(data), content_type='application/json')
    force_authenticate(req, user=user)
    view = SKUBarcodeViewSet.as_view({'post': 'create'})
    try:
        response = view(req)
        print("Response status:", response.status_code)
        if response.status_code != 201:
            print("Response data:", response.data)
    except Exception as e:
        print("Exception:", e)
