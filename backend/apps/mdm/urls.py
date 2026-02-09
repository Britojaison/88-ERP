from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# ViewSets will be registered here

urlpatterns = [
    path('', include(router.urls)),
]
