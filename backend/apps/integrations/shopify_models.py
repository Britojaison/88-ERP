"""
Shopify Integration Models.
Handles Shopify store connections, product sync, and inventory management.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager
from django.utils import timezone
import hashlib
import hmac


class ShopifyStore(TenantAwareModel):
    """
    Shopify store connection configuration.
    """
    name = models.CharField(max_length=255)
    shop_domain = models.CharField(
        max_length=255,
        unique=True,
        help_text='e.g., mystore.myshopify.com'
    )
    
    # OAuth credentials
    access_token = models.CharField(max_length=255)
    api_key = models.CharField(max_length=255, blank=True)
    api_secret = models.CharField(max_length=255, blank=True)
    
    # API version
    api_version = models.CharField(
        max_length=20,
        default='2024-01',
        help_text='Shopify API version (e.g., 2024-01)'
    )
    
    # Sync settings
    auto_sync_products = models.BooleanField(default=True)
    auto_sync_inventory = models.BooleanField(default=True)
    auto_sync_orders = models.BooleanField(default=True)
    sync_interval_minutes = models.IntegerField(default=15)
    
    # Last sync timestamps
    last_product_sync = models.DateTimeField(null=True, blank=True)
    last_inventory_sync = models.DateTimeField(null=True, blank=True)
    last_order_sync = models.DateTimeField(null=True, blank=True)
    
    # Webhook verification
    webhook_secret = models.CharField(max_length=255, blank=True)
    
    # Connection status
    is_connected = models.BooleanField(default=False)
    last_connection_test = models.DateTimeField(null=True, blank=True)
    connection_error = models.TextField(blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'shopify_store'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.shop_domain})"
    
    def verify_webhook(self, data: bytes, hmac_header: str) -> bool:
        """
        Verify Shopify webhook signature.
        """
        if not self.webhook_secret:
            return False
        
        computed_hmac = hmac.new(
            self.webhook_secret.encode('utf-8'),
            data,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(computed_hmac, hmac_header)


class ShopifyProduct(BaseModel):
    """
    Mapping between Shopify products and ERP products.
    """
    store = models.ForeignKey(
        ShopifyStore,
        on_delete=models.CASCADE,
        related_name='products'
    )
    
    # Shopify IDs
    shopify_product_id = models.BigIntegerField(db_index=True)
    shopify_variant_id = models.BigIntegerField(db_index=True, null=True, blank=True)
    shopify_inventory_item_id = models.BigIntegerField(db_index=True, null=True, blank=True)
    
    # ERP mapping
    erp_product = models.ForeignKey(
        'mdm.Product',
        on_delete=models.CASCADE,
        related_name='shopify_products',
        null=True,
        blank=True
    )
    erp_sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.CASCADE,
        related_name='shopify_products',
        null=True,
        blank=True
    )
    
    # Shopify data (cached)
    shopify_title = models.CharField(max_length=255)
    shopify_sku = models.CharField(max_length=255, blank=True)
    shopify_barcode = models.CharField(max_length=255, blank=True)
    shopify_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    shopify_inventory_quantity = models.IntegerField(default=0)
    shopify_product_type = models.CharField(max_length=255, blank=True)
    shopify_vendor = models.CharField(max_length=255, blank=True)
    shopify_tags = models.TextField(blank=True)
    shopify_image_url = models.URLField(max_length=500, blank=True)
    shopify_data = models.JSONField(default=dict, help_text='Full Shopify product data')
    
    # Sync status
    sync_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('synced', 'Synced'),
            ('error', 'Error'),
        ],
        default='pending'
    )
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error = models.TextField(blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_product'
        unique_together = [['store', 'shopify_product_id', 'shopify_variant_id']]
        indexes = [
            models.Index(fields=['store', 'sync_status']),
            models.Index(fields=['shopify_sku']),
        ]
    
    def __str__(self):
        return f"{self.shopify_title} (Shopify ID: {self.shopify_product_id})"


class ShopifyInventoryLevel(BaseModel):
    """
    Shopify inventory levels for locations.
    """
    store = models.ForeignKey(
        ShopifyStore,
        on_delete=models.CASCADE,
        related_name='inventory_levels'
    )
    
    shopify_product = models.ForeignKey(
        ShopifyProduct,
        on_delete=models.CASCADE,
        related_name='inventory_levels'
    )
    
    # Shopify location
    shopify_location_id = models.BigIntegerField(db_index=True)
    shopify_location_name = models.CharField(max_length=255)
    
    # ERP location mapping
    erp_location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.CASCADE,
        related_name='shopify_inventory',
        null=True,
        blank=True
    )
    
    # Inventory data
    available = models.IntegerField(default=0)
    on_hand = models.IntegerField(default=0)
    committed = models.IntegerField(default=0)
    
    last_synced_at = models.DateTimeField(auto_now=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_inventory_level'
        unique_together = [['shopify_product', 'shopify_location_id']]
        indexes = [
            models.Index(fields=['store', 'shopify_location_id']),
        ]
    
    def __str__(self):
        return f"{self.shopify_product.shopify_title} @ {self.shopify_location_name}: {self.available}"


class ShopifyWebhook(BaseModel):
    """
    Registered Shopify webhooks.
    """
    store = models.ForeignKey(
        ShopifyStore,
        on_delete=models.CASCADE,
        related_name='webhooks'
    )
    
    shopify_webhook_id = models.BigIntegerField(unique=True)
    
    topic = models.CharField(
        max_length=100,
        help_text='e.g., products/create, inventory_levels/update'
    )
    address = models.URLField(help_text='Webhook callback URL')
    
    is_active = models.BooleanField(default=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_webhook'
        unique_together = [['store', 'topic']]
    
    def __str__(self):
        return f"{self.store.name} - {self.topic}"


class ShopifyWebhookLog(BaseModel):
    """
    Log of received webhooks for debugging.
    """
    store = models.ForeignKey(
        ShopifyStore,
        on_delete=models.CASCADE,
        related_name='webhook_logs'
    )
    
    topic = models.CharField(max_length=100)
    shopify_id = models.BigIntegerField(null=True, blank=True)
    
    payload = models.JSONField()
    headers = models.JSONField(default=dict)
    
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    error = models.TextField(blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_webhook_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'topic', '-created_at']),
            models.Index(fields=['processed']),
        ]
    
    def __str__(self):
        return f"{self.topic} - {self.created_at}"


class ShopifySyncJob(BaseModel):
    """
    Track sync jobs for monitoring and debugging.
    """
    store = models.ForeignKey(
        ShopifyStore,
        on_delete=models.CASCADE,
        related_name='sync_jobs'
    )
    
    job_type = models.CharField(
        max_length=50,
        choices=[
            ('products', 'Products'),
            ('inventory', 'Inventory'),
            ('orders', 'Orders'),
            ('draft_orders', 'Draft Orders'),
            ('discounts', 'Discounts'),
            ('gift_cards', 'Gift Cards'),
            ('full_sync', 'Full Sync'),
        ]
    )
    
    job_status = models.CharField(
        max_length=20,
        db_column='job_status',
        choices=[
            ('running', 'Running'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='running'
    )
    
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Statistics
    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    created_items = models.IntegerField(default=0)
    updated_items = models.IntegerField(default=0)
    failed_items = models.IntegerField(default=0)
    
    error_log = models.TextField(blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_sync_job'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['store', 'job_status', '-started_at']),
        ]
    
    def __str__(self):
        return f"{self.store.name} - {self.job_type} - {self.job_status}"


class ShopifyOrder(BaseModel):
    """
    Synced orders from Shopify.
    """
    store = models.ForeignKey(ShopifyStore, on_delete=models.CASCADE, related_name='orders')
    shopify_order_id = models.BigIntegerField(unique=True)
    order_number = models.CharField(max_length=100)
    
    # ERP mapping
    erp_document = models.OneToOneField(
        'documents.Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shopify_order'
    )
    
    # Data
    order_status = models.CharField(max_length=50)
    financial_status = models.CharField(max_length=50)
    fulfillment_status = models.CharField(max_length=50, null=True, blank=True)
    
    total_price = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=10)
    
    customer_name = models.CharField(max_length=255, blank=True)
    customer_email = models.EmailField(blank=True)
    
    shopify_data = models.JSONField(default=dict)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_order'
        ordering = ['-processed_at']


class ShopifyFulfillment(BaseModel):
    """
    Track fulfillments (shipments) for Shopify orders.
    """
    order = models.ForeignKey(ShopifyOrder, on_delete=models.CASCADE, related_name='fulfillments')
    shopify_fulfillment_id = models.BigIntegerField(unique=True)
    
    tracking_number = models.CharField(max_length=255, blank=True)
    tracking_company = models.CharField(max_length=100, blank=True)
    tracking_url = models.URLField(max_length=500, blank=True)
    
    status = models.CharField(max_length=50)
    shopify_data = models.JSONField(default=dict)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_fulfillment'


class ShopifyDraftOrder(BaseModel):
    """
    Synced draft orders from Shopify (proposals/quotations).
    """
    store = models.ForeignKey(ShopifyStore, on_delete=models.CASCADE, related_name='draft_orders')
    shopify_draft_order_id = models.BigIntegerField(unique=True)
    
    # ERP mapping
    erp_document = models.OneToOneField(
        'documents.Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shopify_draft_order'
    )
    
    status = models.CharField(max_length=50)
    total_price = models.DecimalField(max_digits=15, decimal_places=2)
    
    shopify_data = models.JSONField(default=dict)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_draft_order'


class ShopifyDiscount(BaseModel):
    """
    Discounts and Price Rules from Shopify.
    """
    store = models.ForeignKey(ShopifyStore, on_delete=models.CASCADE, related_name='discounts')
    shopify_id = models.BigIntegerField(unique=True)
    code = models.CharField(max_length=100)
    type = models.CharField(max_length=50) # price_rule or discount_code
    
    value = models.DecimalField(max_digits=10, decimal_places=2)
    value_type = models.CharField(max_length=20) # percentage or fixed_amount
    
    starts_at = models.DateTimeField(null=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    shopify_data = models.JSONField(default=dict)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_discount'


class ShopifyGiftCard(BaseModel):
    """
    Gift cards issued via Shopify.
    """
    store = models.ForeignKey(ShopifyStore, on_delete=models.CASCADE, related_name='gift_cards')
    shopify_gift_card_id = models.BigIntegerField(unique=True)
    
    last_characters = models.CharField(max_length=10)
    initial_value = models.DecimalField(max_digits=15, decimal_places=2)
    current_balance = models.DecimalField(max_digits=15, decimal_places=2)
    
    currency = models.CharField(max_length=10)
    expires_on = models.DateField(null=True, blank=True)
    is_disabled = models.BooleanField(default=False)
    
    shopify_data = models.JSONField(default=dict)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'shopify_gift_card'
