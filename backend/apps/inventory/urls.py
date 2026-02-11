from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InventoryBalanceViewSet, InventoryMovementViewSet, GoodsReceiptScanViewSet

router = DefaultRouter()
router.register(r'balances', InventoryBalanceViewSet, basename='inventory-balance')
router.register(r'movements', InventoryMovementViewSet, basename='inventory-movement')
router.register(r'goods-receipt-scans', GoodsReceiptScanViewSet, basename='goods-receipt-scan')

urlpatterns = [
    path('', include(router.urls)),
]
