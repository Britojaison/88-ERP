"""
API Views for RBAC Management.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Permission, Role, RolePermission, UserRole
from .serializers import (
    PermissionSerializer,
    RoleSerializer,
    RolePermissionSerializer,
    UserRoleSerializer,
)


class PermissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PermissionSerializer
    pagination_class = None

    def get_queryset(self):
        return Permission.objects.filter(status="active").order_by("module", "action")


class RoleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RoleSerializer
    pagination_class = None

    def get_queryset(self):
        return Role.objects.filter(
            company_id=self.request.user.company_id, status="active"
        ).order_by("code")

    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id)


class RolePermissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RolePermissionSerializer
    pagination_class = None

    def get_queryset(self):
        return RolePermission.objects.filter(
            role__company_id=self.request.user.company_id, status="active"
        ).select_related("role", "permission")


class UserRoleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserRoleSerializer
    pagination_class = None

    def get_queryset(self):
        return UserRole.objects.filter(
            user__company_id=self.request.user.company_id, status="active"
        ).select_related("user", "role", "business_unit", "location")
