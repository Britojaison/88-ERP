"""
Workflow service layer.
Handles state transitions and validation.
"""
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from apps.core.exceptions import WorkflowError
from .models import Workflow, WorkflowState, WorkflowTransition, DocumentWorkflow, WorkflowHistory


class WorkflowService:
    """Service for managing workflow state transitions."""
    
    @staticmethod
    @transaction.atomic
    def initialize_workflow(document, workflow_code, company, user=None):
        """
        Initialize workflow for a document.
        
        Args:
            document: Document instance
            workflow_code: Workflow code
            company: Company instance
            user: User performing action
        
        Returns:
            DocumentWorkflow instance
        """
        workflow = Workflow.active.get(company=company, code=workflow_code)
        
        if not workflow.initial_state:
            raise WorkflowError(
                current_state=None,
                target_state=None,
                reason=f"Workflow {workflow_code} has no initial state defined"
            )
        
        content_type = ContentType.objects.get_for_model(document)
        
        doc_workflow = DocumentWorkflow.objects.create(
            content_type=content_type,
            object_id=document.id,
            workflow=workflow,
            current_state=workflow.initial_state,
            created_by=user,
            updated_by=user
        )
        
        # Record initial state in history
        WorkflowHistory.objects.create(
            document_workflow=doc_workflow,
            from_state=None,
            to_state=workflow.initial_state,
            created_by=user,
            updated_by=user
        )
        
        return doc_workflow
    
    @staticmethod
    @transaction.atomic
    def transition(document, target_state_code, user, comments='', context=None):
        """
        Transition document to new state.
        
        Args:
            document: Document instance
            target_state_code: Target state code
            user: User performing transition
            comments: Optional comments
            context: Context dict for condition evaluation
        
        Raises:
            WorkflowError: If transition is not allowed
        """
        content_type = ContentType.objects.get_for_model(document)
        
        doc_workflow = DocumentWorkflow.active.get(
            content_type=content_type,
            object_id=document.id
        )
        
        current_state = doc_workflow.current_state
        
        # Get target state
        try:
            target_state = WorkflowState.active.get(
                workflow=doc_workflow.workflow,
                code=target_state_code
            )
        except WorkflowState.DoesNotExist:
            raise WorkflowError(
                current_state=current_state.code,
                target_state=target_state_code,
                reason=f"State '{target_state_code}' not found in workflow"
            )
        
        # Find transition
        try:
            transition_obj = WorkflowTransition.active.get(
                workflow=doc_workflow.workflow,
                from_state=current_state,
                to_state=target_state
            )
        except WorkflowTransition.DoesNotExist:
            raise WorkflowError(
                current_state=current_state.code,
                target_state=target_state_code,
                reason="No transition defined between these states"
            )
        
        # Evaluate conditions
        if transition_obj.condition_expression:
            if not WorkflowService._evaluate_condition(
                transition_obj.condition_expression,
                context or {}
            ):
                raise WorkflowError(
                    current_state=current_state.code,
                    target_state=target_state_code,
                    reason="Transition conditions not met"
                )
        
        # Check approval requirements
        if transition_obj.requires_approval and transition_obj.approver_role:
            from apps.rbac.models import UserRole
            has_role = UserRole.active.filter(
                user=user,
                role=transition_obj.approver_role
            ).exists()
            
            if not has_role:
                raise WorkflowError(
                    current_state=current_state.code,
                    target_state=target_state_code,
                    reason=f"User does not have required role: {transition_obj.approver_role.code}"
                )
        
        # Perform transition
        doc_workflow.current_state = target_state
        doc_workflow.updated_by = user
        doc_workflow.save()
        
        # Record in history
        WorkflowHistory.objects.create(
            document_workflow=doc_workflow,
            from_state=current_state,
            to_state=target_state,
            transition=transition_obj,
            comments=comments,
            approved_by=user if transition_obj.requires_approval else None,
            created_by=user,
            updated_by=user
        )
        
        # Execute transition actions
        WorkflowService._execute_actions(transition_obj.actions, document, user)
        
        return doc_workflow
    
    @staticmethod
    def get_available_transitions(document, user):
        """
        Get available transitions from current state.
        
        Returns:
            List of WorkflowTransition objects
        """
        content_type = ContentType.objects.get_for_model(document)
        
        try:
            doc_workflow = DocumentWorkflow.active.get(
                content_type=content_type,
                object_id=document.id
            )
        except DocumentWorkflow.DoesNotExist:
            return []
        
        transitions = WorkflowTransition.active.filter(
            workflow=doc_workflow.workflow,
            from_state=doc_workflow.current_state
        )
        
        # Filter by user permissions
        available = []
        for trans in transitions:
            if trans.requires_approval and trans.approver_role:
                from apps.rbac.models import UserRole
                has_role = UserRole.active.filter(
                    user=user,
                    role=trans.approver_role
                ).exists()
                if not has_role:
                    continue
            
            available.append(trans)
        
        return available
    
    @staticmethod
    def get_workflow_history(document):
        """Get workflow history for a document."""
        content_type = ContentType.objects.get_for_model(document)
        
        try:
            doc_workflow = DocumentWorkflow.active.get(
                content_type=content_type,
                object_id=document.id
            )
        except DocumentWorkflow.DoesNotExist:
            return []
        
        return WorkflowHistory.objects.filter(
            document_workflow=doc_workflow
        ).select_related('from_state', 'to_state', 'created_by')
    
    @staticmethod
    def _evaluate_condition(condition_expression, context):
        """
        Evaluate condition expression.
        Uses JSONLogic or similar.
        """
        if not condition_expression:
            return True
        
        # Simple evaluation - in production use JSONLogic library
        # Example: {"field": "amount", "operator": "lt", "value": 10000}
        if 'field' in condition_expression:
            field = condition_expression['field']
            operator = condition_expression.get('operator', 'eq')
            expected = condition_expression.get('value')
            actual = context.get(field)
            
            if operator == 'eq':
                return actual == expected
            elif operator == 'lt':
                return actual < expected
            elif operator == 'lte':
                return actual <= expected
            elif operator == 'gt':
                return actual > expected
            elif operator == 'gte':
                return actual >= expected
        
        return True
    
    @staticmethod
    def _execute_actions(actions, document, user):
        """Execute transition actions."""
        if not actions:
            return
        
        # Actions are defined as list of dicts
        # Example: [{"type": "send_email", "template": "approval_request"}]
        for action in actions:
            action_type = action.get('type')
            
            if action_type == 'send_email':
                # Trigger email sending
                pass
            elif action_type == 'update_inventory':
                # Trigger inventory update
                pass
            # Add more action types as needed
