import requests
import time
import logging
import re
from collections import defaultdict
from typing import Dict, List, Optional, Any
from django.db import transaction
from django.utils import timezone
from .shopify_models import (
    ShopifyStore, ShopifyProduct, ShopifyInventoryLevel,
    ShopifyWebhook, ShopifyWebhookLog, ShopifySyncJob,
    ShopifyOrder, ShopifyDraftOrder, ShopifyDiscount, ShopifyGiftCard,
    ShopifyCollection
)
from apps.mdm.models import Product, SKU, Location, Customer
from apps.inventory.models import InventoryBalance

logger = logging.getLogger(__name__)


class ShopifyAPIClient:
    """
    Shopify REST Admin API client with rate-limit handling.
    """
    
    def __init__(self, store: ShopifyStore):
        self.store = store
        self.base_url = f"https://{store.shop_domain}/admin/api/{store.api_version}"
        self.headers = {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json',
        }
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make API request with error handling and rate limiting."""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.request(method, url, headers=self.headers, timeout=30, **kwargs)
            
            # Handle rate limiting (429)
            if response.status_code == 429:
                retry_after = float(response.headers.get('Retry-After', '2.0'))
                logger.warning(f"Shopify rate limit hit, waiting {retry_after}s")
                time.sleep(retry_after)
                response = requests.request(method, url, headers=self.headers, timeout=30, **kwargs)
            
            response.raise_for_status()
            
            if response.status_code == 204:
                return {}
            
            return response.json()
        except requests.exceptions.RequestException as e:
            masked_token = f"{self.headers.get('X-Shopify-Access-Token', '')[:10]}..."
            logger.error(f"Shopify API error for {url}: {e}. Token used: {masked_token}")
            raise
    
    def get_products(self, limit: int = 250, since_id: Optional[int] = None, page_info: Optional[str] = None, updated_at_min: Optional[str] = None) -> Dict:
        """Get products from Shopify with pagination support."""
        params = {'limit': limit}
        if since_id:
            params['since_id'] = since_id
        if updated_at_min:
            params['updated_at_min'] = updated_at_min
        if page_info:
            params = {'limit': limit, 'page_info': page_info}
        
        response = self._make_request('GET', 'products.json', params=params)
        return response
    
    def get_all_products(self, updated_at_min: Optional[str] = None) -> List[Dict]:
        """Get ALL products from Shopify using cursor-based pagination (Link header)."""
        import re
        all_products = []
        params = {'limit': 250, 'status': 'active,archived,draft'}
        if updated_at_min:
            params['updated_at_min'] = updated_at_min
        
        url = f"{self.base_url}/products.json"
        current_params = params
        
        while True:
            response = requests.get(url, headers=self.headers, params=current_params, timeout=30)
            
            if response.status_code == 429:
                retry_after = float(response.headers.get('Retry-After', '2.0'))
                time.sleep(retry_after)
                continue
                
            response.raise_for_status()
            data = response.json()
            products = data.get('products', [])
            all_products.extend(products)
            
            # Check for next page in Link header
            link_header = response.headers.get('Link', '')
            if not link_header or 'rel="next"' not in link_header:
                break
                
            # Extract page_info from the next link
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if not next_match:
                break
            
            next_url = next_match.group(1)
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(next_url)
            qs = parse_qs(parsed.query)
            page_info = qs.get('page_info', [None])[0]
            
            if not page_info:
                break
                
            # For next calls, only page_info and limit are allowed
            current_params = {'page_info': page_info, 'limit': 250}
            time.sleep(0.5)

        return all_products
    
    def get_product(self, product_id: int) -> Dict:
        """Get single product by ID."""
        response = self._make_request('GET', f'products/{product_id}.json')
        return response.get('product', {})
    
    def create_product(self, product_data: Dict) -> Dict:
        """Create a product on Shopify."""
        response = self._make_request('POST', 'products.json', json={'product': product_data})
        return response.get('product', {})
    
    def update_product(self, product_id: int, product_data: Dict) -> Dict:
        """Update an existing Shopify product."""
        response = self._make_request('PUT', f'products/{product_id}.json', json={'product': product_data})
        return response.get('product', {})

    def delete_product(self, product_id: int) -> None:
        """Delete a product from Shopify."""
        self._make_request('DELETE', f'products/{product_id}.json')

    def get_custom_collections(self) -> List[Dict]:
        """Fetch all custom collections from Shopify (read-only)."""
        import re
        all_collections = []
        url = f"{self.base_url}/custom_collections.json"
        params = {'limit': 250}
        while True:
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            if response.status_code == 429:
                time.sleep(float(response.headers.get('Retry-After', '2.0')))
                continue
            response.raise_for_status()
            data = response.json()
            all_collections.extend(data.get('custom_collections', []))
            link_header = response.headers.get('Link', '')
            if not link_header or 'rel="next"' not in link_header:
                break
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if not next_match:
                break
            # next page — use full URL
            url = next_match.group(1)
            params = {}
        return all_collections

    def get_smart_collections(self) -> List[Dict]:
        """Fetch all smart collections from Shopify (read-only)."""
        import re
        all_collections = []
        url = f"{self.base_url}/smart_collections.json"
        params = {'limit': 250}
        while True:
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            if response.status_code == 429:
                time.sleep(float(response.headers.get('Retry-After', '2.0')))
                continue
            response.raise_for_status()
            data = response.json()
            all_collections.extend(data.get('smart_collections', []))
            link_header = response.headers.get('Link', '')
            if not link_header or 'rel="next"' not in link_header:
                break
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if not next_match:
                break
            url = next_match.group(1)
            params = {}
        return all_collections

    def add_product_to_collection(self, shopify_product_id: int, shopify_collection_id: int) -> Dict:
        """
        Add a product to a collection via the Collects API.
        This is PURELY additive — it never modifies any product data.
        """
        response = self._make_request('POST', 'collects.json', json={
            'collect': {
                'product_id': shopify_product_id,
                'collection_id': shopify_collection_id,
            }
        })
        return response.get('collect', {})

    def get_collects(self, limit: int = 250) -> List[Dict]:
        """Fetch all collects (memberships in custom collections)."""
        import re
        all_collects = []
        url = f"{self.base_url}/collects.json"
        params = {'limit': limit}
        while True:
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            if response.status_code == 429:
                time.sleep(float(response.headers.get('Retry-After', '2.0')))
                continue
            response.raise_for_status()
            data = response.json()
            all_collects.extend(data.get('collects', []))
            link_header = response.headers.get('Link', '')
            if not link_header or 'rel="next"' not in link_header:
                break
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if not next_match:
                break
            url = next_match.group(1)
            params = {}
        return all_collects

    def get_products_by_collection(self, collection_id: int, limit: int = 250) -> List[Dict]:
        """Fetch all products for a specific collection (useful for smart collections)."""
        all_products = []
        url = f"{self.base_url}/products.json"
        params = {'collection_id': collection_id, 'limit': limit}
        while True:
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            if response.status_code == 429:
                time.sleep(float(response.headers.get('Retry-After', '2.0')))
                continue
            response.raise_for_status()
            data = response.json()
            all_products.extend(data.get('products', []))
            link_header = response.headers.get('Link', '')
            if not link_header or 'rel="next"' not in link_header:
                break
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if not next_match:
                break
            url = next_match.group(1)
            params = {}
        return all_products

    def get_metafields(self, resource_type: str, resource_id: int) -> List[Dict]:
        """Fetch metafields for a specific resource (products, custom_collections, etc.)."""
        response = self._make_request('GET', f"{resource_type}/{resource_id}/metafields.json")
        return response.get('metafields', [])

    def create_variant(self, product_id: int, variant_data: Dict) -> Dict:
        """Create a new variant for an existing product."""
        response = self._make_request('POST', f'products/{product_id}/variants.json', json={'variant': variant_data})
        return response.get('variant', {})

    def get_product_count(self) -> int:
        """Get total product count."""
        response = self._make_request('GET', 'products/count.json')
        return response.get('count', 0)
    
    def get_inventory_levels(self, location_ids: Optional[str] = None, inventory_item_ids: Optional[str] = None) -> List[Dict]:
        """Get inventory levels."""
        params = {}
        if location_ids:
            params['location_ids'] = location_ids
        if inventory_item_ids:
            params['inventory_item_ids'] = inventory_item_ids
        
        response = self._make_request('GET', 'inventory_levels.json', params=params)
        return response.get('inventory_levels', [])
    
    def get_inventory_item(self, inventory_item_id: int) -> Dict:
        """Get a specific inventory item."""
        response = self._make_request('GET', f'inventory_items/{inventory_item_id}.json')
        return response.get('inventory_item', {})
    
    def get_locations(self) -> List[Dict]:
        """Get Shopify locations."""
        response = self._make_request('GET', 'locations.json')
        return response.get('locations', [])
    
    def set_inventory_level(
        self,
        inventory_item_id: int,
        location_id: int,
        available: int
    ) -> Dict:
        """Set inventory level (POST)."""
        data = {
            'location_id': location_id,
            'inventory_item_id': inventory_item_id,
            'available': available
        }
        response = self._make_request('POST', 'inventory_levels/set.json', json=data)
        return response.get('inventory_level', {})
    
    def adjust_inventory_level(
        self,
        inventory_item_id: int,
        location_id: int,
        available_adjustment: int
    ) -> Dict:
        """Adjust inventory level."""
        data = {
            'location_id': location_id,
            'inventory_item_id': inventory_item_id,
            'available_adjustment': available_adjustment, 
        }
        response = self._make_request('POST', 'inventory_levels/adjust.json', json=data)
        return response.get('inventory_level', {})

    def get_orders(self, status_filter: str = 'any', limit: int = 250, created_at_min: Optional[str] = None, created_at_max: Optional[str] = None) -> List[Dict]:
        """Get orders from Shopify with date filtering."""
        params = {'status': status_filter, 'limit': limit}
        if created_at_min:
            params['created_at_min'] = created_at_min
        if created_at_max:
            params['created_at_max'] = created_at_max
        response = self._make_request('GET', 'orders.json', params=params)
        return response.get('orders', [])

    def get_all_orders(self, created_at_min: Optional[str] = None, created_at_max: Optional[str] = None) -> List[Dict]:
        """Get ALL orders within a date range using Link-header pagination."""
        import re
        all_orders = []
        params = {'limit': 250, 'status': 'any'}
        if created_at_min:
            params['created_at_min'] = created_at_min
        if created_at_max:
            params['created_at_max'] = created_at_max

        url = f"{self.base_url}/orders.json"
        current_params = params
        
        while True:
            response = requests.get(url, headers=self.headers, params=current_params, timeout=30)
            
            if response.status_code == 429:
                retry_after = float(response.headers.get('Retry-After', '2.0'))
                time.sleep(retry_after)
                continue
                
            response.raise_for_status()
            data = response.json()
            orders = data.get('orders', [])
            all_orders.extend(orders)
            
            # Check for next page in Link header
            link_header = response.headers.get('Link', '')
            if not link_header or 'rel="next"' not in link_header:
                break
                
            # Extract page_info from the next link
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if not next_match:
                break
            
            next_url = next_match.group(1)
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(next_url)
            qs = parse_qs(parsed.query)
            page_info = qs.get('page_info', [None])[0]
            
            if not page_info:
                break
                
            # For next calls, only page_info and limit are allowed
            current_params = {'page_info': page_info, 'limit': 250}
            time.sleep(0.5)

        return all_orders

    def get_draft_orders(self) -> List[Dict]:
        """Get all draft orders."""
        all_drafts = []
        params = {'limit': 250}
        while True:
            response = self._make_request('GET', 'draft_orders.json', params=params)
            drafts = response.get('draft_orders', [])
            all_drafts.extend(drafts)
            if len(drafts) < 250: break
            params['since_id'] = drafts[-1]['id']
            time.sleep(0.5)
        return all_drafts

    def get_price_rules(self) -> List[Dict]:
        """Get all price rules."""
        all_rules = []
        params = {'limit': 250}
        while True:
            response = self._make_request('GET', 'price_rules.json', params=params)
            rules = response.get('price_rules', [])
            all_rules.extend(rules)
            if len(rules) < 250: break
            params['since_id'] = rules[-1]['id']
            time.sleep(0.5)
        return all_rules

    def get_discount_codes(self, price_rule_id: int) -> List[Dict]:
        """Get individual discount codes for a price rule."""
        response = self._make_request('GET', f'price_rules/{price_rule_id}/discount_codes.json')
        return response.get('discount_codes', [])

    def get_gift_cards(self) -> List[Dict]:
        """Get all gift cards."""
        all_cards = []
        params = {'limit': 250}
        while True:
            response = self._make_request('GET', 'gift_cards.json', params=params)
            cards = response.get('gift_cards', [])
            all_cards.extend(cards)
            if len(cards) < 250: break
            params['since_id'] = cards[-1]['id']
            time.sleep(0.5)
        return all_cards

    def get_reports(self) -> List[Dict]:
        """Get all reports."""
        response = self._make_request('GET', 'reports.json')
        return response.get('reports', [])

    def create_fulfillment(self, fulfillment_order_id: int, tracking_info: Dict) -> Dict:
        """Create a fulfillment for a fulfillment order."""
        data = {
            'fulfillment': {
                'message': 'The items have been fulfilled.',
                'notify_customer': True,
                'tracking_info': tracking_info,
                'line_items_by_fulfillment_order': [{
                    'fulfillment_order_id': fulfillment_order_id
                }]
            }
        }
        response = self._make_request('POST', 'fulfillments.json', json=data)
        return response.get('fulfillment', {})
    
    def create_webhook(self, topic: str, address: str) -> Dict:
        """Create a webhook."""
        data = {
            'webhook': {
                'topic': topic,
                'address': address,
                'format': 'json'
            }
        }
        response = self._make_request('POST', 'webhooks.json', json=data)
        return response.get('webhook', {})
    
    def get_webhooks(self) -> List[Dict]:
        """Get all webhooks."""
        response = self._make_request('GET', 'webhooks.json')
        return response.get('webhooks', [])
    
    def delete_webhook(self, webhook_id: int) -> None:
        """Delete a webhook."""
        self._make_request('DELETE', f'webhooks/{webhook_id}.json')
    
    def test_connection(self) -> Dict:
        """Test API connection and return shop info."""
        try:
            response = self._make_request('GET', 'shop.json')
            return response.get('shop', {})
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return {}


class ShopifyService:
    """
    Service for Shopify integration operations.
    """
    
    @staticmethod
    def test_connection(store: ShopifyStore) -> bool:
        """Test Shopify API connection."""
        client = ShopifyAPIClient(store)
        shop_info = client.test_connection()
        
        store.is_connected = bool(shop_info)
        store.last_connection_test = timezone.now()
        if not shop_info:
            store.connection_error = "Failed to connect to Shopify API"
        else:
            store.connection_error = ""
        store.save(update_fields=[
            'is_connected', 'last_connection_test', 'connection_error', 'updated_at'
        ])
        
        return store.is_connected
    
    @staticmethod
    def sync_products(store: ShopifyStore) -> ShopifySyncJob:
        """Sync products from Shopify to ERP (creates its own job)."""
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='products',
            job_status='running'
        )
        ShopifyService._do_product_sync(store, job)
        return job

    @staticmethod
    def sync_products_delta(store: ShopifyStore) -> ShopifySyncJob:
        """Sync recently changed products from Shopify to ERP (delta sync)."""
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='products_delta',
            job_status='running'
        )
        # Background processing should be handled by the caller/view
        ShopifyService._do_product_sync_delta(store, job)
        return job
    
    @staticmethod
    def _do_product_sync(store: ShopifyStore, job: ShopifySyncJob) -> None:
        """Execute the actual product sync. Can be called from a background thread."""
        try:
            client = ShopifyAPIClient(store)
            products = client.get_all_products()
            
            # Count total variants for accurate progress tracking
            total_variants = sum(len(p.get('variants', [])) for p in products)
            job.total_items = total_variants
            job.save(update_fields=['total_items'])
            for i, shopify_product in enumerate(products):
                # Check for cancellation before processing each product
                if job.is_cancelled():
                    logger.info(f"Product sync job {job.id} was cancelled.")
                    # Stop processing and exit - DO NOT call job.save() because it might overwrite the 'cancelled' status
                    return

                try:
                    ShopifyService._process_product(store, shopify_product, job)
                except Exception as e:
                    logger.error(f"Error processing product {shopify_product.get('id')}: {e}")
                    job.failed_items += 1
                    job.error_log += f"\nProduct {shopify_product.get('id')}: {str(e)}"
                
                # Save progress every 10 products
                if (i + 1) % 10 == 0:
                    job.save(update_fields=['processed_items', 'created_items', 'updated_items', 'failed_items', 'error_log'])
            
            store.last_product_sync = timezone.now()
            store.save(update_fields=['last_product_sync', 'updated_at'])
            
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            job.save()
            
        except Exception as e:
            logger.error(f"Product sync failed: {e}")
            job.job_status = 'failed'
            job.error_log = str(e)
            job.completed_at = timezone.now()
            job.save()

    @staticmethod
    def _do_product_sync_delta(store: ShopifyStore, job: ShopifySyncJob) -> None:
        """Execute delta product sync. Processes only products changed since last sync."""
        try:
            client = ShopifyAPIClient(store)
            updated_at_min = None
            if store.last_product_sync:
                updated_at_min = store.last_product_sync.isoformat()
            
            logger.info(f"Starting delta product sync for store {store.name} since {updated_at_min}")
            products = client.get_all_products(updated_at_min=updated_at_min)
            
            total_variants = sum(len(p.get('variants', [])) for p in products)
            job.total_items = total_variants
            job.save(update_fields=['total_items'])
            
            for i, shopify_product in enumerate(products):
                if job.is_cancelled():
                    logger.info(f"Delta product sync job {job.id} was cancelled.")
                    return

                try:
                    ShopifyService._process_product(store, shopify_product, job)
                except Exception as e:
                    logger.error(f"Error processing delta product {shopify_product.get('id')}: {e}")
                    job.failed_items += 1
                    job.error_log += f"\nProduct {shopify_product.get('id')}: {str(e)}"
                
                if (i + 1) % 10 == 0:
                    job.save(update_fields=['processed_items', 'created_items', 'updated_items', 'failed_items', 'error_log'])
            
            store.last_product_sync = timezone.now()
            store.save(update_fields=['last_product_sync', 'updated_at'])
            
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            job.save()
            
        except Exception as e:
            logger.error(f"Delta product sync failed: {e}")
            job.job_status = 'failed'
            job.error_log = str(e)
            job.completed_at = timezone.now()
            job.save()
    
    @staticmethod
    def get_or_create_virtual_collection(store: ShopifyStore, title: str) -> ShopifyCollection:
        """Create a virtual collection from a Taxonomy name or Metafield value."""
        from hashlib import sha256
        # Generate a stable ID from the title to avoid duplicates and fit in BigIntegerField
        virtual_id = (int(sha256(title.encode()).hexdigest(), 16) % 10**14) + 900000000000000
        obj, _ = ShopifyCollection.objects.get_or_create(
            store=store,
            shopify_collection_id=virtual_id,
            defaults={
                'title': title,
                'collection_type': ShopifyCollection.COLLECTION_TYPE_VIRTUAL,
                'is_active': True,
            }
        )
        return obj

    @staticmethod
    def _fetch_metafields_cached(client: ShopifyAPIClient, product_id: int, cache: Dict) -> List[Dict]:
        """Fetch metafields for a product and cache it within the sync loop."""
        if product_id in cache:
            return cache[product_id]
        try:
            metafields = client.get_metafields('products', product_id)
            cache[product_id] = metafields
            return metafields
        except Exception:
            return []

    @staticmethod
    def _process_product(store: ShopifyStore, shopify_data: Dict, job: ShopifySyncJob) -> None:
        """Process a single Shopify product."""
        product_id = shopify_data['id']
        
        # Process each variant as a separate SKU
        for variant in shopify_data.get('variants', []):
            variant_id = variant['id']
            
            # Get or create ShopifyProduct mapping
            shopify_product, created = ShopifyProduct.objects.get_or_create(
                store=store,
                shopify_product_id=product_id,
                shopify_variant_id=variant_id,
                defaults={
                    'shopify_title': shopify_data.get('title', ''),
                    'shopify_sku': variant.get('sku', '') or '',
                    'shopify_barcode': variant.get('barcode', '') or '',
                    'shopify_price': variant.get('price'),
                    'shopify_inventory_quantity': variant.get('inventory_quantity', 0),
                    'shopify_inventory_item_id': variant.get('inventory_item_id'),
                    'shopify_product_type': shopify_data.get('product_type', '') or '',
                    'shopify_vendor': shopify_data.get('vendor', ''),
                    'shopify_tags': shopify_data.get('tags', ''),
                    'shopify_image_url': (shopify_data.get('image') or {}).get('src', '') if shopify_data.get('image') else '',
                    'shopify_data': shopify_data,
                }
            )
            
            if created:
                job.created_items += 1
            else:
                # Update existing
                shopify_product.shopify_title = shopify_data.get('title', '')
                shopify_product.shopify_sku = variant.get('sku', '') or ''
                shopify_product.shopify_barcode = variant.get('barcode', '') or ''
                shopify_product.shopify_price = variant.get('price')
                shopify_product.shopify_inventory_quantity = variant.get('inventory_quantity', 0)
                shopify_product.shopify_inventory_item_id = variant.get('inventory_item_id')
                shopify_product.shopify_product_type = shopify_data.get('product_type', '') or ''
                shopify_product.shopify_vendor = shopify_data.get('vendor', '')
                shopify_product.shopify_tags = shopify_data.get('tags', '')
                shopify_product.shopify_image_url = (shopify_data.get('image') or {}).get('src', '') if shopify_data.get('image') else ''
                shopify_product.shopify_data = shopify_data
                shopify_product.save()
                job.updated_items += 1
            
            # Try to match with existing ERP SKU by SKU code or barcode
            if variant.get('sku'):
                try:
                    erp_sku = SKU.objects.get(
                        company_id=store.company_id,
                        code=variant['sku'],
                        status='active'
                    )
                    shopify_product.erp_sku = erp_sku
                    shopify_product.erp_product = erp_sku.product
                    shopify_product.sync_status = 'synced'
                    shopify_product.save()
                except SKU.DoesNotExist:
                    # Try matching by barcode
                    if variant.get('barcode'):
                        from apps.mdm.models import SKUBarcode
                        try:
                            barcode = SKUBarcode.objects.get(
                                barcode_value=variant['barcode'],
                                status='active'
                            )
                            shopify_product.erp_sku = barcode.sku
                            shopify_product.erp_product = barcode.sku.product
                            shopify_product.sync_status = 'synced'
                            shopify_product.save()
                        except SKUBarcode.DoesNotExist:
                            shopify_product.sync_status = 'pending'
                            shopify_product.sync_error = 'SKU not found in ERP'
                            shopify_product.save()
                    else:
                        shopify_product.sync_status = 'pending'
                        shopify_product.sync_error = 'SKU not found in ERP'
                        shopify_product.save()
            
            shopify_product.last_synced_at = timezone.now()
            shopify_product.save()
            
            job.processed_items += 1
            # Move save to parent loop or frequent intervals to avoid too many DB writes
            # job.save(update_fields=['processed_items', 'created_items', 'updated_items', 'failed_items'])
    
    @staticmethod
    def create_erp_sku_from_shopify(shopify_product: ShopifyProduct) -> SKU:
        """Create a new ERP SKU and Product from Shopify data."""
        from apps.mdm.models import Product, SKU, SKUBarcode
        
        with transaction.atomic():
            # 1. Get or create the ERP Product
            # We use shopify_product_id as a hint in description or we could add a field to Product if needed.
            # But for now, let's just use the title.
            erp_product, created = Product.objects.get_or_create(
                company_id=shopify_product.store.company_id,
                name=shopify_product.shopify_title,
                defaults={
                    'code': f"SHP-{shopify_product.shopify_product_id}",
                    'description': f"Imported from Shopify (ID: {shopify_product.shopify_product_id})",
                    'status': 'active'
                }
            )
            
            # 2. Create the SKU
            sku_code = shopify_product.shopify_sku or f"SHP-VAR-{shopify_product.shopify_variant_id}"
            
            # Ensure SKU code is unique for this company
            if SKU.objects.filter(company_id=shopify_product.store.company_id, code=sku_code).exists():
                # If SKU exists but isn't mapped, we'll just link it instead of creating
                sku = SKU.objects.get(company_id=shopify_product.store.company_id, code=sku_code)
            else:
                sku = SKU.objects.create(
                    company_id=shopify_product.store.company_id,
                    product=erp_product,
                    code=sku_code,
                    name=shopify_product.shopify_title,
                    base_price=shopify_product.shopify_price or 0,
                    cost_price=0,  # Default cost to 0 for imported items
                    status='active',
                    lifecycle_status='active'
                )
            
            # 3. Create barcode if available
            if shopify_product.shopify_barcode:
                SKUBarcode.objects.get_or_create(
                    company_id=shopify_product.store.company_id,
                    sku=sku,
                    barcode_value=shopify_product.shopify_barcode,
                    defaults={
                        'barcode_type': 'code128',
                        'is_primary': True,
                        'status': 'active'
                    }
                )
            
            # 4. Update the mapping
            shopify_product.erp_sku = sku
            shopify_product.erp_product = erp_product
            shopify_product.sync_status = 'synced'
            shopify_product.sync_error = ''
            shopify_product.save()
            
            return sku

    @staticmethod
    def sync_inventory(store: ShopifyStore) -> ShopifySyncJob:
        """Sync inventory levels from Shopify (creates its own job)."""
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='inventory',
            job_status='running'
        )
        ShopifyService._do_inventory_sync(store, job)
        return job

    @staticmethod
    def sync_inventory_delta(store: ShopifyStore) -> ShopifySyncJob:
        """Sync inventory levels ONLY for products that were recently modified."""
        # Check for already running job to avoid duplicates
        existing = ShopifySyncJob.objects.filter(store=store, job_type='inventory_delta', job_status='running').first()
        if existing:
            return existing

        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='inventory_delta',
            job_status='running'
        )
        ShopifyService._do_inventory_sync_delta(store, job)
        return job
    
    @staticmethod
    def _do_inventory_sync(store: ShopifyStore, job: ShopifySyncJob) -> None:
        """Execute the actual inventory sync. Can be called from a background thread."""
        try:
            client = ShopifyAPIClient(store)
            logger.info(f"Starting inventory sync for store {store.name}")
            locations = client.get_locations()
            
            total_processed = 0
            for location in locations:
                location_id = location['id']
                location_name = location['name']
                
                # Get inventory levels for this location
                inventory_levels = client.get_inventory_levels(
                    location_ids=str(location_id)
                )
                
                # Update total items as we discover them (unavoidable in full sync without pre-counting)
                job.total_items += len(inventory_levels)
                job.save(update_fields=['total_items'])
                
                for level in inventory_levels:
                    # Check for cancellation
                    if job.is_cancelled():
                        return

                    try:
                        ShopifyService._process_inventory_level(
                            store, location_id, location_name, level, job, 
                            save_job=False # Don't save inside the loop
                        )
                        total_processed += 1
                        
                        # Save progress every 20 items to reduce DB load
                        if total_processed % 20 == 0:
                            job.processed_items = total_processed
                            job.save(update_fields=['processed_items', 'failed_items'])
                            
                    except Exception as e:
                        logger.error(f"Error processing inventory level: {e}")
                        job.failed_items += 1
            
            job.processed_items = total_processed
            store.last_inventory_sync = timezone.now()
            store.save(update_fields=['last_inventory_sync', 'updated_at'])
            
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            job.save()
            
        except Exception as e:
            logger.error(f"Inventory sync failed: {e}")
            job.job_status = 'failed'
            job.error_log = f"Failed at {timezone.now()}: {str(e)}"
            job.completed_at = timezone.now()
            job.save()

    @staticmethod
    def _do_inventory_sync_delta(store: ShopifyStore, job: ShopifySyncJob) -> None:
        """Delta inventory sync: optimized and fixed progress bar."""
        try:
            client = ShopifyAPIClient(store)
            since = store.last_inventory_sync or (timezone.now() - timezone.timedelta(hours=24))
            
            # Get list of inventory_item_ids for products changed since 'since'
            changed_products = ShopifyProduct.objects.filter(
                store=store,
                last_synced_at__gte=since,
                status='active'
            ).values_list('shopify_inventory_item_id', flat=True).distinct()
            
            item_id_list = [str(iid) for iid in changed_products if iid]
            if not item_id_list:
                job.job_status = 'completed'
                job.completed_at = timezone.now()
                job.save()
                return

            locations = client.get_locations()
            location_map = {str(l['id']): l['name'] for l in locations}
            location_ids_str = ",".join(location_map.keys())

            # Set total items upfront to avoid the "jumping" behavior
            # Total = Number of Products * Number of Locations
            job.total_items = len(item_id_list) * len(locations)
            job.save(update_fields=['total_items'])
            
            total_processed = 0
            chunk_size = 50
            for i in range(0, len(item_id_list), chunk_size):
                chunk = item_id_list[i:i + chunk_size]
                ids_param = ",".join(chunk)
                
                # Fetch inventory levels for this chunk across ALL locations
                levels = client.get_inventory_levels(
                    location_ids=location_ids_str,
                    inventory_item_ids=ids_param
                )
                
                # Map results by (item_id, location_id)
                level_results = {}
                for lv in levels:
                    key = (str(lv['inventory_item_id']), str(lv['location_id']))
                    level_results[key] = lv

                # Now iterate through the theoretical items*locations
                for item_id in chunk:
                    for loc_id in location_map.keys():
                        if job.is_cancelled():
                            return
                        
                        level_data = level_results.get((item_id, loc_id))
                        if level_data:
                            try:
                                ShopifyService._process_inventory_level(
                                    store, int(loc_id), location_map[loc_id], level_data, job,
                                    save_job=False
                                )
                            except Exception:
                                job.failed_items += 1
                        
                        total_processed += 1
                        # Save progress every 50 "attempts"
                        if total_processed % 50 == 0:
                            job.processed_items = total_processed
                            job.save(update_fields=['processed_items', 'failed_items'])
            
            job.processed_items = total_processed
            store.last_inventory_sync = timezone.now()
            store.save(update_fields=['last_inventory_sync', 'updated_at'])
            
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            job.save()
            
        except Exception as e:
            logger.error(f"Delta inventory sync failed: {e}")
            job.job_status = 'failed'
            job.error_log = str(e)
            job.completed_at = timezone.now()
            job.save()

    @staticmethod
    def cleanup_deleted_products(store: ShopifyStore, job: Optional[ShopifySyncJob] = None) -> None:
        """
        Check all local ShopifyProduct mappings against Shopify and cleanup deleted ones.
        FAST VERSION: Fetches all active IDs from Shopify first.
        """
        logger.info(f"Starting FAST cleanup for store {store.name}")
        
        # If no job provided, create a maintenance job
        created_job = False
        if not job:
            job = ShopifySyncJob.objects.create(
                store=store,
                job_type='cleanup',
                job_status='running'
            )
            created_job = True

        try:
            client = ShopifyAPIClient(store)
            
            # 1. Fetch all products (with variants) from Shopify
            # This is much faster than one-by-one checks
            logger.info("Fetching all active products from Shopify to detect deletions...")
            shopify_products = client.get_all_products()
            
            # 2. Map existing (Product ID, Variant ID) into a set for fast lookup
            active_ids = set()
            for p in shopify_products:
                p_id = p['id']
                for v in p.get('variants', []):
                    active_ids.add((p_id, v['id']))
            
            logger.info(f"Found {len(active_ids)} active product-variant combinations on Shopify.")

            # 3. Find our local active mappings
            local_mappings = ShopifyProduct.objects.filter(store=store, status='active')
            job.total_items = local_mappings.count()
            job.save(update_fields=['total_items'])

            # 4. Resolve the correct location for this company
            shopify_wh = Location.objects.filter(code='SHOPIFY-WH', company=store.company).first()
            if not shopify_wh:
                logger.warning(f"No Location with code 'SHOPIFY-WH' found for company {store.company.name}. Deletions will not zero out inventory.")

            # 5. Compare and cleanup
            deleted_count = 0
            for sp in local_mappings:
                if job.is_cancelled():
                    return

                # Check if this specific mapping (Product+Variant) still exists
                if (sp.shopify_product_id, sp.shopify_variant_id) not in active_ids:
                    logger.info(f"Detected deleted item: {sp.shopify_title} (ID: {sp.shopify_product_id}, Var: {sp.shopify_variant_id})")
                    
                    # Mark as deleted
                    sp.status = 'deleted'
                    sp.sync_status = 'error'
                    sp.sync_error = 'Deleted on Shopify'
                    sp.save(update_fields=['status', 'sync_status', 'sync_error', 'updated_at'])
                    
                    # Zero out inventory in ERP
                    if sp.erp_sku and shopify_wh:
                        from apps.inventory.models import InventoryBalance
                        InventoryBalance.objects.filter(
                            sku=sp.erp_sku,
                            location=shopify_wh
                        ).update(quantity_on_hand=0, quantity_available=0)
                    
                    deleted_count += 1
                    job.updated_items += 1
                
                job.processed_items += 1
                if job.processed_items % 50 == 0:
                    job.save(update_fields=['processed_items', 'updated_items'])

            job.job_status = 'completed'
            job.completed_at = timezone.now()
            job.error_log = f"Fast cleanup complete. Detected and removed {deleted_count} items."
            job.save()
            logger.info(f"Cleanup complete for {store.name}. Deleted {deleted_count} stale mappings.")

        except Exception as e:
            logger.error(f"Fast cleanup failed for {store.name}: {e}")
            job.job_status = 'failed'
            job.error_log = str(e)
            job.completed_at = timezone.now()
            job.save()
            if created_job:
                raise # Re-raise if it's our own internal job call
    
    @staticmethod
    def _process_inventory_level(
        store: ShopifyStore,
        location_id: int,
        location_name: str,
        level_data: Dict,
        job: ShopifySyncJob,
        save_job: bool = True
    ) -> None:
        """Process a single inventory level."""
        inventory_item_id = level_data.get('inventory_item_id')
        available = level_data.get('available', 0) or 0
        
        # Find matching ShopifyProduct
        shopify_products = ShopifyProduct.objects.filter(
            store=store,
            shopify_inventory_item_id=inventory_item_id
        )
        
        if not shopify_products.exists():
            # Fallback to slower JSON search if needed
            all_products = ShopifyProduct.objects.filter(store=store)
            matched_pks = []
            for sp in all_products:
                variant_data = sp.shopify_data.get('variants', [])
                if isinstance(sp.shopify_data, dict) and sp.shopify_data.get('inventory_item_id') == inventory_item_id:
                     matched_pks.append(sp.pk)
                else:
                    for v in variant_data:
                        if v.get('inventory_item_id') == inventory_item_id:
                            matched_pks.append(sp.pk)
                            break
            shopify_products = ShopifyProduct.objects.filter(pk__in=matched_pks)

        for sp in shopify_products:
            if not sp.shopify_inventory_item_id:
                sp.shopify_inventory_item_id = inventory_item_id
                sp.save(update_fields=['shopify_inventory_item_id'])

            ShopifyInventoryLevel.objects.update_or_create(
                shopify_product=sp,
                shopify_location_id=location_id,
                defaults={
                    'store': store,
                    'shopify_location_name': location_name,
                    'available': available,
                    'on_hand': level_data.get('on_hand', available),
                    'committed': level_data.get('committed', 0) or 0,
                }
            )
            
            sp.shopify_inventory_quantity = available
            sp.save(update_fields=['shopify_inventory_quantity'])

            # Bridge: Sync into ERP InventoryBalance
            if sp.erp_sku_id:
                try:
                    from apps.inventory.models import InventoryBalance
                    from decimal import Decimal

                    shopify_location = Location.objects.filter(
                        company_id=store.company_id,
                        code='SHOPIFY-WH',
                    ).first()

                    if shopify_location:
                        from django.db.models import Sum
                        # Calculate buffer (Total on Shopify - sum of other warehouses)
                        other_qty = InventoryBalance.objects.filter(
                            company_id=store.company_id,
                            sku_id=sp.erp_sku_id,
                            status='active',
                            location__location_type='warehouse'
                        ).exclude(location=shopify_location).aggregate(total=Sum('quantity_available'))['total'] or 0
                        
                        target_total = Decimal(str(available or 0))
                        new_shopify_qty = target_total - Decimal(str(other_qty))

                        balance, _ = InventoryBalance.objects.get_or_create(
                            company_id=store.company_id,
                            sku_id=sp.erp_sku_id,
                            location=shopify_location,
                            condition=InventoryBalance.CONDITION_NEW,
                            defaults={
                                'quantity_on_hand': new_shopify_qty,
                                'quantity_reserved': Decimal('0'),
                                'quantity_available': new_shopify_qty,
                                'average_cost': Decimal('0'),
                            },
                        )

                        if not _:  # existing row
                            balance.quantity_on_hand = new_shopify_qty
                            balance.quantity_available = new_shopify_qty - balance.quantity_reserved
                            balance.save(update_fields=[
                                'quantity_on_hand', 'quantity_available',
                                'updated_at', 'version',
                            ])
                except Exception as e:
                    logger.warning(f"Failed to bridge InventoryBalance for {sp.erp_sku_id}: {e}")

            break # Only process one mapping per level
        
        if save_job:
            job.processed_items += 1
            job.save(update_fields=['processed_items', 'failed_items'])

    @staticmethod
    def push_sku_to_shopify(store: ShopifyStore, sku_id: str) -> Dict:
        """Push an ERP SKU to Shopify as a product/variant."""
        sku = SKU.objects.select_related('product').get(id=sku_id)
        client = ShopifyAPIClient(store)
        
        # 1. Check if this specific SKU is already mapped
        existing = ShopifyProduct.objects.filter(
            store=store,
            erp_sku=sku
        ).first()
        
        if existing and existing.shopify_product_id:
            try:
                # Update existing Shopify product/variant
                variant_data = {
                    'id': existing.shopify_variant_id,
                    'sku': sku.code,
                    'price': str(sku.base_price),
                    'inventory_management': 'shopify',
                }
                if sku.size:
                    variant_data['option1'] = sku.size
    
                # Update product with variant only
                product_data = {
                    'id': existing.shopify_product_id,
                    'variants': [variant_data]
                }
    
                result = client.update_product(existing.shopify_product_id, product_data)
                
                existing.shopify_price = sku.base_price
                existing.shopify_sku = sku.code
                existing.shopify_data = result
                existing.sync_status = 'synced'
                existing.last_synced_at = timezone.now()
                existing.save()
                
                return {
                    'action': 'updated',
                    'shopify_product_id': result.get('id'),
                    'message': f'Updated variant {sku.code} on Shopify product {result.get("id")}'
                }
            except Exception as e:
                if hasattr(e, 'response') and e.response.status_code == 404:
                    import logging
                    log = logging.getLogger(__name__)
                    log.warning(f"Shopify product {existing.shopify_product_id} not found. Deleting stale mapping and recreating.")
                    existing.delete()
                    existing = None
                else:
                    raise

        # 2. Check if another SKU from the same ERP Product is already mapped
        # to a Shopify Product in this store.
        product_mapping = ShopifyProduct.objects.filter(
            store=store,
            erp_product=sku.product,
            shopify_product_id__isnull=False
        ).first()

        barcode_value = ''
        try:
            from apps.mdm.models import SKUBarcode
            barcode = SKUBarcode.objects.filter(
                sku=sku, is_primary=True, status='active'
            ).first()
            if barcode:
                barcode_value = barcode.barcode_value
        except Exception:
            pass

        if product_mapping:
            # Add this SKU as a new variant to the existing Shopify product
            shopify_product_id = product_mapping.shopify_product_id
            
            variant_data = {
                'sku': sku.code,
                'price': str(sku.base_price),
                'barcode': barcode_value,
                'inventory_management': 'shopify',
                'weight': float(sku.weight) if sku.weight else 0,
                'weight_unit': 'kg',
            }
            if sku.size:
                variant_data['option1'] = sku.size
            
            try:
                # Add variant to product
                variant_res = client.create_variant(shopify_product_id, variant_data)
                
                # Fetch full product to have consistent shopify_data
                full_product = client.get_product(shopify_product_id)
                
                # Create mapping for this SKU
                ShopifyProduct.objects.create(
                    store=store,
                    shopify_product_id=shopify_product_id,
                    shopify_variant_id=variant_res['id'],
                    shopify_inventory_item_id=variant_res.get('inventory_item_id'),
                    shopify_title=product_mapping.shopify_title,
                    shopify_sku=sku.code,
                    shopify_barcode=barcode_value,
                    shopify_price=sku.base_price,
                    shopify_inventory_quantity=0,
                    shopify_data=full_product, 
                    erp_product=sku.product,
                    erp_sku=sku,
                    sync_status='synced',
                    last_synced_at=timezone.now(),
                )
                
                return {
                    'action': 'variant_added',
                    'shopify_product_id': shopify_product_id,
                    'message': f'Added SKU {sku.code} as variant to Shopify product {shopify_product_id}'
                }
            except Exception as e:
                if hasattr(e, 'response') and e.response.status_code == 404:
                    import logging
                    log = logging.getLogger(__name__)
                    log.warning(f"Shopify product {shopify_product_id} not found when adding variant. Deleting ALL stale mappings for this product.")
                    ShopifyProduct.objects.filter(store=store, shopify_product_id=shopify_product_id).delete()
                    # Fall through to step 3 to recreate the entire product
                else:
                    logger.error(f"Failed to add variant {sku.code} to Shopify product {shopify_product_id}: {e}")
                    raise

        # 3. Create new product on Shopify
        product_data = {
            'title': sku.product.name,
            'body_html': sku.product.description or '',
            'variants': [{
                'sku': sku.code,
                'price': str(sku.base_price),
                'barcode': barcode_value,
                'inventory_management': 'shopify',
                'weight': float(sku.weight) if sku.weight else 0,
                'weight_unit': 'kg',
            }]
        }

        # Add image if available
        if sku.product.image:
            try:
                import base64
                with sku.product.image.open('rb') as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                    product_data['images'] = [{
                        'attachment': encoded_string,
                        'filename': f"{sku.code}.jpg"
                    }]
            except Exception as e:
                logger.error(f"Failed to encode product image for Shopify: {e}")
        
        # Add size as option if present
        if sku.size:
            product_data['options'] = [{'name': 'Size'}]
            product_data['variants'][0]['option1'] = sku.size
        
        result = client.create_product(product_data)
        
        # Create mapping
        variant = result.get('variants', [{}])[0] if result.get('variants') else {}
        
        ShopifyProduct.objects.create(
            store=store,
            shopify_product_id=result['id'],
            shopify_variant_id=variant.get('id'),
            shopify_inventory_item_id=variant.get('inventory_item_id'),
            shopify_title=result.get('title', ''),
            shopify_sku=sku.code,
            shopify_barcode=barcode_value,
            shopify_price=sku.base_price,
            shopify_inventory_quantity=0,
            shopify_data=result,
            erp_product=sku.product,
            erp_sku=sku,
            sync_status='synced',
            last_synced_at=timezone.now(),
        )

        # ── Assign to Shopify Collection (purely additive via Collects API) ──
        try:
            collection = getattr(sku.product, 'shopify_collection', None)
            if collection and collection.shopify_collection_id:
                client.add_product_to_collection(
                    shopify_product_id=result['id'],
                    shopify_collection_id=collection.shopify_collection_id
                )
                logger.info(f"Assigned product {result['id']} to collection '{collection.title}'")
        except Exception as e:
            # Non-fatal: collection assignment failure should not break the product push
            logger.warning(f"Could not assign product to collection: {e}")
        
        return {
            'action': 'created',
            'shopify_product_id': result.get('id'),
            'collection_assigned': getattr(getattr(sku.product, 'shopify_collection', None), 'title', None),
            'message': f'Created product {sku.code} on Shopify'
        }

    @staticmethod
    def sync_collections(store: ShopifyStore, job: Optional[ShopifySyncJob] = None) -> Dict:
        """
        Fetch all Shopify collections (custom + smart) and store them in ERP.
        READ-ONLY from Shopify — only writes to the local ShopifyCollection table.
        """
        from .shopify_models import ShopifyCollection
        client = ShopifyAPIClient(store)
        created = 0
        updated = 0

        try:
            if job:
                job.job_status = 'running'
                job.save(update_fields=['job_status'])

            # Fetch custom collections
            custom = client.get_custom_collections()
            if job:
                job.total_items = len(custom)
                job.save(update_fields=['total_items'])

            for col in custom:
                if job and job.is_cancelled():
                    break
                obj, is_new = ShopifyCollection.objects.update_or_create(
                    store=store,
                    shopify_collection_id=col['id'],
                    defaults={
                        'title': col.get('title', ''),
                        'handle': col.get('handle', ''),
                        'collection_type': ShopifyCollection.COLLECTION_TYPE_CUSTOM,
                        'is_active': True,
                    }
                )
                if is_new:
                    created += 1
                else:
                    updated += 1
                
                if job:
                    job.processed_items += 1
                    if is_new:
                        job.created_items += 1
                    else:
                        job.updated_items += 1
                    if job.processed_items % 50 == 0:
                        job.save(update_fields=['processed_items', 'created_items', 'updated_items'])

            # Fetch smart collections
            smart = client.get_smart_collections()
            if job:
                job.total_items += len(smart)
                job.save(update_fields=['total_items'])

            for col in smart:
                if job and job.is_cancelled():
                    break
                obj, is_new = ShopifyCollection.objects.update_or_create(
                    store=store,
                    shopify_collection_id=col['id'],
                    defaults={
                        'title': col.get('title', ''),
                        'handle': col.get('handle', ''),
                        'collection_type': ShopifyCollection.COLLECTION_TYPE_SMART,
                        'is_active': True,
                    }
                )
                if is_new:
                    created += 1
                else:
                    updated += 1

                if job:
                    job.processed_items += 1
                    if is_new:
                        job.created_items += 1
                    else:
                        job.updated_items += 1
                    if job.processed_items % 50 == 0:
                        job.save(update_fields=['processed_items', 'created_items', 'updated_items'])

            if job:
                job.job_status = 'completed' if not job.is_cancelled() else 'cancelled'
                job.completed_at = timezone.now()
                job.save()

        except Exception as e:
            logger.error(f"Sync collections failed for {store.name}: {e}")
            if job:
                job.job_status = 'failed'
                job.error_log = str(e)
                job.completed_at = timezone.now()
                job.save()
            raise e

        logger.info(f"Synced collections for store {store.name}: {created} created, {updated} updated")
        return {'created': created, 'updated': updated, 'total': created + updated}

    @staticmethod
    def backfill_collections(store: ShopifyStore, job: Optional[ShopifySyncJob] = None) -> Dict:
        """
        Scan all ERP Products with an assigned shopify_collection and ensure they 
        are linked in Shopify via the Collects API.
        Additive operation: if already in collection, Shopify might return error, which we handle.
        """
        from apps.mdm.models import Product
        from .shopify_models import ShopifyProduct
        
        products = Product.objects.filter(shopify_collection__isnull=False)
        client = ShopifyAPIClient(store)
        processed = 0
        total_eligible = products.count()

        if job:
            job.job_status = 'running'
            job.total_items = total_eligible
            job.save(update_fields=['job_status', 'total_items'])
        
        try:
            for product in products:
                if job and job.is_cancelled():
                    break
                    
                # Find any shopify mapping for this product
                mapping = ShopifyProduct.objects.filter(store=store, erp_product=product).first()
                if mapping and mapping.shopify_product_id:
                    try:
                        client.add_product_to_collection(
                            shopify_product_id=mapping.shopify_product_id,
                            shopify_collection_id=product.shopify_collection.shopify_collection_id
                        )
                        processed += 1
                        if job:
                            job.processed_items += 1
                            job.updated_items += 1
                    except Exception as e:
                        logger.warning(f"Backfill error for product {product.name}: {e}")
                        if job:
                            job.failed_items += 1
                            job.error_log += f"\nError for {product.name}: {str(e)}"
                
                if job and job.processed_items % 10 == 0:
                    job.save(update_fields=['processed_items', 'updated_items', 'failed_items', 'error_log'])

            if job:
                job.job_status = 'completed' if not job.is_cancelled() else 'cancelled'
                job.completed_at = timezone.now()
                job.save()

        except Exception as e:
            logger.error(f"Backfill collections failed for {store.name}: {e}")
            if job:
                job.job_status = 'failed'
                job.error_log = str(e)
                job.completed_at = timezone.now()
                job.save()
            raise e
        
        return {'processed': processed, 'total_eligible': total_eligible}

    @staticmethod
    def sync_collection_memberships(store: ShopifyStore, job: Optional[ShopifySyncJob] = None) -> Dict:
        """
        Pulls collection memberships from Shopify and updates ERP Products.
        Includes support for:
        1. Custom Collections (Collects API)
        2. Smart Collections (Product Listing API)
        3. Shopify Taxonomy Categories (from product.category)
        4. Custom Metafields (e.g. custom.categories)
        """
        from .shopify_models import ShopifyCollection, ShopifyProduct
        from apps.mdm.models import Product
        import json
        client = ShopifyAPIClient(store)
        updated_count = 0
        meta_cache = {} # product_id -> metafields list
        
        try:
            if job:
                job.job_status = 'running'
                job.save(update_fields=['job_status'])

            # 1. Fetch all custom collection memberships (collects)
            logger.info(f"Fetching collects for {store.name}...")
            collects = client.get_collects()
            
            # Map shopify_collection_id to our local ShopifyCollection obj
            collections_map = {c.shopify_collection_id: c for c in ShopifyCollection.objects.filter(store=store)}
            
            # Group collects by product_id
            product_to_collections = defaultdict(list)
            for col in collects:
                product_to_collections[col['product_id']].append(col['collection_id'])

            # 2. Handle Smart Collections
            smart_collections = ShopifyCollection.objects.filter(store=store, collection_type=ShopifyCollection.COLLECTION_TYPE_SMART)
            for sc in smart_collections:
                if job and job.is_cancelled():
                    break
                logger.info(f"Fetching products for smart collection: {sc.title}")
                products_in_smart = client.get_products_by_collection(sc.shopify_collection_id)
                for p in products_in_smart:
                    product_to_collections[p['id']].append(sc.shopify_collection_id)

            # 3. Fetch all mapped ShopifyProducts to process virtual collections and ERP links
            # We iterate through all mapped products to ensure Taxonomy and Metafields are respected
            mappings = ShopifyProduct.objects.filter(store=store).select_related('erp_product').exclude(erp_product=None)
            
            if job:
                job.total_items = mappings.count()
                job.save(update_fields=['total_items'])

            for mapping in mappings:
                if job and job.is_cancelled():
                    break
                
                erp_product = mapping.erp_product
                shopify_product_id = mapping.shopify_product_id
                data = mapping.shopify_data
                
                # Collection candidates for this product
                candidate_ids = product_to_collections.get(shopify_product_id, [])
                candidate_objs = [collections_map[cid] for cid in candidate_ids if cid in collections_map]
                
                # Check for Shopify Taxonomy Category
                category_data = data.get('category')
                if category_data and isinstance(category_data, dict) and category_data.get('name'):
                    cat_name = category_data['name']
                    v_col = ShopifyService.get_or_create_virtual_collection(store, cat_name)
                    candidate_objs.append(v_col)
                
                # Check for "maternity dresses" or similar in Product Type if no collection yet
                if not candidate_objs and data.get('product_type'):
                    pt = data.get('product_type')
                    if pt:
                        v_col = ShopifyService.get_or_create_virtual_collection(store, pt)
                        candidate_objs.append(v_col)

                # Optional: Fetch metafields for "categories"
                # To speed up, we only fetch if the product has none or we specifically need them
                # But for this task, the user emphasized category metafields.
                if 'categories' not in json.dumps(data):
                    # We fetch and update the shopify_data if needed
                    try:
                        metafields = ShopifyService._fetch_metafields_cached(client, shopify_product_id, meta_cache)
                        if metafields:
                            data['metafields'] = metafields
                            mapping.shopify_data = data
                            mapping.save(update_fields=['shopify_data'])
                            # Look for 'categories' metafield
                            for m in metafields:
                                if m.get('key') == 'categories' and m.get('value'):
                                    try:
                                        # Value is often a JSON list like '["Feeding"]'
                                        cats = json.loads(m['value'])
                                        if isinstance(cats, list):
                                            for c_name in cats:
                                                v_col = ShopifyService.get_or_create_virtual_collection(store, str(c_name))
                                                candidate_objs.append(v_col)
                                    except:
                                        # Fallback for plain string
                                        v_col = ShopifyService.get_or_create_virtual_collection(store, str(m['value']))
                                        candidate_objs.append(v_col)
                    except Exception as e:
                        logger.error(f"Failed to fetch metafields for {shopify_product_id}: {e}")

                # Selection logic: pick the first one from candidates
                # Usually we prefer Custom/Smart collections over virtual ones if they exist
                target_collection = None
                if candidate_objs:
                    # Sort by type: custom first, then smart, then virtual
                    candidate_objs.sort(key=lambda x: (0 if x.collection_type == 'custom' else (1 if x.collection_type == 'smart' else 2)))
                    target_collection = candidate_objs[0]

                if target_collection and erp_product.shopify_collection_id != target_collection.id:
                    erp_product.shopify_collection = target_collection
                    erp_product.save(update_fields=['shopify_collection', 'updated_at'])
                    updated_count += 1
                    if job:
                        job.updated_items += 1

                if job:
                    job.processed_items += 1
                    if job.processed_items % 50 == 0:
                        job.save(update_fields=['processed_items', 'updated_items'])

            if job:
                job.job_status = 'completed' if not job.is_cancelled() else 'cancelled'
                job.completed_at = timezone.now()
                job.save()
            
            return {'updated': updated_count}

        except Exception as e:
            logger.error(f"Sync collection memberships failed: {e}")
            if job:
                job.job_status = 'failed'
                job.error_log = str(e)
                job.completed_at = timezone.now()
                job.save()
            raise e

        except Exception as e:
            logger.error(f"Sync collection memberships failed for {store.name}: {e}")
            if job:
                job.job_status = 'failed'
                job.error_log = str(e)
                job.completed_at = timezone.now()
                job.save()
            raise e

        return {'updated': updated_count}

    @staticmethod
    def push_inventory_to_shopify(
        store: ShopifyStore,
        sku_id: str,
        quantity: int,
        location_id: Optional[int] = None
    ) -> Dict:
        """Push inventory level from ERP to Shopify."""
        client = ShopifyAPIClient(store)
        
        # Find Shopify mapping
        mapping = ShopifyProduct.objects.filter(
            store=store,
            erp_sku_id=sku_id,
            sync_status='synced'
        ).first()
        
        if not mapping:
            raise ValueError(f"SKU {sku_id} is not mapped to a Shopify product.")
        
        # Use our new field if available, otherwise fallback to old logic
        inventory_item_id = mapping.shopify_inventory_item_id
        
        if not inventory_item_id:
            # Fallback: Get the inventory_item_id from variant data
            variant_data = mapping.shopify_data.get('variants', [])
            for v in variant_data:
                if v.get('id') == mapping.shopify_variant_id:
                    inventory_item_id = v.get('inventory_item_id')
                    break
            
            if not inventory_item_id:
                # Still not found? Fetch from Shopify
                product = client.get_product(mapping.shopify_product_id)
                variants = product.get('variants', [])
                for v in variants:
                    if v.get('id') == mapping.shopify_variant_id:
                        inventory_item_id = v.get('inventory_item_id')
                        break
                
                # Update mapping with inventory_item_id for next time
                if inventory_item_id:
                    mapping.shopify_inventory_item_id = inventory_item_id
                    mapping.save(update_fields=['shopify_inventory_item_id'])
        
        if not inventory_item_id:
            raise ValueError(f"Could not determine inventory_item_id for SKU {sku_id}")
        
        # If no location specified, try to find where this item is already tracked on Shopify
        if not location_id:
            try:
                levels = client.get_inventory_levels(inventory_item_ids=str(inventory_item_id))
                if levels:
                    # Use the first location where this item is already active
                    location_id = levels[0]['location_id']
                    logger.info(f"Auto-selected Shopify location {location_id} for SKU {mapping.shopify_sku} based on existing levels.")
                else:
                    # Fallback to the first location found on the store
                    locations = client.get_locations()
                    if locations:
                        location_id = locations[0]['id']
                        logger.warning(f"SKU {mapping.shopify_sku} not tracked anywhere. Defaulting to first location: {location_id}")
                    else:
                        raise ValueError("No Shopify locations found.")
            except Exception as e:
                logger.error(f"Failed to resolve Shopify location for SKU {mapping.shopify_sku}: {e}")
                raise
        
        try:
            # Set inventory level
            result = client.set_inventory_level(inventory_item_id, location_id, quantity)
        except Exception as e:
            if hasattr(e, 'response') and e.response.status_code == 404:
                import logging
                log = logging.getLogger(__name__)
                log.warning(f"Inventory item {inventory_item_id} or location {location_id} not found on Shopify. Deleting stale mapping.")
                mapping.delete()
                raise ValueError("Mapping was pointing to a deleted or inaccessible Shopify ghost product. It has been removed.")
            else:
                raise
        
        # Update cached quantity in mapping
        mapping.shopify_inventory_quantity = result.get('available', quantity)
        mapping.last_synced_at = timezone.now()
        mapping.save(update_fields=['shopify_inventory_quantity', 'last_synced_at'])
        
        return {
            'success': True,
            'inventory_item_id': inventory_item_id,
            'location_id': location_id,
            'available': result.get('available', quantity),
            'message': f'Inventory set to {quantity} for SKU {mapping.shopify_sku}'
        }
    
    @staticmethod
    def setup_webhooks(store: ShopifyStore, base_url: str) -> List[ShopifyWebhook]:
        """Setup Shopify webhooks."""
        client = ShopifyAPIClient(store)
        
        # Define webhooks to create
        webhook_topics = [
            'products/create',
            'products/update',
            'products/delete',
            'inventory_levels/update',
            'orders/create',
            'orders/updated',
        ]
        
        created_webhooks = []
        
        for topic in webhook_topics:
            address = f"{base_url}/api/integrations/shopify/webhook/{store.id}/"
            
            try:
                # Check if webhook already exists
                existing = ShopifyWebhook.objects.filter(
                    store=store,
                    topic=topic
                ).first()
                
                if not existing:
                    # Create webhook in Shopify
                    webhook_data = client.create_webhook(topic, address)
                    
                    # Save to database
                    webhook = ShopifyWebhook.objects.create(
                        store=store,
                        shopify_webhook_id=webhook_data['id'],
                        topic=topic,
                        address=address
                    )
                    created_webhooks.append(webhook)
                    logger.info(f"Created webhook: {topic}")
                else:
                    created_webhooks.append(existing)
                    
            except Exception as e:
                logger.error(f"Failed to create webhook {topic}: {e}")
        
        return created_webhooks
    
    @staticmethod
    @transaction.atomic
    def process_webhook(store: ShopifyStore, topic: str, payload: Dict, headers: Dict) -> None:
        """Process incoming webhook."""
        # Log webhook
        log = ShopifyWebhookLog.objects.create(
            store=store,
            topic=topic,
            shopify_id=payload.get('id'),
            payload=payload,
            headers=headers
        )
        
        try:
            # Route to appropriate handler
            if topic.startswith('products/'):
                ShopifyService._handle_product_webhook(store, topic, payload)
            elif topic.startswith('inventory_levels/'):
                ShopifyService._handle_inventory_webhook(store, topic, payload)
            elif topic.startswith('orders/'):
                ShopifyService._handle_order_webhook(store, topic, payload)
            
            log.processed = True
            log.processed_at = timezone.now()
            log.save()
            
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")
            log.error = str(e)
            log.save()
            raise
    
    @staticmethod
    def _handle_product_webhook(store: ShopifyStore, topic: str, payload: Dict) -> None:
        """Handle product webhooks."""
        if topic == 'products/delete':
            # Mark as deleted and zero out inventory in ERP
            product_id = payload['id']
            mappings = ShopifyProduct.objects.filter(
                store=store,
                shopify_product_id=product_id,
                status='active'
            )
            
            shopify_wh = Location.objects.filter(code='SHOPIFY-WH').first()
            
            for sp in mappings:
                if sp.erp_sku and shopify_wh:
                    # Clean up ERP warehouse balance
                    InventoryBalance.objects.filter(
                        sku=sp.erp_sku,
                        location=shopify_wh
                    ).update(quantity_on_hand=0, quantity_available=0)
                
                sp.status = 'deleted'
                sp.save(update_fields=['status', 'updated_at'])
        else:
            # Create or update
            job = ShopifySyncJob.objects.create(
                store=store,
                job_type='products',
                job_status='running',
                total_items=1
            )
            ShopifyService._process_product(store, payload, job)
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            job.save()
    
    @staticmethod
    def _handle_inventory_webhook(store: ShopifyStore, topic: str, payload: Dict) -> None:
        """Handle inventory level update webhooks with efficient lookup and ERP bridge."""
        inventory_item_id = payload.get('inventory_item_id')
        location_id = payload.get('location_id')
        available = payload.get('available', 0)
        
        if not inventory_item_id:
            return
        
        # Fast lookup using indexed field
        shopify_products = ShopifyProduct.objects.filter(
            store=store, 
            shopify_inventory_item_id=inventory_item_id
        )
        
        if not shopify_products.exists():
            # Fallback for old records without the field populated
            mappings = ShopifyProduct.objects.filter(store=store)
            matched_pks = []
            for sp in mappings:
                variants = sp.shopify_data.get('variants', [])
                for v in variants:
                    if v.get('inventory_item_id') == inventory_item_id:
                        matched_pks.append(sp.pk)
                        break
            shopify_products = ShopifyProduct.objects.filter(pk__in=matched_pks)

        for sp in shopify_products:
            # Sync to local ShopifyInventoryLevel
            ShopifyInventoryLevel.objects.update_or_create(
                shopify_product=sp,
                shopify_location_id=location_id,
                defaults={
                    'store': store,
                    'available': available or 0,
                    'on_hand': payload.get('on_hand', available) or 0,
                    'last_synced_at': timezone.now()
                }
            )
            
            sp.shopify_inventory_quantity = available or 0
            # Ensure the ID is saved for next time's fast lookup
            sp.shopify_inventory_item_id = inventory_item_id
            sp.save(update_fields=['shopify_inventory_quantity', 'shopify_inventory_item_id', 'updated_at'])
            
            # ── BRIDGE TO ERP WAREHOUSE ──
            if sp.erp_sku:
                try:
                    from apps.inventory.models import InventoryBalance
                    from django.db.models import Sum
                    from decimal import Decimal
                    
                    # Target the "Shopify Online" warehouse in ERP
                    shopify_wh = Location.objects.filter(
                        company_id=store.company_id,
                        code='SHOPIFY-WH'
                    ).first()
                    
                    if shopify_wh:
                        # Calculate sum of other WAREHOUSES only (exclude stores/offices)
                        other_qty = InventoryBalance.objects.filter(
                            company_id=store.company_id,
                            sku=sp.erp_sku,
                            status='active',
                            location__location_type='warehouse'
                        ).exclude(location=shopify_wh).aggregate(total=Sum('quantity_available'))['total'] or 0
                        
                        # We want the Global Sum to match exactly what's on Shopify (available)
                        target_total = Decimal(str(available or 0))
                        
                        # Therefore, SHOPIFY-WH acts as the balance buffer
                        new_shopify_qty = target_total - Decimal(str(other_qty))
                        
                        balance, _ = InventoryBalance.objects.get_or_create(
                            company_id=store.company_id,
                            sku=sp.erp_sku,
                            location=shopify_wh,
                            condition=InventoryBalance.CONDITION_NEW,
                            defaults={
                                'quantity_on_hand': new_shopify_qty,
                                'quantity_available': new_shopify_qty,
                            }
                        )
                        
                        # Only update and trigger signal if it ACTUALLY changed.
                        # The signal will now skip the push-back thanks to 'is_syncing()' context.
                        if not _ and balance.quantity_available != new_shopify_qty:
                            balance.quantity_on_hand = new_shopify_qty
                            balance.quantity_available = new_shopify_qty - balance.quantity_reserved
                            balance.save(update_fields=['quantity_on_hand', 'quantity_available', 'updated_at'])
                            
                except Exception as e:
                    logger.warning(f"Failed to bridge inventory webhook to ERP: {e}")
            break # Usually one mapping per inventory item
    
    @staticmethod
    def sync_orders(store: ShopifyStore, start_date: Optional[str] = None, end_date: Optional[str] = None) -> ShopifySyncJob:
        """
        Sync orders from Shopify to ERP.
        Optionally filter by date range (ISO strings).
        """
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='orders',
            job_status='running',
            error_log=f"Range: {start_date or 'All'} to {end_date or 'Now'}"
        )
        try:
            client = ShopifyAPIClient(store)
            
            # Prepare ISO strings for Shopify API
            created_at_min = None
            if start_date:
                created_at_min = f"{start_date}T00:00:00Z"
            
            created_at_max = None
            if end_date:
                created_at_max = f"{end_date}T23:59:59Z"

            orders = client.get_all_orders(created_at_min=created_at_min, created_at_max=created_at_max)
            job.total_items = len(orders)
            job.save(update_fields=['total_items'])
            
            for order_data in orders:
                try:
                    ShopifyService._process_order(store, order_data)
                    job.processed_items += 1
                except Exception as e:
                    logger.error(f"Error processing order {order_data.get('id')}: {e}")
                    job.failed_items += 1
                
                if job.processed_items % 10 == 0:
                    job.save(update_fields=['processed_items', 'failed_items'])
                
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            store.last_order_sync = timezone.now()
            store.save(update_fields=['last_order_sync'])
        except Exception as e:
            logger.error(f"Order sync failed: {e}")
            job.job_status = 'failed'
            job.error_log = f"{job.error_log}\nError: {str(e)}"
            job.completed_at = timezone.now()
        
        job.save()
        return job

    @staticmethod
    def sync_draft_orders(store: ShopifyStore) -> ShopifySyncJob:
        """Sync draft orders (quotations)."""
        job = ShopifySyncJob.objects.create(store=store, job_type='draft_orders', job_status='running')
        try:
            client = ShopifyAPIClient(store)
            drafts = client.get_draft_orders()
            job.total_items = len(drafts)
            job.save()
            for draft_data in drafts:
                ShopifyService._process_draft_order(store, draft_data)
                job.processed_items += 1
                job.save()
            job.job_status = 'completed'
        except Exception as e:
            job.job_status = 'failed'
            job.error_log = str(e)
        job.save()
        return job

    @staticmethod
    def sync_discounts(store: ShopifyStore) -> ShopifySyncJob:
        """Sync price rules and discount codes."""
        job = ShopifySyncJob.objects.create(store=store, job_type='discounts', job_status='running')
        try:
            client = ShopifyAPIClient(store)
            rules = client.get_price_rules()
            job.total_items = len(rules)
            job.save()
            for rule in rules:
                ShopifyDiscount.objects.update_or_create(
                    store=store,
                    shopify_id=rule['id'],
                    defaults={
                        'code': rule.get('title', ''),
                        'type': 'price_rule',
                        'value': abs(float(rule.get('value', 0))),
                        'value_type': rule.get('value_type', 'fixed_amount'),
                        'starts_at': rule.get('starts_at'),
                        'ends_at': rule.get('ends_at'),
                        'shopify_data': rule
                    }
                )
                job.processed_items += 1
                job.save()
            job.job_status = 'completed'
        except Exception as e:
            job.job_status = 'failed'
            job.error_log = str(e)
        job.save()
        return job

    @staticmethod
    @transaction.atomic
    def _process_order(store: ShopifyStore, order_data: Dict) -> ShopifyOrder:
        """Process a Shopify order and link it to an ERP Document."""
        order_id = order_data['id']
        
        # Get or create ShopifyOrder
        s_order, created = ShopifyOrder.objects.update_or_create(
            shopify_order_id=order_id,
            defaults={
                'store': store,
                'order_number': order_data.get('order_number', ''),
                'order_status': order_data.get('status', 'open'),
                'financial_status': order_data.get('financial_status', ''),
                'fulfillment_status': order_data.get('fulfillment_status', ''),
                'total_price': order_data.get('total_price', 0),
                'currency': order_data.get('currency', 'INR'),
                'customer_name': f"{order_data.get('customer', {}).get('first_name', '')} {order_data.get('customer', {}).get('last_name', '')}".strip(),
                'customer_email': order_data.get('customer', {}).get('email', ''),
                'shopify_data': order_data,
                'processed_at': order_data.get('created_at')
            }
        )
        
        # ERP document mapping removed as documents app was uninstalled
        return s_order

    @staticmethod
    def _process_draft_order(store: ShopifyStore, draft_data: Dict) -> ShopifyDraftOrder:
        """Process a Shopify draft order."""
        draft, _ = ShopifyDraftOrder.objects.update_or_create(
            shopify_draft_order_id=draft_data['id'],
            defaults={
                'store': store,
                'status': draft_data.get('status', 'open'),
                'total_price': draft_data.get('total_price', 0),
                'shopify_data': draft_data
            }
        )
        return draft

    @staticmethod
    def _handle_order_webhook(store: ShopifyStore, topic: str, payload: Dict) -> None:
        """Handle order webhooks by processing the order."""
        logger.info(f"Order webhook received: {topic}, Order ID: {payload.get('id')}")
        ShopifyService._process_order(store, payload)
