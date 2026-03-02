import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { DEFAULT_ROLES } from '../constants/permissions';

export const usePermissions = () => {
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

    const userPermissions = useMemo(() => {
        if (isAdmin) return null; // Admin has all permissions

        // Get roles from localStorage or fallback to defaults
        let roles = DEFAULT_ROLES;
        const storedRoles = localStorage.getItem('metadata_permission_roles');
        if (storedRoles) {
            try {
                const parsed = JSON.parse(storedRoles);
                if (Array.isArray(parsed)) roles = parsed;
            } catch (e) {
                console.error('Failed to parse roles from localStorage', e);
            }
        }

        const userRole = roles.find((r: any) => r.code.toLowerCase() === currentUser?.role?.toLowerCase());
        return userRole?.permissions || [];
    }, [currentUser, isAdmin]);

    const hasPermission = (permission: string) => {
        if (isAdmin) return true;
        if (!userPermissions) return false;
        return userPermissions.includes(permission);
    };

    const hasAnyPermission = (permissions: string[]) => {
        if (isAdmin) return true;
        if (!userPermissions) return false;
        return permissions.some(p => userPermissions.includes(p));
    };

    return { hasPermission, hasAnyPermission, isAdmin, userPermissions };
};
