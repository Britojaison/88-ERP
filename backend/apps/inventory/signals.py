import logging
import threading
from django.db import transaction
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

        from django.db.models import Sum
        
        # We calculate the total warehouse stock to push to Shopify.
        # This calculation happens NOW, within the current transaction.
        warehouse_qty = InventoryBalance.objects.filter(
            sku=instance.sku,
            location__location_type='warehouse',
            status='active'
        ).aggregate(total=Sum('quantity_available'))['total'] or 0

        qty = int(warehouse_qty)
        
        for store in stores:
            logger.info(f"Scheduling background Shopify inventory sync for SKU: {instance.sku.code}")
            # Use on_commit to ensure the thread only starts after the DB transaction is successful.
            transaction.on_commit(
                lambda s=store, i=instance.sku.id, q=qty: threading.Thread(
                    target=lambda: push_inventory(s, i, q),
                    daemon=True
                ).start()
            )
    except Exception as e:
        logger.error(f"Failed to schedule Shopify inventory sync for SKU {instance.sku.code}: {e}")

def push_inventory(store, sku_id, quantity):
    from apps.integrations.shopify_service import ShopifyService
    import logging
    logger = logging.getLogger(__name__)
    try:
        ShopifyService.push_inventory_to_shopify(store, sku_id, quantity)
        logger.info(f"Successfully pushed inventory to Shopify for SKU ID {sku_id}.")
    except ValueError as e:
        if "not mapped to a Shopify product" in str(e):
            logger.info(f"SKU {sku_id} not mapped to Shopify. Pushing SKU first...")
            try:
                ShopifyService.push_sku_to_shopify(store, sku_id)
                ShopifyService.push_inventory_to_shopify(store, sku_id, quantity)
                logger.info(f"Successfully pushed SKU and inventory to Shopify for SKU ID {sku_id}.")
            except Exception as inner_e:
                logger.error(f"Failed to push SKU and inventory: {inner_e}")
        else:
            logger.error(f"ValueError while pushing inventory to Shopify: {e}")
    except Exception as e:
        logger.error(f"Background thread failed to push inventory to Shopify: {e}")
