"""
Attribute Engine - Dynamic attribute system.
NO hard-coded attributes (size, color, fabric, etc.).
All attributes are metadata-driven.
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager
import json


class AttributeDefinition(TenantAwareModel):
    """
    Defines an attribute that can be attached to any entity.
    
    Examples:
    - entity_type: 'sku', name: 'size', data_type: 'string'
    - entity_type: 'sku', name: 'color', data_type: 'string'
    - entity_type: 'product', name: 'season', data_type: 'string'
    - entity_type: 'customer', name: 'tier', data_type: 'string'
    """
    
    DATA_TYPE_STRING = 'string'
    DATA_TYPE_INTEGER = 'integer'
    DATA_TYPE_DECIMAL = 'decimal'
    DATA_TYPE_BOOLEAN = 'boolean'
    DATA_TYPE_DATE = 'date'
    DATA_TYPE_DATETIME = 'datetime'
    DATA_TYPE_JSON = 'json'
    
    DATA_TYPE_CHOICES = [
        (DATA_TYPE_STRING, 'String'),
        (DATA_TYPE_INTEGER, 'Integer'),
        (DATA_TYPE_DECIMAL, 'Decimal'),
        (DATA_TYPE_BOOLEAN, 'Boolean'),
        (DATA_TYPE_DATE, 'Date'),
        (DATA_TYPE_DATETIME, 'DateTime'),
        (DATA_TYPE_JSON, 'JSON'),
    ]
    
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    entity_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Entity type this attribute applies to (e.g., sku, product, customer)'
    )
    
    data_type = models.CharField(max_length=20, choices=DATA_TYPE_CHOICES)
    
    is_required = models.BooleanField(default=False)
    is_variant_dimension = models.BooleanField(
        default=False,
        help_text='If true, this attribute creates product variants (e.g., size, color)'
    )
    is_searchable = models.BooleanField(default=True)
    is_filterable = models.BooleanField(default=True)
    
    # Validation rules (stored as JSON)
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text='Validation rules: min, max, pattern, allowed_values, etc.'
    )
    
    # Display configuration
    display_order = models.IntegerField(default=0)
    group = models.ForeignKey(
        'AttributeGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attributes'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'attr_definition'
        unique_together = [['company', 'entity_type', 'code']]
        indexes = [
            models.Index(fields=['company', 'entity_type', 'status']),
        ]
    
    def __str__(self):
        return f"{self.entity_type}.{self.code}"
    
    def validate_value(self, value):
        """
        Validate a value against this attribute's rules.
        Returns (is_valid, error_message).
        """
        if self.is_required and value is None:
            return False, f"{self.name} is required"
        
        if value is None:
            return True, None
        
        # Type validation
        try:
            if self.data_type == self.DATA_TYPE_INTEGER:
                value = int(value)
            elif self.data_type == self.DATA_TYPE_DECIMAL:
                value = float(value)
            elif self.data_type == self.DATA_TYPE_BOOLEAN:
                value = bool(value)
        except (ValueError, TypeError):
            return False, f"Invalid {self.data_type} value"
        
        # Custom validation rules
        rules = self.validation_rules
        
        if 'allowed_values' in rules:
            if value not in rules['allowed_values']:
                return False, f"Value must be one of: {', '.join(rules['allowed_values'])}"
        
        if 'min' in rules and value < rules['min']:
            return False, f"Value must be >= {rules['min']}"
        
        if 'max' in rules and value > rules['max']:
            return False, f"Value must be <= {rules['max']}"
        
        if 'pattern' in rules:
            import re
            if not re.match(rules['pattern'], str(value)):
                return False, f"Value does not match required pattern"
        
        return True, None


class AttributeGroup(TenantAwareModel):
    """
    Groups attributes for UI organization.
    Example: 'Physical Attributes', 'Pricing', 'Classification'
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=100, db_index=True)
    display_order = models.IntegerField(default=0)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'attr_group'
        unique_together = [['company', 'entity_type', 'code']]
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f"{self.entity_type}.{self.name}"


class AttributeValue(BaseModel):
    """
    Stores actual attribute values for entities.
    Uses generic foreign key to support any entity type.
    
    Example:
    - entity: SKU(id=123), attribute: 'size', value: 'M'
    - entity: SKU(id=123), attribute: 'color', value: 'Blue'
    """
    
    # Generic foreign key to any entity
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField(db_index=True)
    entity = GenericForeignKey('content_type', 'object_id')
    
    attribute = models.ForeignKey(
        AttributeDefinition,
        on_delete=models.PROTECT,
        related_name='values'
    )
    
    # Store value as text, convert based on attribute.data_type
    value_text = models.TextField(blank=True, null=True)
    value_integer = models.BigIntegerField(blank=True, null=True)
    value_decimal = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        blank=True,
        null=True
    )
    value_boolean = models.BooleanField(blank=True, null=True)
    value_date = models.DateField(blank=True, null=True)
    value_datetime = models.DateTimeField(blank=True, null=True)
    value_json = models.JSONField(blank=True, null=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'attr_value'
        unique_together = [['content_type', 'object_id', 'attribute']]
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['attribute', 'value_text']),
            models.Index(fields=['attribute', 'value_integer']),
        ]
    
    def __str__(self):
        return f"{self.attribute.code}={self.get_value()}"
    
    def get_value(self):
        """Get the value in the correct data type."""
        data_type = self.attribute.data_type
        
        if data_type == AttributeDefinition.DATA_TYPE_STRING:
            return self.value_text
        elif data_type == AttributeDefinition.DATA_TYPE_INTEGER:
            return self.value_integer
        elif data_type == AttributeDefinition.DATA_TYPE_DECIMAL:
            return self.value_decimal
        elif data_type == AttributeDefinition.DATA_TYPE_BOOLEAN:
            return self.value_boolean
        elif data_type == AttributeDefinition.DATA_TYPE_DATE:
            return self.value_date
        elif data_type == AttributeDefinition.DATA_TYPE_DATETIME:
            return self.value_datetime
        elif data_type == AttributeDefinition.DATA_TYPE_JSON:
            return self.value_json
        
        return None
    
    def set_value(self, value):
        """Set the value in the correct field based on data type."""
        data_type = self.attribute.data_type
        
        # Clear all value fields first
        self.value_text = None
        self.value_integer = None
        self.value_decimal = None
        self.value_boolean = None
        self.value_date = None
        self.value_datetime = None
        self.value_json = None
        
        if value is None:
            return
        
        if data_type == AttributeDefinition.DATA_TYPE_STRING:
            self.value_text = str(value)
        elif data_type == AttributeDefinition.DATA_TYPE_INTEGER:
            self.value_integer = int(value)
        elif data_type == AttributeDefinition.DATA_TYPE_DECIMAL:
            self.value_decimal = float(value)
        elif data_type == AttributeDefinition.DATA_TYPE_BOOLEAN:
            self.value_boolean = bool(value)
        elif data_type == AttributeDefinition.DATA_TYPE_DATE:
            self.value_date = value
        elif data_type == AttributeDefinition.DATA_TYPE_DATETIME:
            self.value_datetime = value
        elif data_type == AttributeDefinition.DATA_TYPE_JSON:
            self.value_json = value


class AttributeOption(TenantAwareModel):
    """
    Predefined options for attributes (dropdown values).
    Example: For 'size' attribute: XS, S, M, L, XL
    """
    attribute = models.ForeignKey(
        AttributeDefinition,
        on_delete=models.CASCADE,
        related_name='options'
    )
    
    code = models.CharField(max_length=100)
    label = models.CharField(max_length=255)
    display_order = models.IntegerField(default=0)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'attr_option'
        unique_together = [['attribute', 'code']]
        ordering = ['display_order', 'label']
    
    def __str__(self):
        return f"{self.attribute.code}: {self.label}"
