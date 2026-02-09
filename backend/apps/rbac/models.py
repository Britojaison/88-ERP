"""
RBAC Engine - Role-Based Access Control.
Permissions evaluated at runtime via condition expressions.
NO hard-coded role checks in code.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager
import json


class Permission(BaseModel):
    """
    Defines a permission in the system.
    Format: module.action (e.g., 'inventory.view', 'documents.approve')
    """
    code = models.CharField(max_length=100, unique=True, db_index=True)
    module = models.CharField(max_length=50, db_index=True)
    action = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'rbac_permission'
        unique_together = [['module', 'action']]
    
    def __str__(self):
        return self.code


class Role(TenantAwareModel):
    """
    Role definition.
    Roles are assigned permissions, not hard-coded.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    permissions = models.ManyToManyField(
        Permission,
        through='RolePermission',
        related_name='roles'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'rbac_role'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class RolePermission(BaseModel):
    """
    Links roles to permissions.
    Can include conditions for fine-grained control.
    """
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    
    # Optional conditions (JSONLogic or similar)
    conditions = models.JSONField(
        default=dict,
        blank=True,
        help_text='Conditional logic for permission (e.g., own records only)'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'rbac_role_permission'
        unique_together = [['role', 'permission']]
    
    def __str__(self):
        return f"{self.role.code} -> {self.permission.code}"


class UserRole(BaseModel):
    """
    Assigns roles to users.
    Users can have multiple roles.
    """
    user = models.ForeignKey('mdm.User', on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    
    # Optional scope restrictions
    business_unit = models.ForeignKey(
        'mdm.BusinessUnit',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Restrict role to specific business unit'
    )
    location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Restrict role to specific location'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'rbac_user_role'
        unique_together = [['user', 'role', 'business_unit', 'location']]
    
    def __str__(self):
        return f"{self.user.email} -> {self.role.code}"


class PermissionRule(TenantAwareModel):
    """
    Advanced permission rules with conditions.
    Example: "User can approve if amount < 10000 OR user is manager"
    """
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='permission_rules')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    
    # Condition expression (JSONLogic format)
    condition_expression = models.JSONField(
        help_text='JSONLogic expression for conditional permission'
    )
    
    # Allowed values (for field-level permissions)
    allowed_values = models.JSONField(
        default=dict,
        blank=True,
        help_text='Allowed values for specific fields'
    )
    
    priority = models.IntegerField(default=0, help_text='Higher priority rules evaluated first')
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'rbac_permission_rule'
        ordering = ['-priority']
    
    def __str__(self):
        return f"{self.role.code} -> {self.permission.code} (conditional)"
