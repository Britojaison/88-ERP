"""
Attribute service layer.
Handles attribute value management and validation.
"""
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from apps.core.exceptions import ValidationError
from .models import AttributeDefinition, AttributeValue


class AttributeService:
    """Service for managing entity attributes."""
    
    @staticmethod
    def get_entity_attributes(entity, company):
        """
        Get all attribute values for an entity.
        Returns dict: {attribute_code: value}
        """
        content_type = ContentType.objects.get_for_model(entity)
        
        values = AttributeValue.objects.filter(
            content_type=content_type,
            object_id=entity.id,
            status=AttributeValue.STATUS_ACTIVE
        ).select_related('attribute')
        
        return {
            av.attribute.code: av.get_value()
            for av in values
        }
    
    @staticmethod
    @transaction.atomic
    def set_entity_attributes(entity, attributes_dict, company, user=None):
        """
        Set multiple attributes for an entity.
        
        Args:
            entity: The entity instance
            attributes_dict: Dict of {attribute_code: value}
            company: Company instance
            user: User performing the action
        
        Raises:
            ValidationError: If validation fails
        """
        content_type = ContentType.objects.get_for_model(entity)
        entity_type = entity.__class__.__name__.lower()
        
        # Get attribute definitions
        attr_codes = list(attributes_dict.keys())
        definitions = AttributeDefinition.active.filter(
            company=company,
            entity_type=entity_type,
            code__in=attr_codes
        )
        
        definitions_map = {ad.code: ad for ad in definitions}
        
        # Validate all attributes
        for code, value in attributes_dict.items():
            if code not in definitions_map:
                raise ValidationError(
                    f"Attribute '{code}' not defined for {entity_type}",
                    field=code
                )
            
            definition = definitions_map[code]
            is_valid, error_msg = definition.validate_value(value)
            
            if not is_valid:
                raise ValidationError(error_msg, field=code)
        
        # Set attribute values
        for code, value in attributes_dict.items():
            definition = definitions_map[code]
            
            # Get or create attribute value
            attr_value, created = AttributeValue.objects.get_or_create(
                content_type=content_type,
                object_id=entity.id,
                attribute=definition,
                defaults={
                    'created_by': user,
                    'updated_by': user,
                }
            )
            
            if not created:
                attr_value.updated_by = user
            
            attr_value.set_value(value)
            attr_value.save()
    
    @staticmethod
    def validate_required_attributes(entity, company):
        """
        Validate that all required attributes are set.
        
        Returns:
            (is_valid, errors_dict)
        """
        content_type = ContentType.objects.get_for_model(entity)
        entity_type = entity.__class__.__name__.lower()
        
        # Get required attributes
        required_attrs = AttributeDefinition.active.filter(
            company=company,
            entity_type=entity_type,
            is_required=True
        )
        
        # Get existing values
        existing_values = AttributeValue.objects.filter(
            content_type=content_type,
            object_id=entity.id,
            status=AttributeValue.STATUS_ACTIVE
        ).values_list('attribute_id', flat=True)
        
        errors = {}
        for attr in required_attrs:
            if attr.id not in existing_values:
                errors[attr.code] = f"{attr.name} is required"
        
        return len(errors) == 0, errors
    
    @staticmethod
    def get_variant_dimensions(company, entity_type='sku'):
        """
        Get attributes that are variant dimensions.
        Used for product variant generation.
        """
        return AttributeDefinition.active.filter(
            company=company,
            entity_type=entity_type,
            is_variant_dimension=True
        ).order_by('display_order')
    
    @staticmethod
    def search_by_attributes(entity_class, company, attribute_filters):
        """
        Search entities by attribute values.
        
        Args:
            entity_class: Model class to search
            company: Company instance
            attribute_filters: Dict of {attribute_code: value}
        
        Returns:
            QuerySet of matching entities
        """
        content_type = ContentType.objects.get_for_model(entity_class)
        
        # Start with all entities
        entity_ids = entity_class.objects.filter(
            company=company,
            status=entity_class.STATUS_ACTIVE
        ).values_list('id', flat=True)
        
        # Filter by each attribute
        for attr_code, value in attribute_filters.items():
            matching_values = AttributeValue.objects.filter(
                content_type=content_type,
                object_id__in=entity_ids,
                attribute__code=attr_code,
                attribute__company=company,
                status=AttributeValue.STATUS_ACTIVE
            )
            
            # Filter by value based on data type
            # This is simplified - real implementation would handle all data types
            matching_values = matching_values.filter(value_text=value)
            
            entity_ids = matching_values.values_list('object_id', flat=True)
        
        return entity_class.objects.filter(id__in=entity_ids)
