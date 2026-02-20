from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InventoryBalanceViewSet, 
    InventoryMovementViewSet, 
    GoodsReceiptScanViewSet, 
    DamagedItemViewSet,
    DesignerWorkbenchViewSet,
    ProductionKanbanViewSet
)

router = DefaultRouter()
router.register(r'balances', InventoryBalanceViewSet, basename='inventory-balance')
router.register(r'movements', InventoryMovementViewSet, basename='inventory-movement')
router.register(r'goods-receipt-scans', GoodsReceiptScanViewSet, basename='goods-receipt-scan')
router.register(r'damaged-items', DamagedItemViewSet, basename='damaged-item')
router.register(r'design-approvals', DesignerWorkbenchViewSet, basename='design-approvals')
router.register(r'production-kanban', ProductionKanbanViewSet, basename='production-kanban')

urlpatterns = [
    path('', include(router.urls)),
]
