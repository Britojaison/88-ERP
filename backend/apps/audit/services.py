"""
Audit service layer.
Handles audit log creation.
"""
from django.contrib.contenttypes.models import ContentType
from .models import AuditLog
import uuid


class AuditService:
    """Service for creating audit logs."""
    
    @staticmethod
    def log_create(entity, user, ip_address=None, context=None):
        """Log entity creation."""
        content_type = ContentType.objects.get_for_model(entity)
        
        AuditLog.objects.create(
            content_type=content_type,
            object_id=entity.id,
            action=AuditLog.ACTION_CREATE,
            user=user,
            ip_address=ip_address,
            new_value=AuditService._serialize_entity(entity),
            context=context or {}
        )
    
    @staticmethod
    def log_update(entity, user, changed_fields, old_values, ip_address=None, context=None):
        """
        Log entity update.
        
        Args:
            entity: Updated entity
            user: User performing update
            changed_fields: List of changed field names
            old_values: Dict of {field_name: old_value}
            ip_address: IP address
            context: Additional context
        """
        content_type = ContentType.objects.get_for_model(entity)
        
        for field_name in changed_fields:
            old_value = old_values.get(field_name)
            new_value = getattr(entity, field_name, None)
            
            AuditLog.objects.create(
                content_type=content_type,
                object_id=entity.id,
                action=AuditLog.ACTION_UPDATE,
                user=user,
                ip_address=ip_address,
                field_name=field_name,
                old_value=AuditService._serialize_value(old_value),
                new_value=AuditService._serialize_value(new_value),
                context=context or {}
            )
    
    @staticmethod
    def log_delete(entity, user, ip_address=None, context=None):
        """Log entity deletion (soft delete)."""
        content_type = ContentType.objects.get_for_model(entity)
        
        AuditLog.objects.create(
            content_type=content_type,
            object_id=entity.id,
            action=AuditLog.ACTION_DELETE,
            user=user,
            ip_address=ip_address,
            old_value=AuditService._serialize_entity(entity),
            context=context or {}
        )
    
    @staticmethod
    def log_state_change(entity, user, from_state, to_state, ip_address=None, context=None):
        """Log workflow state change."""
        content_type = ContentType.objects.get_for_model(entity)
        
        AuditLog.objects.create(
            content_type=content_type,
            object_id=entity.id,
            action=AuditLog.ACTION_STATE_CHANGE,
            user=user,
            ip_address=ip_address,
            field_name='state',
            old_value=from_state,
            new_value=to_state,
            context=context or {}
        )
    
    @staticmethod
    def log_approval(entity, user, ip_address=None, context=None):
        """Log approval action."""
        content_type = ContentType.objects.get_for_model(entity)
        
        AuditLog.objects.create(
            content_type=content_type,
            object_id=entity.id,
            action=AuditLog.ACTION_APPROVAL,
            user=user,
            ip_address=ip_address,
            context=context or {}
        )
    
    @staticmethod
    def get_entity_history(entity):
        """Get audit history for an entity."""
        content_type = ContentType.objects.get_for_model(entity)
        
        return AuditLog.objects.filter(
            content_type=content_type,
            object_id=entity.id
        ).select_related('user')
    
    @staticmethod
    def _serialize_entity(entity):
        """Serialize entity for audit log."""
        # Simple serialization - in production use DRF serializer
        data = {}
        for field in entity._meta.fields:
            value = getattr(entity, field.name, None)
            data[field.name] = AuditService._serialize_value(value)
        return data
    
    @staticmethod
    def _serialize_value(value):
        """Serialize a value for JSON storage."""
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, uuid.UUID):
            return str(value)
        if hasattr(value, 'isoformat'):  # datetime/date
            return value.isoformat()
        return str(value)
