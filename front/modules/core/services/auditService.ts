import { supabase, isSupabaseConfigured } from './supabaseClient';
import { AuditLog } from '../types/auth';
import { getClientIP, getUserAgent, sanitizeData } from '../utils/auditUtils';

/**
 * Serviço de Auditoria
 * 
 * Registra todas as ações do sistema para rastreabilidade completa.
 */
export class AuditService {
    /**
     * Registrar ação genérica
     */
    static async logAction(params: {
        userId?: string;
        userName?: string;
        userEmail?: string;
        action: string;
        entityType: string;
        entityId?: string;
        entityName?: string;
        oldData?: any;
        newData?: any;
    }): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured() || !supabase) {
            console.warn('Supabase não configurado - auditoria não registrada');
            return { success: false, error: 'Supabase não configurado' };
        }

        try {
            const ipAddress = await getClientIP();
            const userAgent = getUserAgent();

            // Sanitizar dados sensíveis
            const sanitizedOldData = params.oldData ? sanitizeData(params.oldData) : null;
            const sanitizedNewData = params.newData ? sanitizeData(params.newData) : null;

            const { error } = await supabase.from('audit_logs').insert({
                user_id: params.userId || null,
                user_name: params.userName || null,
                user_email: params.userEmail || null,
                action: params.action,
                entity_type: params.entityType,
                entity_id: params.entityId || null,
                entity_name: params.entityName || null,
                old_data: sanitizedOldData,
                new_data: sanitizedNewData,
                ip_address: ipAddress,
                user_agent: userAgent,
            });

            if (error) {
                console.error('Erro ao registrar auditoria:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error: any) {
            console.error('Erro ao registrar auditoria:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Registrar criação de entidade
     */
    static async logCreate(params: {
        userId: string;
        userName?: string;
        userEmail?: string;
        entityType: string;
        entityId: string;
        entityName?: string;
        newData: any;
    }): Promise<{ success: boolean; error?: string }> {
        return this.logAction({
            ...params,
            action: 'create',
        });
    }

    /**
     * Registrar atualização de entidade
     */
    static async logUpdate(params: {
        userId: string;
        userName?: string;
        userEmail?: string;
        entityType: string;
        entityId: string;
        entityName?: string;
        oldData: any;
        newData: any;
    }): Promise<{ success: boolean; error?: string }> {
        return this.logAction({
            ...params,
            action: 'update',
        });
    }

    /**
     * Registrar exclusão de entidade
     */
    static async logDelete(params: {
        userId: string;
        userName?: string;
        userEmail?: string;
        entityType: string;
        entityId: string;
        entityName?: string;
        oldData: any;
    }): Promise<{ success: boolean; error?: string }> {
        return this.logAction({
            ...params,
            action: 'delete',
        });
    }

    /**
     * Registrar login
     */
    static async logLogin(params: {
        userId: string;
        userName?: string;
        userEmail?: string;
    }): Promise<{ success: boolean; error?: string }> {
        return this.logAction({
            ...params,
            action: 'login',
            entityType: 'user',
            entityId: params.userId,
        });
    }

    /**
     * Registrar logout
     */
    static async logLogout(params: {
        userId: string;
        userName?: string;
        userEmail?: string;
    }): Promise<{ success: boolean; error?: string }> {
        return this.logAction({
            ...params,
            action: 'logout',
            entityType: 'user',
            entityId: params.userId,
        });
    }

    /**
     * Registrar tentativa de login falhada
     */
    static async logLoginFailed(params: {
        userEmail: string;
    }): Promise<{ success: boolean; error?: string }> {
        return this.logAction({
            userEmail: params.userEmail,
            action: 'login_failed',
            entityType: 'user',
        });
    }

    /**
     * Buscar logs de auditoria com filtros
     */
    static async getAuditLogs(filters?: {
        userId?: string;
        action?: string;
        entityType?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    }): Promise<AuditLog[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            let query = supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters?.userId) {
                query = query.eq('user_id', filters.userId);
            }

            if (filters?.action) {
                query = query.eq('action', filters.action);
            }

            if (filters?.entityType) {
                query = query.eq('entity_type', filters.entityType);
            }

            if (filters?.startDate) {
                query = query.gte('created_at', filters.startDate);
            }

            if (filters?.endDate) {
                query = query.lte('created_at', filters.endDate);
            }

            if (filters?.limit) {
                query = query.limit(filters.limit);
            }

            if (filters?.offset) {
                query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Erro ao buscar logs de auditoria:', error);
                return [];
            }

            return data.map((item: any) => this.mapToAuditLog(item));
        } catch (error) {
            console.error('Erro ao buscar logs de auditoria:', error);
            return [];
        }
    }

    /**
     * Buscar logs de um utilizador específico
     */
    static async getUserAuditLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
        return this.getAuditLogs({ userId, limit });
    }

    /**
     * Buscar logs de uma entidade específica
     */
    static async getEntityAuditLogs(
        entityType: string,
        entityId: string,
        limit: number = 50
    ): Promise<AuditLog[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Erro ao buscar logs da entidade:', error);
                return [];
            }

            return data.map((item: any) => this.mapToAuditLog(item));
        } catch (error) {
            console.error('Erro ao buscar logs da entidade:', error);
            return [];
        }
    }

    /**
     * Obter estatísticas de auditoria
     */
    static async getAuditStats(filters?: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        totalActions: number;
        actionsByType: Record<string, number>;
        topUsers: Array<{ userId: string; userName: string; count: number }>;
    }> {
        if (!isSupabaseConfigured() || !supabase) {
            return { totalActions: 0, actionsByType: {}, topUsers: [] };
        }

        try {
            let query = supabase.from('audit_logs').select('*');

            if (filters?.startDate) {
                query = query.gte('created_at', filters.startDate);
            }

            if (filters?.endDate) {
                query = query.lte('created_at', filters.endDate);
            }

            const { data, error } = await query;

            if (error || !data) {
                return { totalActions: 0, actionsByType: {}, topUsers: [] };
            }

            // Contar ações por tipo
            const actionsByType: Record<string, number> = {};
            const userCounts: Record<string, { name: string; count: number }> = {};

            data.forEach((log: any) => {
                actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;

                if (log.user_id) {
                    if (!userCounts[log.user_id]) {
                        userCounts[log.user_id] = { name: log.user_name || 'Unknown', count: 0 };
                    }
                    userCounts[log.user_id].count++;
                }
            });

            // Top 10 utilizadores
            const topUsers = Object.entries(userCounts)
                .map(([userId, data]) => ({ userId, userName: data.name, count: data.count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            return {
                totalActions: data.length,
                actionsByType,
                topUsers,
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas de auditoria:', error);
            return { totalActions: 0, actionsByType: {}, topUsers: [] };
        }
    }

    /**
     * Mapear dados do banco para interface AuditLog
     */
    private static mapToAuditLog(item: any): AuditLog {
        return {
            id: item.id,
            userId: item.user_id,
            userName: item.user_name,
            userEmail: item.user_email,
            action: item.action,
            entityType: item.entity_type,
            entityId: item.entity_id,
            entityName: item.entity_name,
            oldData: item.old_data,
            newData: item.new_data,
            ipAddress: item.ip_address,
            userAgent: item.user_agent,
            createdAt: item.created_at,
            tenantId: item.tenant_id,
        };
    }
}

export const auditService = AuditService;
