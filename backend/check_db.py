import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Product, SKU

with open('check_db_output.txt', 'w', encoding='utf-8') as f:
    f.write("Latest 5 Products:\n")
    products = Product.objects.all().order_by('-created_at')[:5]
    for p in products:
        f.write(f"- {p.code}: {p.name}\n")
        skus = SKU.objects.filter(product=p)
        if skus.exists():
            for s in skus:
                f.write(f"  -> SKU: {s.code}, {s.name}, size: {s.size}\n")
        else:
            f.write("  -> No SKUs found for this product.\n")

    f.write("\nLatest 5 SKUs total:\n")
    skus = SKU.objects.all().order_by('-created_at')[:5]
    for s in skus:
        f.write(f"- {s.code}: {s.name} (Product: {s.product.name if s.product else 'None'})\n")
