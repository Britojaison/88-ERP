from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, DocumentTypeViewSet

router = DefaultRouter()
router.register(r'types', DocumentTypeViewSet, basename='document-type')
router.register(r'', DocumentViewSet, basename='document')

urlpatterns = [
    path('', include(router.urls)),
]
