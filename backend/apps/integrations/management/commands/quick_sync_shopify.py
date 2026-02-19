"""
Quick sync command - syncs first 100 Shopify products for testing.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.integrations.shopify_models import ShopifyProduct
from apps.mdm.models import Product, SKU, Company, Location, BusinessUnit
from apps.inventory.models import InventoryBalance
from decimal import Decimal


class Command(BaseCommand):
    help = 'Quick sync first 100 Shopify products to test'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Number of products to sync (default: 100)',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        
        self.stdout.write(self.style.SUCCESS(f'Quick syncing first {limit} Shopify products...'))

        # Get or create company, business unit, location
        company, _ = Company.objects.get_or_create(
            code='SHOPIFY',
            defaults={'name': 'Shopify Store', 'status': 'active'}
        )
        
        business_unit, _ = BusinessUnit.objects.get_or_create(
            code='SHOPIFY-BU',
            company=company,
            defaults={'name': 'Shopify Business Unit', 'status': 'active'}
        )
        
        location, _ = Location.objects.get_or_create(
            code='SHOPIFY-WH',
            company=company,
            defaults={
                'name': 'Shopify Warehouse',
                'location_type': 'warehouse',
                'business_unit': business_unit,
                'status': 'active',
            }
        )

        # Get products to sync
        products_to_sync = ShopifyProduct.objects.filter(
            erp_product__isnull=True
        )[:limit]

        total = products_to_sync.count()
        self.stdout.write(f'Found {total} products to sync')

        created_products = 0
        created_skus = 0
        created_balances = 0
        errors = 0

        for i, sp in enumerate(products_to_sync, 1):
            try:
                with transaction.atomic():
                    # Create product
                    product_code = f'SHOP-{sp.shopify_product_id}'
                    product, p_created = Product.objects.get_or_create(
                        code=product_code[:100],
                        company=company,
                        defaults={
                            'name': sp.shopify_title[:255],
                            'description': f'Type: {sp.shopify_product_type or "N/A"}',
                            'status': 'active',
                        }
                    )
                    if p_created:
                        created_products += 1

                    # Create SKU
                    sku_code = sp.shopify_sku or f'SKU-{sp.shopify_product_id}'
                    if sp.shopify_variant_id:
                        sku_code = f'{sku_code}-{sp.shopify_variant_id}'

                    sku, s_created = SKU.objects.get_or_create(
                        code=sku_code[:100],
                        product=product,
                        defaults={
                            'name': sp.shopify_title[:255],
                            'base_price': sp.shopify_price or Decimal('0.00'),
                            'cost_price': sp.shopify_price or Decimal('0.00'),
                            'status': 'active',
                        }
                    )
                    if s_created:
                        created_skus += 1
                        
                        # Create barcode if available
                        if sp.shopify_barcode:
                            from apps.mdm.models import SKUBarcode
                            SKUBarcode.objects.get_or_create(
                                sku=sku,
                                barcode_value=sp.shopify_barcode[:255],
                                defaults={
                                    'barcode_type': 'ean13',
                                    'is_primary': True,
                                    'company': company,
                                    'status': 'active',
                                }
                            )

                    # Link to Shopify
                    sp.erp_product = product
                    sp.erp_sku = sku
                    sp.sync_status = 'synced'
                    sp.save()

                    # Create inventory
                    qty = sp.shopify_inventory_quantity or 0
                    balance, b_created = InventoryBalance.objects.update_or_create(
                        sku=sku,
                        location=location,
                        defaults={
                            'quantity_on_hand': qty,
                            'quantity_available': qty,
                            'quantity_reserved': 0,
                            'average_cost': sp.shopify_price or Decimal('0.00'),
                        }
                    )
                    if b_created:
                        created_balances += 1

                if i % 10 == 0:
                    self.stdout.write(f'Processed {i}/{total}...')

            except Exception as e:
                errors += 1
                self.stdout.write(self.style.ERROR(f'Error: {str(e)[:100]}'))

        self.stdout.write(self.style.SUCCESS(f'\nCompleted!'))
        self.stdout.write(f'Products created: {created_products}')
        self.stdout.write(f'SKUs created: {created_skus}')
        self.stdout.write(f'Inventory balances created: {created_balances}')
        self.stdout.write(f'Errors: {errors}')
