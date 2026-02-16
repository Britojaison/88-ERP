"""
Admin configuration for Sales models.
"""
from django.contrib import admin
from .models import (
    SalesTransaction,
    SalesTransactionLine,
    ReturnTransaction,
    StoreFootTraffic,
    StaffShift,
)


class SalesTransactionLineInline(admin.TabularInline):
    model = SalesTransactionLine
    extra = 0
    readonly_fields = ['created_at']


@admin.register(SalesTransaction)
class SalesTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'transaction_number',
        'transaction_date',
        'sales_channel',
        'store',
        'total_amount',
        'payment_method',
        'status',
    ]
    list_filter = ['sales_channel', 'payment_method', 'status', 'transaction_date']
    search_fields = ['transaction_number', 'store__code']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [SalesTransactionLineInline]


@admin.register(ReturnTransaction)
class ReturnTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'return_number',
        'return_date',
        'store',
        'return_type',
        'refund_amount',
        'status',
    ]
    list_filter = ['return_type', 'status', 'return_date']
    search_fields = ['return_number', 'store__code']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StoreFootTraffic)
class StoreFootTrafficAdmin(admin.ModelAdmin):
    list_display = ['store', 'date', 'hour', 'visitor_count', 'transaction_count', 'conversion_rate']
    list_filter = ['date', 'store']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StaffShift)
class StaffShiftAdmin(admin.ModelAdmin):
    list_display = ['employee', 'store', 'shift_date', 'hours_worked', 'labor_cost']
    list_filter = ['shift_date', 'store']
    search_fields = ['employee__username', 'store__code']
    readonly_fields = ['created_at', 'updated_at']
