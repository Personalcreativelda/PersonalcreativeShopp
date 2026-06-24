/**
 * Lot Integrity Service
 * Verificação de integridade de lotes de stock.
 * Detecta lotes antigos que ainda mostram stock mas que, com base nos consumos
 * e movimentos de saída, já foram totalmente consumidos.
 */
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';
import { stockLotsService } from './stockLotsService';

const BATCH_SIZE = 500;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LotIntegrityIssue {
    lotId: string;
    productName: string;
    variantName: string;
    sourceType: string;
    sourceLabel: string;
    invoiceNumber?: string;
    receivedAt: string;
    /** Quantidade actual no lote */
    currentQuantity: number;
    /** Total já consumido (stock_lot_consumptions) */
    totalConsumed: number;
    /** Quantidade esperada = original - consumida (pode ser <= 0) */
    expectedQuantity: number;
    /** Diferença entre actual e esperada */
    discrepancy: number;
}

export interface LotIntegrityReport {
    generatedAt: string;
    issues: LotIntegrityIssue[];
    summary: {
        totalLotsChecked: number;
        lotsWithStock: number;
        issuesFound: number;
        totalExcessStock: number;
    };
}

export type LotIntegrityProgressCallback = (
    stage: string,
    current: number,
    total: number,
    message?: string
) => void;

// ─── Service ──────────────────────────────────────────────────────────────────

export const lotIntegrityService = {
    /**
     * Detectar lotes com stock inconsistente.
     * Abordagem Ground Truth:
     * A tabela `product_variants` é a fonte de verdade do stock actual.
     * A soma das quantidades de todos os lotes (quantity > 0) para uma variante
     * não pode exceder o stock actual dessa variante.
     * Se exceder, deduz-se o excesso nos lotes mais antigos primeiro (FIFO).
     */
    async detectStaleLots(
        onProgress?: LotIntegrityProgressCallback
    ): Promise<LotIntegrityReport> {
        const issues: LotIntegrityIssue[] = [];
        let totalLotsChecked = 0;
        let lotsWithStock = 0;

        try {
            onProgress?.('A carregar lotes com stock...', 0, 100);

            // Buscar todos os lotes com stock > 0
            const lotsWithStockData = await stockLotsService.getStockLots({
                includeConsumed: false
            });

            lotsWithStock = lotsWithStockData.length;
            totalLotsChecked = lotsWithStockData.length;

            if (lotsWithStockData.length === 0) {
                onProgress?.('Concluído', 100, 100, 'Nenhum lote com stock encontrado');
                return {
                    generatedAt: new Date().toISOString(),
                    issues: [],
                    summary: {
                        totalLotsChecked: 0,
                        lotsWithStock: 0,
                        issuesFound: 0,
                        totalExcessStock: 0
                    }
                };
            }

            onProgress?.('A carregar stock actual (Ground Truth)...', 30, 100);

            // Buscar stock real na product_variants
            const { data: variants } = await supabase
                .from('product_variants')
                .select('id, product_id, stock, is_default');

            const variantStockMap = new Map<string, number>();
            const defaultVariantMap = new Map<string, number>();

            if (variants) {
                for (const v of variants) {
                    variantStockMap.set(v.id, Number(v.stock) || 0);
                    if (v.is_default) {
                        defaultVariantMap.set(v.product_id, Number(v.stock) || 0);
                    }
                }
            }

            onProgress?.('A analisar lotes...', 60, 100);

            // Agrupar lotes activos por variante
            const lotsByVariant = new Map<string, typeof lotsWithStockData>();
            for (const lot of lotsWithStockData) {
                const key = lot.variantId || `default:${lot.productId}`;
                if (!lotsByVariant.has(key)) lotsByVariant.set(key, []);
                lotsByVariant.get(key)!.push(lot);
            }

            let analyzedCount = 0;
            const totalVariants = lotsByVariant.size;
            let currentVariantIdx = 0;

            for (const [key, variantLots] of lotsByVariant) {
                const firstLot = variantLots[0];
                const actualVariantStock = firstLot.variantId
                    ? (variantStockMap.get(firstLot.variantId) || 0)
                    : (defaultVariantMap.get(firstLot.productId) || 0);

                const totalLotStock = variantLots.reduce((sum, l) => sum + l.quantity, 0);

                // Calcular excesso
                let excess = totalLotStock - Math.max(0, actualVariantStock);

                if (excess > 0.01) {
                    // Há excesso. Os lotes mais antigos devem ser mortos primeiro (FIFO)
                    variantLots.sort((a, b) => new Date(a.receivedAt || 0).getTime() - new Date(b.receivedAt || 0).getTime());

                    for (const lot of variantLots) {
                        if (excess <= 0.01) break;

                        const deduct = Math.min(lot.quantity, excess);
                        const expectedLotQty = lot.quantity - deduct;
                        excess -= deduct;

                        issues.push({
                            lotId: lot.id,
                            productName: lot.productName,
                            variantName: lot.variantName,
                            sourceType: lot.sourceType,
                            sourceLabel: stockLotsService.getSourceTypeLabel(lot.sourceType),
                            invoiceNumber: lot.invoiceNumber,
                            receivedAt: lot.receivedAt,
                            currentQuantity: lot.quantity,
                            totalConsumed: 0, // Obsoleto na nova abordagem
                            expectedQuantity: expectedLotQty,
                            discrepancy: deduct
                        });
                    }
                }

                currentVariantIdx++;
                if (currentVariantIdx % 10 === 0) {
                    const pct = Math.round(60 + (currentVariantIdx / totalVariants) * 35);
                    onProgress?.('A analisar lotes...', pct, 100, `${currentVariantIdx}/${totalVariants} produtos`);
                }
            }

            onProgress?.('Concluído', 100, 100, `${issues.length} problema(s) encontrado(s)`);

            console.log(
                `[lotIntegrityService] Verificados ${totalLotsChecked} lotes, ` +
                `${lotsWithStock} activos, ${issues.length} problemas encontrados`
            );
        } catch (e: any) {
            console.error('[lotIntegrityService] detectStaleLots:', e);
        }

        const totalExcessStock = issues.reduce((s, i) => s + i.discrepancy, 0);

        return {
            generatedAt: new Date().toISOString(),
            issues,
            summary: {
                totalLotsChecked,
                lotsWithStock,
                issuesFound: issues.length,
                totalExcessStock
            }
        };
    },

    /**
     * Corrigir lotes inconsistentes definindo a quantidade a 0 (ou ao valor esperado).
     */
    async fixStaleLots(
        issues: LotIntegrityIssue[],
        onProgress?: LotIntegrityProgressCallback
    ): Promise<{
        fixed: number;
        errors: string[];
    }> {
        let fixed = 0;
        const errors: string[] = [];

        if (issues.length === 0) {
            onProgress?.('Concluído', 100, 100, 'Nada para corrigir');
            return { fixed: 0, errors: [] };
        }

        onProgress?.('A corrigir lotes...', 0, 100);

        for (let i = 0; i < issues.length; i++) {
            const issue = issues[i];

            try {
                const result = await stockLotsService.updateLot(issue.lotId, {
                    quantity: issue.expectedQuantity
                });

                if (result.success) {
                    fixed++;
                } else {
                    errors.push(`${issue.productName} ${issue.variantName}: ${result.error}`);
                }
            } catch (e: any) {
                errors.push(
                    `${issue.productName} ${issue.variantName}: ${e.message || e}`
                );
            }

            if (i % 10 === 0 || i === issues.length - 1) {
                const pct = Math.round(((i + 1) / issues.length) * 100);
                onProgress?.(
                    'A corrigir lotes...',
                    pct,
                    100,
                    `${fixed} corrigidos, ${errors.length} erros`
                );
            }
        }

        onProgress?.('Concluído', 100, 100, `${fixed} corrigidos, ${errors.length} erros`);
        console.log(`[lotIntegrityService] fixStaleLots: ${fixed} corrigidos, ${errors.length} erros`);

        return { fixed, errors };
    },

    /**
     * Buscar movimentos de saída (pedidos e ajustes negativos)
     */
    async _fetchOutboundMovements(): Promise<
        Array<{
            id: string;
            items: Array<{
                productId: string;
                variantId?: string;
                quantity: number;
            }>;
            sourceReference?: { type: string; id: string };
        }>
    > {
        if (!isSupabaseConfigured() || !supabase) return [];

        const all: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('id, items, source_reference')
                .range(offset, offset + BATCH_SIZE - 1);

            if (error) {
                console.error('[_fetchOutboundMovements] Error at offset', offset, error);
                break;
            }
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                for (const m of data) {
                    // Filtrar apenas movimentos de saída (items com quantity < 0)
                    const outItems = (m.items || []).filter(
                        (item: any) => (Number(item.quantity) || 0) < 0
                    );
                    if (outItems.length > 0) {
                        all.push({
                            id: m.id,
                            items: outItems.map((item: any) => ({
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: Number(item.quantity) || 0
                            })),
                            sourceReference: m.source_reference
                        });
                    }
                }
                offset += BATCH_SIZE;
                hasMore = data.length === BATCH_SIZE;
            }
        }

        console.log(`[_fetchOutboundMovements] Total: ${all.length} movimentos de saída`);
        return all;
    },

    // ─── Duplicate Lot Detection & Consolidation ──────────────────────────────

    /**
     * Detectar lotes duplicados: mesmo produto, variante, source_type, source_id,
     * unit_cost e mesma data (received_at truncada ao dia).
     * Retorna grupos de lotes duplicados que podem ser consolidados.
     */
    async detectDuplicateLots(
        onProgress?: LotIntegrityProgressCallback
    ): Promise<DuplicateLotGroup[]> {
        const groups: DuplicateLotGroup[] = [];

        try {
            onProgress?.('A carregar todos os lotes...', 0, 100);

            // Buscar todos os lotes (incluindo consumidos)
            const allLots = await stockLotsService.getStockLots({ includeConsumed: true });

            onProgress?.('A detectar duplicados...', 40, 100);

            // Agrupar por chave composta:
            // product_id + variant_id + source_type + source_id + unit_cost + received_at (dia)
            const lotsByKey = new Map<string, typeof allLots>();

            for (const lot of allLots) {
                const receivedDay = lot.receivedAt ? lot.receivedAt.slice(0, 10) : '';
                const key = [
                    lot.productId,
                    lot.variantId ?? 'null',
                    lot.sourceType,
                    lot.sourceId ?? 'null',
                    lot.unitCost.toFixed(2),
                    receivedDay
                ].join('|');

                if (!lotsByKey.has(key)) lotsByKey.set(key, []);
                lotsByKey.get(key)!.push(lot);
            }

            onProgress?.('A filtrar grupos duplicados...', 70, 100);

            // Filtrar apenas grupos com mais de 1 lote
            for (const [key, lots] of lotsByKey) {
                if (lots.length <= 1) continue;

                const first = lots[0];
                const totalQuantity = lots.reduce((s, l) => s + l.quantity, 0);
                const totalValue = lots.reduce((s, l) => s + l.totalValue, 0);

                groups.push({
                    key,
                    productName: first.productName,
                    variantName: first.variantName,
                    sourceType: first.sourceType,
                    sourceLabel: stockLotsService.getSourceTypeLabel(first.sourceType),
                    invoiceNumber: first.invoiceNumber,
                    unitCost: first.unitCost,
                    receivedAt: first.receivedAt,
                    lotCount: lots.length,
                    totalQuantity,
                    totalValue,
                    lots: lots.map(l => ({
                        id: l.id,
                        quantity: l.quantity,
                        unitCost: l.unitCost
                    }))
                });
            }

            // Ordenar por número de lotes (mais duplicados primeiro)
            groups.sort((a, b) => b.lotCount - a.lotCount);

            onProgress?.('Concluído', 100, 100, `${groups.length} grupo(s) de duplicados`);
            console.log(
                `[lotIntegrityService] detectDuplicateLots: ${allLots.length} lotes verificados, ` +
                `${groups.length} grupos de duplicados encontrados ` +
                `(${groups.reduce((s, g) => s + g.lotCount - 1, 0)} lotes redundantes)`
            );
        } catch (e: any) {
            console.error('[lotIntegrityService] detectDuplicateLots:', e);
        }

        return groups;
    },

    /**
     * Consolidar lotes duplicados: manter o primeiro lote de cada grupo,
     * somar a quantidade de todos os duplicados, e eliminar os restantes.
     */
    async consolidateDuplicateLots(
        groups: DuplicateLotGroup[],
        onProgress?: LotIntegrityProgressCallback
    ): Promise<{
        consolidated: number;
        lotsRemoved: number;
        errors: string[];
    }> {
        let consolidated = 0;
        let lotsRemoved = 0;
        const errors: string[] = [];

        if (groups.length === 0) {
            onProgress?.('Concluído', 100, 100, 'Nada para consolidar');
            return { consolidated: 0, lotsRemoved: 0, errors: [] };
        }

        onProgress?.('A consolidar lotes...', 0, 100);

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];

            try {
                // Manter o primeiro lote, somar quantidades
                const keepLot = group.lots[0];
                const duplicateLots = group.lots.slice(1);
                const totalQty = group.lots.reduce((s, l) => s + l.quantity, 0);

                // Actualizar o primeiro lote com a quantidade total
                const updateResult = await stockLotsService.updateLot(keepLot.id, {
                    quantity: totalQty
                });

                if (!updateResult.success) {
                    errors.push(
                        `${group.productName} ${group.variantName}: ${updateResult.error}`
                    );
                    continue;
                }

                // Eliminar os lotes duplicados
                for (const dup of duplicateLots) {
                    const deleteResult = await stockLotsService.deleteLot(dup.id);
                    if (deleteResult.success) {
                        lotsRemoved++;
                    } else {
                        errors.push(
                            `Erro ao eliminar lote ${dup.id}: ${deleteResult.error}`
                        );
                    }
                }

                consolidated++;
            } catch (e: any) {
                errors.push(
                    `${group.productName} ${group.variantName}: ${e.message || e}`
                );
            }

            if (i % 5 === 0 || i === groups.length - 1) {
                const pct = Math.round(((i + 1) / groups.length) * 100);
                onProgress?.(
                    'A consolidar lotes...',
                    pct,
                    100,
                    `${consolidated} consolidados, ${lotsRemoved} removidos`
                );
            }
        }

        onProgress?.(
            'Concluído',
            100,
            100,
            `${consolidated} consolidados, ${lotsRemoved} removidos, ${errors.length} erros`
        );
        console.log(
            `[lotIntegrityService] consolidateDuplicateLots: ${consolidated} consolidados, ` +
            `${lotsRemoved} removidos, ${errors.length} erros`
        );

        return { consolidated, lotsRemoved, errors };
    }
};

// ─── Additional Interfaces ────────────────────────────────────────────────────

export interface DuplicateLotGroup {
    key: string;
    productName: string;
    variantName: string;
    sourceType: string;
    sourceLabel: string;
    invoiceNumber?: string;
    unitCost: number;
    receivedAt: string;
    lotCount: number;
    totalQuantity: number;
    totalValue: number;
    lots: Array<{
        id: string;
        quantity: number;
        unitCost: number;
    }>;
}

