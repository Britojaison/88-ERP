import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.inventory.models import InventoryBalance
from apps.sales.models import SalesTransactionLine
from decimal import Decimal
from collections import defaultdict

# Step 1: Find all sellable returns and sum up quantities per SKU+store
restocked = defaultdict(Decimal)
returned_lines = SalesTransactionLine.objects.filter(
    is_returned=True,
).select_related('sku', 'transaction__store')

for line in returned_lines:
    cond = line.return_condition or 'sellable'
    if cond != 'damaged':
        key = (line.sku_id, line.transaction.store_id)
        restocked[key] += line.quantity

# Step 2: Check the current balances for these items
with open("inv_debug.txt", "w") as f:
    f.write("=== RETURNED (SELLABLE) LINE ITEMS ===\n")
    for line in returned_lines:
        cond = line.return_condition or 'sellable'
        if cond != 'damaged':
            f.write(f"SKU: {line.sku.code} | Store: {line.transaction.store.code} | Qty returned: {line.quantity} | Reason: {line.return_reason}\n")
    
    f.write("\n=== EXPECTED RESTOCKED AMOUNTS ===\n")
    for (sku_id, store_id), total in restocked.items():
        bal = InventoryBalance.objects.filter(sku_id=sku_id, location_id=store_id, condition='new').first()
        current = bal.quantity_on_hand if bal else Decimal('0')
        f.write(f"SKU_ID: {sku_id} | Store_ID: {store_id} | Total should be restocked: {total} | Current balance: {current}\n")
        
        # Fix: if current balance is less than the total restocked, update it
        if bal and current < total:
            bal.quantity_on_hand = total
            bal.quantity_available = total - bal.quantity_reserved
            bal.save()
            f.write(f"  -> FIXED: Set balance to {total}\n")
        elif not bal:
            f.write(f"  -> ERROR: No balance row found with condition=new!\n")
    
    f.write("\n=== FINAL BALANCES AT STORE ===\n")
    all_bals = InventoryBalance.objects.filter(
        location__code='store-04', status='active'
    ).select_related('sku')
    for b in all_bals:
        f.write(f"{b.sku.code} | cond={b.condition} | hand={b.quantity_on_hand} | avail={b.quantity_available}\n")

print("Done - check inv_debug.txt")
