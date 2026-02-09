from django.contrib import admin
from .models import Workflow, WorkflowState, WorkflowTransition, DocumentWorkflow, WorkflowHistory


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'entity_type', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'entity_type', 'status']


@admin.register(WorkflowState)
class WorkflowStateAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'workflow', 'is_initial', 'is_final', 'status']
    search_fields = ['code', 'name']
    list_filter = ['workflow', 'is_initial', 'is_final', 'status']


@admin.register(WorkflowTransition)
class WorkflowTransitionAdmin(admin.ModelAdmin):
    list_display = ['workflow', 'from_state', 'to_state', 'requires_approval', 'status']
    search_fields = ['name']
    list_filter = ['workflow', 'requires_approval', 'status']


@admin.register(DocumentWorkflow)
class DocumentWorkflowAdmin(admin.ModelAdmin):
    list_display = ['workflow', 'current_state', 'content_type', 'object_id', 'status']
    list_filter = ['workflow', 'current_state', 'status']


@admin.register(WorkflowHistory)
class WorkflowHistoryAdmin(admin.ModelAdmin):
    list_display = ['document_workflow', 'from_state', 'to_state', 'created_by', 'created_at']
    list_filter = ['document_workflow__workflow', 'created_at']
    readonly_fields = ['document_workflow', 'from_state', 'to_state', 'transition', 'comments', 'approved_by', 'created_by', 'created_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
