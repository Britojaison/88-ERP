from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .shopify_views import (
    ShopifyStoreViewSet,
    ShopifyProductViewSet,
    ShopifySyncJobViewSet,
    ShopifyWebhookView,
    ShopifyOrderViewSet,
    ShopifyDraftOrderViewSet,
    ShopifyDiscountViewSet,
    ShopifyGiftCardViewSet
)
from .shopify_analytics_views import (
    product_performance,
    customer_analysis,
    traffic_source_analysis,
    inventory_summary,
    returns_analysis,
)

router = DefaultRouter()
router.register(r'stores', ShopifyStoreViewSet, basename='shopify-store')
router.register(r'products', ShopifyProductViewSet, basename='shopify-product')
router.register(r'sync-jobs', ShopifySyncJobViewSet, basename='shopify-sync-job')
router.register(r'orders', ShopifyOrderViewSet, basename='shopify-order')
router.register(r'draft-orders', ShopifyDraftOrderViewSet, basename='shopify-draft-order')
router.register(r'discounts', ShopifyDiscountViewSet, basename='shopify-discount')
router.register(r'gift-cards', ShopifyGiftCardViewSet, basename='shopify-gift-card')

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/<uuid:store_id>/', ShopifyWebhookView.as_view(), name='shopify-webhook'),
    # Analytics endpoints for reports
    path('analytics/product-performance/', product_performance, name='shopify-product-performance'),
    path('analytics/customer-analysis/', customer_analysis, name='shopify-customer-analysis'),
    path('analytics/traffic-source/', traffic_source_analysis, name='shopify-traffic-source'),
    path('analytics/inventory-summary/', inventory_summary, name='shopify-inventory-summary'),
    path('analytics/returns-analysis/', returns_analysis, name='shopify-returns-analysis'),
]
