import { User, UserRole } from '../../core/types/types';

/**
 * Verifica se o usué¡rio é© um cliente
 */
export const isClientUser = (user: User | null): boolean => {
  if (!user) return false;
  const userRoles = user.roles || [user.role];
  return userRoles.includes('CLIENTE');
};

/**
 * Verifica se o usué¡rio é© staff/admin (néo cliente)
 */
export const isStaffUser = (user: User | null): boolean => {
  if (!user) return false;
  const userRoles = user.roles || [user.role];
  return !userRoles.includes('CLIENTE') && userRoles.some(role =>
    ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'CONTABILISTA', 'GESTOR_STOCK', 'GESTOR_VENDAS', 'GESTOR_ENTREGAS'].includes(role)
  );
};

/**
 * Verifica se o usué¡rio pode gerenciar outros usué¡rios
 */
export const canManageUsers = (user: User | null): boolean => {
  if (!user) return false;
  // Super Admin (via flag ou role) pode gerir utilizadores
  if ((user as any).isSuperAdmin === true) return true;
  const userRoles = user.roles || [user.role];
  return userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
};

/**
 * Verifica se o usué¡rio pode ver um perfil especé­fico
 */
export const canViewProfile = (currentUser: User | null, targetUserId: string): boolean => {
  if (!currentUser) return false;

  // Usué¡rio sempre pode ver seu pré³prio perfil
  if (currentUser.id === targetUserId) return true;

  // Clientes sé³ podem ver seu pré³prio perfil
  if (isClientUser(currentUser)) return false;

  // Staff pode ver todos os perfis
  if (isStaffUser(currentUser)) return true;

  return false;
};

/**
 * Verifica se o usué¡rio tem uma role especé­fica
 */
export const hasRole = (user: User | null, role: UserRole | string): boolean => {
  if (!user) return false;
  const userRoles = user.roles || [user.role];
  return userRoles.includes(role);
};

/**
 * Verifica se o usué¡rio tem qualquer uma das roles especificadas
 */
export const hasAnyRole = (user: User | null, roles: (UserRole | string)[]): boolean => {
  if (!user) return false;
  const userRoles = user.roles || [user.role];
  return roles.some(role => userRoles.includes(role));
};

/**
 * Hook React para usar funçéµes de permissão
 */
export const useUserPermissions = (user: User | null) => {
  return {
    isClientUser: () => isClientUser(user),
    isStaffUser: () => isStaffUser(user),
    canManageUsers: () => canManageUsers(user),
    canViewProfile: (targetUserId: string) => canViewProfile(user, targetUserId),
    hasRole: (role: UserRole | string) => hasRole(user, role),
    hasAnyRole: (roles: (UserRole | string)[]) => hasAnyRole(user, roles),
  };
};


