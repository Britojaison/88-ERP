"""
API Views for Sales and POS.
"""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Avg, Count, F, Q
from django.db.models.functions import TruncDate, TruncHour
from datetime import datetime, timedelta
from .models import (
    SalesTransaction,
    SalesTransactionLine,
    ReturnTransaction,
    StoreFootTraffic,
    StaffShift,
)
from .serializers import (
    SalesTransactionSerializer,
    SalesTransactionLineSerializer,
    ReturnTransactionSerializer,
    StoreFootTrafficSerializer,
    StaffShiftSerializer,
)


class SalesTransactionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SalesTransactionSerializer

    def get_queryset(self):
        queryset = SalesTransaction.objects.filter(
            company_id=self.request.user.company_id,
            status='active'
        ).select_related('store', 'cashier', 'customer')
        
        # Filters
        channel = self.request.query_params.get('channel')
        store = self.request.query_params.get('store')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        transaction_number = self.request.query_params.get('transaction_number')
        
        if channel:
            queryset = queryset.filter(sales_channel=channel)
        if store:
            queryset = queryset.filter(store_id=store)
        if date_from:
            queryset = queryset.filter(transaction_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(transaction_date__lte=date_to)
        if transaction_number:
            queryset = queryset.filter(transaction_number=transaction_number)
        
        return queryset.order_by('-transaction_date')

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Get sales summary statistics including Shopify orders"""
        from apps.integrations.shopify_models import ShopifyOrder
        
        # POS Stats
        pos_summary = self.get_queryset().aggregate(
            total_sales=Sum('total_amount'),
            total_transactions=Count('id'),
            total_items=Sum('item_count'),
        )
        
        # Shopify Stats
        from apps.integrations.shopify_models import ShopifyOrder
        shopify_qs = ShopifyOrder.objects.filter(
            store__company_id=request.user.company_id
        )
        
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            shopify_qs = shopify_qs.filter(processed_at__gte=date_from)
        if date_to:
            shopify_qs = shopify_qs.filter(processed_at__lte=date_to)

        shopify_summary = shopify_qs.aggregate(
            total_sales=Sum('total_price'),
            total_transactions=Count('id'),
        )
        
        # Returns Stats
        from apps.sales.models import ReturnTransaction
        returns_qs = ReturnTransaction.objects.filter(
            company_id=request.user.company_id,
            status='active'
        )
        if date_from:
            returns_qs = returns_qs.filter(return_date__gte=date_from)
        if date_to:
            returns_qs = returns_qs.filter(return_date__lte=date_to)
            
        returns_summary = returns_qs.aggregate(
            total_refunds=Sum('refund_amount'),
            count=Count('id')
        )
        
        total_sales = float(pos_summary['total_sales'] or 0) + float(shopify_summary['total_sales'] or 0)
        total_transactions = (pos_summary['total_transactions'] or 0) + (shopify_summary['total_transactions'] or 0)
        total_refunds = float(returns_summary['total_refunds'] or 0)
        
        return Response({
            'total_sales': total_sales,
            'net_sales': total_sales - total_refunds,
            'total_transactions': total_transactions,
            'avg_transaction_value': total_sales / total_transactions if total_transactions > 0 else 0,
            'total_items': (pos_summary['total_items'] or 0), 
            'pos_sales': float(pos_summary['total_sales'] or 0),
            'online_sales': float(shopify_summary['total_sales'] or 0),
            'total_refunds': total_refunds,
            'return_count': returns_summary['count'] or 0,
        })

    @action(detail=False, methods=['get'], url_path='by-channel')
    def by_channel(self, request):
        """Sales breakdown by channel (POS + Shopify)"""
        from apps.integrations.shopify_models import ShopifyOrder
        
        # 1. POS Channels
        pos_by_channel = list(self.get_queryset().values('sales_channel').annotate(
            total_sales=Sum('total_amount'),
            transaction_count=Count('id'),
        ))
        
        # Ensure floating point
        for c in pos_by_channel:
            c['total_sales'] = float(c['total_sales'] or 0)
            c['avg_value'] = c['total_sales'] / c['transaction_count'] if c['transaction_count'] > 0 else 0
            
        # 2. Shopify Channel
        shopify_stats = ShopifyOrder.objects.filter(
            store__company_id=request.user.company_id
        ).aggregate(
            total_sales=Sum('total_price'),
            transaction_count=Count('id'),
        )
        
        online_rev = float(shopify_stats['total_sales'] or 0)
        online_count = shopify_stats['transaction_count'] or 0
        
        # Merge Shopify into 'online' if exists, else add new
        found = False
        for c in pos_by_channel:
            if c['sales_channel'] == 'online':
                c['total_sales'] += online_rev
                c['transaction_count'] += online_count
                c['avg_value'] = c['total_sales'] / c['transaction_count'] if c['transaction_count'] > 0 else 0
                found = True
                break
        
        if not found and online_count > 0:
            pos_by_channel.append({
                'sales_channel': 'online',
                'total_sales': online_rev,
                'transaction_count': online_count,
                'avg_value': online_rev / online_count if online_count > 0 else 0
            })
            
        return Response(sorted(pos_by_channel, key=lambda x: x['total_sales'], reverse=True))

    @action(detail=False, methods=['get'], url_path='by-store')
    def by_store(self, request):
        """Sales breakdown by store"""
        queryset = self.get_queryset()
        
        by_store = queryset.values(
            'store__code',
            'store__name'
        ).annotate(
            total_sales=Sum('total_amount'),
            transaction_count=Count('id'),
            avg_value=Avg('total_amount'),
        ).order_by('-total_sales')
        
        return Response(by_store)

    @action(detail=False, methods=['get'], url_path='daily')
    def daily(self, request):
        """Daily sales trend"""
        queryset = self.get_queryset()
        
        daily = queryset.annotate(
            date=TruncDate('transaction_date')
        ).values('date').annotate(
            total_sales=Sum('total_amount'),
            transaction_count=Count('id'),
        ).order_by('date')
        
        return Response(daily)

    @action(detail=False, methods=['get'], url_path='channel-comparison')
    def channel_comparison(self, request):
        """Compare Store vs Online sales over time"""
        from datetime import timedelta, date as date_type
        from django.utils import timezone
        
        end_date_str = request.query_params.get('end_date')
        start_date_str = request.query_params.get('start_date')

        if end_date_str:
            end_date = date_type.fromisoformat(end_date_str)
        else:
            end_date = timezone.localtime().date()

        if start_date_str:
            start_date = date_type.fromisoformat(start_date_str)
        else:
            start_date = end_date - timedelta(days=30)
            
        day_count = (end_date - start_date).days + 1
            
        queryset = self.get_queryset().filter(transaction_date__gte=start_date, transaction_date__lte=end_date + timedelta(days=1))
        
        daily_sales = queryset.annotate(
            date=TruncDate('transaction_date')
        ).values('date', 'sales_channel').annotate(
            total_amount=Sum('total_amount'),
        ).order_by('date')
        
        date_map = {}
        for d in range(day_count):
            date_str = (start_date + timedelta(days=d)).strftime('%Y-%m-%d')
            date_map[date_str] = {'date': date_str, 'store': 0, 'online': 0}
            
        # POS Transactions
        for sale in daily_sales:
            if not sale['date']:
                continue
            date_str = sale['date'].strftime('%Y-%m-%d')
            if date_str not in date_map:
                continue
            channel = sale['sales_channel']
            if channel == SalesTransaction.CHANNEL_STORE:
                date_map[date_str]['store'] += float(sale['total_amount'] or 0)
            else:
                date_map[date_str]['online'] += float(sale['total_amount'] or 0)
        
        # Shopify Orders (Direct sync)
        from apps.integrations.shopify_models import ShopifyOrder
        # Use timezone aware date logic for Shopify filtering
        shopify_daily = ShopifyOrder.objects.filter(
            store__company_id=request.user.company_id,
            processed_at__gte=start_date,
            processed_at__lt=end_date + timedelta(days=1)
        ).annotate(
            date=TruncDate('processed_at')
        ).values('date').annotate(
            total=Sum('total_price')
        )
        
        for sale in shopify_daily:
            if not sale['date']:
                continue
            date_str = sale['date'].strftime('%Y-%m-%d')
            if date_str in date_map:
                date_map[date_str]['online'] += float(sale['total'] or 0)
                
        data = sorted(list(date_map.values()), key=lambda x: x['date'])
        
        return Response(data)

    @action(detail=False, methods=['post'], url_path='pos-checkout')
    def pos_checkout(self, request):
        """Process a POS checkout with discounts, customer data, and inventory deduction."""
        from django.db import transaction
        from apps.mdm.models import SKU, Location, Customer
        from apps.inventory.models import InventoryBalance
        from django.utils import timezone
        from decimal import Decimal, ROUND_HALF_UP
        import uuid

        store_id = request.data.get('store_id')
        items = request.data.get('items', [])
        payment_method = request.data.get('payment_method', SalesTransaction.PAYMENT_METHOD_CASH)
        customer_mobile = request.data.get('customer_mobile', '').strip()
        customer_email = request.data.get('customer_email', '').strip()
        bill_discount_percent = Decimal(str(request.data.get('bill_discount_percent', 0)))

        if not store_id or not items:
            return Response({'error': 'store_id and items are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            store = Location.objects.get(id=store_id, company_id=request.user.company_id)
        except Location.DoesNotExist:
            return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        # Customer handling: optional, lookup by phone if provided
        customer = None
        if customer_mobile:
            customer, created = Customer.objects.get_or_create(
                company_id=request.user.company_id,
                phone=customer_mobile,
                defaults={
                    'name': 'Walk-in Customer',
                    'code': f"CUST-{customer_mobile[-6:]}",
                    'email': customer_email,
                }
            )
            # Update email if it wasn't previously set
            if not created and customer_email and not customer.email:
                customer.email = customer_email
                customer.save()

        try:
            with transaction.atomic():
                subtotal = Decimal('0')
                total_line_discounts = Decimal('0')
                item_count = 0
                receipt_num = f"POS-{uuid.uuid4().hex[:8].upper()}"

                # 1. Create Transaction Shell
                txn = SalesTransaction.objects.create(
                    company_id=request.user.company_id,
                    transaction_number=receipt_num,
                    transaction_date=timezone.now(),
                    sales_channel=SalesTransaction.CHANNEL_STORE,
                    store=store,
                    customer=customer,
                    customer_type=SalesTransaction.CUSTOMER_TYPE_WALKIN if not customer else SalesTransaction.CUSTOMER_TYPE_MEMBER,
                    cashier=request.user,
                    subtotal=0,
                    total_amount=0,
                    payment_method=payment_method,
                )

                # 2. Process Items with Mix & Match Offers
                line_data = []
                offer_buckets = {'b1g1': [], 'b2g1': [], 'b3g1': []}
                
                # Fetch all SKUs and build initial line measurements
                for idx, item in enumerate(items):
                    try:
                        sku = SKU.objects.get(id=item['sku_id'], company_id=request.user.company_id)
                    except SKU.DoesNotExist:
                        raise Exception(f"SKU {item.get('sku_id')} not found")

                    quantity = int(item.get('quantity', 1))
                    unit_price = Decimal(str(item.get('unit_price', sku.base_price)))
                    item_discount_pct = Decimal(str(item.get('discount_percent', 0)))
                    
                    gross_total = (unit_price * quantity).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    
                    entry = {
                        'idx': idx + 1,
                        'sku': sku,
                        'quantity': quantity,
                        'unit_price': unit_price,
                        'discount_percent': item_discount_pct,
                        'gross_total': gross_total,
                        'offer_discount': Decimal('0'),
                        'manual_discount': Decimal('0'),
                    }
                    line_data.append(entry)
                    
                # Finalize lines and deduct inventory
                for entry in line_data:
                    sku = entry['sku']
                    quantity = entry['quantity']
                    
                    # Manual discount applied ON TOP of remaining part
                    entry['manual_discount'] = ((entry['gross_total'] - entry['offer_discount']) * entry['discount_percent'] / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    
                    total_line_discount = entry['offer_discount'] + entry['manual_discount']
                    line_total = entry['gross_total'] - total_line_discount

                    # Deduct inventory
                    inv_balance, _ = InventoryBalance.objects.get_or_create(
                        company_id=request.user.company_id,
                        sku=sku,
                        location=store,
                        defaults={'quantity_on_hand': 0, 'quantity_reserved': 0, 'quantity_available': 0}
                    )
                    inv_balance.quantity_on_hand -= quantity
                    inv_balance.quantity_available = inv_balance.quantity_on_hand - inv_balance.quantity_reserved
                    inv_balance.save()

                    SalesTransactionLine.objects.create(
                        transaction=txn,
                        line_number=entry['idx'],
                        sku=sku,
                        quantity=quantity,
                        unit_price=entry['unit_price'],
                        discount_percent=entry['discount_percent'],
                        discount_amount=total_line_discount,
                        line_total=line_total,
                        unit_cost=sku.cost_price,
                    )

                    subtotal += entry['gross_total']
                    total_line_discounts += total_line_discount
                    item_count += quantity

                # 3. Apply bill-level discount on top of line discounts
                after_line_discounts = subtotal - total_line_discounts
                bill_discount_amt = Decimal('0')
                if bill_discount_percent > 0:
                    bill_discount_amt = (after_line_discounts * bill_discount_percent / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

                total_discount = total_line_discounts + bill_discount_amt
                final_amount = subtotal - total_discount

                txn.subtotal = subtotal
                txn.discount_amount = total_discount
                txn.total_amount = final_amount
                txn.item_count = item_count
                txn.save()

            data = self.get_serializer(txn).data
            data['receipt_number'] = receipt_num
            return Response(data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)



class ReturnTransactionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReturnTransactionSerializer

    def get_queryset(self):
        return ReturnTransaction.objects.filter(
            company_id=self.request.user.company_id,
            status='active'
        ).select_related('store', 'processed_by').order_by('-return_date')

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)

    @action(detail=False, methods=['post'], url_path='process')
    def process_return(self, request):
        """Process a POS return."""
        from django.db import transaction
        from apps.mdm.models import Location
        from apps.inventory.models import InventoryBalance
        from apps.sales.models import SalesTransaction, SalesTransactionLine, ReturnTransaction
        import uuid
        from django.utils import timezone
        from decimal import Decimal

        store_id = request.data.get('store_id')
        transaction_id = request.data.get('original_transaction_id')
        items = request.data.get('items', [])
        return_type = request.data.get('return_type', ReturnTransaction.RETURN_TYPE_REFUND)

        if not store_id or not transaction_id or not items:
            return Response({'error': 'store_id, original_transaction_id, and items are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            store = Location.objects.get(id=store_id, company_id=request.user.company_id)
            try:
                orig_tx = SalesTransaction.objects.get(id=transaction_id, company_id=request.user.company_id)
            except ValueError:
                orig_tx = SalesTransaction.objects.get(transaction_number=transaction_id, company_id=request.user.company_id)
        except (Location.DoesNotExist, SalesTransaction.DoesNotExist):
            return Response({'error': 'Store or Transaction not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                total_refund = Decimal('0')
                return_number = f"RET-{uuid.uuid4().hex[:8].upper()}"

                ret_tx = ReturnTransaction.objects.create(
                    company_id=request.user.company_id,
                    return_number=return_number,
                    return_date=timezone.now(),
                    original_transaction=orig_tx,
                    store=store,
                    return_reason='Multiple reasons' if len(items) > 1 else items[0].get('return_reason', 'Customer requested'),
                    return_type=return_type,
                    refund_amount=0,
                    processed_by=request.user,
                )

                for item in items:
                    line_id = item.get('line_id')
                    reason = item.get('return_reason', 'Customer requested')
                    condition = item.get('condition', 'sellable')

                    try:
                        line = SalesTransactionLine.objects.get(id=line_id, transaction=orig_tx)
                    except SalesTransactionLine.DoesNotExist:
                        return Response({'error': f"Line item {line_id} not found"}, status=status.HTTP_400_BAD_REQUEST)

                    if line.is_returned:
                        continue
                    
                    line.is_returned = True
                    line.return_reason = reason
                    line.save()

                    total_refund += line.line_total

                    if condition == 'sellable':
                        inv_balance, _ = InventoryBalance.objects.get_or_create(
                            company_id=request.user.company_id,
                            sku=line.sku,
                            location=store,
                            defaults={'quantity_on_hand': 0, 'quantity_reserved': 0, 'quantity_available': 0}
                        )
                        inv_balance.quantity_on_hand += line.quantity
                        inv_balance.quantity_available = inv_balance.quantity_on_hand - inv_balance.quantity_reserved
                        inv_balance.save()

                ret_tx.refund_amount = total_refund
                ret_tx.save()

                return Response({
                    'message': 'Return processed successfully',
                    'return_number': return_number,
                    'refund_amount': total_refund
                }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class StoreFootTrafficViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StoreFootTrafficSerializer

    def get_queryset(self):
        return StoreFootTraffic.objects.filter(
            company_id=self.request.user.company_id,
            status='active'
        ).select_related('store').order_by('-date', 'hour')

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)


class StaffShiftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StaffShiftSerializer

    def get_queryset(self):
        return StaffShift.objects.filter(
            company_id=self.request.user.company_id,
            status='active'
        ).select_related('store', 'employee').order_by('-shift_date')

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
