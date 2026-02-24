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
    Fabric,
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
        fields = [
            'id', 'company', 'product', 'product_code', 'product_name', 'style',
            'code', 'name', 'base_price', 'cost_price', 'weight', 'size',
            'is_serialized', 'is_batch_tracked', 'status', 'created_at', 'updated_at'
        ]
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
        fields = [
            'id', 'company', 'sku', 'sku_code', 'product_name', 'barcode_type', 'barcode_value',
            'is_primary', 'display_code', 'label_title', 'size_label',
            'selling_price', 'mrp', 'status', 'created_at', 'updated_at'
        ]
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


class FabricSerializer(serializers.ModelSerializer):
    remaining_meters = serializers.SerializerMethodField()
    vendor_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    sku_code = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Fabric
        fields = [
            'id', 'company', 'code', 'name', 'color', 'fabric_type',
            'total_meters', 'used_meters', 'remaining_meters', 'cost_per_meter',
            'photo', 'photo_url',
            'approval_status', 'approved_by', 'approved_by_name', 'approval_date',
            'rejection_reason',
            'dispatch_unit', 'vendor', 'vendor_name', 'notes',
            'sku', 'sku_code',
            'status', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'company': {'required': False},
            'photo': {'required': False},
            'code': {'required': False},
            'sku': {'required': False},
        }
        validators = []

    def get_remaining_meters(self, obj):
        return float(obj.total_meters) - float(obj.used_meters)

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_vendor_name(self, obj):
        if obj.vendor:
            return obj.vendor.name
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_sku_code(self, obj):
        if obj.sku:
            return obj.sku.code
        return None
