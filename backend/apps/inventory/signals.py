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
    When InventoryBalance changes, push the new quantity_available from SHOPIFY-WH to Shopify.
    """
    try:
        from apps.integrations.shopify_models import ShopifyStore
        
        # 1. Only respond if the change happened at SHOPIFY-WH
        # 1. We now allow ANY location change to trigger a sync (so POS sales reflect in Shopify)
        # But we only push if the store is connected.
        
        # 2. Find connected Shopify stores for THIS company
        stores = ShopifyStore.objects.filter(company_id=instance.company_id, is_connected=True)
        if not stores.exists():
            return

        from django.db.models import Sum
        
        # 3. Calculate total stock across ALL active locations for THIS company
        # (This ensures POS sales and Warehouse movements are both reflected)
        total_balance = InventoryBalance.objects.filter(
            company_id=instance.company_id,
            sku=instance.sku,
            status='active'
        ).aggregate(total=Sum('quantity_available'))['total'] or 0

        qty = int(total_balance)
        
        for store in stores:
            logger.info(f"Syncing total ERP stock ({qty}) to Shopify for SKU: {instance.sku.code} (Triggered by {instance.location.code})")
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
        # PUSH ONLY — never create new products from the background signal
        # This prevents the creation of duplicates reported by the user.
        result = ShopifyService.push_inventory_to_shopify(store, sku_id, quantity)
        logger.info(f"Shopify Sync Success: SKU ID {sku_id} set to {quantity}. Result: {result}")
    except ValueError as e:
        # Log mapping issues but do NOT call push_sku_to_shopify
        logger.warning(f"Shopify Sync Skipped: SKU ID {sku_id} is not mapped correctly: {e}")
    except Exception as e:
        logger.error(f"Shopify Sync Failed: {e}")
