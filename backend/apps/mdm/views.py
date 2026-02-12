"""
API Views for Master Data Management.
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Company, BusinessUnit, Location, Customer, Vendor, Product, Style, SKU, SKUBarcode
from .serializers import (
    CompanySerializer,
    BusinessUnitSerializer,
    LocationSerializer,
    CustomerSerializer,
    VendorSerializer,
    ProductSerializer,
    StyleSerializer,
    SKUSerializer,
    SKUBarcodeSerializer,
)
from .barcode_service import BarcodeService


class CompanyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompanySerializer
    pagination_class = None

    def get_queryset(self):
        return Company.objects.filter(status="active").order_by("code")


class TenantScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)


class BusinessUnitViewSet(TenantScopedViewSet):
    serializer_class = BusinessUnitSerializer

    def get_queryset(self):
        return BusinessUnit.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("code")


class LocationViewSet(TenantScopedViewSet):
    serializer_class = LocationSerializer

    def get_queryset(self):
        queryset = Location.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("business_unit")

        location_type = self.request.query_params.get("location_type")
        if location_type:
            queryset = queryset.filter(location_type=location_type)

        return queryset.order_by("code")


class CustomerViewSet(TenantScopedViewSet):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return Customer.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("code")


class VendorViewSet(TenantScopedViewSet):
    serializer_class = VendorSerializer

    def get_queryset(self):
        return Vendor.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("code")


class ProductViewSet(TenantScopedViewSet):
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("code")


class StyleViewSet(TenantScopedViewSet):
    serializer_class = StyleSerializer

    def get_queryset(self):
        return Style.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("product").order_by("code")


class SKUViewSet(TenantScopedViewSet):
    serializer_class = SKUSerializer

    def get_queryset(self):
        queryset = SKU.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("product", "style")

        product_id = self.request.query_params.get("product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)

        return queryset.order_by("code")


class SKUBarcodeViewSet(TenantScopedViewSet):
    serializer_class = SKUBarcodeSerializer

    def get_queryset(self):
        queryset = SKUBarcode.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("sku")
        sku_id = self.request.query_params.get("sku")
        if sku_id:
            queryset = queryset.filter(sku_id=sku_id)
        return queryset.order_by("-created_at")

    @action(detail=True, methods=["get"], url_path="label")
    def label(self, request, pk=None):
        barcode = self.get_object()
        # Always regenerate barcode SVG for fresh rendering
        barcode_svg = BarcodeService.generate_barcode_svg(
            barcode.barcode_value, barcode.barcode_type
        )
        label_svg = BarcodeService.build_label_svg(
            display_code=barcode.display_code or barcode.sku.code,
            title=barcode.label_title or barcode.sku.name,
            size_label=barcode.size_label or "",
            barcode_value=barcode.barcode_value,
            barcode_svg=barcode_svg,
            selling_price=str(barcode.selling_price or barcode.sku.base_price),
            mrp=str(barcode.mrp or barcode.sku.base_price),
        )
        return Response(
            {
                "barcode_id": str(barcode.id),
                "barcode_value": barcode.barcode_value,
                "barcode_type": barcode.barcode_type,
                "label_svg": label_svg,
            }
        )
