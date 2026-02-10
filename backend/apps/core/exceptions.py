"""
Structured exception handling with error codes.
All exceptions must be auditable and human-readable.
"""
from rest_framework.response import Response
from rest_framework import status


class ERPException(Exception):
    """
    Base exception for all ERP errors.
    
    Attributes:
        code: Machine-readable error code (e.g., 'STOCK_UNAVAILABLE')
        message: Human-readable error message
        details: Additional context (dict)
        http_status: HTTP status code
    """
    
    def __init__(self, code, message, details=None, http_status=status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.details = details or {}
        self.http_status = http_status
        super().__init__(message)


class ValidationError(ERPException):
    """Validation errors with specific field information."""
    
    def __init__(self, message, field=None, details=None):
        super().__init__(
            code='VALIDATION_ERROR',
            message=message,
            details={'field': field, **(details or {})},
            http_status=status.HTTP_400_BAD_REQUEST
        )


class BusinessRuleViolation(ERPException):
    """Business rule violations."""
    
    def __init__(self, rule_code, message, details=None):
        super().__init__(
            code=f'RULE_VIOLATION_{rule_code}',
            message=message,
            details=details,
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY
        )


class InsufficientStockError(ERPException):
    """Stock availability errors with specific details."""
    
    def __init__(self, sku_code, location_name, requested, available, details=None):
        message = (
            f"SKU {sku_code} has insufficient stock at {location_name}. "
            f"Requested: {requested}, Available: {available}"
        )
        super().__init__(
            code='INSUFFICIENT_STOCK',
            message=message,
            details={
                'sku_code': sku_code,
                'location': location_name,
                'requested': requested,
                'available': available,
                **(details or {})
            },
            http_status=status.HTTP_409_CONFLICT
        )


class WorkflowError(ERPException):
    """Workflow state transition errors."""
    
    def __init__(self, current_state, target_state, reason, details=None):
        message = (
            f"Cannot transition from '{current_state}' to '{target_state}': {reason}"
        )
        super().__init__(
            code='WORKFLOW_TRANSITION_ERROR',
            message=message,
            details={
                'current_state': current_state,
                'target_state': target_state,
                'reason': reason,
                **(details or {})
            },
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY
        )


class PermissionDeniedError(ERPException):
    """Permission errors with specific action and resource."""
    
    def __init__(self, action, resource, reason=None):
        message = f"Permission denied for action '{action}' on '{resource}'"
        if reason:
            message += f": {reason}"
        super().__init__(
            code='PERMISSION_DENIED',
            message=message,
            details={
                'action': action,
                'resource': resource,
                'reason': reason
            },
            http_status=status.HTTP_403_FORBIDDEN
        )


class ConcurrencyError(ERPException):
    """Optimistic locking failures."""
    
    def __init__(self, entity_type, entity_id):
        message = (
            f"{entity_type} {entity_id} was modified by another user. "
            "Please refresh and try again."
        )
        super().__init__(
            code='CONCURRENCY_ERROR',
            message=message,
            details={
                'entity_type': entity_type,
                'entity_id': str(entity_id)
            },
            http_status=status.HTTP_409_CONFLICT
        )


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    Converts ERPException to structured JSON response.
    """
    # Import here to avoid circular import
    from rest_framework.views import exception_handler as drf_exception_handler
    
    if isinstance(exc, ERPException):
        return Response(
            {
                'error': {
                    'code': exc.code,
                    'message': exc.message,
                    'details': exc.details
                }
            },
            status=exc.http_status
        )
    
    # Fall back to DRF's default handler
    response = drf_exception_handler(exc, context)
    
    if response is not None:
        # Wrap DRF errors in our format
        response.data = {
            'error': {
                'code': 'GENERIC_ERROR',
                'message': str(exc),
                'details': response.data
            }
        }
    
    return response
