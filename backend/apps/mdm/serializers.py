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
    class Meta:
        model = SKU
        fields = '__all__'
        extra_kwargs = {'company': {'required': False}}
        validators = []


class SKUBarcodeSerializer(serializers.ModelSerializer):
    barcode_value = serializers.CharField(max_length=255, required=False, allow_blank=True)
    
    class Meta:
        model = SKUBarcode
        fields = [
            'id', 'company', 'sku', 'sku_code', 'barcode_type', 'barcode_value',
            'is_primary', 'display_code', 'label_title', 'size_label',
            'selling_price', 'mrp', 'status', 'created_at', 'updated_at'
        ]
        extra_kwargs = {'company': {'required': False}}
        validators = []
    
    def validate(self, attrs):
        """Validate barcode assignment fields."""
        # Validate display_code is required
        display_code = attrs.get('display_code')
        if not display_code or not display_code.strip():
            raise serializers.ValidationError({
                'display_code': 'Display Code is required.'
            })
        
        # Validate label_title is required
        label_title = attrs.get('label_title')
        if not label_title or not label_title.strip():
            raise serializers.ValidationError({
                'label_title': 'Label Title is required.'
            })
        
        # size_label is optional
        
        # Validate selling_price is required and positive
        selling_price = attrs.get('selling_price')
        if selling_price is None:
            raise serializers.ValidationError({
                'selling_price': 'Selling Price is required.'
            })
        try:
            selling_price = float(selling_price)
            if selling_price <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise serializers.ValidationError({
                'selling_price': 'Selling Price must be a positive number.'
            })
        
        # Validate mrp is required and positive
        mrp = attrs.get('mrp')
        if mrp is None:
            raise serializers.ValidationError({
                'mrp': 'MRP is required.'
            })
        try:
            mrp = float(mrp)
            if mrp <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise serializers.ValidationError({
                'mrp': 'MRP must be a positive number.'
            })
        
        # Validate selling_price <= mrp
        if selling_price > mrp:
            raise serializers.ValidationError({
                'selling_price': 'Selling Price cannot be greater than MRP.'
            })
        
        return attrs
