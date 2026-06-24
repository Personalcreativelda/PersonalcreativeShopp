/**
 * purchaseService.ts — Via API REST (sem Supabase)
 */
import api from '../../core/services/apiClient';
import { Purchase, PurchaseItem, StockItem, StockMovement } from '../../core/types/types';
import { stockService } from './stockService';
import { getTodayDateString } from '../../core/utils/dateUtils';

const parseProductName = (name: string): { baseName: string; variant: string | null } => {
  const words = (name || '').trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  if (/\d/.test(lastWord) && words.length > 1) {
    return { baseName: words.slice(0, -1).join(' ').trim(), variant: lastWord };
  }
  return { baseName: name.trim(), variant: null };
};

async function applyPurchaseStock(
  purchaseId: string, items: PurchaseItem[], orderDate: string,
  op: 'add' | 'subtract', supplierName?: string, invoiceNumber?: string
): Promise<void> {
  if (op === 'subtract') {
    const movements = await stockService.getStockMovements();
    const pm = movements.filter(m => m.sourceReference?.type === 'purchase' && m.sourceReference?.id === purchaseId);
    for (const m of pm) await stockService.deleteStockMovement(m.id);
    return;
  }

  const stockItems: StockItem[] = items
    .filter(it => Number(it.quantity) > 0)
    .map(it => {
      const parsed = parseProductName(it.productName || '');
      return {
        productId: it.productId,
        productName: parsed.baseName || (it.productName || '').trim(),
        variant: it.variant ?? parsed.variant ?? undefined,
        quantity: Math.abs(Number(it.quantity)),
        unit: it.unit || 'un',
        unitPrice: it.unitPrice ?? it.costPrice ?? undefined
      };
    });

  if (stockItems.length > 0) {
    const movement: StockMovement = {
      id: '',
      date: orderDate,
      items: stockItems,
      notes: `Entrada de stock via compra${supplierName ? ` - ${supplierName}` : ''}${invoiceNumber ? ` (${invoiceNumber})` : ''}`,
      sourceReference: { type: 'purchase', id: purchaseId },
      createdAt: new Date().toISOString()
    };
    await stockService.ensureStockMovement(movement);
  }
}

export const purchaseService = {
  async getPurchases(): Promise<Purchase[]> {
    try {
      return await api.get<Purchase[]>('/purchases/purchases');
    } catch (e: any) {
      console.error('[getPurchases]', e);
      return [];
    }
  },

  async getPurchasesCount(): Promise<number> {
    try {
      const res = await api.get<{ count: number }>('/purchases/purchases/count');
      return res.count;
    } catch { return 0; }
  },

  async createPurchase(purchase: Purchase, updateStock = false): Promise<{ purchase: Purchase | null }> {
    try {
      const result = await api.post<{ purchase: Purchase }>('/purchases/purchases', purchase);
      const created = result.purchase;
      if (created && updateStock && created.items?.length) {
        const date = (created.date ?? created.orderDate ?? getTodayDateString()).toString().split('T')[0];
        await applyPurchaseStock(created.id, created.items, date, 'add', created.supplierName, created.invoiceNumber);
      }
      return { purchase: created };
    } catch (e: any) {
      console.error('[createPurchase]', e);
      return { purchase: null };
    }
  },

  async updatePurchase(id: string, updates: Partial<Purchase>, updateStock = false): Promise<boolean> {
    if (!id) return false;
    try {
      await api.put(`/purchases/purchases/${id}`, updates);
      if (updateStock && updates.items?.length) {
        const date = (updates.date ?? updates.orderDate ?? getTodayDateString()).toString().split('T')[0];
        await applyPurchaseStock(id, updates.items, date, 'subtract');
        await applyPurchaseStock(id, updates.items, date, 'add', updates.supplierName, updates.invoiceNumber);
      }
      return true;
    } catch (e: any) {
      console.error('[updatePurchase]', e);
      return false;
    }
  },

  async deletePurchase(id: string, revertStock = false): Promise<boolean> {
    if (!id) return true;
    try {
      if (revertStock) await applyPurchaseStock(id, [], getTodayDateString(), 'subtract');
      await api.delete(`/purchases/purchases/${id}`);
      return true;
    } catch { return false; }
  },

  async findDuplicatePurchases(): Promise<Purchase[][]> {
    const purchases = await this.getPurchases();
    const byKey = new Map<string, Purchase[]>();
    for (const p of purchases) {
      const key = (p.invoiceNumber ?? '').trim().toLowerCase() || `no-invoice-${p.id}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(p);
    }
    return Array.from(byKey.values()).filter(g => g.length > 1);
  },

  async removeDuplicatePurchases(): Promise<{ removed: number; errors: string[] }> {
    const errors: string[] = [];
    let removed = 0;
    const groups = await this.findDuplicatePurchases();
    for (const group of groups) {
      group.sort((a, b) => ((b.updatedAt || b.createdAt || '') > (a.updatedAt || a.createdAt || '') ? 1 : -1));
      for (let i = 1; i < group.length; i++) {
        const ok = await this.deletePurchase(group[i].id, true);
        if (ok) removed++; else errors.push(group[i].id);
      }
    }
    return { removed, errors };
  },

  async normalizePurchaseProductNames(_purchaseId?: string): Promise<{ updated: number; errors: string[] }> {
    return { updated: 0, errors: [] };
  }
};

export default purchaseService;
