from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttributeDefinitionViewSet, AttributeGroupViewSet

router = DefaultRouter()
router.register(r'definitions', AttributeDefinitionViewSet, basename='attribute-definition')
router.register(r'groups', AttributeGroupViewSet, basename='attribute-group')

urlpatterns = [
    path('', include(router.urls)),
]
