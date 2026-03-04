import os
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Product, Company, SKU

def test_create():
    try:
        company = Company.objects.first()
        if not company:
            print("No company found.")
            return

        code = f"TEST-{uuid.uuid4().hex[:6]}"
        print(f"Creating product with code {code}...")
        p = Product.objects.create(
            company=company,
            code=code,
            name="Test Product",
            status="active"
        )
        print(f"Product created: {p.id}")

        sku_code = f"SKU-{uuid.uuid4().hex[:6]}"
        print(f"Creating SKU with code {sku_code}...")
        s = SKU.objects.create(
            company=company,
            product=p,
            code=sku_code,
            name="Test SKU",
            base_price=10.0,
            cost_price=5.0,
            status="active"
        )
        print(f"SKU created: {s.id}")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_create()
