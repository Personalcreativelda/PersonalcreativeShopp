/**
 * Tipos de autenticação e utilizador
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AUDITOR = 'AUDITOR',
  GERENTE = 'GERENTE',
  SUPERVISOR = 'SUPERVISOR',
  FINANCEIRO = 'FINANCEIRO',
  CONTABILISTA = 'CONTABILISTA',
  GESTOR_VENDAS = 'GESTOR_VENDAS',
  GESTOR_STOCK = 'GESTOR_STOCK',
  VENDEDOR = 'VENDEDOR',
  CLIENTE = 'CLIENTE',
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles?: string[];
  roleDisplayName?: string;
  phone?: string;
  avatar?: string;
  customerId?: string;
  locationId?: string;
  displayName?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
  /** Se true, o utilizador é um super administrador (acesso total). */
  isSuperAdmin?: boolean;
  /** Se true, o utilizador deve definir uma senha forte no próximo acesso (modal obrigatório). */
  requiresStrongPassword?: boolean;
  /** Pontos acumulados pelo utilizador (programa de fidelidade). */
  points?: number;
  totalPointsEarned?: number;
};

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  level: number; // Hierarchy level (0 = SUPER_ADMIN, higher = lower privilege)
  isSystemRole?: boolean;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
  tenantId?: string;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  assignedBy?: string;
  assignedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  createdAt?: string;
}

export interface PendingApproval {
  id: string;
  actionType: string; // 'delete_product', 'adjust_stock', 'high_discount', etc.
  entityType: string; // 'product', 'sale', 'stock_adjustment', etc.
  entityId: string;
  entityData?: any; // Snapshot of entity data for preview
  requestedBy: string;
  requestedAt: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  approvalLevel?: number; // 1-6 based on approval hierarchy
  tenantId?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: string; // 'create', 'update', 'delete', 'login', 'logout', etc.
  entityType: string; // 'product', 'sale', 'user', etc.
  entityId?: string;
  entityName?: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  tenantId?: string;
}
