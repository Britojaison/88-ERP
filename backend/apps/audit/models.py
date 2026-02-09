"""
Audit Service - Immutable audit trail.
APPEND-ONLY. No updates or deletes.
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
import uuid


class AuditLog(models.Model):
    """
    Immutable audit log entry.
    Records all changes to business entities.
    """
    
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    ACTION_STATE_CHANGE = 'state_change'
    ACTION_APPROVAL = 'approval'
    ACTION_REJECTION = 'rejection'
    
    ACTION_CHOICES = [
        (ACTION_CREATE, 'Create'),
        (ACTION_UPDATE, 'Update'),
        (ACTION_DELETE, 'Delete'),
        (ACTION_STATE_CHANGE, 'State Change'),
        (ACTION_APPROVAL, 'Approval'),
        (ACTION_REJECTION, 'Rejection'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Entity being audited
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.UUIDField(db_index=True)
    entity = GenericForeignKey('content_type', 'object_id')
    
    # Action details
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # User and session info
    user = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='audit_logs'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Change details
    field_name = models.CharField(max_length=255, blank=True, db_index=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    
    # Additional context
    context = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional context (e.g., workflow state, approval details)'
    )
    
    class Meta:
        db_table = 'audit_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['content_type', 'object_id', '-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['action', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.action} on {self.content_type} at {self.timestamp}"
    
    def save(self, *args, **kwargs):
        """Only allow creation, no updates."""
        if self.pk:
            raise ValueError("Audit logs are immutable and cannot be updated")
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Prevent deletion of audit logs."""
        raise ValueError("Audit logs cannot be deleted")


class AuditLogBatch(models.Model):
    """
    Groups related audit log entries (e.g., all changes in a transaction).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    transaction_id = models.CharField(max_length=255, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    user = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='audit_batches'
    )
    
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'audit_log_batch'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"Batch {self.transaction_id} at {self.timestamp}"
