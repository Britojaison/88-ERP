#!/usr/bin/env python3
import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.mdm.models import Company
from apps.rbac.models import Role, UserRole

User = get_user_model()

def run():
    try:
        print("Starting demo user creation...")
        
        # 1. Ensure Company exists
        company, created = Company.objects.get_or_create(
            code="88GB",
            defaults={
                "name": "88 Global Business",
                "legal_name": "88 Global Business Ltd",
                "currency": "INR",
                "status": "active"
            }
        )
        if created:
            print(f"[NEW] Created company: {company.name}")
        else:
            print(f"[OK] Using existing company: {company.name}")

        # 2. Define Demo Users and Roles
        # Format: email, name, role_name (sent to frontend), is_super
        demo_data = [
            {"email": "admin@88erp.com", "name": "Admin User", "role_name": "Admin", "is_super": True},
            {"email": "warehouse@88erp.com", "name": "Demo Warehouse", "role_name": "Warehouse", "is_super": False},
            {"email": "store@88erp.com", "name": "Demo Store", "role_name": "Store", "is_super": False},
            {"email": "designer@88erp.com", "name": "Demo Designer", "role_name": "Designer", "is_super": False},
            {"email": "ops@88erp.com", "name": "Ops User", "role_name": "Operations", "is_super": False},
        ]

        password = "admin123"

        for data in demo_data:
            print(f"Processing {data['email']}...")
            # Create/Get User
            user = User.objects.filter(email=data["email"]).first()
            if not user:
                user = User.objects.create_user(
                    email=data["email"],
                    username=data["email"],
                    password=password,
                    first_name=data["name"].split()[0],
                    last_name=data["name"].split()[1] if len(data["name"].split()) > 1 else "",
                    is_staff=data["is_super"],
                    is_superuser=data["is_super"],
                    company=company,
                    role=data["role_name"] # Set the role field!
                )
                print(f"  [NEW] Created user: {data['email']}")
            else:
                user.set_password(password)
                user.is_superuser = data["is_super"]
                user.is_staff = data["is_super"]
                user.company = company
                user.role = data["role_name"] # Update the role field!
                user.save()
                print(f"  [OK] Updated user: {data['email']}")

            # Create/Get Role record in RBAC system as well for consistency
            rbac_role_code = data["role_name"].lower()
            role, r_created = Role.objects.get_or_create(
                company=company,
                code=rbac_role_code,
                defaults={"name": data["role_name"]}
            )
            if r_created:
                print(f"  [NEW] Created RBAC role: {rbac_role_code}")

            # Assign RBAC Role to User
            ur, ur_created = UserRole.objects.get_or_create(
                user=user,
                role=role
            )
            if ur_created:
                print(f"  [NEW] Assigned RBAC role {rbac_role_code} to {data['email']}")

        print("\n" + "="*50)
        print("DEMO SETUP COMPLETE")
        print("All users can log in with password: admin123")
        print("="*50)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    run()
