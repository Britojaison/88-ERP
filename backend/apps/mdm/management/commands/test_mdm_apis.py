from django.core.management.base import BaseCommand
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.mdm.models import User
from apps.mdm.views import ProductViewSet, SKUViewSet, CompanyViewSet, BusinessUnitViewSet, LocationViewSet, FabricViewSet

class Command(BaseCommand):
    def handle(self, *args, **options):
        user = User.objects.filter(is_superuser=True).first()
        if not user:
            user = User.objects.first()
        
        self.stdout.write(f"Using user: {user.email}")
        factory = APIRequestFactory()
        request = factory.get('/', HTTP_HOST='127.0.0.1')
        force_authenticate(request, user=user)
        
        views = {
            'Products': ProductViewSet,
            'SKUs': SKUViewSet,
            'Companies': CompanyViewSet,
            'BusinessUnits': BusinessUnitViewSet,
            'Locations': LocationViewSet,
            'Fabrics': FabricViewSet,
        }
        
        for name, view_class in views.items():
            self.stdout.write(f"Testing {name}...")
            view = view_class.as_view({'get': 'list'})
            try:
                response = view(request)
                if response.status_code == 200:
                    data = response.data
                    res = getattr(data, 'get', lambda k, v=None: data)( 'results', data )
                    count = len(res) if isinstance(res, list) else 1
                    self.stdout.write(self.style.SUCCESS(f"{name} OK ({count} items)"))
                else:
                    self.stdout.write(self.style.ERROR(f"{name} FAILED: {response.status_code} - {response.data}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"{name} EXCEPTION: {str(e)}"))
