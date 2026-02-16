"""
Serializers for Sales API.
"""
from rest_framework import serializers
from .models import (
    SalesTransaction,
    SalesTransactionLine,
    ReturnTransaction,
    StoreFootTraffic,
    StaffShift,
)


class SalesTransactionLineSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source='sku.code', read_only=True)
    sku_name = serializers.CharField(source='sku.name', read_only=True)
    
    class Meta:
        model = SalesTransactionLine
        fields = [
            'id',
            'transaction',
            'line_number',
            'sku',
            'sku_code',
            'sku_name',
            'quantity',
            'unit_price',
            'discount_percent',
            'discount_amount',
            'line_total',
            'unit_cost',
            'is_returned',
            'return_reason',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SalesTransactionSerializer(serializers.ModelSerializer):
    store_code = serializers.CharField(source='store.code', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    cashier_name = serializers.CharField(source='cashier.username', read_only=True)
    lines = SalesTransactionLineSerializer(many=True, read_only=True)
    
    class Meta:
        model = SalesTransaction
        fields = [
            'id',
            'company',
            'transaction_number',
            'transaction_date',
            'sales_channel',
            'store',
            'store_code',
            'store_name',
            'register_number',
            'customer',
            'customer_type',
            'cashier',
            'cashier_name',
            'sales_associate',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'total_amount',
            'payment_method',
            'item_count',
            'processing_time_seconds',
            'campaign_code',
            'referral_source',
            'status',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReturnTransactionSerializer(serializers.ModelSerializer):
    store_code = serializers.CharField(source='store.code', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.username', read_only=True)
    
    class Meta:
        model = ReturnTransaction
        fields = [
            'id',
            'company',
            'return_number',
            'return_date',
            'original_transaction',
            'store',
            'store_code',
            'return_reason',
            'return_type',
            'refund_amount',
            'processed_by',
            'processed_by_name',
            'notes',
            'status',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class StoreFootTrafficSerializer(serializers.ModelSerializer):
    store_code = serializers.CharField(source='store.code', read_only=True)
    
    class Meta:
        model = StoreFootTraffic
        fields = [
            'id',
            'company',
            'store',
            'store_code',
            'date',
            'hour',
            'visitor_count',
            'entry_count',
            'exit_count',
            'transaction_count',
            'conversion_rate',
            'status',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class StaffShiftSerializer(serializers.ModelSerializer):
    store_code = serializers.CharField(source='store.code', read_only=True)
    employee_name = serializers.CharField(source='employee.username', read_only=True)
    
    class Meta:
        model = StaffShift
        fields = [
            'id',
            'company',
            'store',
            'store_code',
            'employee',
            'employee_name',
            'shift_date',
            'clock_in',
            'clock_out',
            'hours_worked',
            'hourly_rate',
            'labor_cost',
            'status',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
