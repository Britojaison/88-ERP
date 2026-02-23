#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.sales.models import SalesTransaction
from django.db.models import Count, Sum

print("=" * 60)
print("SALES DATA SUMMARY")
print("=" * 60)

# Total transactions
total = SalesTransaction.objects.count()
print(f"\n✅ Total Transactions: {total:,}")

# By channel
print("\n📊 By Channel:")
channels = SalesTransaction.objects.values('sales_channel').annotate(
    count=Count('id'),
    revenue=Sum('total_amount')
).order_by('-count')

for ch in channels:
    channel_name = ch['sales_channel'].capitalize()
    count = ch['count']
    revenue = float(ch['revenue'] or 0)
    print(f"   {channel_name:12} {count:6,} transactions  ₹{revenue:15,.2f}")

# Total revenue
total_revenue = SalesTransaction.objects.aggregate(Sum('total_amount'))['total_amount__sum']
print(f"\n💰 Total Revenue: ₹{float(total_revenue or 0):,.2f}")

print("\n" + "=" * 60)
print("✅ Data generation successful!")
print("=" * 60)
