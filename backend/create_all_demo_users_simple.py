#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.mdm.models import Company
from apps.rbac.models import Role, UserRole

User = get_user_model()

def run():
    print("Starting demo user creation...")
    company = Company.objects.first()
    if not company:
        company = Company.objects.create(code="88GB", name="88 Global Business")

    emails = ["warehouse@88erp.com", "store@88erp.com", "designer@88erp.com", "ops@88erp.com"]
    for email in emails:
        if not User.objects.filter(email=email).exists():
            u = User(email=email, username=email, company=company)
            u.set_password("admin123")
            u.save()
            print(f"Created {email}")
        else:
            print(f"Exists {email}")

if __name__ == "__main__":
    run()
