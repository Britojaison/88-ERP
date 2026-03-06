"""
Management command to clean up all non-Shopify data from the ERP.
Keeps: Shopify-linked Products, SKUs, Barcodes, and all Shopify integration tables.
Deletes: Everything else (test/dummy products, SKUs, sales, inventory, etc.)
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Remove all non-Shopify data. Fresh ERP with only Shopify-synced master data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting.',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        skip_confirm = options['yes']

        self.stdout.write(self.style.WARNING('\n' + '=' * 70))
        self.stdout.write(self.style.WARNING(' ERP CLEANUP: Remove all non-Shopify data'))
        self.stdout.write(self.style.WARNING('=' * 70))

        # -- Step 0: Show current counts -----------------------------------
        self.stdout.write('\n[INFO] Current database state:')
        counts = self._get_counts()
        for label, count in counts.items():
            self.stdout.write(f'   {label}: {count}')

        # -- Step 1: Identify non-Shopify products & SKUs ------------------
        self.stdout.write('\n[SCAN] Identifying non-Shopify data...')

        with connection.cursor() as cursor:
            # Products linked to Shopify
            cursor.execute("""
                SELECT COUNT(DISTINCT erp_product_id)
                FROM shopify_product
                WHERE erp_product_id IS NOT NULL
            """)
            shopify_product_count = cursor.fetchone()[0]

            # SKUs linked to Shopify
            cursor.execute("""
                SELECT COUNT(DISTINCT erp_sku_id)
                FROM shopify_product
                WHERE erp_sku_id IS NOT NULL
            """)
            shopify_sku_count = cursor.fetchone()[0]

            # Total products & SKUs
            cursor.execute("SELECT COUNT(*) FROM mdm_product")
            total_products = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM mdm_sku")
            total_skus = cursor.fetchone()[0]

            # Non-Shopify counts
            non_shopify_products = total_products - shopify_product_count
            non_shopify_skus = total_skus - shopify_sku_count

        self.stdout.write(f'\n   Shopify-linked Products: {shopify_product_count}')
        self.stdout.write(f'   Shopify-linked SKUs:     {shopify_sku_count}')
        self.stdout.write(self.style.ERROR(
            f'   Non-Shopify Products to DELETE: {non_shopify_products}'
        ))
        self.stdout.write(self.style.ERROR(
            f'   Non-Shopify SKUs to DELETE:     {non_shopify_skus}'
        ))

        # -- Step 2: List all tables to truncate ---------------------------
        tables_to_truncate = [
            # Sales & Returns
            ('sales_transaction_line', 'Sales Transaction Lines'),
            ('sales_transaction', 'Sales Transactions'),
            ('sales_return_transaction', 'Return Transactions'),
            ('sales_store_foot_traffic', 'Store Foot Traffic'),
            ('sales_staff_shift', 'Staff Shifts'),

            # Inventory
            ('inv_movement', 'Inventory Movements'),
            ('inv_balance', 'Inventory Balances'),
            ('inv_goods_receipt_scan', 'Goods Receipt Scans'),
            ('inv_damaged_item', 'Damaged Items'),
            ('inv_product_journey_checkpoint', 'Product Journey Checkpoints'),
            ('inv_daily_stock_snapshot', 'Daily Stock Snapshots'),

            # Fabric
            ('mdm_fabric', 'Fabrics'),

            # Reporting
            ('report_execution', 'Report Executions'),
            ('analytics_snapshot', 'Analytics Snapshots'),

            # Numbering counters (reset sequences)
            ('num_counter', 'Numbering Counters'),

            # Search
            ('search_saved', 'Saved Searches'),

            # Metadata
            ('metadata_version', 'Metadata Versions'),
            ('config_sandbox', 'Configuration Sandboxes'),
            ('metadata_impact', 'Metadata Impact'),

            # Shopify logs (cleanup old logs, keeps core integration data)
            ('shopify_webhook_log', 'Shopify Webhook Logs'),
            ('shopify_sync_job', 'Shopify Sync Jobs'),
        ]

        self.stdout.write('\n[LIST] Tables to TRUNCATE (all rows removed):')
        for table, label in tables_to_truncate:
            with connection.cursor() as cursor:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    if count > 0:
                        self.stdout.write(
                            self.style.WARNING(f'   {label} ({table}): {count} rows')
                        )
                    else:
                        self.stdout.write(f'   {label} ({table}): 0 rows (already empty)')
                except Exception:
                    self.stdout.write(f'   {label} ({table}): table not found (skip)')

        # -- Confirmation --------------------------------------------------
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                '\n[OK] DRY RUN complete. No changes made.'
            ))
            return

        if not skip_confirm:
            self.stdout.write(self.style.WARNING(
                '\n[WARNING] This will PERMANENTLY delete the data listed above!'
            ))
            confirm = input('Type "CLEAN" to proceed: ')
            if confirm != 'CLEAN':
                self.stdout.write(self.style.ERROR('Aborted.'))
                return

        # -- Step 3: Execute cleanup ---------------------------------------
        self.stdout.write('\n[EXEC] Starting cleanup...\n')

        with connection.cursor() as cursor:
            # 3a. Truncate transactional tables
            for table, label in tables_to_truncate:
                try:
                    cursor.execute(f"TRUNCATE TABLE {table} CASCADE")
                    self.stdout.write(self.style.SUCCESS(f'   [OK] Truncated {label}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'   [ERR] {label}: {e}'))

            # 3b. Delete non-Shopify SKU Barcodes (via non-Shopify SKUs)
            cursor.execute("""
                DELETE FROM mdm_sku_barcode
                WHERE sku_id IN (
                    SELECT id FROM mdm_sku
                    WHERE id NOT IN (
                        SELECT DISTINCT erp_sku_id
                        FROM shopify_product
                        WHERE erp_sku_id IS NOT NULL
                    )
                )
            """)
            deleted_barcodes = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(
                f'   [OK] Deleted {deleted_barcodes} non-Shopify barcodes'
            ))

            # 3c. Delete non-Shopify SKUs
            cursor.execute("""
                DELETE FROM mdm_sku
                WHERE id NOT IN (
                    SELECT DISTINCT erp_sku_id
                    FROM shopify_product
                    WHERE erp_sku_id IS NOT NULL
                )
            """)
            deleted_skus = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(
                f'   [OK] Deleted {deleted_skus} non-Shopify SKUs'
            ))

            # 3d. Delete non-Shopify Products
            cursor.execute("""
                DELETE FROM mdm_product
                WHERE id NOT IN (
                    SELECT DISTINCT erp_product_id
                    FROM shopify_product
                    WHERE erp_product_id IS NOT NULL
                )
            """)
            deleted_products = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(
                f'   [OK] Deleted {deleted_products} non-Shopify Products'
            ))

            # 3e. Delete Styles not linked to any remaining product
            cursor.execute("""
                DELETE FROM mdm_style
                WHERE product_id NOT IN (
                    SELECT id FROM mdm_product
                )
            """)
            deleted_styles = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(
                f'   [OK] Deleted {deleted_styles} orphaned Styles'
            ))

            # 3f. Delete Vendors (all are test data)
            cursor.execute("DELETE FROM mdm_vendor")
            deleted_vendors = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(
                f'   [OK] Deleted {deleted_vendors} Vendors'
            ))

            # 3g. Delete Customers (sales already truncated, so all are orphans)
            cursor.execute("DELETE FROM mdm_customer")
            deleted_customers = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(
                f'   [OK] Deleted {deleted_customers} Customers'
            ))

        # -- Step 4: Final verification ------------------------------------
        self.stdout.write('\n[FINAL] Database state after cleanup:')
        counts = self._get_counts()
        for label, count in counts.items():
            self.stdout.write(f'   {label}: {count}')

        self.stdout.write(self.style.SUCCESS(
            '\n[DONE] Cleanup complete! Your ERP is now a fresh "Day 1" with only Shopify data.\n'
        ))

    def _get_counts(self):
        """Get counts for key tables."""
        tables = [
            ('Products', 'mdm_product'),
            ('SKUs', 'mdm_sku'),
            ('Barcodes', 'mdm_sku_barcode'),
            ('Fabrics', 'mdm_fabric'),
            ('Customers', 'mdm_customer'),
            ('Vendors', 'mdm_vendor'),
            ('Styles', 'mdm_style'),
            ('Sales Transactions', 'sales_transaction'),
            ('Sales Lines', 'sales_transaction_line'),
            ('Returns', 'sales_return_transaction'),
            ('Inventory Balances', 'inv_balance'),
            ('Inventory Movements', 'inv_movement'),
            ('Shopify Products (mapping)', 'shopify_product'),
        ]
        counts = {}
        with connection.cursor() as cursor:
            for label, table in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    counts[label] = cursor.fetchone()[0]
                except Exception:
                    counts[label] = 'N/A'
        return counts
