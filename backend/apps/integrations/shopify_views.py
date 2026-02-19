"""
Shopify Integration API Views.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
from .shopify_models import (
    ShopifyStore, ShopifyProduct, ShopifyInventoryLevel,
    ShopifyWebhook, ShopifyWebhookLog, ShopifySyncJob,
    ShopifyOrder, ShopifyDraftOrder, ShopifyDiscount, ShopifyGiftCard,
    ShopifyFulfillment
)
from .shopify_service import ShopifyService, ShopifyAPIClient
from rest_framework import serializers
import json
import logging
import threading
from collections import defaultdict

logger = logging.getLogger(__name__)


class ShopifyProductPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class ShopifyOrderPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


# Serializers
class ShopifyStoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopifyStore
        fields = [
            'id', 'name', 'shop_domain', 'api_version',
            'auto_sync_products', 'auto_sync_inventory', 'auto_sync_orders',
            'sync_interval_minutes', 'last_product_sync', 'last_inventory_sync',
            'last_order_sync', 'is_connected', 'last_connection_test',
            'connection_error', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'is_connected', 'last_connection_test', 'connection_error',
            'last_product_sync', 'last_inventory_sync', 'last_order_sync',
            'created_at', 'updated_at'
        ]


class ShopifyStoreCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopifyStore
        fields = [
            'name', 'shop_domain', 'access_token', 'api_key', 'api_secret',
            'api_version', 'webhook_secret', 'auto_sync_products',
            'auto_sync_inventory', 'auto_sync_orders', 'sync_interval_minutes'
        ]
        extra_kwargs = {
            'shop_domain': {
                'validators': [],  # Remove unique validator; perform_create handles duplicates
            }
        }

    def validate_shop_domain(self, value):
        """Allow duplicate shop_domain — perform_create updates existing stores."""
        return value


class ShopifyProductSerializer(serializers.ModelSerializer):
    erp_product_code = serializers.CharField(source='erp_product.code', read_only=True, allow_null=True)
    erp_sku_code = serializers.CharField(source='erp_sku.code', read_only=True, allow_null=True)
    
    class Meta:
        model = ShopifyProduct
        fields = [
            'id', 'shopify_product_id', 'shopify_variant_id', 'shopify_title',
            'shopify_sku', 'shopify_barcode', 'shopify_price',
            'shopify_inventory_quantity', 'shopify_product_type', 'shopify_vendor',
            'shopify_tags', 'shopify_image_url', 'erp_product', 'erp_product_code',
            'erp_sku', 'erp_sku_code', 'sync_status', 'last_synced_at',
            'sync_error', 'created_at'
        ]


class ShopifySyncJobSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    duration_seconds = serializers.SerializerMethodField()
    status = serializers.CharField(source='job_status', read_only=True)
    
    class Meta:
        model = ShopifySyncJob
        fields = [
            'id', 'store', 'store_name', 'job_type', 'status',
            'started_at', 'completed_at', 'duration_seconds',
            'total_items', 'processed_items', 'created_items',
            'updated_items', 'failed_items', 'error_log'
        ]
    
    def get_duration_seconds(self, obj):
        if obj.completed_at and obj.started_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return None


class ShopifyWebhookLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopifyWebhookLog
        fields = [
            'id', 'topic', 'shopify_id', 'processed', 'processed_at',
            'error', 'created_at'
        ]


class ShopifyOrderSerializer(serializers.ModelSerializer):
    erp_document_number = serializers.SerializerMethodField()
    line_items = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    shipping_address = serializers.SerializerMethodField()
    
    class Meta:
        model = ShopifyOrder
        fields = [
            'id', 'shopify_order_id', 'order_number', 'store',
            'erp_document_number', 'order_status', 'financial_status',
            'fulfillment_status', 'total_price', 'currency',
            'customer_name', 'customer_email', 'processed_at',
            'line_items', 'items_count', 'shipping_address',
        ]

    def get_erp_document_number(self, obj):
        return obj.erp_document.document_number if obj.erp_document else None

    def get_line_items(self, obj):
        """Extract line items from stored Shopify order JSON."""
        raw_items = obj.shopify_data.get('line_items', []) if obj.shopify_data else []
        items = []
        for item in raw_items:
            items.append({
                'id': item.get('id'),
                'title': item.get('title', 'Unknown Product'),
                'variant_title': item.get('variant_title', ''),
                'sku': item.get('sku', ''),
                'quantity': item.get('quantity', 0),
                'price': item.get('price', '0.00'),
                'total_discount': item.get('total_discount', '0.00'),
                'fulfillment_status': item.get('fulfillment_status'),
                'product_id': item.get('product_id'),
                'variant_id': item.get('variant_id'),
                'requires_shipping': item.get('requires_shipping', True),
                'taxable': item.get('taxable', True),
            })
        return items

    def get_items_count(self, obj):
        raw_items = obj.shopify_data.get('line_items', []) if obj.shopify_data else []
        return sum(item.get('quantity', 0) for item in raw_items)

    def get_shipping_address(self, obj):
        addr = obj.shopify_data.get('shipping_address', {}) if obj.shopify_data else {}
        if not addr:
            return None
        return {
            'city': addr.get('city', ''),
            'province': addr.get('province', ''),
            'country': addr.get('country', ''),
            'zip': addr.get('zip', ''),
        }


class ShopifyDraftOrderSerializer(serializers.ModelSerializer):
    erp_document_number = serializers.SerializerMethodField()
    line_items = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ShopifyDraftOrder
        fields = [
            'id', 'shopify_draft_order_id', 'store', 'erp_document_number',
            'status', 'total_price', 'line_items', 'customer_name',
        ]

    def get_erp_document_number(self, obj):
        return obj.erp_document.document_number if obj.erp_document else None

    def get_line_items(self, obj):
        raw_items = obj.shopify_data.get('line_items', []) if obj.shopify_data else []
        items = []
        for item in raw_items:
            items.append({
                'title': item.get('title', 'Unknown'),
                'variant_title': item.get('variant_title', ''),
                'sku': item.get('sku', ''),
                'quantity': item.get('quantity', 0),
                'price': item.get('price', '0.00'),
            })
        return items

    def get_customer_name(self, obj):
        cust = obj.shopify_data.get('customer', {}) if obj.shopify_data else {}
        if cust:
            return f"{cust.get('first_name', '')} {cust.get('last_name', '')}".strip()
        return ''


class ShopifyDiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopifyDiscount
        fields = [
            'id', 'store', 'shopify_id', 'code', 'type',
            'value', 'value_type', 'starts_at', 'ends_at', 'is_active',
        ]


class ShopifyGiftCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopifyGiftCard
        fields = [
            'id', 'store', 'shopify_gift_card_id', 'last_characters',
            'initial_value', 'current_balance', 'currency',
            'expires_on', 'is_disabled',
        ]


# ViewSets
class ShopifyStoreViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Shopify store management.
    """
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    
    def get_queryset(self):
        user = self.request.user
        
        # If user is authenticated and has a company, filter by company
        if user and user.is_authenticated:
            company_id = getattr(user, 'company_id', None)
            if company_id:
                return ShopifyStore.objects.filter(company_id=company_id, status='active')
            # If user has no company, return stores they created
            return ShopifyStore.objects.filter(created_by=user, status='active')
        
        # For anonymous users, return all active stores (for testing)
        return ShopifyStore.objects.filter(status='active')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShopifyStoreCreateSerializer
        return ShopifyStoreSerializer
    
    def perform_create(self, serializer):
        user = self.request.user if self.request.user and self.request.user.is_authenticated else None
        
        # Check if store with this domain already exists
        shop_domain = serializer.validated_data.get('shop_domain')
        existing = ShopifyStore.objects.filter(shop_domain=shop_domain).first()
        
        if existing:
            # Update existing store instead of creating new one
            for key, value in serializer.validated_data.items():
                setattr(existing, key, value)
            if user:
                existing.updated_by = user
            existing.save()
            
            # Test connection
            ShopifyService.test_connection(existing)
            
            # Replace the instance in serializer
            serializer.instance = existing
            return
        
        # Get or create company
        company_id = getattr(user, 'company_id', None) if user else None
        if not company_id:
            from apps.mdm.models import Company
            company, _ = Company.objects.get_or_create(
                code='DEFAULT',
                defaults={'name': 'Default Company', 'status': 'active'}
            )
            company_id = company.id
        
        # Save the store
        save_params = {'company_id': company_id}
        if user:
            save_params['created_by'] = user
        
        store = serializer.save(**save_params)
        
        # Auto-test connection after creation
        try:
            ShopifyService.test_connection(store)
        except Exception as e:
            logger.warning(f"Auto connection test failed for store {store.id}: {e}")
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def quick_connect(self, request):
        """
        Quick-connect using credentials from .env settings.
        Creates a store entry using the environment-configured Shopify credentials.
        """
        
        store_domain = settings.SHOPIFY_STORE_DOMAIN
        access_token = settings.SHOPIFY_ACCESS_TOKEN
        api_key = settings.SHOPIFY_API_KEY
        api_secret = settings.SHOPIFY_API_SECRET
        api_version = settings.SHOPIFY_API_VERSION

        if not store_domain or not access_token or store_domain == 'your-store.myshopify.com':
            return Response({
                'error': 'Shopify credentials not configured in .env. '
                         'Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if already connected
        existing = ShopifyStore.objects.filter(
            shop_domain=store_domain,
            status='active'
        ).first()

        if existing:
            # Update credentials
            existing.access_token = access_token
            existing.api_key = api_key
            existing.api_secret = api_secret
            existing.api_version = api_version
            if request.user and request.user.is_authenticated:
                existing.updated_by = request.user
            existing.save()
            
            # Test connection
            is_connected = ShopifyService.test_connection(existing)
            
            if not is_connected:
                return Response({
                    'store': ShopifyStoreSerializer(existing).data,
                    'message': f'Connection failed: {existing.connection_error}',
                    'connected': False,
                    'error': existing.connection_error
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'store': ShopifyStoreSerializer(existing).data,
                'message': 'Store already exists, credentials updated and connection successful!',
                'connected': is_connected,
            })

        # Create new store
        user = request.user if request.user and request.user.is_authenticated else None
        company_id = getattr(user, 'company_id', None) if user else None
        if not company_id:
            from apps.mdm.models import Company
            company, _ = Company.objects.get_or_create(
                code='DEFAULT',
                defaults={'name': 'Default Company', 'status': 'active'}
            )
            company_id = company.id

        store_name = store_domain.replace('.myshopify.com', '').replace('-', ' ').title()
        
        create_params = {
            'name': store_name,
            'shop_domain': store_domain,
            'access_token': access_token,
            'api_key': api_key,
            'api_secret': api_secret,
            'api_version': api_version,
            'company_id': company_id,
            'auto_sync_products': True,
            'auto_sync_inventory': True,
            'auto_sync_orders': True,
        }
        
        if user:
            create_params['created_by'] = user
            create_params['updated_by'] = user
        
        store = ShopifyStore.objects.create(**create_params)

        # Test connection
        is_connected = ShopifyService.test_connection(store)
        
        if not is_connected:
            return Response({
                'store': ShopifyStoreSerializer(store).data,
                'message': f'Store created but connection failed: {store.connection_error}',
                'connected': False,
                'error': store.connection_error
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'store': ShopifyStoreSerializer(store).data,
            'message': 'Store connected successfully!',
            'connected': is_connected,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test connection to Shopify store."""
        store = self.get_object()
        is_connected = ShopifyService.test_connection(store)
        
        return Response({
            'connected': is_connected,
            'message': 'Connection successful' if is_connected else 'Connection failed',
            'error': store.connection_error if not is_connected else None
        })
    
    @action(detail=True, methods=['post'])
    def sync_products(self, request, pk=None):
        """Trigger product sync in background."""
        store = self.get_object()
        
        # Create job immediately so we can return the ID
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='products',
            job_status='running'
        )
        
        # Run sync in background thread
        def _run_sync():
            try:
                import django
                django.db.connections.close_all()
                ShopifyService._do_product_sync(store, job)
            except Exception as e:
                logger.error(f"Background product sync failed: {e}")
        
        thread = threading.Thread(target=_run_sync, daemon=True)
        thread.start()
        
        return Response({
            'job_id': str(job.id),
            'status': 'running',
            'message': f'Product sync started in background (job {job.id})'
        })
    
    @action(detail=True, methods=['post'])
    def sync_inventory(self, request, pk=None):
        """Trigger inventory sync in background."""
        store = self.get_object()
        job = ShopifySyncJob.objects.create(store=store, job_type='inventory', job_status='running')
        threading.Thread(target=lambda: ShopifyService._do_inventory_sync(store, job), daemon=True).start()
        return Response({'job_id': str(job.id), 'status': 'running'})

    @action(detail=True, methods=['post'])
    def sync_orders(self, request, pk=None):
        """Trigger order sync in background."""
        store = self.get_object()
        job = ShopifySyncJob.objects.create(store=store, job_type='orders', job_status='running')
        threading.Thread(target=lambda: ShopifyService.sync_orders(store), daemon=True).start()
        return Response({'job_id': str(job.id), 'status': 'running'})

    @action(detail=True, methods=['post'])
    def sync_draft_orders(self, request, pk=None):
        """Sync draft orders."""
        store = self.get_object()
        job = ShopifySyncJob.objects.create(store=store, job_type='draft_orders', job_status='running')
        threading.Thread(target=lambda: ShopifyService.sync_draft_orders(store), daemon=True).start()
        return Response({'job_id': str(job.id), 'status': 'running'})

    @action(detail=True, methods=['post'])
    def sync_discounts(self, request, pk=None):
        """Sync price rules and discounts."""
        store = self.get_object()
        job = ShopifySyncJob.objects.create(store=store, job_type='discounts', job_status='running')
        threading.Thread(target=lambda: ShopifyService.sync_discounts(store), daemon=True).start()
        return Response({'job_id': str(job.id), 'status': 'running'})
    
    @action(detail=True, methods=['post'])
    def setup_webhooks(self, request, pk=None):
        """Setup Shopify webhooks."""
        store = self.get_object()
        base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash
        
        try:
            webhooks = ShopifyService.setup_webhooks(store, base_url)
            return Response({
                'success': True,
                'webhooks_created': len(webhooks),
                'message': f'Created {len(webhooks)} webhooks'
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def sync_status(self, request, pk=None):
        """Get sync status and statistics."""
        store = self.get_object()
        
        products_count = ShopifyProduct.objects.filter(store=store).count()
        synced_count = ShopifyProduct.objects.filter(
            store=store,
            sync_status='synced'
        ).count()
        pending_count = ShopifyProduct.objects.filter(
            store=store,
            sync_status='pending'
        ).count()
        
        recent_jobs = ShopifySyncJob.objects.filter(store=store)[:5]
        
        return Response({
            'store': ShopifyStoreSerializer(store).data,
            'products': {
                'total': products_count,
                'synced': synced_count,
                'pending': pending_count,
            },
            'recent_jobs': ShopifySyncJobSerializer(recent_jobs, many=True).data
        })

    @action(detail=True, methods=['get'])
    def product_demand(self, request, pk=None):
        """
        Aggregated product demand from all orders.
        Shows what products were ordered and total quantities — for ERP inventory planning.
        """
        store = self.get_object()
        orders = ShopifyOrder.objects.filter(store=store)

        # Aggregate line items across all orders by product title + variant + SKU
        demand = defaultdict(lambda: {
            'title': '',
            'variant_title': '',
            'sku': '',
            'total_quantity': 0,
            'total_revenue': 0.0,
            'order_count': 0,
            'shopify_product_id': None,
        })

        for order in orders:
            if not order.shopify_data:
                continue
            for item in order.shopify_data.get('line_items', []):
                sku = item.get('sku', '')
                title = item.get('title', 'Unknown')
                variant = item.get('variant_title', '')
                key = f"{title}||{variant}||{sku}"

                demand[key]['title'] = title
                demand[key]['variant_title'] = variant
                demand[key]['sku'] = sku
                demand[key]['total_quantity'] += int(item.get('quantity', 0))
                demand[key]['total_revenue'] += float(item.get('price', 0)) * int(item.get('quantity', 0))
                demand[key]['order_count'] += 1
                demand[key]['shopify_product_id'] = item.get('product_id')

        # Enrich with current inventory from ShopifyProduct table
        result = []
        for key, d in demand.items():
            current_stock = None
            product_match = None
            if d['sku']:
                product_match = ShopifyProduct.objects.filter(
                    store=store, shopify_sku=d['sku']
                ).first()
            elif d['shopify_product_id']:
                product_match = ShopifyProduct.objects.filter(
                    store=store, shopify_product_id=d['shopify_product_id']
                ).first()

            if product_match:
                current_stock = product_match.shopify_inventory_quantity

            result.append({
                'title': d['title'],
                'variant_title': d['variant_title'],
                'sku': d['sku'],
                'total_quantity_sold': d['total_quantity'],
                'total_revenue': round(d['total_revenue'], 2),
                'order_count': d['order_count'],
                'current_stock': current_stock,
            })

        # Sort by total quantity sold descending
        result.sort(key=lambda x: x['total_quantity_sold'], reverse=True)

        return Response({
            'total_products': len(result),
            'total_units_sold': sum(r['total_quantity_sold'] for r in result),
            'total_revenue': round(sum(r['total_revenue'] for r in result), 2),
            'total_orders': orders.count(),
            'items': result,
        })

    @action(detail=True, methods=['get'])
    def shop_info(self, request, pk=None):
        """Fetch live shop info from Shopify API."""
        store = self.get_object()
        try:
            client = ShopifyAPIClient(store)
            shop_data = client._make_request('GET', 'shop.json')
            return Response(shop_data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY
            )

    @action(detail=True, methods=['get'])
    def locations(self, request, pk=None):
        """Fetch Shopify locations."""
        store = self.get_object()
        try:
            client = ShopifyAPIClient(store)
            locations = client.get_locations()
            return Response({'locations': locations})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY
            )

    @action(detail=True, methods=['post'])
    def push_product(self, request, pk=None):
        """Push an ERP product/SKU to Shopify."""
        store = self.get_object()
        sku_id = request.data.get('sku_id')
        if not sku_id:
            return Response(
                {'error': 'sku_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            result = ShopifyService.push_sku_to_shopify(store, sku_id)
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def push_inventory(self, request, pk=None):
        """Push ERP inventory levels to Shopify."""
        store = self.get_object()
        sku_id = request.data.get('sku_id')
        location_id = request.data.get('location_id')
        quantity = request.data.get('quantity')

        if not all([sku_id, quantity is not None]):
            return Response(
                {'error': 'sku_id and quantity are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            result = ShopifyService.push_inventory_to_shopify(
                store, sku_id, int(quantity), location_id
            )
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ShopifyProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for Shopify products.
    """
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifyProductSerializer
    pagination_class = ShopifyProductPagination
    
    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated:
            company_id = getattr(user, 'company_id', None)
            if company_id:
                queryset = ShopifyProduct.objects.filter(
                    store__company_id=company_id
                ).select_related('store', 'erp_product', 'erp_sku')
            else:
                queryset = ShopifyProduct.objects.filter(
                    store__created_by=user
                ).select_related('store', 'erp_product', 'erp_sku')
        else:
            queryset = ShopifyProduct.objects.all().select_related('store', 'erp_product', 'erp_sku')
        
        # Filter by store
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        # Filter by sync status
        sync_status = self.request.query_params.get('sync_status')
        if sync_status:
            queryset = queryset.filter(sync_status=sync_status)
            
        # Filter by product type
        product_type = self.request.query_params.get('product_type')
        if product_type:
            queryset = queryset.filter(shopify_product_type=product_type)
            
        # Filter by vendor
        vendor = self.request.query_params.get('vendor')
        if vendor:
            queryset = queryset.filter(shopify_vendor=vendor)
            
        # Filter by search
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(shopify_title__icontains=search) |
                Q(shopify_sku__icontains=search) |
                Q(shopify_barcode__icontains=search)
            )
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def map_to_sku(self, request, pk=None):
        """Map Shopify product to ERP SKU."""
        shopify_product = self.get_object()
        sku_id = request.data.get('sku_id')
        
        if not sku_id:
            return Response(
                {'error': 'sku_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from apps.mdm.models import SKU
            sku = SKU.objects.get(id=sku_id)
            
            shopify_product.erp_sku = sku
            shopify_product.erp_product = sku.product
            shopify_product.sync_status = 'synced'
            shopify_product.sync_error = ''
            shopify_product.save()
            
            return Response({
                'success': True,
                'message': 'Product mapped successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ShopifySyncJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for sync jobs.
    """
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifySyncJobSerializer
    
    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated:
            company_id = getattr(user, 'company_id', None)
            if company_id:
                queryset = ShopifySyncJob.objects.filter(
                    store__company_id=company_id
                ).select_related('store')
            else:
                queryset = ShopifySyncJob.objects.filter(
                    store__created_by=user
                ).select_related('store')
        else:
            queryset = ShopifySyncJob.objects.all().select_related('store')
        
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        return queryset.order_by('-started_at')


@method_decorator(csrf_exempt, name='dispatch')
class ShopifyWebhookView(APIView):
    """
    Receive Shopify webhooks.
    """
    permission_classes = [AllowAny]
    
    def post(self, request, store_id):
        """Handle incoming webhook."""
        try:
            store = ShopifyStore.objects.get(id=store_id)
        except ShopifyStore.DoesNotExist:
            return HttpResponse(status=404)
        
        # Get webhook data
        topic = request.headers.get('X-Shopify-Topic', '')
        hmac_header = request.headers.get('X-Shopify-Hmac-Sha256', '')
        
        # Verify webhook signature
        if store.webhook_secret and not store.verify_webhook(request.body, hmac_header):
            logger.warning(f"Invalid webhook signature for store {store_id}")
            return HttpResponse(status=401)
        
        # Parse payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponse(status=400)
        
        # Process webhook
        try:
            ShopifyService.process_webhook(
                store,
                topic,
                payload,
                dict(request.headers)
            )
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")
            return HttpResponse(status=500)
        
        return HttpResponse(status=200)


class ShopifyOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]  # Allow unauthenticated access for testing
    serializer_class = ShopifyOrderSerializer
    pagination_class = ShopifyOrderPagination

    def get_queryset(self):
        user = self.request.user
        company_id = getattr(user, 'company_id', None)
        queryset = ShopifyOrder.objects.select_related('erp_document', 'store').order_by('-processed_at')
        if company_id:
            queryset = queryset.filter(store__company_id=company_id)
        elif user.is_authenticated:
            queryset = queryset.filter(store__created_by=user)
        # If not authenticated, return all orders (since permission is AllowAny)
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        return queryset

    @action(detail=False, methods=['get'])
    def sales_summary(self, request):
        """
        Aggregate sales summary from Shopify orders for reporting.
        """
        from django.db.models import Sum, Count, Avg, Q
        from django.db.models.functions import TruncDate
        
        queryset = self.get_queryset()
        
        # Overall summary
        summary = queryset.aggregate(
            total_sales=Sum('total_price'),
            total_transactions=Count('id'),
            avg_transaction_value=Avg('total_price'),
        )
        
        # Calculate total items from line_items in shopify_data
        total_items = 0
        for order in queryset:
            if order.shopify_data and 'line_items' in order.shopify_data:
                total_items += sum(item.get('quantity', 0) for item in order.shopify_data['line_items'])
        
        summary['total_items'] = total_items
        
        # Sales by store (properly aggregated)
        by_store = queryset.values(
            'store__name',
            'store__shop_domain'
        ).annotate(
            total_sales=Sum('total_price'),
            transaction_count=Count('id'),
            avg_value=Avg('total_price'),
        )
        
        # Daily sales (last 30 days)
        daily_sales = queryset.annotate(
            date=TruncDate('processed_at')
        ).values('date').annotate(
            total_sales=Sum('total_price'),
            transaction_count=Count('id'),
        ).order_by('-date')[:30]
        
        # Order status breakdown
        status_breakdown = {
            'pending': queryset.filter(financial_status='pending').count(),
            'paid': queryset.filter(financial_status='paid').count(),
            'refunded': queryset.filter(financial_status='refunded').count(),
            'partially_refunded': queryset.filter(financial_status='partially_refunded').count(),
        }
        
        # Fulfillment status
        fulfillment_breakdown = {
            'unfulfilled': queryset.filter(Q(fulfillment_status__isnull=True) | Q(fulfillment_status='')).count(),
            'fulfilled': queryset.filter(fulfillment_status='fulfilled').count(),
            'partial': queryset.filter(fulfillment_status='partial').count(),
        }
        
        return Response({
            'summary': {
                'total_sales': float(summary['total_sales'] or 0),
                'total_transactions': summary['total_transactions'] or 0,
                'avg_transaction_value': float(summary['avg_transaction_value'] or 0),
                'total_items': total_items,
            },
            'by_store': list(by_store),
            'daily_sales': list(daily_sales),
            'status_breakdown': status_breakdown,
            'fulfillment_breakdown': fulfillment_breakdown,
        })
    
    @action(detail=False, methods=['get'])
    def top_products(self, request):
        """
        Top selling products from order line items.
        """
        queryset = self.get_queryset()
        limit = int(request.query_params.get('limit', 10))
        
        # Aggregate products from line items
        product_stats = defaultdict(lambda: {
            'title': '',
            'sku': '',
            'quantity_sold': 0,
            'revenue': 0.0,
            'order_count': 0,
        })
        
        for order in queryset:
            if not order.shopify_data or 'line_items' not in order.shopify_data:
                continue
            
            for item in order.shopify_data['line_items']:
                key = f"{item.get('product_id', 'unknown')}_{item.get('variant_id', '')}"
                product_stats[key]['title'] = item.get('title', 'Unknown')
                product_stats[key]['sku'] = item.get('sku', '')
                product_stats[key]['quantity_sold'] += int(item.get('quantity', 0))
                product_stats[key]['revenue'] += float(item.get('price', 0)) * int(item.get('quantity', 0))
                product_stats[key]['order_count'] += 1
        
        # Sort by revenue and limit
        products = sorted(product_stats.values(), key=lambda x: x['revenue'], reverse=True)[:limit]
        
        return Response({
            'products': products,
            'total_products': len(product_stats),
        })
    
    @action(detail=False, methods=['get'])
    def geographic_sales(self, request):
        """
        Sales breakdown by shipping location.
        """
        queryset = self.get_queryset()
        
        # Aggregate by country and city
        location_stats = defaultdict(lambda: {
            'country': '',
            'city': '',
            'order_count': 0,
            'revenue': 0.0,
        })
        
        for order in queryset:
            if not order.shopify_data:
                continue
            
            shipping = order.shopify_data.get('shipping_address', {})
            if not shipping:
                continue
            
            country = shipping.get('country', 'Unknown')
            city = shipping.get('city', 'Unknown')
            key = f"{country}_{city}"
            
            location_stats[key]['country'] = country
            location_stats[key]['city'] = city
            location_stats[key]['order_count'] += 1
            location_stats[key]['revenue'] += float(order.total_price)
        
        # Sort by revenue
        locations = sorted(location_stats.values(), key=lambda x: x['revenue'], reverse=True)
        
        return Response({
            'locations': locations,
            'total_locations': len(locations),
        })

class ShopifyDraftOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifyDraftOrderSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ShopifyDraftOrder.objects.select_related('store')
        if user and user.is_authenticated:
            company_id = getattr(user, 'company_id', None)
            if company_id:
                queryset = queryset.filter(store__company_id=company_id)
            else:
                queryset = queryset.filter(store__created_by=user)
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        return queryset

class ShopifyDiscountViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifyDiscountSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ShopifyDiscount.objects.select_related('store')
        if user and user.is_authenticated:
            company_id = getattr(user, 'company_id', None)
            if company_id:
                queryset = queryset.filter(store__company_id=company_id)
            else:
                queryset = queryset.filter(store__created_by=user)
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        return queryset


class ShopifyGiftCardViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifyGiftCardSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ShopifyGiftCard.objects.select_related('store')
        if user and user.is_authenticated:
            company_id = getattr(user, 'company_id', None)
            if company_id:
                return queryset.filter(store__company_id=company_id)
            return queryset.filter(store__created_by=user)
        return queryset

