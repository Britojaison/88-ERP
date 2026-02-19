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
    
    @action(detail=True, methods=["post"], url_path="create-variants")
    def create_variants(self, request, pk=None):
        """
        Bulk create SKU variants for a product with different sizes.
        """
        product = self.get_object()
        sizes = request.data.get('sizes', [])
        selling_price = request.data.get('selling_price')
        mrp = request.data.get('mrp')
        
        if not sizes:
            return Response(
                {'error': 'At least one size must be selected.'},
                status=400
            )
        
        if not selling_price or not mrp:
            return Response(
                {'error': 'Selling price and MRP are required.'},
                status=400
            )
        
        try:
            selling_price = float(selling_price)
            mrp = float(mrp)
            
            if selling_price <= 0 or mrp <= 0:
                return Response(
                    {'error': 'Prices must be positive numbers.'},
                    status=400
                )
            
            if selling_price > mrp:
                return Response(
                    {'error': 'Selling price cannot be greater than MRP.'},
                    status=400
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid price format.'},
                status=400
            )
        
        created_skus = []
        skipped_sizes = []
        
        for size in sizes:
            # Generate SKU code: product-code-size
            size_suffix = str(size).lower().replace(" ", "").replace("-", "")
            sku_code = f"{product.code}-{size_suffix}"
            
            # Check if SKU already exists
            if SKU.objects.filter(code=sku_code).exists():
                skipped_sizes.append(size)
                continue
            
            # Create SKU
            sku = SKU.objects.create(
                code=sku_code,
                name=f"{product.name} - {size}",
                product=product,
                size=size,
                base_price=selling_price,
                cost_price=mrp,
                company_id=request.user.company_id,
                status='active'
            )
            created_skus.append(sku)
        
        # Serialize created SKUs
        serializer = SKUSerializer(created_skus, many=True)
        
        return Response({
            'created': len(created_skus),
            'skipped': len(skipped_sizes),
            'skipped_sizes': skipped_sizes,
            'skus': serializer.data
        })


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
        ).select_related("sku", "sku__product")
        sku_id = self.request.query_params.get("sku")
        if sku_id:
            queryset = queryset.filter(sku_id=sku_id)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        # Auto-generate barcode_value if not provided
        if not serializer.validated_data.get('barcode_value'):
            sku = serializer.validated_data.get('sku')
            if sku:
                barcode_value = BarcodeService.build_default_value(sku.code)
                serializer.validated_data['barcode_value'] = barcode_value
        
        serializer.save(company_id=self.request.user.company_id)

    @action(detail=True, methods=["get"], url_path="label")
    def label(self, request, pk=None):
        barcode = self.get_object()
        label_svg = BarcodeService.build_label_svg(
            display_code=barcode.display_code or barcode.sku.code,
            title=barcode.label_title or barcode.sku.name,
            size_label=barcode.size_label or "",
            barcode_value=barcode.barcode_value,
            barcode_type=barcode.barcode_type,
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

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        barcode = self.get_object()
        fmt = request.query_params.get("format", "png").lower()
        
        display_code = barcode.display_code or barcode.sku.code
        title = barcode.label_title or barcode.sku.name
        size_label = barcode.size_label or ""
        selling_price = str(barcode.selling_price or barcode.sku.base_price)
        mrp = str(barcode.mrp or barcode.sku.base_price)

        if fmt == "pdf":
            content = BarcodeService.build_label_pdf(
                display_code, title, size_label, 
                barcode.barcode_value, barcode.barcode_type,
                selling_price, mrp
            )
            filename = f"label_{barcode.barcode_value}.pdf"
            content_type = "application/pdf"
        else:
            content = BarcodeService.build_label_png(
                display_code, title, size_label, 
                barcode.barcode_value, barcode.barcode_type,
                selling_price, mrp
            )
            filename = f"label_{barcode.barcode_value}.png"
            content_type = "image/png"

        from django.http import HttpResponse
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
