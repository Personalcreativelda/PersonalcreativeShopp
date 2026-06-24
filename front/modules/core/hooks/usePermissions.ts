import { useState, useEffect, useCallback } from 'react';
import { User } from '../../core/types/types';
import api from '../../core/services/apiClient';

interface UsePermissionsReturn {
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissionNames: string[]) => boolean;
  hasAllPermissions: (permissionNames: string[]) => boolean;
  isLoading: boolean;
  permissions: string[];
  refreshPermissions: () => Promise<void>;
}

// Cache de permisséµes por usué¡rio
const permissionsCache: Record<string, { permissions: string[]; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Funçéo para limpar cache de um usué¡rio especé­fico (exportada para uso externo)
export const clearUserPermissionsCache = (userId: string) => {
  delete permissionsCache[userId];
  console.log(`Cache de permisséµes limpo para usué¡rio: ${userId}`);
};

// Função para limpar todo o cache
export const clearAllPermissionsCache = () => {
  Object.keys(permissionsCache).forEach(key => delete permissionsCache[key]);
  console.log('Cache de permissões limpo para todos os utilizadores');
};

// Mapa de permissões por role — usado como fallback quando o backend falha
// Controla quais secções do sidebar cada role consegue ver
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  'GESTOR_BLOG': [
    'admin.access', 'dashboard.view',
    'media.view', 'media.upload', 'media.delete',
    'messaging.view',
  ],
  'GESTOR_VENDAS': [
    'admin.access', 'dashboard.view',
    'sales.view', 'sales.view.all', 'sales.create', 'sales.edit',
    'sales.discount', 'sales.reports',
    'customers.view', 'customers.create', 'customers.edit',
    'orders.view', 'orders.create', 'orders.edit', 'orders.update_status',
    'helpdesk.view', 'subscriptions.view',
    'messaging.view', 'documents.view',
  ],
  'VENDEDOR': [
    'admin.access', 'dashboard.view',
    'sales.view', 'sales.view.own', 'sales.create',
    'orders.view', 'orders.create',
    'customers.view',
    'timesheets.view',
    'messaging.view',
  ],
  'LOGISTICA': [
    'admin.access', 'dashboard.view',
    'logistics.manage',
    'orders.view', 'orders.edit', 'orders.update_status',
    'messaging.view',
  ],
  'AFILIADO': [
    'admin.access', 'dashboard.view',
    'messaging.view',
  ],
  'GERENTE': [
    'admin.access', 'dashboard.view', 'analytics.view',
    'sales.view', 'sales.view.all', 'sales.create', 'sales.edit',
    'products.view', 'products.create', 'products.edit',
    'purchases.view', 'purchases.create',
    'stock.view', 'stock.movements.view',
    'orders.view', 'orders.edit', 'orders.update_status',
    'customers.view', 'customers.create', 'customers.edit',
    'media.view', 'media.upload',
    'users.view',
    'finance.view',
    'hr.view', 'projects.view', 'helpdesk.view',
    'timesheets.view', 'messaging.view',
    'subscriptions.view', 'documents.view',
  ],
  'CONTABILISTA': [
    'admin.access', 'dashboard.view', 'analytics.view',
    'finance.view', 'finance.manage',
    'purchases.view',
    'orders.view',
    'messaging.view', 'documents.view',
  ],
  'FINANCEIRO': [
    'admin.access', 'dashboard.view', 'analytics.view',
    'finance.view', 'finance.manage',
    'purchases.view',
    'messaging.view', 'documents.view',
  ],
  'GESTOR_STOCK': [
    'admin.access', 'dashboard.view',
    'products.view', 'products.create', 'products.edit',
    'purchases.view', 'purchases.create',
    'stock.view', 'stock.adjust', 'stock.audit', 'stock.movements.view',
    'messaging.view',
  ],
  'STAFF': [
    'admin.access', 'dashboard.view',
    'sales.view', 'sales.view.own',
    'orders.view',
    'customers.view',
    'projects.view',
    'helpdesk.view',
    'timesheets.view',
    'messaging.view',
    'documents.view',
  ],
};

// Dado um array de role names, retorna as permissões combinadas do mapa local
function getPermissionsFromRoles(roleNames: string[]): string[] {
  const perms = new Set<string>();
  perms.add('admin.access'); // qualquer role não-CLIENTE acede à dashboard
  for (const role of roleNames) {
    const roleName = role.toUpperCase();
    const mapped = ROLE_PERMISSION_MAP[roleName];
    if (mapped) mapped.forEach(p => perms.add(p));
  }
  return Array.from(perms);
}

// Lista completa de todas as 96 permissões do sistema
const getAllPermissionsList = (): string[] => {
  return [
    // Dashboard (3)
    'dashboard.view', 'dashboard.export', 'analytics.view',

    // Sales (12)
    'sales.view', 'sales.view.own', 'sales.view.all', 'sales.create', 'sales.edit',
    'sales.edit.all', 'sales.delete', 'sales.approve', 'sales.cancel', 'sales.discount',
    'sales.discount.high', 'sales.reports',

    // Purchases (6)
    'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.delete',
    'purchases.approve', 'purchases.reports',

    // Products (7)
    'products.view', 'products.create', 'products.edit', 'products.delete',
    'products.manage_categories', 'products.manage_units', 'products.manage_pricing',

    // Stock (7)
    'stock.view', 'stock.adjust', 'stock.audit', 'stock.audit.approve',
    'stock.movements.view', 'stock.movements.create', 'stock.reports',

    // Customers (6)
    'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
    'customers.view_sensitive', 'customers.export',

    // Users (8)
    'users.view', 'users.create', 'users.edit', 'users.delete', 'users.deactivate',
    'users.manage_roles', 'users.reset_password', 'users.view_activity',

    // Financial (8)
    'financial.view', 'financial.edit', 'financial.approve', 'financial.reports',
    'financial.export', 'financial.accounts', 'financial.reconciliation', 'financial.taxes',

    // Accounting (6)
    'accounting.view', 'accounting.entries.create', 'accounting.entries.edit',
    'accounting.reports', 'accounting.balances', 'accounting.export',

    // Media (3)
    'media.view', 'media.upload', 'media.delete',

    // System (5)
    'system.settings', 'system.modules', 'system.backup', 'system.audit_logs',
    'system.audit_logs.export',

    // Approvals (3)
    'approvals.view', 'approvals.approve', 'approvals.reject',

    // Orders (5)
    'orders.view', 'orders.create', 'orders.edit', 'orders.delete', 'orders.update_status',

    // Shop (2)
    'shop.view', 'shop.order',

    // Novos módulos (8)
    'hr.view', 'hr.manage',
    'projects.view', 'projects.manage',
    'helpdesk.view', 'helpdesk.manage',
    'timesheets.view',
    'messaging.view',
    'subscriptions.view', 'subscriptions.manage',
    'documents.view', 'documents.manage',
    'finance.view', 'finance.manage',
  ];
};

export const usePermissions = (user: User | null): UsePermissionsReturn => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    const userRoles = user.roles || [user.role || 'STAFF'];

    // SUPER_ADMIN — todas as permissões localmente, sem chamada à API
    if (user.isSuperAdmin || userRoles.includes('SUPER_ADMIN')) {
      const all = getAllPermissionsList();
      setPermissions(all);
      permissionsCache[user.id] = { permissions: all, timestamp: Date.now() };
      setIsLoading(false);
      return;
    }

    // ADMIN — todas menos users.delete e system.backup
    if (userRoles.includes('ADMIN')) {
      const all = getAllPermissionsList().filter(p => p !== 'users.delete' && p !== 'system.backup');
      setPermissions(all);
      permissionsCache[user.id] = { permissions: all, timestamp: Date.now() };
      setIsLoading(false);
      return;
    }

    // Verificar cache
    const cached = permissionsCache[user.id];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPermissions(cached.permissions);
      setIsLoading(false);
      return;
    }

    // Primeiro aplicar o mapa local como base imediata (sem esperar API)
    const localPerms = getPermissionsFromRoles(userRoles);
    setPermissions(localPerms);
    setIsLoading(false);

    // Depois tentar enriquecer com permissões específicas da BD (best-effort)
    try {
      const data = await api.get<{ roles: string[]; permissions: string[] }>('/auth/my-permissions');
      if (data?.permissions?.length) {
        // Merge: local + BD, sem duplicados
        const merged = Array.from(new Set([...localPerms, ...data.permissions]));
        setPermissions(merged);
        permissionsCache[user.id] = { permissions: merged, timestamp: Date.now() };
      } else {
        permissionsCache[user.id] = { permissions: localPerms, timestamp: Date.now() };
      }
    } catch {
      permissionsCache[user.id] = { permissions: localPerms, timestamp: Date.now() };
    }
  }, [user]);

  useEffect(() => {
    loadPermissions();

    // Ouvir eventos de atualizaçéo de roles para limpar cache
    const handleRolesUpdated = (event: CustomEvent) => {
      const updatedUserId = event.detail?.userId;
      if (updatedUserId && updatedUserId === user?.id) {
        clearUserPermissionsCache(updatedUserId);
        loadPermissions();
      } else if (!updatedUserId) {
        // Se néo especificou userId, limpar cache de todos
        clearAllPermissionsCache();
        if (user) {
          loadPermissions();
        }
      }
    };

    window.addEventListener('roles-updated' as any, handleRolesUpdated);

    return () => {
      window.removeEventListener('roles-updated' as any, handleRolesUpdated);
    };
  }, [loadPermissions, user]);

  const hasPermission = useCallback((permissionName: string): boolean => {
    if (!user) return false;
    const userRoles = user.roles || [user.role || 'STAFF'];

    if (user.isSuperAdmin || userRoles.includes('SUPER_ADMIN')) return true;

    if (userRoles.includes('ADMIN')) {
      return permissionName !== 'users.delete' && permissionName !== 'system.backup';
    }

    // Verificar no state carregado (local + BD)
    if (permissions.includes(permissionName)) return true;

    // Fallback síncrono via mapa local (antes do state carregar)
    const localPerms = getPermissionsFromRoles(userRoles);
    return localPerms.includes(permissionName);
  }, [user, permissions]);

  const hasAnyPermission = useCallback((permissionNames: string[]): boolean => {
    return permissionNames.some(perm => hasPermission(perm));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissionNames: string[]): boolean => {
    return permissionNames.every(perm => hasPermission(perm));
  }, [hasPermission]);

  const refreshPermissions = useCallback(async () => {
    if (user) {
      delete permissionsCache[user.id];
      await loadPermissions();
    }
  }, [user, loadPermissions]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
    permissions,
    refreshPermissions
  };
};



