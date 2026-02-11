"""
API Views for Reporting and Analytics.
"""
import time
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ReportDefinition, ReportExecution, AnalyticsSnapshot
from .serializers import (
    ReportDefinitionSerializer,
    ReportExecutionSerializer,
    AnalyticsSnapshotSerializer,
)


class ReportDefinitionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportDefinitionSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = ReportDefinition.objects.filter(
            company_id=self.request.user.company_id, status="active"
        )
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        return queryset.order_by("category", "code")

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)

    @action(detail=False, methods=["get"], url_path="types")
    def types(self, request):
        types = [{"value": value, "label": label} for value, label in ReportDefinition.REPORT_TYPE_CHOICES]
        return Response(types)

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        report_type = request.data.get("report_type")
        parameters = request.data.get("parameters", {})

        report = self.get_queryset().filter(report_type=report_type).first()
        if not report:
            return Response({"error": "Report definition not found."}, status=status.HTTP_404_NOT_FOUND)

        start = time.time()
        # Placeholder execution: in next milestone, this will call a safe execution engine.
        execution = ReportExecution.objects.create(
            report=report,
            parameters=parameters,
            executed_by=request.user,
            execution_time_ms=int((time.time() - start) * 1000),
            row_count=0,
            output_format="json",
            created_by=request.user,
            updated_by=request.user,
        )

        return Response(ReportExecutionSerializer(execution).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        report = self.get_object()
        output = {
            "report": report.code,
            "message": "Download pipeline not implemented yet. Use execution records for now.",
            "format": request.query_params.get("format", "pdf"),
        }
        return Response(output, status=status.HTTP_501_NOT_IMPLEMENTED)


class ReportExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportExecutionSerializer
    pagination_class = None

    def get_queryset(self):
        return ReportExecution.objects.filter(
            report__company_id=self.request.user.company_id
        ).select_related("report", "executed_by").order_by("-created_at")


class AnalyticsSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AnalyticsSnapshotSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AnalyticsSnapshot.objects.filter(
            company_id=self.request.user.company_id, status="active"
        )
        metric_name = self.request.query_params.get("metric_name")
        if metric_name:
            queryset = queryset.filter(metric_name=metric_name)
        return queryset.order_by("-snapshot_date")


class ReportingTypesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        types = [{"value": value, "label": label} for value, label in ReportDefinition.REPORT_TYPE_CHOICES]
        return Response(types)


class ReportingGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        report_type = request.data.get("report_type")
        parameters = request.data.get("parameters", {})

        report = ReportDefinition.objects.filter(
            company_id=request.user.company_id,
            status="active",
            report_type=report_type,
        ).first()
        if not report:
            return Response({"error": "Report definition not found."}, status=status.HTTP_404_NOT_FOUND)

        start = time.time()
        execution = ReportExecution.objects.create(
            report=report,
            parameters=parameters,
            executed_by=request.user,
            execution_time_ms=int((time.time() - start) * 1000),
            row_count=0,
            output_format="json",
            created_by=request.user,
            updated_by=request.user,
        )
        return Response(ReportExecutionSerializer(execution).data, status=status.HTTP_201_CREATED)
