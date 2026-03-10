
import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def debug():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            WHERE conname LIKE 'shopify_sync_job%'
        """)
        constraints = cursor.fetchall()
        for name, definition in constraints:
            if 'CHECK' in definition:
                print(f"NAME: {name}")
                print(f"DEF: {definition}")

if __name__ == "__main__":
    debug()
