"""
Check Shopify sync status.
"""
from django.core.management.base import BaseCommand
from apps.mdm.models import Product, SKU
from apps.inventory.models import InventoryBalance
from apps.integrations.shopify_models import ShopifyProduct


class Command(BaseCommand):
    help = 'Check Shopify sync status'

    def handle(self, *args, **options):
        total_shopify = ShopifyProduct.objects.count()
        synced = ShopifyProduct.objects.filter(sync_status='synced').count()
        pending = ShopifyProduct.objects.filter(erp_product__isnull=True).count()
        errors = ShopifyProduct.objects.filter(sync_status='error').count()
        
        products = Product.objects.filter(code__startswith='SHOP-').count()
        skus = SKU.objects.filter(code__startswith='SKU-').count() + SKU.objects.filter(code__startswith='SHOP-').count()
        inventory = InventoryBalance.objects.count()
        
        self.stdout.write(self.style.SUCCESS('\nShopify Sync Status:'))
        self.stdout.write(f'\nShopify Products:')
        self.stdout.write(f'  Total: {total_shopify}')
        self.stdout.write(f'  Synced: {synced} ({synced/total_shopify*100:.1f}%)')
        self.stdout.write(f'  Pending: {pending}')
        self.stdout.write(f'  Errors: {errors}')
        
        self.stdout.write(f'\nERP Master Data:')
        self.stdout.write(f'  Products: {products}')
        self.stdout.write(f'  SKUs: {skus}')
        self.stdout.write(f'  Inventory Balances: {inventory}')
        
        if pending > 0:
            self.stdout.write(self.style.WARNING(f'\nSync in progress... {pending} products remaining'))
        elif errors > 0:
            self.stdout.write(self.style.WARNING(f'\nSync completed with {errors} errors'))
        else:
            self.stdout.write(self.style.SUCCESS('\nSync completed successfully!'))
