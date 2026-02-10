from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RuleViewSet, RuleExecutionViewSet

router = DefaultRouter()
router.register(r'rules', RuleViewSet, basename='rule')
router.register(r'executions', RuleExecutionViewSet, basename='rule-execution')

urlpatterns = [
    path('', include(router.urls)),
]
