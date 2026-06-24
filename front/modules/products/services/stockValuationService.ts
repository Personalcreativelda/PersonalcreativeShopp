/**
 * Serviço de valorização de stock: FIFO, LIFO, custo médio, custo padrão.
 * Calcula custo das saídas e actualiza lotes em stock_lots.
 */
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';
import { handleSupabaseError } from '../../core/services/serviceUtils';
import { stockConfigService, ValuationMethod } from './stockConfigService';

export interface ConsumedLot {
    lotId: string;
    quantity: number;
    unitCost: number;
}

export interface ValuationResult {
    costAmount: number;
    consumedLots?: ConsumedLot[];
}

interface StockLotRow {
    id: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit_cost: number;
    received_at: string;
}

async function getLots(
    productId: string,
    variantId: string | null,
    order: 'asc' | 'desc' = 'asc'
): Promise<StockLotRow[]> {
    if (!isSupabaseConfigured() || !supabase) return [];
    let query = supabase
        .from('stock_lots')
        .select('id, product_id, variant_id, quantity, unit_cost, received_at')
        .eq('product_id', productId)
        .gt('quantity', 0)
        .order('received_at', { ascending: order === 'asc' });
    if (variantId === null) {
        query = query.is('variant_id', null);
    } else {
        query = query.eq('variant_id', variantId);
    }
    const { data, error } = await query;
    if (error) {
        if (error.code === '42P01') return [];
        handleSupabaseError('getLots', error);
        return [];
    }
    return (data || []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        variant_id: r.variant_id,
        quantity: Number(r.quantity) || 0,
        unit_cost: Number(r.unit_cost) || 0,
        received_at: r.received_at
    }));
}

async function getProductCost(productId: string, variantId: string | null): Promise<number> {
    if (!isSupabaseConfigured() || !supabase) return 0;
    if (variantId) {
        const { data } = await supabase
            .from('product_variants')
            .select('cost_price')
            .eq('id', variantId)
            .maybeSingle();
        return Number(data?.cost_price ?? 0);
    }
    const { data } = await supabase
        .from('products')
        .select('cost_price')
        .eq('id', productId)
        .maybeSingle();
    return Number(data?.cost_price ?? 0);
}

async function reduceLotQuantity(
    lotId: string,
    quantityToDeduct: number,
    sourceType?: string,
    sourceId?: string,
    consumedAt?: string
): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    const { data: lot } = await supabase
        .from('stock_lots')
        .select('quantity')
        .eq('id', lotId)
        .single();
    if (!lot) return;
    const current = Number(lot.quantity) || 0;
    const newQty = Math.max(0, current - quantityToDeduct);
    await supabase.from('stock_lots').update({ quantity: newQty }).eq('id', lotId);
    if (sourceType && sourceId) {
        const record: Record<string, unknown> = {
            lot_id: lotId,
            quantity_consumed: quantityToDeduct,
            source_type: sourceType,
            source_id: sourceId
        };
        if (consumedAt) record.consumed_at = consumedAt;
        await supabase.from('stock_lot_consumptions').insert(record);
    }
}

export const stockValuationService = {
    /**
     * Calcula custo de uma saída e aplica consumo nos lotes.
     */
    async computeExitCost(
        productId: string,
        variantId: string | null,
        quantity: number,
        exitDate: string,
        sourceType?: string,
        sourceId?: string
    ): Promise<ValuationResult> {
        const method = await stockConfigService.getValuationMethod();
        switch (method) {
            case 'fifo':
                return this._computeFifo(productId, variantId, quantity, exitDate, sourceType, sourceId);
            case 'lifo':
                return this._computeLifo(productId, variantId, quantity, exitDate, sourceType, sourceId);
            case 'average':
                return this._computeAverage(productId, variantId, quantity, exitDate, sourceType, sourceId);
            case 'standard_cost':
                return this._computeStandardCost(productId, variantId, quantity, exitDate, sourceType, sourceId);
            default:
                return this._computeFifo(productId, variantId, quantity, exitDate, sourceType, sourceId);
        }
    },

    /**
     * FIFO: consume os lotes mais antigos primeiro.
     */
    async _computeFifo(
        productId: string,
        variantId: string | null,
        quantity: number,
        exitDate: string,
        sourceType?: string,
        sourceId?: string
    ): Promise<ValuationResult> {
        const lots = await getLots(productId, variantId, 'asc');
        let remaining = Math.abs(quantity);
        let totalCost = 0;
        const consumed: ConsumedLot[] = [];
        for (const lot of lots) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, lot.quantity);
            if (take <= 0) continue;
            totalCost += take * lot.unit_cost;
            consumed.push({ lotId: lot.id, quantity: take, unitCost: lot.unit_cost });
            await reduceLotQuantity(lot.id, take, sourceType, sourceId, exitDate);
            remaining -= take;
        }
        if (remaining > 0) {
            const fallbackCost = await getProductCost(productId, variantId);
            totalCost += remaining * fallbackCost;
        }
        return { costAmount: totalCost, consumedLots: consumed };
    },

    /**
     * LIFO: consume os lotes mais recentes primeiro.
     */
    async _computeLifo(
        productId: string,
        variantId: string | null,
        quantity: number,
        exitDate: string,
        sourceType?: string,
        sourceId?: string
    ): Promise<ValuationResult> {
        const lots = await getLots(productId, variantId, 'desc');
        let remaining = Math.abs(quantity);
        let totalCost = 0;
        const consumed: ConsumedLot[] = [];
        for (const lot of lots) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, lot.quantity);
            if (take <= 0) continue;
            totalCost += take * lot.unit_cost;
            consumed.push({ lotId: lot.id, quantity: take, unitCost: lot.unit_cost });
            await reduceLotQuantity(lot.id, take, sourceType, sourceId, exitDate);
            remaining -= take;
        }
        if (remaining > 0) {
            const fallbackCost = await getProductCost(productId, variantId);
            totalCost += remaining * fallbackCost;
        }
        return { costAmount: totalCost, consumedLots: consumed };
    },

    /**
     * Custo médio ponderado: usa média dos lotes e deduz em ordem FIFO.
     */
    async _computeAverage(
        productId: string,
        variantId: string | null,
        quantity: number,
        exitDate: string,
        sourceType?: string,
        sourceId?: string
    ): Promise<ValuationResult> {
        const lots = await getLots(productId, variantId, 'asc');
        const totalQty = lots.reduce((s, l) => s + l.quantity, 0);
        const totalVal = lots.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
        const avgCost = totalQty > 0 ? totalVal / totalQty : await getProductCost(productId, variantId);
        const qty = Math.abs(quantity);
        const costAmount = qty * avgCost;
        let remaining = qty;
        const consumed: ConsumedLot[] = [];
        for (const lot of lots) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, lot.quantity);
            if (take <= 0) continue;
            consumed.push({ lotId: lot.id, quantity: take, unitCost: lot.unit_cost });
            await reduceLotQuantity(lot.id, take, sourceType, sourceId, exitDate);
            remaining -= take;
        }
        return { costAmount, consumedLots: consumed };
    },

    /**
     * Custo padrão: usa products.cost_price / product_variants.cost_price.
     * Deduz dos lotes em FIFO para manter consistência quantitativa.
     */
    async _computeStandardCost(
        productId: string,
        variantId: string | null,
        quantity: number,
        exitDate: string,
        sourceType?: string,
        sourceId?: string
    ): Promise<ValuationResult> {
        const unitCost = await getProductCost(productId, variantId);
        const qty = Math.abs(quantity);
        const costAmount = qty * unitCost;
        const lots = await getLots(productId, variantId, 'asc');
        let remaining = qty;
        const consumed: ConsumedLot[] = [];
        for (const lot of lots) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, lot.quantity);
            if (take <= 0) continue;
            consumed.push({ lotId: lot.id, quantity: take, unitCost: lot.unit_cost });
            await reduceLotQuantity(lot.id, take, sourceType, sourceId, exitDate);
            remaining -= take;
        }
        return { costAmount, consumedLots: consumed };
    },

    /**
     * Valor do stock actual (soma dos lotes) para um produto/variante.
     */
    async getStockValue(productId: string, variantId: string | null): Promise<{ quantity: number; value: number }> {
        const lots = await getLots(productId, variantId, 'asc');
        const quantity = lots.reduce((s, l) => s + l.quantity, 0);
        const value = lots.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
        return { quantity, value };
    },

    /**
     * Custo médio ponderado actual (para relatórios).
     */
    async getAverageCost(productId: string, variantId: string | null): Promise<number> {
        const lots = await getLots(productId, variantId, 'asc');
        const totalQty = lots.reduce((s, l) => s + l.quantity, 0);
        const totalVal = lots.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
        return totalQty > 0 ? totalVal / totalQty : (await getProductCost(productId, variantId));
    }
};
