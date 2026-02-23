#!/usr/bin/env python3
"""
Create a demo admin user for the ERP system.
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.mdm.models import Company

User = get_user_model()

def create_demo_user():
    email = "admin@88erp.com"
    password = "admin123"
    
    # Check if user already exists
    if User.objects.filter(email=email).exists():
        print(f"✓ User {email} already exists")
        user = User.objects.get(email=email)
    else:
        # Create user
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name="Admin",
            last_name="User",
            is_staff=True,
            is_superuser=True
        )
        print(f"✓ Created user: {email}")
    
    # Ensure there's at least one company
    if not Company.objects.exists():
        company = Company.objects.create(
            code="88GB",
            name="88 Global Business",
            legal_name="88 Global Business Ltd",
            currency="INR",
            status="active"
        )
        print(f"✓ Created company: {company.name}")
    else:
        company = Company.objects.first()
        print(f"✓ Using existing company: {company.name}")
    
    print("\n" + "="*50)
    print("Demo user credentials:")
    print(f"Email: {email}")
    print(f"Password: {password}")
    print("="*50)

if __name__ == "__main__":
    create_demo_user()
