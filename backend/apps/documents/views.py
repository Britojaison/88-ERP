"""
API Views for Document Management.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import DocumentType, Document
from .serializers import DocumentTypeSerializer, DocumentSerializer
from apps.numbering.models import NumberingSequence
from apps.workflow.models import Workflow, WorkflowState


class DocumentTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentTypeSerializer
    pagination_class = None

    def _ensure_default_document_setup(self):
        company_id = self.request.user.company_id
        if not company_id:
            return

        has_doc_types = DocumentType.objects.filter(company_id=company_id, status="active").exists()
        if has_doc_types:
            return

        sequence, _ = NumberingSequence.objects.get_or_create(
            company_id=company_id,
            code="DOC_DEFAULT",
            defaults={
                "name": "Default Document Sequence",
                "format_pattern": "{prefix}{year}-{sequence}",
                "prefix": "DOC-",
                "scope_by_year": True,
                "scope_by_month": False,
                "scope_by_location": False,
                "start_number": 1,
                "increment_by": 1,
                "padding_length": 5,
            },
        )

        workflow, _ = Workflow.objects.get_or_create(
            company_id=company_id,
            code="document_lifecycle",
            defaults={
                "name": "Document Lifecycle",
                "description": "Default document lifecycle workflow",
                "entity_type": "document",
            },
        )

        draft_state, _ = WorkflowState.objects.get_or_create(
            company_id=company_id,
            workflow=workflow,
            code="draft",
            defaults={
                "name": "Draft",
                "is_initial": True,
                "is_final": False,
                "allow_edit": True,
                "allow_delete": True,
            },
        )
        WorkflowState.objects.get_or_create(
            company_id=company_id,
            workflow=workflow,
            code="posted",
            defaults={
                "name": "Posted",
                "is_initial": False,
                "is_final": True,
                "allow_edit": False,
                "allow_delete": False,
            },
        )

        if not workflow.initial_state_id:
            workflow.initial_state = draft_state
            workflow.save(update_fields=["initial_state", "updated_at", "version"])

        DocumentType.objects.get_or_create(
            company_id=company_id,
            code="GENERIC",
            defaults={
                "name": "Generic Document",
                "description": "Default document type created automatically",
                "numbering_sequence": sequence,
                "workflow": workflow,
                "has_lines": True,
                "requires_approval": False,
                "affects_inventory": False,
                "affects_financials": False,
            },
        )

    def get_queryset(self):
        self._ensure_default_document_setup()
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
