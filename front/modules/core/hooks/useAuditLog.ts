import { useState, useEffect, useCallback } from 'react';
import { AuditLog } from '../types/auth';
import { auditService } from '../services/auditService';
import { User } from '../types/auth';

interface UseAuditLogFilters {
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
}

interface UseAuditLogReturn {
    auditLogs: AuditLog[];
    isLoading: boolean;
    error: string | null;
    logAction: (params: {
        action: string;
        entityType: string;
        entityId?: string;
        entityName?: string;
        oldData?: any;
        newData?: any;
    }) => Promise<{ success: boolean; error?: string }>;
    refresh: () => Promise<void>;
    stats: {
        totalActions: number;
        actionsByType: Record<string, number>;
        topUsers: Array<{ userId: string; userName: string; count: number }>;
    } | null;
}

/**
 * Hook para gerenciar logs de auditoria
 * 
 * @example
 * const { auditLogs, logAction, refresh } = useAuditLog(user, {
 *   entityType: 'product',
 *   limit: 100
 * });
 * 
 * // Registrar ação
 * await logAction({
 *   action: 'update',
 *   entityType: 'product',
 *   entityId: productId,
 *   entityName: product.name,
 *   oldData: oldProduct,
 *   newData: updatedProduct
 * });
 */
export const useAuditLog = (
    user: User | null,
    filters?: UseAuditLogFilters
): UseAuditLogReturn => {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        totalActions: number;
        actionsByType: Record<string, number>;
        topUsers: Array<{ userId: string; userName: string; count: number }>;
    } | null>(null);

    const loadAuditLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const logs = await auditService.getAuditLogs({
                ...filters,
                limit: filters?.limit || 50,
            });
            setAuditLogs(logs);

            // Carregar estatísticas se não houver filtros específicos
            if (!filters?.userId && !filters?.entityType) {
                const auditStats = await auditService.getAuditStats({
                    startDate: filters?.startDate,
                    endDate: filters?.endDate,
                });
                setStats(auditStats);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar logs de auditoria');
            console.error('Erro ao carregar logs:', err);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadAuditLogs();
    }, [loadAuditLogs]);

    const logAction = useCallback(
        async (params: {
            action: string;
            entityType: string;
            entityId?: string;
            entityName?: string;
            oldData?: any;
            newData?: any;
        }) => {
            if (!user) {
                return { success: false, error: 'Utilizador não autenticado' };
            }

            const result = await auditService.logAction({
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                ...params,
            });

            if (result.success) {
                await loadAuditLogs();
            }

            return result;
        },
        [user, loadAuditLogs]
    );

    const refresh = useCallback(async () => {
        await loadAuditLogs();
    }, [loadAuditLogs]);

    return {
        auditLogs,
        isLoading,
        error,
        logAction,
        refresh,
        stats,
    };
};
