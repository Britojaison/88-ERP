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
