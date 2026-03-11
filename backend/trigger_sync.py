
import os
import django
import sys

# Setup Django
sys.path.append(r'c:\Users\jeril\OneDrive\Desktop\88gb\erp\88-ERP\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore, ShopifySyncJob
from apps.integrations.shopify_service import ShopifyService
from django.utils import timezone

def run():
    store = ShopifyStore.objects.get(name='mmwear')
    print(f"Starting sync for {store.name}...")
    
    # 1. Sync Collections
    job_col = ShopifySyncJob.objects.create(
        store=store,
        job_type='collections',
        job_status='running',
        started_at=timezone.now()
    )
    print("Syncing collections...")
    ShopifyService.sync_collections(store, job_col)
    print(f"Collections sync done. Status: {job_col.job_status}")
    
    # 2. Sync Memberships (includes virtual and metafields)
    job_mem = ShopifySyncJob.objects.create(
        store=store,
        job_type='collections', 
        job_status='running',
        started_at=timezone.now()
    )
    
    print("Syncing collection memberships (including metafields and taxonomy)...")
    result = ShopifyService.sync_collection_memberships(store, job_mem)
    print(f"Memberships sync done. result: {result}")

if __name__ == '__main__':
    run()
