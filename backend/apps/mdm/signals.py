import logging
import threading
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.mdm.models import SKU

logger = logging.getLogger(__name__)

@receiver(post_save, sender=SKU)
def sync_sku_to_shopify_on_save(sender, instance, created, **kwargs):
    """
    When a new SKU is created, sync it to Shopify asynchronously.
    """
    if created and instance.status == 'active':
        try:
            from apps.integrations.models import ShopifyStore
            from apps.integrations.shopify_service import ShopifyService
            
            # Find all active Shopify stores for this company
            stores = ShopifyStore.objects.filter(company_id=instance.company_id, is_connected=True)
            for store in stores:
                logger.info(f"Triggering background Shopify sync for new SKU: {instance.code}")
                # Spawn a background thread to prevent blocking the HTTP response
                threading.Thread(
                    target=lambda s=store, i=instance.id: push_sku(s, i),
                    daemon=True
                ).start()
        except Exception as e:
            logger.error(f"Failed to schedule Shopify sync for SKU {instance.code}: {e}")

def push_sku(store, sku_id):
    from apps.integrations.shopify_service import ShopifyService
    import logging
    logger = logging.getLogger(__name__)
    try:
        ShopifyService.push_sku_to_shopify(store, sku_id)
        logger.info(f"Successfully pushed SKU {sku_id} to Shopify.")
    except Exception as e:
        logger.error(f"Background thread failed to push SKU to Shopify: {e}")
