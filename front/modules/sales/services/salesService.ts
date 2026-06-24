/**
 * salesService.ts — Via API REST (sem Supabase)
 */
import api from '../../core/services/apiClient';
import { Sale } from '../../core/types/types';

export const salesService = {
  async getSales(): Promise<Sale[]> {
    try {
      return await api.get<Sale[]>('/sales');
    } catch (e: any) {
      console.error('[getSales]', e);
      return [];
    }
  },

  async getSalesCount(): Promise<number> {
    try {
      const res = await api.get<{ count: number }>('/sales/count');
      return res.count;
    } catch { return 0; }
  },

  async getSaleByDate(date: string): Promise<Sale | null> {
    try {
      const dateOnly = date.split('T')[0];
      const result = await api.get<Sale | null>(`/sales/by-date/${dateOnly}`);
      return result;
    } catch { return null; }
  },

  async createSale(sale: Sale): Promise<{ sale: Sale | null }> {
    try {
      const result = await api.post<Sale>('/sales', sale);
      return { sale: result };
    } catch (e: any) {
      console.error('[createSale]', e);
      return { sale: null };
    }
  },

  async updateSale(id: string, updates: Partial<Sale>): Promise<boolean> {
    if (!id) return false;
    try {
      await api.put(`/sales/${id}`, updates);
      return true;
    } catch (e: any) {
      console.error('[updateSale]', e);
      return false;
    }
  },

  async deleteSale(id: string): Promise<boolean> {
    if (!id) return true;
    try {
      await api.delete(`/sales/${id}`);
      return true;
    } catch { return false; }
  },

  async deleteSales(ids: string[]): Promise<{ success: boolean; deleted?: number; errors?: string[] }> {
    if (!ids?.length) return { success: true, deleted: 0, errors: [] };
    try {
      await api.delete('/sales', { ids });
      return { success: true, deleted: ids.length, errors: [] };
    } catch (e: any) {
      return { success: false, errors: [e?.message || 'Erro ao apagar vendas'] };
    }
  }
};

export default salesService;
