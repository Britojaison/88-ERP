from django.db import models
from apps.core.models import BaseModel, TenantAwareModel

# External system integrations
# API connectors, webhooks, data sync

# Import Shopify models so Django discovers them for migrations
from .shopify_models import (
    ShopifyStore,
    ShopifyProduct,
    ShopifyInventoryLevel,
    ShopifyWebhook,
    ShopifyWebhookLog,
    ShopifySyncJob,
)
