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
        
        if channel:
            queryset = queryset.filter(sales_channel=channel)
        if store:
            queryset = queryset.filter(store_id=store)
        if date_from:
            queryset = queryset.filter(transaction_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(transaction_date__lte=date_to)
        
        return queryset.order_by('-transaction_date')

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Get sales summary statistics"""
        queryset = self.get_queryset()
        
        summary = queryset.aggregate(
            total_sales=Sum('total_amount'),
            total_transactions=Count('id'),
            avg_transaction_value=Avg('total_amount'),
            total_items=Sum('item_count'),
        )
        
        return Response(summary)

    @action(detail=False, methods=['get'], url_path='by-channel')
    def by_channel(self, request):
        """Sales breakdown by channel"""
        queryset = self.get_queryset()
        
        by_channel = queryset.values('sales_channel').annotate(
            total_sales=Sum('total_amount'),
            transaction_count=Count('id'),
            avg_value=Avg('total_amount'),
        ).order_by('-total_sales')
        
        return Response(by_channel)

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
        """Compare Store vs Online sales over time (last 30 days)"""
        from datetime import timedelta
        from django.utils import timezone
        
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        
        queryset = self.get_queryset().filter(transaction_date__gte=thirty_days_ago)
        
        daily_sales = queryset.annotate(
            date=TruncDate('transaction_date')
        ).values('date', 'sales_channel').annotate(
            total_amount=Sum('total_amount'),
        ).order_by('date')
        
        date_map = {}
        for d in range(31):
            date_str = (thirty_days_ago + timedelta(days=d)).strftime('%Y-%m-%d')
            date_map[date_str] = {'date': date_str, 'store': 0, 'online': 0}
            
        for sale in daily_sales:
            if not sale['date']:
                continue
            date_str = sale['date'].strftime('%Y-%m-%d')
            channel = sale['sales_channel']
            if channel == SalesTransaction.CHANNEL_STORE:
                date_map[date_str]['store'] += float(sale['total_amount'] or 0)
            else:
                date_map[date_str]['online'] += float(sale['total_amount'] or 0)
                
        data = sorted(list(date_map.values()), key=lambda x: x['date'])
        
        return Response(data)

    @action(detail=False, methods=['post'], url_path='pos-checkout')
    def pos_checkout(self, request):
        """Process a POS checkout. Deducts inventory and records sale."""
        from django.db import transaction
        from apps.mdm.models import SKU, Location, Customer
        from apps.inventory.models import InventoryBalance
        from django.utils import timezone
        import uuid

        store_id = request.data.get('store_id')
        items = request.data.get('items', [])
        payment_method = request.data.get('payment_method', SalesTransaction.PAYMENT_METHOD_CASH)
        customer_mobile = request.data.get('customer_mobile')
        
        if not store_id or not items:
            return Response({'error': 'store_id and items are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            store = Location.objects.get(id=store_id, company_id=request.user.company_id)
        except Location.DoesNotExist:
            return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        customer = None
        if customer_mobile:
            customer, _ = Customer.objects.get_or_create(
                company_id=request.user.company_id,
                phone=customer_mobile,
                defaults={'name': 'Walk-in Customer'}
            )

        try:
            with transaction.atomic():
                total_amount = 0
                subtotal = 0
                item_count = 0

                # 1. Create Transaction Shell
                txn = SalesTransaction.objects.create(
                    company_id=request.user.company_id,
                    transaction_number=f"POS-{uuid.uuid4().hex[:8].upper()}",
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

                # 2. Process Items
                for idx, item in enumerate(items):
                    try:
                        sku = SKU.objects.get(id=item['sku_id'], company_id=request.user.company_id)
                    except SKU.DoesNotExist:
                        raise Exception(f"SKU {item.get('sku_id')} not found")

                    quantity = int(item.get('quantity', 1))
                    unit_price = float(item.get('unit_price', sku.base_price))
                    line_total = quantity * unit_price

                    # deduct inventory
                    inv_balance, _ = InventoryBalance.objects.get_or_create(
                        company_id=request.user.company_id,
                        sku=sku,
                        location=store,
                        defaults={'quantity': 0, 'reserved_quantity': 0}
                    )
                    
                    inv_balance.quantity -= quantity
                    inv_balance.save()

                    SalesTransactionLine.objects.create(
                        transaction=txn,
                        line_number=idx + 1,
                        sku=sku,
                        quantity=quantity,
                        unit_price=unit_price,
                        line_total=line_total,
                        unit_cost=sku.cost_price,
                    )

                    subtotal += line_total
                    item_count += quantity

                txn.subtotal = subtotal
                txn.total_amount = subtotal
                txn.item_count = item_count
                txn.save()

            serializer = self.get_serializer(txn)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
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
