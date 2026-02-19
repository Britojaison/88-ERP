"""
Management command to sync Shopify products to ERP inventory.
Removes dummy data and creates proper product/SKU/inventory records from Shopify.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.integrations.shopify_models import ShopifyProduct, ShopifyStore
from apps.mdm.models import Product, SKU, Company, Location, BusinessUnit
from apps.inventory.models import InventoryBalance
from decimal import Decimal


class Command(BaseCommand):
    help = 'Sync Shopify products to ERP inventory and remove dummy data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--remove-dummy',
            action='store_true',
            help='Remove existing dummy data before sync',
        )
        parser.add_argument(
            '--store-id',
            type=str,
            help='Specific Shopify store ID to sync (optional)',
        )

    def handle(self, *args, **options):
        remove_dummy = options['remove_dummy']
        store_id = options.get('store_id')

        self.stdout.write(self.style.SUCCESS('Starting Shopify to Inventory sync...'))

        # Step 1: Remove dummy data if requested
        if remove_dummy:
            self.remove_dummy_data()

        # Step 2: Get or create default company, business unit, and location
        company = self.get_or_create_company()
        business_unit = self.get_or_create_business_unit(company)
        location = self.get_or_create_location(company, business_unit)

        # Step 3: Sync Shopify products
        self.sync_products(company, location, store_id)

        self.stdout.write(self.style.SUCCESS('Sync completed successfully!'))

    def remove_dummy_data(self):
        """Remove existing dummy/sample data."""
        self.stdout.write('Removing dummy data...')
        
        with transaction.atomic():
            # Remove inventory balances first (no dependencies)
            deleted_balances = InventoryBalance.objects.all().delete()[0]
            self.stdout.write(f'  - Deleted {deleted_balances} inventory balances')

            # Don't delete SKUs/Products - just clear inventory
            # This avoids foreign key issues
            self.stdout.write(f'  - Kept existing SKUs and Products (will be updated if linked to Shopify)')

        self.stdout.write(self.style.SUCCESS('Dummy data removed'))

    def get_or_create_company(self):
        """Get or create default company."""
        company, created = Company.objects.get_or_create(
            code='SHOPIFY',
            defaults={
                'name': 'Shopify Store',
                'status': 'active',
            }
        )
        if created:
            self.stdout.write(f'Created company: {company.name}')
        return company

    def get_or_create_business_unit(self, company):
        """Get or create default business unit."""
        business_unit, created = BusinessUnit.objects.get_or_create(
            code='SHOPIFY-BU',
            company=company,
            defaults={
                'name': 'Shopify Business Unit',
                'status': 'active',
            }
        )
        if created:
            self.stdout.write(f'Created business unit: {business_unit.name}')
        return business_unit

    def get_or_create_location(self, company, business_unit):
        """Get or create default warehouse location."""
        location, created = Location.objects.get_or_create(
            code='SHOPIFY-WH',
            company=company,
            defaults={
                'name': 'Shopify Warehouse',
                'location_type': 'warehouse',
                'business_unit': business_unit,
                'status': 'active',
            }
        )
        if created:
            self.stdout.write(f'Created location: {location.name}')
        return location

    def sync_products(self, company, location, store_id=None):
        """Sync Shopify products to ERP."""
        self.stdout.write('Syncing Shopify products to ERP...')

        # Get Shopify products
        queryset = ShopifyProduct.objects.select_related('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)

        total = queryset.count()
        self.stdout.write(f'Found {total} Shopify products to sync')

        created_products = 0
        created_skus = 0
        created_balances = 0
        updated_products = 0
        skipped = 0

        for i, shopify_product in enumerate(queryset.iterator(), 1):
            if i % 100 == 0:
                self.stdout.write(f'Processing {i}/{total}...')

            try:
                with transaction.atomic():
                    # Check if product already exists
                    if shopify_product.erp_product:
                        product = shopify_product.erp_product
                        updated_products += 1
                    else:
                        # Create product
                        product_code = self.generate_product_code(shopify_product)
                        product, created = Product.objects.get_or_create(
                            code=product_code,
                            company=company,
                            defaults={
                                'name': shopify_product.shopify_title[:255],
                                'description': f'Shopify Product ID: {shopify_product.shopify_product_id}\nType: {shopify_product.shopify_product_type or "N/A"}\nVendor: {shopify_product.shopify_vendor or "N/A"}',
                                'status': 'active',
                            }
                        )
                        if created:
                            created_products += 1
                        
                        # Link to Shopify product
                        shopify_product.erp_product = product

                    # Check if SKU already exists
                    if shopify_product.erp_sku:
                        sku = shopify_product.erp_sku
                    else:
                        # Create SKU - use Shopify SKU directly
                        if shopify_product.shopify_sku:
                            sku_code = shopify_product.shopify_sku
                        else:
                            # Fallback: use product ID + variant ID if no SKU
                            sku_code = f'SKU-{shopify_product.shopify_product_id}'
                            if shopify_product.shopify_variant_id:
                                sku_code = f'{sku_code}-{shopify_product.shopify_variant_id}'

                        sku, created = SKU.objects.get_or_create(
                            code=sku_code[:100],
                            product=product,
                            defaults={
                                'name': shopify_product.shopify_title[:255],
                                'barcode': shopify_product.shopify_barcode[:100] if shopify_product.shopify_barcode else '',
                                'base_price': shopify_product.shopify_price or Decimal('0.00'),
                                'cost_price': shopify_product.shopify_price or Decimal('0.00'),
                                'status': 'active',
                            }
                        )
                        if created:
                            created_skus += 1
                        
                        # Link to Shopify product
                        shopify_product.erp_sku = sku

                    # Update sync status
                    shopify_product.sync_status = 'synced'
                    shopify_product.sync_error = ''
                    shopify_product.save()

                    # Create or update inventory balance
                    quantity = shopify_product.shopify_inventory_quantity or 0
                    balance, created = InventoryBalance.objects.update_or_create(
                        sku=sku,
                        location=location,
                        defaults={
                            'quantity_on_hand': quantity,
                            'quantity_available': quantity,
                            'quantity_reserved': 0,
                            'average_cost': shopify_product.shopify_price or Decimal('0.00'),
                        }
                    )
                    if created:
                        created_balances += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error syncing product {shopify_product.id}: {str(e)}')
                )
                skipped += 1
                continue

        self.stdout.write(self.style.SUCCESS(f'\nSync Summary:'))
        self.stdout.write(f'  - Products created: {created_products}')
        self.stdout.write(f'  - Products updated: {updated_products}')
        self.stdout.write(f'  - SKUs created: {created_skus}')
        self.stdout.write(f'  - Inventory balances created: {created_balances}')
        self.stdout.write(f'  - Skipped (errors): {skipped}')

    def sanitize_code(self, text):
        """Sanitize text for use as code."""
        if not text:
            return 'UNKNOWN'
        # Remove special characters, keep alphanumeric and dash
        import re
        code = re.sub(r'[^a-zA-Z0-9-]', '-', text)
        code = re.sub(r'-+', '-', code)  # Replace multiple dashes with single
        return code[:50].upper().strip('-')

    def generate_product_code(self, shopify_product):
        """Generate unique product code."""
        base_code = f'SHOP-{shopify_product.shopify_product_id}'
        return base_code[:100]
