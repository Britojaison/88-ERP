"""
API Views for Attribute Management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from .models import AttributeDefinition, AttributeGroup, AttributeOption
from .serializers import (
    AttributeDefinitionSerializer,
    AttributeDefinitionCreateSerializer,
    AttributeGroupSerializer,
    AttributeOptionSerializer
)


class AttributeDefinitionViewSet(viewsets.ModelViewSet):
    """
    API endpoints for attribute definitions.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = AttributeDefinition.objects.filter(company_id=company_id, status='active')
        
        # Filter by entity type
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        return queryset.select_related('group').prefetch_related('options')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AttributeDefinitionCreateSerializer
        return AttributeDefinitionSerializer
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
    
    @action(detail=True, methods=['post'])
    def add_option(self, request, pk=None):
        """Add an option to an attribute."""
        attribute = self.get_object()
        serializer = AttributeOptionSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(
                attribute=attribute,
                company_id=request.user.company_id
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def remove_option(self, request, pk=None):
        """Remove an option from an attribute."""
        attribute = self.get_object()
        option_id = request.data.get('option_id')
        
        try:
            option = AttributeOption.objects.get(
                id=option_id,
                attribute=attribute
            )
            option.status = 'deleted'
            option.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AttributeOption.DoesNotExist:
            return Response(
                {'error': 'Option not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def validate_value(self, request, pk=None):
        """Validate a value against attribute rules."""
        attribute = self.get_object()
        value = request.data.get('value')
        
        is_valid, error_message = attribute.validate_value(value)
        
        return Response({
            'valid': is_valid,
            'error': error_message
        })


class AttributeGroupViewSet(viewsets.ModelViewSet):
    """
    API endpoints for attribute groups.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AttributeGroupSerializer
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = AttributeGroup.objects.filter(company_id=company_id, status='active')
        
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
