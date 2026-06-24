/**
 * purchaseRequestService.ts — REST API
 */
import api from '../../core/services/apiClient';
import { PurchaseRequest } from '../../core/types/types';

export const purchaseRequestService = {
  async getRequests(): Promise<PurchaseRequest[]> {
    try {
      return await api.get<PurchaseRequest[]>('/purchases/requests');
    } catch { return []; }
  },

  async createRequest(req: Partial<PurchaseRequest>): Promise<{ request: PurchaseRequest | null; error?: string }> {
    try {
      const result = await api.post<{ request: PurchaseRequest }>('/purchases/requests', req);
      return { request: result.request };
    } catch (e: any) {
      return { request: null, error: e.message };
    }
  },

  async updateRequest(id: string, updates: Partial<PurchaseRequest>): Promise<boolean> {
    if (!id) return false;
    try {
      await api.put(`/purchases/requests/${id}`, updates);
      return true;
    } catch { return false; }
  },

  async deleteRequest(id: string): Promise<boolean> {
    if (!id) return true;
    try {
      await api.delete(`/purchases/requests/${id}`);
      return true;
    } catch { return false; }
  }
};
