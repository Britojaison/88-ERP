"""
URL configuration for ERP platform.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # ERP Modules
    path('api/mdm/', include('apps.mdm.urls')),
    path('api/attributes/', include('apps.attributes.urls')),
    path('api/rbac/', include('apps.rbac.urls')),
    path('api/workflow/', include('apps.workflow.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/config/', include('apps.config.urls')),
    path('api/rules/', include('apps.rules.urls')),
    path('api/numbering/', include('apps.numbering.urls')),
    path('api/calendar/', include('apps.calendar.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/reporting/', include('apps.reporting.urls')),
    path('api/imports/', include('apps.imports.urls')),
    path('api/search/', include('apps.search.urls')),
]
