from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .shopify_views import (
    ShopifyStoreViewSet,
    ShopifyProductViewSet,
    ShopifySyncJobViewSet,
    ShopifyWebhookView
)

router = DefaultRouter()
router.register(r'stores', ShopifyStoreViewSet, basename='shopify-store')
router.register(r'products', ShopifyProductViewSet, basename='shopify-product')
router.register(r'sync-jobs', ShopifySyncJobViewSet, basename='shopify-sync-job')

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/<uuid:store_id>/', ShopifyWebhookView.as_view(), name='shopify-webhook'),
]
