"""
Numbering/Sequence Engine.
Configurable, scoped, concurrency-safe sequences.
NEVER use max(id)+1.
"""
from django.db import models, transaction
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class NumberingSequence(TenantAwareModel):
    """
    Sequence definition for document numbering.
    """
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    
    # Format: {prefix}{year}{month}{sequence:05d}
    # Example: PO-2024-00001
    format_pattern = models.CharField(
        max_length=255,
        help_text='Format pattern with placeholders: {prefix}, {year}, {month}, {sequence}'
    )
    
    prefix = models.CharField(max_length=20, blank=True)
    
    # Scope
    scope_by_year = models.BooleanField(default=True)
    scope_by_month = models.BooleanField(default=False)
    scope_by_location = models.BooleanField(default=False)
    
    # Sequence settings
    start_number = models.IntegerField(default=1)
    increment_by = models.IntegerField(default=1)
    padding_length = models.IntegerField(default=5)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'num_sequence'
        unique_together = [['company', 'code']]
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class NumberingCounter(BaseModel):
    """
    Current counter value for a sequence.
    Concurrency-safe via select_for_update.
    """
    sequence = models.ForeignKey(
        NumberingSequence,
        on_delete=models.CASCADE,
        related_name='counters'
    )
    
    # Scope keys
    year = models.IntegerField(null=True, blank=True)
    month = models.IntegerField(null=True, blank=True)
    location = models.ForeignKey(
        'mdm.Location',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    current_value = models.IntegerField(default=0)
    
    objects = models.Manager()
    
    class Meta:
        db_table = 'num_counter'
        unique_together = [['sequence', 'year', 'month', 'location']]
        indexes = [
            models.Index(fields=['sequence', 'year', 'month']),
        ]
    
    def __str__(self):
        return f"{self.sequence.code} - {self.current_value}"
    
    @classmethod
    @transaction.atomic
    def get_next_number(cls, sequence, year=None, month=None, location=None):
        """
        Get next number in sequence (concurrency-safe).
        """
        # Get or create counter with lock
        counter, created = cls.objects.select_for_update().get_or_create(
            sequence=sequence,
            year=year if sequence.scope_by_year else None,
            month=month if sequence.scope_by_month else None,
            location=location if sequence.scope_by_location else None,
            defaults={'current_value': sequence.start_number - sequence.increment_by}
        )
        
        # Increment
        counter.current_value += sequence.increment_by
        counter.save(update_fields=['current_value'])
        
        # Format number
        context = {
            'prefix': sequence.prefix,
            'year': str(year) if year else '',
            'month': str(month).zfill(2) if month else '',
            'sequence': str(counter.current_value).zfill(sequence.padding_length),
        }
        
        return sequence.format_pattern.format(**context)
