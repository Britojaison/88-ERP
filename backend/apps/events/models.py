"""
Event System - Lightweight domain events.
Used for state changes, approvals, inventory movements.
Enables decoupled services and async processing.
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from apps.core.models import BaseModel
import uuid


class DomainEvent(models.Model):
    """
    Domain event record.
    Published when important business actions occur.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    event_type = models.CharField(
        max_length=255,
        db_index=True,
        help_text='Event type: inventory.reserved, document.approved, etc.'
    )
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # Source entity
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.UUIDField(db_index=True)
    source_entity = GenericForeignKey('content_type', 'object_id')
    
    # Event payload
    payload = models.JSONField(
        default=dict,
        help_text='Event data'
    )
    
    # User who triggered the event
    user = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='triggered_events'
    )
    
    # Processing status
    is_processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'event_domain'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['event_type', '-timestamp']),
            models.Index(fields=['is_processed', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.event_type} at {self.timestamp}"


class EventSubscription(models.Model):
    """
    Event subscription configuration.
    Defines which handlers should process which events.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    event_type = models.CharField(
        max_length=255,
        db_index=True,
        help_text='Event type pattern (supports wildcards)'
    )
    
    handler_name = models.CharField(
        max_length=255,
        help_text='Handler function name'
    )
    
    is_async = models.BooleanField(
        default=False,
        help_text='If true, process via Celery'
    )
    
    is_active = models.BooleanField(default=True)
    
    priority = models.IntegerField(
        default=0,
        help_text='Higher priority handlers execute first'
    )
    
    class Meta:
        db_table = 'event_subscription'
        ordering = ['-priority']
    
    def __str__(self):
        return f"{self.event_type} -> {self.handler_name}"
