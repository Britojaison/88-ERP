"""
URL configuration for ERP platform.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from apps.mdm.serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Metadata Management
    path('api/', include('apps.core.metadata_urls')),
    
    # ERP Modules
    path('api/mdm/', include('apps.mdm.urls')),
    path('api/attributes/', include('apps.attributes.urls')),
    path('api/rbac/', include('apps.rbac.urls')),
    path('api/workflow/', include('apps.workflow.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/config/', include('apps.config.urls')),
    path('api/rules/', include('apps.rules.urls')),
    path('api/numbering/', include('apps.numbering.urls')),
    path('api/calendar/', include('apps.calendar.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/reporting/', include('apps.reporting.urls')),
    path('api/imports/', include('apps.imports.urls')),
    path('api/search/', include('apps.search.urls')),
    path('api/integrations/', include('apps.integrations.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
