"""
API Views for Inventory Management.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
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
    max_page_size = 200


class InventoryBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryBalanceSerializer
    pagination_class = InventoryPagination

    def get_queryset(self):
        queryset = InventoryBalance.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("sku", "location")

        sku_id = self.request.query_params.get("sku")
        if sku_id:
            queryset = queryset.filter(sku_id=sku_id)

        location_id = self.request.query_params.get("location")
        if location_id:
            queryset = queryset.filter(location_id=location_id)

        return queryset.order_by("sku__code")

    @action(detail=False, methods=['get'], url_path='velocity')
    def stock_velocity(self, request):
        """Calculates fast, slow, and dead stock based on recent sales vs current balance."""
        from django.db.models import Sum
        from apps.sales.models import SalesTransactionLine
        from django.utils import timezone
        import datetime

        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
        
        # 1. Get current inventory by sku
        balances = InventoryBalance.objects.filter(
            company_id=request.user.company_id,
            status="active"
        ).values('sku__id', 'sku__code', 'sku__name').annotate(
            total_quantity=Sum('quantity')
        )
        
        # 2. Get sales last 30 days
        sales = SalesTransactionLine.objects.filter(
            sku__company_id=request.user.company_id,
            transaction__transaction_date__gte=thirty_days_ago,
            transaction__status='active'
        ).values('sku__id').annotate(
            sold_last_30_days=Sum('quantity')
        )
        sales_dict = {item['sku__id']: item['sold_last_30_days'] for item in sales}

        fast, slow, dead = [], [], []
        for bal in balances:
            sku_id = bal['sku__id']
            qty = bal['total_quantity'] or 0
            sold = sales_dict.get(sku_id, 0)
            
            item = {
                "sku_id": str(sku_id),
                "sku_code": bal['sku__code'],
                "sku_name": bal['sku__name'],
                "current_stock": float(qty),
                "sold_30d": float(sold)
            }
            if sold >= 20: # threshold could be dynamic
                fast.append(item)
            elif sold > 0:
                slow.append(item)
            else:
                dead.append(item)
                
        # sort by highest sold / Highest stock
        fast = sorted(fast, key=lambda x: x['sold_30d'], reverse=True)
        slow = sorted(slow, key=lambda x: x['sold_30d'], reverse=True)
        dead = sorted(dead, key=lambda x: x['current_stock'], reverse=True)
        
        return Response({
            "fast_moving": fast[:20],  # Give top 20
            "slow_moving": slow[:20],
            "dead_stock": dead[:20]
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
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_ISSUE:
            from_balance = self._get_or_create_balance(company_id, movement.sku, movement.from_location, condition)
            self._decrease_balance(from_balance, qty)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_TRANSFER:
            from_balance = self._get_or_create_balance(company_id, movement.sku, movement.from_location, condition)
            to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
            self._decrease_balance(from_balance, qty)
            self._increase_balance(to_balance, qty, movement.unit_cost)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_ADJUSTMENT:
            if movement.from_location:
                from_balance = self._get_or_create_balance(company_id, movement.sku, movement.from_location, condition)
                self._decrease_balance(from_balance, qty)
            if movement.to_location:
                to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
                self._increase_balance(to_balance, qty, movement.unit_cost)
            return

        if movement.movement_type == InventoryMovement.MOVEMENT_TYPE_RETURN:
            to_balance = self._get_or_create_balance(company_id, movement.sku, movement.to_location, condition)
            self._increase_balance(to_balance, qty, movement.unit_cost)
            return

    @action(detail=False, methods=["get"], url_path="alerts")
    def alerts(self, request):
        threshold_str = request.query_params.get("threshold", "10")
        threshold = Decimal(threshold_str)

        low_stock = (
            InventoryBalance.objects.filter(
                company_id=request.user.company_id,
                status="active",
                quantity_available__lte=threshold,
            )
            .select_related("sku", "location")
            .order_by("quantity_available")
        )

        data = [
            {
                "id": str(item.id),
                "sku": item.sku.code,
                "location": item.location.code,
                "available_quantity": str(item.quantity_available),
                "threshold": str(threshold),
                "updated_at": timezone.localtime(item.updated_at).isoformat(),
            }
            for item in low_stock
        ]

        return Response(data)


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
        ).select_related('product').order_by('-created_at')
        
        total_count = queryset.count()
        skus = queryset[offset:offset+limit]
        
        data = [
            {
                "id": str(sku.id),
                "code": sku.code,
                "name": sku.name,
                "product_name": sku.product.name if sku.product else "",
                "lifecycle_status": sku.lifecycle_status,
                "created_at": sku.created_at.isoformat(),
            }
            for sku in skus
        ]
        return Response({
            "results": data,
            "count": total_count,
            "page": page,
            "limit": limit
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Transition SKU to 'In Production' and log journeys."""
        from django.utils import timezone
        import datetime
        from apps.mdm.models import SKU
        from .models import ProductJourneyCheckpoint

        try:
            sku = SKU.objects.get(id=pk, company_id=request.user.company_id)
        except SKU.DoesNotExist:
            return Response({"error": "SKU not found."}, status=status.HTTP_404_NOT_FOUND)

        if sku.lifecycle_status != SKU.LIFECYCLE_PROTO:
            return Response({"error": "SKU is not in Proto/Design phase."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', 'Design approved and moved to production.')
        expected_days = int(request.data.get('expected_days', 14))
        attachment = request.FILES.get('attachment')

        with transaction.atomic():
            # 1. Update SKU lifecycle status
            sku.lifecycle_status = SKU.LIFECYCLE_IN_PRODUCTION
            sku.save(update_fields=['lifecycle_status', 'updated_at'])

            # 2. Complete the "Design Approved" checkpoint
            ProductJourneyCheckpoint.objects.create(
                company_id=request.user.company_id,
                sku=sku,
                stage=ProductJourneyCheckpoint.STAGE_DESIGN_APPROVED,
                status=ProductJourneyCheckpoint.STATUS_COMPLETED,
                notes=notes,
                user_name=request.user.get_full_name() or request.user.username,
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
                user_name=request.user.get_full_name() or request.user.username,
                timestamp=timezone.now(),
                expected_time=timezone.now() + datetime.timedelta(days=expected_days)
            )

        return Response({"message": "Successfully sent to production."}, status=status.HTTP_200_OK)

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

        # Fetch SKUs in proto or in_production that aren't inactive
        skus = SKU.objects.filter(
            company_id=request.user.company_id,
            lifecycle_status__in=[SKU.LIFECYCLE_PROTO, SKU.LIFECYCLE_IN_PRODUCTION],
            status='active'
        ).prefetch_related(
            Prefetch(
                'journey_checkpoints',
                queryset=ProductJourneyCheckpoint.objects.select_related('location').order_by('-timestamp', '-created_at'),
                to_attr='latest_checkpoints'
            )
        )

        columns = {
            'fabric_sourced': [],
            'fabric_dispatched': [],
            'design_approved': [],
            'in_production': [],
            'shoot': [],
            'received': [],
            'quality_check': [],
            'ready': [],
        }

        for sku in skus:
            checkpoints = getattr(sku, 'latest_checkpoints', [])
            latest_stage = checkpoints[0].stage if checkpoints else 'fabric_sourced'
            latest_cp = checkpoints[0] if checkpoints else None

            # Map to kanban columns
            mapped_stage = latest_stage
            if mapped_stage == 'storage':
                mapped_stage = 'ready'
            elif mapped_stage in ['picked', 'packed', 'dispatched', 'in_transit', 'delivered']:
                continue  # Already beyond production
            elif mapped_stage not in columns:
                if latest_stage == 'design_approved':
                    mapped_stage = 'design_approved'
                else:
                    mapped_stage = 'fabric_sourced'

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

