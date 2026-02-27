import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.inventory.models import InventoryBalance
from apps.sales.models import SalesTransactionLine

lines = SalesTransactionLine.objects.filter(is_returned=True).select_related("sku", "transaction__store")
print("\n--- INVENTORY VERIFICATION ---")
for l in lines:
    cond = l.return_condition or 'sellable'
    if cond == 'sellable':
        cond_val = 'new'
    else:
        cond_val = 'damaged'
    bal = InventoryBalance.objects.filter(sku=l.sku, location=l.transaction.store, condition=cond_val).first()
    qty = bal.quantity_available if bal else 0
    print(f"SKU {l.sku.code} | Return Condition: {cond} | Inventory Balance ({cond_val}): {qty}")
print("--- END ---\n")
