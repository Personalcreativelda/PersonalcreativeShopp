import React from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

interface ProtectedActionProps {
 /** Single permission or array of permissions required */
 permission: string | string[];
 /** If true, requires ALL permissions. If false, requires ANY permission (default: false) */
 requireAll?: boolean;
 /** Component to render if user doesn't have permission */
 fallback?: React.ReactNode;
 /** If true, shows the element but disabled. If false, hides completely (default: false) */
 showDisabled?: boolean;
 /** Children to render if user has permission */
 children: React.ReactNode | ((hasPermission: boolean) => React.ReactNode);
}

/**
 * ProtectedAction Component
 * 
 * Protects UI elements based on user permissions.
 * Can hide elements completely or show them as disabled.
 * 
 * @example
 * // Hide delete button if user doesn't have permission
 * <ProtectedAction permission="products.delete">
 * <button onClick={handleDelete}>Delete</button>
 * </ProtectedAction>
 * 
 * @example
 * // Show button as disabled if user doesn't have permission
 * <ProtectedAction permission="products.edit" showDisabled>
 * {(hasPermission) => (
 * <button disabled={!hasPermission} onClick={handleEdit}>
 * Edit
 * </button>
 * )}
 * </ProtectedAction>
 * 
 * @example
 * // Require ANY of multiple permissions
 * <ProtectedAction permission={['sales.edit', 'sales.edit.all']}>
 * <button onClick={handleEdit}>Edit Sale</button>
 * </ProtectedAction>
 * 
 * @example
 * // Require ALL permissions
 * <ProtectedAction permission={['products.view', 'products.edit']} requireAll>
 * <ProductEditor />
 * </ProtectedAction>
 */
export const ProtectedAction: React.FC<ProtectedActionProps> = ({
 permission,
 requireAll = false,
 fallback = null,
 showDisabled = false,
 children,
}) => {
 const { user } = useAuth();
 const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions(user);

 // While loading, show nothing or fallback
 if (isLoading) {
 return <>{fallback}</>;
 }

 // Determine if user has required permission(s)
 let hasRequiredPermission = false;

 if (Array.isArray(permission)) {
 hasRequiredPermission = requireAll
 ? hasAllPermissions(permission)
 : hasAnyPermission(permission);
 } else {
 hasRequiredPermission = hasPermission(permission);
 }

 // If user doesn't have permission
 if (!hasRequiredPermission) {
 // Show disabled version if requested
 if (showDisabled && typeof children === 'function') {
 return <>{children(false)}</>;
 }
 // Otherwise show fallback or nothing
 return <>{fallback}</>;
 }

 // User has permission, render children
 if (typeof children === 'function') {
 return <>{children(true)}</>;
 }

 return <>{children}</>;
};
