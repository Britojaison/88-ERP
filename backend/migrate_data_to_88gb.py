import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import Company, Product, SKU, SKUBarcode, Location, BusinessUnit

def migrate():
    source_code = "SHOPIFY"
    target_code = "88GB"
    
    target_comp = Company.objects.get(code=target_code)
    source_comp = Company.objects.filter(code=source_code).first()
    
    if not source_comp:
        print("Source company SHOPIFY not found.")
        return

    print(f"Migrating data from {source_code} to {target_code}...")
    
    # Update related records
    p_count = Product.objects.filter(company=source_comp).update(company=target_comp)
    s_count = SKU.objects.filter(company=source_comp).update(company=target_comp)
    b_count = SKUBarcode.objects.filter(company=source_comp).update(company=target_comp)
    l_count = Location.objects.filter(company=source_comp).update(company=target_comp)
    bu_count = BusinessUnit.objects.filter(company=source_comp).update(company=target_comp)
    
    print(f"Updated Products: {p_count}")
    print(f"Updated SKUs: {s_count}")
    print(f"Updated Barcodes: {b_count}")
    print(f"Updated Locations: {l_count}")
    print(f"Updated Business Units: {bu_count}")
    
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
