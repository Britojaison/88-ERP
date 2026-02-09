"""
RBAC service layer.
Evaluates permissions at runtime.
"""
from django.db.models import Q
from apps.core.exceptions import PermissionDeniedError
from .models import UserRole, RolePermission, PermissionRule


class RBACService:
    """Service for evaluating permissions."""
    
    @staticmethod
    def has_permission(user, permission_code, context=None):
        """
        Check if user has permission.
        
        Args:
            user: User instance
            permission_code: Permission code (e.g., 'inventory.view')
            context: Optional context dict for conditional evaluation
        
        Returns:
            bool
        """
        if user.is_superuser:
            return True
        
        # Get user's roles
        user_roles = UserRole.active.filter(user=user).select_related('role')
        
        # Check if any role has the permission
        for user_role in user_roles:
            role_perms = RolePermission.active.filter(
                role=user_role.role,
                permission__code=permission_code
            )
            
            if role_perms.exists():
                # Check conditions if provided
                for role_perm in role_perms:
                    if RBACService._evaluate_conditions(role_perm.conditions, context):
                        return True
        
        return False
    
    @staticmethod
    def require_permission(user, permission_code, context=None):
        """
        Require permission or raise exception.
        
        Raises:
            PermissionDeniedError
        """
        if not RBACService.has_permission(user, permission_code, context):
            raise PermissionDeniedError(
                action=permission_code,
                resource=context.get('resource', 'unknown') if context else 'unknown'
            )
    
    @staticmethod
    def get_user_permissions(user):
        """
        Get all permissions for a user.
        
        Returns:
            Set of permission codes
        """
        if user.is_superuser:
            from .models import Permission
            return set(Permission.active.values_list('code', flat=True))
        
        user_roles = UserRole.active.filter(user=user).values_list('role_id', flat=True)
        
        role_perms = RolePermission.active.filter(
            role_id__in=user_roles
        ).select_related('permission')
        
        return {rp.permission.code for rp in role_perms}
    
    @staticmethod
    def _evaluate_conditions(conditions, context):
        """
        Evaluate permission conditions.
        
        Args:
            conditions: Dict with condition logic
            context: Context dict with values
        
        Returns:
            bool
        """
        if not conditions or not context:
            return True
        
        # Simple condition evaluation
        # In production, use JSONLogic or similar library
        
        # Example: {"field": "amount", "operator": "lt", "value": 10000}
        if 'field' in conditions:
            field = conditions['field']
            operator = conditions.get('operator', 'eq')
            expected = conditions.get('value')
            actual = context.get(field)
            
            if operator == 'eq':
                return actual == expected
            elif operator == 'lt':
                return actual < expected
            elif operator == 'lte':
                return actual <= expected
            elif operator == 'gt':
                return actual > expected
            elif operator == 'gte':
                return actual >= expected
            elif operator == 'in':
                return actual in expected
        
        return True
    
    @staticmethod
    def filter_by_permission(queryset, user, permission_code):
        """
        Filter queryset based on user permissions.
        Used for row-level security.
        
        Args:
            queryset: Django QuerySet
            user: User instance
            permission_code: Permission code
        
        Returns:
            Filtered QuerySet
        """
        if user.is_superuser:
            return queryset
        
        # Get user roles with scope restrictions
        user_roles = UserRole.active.filter(user=user).select_related('role')
        
        # Build filter based on role scopes
        filters = Q()
        
        for user_role in user_roles:
            role_filter = Q()
            
            if user_role.business_unit:
                role_filter &= Q(business_unit=user_role.business_unit)
            
            if user_role.location:
                role_filter &= Q(location=user_role.location)
            
            if role_filter:
                filters |= role_filter
        
        if filters:
            return queryset.filter(filters)
        
        return queryset
