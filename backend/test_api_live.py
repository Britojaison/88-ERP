import requests
import json
import base64

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# We need an admin user token
from apps.mdm.models import User
from rest_framework_simplejwt.tokens import RefreshToken

user = User.objects.filter(is_superuser=True).first()
if not user:
    user = User.objects.first()
token = str(RefreshToken.for_user(user).access_token)
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

from apps.mdm.models import SKU
sku = SKU.objects.first()

data = {}

response = requests.post('http://localhost:8000/api/mdm/sku-barcodes/', json=data, headers=headers)
print("Response STATUS:", response.status_code)
print("Response DATA:", response.text)
