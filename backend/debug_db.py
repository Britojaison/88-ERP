#!/usr/bin/env python3
import os
import django
from django.db import IntegrityError

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.mdm.models import User

try:
    User.objects.create(email='debug@test.com', username='debug@test.com')
except IntegrityError as e:
    print(f"INTEGRITY ERROR: {e}")
except Exception as e:
    print(f"OTHER ERROR: {e}")
