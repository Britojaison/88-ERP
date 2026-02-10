"""
Serializers for Attribute API.
"""
from rest_framework import serializers
from .models import AttributeDefinition, AttributeGroup, AttributeOption, AttributeValue


class AttributeOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeOption
        fields = ['id', 'code', 'label', 'display_order', 'status']
        read_only_fields = ['id']


class AttributeDefinitionSerializer(serializers.ModelSerializer):
    options = AttributeOptionSerializer(many=True, read_only=True)
    group_code = serializers.CharField(source='group.code', read_only=True, allow_null=True)
    
    class Meta:
        model = AttributeDefinition
        fields = [
            'id', 'code', 'name', 'entity_type', 'data_type',
            'is_required', 'is_variant_dimension', 'is_searchable', 'is_filterable',
            'validation_rules', 'display_order', 'group', 'group_code',
            'options', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttributeDefinitionCreateSerializer(serializers.ModelSerializer):
    options = AttributeOptionSerializer(many=True, required=False)
    
    class Meta:
        model = AttributeDefinition
        fields = [
            'code', 'name', 'entity_type', 'data_type',
            'is_required', 'is_variant_dimension', 'is_searchable', 'is_filterable',
            'validation_rules', 'display_order', 'group', 'options'
        ]
    
    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        attribute = AttributeDefinition.objects.create(**validated_data)
        
        for option_data in options_data:
            AttributeOption.objects.create(attribute=attribute, **option_data)
        
        return attribute


class AttributeGroupSerializer(serializers.ModelSerializer):
    attributes_count = serializers.IntegerField(source='attributes.count', read_only=True)
    
    class Meta:
        model = AttributeGroup
        fields = [
            'id', 'code', 'name', 'entity_type', 'display_order',
            'attributes_count', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttributeValueSerializer(serializers.ModelSerializer):
    attribute_code = serializers.CharField(source='attribute.code', read_only=True)
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    value = serializers.SerializerMethodField()
    
    class Meta:
        model = AttributeValue
        fields = [
            'id', 'attribute', 'attribute_code', 'attribute_name',
            'value', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_value(self, obj):
        return obj.get_value()
