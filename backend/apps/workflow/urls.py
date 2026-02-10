from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkflowViewSet, WorkflowStateViewSet, WorkflowTransitionViewSet

router = DefaultRouter()
router.register(r'workflows', WorkflowViewSet, basename='workflow')
router.register(r'states', WorkflowStateViewSet, basename='workflow-state')
router.register(r'transitions', WorkflowTransitionViewSet, basename='workflow-transition')

urlpatterns = [
    path('', include(router.urls)),
]
