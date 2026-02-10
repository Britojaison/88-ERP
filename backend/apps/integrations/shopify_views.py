"""
Shopify Integration API Views.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .shopify_models import (
    ShopifyStore, ShopifyProduct, ShopifyInventoryLevel,
    ShopifyWebhook, ShopifyWebhookLog, ShopifySyncJob
)
from .shopify_service import ShopifyService
from rest_framework import serializers
import json
import logging

logger = logging.getLogger(__name__)


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


class ShopifyProductSerializer(serializers.ModelSerializer):
    erp_product_code = serializers.CharField(source='erp_product.code', read_only=True, allow_null=True)
    erp_sku_code = serializers.CharField(source='erp_sku.code', read_only=True, allow_null=True)
    
    class Meta:
        model = ShopifyProduct
        fields = [
            'id', 'shopify_product_id', 'shopify_variant_id', 'shopify_title',
            'shopify_sku', 'shopify_barcode', 'shopify_price',
            'shopify_inventory_quantity', 'erp_product', 'erp_product_code',
            'erp_sku', 'erp_sku_code', 'sync_status', 'last_synced_at',
            'sync_error', 'created_at'
        ]


class ShopifySyncJobSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    duration_seconds = serializers.SerializerMethodField()
    
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


# ViewSets
class ShopifyStoreViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Shopify store management.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        return ShopifyStore.objects.filter(company_id=company_id, status='active')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShopifyStoreCreateSerializer
        return ShopifyStoreSerializer
    
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)
    
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
        """Trigger product sync."""
        store = self.get_object()
        job = ShopifyService.sync_products(store)
        
        return Response({
            'job_id': job.id,
            'status': job.status,
            'message': 'Product sync started'
        })
    
    @action(detail=True, methods=['post'])
    def sync_inventory(self, request, pk=None):
        """Trigger inventory sync."""
        store = self.get_object()
        job = ShopifyService.sync_inventory(store)
        
        return Response({
            'job_id': job.id,
            'status': job.status,
            'message': 'Inventory sync started'
        })
    
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


class ShopifyProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for Shopify products.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ShopifyProductSerializer
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = ShopifyProduct.objects.filter(
            store__company_id=company_id
        ).select_related('store', 'erp_product', 'erp_sku')
        
        # Filter by store
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        # Filter by sync status
        sync_status = self.request.query_params.get('sync_status')
        if sync_status:
            queryset = queryset.filter(sync_status=sync_status)
        
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
            sku = SKU.objects.get(id=sku_id, company_id=request.user.company_id)
            
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
    permission_classes = [IsAuthenticated]
    serializer_class = ShopifySyncJobSerializer
    
    def get_queryset(self):
        company_id = self.request.user.company_id
        queryset = ShopifySyncJob.objects.filter(
            store__company_id=company_id
        ).select_related('store')
        
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
        if not store.verify_webhook(request.body, hmac_header):
            logger.warning(f"Invalid webhook signature for store {store_id}")
            return HttpResponse(status=401)
        
        # Parse payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return HttpResponse(status=400)
        
        # Process webhook asynchronously (you can use Celery here)
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
