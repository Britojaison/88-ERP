"""
MDM Serializers for API views.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    Company,
    BusinessUnit,
    Location,
    User,
    Customer,
    Vendor,
    Product,
    Style,
    SKU,
    SKUBarcode,
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer that includes user information."""
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user information to the response
        data['user'] = {
            'id': str(self.user.id),
            'email': self.user.email,
            'name': self.user.get_full_name() or self.user.username,
            'role': 'Admin' if self.user.is_superuser else 'User',
        }
        
        return data


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'


class BusinessUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessUnit
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'company', 'is_staff', 'is_active']
        read_only_fields = ['id']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class StyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Style
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class SKUSerializer(serializers.ModelSerializer):
    product_code = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SKU
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []
    
    def get_product_code(self, obj):
        """Get the product code."""
        if obj.product:
            return obj.product.code
        return None
    
    def get_product_name(self, obj):
        """Get the product name."""
        if obj.product:
            return obj.product.name
        return None


class SKUBarcodeSerializer(serializers.ModelSerializer):
    barcode_value = serializers.CharField(max_length=255, required=False, allow_blank=True)
    product_name = serializers.SerializerMethodField()
    sku_code = serializers.SerializerMethodField()
    
    class Meta:
        model = SKUBarcode
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []
    
    def get_product_name(self, obj):
        """Get the product name from the related SKU."""
        if obj.sku and obj.sku.product:
            return obj.sku.product.name
        return None
    
    def get_sku_code(self, obj):
        """Get the SKU code."""
        if obj.sku:
            return obj.sku.code
        return None
    
    def validate(self, attrs):
        """Validate barcode assignment fields."""
        # Validate display_code is required
        if not attrs.get('display_code') or not attrs.get('display_code').strip():
            raise serializers.ValidationError({
                'display_code': 'Display Code is required.'
            })
        
        # Validate label_title is required
        if not attrs.get('label_title') or not attrs.get('label_title').strip():
            raise serializers.ValidationError({
                'label_title': 'Label Title is required.'
            })
        
        # Validate size_label is required
        if not attrs.get('size_label') or not attrs.get('size_label').strip():
            raise serializers.ValidationError({
                'size_label': 'Size Label is required.'
            })
        
        # Validate selling_price is required and positive
        selling_price = attrs.get('selling_price')
        if selling_price is None:
            raise serializers.ValidationError({
                'selling_price': 'Selling Price is required.'
            })
        if selling_price <= 0:
            raise serializers.ValidationError({
                'selling_price': 'Selling Price must be greater than zero.'
            })
        
        # Validate mrp is required and positive
        mrp = attrs.get('mrp')
        if mrp is None:
            raise serializers.ValidationError({
                'mrp': 'MRP is required.'
            })
        if mrp <= 0:
            raise serializers.ValidationError({
                'mrp': 'MRP must be greater than zero.'
            })
        
        # Validate selling_price <= mrp
        if selling_price > mrp:
            raise serializers.ValidationError({
                'selling_price': 'Selling Price cannot be greater than MRP.'
            })
        
        return attrs
