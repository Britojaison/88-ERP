"""
Configuration Engine.
Key-value store for system configuration.
Used for tax rules, discount slabs, pricing rules, feature toggles.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class Configuration(TenantAwareModel):
    """
    Configuration key-value store.
    Scoped by company, business unit, or location.
    """
    
    SCOPE_GLOBAL = 'global'
    SCOPE_COMPANY = 'company'
    SCOPE_BUSINESS_UNIT = 'business_unit'
    SCOPE_LOCATION = 'location'
    
    SCOPE_CHOICES = [
        (SCOPE_GLOBAL, 'Global'),
        (SCOPE_COMPANY, 'Company'),
        (SCOPE_BUSINESS_UNIT, 'Business Unit'),
        (SCOPE_LOCATION, 'Location'),
    ]
    
    key = models.CharField(max_length=255, db_index=True)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default=SCOPE_COMPANY)
    
    # Scope references
    business_unit = models.ForeignKey(
        'mdm.BusinessUnit',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    # Value (stored as JSON for flexibility)
    value = models.JSONField()
    
    # Metadata
    description = models.TextField(blank=True)
    data_type = models.CharField(
        max_length=50,
        default='string',
        help_text='Expected data type: string, number, boolean, object, array'
    )
    
    is_sensitive = models.BooleanField(
        default=False,
        help_text='If true, value should be encrypted/masked'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'config'
        unique_together = [['company', 'key', 'scope', 'business_unit', 'location']]
        indexes = [
            models.Index(fields=['company', 'key', 'scope']),
        ]
    
    def __str__(self):
        return f"{self.key} ({self.scope})"


class ConfigurationHistory(BaseModel):
    """
    History of configuration changes (audit trail).
    """
    configuration = models.ForeignKey(
        Configuration,
        on_delete=models.CASCADE,
        related_name='history'
    )
    
    old_value = models.JSONField(null=True)
    new_value = models.JSONField()
    
    changed_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='config_changes'
    )
    
    reason = models.TextField(blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'config_history'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.configuration.key} changed at {self.created_at}"
