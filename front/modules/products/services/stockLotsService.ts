/**
 * Stock Lots Service — REST API
 */
import api from '../../core/services/apiClient';

export interface StockLotRow {
    id: string;
    productId: string;
    productName: string;
    variantId: string | null;
    variantName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
    sourceType: string;
    sourceId: string | null;
    receivedAt: string;
    invoiceNumber?: string;
    purchaseDate?: string;
    supplierName?: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
    purchase: 'Compra',
    adjustment: 'Ajuste',
    manual: 'Manual',
    migration: 'Migração',
    order: 'Encomenda'
};

export const stockLotsService = {
    async getStockLots(filters?: {
        productId?: string;
        variantId?: string | null;
        sourceType?: string;
        minQuantity?: number;
        includeConsumed?: boolean;
    }): Promise<StockLotRow[]> {
        try {
            const params = new URLSearchParams();
            if (filters?.productId) params.set('productId', filters.productId);
            if (filters?.variantId !== undefined && filters.variantId !== null) params.set('variantId', filters.variantId);
            if (filters?.sourceType) params.set('sourceType', filters.sourceType);
            if (filters?.includeConsumed) params.set('includeConsumed', 'true');
            const qs = params.toString();
            return await api.get<StockLotRow[]>(`/stock/lots${qs ? '?' + qs : ''}`);
        } catch (e) {
            console.warn('[stockLotsService] getStockLots:', e);
            return [];
        }
    },

    getSourceTypeLabel(sourceType: string): string {
        return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
    },

    async updateLot(lotId: string, updates: { quantity?: number; unitCost?: number }): Promise<{ success: boolean; error?: string }> {
        if (!lotId) return { success: false, error: 'ID inválido' };
        try {
            await api.put(`/stock/lots/${lotId}`, updates);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e?.message ?? 'Erro ao actualizar lote' };
        }
    },

    async deleteLot(lotId: string): Promise<{ success: boolean; error?: string }> {
        if (!lotId) return { success: false, error: 'ID inválido' };
        try {
            await api.delete(`/stock/lots/${lotId}`);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e?.message ?? 'Erro ao eliminar lote' };
        }
    },

    async deleteLots(lotIds: string[]): Promise<{ deletedCount: number; errors: string[] }> {
        if (!lotIds.length) return { deletedCount: 0, errors: [] };
        try {
            await api.delete('/stock/lots', { ids: lotIds });
            return { deletedCount: lotIds.length, errors: [] };
        } catch (e: any) {
            return { deletedCount: 0, errors: [e?.message ?? 'Erro ao eliminar lotes'] };
        }
    },

    async setLotsQuantityToZero(lotIds: string[]): Promise<{ updatedCount: number; errors: string[] }> {
        if (!lotIds.length) return { updatedCount: 0, errors: [] };
        const errors: string[] = [];
        let updatedCount = 0;
        for (const id of lotIds) {
            const result = await this.updateLot(id, { quantity: 0 });
            if (result.success) updatedCount++;
            else if (result.error) errors.push(result.error);
        }
        return { updatedCount, errors };
    }
};
