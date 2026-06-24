/**
 * customerService.ts — Via API REST (sem Supabase)
 */
import api from '../../core/services/apiClient';
import { Customer } from '../../core/types/types';

// ─── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>();
const CACHE_TTL = 30000;

const getOrSetCache = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const existing = cache.get(key);
  if (existing?.promise) return existing.promise;
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;

  const promise = fetcher();
  cache.set(key, { data: null, timestamp: Date.now(), promise });
  try {
    const data = await promise;
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
};

export const normalizeBaseName = (name: string): string =>
  name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

export const customerService = {
  async getCustomers(): Promise<Customer[]> {
    return getOrSetCache('customers', () => api.get<Customer[]>('/customers'));
  },

  async getCustomersCount(): Promise<number> {
    try {
      const res = await api.get<{ count: number }>('/customers/count');
      return res.count;
    } catch { return 0; }
  },

  async addCustomer(customer: Omit<Customer, 'id' | 'totalOrders' | 'totalSpent' | 'tier' | 'lastOrderDate'>): Promise<Customer | null> {
    try {
      const result = await api.post<Customer>('/customers', customer);
      cache.delete('customers');
      return result;
    } catch (err: any) {
      console.error('[addCustomer]', err.message);
      return null;
    }
  },

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<boolean> {
    try {
      await api.put(`/customers/${customerId}`, updates);
      cache.delete('customers');
      return true;
    } catch (err) {
      console.error('[updateCustomer]', err);
      return false;
    }
  },

  async deleteCustomer(customerId: string): Promise<boolean> {
    try {
      await api.delete(`/customers/${customerId}`);
      cache.delete('customers');
      return true;
    } catch { return false; }
  },

  async deleteCustomers(customerIds: string[]): Promise<boolean> {
    try {
      await api.delete('/customers', { ids: customerIds });
      cache.delete('customers');
      return true;
    } catch { return false; }
  },

  async mergeCustomers(primaryCustomerId: string, duplicateCustomerId: string): Promise<{ success: boolean; ordersTransferred: number; error?: string }> {
    try {
      const result = await api.post<{ success: boolean; ordersTransferred: number }>('/customers/merge', {
        primaryId: primaryCustomerId,
        duplicateId: duplicateCustomerId
      });
      cache.delete('customers');
      return result;
    } catch (err: any) {
      return { success: false, ordersTransferred: 0, error: err.message };
    }
  },

  async recalculateAllLastOrderDates(): Promise<{ updated: number; errors: string[] }> {
    // Simplificado — a lógica está no backend
    return { updated: 0, errors: ['Use o backend para recalcular datas de pedidos'] };
  },

  findCustomerByNameOrPhone(name: string, phone: string, customers: Customer[]): Customer | null {
    const normalizedName = normalizeBaseName(name);
    const cleanPhone = phone.replace(/\D/g, '');

    return customers.find(c => {
      if (cleanPhone.length >= 8 && c.phone) {
        const cPhone = c.phone.replace(/\D/g, '');
        if (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone)) return true;
      }
      const cName = normalizeBaseName(c.name);
      return cName === normalizedName || cName.includes(normalizedName) || normalizedName.includes(cName);
    }) || null;
  }
};

export default customerService;
