"""
API Views for Master Data Management.
"""
import re
from django.db import IntegrityError
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Company, BusinessUnit, Location, Customer, Vendor, Product, Style, SKU, SKUBarcode, Fabric, User
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
    FabricSerializer,
    UserSerializer,
)
from rest_framework.pagination import PageNumberPagination
from .barcode_service import BarcodeService


class IsAdminUser(IsAuthenticated):
    """Only allow access to users whose role is 'admin' or who are superusers."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.is_superuser or (request.user.role or '').lower() == 'admin'


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only user management — list, create, edit users and set passwords."""
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

    def get_queryset(self):
        return User.objects.all().order_by('email')

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password', '')
        if not password or len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save()
        return Response({'detail': f'Password updated for {user.email}.'})



def _get_next_mmw_number(company_id):
    """Get the next available MMW sequence number for a specific company."""
    existing = SKU.objects.filter(
        company_id=company_id,
        code__startswith='MMW-'
    ).values_list('code', flat=True)
    max_num = 0
    for code in existing:
        match = re.match(r'MMW-(\d+)-', code)
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num
    return max_num + 1


def _extract_product_type(product_name):
    """Extract short product type from product name (last meaningful word)."""
    if not product_name:
        return 'SKU'
    # Clean the name and get words
    words = re.sub(r'[^A-Za-z0-9\s]', ' ', product_name).strip().split()
    if not words:
        return 'SKU'
    # Use the last word as the product type
    return words[-1].upper()


def generate_mmw_sku_code(company_id, product_name, size=None):
    """Generate a SKU code in the MMW-{seq}-{SIZE}-{TYPE} format."""
    next_num = _get_next_mmw_number(company_id)
    product_type = _extract_product_type(product_name)
    size_part = str(size).upper().strip() if size else ''
    
    if size_part:
        return f"MMW-{next_num}-{size_part}-{product_type}"
    else:
        return f"MMW-{next_num}-{product_type}"


class MDMPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 1000


class CompanyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompanySerializer
    pagination_class = None

    def get_queryset(self):
        return Company.objects.filter(status="active").order_by("code")


class TenantScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = MDMPagination

    def perform_create(self, serializer):
        import traceback
        print(f"[{self.__class__.__name__}] Performing CREATE. Data: {self.request.data}")
        try:
            # The HiddenField in TenantModelSerializer now handles the company automatically.
            # This enables DRF's UniqueTogetherValidator to work correctly.
            instance = serializer.save()
            print(f"[{self.__class__.__name__}] Create successful. ID: {instance.id}")
        except IntegrityError as e:
            error_msg = str(e).lower()
            print(f"[{self.__class__.__name__}] Create FAILED (IntegrityError): {error_msg}")
            # Parse common DB constraint errors into user-friendly messages
            if 'unique' in error_msg or 'duplicate' in error_msg:
                raise serializers.ValidationError(
                    {'detail': 'A record with this code already exists. Please use a different code.'}
                )
            elif 'null' in error_msg and 'not-null' in error_msg or 'null value' in error_msg:
                # Catch fields like offer_tag or lifecycle_status that were problematic
                missing_field = 'unknown'
                import re
                match = re.search(r'"([^"]+)"', error_msg)
                if match:
                    missing_field = match.group(1)
                raise serializers.ValidationError(
                    {'detail': f'Missing or invalid value for field: {missing_field}'}
                )
            else:
                raise serializers.ValidationError(
                    {'detail': f'Database integrity error: {error_msg}'}
                )
        except Exception as e:
            tb = traceback.format_exc()
            print(f"[{self.__class__.__name__}] UNEXPECTED EXCEPTION: {str(e)}\n{tb}")
            # Return a 400 with the error detail instead of a 500
            raise serializers.ValidationError(
                {'detail': f'Internal Server Error: {str(e)}'}
            )

    def perform_update(self, serializer):
        import traceback
        try:
            serializer.save()
        except IntegrityError as e:
            error_msg = str(e).lower()
            if 'unique' in error_msg or 'duplicate' in error_msg:
                raise serializers.ValidationError(
                    {'detail': 'A record with this code already exists.'}
                )
            raise serializers.ValidationError({'detail': f'Database error: {error_msg}'})
        except Exception as e:
            print(f"[{self.__class__.__name__}] Update FAILED: {str(e)}\n{traceback.format_exc()}")
            raise serializers.ValidationError({'detail': f'Internal Server Error: {str(e)}'})



class BusinessUnitViewSet(TenantScopedViewSet):
    serializer_class = BusinessUnitSerializer

    def get_queryset(self):
        return BusinessUnit.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("-created_at")


class LocationViewSet(TenantScopedViewSet):
    serializer_class = LocationSerializer

    def get_queryset(self):
        queryset = Location.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("business_unit")

        location_type = self.request.query_params.get("location_type")
        if location_type:
            queryset = queryset.filter(location_type=location_type)

        return queryset.order_by("-created_at")


class CustomerViewSet(TenantScopedViewSet):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return Customer.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("-created_at")


class VendorViewSet(TenantScopedViewSet):
    serializer_class = VendorSerializer

    def get_queryset(self):
        return Vendor.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("-created_at")


class ProductViewSet(TenantScopedViewSet):
    serializer_class = ProductSerializer
    from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Product.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        print(f"[ProductViewSet] CREATE request data: {request.data}")
        print(f"[ProductViewSet] FILES: {request.FILES}")
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print(f"[ProductViewSet] Validation errors: {serializer.errors}")
        return super().create(request, *args, **kwargs)
    
    @action(detail=False, methods=["get"], url_path="next-sku-code")
    def next_sku_code(self, request):
        """
        Get the next auto-generated SKU code in MMW format.
        Query params: product_name, size (optional)
        """
        product_name = request.query_params.get('product_name', '')
        size = request.query_params.get('size', '')
        
        code = generate_mmw_sku_code(request.user.company_id, product_name, size if size else None)
        return Response({'sku_code': code})
    
    @action(detail=True, methods=["post"], url_path="create-variants")
    def create_variants(self, request, pk=None):
        """
        Bulk create SKU variants for a product with different sizes.
        """
        product = self.get_object()
        
        # Handle optional image update during variant creation
        image = request.FILES.get('image')
        if image:
            product.image = image
            product.save(update_fields=['image'])
            
        sizes = request.data.get('sizes', [])
        # If sizes comes as a string (FormData often does this depending on how it's appended)
        if isinstance(sizes, str):
            import json
            try:
                sizes = json.loads(sizes)
            except json.JSONDecodeError:
                sizes = [s.strip() for s in sizes.split(',')]
                
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
            # Generate SKU code in MMW format
            sku_code = generate_mmw_sku_code(request.user.company_id, product.name, size)
            
            # Check if SKU already exists
            if SKU.objects.filter(code=sku_code).exists():
                skipped_sizes.append(size)
                continue
            
            # Create SKU
            try:
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
            except IntegrityError:
                # SKU code already exists or other constraint violation
                skipped_sizes.append(size)
                continue
        
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
        ).select_related("product").order_by("-created_at")


class SKUViewSet(TenantScopedViewSet):
    serializer_class = SKUSerializer

    def get_queryset(self):
        queryset = SKU.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("product", "style")

        product_id = self.request.query_params.get("product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)
            
        exclude_fabrics = self.request.query_params.get("exclude_fabrics")
        if exclude_fabrics and exclude_fabrics.lower() == 'true':
            queryset = queryset.exclude(product__code='RAW-FABRICS')

        # Search by SKU code, SKU name, or product name
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(code__icontains=search) |
                Q(name__icontains=search) |
                Q(product__name__icontains=search)
            )

        return queryset.order_by("-created_at")

    @action(detail=False, methods=['get'], url_path='search-with-stock')
    def search_with_stock(self, request):
        """
        Search SKUs and return them with current warehouse inventory.
        Query params: search (string), page (int), page_size (int, default 50)
        """
        from django.db.models import Q, Sum
        from apps.inventory.models import InventoryBalance

        search = request.query_params.get('search', '')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))

        queryset = SKU.objects.filter(
            company_id=request.user.company_id, status="active"
        ).exclude(product__code='RAW-FABRICS').select_related("product")

        if search:
            queryset = queryset.filter(
                Q(code__icontains=search) |
                Q(name__icontains=search) |
                Q(product__name__icontains=search)
            )

        total = queryset.count()
        skus_page = queryset.order_by('product__name', 'name')[(page - 1) * page_size:page * page_size]
        sku_ids = [s.id for s in skus_page]

        # Bulk fetch inventory for these SKUs
        stock_qs = InventoryBalance.objects.filter(
            sku_id__in=sku_ids,
            company_id=request.user.company_id,
            status='active',
        ).values('sku_id').annotate(total_stock=Sum('quantity_on_hand'))
        stock_map = {str(s['sku_id']): float(s['total_stock'] or 0) for s in stock_qs}

        results = []
        for s in skus_page:
            results.append({
                'id': str(s.id),
                'code': s.code,
                'name': s.name,
                'product_name': s.product.name if s.product else '',
                'size': s.size or '',
                'base_price': str(s.base_price),
                'warehouse_stock': stock_map.get(str(s.id), 0),
            })

        from rest_framework.response import Response
        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'results': results,
        })


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


def _get_next_fabric_number(company_id):
    """Get the next sequential number for fabric codes within a company."""
    last = Fabric.objects.filter(company_id=company_id).order_by('-created_at').first()
    if last and last.code:
        match = re.search(r'FAB-(\d+)', last.code)
        if match:
            return int(match.group(1)) + 1
    return 1


class FabricViewSet(TenantScopedViewSet):
    serializer_class = FabricSerializer
    # Support multipart form data for photo upload
    from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        qs = Fabric.objects.filter(
            company_id=self.request.user.company_id
        ).select_related('vendor', 'approved_by', 'sku')
        
        # Filter by approval status
        approval = self.request.query_params.get('approval_status')
        if approval:
            qs = qs.filter(approval_status=approval)
            
        # Filter by dispatch unit
        unit = self.request.query_params.get('dispatch_unit')
        if unit:
            qs = qs.filter(dispatch_unit=unit)
            
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        """Auto-generate fabric code and SKU on creation."""
        company_id = self.request.user.company_id
        if not company_id:
            raise Exception('No company assigned to user')

        # Auto-generate fabric code
        seq = _get_next_fabric_number(company_id)
        fabric_name = serializer.validated_data.get('name', 'FABRIC')
        fabric_type = serializer.validated_data.get('fabric_type', '')
        type_abbr = fabric_type[:3].upper() if fabric_type else 'FAB'
        code = f"FAB-{seq:04d}-{type_abbr}"

        # Ensure a 'Raw Fabrics' Product exists to attach the SKU to
        product, _ = Product.objects.get_or_create(
            company_id=company_id,
            code="RAW-FABRICS",
            defaults={
                "name": "Raw Fabrics",
                "description": "Auto-generated product for all fabric SKUs"
            }
        )

        # Create an SKU for this fabric
        sku = SKU.objects.create(
            company_id=company_id,
            product=product,
            code=code,
            name=f"Fabric: {fabric_name}",
            base_price=serializer.validated_data.get('cost_per_meter', 0),
            cost_price=serializer.validated_data.get('cost_per_meter', 0),
        )

        serializer.save(
            company_id=company_id,
            code=code,
            sku=sku,
            created_by=self.request.user if self.request.user.is_authenticated else None,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Designer approves this fabric."""
        from django.utils import timezone
        fabric = self.get_object()
        fabric.approval_status = Fabric.APPROVAL_APPROVED
        fabric.approved_by = request.user
        fabric.approval_date = timezone.now()
        fabric.rejection_reason = ''
        fabric.save()
        return Response(FabricSerializer(fabric, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Designer rejects this fabric."""
        from django.utils import timezone
        fabric = self.get_object()
        fabric.approval_status = Fabric.APPROVAL_REJECTED
        fabric.approved_by = request.user
        fabric.approval_date = timezone.now()
        fabric.rejection_reason = request.data.get('reason', '')
        fabric.save()
        return Response(FabricSerializer(fabric, context={'request': request}).data)
