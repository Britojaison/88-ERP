"""
Serializers for Document API.
"""
from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from .models import DocumentType, Document, DocumentLine


class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = [
            "id",
            "company",
            "code",
            "name",
            "description",
            "numbering_sequence",
            "workflow",
            "has_lines",
            "requires_approval",
            "affects_inventory",
            "affects_financials",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DocumentLineSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source="sku.code", read_only=True)

    class Meta:
        model = DocumentLine
        fields = [
            "id",
            "line_number",
            "sku",
            "sku_code",
            "quantity",
            "unit_price",
            "line_amount",
            "tax_rate",
            "tax_amount",
            "notes",
        ]
        read_only_fields = ["id"]


class DocumentSerializer(serializers.ModelSerializer):
    lines = DocumentLineSerializer(many=True, required=False)
    date = serializers.DateField(source="document_date", required=False)

    class Meta:
        model = Document
        fields = [
            "id",
            "company",
            "document_type",
            "document_number",
            "document_date",
            "date",
            "reference_number",
            "external_reference",
            "customer",
            "vendor",
            "from_location",
            "to_location",
            "total_amount",
            "tax_amount",
            "notes",
            "status",
            "created_at",
            "updated_at",
            "lines",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        document = Document.objects.create(**validated_data)
        self._upsert_lines(document, lines_data)
        self._recalculate_totals(document)
        return document

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()

        if lines_data is not None:
            instance.lines.all().delete()
            self._upsert_lines(instance, lines_data)

        self._recalculate_totals(instance)
        return instance

    def _upsert_lines(self, document, lines_data):
        for idx, line in enumerate(lines_data, start=1):
            quantity = Decimal(line["quantity"])
            unit_price = Decimal(line["unit_price"])
            tax_rate = Decimal(line.get("tax_rate", 0))
            line_amount = quantity * unit_price
            tax_amount = (line_amount * tax_rate) / Decimal("100")

            DocumentLine.objects.create(
                document=document,
                line_number=line.get("line_number", idx),
                sku=line["sku"],
                quantity=quantity,
                unit_price=unit_price,
                line_amount=line_amount,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                notes=line.get("notes", ""),
                created_by=document.created_by,
                updated_by=document.updated_by,
                status="active",
            )

    def _recalculate_totals(self, document):
        total = Decimal("0")
        tax_total = Decimal("0")
        for line in document.lines.all():
            total += line.line_amount
            tax_total += line.tax_amount

        document.total_amount = total
        document.tax_amount = tax_total
        document.save(update_fields=["total_amount", "tax_amount", "updated_at", "version"])
