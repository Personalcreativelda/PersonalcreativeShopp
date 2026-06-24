/**
 * Stock Audit Service — REST API
 */
import api from '../../core/services/apiClient';
import {
    StockAudit,
    StockAuditItem,
    StockAuditStatus,
    StockAuditScope,
    Product,
    StockAdjustmentReason
} from '../../core/types/types';

export { StockAuditStatus, StockAuditScope };

function generateAuditItems(
    auditId: string,
    scope: StockAuditScope,
    scopeFilter: any,
    products: Product[]
): Array<{
    productId: string; productName: string;
    variantId?: string; variantName?: string;
    systemQuantity: number; unit: string; costPrice?: number;
}> {
    let filtered: Product[] = [];
    switch (scope) {
        case StockAuditScope.ALL:
            filtered = products;
            break;
        case StockAuditScope.SELECTED:
            filtered = scopeFilter?.productIds
                ? products.filter(p => scopeFilter.productIds.includes(p.id))
                : [];
            break;
        case StockAuditScope.CATEGORY:
            filtered = scopeFilter?.category
                ? products.filter(p => p.category === scopeFilter.category)
                : [];
            break;
    }

    const items: ReturnType<typeof generateAuditItems> = [];
    for (const product of filtered) {
        if (product.variants && product.variants.length > 0) {
            for (const variant of product.variants) {
                items.push({
                    productId: product.id,
                    productName: product.name,
                    variantId: variant.id,
                    variantName: variant.name,
                    systemQuantity: variant.stock ?? 0,
                    unit: variant.unit || product.unit,
                    costPrice: (variant as any).costPrice ?? (product as any).costPrice ?? undefined
                });
            }
        } else {
            items.push({
                productId: product.id,
                productName: product.name,
                variantId: undefined,
                variantName: undefined,
                systemQuantity: (product as any).stock ?? 0,
                unit: product.unit,
                costPrice: (product as any).costPrice ?? undefined
            });
        }
    }
    return items;
}

export const stockAuditService = {
    async getAudits(): Promise<StockAudit[]> {
        try {
            return await api.get<StockAudit[]>('/stock/audits');
        } catch (e) {
            console.error('[stockAuditService] getAudits:', e);
            return [];
        }
    },

    async getAuditById(auditId: string): Promise<(StockAudit & { items: StockAuditItem[] }) | null> {
        if (!auditId) return null;
        try {
            return await api.get<StockAudit & { items: StockAuditItem[] }>(`/stock/audits/${auditId}`);
        } catch { return null; }
    },

    async createAudit(
        auditDate: string,
        description: string | undefined,
        scope: StockAuditScope,
        scopeFilter: any,
        products: Product[]
    ): Promise<{ audit: StockAudit | null; error?: string }> {
        try {
            const items = generateAuditItems('', scope, scopeFilter, products);
            const result = await api.post<StockAudit & { items: StockAuditItem[] }>('/stock/audits', {
                auditDate,
                description,
                scope,
                scopeFilter,
                items
            });
            return { audit: result };
        } catch (e: any) {
            console.error('[stockAuditService] createAudit:', e);
            return { audit: null, error: e.message || 'Erro ao criar auditoria' };
        }
    },

    async updateAuditItemsBatch(
        auditId: string,
        updates: Array<{ itemId: string; countedQuantity: number; notes?: string }>
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await api.put(`/stock/audits/${auditId}/items/batch`, { updates });
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao guardar contagens' };
        }
    },

    async updateAuditItem(
        itemId: string,
        updates: Partial<StockAuditItem>
    ): Promise<{ success: boolean; item?: StockAuditItem; error?: string }> {
        try {
            const result = await api.put<StockAuditItem>(`/stock/audit-items/${itemId}`, updates);
            return { success: true, item: result };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao actualizar item' };
        }
    },

    async completeAudit(auditId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await api.put(`/stock/audits/${auditId}/complete`, {});
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao completar auditoria' };
        }
    },

    async applyAudit(auditId: string): Promise<{ success: boolean; applied?: number; error?: string }> {
        try {
            const result = await api.put<{ success: boolean; applied: number }>(`/stock/audits/${auditId}/apply`, {});
            return { success: true, applied: result.applied };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao aplicar auditoria' };
        }
    },

    async getAuditItems(auditId: string): Promise<StockAuditItem[]> {
        if (!auditId) return [];
        try {
            const result = await api.get<{ items: StockAuditItem[] }>(`/stock/audits/${auditId}`);
            return (result as any).items ?? [];
        } catch { return []; }
    },

    async updateAuditItemApproval(
        itemId: string,
        approved: boolean,
        adjustmentReason?: StockAdjustmentReason,
        adjustmentNotes?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await api.put(`/stock/audit-items/${itemId}`, { approved, adjustmentReason, adjustmentNotes });
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao actualizar aprovação' };
        }
    },

    async applyAuditAdjustments(
        auditId: string,
        _auditDate?: string
    ): Promise<{ success: boolean; applied?: number; error?: string }> {
        return this.applyAudit(auditId);
    },

    async revertAuditToCompleted(auditId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await api.put(`/stock/audits/${auditId}/revert`, {});
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao reverter auditoria' };
        }
    },

    async deleteAudit(
        auditId: string,
        _options?: { allowAnyStatus?: boolean }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await api.delete(`/stock/audits/${auditId}`);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Erro ao eliminar auditoria' };
        }
    }
};
