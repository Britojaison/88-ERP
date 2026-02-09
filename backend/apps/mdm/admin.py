from django.contrib import admin
from .models import (
    Company, BusinessUnit, Location, User,
    Customer, Vendor, Product, Style, SKU, ChartOfAccounts
)

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'currency', 'status', 'created_at']
    search_fields = ['code', 'name', 'legal_name']
    list_filter = ['status', 'currency']

@admin.register(BusinessUnit)
class BusinessUnitAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'status']

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'location_type', 'company', 'status']
    search_fields = ['code', 'name', 'city']
    list_filter = ['company', 'location_type', 'status']

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'username', 'company', 'is_active', 'status']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    list_filter = ['company', 'is_active', 'status']

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'company', 'credit_limit', 'status']
    search_fields = ['code', 'name', 'email']
    list_filter = ['company', 'status']

@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'company', 'status']
    search_fields = ['code', 'name', 'email']
    list_filter = ['company', 'status']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'status']

@admin.register(Style)
class StyleAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'product', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'status']

@admin.register(SKU)
class SKUAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'product', 'base_price', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'product', 'status']

@admin.register(ChartOfAccounts)
class ChartOfAccountsAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'account_type', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'account_type', 'status']
