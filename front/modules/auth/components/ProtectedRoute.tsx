import React from 'react';
import { User } from '../../core/types/types';
import { usePermissions } from '../../core/hooks/usePermissions';
import { Lock, AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  user: User | null;
  permission?: string;
  permissions?: string[]; // Para verificar méºltiplas permisséµes (OR)
  requireAll?: boolean; // Se true, requer todas as permisséµes (AND), senéo requer qualquer uma (OR)
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  permission,
  permissions,
  requireAll = false,
  children,
  fallback
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions(user);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Lock className="h-12 w-12 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400">Vocéª precisa estar autenticado para acessar esta pé¡gina.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions);
    } else {
      hasAccess = hasAnyPermission(permissions);
    }
  } else {
    // Se néo especificou permissão, permitir acesso (compatibilidade)
    hasAccess = true;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 p-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded w-full max-w-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400 dark:text-yellow-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Acesso Negado
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>Vocéª néo tem permissão para acessar esta pé¡gina.</p>
                <p className="mt-2">Entre em contato com o administrador para solicitar acesso.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};


