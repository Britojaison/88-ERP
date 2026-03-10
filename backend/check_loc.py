
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore
from apps.mdm.models import Location

def check():
    store = ShopifyStore.objects.first()
    print(f"Store Company ID: {store.company_id}")
    
    ls = Location.objects.filter(code='SHOPIFY-WH')
    for l in ls:
        print(f"Location ID: {l.id} | Code: {l.code} | Co ID: {l.company_id}")
        if l.company_id == store.company_id:
            print("  MATCHED THIS STORE'S COMPANY")

if __name__ == "__main__":
    check()
