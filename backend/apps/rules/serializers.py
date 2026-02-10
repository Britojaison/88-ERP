"""
Serializers for Rules API.
"""
from rest_framework import serializers
from .models import Rule, RuleExecution


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rule
        fields = [
            'id', 'code', 'name', 'description', 'rule_type', 'trigger',
            'entity_type', 'condition_expression', 'error_message', 'error_code',
            'priority', 'is_blocking', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RuleExecutionSerializer(serializers.ModelSerializer):
    rule_code = serializers.CharField(source='rule.code', read_only=True)
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    
    class Meta:
        model = RuleExecution
        fields = [
            'id', 'rule', 'rule_code', 'rule_name', 'entity_type', 'entity_id',
            'passed', 'error_message', 'execution_time_ms', 'context', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
