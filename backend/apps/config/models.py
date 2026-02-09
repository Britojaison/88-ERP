from django.db import models
from apps.core.models import BaseModel, TenantAwareModel, ActiveManager

# Configuration key-value store
# Used for tax rules, discount slabs, pricing rules, feature toggles
