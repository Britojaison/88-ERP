import logging
import threading
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.inventory.models import InventoryBalance

logger = logging.getLogger(__name__)

@receiver(post_save, sender=InventoryBalance)
def sync_inventory_to_shopify_on_save(sender, instance, **kwargs):
    """
    When InventoryBalance changes, push the new quantity_available to Shopify asynchronously.
    """
    try:
        from apps.integrations.models import ShopifyStore
        
        # Find all connected Shopify stores for this company
        stores = ShopifyStore.objects.filter(company_id=instance.company_id, is_connected=True)
        if not stores.exists():
            return

        qty = int(instance.quantity_available)
        
        for store in stores:
            logger.info(f"Triggering background Shopify inventory sync for SKU: {instance.sku.code}")
            # Spawn a background thread to prevent blocking the HTTP response
            threading.Thread(
                target=lambda s=store, i=instance.sku.id, q=qty: push_inventory(s, i, q),
                daemon=True
            ).start()
    except Exception as e:
        logger.error(f"Failed to schedule Shopify inventory sync for SKU {instance.sku.code}: {e}")

def push_inventory(store, sku_id, quantity):
    from apps.integrations.shopify_service import ShopifyService
    import logging
    logger = logging.getLogger(__name__)
    try:
        ShopifyService.push_inventory_to_shopify(store, sku_id, quantity)
        logger.info(f"Successfully pushed inventory to Shopify for SKU ID {sku_id}.")
    except Exception as e:
        logger.error(f"Background thread failed to push inventory to Shopify: {e}")
