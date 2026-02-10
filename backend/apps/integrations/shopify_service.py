"""
Shopify Integration Service.
Handles API calls, data sync, and webhook processing.
"""
import requests
from typing import Dict, List, Optional, Any
from django.db import transaction
from django.utils import timezone
from .shopify_models import (
    ShopifyStore, ShopifyProduct, ShopifyInventoryLevel,
    ShopifyWebhook, ShopifyWebhookLog, ShopifySyncJob
)
from apps.mdm.models import Product, SKU, Location
import logging

logger = logging.getLogger(__name__)


class ShopifyAPIClient:
    """
    Shopify REST Admin API client.
    """
    
    def __init__(self, store: ShopifyStore):
        self.store = store
        self.base_url = f"https://{store.shop_domain}/admin/api/{store.api_version}"
        self.headers = {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json',
        }
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make API request with error handling."""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.request(method, url, headers=self.headers, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Shopify API error: {e}")
            raise
    
    def get_products(self, limit: int = 250, since_id: Optional[int] = None) -> List[Dict]:
        """Get products from Shopify."""
        params = {'limit': limit}
        if since_id:
            params['since_id'] = since_id
        
        response = self._make_request('GET', 'products.json', params=params)
        return response.get('products', [])
    
    def get_product(self, product_id: int) -> Dict:
        """Get single product by ID."""
        response = self._make_request('GET', f'products/{product_id}.json')
        return response.get('product', {})
    
    def get_inventory_levels(self, location_id: Optional[int] = None) -> List[Dict]:
        """Get inventory levels."""
        params = {}
        if location_id:
            params['location_ids'] = location_id
        
        response = self._make_request('GET', 'inventory_levels.json', params=params)
        return response.get('inventory_levels', [])
    
    def get_locations(self) -> List[Dict]:
        """Get Shopify locations."""
        response = self._make_request('GET', 'locations.json')
        return response.get('locations', [])
    
    def update_inventory_level(
        self,
        inventory_item_id: int,
        location_id: int,
        available: int
    ) -> Dict:
        """Update inventory level."""
        data = {
            'location_id': location_id,
            'inventory_item_id': inventory_item_id,
            'available': available
        }
        response = self._make_request('POST', 'inventory_levels/set.json', json=data)
        return response.get('inventory_level', {})
    
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
    
    def test_connection(self) -> bool:
        """Test API connection."""
        try:
            self._make_request('GET', 'shop.json')
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False


class ShopifyService:
    """
    Service for Shopify integration operations.
    """
    
    @staticmethod
    def test_connection(store: ShopifyStore) -> bool:
        """Test Shopify API connection."""
        client = ShopifyAPIClient(store)
        is_connected = client.test_connection()
        
        store.is_connected = is_connected
        store.last_connection_test = timezone.now()
        if not is_connected:
            store.connection_error = "Failed to connect to Shopify API"
        else:
            store.connection_error = ""
        store.save()
        
        return is_connected
    
    @staticmethod
    @transaction.atomic
    def sync_products(store: ShopifyStore) -> ShopifySyncJob:
        """Sync products from Shopify to ERP."""
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='products',
            status='running'
        )
        
        try:
            client = ShopifyAPIClient(store)
            products = client.get_products()
            
            job.total_items = len(products)
            job.save()
            
            for shopify_product in products:
                try:
                    ShopifyService._process_product(store, shopify_product, job)
                except Exception as e:
                    logger.error(f"Error processing product {shopify_product.get('id')}: {e}")
                    job.failed_items += 1
                    job.error_log += f"\nProduct {shopify_product.get('id')}: {str(e)}"
            
            store.last_product_sync = timezone.now()
            store.save()
            
            job.status = 'completed'
            job.completed_at = timezone.now()
            job.save()
            
        except Exception as e:
            logger.error(f"Product sync failed: {e}")
            job.status = 'failed'
            job.error_log = str(e)
            job.completed_at = timezone.now()
            job.save()
        
        return job
    
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
                    # SKU not found in ERP - could auto-create or flag for manual mapping
                    shopify_product.sync_status = 'pending'
                    shopify_product.sync_error = 'SKU not found in ERP'
                    shopify_product.save()
            
            shopify_product.last_synced_at = timezone.now()
            shopify_product.save()
            
            job.processed_items += 1
            job.save()
    
    @staticmethod
    @transaction.atomic
    def sync_inventory(store: ShopifyStore) -> ShopifySyncJob:
        """Sync inventory levels from Shopify."""
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='inventory',
            status='running'
        )
        
        try:
            client = ShopifyAPIClient(store)
            locations = client.get_locations()
            
            for location in locations:
                location_id = location['id']
                location_name = location['name']
                
                # Get inventory levels for this location
                inventory_levels = client.get_inventory_levels(location_id)
                
                job.total_items += len(inventory_levels)
                job.save()
                
                for level in inventory_levels:
                    try:
                        ShopifyService._process_inventory_level(
                            store, location_id, location_name, level, job
                        )
                    except Exception as e:
                        logger.error(f"Error processing inventory level: {e}")
                        job.failed_items += 1
            
            store.last_inventory_sync = timezone.now()
            store.save()
            
            job.status = 'completed'
            job.completed_at = timezone.now()
            job.save()
            
        except Exception as e:
            logger.error(f"Inventory sync failed: {e}")
            job.status = 'failed'
            job.error_log = str(e)
            job.completed_at = timezone.now()
            job.save()
        
        return job
    
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
        
        # Find the ShopifyProduct by inventory_item_id
        # Note: You may need to store inventory_item_id in ShopifyProduct model
        # For now, we'll skip if not found
        
        # Create or update inventory level
        # This is a simplified version - you'd need proper mapping
        
        job.processed_items += 1
        job.save()
    
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
                status='running'
            )
            ShopifyService._process_product(store, payload, job)
            job.status = 'completed'
            job.completed_at = timezone.now()
            job.save()
    
    @staticmethod
    def _handle_inventory_webhook(store: ShopifyStore, topic: str, payload: Dict) -> None:
        """Handle inventory webhooks."""
        # Update inventory level
        pass
    
    @staticmethod
    def _handle_order_webhook(store: ShopifyStore, topic: str, payload: Dict) -> None:
        """Handle order webhooks."""
        # Process order
        pass
