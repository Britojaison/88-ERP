import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Company

def check_comps():
    comps = Company.objects.all()
    for c in comps:
        print(f"Company: {c.code}, Name: {c.name}")

if __name__ == "__main__":
    check_comps()
