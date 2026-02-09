"""
Inventory Engine - Attribute-based inventory management.
Inventory ALWAYS references SKU, never Product.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class InventoryBalance(TenantAwareModel):
    """
    Current inventory balance by SKU and location.
    NO denormalized aging columns - calculated from movements.
    """
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.PROTECT,
        related_name='inventory_balances'
    )
    
    location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='inventory_balances'
    )
    
    # Quantity tracking
    quantity_on_hand = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
        help_text='Physical quantity available'
    )
    quantity_reserved = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
        help_text='Quantity reserved for orders'
    )
    quantity_available = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
        help_text='Available = On Hand - Reserved'
    )
    
    # Condition
    CONDITION_NEW = 'new'
    CONDITION_USED = 'used'
    CONDITION_DAMAGED = 'damaged'
    
    CONDITION_CHOICES = [
        (CONDITION_NEW, 'New'),
        (CONDITION_USED, 'Used'),
        (CONDITION_DAMAGED, 'Damaged'),
    ]
    
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default=CONDITION_NEW
    )
    
    # Cost tracking
    average_cost = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'inv_balance'
        unique_together = [['company', 'sku', 'location', 'condition']]
        indexes = [
            models.Index(fields=['company', 'location', 'status']),
            models.Index(fields=['sku', 'status']),
        ]
    
    def __str__(self):
        return f"{self.sku.code} @ {self.location.code}: {self.quantity_available}"


class InventoryMovement(BaseModel):
    """
    Immutable inventory movement record.
    All inventory changes recorded here.
    """
    
    MOVEMENT_TYPE_RECEIPT = 'receipt'
    MOVEMENT_TYPE_ISSUE = 'issue'
    MOVEMENT_TYPE_TRANSFER = 'transfer'
    MOVEMENT_TYPE_ADJUSTMENT = 'adjustment'
    MOVEMENT_TYPE_RETURN = 'return'
    
    MOVEMENT_TYPE_CHOICES = [
        (MOVEMENT_TYPE_RECEIPT, 'Receipt'),
        (MOVEMENT_TYPE_ISSUE, 'Issue'),
        (MOVEMENT_TYPE_TRANSFER, 'Transfer'),
        (MOVEMENT_TYPE_ADJUSTMENT, 'Adjustment'),
        (MOVEMENT_TYPE_RETURN, 'Return'),
    ]
    
    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPE_CHOICES,
        db_index=True
    )
    
    movement_date = models.DateTimeField(db_index=True)
    
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.PROTECT,
        related_name='inventory_movements'
    )
    
    from_location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='movements_from'
    )
    to_location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='movements_to'
    )
    
    quantity = models.DecimalField(max_digits=15, decimal_places=3)
    
    # Cost
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2)
    total_cost = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Reference to source document
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='inventory_movements'
    )
    
    reference_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'inv_movement'
        ordering = ['-movement_date']
        indexes = [
            models.Index(fields=['sku', '-movement_date']),
            models.Index(fields=['from_location', '-movement_date']),
            models.Index(fields=['to_location', '-movement_date']),
        ]
    
    def __str__(self):
        return f"{self.movement_type} - {self.sku.code} - {self.quantity}"
    
    def save(self, *args, **kwargs):
        """Only allow creation, no updates."""
        if self.pk:
            raise ValueError("Inventory movements are immutable")
        super().save(*args, **kwargs)
