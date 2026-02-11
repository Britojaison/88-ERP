from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReportDefinitionViewSet,
    ReportExecutionViewSet,
    AnalyticsSnapshotViewSet,
    ReportingTypesView,
    ReportingGenerateView,
)

router = DefaultRouter()
router.register(r'reports', ReportDefinitionViewSet, basename='report-definition')
router.register(r'executions', ReportExecutionViewSet, basename='report-execution')
router.register(r'analytics-snapshots', AnalyticsSnapshotViewSet, basename='analytics-snapshot')

urlpatterns = [
    path('types/', ReportingTypesView.as_view(), name='reporting-types'),
    path('generate/', ReportingGenerateView.as_view(), name='reporting-generate'),
    path('', include(router.urls)),
]
