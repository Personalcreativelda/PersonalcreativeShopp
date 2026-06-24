/**
 * Tipos de vendas
 */

import type { OrderItem } from './order';

export type SaleType = 'LOJA' | 'BALCAO';

export interface SaleItem extends OrderItem {
  total?: number;
}

export interface Sale {
  id: string;
  date?: string;
  orderId?: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  totalAmount?: number;
  totalSales?: number;
  totalDeliveries?: number;
  valueReceived?: number;
  difference?: number;
  notes?: string;
  saleType?: SaleType;
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  createdAt: string;
  userId?: string;
  locationId?: string;
}
