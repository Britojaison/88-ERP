import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU, Product, Company

def check_all():
    all_p = Product.objects.all().count()
    all_s = SKU.objects.all().count()
    print(f"Total Products in DB: {all_p}")
    print(f"Total SKUs in DB: {all_s}")
    
    if all_p > 0:
        first_p = Product.objects.all()[:3]
        for p in first_p:
            print(f"Product: {p.code} (Company: {p.company.code if p.company else 'None'})")

if __name__ == "__main__":
    check_all()
