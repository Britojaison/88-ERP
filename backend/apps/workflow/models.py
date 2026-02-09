"""
Workflow Engine - State machine for document workflows.
NO hard-coded workflows. All defined via metadata.
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class Workflow(TenantAwareModel):
    """
    Workflow definition.
    Example: 'purchase_order_approval', 'sales_order_fulfillment'
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    entity_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Entity type this workflow applies to'
    )
    
    initial_state = models.ForeignKey(
        'WorkflowState',
        on_delete=models.PROTECT,
        related_name='workflows_as_initial',
        null=True,
        blank=True
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'workflow_definition'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class WorkflowState(TenantAwareModel):
    """
    State in a workflow.
    Example: 'draft', 'pending_approval', 'approved', 'rejected'
    """
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='states'
    )
    
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    is_initial = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)
    
    # Actions allowed in this state
    allow_edit = models.BooleanField(default=True)
    allow_delete = models.BooleanField(default=False)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'workflow_state'
        unique_together = [['workflow', 'code']]
    
    def __str__(self):
        return f"{self.workflow.code}.{self.code}"


class WorkflowTransition(TenantAwareModel):
    """
    Allowed transition between states.
    Includes conditions and approver requirements.
    """
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='transitions'
    )
    
    from_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.CASCADE,
        related_name='transitions_from'
    )
    to_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.CASCADE,
        related_name='transitions_to'
    )
    
    name = models.CharField(max_length=255)
    
    # Condition for transition (JSONLogic)
    condition_expression = models.JSONField(
        default=dict,
        blank=True,
        help_text='Condition that must be true for transition'
    )
    
    # Approval requirements
    requires_approval = models.BooleanField(default=False)
    approver_role = models.ForeignKey(
        'rbac.Role',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='workflow_transitions'
    )
    
    # Actions to execute on transition
    actions = models.JSONField(
        default=list,
        blank=True,
        help_text='Actions to execute on transition (e.g., send email, update inventory)'
    )
    
    display_order = models.IntegerField(default=0)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'workflow_transition'
        unique_together = [['workflow', 'from_state', 'to_state']]
        ordering = ['display_order']
    
    def __str__(self):
        return f"{self.from_state.code} -> {self.to_state.code}"


class DocumentWorkflow(BaseModel):
    """
    Runtime workflow state for a document.
    Tracks current state and history.
    """
    # Generic foreign key to any document
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField(db_index=True)
    document = GenericForeignKey('content_type', 'object_id')
    
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.PROTECT,
        related_name='document_workflows'
    )
    
    current_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.PROTECT,
        related_name='current_documents'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'workflow_document'
        unique_together = [['content_type', 'object_id']]
        indexes = [
            models.Index(fields=['workflow', 'current_state']),
        ]
    
    def __str__(self):
        return f"{self.workflow.code} - {self.current_state.code}"


class WorkflowHistory(BaseModel):
    """
    Immutable history of workflow transitions.
    Audit trail for all state changes.
    """
    document_workflow = models.ForeignKey(
        DocumentWorkflow,
        on_delete=models.CASCADE,
        related_name='history'
    )
    
    from_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.PROTECT,
        related_name='history_from',
        null=True,
        blank=True
    )
    to_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.PROTECT,
        related_name='history_to'
    )
    
    transition = models.ForeignKey(
        WorkflowTransition,
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    
    comments = models.TextField(blank=True)
    
    # Approval information
    approved_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='workflow_approvals'
    )
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'workflow_history'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.from_state} -> {self.to_state} at {self.created_at}"
