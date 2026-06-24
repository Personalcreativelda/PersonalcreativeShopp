/**
 * Stock Movement Service
 * Serviço para obter histórico de movimentos de stock de produtos
 */
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';

export interface StockMovement {
    id: string;
    type: 'purchase' | 'order' | 'adjustment' | 'movement' | 'transfer' | 'return' | 'waste';
    date: string;
    quantity: number; // Positive for incoming, negative for outgoing
    reference: string;
    notes?: string;
    user?: string;
}

export const stockMovementService = {
    /**
     * Obter histórico de movimentos de um produto usando a tabela central de transações
     */
    async getProductMovementHistory(
        productId: string,
        variantId?: string,
        dateFrom?: string,
        dateTo?: string,
        limit: number = 20
    ): Promise<StockMovement[]> {
        if (!isSupabaseConfigured()) {
            console.warn('[stockMovementService] Supabase não configurado');
            return [];
        }

        try {
            let query = supabase
                .from('stock_transactions')
                .select('*')
                .eq('product_id', productId);

            if (variantId) {
                query = query.eq('variant_id', variantId);
            }

            if (dateTo) {
                // dateTo pode ser uma data ISO ou apenas YYYY-MM-DD
                // Se for ISO, o lte funciona bem. Se for YYYY-MM-DD, talvez precise de T23:59:59
                const finalDate = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59`;
                query = query.lte('date', finalDate);
            }

            if (dateFrom) {
                const startDate = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00`;
                query = query.gte('date', startDate);
            }

            query = query.order('date', { ascending: false }).limit(limit);

            const { data, error } = await query;

            if (error) {
                console.error('[stockMovementService] Erro ao buscar transações:', error);
                return [];
            }

            return (data || []).map((trans: any) => {
                // Determinar o tipo amigável
                let type: StockMovement['type'] = 'movement';
                const st = trans.source_type?.toLowerCase();

                if (st === 'purchase') type = 'purchase';
                else if (st === 'order' || st === 'sale') type = 'order';
                else if (st === 'adjustment') type = 'adjustment';
                else if (st === 'transfer') type = 'transfer';
                else if (st === 'return') type = 'return';
                else if (st === 'waste') type = 'waste';

                // Determinar sinal da quantidade
                const qty = parseFloat(trans.quantity) || 0;
                const finalQty = trans.transaction_type === 'exit' ? -qty : qty;

                // Formatar referência
                let ref = trans.source_reference || '';
                if (type === 'adjustment') {
                    ref = this._formatAdjustmentReason(trans.source_reference || trans.notes || '');
                }

                return {
                    id: trans.id,
                    type,
                    date: trans.date,
                    quantity: finalQty,
                    reference: ref || this._formatType(type),
                    notes: trans.notes,
                    user: trans.created_by // Opcional
                };
            });
        } catch (error) {
            console.error('[stockMovementService] Erro ao buscar histórico:', error);
            return [];
        }
    },

    /**
     * Formatar tipo para exibição quando não há referência
     */
    _formatType(type: string): string {
        const types: Record<string, string> = {
            purchase: 'Compra/Entrada',
            order: 'Venda/Pedido',
            adjustment: 'Ajuste de Stock',
            transfer: 'Transferência',
            return: 'Devolução',
            waste: 'Quebra/Perda',
            movement: 'Movimento'
        };
        return types[type] || type;
    },

    /**
     * Formatar motivo de ajuste para exibição
     */
    _formatAdjustmentReason(reason: string): string {
        const reasons: Record<string, string> = {
            damaged: 'Produto Danificado',
            loss: 'Perda/Roubo',
            correction: 'Correção de Contagem',
            expired: 'Produto Expirado',
            return: 'Devolução',
            production: 'Produção',
            other: 'Outro'
        };
        // Se a razão for uma das chaves, traduzir. Senão devolver o original.
        return reasons[reason.toLowerCase()] || reason;
    }
};
