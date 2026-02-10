"""
Metadata Management Models.
Tracks changes to metadata entities (attributes, workflows, rules, etc.).
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager
import uuid


class MetadataVersion(BaseModel):
    """
    Version history for metadata entities.
    Tracks who changed what and when.
    """
    
    # Entity being versioned
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.UUIDField(db_index=True)
    entity = GenericForeignKey('content_type', 'object_id')
    
    version_number = models.IntegerField()
    
    # Change details
    changes = models.JSONField(
        help_text='What changed in this version'
    )
    
    # Snapshot of entity at this version
    snapshot = models.JSONField(
        help_text='Complete entity state at this version'
    )
    
    # Effective dates
    effective_from = models.DateTimeField(db_index=True)
    effective_to = models.DateTimeField(null=True, blank=True, db_index=True)
    
    # Change metadata
    change_reason = models.TextField(blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'metadata_version'
        ordering = ['-version_number']
        indexes = [
            models.Index(fields=['content_type', 'object_id', '-version_number']),
        ]
    
    def __str__(self):
        return f"{self.content_type} v{self.version_number}"


class ConfigurationTemplate(TenantAwareModel):
    """
    Pre-built configuration templates for different industries.
    """
    
    INDUSTRY_FASHION = 'fashion'
    INDUSTRY_MANUFACTURING = 'manufacturing'
    INDUSTRY_DISTRIBUTION = 'distribution'
    INDUSTRY_SERVICES = 'services'
    INDUSTRY_GENERIC = 'generic'
    
    INDUSTRY_CHOICES = [
        (INDUSTRY_FASHION, 'Fashion Retail'),
        (INDUSTRY_MANUFACTURING, 'Manufacturing'),
        (INDUSTRY_DISTRIBUTION, 'Distribution'),
        (INDUSTRY_SERVICES, 'Services'),
        (INDUSTRY_GENERIC, 'Generic'),
    ]
    
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField()
    
    industry = models.CharField(max_length=50, choices=INDUSTRY_CHOICES)
    
    # Template configuration (complete metadata export)
    configuration = models.JSONField(
        help_text='Complete configuration: attributes, workflows, rules, etc.'
    )
    
    # Sample data for testing
    sample_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Sample data to demonstrate the template'
    )
    
    is_public = models.BooleanField(
        default=True,
        help_text='If true, available to all companies'
    )
    
    usage_count = models.IntegerField(default=0)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'config_template'
    
    def __str__(self):
        return f"{self.name} ({self.industry})"


class ConfigurationSandbox(TenantAwareModel):
    """
    Sandbox environment for testing metadata changes.
    """
    
    STATUS_DRAFT = 'draft'
    STATUS_TESTING = 'testing'
    STATUS_APPROVED = 'approved'
    STATUS_DEPLOYED = 'deployed'
    STATUS_REJECTED = 'rejected'
    
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_TESTING, 'Testing'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_DEPLOYED, 'Deployed'),
        (STATUS_REJECTED, 'Rejected'),
    ]
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    sandbox_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT
    )
    
    # Base configuration (current production)
    base_configuration = models.JSONField(
        help_text='Current production configuration'
    )
    
    # Proposed changes
    changes = models.JSONField(
        help_text='Proposed metadata changes'
    )
    
    # Test results
    test_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Sample data for testing'
    )
    test_results = models.JSONField(
        default=dict,
        blank=True,
        help_text='Test execution results'
    )
    
    # Approval workflow
    approved_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='approved_sandboxes'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    deployed_at = models.DateTimeField(null=True, blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'config_sandbox'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.sandbox_status})"


class MetadataImpact(models.Model):
    """
    Impact analysis for metadata changes.
    Cached results of dependency analysis.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Entity being analyzed
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField(db_index=True)
    entity = GenericForeignKey('content_type', 'object_id')
    
    # Impact analysis results
    impact_data = models.JSONField(
        help_text='Detailed impact analysis: affected entities, counts, etc.'
    )
    
    # Cache metadata
    analyzed_at = models.DateTimeField(auto_now=True)
    is_stale = models.BooleanField(
        default=False,
        help_text='If true, needs re-analysis'
    )
    
    class Meta:
        db_table = 'metadata_impact'
        unique_together = [['content_type', 'object_id']]
    
    def __str__(self):
        return f"Impact: {self.content_type}"


class TenantConfiguration(TenantAwareModel):
    """
    Tenant-specific configuration and limits.
    """
    
    # Feature flags
    feature_flags = models.JSONField(
        default=dict,
        help_text='Enable/disable features per tenant'
    )
    
    # Limits
    limits = models.JSONField(
        default=dict,
        help_text='Max users, SKUs, documents, etc.'
    )
    
    # Customizations
    customizations = models.JSONField(
        default=dict,
        help_text='Tenant-specific overrides'
    )
    
    # Branding
    branding = models.JSONField(
        default=dict,
        help_text='Logo, colors, theme'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'tenant_config'
    
    def __str__(self):
        return f"Config for {self.company.name}"
