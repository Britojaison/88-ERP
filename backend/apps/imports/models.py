"""
Data Import Framework.
CSV upload, validation, partial success handling.
Reuses rule engine for validation.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class ImportTemplate(TenantAwareModel):
    """
    Import template definition.
    Defines how to import data for an entity type.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    entity_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Entity type to import (product, sku, customer, etc.)'
    )
    
    # Field mapping
    field_mappings = models.JSONField(
        help_text='Maps CSV columns to entity fields'
    )
    
    # Validation rules
    validation_rules = models.JSONField(
        default=list,
        help_text='List of validation rule codes to apply'
    )
    
    # Import behavior
    allow_create = models.BooleanField(default=True)
    allow_update = models.BooleanField(default=True)
    update_key_field = models.CharField(
        max_length=100,
        blank=True,
        help_text='Field to use for matching existing records'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'import_template'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class ImportBatch(BaseModel):
    """
    Import batch execution.
    """
    
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_PARTIAL = 'partial'
    
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_PARTIAL, 'Partial Success'),
    ]
    
    template = models.ForeignKey(
        ImportTemplate,
        on_delete=models.PROTECT,
        related_name='batches'
    )
    
    batch_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True
    )
    
    # File
    source_file = models.FileField(upload_to='imports/')
    
    # Statistics
    total_rows = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    
    # Processing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'import_batch'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.template.code} - {self.batch_status}"


class ImportRow(BaseModel):
    """
    Individual row in import batch.
    """
    batch = models.ForeignKey(
        ImportBatch,
        on_delete=models.CASCADE,
        related_name='rows'
    )
    
    row_number = models.IntegerField()
    
    # Data
    raw_data = models.JSONField(help_text='Original CSV row data')
    mapped_data = models.JSONField(help_text='Mapped to entity fields')
    
    # Processing result
    is_success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    
    # Created entity reference
    entity_id = models.UUIDField(null=True, blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'import_row'
        ordering = ['row_number']
        indexes = [
            models.Index(fields=['batch', 'is_success']),
        ]
    
    def __str__(self):
        return f"Row {self.row_number} - {'SUCCESS' if self.is_success else 'ERROR'}"
