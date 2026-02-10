"""
Business Rule and Validation Engine.
Rules stored in database, evaluated via engine.
Pre-save and pre-submit validations.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class Rule(TenantAwareModel):
    """
    Business rule definition.
    Examples:
    - "Size mandatory if category = apparel"
    - "MRP must be >= cost × 1.3"
    - "Cannot sell archived SKU"
    """
    
    RULE_TYPE_VALIDATION = 'validation'
    RULE_TYPE_CALCULATION = 'calculation'
    RULE_TYPE_CONSTRAINT = 'constraint'
    
    RULE_TYPE_CHOICES = [
        (RULE_TYPE_VALIDATION, 'Validation'),
        (RULE_TYPE_CALCULATION, 'Calculation'),
        (RULE_TYPE_CONSTRAINT, 'Constraint'),
    ]
    
    TRIGGER_PRE_SAVE = 'pre_save'
    TRIGGER_PRE_SUBMIT = 'pre_submit'
    TRIGGER_PRE_APPROVE = 'pre_approve'
    
    TRIGGER_CHOICES = [
        (TRIGGER_PRE_SAVE, 'Pre-Save'),
        (TRIGGER_PRE_SUBMIT, 'Pre-Submit'),
        (TRIGGER_PRE_APPROVE, 'Pre-Approve'),
    ]
    
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    rule_type = models.CharField(max_length=20, choices=RULE_TYPE_CHOICES)
    trigger = models.CharField(max_length=20, choices=TRIGGER_CHOICES)
    
    # Entity this rule applies to
    entity_type = models.CharField(max_length=100, db_index=True)
    
    # Rule expression (JSONLogic format)
    condition_expression = models.JSONField(
        help_text='Condition when rule applies (JSONLogic)'
    )
    
    # Error message if rule fails
    error_message = models.TextField(
        help_text='User-friendly error message'
    )
    error_code = models.CharField(max_length=100)
    
    # Priority (higher = evaluated first)
    priority = models.IntegerField(default=0)
    
    is_blocking = models.BooleanField(
        default=True,
        help_text='If true, prevents action on failure'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'rule_definition'
        unique_together = [['company', 'code']]
        ordering = ['-priority', 'code']
        indexes = [
            models.Index(fields=['company', 'entity_type', 'trigger']),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class RuleExecution(BaseModel):
    """
    Log of rule executions (for debugging and audit).
    """
    rule = models.ForeignKey(Rule, on_delete=models.PROTECT)
    
    entity_type = models.CharField(max_length=100)
    entity_id = models.UUIDField()
    
    passed = models.BooleanField()
    error_message = models.TextField(blank=True)
    
    execution_time_ms = models.IntegerField(
        help_text='Execution time in milliseconds'
    )
    
    context = models.JSONField(
        default=dict,
        help_text='Context data used in evaluation'
    )
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'rule_execution'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id', '-created_at']),
            models.Index(fields=['rule', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.rule.code} - {'PASS' if self.passed else 'FAIL'}"
