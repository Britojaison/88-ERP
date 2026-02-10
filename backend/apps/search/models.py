"""
Search Abstraction Layer for Elasticsearch.
SKU search, attribute filtering, saved searches.
"""
from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager


class SavedSearch(TenantAwareModel):
    """
    User-saved search queries.
    """
    name = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=100, db_index=True)
    
    # Search criteria
    search_criteria = models.JSONField(
        help_text='Search filters and parameters'
    )
    
    # User
    user = models.ForeignKey(
        'mdm.User',
        on_delete=models.CASCADE,
        related_name='saved_searches'
    )
    
    is_shared = models.BooleanField(default=False)
    
    objects = models.Manager()
    active = ActiveManager()
    
    class Meta:
        db_table = 'search_saved'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.entity_type})"


class SearchIndex(models.Model):
    """
    Search index metadata.
    Tracks Elasticsearch index status.
    """
    entity_type = models.CharField(max_length=100, unique=True, db_index=True)
    index_name = models.CharField(max_length=255)
    
    last_indexed_at = models.DateTimeField(null=True, blank=True)
    document_count = models.IntegerField(default=0)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'search_index'
    
    def __str__(self):
        return f"{self.entity_type} -> {self.index_name}"
