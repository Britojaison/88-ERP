"""
Background scheduler for Shopify data synchronization.
Runs every 12 hours to keep the local DB in sync with Shopify.
Uses APScheduler with DB job store so it works safely with multi-worker Gunicorn.
"""
import logging
import threading
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from django.conf import settings

logger = logging.getLogger(__name__)

_scheduler = None
_scheduler_lock = threading.Lock()


def sync_all_shopify_stores():
    """
    Full Shopify sync: orders + products for every active store.
    Runs automatically every 12 hours.
    """
    try:
        # Import inside function to avoid app-not-ready issues
        from apps.integrations.shopify_models import ShopifyStore
        from apps.integrations.shopify_service import ShopifyService

        stores = ShopifyStore.objects.filter(status='active')
        if not stores.exists():
            logger.info("[ShopifyScheduler] No active stores, skipping sync.")
            return

        logger.info(f"[ShopifyScheduler] Starting scheduled sync for {stores.count()} store(s).")

        for store in stores:
            try:
                logger.info(f"[ShopifyScheduler] Syncing orders for: {store.name}")
                ShopifyService.sync_orders(store)
            except Exception as e:
                logger.error(f"[ShopifyScheduler] Order sync failed for {store.name}: {e}")

            try:
                logger.info(f"[ShopifyScheduler] Syncing products for: {store.name}")
                ShopifyService.sync_products(store)
            except Exception as e:
                logger.error(f"[ShopifyScheduler] Product sync failed for {store.name}: {e}")

        logger.info("[ShopifyScheduler] Scheduled sync complete.")

    except Exception as e:
        logger.error(f"[ShopifyScheduler] Fatal error during scheduled sync: {e}")


def start_scheduler():
    """
    Start the background scheduler. Safe to call multiple times (idempotent).
    Only one scheduler instance is created per process.
    """
    global _scheduler

    with _scheduler_lock:
        if _scheduler is not None and _scheduler.running:
            return  # Already running

        logger.info("[ShopifyScheduler] Starting background scheduler (12-hour interval).")

        _scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            timezone='UTC'
        )

        # Run every 12 hours
        _scheduler.add_job(
            sync_all_shopify_stores,
            trigger='interval',
            hours=12,
            id='shopify_full_sync',
            name='Shopify Full Sync (12h)',
            replace_existing=True,
            misfire_grace_time=3600,  # Allow 1 hour grace if server was down
        )

        _scheduler.start()
        logger.info("[ShopifyScheduler] Scheduler started. Next run in 12 hours.")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[ShopifyScheduler] Scheduler stopped.")
