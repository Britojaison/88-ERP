"""
Reporting and Analytics Models.
OLTP vs OLAP separation - nightly ETL jobs.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class ReportDefinition(TenantAwareModel):
    """
    Report definition/template.
    """
    
    REPORT_TYPE_TABULAR = 'tabular'
    REPORT_TYPE_SUMMARY = 'summary'
    REPORT_TYPE_CHART = 'chart'
    REPORT_TYPE_DASHBOARD = 'dashboard'
    
    REPORT_TYPE_CHOICES = [
        (REPORT_TYPE_TABULAR, 'Tabular'),
        (REPORT_TYPE_SUMMARY, 'Summary'),
        (REPORT_TYPE_CHART, 'Chart'),
        (REPORT_TYPE_DASHBOARD, 'Dashboard'),
    ]
    
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    category = models.CharField(max_length=100, db_index=True)
    
    # Query definition
    query_template = models.TextField(
        help_text='SQL query template with parameters'
    )
    
    # Parameters
    parameters = models.JSONField(
        default=list,
        help_text='List of parameter definitions'
    )
    
    # Display configuration
    columns = models.JSONField(
        default=list,
        help_text='Column definitions for display'
    )
    
    # Access control
    required_permission = models.CharField(max_length=100, blank=True)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'report_definition'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class ReportExecution(BaseModel):
    """
    Report execution history.
    """
    report = models.ForeignKey(
        ReportDefinition,
        on_delete=models.PROTECT,
        related_name='executions'
    )
    
    parameters = models.JSONField(
        default=dict,
        help_text='Parameters used for this execution'
    )
    
    executed_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        related_name='report_executions'
    )
    
    execution_time_ms = models.IntegerField()
    row_count = models.IntegerField(default=0)
    
    # Output
    output_format = models.CharField(max_length=20, default='json')
    output_file = models.FileField(upload_to='reports/', null=True, blank=True)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'report_execution'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.report.code} at {self.created_at}"


class AnalyticsSnapshot(TenantAwareModel):
    """
    Pre-aggregated analytics data.
    Updated via nightly ETL jobs.
    """
    snapshot_date = models.DateField(db_index=True)
    metric_name = models.CharField(max_length=255, db_index=True)
    
    # Dimensions
    dimensions = models.JSONField(
        default=dict,
        help_text='Dimension values (location, product, etc.)'
    )
    
    # Metrics
    value = models.DecimalField(max_digits=20, decimal_places=4)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'analytics_snapshot'
        unique_together = [['company', 'snapshot_date', 'metric_name', 'dimensions']]
        indexes = [
            models.Index(fields=['company', 'metric_name', '-snapshot_date']),
        ]
    
    def __str__(self):
        return f"{self.metric_name} on {self.snapshot_date}"
