from django.db import models
from apps.core.models import BaseModel, TenantAwareModel

# CSV upload, validation, partial success handling
# Reuses rule engine for validation
