"""
Management command to generate sample sales data.
Usage: python manage.py generate_sample_sales
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from datetime import datetime, timedelta
import random
from decimal import Decimal

from apps.mdm.models import Company, Location, User, SKU
from apps.sales.models import (
    SalesTransaction,
    SalesTransactionLine,
    ReturnTransaction,
    StoreFootTraffic,
    StaffShift,
)


class Command(BaseCommand):
    help = 'Generate sample sales data for testing and demonstration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days of data to generate (default: 30)',
        )
        parser.add_argument(
            '--transactions-per-day',
            type=int,
            default=50,
            help='Average transactions per store per day (default: 50)',
        )
        parser.add_argument(
            '--comprehensive',
            action='store_true',
            help='Generate comprehensive data for all report types (online, store, unified)',
        )

    def handle(self, *args, **options):
        days = options['days']
        transactions_per_day = options['transactions_per_day']
        comprehensive = options.get('comprehensive', False)

        self.stdout.write('Fetching required data...')
        
        # Get company
        company = Company.objects.filter(status='active').first()
        if not company:
            self.stdout.write(self.style.ERROR('No active company found. Please create a company first.'))
            return

        # Get users (cashiers) - moved before stores
        users = list(User.objects.filter(company=company, is_active=True))
        if not users:
            self.stdout.write(self.style.ERROR('No users found. Please create users first.'))
            return
        
        # Get stores
        stores = list(Location.objects.filter(
            company=company,
            location_type='store',
            status='active'
        ))
        if not stores:
            self.stdout.write(self.style.WARNING('No stores found. Creating sample stores...'))
            stores = self.create_sample_stores(company, users)

        # Get SKUs
        skus = list(SKU.objects.filter(company=company, status='active'))
        if not skus:
            self.stdout.write(self.style.ERROR('No SKUs found. Please create products and SKUs first.'))
            return

        self.stdout.write(f'Generating {days} days of sales data...')
        self.stdout.write(f'Stores: {len(stores)}, SKUs: {len(skus)}, Users: {len(users)}')
        if comprehensive:
            self.stdout.write(self.style.WARNING('Comprehensive mode: Generating data for ALL report types'))

        # Generate data
        total_transactions = 0
        total_returns = 0
        transaction_counter = 0

        for day_offset in range(days):
            date = timezone.now() - timedelta(days=day_offset)
            
            # Store transactions
            for store in stores:
                num_transactions = random.randint(
                    int(transactions_per_day * 0.7),
                    int(transactions_per_day * 1.3)
                )
                
                for _ in range(num_transactions):
                    transaction_counter += 1
                    txn = self.create_transaction(
                        company, store, users, skus, date, transaction_counter, 'store'
                    )
                    total_transactions += 1
                
                # Generate foot traffic data
                self.create_foot_traffic(company, store, date, num_transactions, users)
                
                # Generate staff shifts
                self.create_staff_shifts(company, store, users, date)
            
            # Online transactions (comprehensive mode or always generate some)
            online_transactions = int(transactions_per_day * 0.3) if comprehensive else int(transactions_per_day * 0.2)
            for _ in range(online_transactions):
                transaction_counter += 1
                txn = self.create_transaction(
                    company, None, users, skus, date, transaction_counter, 'online'
                )
                total_transactions += 1
            
            # Mobile app transactions (comprehensive mode only)
            if comprehensive:
                mobile_transactions = int(transactions_per_day * 0.15)
                for _ in range(mobile_transactions):
                    transaction_counter += 1
                    txn = self.create_transaction(
                        company, None, users, skus, date, transaction_counter, 'mobile'
                    )
                    total_transactions += 1
                
                # Marketplace transactions (comprehensive mode only)
                marketplace_transactions = int(transactions_per_day * 0.1)
                for _ in range(marketplace_transactions):
                    transaction_counter += 1
                    txn = self.create_transaction(
                        company, None, users, skus, date, transaction_counter, 'marketplace'
                    )
                    total_transactions += 1
            
            # Generate returns (5% of transactions)
            if random.random() < 0.05:
                transaction_counter += 1
                self.create_return(company, stores[0] if stores else None, users, date, transaction_counter)
                total_returns += 1

        self.stdout.write(self.style.SUCCESS(
            f'Successfully generated {total_transactions} transactions and {total_returns} returns'
        ))

    def create_sample_stores(self, company, users):
        """Create sample store locations"""
        from apps.mdm.models import BusinessUnit
        
        # Get first user for created_by/updated_by
        user = users[0] if users else None
        if not user:
            self.stdout.write(self.style.ERROR('Cannot create stores without users. Please create a user first.'))
            return []
        
        # Create business unit if needed
        bu = BusinessUnit.objects.filter(company=company).first()
        if not bu:
            bu = BusinessUnit.objects.create(
                company=company,
                code='RETAIL',
                name='Retail Operations',
                status='active',
                created_by=user,
                updated_by=user,
            )
        
        stores = []
        store_data = [
            ('STORE-NYC', 'New York Flagship'),
            ('STORE-LA', 'Los Angeles Store'),
            ('STORE-SF', 'San Francisco Store'),
        ]
        
        for code, name in store_data:
            # Check if store already exists
            existing = Location.objects.filter(company=company, code=code).first()
            if existing:
                stores.append(existing)
                continue
                
            store = Location.objects.create(
                company=company,
                code=code,
                name=name,
                location_type='store',
                business_unit=bu,
                is_inventory_location=True,
                status='active',
                created_by=user,
                updated_by=user,
            )
            stores.append(store)
        
        return stores

    def create_transaction(self, company, store, users, skus, date, counter, channel='store'):
        """Create a single sales transaction"""
        # Random time during business hours (9 AM - 9 PM for store, 24/7 for online)
        if channel == 'store':
            hour = random.randint(9, 20)
        else:
            hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        transaction_date = date.replace(hour=hour, minute=minute, second=0)
        
        # Payment method based on channel
        if channel == 'store':
            payment_methods = ['card'] * 5 + ['cash'] * 3 + ['upi'] * 2
        else:
            payment_methods = ['card'] * 6 + ['upi'] * 3 + ['wallet'] * 1
        payment_method = random.choice(payment_methods)
        
        # Random cashier (only for store)
        cashier = random.choice(users) if channel == 'store' else None
        
        # Generate unique transaction number with counter and UUID suffix
        import uuid
        unique_suffix = str(uuid.uuid4())[:8]
        location_code = store.code if store else channel.upper()
        txn_number = f"TXN-{date.strftime('%Y%m%d')}-{location_code}-{counter:04d}-{unique_suffix}"
        
        # Create transaction
        transaction = SalesTransaction.objects.create(
            company=company,
            transaction_number=txn_number,
            transaction_date=transaction_date,
            sales_channel=channel,
            store=store if channel == 'store' else None,
            register_number=f"REG-{random.randint(1, 5)}" if channel == 'store' else '',
            cashier=cashier,
            customer_type=random.choice(['walk-in', 'member', 'vip']),
            subtotal=Decimal('0'),
            tax_amount=Decimal('0'),
            discount_amount=Decimal('0'),
            total_amount=Decimal('0'),
            payment_method=payment_method,
            item_count=0,
            processing_time_seconds=random.randint(60, 300) if channel == 'store' else random.randint(30, 120),
            status='active',
            created_by=cashier or users[0],
            updated_by=cashier or users[0],
        )
        
        # Add line items (1-5 items per transaction, online tends to have more)
        if channel == 'online' or channel == 'mobile' or channel == 'marketplace':
            num_items = random.randint(1, 7)  # Online orders tend to be larger
        else:
            num_items = random.randint(1, 5)
        
        subtotal = Decimal('0')
        item_count = 0
        
        for line_num in range(1, num_items + 1):
            sku = random.choice(skus)
            quantity = random.randint(1, 3)
            unit_price = Decimal(sku.base_price)
            unit_cost = Decimal(sku.cost_price)
            
            # Random discount (online has more discounts)
            if channel in ['online', 'mobile', 'marketplace']:
                discount_percent = Decimal(random.choice([0, 0, 5, 10, 15, 20, 25]))
            else:
                discount_percent = Decimal(random.choice([0, 0, 0, 5, 10, 15, 20]))
            discount_amount = (unit_price * quantity * discount_percent / 100).quantize(Decimal('0.01'))
            line_total = (unit_price * quantity - discount_amount).quantize(Decimal('0.01'))
            
            SalesTransactionLine.objects.create(
                transaction=transaction,
                line_number=line_num,
                sku=sku,
                quantity=quantity,
                unit_price=unit_price,
                discount_percent=discount_percent,
                discount_amount=discount_amount,
                line_total=line_total,
                unit_cost=unit_cost,
                status='active',
                created_by=cashier or users[0],
                updated_by=cashier or users[0],
            )
            
            subtotal += line_total
            item_count += quantity
        
        # Update transaction totals
        tax_amount = (subtotal * Decimal('0.08')).quantize(Decimal('0.01'))  # 8% tax
        total_amount = subtotal + tax_amount
        
        transaction.subtotal = subtotal
        transaction.tax_amount = tax_amount
        transaction.total_amount = total_amount
        transaction.item_count = item_count
        transaction.save()
        
        return transaction

    def create_foot_traffic(self, company, store, date, transaction_count, users):
        """Create hourly foot traffic data"""
        # Business hours: 9 AM - 9 PM
        for hour in range(9, 21):
            # Peak hours: 12-2 PM and 6-8 PM
            if hour in [12, 13, 18, 19]:
                visitor_count = random.randint(40, 60)
            else:
                visitor_count = random.randint(20, 40)
            
            hour_transactions = transaction_count // 12  # Distribute evenly
            conversion_rate = (hour_transactions / visitor_count * 100) if visitor_count > 0 else 0
            
            user = random.choice(users) if users else None
            if not user:
                continue
            
            StoreFootTraffic.objects.create(
                company=company,
                store=store,
                date=date.date(),
                hour=hour,
                visitor_count=visitor_count,
                entry_count=visitor_count,
                exit_count=visitor_count,
                transaction_count=hour_transactions,
                conversion_rate=Decimal(str(conversion_rate)).quantize(Decimal('0.01')),
                status='active',
                created_by=user,
                updated_by=user,
            )

    def create_staff_shifts(self, company, store, users, date):
        """Create staff shift records"""
        # 2-4 staff members per day
        num_staff = random.randint(2, 4)
        staff_members = random.sample(users, min(num_staff, len(users)))
        
        for employee in staff_members:
            # 8-hour shifts
            clock_in_hour = random.choice([9, 13])  # Morning or afternoon shift
            clock_in = date.replace(hour=clock_in_hour, minute=0, second=0)
            clock_out = clock_in + timedelta(hours=8)
            
            hours_worked = Decimal('8.0')
            hourly_rate = Decimal(random.choice(['15.00', '18.00', '20.00', '25.00']))
            labor_cost = hours_worked * hourly_rate
            
            StaffShift.objects.create(
                company=company,
                store=store,
                employee=employee,
                shift_date=date.date(),
                clock_in=clock_in,
                clock_out=clock_out,
                hours_worked=hours_worked,
                hourly_rate=hourly_rate,
                labor_cost=labor_cost,
                status='active',
                created_by=employee,
                updated_by=employee,
            )

    def create_return(self, company, store, users, date, counter):
        """Create a return transaction"""
        # Ensure we have a valid user and store
        if not users or not store:
            return None
        
        import uuid
        unique_suffix = str(uuid.uuid4())[:8]
        return_number = f"RET-{date.strftime('%Y%m%d')}-{store.code}-{counter:06d}-{unique_suffix}"
        
        reasons = [
            'Size issue',
            'Defective product',
            'Changed mind',
            'Wrong item received',
            'Quality issue',
        ]
        
        ReturnTransaction.objects.create(
            company=company,
            return_number=return_number,
            return_date=date,
            store=store,
            return_reason=random.choice(reasons),
            return_type=random.choice(['refund', 'exchange', 'store_credit']),
            refund_amount=Decimal(random.randint(20, 200)),
            processed_by=random.choice(users),
            status='active',
            created_by=random.choice(users),
            updated_by=random.choice(users),
        )
