from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet,
    BusinessUnitViewSet,
    LocationViewSet,
    CustomerViewSet,
    VendorViewSet,
    ProductViewSet,
    StyleViewSet,
    SKUViewSet,
    SKUBarcodeViewSet,
)

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'business-units', BusinessUnitViewSet, basename='business-unit')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'styles', StyleViewSet, basename='style')
router.register(r'skus', SKUViewSet, basename='sku')
router.register(r'sku-barcodes', SKUBarcodeViewSet, basename='sku-barcode')

urlpatterns = [
    path('', include(router.urls)),
]
