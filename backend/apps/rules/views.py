"""
API Views for Rules Management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
import time
from .models import Rule, RuleExecution
from .serializers import RuleSerializer, RuleExecutionSerializer


class RuleViewSet(viewsets.ModelViewSet):
    """
    API endpoints for business rules.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = RuleSerializer
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = Rule.objects.filter(company_id=company_id, status='active')
        
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        rule_type = self.request.query_params.get('rule_type')
        if rule_type:
            queryset = queryset.filter(rule_type=rule_type)
        
        trigger = self.request.query_params.get('trigger')
        if trigger:
            queryset = queryset.filter(trigger=trigger)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test a rule with sample data."""
        rule = self.get_object()
        context = request.data.get('context', {})
        
        start_time = time.time()
        
        try:
            # TODO: Implement JSONLogic evaluation
            # For now, return mock result
            passed = True
            error_message = ''
            
            # Simple mock evaluation
            if 'amount' in context and context['amount'] < 0:
                passed = False
                error_message = rule.error_message
            
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # Log execution
            RuleExecution.objects.create(
                rule=rule,
                entity_type=rule.entity_type,
                entity_id=context.get('entity_id', '00000000-0000-0000-0000-000000000000'),
                passed=passed,
                error_message=error_message,
                execution_time_ms=execution_time_ms,
                context=context
            )
            
            return Response({
                'passed': passed,
                'error_message': error_message,
                'execution_time_ms': execution_time_ms,
                'rule': {
                    'code': rule.code,
                    'name': rule.name,
                    'is_blocking': rule.is_blocking
                }
            })
        
        except Exception as e:
            return Response({
                'passed': False,
                'error_message': str(e),
                'execution_time_ms': int((time.time() - start_time) * 1000)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def validate_expression(self, request, pk=None):
        """Validate a JSONLogic expression."""
        expression = request.data.get('expression', {})
        
        try:
            # TODO: Implement JSONLogic validation
            # For now, just check if it's valid JSON
            if not isinstance(expression, dict):
                return Response({
                    'valid': False,
                    'error': 'Expression must be a JSON object'
                })
            
            return Response({
                'valid': True,
                'message': 'Expression is valid'
            })
        
        except Exception as e:
            return Response({
                'valid': False,
                'error': str(e)
            })
    
    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Get rule templates."""
        templates = [
            {
                'name': 'Required Field',
                'description': 'Field must not be empty',
                'expression': {'missing': ['field_name']},
                'error_message': 'Field is required'
            },
            {
                'name': 'Value Range',
                'description': 'Value must be within range',
                'expression': {
                    'and': [
                        {'>': [{'var': 'field'}, 'min']},
                        {'<': [{'var': 'field'}, 'max']}
                    ]
                },
                'error_message': 'Value must be between min and max'
            },
            {
                'name': 'Conditional Required',
                'description': 'Field required if condition met',
                'expression': {
                    'if': [
                        {'==': [{'var': 'category'}, 'value']},
                        {'missing': ['field']},
                        False
                    ]
                },
                'error_message': 'Field is required when condition is met'
            },
            {
                'name': 'Comparison',
                'description': 'Compare two fields',
                'expression': {
                    '>=': [{'var': 'field1'}, {'var': 'field2'}]
                },
                'error_message': 'Field1 must be greater than or equal to Field2'
            }
        ]
        
        return Response(templates)


class RuleExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for rule execution history.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = RuleExecutionSerializer
    
    def get_queryset(self):
        queryset = RuleExecution.objects.all()
        
        rule_id = self.request.query_params.get('rule')
        if rule_id:
            queryset = queryset.filter(rule_id=rule_id)
        
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        
        return queryset.select_related('rule')[:100]  # Limit to last 100
