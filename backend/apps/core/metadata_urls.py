"""
Metadata Management URLs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .metadata_views import MetadataViewSet, TemplateViewSet, SandboxViewSet

router = DefaultRouter()
router.register(r'metadata', MetadataViewSet, basename='metadata')
router.register(r'templates', TemplateViewSet, basename='templates')
router.register(r'sandboxes', SandboxViewSet, basename='sandboxes')

urlpatterns = router.urls
