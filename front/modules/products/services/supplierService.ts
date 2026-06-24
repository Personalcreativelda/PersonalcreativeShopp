/**
 * supplierService.ts — Via API REST (sem Supabase)
 */
import api from '../../core/services/apiClient';
import { Supplier } from '../../core/types/types';

export const supplierService = {
  async getSuppliers(): Promise<Supplier[]> {
    try {
      return await api.get<Supplier[]>('/purchases/suppliers');
    } catch (e: any) {
      console.error('[getSuppliers]', e);
      return [];
    }
  },

  async getSuppliersCount(): Promise<number> {
    try {
      const res = await api.get<{ count: number }>('/purchases/suppliers/count');
      return res.count;
    } catch { return 0; }
  },

  async createSupplier(supplier: Supplier): Promise<{ supplier: Supplier | null; error?: string }> {
    try {
      const result = await api.post<{ supplier: Supplier }>('/purchases/suppliers', supplier);
      return { supplier: result.supplier };
    } catch (e: any) {
      return { supplier: null, error: e.message };
    }
  },

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<boolean> {
    if (!id) return false;
    try {
      await api.put(`/purchases/suppliers/${id}`, updates);
      return true;
    } catch { return false; }
  },

  async deleteSupplier(id: string): Promise<boolean> {
    if (!id) return true;
    try {
      await api.delete(`/purchases/suppliers/${id}`);
      return true;
    } catch { return false; }
  }
};

export default supplierService;
