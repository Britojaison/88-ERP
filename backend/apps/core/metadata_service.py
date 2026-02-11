"""
Metadata Management Service.
Handles export, import, validation, and impact analysis of metadata.
"""
from pathlib import Path
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
            
            if 'numbering' in config_data:
                count = MetadataService._import_numbering(company_id, config_data['numbering'])
                results['imported']['numbering'] = count

            if 'document_types' in config_data:
                count = MetadataService._import_document_types(company_id, config_data['document_types'])
                results['imported']['document_types'] = count
            
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
        groups = attributes_data.get('groups', [])
        definitions = attributes_data.get('definitions', [])

        group_map: Dict[str, AttributeGroup] = {}
        for group in groups:
            grp_obj, _ = AttributeGroup.objects.update_or_create(
                company_id=company_id,
                code=group['code'],
                defaults={
                    'name': group['name'],
                    'entity_type': group['entity_type'],
                    'display_order': group.get('display_order', 0),
                    'status': 'active',
                },
            )
            group_map[group['code']] = grp_obj

        imported = 0
        for definition in definitions:
            group_code = definition.get('group_code')
            group_obj = group_map.get(group_code) if group_code else None

            attr_obj, _ = AttributeDefinition.objects.update_or_create(
                company_id=company_id,
                code=definition['code'],
                defaults={
                    'name': definition['name'],
                    'entity_type': definition['entity_type'],
                    'data_type': definition['data_type'],
                    'is_required': definition.get('is_required', False),
                    'is_variant_dimension': definition.get('is_variant_dimension', False),
                    'is_searchable': definition.get('is_searchable', True),
                    'is_filterable': definition.get('is_filterable', True),
                    'validation_rules': definition.get('validation_rules', {}),
                    'display_order': definition.get('display_order', 0),
                    'group': group_obj,
                    'status': 'active',
                },
            )

            options = definition.get('options', [])
            existing_codes = set()
            for option in options:
                existing_codes.add(option['code'])
                AttributeOption.objects.update_or_create(
                    company_id=company_id,
                    attribute=attr_obj,
                    code=option['code'],
                    defaults={
                        'label': option['label'],
                        'display_order': option.get('display_order', 0),
                        'status': 'active',
                    },
                )

            if existing_codes:
                AttributeOption.objects.filter(
                    company_id=company_id,
                    attribute=attr_obj,
                ).exclude(code__in=existing_codes).update(status='inactive')

            imported += 1

        return imported
    
    @staticmethod
    def _import_workflows(company_id: str, workflows_data: List[Dict[str, Any]]) -> int:
        """Import workflow definitions."""
        imported = 0

        for workflow in workflows_data:
            wf_obj, _ = Workflow.objects.update_or_create(
                company_id=company_id,
                code=workflow['code'],
                defaults={
                    'name': workflow['name'],
                    'description': workflow.get('description', ''),
                    'entity_type': workflow['entity_type'],
                    'status': 'active',
                },
            )

            state_map: Dict[str, WorkflowState] = {}
            initial_state = None
            state_codes = set()
            for state in workflow.get('states', []):
                state_codes.add(state['code'])
                state_obj, _ = WorkflowState.objects.update_or_create(
                    company_id=company_id,
                    workflow=wf_obj,
                    code=state['code'],
                    defaults={
                        'name': state['name'],
                        'is_initial': state.get('is_initial', False),
                        'is_final': state.get('is_final', False),
                        'allow_edit': state.get('allow_edit', True),
                        'allow_delete': state.get('allow_delete', False),
                        'status': 'active',
                    },
                )
                if state.get('is_initial'):
                    initial_state = state_obj
                state_map[state['code']] = state_obj

            if state_codes:
                WorkflowState.objects.filter(
                    company_id=company_id,
                    workflow=wf_obj,
                ).exclude(code__in=state_codes).update(status='inactive')

            if initial_state and wf_obj.initial_state_id != initial_state.id:
                wf_obj.initial_state = initial_state
                wf_obj.save(update_fields=['initial_state', 'updated_at', 'version'])

            transition_keys = set()
            for transition in workflow.get('transitions', []):
                from_state = state_map.get(transition['from_state'])
                to_state = state_map.get(transition['to_state'])
                if not from_state or not to_state:
                    continue

                approver_role = None
                approver_role_code = transition.get('approver_role')
                if approver_role_code:
                    approver_role, _ = Role.objects.get_or_create(
                        company_id=company_id,
                        code=approver_role_code,
                        defaults={'name': approver_role_code.replace('_', ' ').title(), 'description': ''},
                    )

                transition_obj, _ = WorkflowTransition.objects.update_or_create(
                    company_id=company_id,
                    workflow=wf_obj,
                    from_state=from_state,
                    to_state=to_state,
                    defaults={
                        'name': transition['name'],
                        'condition_expression': transition.get('condition_expression', {}),
                        'requires_approval': transition.get('requires_approval', False),
                        'approver_role': approver_role,
                        'actions': transition.get('actions', []),
                        'display_order': transition.get('display_order', 0),
                        'status': 'active',
                    },
                )
                transition_keys.add(transition_obj.id)

            if transition_keys:
                WorkflowTransition.objects.filter(
                    company_id=company_id,
                    workflow=wf_obj,
                ).exclude(id__in=transition_keys).update(status='inactive')

            imported += 1

        return imported
    
    @staticmethod
    def _import_rules(company_id: str, rules_data: List[Dict[str, Any]]) -> int:
        """Import rule definitions."""
        imported = 0
        seen_codes = set()
        for rule in rules_data:
            seen_codes.add(rule['code'])
            Rule.objects.update_or_create(
                company_id=company_id,
                code=rule['code'],
                defaults={
                    'name': rule['name'],
                    'description': rule.get('description', ''),
                    'rule_type': rule.get('rule_type', 'validation'),
                    'trigger': rule.get('trigger', 'pre_save'),
                    'entity_type': rule.get('entity_type', 'sku'),
                    'condition_expression': rule.get('condition_expression', {}),
                    'error_message': rule.get('error_message', ''),
                    'error_code': rule.get('error_code', ''),
                    'priority': rule.get('priority', 100),
                    'is_blocking': rule.get('is_blocking', True),
                    'status': 'active',
                },
            )
            imported += 1

        if seen_codes:
            Rule.objects.filter(company_id=company_id).exclude(code__in=seen_codes).update(status='inactive')

        return imported

    @staticmethod
    def _import_numbering(company_id: str, numbering_data: List[Dict[str, Any]]) -> int:
        imported = 0
        for seq in numbering_data:
            NumberingSequence.objects.update_or_create(
                company_id=company_id,
                code=seq['code'],
                defaults={
                    'name': seq['name'],
                    'format_pattern': seq['format_pattern'],
                    'prefix': seq.get('prefix', ''),
                    'scope_by_year': seq.get('scope_by_year', True),
                    'scope_by_month': seq.get('scope_by_month', False),
                    'scope_by_location': seq.get('scope_by_location', False),
                    'start_number': seq.get('start_number', 1),
                    'increment_by': seq.get('increment_by', 1),
                    'padding_length': seq.get('padding_length', 5),
                    'status': 'active',
                },
            )
            imported += 1
        return imported

    @staticmethod
    def _ensure_default_document_workflow(company_id: str) -> Workflow:
        workflow, _ = Workflow.objects.get_or_create(
            company_id=company_id,
            code='document_lifecycle',
            defaults={
                'name': 'Document Lifecycle',
                'description': 'Default workflow for commercial documents',
                'entity_type': 'document',
                'status': 'active',
            },
        )

        draft_state, _ = WorkflowState.objects.get_or_create(
            company_id=company_id,
            workflow=workflow,
            code='draft',
            defaults={
                'name': 'Draft',
                'is_initial': True,
                'is_final': False,
                'allow_edit': True,
                'allow_delete': True,
                'status': 'active',
            },
        )

        WorkflowState.objects.get_or_create(
            company_id=company_id,
            workflow=workflow,
            code='posted',
            defaults={
                'name': 'Posted',
                'is_initial': False,
                'is_final': True,
                'allow_edit': False,
                'allow_delete': False,
                'status': 'active',
            },
        )

        if not workflow.initial_state_id:
            workflow.initial_state = draft_state
            workflow.save(update_fields=['initial_state', 'updated_at', 'version'])

        return workflow

    @staticmethod
    def _import_document_types(company_id: str, document_types_data: List[Dict[str, Any]]) -> int:
        default_workflow = MetadataService._ensure_default_document_workflow(company_id)
        imported = 0

        for doc_type in document_types_data:
            code = doc_type['code']
            sequence_code = f"{code}_sequence"
            sequence = NumberingSequence.objects.filter(company_id=company_id, code=sequence_code).first()
            if not sequence:
                sequence, _ = NumberingSequence.objects.get_or_create(
                    company_id=company_id,
                    code=sequence_code,
                    defaults={
                        'name': f"{doc_type['name']} Sequence",
                        'format_pattern': f"{code.upper()}-{{year}}-{{sequence}}",
                        'prefix': f"{code.upper()}-",
                        'scope_by_year': True,
                        'scope_by_month': False,
                        'scope_by_location': False,
                        'start_number': 1,
                        'increment_by': 1,
                        'padding_length': 5,
                        'status': 'active',
                    },
                )

            DocumentType.objects.update_or_create(
                company_id=company_id,
                code=code,
                defaults={
                    'name': doc_type['name'],
                    'description': doc_type.get('description', ''),
                    'numbering_sequence': sequence,
                    'workflow': default_workflow,
                    'has_lines': doc_type.get('has_lines', True),
                    'requires_approval': doc_type.get('requires_approval', False),
                    'affects_inventory': doc_type.get('affects_inventory', False),
                    'affects_financials': doc_type.get('affects_financials', False),
                    'status': 'active',
                },
            )
            imported += 1

        return imported


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

    @staticmethod
    @transaction.atomic
    def bootstrap_fashion_for_company(company_id: str) -> Dict[str, Any]:
        template_path = Path(__file__).resolve().parent / 'templates' / 'fashion_retail.json'
        with open(template_path, 'r', encoding='utf-8') as fp:
            template_data = json.load(fp)

        result = MetadataService.import_configuration(company_id, template_data, validate_only=False)
        result['template'] = {
            'name': template_data.get('name'),
            'industry': template_data.get('industry'),
            'version': template_data.get('version'),
        }
        return result
