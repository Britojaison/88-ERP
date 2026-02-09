from django.contrib import admin
from .models import Permission, Role, RolePermission, UserRole, PermissionRule


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['code', 'module', 'action', 'status']
    search_fields = ['code', 'module', 'action']
    list_filter = ['module', 'status']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'status']


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ['role', 'permission', 'status']
    search_fields = ['role__code', 'permission__code']
    list_filter = ['role', 'status']


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'business_unit', 'location', 'status']
    search_fields = ['user__email', 'role__code']
    list_filter = ['role', 'status']


@admin.register(PermissionRule)
class PermissionRuleAdmin(admin.ModelAdmin):
    list_display = ['role', 'permission', 'priority', 'company', 'status']
    search_fields = ['role__code', 'permission__code']
    list_filter = ['company', 'role', 'status']
