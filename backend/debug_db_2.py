#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import User

user = User(email='debug2@test.com', username='debug2@test.com')
print(f"DEBUG: User email={user.email}, username={user.username}")
try:
    user.save()
except Exception as e:
    print(f"ERROR: {e}")
