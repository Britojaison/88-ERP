"""
Metadata Management API Views.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from .metadata_service import MetadataService, TemplateService
from .metadata_models import ConfigurationTemplate, ConfigurationSandbox
import json


class MetadataViewSet(viewsets.ViewSet):
    """
    API endpoints for metadata management.
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Export configuration for current company.
        
        Query params:
        - entity_types: Comma-separated list of entity types
        - format: json or yaml
        """
        company_id = request.user.company_id
        entity_types = request.query_params.get('entity_types')
        format_type = request.query_params.get('format', 'json')
        
        if entity_types:
            entity_types = entity_types.split(',')
        
        config = MetadataService.export_configuration(company_id, entity_types)
        
        if format_type == 'yaml':
            import yaml
            content = yaml.dump(config, default_flow_style=False)
            content_type = 'application/x-yaml'
            filename = 'configuration.yaml'
        else:
            content = json.dumps(config, indent=2)
            content_type = 'application/json'
            filename = 'configuration.json'
        
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    
    @action(detail=False, methods=['post'])
    def import_config(self, request):
        """
        Import configuration.
        
        Body:
        - configuration: Configuration data
        - validate_only: Boolean (default: false)
        """
        company_id = request.user.company_id
        config_data = request.data.get('configuration')
        validate_only = request.data.get('validate_only', False)
        
        if not config_data:
            return Response(
                {'error': 'Configuration data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = MetadataService.import_configuration(
            company_id,
            config_data,
            validate_only=validate_only
        )
        
        if results['success']:
            return Response(results, status=status.HTTP_200_OK)
        else:
            return Response(results, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        """
        Validate configuration without importing.
        """
        config_data = request.data.get('configuration')
        
        if not config_data:
            return Response(
                {'error': 'Configuration data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        errors = MetadataService.validate_configuration(config_data)
        
        return Response({
            'valid': len(errors) == 0,
            'errors': errors
        })
    
    @action(detail=False, methods=['get'], url_path='impact/(?P<entity_type>[^/.]+)/(?P<entity_id>[^/.]+)')
    def impact_analysis(self, request, entity_type=None, entity_id=None):
        """
        Get impact analysis for a metadata entity.
        """
        impact = MetadataService.get_impact_analysis(entity_type, entity_id)
        return Response(impact)


class TemplateViewSet(viewsets.ViewSet):
    """
    API endpoints for configuration templates.
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """List available templates."""
        industry = request.query_params.get('industry')
        templates = TemplateService.list_templates(industry)
        
        data = [
            {
                'id': str(t.id),
                'code': t.code,
                'name': t.name,
                'description': t.description,
                'industry': t.industry,
                'usage_count': t.usage_count,
            }
            for t in templates
        ]
        
        return Response(data)
    
    def retrieve(self, request, pk=None):
        """Get template details."""
        template = TemplateService.get_template(pk)
        
        return Response({
            'id': str(template.id),
            'code': template.code,
            'name': template.name,
            'description': template.description,
            'industry': template.industry,
            'configuration': template.configuration,
            'sample_data': template.sample_data,
        })
    
    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Apply template to current company."""
        company_id = request.user.company_id
        
        results = TemplateService.apply_template(company_id, pk)
        
        if results['success']:
            return Response(results, status=status.HTTP_200_OK)
        else:
            return Response(results, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def create_from_company(self, request):
        """Create template from current company configuration."""
        company_id = request.user.company_id
        name = request.data.get('name')
        industry = request.data.get('industry')
        
        if not name or not industry:
            return Response(
                {'error': 'Name and industry are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = TemplateService.create_template_from_company(
            company_id,
            name,
            industry
        )
        
        return Response({
            'id': str(template.id),
            'code': template.code,
            'name': template.name,
        }, status=status.HTTP_201_CREATED)


class SandboxViewSet(viewsets.ViewSet):
    """
    API endpoints for configuration sandboxes.
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """List sandboxes for current company."""
        company_id = request.user.company_id
        sandboxes = ConfigurationSandbox.objects.filter(
            company_id=company_id,
            status='active'
        )
        
        data = [
            {
                'id': str(s.id),
                'name': s.name,
                'description': s.description,
                'status': s.sandbox_status,
                'created_at': s.created_at,
                'created_by': s.created_by.email if s.created_by else None,
            }
            for s in sandboxes
        ]
        
        return Response(data)
    
    def create(self, request):
        """Create a new sandbox."""
        company_id = request.user.company_id
        name = request.data.get('name')
        changes = request.data.get('changes', {})
        
        if not name:
            return Response(
                {'error': 'Name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sandbox = MetadataService.create_sandbox(company_id, name, changes)
        
        return Response({
            'id': str(sandbox.id),
            'name': sandbox.name,
            'status': sandbox.sandbox_status,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def deploy(self, request, pk=None):
        """Deploy sandbox to production."""
        results = MetadataService.deploy_sandbox(pk)
        
        if results['success']:
            return Response(results, status=status.HTTP_200_OK)
        else:
            return Response(results, status=status.HTTP_400_BAD_REQUEST)
