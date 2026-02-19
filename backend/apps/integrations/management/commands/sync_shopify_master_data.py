"""
Sync Shopify products to ERP master data.
Handles unique constraints properly and removes dummy data.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.integrations.shopify_models import ShopifyProduct
from apps.mdm.models import Product, SKU, Company, Location, BusinessUnit, SKUBarcode
from apps.inventory.models import InventoryBalance
from decimal import Decimal
import hashlib


class Command(BaseCommand):
    help = 'Sync all Shopify products to ERP master data and remove dummy data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Batch size for processing (default: 100)',
        )
        parser.add_argument(
            '--skip-dummy-removal',
            action='store_true',
            help='Skip removing dummy data',
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        skip_dummy = options['skip_dummy_removal']
        
        self.stdout.write(self.style.SUCCESS('Starting Shopify master data sync...'))

        # Step 1: Remove dummy data
        if not skip_dummy:
            self.remove_dummy_data()

        # Step 2: Setup company, business unit, location
        company = self.get_or_create_company()
        business_unit = self.get_or_create_business_unit(company)
        location = self.get_or_create_location(company, business_unit)

        # Step 3: Sync products in batches
        self.sync_products_batch(company, location, batch_size)

        self.stdout.write(self.style.SUCCESS('\nSync completed successfully!'))

    def remove_dummy_data(self):
        """Remove dummy data safely."""
        self.stdout.write('Removing dummy data...')
        
        # Just clear inventory - keep products/SKUs to avoid FK issues
        deleted = InventoryBalance.objects.all().delete()[0]
        self.stdout.write(f'  - Deleted {deleted} inventory balances')

    def get_or_create_company(self):
        """Get or create Shopify company."""
        company, created = Company.objects.get_or_create(
            code='SHOPIFY',
            defaults={'name': 'Shopify Store', 'status': 'active'}
        )
        if created:
            self.stdout.write(f'  - Created company: {company.name}')
        return company

    def get_or_create_business_unit(self, company):
        """Get or create business unit."""
        bu, created = BusinessUnit.objects.get_or_create(
            code='SHOPIFY-BU',
            company=company,
            defaults={'name': 'Shopify Business Unit', 'status': 'active'}
        )
        if created:
            self.stdout.write(f'  - Created business unit: {bu.name}')
        return bu

    def get_or_create_location(self, company, business_unit):
        """Get or create warehouse location."""
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
            self.stdout.write(f'  - Created location: {location.name}')
        return location

    def generate_unique_code(self, base, model_class, max_length=100):
        """Generate unique code for a model."""
        code = base[:max_length]
        counter = 1
        
        while model_class.objects.filter(code=code).exists():
            suffix = f'-{counter}'
            code = base[:max_length - len(suffix)] + suffix
            counter += 1
            
        return code

    def sync_products_batch(self, company, location, batch_size):
        """Sync products in batches."""
        self.stdout.write(f'\nSyncing Shopify products (batch size: {batch_size})...')
        
        # Get unsynced products
        total = ShopifyProduct.objects.filter(erp_product__isnull=True).count()
        self.stdout.write(f'Found {total} products to sync')
        
        if total == 0:
            self.stdout.write(self.style.WARNING('No products to sync. All products already linked.'))
            return

        created_products = 0
        created_skus = 0
        created_barcodes = 0
        created_balances = 0
        errors = 0
        processed = 0

        # Process in batches
        while True:
            batch = list(ShopifyProduct.objects.filter(
                erp_product__isnull=True
            ).select_related('store')[:batch_size])
            
            if not batch:
                break

            for sp in batch:
                try:
                    with transaction.atomic():
                        # Generate unique product code
                        base_product_code = f'SHOP-{sp.shopify_product_id}'
                        product_code = self.generate_unique_code(
                            base_product_code, Product
                        )

                        # Create product
                        product, p_created = Product.objects.get_or_create(
                            code=product_code,
                            company=company,
                            defaults={
                                'name': sp.shopify_title[:255],
                                'description': self.build_description(sp),
                                'status': 'active',
                            }
                        )
                        if p_created:
                            created_products += 1

                        # Generate unique SKU code - use Shopify SKU directly
                        if sp.shopify_sku:
                            base_sku_code = sp.shopify_sku
                        else:
                            # Fallback: use product ID + variant ID if no SKU
                            base_sku_code = f'SKU-{sp.shopify_product_id}'
                            if sp.shopify_variant_id:
                                base_sku_code = f'{base_sku_code}-V{sp.shopify_variant_id}'

                        sku_code = self.generate_unique_code(base_sku_code, SKU)

                        # Create SKU
                        sku, s_created = SKU.objects.get_or_create(
                            code=sku_code,
                            defaults={
                                'product': product,
                                'name': sp.shopify_title[:255],
                                'base_price': sp.shopify_price or Decimal('0.00'),
                                'cost_price': sp.shopify_price or Decimal('0.00'),
                                'company': company,
                                'status': 'active',
                            }
                        )
                        if s_created:
                            created_skus += 1

                            # Create barcode if available
                            if sp.shopify_barcode:
                                try:
                                    barcode, b_created = SKUBarcode.objects.get_or_create(
                                        barcode_value=sp.shopify_barcode[:255],
                                        defaults={
                                            'sku': sku,
                                            'barcode_type': 'ean13',
                                            'is_primary': True,
                                            'label_title': sp.shopify_title[:255],
                                            'company': company,
                                            'status': 'active',
                                        }
                                    )
                                    if b_created:
                                        created_barcodes += 1
                                except Exception:
                                    pass  # Skip if barcode already exists

                        # Link to Shopify
                        sp.erp_product = product
                        sp.erp_sku = sku
                        sp.sync_status = 'synced'
                        sp.sync_error = ''
                        sp.save()

                        # Create/update inventory
                        qty = sp.shopify_inventory_quantity or 0
                        balance, b_created = InventoryBalance.objects.update_or_create(
                            sku=sku,
                            location=location,
                            company=company,
                            defaults={
                                'quantity_on_hand': qty,
                                'quantity_available': qty,
                                'quantity_reserved': 0,
                                'average_cost': sp.shopify_price or Decimal('0.00'),
                                'condition': 'new',
                                'status': 'active',
                            }
                        )
                        if b_created:
                            created_balances += 1

                        processed += 1

                except Exception as e:
                    errors += 1
                    error_msg = str(e)[:200]
                    self.stdout.write(
                        self.style.ERROR(f'  X Error syncing {sp.shopify_product_id}: {error_msg}')
                    )
                    
                    # Mark as error in Shopify product
                    sp.sync_status = 'error'
                    sp.sync_error = error_msg
                    sp.save()

            # Progress update
            self.stdout.write(f'  Progress: {processed}/{total} ({(processed/total*100):.1f}%)')

        # Final summary
        self.stdout.write(self.style.SUCCESS(f'\nSync Summary:'))
        self.stdout.write(f'  Products created: {created_products}')
        self.stdout.write(f'  SKUs created: {created_skus}')
        self.stdout.write(f'  Barcodes created: {created_barcodes}')
        self.stdout.write(f'  Inventory balances created: {created_balances}')
        self.stdout.write(f'  Total processed: {processed}')
        if errors > 0:
            self.stdout.write(self.style.WARNING(f'  Errors: {errors}'))

    def build_description(self, sp):
        """Build product description from Shopify data."""
        parts = []
        
        if sp.shopify_product_type:
            parts.append(f'Type: {sp.shopify_product_type}')
        
        if sp.shopify_vendor:
            parts.append(f'Vendor: {sp.shopify_vendor}')
        
        parts.append(f'Shopify ID: {sp.shopify_product_id}')
        
        if sp.shopify_variant_id:
            parts.append(f'Variant ID: {sp.shopify_variant_id}')
        
        return ' | '.join(parts)
