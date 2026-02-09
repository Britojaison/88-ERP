from django.contrib import admin
from .models import AuditLog, AuditLogBatch


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'action', 'content_type', 'object_id', 'user', 'field_name']
    list_filter = ['action', 'content_type', 'timestamp']
    search_fields = ['object_id', 'user__email', 'field_name']
    readonly_fields = ['id', 'content_type', 'object_id', 'action', 'timestamp', 'user', 'ip_address', 'field_name', 'old_value', 'new_value', 'context']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AuditLogBatch)
class AuditLogBatchAdmin(admin.ModelAdmin):
    list_display = ['transaction_id', 'timestamp', 'user', 'description']
    list_filter = ['timestamp']
    search_fields = ['transaction_id', 'user__email']
    readonly_fields = ['id', 'transaction_id', 'timestamp', 'user', 'description']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
