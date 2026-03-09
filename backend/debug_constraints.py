import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'mdm_product' ORDER BY ordinal_position;")
    rows = cursor.fetchall()
    for row in rows:
        print(f"{row[0]} | {row[1]} | {row[2]}")
