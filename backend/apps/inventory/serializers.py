"""
Serializers for Inventory API.
"""
from decimal import Decimal
from rest_framework import serializers
from .models import InventoryBalance, InventoryMovement, GoodsReceiptScan, DamagedItem


class InventoryBalanceSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source="sku.code", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = InventoryBalance
        fields = [
            "id",
            "company",
            "sku",
            "sku_code",
            "location",
            "location_code",
            "quantity_on_hand",
            "quantity_reserved",
            "quantity_available",
            "condition",
            "average_cost",
            "status",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class InventoryMovementSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source="sku.code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.code", read_only=True, allow_null=True)
    to_location_code = serializers.CharField(source="to_location.code", read_only=True, allow_null=True)

    class Meta:
        model = InventoryMovement
        fields = [
            "id",
            "movement_type",
            "movement_date",
            "sku",
            "sku_code",
            "from_location",
            "from_location_code",
            "to_location",
            "to_location_code",
            "quantity",
            "unit_cost",
            "total_cost",
            "document",
            "reference_number",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class InventoryMovementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = [
            "movement_type",
            "movement_date",
            "sku",
            "from_location",
            "to_location",
            "quantity",
            "unit_cost",
            "document",
            "reference_number",
            "notes",
        ]

    def validate(self, attrs):
        movement_type = attrs["movement_type"]
        from_location = attrs.get("from_location")
        to_location = attrs.get("to_location")
        quantity = attrs.get("quantity", Decimal("0"))
        unit_cost = attrs.get("unit_cost", Decimal("0"))

        if quantity <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")

        if unit_cost < 0:
            raise serializers.ValidationError("Unit cost cannot be negative.")

        if movement_type == InventoryMovement.MOVEMENT_TYPE_RECEIPT and not to_location:
            raise serializers.ValidationError("Receipt requires to_location.")

        if movement_type == InventoryMovement.MOVEMENT_TYPE_ISSUE and not from_location:
            raise serializers.ValidationError("Issue requires from_location.")

        if movement_type == InventoryMovement.MOVEMENT_TYPE_TRANSFER:
            if not from_location or not to_location:
                raise serializers.ValidationError("Transfer requires both from_location and to_location.")
            if from_location == to_location:
                raise serializers.ValidationError("Transfer source and destination must differ.")

        if movement_type == InventoryMovement.MOVEMENT_TYPE_ADJUSTMENT and not (from_location or to_location):
            raise serializers.ValidationError("Adjustment requires from_location or to_location.")

        attrs["total_cost"] = quantity * unit_cost
        return attrs


class GoodsReceiptScanSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source="sku.code", read_only=True, allow_null=True)
    location_code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = GoodsReceiptScan
        fields = [
            "id",
            "barcode_value",
            "sku",
            "sku_code",
            "barcode",
            "location",
            "location_code",
            "document",
            "quantity",
            "batch_number",
            "serial_number",
            "result",
            "message",
            "scanned_at",
        ]
        read_only_fields = ["id", "result", "message", "scanned_at"]


class GoodsReceiptScanRequestSerializer(serializers.Serializer):
    barcode_value = serializers.CharField()
    location_id = serializers.UUIDField()
    document_id = serializers.UUIDField(required=False)
    quantity = serializers.DecimalField(max_digits=15, decimal_places=3, default=Decimal("1"))
    strict = serializers.BooleanField(default=True)


class DamagedItemSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source="sku.code", read_only=True, allow_null=True)
    location_code = serializers.CharField(source="location.code", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DamagedItem
        fields = [
            "id",
            "scan_log",
            "sku",
            "sku_code",
            "barcode_value",
            "quantity",
            "location",
            "location_code",
            "damage_type",
            "severity",
            "description",
            "suggested_action",
            "photo",
            "recorded_at",
            "recorded_by",
            "recorded_by_name",
            "status",
        ]
        read_only_fields = ["id", "recorded_at", "recorded_by"]

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.username
        return None

from .models import ProductJourneyCheckpoint

class ProductJourneyCheckpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductJourneyCheckpoint
        fields = '__all__'

