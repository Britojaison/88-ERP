from django.contrib import admin
from .models import InventoryBalance, InventoryMovement


@admin.register(InventoryBalance)
class InventoryBalanceAdmin(admin.ModelAdmin):
    list_display = ['sku', 'location', 'quantity_on_hand', 'quantity_reserved', 'quantity_available', 'condition', 'company', 'status']
    search_fields = ['sku__code', 'location__code']
    list_filter = ['company', 'location', 'condition', 'status']


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ['movement_date', 'movement_type', 'sku', 'from_location', 'to_location', 'quantity', 'status']
    search_fields = ['sku__code', 'reference_number']
    list_filter = ['movement_type', 'movement_date', 'status']
    readonly_fields = ['movement_type', 'movement_date', 'sku', 'from_location', 'to_location', 'quantity', 'unit_cost', 'total_cost', 'document', 'reference_number']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
