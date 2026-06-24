import { supabase, isSupabaseConfigured } from './supabaseClient';
import { PendingApproval } from '../types/auth';

/**
 * Serviço de Aprovações
 * 
 * Gerencia o workflow de aprovações para ações críticas.
 */
export class ApprovalsService {
    /**
     * Criar nova solicitação de aprovação
     */
    static async createApprovalRequest(params: {
        actionType: string;
        entityType: string;
        entityId: string;
        entityData?: any;
        reason?: string;
        requestedBy: string;
        approvalLevel?: number;
    }): Promise<{ success: boolean; approvalId?: string; error?: string }> {
        if (!isSupabaseConfigured() || !supabase) {
            return { success: false, error: 'Supabase não configurado' };
        }

        try {
            const { data, error } = await supabase
                .from('pending_approvals')
                .insert({
                    action_type: params.actionType,
                    entity_type: params.entityType,
                    entity_id: params.entityId,
                    entity_data: params.entityData,
                    reason: params.reason,
                    requested_by: params.requestedBy,
                    approval_level: params.approvalLevel,
                    status: 'pending',
                })
                .select('id')
                .single();

            if (error) {
                console.error('Erro ao criar solicitação de aprovação:', error);
                return { success: false, error: error.message };
            }

            return { success: true, approvalId: data.id };
        } catch (error: any) {
            console.error('Erro ao criar solicitação de aprovação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Buscar todas as aprovações pendentes
     */
    static async getPendingApprovals(filters?: {
        status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
        actionType?: string;
        entityType?: string;
    }): Promise<PendingApproval[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            let query = supabase
                .from('pending_approvals')
                .select(`
          *,
          requester:profiles!pending_approvals_requested_by_fkey(id, name, email),
          reviewer:profiles!pending_approvals_reviewed_by_fkey(id, name, email)
        `)
                .order('requested_at', { ascending: false });

            if (filters?.status) {
                query = query.eq('status', filters.status);
            }

            if (filters?.actionType) {
                query = query.eq('action_type', filters.actionType);
            }

            if (filters?.entityType) {
                query = query.eq('entity_type', filters.entityType);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Erro ao buscar aprovações pendentes:', error);
                return [];
            }

            return data.map((item: any) => this.mapToApproval(item));
        } catch (error) {
            console.error('Erro ao buscar aprovações pendentes:', error);
            return [];
        }
    }

    /**
     * Buscar solicitações de aprovação de um utilizador
     */
    static async getUserPendingApprovals(userId: string): Promise<PendingApproval[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('pending_approvals')
                .select(`
          *,
          requester:profiles!pending_approvals_requested_by_fkey(id, name, email),
          reviewer:profiles!pending_approvals_reviewed_by_fkey(id, name, email)
        `)
                .eq('requested_by', userId)
                .order('requested_at', { ascending: false });

            if (error) {
                console.error('Erro ao buscar solicitações do utilizador:', error);
                return [];
            }

            return data.map((item: any) => this.mapToApproval(item));
        } catch (error) {
            console.error('Erro ao buscar solicitações do utilizador:', error);
            return [];
        }
    }

    /**
     * Buscar aprovações que o utilizador pode aprovar
     * (baseado no nível hierárquico do utilizador)
     */
    static async getApprovableRequests(userId: string, userLevel: number): Promise<PendingApproval[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('pending_approvals')
                .select(`
          *,
          requester:profiles!pending_approvals_requested_by_fkey(id, name, email),
          reviewer:profiles!pending_approvals_reviewed_by_fkey(id, name, email)
        `)
                .eq('status', 'pending')
                .gte('approval_level', userLevel) // Utilizador pode aprovar níveis >= ao seu
                .order('requested_at', { ascending: false });

            if (error) {
                console.error('Erro ao buscar aprovações que pode aprovar:', error);
                return [];
            }

            return data.map((item: any) => this.mapToApproval(item));
        } catch (error) {
            console.error('Erro ao buscar aprovações que pode aprovar:', error);
            return [];
        }
    }

    /**
     * Aprovar solicitação
     */
    static async approveRequest(params: {
        approvalId: string;
        reviewedBy: string;
        reviewNotes?: string;
    }): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured() || !supabase) {
            return { success: false, error: 'Supabase não configurado' };
        }

        try {
            const { error } = await supabase
                .from('pending_approvals')
                .update({
                    status: 'approved',
                    reviewed_by: params.reviewedBy,
                    reviewed_at: new Date().toISOString(),
                    review_notes: params.reviewNotes,
                })
                .eq('id', params.approvalId)
                .eq('status', 'pending'); // Apenas aprovar se ainda estiver pendente

            if (error) {
                console.error('Erro ao aprovar solicitação:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error: any) {
            console.error('Erro ao aprovar solicitação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Rejeitar solicitação
     */
    static async rejectRequest(params: {
        approvalId: string;
        reviewedBy: string;
        reviewNotes?: string;
    }): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured() || !supabase) {
            return { success: false, error: 'Supabase não configurado' };
        }

        try {
            const { error } = await supabase
                .from('pending_approvals')
                .update({
                    status: 'rejected',
                    reviewed_by: params.reviewedBy,
                    reviewed_at: new Date().toISOString(),
                    review_notes: params.reviewNotes,
                })
                .eq('id', params.approvalId)
                .eq('status', 'pending');

            if (error) {
                console.error('Erro ao rejeitar solicitação:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error: any) {
            console.error('Erro ao rejeitar solicitação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cancelar solicitação (apenas pelo solicitante)
     */
    static async cancelRequest(approvalId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured() || !supabase) {
            return { success: false, error: 'Supabase não configurado' };
        }

        try {
            const { error } = await supabase
                .from('pending_approvals')
                .update({
                    status: 'cancelled',
                })
                .eq('id', approvalId)
                .eq('requested_by', userId) // Apenas o solicitante pode cancelar
                .eq('status', 'pending');

            if (error) {
                console.error('Erro ao cancelar solicitação:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error: any) {
            console.error('Erro ao cancelar solicitação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Buscar histórico de aprovações (todas, não apenas pendentes)
     */
    static async getApprovalHistory(filters?: {
        userId?: string;
        entityType?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<PendingApproval[]> {
        if (!isSupabaseConfigured() || !supabase) {
            return [];
        }

        try {
            let query = supabase
                .from('pending_approvals')
                .select(`
          *,
          requester:profiles!pending_approvals_requested_by_fkey(id, name, email),
          reviewer:profiles!pending_approvals_reviewed_by_fkey(id, name, email)
        `)
                .order('requested_at', { ascending: false });

            if (filters?.userId) {
                query = query.or(`requested_by.eq.${filters.userId},reviewed_by.eq.${filters.userId}`);
            }

            if (filters?.entityType) {
                query = query.eq('entity_type', filters.entityType);
            }

            if (filters?.startDate) {
                query = query.gte('requested_at', filters.startDate);
            }

            if (filters?.endDate) {
                query = query.lte('requested_at', filters.endDate);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Erro ao buscar histórico de aprovações:', error);
                return [];
            }

            return data.map((item: any) => this.mapToApproval(item));
        } catch (error) {
            console.error('Erro ao buscar histórico de aprovações:', error);
            return [];
        }
    }

    /**
     * Mapear dados do banco para interface PendingApproval
     */
    private static mapToApproval(item: any): PendingApproval {
        return {
            id: item.id,
            actionType: item.action_type,
            entityType: item.entity_type,
            entityId: item.entity_id,
            entityData: item.entity_data,
            requestedBy: item.requested_by,
            requestedAt: item.requested_at,
            reason: item.reason,
            status: item.status,
            reviewedBy: item.reviewed_by,
            reviewedAt: item.reviewed_at,
            reviewNotes: item.review_notes,
            approvalLevel: item.approval_level,
            tenantId: item.tenant_id,
        };
    }
}

export const approvalsService = ApprovalsService;
