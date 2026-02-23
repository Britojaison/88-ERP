import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
import django
django.setup()

from apps.integrations.shopify_models import ShopifyStore, ShopifySyncJob
store = ShopifyStore.objects.get(pk='ba41c638-5472-4185-b71a-4f97d75ea0f8')

# Test creating jobs for draft_orders and discounts
for jt in ['draft_orders', 'discounts', 'gift_cards']:
    try:
        job = ShopifySyncJob.objects.create(store=store, job_type=jt, job_status='running')
        print(f'{jt}: OK (id={job.id})')
        job.delete()  # cleanup
    except Exception as e:
        print(f'{jt}: FAILED - {e}')
