import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Permission, Role } from '../types/auth';

/**
 * Serviço de Permissões
 * 
 * Fornece funções para gerenciar permissões, roles e verificações de acesso.
 */
export class PermissionsService {
    /**
     * Buscar todas as permissões de um utilizador
     */
    static async getUserPermissions(userId: string): Promise<string[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            // Buscar roles do utilizador
            const { data: userRoles, error: rolesError } = await supabase
                .from('user_roles')
                .select('role_id, roles(name)')
                .eq('user_id', userId);

            if (rolesError || !userRoles || userRoles.length === 0) {
                return [];
            }

            const roleIds = userRoles.map((ur: any) => ur.role_id);

            // Buscar permissões dos roles
            const { data: rolePermissions, error: permError } = await supabase
                .from('role_permissions')
                .select('permission_id, permissions(name)')
                .in('role_id', roleIds);

            if (permError || !rolePermissions) {
                return [];
            }

            // Extrair nomes das permissões (sem duplicatas)
            const permissions = new Set<string>();
            rolePermissions.forEach((rp: any) => {
                if (rp.permissions?.name) {
                    permissions.add(rp.permissions.name);
                }
            });

            return Array.from(permissions);
        } catch (error) {
            console.error('Erro ao buscar permissões do utilizador:', error);
            return [];
        }
    }

    /**
     * Buscar todos os roles de um utilizador
     */
    static async getUserRoles(userId: string): Promise<Role[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('user_roles')
                .select(`
          role_id,
          roles (
            id,
            name,
            display_name,
            description,
            level,
            is_system_role
          )
        `)
                .eq('user_id', userId);

            if (error || !data) {
                return [];
            }

            return data.map((ur: any) => ({
                id: ur.roles.id,
                name: ur.roles.name,
                displayName: ur.roles.display_name,
                description: ur.roles.description,
                level: ur.roles.level,
                isSystemRole: ur.roles.is_system_role,
            }));
        } catch (error) {
            console.error('Erro ao buscar roles do utilizador:', error);
            return [];
        }
    }

    /**
     * Buscar permissões de um role específico
     */
    static async getRolePermissions(roleId: string): Promise<Permission[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select(`
          permission_id,
          permissions (
            id,
            name,
            display_name,
            description,
            category
          )
        `)
                .eq('role_id', roleId);

            if (error || !data) {
                return [];
            }

            return data.map((rp: any) => ({
                id: rp.permissions.id,
                name: rp.permissions.name,
                displayName: rp.permissions.display_name,
                description: rp.permissions.description,
                category: rp.permissions.category,
            }));
        } catch (error) {
            console.error('Erro ao buscar permissões do role:', error);
            return [];
        }
    }

    /**
     * Verificar se um utilizador tem uma permissão específica
     */
    static async checkPermission(userId: string, permissionName: string): Promise<boolean> {
        const permissions = await this.getUserPermissions(userId);
        return permissions.includes(permissionName);
    }

    /**
     * Buscar todas as permissões disponíveis no sistema
     */
    static async getAllPermissions(): Promise<Permission[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('permissions')
                .select('id, name, display_name, description, category')
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (error || !data) {
                return [];
            }

            return data.map((p: any) => ({
                id: p.id,
                name: p.name,
                displayName: p.display_name,
                description: p.description,
                category: p.category,
            }));
        } catch (error) {
            console.error('Erro ao buscar todas as permissões:', error);
            return [];
        }
    }

    /**
     * Buscar todos os roles disponíveis no sistema
     */
    static async getAllRoles(): Promise<Role[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('roles')
                .select('id, name, display_name, description, level, is_system_role')
                .order('level', { ascending: true });

            if (error || !data) {
                return [];
            }

            return data.map((r: any) => ({
                id: r.id,
                name: r.name,
                displayName: r.display_name,
                description: r.description,
                level: r.level,
                isSystemRole: r.is_system_role,
            }));
        } catch (error) {
            console.error('Erro ao buscar todos os roles:', error);
            return [];
        }
    }

    /**
     * Obter o nível hierárquico mais alto de um utilizador
     * (menor número = maior privilégio)
     */
    static async getUserHighestRoleLevel(userId: string): Promise<number | null> {
        const roles = await this.getUserRoles(userId);
        if (roles.length === 0) return null;

        return Math.min(...roles.map(r => r.level));
    }

    /**
     * Verificar se um utilizador pode aprovar ações de um determinado nível
     * (utilizador deve ter nível menor ou igual ao nível de aprovação)
     */
    static async canApprove(userId: string, approvalLevel: number): Promise<boolean> {
        const userLevel = await this.getUserHighestRoleLevel(userId);
        if (userLevel === null) return false;

        return userLevel <= approvalLevel;
    }
}

export const permissionsService = PermissionsService;
