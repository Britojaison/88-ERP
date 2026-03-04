import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from apps.mdm.models import User

user = User.objects.first()

client = APIClient()
client.force_authenticate(user=user)
response = client.post('/api/mdm/products/', {'name': 'API Test Product 2', 'code': 'API-TEST-999', 'status': 'active'}, format='json')
print("STATUS", response.status_code)
text = response.content.decode('utf-8')
if response.status_code == 500:
    open('error500.html', 'w', encoding='utf-8').write(text)
    print("Saved error500.html")
else:
    print(text)