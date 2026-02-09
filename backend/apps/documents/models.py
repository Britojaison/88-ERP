"""
Document Engine - Generic document framework.
Document types configured via metadata.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class DocumentType(TenantAwareModel):
    """
    Document type definition.
    Examples: 'purchase_order', 'sales_order', 'invoice', 'goods_receipt'
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Numbering sequence
    numbering_sequence = models.ForeignKey(
        'numbering.NumberingSequence',
        on_delete=models.PROTECT,
        related_name='document_types'
    )
    
    # Workflow
    workflow = models.ForeignKey(
        'workflow.Workflow',
        on_delete=models.PROTECT,
        related_name='document_types'
    )
    
    # Document behavior
    has_lines = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=False)
    affects_inventory = models.BooleanField(default=False)
    affects_financials = models.BooleanField(default=False)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'doc_type'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Document(TenantAwareModel):
    """
    Generic document header.
    All business documents inherit from this.
    """
    document_type = models.ForeignKey(
        DocumentType,
        on_delete=models.PROTECT,
        related_name='documents'
    )
    
    document_number = models.CharField(max_length=100, db_index=True)
    document_date = models.DateField(db_index=True)
    
    # References
    reference_number = models.CharField(max_length=100, blank=True)
    external_reference = models.CharField(max_length=100, blank=True)
    
    # Parties
    customer = models.ForeignKey(
        'mdm.Customer',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='documents'
    )
    vendor = models.ForeignKey(
        'mdm.Vendor',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='documents'
    )
    
    # Locations
    from_location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='documents_from'
    )
    to_location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='documents_to'
    )
    
    # Amounts
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    # Notes
    notes = models.TextField(blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'doc_header'
        unique_together = [['company', 'document_number']]
        indexes = [
            models.Index(fields=['company', 'document_type', 'document_date']),
        ]
    
    def __str__(self):
        return f"{self.document_type.code} - {self.document_number}"


class DocumentLine(BaseModel):
    """
    Document line item.
    """
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    
    line_number = models.IntegerField()
    
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.PROTECT,
        related_name='document_lines'
    )
    
    quantity = models.DecimalField(max_digits=15, decimal_places=3)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    line_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    notes = models.TextField(blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'doc_line'
        unique_together = [['document', 'line_number']]
        ordering = ['line_number']
    
    def __str__(self):
        return f"{self.document.document_number} - Line {self.line_number}"
