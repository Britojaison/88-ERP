from django.core.management.base import BaseCommand
from apps.integrations.shopify_models import ShopifyStore
from apps.integrations.shopify_service import ShopifyService

class Command(BaseCommand):
    help = 'Backfill Shopify collection assignments for ERP products'

    def add_arguments(self, parser):
        parser.add_argument('--store', type=str, help='Shopify store domain to backfill for')

    def handle(self, *args, **options):
        store_domain = options.get('store')
        if store_domain:
            stores = ShopifyStore.objects.filter(shop_domain=store_domain)
        else:
            stores = ShopifyStore.objects.all()

        if not stores.exists():
            self.stdout.write(self.style.ERROR('No Shopify stores found.'))
            return

        for store in stores:
            self.stdout.write(f"Backfilling collections for store: {store.name} ({store.shop_domain})")
            result = ShopifyService.backfill_collections(store)
            self.stdout.write(self.style.SUCCESS(
                f"Completed! Processed: {result['processed']}, Total eligible: {result['total_eligible']}"
            ))
