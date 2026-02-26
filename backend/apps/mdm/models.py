"""
Master Data Management models.
Industry-agnostic core entities: Company, User, Customer, Vendor, Product, etc.
"""
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class UserManager(BaseUserManager):
    """Custom manager for User model."""
    
    def get_by_natural_key(self, username):
        """Get user by email (natural key)."""
        return self.get(**{self.model.USERNAME_FIELD: username})
    
    def create_user(self, email, username, password=None, **extra_fields):
        """Create and save a regular user."""
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, username, password=None, **extra_fields):
        """Create and save a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True')
        
        return self.create_user(email, username, password, **extra_fields)


class Company(BaseModel):
    """
    Top-level tenant entity.
    Represents a legal entity or business unit group.
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    currency = models.CharField(max_length=3, default='INR')
    
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='subsidiaries'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_company'
        verbose_name_plural = 'Companies'
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class BusinessUnit(TenantAwareModel):
    """
    Organizational unit within a company.
    Used for reporting and access control.
    """
    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_business_unit'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Location(TenantAwareModel):
    """
    Physical or logical location.
    Used for inventory, shipping, and operations.
    """
    
    TYPE_WAREHOUSE = 'warehouse'
    TYPE_STORE = 'store'
    TYPE_OFFICE = 'office'
    TYPE_VIRTUAL = 'virtual'
    
    TYPE_CHOICES = [
        (TYPE_WAREHOUSE, 'Warehouse'),
        (TYPE_STORE, 'Store'),
        (TYPE_OFFICE, 'Office'),
        (TYPE_VIRTUAL, 'Virtual'),
    ]
    
    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    location_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    
    business_unit = models.ForeignKey(
        BusinessUnit,
        on_delete=models.PROTECT,
        related_name='locations'
    )
    
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=2, blank=True)
    
    # Store specific fields
    email = models.EmailField(blank=True, null=True)
    opening_date = models.DateField(blank=True, null=True)
    
    is_inventory_location = models.BooleanField(default=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_location'
        unique_together = [['company', 'code']]
        indexes = [
            models.Index(fields=['company', 'location_type', 'status']),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Custom user model.
    Authentication is separate from authorization (RBAC).
    """
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='users',
        null=True,
        blank=True
    )
    
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    objects = UserManager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_user'
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class Customer(TenantAwareModel):
    """
    Customer master data.
    Industry-agnostic customer entity.
    """
    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    
    credit_limit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text='Credit limit in company currency'
    )
    
    payment_terms_days = models.IntegerField(default=30)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_customer'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Vendor(TenantAwareModel):
    """
    Vendor/Supplier master data.
    Industry-agnostic vendor entity.
    """
    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    
    payment_terms_days = models.IntegerField(default=30)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_vendor'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Product(TenantAwareModel):
    """
    Product master - design/concept level.
    NO hard-coded attributes (size, color, etc.).
    All attributes are dynamic via attribute engine.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Product hierarchy (optional)
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='variants'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_product'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Style(TenantAwareModel):
    """
    Optional grouping level between Product and SKU.
    Used in fashion but not required.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='styles'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_style'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class SKU(TenantAwareModel):
    """
    Stock Keeping Unit - sellable unit.
    Inventory ALWAYS references SKU, never Product.
    All variant dimensions (size, color, etc.) are attributes.
    """
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    
    LIFECYCLE_PROTO = 'proto'
    LIFECYCLE_IN_PRODUCTION = 'in_production'
    LIFECYCLE_ACTIVE = 'active'
    
    LIFECYCLE_CHOICES = [
        (LIFECYCLE_PROTO, 'Proto / Design'),
        (LIFECYCLE_IN_PRODUCTION, 'In Production'),
        (LIFECYCLE_ACTIVE, 'Active / Sellable'),
    ]
    
    lifecycle_status = models.CharField(
        max_length=20,
        choices=LIFECYCLE_CHOICES,
        default=LIFECYCLE_PROTO
    )
    
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='skus'
    )
    
    style = models.ForeignKey(
        Style,
        on_delete=models.PROTECT,
        related_name='skus',
        null=True,
        blank=True
    )
    
    # Pricing
    base_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text='Base selling price'
    )
    cost_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text='Cost price'
    )
    
    # Physical attributes (generic)
    weight = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
        help_text='Weight in kg'
    )
    
    size = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text='Size (e.g., S, M, L, XL, 28, 30, etc.)'
    )
    
    # Inventory control
    is_serialized = models.BooleanField(default=False)
    is_batch_tracked = models.BooleanField(default=False)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_sku'
        indexes = [
            models.Index(fields=['company', 'product', 'status']),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class SKUBarcode(TenantAwareModel):
    """
    Barcode assignment per SKU/variant.
    Supports label rendering fields for factory/warehouse operations.
    """
    TYPE_CODE128 = "code128"
    TYPE_GS1_128 = "gs1_128"
    TYPE_EAN13 = "ean13"

    TYPE_CHOICES = [
        (TYPE_CODE128, "Code 128"),
        (TYPE_GS1_128, "GS1-128"),
        (TYPE_EAN13, "EAN-13"),
    ]

    sku = models.ForeignKey(
        SKU,
        on_delete=models.CASCADE,
        related_name="barcodes",
    )

    barcode_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_CODE128)
    barcode_value = models.CharField(max_length=255, unique=True, db_index=True)
    is_primary = models.BooleanField(default=True)

    # Label data
    display_code = models.CharField(max_length=100, blank=True)
    label_title = models.CharField(max_length=255, blank=True)
    size_label = models.CharField(max_length=50, blank=True)
    selling_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    mrp = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    barcode_svg = models.TextField(blank=True)

    objects = models.Manager()
    active = ActiveManager()

    class Meta:
        db_table = "mdm_sku_barcode"
        unique_together = [["company", "sku", "barcode_value"]]
        indexes = [
            models.Index(fields=["company", "sku", "status"]),
        ]

    def __str__(self):
        return f"{self.sku.code} - {self.barcode_value}"


class ChartOfAccounts(TenantAwareModel):
    """
    Chart of accounts for financial integration.
    Industry-agnostic GL structure.
    """
    
    TYPE_ASSET = 'asset'
    TYPE_LIABILITY = 'liability'
    TYPE_EQUITY = 'equity'
    TYPE_REVENUE = 'revenue'
    TYPE_EXPENSE = 'expense'
    
    TYPE_CHOICES = [
        (TYPE_ASSET, 'Asset'),
        (TYPE_LIABILITY, 'Liability'),
        (TYPE_EQUITY, 'Equity'),
        (TYPE_REVENUE, 'Revenue'),
        (TYPE_EXPENSE, 'Expense'),
    ]
    
    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children'
    )
    
    is_control_account = models.BooleanField(default=False)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'mdm_chart_of_accounts'
        unique_together = [['company', 'code']]
        verbose_name_plural = 'Chart of Accounts'
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Fabric(TenantAwareModel):
    """
    Fabric master data.
    Tracks fabric rolls with meters, photo, designer approval, and dispatch to units.
    Each fabric auto-generates its own SKU on creation.
    """

    APPROVAL_PENDING = 'pending'
    APPROVAL_APPROVED = 'approved'
    APPROVAL_REJECTED = 'rejected'
    APPROVAL_CHOICES = [
        (APPROVAL_PENDING, 'Pending'),
        (APPROVAL_APPROVED, 'Approved'),
        (APPROVAL_REJECTED, 'Rejected'),
    ]

    code = models.CharField(max_length=100, unique=True, db_index=True,
                            help_text='Auto-generated fabric SKU code')
    name = models.CharField(max_length=255, help_text='Fabric name/description')
    color = models.CharField(max_length=100, blank=True, help_text='Fabric color')
    fabric_type = models.CharField(max_length=100, blank=True,
                                   help_text='Type of fabric (e.g. Cotton, Silk, Polyester)')

    # Meter tracking
    total_meters = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                       help_text='Total meters of fabric received')
    used_meters = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                      help_text='Meters already used/dispatched')
    cost_per_meter = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                         help_text='Cost per meter in INR')

    # Photo upload
    photo = models.ImageField(upload_to='fabrics/photos/', blank=True, null=True,
                              help_text='Photo of the fabric')

    # Designer approval
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default=APPROVAL_PENDING,
        db_index=True,
    )
    approved_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_fabrics',
        help_text='Designer who approved/rejected'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, help_text='Reason for rejection')

    # Dispatch tracking
    dispatch_unit = models.CharField(
        max_length=10,
        blank=True,
        help_text='Dispatch unit (A, B, C, etc.)'
    )

    # Vendor/source
    vendor = models.ForeignKey(
        'mdm.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fabrics',
    )

    notes = models.TextField(blank=True)

    # Link to auto-generated SKU
    sku = models.ForeignKey(
        'mdm.SKU',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fabric_source',
        help_text='Auto-generated SKU for this fabric'
    )

    objects = models.Manager()
    active = ActiveManager()

    class Meta:
        db_table = 'mdm_fabric'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'approval_status']),
            models.Index(fields=['company', 'dispatch_unit']),
        ]

    @property
    def remaining_meters(self):
        return self.total_meters - self.used_meters

    def __str__(self):
        return f"{self.code} - {self.name}"
