from apps.mdm.models import SKU
from django.db.models import Sum

# Set some standard alerts (min stock level > current stock)
standard_skus = SKU.objects.filter(status='active', is_best_seller=False)[:3]
scount = 0
for sku in standard_skus:
    sku.min_stock_level = 10
    sku.save(update_fields=['min_stock_level'])
    scount += 1
print(f"Updated {scount} standard SKUs for alerts.")

# Set some critical alerts (min stock level > current stock + is_best_seller=True)
critical_skus = SKU.objects.filter(status='active', is_best_seller=True)[:2]
if not critical_skus.exists():
    critical_skus = SKU.objects.filter(status='active', is_best_seller=False)[3:5]
ccount = 0
for sku in critical_skus:
    sku.min_stock_level = 20
    sku.is_best_seller = True
    sku.save(update_fields=['min_stock_level', 'is_best_seller'])
    ccount += 1
print(f"Updated {ccount} critical SKUs for alerts.")
