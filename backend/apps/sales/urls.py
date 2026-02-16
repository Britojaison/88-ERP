"""
URL Configuration for Sales API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SalesTransactionViewSet,
    ReturnTransactionViewSet,
    StoreFootTrafficViewSet,
    StaffShiftViewSet,
)

router = DefaultRouter()
router.register(r'transactions', SalesTransactionViewSet, basename='sales-transaction')
router.register(r'returns', ReturnTransactionViewSet, basename='return-transaction')
router.register(r'foot-traffic', StoreFootTrafficViewSet, basename='foot-traffic')
router.register(r'staff-shifts', StaffShiftViewSet, basename='staff-shift')

urlpatterns = [
    path('', include(router.urls)),
]
