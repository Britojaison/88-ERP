"""
Serializers for Reporting API.
"""
from rest_framework import serializers
from .models import ReportDefinition, ReportExecution, AnalyticsSnapshot


class ReportDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportDefinition
        fields = [
            "id",
            "company",
            "code",
            "name",
            "description",
            "report_type",
            "category",
            "query_template",
            "parameters",
            "columns",
            "required_permission",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ReportExecutionSerializer(serializers.ModelSerializer):
    report_code = serializers.CharField(source="report.code", read_only=True)

    class Meta:
        model = ReportExecution
        fields = [
            "id",
            "report",
            "report_code",
            "parameters",
            "executed_by",
            "execution_time_ms",
            "row_count",
            "output_format",
            "output_file",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AnalyticsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsSnapshot
        fields = [
            "id",
            "company",
            "snapshot_date",
            "metric_name",
            "dimensions",
            "value",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
