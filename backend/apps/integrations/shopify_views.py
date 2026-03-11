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
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.conf import settings
from django.db.models import Sum
from decimal import Decimal
import threading

_thread_locals = threading.local()

def is_syncing():
    return getattr(_thread_locals, 'shopify_sync_in_progress', False)

class ShopifySyncContext:
    def __enter__(self):
        _thread_locals.shopify_sync_in_progress = True
    def __exit__(self, exc_type, exc_val, exc_tb):
        _thread_locals.shopify_sync_in_progress = False
from .shopify_models import (
    ShopifyStore, ShopifyProduct, ShopifyInventoryLevel,
    ShopifyWebhook, ShopifyWebhookLog, ShopifySyncJob,
    ShopifyOrder, ShopifyDraftOrder, ShopifyDiscount, ShopifyGiftCard,
    ShopifyFulfillment, ShopifyCollection
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
    page_size = 50
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
            'id', 'name', 'shop_domain', 'access_token', 'api_key', 'api_secret',
            'api_version', 'webhook_secret', 'auto_sync_products',
            'auto_sync_inventory', 'auto_sync_orders', 'sync_interval_minutes'
        ]
        read_only_fields = ['id']
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
        # ERP mapping removed from model
        return None

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
        # ERP mapping removed from model
        return None

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
        # Return all active stores — auth is handled by permission_classes
        return ShopifyStore.objects.filter(status='active')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShopifyStoreCreateSerializer
        return ShopifyStoreSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = self.perform_create(serializer)
        
        # Return full store data using standard serializer
        response_serializer = ShopifyStoreSerializer(instance)
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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
            return existing
        
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
            
        return store
    
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
        
        # Check for existing running job (SINGLETON)
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

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
                job.job_status = 'failed'
                job.error_log = str(e)
                job.save()

        threading.Thread(target=_run_sync, daemon=True).start()
        
        return Response({
            'job_id': str(job.id),
            'status': 'running',
            'message': 'Product sync started in background'
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def bulk_create_missing_erp_skus(self, request, pk=None):
        """Auto-create ERP Products/SKUs for all pending Shopify items."""
        store = self.get_object()
        
        pending_count = ShopifyProduct.objects.filter(store=store, sync_status='pending').count()
        if pending_count == 0:
            return Response({'message': 'No pending products to create.'})

        # Create a job to track progress
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='bulk_create_erp',
            job_status='running',
            total_items=pending_count
        )

        def _run_bulk_create():
            try:
                import django
                django.db.connections.close_all()
                
                pending_products = ShopifyProduct.objects.filter(store=store, sync_status='pending')
                for p in pending_products:
                    if job.job_status == 'cancelled':
                        break
                    try:
                        ShopifyService.create_erp_sku_from_shopify(p)
                        job.processed_items += 1
                        job.updated_items += 1
                    except Exception as e:
                        job.failed_items += 1
                        job.error_log += f"\nError creating {p.shopify_sku}: {str(e)}"
                    
                    if job.processed_items % 20 == 0:
                        job.save(update_fields=['processed_items', 'updated_items', 'failed_items', 'error_log'])
                
                job.job_status = 'completed' if job.job_status != 'cancelled' else 'cancelled'
                job.completed_at = timezone.now()
                job.save()
            except Exception as e:
                job.job_status = 'failed'
                job.error_log = f"Critical bulk creation error: {str(e)}"
                job.save()

        threading.Thread(target=_run_bulk_create, daemon=True).start()

        return Response({
            'job_id': str(job.id),
            'message': f'Started bulk creation for {pending_count} products.',
            'status': 'running'
        })
    
    @action(detail=True, methods=['post'])
    def sync_inventory(self, request, pk=None):
        """Trigger inventory sync in background."""
        store = self.get_object()

        # SINGLETON check
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        job = ShopifySyncJob.objects.create(store=store, job_type='inventory', job_status='running')
        threading.Thread(target=lambda: ShopifyService._do_inventory_sync(store, job), daemon=True).start()
        return Response({'job_id': str(job.id), 'status': 'running'})

    @action(detail=True, methods=['post'], url_path='sync-now')
    def sync_now(self, request, pk=None):
        """
        Trigger a full manual sync (orders + products) in the background.
        This is the single "Sync Now" action — all reports read from DB automatically.
        """
        store = self.get_object()

        # SINGLETON check
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        def _run_full_sync():
            try:
                import django
                django.db.connections.close_all()
                logger.info(f"[SyncNow] Starting full sync for {store.name}")
                ShopifyService.sync_orders(store)
                ShopifyService.sync_products(store)
                logger.info(f"[SyncNow] Full sync complete for {store.name}")
            except Exception as e:
                logger.error(f"[SyncNow] Sync failed for {store.name}: {e}")

        thread = threading.Thread(target=_run_full_sync, daemon=True)
        thread.start()

        return Response({
            'status': 'running',
            'message': f'Sync started for {store.name}. Data will be updated in the background (usually 1–3 minutes).',
        })

    @action(detail=True, methods=['post'], url_path='quick-sync')
    def quick_sync(self, request, pk=None):
        """
        Trigger a delta sync (changes only) in the background.
        """
        store = self.get_object()

        # SINGLETON check
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        def _run_quick_sync():
            try:
                import django
                django.db.connections.close_all()
                logger.info(f"[QuickSync] Starting streamlined delta sync for {store.name}")
                
                # 1. Faster Cleanup (Detect and remove deleted products)
                ShopifyService.cleanup_deleted_products(store)
                
                # 2. Products Delta (Fetch only updated product details)
                ShopifyService.sync_products_delta(store)
                
                # We skip full Inventory Delta here because it scans thousands of records.
                # Real-time inventory is already handled by bridged webhooks.
                
                logger.info(f"[QuickSync] Streamlined delta sync complete for {store.name}")
            except Exception as e:
                logger.error(f"[QuickSync] Sync failed for {store.name}: {e}")

        threading.Thread(target=_run_quick_sync, daemon=True).start()

        return Response({
            'status': 'running',
            'message': f'Quick sync (deletions & updates) started for {store.name}.',
        })

    @action(detail=True, methods=['post'])
    def cleanup_deleted(self, request, pk=None):
        """Run a full cleanup check against Shopify for deleted products."""
        store = self.get_object()
        
        # Singleton check
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='cleanup',
            job_status='running'
        )
        
        def _run_cleanup():
            try:
                import django
                django.db.connections.close_all()
                ShopifyService.cleanup_deleted_products(store, job)
                if job.job_status == 'running':
                    job.job_status = 'completed'
                    job.completed_at = timezone.now()
                    job.save()
            except Exception as e:
                logger.error(f"Background cleanup failed: {e}")
                job.job_status = 'failed'
                job.error_log = str(e)
                job.save()

        threading.Thread(target=_run_cleanup, daemon=True).start()
        
        return Response({
            'job_id': str(job.id),
            'status': 'running',
            'message': 'Cleanup job started in background'
        })

    @action(detail=True, methods=['post'])
    def sync_orders(self, request, pk=None):
        """Trigger order sync in background."""
        store = self.get_object()

        # SINGLETON check
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        job = ShopifySyncJob.objects.create(store=store, job_type='orders', job_status='running')
        threading.Thread(target=lambda: ShopifyService.sync_orders(store), daemon=True).start()
        return Response({'job_id': str(job.id), 'status': 'running'})

    @action(detail=True, methods=['post'])
    def sync_draft_orders(self, request, pk=None):
        """Sync draft orders."""
        store = self.get_object()

        # SINGLETON check
        existing_job = ShopifySyncJob.objects.filter(store=store, job_status='running').first()
        if existing_job:
            return Response({
                'error': f'A sync job ({existing_job.job_type}) is already running for this store.',
                'job_id': str(existing_job.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        job = ShopifySyncJob.objects.create(store=store, job_type='draft_orders', job_status='running')
        threading.Thread(target=lambda: ShopifyService.sync_draft_orders(store), daemon=True).start()
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
        Aggregated product demand from synced ShopifyOrder DB (fast, no timeout).
        Data is auto-synced every 12 hours by the background scheduler.
        """
        store = self.get_object()
        from datetime import datetime, timedelta
        from django.utils import timezone as tz
        from django.core.cache import cache
        from apps.integrations.shopify_models import ShopifyOrder
        from django.db.models import Sum, Count, F
        import json as _json

        days = request.query_params.get('days')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        # Build cache key
        cache_key = f"product_demand_{store.id}_{days or 'all'}_{date_from or ''}_{date_to or ''}"

        # Return cached result if available
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # Build date filter for DB query
        now = tz.now()
        orders_qs = ShopifyOrder.objects.filter(store=store)
        if days:
            cutoff = now - timedelta(days=int(days))
            orders_qs = orders_qs.filter(processed_at__gte=cutoff)
        elif date_from:
            orders_qs = orders_qs.filter(processed_at__date__gte=date_from)
            if date_to:
                orders_qs = orders_qs.filter(processed_at__date__lte=date_to)

        # Aggregate line items from stored shopify_data JSON
        demand = defaultdict(lambda: {
            'title': '',
            'variant_title': '',
            'sku': '',
            'total_quantity': 0,
            'total_revenue': 0.0,
            'order_count': 0,
            'shopify_product_id': None,
        })

        total_revenue = 0.0
        earliest_date = None
        latest_date = None
        order_count = 0

        # We need shopify_product_id and shopify_sku for bulk lookup
        skus_needed = set()
        ids_needed = set()

        for order in orders_qs.values('total_price', 'processed_at', 'shopify_data'):
            order_total = float(order['total_price'] or 0)
            total_revenue += order_total
            order_count += 1

            processed_at = order['processed_at']
            if processed_at:
                if earliest_date is None or processed_at < earliest_date:
                    earliest_date = processed_at
                if latest_date is None or processed_at > latest_date:
                    latest_date = processed_at

            shopify_data = order['shopify_data']
            line_items = shopify_data.get('line_items', []) if shopify_data else []
            for item in line_items:
                sku = item.get('sku', '')
                title = item.get('title', 'Unknown')
                variant = item.get('variant_title', '')
                p_id = item.get('product_id')
                
                key = f"{title}||{variant}||{sku}"

                demand[key]['title'] = title
                demand[key]['variant_title'] = variant
                demand[key]['sku'] = sku
                demand[key]['total_quantity'] += int(item.get('quantity', 0))
                demand[key]['total_revenue'] += float(item.get('price', 0)) * int(item.get('quantity', 0))
                demand[key]['order_count'] += 1
                if sku:
                    skus_needed.add(sku)
                if p_id:
                    demand[key]['shopify_product_id'] = p_id
                    ids_needed.add(str(p_id))

        # Bulk fetch current inventory to avoid N+1 queries
        from apps.integrations.shopify_models import ShopifyProduct
        stock_by_sku = {
            p.shopify_sku: p.shopify_inventory_quantity 
            for p in ShopifyProduct.objects.filter(store=store, shopify_sku__in=skus_needed).only('shopify_sku', 'shopify_inventory_quantity')
            if p.shopify_sku
        }
        stock_by_id = {
            str(p.shopify_product_id): p.shopify_inventory_quantity 
            for p in ShopifyProduct.objects.filter(store=store, shopify_product_id__in=ids_needed).only('shopify_product_id', 'shopify_inventory_quantity')
            if p.shopify_product_id
        }

        # Format results
        result = []
        for key, d in demand.items():
            current_stock = stock_by_sku.get(d['sku'])
            if current_stock is None and d['shopify_product_id']:
                current_stock = stock_by_id.get(str(d['shopify_product_id']))

            result.append({
                'title': d['title'],
                'variant_title': d['variant_title'],
                'sku': d['sku'],
                'total_quantity_sold': d['total_quantity'],
                'total_revenue': round(d['total_revenue'], 2),
                'order_count': d['order_count'],
                'current_stock': current_stock,
            })

        result.sort(key=lambda x: x['total_quantity_sold'], reverse=True)

        if earliest_date and latest_date:
            period_label = f"{earliest_date.strftime('%b %d, %Y')} – {latest_date.strftime('%b %d, %Y')}"
        else:
            period_label = "No Data"

        response_data = {
            'total_products': len(result),
            'total_units_sold': sum(r['total_quantity_sold'] for r in result),
            'total_revenue': round(total_revenue, 2),
            'total_orders': order_count,
            'period': period_label,
            'order_date_from': earliest_date.isoformat() if earliest_date else None,
            'order_date_to': latest_date.isoformat() if latest_date else None,
            'last_order_sync': store.last_order_sync.isoformat() if store.last_order_sync else None,
            'latest_order_date': latest_date.isoformat() if latest_date else None,
            'items': result,
        }

        # Cache for 5 minutes (300 seconds) — shorter to reflect syncs faster
        cache.set(cache_key, response_data, 300)
        return Response(response_data)

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

    @action(detail=True, methods=['post'])
    def create_erp_sku(self, request, pk=None):
        """Create a new ERP SKU from this Shopify product."""
        shopify_product = self.get_object()
        try:
            from .shopify_service import ShopifyService
            sku = ShopifyService.create_erp_sku_from_shopify(shopify_product)
            return Response({
                'success': True,
                'sku_id': str(sku.id),
                'message': f"Created ERP SKU: {sku.code}"
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ShopifySyncJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for sync jobs.
    """
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifySyncJobSerializer
    pagination_class = ShopifyProductPagination
    
    def get_queryset(self):
        queryset = ShopifySyncJob.objects.all().select_related('store')
        
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        return queryset.order_by('-started_at')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Mark a job as cancelled so background loop stops."""
        job = self.get_object()
        if job.job_status != 'running':
            return Response({
                'error': f'Job is already in {job.job_status} state and cannot be cancelled.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        job.job_status = 'cancelled'
        job.save()
        
        return Response({
            'success': True,
            'message': 'Sync job marked for cancellation. It will stop after the current item finishes.'
        })


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
            with ShopifySyncContext():
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
        from datetime import timedelta
        from django.utils import timezone as tz

        queryset = ShopifyOrder.objects.select_related('erp_document', 'store').order_by('-processed_at')
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)

        # Date filtering: ?days=30 (default 30) or ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        days = self.request.query_params.get('days')

        if start_date:
            queryset = queryset.filter(processed_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(processed_at__date__lte=end_date)
        if not start_date and not end_date:
            # Default to last N days (default 30)
            period = int(days) if days else 30
            cutoff = tz.now() - timedelta(days=period)
            queryset = queryset.filter(processed_at__gte=cutoff)

        return queryset

    @action(detail=False, methods=['get'])
    def sales_summary(self, request):
        """
        Aggregate sales summary from Shopify orders for reporting.
        Respects ?days=N, ?start_date, ?end_date from get_queryset.
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
        for shopify_data in queryset.values_list('shopify_data', flat=True):
            if shopify_data and 'line_items' in shopify_data:
                total_items += sum(item.get('quantity', 0) for item in shopify_data['line_items'])
        
        summary['total_items'] = total_items
        
        # Sales by channel
        by_channel = []
        total_sales_val = float(summary['total_sales'] or 0)
        # All Shopify orders are "online" channel
        if total_sales_val > 0:
            by_channel.append({
                'sales_channel': 'online',
                'total_sales': total_sales_val,
                'transaction_count': summary['total_transactions'] or 0,
                'avg_value': float(summary['avg_transaction_value'] or 0),
            })

        # Sales by store (properly aggregated)
        by_store = queryset.values(
            'store__name',
            'store__shop_domain'
        ).annotate(
            total_sales=Sum('total_price'),
            transaction_count=Count('id'),
            avg_value=Avg('total_price'),
        )
        
        # Daily sales within the filtered period
        daily_sales = queryset.annotate(
            date=TruncDate('processed_at')
        ).values('date').annotate(
            total_sales=Sum('total_price'),
            transaction_count=Count('id'),
        ).order_by('-date')
        
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

        # Date range info
        days_param = request.query_params.get('days', '30')
        
        return Response({
            'summary': {
                'total_sales': total_sales_val,
                'total_transactions': summary['total_transactions'] or 0,
                'avg_transaction_value': float(summary['avg_transaction_value'] or 0),
                'total_items': total_items,
            },
            'by_channel': by_channel,
            'by_store': list(by_store),
            'daily_sales': list(daily_sales),
            'status_breakdown': status_breakdown,
            'fulfillment_breakdown': fulfillment_breakdown,
            'period_days': int(days_param),
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
    pagination_class = ShopifyProductPagination

    def get_queryset(self):
        queryset = ShopifyDraftOrder.objects.select_related('store')
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        return queryset




class ShopifyGiftCardViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]  # Temporarily disabled for testing
    serializer_class = ShopifyGiftCardSerializer
    pagination_class = ShopifyProductPagination

    def get_queryset(self):
        queryset = ShopifyGiftCard.objects.select_related('store')
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        return queryset


# ── Shopify Collections ──────────────────────────────────────────────────────

class ShopifyCollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopifyCollection
        fields = ['id', 'shopify_collection_id', 'title', 'collection_type', 'handle', 'is_active']


class ShopifyCollectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lists cached Shopify collections and provides a sync action
    to refresh them from the live Shopify Admin API.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ShopifyCollectionSerializer
    pagination_class = None  # Return all collections (small list)

    def get_queryset(self):
        qs = ShopifyCollection.objects.select_related('store').filter(is_active=True)
        store_id = self.request.query_params.get('store')
        if store_id:
            qs = qs.filter(store_id=store_id)
        else:
            # Default to the first connected store for this company
            store = ShopifyStore.objects.filter(
                company_id=self.request.user.company_id,
                is_connected=True
            ).first()
            if store:
                qs = qs.filter(store=store)
        return qs.order_by('title')

    @action(detail=False, methods=['post'], url_path='sync')
    def sync(self, request):
        """
        Fetch all collections from Shopify Admin and cache them locally.
        READ-ONLY fetch from Shopify — only writes to local ShopifyCollection table.
        """
        store_id = request.data.get('store_id')
        if store_id:
            try:
                store = ShopifyStore.objects.get(id=store_id, company_id=request.user.company_id)
            except ShopifyStore.DoesNotExist:
                return Response({'error': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            store = ShopifyStore.objects.filter(
                company_id=request.user.company_id,
                is_connected=True
            ).first()
            if not store:
                return Response({'error': 'No connected Shopify store found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create job record
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='collections',
            job_status='running'
        )

        def _run_sync():
            try:
                import django
                django.db.connections.close_all()
                # First fetch the folder/titles (Collections themselves)
                ShopifyService.sync_collections(store, job=job)
                
                # Immediately follow with Membership sync (Product <-> Collection association)
                # We reuse the same job ID or create a sub-step?
                # For simplicity, we just call the second method which also updates the job.
                ShopifyService.sync_collection_memberships(store, job=job)
            except Exception as e:
                logger.error(f"Background collection sync failed: {e}")
                if job:
                    job.job_status = 'failed'
                    job.error_log = str(e)
                    job.save()

        threading.Thread(target=_run_sync, daemon=True).start()

        return Response({
            'job_id': str(job.id),
            'status': 'running',
            'message': 'Collection sync started in background'
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], url_path='backfill')
    def backfill(self, request):
        """
        Scan all products and assign them to Shopify collections if set.
        """
        store_id = request.data.get('store_id')
        if store_id:
            try:
                store = ShopifyStore.objects.get(id=store_id, company_id=request.user.company_id)
            except ShopifyStore.DoesNotExist:
                return Response({'error': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            store = ShopifyStore.objects.filter(
                company_id=request.user.company_id,
                is_connected=True
            ).first()
            if not store:
                return Response({'error': 'No connected Shopify store found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create job record
        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='collections',  # Could use a new type but 'collections' covers both sync and backfill
            job_status='running'
        )

        def _run_backfill():
            try:
                import django
                django.db.connections.close_all()
                ShopifyService.backfill_collections(store, job=job)
            except Exception as e:
                logger.error(f"Background collection backfill failed: {e}")
                if job:
                    job.job_status = 'failed'
                    job.error_log = str(e)
                    job.save()

        threading.Thread(target=_run_backfill, daemon=True).start()

        return Response({
            'job_id': str(job.id),
            'status': 'running',
            'message': 'Collection backfill started in background'
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], url_path='sync-memberships')
    def sync_memberships(self, request):
        """
        Pulls collection memberships from Shopify and updates local ERP products.
        Fixes the issue where filters show '—' instead of the collection name.
        """
        store_id = request.data.get('store_id')
        if store_id:
            try:
                store = ShopifyStore.objects.get(id=store_id, company_id=request.user.company_id)
            except ShopifyStore.DoesNotExist:
                return Response({'error': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            store = ShopifyStore.objects.filter(
                company_id=request.user.company_id,
                is_connected=True
            ).first()
            if not store:
                return Response({'error': 'No connected Shopify store found.'}, status=status.HTTP_400_BAD_REQUEST)

        job = ShopifySyncJob.objects.create(
            store=store,
            job_type='collections',
            job_status='running'
        )

        def _run_memberships():
            try:
                import django
                django.db.connections.close_all()
                ShopifyService.sync_collection_memberships(store, job=job)
            except Exception as e:
                logger.error(f"Background membership sync failed: {e}")
                if job:
                    job.job_status = 'failed'
                    job.error_log = str(e)
                    job.save()

        threading.Thread(target=_run_memberships, daemon=True).start()

        return Response({
            'job_id': str(job.id),
            'status': 'running',
            'message': 'Collection membership sync started'
        }, status=status.HTTP_202_ACCEPTED)
