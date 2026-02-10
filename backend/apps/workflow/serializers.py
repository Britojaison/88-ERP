"""
Serializers for Workflow API.
"""
from rest_framework import serializers
from .models import Workflow, WorkflowState, WorkflowTransition, DocumentWorkflow, WorkflowHistory


class WorkflowStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowState
        fields = [
            'id', 'code', 'name', 'is_initial', 'is_final',
            'allow_edit', 'allow_delete', 'status'
        ]
        read_only_fields = ['id']


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    from_state_code = serializers.CharField(source='from_state.code', read_only=True)
    to_state_code = serializers.CharField(source='to_state.code', read_only=True)
    approver_role_code = serializers.CharField(source='approver_role.code', read_only=True, allow_null=True)
    
    class Meta:
        model = WorkflowTransition
        fields = [
            'id', 'from_state', 'from_state_code', 'to_state', 'to_state_code',
            'name', 'condition_expression', 'requires_approval',
            'approver_role', 'approver_role_code', 'actions', 'display_order', 'status'
        ]
        read_only_fields = ['id']


class WorkflowSerializer(serializers.ModelSerializer):
    states = WorkflowStateSerializer(many=True, read_only=True)
    transitions = WorkflowTransitionSerializer(many=True, read_only=True)
    initial_state_code = serializers.CharField(source='initial_state.code', read_only=True, allow_null=True)
    
    class Meta:
        model = Workflow
        fields = [
            'id', 'code', 'name', 'description', 'entity_type',
            'initial_state', 'initial_state_code', 'states', 'transitions',
            'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkflowCreateSerializer(serializers.ModelSerializer):
    states = WorkflowStateSerializer(many=True, required=False)
    transitions = WorkflowTransitionSerializer(many=True, required=False)
    
    class Meta:
        model = Workflow
        fields = ['code', 'name', 'description', 'entity_type', 'states', 'transitions']
    
    def create(self, validated_data):
        states_data = validated_data.pop('states', [])
        transitions_data = validated_data.pop('transitions', [])
        
        workflow = Workflow.objects.create(**validated_data)
        
        # Create states
        state_map = {}
        for state_data in states_data:
            state = WorkflowState.objects.create(
                workflow=workflow,
                company_id=workflow.company_id,
                **state_data
            )
            state_map[state.code] = state
            
            # Set initial state
            if state.is_initial:
                workflow.initial_state = state
                workflow.save()
        
        # Create transitions
        for trans_data in transitions_data:
            from_state_code = trans_data.pop('from_state_code', None)
            to_state_code = trans_data.pop('to_state_code', None)
            
            if from_state_code and to_state_code:
                WorkflowTransition.objects.create(
                    workflow=workflow,
                    from_state=state_map.get(from_state_code),
                    to_state=state_map.get(to_state_code),
                    company_id=workflow.company_id,
                    **trans_data
                )
        
        return workflow


class DocumentWorkflowSerializer(serializers.ModelSerializer):
    workflow_code = serializers.CharField(source='workflow.code', read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    current_state_code = serializers.CharField(source='current_state.code', read_only=True)
    current_state_name = serializers.CharField(source='current_state.name', read_only=True)
    
    class Meta:
        model = DocumentWorkflow
        fields = [
            'id', 'workflow', 'workflow_code', 'workflow_name',
            'current_state', 'current_state_code', 'current_state_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkflowHistorySerializer(serializers.ModelSerializer):
    from_state_code = serializers.CharField(source='from_state.code', read_only=True, allow_null=True)
    to_state_code = serializers.CharField(source='to_state.code', read_only=True)
    approved_by_email = serializers.CharField(source='approved_by.email', read_only=True, allow_null=True)
    
    class Meta:
        model = WorkflowHistory
        fields = [
            'id', 'from_state', 'from_state_code', 'to_state', 'to_state_code',
            'transition', 'comments', 'approved_by', 'approved_by_email',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
