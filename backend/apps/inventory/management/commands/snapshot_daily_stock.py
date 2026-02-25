"""
Management command to capture daily stock snapshots.
Run this via cron/scheduler at end of day (e.g. 11:59pm):
    python manage.py snapshot_daily_stock

Or at start of day to capture opening stock (e.g. 12:01am):
    python manage.py snapshot_daily_stock --opening

Safe to run multiple times — uses update_or_create.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Sum, Q
from decimal import Decimal
from datetime import timedelta
from apps.inventory.models import InventoryBalance, DailyStockSnapshot
from apps.sales.models import SalesTransactionLine, SalesTransaction
from apps.mdm.models import Company


class Command(BaseCommand):
    help = 'Capture daily stock snapshots for all SKUs at all locations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Date to snapshot (YYYY-MM-DD). Defaults to today.',
        )
        parser.add_argument(
            '--opening',
            action='store_true',
            help='Only set opening stock (run at start of day)',
        )

    def handle(self, *args, **options):
        target_date_str = options.get('date')
        opening_only = options.get('opening', False)

        if target_date_str:
            from datetime import datetime
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        else:
            target_date = timezone.now().date()

        companies = Company.objects.filter(status='active')
        total_created = 0
        total_updated = 0

        for company in companies:
            # Get all current inventory balances
            balances = InventoryBalance.objects.filter(
                company=company,
                status='active',
            ).select_related('sku', 'location')

            for balance in balances:
                # Calculate units sold today
                units_sold = SalesTransactionLine.objects.filter(
                    transaction__company=company,
                    transaction__store=balance.location,
                    sku=balance.sku,
                    transaction__transaction_date__date=target_date,
                    transaction__status='active',
                ).aggregate(
                    total=Sum('quantity')
                )['total'] or Decimal('0')

                # Get previous day's closing stock as today's opening
                previous_snapshot = DailyStockSnapshot.objects.filter(
                    company=company,
                    sku=balance.sku,
                    location=balance.location,
                    snapshot_date=target_date - timedelta(days=1),
                ).first()

                if previous_snapshot:
                    opening = previous_snapshot.closing_stock
                else:
                    # First snapshot ever — use current balance + sold items as opening estimate
                    opening = balance.quantity_on_hand + units_sold

                closing = balance.quantity_on_hand

                defaults = {
                    'closing_stock': closing,
                    'units_sold': units_sold,
                }

                if opening_only:
                    defaults = {
                        'opening_stock': float(balance.quantity_on_hand),
                    }
                else:
                    defaults['opening_stock'] = opening

                snapshot, created = DailyStockSnapshot.objects.update_or_create(
                    company=company,
                    snapshot_date=target_date,
                    sku=balance.sku,
                    location=balance.location,
                    defaults=defaults,
                )

                if created:
                    total_created += 1
                else:
                    total_updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Stock snapshot for {target_date}: {total_created} created, {total_updated} updated'
            )
        )
