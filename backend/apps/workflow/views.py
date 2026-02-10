"""
API Views for Workflow Management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from .models import Workflow, WorkflowState, WorkflowTransition
from .serializers import (
    WorkflowSerializer,
    WorkflowCreateSerializer,
    WorkflowStateSerializer,
    WorkflowTransitionSerializer
)


class WorkflowViewSet(viewsets.ModelViewSet):
    """
    API endpoints for workflow definitions.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = Workflow.objects.filter(company_id=company_id, status='active')
        
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        return queryset.prefetch_related('states', 'transitions')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return WorkflowCreateSerializer
        return WorkflowSerializer
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
    
    @action(detail=True, methods=['post'])
    def add_state(self, request, pk=None):
        """Add a state to a workflow."""
        workflow = self.get_object()
        serializer = WorkflowStateSerializer(data=request.data)
        
        if serializer.is_valid():
            state = serializer.save(
                workflow=workflow,
                company_id=request.user.company_id
            )
            
            # Set as initial state if specified
            if request.data.get('is_initial') and not workflow.initial_state:
                workflow.initial_state = state
                workflow.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_transition(self, request, pk=None):
        """Add a transition to a workflow."""
        workflow = self.get_object()
        serializer = WorkflowTransitionSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(
                workflow=workflow,
                company_id=request.user.company_id
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Validate workflow definition."""
        workflow = self.get_object()
        errors = []
        
        # Check for initial state
        if not workflow.initial_state:
            errors.append("Workflow must have an initial state")
        
        # Check for unreachable states
        states = workflow.states.filter(status='active')
        transitions = workflow.transitions.filter(status='active')
        
        if states.count() == 0:
            errors.append("Workflow must have at least one state")
        
        # Check for final states
        final_states = states.filter(is_final=True)
        if final_states.count() == 0:
            errors.append("Workflow should have at least one final state")
        
        # Check for orphaned states (no transitions in or out)
        for state in states:
            if not state.is_initial:
                has_incoming = transitions.filter(to_state=state).exists()
                if not has_incoming:
                    errors.append(f"State '{state.code}' has no incoming transitions")
        
        return Response({
            'valid': len(errors) == 0,
            'errors': errors
        })
    
    @action(detail=True, methods=['post'])
    def test_transition(self, request, pk=None):
        """Test if a transition is allowed given context."""
        workflow = self.get_object()
        from_state_code = request.data.get('from_state')
        to_state_code = request.data.get('to_state')
        context = request.data.get('context', {})
        
        try:
            from_state = workflow.states.get(code=from_state_code)
            to_state = workflow.states.get(code=to_state_code)
            transition = workflow.transitions.get(
                from_state=from_state,
                to_state=to_state,
                status='active'
            )
            
            # TODO: Evaluate condition_expression with context using JSONLogic
            # For now, just return basic info
            
            return Response({
                'allowed': True,
                'transition': WorkflowTransitionSerializer(transition).data,
                'requires_approval': transition.requires_approval,
                'approver_role': transition.approver_role.code if transition.approver_role else None
            })
        
        except (WorkflowState.DoesNotExist, WorkflowTransition.DoesNotExist):
            return Response({
                'allowed': False,
                'error': 'Transition not found or not allowed'
            }, status=status.HTTP_400_BAD_REQUEST)


class WorkflowStateViewSet(viewsets.ModelViewSet):
    """
    API endpoints for workflow states.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = WorkflowStateSerializer
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = WorkflowState.objects.filter(company_id=company_id, status='active')
        
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)


class WorkflowTransitionViewSet(viewsets.ModelViewSet):
    """
    API endpoints for workflow transitions.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = WorkflowTransitionSerializer
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = WorkflowTransition.objects.filter(company_id=company_id, status='active')
        
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)
        
        return queryset.select_related('from_state', 'to_state', 'approver_role')
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
