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


from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def meta_webhook_sink(request):
    """
    Silent handler for Meta/Instagram webhook deliveries targeting an old ngrok URL.
    Returns 200 to stop Meta from retrying. Once the ngrok URL changes, Meta will
    stop delivering to this endpoint automatically.
    """
    if request.method == 'GET':
        # Meta webhook verification challenge
        challenge = request.GET.get('hub.challenge', '')
        return HttpResponse(challenge, content_type='text/plain')
    return HttpResponse(status=200)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Meta/Instagram webhook sink (stale deliveries from a previous session)
    path('api/webhook', meta_webhook_sink, name='meta-webhook-sink'),
    path('api/webhook/', meta_webhook_sink, name='meta-webhook-sink-slash'),
    
    # ERP Modules
    path('api/mdm/', include('apps.mdm.urls')),
    path('api/rbac/', include('apps.rbac.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/numbering/', include('apps.numbering.urls')),
    path('api/reporting/', include('apps.reporting.urls')),
    path('api/search/', include('apps.search.urls')),
    path('api/integrations/', include('apps.integrations.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
