from django.contrib import admin
from .models import AttributeDefinition, AttributeGroup, AttributeValue, AttributeOption


@admin.register(AttributeDefinition)
class AttributeDefinitionAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'entity_type', 'data_type', 'is_required', 'is_variant_dimension', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'entity_type', 'data_type', 'is_required', 'is_variant_dimension', 'status']


@admin.register(AttributeGroup)
class AttributeGroupAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'entity_type', 'display_order', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'entity_type', 'status']


@admin.register(AttributeValue)
class AttributeValueAdmin(admin.ModelAdmin):
    list_display = ['attribute', 'content_type', 'object_id', 'get_value', 'status']
    search_fields = ['value_text']
    list_filter = ['attribute', 'content_type', 'status']
    
    def get_value(self, obj):
        return obj.get_value()
    get_value.short_description = 'Value'


@admin.register(AttributeOption)
class AttributeOptionAdmin(admin.ModelAdmin):
    list_display = ['attribute', 'code', 'label', 'display_order', 'company', 'status']
    search_fields = ['code', 'label']
    list_filter = ['attribute', 'company', 'status']
