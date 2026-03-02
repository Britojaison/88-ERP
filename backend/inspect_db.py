#!/usr/bin/env python3
import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

cursor = connection.cursor()
cursor.execute("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'mdm_user' ORDER BY ordinal_position")
for row in cursor.fetchall():
    print(f"COL: {row[0]} | NULLABLE: {row[1]} | DEFAULT: {row[2]}")
