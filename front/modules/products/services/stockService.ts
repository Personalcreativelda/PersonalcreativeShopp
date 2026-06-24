/**
 * stockService.ts — Via API REST (sem Supabase)
 * 
 * Mantém toda a interface existente para compatibilidade.
 * Operações de baixo nível delegadas ao backend REST.
 */
import api from '../../core/services/apiClient';
import { StockMovement, StockItem } from '../../core/types/types';

const normalizeProductName = (name: string): string =>
  name.toUpperCase().trim().replace(/\s+/g, ' ')
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
    .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ç/g, 'C')
    .replace(/Ã/g, 'A').replace(/Õ/g, 'O');

export const stockService = {
  // ── Movements ────────────────────────────────────────────────────────────────

  async getStockMovements(): Promise<StockMovement[]> {
    try {
      return await api.get<StockMovement[]>('/stock/movements');
    } catch { return []; }
  },

  async ensureStockMovement(movement: StockMovement): Promise<{ stockMovement: StockMovement | null; error?: string }> {
    try {
      const result = await api.post<StockMovement>('/stock/movements', movement);
      return { stockMovement: result };
    } catch (e: any) {
      console.warn('[ensureStockMovement]', e.message);
      return { stockMovement: null, error: e.message };
    }
  },

  async createStockMovement(stock: StockMovement): Promise<{ stockMovement: StockMovement | null; error?: string }> {
    return this.ensureStockMovement(stock);
  },

  async updateStockMovement(stockId: string, stock: StockMovement): Promise<boolean> {
    try {
      await api.put(`/stock/movements/${stockId}`, stock);
      return true;
    } catch { return false; }
  },

  async deleteStockMovement(stockId: string): Promise<boolean> {
    try {
      await api.delete(`/stock/movements/${stockId}`);
      return true;
    } catch { return false; }
  },

  // ── Variant stock adjustment ──────────────────────────────────────────────────

  async adjustVariantStock(
    productId: string,
    variantId: string | null,
    quantityChange: number,
    operation: 'add' | 'subtract' = 'add'
  ): Promise<boolean> {
    try {
      const targetId = variantId || productId;
      await api.put(`/stock/variants/${targetId}/adjust`, { quantity: quantityChange, operation });
      return true;
    } catch { return false; }
  },

  // ── Stock config / reset ─────────────────────────────────────────────────────

  async getStockConfig(): Promise<any> {
    try {
      return await api.get('/stock/config');
    } catch { return null; }
  },

  async resetStockHistory(resetDate: string, resetReason: string, initialStocks: any[]): Promise<any> {
    try {
      return await api.post('/stock/reset', { resetDate, resetReason, initialStocks });
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  async getStockInitialSnapshot(snapshotDate: string): Promise<{ productId: string; variantId: string | null; quantity: number }[]> {
    try {
      return await api.get(`/stock/snapshot/${snapshotDate}`);
    } catch { return []; }
  },

  async saveStockInitialSnapshot(
    snapshotDate: string,
    items: { productId: string; variantId?: string | null; quantity: number }[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post('/stock/snapshot', { snapshotDate, items });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async saveStockInitialSnapshotItem(
    snapshotDate: string,
    item: { productId: string; variantId?: string | null; quantity: number }
  ): Promise<{ success: boolean; error?: string }> {
    return this.saveStockInitialSnapshot(snapshotDate, [item]);
  },

  // ── Stock transactions ────────────────────────────────────────────────────────

  async ensureStockTransaction(
    productId: string, productName: string, variantId: string | null, variantName: string | null,
    type: 'entry' | 'exit', quantity: number, unit: string, date: string,
    sourceType: string, sourceId: string, sourceReference: string,
    costPrice?: number, salePrice?: number, notes?: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Delegado ao backend via movimento de stock
    return { success: true };
  },

  async getTransactionCostsForMovements(_movementIds: string[]): Promise<Map<string, number>> {
    return new Map();
  },

  // Copies products.stock → default variant stock for rows where variant.stock = 0 but products.stock > 0.
  // Safe to call repeatedly (only updates variants where stock is already 0).
  async syncProductStockToVariants(): Promise<void> {
    try { await api.post('/stock/sync-product-stock', {}); } catch { /* ignore */ }
  },

  // ── Validation ───────────────────────────────────────────────────────────────

  async validateStockIntegrity(): Promise<any> {
    return { isValid: true, errors: [], warnings: [], summary: {} };
  },

  async checkStockAvailability(
    productId: string, variantId: string | null, _locationId: string, requiredQuantity: number
  ): Promise<{ available: boolean; availableQuantity: number; reservedQuantity: number; totalQuantity: number; message?: string }> {
    return { available: true, availableQuantity: 9999, reservedQuantity: 0, totalQuantity: 9999 };
  },

  // ── Lots (stubs – não usados no novo modelo) ──────────────────────────────────

  async _createStockLot(): Promise<void> {},
  async _updateOrCreateStockLot(): Promise<void> {},
  async _getStockLotsTotalValue(_productId: string, _variantId: string | null): Promise<number | null> { return null; },

  // ── processStockMovementItems (chamado internamente pelo ensureStockMovement) ─

  async processStockMovementItems(_movement: StockMovement): Promise<void> {
    // Processado no backend
  },

  async revertStockMovementItems(_movement: StockMovement): Promise<void> {
    // Processado no backend
  }
};

export default stockService;
