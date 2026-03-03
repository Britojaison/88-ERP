"""
API Views for Inventory Management.
"""
from decimal import Decimal
from django.db import models, transaction
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.core.exceptions import ValidationError
from .models import InventoryBalance, InventoryMovement, GoodsReceiptScan, DamagedItem
from .serializers import (
    InventoryBalanceSerializer,
    InventoryMovementSerializer,
    InventoryMovementCreateSerializer,
    GoodsReceiptScanSerializer,
    GoodsReceiptScanRequestSerializer,
    DamagedItemSerializer,
)
from rest_framework.pagination import PageNumberPagination
from apps.mdm.models import SKU, Location, SKUBarcode
from apps.documents.models import Document, DocumentLine


class InventoryPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 1000


from rest_framework import mixins
class InventoryBalanceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryBalanceSerializer
    pagination_class = InventoryPagination

    def get_queryset(self):
        queryset = InventoryBalance.objects.filter(
            company_id=self.request.user.company_id, 
            status="active",
            condition=InventoryBalance.CONDITION_NEW
        ).select_related("sku", "sku__product", "location")

        sku_id = self.request.query_params.get("sku")
        if sku_id:
            queryset = queryset.filter(sku_id=sku_id)

        location_id = self.request.query_params.get("location")
        if location_id:
            queryset = queryset.filter(location_id=location_id)

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(sku__code__icontains=search) |
                Q(sku__name__icontains=search) |
                Q(sku__product__name__icontains=search)
            )

        stock_filter = self.request.query_params.get("stock_filter")
        if stock_filter == "in_stock":
            queryset = queryset.filter(quantity_available__gt=0)
        elif stock_filter == "out_of_stock":
            queryset = queryset.filter(quantity_available__lte=0)

        return queryset.order_by("-updated_at")

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Return aggregate stats for a location (total SKUs, total units, zero-stock count)."""
        location_id = request.query_params.get("location")
        if not location_id:
            return Response({"error": "location parameter is required"}, status=400)

        qs = InventoryBalance.objects.filter(
            company_id=request.user.company_id,
            status="active",
            condition=InventoryBalance.CONDITION_NEW,
            location_id=location_id,
        )

        agg = qs.aggregate(
            total_skus=Count('id'),
            total_units=Sum('quantity_available'),
            zero_stock=Count('id', filter=models.Q(quantity_available__lte=0)),
        )

        return Response({
            "total_skus": agg['total_skus'] or 0,
            "total_units": int(agg['total_units'] or 0),
            "zero_stock": agg['zero_stock'] or 0,
        })

    @action(detail=False, methods=['get'], url_path='velocity')
    def stock_velocity(self, request):
        """
        Calculates fast, slow, and dead stock based on recent sales vs current balance.
        Persists classification to SKU model.
        """
        from django.db.models import Sum
        from apps.sales.models import SalesTransactionLine
        from django.utils import timezone
        import datetime

        days = int(request.query_params.get("days", "30"))
        fast_threshold = float(request.query_params.get("fast_threshold", "20"))
        slow_threshold = float(request.query_params.get("slow_threshold", "1"))
        period_ago = timezone.now() - datetime.timedelta(days=days)
        
        # 1. Get current inventory by sku
        balances = InventoryBalance.objects.filter(
            company_id=request.user.company_id,
            status="active"
        ).values('sku__id', 'sku__code', 'sku__name').annotate(
            total_quantity=Sum('quantity_on_hand')
        )
        
        # 2. Get sales in period (Unified: POS + Shopify)
        from apps.documents.models import DocumentLine
        from apps.sales.models import SalesTransactionLine
        
        # POS sales
        pos_sales = SalesTransactionLine.objects.filter(
            sku__company_id=request.user.company_id,
            transaction__transaction_date__gte=period_ago,
            transaction__status='active'
        ).values('sku__id').annotate(
            sold_in_period=Sum('quantity')
        )
        
        # Shopify/Sales Order sales
        order_sales = DocumentLine.objects.filter(
            sku__company_id=request.user.company_id,
            document__document_type__code='sales_order',
            document__document_date__gte=period_ago.date(),
            status='active'
        ).values('sku__id').annotate(
            sold_in_period=Sum('quantity')
        )

        sales_dict = {}
        for item in pos_sales:
            sales_dict[item['sku__id']] = float(item['sold_in_period'] or 0)
        for item in order_sales:
            sku_id = item['sku__id']
            sales_dict[sku_id] = sales_dict.get(sku_id, 0) + float(item['sold_in_period'] or 0)

        fast, slow, dead = [], [], []
        sku_updates = []
        
        # We need SKU objects to update them
        all_skus = SKU.objects.filter(company_id=request.user.company_id, status='active')
        sku_map = {sku.id: sku for sku in all_skus}

        for bal in balances:
            sku_id = bal['sku__id']
            qty = bal['total_quantity'] or 0
            sold = float(sales_dict.get(sku_id, 0))
            
            item = {
                "sku_id": str(sku_id),
                "sku_code": bal['sku__code'],
                "sku_name": bal['sku__name'],
                "current_stock": float(qty),
                "sold_period": sold
            }
            
            classification = SKU.CLASSIFICATION_NONE
            if sold >= fast_threshold:
                classification = SKU.CLASSIFICATION_FAST
                fast.append(item)
            elif sold >= slow_threshold:
                classification = SKU.CLASSIFICATION_SLOW
                slow.append(item)
            else:
                classification = SKU.CLASSIFICATION_DEAD
                dead.append(item)
            
            # Update SKU model if changed
            sku_obj = sku_map.get(sku_id)
            if sku_obj and sku_obj.movement_classification != classification:
                sku_obj.movement_classification = classification
                sku_updates.append(sku_obj)
                
        if sku_updates:
            SKU.objects.bulk_update(sku_updates, ['movement_classification'])
                
        # sort by highest sold / Highest stock
        fast = sorted(fast, key=lambda x: x['sold_period'], reverse=True)
        slow = sorted(slow, key=lambda x: x['sold_period'], reverse=True)
        dead = sorted(dead, key=lambda x: x['current_stock'], reverse=True)
        
        return Response({
            "period_days": days,
            "thresholds": {"fast": fast_threshold, "slow": slow_threshold},
            "summary": {
                "fast_count": len(fast),
                "slow_count": len(slow),
                "dead_count": len(dead)
            },
            "fast_moving": fast[:50],
            "slow_moving": slow[:50],
            "dead_stock": dead[:50]
        })


class InventoryMovementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = InventoryPagination

    def get_queryset(self):
        queryset = InventoryMovement.objects.filter(
            sku__company_id=self.request.user.company_id
        ).select_related("sku", "from_location", "to_location", "document")

        movement_type = self.request.query_params.get("movement_type")
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)

        sku_id = self.request.query_params.get("sku")
        if sku_id:
            queryset = queryset.filter(sku_id=sku_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                sku__code__icontains=search
            ) | queryset.filter(
                reference_number__icontains=search
            )

        return queryset.order_by("-movement_date")

    def get_serializer_class(self):
        if self.action == "create":
            return InventoryMovementCreateSerializer
        return InventoryMovementSerializer

    def update(self, request, *args, **kwargs):
        return Response(
            {"error": "Inventory movements are immutable."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        return Response(
            {"error": "Inventory movements are immutable."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @transaction.atomic
    def perform_create(self, serializer):
        movement = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        self._apply_movement(movement, self.request.user.company_id)

    def _get_or_create_balance(self, company_id, sku, location, condition):
        balance, _ = InventoryBalance.objects.select_for_update().get_or_create(
            company_id=company_id,
            sku=sku,
            location=location,
            condition=condition,
            defaults={
                "quantity_on_hand": Decimal("0"),
                "quantity_reserved": Decimal("0"),
                "quantity_available": Decimal("0"),
                "average_cost": Decimal("0"),
            },
        )
        return balance

    def _decrease_balance(self, balance, qty):
        if balance.quantity_on_hand < qty:
            raise ValidationError(f"Insufficient stock for SKU {balance.sku.code} at {balance.location.code}")

        balance.quantity_on_hand -= qty
        balance.quantity_available = balance.quantity_on_hand - balance.quantity_reserved
        balance.save(update_fields=["quantity_on_hand", "quantity_available", "updated_at", "version"])

    def _increase_balance(self, balance, qty, unit_cost):
        current_qty = balance.quantity_on_hand
        new_qty = current_qty + qty

        if new_qty > 0:
            weighted_total = (balance.average_cost * current_qty) + (unit_cost * qty)
            balance.average_cost = weighted_total / new_qty

        balance.quantity_on_hand = new_qty
        balance.quantity_available = balance.quantity_on_hand - balance.quantity_reserved
        balance.save(
            update_fields=[
                "quantity_on_hand",
                "quantity_available",
                "average_cost",
                "updated_at",
                "version",
            ]
        )

    def _apply_movement(self, movement: InventoryMovement, company_id):
        qty = movement.quantity
        condition = InventoryBalance.CONDITION_NEW

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_RECEIPT:
            to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
            self._increase_balance(to_balance, qty, movement.unit_cost)
            # ── Push to Shopify if receiving into Shopify Warehouse ──
            self._sync_shopify_after_balance_change(movement.sku, movement.to_location, to_balance)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_ISSUE:
            from_balance = self._get_or_create_balance(company_id, movement.sku, movement.from_location, condition)
            self._decrease_balance(from_balance, qty)
            # ── Push to Shopify if issuing from Shopify Warehouse ──
            self._sync_shopify_after_balance_change(movement.sku, movement.from_location, from_balance)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_TRANSFER:
            from_balance = self._get_or_create_balance(company_id, movement.sku, movement.from_location, condition)
            to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
            self._decrease_balance(from_balance, qty)
            self._increase_balance(to_balance, qty, movement.unit_cost)

            # ── Auto-push to Shopify when transferring OUT of Shopify Warehouse ──
            self._sync_shopify_after_balance_change(movement.sku, movement.from_location, from_balance)
            # Also handle transfers INTO Shopify Warehouse (increases online stock)
            self._sync_shopify_after_balance_change(movement.sku, movement.to_location, to_balance)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_ADJUSTMENT:
            if movement.from_location:
                from_balance = self._get_or_create_balance(company_id, movement.sku, movement.from_location, condition)
                self._decrease_balance(from_balance, qty)
                self._sync_shopify_after_balance_change(movement.sku, movement.from_location, from_balance)
            if movement.to_location:
                to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
                self._increase_balance(to_balance, qty, movement.unit_cost)
                self._sync_shopify_after_balance_change(movement.sku, movement.to_location, to_balance)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_RETURN:
            to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
            self._increase_balance(to_balance, qty, movement.unit_cost)
            self._sync_shopify_after_balance_change(movement.sku, movement.to_location, to_balance)
            return

    def _sync_shopify_after_balance_change(self, sku, location, balance):
        """If the location is Shopify Warehouse, push the updated quantity to Shopify.
        If the SKU doesn't have a Shopify mapping yet, auto-create it first."""
        if location.code != 'SHOPIFY-WH':
            return
        try:
            from apps.integrations.shopify_models import ShopifyStore, ShopifyProduct
            from apps.integrations.shopify_service import ShopifyService
            import threading
            import logging

            log = logging.getLogger(__name__)

            store = ShopifyStore.objects.filter(
                company_id=location.company_id,
                is_active=True
            ).first()
            if not store:
                return

            new_qty = int(balance.quantity_available)

            mapping = ShopifyProduct.objects.filter(
                store=store,
                erp_sku_id=sku.id,
                sync_status='synced'
            ).first()

            def _push():
                try:
                    nonlocal mapping
                    # If no mapping, auto-create the product on Shopify first
                    if not mapping:
                        log.info(f"No Shopify mapping for SKU {sku.code}, auto-creating...")
                        ShopifyService.push_sku_to_shopify(store, str(sku.id))
                        # Re-fetch the mapping that was just created
                        mapping = ShopifyProduct.objects.filter(
                            store=store,
                            erp_sku_id=sku.id,
                            sync_status='synced'
                        ).first()
                        if not mapping:
                            log.warning(f"Failed to create Shopify mapping for SKU {sku.code}")
                            return

                    # Now push the accurate quantity
                    ShopifyService.push_inventory_to_shopify(store, str(sku.id), new_qty)
                    log.info(f"Pushed {new_qty} units to Shopify for SKU {sku.code}")
                except Exception as e:
                    log.warning(f"Shopify sync failed for SKU {sku.code}: {e}")

            # Run in background thread so the response isn't delayed
            threading.Thread(target=_push, daemon=True).start()
        except Exception:
            pass  # Shopify integration not configured — silently skip

    @action(detail=False, methods=["get"], url_path="alerts")
    def alerts(self, request):
        """
        Stock alerts using per-SKU minimum stock levels.
        Prioritizes best sellers.
        """
        all_balances = InventoryBalance.objects.filter(
            company_id=request.user.company_id,
            status="active",
        ).select_related("sku", "location")

        critical_alerts = [] # Best sellers below min
        standard_alerts = [] # Regular items below min

        for item in all_balances:
            min_level = item.sku.min_stock_level
            current_qty = item.quantity_available
            
            if min_level > 0 and current_qty <= min_level:
                alert_data = {
                    "id": str(item.id),
                    "sku_id": item.sku_id,
                    "sku_code": item.sku.code,
                    "sku_name": item.sku.name,
                    "location_code": item.location.code,
                    "location_name": item.location.name,
                    "quantity_on_hand": str(item.quantity_on_hand),
                    "min_stock_level": str(min_level),
                    "classification": item.sku.movement_classification,
                    "is_best_seller": item.sku.is_best_seller,
                    "updated_at": timezone.localtime(item.updated_at).isoformat(),
                }
                
                # Critical if marked as best seller OR classified as 'fast' moving
                if item.sku.is_best_seller or item.sku.movement_classification == 'fast':
                    critical_alerts.append(alert_data)
                else:
                    standard_alerts.append(alert_data)
                    
        # Include Shopify integrations inventory
        from apps.integrations.shopify_models import ShopifyProduct
        shopify_products = ShopifyProduct.objects.filter(
            store__company_id=request.user.company_id,
            erp_sku__isnull=False
        ).select_related("erp_sku")
        
        for sp in shopify_products:
            min_level = sp.erp_sku.min_stock_level
            current_qty = sp.shopify_inventory_quantity
            
            if min_level > 0 and current_qty <= min_level:
                alert_data = {
                    "id": f"shopify_{sp.id}",
                    "sku_id": sp.erp_sku_id,
                    "sku_code": sp.erp_sku.code,
                    "sku_name": sp.erp_sku.name,
                    "location_code": "ONLINE",
                    "location_name": "Shopify Online Store",
                    "quantity_on_hand": str(current_qty),
                    "min_stock_level": str(min_level),
                    "classification": sp.erp_sku.movement_classification,
                    "is_best_seller": sp.erp_sku.is_best_seller,
                    "updated_at": timezone.localtime(sp.last_synced_at or sp.updated_at).isoformat(),
                }
                
                if sp.erp_sku.is_best_seller or sp.erp_sku.movement_classification == 'fast':
                    critical_alerts.append(alert_data)
                else:
                    standard_alerts.append(alert_data)

        # Sort: lowest stock relative to min_level first
        standard_alerts.sort(key=lambda x: float(x['quantity_on_hand']))
        critical_alerts.sort(key=lambda x: float(x['quantity_on_hand']))

        return Response({
            "critical_best_sellers": critical_alerts,
            "standard_alerts": standard_alerts,
            "summary": {
                "critical_count": len(critical_alerts),
                "standard_count": len(standard_alerts)
            }
        })


class GoodsReceiptScanViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GoodsReceiptScanSerializer
    pagination_class = InventoryPagination

    def get_queryset(self):
        queryset = GoodsReceiptScan.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("sku", "barcode", "location", "document")
        
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                sku__code__icontains=search
            ) | queryset.filter(
                barcode_value__icontains=search
            )
            
        return queryset

    def list(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @transaction.atomic
    @action(detail=False, methods=["post"], url_path="scan")
    def scan(self, request):
        """
        Barcode scanning endpoint for goods receipt.
        
        Supports:
        1. Exact barcode value match
        2. SKU code direct lookup
        3. Pipe-delimited format: SKU|Batch|Serial
        
        Validates:
        - Barcode/SKU exists and is active
        - Document line matching (if document provided)
        - Over-receipt prevention (if strict mode)
        """
        input_serializer = GoodsReceiptScanRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        barcode_value = data["barcode_value"].strip()
        
        # Validate location exists
        try:
            location = Location.objects.get(id=data["location_id"], company_id=request.user.company_id, status="active")
        except Location.DoesNotExist:
            return Response(
                {"error": "Location not found or inactive."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        quantity = data["quantity"]
        strict = data["strict"]

        # Validate document if provided
        document = None
        if data.get("document_id"):
            try:
                document = Document.objects.get(
                    id=data["document_id"], 
                    company_id=request.user.company_id,
                    status="active"
                )
            except Document.DoesNotExist:
                return Response(
                    {"error": "Document not found or inactive."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Step 1: Try exact barcode match
        barcode = SKUBarcode.objects.filter(
            company_id=request.user.company_id,
            barcode_value=barcode_value,
            status="active",
        ).select_related("sku").first()

        sku = barcode.sku if barcode else None
        batch_number = ""
        serial_number = ""

        # Step 2: If no barcode match, try SKU code lookup
        if not sku:
            sku = SKU.objects.filter(
                company_id=request.user.company_id,
                code=barcode_value,
                status="active"
            ).first()

        # Step 3: Try pipe-delimited format (SKU|Batch|Serial)
        if not sku and "|" in barcode_value:
            parts = barcode_value.split("|")
            sku_code = parts[0].strip()
            batch_number = parts[1].strip() if len(parts) > 1 else ""
            serial_number = parts[2].strip() if len(parts) > 2 else ""
            sku = SKU.objects.filter(
                company_id=request.user.company_id, 
                code=sku_code, 
                status="active"
            ).first()

        # SKU not found - log as unknown
        if not sku:
            log = GoodsReceiptScan.objects.create(
                company_id=request.user.company_id,
                barcode_value=barcode_value,
                location=location,
                document=document,
                quantity=quantity,
                result=GoodsReceiptScan.RESULT_UNKNOWN,
                message=f"Barcode/SKU '{barcode_value}' not recognized.",
                created_by=request.user,
                updated_by=request.user,
            )
            return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_200_OK)

        # Validate SKU has cost price
        if not sku.cost_price or sku.cost_price <= 0:
            log = GoodsReceiptScan.objects.create(
                company_id=request.user.company_id,
                barcode_value=barcode_value,
                sku=sku,
                barcode=barcode,
                location=location,
                document=document,
                quantity=quantity,
                batch_number=batch_number,
                serial_number=serial_number,
                result=GoodsReceiptScan.RESULT_UNKNOWN,
                message=f"SKU {sku.code} has no valid cost price configured.",
                created_by=request.user,
                updated_by=request.user,
            )
            return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_200_OK)

        # Document validation
        if document:
            line = DocumentLine.objects.filter(
                document=document, 
                sku=sku, 
                status="active"
            ).first()
            
            if not line:
                result = GoodsReceiptScan.RESULT_MISMATCH
                msg = f"SKU {sku.code} is not part of document {document.document_number}."
                log = GoodsReceiptScan.objects.create(
                    company_id=request.user.company_id,
                    barcode_value=barcode_value,
                    sku=sku,
                    barcode=barcode,
                    location=location,
                    document=document,
                    quantity=quantity,
                    batch_number=batch_number,
                    serial_number=serial_number,
                    result=result,
                    message=msg,
                    created_by=request.user,
                    updated_by=request.user,
                )
                return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_200_OK)

            # Check for over-receipt
            ordered_qty = line.quantity
            received_qty = (
                InventoryMovement.objects.filter(
                    document=document,
                    sku=sku,
                    movement_type=InventoryMovement.MOVEMENT_TYPE_RECEIPT,
                    status="active",
                )
                .aggregate(total=Sum("quantity"))
                .get("total")
                or Decimal("0")
            )
            
            if strict and (received_qty + quantity > ordered_qty):
                result = GoodsReceiptScan.RESULT_OVER_RECEIPT
                msg = (
                    f"Over receipt blocked. Ordered: {ordered_qty}, "
                    f"Already received: {received_qty}, Attempting: {quantity}, "
                    f"Remaining: {ordered_qty - received_qty}."
                )
                log = GoodsReceiptScan.objects.create(
                    company_id=request.user.company_id,
                    barcode_value=barcode_value,
                    sku=sku,
                    barcode=barcode,
                    location=location,
                    document=document,
                    quantity=quantity,
                    batch_number=batch_number,
                    serial_number=serial_number,
                    result=result,
                    message=msg,
                    created_by=request.user,
                    updated_by=request.user,
                )
                return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_200_OK)

        # Create inventory movement
        try:
            movement = InventoryMovement.objects.create(
                movement_type=InventoryMovement.MOVEMENT_TYPE_RECEIPT,
                movement_date=timezone.now(),
                sku=sku,
                to_location=location,
                quantity=quantity,
                unit_cost=sku.cost_price,
                total_cost=quantity * sku.cost_price,
                document=document,
                reference_number=f"SCAN:{barcode_value}",
                notes=f"Goods receipt via barcode scan. Batch: {batch_number or 'N/A'}, Serial: {serial_number or 'N/A'}",
                created_by=request.user,
                updated_by=request.user,
                status="active",
            )

            # Apply movement to inventory balance
            InventoryMovementViewSet()._apply_movement(movement, request.user.company_id)

            # ── Sync with Production Orders ──
            # If there's an active PO for this SKU, update its received count
            try:
                from .models import ProductionOrder, ProductionOrderLine, ProductJourneyCheckpoint
                active_po_lines = ProductionOrderLine.objects.filter(
                    production_order__company_id=request.user.company_id,
                    sku=sku,
                    production_order__po_status__in=[
                        ProductionOrder.STATUS_DRAFT,
                        ProductionOrder.STATUS_CONFIRMED,
                        ProductionOrder.STATUS_IN_PRODUCTION,
                        ProductionOrder.STATUS_PARTIALLY_RECEIVED,
                    ],
                    line_status__in=['pending', 'in_production', 'partially_received'],
                ).select_related('production_order').order_by('production_order__created_at')

                remaining_qty = quantity
                for po_line in active_po_lines:
                    if remaining_qty <= 0:
                        break

                    can_receive = po_line.planned_quantity - po_line.received_quantity
                    if can_receive <= 0:
                        continue

                    apply_qty = min(remaining_qty, can_receive)
                    po_line.received_quantity += apply_qty
                    remaining_qty -= apply_qty

                    if po_line.received_quantity >= po_line.planned_quantity:
                        po_line.line_status = 'completed'
                    else:
                        po_line.line_status = 'partially_received'
                    po_line.save(update_fields=['received_quantity', 'line_status', 'updated_at'])

                    # Update PO status
                    po = po_line.production_order
                    all_lines = po.lines.all()
                    if all(l.line_status == 'completed' for l in all_lines):
                        po.po_status = ProductionOrder.STATUS_COMPLETED
                        po.actual_delivery = timezone.now().date()
                    elif any(l.received_quantity > 0 for l in all_lines):
                        po.po_status = ProductionOrder.STATUS_PARTIALLY_RECEIVED
                    po.save(update_fields=['po_status', 'actual_delivery', 'updated_at'])

                    # Journey checkpoint
                    user_name = request.user.get_full_name() or request.user.username
                    ProductJourneyCheckpoint.objects.create(
                        company_id=request.user.company_id,
                        sku=sku,
                        stage=ProductJourneyCheckpoint.STAGE_RECEIVED,
                        status=ProductJourneyCheckpoint.STATUS_COMPLETED,
                        notes=f"Received {int(apply_qty)} units via scan. PO {po.order_number} updated ({po_line.received_quantity}/{po_line.planned_quantity}).",
                        user_name=user_name,
                        location=location,
                        timestamp=timezone.now(),
                        expected_time=timezone.now(),
                    )
            except Exception as po_err:
                import logging
                logging.getLogger(__name__).warning(f"PO sync on receive failed: {po_err}")

            # Log successful scan
            log = GoodsReceiptScan.objects.create(
                company_id=request.user.company_id,
                barcode_value=barcode_value,
                sku=sku,
                barcode=barcode,
                location=location,
                document=document,
                quantity=quantity,
                batch_number=batch_number,
                serial_number=serial_number,
                result=GoodsReceiptScan.RESULT_MATCHED,
                message=f"Successfully received {quantity} units of {sku.code} at {location.code}.",
                created_by=request.user,
                updated_by=request.user,
            )
            return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            # Log error
            log = GoodsReceiptScan.objects.create(
                company_id=request.user.company_id,
                barcode_value=barcode_value,
                sku=sku,
                barcode=barcode,
                location=location,
                document=document,
                quantity=quantity,
                batch_number=batch_number,
                serial_number=serial_number,
                result=GoodsReceiptScan.RESULT_UNKNOWN,
                message=f"Error creating inventory movement: {str(e)}",
                created_by=request.user,
                updated_by=request.user,
            )
            return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class DamagedItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DamagedItemSerializer
    pagination_class = InventoryPagination

    def get_queryset(self):
        from .serializers import DamagedItemSerializer
        queryset = DamagedItem.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("sku", "location", "scan_log", "recorded_by")
        
        # Filter by damage type
        damage_type = self.request.query_params.get("damage_type")
        if damage_type:
            queryset = queryset.filter(damage_type=damage_type)
        
        # Filter by severity
        severity = self.request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity)
        
        # Filter by SKU
        sku_id = self.request.query_params.get("sku")
        if sku_id:
            queryset = queryset.filter(sku_id=sku_id)
        
        return queryset.order_by("-recorded_at")
    
    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            recorded_by=self.request.user
        )

class DesignerWorkbenchViewSet(viewsets.ViewSet):
    """
    Handles Designer pre-production lifecycle.
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        """List SKUs waiting for designer approval with pagination (Max 50)."""
        try:
            page = int(request.query_params.get('page', 1))
            limit = int(request.query_params.get('limit', 50))
            if limit > 50:
                limit = 50
        except ValueError:
            page = 1
            limit = 50

        offset = (page - 1) * limit
        
        queryset = SKU.objects.filter(
            company_id=request.user.company_id,
            lifecycle_status=SKU.LIFECYCLE_PROTO,
            status='active'
        ).select_related('product').prefetch_related('fabric_source').order_by('-created_at')
        
        total_count = queryset.count()
        skus = queryset[offset:offset+limit]
        
        data = []
        for sku in skus:
            fabric = sku.fabric_source.first()
            photo_url = request.build_absolute_uri(fabric.photo.url) if (fabric and getattr(fabric, 'photo', None)) else None
            data.append({
                "id": str(sku.id),
                "code": sku.code,
                "name": sku.name,
                "product_name": sku.product.name if sku.product else "",
                "lifecycle_status": sku.lifecycle_status,
                "created_at": sku.created_at.isoformat(),
                "fabric_photo_url": photo_url,
            })
        return Response({
            "results": data,
            "count": total_count,
            "page": page,
            "limit": limit
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Transition SKU to 'In Production', log journeys, and optionally auto-create a Production Order."""
        from django.utils import timezone
        import datetime
        from apps.mdm.models import SKU, Fabric
        from .models import ProductJourneyCheckpoint, ProductionOrder, ProductionOrderLine

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found."}, status=status.HTTP_404_NOT_FOUND)

        if sku.lifecycle_status != SKU.LIFECYCLE_PROTO:
            return Response({"error": "SKU is not in Proto/Design phase."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', 'Design approved and moved to production.')
        expected_days = int(request.data.get('expected_days', 14))
        attachment = request.FILES.get('attachment')

        # New: production order fields
        production_quantity = request.data.get('production_quantity')
        destination_id = request.data.get('destination_id')
        unit_cost = request.data.get('unit_cost', 0)

        user_name = request.user.get_full_name() or request.user.username

        with transaction.atomic():
            # 1. Update SKU lifecycle status
            sku.lifecycle_status = SKU.LIFECYCLE_IN_PRODUCTION
            sku.save(update_fields=['lifecycle_status', 'updated_at'])

            # 1.5 Update associated Fabric if exists
            # We use name-based access carefully. RelatedManager works fine here.
            try:
                # Attempt to find if this SKU is the primary SKU for any Fabric rolls
                fabric = Fabric.objects.filter(sku=sku).first()
                if fabric:
                    print(f"[DesignerWorkbench] Found associated fabric for SKU {sku.code}. Updating status.")
                    fabric.approval_status = 'approved'
                    fabric.approved_by = request.user
                    fabric.approval_date = timezone.now()
                    fabric.save() # Save all fields to ensure no hidden logic is missed
            except Exception as e:
                print(f"[DesignerWorkbench] Error updating associated fabric: {str(e)}")
                # We often don't want to fail the whole approval if fabric update fails, 
                # but if it's atomic, it will roll back anyway.

            # 2. Complete the "Design Approved" checkpoint
            ProductJourneyCheckpoint.objects.create(
                company_id=request.user.company_id,
                sku=sku,
                stage=ProductJourneyCheckpoint.STAGE_DESIGN_APPROVED,
                status=ProductJourneyCheckpoint.STATUS_COMPLETED,
                notes=notes,
                user_name=user_name,
                timestamp=timezone.now(),
                expected_time=timezone.now(),
                attachment=attachment
            )

            # 3. Create the future "In Production" checkpoint
            ProductJourneyCheckpoint.objects.create(
                company_id=request.user.company_id,
                sku=sku,
                stage=ProductJourneyCheckpoint.STAGE_IN_PRODUCTION,
                status=ProductJourneyCheckpoint.STATUS_IN_PROGRESS,
                notes='Manufacturing started.',
                user_name=user_name,
                timestamp=timezone.now(),
                expected_time=timezone.now() + datetime.timedelta(days=expected_days)
            )

            # 4. Auto-create Production Order if quantity and destination provided
            po_data = None
            if production_quantity and destination_id:
                try:
                    production_qty = int(production_quantity)
                    cost = float(unit_cost) if unit_cost else 0

                    po = ProductionOrder.objects.create(
                        company_id=request.user.company_id,
                        order_number=_next_po_number(request.user.company_id),
                        order_type=ProductionOrder.TYPE_NEW_PRODUCTION,
                        destination_id=destination_id,
                        order_date=timezone.now().date(),
                        expected_delivery=timezone.now().date() + datetime.timedelta(days=expected_days),
                        triggered_by=ProductionOrder.TRIGGER_DESIGN_APPROVAL,
                        notes=f"Auto-created from design approval of {sku.code}. {notes}",
                        created_by=request.user,
                    )

                    ProductionOrderLine.objects.create(
                        company_id=request.user.company_id,
                        production_order=po,
                        sku=sku,
                        planned_quantity=production_qty,
                        unit_cost=cost,
                    )

                    # Journey checkpoint: production ordered
                    _create_journey_checkpoint(
                        company_id=request.user.company_id,
                        sku=sku,
                        stage=ProductJourneyCheckpoint.STAGE_PRODUCTION_ORDERED,
                        status_val=ProductJourneyCheckpoint.STATUS_COMPLETED,
                        notes=f"Production Order {po.order_number} auto-created from design approval. Planned: {production_qty} units.",
                        user_name=user_name,
                    )

                    po_data = {
                        'order_number': po.order_number,
                        'id': str(po.id),
                        'planned_quantity': production_qty,
                    }
                except (ValueError, Exception) as e:
                    # Don't fail the approval if PO creation fails
                    po_data = {'error': str(e)}

        response_data = {"message": "Successfully sent to production."}
        if po_data:
            response_data['production_order'] = po_data

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a SKU design and maintain record."""
        from django.utils import timezone
        from apps.mdm.models import SKU
        from .models import ProductJourneyCheckpoint

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found."}, status=status.HTTP_404_NOT_FOUND)

        if sku.lifecycle_status != SKU.LIFECYCLE_PROTO:
            return Response({"error": "SKU is not in Proto/Design phase."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', 'Design rejected.')

        with transaction.atomic():
            # Update SKU lifecycle to reflect rejection (could introduce a REJECTED state or make it inactive)
            # We'll set it inactive so it's maintained but out of the working queue
            sku.status = 'inactive'
            sku.save(update_fields=['status', 'updated_at'])

            # Update associated Fabric if exists
            fabric_qs = getattr(sku, 'fabric_source', None)
            if fabric_qs and fabric_qs.exists():
                fabric = fabric_qs.first()
                fabric.approval_status = 'rejected'
                fabric.approved_by = request.user
                fabric.approval_date = timezone.now()
                fabric.rejection_reason = notes
                fabric.save(update_fields=['approval_status', 'approved_by', 'approval_date', 'rejection_reason', 'updated_at'])

            # Log rejection checkpoint
            ProductJourneyCheckpoint.objects.create(
                company_id=request.user.company_id,
                sku=sku,
                stage=ProductJourneyCheckpoint.STAGE_DESIGN_APPROVED,
                status=ProductJourneyCheckpoint.STATUS_DELAYED, # Mark delayed or custom 'rejected' state
                notes=f"REJECTED: {notes}",
                user_name=request.user.get_full_name() or request.user.username,
                timestamp=timezone.now(),
                expected_time=timezone.now()
            )

        return Response({"message": "Design successfully rejected."}, status=status.HTTP_200_OK)

class ProductionKanbanViewSet(viewsets.ViewSet):
    """
    Handles Kanban board data for Production: Fabric Sourced -> Dispatched -> Production -> Shoot -> QC -> Done.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def board(self, request):
        """Fetch all SKUs currently in the production lifecycle and group by their latest checkpoint stage."""
        from django.db.models import Prefetch
        from apps.mdm.models import SKU
        from .models import ProductJourneyCheckpoint

        # Fetch SKUs in_production or newly active (ready/storage)
        skus = SKU.objects.filter(
            company_id=request.user.company_id,
            lifecycle_status__in=[SKU.LIFECYCLE_IN_PRODUCTION, SKU.LIFECYCLE_ACTIVE],
            status='active'
        ).prefetch_related(
            Prefetch(
                'journey_checkpoints',
                queryset=ProductJourneyCheckpoint.objects.select_related('location').order_by('-timestamp', '-created_at'),
                to_attr='latest_checkpoints'
            )
        )

        columns = {
            'in_production': [],
            'shoot': [],
            'received': [],
            'quality_check': [],
            'ready': [],
        }

        for sku in skus:
            checkpoints = getattr(sku, 'latest_checkpoints', [])
            latest_stage = checkpoints[0].stage if checkpoints else None
            if not latest_stage:
                # If no checkpoints or stage but it's in production, assume it just started
                latest_stage = 'in_production'

            latest_cp = checkpoints[0] if checkpoints else None

            # Map to kanban columns
            mapped_stage = latest_stage
            if mapped_stage == 'storage':
                mapped_stage = 'ready'
            elif mapped_stage in ['picked', 'packed', 'dispatched', 'in_transit', 'delivered']:
                continue  # Already beyond production
            elif mapped_stage not in columns:
                if sku.lifecycle_status == SKU.LIFECYCLE_IN_PRODUCTION:
                    mapped_stage = 'in_production'
                else:
                    continue  # Ignore completed or unrelated stages

            item_data = {
                "id": str(sku.id),
                "code": sku.code,
                "name": sku.name,
                "latest_stage": latest_stage,
                "location_name": latest_cp.location.name if latest_cp and latest_cp.location else None,
                "measurement_value": str(latest_cp.measurement_value) if latest_cp and latest_cp.measurement_value else None,
                "measurement_unit": latest_cp.measurement_unit if latest_cp else None,
                "notes": latest_cp.notes if latest_cp else None,
                "user_name": latest_cp.user_name if latest_cp else None,
                "timestamp": latest_cp.timestamp.isoformat() if latest_cp and latest_cp.timestamp else None,
                "attachment_url": request.build_absolute_uri(latest_cp.attachment.url) if latest_cp and latest_cp.attachment else None,
            }
            if mapped_stage in columns:
                columns[mapped_stage].append(item_data)
            else:
                if sku.lifecycle_status == SKU.LIFECYCLE_IN_PRODUCTION and latest_stage not in columns:
                    columns['in_production'].append(item_data)

        return Response(columns)

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        """Move a SKU to a new Kanban stage, taking optional measurements/attachments/location."""
        from django.utils import timezone
        from apps.mdm.models import SKU, Location
        from .models import ProductJourneyCheckpoint

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found"}, status=404)

        new_stage = request.data.get('stage')
        if not new_stage:
            return Response({"error": "stage is required"}, status=400)

        notes = request.data.get('notes', f'Moved to {new_stage}')
        measurement_value = request.data.get('measurement_value')
        measurement_unit = request.data.get('measurement_unit', 'Meters' if measurement_value else None)
        attachment = request.FILES.get('attachment')
        location_id = request.data.get('location_id')

        # Validate location if provided
        location = None
        if location_id:
            try:
                location = Location.objects.get(id=location_id)
            except Location.DoesNotExist:
                return Response({"error": "Location not found"}, status=400)

        with transaction.atomic():
            # Update lifecycle status
            if new_stage in ['in_production', 'shoot']:
                sku.lifecycle_status = SKU.LIFECYCLE_IN_PRODUCTION
                sku.save(update_fields=['lifecycle_status'])
            elif new_stage in ['received', 'quality_check', 'storage', 'ready']:
                # Mark as active once goods are received
                if new_stage in ['storage', 'ready']:
                    sku.lifecycle_status = SKU.LIFECYCLE_ACTIVE
                    sku.save(update_fields=['lifecycle_status'])

            # Complete previous "in_progress" checkpoints
            ProductJourneyCheckpoint.objects.filter(
                sku=sku, status=ProductJourneyCheckpoint.STATUS_IN_PROGRESS
            ).update(
                status=ProductJourneyCheckpoint.STATUS_COMPLETED,
                timestamp=timezone.now()
            )

            # Create new checkpoint for the new stage
            ProductJourneyCheckpoint.objects.create(
                company_id=request.user.company_id,
                sku=sku,
                stage=new_stage,
                status=ProductJourneyCheckpoint.STATUS_IN_PROGRESS,
                notes=notes,
                user_name=request.user.get_full_name() or request.user.username,
                timestamp=timezone.now(),
                expected_time=timezone.now(),
                measurement_value=measurement_value,
                measurement_unit=measurement_unit,
                attachment=attachment,
                location=location,
            )

        return Response({"message": f"Successfully moved to {new_stage}."})

    @action(detail=False, methods=['get'])
    def locations(self, request):
        """Return available factory/unit locations for dispatch dropdown."""
        from apps.mdm.models import Location
        locs = Location.objects.filter(
            company_id=request.user.company_id,
            status='active',
            is_inventory_location=True
        ).values('id', 'code', 'name', 'location_type')
        return Response(list(locs))


class ProductJourneyViewSet(viewsets.ViewSet):
    """
    API for the Product Journey page — search SKUs and view their full checkpoint timeline.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Search for a SKU by code, name, or barcode value.
        Returns the SKU info + full checkpoint timeline.
        """
        from apps.mdm.models import SKU, SKUBarcode
        from .models import ProductJourneyCheckpoint
        from .serializers import ProductJourneyCheckpointSerializer

        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"error": "Search query 'q' is required."}, status=400)

        company_id = request.user.company_id

        # Try to find SKU by code, name, or barcode
        sku = None
        # 1. Exact code match
        sku = SKU.objects.filter(company_id=company_id, code__iexact=query, status='active').first()
        # 2. Barcode match
        if not sku:
            barcode = SKUBarcode.objects.filter(
                company_id=company_id, barcode_value=query, status='active'
            ).select_related('sku').first()
            if barcode:
                sku = barcode.sku
        # 3. Name contains
        if not sku:
            sku = SKU.objects.filter(
                company_id=company_id, name__icontains=query, status='active'
            ).first()
        # 4. Partial code match
        if not sku:
            sku = SKU.objects.filter(
                company_id=company_id, code__icontains=query, status='active'
            ).first()

        if not sku:
            return Response({"error": "No SKU found matching your search."}, status=404)

        # Get all checkpoints for this SKU
        checkpoints = ProductJourneyCheckpoint.objects.filter(
            sku=sku
        ).select_related('location').order_by('created_at')

        serializer = ProductJourneyCheckpointSerializer(
            checkpoints, many=True, context={'request': request}
        )

        # Determine overall status
        current_stage = 'fabric_sourced'
        current_status = 'pending'
        current_location = None
        if checkpoints.exists():
            latest = checkpoints.order_by('-timestamp', '-created_at').first()
            current_stage = latest.stage
            current_status = latest.status
            current_location = latest.location.name if latest.location else None

        # Get barcode value
        barcode_obj = SKUBarcode.objects.filter(sku=sku, status='active').first()

        return Response({
            'sku': str(sku.id),
            'sku_code': sku.code,
            'product_name': sku.product.name if sku.product else sku.name,
            'sku_name': sku.name,
            'barcode': barcode_obj.barcode_value if barcode_obj else '',
            'lifecycle_status': sku.lifecycle_status,
            'current_stage': current_stage,
            'current_status': current_status,
            'current_location': current_location or '',
            'checkpoints': serializer.data,
        })

    @action(detail=True, methods=['get'])
    def checkpoints(self, request, pk=None):
        """Get all checkpoints for a specific SKU."""
        from apps.mdm.models import SKU
        from .models import ProductJourneyCheckpoint
        from .serializers import ProductJourneyCheckpointSerializer

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found"}, status=404)

        checkpoints = ProductJourneyCheckpoint.objects.filter(
            sku=sku
        ).select_related('location').order_by('created_at')

        serializer = ProductJourneyCheckpointSerializer(
            checkpoints, many=True, context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_checkpoint(self, request, pk=None):
        """Manually add a checkpoint to a SKU's journey."""
        from django.utils import timezone as tz
        from apps.mdm.models import SKU, Location
        from .models import ProductJourneyCheckpoint

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found"}, status=404)

        stage = request.data.get('stage')
        checkpoint_status = request.data.get('status', 'in_progress')
        notes = request.data.get('notes', '')
        location_id = request.data.get('location_id')
        measurement_value = request.data.get('measurement_value')
        measurement_unit = request.data.get('measurement_unit')
        attachment = request.FILES.get('attachment')

        location = None
        if location_id:
            try:
                location = Location.objects.get(id=location_id)
            except Location.DoesNotExist:
                return Response({"error": "Location not found"}, status=400)

        if not stage:
            return Response({"error": "stage is required"}, status=400)

        checkpoint = ProductJourneyCheckpoint.objects.create(
            company_id=request.user.company_id,
            sku=sku,
            stage=stage,
            status=checkpoint_status,
            notes=notes,
            user_name=request.user.get_full_name() or request.user.username,
            timestamp=tz.now(),
            expected_time=tz.now(),
            location=location,
            measurement_value=measurement_value,
            measurement_unit=measurement_unit,
            attachment=attachment,
        )

        from .serializers import ProductJourneyCheckpointSerializer
        serializer = ProductJourneyCheckpointSerializer(
            checkpoint, context={'request': request}
        )
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def photos(self, request, pk=None):
        """Get all photos/attachments for a SKU's journey checkpoints."""
        from apps.mdm.models import SKU
        from .models import ProductJourneyCheckpoint

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found"}, status=404)

        checkpoints = ProductJourneyCheckpoint.objects.filter(
            sku=sku,
            attachment__isnull=False,
        ).exclude(attachment='').select_related('location').order_by('-created_at')

        photos = []
        for cp in checkpoints:
            photos.append({
                'id': str(cp.id),
                'stage': cp.stage,
                'user_name': cp.user_name,
                'timestamp': cp.timestamp.isoformat() if cp.timestamp else None,
                'notes': cp.notes,
                'location_name': cp.location.name if cp.location else None,
                'attachment_url': request.build_absolute_uri(cp.attachment.url),
                'measurement_value': str(cp.measurement_value) if cp.measurement_value else None,
                'measurement_unit': cp.measurement_unit,
            })

        return Response({
            'sku_code': sku.code,
            'sku_name': sku.name,
            'total_photos': len(photos),
            'photos': photos,
        })


class DailyStockReportViewSet(viewsets.ViewSet):
    """
    Opening/Closing Stock & Daily Sales Reports.
    Designed for 5000+ SKU scale with pagination & filters.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='stock-report')
    def stock_report(self, request):
        """
        Opening/Closing stock report for a given date and location.
        Query params: date (YYYY-MM-DD), location (id), page, page_size
        """
        from .models import DailyStockSnapshot
        from datetime import date as date_type

        target_date = request.query_params.get('date', str(timezone.now().date()))
        location_id = request.query_params.get('location')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))

        snapshots = DailyStockSnapshot.objects.filter(
            company_id=request.user.company_id,
            snapshot_date=target_date,
        ).select_related('sku', 'sku__product', 'location')

        if location_id:
            snapshots = snapshots.filter(location_id=location_id)

        total = snapshots.count()
        offset = (page - 1) * page_size
        items = snapshots[offset:offset + page_size]

        results = []
        for s in items:
            results.append({
                'sku_id': str(s.sku_id),
                'sku_code': s.sku.code,
                'sku_name': s.sku.name,
                'product_name': s.sku.product.name if s.sku.product else '',
                'location_id': str(s.location_id),
                'location_code': s.location.code,
                'location_name': s.location.name,
                'opening_stock': float(s.opening_stock),
                'closing_stock': float(s.closing_stock),
                'units_sold': float(s.units_sold),
                'units_received': float(s.units_received),
                'units_transferred_in': float(s.units_transferred_in),
                'units_transferred_out': float(s.units_transferred_out),
                'units_adjusted': float(s.units_adjusted),
                'difference': float(s.closing_stock - s.opening_stock),
            })

        return Response({
            'date': target_date,
            'total': total,
            'page': page,
            'page_size': page_size,
            'results': results,
        })

    @action(detail=False, methods=['get'], url_path='stock-summary')
    def stock_summary(self, request):
        """
        Aggregate stock summary for a date — total opening, closing, sold across all locations.
        """
        from .models import DailyStockSnapshot

        target_date = request.query_params.get('date', str(timezone.now().date()))
        location_id = request.query_params.get('location')

        qs = DailyStockSnapshot.objects.filter(
            company_id=request.user.company_id,
            snapshot_date=target_date,
        )
        if location_id:
            qs = qs.filter(location_id=location_id)

        summary = qs.aggregate(
            total_opening=Sum('opening_stock'),
            total_closing=Sum('closing_stock'),
            total_sold=Sum('units_sold'),
            total_received=Sum('units_received'),
            total_transferred_in=Sum('units_transferred_in'),
            total_transferred_out=Sum('units_transferred_out'),
            total_adjusted=Sum('units_adjusted'),
        )

        return Response({
            'date': target_date,
            'total_skus': qs.count(),
            'total_opening': float(summary['total_opening'] or 0),
            'total_closing': float(summary['total_closing'] or 0),
            'total_sold': float(summary['total_sold'] or 0),
            'total_received': float(summary['total_received'] or 0),
            'total_transferred_in': float(summary['total_transferred_in'] or 0),
            'total_transferred_out': float(summary['total_transferred_out'] or 0),
            'total_adjusted': float(summary['total_adjusted'] or 0),
        })

    @action(detail=False, methods=['post'], url_path='take-snapshot')
    def take_snapshot(self, request):
        """
        Manually trigger a stock snapshot for today (or a given date).
        """
        from django.core.management import call_command
        target_date = request.data.get('date', str(timezone.now().date()))
        try:
            call_command('snapshot_daily_stock', date=target_date)
            return Response({'message': f'Snapshot taken for {target_date}'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='daily-sales-report')
    def daily_sales_report(self, request):
        """
        Comprehensive daily sales report with top products, payment breakdown, discount totals.
        Query params: date (YYYY-MM-DD), store (location_id)
        """
        from apps.sales.models import SalesTransaction, SalesTransactionLine
        from apps.integrations.shopify_models import ShopifyOrder, ShopifyStore
        from apps.integrations.shopify_service import ShopifyService
        from django.db.models.functions import TruncDate

        target_date = request.query_params.get('date', str(timezone.now().date()))
        store_id = request.query_params.get('store')
        do_sync = request.query_params.get('sync') == 'true'

        if do_sync:
            stores = ShopifyStore.objects.filter(company_id=request.user.company_id, status='active')
            for store in stores:
                try:
                    ShopifyService.sync_orders(store, start_date=target_date, end_date=target_date)
                except Exception:
                    pass

        txn_qs = SalesTransaction.objects.filter(
            company_id=request.user.company_id,
            transaction_date__date=target_date,
            status='active',
        )
        if store_id:
            txn_qs = txn_qs.filter(store_id=store_id)

        # Overview from POS
        overview = txn_qs.aggregate(
            total_revenue=Sum('total_amount'),
            total_transactions=Count('id'),
            total_items=Sum('item_count'),
            total_discount=Sum('discount_amount'),
            avg_transaction=Avg('total_amount'),
        )

        # Payment breakdown
        payment_breakdown = list(txn_qs.values('payment_method').annotate(
            count=Count('id'),
            total=Sum('total_amount'),
        ).order_by('-total'))

        # Channel breakdown
        channel_breakdown = list(txn_qs.values('sales_channel').annotate(
            count=Count('id'),
            total=Sum('total_amount'),
        ).order_by('-total'))

        # Shopify Add-ons (if no specific store selected or SHOPIFY-WH mapped)
        if not store_id:
            shopify_qs = ShopifyOrder.objects.filter(
                store__company_id=request.user.company_id,
                processed_at__date=target_date
            )
            shopify_stats = shopify_qs.aggregate(
                total_rev=Sum('total_price'),
                orders=Count('id')
            )
            
            online_rev = float(shopify_stats['total_rev'] or 0)
            online_count = shopify_stats['orders'] or 0
            
            if online_rev > 0:
                # Update Overview
                overview['total_revenue'] = float(overview['total_revenue'] or 0) + online_rev
                overview['total_transactions'] = (overview['total_transactions'] or 0) + online_count
                
                # Update channel breakdown
                found = False
                for c in channel_breakdown:
                    if c['sales_channel'] == 'online':
                        c['total'] = float(c['total'] or 0) + online_rev
                        c['count'] += online_count
                        found = True
                        break
                if not found:
                    channel_breakdown.append({
                        'sales_channel': 'online',
                        'count': online_count,
                        'total': online_rev
                    })

        # Top 10 products sold (POS only for now, merging Shopify SKUs is expensive here)
        line_qs = SalesTransactionLine.objects.filter(
            transaction__in=txn_qs,
        ).values(
            'sku__code', 'sku__name'
        ).annotate(
            qty_sold=Sum('quantity'),
            revenue=Sum('line_total'),
            discount_given=Sum('discount_amount'),
        ).order_by('-revenue')[:10]

        # Customer type breakdown
        customer_breakdown = list(txn_qs.values('customer_type').annotate(
            count=Count('id'),
            total=Sum('total_amount'),
        ).order_by('-total'))

        return Response({
            'date': target_date,
            'overview': {
                'total_revenue': float(overview['total_revenue'] or 0),
                'total_transactions': overview['total_transactions'] or 0,
                'total_items': overview['total_items'] or 0,
                'total_discount': float(overview['total_discount'] or 0),
                'avg_transaction': float(overview['avg_transaction'] or 0),
            },
            'payment_breakdown': payment_breakdown,
            'channel_breakdown': channel_breakdown,
            'top_products': list(line_qs),
            'customer_breakdown': customer_breakdown,
        })

    @action(detail=False, methods=['get'], url_path='weekly-stock-velocity')
    def weekly_stock_velocity(self, request):
        """
        Weekly Fast/Slow/Dead Stock Report.
        Query params: period (7/14/30, default 7), location (id)
        Returns categorised SKU list with days-of-stock and velocity.
        """
        from apps.sales.models import SalesTransactionLine
        from datetime import timedelta

        period = int(request.query_params.get('period', 7))
        location_id = request.query_params.get('location')

        cutoff = timezone.now() - timedelta(days=period)

        # Current balances
        balance_qs = InventoryBalance.objects.filter(
            company_id=request.user.company_id,
            status='active',
        )
        if location_id:
            balance_qs = balance_qs.filter(location_id=location_id)

        balances = balance_qs.values(
            'sku__id', 'sku__code', 'sku__name', 'sku__product__name'
        ).annotate(
            total_stock=Sum('quantity_on_hand'),
            total_value=Sum('quantity_on_hand') * Avg('average_cost'),
        )

        # Sales in the period
        sale_filter = {
            'sku__company_id': request.user.company_id,
            'transaction__transaction_date__gte': cutoff,
            'transaction__status': 'active',
        }
        if location_id:
            sale_filter['transaction__store_id'] = location_id

        sales = SalesTransactionLine.objects.filter(
            **sale_filter
        ).values('sku__id').annotate(
            sold=Sum('quantity'),
            revenue=Sum('line_total'),
            cost=Sum('unit_cost'),
        )
        sales_dict = {s['sku__id']: s for s in sales}

        # If no location filtered, add Shopify online sales to give a complete picture
        if not location_id:
            from apps.integrations.models import ShopifyOrder
            shopify_orders = ShopifyOrder.objects.filter(
                processed_at__gte=cutoff
            ).values_list('shopify_data', flat=True)
            
            # Create a lookup map for SKU code -> SKU ID based on what we have in balances
            sku_lookup = {bal['sku__code']: bal['sku__id'] for bal in balances if bal.get('sku__code')}
            
            for shopify_data in shopify_orders:
                if not shopify_data or 'line_items' not in shopify_data:
                    continue
                for item in shopify_data['line_items']:
                    code = item.get('sku')
                    if not code or code not in sku_lookup:
                        continue
                    sid = sku_lookup[code]
                    
                    if sid not in sales_dict:
                        sales_dict[sid] = {'sku__id': sid, 'sold': 0, 'revenue': 0, 'cost': 0}
                    
                    qty_sold = int(item.get('quantity', 0))
                    price = float(item.get('price', 0))
                    sales_dict[sid]['sold'] += qty_sold
                    sales_dict[sid]['revenue'] += (qty_sold * price)

        fast, slow, dead = [], [], []
        fast_threshold = max(5, period // 2)
        slow_threshold = 0

        for bal in balances:
            sku_id = bal['sku__id']
            stock = float(bal['total_stock'] or 0)
            sold_data = sales_dict.get(sku_id, {})
            sold = float(sold_data.get('sold', 0))
            revenue = float(sold_data.get('revenue', 0))

            daily_rate = sold / period if period > 0 else 0
            
            # Prevent negative stock from creating negative days_of_stock or negative locked capital
            is_negative_stock = stock < 0
            calc_stock = max(0, stock)
            days_of_stock = calc_stock / daily_rate if daily_rate > 0 else 999

            item = {
                'sku_id': str(sku_id),
                'sku_code': bal['sku__code'],
                'sku_name': bal['sku__name'],
                'product_name': bal['sku__product__name'] or '',
                'current_stock': stock,
                'sold_in_period': sold,
                'revenue': revenue,
                'daily_rate': round(daily_rate, 2),
                'days_of_stock': round(days_of_stock, 1) if days_of_stock < 999 else None,
                'stock_value': float(bal['total_value'] or 0) if not is_negative_stock else 0,
            }

            if sold >= fast_threshold:
                fast.append(item)
            elif sold > slow_threshold:
                slow.append(item)
            else:
                dead.append(item)

        fast.sort(key=lambda x: x['sold_in_period'], reverse=True)
        slow.sort(key=lambda x: x['sold_in_period'], reverse=True)
        dead.sort(key=lambda x: x['current_stock'], reverse=True)

        return Response({
            'period_days': period,
            'fast_threshold': fast_threshold,
            'summary': {
                'fast_count': len(fast),
                'slow_count': len(slow),
                'dead_count': len(dead),
                'total_skus': len(fast) + len(slow) + len(dead),
                'dead_stock_value': sum(i['stock_value'] for i in dead),
            },
            'fast_moving': fast[:50],
            'slow_moving': slow[:50],
            'dead_stock': dead[:50],
        })

    @action(detail=False, methods=['get'], url_path='monthly-turnover-margin')
    def monthly_turnover_margin(self, request):
        """
        Monthly Stock Turnover & Margin Analysis.
        Query params: month (YYYY-MM), location (id)
        Returns per-SKU and aggregate turnover ratio, margin %, COGS, revenue.
        """
        try:
            return self._monthly_turnover_margin_inner(request)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Monthly margin report error: {e}")
            month_str = request.query_params.get('month', '')
            return Response({
                'month': month_str,
                'overview': {
                    'total_revenue': 0, 'total_cogs': 0, 'gross_profit': 0,
                    'overall_margin_pct': 0, 'total_discount': 0, 'total_skus_sold': 0,
                },
                'by_category': [],
                'by_sku': [],
            })

    def _monthly_turnover_margin_inner(self, request):
        """Core logic for monthly turnover margin."""
        from apps.sales.models import SalesTransactionLine, SalesTransaction
        from apps.documents.models import DocumentLine
        from datetime import date
        import calendar

        month_str = request.query_params.get('month')
        location_id = request.query_params.get('location')

        if month_str:
            year, month = [int(x) for x in month_str.split('-')]
        else:
            today = timezone.now().date()
            year, month = today.year, today.month

        _, last_day = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

        # Sales lines in this month (Unified: POS + Shopify)
        
        # 1. POS Lines
        sale_filter = {
            'transaction__company_id': request.user.company_id,
            'transaction__transaction_date__date__gte': start_date,
            'transaction__transaction_date__date__lte': end_date,
            'transaction__status': 'active',
        }
        if location_id:
            sale_filter['transaction__store_id'] = location_id

        lines_qs = SalesTransactionLine.objects.filter(**sale_filter).values(
            'sku__id', 'sku__code', 'sku__name', 'sku__product__name'
        ).annotate(
            qty_sold=Sum('quantity'),
            revenue=Sum('line_total'),
            cogs=Sum(models.F('quantity') * models.F('unit_cost')),
            total_discount=Sum('discount_amount'),
        )
        
        # 2. Document Lines (Shopify/Sales orders)
        doc_filter = {
            'document__company_id': request.user.company_id,
            'document__document_date__gte': start_date,
            'document__document_date__lte': end_date,
            'document__document_type__code': 'sales_order',
            'status': 'active',
        }
        if location_id:
            doc_filter['document__from_location_id'] = location_id
            
        doc_lines = DocumentLine.objects.filter(**doc_filter).values(
            'sku__id', 'sku__code', 'sku__name', 'sku__product__name'
        ).annotate(
            qty_sold=Sum('quantity'),
            revenue=Sum('line_amount'),
            # COGS from average cost if unit_cost not in DocumentLine
            cogs=Sum(models.F('quantity') * models.F('sku__cost_price'), output_field=models.DecimalField()),
            total_discount=models.Value(0, output_field=models.DecimalField()),
        )
        
        # Merge lines (convert QuerySet to dict by SKU)
        merged_lines = {}
        for l in lines_qs:
            sku_id = l['sku__id']
            merged_lines[sku_id] = {
                'sku__id': sku_id,
                'sku__code': l['sku__code'],
                'sku__name': l['sku__name'],
                'sku__product__name': l['sku__product__name'],
                'qty_sold': float(l['qty_sold'] or 0),
                'revenue': float(l['revenue'] or 0),
                'cogs': float(l['cogs'] or 0),
                'total_discount': float(l['total_discount'] or 0),
            }
            
        for l in doc_lines:
            sku_id = l['sku__id']
            if sku_id in merged_lines:
                merged_lines[sku_id]['qty_sold'] += float(l['qty_sold'] or 0)
                merged_lines[sku_id]['revenue'] += float(l['revenue'] or 0)
                merged_lines[sku_id]['cogs'] += float(l['cogs'] or 0)
            else:
                merged_lines[sku_id] = {
                    'sku__id': sku_id,
                    'sku__code': l['sku__code'],
                    'sku__name': l['sku__name'],
                    'sku__product__name': l['sku__product__name'],
                    'qty_sold': float(l['qty_sold'] or 0),
                    'revenue': float(l['revenue'] or 0),
                    'cogs': float(l['cogs'] or 0),
                    'total_discount': 0,
                }
        
        lines = sorted(list(merged_lines.values()), key=lambda x: x['revenue'], reverse=True)

        # Average inventory for turnover
        balance_filter = {
            'company_id': request.user.company_id,
            'status': 'active',
        }
        if location_id:
            balance_filter['location_id'] = location_id

        avg_inventory = InventoryBalance.objects.filter(
            **balance_filter
        ).values('sku__id').annotate(
            avg_stock=Avg('quantity_on_hand'),
            avg_cost=Avg('average_cost'),
        )
        inv_dict = {i['sku__id']: i for i in avg_inventory}

        results = []
        total_revenue = Decimal('0')
        total_cogs = Decimal('0')
        total_discount = Decimal('0')

        for line in lines:
            sku_id = line['sku__id']
            revenue = Decimal(str(line['revenue'] or 0))
            cogs = Decimal(str(line['cogs'] or 0))
            discount = Decimal(str(line['total_discount'] or 0))
            gross_profit = revenue - cogs
            margin_pct = float((gross_profit / revenue * 100)) if revenue > 0 else 0

            inv = inv_dict.get(sku_id, {})
            avg_stock = float(inv.get('avg_stock', 0) or 0)
            avg_cost_per_unit = float(inv.get('avg_cost', 0) or 0)
            avg_inv_value = avg_stock * avg_cost_per_unit
            turnover = float(cogs / Decimal(str(avg_inv_value))) if avg_inv_value > 0 else 0

            total_revenue += revenue
            total_cogs += cogs
            total_discount += discount

            results.append({
                'sku_id': str(sku_id),
                'sku_code': line['sku__code'],
                'sku_name': line['sku__name'],
                'product_name': line['sku__product__name'] or '',
                'category': line['sku__product__name'] or 'Uncategorized',
                'qty_sold': float(line['qty_sold'] or 0),
                'revenue': float(revenue),
                'cogs': float(cogs),
                'gross_profit': float(gross_profit),
                'margin_pct': round(margin_pct, 1),
                'discount_given': float(discount),
                'avg_inventory': round(avg_stock, 1),
                'turnover_ratio': round(turnover, 2),
            })

        # Category-level aggregation
        category_map = {}
        for r in results:
            cat = r['category']
            if cat not in category_map:
                category_map[cat] = {'category': cat, 'revenue': 0, 'cogs': 0, 'items': 0}
            category_map[cat]['revenue'] += r['revenue']
            category_map[cat]['cogs'] += r['cogs']
            category_map[cat]['items'] += 1
        categories = []
        for c in category_map.values():
            gp = c['revenue'] - c['cogs']
            c['gross_profit'] = gp
            c['margin_pct'] = round((gp / c['revenue'] * 100), 1) if c['revenue'] > 0 else 0
            categories.append(c)
        categories.sort(key=lambda x: x['revenue'], reverse=True)

        overall_profit = total_revenue - total_cogs
        overall_margin = float((overall_profit / total_revenue * 100)) if total_revenue > 0 else 0

        return Response({
            'month': f'{year}-{month:02d}',
            'overview': {
                'total_revenue': float(total_revenue),
                'total_cogs': float(total_cogs),
                'gross_profit': float(overall_profit),
                'overall_margin_pct': round(overall_margin, 1),
                'total_discount': float(total_discount),
                'total_skus_sold': len(results),
            },
            'by_category': categories,
            'by_sku': results[:100],
        })

    @action(detail=False, methods=['get'], url_path='channel-comparison')
    def channel_comparison(self, request):
        """
        Store vs Shopify/Online sales comparison with flexible date range.
        Query params: start_date, end_date (YYYY-MM-DD), defaults to last 30 days
        """
        from apps.sales.models import SalesTransaction
        from django.db.models.functions import TruncDate
        from datetime import timedelta, date as date_type

        end_date_str = request.query_params.get('end_date')
        start_date_str = request.query_params.get('start_date')

        if end_date_str:
            end_date = date_type.fromisoformat(end_date_str)
        else:
            end_date = timezone.now().date()

        if start_date_str:
            start_date = date_type.fromisoformat(start_date_str)
        else:
            start_date = end_date - timedelta(days=30)

        txns = SalesTransaction.objects.filter(
            company_id=request.user.company_id,
            transaction_date__date__gte=start_date,
            transaction_date__date__lte=end_date,
            status='active',
        )

        daily = txns.annotate(
            date=TruncDate('transaction_date')
        ).values('date', 'sales_channel').annotate(
            revenue=Sum('total_amount'),
            orders=Count('id'),
            items=Sum('item_count'),
        ).order_by('date')

        # Build daily map
        day_count = (end_date - start_date).days + 1
        date_map = {}
        for d in range(day_count):
            ds = (start_date + timedelta(days=d)).strftime('%Y-%m-%d')
            date_map[ds] = {'date': ds, 'store_revenue': 0, 'store_orders': 0,
                           'online_revenue': 0, 'online_orders': 0}

        for row in daily:
            if not row['date']:
                continue
            ds = row['date'].strftime('%Y-%m-%d')
            if ds not in date_map:
                continue
            channel = row['sales_channel']
            if channel == 'store':
                date_map[ds]['store_revenue'] += float(row['revenue'] or 0)
                date_map[ds]['store_orders'] += row['orders'] or 0
            else:
                date_map[ds]['online_revenue'] += float(row['revenue'] or 0)
                date_map[ds]['online_orders'] += row['orders'] or 0

        # Shopify Orders (Unified accuracy)
        from apps.integrations.shopify_models import ShopifyOrder, ShopifyStore
        from apps.integrations.shopify_service import ShopifyService

        # If 'sync' param is provided, trigger a direct pull from Shopify for this range
        do_sync = request.query_params.get('sync') == 'true'
        if do_sync:
            stores = ShopifyStore.objects.filter(company_id=request.user.company_id, status='active')
            for store in stores:
                try:
                    # Synchronous sync for the report range
                    ShopifyService.sync_orders(store, start_date=start_date.isoformat(), end_date=end_date.isoformat())
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Live sync failed during report: {e}")

        shopify_sales = ShopifyOrder.objects.filter(
            store__company_id=request.user.company_id,
            processed_at__date__gte=start_date,
            processed_at__date__lte=end_date
        ).annotate(
            date=TruncDate('processed_at')
        ).values('date').annotate(
            revenue=Sum('total_price'),
            orders=Count('id')
        )
        
        for row in shopify_sales:
            if not row['date']:
                continue
            ds = row['date'].strftime('%Y-%m-%d')
            if ds in date_map:
                date_map[ds]['online_revenue'] += float(row['revenue'] or 0)
                date_map[ds]['online_orders'] += row['orders'] or 0

        daily_data = sorted(date_map.values(), key=lambda x: x['date'])

        # Totals
        total_store_rev = sum(d['store_revenue'] for d in daily_data)
        total_online_rev = sum(d['online_revenue'] for d in daily_data)
        total_store_orders = sum(d['store_orders'] for d in daily_data)
        total_online_orders = sum(d['online_orders'] for d in daily_data)
        grand_total = total_store_rev + total_online_rev

        return Response({
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'totals': {
                'store_revenue': total_store_rev,
                'online_revenue': total_online_rev,
                'store_orders': total_store_orders,
                'online_orders': total_online_orders,
                'grand_total': grand_total,
                'store_pct': round(total_store_rev / grand_total * 100, 1) if grand_total > 0 else 0,
                'online_pct': round(total_online_rev / grand_total * 100, 1) if grand_total > 0 else 0,
            },
            'daily': daily_data,
        })


# ─────────────────────────────────────────────────────────
# Production Orders
# ─────────────────────────────────────────────────────────

from .models import ProductionOrder, ProductionOrderLine, ProductJourneyCheckpoint
from .serializers import (
    ProductionOrderSerializer,
    ProductionOrderCreateSerializer,
    ProductionOrderLineSerializer,
)


def _next_po_number(company_id):
    """Generate next sequential PO number: PO-2026-0001."""
    import re
    from datetime import date
    year = date.today().year
    prefix = f"PO-{year}-"
    existing = ProductionOrder.objects.filter(
        company_id=company_id,
        order_number__startswith=prefix
    ).values_list('order_number', flat=True)
    max_seq = 0
    for num in existing:
        match = re.search(r'PO-\d{4}-(\d+)', num)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    return f"{prefix}{max_seq + 1:04d}"


def _create_journey_checkpoint(company_id, sku, stage, status_val, notes='', user_name='', location=None):
    """Helper to create a Product Journey checkpoint."""
    ProductJourneyCheckpoint.objects.create(
        company_id=company_id,
        sku=sku,
        stage=stage,
        status=status_val,
        location=location,
        timestamp=timezone.now(),
        notes=notes,
        user_name=user_name,
    )


class ProductionOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProductionOrderSerializer
    pagination_class = InventoryPagination

    def get_queryset(self):
        qs = ProductionOrder.objects.filter(
            company_id=self.request.user.company_id,
        ).select_related('factory', 'destination').prefetch_related('lines__sku__product')

        po_status = self.request.query_params.get('po_status')
        if po_status:
            qs = qs.filter(po_status=po_status)

        order_type = self.request.query_params.get('order_type')
        if order_type:
            qs = qs.filter(order_type=order_type)

        return qs.order_by('-order_date')

    def create(self, request, *args, **kwargs):
        """Create a Production Order with lines in one request."""
        serializer = ProductionOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_name = request.user.get_full_name() or request.user.username

        with transaction.atomic():
            po = ProductionOrder.objects.create(
                company_id=request.user.company_id,
                order_number=_next_po_number(request.user.company_id),
                order_type=data['order_type'],
                factory_id=data.get('factory'),
                destination_id=data['destination'],
                order_date=data['order_date'],
                expected_delivery=data.get('expected_delivery'),
                triggered_by=data.get('triggered_by', 'manual'),
                notes=data.get('notes', ''),
                created_by=request.user,
            )

            for line_data in data['lines']:
                sku = SKU.objects.get(id=line_data['sku'])
                ProductionOrderLine.objects.create(
                    company_id=request.user.company_id,
                    production_order=po,
                    sku=sku,
                    planned_quantity=line_data['planned_quantity'],
                    unit_cost=line_data.get('unit_cost', 0),
                    notes=line_data.get('notes', ''),
                )

                # Product Journey: production ordered
                _create_journey_checkpoint(
                    company_id=request.user.company_id,
                    sku=sku,
                    stage=ProductJourneyCheckpoint.STAGE_PRODUCTION_ORDERED,
                    status_val=ProductJourneyCheckpoint.STATUS_COMPLETED,
                    notes=f"Production Order {po.order_number} created. Planned: {line_data['planned_quantity']} units.",
                    user_name=user_name,
                    location=po.destination,
                )

        result = ProductionOrderSerializer(po, context={'request': request}).data
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Move PO from draft → confirmed."""
        po = self.get_object()
        if po.po_status != ProductionOrder.STATUS_DRAFT:
            return Response({'error': 'Only draft orders can be confirmed.'}, status=400)

        user_name = request.user.get_full_name() or request.user.username
        po.po_status = ProductionOrder.STATUS_CONFIRMED
        po.save(update_fields=['po_status', 'updated_at'])

        for line in po.lines.select_related('sku'):
            line.line_status = ProductionOrderLine.LINE_PENDING
            line.save(update_fields=['line_status', 'updated_at'])

            _create_journey_checkpoint(
                company_id=po.company_id,
                sku=line.sku,
                stage=ProductJourneyCheckpoint.STAGE_PRODUCTION_CONFIRMED,
                status_val=ProductJourneyCheckpoint.STATUS_COMPLETED,
                notes=f"Production Order {po.order_number} confirmed. {line.planned_quantity} units to be produced.",
                user_name=user_name,
                location=po.destination,
            )

        return Response(ProductionOrderSerializer(po, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Move PO from confirmed → in_production."""
        po = self.get_object()
        if po.po_status != ProductionOrder.STATUS_CONFIRMED:
            return Response({'error': 'Only confirmed orders can be started.'}, status=400)

        user_name = request.user.get_full_name() or request.user.username
        po.po_status = ProductionOrder.STATUS_IN_PRODUCTION
        po.save(update_fields=['po_status', 'updated_at'])

        for line in po.lines.select_related('sku'):
            line.line_status = ProductionOrderLine.LINE_IN_PRODUCTION
            line.save(update_fields=['line_status', 'updated_at'])

            _create_journey_checkpoint(
                company_id=po.company_id,
                sku=line.sku,
                stage=ProductJourneyCheckpoint.STAGE_IN_PRODUCTION,
                status_val=ProductJourneyCheckpoint.STATUS_IN_PROGRESS,
                notes=f"Production started for {po.order_number}. {line.planned_quantity} units in production.",
                user_name=user_name,
                location=po.destination,
            )

        return Response(ProductionOrderSerializer(po, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """
        Record receipt of goods against a Production Order.
        Body: { "receipts": [{ "sku_id": "uuid", "quantity": 10, "rejected": 0 }] }
        This updates PO lines, creates inventory movements, and updates balances.
        """
        po = self.get_object()
        if po.po_status not in (
            ProductionOrder.STATUS_IN_PRODUCTION,
            ProductionOrder.STATUS_PARTIALLY_RECEIVED,
            ProductionOrder.STATUS_CONFIRMED,
        ):
            return Response({'error': 'Order is not in a receivable state.'}, status=400)

        receipts = request.data.get('receipts', [])
        if not receipts:
            return Response({'error': 'No receipt data provided.'}, status=400)

        user_name = request.user.get_full_name() or request.user.username
        from datetime import date
        results = []

        with transaction.atomic():
            if not po.actual_delivery:
                po.actual_delivery = date.today()

            for rec in receipts:
                sku_id = rec.get('sku_id')
                qty = int(rec.get('quantity', 0))
                rejected = int(rec.get('rejected', 0))

                if qty <= 0 and rejected <= 0:
                    continue

                try:
                    line = po.lines.select_related('sku').get(sku_id=sku_id)
                except ProductionOrderLine.DoesNotExist:
                    results.append({'sku_id': sku_id, 'error': 'SKU not found on this PO'})
                    continue

                line.received_quantity += qty
                line.rejected_quantity += rejected

                # Update line status
                total_accounted = line.received_quantity + line.rejected_quantity
                if total_accounted >= line.planned_quantity:
                    line.line_status = ProductionOrderLine.LINE_COMPLETED
                else:
                    line.line_status = ProductionOrderLine.LINE_PARTIALLY_RECEIVED

                line.save(update_fields=['received_quantity', 'rejected_quantity', 'line_status', 'updated_at'])

                # Create inventory movement (receipt into destination warehouse)
                if qty > 0:
                    movement = InventoryMovement(
                        movement_type=InventoryMovement.MOVEMENT_TYPE_RECEIPT,
                        movement_date=timezone.now(),
                        sku=line.sku,
                        to_location=po.destination,
                        quantity=qty,
                        unit_cost=line.unit_cost,
                        total_cost=qty * line.unit_cost,
                        reference_number=po.order_number,
                        notes=f"Production order receipt: {po.order_number}",
                    )
                    movement.save()

                    # Update inventory balance
                    balance, _ = InventoryBalance.objects.get_or_create(
                        company_id=po.company_id,
                        sku=line.sku,
                        location=po.destination,
                        defaults={'quantity_on_hand': 0, 'quantity_available': 0}
                    )
                    balance.quantity_on_hand += qty
                    balance.quantity_available += qty
                    balance.save(update_fields=['quantity_on_hand', 'quantity_available', 'updated_at'])

                # Product Journey: received
                _create_journey_checkpoint(
                    company_id=po.company_id,
                    sku=line.sku,
                    stage=ProductJourneyCheckpoint.STAGE_RECEIVED,
                    status_val=ProductJourneyCheckpoint.STATUS_COMPLETED,
                    notes=f"Received {qty} units (rejected {rejected}) against {po.order_number}. Total: {line.received_quantity}/{line.planned_quantity}.",
                    user_name=user_name,
                    location=po.destination,
                )

                # If there's a shortfall, log that too
                if line.line_status == ProductionOrderLine.LINE_COMPLETED and line.shortfall > 0:
                    _create_journey_checkpoint(
                        company_id=po.company_id,
                        sku=line.sku,
                        stage=ProductJourneyCheckpoint.STAGE_PRODUCTION_SHORTFALL,
                        status_val=ProductJourneyCheckpoint.STATUS_COMPLETED,
                        notes=f"Shortfall of {line.shortfall} units on {po.order_number}. Planned: {line.planned_quantity}, Received: {line.received_quantity}, Rejected: {line.rejected_quantity}.",
                        user_name=user_name,
                        location=po.destination,
                    )

                results.append({
                    'sku_id': str(sku_id),
                    'sku_code': line.sku.code,
                    'received': qty,
                    'rejected': rejected,
                    'total_received': line.received_quantity,
                    'planned': line.planned_quantity,
                    'fulfillment_pct': line.fulfillment_pct,
                })

            # Update PO status
            all_lines = po.lines.all()
            all_completed = all(l.line_status in (ProductionOrderLine.LINE_COMPLETED, ProductionOrderLine.LINE_SHORT_CLOSED) for l in all_lines)
            any_received = any(l.received_quantity > 0 for l in all_lines)

            if all_completed:
                po.po_status = ProductionOrder.STATUS_COMPLETED
            elif any_received:
                po.po_status = ProductionOrder.STATUS_PARTIALLY_RECEIVED

            po.save(update_fields=['po_status', 'actual_delivery', 'updated_at'])

        return Response({
            'order_number': po.order_number,
            'po_status': po.po_status,
            'receipts': results,
        })

    @action(detail=True, methods=['post'])
    def short_close(self, request, pk=None):
        """Accept shortfall and close the PO."""
        po = self.get_object()
        if po.po_status not in (ProductionOrder.STATUS_PARTIALLY_RECEIVED, ProductionOrder.STATUS_IN_PRODUCTION):
            return Response({'error': 'Order cannot be short-closed in its current state.'}, status=400)

        user_name = request.user.get_full_name() or request.user.username

        with transaction.atomic():
            for line in po.lines.select_related('sku'):
                if line.line_status != ProductionOrderLine.LINE_COMPLETED:
                    shortfall = line.shortfall
                    line.line_status = ProductionOrderLine.LINE_SHORT_CLOSED
                    line.save(update_fields=['line_status', 'updated_at'])

                    if shortfall > 0:
                        _create_journey_checkpoint(
                            company_id=po.company_id,
                            sku=line.sku,
                            stage=ProductJourneyCheckpoint.STAGE_PRODUCTION_SHORTFALL,
                            status_val=ProductJourneyCheckpoint.STATUS_COMPLETED,
                            notes=f"PO {po.order_number} short-closed. {shortfall} units undelivered for {line.sku.code}.",
                            user_name=user_name,
                            location=po.destination,
                        )

            po.po_status = ProductionOrder.STATUS_SHORT_CLOSED
            po.save(update_fields=['po_status', 'updated_at'])

        return Response(ProductionOrderSerializer(po, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a PO (only if draft or confirmed)."""
        po = self.get_object()
        if po.po_status not in (ProductionOrder.STATUS_DRAFT, ProductionOrder.STATUS_CONFIRMED):
            return Response({'error': 'Only draft or confirmed orders can be cancelled.'}, status=400)

        po.po_status = ProductionOrder.STATUS_CANCELLED
        po.save(update_fields=['po_status', 'updated_at'])
        return Response(ProductionOrderSerializer(po, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Production orders summary for the dashboard widget."""
        company_id = request.user.company_id
        from datetime import date, timedelta

        active_statuses = [
            ProductionOrder.STATUS_CONFIRMED,
            ProductionOrder.STATUS_IN_PRODUCTION,
            ProductionOrder.STATUS_PARTIALLY_RECEIVED,
        ]

        active_pos = ProductionOrder.objects.filter(
            company_id=company_id, po_status__in=active_statuses
        ).prefetch_related('lines')

        total_active = active_pos.count()
        total_units_in_production = 0
        overdue_count = 0
        awaiting_receipt = 0

        for po in active_pos:
            total_units_in_production += po.total_planned - po.total_received
            if po.is_overdue:
                overdue_count += 1
            if po.po_status in (ProductionOrder.STATUS_IN_PRODUCTION, ProductionOrder.STATUS_CONFIRMED):
                awaiting_receipt += 1

        # Recent completed
        recent_completed = ProductionOrder.objects.filter(
            company_id=company_id,
            po_status__in=[ProductionOrder.STATUS_COMPLETED, ProductionOrder.STATUS_SHORT_CLOSED],
        ).order_by('-updated_at')[:5]

        return Response({
            'active_orders': total_active,
            'units_in_production': total_units_in_production,
            'awaiting_receipt': awaiting_receipt,
            'overdue': overdue_count,
            'recent_completed': ProductionOrderSerializer(recent_completed, many=True, context={'request': request}).data,
        })

    @action(detail=False, methods=['get'])
    def restock_suggestions(self, request):
        """
        Restock suggestions: SKUs below min_stock_level with no active PO already.
        Returns items ready for one-click restock PO creation.
        """
        company_id = request.user.company_id

        # Get all active PO SKU IDs so we don't suggest restocking items already in production
        active_po_skus = set(
            ProductionOrderLine.objects.filter(
                production_order__company_id=company_id,
                production_order__po_status__in=[
                    ProductionOrder.STATUS_DRAFT,
                    ProductionOrder.STATUS_CONFIRMED,
                    ProductionOrder.STATUS_IN_PRODUCTION,
                    ProductionOrder.STATUS_PARTIALLY_RECEIVED,
                ],
            ).values_list('sku_id', flat=True)
        )

        suggestions = []

        # Warehouse stock alerts
        all_balances = InventoryBalance.objects.filter(
            company_id=company_id,
            status='active',
        ).select_related('sku__product', 'location')

        for item in all_balances:
            min_level = item.sku.min_stock_level
            current_qty = float(item.quantity_available)

            if min_level > 0 and current_qty <= min_level:
                sku_id = item.sku_id
                already_in_production = sku_id in active_po_skus
                suggested_qty = max(int(min_level * 2 - current_qty), int(min_level))

                suggestions.append({
                    'sku_id': str(sku_id),
                    'sku_code': item.sku.code,
                    'sku_name': item.sku.name,
                    'product_name': item.sku.product.name if item.sku.product else '',
                    'location_id': str(item.location_id),
                    'location_name': item.location.name,
                    'current_stock': current_qty,
                    'min_stock_level': float(min_level),
                    'suggested_quantity': suggested_qty,
                    'is_best_seller': item.sku.is_best_seller,
                    'source': 'warehouse',
                    'already_in_production': already_in_production,
                    'urgency': 'critical' if (item.sku.is_best_seller or item.sku.movement_classification == 'fast') else 'standard',
                })

        # Shopify low-stock
        try:
            from apps.integrations.shopify_models import ShopifyProduct
            shopify_products = ShopifyProduct.objects.filter(
                store__company_id=company_id,
                erp_sku__isnull=False
            ).select_related('erp_sku__product')

            for sp in shopify_products:
                min_level = sp.erp_sku.min_stock_level
                current_qty = sp.shopify_inventory_quantity or 0

                if min_level > 0 and current_qty <= min_level:
                    sku_id = sp.erp_sku_id
                    already_in_production = sku_id in active_po_skus
                    suggested_qty = max(int(min_level * 2 - current_qty), int(min_level))

                    # Avoid duplicating if already in warehouse alerts
                    if not any(s['sku_id'] == str(sku_id) for s in suggestions):
                        suggestions.append({
                            'sku_id': str(sku_id),
                            'sku_code': sp.erp_sku.code,
                            'sku_name': sp.erp_sku.name,
                            'product_name': sp.erp_sku.product.name if sp.erp_sku.product else '',
                            'location_id': None,
                            'location_name': 'Shopify Online',
                            'current_stock': current_qty,
                            'min_stock_level': float(min_level),
                            'suggested_quantity': suggested_qty,
                            'is_best_seller': sp.erp_sku.is_best_seller,
                            'source': 'shopify',
                            'already_in_production': already_in_production,
                            'urgency': 'critical' if sp.erp_sku.is_best_seller else 'standard',
                        })
        except Exception:
            pass  # Shopify not configured

        # Sort: critical first, then by lowest stock
        suggestions.sort(key=lambda x: (0 if x['urgency'] == 'critical' else 1, x['current_stock']))

        return Response({
            'suggestions': suggestions,
            'summary': {
                'total': len(suggestions),
                'critical': sum(1 for s in suggestions if s['urgency'] == 'critical'),
                'already_in_production': sum(1 for s in suggestions if s['already_in_production']),
            }
        })

