#!/bin/bash

# Create remaining app directories and basic files
apps=("documents" "inventory" "config" "rules" "events" "numbering" "calendar" "reporting" "imports" "search" "integrations")

for app in "${apps[@]}"; do
    mkdir -p "apps/$app"
    
    # __init__.py
    echo "default_app_config = 'apps.$app.apps.${app^}Config'" > "apps/$app/__init__.py"
    
    # apps.py
    cat > "apps/$app/apps.py" << APPPY
from django.apps import AppConfig


class ${app^}Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.$app'
    verbose_name = '${app^}'
APPPY
    
    # models.py
    echo "from django.db import models" > "apps/$app/models.py"
    echo "from apps.core.models import BaseModel, TenantAwareModel, ActiveManager" >> "apps/$app/models.py"
    echo "" >> "apps/$app/models.py"
    echo "# Models for $app module" >> "apps/$app/models.py"
    
    # admin.py
    echo "from django.contrib import admin" > "apps/$app/admin.py"
    echo "# Register your models here" >> "apps/$app/admin.py"
    
    # urls.py
    cat > "apps/$app/urls.py" << URLSPY
from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()

urlpatterns = [
    path('', include(router.urls)),
]
URLSPY
    
    echo "Created $app app structure"
done

echo "All remaining apps created successfully!"
