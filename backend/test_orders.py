import sys
from apps.integrations.shopify_service import ShopifyService, ShopifyAPIClient
from apps.integrations.shopify_models import ShopifyStore
import json

store = ShopifyStore.objects.first()
client = ShopifyAPIClient(store)
order = client._make_request('GET', 'orders/7288446976164.json').get('order')

try:
    ShopifyService._process_order(store, order)
except Exception as e:
    with open('error.txt', 'w') as f:
        f.write(str(e))
    # Also save the order json to see what field might be null
    with open('failed_order.json', 'w') as f:
        json.dump(order, f, indent=2)
