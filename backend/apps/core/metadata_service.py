"""
Metadata Management Service.
Handles export, import, validation, and impact analysis of metadata.
"""
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from apps.attributes.models import AttributeDefinition, AttributeGroup, AttributeOption
from apps.workflow.models import Workflow, WorkflowState, WorkflowTransition
from apps.rules.models import Rule
from apps.rbac.models import Permission, Role, RolePermission
from apps.documents.models import DocumentType
from apps.numbering.models import NumberingSequence
from .metadata_models import MetadataVersion, ConfigurationTemplate, ConfigurationSandbox, MetadataImpact
import json
from typing import Dict, List, Any


class MetadataService:
    """
    Service for managing metadata configuration.
    """
    
    @staticmethod
    def export_configuration(company_id: str, entity_types: List[str] = None) -> Dict[str, Any]:
        """
        Export complete configuration for a company.
        
        Args:
            company_id: Company UUID
            entity_types: List of entity types to export (None = all)
        
        Returns:
            Dictionary with complete configuration
        """
        config = {
            'version': '1.0',
            'exported_at': timezone.now().isoformat(),
            'company_id': str(company_id),
        }
        
        if not entity_types or 'attributes' in entity_types:
            config['attributes'] = MetadataService._export_attributes(company_id)
        
        if not entity_types or 'workflows' in entity_types:
            config['workflows'] = MetadataService._export_workflows(company_id)
        
        if not entity_types or 'rules' in entity_types:
            config['rules'] = MetadataService._export_rules(company_id)
        
        if not entity_types or 'permissions' in entity_types:
            config['permissions'] = MetadataService._export_permissions(company_id)
        
        if not entity_types or 'document_types' in entity_types:
            config['document_types'] = MetadataService._export_document_types(company_id)
        
        if not entity_types or 'numbering' in entity_types:
            config['numbering'] = MetadataService._export_numbering(company_id)
        
        return config
    
    @staticmethod
    def _export_attributes(company_id: str) -> Dict[str, Any]:
        """Export attribute definitions, groups, and options."""
        attributes = AttributeDefinition.objects.filter(company_id=company_id, status='active')
        groups = AttributeGroup.objects.filter(company_id=company_id, status='active')
        
        return {
            'definitions': [
                {
                    'code': attr.code,
                    'name': attr.name,
                    'entity_type': attr.entity_type,
                    'data_type': attr.data_type,
                    'is_required': attr.is_required,
                    'is_variant_dimension': attr.is_variant_dimension,
                    'is_searchable': attr.is_searchable,
                    'is_filterable': attr.is_filterable,
                    'validation_rules': attr.validation_rules,
                    'display_order': attr.display_order,
                    'group_code': attr.group.code if attr.group else None,
                    'options': [
                        {
                            'code': opt.code,
                            'label': opt.label,
                            'display_order': opt.display_order,
                        }
                        for opt in attr.options.filter(status='active')
                    ]
                }
                for attr in attributes
            ],
            'groups': [
                {
                    'code': grp.code,
                    'name': grp.name,
                    'entity_type': grp.entity_type,
                    'display_order': grp.display_order,
                }
                for grp in groups
            ]
        }
    
    @staticmethod
    def _export_workflows(company_id: str) -> List[Dict[str, Any]]:
        """Export workflow definitions."""
        workflows = Workflow.objects.filter(company_id=company_id, status='active')
        
        return [
            {
                'code': wf.code,
                'name': wf.name,
                'description': wf.description,
                'entity_type': wf.entity_type,
                'states': [
                    {
                        'code': state.code,
                        'name': state.name,
                        'is_initial': state.is_initial,
                        'is_final': state.is_final,
                        'allow_edit': state.allow_edit,
                        'allow_delete': state.allow_delete,
                    }
                    for state in wf.states.filter(status='active')
                ],
                'transitions': [
                    {
                        'name': trans.name,
                        'from_state': trans.from_state.code,
                        'to_state': trans.to_state.code,
                        'condition_expression': trans.condition_expression,
                        'requires_approval': trans.requires_approval,
                        'approver_role': trans.approver_role.code if trans.approver_role else None,
                        'actions': trans.actions,
                        'display_order': trans.display_order,
                    }
                    for trans in wf.transitions.filter(status='active')
                ]
            }
            for wf in workflows
        ]
    
    @staticmethod
    def _export_rules(company_id: str) -> List[Dict[str, Any]]:
        """Export business rules."""
        rules = Rule.objects.filter(company_id=company_id, status='active')
        
        return [
            {
                'code': rule.code,
                'name': rule.name,
                'description': rule.description,
                'rule_type': rule.rule_type,
                'trigger': rule.trigger,
                'entity_type': rule.entity_type,
                'condition_expression': rule.condition_expression,
                'error_message': rule.error_message,
                'error_code': rule.error_code,
                'priority': rule.priority,
                'is_blocking': rule.is_blocking,
            }
            for rule in rules
        ]
    
    @staticmethod
    def _export_permissions(company_id: str) -> Dict[str, Any]:
        """Export roles and permissions."""
        roles = Role.objects.filter(company_id=company_id, status='active')
        
        return {
            'roles': [
                {
                    'code': role.code,
                    'name': role.name,
                    'description': role.description,
                    'permissions': [
                        {
                            'permission_code': rp.permission.code,
                            'conditions': rp.conditions,
                        }
                        for rp in role.rolepermission_set.filter(status='active')
                    ]
                }
                for role in roles
            ]
        }
    
    @staticmethod
    def _export_document_types(company_id: str) -> List[Dict[str, Any]]:
        """Export document type definitions."""
        doc_types = DocumentType.objects.filter(company_id=company_id, status='active')
        
        return [
            {
                'code': dt.code,
                'name': dt.name,
                'description': dt.description,
                'has_lines': dt.has_lines,
                'requires_approval': dt.requires_approval,
                'affects_inventory': dt.affects_inventory,
                'affects_financials': dt.affects_financials,
            }
            for dt in doc_types
        ]
    
    @staticmethod
    def _export_numbering(company_id: str) -> List[Dict[str, Any]]:
        """Export numbering sequences."""
        sequences = NumberingSequence.objects.filter(company_id=company_id, status='active')
        
        return [
            {
                'code': seq.code,
                'name': seq.name,
                'format_pattern': seq.format_pattern,
                'prefix': seq.prefix,
                'scope_by_year': seq.scope_by_year,
                'scope_by_month': seq.scope_by_month,
                'scope_by_location': seq.scope_by_location,
                'start_number': seq.start_number,
                'increment_by': seq.increment_by,
                'padding_length': seq.padding_length,
            }
            for seq in sequences
        ]
    
    @staticmethod
    @transaction.atomic
    def import_configuration(company_id: str, config_data: Dict[str, Any], validate_only: bool = False) -> Dict[str, Any]:
        """
        Import configuration for a company.
        
        Args:
            company_id: Company UUID
            config_data: Configuration dictionary
            validate_only: If True, only validate without importing
        
        Returns:
            Import results with success/error details
        """
        results = {
            'success': True,
            'errors': [],
            'warnings': [],
            'imported': {},
        }
        
        # Validate configuration
        validation_errors = MetadataService.validate_configuration(config_data)
        if validation_errors:
            results['success'] = False
            results['errors'] = validation_errors
            return results
        
        if validate_only:
            results['message'] = 'Validation passed'
            return results
        
        # Import each entity type
        try:
            if 'attributes' in config_data:
                count = MetadataService._import_attributes(company_id, config_data['attributes'])
                results['imported']['attributes'] = count
            
            if 'workflows' in config_data:
                count = MetadataService._import_workflows(company_id, config_data['workflows'])
                results['imported']['workflows'] = count
            
            if 'rules' in config_data:
                count = MetadataService._import_rules(company_id, config_data['rules'])
                results['imported']['rules'] = count
            
            # Add more imports...
            
        except Exception as e:
            results['success'] = False
            results['errors'].append(str(e))
            raise
        
        return results
    
    @staticmethod
    def validate_configuration(config_data: Dict[str, Any]) -> List[str]:
        """
        Validate configuration data.
        
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        # Check required fields
        if 'version' not in config_data:
            errors.append("Missing 'version' field")
        
        # Validate workflows
        if 'workflows' in config_data:
            for wf in config_data['workflows']:
                wf_errors = MetadataService._validate_workflow(wf)
                errors.extend(wf_errors)
        
        # Validate attributes
        if 'attributes' in config_data:
            attr_errors = MetadataService._validate_attributes(config_data['attributes'])
            errors.extend(attr_errors)
        
        return errors
    
    @staticmethod
    def _validate_workflow(workflow_data: Dict[str, Any]) -> List[str]:
        """Validate workflow definition."""
        errors = []
        
        if 'states' not in workflow_data or not workflow_data['states']:
            errors.append(f"Workflow '{workflow_data.get('code')}' has no states")
        
        # Check for initial state
        initial_states = [s for s in workflow_data.get('states', []) if s.get('is_initial')]
        if not initial_states:
            errors.append(f"Workflow '{workflow_data.get('code')}' has no initial state")
        
        # Check for unreachable states
        # TODO: Implement graph traversal
        
        return errors
    
    @staticmethod
    def _validate_attributes(attributes_data: Dict[str, Any]) -> List[str]:
        """Validate attribute definitions."""
        errors = []
        
        definitions = attributes_data.get('definitions', [])
        
        # Check for duplicate codes
        codes = [attr['code'] for attr in definitions]
        duplicates = [code for code in codes if codes.count(code) > 1]
        if duplicates:
            errors.append(f"Duplicate attribute codes: {', '.join(set(duplicates))}")
        
        return errors
    
    @staticmethod
    def get_impact_analysis(entity_type: str, entity_id: str) -> Dict[str, Any]:
        """
        Analyze impact of changing/deleting a metadata entity.
        
        Returns:
            Dictionary with impact details
        """
        impact = {
            'entity_type': entity_type,
            'entity_id': entity_id,
            'affected_entities': {},
            'total_affected': 0,
        }
        
        # TODO: Implement actual impact analysis based on entity type
        
        return impact
    
    @staticmethod
    @transaction.atomic
    def create_sandbox(company_id: str, name: str, changes: Dict[str, Any]) -> ConfigurationSandbox:
        """Create a configuration sandbox for testing."""
        # Get current configuration
        base_config = MetadataService.export_configuration(company_id)
        
        sandbox = ConfigurationSandbox.objects.create(
            company_id=company_id,
            name=name,
            base_configuration=base_config,
            changes=changes,
            status='draft'
        )
        
        return sandbox
    
    @staticmethod
    @transaction.atomic
    def deploy_sandbox(sandbox_id: str) -> Dict[str, Any]:
        """Deploy sandbox changes to production."""
        sandbox = ConfigurationSandbox.objects.get(id=sandbox_id)
        
        if sandbox.sandbox_status != 'approved':
            raise ValueError("Sandbox must be approved before deployment")
        
        # Apply changes
        results = MetadataService.import_configuration(
            sandbox.company_id,
            sandbox.changes,
            validate_only=False
        )
        
        if results['success']:
            sandbox.sandbox_status = 'deployed'
            sandbox.deployed_at = timezone.now()
            sandbox.save()
        
        return results
    
    @staticmethod
    def _import_attributes(company_id: str, attributes_data: Dict[str, Any]) -> int:
        """Import attribute definitions."""
        # TODO: Implement actual import logic
        return len(attributes_data.get('definitions', []))
    
    @staticmethod
    def _import_workflows(company_id: str, workflows_data: List[Dict[str, Any]]) -> int:
        """Import workflow definitions."""
        # TODO: Implement actual import logic
        return len(workflows_data)
    
    @staticmethod
    def _import_rules(company_id: str, rules_data: List[Dict[str, Any]]) -> int:
        """Import rule definitions."""
        # TODO: Implement actual import logic
        return len(rules_data)


class TemplateService:
    """
    Service for managing configuration templates.
    """
    
    @staticmethod
    def list_templates(industry: str = None) -> List[ConfigurationTemplate]:
        """List available templates."""
        templates = ConfigurationTemplate.objects.filter(is_public=True, status='active')
        
        if industry:
            templates = templates.filter(industry=industry)
        
        return templates
    
    @staticmethod
    def get_template(template_id: str) -> ConfigurationTemplate:
        """Get template by ID."""
        return ConfigurationTemplate.objects.get(id=template_id)
    
    @staticmethod
    @transaction.atomic
    def apply_template(company_id: str, template_id: str) -> Dict[str, Any]:
        """Apply template to a company."""
        template = TemplateService.get_template(template_id)
        
        # Import template configuration
        results = MetadataService.import_configuration(
            company_id,
            template.configuration,
            validate_only=False
        )
        
        if results['success']:
            template.usage_count += 1
            template.save()
        
        return results
    
    @staticmethod
    @transaction.atomic
    def create_template_from_company(company_id: str, name: str, industry: str) -> ConfigurationTemplate:
        """Create a template from existing company configuration."""
        config = MetadataService.export_configuration(company_id)
        
        template = ConfigurationTemplate.objects.create(
            company_id=company_id,
            code=name.lower().replace(' ', '_'),
            name=name,
            industry=industry,
            configuration=config,
            is_public=False
        )
        
        return template
