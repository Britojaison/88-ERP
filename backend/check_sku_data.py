import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import SKU, Product, Company

def check_data():
    comp = Company.objects.filter(code="88GB").first()
    if not comp:
        print("Company 88GB not found!")
        return
        
    print(f"Company Found: {comp.name} ({comp.id})")
    scount = SKU.objects.filter(company=comp).count()
    pcount = Product.objects.filter(company=comp).count()
    print(f"Product Count: {pcount}")
    print(f"SKU Count: {scount}")
    
    if scount > 0:
        first_skus = SKU.objects.filter(company=comp)[:5]
        for s in first_skus:
            print(f"- {s.code}: {s.name}")

if __name__ == "__main__":
    check_data()
