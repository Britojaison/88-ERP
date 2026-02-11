"""
API Views for Document Management.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import DocumentType, Document
from .serializers import DocumentTypeSerializer, DocumentSerializer


class DocumentTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentTypeSerializer
    pagination_class = None

    def get_queryset(self):
        return DocumentType.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("code")

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Document.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).select_related("document_type", "customer", "vendor", "from_location", "to_location")

        document_type_id = self.request.query_params.get("document_type")
        if document_type_id:
            queryset = queryset.filter(document_type_id=document_type_id)

        return queryset.prefetch_related("lines__sku").order_by("-document_date")

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id, created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
