"""
Shopify Integration Service.
Handles API calls, data sync, and webhook processing.
"""
import requests
import time
from typing import Dict, List, Optional, Any
from django.db import transaction
from django.utils import timezone
from .shopify_models import (
    ShopifyStore, ShopifyProduct, ShopifyInventoryLevel,
    ShopifyWebhook, ShopifyWebhookLog, ShopifySyncJob,
    ShopifyOrder, ShopifyDraftOrder, ShopifyDiscount, ShopifyGiftCard
)
from apps.mdm.models import Product, SKU, Location, Customer
from apps.documents.models import Document, DocumentType, DocumentLine
import logging

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
    
    def get_products(self, limit: int = 250, since_id: Optional[int] = None, page_info: Optional[str] = None) -> Dict:
        """Get products from Shopify with pagination support."""
        params = {'limit': limit}
        if since_id:
            params['since_id'] = since_id
        if page_info:
            params = {'limit': limit, 'page_info': page_info}
        
        response = self._make_request('GET', 'products.json', params=params)
        return response
    
    def get_all_products(self) -> List[Dict]:
        """Get ALL products from Shopify using pagination."""
        all_products = []
        params = {'limit': 250}
        
        while True:
            response = self._make_request('GET', 'products.json', params=params)
            products = response.get('products', [])
            all_products.extend(products)
            
            if len(products) < 250:
                break
            
            # Use since_id pagination
            last_id = products[-1]['id']
            params = {'limit': 250, 'since_id': last_id}
            time.sleep(0.5)  # Be gentle with rate limits
        
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

    def get_orders(self, status_filter: str = 'any', limit: int = 250) -> List[Dict]:
        """Get orders from Shopify."""
        params = {'status': status_filter, 'limit': limit}
        response = self._make_request('GET', 'orders.json', params=params)
        return response.get('orders', [])

    def get_all_orders(self) -> List[Dict]:
        """Get ALL orders using pagination."""
        all_orders = []
        params = {'limit': 250, 'status': 'any'}
        while True:
            response = self._make_request('GET', 'orders.json', params=params)
            orders = response.get('orders', [])
            all_orders.extend(orders)
            if len(orders) < 250: break
            params['since_id'] = orders[-1]['id']
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
                    'shopify_sku': variant.get('sku', ''),
                    'shopify_barcode': variant.get('barcode', ''),
                    'shopify_price': variant.get('price'),
                    'shopify_inventory_quantity': variant.get('inventory_quantity', 0),
                    'shopify_product_type': shopify_data.get('product_type', ''),
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
                shopify_product.shopify_sku = variant.get('sku', '')
                shopify_product.shopify_barcode = variant.get('barcode', '')
                shopify_product.shopify_price = variant.get('price')
                shopify_product.shopify_inventory_quantity = variant.get('inventory_quantity', 0)
                shopify_product.shopify_product_type = shopify_data.get('product_type', '')
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
            job.save(update_fields=['processed_items', 'created_items', 'updated_items', 'failed_items'])
    
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
    def _do_inventory_sync(store: ShopifyStore, job: ShopifySyncJob) -> None:
        """Execute the actual inventory sync. Can be called from a background thread."""
        try:
            client = ShopifyAPIClient(store)
            logger.info(f"Starting inventory sync for store {store.name} at {client.base_url}")
            locations = client.get_locations()
            logger.info(f"Found {len(locations)} Shopify locations")
            
            total_processed = 0
            for location in locations:
                location_id = location['id']
                location_name = location['name']
                
                # Get inventory levels for this location
                inventory_levels = client.get_inventory_levels(
                    location_ids=str(location_id)
                )
                
                job.total_items += len(inventory_levels)
                job.save(update_fields=['total_items'])
                
                for level in inventory_levels:
                    try:
                        ShopifyService._process_inventory_level(
                            store, location_id, location_name, level, job
                        )
                        total_processed += 1
                        
                        # Save progress every 10 items
                        if total_processed % 10 == 0:
                            job.save(update_fields=['processed_items', 'failed_items'])
                            
                    except Exception as e:
                        logger.error(f"Error processing inventory level: {e}")
                        job.failed_items += 1
            
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
    def _process_inventory_level(
        store: ShopifyStore,
        location_id: int,
        location_name: str,
        level_data: Dict,
        job: ShopifySyncJob
    ) -> None:
        """Process a single inventory level."""
        inventory_item_id = level_data.get('inventory_item_id')
        available = level_data.get('available', 0) or 0
        
        # Find matching ShopifyProduct by looking up the variant's inventory_item_id
        # Shopify variants have an inventory_item_id field in the full product data
        shopify_products = ShopifyProduct.objects.filter(store=store)
        
        for sp in shopify_products:
            variant_data = sp.shopify_data.get('variants', [])
            for v in variant_data:
                if v.get('inventory_item_id') == inventory_item_id:
                    inv_level, created = ShopifyInventoryLevel.objects.update_or_create(
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
                    
                    # Update the cached quantity on the product mapping
                    sp.shopify_inventory_quantity = available
                    sp.save(update_fields=['shopify_inventory_quantity'])
                    break
        
        job.processed_items += 1
        job.save(update_fields=['processed_items', 'failed_items'])

    @staticmethod
    def push_sku_to_shopify(store: ShopifyStore, sku_id: str) -> Dict:
        """Push an ERP SKU to Shopify as a product/variant."""
        sku = SKU.objects.select_related('product').get(id=sku_id)
        client = ShopifyAPIClient(store)
        
        # Check if already mapped
        existing = ShopifyProduct.objects.filter(
            store=store,
            erp_sku=sku
        ).first()
        
        if existing and existing.shopify_product_id:
            # Update existing Shopify product
            product_data = {
                'id': existing.shopify_product_id,
                'title': sku.product.name,
                'variants': [{
                    'id': existing.shopify_variant_id,
                    'sku': sku.code,
                    'price': str(sku.base_price),
                    'inventory_management': 'shopify',
                }]
            }
            
            result = client.update_product(existing.shopify_product_id, product_data)
            
            existing.shopify_title = result.get('title', sku.product.name)
            existing.shopify_price = sku.base_price
            existing.shopify_sku = sku.code
            existing.shopify_data = result
            existing.sync_status = 'synced'
            existing.last_synced_at = timezone.now()
            existing.save()
            
            return {
                'action': 'updated',
                'shopify_product_id': result.get('id'),
                'message': f'Updated product {sku.code} on Shopify'
            }
        else:
            # Create new product on Shopify
            # Get barcode if available
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

            product_data = {
                'title': sku.product.name,
                'body_html': sku.product.description or '',
                'vendor': '',
                'product_type': '',
                'variants': [{
                    'sku': sku.code,
                    'price': str(sku.base_price),
                    'barcode': barcode_value,
                    'inventory_management': 'shopify',
                    'weight': float(sku.weight) if sku.weight else 0,
                    'weight_unit': 'kg',
                }]
            }
            
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
            
            return {
                'action': 'created',
                'shopify_product_id': result.get('id'),
                'message': f'Created product {sku.code} on Shopify'
            }

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
        
        # Get the inventory_item_id from variant data
        variant_data = mapping.shopify_data.get('variants', [])
        inventory_item_id = None
        for v in variant_data:
            if v.get('id') == mapping.shopify_variant_id:
                inventory_item_id = v.get('inventory_item_id')
                break
        
        if not inventory_item_id:
            # Fetch from Shopify
            product = client.get_product(mapping.shopify_product_id)
            for v in product.get('variants', []):
                if v.get('id') == mapping.shopify_variant_id:
                    inventory_item_id = v.get('inventory_item_id')
                    break
        
        if not inventory_item_id:
            raise ValueError("Could not find inventory_item_id for this variant.")
        
        # If no location specified, use first location
        if not location_id:
            locations = client.get_locations()
            if locations:
                location_id = locations[0]['id']
            else:
                raise ValueError("No Shopify locations found.")
        
        # Set inventory level
        result = client.set_inventory_level(inventory_item_id, location_id, quantity)
        
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
            # Mark as deleted
            ShopifyProduct.objects.filter(
                store=store,
                shopify_product_id=payload['id']
            ).update(status='deleted')
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
        """Handle inventory level update webhooks."""
        inventory_item_id = payload.get('inventory_item_id')
        location_id = payload.get('location_id')
        available = payload.get('available', 0)
        
        if not inventory_item_id:
            return
        
        # Find matching product
        shopify_products = ShopifyProduct.objects.filter(store=store)
        for sp in shopify_products:
            for v in sp.shopify_data.get('variants', []):
                if v.get('inventory_item_id') == inventory_item_id:
                    # Update inventory level
                    ShopifyInventoryLevel.objects.update_or_create(
                        shopify_product=sp,
                        shopify_location_id=location_id,
                        defaults={
                            'store': store,
                            'shopify_location_name': '',
                            'available': available or 0,
                        }
                    )
                    sp.shopify_inventory_quantity = available or 0
                    sp.save(update_fields=['shopify_inventory_quantity'])
                    return
    
    @staticmethod
    def sync_orders(store: ShopifyStore) -> ShopifySyncJob:
        """Sync orders from Shopify to ERP."""
        job = ShopifySyncJob.objects.create(store=store, job_type='orders', job_status='running')
        try:
            client = ShopifyAPIClient(store)
            orders = client.get_all_orders()
            job.total_items = len(orders)
            job.save()
            
            for order_data in orders:
                try:
                    ShopifyService._process_order(store, order_data)
                    job.processed_items += 1
                except Exception as e:
                    logger.error(f"Error processing order {order_data.get('id')}: {e}")
                    job.failed_items += 1
                job.save()
                
            job.job_status = 'completed'
            job.completed_at = timezone.now()
            store.last_order_sync = timezone.now()
            store.save()
        except Exception as e:
            job.job_status = 'failed'
            job.error_log = str(e)
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
        
        # Mapping to ERP Document (Sales Order)
        if not s_order.erp_document:
            try:
                # Find or create customer
                email = order_data.get('customer', {}).get('email')
                customer = None
                if email:
                    customer, _ = Customer.objects.get_or_create(
                        company_id=store.company_id,
                        email=email,
                        defaults={
                            'name': s_order.customer_name,
                            'status': 'active'
                        }
                    )
                
                # Create ERP Document
                doc_type = DocumentType.objects.get(company_id=store.company_id, code='sales_order')
                from apps.numbering.models import NumberingSequence
                doc_number = NumberingSequence.objects.get(id=doc_type.numbering_sequence_id).get_next_number()
                
                erp_doc = Document.objects.create(
                    company_id=store.company_id,
                    document_type=doc_type,
                    document_number=doc_number,
                    document_date=timezone.now().date(),
                    customer=customer,
                    external_reference=s_order.order_number,
                    total_amount=s_order.total_price,
                    notes=f"Shopify Order #{s_order.order_number}"
                )
                
                # Add Lines
                for idx, item in enumerate(order_data.get('line_items', [])):
                    sku = None
                    if item.get('sku'):
                        sku = SKU.objects.filter(company_id=store.company_id, code=item['sku']).first()
                    
                    DocumentLine.objects.create(
                        document=erp_doc,
                        line_number=idx + 1,
                        sku=sku or SKU.objects.first(), # Fallback if SKU not found
                        quantity=item.get('quantity', 1),
                        unit_price=item.get('price', 0),
                        line_amount=float(item.get('price', 0)) * int(item.get('quantity', 1))
                    )
                
                s_order.erp_document = erp_doc
                s_order.save()
            except Exception as e:
                logger.error(f"Failed to create ERP document for order {order_id}: {e}")
                
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
