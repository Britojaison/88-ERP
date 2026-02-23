"""
Sales and POS Transaction Models.
Tracks sales transactions, returns, and store performance data.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class SalesTransaction(TenantAwareModel):
    """
    Point of Sale transaction record.
    Records all sales transactions across stores and online channels.
    """
    
    PAYMENT_METHOD_CASH = 'cash'
    PAYMENT_METHOD_CARD = 'card'
    PAYMENT_METHOD_UPI = 'upi'
    PAYMENT_METHOD_WALLET = 'wallet'
    PAYMENT_METHOD_MIXED = 'mixed'
    
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_METHOD_CASH, 'Cash'),
        (PAYMENT_METHOD_CARD, 'Card'),
        (PAYMENT_METHOD_UPI, 'UPI'),
        (PAYMENT_METHOD_WALLET, 'Wallet'),
        (PAYMENT_METHOD_MIXED, 'Mixed'),
    ]
    
    CHANNEL_STORE = 'store'
    CHANNEL_ONLINE = 'online'
    CHANNEL_MOBILE = 'mobile'
    CHANNEL_MARKETPLACE = 'marketplace'
    
    CHANNEL_CHOICES = [
        (CHANNEL_STORE, 'Store'),
        (CHANNEL_ONLINE, 'Online'),
        (CHANNEL_MOBILE, 'Mobile App'),
        (CHANNEL_MARKETPLACE, 'Marketplace'),
    ]
    
    CUSTOMER_TYPE_WALKIN = 'walk-in'
    CUSTOMER_TYPE_MEMBER = 'member'
    CUSTOMER_TYPE_VIP = 'vip'
    
    CUSTOMER_TYPE_CHOICES = [
        (CUSTOMER_TYPE_WALKIN, 'Walk-in'),
        (CUSTOMER_TYPE_MEMBER, 'Member'),
        (CUSTOMER_TYPE_VIP, 'VIP'),
    ]
    
    # Transaction Identity
    transaction_number = models.CharField(max_length=100, unique=True, db_index=True)
    transaction_date = models.DateTimeField(db_index=True)
    
    # Channel & Location
    sales_channel = models.CharField(
        max_length=20,
        choices=CHANNEL_CHOICES,
        default=CHANNEL_STORE,
        db_index=True
    )
    store = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='sales_transactions',
        null=True,
        blank=True
    )
    register_number = models.CharField(max_length=50, blank=True)
    
    # Customer
    customer = models.ForeignKey(
        'mdm.Customer',
        on_delete=models.PROTECT,
        related_name='sales_transactions',
        null=True,
        blank=True
    )
    customer_type = models.CharField(
        max_length=20,
        choices=CUSTOMER_TYPE_CHOICES,
        default=CUSTOMER_TYPE_WALKIN
    )
    
    # Staff
    cashier = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='transactions_processed',
        null=True,
        blank=True
    )
    sales_associate = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='transactions_assisted',
        null=True,
        blank=True
    )
    
    # Financial
    subtotal = models.DecimalField(max_digits=15, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Payment
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default=PAYMENT_METHOD_CASH
    )
    
    # Metrics
    item_count = models.IntegerField(default=0)
    processing_time_seconds = models.IntegerField(default=0)
    
    # Marketing
    campaign_code = models.CharField(max_length=100, blank=True)
    referral_source = models.CharField(max_length=100, blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'sales_transaction'
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['company', 'sales_channel', '-transaction_date']),
            models.Index(fields=['store', '-transaction_date']),
            models.Index(fields=['transaction_date']),
        ]
    
    def __str__(self):
        return f"{self.transaction_number} - ₹{self.total_amount}"


class SalesTransactionLine(BaseModel):
    """
    Individual line items in a sales transaction.
    """
    transaction = models.ForeignKey(
        SalesTransaction,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    
    line_number = models.IntegerField()
    
    # Product
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.PROTECT,
        related_name='sales_lines'
    )
    
    # Quantity & Pricing
    quantity = models.DecimalField(max_digits=15, decimal_places=3)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Cost (for margin calculation)
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Returns
    is_returned = models.BooleanField(default=False)
    return_reason = models.CharField(max_length=255, blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'sales_transaction_line'
        unique_together = [['transaction', 'line_number']]
        ordering = ['line_number']
    
    def __str__(self):
        return f"{self.transaction.transaction_number} - Line {self.line_number}"


class ReturnTransaction(TenantAwareModel):
    """
    Product return/refund transactions.
    """
    
    RETURN_TYPE_REFUND = 'refund'
    RETURN_TYPE_EXCHANGE = 'exchange'
    RETURN_TYPE_CREDIT = 'store_credit'
    
    RETURN_TYPE_CHOICES = [
        (RETURN_TYPE_REFUND, 'Refund'),
        (RETURN_TYPE_EXCHANGE, 'Exchange'),
        (RETURN_TYPE_CREDIT, 'Store Credit'),
    ]
    
    return_number = models.CharField(max_length=100, unique=True, db_index=True)
    return_date = models.DateTimeField(db_index=True)
    
    # Reference
    original_transaction = models.ForeignKey(
        SalesTransaction,
        on_delete=models.PROTECT,
        related_name='returns',
        null=True,
        blank=True
    )
    store = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='return_transactions'
    )
    
    # Details
    return_reason = models.CharField(max_length=255)
    return_type = models.CharField(
        max_length=20,
        choices=RETURN_TYPE_CHOICES,
        default=RETURN_TYPE_REFUND
    )
    
    # Financial
    refund_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Staff
    processed_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='returns_processed'
    )
    
    notes = models.TextField(blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'sales_return_transaction'
        ordering = ['-return_date']
        indexes = [
            models.Index(fields=['company', 'store', '-return_date']),
        ]
    
    def __str__(self):
        return f"{self.return_number} - ₹{self.refund_amount}"


class StoreFootTraffic(TenantAwareModel):
    """
    Daily foot traffic tracking for stores.
    Can be populated manually or via automated counters.
    """
    store = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='foot_traffic'
    )
    
    date = models.DateField(db_index=True)
    hour = models.IntegerField()  # 0-23 for hourly breakdown
    
    # Traffic counts
    visitor_count = models.IntegerField(default=0)
    entry_count = models.IntegerField(default=0)
    exit_count = models.IntegerField(default=0)
    
    # Conversion
    transaction_count = models.IntegerField(default=0)
    conversion_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text='Percentage of visitors who made a purchase'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'sales_store_foot_traffic'
        unique_together = [['company', 'store', 'date', 'hour']]
        indexes = [
            models.Index(fields=['store', 'date']),
        ]
    
    def __str__(self):
        return f"{self.store.code} - {self.date} {self.hour}:00"


class StaffShift(TenantAwareModel):
    """
    Staff working hours for labor cost analysis.
    """
    store = models.ForeignKey(
        'mdm.Location',
        on_delete=models.PROTECT,
        related_name='staff_shifts'
    )
    employee = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='shifts'
    )
    
    shift_date = models.DateField(db_index=True)
    clock_in = models.DateTimeField()
    clock_out = models.DateTimeField(null=True, blank=True)
    
    hours_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    labor_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'sales_staff_shift'
        ordering = ['-shift_date', 'clock_in']
        indexes = [
            models.Index(fields=['store', 'shift_date']),
            models.Index(fields=['employee', 'shift_date']),
        ]
    
    def __str__(self):
        return f"{self.employee.username} - {self.shift_date}"
