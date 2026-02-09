"""
DRF permission classes using RBAC engine.
"""
from rest_framework import permissions
from .services import RBACService


class DynamicPermission(permissions.BasePermission):
    """
    Dynamic permission class that uses RBAC engine.
    Permissions are evaluated at runtime, not hard-coded.
    """
    
    def has_permission(self, request, view):
        """Check if user has permission for the view."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Get permission code from view
        permission_code = self._get_permission_code(request, view)
        
        if not permission_code:
            return True  # No permission required
        
        # Build context for conditional evaluation
        context = {
            'user': request.user,
            'method': request.method,
            'view': view.__class__.__name__,
        }
        
        return RBACService.has_permission(request.user, permission_code, context)
    
    def has_object_permission(self, request, view, obj):
        """Check if user has permission for specific object."""
        permission_code = self._get_permission_code(request, view)
        
        if not permission_code:
            return True
        
        context = {
            'user': request.user,
            'method': request.method,
            'view': view.__class__.__name__,
            'object': obj,
            'object_id': str(obj.id) if hasattr(obj, 'id') else None,
        }
        
        # Add object-specific context
        if hasattr(obj, 'company'):
            context['company_id'] = str(obj.company.id)
        
        if hasattr(obj, 'created_by'):
            context['is_owner'] = obj.created_by == request.user
        
        return RBACService.has_permission(request.user, permission_code, context)
    
    def _get_permission_code(self, request, view):
        """
        Get permission code from view.
        Views can define permission_code or permission_map.
        """
        # Check for explicit permission_code
        if hasattr(view, 'permission_code'):
            return view.permission_code
        
        # Check for permission_map based on action
        if hasattr(view, 'permission_map'):
            action = getattr(view, 'action', None)
            if action and action in view.permission_map:
                return view.permission_map[action]
        
        # Default mapping based on HTTP method
        if hasattr(view, 'permission_module'):
            module = view.permission_module
            action_map = {
                'GET': 'view',
                'POST': 'create',
                'PUT': 'update',
                'PATCH': 'update',
                'DELETE': 'delete',
            }
            action = action_map.get(request.method)
            if action:
                return f"{module}.{action}"
        
        return None
