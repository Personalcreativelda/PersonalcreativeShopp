/**
 * Stock Adjustment Service — REST API
 */
import api from '../../core/services/apiClient';
import { getTodayDateString } from '../../core/utils/dateUtils';
import { AdjustmentLine, StockAdjustment, StockAdjustmentReason } from '../../core/types/types';

export const ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
    [StockAdjustmentReason.DAMAGED]: 'Produto Estragado',
    [StockAdjustmentReason.RETURN]: 'Devolução de Cliente',
    [StockAdjustmentReason.CORRECTION]: 'Correção de Contagem',
    [StockAdjustmentReason.LOSS]: 'Perda/Roubo',
    [StockAdjustmentReason.PRODUCTION]: 'Produção Interna',
    [StockAdjustmentReason.EXPIRED]: 'Produto Expirado',
    [StockAdjustmentReason.OTHER]: 'Outro Motivo'
};

export const stockAdjustmentService = {
    async getAdjustments(): Promise<StockAdjustment[]> {
        try {
            return await api.get<StockAdjustment[]>('/stock/adjustments');
        } catch (e: any) {
            console.error('[stockAdjustmentService] getAdjustments:', e);
            return [];
        }
    },

    async getAdjustmentsByProduct(productId: string): Promise<StockAdjustment[]> {
        if (!productId) return [];
        try {
            return await api.get<StockAdjustment[]>(`/stock/adjustments?productId=${encodeURIComponent(productId)}`);
        } catch { return []; }
    },

    async createAdjustment(
        adjustment: Omit<StockAdjustment, 'id' | 'createdAt'>
    ): Promise<{ adjustment: StockAdjustment | null; error?: string }> {
        try {
            const result = await api.post<StockAdjustment>('/stock/adjustments', {
                ...adjustment,
                date: adjustment.date || getTodayDateString()
            });
            return { adjustment: result };
        } catch (e: any) {
            console.error('[stockAdjustmentService] createAdjustment:', e);
            return { adjustment: null, error: e.message || 'Erro ao criar ajuste' };
        }
    },

    async createBatchAdjustments(
        lines: AdjustmentLine[],
        common: { reason: StockAdjustmentReason; date: string; notes?: string; createdBy?: string; isEntry: boolean }
    ): Promise<{ created: number; failed: number; errors: string[] }> {
        const result = { created: 0, failed: 0, errors: [] as string[] };
        const sign = common.isEntry ? 1 : -1;
        for (const line of lines) {
            const qty = Number(line.quantity) || 0;
            if (qty <= 0) {
                result.failed++;
                result.errors.push(`${line.productName || line.productId}: quantidade inválida`);
                continue;
            }
            const res = await this.createAdjustment({
                productId: line.productId,
                productName: line.productName,
                variantId: line.variantId,
                variantName: line.variantName,
                quantity: sign * Math.abs(qty),
                reason: common.reason,
                notes: common.notes,
                date: common.date,
                createdBy: common.createdBy
            });
            if (res.adjustment) result.created++;
            else {
                result.failed++;
                if (res.error) result.errors.push(`${line.productName || line.productId}: ${res.error}`);
            }
        }
        return result;
    },

    async updateAdjustment(
        adjustmentId: string,
        payload: { quantity: number; reason: StockAdjustmentReason; notes?: string; date: string }
    ): Promise<{ success: boolean; error?: string }> {
        if (!adjustmentId) return { success: false, error: 'ID inválido' };
        try {
            await api.put(`/stock/adjustments/${adjustmentId}`, payload);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao atualizar ajuste' };
        }
    },

    async deleteAdjustment(adjustmentId: string): Promise<{ success: boolean; error?: string }> {
        if (!adjustmentId) return { success: false, error: 'ID inválido' };
        try {
            await api.delete(`/stock/adjustments/${adjustmentId}`);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao eliminar ajuste' };
        }
    },

    async deleteAdjustments(ids: string[]): Promise<{ deletedCount: number; errors: { id: string; error: string }[] }> {
        if (!ids?.length) return { deletedCount: 0, errors: [] };
        try {
            const result = await api.delete('/stock/adjustments', { ids }) as any;
            return { deletedCount: result.deleted || 0, errors: [] };
        } catch (e: any) {
            return { deletedCount: 0, errors: ids.map(id => ({ id, error: e.message || 'Erro' })) };
        }
    },

    async getAdjustmentStats(fromDate?: string, toDate?: string): Promise<{
        byReason: Record<StockAdjustmentReason, { count: number; totalQuantity: number }>;
        total: { count: number; entries: number; exits: number };
    }> {
        const stats = {
            byReason: {} as Record<StockAdjustmentReason, { count: number; totalQuantity: number }>,
            total: { count: 0, entries: 0, exits: 0 }
        };
        for (const reason of Object.values(StockAdjustmentReason)) {
            stats.byReason[reason] = { count: 0, totalQuantity: 0 };
        }
        const adjustments = await this.getAdjustments();
        for (const adj of adjustments) {
            if (fromDate && adj.date < fromDate) continue;
            if (toDate && adj.date > toDate) continue;
            stats.total.count++;
            if (adj.quantity > 0) stats.total.entries += adj.quantity;
            else stats.total.exits += Math.abs(adj.quantity);
            if (stats.byReason[adj.reason]) {
                stats.byReason[adj.reason].count++;
                stats.byReason[adj.reason].totalQuantity += adj.quantity;
            }
        }
        return stats;
    },

    // Kept for compatibility — no longer needed with REST API
    async _cleanupStockRecords(_adjustmentId: string): Promise<void> {}
};
