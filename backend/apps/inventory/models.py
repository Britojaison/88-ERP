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
        if self.pk and InventoryMovement.objects.filter(pk=self.pk).exists():
            raise ValueError("Inventory movements are immutable")
        super().save(*args, **kwargs)


class GoodsReceiptScan(TenantAwareModel):
    """
    Barcode scan audit trail for goods receiving.
    """
    RESULT_MATCHED = "matched"
    RESULT_MISMATCH = "mismatch"
    RESULT_OVER_RECEIPT = "over_receipt"
    RESULT_UNKNOWN = "unknown"

    RESULT_CHOICES = [
        (RESULT_MATCHED, "Matched"),
        (RESULT_MISMATCH, "Mismatch"),
        (RESULT_OVER_RECEIPT, "Over Receipt"),
        (RESULT_UNKNOWN, "Unknown"),
    ]

    barcode_value = models.CharField(max_length=255, db_index=True)
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.PROTECT,
        related_name='goods_receipt_scans',
        null=True,
        blank=True,
    )
    barcode = models.ForeignKey(
        'mdm.SKUBarcode',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scan_logs',
    )
    location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='goods_receipt_scans'
    )
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='goods_receipt_scans'
    )

    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=1)
    batch_number = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    result = models.CharField(max_length=20, choices=RESULT_CHOICES, db_index=True)
    message = models.CharField(max_length=500, blank=True)
    scanned_at = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = models.Manager()
    active = ActiveManager()

    class Meta:
        db_table = 'inv_goods_receipt_scan'
        ordering = ['-scanned_at']
        indexes = [
            models.Index(fields=['company', 'result', '-scanned_at']),
            models.Index(fields=['barcode_value', '-scanned_at']),
        ]

    def __str__(self):
        return f"{self.barcode_value} - {self.result}"


class DamagedItem(TenantAwareModel):
    """
    Record of damaged items discovered during receiving or inspection.
    """
    DAMAGE_TYPE_PHYSICAL = "physical"
    DAMAGE_TYPE_PACKAGING = "packaging"
    DAMAGE_TYPE_QUALITY = "quality"
    DAMAGE_TYPE_MISSING_PARTS = "missing_parts"
    DAMAGE_TYPE_WRONG_ITEM = "wrong_item"
    DAMAGE_TYPE_EXPIRED = "expired"
    DAMAGE_TYPE_OTHER = "other"

    DAMAGE_TYPE_CHOICES = [
        (DAMAGE_TYPE_PHYSICAL, "Physical Damage"),
        (DAMAGE_TYPE_PACKAGING, "Packaging Damage"),
        (DAMAGE_TYPE_QUALITY, "Quality Issue"),
        (DAMAGE_TYPE_MISSING_PARTS, "Missing Parts"),
        (DAMAGE_TYPE_WRONG_ITEM, "Wrong Item"),
        (DAMAGE_TYPE_EXPIRED, "Expired/Near Expiry"),
        (DAMAGE_TYPE_OTHER, "Other"),
    ]

    SEVERITY_MINOR = "minor"
    SEVERITY_MAJOR = "major"
    SEVERITY_CRITICAL = "critical"

    SEVERITY_CHOICES = [
        (SEVERITY_MINOR, "Minor - Cosmetic only"),
        (SEVERITY_MAJOR, "Major - Affects functionality"),
        (SEVERITY_CRITICAL, "Critical - Unusable"),
    ]

    ACTION_RETURN = "return_to_vendor"
    ACTION_DISPOSE = "dispose"
    ACTION_REPAIR = "repair"
    ACTION_DISCOUNT = "discount_sale"
    ACTION_USE_AS_IS = "use_as_is"

    ACTION_CHOICES = [
        (ACTION_RETURN, "Return to Vendor"),
        (ACTION_DISPOSE, "Dispose"),
        (ACTION_REPAIR, "Repair"),
        (ACTION_DISCOUNT, "Discount Sale"),
        (ACTION_USE_AS_IS, "Use As-Is"),
    ]

    # Link to scan log
    scan_log = models.ForeignKey(
        GoodsReceiptScan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='damage_records'
    )

    # Item details
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.PROTECT,
        related_name='damage_records',
        null=True,
        blank=True,
    )
    barcode_value = models.CharField(max_length=255, db_index=True)
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=1)
    location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='damaged_items'
    )

    # Damage details
    damage_type = models.CharField(max_length=50, choices=DAMAGE_TYPE_CHOICES, db_index=True)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, db_index=True)
    description = models.TextField(blank=True)
    suggested_action = models.CharField(max_length=50, choices=ACTION_CHOICES, blank=True)

    # Photo evidence
    photo = models.ImageField(upload_to='damage_photos/', null=True, blank=True)

    # Timestamps
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    recorded_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_damages'
    )

    objects = models.Manager()
    active = ActiveManager()

    class Meta:
        db_table = 'inv_damaged_item'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['company', 'damage_type', '-recorded_at']),
            models.Index(fields=['severity', '-recorded_at']),
            models.Index(fields=['sku', '-recorded_at']),
        ]

    def __str__(self):
        return f"{self.barcode_value} - {self.damage_type} ({self.severity})"
