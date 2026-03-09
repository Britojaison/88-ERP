"""
Serializers for Inventory API.
"""
from decimal import Decimal
from rest_framework import serializers
from .models import InventoryBalance, InventoryMovement, GoodsReceiptScan, DamagedItem


class InventoryBalanceSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source="sku.code", read_only=True)
    sku_name = serializers.CharField(source="sku.name", read_only=True)
    product_name = serializers.SerializerMethodField()
    location_code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = InventoryBalance
        fields = [
            "id",
            "company",
            "sku",
            "sku_code",
            "sku_name",
            "product_name",
            "location",
            "location_code",
            "quantity_on_hand",
            "quantity_reserved",
            "quantity_available",
            "condition",
            "is_offer_eligible",
            "average_cost",
            "status",
            "updated_at",
        ]
        read_only_fields = [
            "id", 
            "company", 
            "sku", 
            "location", 
            "quantity_on_hand", 
            "quantity_reserved", 
            "quantity_available", 
            "average_cost", 
            "status", 
            "updated_at"
        ]

    def get_product_name(self, obj):
        if hasattr(obj.sku, 'product') and obj.sku.product:
            return obj.sku.product.name
        return obj.sku.name


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
    sku_code = serializers.CharField(source='sku.code', read_only=True)
    sku_name = serializers.CharField(source='sku.name', read_only=True)
    location_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductJourneyCheckpoint
        fields = [
            'id', 'sku', 'sku_code', 'sku_name', 'document',
            'stage', 'status', 'location', 'location_name',
            'timestamp', 'expected_time', 'notes', 'user_name',
            'attachment', 'attachment_url',
            'measurement_value', 'measurement_unit',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_location_name(self, obj):
        return obj.location.name if obj.location else None

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


from .models import ProductionOrder, ProductionOrderLine


class ProductionOrderLineSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source='sku.code', read_only=True)
    sku_name = serializers.CharField(source='sku.name', read_only=True)
    product_name = serializers.SerializerMethodField()
    shortfall = serializers.ReadOnlyField()
    fulfillment_pct = serializers.ReadOnlyField()
    total_cost = serializers.ReadOnlyField()

    class Meta:
        model = ProductionOrderLine
        fields = [
            'id', 'production_order', 'sku', 'sku_code', 'sku_name', 'product_name',
            'planned_quantity', 'received_quantity', 'rejected_quantity',
            'unit_cost', 'line_status', 'notes',
            'shortfall', 'fulfillment_pct', 'total_cost',
            'created_at',
        ]
        read_only_fields = ['id', 'received_quantity', 'rejected_quantity', 'created_at']

    def get_product_name(self, obj):
        if obj.sku and obj.sku.product:
            return obj.sku.product.name
        return None


class ProductionOrderLineCreateSerializer(serializers.Serializer):
    """Used for nested creation inside ProductionOrder."""
    sku = serializers.UUIDField()
    planned_quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, default='')


class ProductionOrderSerializer(serializers.ModelSerializer):
    lines = ProductionOrderLineSerializer(many=True, read_only=True)
    factory_name = serializers.SerializerMethodField()
    destination_name = serializers.SerializerMethodField()
    total_planned = serializers.ReadOnlyField()
    total_received = serializers.ReadOnlyField()
    total_rejected = serializers.ReadOnlyField()
    total_shortfall = serializers.ReadOnlyField()
    fulfillment_pct = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()

    class Meta:
        model = ProductionOrder
        fields = [
            'id', 'order_number', 'order_type', 'po_status',
            'factory', 'factory_name', 'destination', 'destination_name',
            'order_date', 'expected_delivery', 'actual_delivery',
            'triggered_by', 'notes',
            'total_planned', 'total_received', 'total_rejected',
            'total_shortfall', 'fulfillment_pct', 'is_overdue',
            'lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

    def get_factory_name(self, obj):
        return obj.factory.name if obj.factory else None

    def get_destination_name(self, obj):
        return obj.destination.name if obj.destination else None


class ProductionOrderCreateSerializer(serializers.Serializer):
    """Handles creation of a Production Order with its lines in one request."""
    order_type = serializers.ChoiceField(choices=ProductionOrder.TYPE_CHOICES, default='new_production')
    factory = serializers.UUIDField(required=False, allow_null=True)
    destination = serializers.UUIDField()
    order_date = serializers.DateField()
    expected_delivery = serializers.DateField(required=False, allow_null=True)
    triggered_by = serializers.ChoiceField(choices=ProductionOrder.TRIGGER_CHOICES, default='manual')
    notes = serializers.CharField(required=False, default='')
    lines = ProductionOrderLineCreateSerializer(many=True)

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError('At least one line is required.')
        return value
