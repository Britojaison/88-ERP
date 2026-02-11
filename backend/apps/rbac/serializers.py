"""
Serializers for RBAC API.
"""
from rest_framework import serializers
from .models import Permission, Role, RolePermission, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            "id",
            "code",
            "module",
            "action",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RolePermissionSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source="permission.code", read_only=True)

    class Meta:
        model = RolePermission
        fields = [
            "id",
            "role",
            "permission",
            "permission_code",
            "conditions",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "company",
            "code",
            "name",
            "description",
            "permissions",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_permissions(self, obj):
        return list(
            RolePermission.objects.filter(role=obj, status="active")
            .select_related("permission")
            .values_list("permission__code", flat=True)
        )


class UserRoleSerializer(serializers.ModelSerializer):
    role_code = serializers.CharField(source="role.code", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = UserRole
        fields = [
            "id",
            "user",
            "user_email",
            "role",
            "role_code",
            "business_unit",
            "location",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
