/**
 * Stock Integrity Service
 * Deteccao de anomalias, movimentos em falta, e validacao de integridade de stock
 * 
 * IMPORTANTE: Todas as operacoes usam paginacao para garantir que todos os registos sao processados
 */
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';
import { Order, OrderStatus, Purchase, StockMovement, Product, ProductVariant, StockAdjustmentReason } from '../../core/types/types';
import { stockService } from './stockService';
import { stockAdjustmentService } from './stockAdjustmentService';
import { orderService } from '../../sales/services/orderService';
import { purchaseService } from './purchaseService';
import { productService } from './productService';
import { getTodayDateString, extractLocalDate } from '../../core/utils/dateUtils';

// Tamanho do batch para operacoes paginadas
const BATCH_SIZE = 500;

export interface StockIntegrityIssue {
    type: 'missing_movement' | 'orphan_movement' | 'duplicate_movement' | 'stock_discrepancy' | 'missing_transaction';
    severity: 'error' | 'warning' | 'info';
    description: string;
    sourceType?: 'order' | 'purchase' | 'adjustment';
    sourceId?: string;
    productId?: string;
    productName?: string;
    variantId?: string;
    expectedQuantity?: number;
    actualQuantity?: number;
    movementId?: string;
}

/** Contagem de movimentos por tipo de origem (order, purchase, adjustment). Ajustes incluem os gerados por auditorias. */
export interface MovementCountByType {
    order: number;
    purchase: number;
    adjustment: number;
    other: number;
}

export interface StockIntegrityReport {
    generatedAt: string;
    issues: StockIntegrityIssue[];
    summary: {
        totalIssues: number;
        errors: number;
        warnings: number;
        infos: number;
        missingMovements: number;
        orphanMovements: number;
        duplicateMovements: number;
        stockDiscrepancies: number;
    };
    checkedOrders: number;
    checkedPurchases: number;
    checkedMovements: number;
    checkedProducts: number;
    /** Contagem de movimentos por tipo; confirma que order, purchase e adjustment (auditorias) entram no cálculo. */
    movementCountByType?: MovementCountByType;
}

export type ProgressCallback = (stage: string, current: number, total: number, message?: string) => void;

/**
 * Funcoes de paginacao para buscar todos os registos do Supabase
 * (o Supabase tem um limite default de 1000 registos)
 */
async function fetchAllOrders(): Promise<Order[]> {
    if (!isSupabaseConfigured() || !supabase) return [];
    
    const allOrders: Order[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, profiles:created_by(name)')
            .order('created_at', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
            console.error('[fetchAllOrders] Error at offset', offset, error);
            break;
        }
        
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            for (const row of data) {
                allOrders.push({
                    id: row.id,
                    externalId: row.external_id,
                    orderNumber: row.order_number,
                    customerId: row.customer_id,
                    customerName: row.customer_name,
                    customerPhone: row.customer_phone,
                    items: row.items || [],
                    totalAmount: Number(row.total_amount) || 0,
                    status: row.status,
                    source: row.source,
                    isDelivery: !!row.is_delivery,
                    deliveryLocation: row.delivery_location,
                    deliveryFee: Number(row.delivery_fee) || 0,
                    paymentStatus: row.payment_status || 'unpaid',
                    amountPaid: Number(row.amount_paid) || 0,
                    paymentProof: row.payment_proof,
                    paymentProofText: row.payment_proof_text,
                    notes: row.notes,
                    createdAt: row.created_at,
                    createdBy: row.created_by,
                    createdByName: row.profiles?.name || undefined,
                    deliveryZoneId: row.delivery_zone_id,
                    deliveryZoneName: row.delivery_zone_name,
                    deliveryLatitude: row.delivery_latitude,
                    deliveryLongitude: row.delivery_longitude,
                    deliveryAddressFormatted: row.delivery_address_formatted
                });
            }
            offset += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE;
        }
    }
    
    console.log(`[fetchAllOrders] Total: ${allOrders.length} pedidos`);
    return allOrders;
}

async function fetchAllPurchases(): Promise<Purchase[]> {
    if (!isSupabaseConfigured() || !supabase) return [];
    
    const allPurchases: Purchase[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase
            .from('purchases')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
            console.error('[fetchAllPurchases] Error at offset', offset, error);
            break;
        }
        
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            for (const row of data) {
                allPurchases.push({
                    id: row.id,
                    supplierId: row.supplier_id,
                    supplierName: row.supplier_name,
                    items: row.items || [],
                    totalAmount: Number(row.total_amount) || 0,
                    invoiceNumber: row.invoice_number,
                    orderDate: row.order_date,
                    expectedDeliveryDate: row.expected_delivery_date,
                    status: row.status || 'Pendente',
                    notes: row.notes,
                    createdAt: row.created_at,
                    createdBy: row.created_by,
                    updatedAt: row.updated_at
                });
            }
            offset += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE;
        }
    }
    
    console.log(`[fetchAllPurchases] Total: ${allPurchases.length} compras`);
    return allPurchases;
}

async function fetchAllMovements(): Promise<StockMovement[]> {
    if (!isSupabaseConfigured() || !supabase) return [];
    
    const allMovements: StockMovement[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .order('date', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
            console.error('[fetchAllMovements] Error at offset', offset, error);
            break;
        }
        
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            for (const m of data) {
                allMovements.push({
                    id: m.id,
                    date: m.date,
                    items: m.items,
                    notes: m.notes,
                    sourceReference: m.source_reference,
                    createdAt: m.created_at,
                    updatedAt: m.updated_at
                });
            }
            offset += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE;
        }
    }
    
    console.log(`[fetchAllMovements] Total: ${allMovements.length} movimentos`);
    return allMovements;
}

/**
 * Obter a data mais antiga do stock inicial para considerar como limite
 */
async function getStockInitialDate(): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    
    const { data, error } = await supabase
        .from('stock_initial_snapshot')
        .select('snapshot_date')
        .order('snapshot_date', { ascending: true })
        .limit(1);
    
    if (error || !data || data.length === 0) return null;
    return data[0].snapshot_date;
}

/** Tipos de movimento considerados no cálculo de stock (alinhado com get_stock_period_summary). */
function isMovementTypeForStock(m: StockMovement): boolean {
    const t = m.sourceReference?.type;
    return t === 'purchase' || t === 'order' || t === 'adjustment' || t == null;
}

export const stockIntegrityService = {
    /**
     * Detectar pedidos entregues sem movimento de stock correspondente
     * Considera apenas pedidos apos a data do stock inicial (se existir)
     */
    async detectMissingOrderMovements(onProgress?: ProgressCallback): Promise<StockIntegrityIssue[]> {
        const issues: StockIntegrityIssue[] = [];
        
        try {
            onProgress?.('A carregar pedidos...', 0, 100);
            const orders = await fetchAllOrders();
            
            onProgress?.('A carregar movimentos...', 30, 100);
            const movements = await fetchAllMovements();
            
            // Obter data do stock inicial para filtrar pedidos antigos
            const stockInitialDate = await getStockInitialDate();
            
            onProgress?.('A analisar pedidos...', 60, 100);
            
            // Filtrar pedidos entregues (e apos a data do stock inicial se existir)
            const deliveredOrders = orders.filter(o => {
                const isDelivered = o.status === 'Entregue' || o.status === OrderStatus.DELIVERED;
                if (!isDelivered) return false;
                
                // Se temos stock inicial, ignorar pedidos anteriores a essa data
                if (stockInitialDate) {
                    const orderDate = o.createdAt?.split('T')[0];
                    if (orderDate && orderDate < stockInitialDate) {
                        return false; // Pedido anterior ao stock inicial
                    }
                }
                
                return true;
            });
            
            // Criar set de IDs de pedidos com movimentos
            const orderIdsWithMovements = new Set<string>();
            for (const m of movements) {
                if (m.sourceReference?.type === 'order' && m.sourceReference?.id) {
                    orderIdsWithMovements.add(m.sourceReference.id);
                }
            }
            
            // Verificar cada pedido entregue
            for (const order of deliveredOrders) {
                if (!orderIdsWithMovements.has(order.id)) {
                    issues.push({
                        type: 'missing_movement',
                        severity: 'error',
                        description: `Pedido ${order.orderNumber || order.id} entregue sem movimento de stock`,
                        sourceType: 'order',
                        sourceId: order.id
                    });
                }
            }
            
            onProgress?.('Concluído', 100, 100);
            console.log(`[detectMissingOrderMovements] ${deliveredOrders.length} pedidos entregues verificados, ${issues.length} em falta`);
        } catch (e: any) {
            console.error('[stockIntegrityService] detectMissingOrderMovements:', e);
        }
        
        return issues;
    },

    /**
     * Detectar compras sem movimento de stock correspondente
     * Considera apenas compras apos a data do stock inicial (se existir)
     */
    async detectMissingPurchaseMovements(onProgress?: ProgressCallback): Promise<StockIntegrityIssue[]> {
        const issues: StockIntegrityIssue[] = [];
        
        try {
            onProgress?.('A carregar compras...', 0, 100);
            const purchases = await fetchAllPurchases();
            
            onProgress?.('A carregar movimentos...', 30, 100);
            const movements = await fetchAllMovements();
            
            // Obter data do stock inicial
            const stockInitialDate = await getStockInitialDate();
            
            onProgress?.('A analisar compras...', 60, 100);
            
            // Criar set de IDs de compras com movimentos
            const purchaseIdsWithMovements = new Set<string>();
            for (const m of movements) {
                if (m.sourceReference?.type === 'purchase' && m.sourceReference?.id) {
                    purchaseIdsWithMovements.add(m.sourceReference.id);
                }
            }
            
            // Verificar cada compra (filtrar por data do stock inicial)
            for (const purchase of purchases) {
                // Se temos stock inicial, ignorar compras anteriores
                if (stockInitialDate) {
                    const purchaseDate = purchase.orderDate || purchase.createdAt?.split('T')[0];
                    if (purchaseDate && purchaseDate < stockInitialDate) {
                        continue; // Compra anterior ao stock inicial
                    }
                }
                
                if (!purchaseIdsWithMovements.has(purchase.id)) {
                    issues.push({
                        type: 'missing_movement',
                        severity: 'warning',
                        description: `Compra ${purchase.invoiceNumber || purchase.id} sem movimento de stock`,
                        sourceType: 'purchase',
                        sourceId: purchase.id
                    });
                }
            }
            
            onProgress?.('Concluído', 100, 100);
            console.log(`[detectMissingPurchaseMovements] ${purchases.length} compras verificadas, ${issues.length} em falta`);
        } catch (e: any) {
            console.error('[stockIntegrityService] detectMissingPurchaseMovements:', e);
        }
        
        return issues;
    },

    /**
     * Detectar movimentos órfãos (sem pedido/compra correspondente)
     */
    async detectOrphanMovements(onProgress?: ProgressCallback): Promise<StockIntegrityIssue[]> {
        const issues: StockIntegrityIssue[] = [];
        
        try {
            onProgress?.('A carregar dados...', 0, 100);
            const [movements, orders, purchases] = await Promise.all([
                fetchAllMovements(),
                fetchAllOrders(),
                fetchAllPurchases()
            ]);
            
            onProgress?.('A analisar movimentos...', 60, 100);
            
            const orderIds = new Set(orders.map(o => o.id));
            const purchaseIds = new Set(purchases.map(p => p.id));
            
            for (const movement of movements) {
                if (!movement.sourceReference?.type || !movement.sourceReference?.id) {
                    continue; // Movimento manual, não é órfão
                }
                
                const { type, id } = movement.sourceReference;
                
                if (type === 'order' && !orderIds.has(id)) {
                    issues.push({
                        type: 'orphan_movement',
                        severity: 'warning',
                        description: `Movimento ${movement.id} referencia pedido inexistente ${id}`,
                        movementId: movement.id,
                        sourceType: 'order',
                        sourceId: id
                    });
                } else if (type === 'purchase' && !purchaseIds.has(id)) {
                    issues.push({
                        type: 'orphan_movement',
                        severity: 'warning',
                        description: `Movimento ${movement.id} referencia compra inexistente ${id}`,
                        movementId: movement.id,
                        sourceType: 'purchase',
                        sourceId: id
                    });
                }
            }
            
            onProgress?.('Concluído', 100, 100);
        } catch (e: any) {
            console.error('[stockIntegrityService] detectOrphanMovements:', e);
        }
        
        return issues;
    },

    /**
     * Detectar movimentos duplicados (mesmo sourceReference)
     */
    async detectDuplicateMovements(onProgress?: ProgressCallback): Promise<StockIntegrityIssue[]> {
        const issues: StockIntegrityIssue[] = [];
        
        try {
            onProgress?.('A carregar movimentos...', 0, 100);
            const movements = await fetchAllMovements();
            
            onProgress?.('A analisar duplicados...', 50, 100);
            
            // Agrupar por sourceReference
            const bySource = new Map<string, StockMovement[]>();
            for (const m of movements) {
                if (!m.sourceReference?.type || !m.sourceReference?.id) continue;
                const key = `${m.sourceReference.type}:${m.sourceReference.id}`;
                if (!bySource.has(key)) bySource.set(key, []);
                bySource.get(key)!.push(m);
            }
            
            // Reportar duplicados
            for (const [key, group] of bySource) {
                if (group.length > 1) {
                    const [type, id] = key.split(':');
                    issues.push({
                        type: 'duplicate_movement',
                        severity: 'warning',
                        description: `${group.length} movimentos duplicados para ${type} ${id.substring(0, 8)}...`,
                        sourceType: type as 'order' | 'purchase',
                        sourceId: id,
                        movementId: group.map(m => m.id).join(', ')
                    });
                }
            }
            
            onProgress?.('Concluído', 100, 100);
        } catch (e: any) {
            console.error('[stockIntegrityService] detectDuplicateMovements:', e);
        }
        
        return issues;
    },

    /**
     * Detectar discrepâncias entre stock calculado e stock actual.
     * Lógica alinhada com get_stock_period_summary: produtos no snapshot usam snapshot + movimentos
     * após snapshot; produtos fora do snapshot usam todos os movimentos (antes e após o snapshot).
     * Apenas tipos purchase, order, adjustment (ou null) são considerados.
     */
    async detectStockDiscrepancies(onProgress?: ProgressCallback): Promise<StockIntegrityIssue[]> {
        const issues: StockIntegrityIssue[] = [];
        
        try {
            onProgress?.('A carregar dados...', 0, 100);
            const products = await productService.getProducts({ useCalculatedStock: false });
            const movements = await fetchAllMovements();
            
            // Obter data do stock inicial
            const stockInitialDate = await getStockInitialDate();
            
            // Carregar snapshot inicial se existir
            let initialStock = new Map<string, number>();
            if (stockInitialDate) {
                const snapshots = await stockService.getStockInitialSnapshot(stockInitialDate);
                for (const s of snapshots) {
                    const key = s.variantId || `product:${s.productId}`;
                    initialStock.set(key, s.quantity);
                }
            }
            
            onProgress?.('A calcular stock...', 50, 100);
            
            const calculatedStock = new Map<string, number>(initialStock);
            
            // Produtos fora do snapshot: somar movimentos anteriores ao snapshot (alinhado com movements_before_agg)
            if (stockInitialDate) {
                for (const movement of movements) {
                    if (movement.date >= stockInitialDate || !isMovementTypeForStock(movement)) continue;
                    for (const item of movement.items || []) {
                        const key = item.variantId || `product:${item.productId}`;
                        if (initialStock.has(key)) continue;
                        calculatedStock.set(key, (calculatedStock.get(key) || 0) + (item.quantity || 0));
                    }
                }
            }
            
            // Snapshot + movimentos após snapshot (ou todos os movimentos se não houver snapshot)
            for (const movement of movements) {
                if (stockInitialDate && movement.date < stockInitialDate) continue;
                if (!isMovementTypeForStock(movement)) continue;
                for (const item of movement.items || []) {
                    const key = item.variantId || `product:${item.productId}`;
                    calculatedStock.set(key, (calculatedStock.get(key) || 0) + (item.quantity || 0));
                }
            }
            
            onProgress?.('A comparar stocks...', 80, 100);
            
            // Comparar com stock actual nas variantes
            for (const product of products) {
                for (const variant of product.variants || []) {
                    const calculated = calculatedStock.get(variant.id) ?? 0;
                    const actual = variant.stock ?? 0;
                    const diff = Math.abs(calculated - actual);
                    const hasNegativeStock = calculated < 0 || actual < 0;
                    
                    // Reportar se diferença significativa (> 0.1) OU stock negativo (mesmo que calculado = actual)
                    if (diff > 0.1 || hasNegativeStock) {
                        const desc = hasNegativeStock
                            ? `Stock de ${product.name} ${variant.name}: calculado=${calculated.toFixed(2)}, actual=${actual.toFixed(2)} — stock negativo requer correção`
                            : `Stock de ${product.name} ${variant.name}: calculado=${calculated.toFixed(2)}, actual=${actual.toFixed(2)}, diff=${diff.toFixed(2)}`;
                        issues.push({
                            type: 'stock_discrepancy',
                            severity: hasNegativeStock || diff > 5 ? 'error' : 'warning',
                            description: desc,
                            productId: product.id,
                            productName: product.name,
                            variantId: variant.id,
                            expectedQuantity: calculated,
                            actualQuantity: actual
                        });
                    }
                }
            }
            
            onProgress?.('Concluído', 100, 100);
        } catch (e: any) {
            console.error('[stockIntegrityService] detectStockDiscrepancies:', e);
        }
        
        return issues;
    },

    /**
     * Gerar relatório completo de integridade
     */
    async generateIntegrityReport(
        options?: {
            checkOrders?: boolean;
            checkPurchases?: boolean;
            checkDuplicates?: boolean;
            checkOrphans?: boolean;
            checkDiscrepancies?: boolean;
        },
        onProgress?: ProgressCallback
    ): Promise<StockIntegrityReport> {
        const opts = {
            checkOrders: true,
            checkPurchases: true,
            checkDuplicates: true,
            checkOrphans: true,
            checkDiscrepancies: true,
            ...options
        };

        const allIssues: StockIntegrityIssue[] = [];
        let checkedOrders = 0;
        let checkedPurchases = 0;
        let checkedMovements = 0;
        let checkedProducts = 0;
        let movementCountByType: MovementCountByType = { order: 0, purchase: 0, adjustment: 0, other: 0 };

        try {
            onProgress?.('A carregar dados...', 0, 100);
            
            // Carregar todas as entidades com paginacao
            const [orders, purchases, movements, products] = await Promise.all([
                fetchAllOrders(),
                fetchAllPurchases(),
                fetchAllMovements(),
                productService.getProducts({ useCalculatedStock: false })
            ]);
            
            checkedOrders = orders.length;
            checkedPurchases = purchases.length;
            checkedMovements = movements.length;
            checkedProducts = products.length;

            // Contagem por tipo de movimento (order, purchase, adjustment) para confirmar que auditorias/ajustes entram no cálculo
            movementCountByType = { order: 0, purchase: 0, adjustment: 0, other: 0 };
            for (const m of movements) {
                const t = m.sourceReference?.type;
                if (t === 'order') movementCountByType.order++;
                else if (t === 'purchase') movementCountByType.purchase++;
                else if (t === 'adjustment') movementCountByType.adjustment++;
                else if (t != null) movementCountByType.other++;
            }
            
            console.log(`[generateIntegrityReport] Carregados: ${checkedOrders} pedidos, ${checkedPurchases} compras, ${checkedMovements} movimentos, ${checkedProducts} produtos; por tipo: order=${movementCountByType.order}, purchase=${movementCountByType.purchase}, adjustment=${movementCountByType.adjustment}, other=${movementCountByType.other}`);

            // Executar verificações
            let progress = 20;
            const progressStep = 16;
            
            if (opts.checkOrders) {
                onProgress?.('A verificar pedidos...', progress, 100);
                const orderIssues = await this.detectMissingOrderMovements();
                allIssues.push(...orderIssues);
                progress += progressStep;
            }

            if (opts.checkPurchases) {
                onProgress?.('A verificar compras...', progress, 100);
                const purchaseIssues = await this.detectMissingPurchaseMovements();
                allIssues.push(...purchaseIssues);
                progress += progressStep;
            }

            if (opts.checkDuplicates) {
                onProgress?.('A verificar duplicados...', progress, 100);
                const duplicateIssues = await this.detectDuplicateMovements();
                allIssues.push(...duplicateIssues);
                progress += progressStep;
            }

            if (opts.checkOrphans) {
                onProgress?.('A verificar órfãos...', progress, 100);
                const orphanIssues = await this.detectOrphanMovements();
                allIssues.push(...orphanIssues);
                progress += progressStep;
            }

            if (opts.checkDiscrepancies) {
                onProgress?.('A verificar discrepâncias...', progress, 100);
                const discrepancyIssues = await this.detectStockDiscrepancies();
                allIssues.push(...discrepancyIssues);
            }
            
            onProgress?.('Concluído', 100, 100);
        } catch (e: any) {
            console.error('[stockIntegrityService] generateIntegrityReport:', e);
        }

        // Calcular sumário
        const summary = {
            totalIssues: allIssues.length,
            errors: allIssues.filter(i => i.severity === 'error').length,
            warnings: allIssues.filter(i => i.severity === 'warning').length,
            infos: allIssues.filter(i => i.severity === 'info').length,
            missingMovements: allIssues.filter(i => i.type === 'missing_movement').length,
            orphanMovements: allIssues.filter(i => i.type === 'orphan_movement').length,
            duplicateMovements: allIssues.filter(i => i.type === 'duplicate_movement').length,
            stockDiscrepancies: allIssues.filter(i => i.type === 'stock_discrepancy').length
        };

        return {
            generatedAt: new Date().toISOString(),
            issues: allIssues,
            summary,
            checkedOrders,
            checkedPurchases,
            checkedMovements,
            checkedProducts,
            movementCountByType
        };
    },

    /**
     * Corrigir movimentos em falta para pedidos entregues
     * Processa em batch para evitar timeouts e mostrar progresso
     */
    async fixMissingOrderMovements(
        dryRun = true,
        onProgress?: ProgressCallback
    ): Promise<{
        fixed: number;
        skipped: number;
        errors: string[];
        dryRun: boolean;
    }> {
        const errors: string[] = [];
        let fixed = 0;
        let skipped = 0;
        const BATCH_SIZE_FIX = 50; // Processar 50 de cada vez

        try {
            onProgress?.('A detectar movimentos em falta...', 0, 100);
            
            // Detectar todos os pedidos sem movimento
            const issues = await this.detectMissingOrderMovements();
            const orderIssues = issues.filter(i => i.type === 'missing_movement' && i.sourceType === 'order');
            
            if (orderIssues.length === 0) {
                onProgress?.('Concluído', 100, 100, 'Nenhum movimento em falta');
                return { fixed: 0, skipped: 0, errors: [], dryRun };
            }
            
            console.log(`[fixMissingOrderMovements] ${orderIssues.length} pedidos sem movimento`);
            
            // Carregar todos os pedidos uma vez
            onProgress?.('A carregar pedidos...', 5, 100);
            const allOrders = await fetchAllOrders();
            const ordersMap = new Map(allOrders.map(o => [o.id, o]));
            
            // Processar em batches
            const totalBatches = Math.ceil(orderIssues.length / BATCH_SIZE_FIX);
            
            for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
                const batchStart = batchIdx * BATCH_SIZE_FIX;
                const batchEnd = Math.min(batchStart + BATCH_SIZE_FIX, orderIssues.length);
                const batch = orderIssues.slice(batchStart, batchEnd);
                
                const progress = Math.round(10 + (batchIdx / totalBatches) * 85);
                onProgress?.(`A processar batch ${batchIdx + 1}/${totalBatches}...`, progress, 100, 
                    `${fixed} criados, ${skipped} ignorados, ${errors.length} erros`);
                
                // Processar cada pedido do batch
                for (const issue of batch) {
                    const orderId = issue.sourceId;
                    if (!orderId) {
                        skipped++;
                        continue;
                    }
                    
                    const order = ordersMap.get(orderId);
                    if (!order) {
                        errors.push(`Pedido ${orderId}: não encontrado`);
                        skipped++;
                        continue;
                    }
                    
                    if (!order.items?.length) {
                        skipped++;
                        continue;
                    }
                    
                    try {
                        if (!dryRun) {
                            // Usar a data actual para movimentos criados como correcção
                            // (já que não sabemos quando o pedido foi entregue originalmente)
                            await (orderService as any)._createStockRecordsForOrder(
                                order.id,
                                order.orderNumber || order.id,
                                getTodayDateString(), // Data actual, não data de criação
                                order.items,
                                order.customerName
                            );
                        }
                        fixed++;
                    } catch (e: any) {
                        const errorMsg = `Pedido ${order.orderNumber || orderId}: ${e.message || e}`;
                        errors.push(errorMsg);
                        console.error('[fixMissingOrderMovements]', errorMsg);
                    }
                }
                
                // Pequena pausa entre batches para não sobrecarregar
                if (!dryRun && batchIdx < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            onProgress?.('Concluído', 100, 100, `${fixed} criados, ${skipped} ignorados, ${errors.length} erros`);
            console.log(`[fixMissingOrderMovements] Resultado: ${fixed} corrigidos, ${skipped} ignorados, ${errors.length} erros`);
            
        } catch (e: any) {
            const msg = e.message || 'Erro geral';
            errors.push(msg);
            console.error('[fixMissingOrderMovements]', msg);
        }

        return { fixed, skipped, errors, dryRun };
    },

    /**
     * Remover movimentos duplicados (manter o mais recente)
     * Processa em batch
     */
    async fixDuplicateMovements(
        dryRun = true,
        onProgress?: ProgressCallback
    ): Promise<{
        removed: number;
        errors: string[];
        dryRun: boolean;
    }> {
        const errors: string[] = [];
        let removed = 0;
        const BATCH_SIZE_FIX = 50;

        try {
            onProgress?.('A carregar movimentos...', 0, 100);
            const movements = await fetchAllMovements();
            
            onProgress?.('A detectar duplicados...', 20, 100);
            
            // Agrupar por sourceReference
            const bySource = new Map<string, StockMovement[]>();
            for (const m of movements) {
                if (!m.sourceReference?.type || !m.sourceReference?.id) continue;
                const key = `${m.sourceReference.type}:${m.sourceReference.id}`;
                if (!bySource.has(key)) bySource.set(key, []);
                bySource.get(key)!.push(m);
            }
            
            // Colectar IDs de movimentos a remover
            const toRemove: string[] = [];
            for (const [key, group] of bySource) {
                if (group.length <= 1) continue;
                
                // Ordenar por createdAt (mais recente primeiro)
                group.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
                
                // Manter o primeiro, marcar os restantes para remocao
                for (let i = 1; i < group.length; i++) {
                    toRemove.push(group[i].id);
                }
            }
            
            if (toRemove.length === 0) {
                onProgress?.('Concluído', 100, 100, 'Nenhum duplicado encontrado');
                return { removed: 0, errors: [], dryRun };
            }
            
            console.log(`[fixDuplicateMovements] ${toRemove.length} movimentos duplicados a remover`);
            
            // Processar em batches
            const totalBatches = Math.ceil(toRemove.length / BATCH_SIZE_FIX);
            
            for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
                const batchStart = batchIdx * BATCH_SIZE_FIX;
                const batchEnd = Math.min(batchStart + BATCH_SIZE_FIX, toRemove.length);
                const batch = toRemove.slice(batchStart, batchEnd);
                
                const progress = Math.round(30 + (batchIdx / totalBatches) * 65);
                onProgress?.(`A remover batch ${batchIdx + 1}/${totalBatches}...`, progress, 100);
                
                for (const movementId of batch) {
                    try {
                        if (!dryRun) {
                            await stockService.deleteStockMovement(movementId);
                        }
                        removed++;
                    } catch (e: any) {
                        errors.push(`Movimento ${movementId}: ${e.message || e}`);
                    }
                }
                
                // Pausa entre batches
                if (!dryRun && batchIdx < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            onProgress?.('Concluído', 100, 100, `${removed} removidos`);
        } catch (e: any) {
            errors.push(e.message || 'Erro geral');
        }

        return { removed, errors, dryRun };
    },

    /**
     * Remover movimentos órfãos
     * Processa em batch
     */
    async fixOrphanMovements(
        dryRun = true,
        onProgress?: ProgressCallback
    ): Promise<{
        removed: number;
        errors: string[];
        dryRun: boolean;
    }> {
        const errors: string[] = [];
        let removed = 0;
        const BATCH_SIZE_FIX = 50;

        try {
            onProgress?.('A detectar movimentos órfãos...', 0, 100);
            const issues = await this.detectOrphanMovements();
            
            const orphanIds = issues
                .filter(i => i.type === 'orphan_movement' && i.movementId)
                .map(i => i.movementId!);
            
            if (orphanIds.length === 0) {
                onProgress?.('Concluído', 100, 100, 'Nenhum órfão encontrado');
                return { removed: 0, errors: [], dryRun };
            }
            
            console.log(`[fixOrphanMovements] ${orphanIds.length} movimentos órfãos a remover`);
            
            // Processar em batches
            const totalBatches = Math.ceil(orphanIds.length / BATCH_SIZE_FIX);
            
            for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
                const batchStart = batchIdx * BATCH_SIZE_FIX;
                const batchEnd = Math.min(batchStart + BATCH_SIZE_FIX, orphanIds.length);
                const batch = orphanIds.slice(batchStart, batchEnd);
                
                const progress = Math.round(20 + (batchIdx / totalBatches) * 75);
                onProgress?.(`A remover batch ${batchIdx + 1}/${totalBatches}...`, progress, 100);
                
                for (const movementId of batch) {
                    try {
                        if (!dryRun) {
                            await stockService.deleteStockMovement(movementId);
                        }
                        removed++;
                    } catch (e: any) {
                        errors.push(`Movimento ${movementId}: ${e.message || e}`);
                    }
                }
                
                // Pausa entre batches
                if (!dryRun && batchIdx < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            onProgress?.('Concluído', 100, 100, `${removed} removidos`);
        } catch (e: any) {
            errors.push(e.message || 'Erro geral');
        }

        return { removed, errors, dryRun };
    },

    /**
     * Criar movimentos em falta para compras
     * Processa em batch
     */
    async fixMissingPurchaseMovements(
        dryRun = true,
        onProgress?: ProgressCallback
    ): Promise<{
        fixed: number;
        skipped: number;
        errors: string[];
        dryRun: boolean;
    }> {
        const errors: string[] = [];
        let fixed = 0;
        let skipped = 0;
        const BATCH_SIZE_FIX = 50;

        try {
            onProgress?.('A detectar compras sem movimento...', 0, 100);
            
            // Detectar compras sem movimento
            const issues = await this.detectMissingPurchaseMovements();
            const purchaseIssues = issues.filter(i => i.type === 'missing_movement' && i.sourceType === 'purchase');
            
            if (purchaseIssues.length === 0) {
                onProgress?.('Concluído', 100, 100, 'Nenhuma compra sem movimento');
                return { fixed: 0, skipped: 0, errors: [], dryRun };
            }
            
            console.log(`[fixMissingPurchaseMovements] ${purchaseIssues.length} compras sem movimento`);
            
            // Carregar todas as compras uma vez
            onProgress?.('A carregar compras...', 5, 100);
            const allPurchases = await fetchAllPurchases();
            const purchasesMap = new Map(allPurchases.map(p => [p.id, p]));
            
            // Processar em batches
            const totalBatches = Math.ceil(purchaseIssues.length / BATCH_SIZE_FIX);
            
            for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
                const batchStart = batchIdx * BATCH_SIZE_FIX;
                const batchEnd = Math.min(batchStart + BATCH_SIZE_FIX, purchaseIssues.length);
                const batch = purchaseIssues.slice(batchStart, batchEnd);
                
                const progress = Math.round(10 + (batchIdx / totalBatches) * 85);
                onProgress?.(`A processar batch ${batchIdx + 1}/${totalBatches}...`, progress, 100, 
                    `${fixed} criados, ${skipped} ignorados, ${errors.length} erros`);
                
                for (const issue of batch) {
                    const purchaseId = issue.sourceId;
                    if (!purchaseId) {
                        skipped++;
                        continue;
                    }
                    
                    const purchase = purchasesMap.get(purchaseId);
                    if (!purchase) {
                        errors.push(`Compra ${purchaseId}: não encontrada`);
                        skipped++;
                        continue;
                    }
                    
                    if (!purchase.items?.length) {
                        skipped++;
                        continue;
                    }
                    
                    try {
                        if (!dryRun) {
                            // Criar movimento de stock para a compra
                            const purchaseDate = purchase.date || extractLocalDate(purchase.createdAt || '');
                            const stockItems = purchase.items.map((item: any) => ({
                                productId: item.productId,
                                productName: item.productName || item.name,
                                variantId: item.variantId,
                                variant: item.variantName || item.variant,
                                quantity: Math.abs(item.quantity), // Entrada positiva
                                unit: item.unit || 'un'
                            }));
                            
                            if (stockItems.length > 0) {
                                const stockMovement = {
                                    id: '',
                                    date: purchaseDate,
                                    items: stockItems,
                                    notes: `Entrada de stock via compra - ${purchase.supplierName || ''} (${purchase.invoiceNumber || ''})`,
                                    sourceReference: { type: 'purchase' as const, id: purchase.id },
                                    createdAt: new Date().toISOString()
                                };
                                await stockService.ensureStockMovement(stockMovement);
                            }
                        }
                        fixed++;
                    } catch (e: any) {
                        const errorMsg = `Compra ${purchase.invoiceNumber || purchaseId}: ${e.message || e}`;
                        errors.push(errorMsg);
                        console.error('[fixMissingPurchaseMovements]', errorMsg);
                    }
                }
                
                if (!dryRun && batchIdx < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            onProgress?.('Concluído', 100, 100, `${fixed} criados, ${skipped} ignorados, ${errors.length} erros`);
            console.log(`[fixMissingPurchaseMovements] Resultado: ${fixed} corrigidos, ${skipped} ignorados, ${errors.length} erros`);
            
        } catch (e: any) {
            const msg = e.message || 'Erro geral';
            errors.push(msg);
            console.error('[fixMissingPurchaseMovements]', msg);
        }

        return { fixed, skipped, errors, dryRun };
    },

    /**
     * Corrigir discrepâncias de stock.
     * Recalcula o stock com a mesma lógica que get_stock_period_summary e detectStockDiscrepancies:
     * produtos no snapshot = snapshot + movimentos após snapshot; produtos fora = todos os movimentos.
     * Apenas tipos purchase, order, adjustment (ou null). Actualiza product_variants.
     */
    async fixStockDiscrepancies(
        dryRun = true,
        onProgress?: ProgressCallback
    ): Promise<{
        fixed: number;
        errors: string[];
        dryRun: boolean;
        details: { product: string; variant: string; before: number; after: number }[];
    }> {
        const errors: string[] = [];
        let fixed = 0;
        const details: { product: string; variant: string; before: number; after: number }[] = [];

        try {
            onProgress?.('A carregar dados...', 0, 100);
            
            const stockInitialDate = await getStockInitialDate();
            
            let initialStock = new Map<string, number>();
            if (stockInitialDate) {
                const snapshots = await stockService.getStockInitialSnapshot(stockInitialDate);
                for (const s of snapshots) {
                    const key = s.variantId || `product:${s.productId}`;
                    initialStock.set(key, s.quantity);
                }
            }
            
            onProgress?.('A carregar movimentos...', 20, 100);
            const movements = await fetchAllMovements();
            const products = await productService.getProducts({ useCalculatedStock: false });
            
            onProgress?.('A calcular stock...', 40, 100);
            
            const calculatedStock = new Map<string, number>(initialStock);
            
            if (stockInitialDate) {
                for (const movement of movements) {
                    if (movement.date >= stockInitialDate || !isMovementTypeForStock(movement)) continue;
                    for (const item of movement.items || []) {
                        const key = item.variantId || `product:${item.productId}`;
                        if (initialStock.has(key)) continue;
                        calculatedStock.set(key, (calculatedStock.get(key) || 0) + (item.quantity || 0));
                    }
                }
            }
            
            for (const movement of movements) {
                if (stockInitialDate && movement.date < stockInitialDate) continue;
                if (!isMovementTypeForStock(movement)) continue;
                for (const item of movement.items || []) {
                    const key = item.variantId || `product:${item.productId}`;
                    calculatedStock.set(key, (calculatedStock.get(key) || 0) + (item.quantity || 0));
                }
            }
            
            onProgress?.('A corrigir discrepâncias...', 60, 100);
            
            // Corrigir cada variante com discrepância
            for (const product of products) {
                for (const variant of product.variants || []) {
                    const calculated = calculatedStock.get(variant.id) ?? 0;
                    const actual = variant.stock ?? 0;
                    const diff = Math.abs(calculated - actual);
                    const hasNegativeStock = calculated < 0 || actual < 0;
                    
                    // Corrigir quando há diferença OU quando stock é negativo (mesmo calculado = actual)
                    if (diff <= 0.1 && !hasNegativeStock) continue;
                    
                    const safeStock = Math.max(0, calculated);
                    
                    try {
                        if (!dryRun) {
                            // Quando stock calculado é negativo: criar ajuste de entrada para zerar o ledger
                            if (calculated < 0) {
                                const adjQty = Math.abs(calculated);
                                const adjResult = await stockAdjustmentService.createAdjustment({
                                    productId: product.id,
                                    productName: product.name,
                                    variantId: variant.id,
                                    variantName: variant.name,
                                    quantity: adjQty,
                                    reason: StockAdjustmentReason.CORRECTION,
                                    notes: `Correção de integridade: stock calculado era ${calculated.toFixed(2)}`,
                                    date: getTodayDateString()
                                });
                                if (adjResult.error) {
                                    errors.push(`${product.name} ${variant.name}: ${adjResult.error}`);
                                    continue;
                                }
                            }
                            // Actualizar product_variants para alinhar ao valor seguro (0 ou calculado)
                            const { error } = await supabase
                                .from('product_variants')
                                .update({ stock: safeStock })
                                .eq('id', variant.id);
                            
                            if (error) {
                                errors.push(`${product.name} ${variant.name}: ${error.message}`);
                                continue;
                            }
                        }
                        
                        details.push({
                            product: product.name,
                            variant: variant.name,
                            before: actual,
                            after: safeStock
                        });
                        fixed++;
                    } catch (e: any) {
                        errors.push(`${product.name} ${variant.name}: ${e.message || e}`);
                    }
                }
            }
            
            onProgress?.('Concluído', 100, 100, `${fixed} corrigidos`);
            console.log(`[fixStockDiscrepancies] ${fixed} variantes corrigidas`);
            
        } catch (e: any) {
            errors.push(e.message || 'Erro geral');
        }

        return { fixed, errors, dryRun, details };
    },

    /**
     * Normalizar todas as referências de produtos em pedidos, compras e movimentos
     * Garante que os nomes de produtos e variantes estão consistentes com os dados actuais
     */
    async normalizeAllProductReferences(onProgress?: (stage: string, current: number, total: number) => void): Promise<{
        success: boolean;
        ordersUpdated: number;
        purchasesUpdated: number;
        movementsUpdated: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let ordersUpdated = 0;
        let purchasesUpdated = 0;
        let movementsUpdated = 0;

        try {
            // 1. Normalizar pedidos
            onProgress?.('Normalizando pedidos...', 0, 3);
            try {
                const ordersResult = await orderService.normalizeOrderProductNames();
                ordersUpdated = ordersResult.updated;
                if (ordersResult.errors.length > 0) {
                    errors.push(...ordersResult.errors.map(e => `[Pedidos] ${e}`));
                }
            } catch (e: any) {
                errors.push(`[Pedidos] ${e.message || e}`);
            }

            // 2. Normalizar compras
            onProgress?.('Normalizando compras...', 1, 3);
            try {
                const purchasesResult = await purchaseService.normalizePurchaseProductNames();
                purchasesUpdated = purchasesResult.updated;
                if (purchasesResult.errors.length > 0) {
                    errors.push(...purchasesResult.errors.map(e => `[Compras] ${e}`));
                }
            } catch (e: any) {
                errors.push(`[Compras] ${e.message || e}`);
            }

            // 3. Normalizar movimentos
            onProgress?.('Normalizando movimentos...', 2, 3);
            try {
                const movementsResult = await stockService.synchronizeMovementProductNames();
                movementsUpdated = movementsResult.updated;
                if (movementsResult.errors.length > 0) {
                    errors.push(...movementsResult.errors.map(e => `[Movimentos] ${e}`));
                }
            } catch (e: any) {
                errors.push(`[Movimentos] ${e.message || e}`);
            }

            onProgress?.('Concluído', 3, 3);

            console.log(`[normalizeAllProductReferences] Resultado: ${ordersUpdated} pedidos, ${purchasesUpdated} compras, ${movementsUpdated} movimentos actualizados`);

            return {
                success: errors.length === 0,
                ordersUpdated,
                purchasesUpdated,
                movementsUpdated,
                errors
            };
        } catch (e: any) {
            errors.push(e.message || 'Erro geral');
            return {
                success: false,
                ordersUpdated,
                purchasesUpdated,
                movementsUpdated,
                errors
            };
        }
    }
};
