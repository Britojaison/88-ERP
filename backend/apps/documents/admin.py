from django.contrib import admin
from .models import DocumentType, Document, DocumentLine


@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'company', 'has_lines', 'requires_approval', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'has_lines', 'requires_approval', 'status']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['document_number', 'document_type', 'document_date', 'total_amount', 'company', 'status']
    search_fields = ['document_number', 'reference_number']
    list_filter = ['company', 'document_type', 'document_date', 'status']


@admin.register(DocumentLine)
class DocumentLineAdmin(admin.ModelAdmin):
    list_display = ['document', 'line_number', 'sku', 'quantity', 'unit_price', 'line_amount']
    search_fields = ['document__document_number', 'sku__code']
    list_filter = ['document__document_type', 'status']
