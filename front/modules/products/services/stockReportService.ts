/**
 * Serviço de relatórios de stock.
 * Usa REST API (backend Express) em vez de Supabase RPC.
 */
import api from '../../core/services/apiClient';

export interface StockPeriodSummaryRow {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  unit: string;
  initialStock: number;
  purchases: number;
  sales: number;
  adjustments: number;
  finalStock: number;
  initialValue: number;
  purchasesValue: number;
  salesValue: number;
  finalValue: number;
  costPrice: number;
  profit: number;
}

export const stockReportService = {
  async getStockPeriodSummary(
    startDate: string,
    endDate: string,
    snapshotDate?: string | null,
    includeZeroStock?: boolean
  ): Promise<StockPeriodSummaryRow[]> {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        include_zero_stock: String(includeZeroStock !== false)
      });
      const data = await api.get<any[]>(`/stock/period-summary?${params}`);
      return (data || []).map((row) => ({
        productId: String(row.product_id ?? ''),
        productName: String(row.product_name ?? ''),
        variantId: row.variant_id ? String(row.variant_id) : undefined,
        variantName: row.variant_name ? String(row.variant_name) : undefined,
        unit: String(row.unit ?? 'un'),
        initialStock: Number(row.initial_qty ?? 0),
        purchases: Number(row.purchases_qty ?? 0),
        sales: Number(row.sales_qty ?? 0),
        adjustments: Number(row.adjustments_qty ?? 0),
        finalStock: Number(row.final_qty ?? 0),
        initialValue: Number(row.initial_value ?? 0),
        purchasesValue: Number(row.purchases_value ?? 0),
        salesValue: Number(row.sales_value ?? 0),
        finalValue: Number(row.final_value ?? 0),
        costPrice: Number(row.cost_price ?? 0),
        profit: 0
      }));
    } catch (e) {
      console.warn('[stockReportService] getStockPeriodSummary error:', e);
      return [];
    }
  },

  async getCurrentStockSummary(snapshotDate?: string | null): Promise<StockPeriodSummaryRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.getStockPeriodSummary(today, today, snapshotDate ?? null);
  }
};
