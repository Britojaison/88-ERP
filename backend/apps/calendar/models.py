"""
Fiscal Calendar and Period Management.
Used for financial posting, inventory valuation, reporting.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class FiscalCalendar(TenantAwareModel):
    """
    Fiscal calendar definition.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    start_month = models.IntegerField(
        help_text='Starting month of fiscal year (1-12)'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'cal_fiscal_calendar'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class FiscalPeriod(TenantAwareModel):
    """
    Fiscal period (month, quarter, year).
    Used for period locking and financial reporting.
    """
    
    PERIOD_TYPE_MONTH = 'month'
    PERIOD_TYPE_QUARTER = 'quarter'
    PERIOD_TYPE_YEAR = 'year'
    
    PERIOD_TYPE_CHOICES = [
        (PERIOD_TYPE_MONTH, 'Month'),
        (PERIOD_TYPE_QUARTER, 'Quarter'),
        (PERIOD_TYPE_YEAR, 'Year'),
    ]
    
    calendar = models.ForeignKey(
        FiscalCalendar,
        on_delete=models.CASCADE,
        related_name='periods'
    )
    
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    period_type = models.CharField(max_length=20, choices=PERIOD_TYPE_CHOICES)
    
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    
    # Period status
    is_open = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    
    # Closing information
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'mdm.User',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='closed_periods'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'cal_fiscal_period'
        unique_together = [['company', 'calendar', 'code']]
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['company', 'start_date', 'end_date']),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class WorkingCalendar(TenantAwareModel):
    """
    Working days calendar for operations.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    # Default working days (0=Monday, 6=Sunday)
    working_days = models.JSONField(
        default=list,
        help_text='List of working day numbers: [0,1,2,3,4] for Mon-Fri'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'cal_working_calendar'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Holiday(TenantAwareModel):
    """
    Holiday definition.
    """
    calendar = models.ForeignKey(
        WorkingCalendar,
        on_delete=models.CASCADE,
        related_name='holidays'
    )
    
    name = models.CharField(max_length=255)
    date = models.DateField(db_index=True)
    
    is_recurring = models.BooleanField(
        default=False,
        help_text='If true, repeats annually'
    )
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'cal_holiday'
        unique_together = [['calendar', 'date']]
        ordering = ['date']
    
    def __str__(self):
        return f"{self.name} - {self.date}"
