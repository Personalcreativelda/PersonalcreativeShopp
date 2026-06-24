import { useState, useEffect, useCallback } from 'react';
import { PendingApproval } from '../types/auth';
import { approvalsService } from '../services/approvalsService';
import { permissionsService } from '../services/permissionsService';
import { User } from '../types/auth';

interface UseApprovalsReturn {
    pendingApprovals: PendingApproval[];
    myRequests: PendingApproval[];
    approvableRequests: PendingApproval[];
    isLoading: boolean;
    requestApproval: (params: {
        actionType: string;
        entityType: string;
        entityId: string;
        entityData?: any;
        reason?: string;
        approvalLevel?: number;
    }) => Promise<{ success: boolean; approvalId?: string; error?: string }>;
    approve: (approvalId: string, reviewNotes?: string) => Promise<{ success: boolean; error?: string }>;
    reject: (approvalId: string, reviewNotes?: string) => Promise<{ success: boolean; error?: string }>;
    cancel: (approvalId: string) => Promise<{ success: boolean; error?: string }>;
    refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar aprovações
 * 
 * @example
 * const { requestApproval, approvableRequests, approve, reject } = useApprovals(user);
 * 
 * // Solicitar aprovação
 * await requestApproval({
 *   actionType: 'delete_product',
 *   entityType: 'product',
 *   entityId: productId,
 *   entityData: product,
 *   reason: 'Produto descontinuado'
 * });
 */
export const useApprovals = (user: User | null): UseApprovalsReturn => {
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
    const [myRequests, setMyRequests] = useState<PendingApproval[]>([]);
    const [approvableRequests, setApprovableRequests] = useState<PendingApproval[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadApprovals = useCallback(async () => {
        if (!user) {
            setPendingApprovals([]);
            setMyRequests([]);
            setApprovableRequests([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // Carregar todas as aprovações pendentes
            const pending = await approvalsService.getPendingApprovals({ status: 'pending' });
            setPendingApprovals(pending);

            // Carregar solicitações do utilizador
            const userRequests = await approvalsService.getUserPendingApprovals(user.id);
            setMyRequests(userRequests);

            // Carregar aprovações que o utilizador pode aprovar
            const userLevel = await permissionsService.getUserHighestRoleLevel(user.id);
            if (userLevel !== null) {
                const approvable = await approvalsService.getApprovableRequests(user.id, userLevel);
                setApprovableRequests(approvable);
            }
        } catch (error) {
            console.error('Erro ao carregar aprovações:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadApprovals();

        // Recarregar aprovações a cada 30 segundos
        const interval = setInterval(loadApprovals, 30000);

        return () => clearInterval(interval);
    }, [loadApprovals]);

    const requestApproval = useCallback(async (params: {
        actionType: string;
        entityType: string;
        entityId: string;
        entityData?: any;
        reason?: string;
        approvalLevel?: number;
    }) => {
        if (!user) {
            return { success: false, error: 'Utilizador não autenticado' };
        }

        const result = await approvalsService.createApprovalRequest({
            ...params,
            requestedBy: user.id,
        });

        if (result.success) {
            await loadApprovals();
        }

        return result;
    }, [user, loadApprovals]);

    const approve = useCallback(async (approvalId: string, reviewNotes?: string) => {
        if (!user) {
            return { success: false, error: 'Utilizador não autenticado' };
        }

        const result = await approvalsService.approveRequest({
            approvalId,
            reviewedBy: user.id,
            reviewNotes,
        });

        if (result.success) {
            await loadApprovals();
        }

        return result;
    }, [user, loadApprovals]);

    const reject = useCallback(async (approvalId: string, reviewNotes?: string) => {
        if (!user) {
            return { success: false, error: 'Utilizador não autenticado' };
        }

        const result = await approvalsService.rejectRequest({
            approvalId,
            reviewedBy: user.id,
            reviewNotes,
        });

        if (result.success) {
            await loadApprovals();
        }

        return result;
    }, [user, loadApprovals]);

    const cancel = useCallback(async (approvalId: string) => {
        if (!user) {
            return { success: false, error: 'Utilizador não autenticado' };
        }

        const result = await approvalsService.cancelRequest(approvalId, user.id);

        if (result.success) {
            await loadApprovals();
        }

        return result;
    }, [user, loadApprovals]);

    const refresh = useCallback(async () => {
        await loadApprovals();
    }, [loadApprovals]);

    return {
        pendingApprovals,
        myRequests,
        approvableRequests,
        isLoading,
        requestApproval,
        approve,
        reject,
        cancel,
        refresh,
    };
};
