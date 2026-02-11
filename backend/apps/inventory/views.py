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
from .models import InventoryBalance, InventoryMovement, GoodsReceiptScan
from .serializers import (
    InventoryBalanceSerializer,
    InventoryMovementSerializer,
    InventoryMovementCreateSerializer,
    GoodsReceiptScanSerializer,
    GoodsReceiptScanRequestSerializer,
)
from apps.mdm.models import SKU, Location, SKUBarcode
from apps.documents.models import Document, DocumentLine


class InventoryBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryBalanceSerializer
    pagination_class = None

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


class InventoryMovementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

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
    pagination_class = None

    def get_queryset(self):
        return GoodsReceiptScan.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("sku", "barcode", "location", "document")

    def list(self, request):
        queryset = self.get_queryset()[:100]
        return Response(GoodsReceiptScanSerializer(queryset, many=True).data)

    @transaction.atomic
    @action(detail=False, methods=["post"], url_path="scan")
    def scan(self, request):
        input_serializer = GoodsReceiptScanRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        barcode_value = data["barcode_value"].strip()
        location = Location.objects.get(id=data["location_id"], company_id=request.user.company_id)
        quantity = data["quantity"]
        strict = data["strict"]

        document = None
        if data.get("document_id"):
            document = Document.objects.get(id=data["document_id"], company_id=request.user.company_id)

        barcode = SKUBarcode.objects.filter(
            company_id=request.user.company_id,
            barcode_value=barcode_value,
            status="active",
        ).select_related("sku").first()

        sku = barcode.sku if barcode else None
        batch_number = ""
        serial_number = ""

        if not sku and "|" in barcode_value:
            parts = barcode_value.split("|")
            sku_code = parts[0].strip()
            batch_number = parts[1].strip() if len(parts) > 1 else ""
            serial_number = parts[2].strip() if len(parts) > 2 else ""
            sku = SKU.objects.filter(
                company_id=request.user.company_id, code=sku_code, status="active"
            ).first()

        if not sku:
            log = GoodsReceiptScan.objects.create(
                company_id=request.user.company_id,
                barcode_value=barcode_value,
                location=location,
                document=document,
                quantity=quantity,
                result=GoodsReceiptScan.RESULT_UNKNOWN,
                message="Barcode/SKU not recognized.",
                created_by=request.user,
                updated_by=request.user,
            )
            return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_200_OK)

        if document:
            line = DocumentLine.objects.filter(document=document, sku=sku, status="active").first()
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

            ordered_qty = line.quantity
            received_qty = (
                InventoryMovement.objects.filter(
                    document=document,
                    sku=sku,
                    movement_type=InventoryMovement.MOVEMENT_TYPE_RECEIPT,
                )
                .aggregate(total=Sum("quantity"))
                .get("total")
                or Decimal("0")
            )
            if strict and (received_qty + quantity > ordered_qty):
                result = GoodsReceiptScan.RESULT_OVER_RECEIPT
                msg = (
                    f"Over receipt blocked. Ordered={ordered_qty}, "
                    f"already_received={received_qty}, trying={quantity}."
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
            notes="Goods receipt via barcode scan",
            created_by=request.user,
            updated_by=request.user,
            status="active",
        )

        InventoryMovementViewSet()._apply_movement(movement, request.user.company_id)

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
            message="Scan received and inventory updated.",
            created_by=request.user,
            updated_by=request.user,
        )
        return Response(GoodsReceiptScanSerializer(log).data, status=status.HTTP_201_CREATED)
