"""
Base models with common fields for all entities.
All ERP entities MUST inherit from these base classes.
"""
import uuid
from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    """
    Abstract base model with mandatory fields for all entities.
    
    Fields:
    - id: UUID primary key
    - status: Entity status (active, inactive, deleted)
    - version: Optimistic locking version
    - created_at: Creation timestamp
    - updated_at: Last update timestamp
    - created_by: User who created the record
    - updated_by: User who last updated the record
    """
    
    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_DELETED = 'deleted'
    
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_DELETED, 'Deleted'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True
    )
    version = models.IntegerField(default=1, help_text='Optimistic locking version')
    
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    created_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='%(class)s_created',
        null=True,
        blank=True
    )
    updated_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='%(class)s_updated',
        null=True,
        blank=True
    )
    
    class Meta:
        abstract = True
        ordering = ['-created_at']
    
    def soft_delete(self):
        """Soft delete - never physically delete business data."""
        self.status = self.STATUS_DELETED
        self.save(update_fields=['status', 'updated_at'])
    
    def save(self, *args, **kwargs):
        """Override save to increment version for optimistic locking."""
        if self.pk:
            self.version += 1
        super().save(*args, **kwargs)


class ActiveManager(models.Manager):
    """Manager that returns only active records."""
    
    def get_queryset(self):
        return super().get_queryset().filter(status=BaseModel.STATUS_ACTIVE)


class TenantAwareModel(BaseModel):
    """
    Base model for multi-tenant entities.
    All tenant-specific data must inherit from this.
    """
    
    company = models.ForeignKey(
        'mdm.Company',
        on_delete=models.PROTECT,
        related_name='%(class)s_set',
        db_index=True
    )
    
    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=['company', 'status']),
        ]
