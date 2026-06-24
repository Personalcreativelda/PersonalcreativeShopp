/**
 * orderService.ts — Via API REST (sem Supabase)
 */
import api from '../../core/services/apiClient';
import { Order, OrderItem, OrderStatus, StockMovement, StockItem } from '../../core/types/types';
import { stockService } from '../../products/services/stockService';
import { getTodayDateString } from '../../core/utils/dateUtils';

const parseProductName = (productName: string): { baseName: string; variant: string | null } => {
  const name = productName.trim();
  const words = name.split(/\s+/);
  const lastWord = words[words.length - 1];
  if (/\d/.test(lastWord) && words.length > 1) {
    return { baseName: words.slice(0, -1).join(' ').trim(), variant: lastWord };
  }
  return { baseName: name, variant: null };
};

const normalizeVariantForMovement = (v?: string): string | undefined => {
  if (!v) return undefined;
  return v.trim().toUpperCase().replace(/\s+/g, '').replace(',', '.');
};

export const orderService = {
  async getOrders(): Promise<Order[]> {
    try {
      return await api.get<Order[]>('/orders');
    } catch (e: any) {
      console.error('[getOrders]', e);
      return [];
    }
  },

  async getOrdersCount(): Promise<number> {
    try {
      const res = await api.get<{ count: number }>('/orders/count');
      return res.count;
    } catch { return 0; }
  },

  async getNextOrderNumber(): Promise<string> {
    try {
      const res = await api.get<{ nextNumber: string }>('/orders/next-number');
      return res.nextNumber;
    } catch { return '1'; }
  },

  async checkOrderNumberExists(orderNumber: string): Promise<boolean> {
    try {
      const res = await api.get<{ exists: boolean }>(`/orders/check-number/${encodeURIComponent(orderNumber)}`);
      return res.exists;
    } catch { return false; }
  },

  async createOrder(order: Order): Promise<{ order: Order | null; customerCreated: boolean; customerUpdated: boolean }> {
    // Lança o erro para que o chamador possa mostrar a mensagem real ao utilizador
    const result = await api.post<{ order: Order; customerCreated: boolean; customerUpdated: boolean }>('/orders', order);

    // Criar movimentos de stock (só para pedidos imediatamente entregues)
    if (result.order && (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED)) {
      await this._createStockRecordsForOrder(
        result.order.id,
        result.order.orderNumber || result.order.id,
        getTodayDateString(),
        order.items as OrderItem[],
        order.customerName
      ).catch(e => console.warn('[createOrder] stock error:', e));
    }

    return result;
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<boolean> {
    try {
      // Buscar estado actual do pedido para gerir stock
      const orders = await this.getOrders();
      const existingOrder = orders.find(o => o.id === orderId);

      const wasDelivered = existingOrder?.status === OrderStatus.DELIVERED || existingOrder?.status === OrderStatus.COMPLETED;
      const willBeDelivered = updates.status === undefined ? wasDelivered
        : (updates.status === OrderStatus.DELIVERED || updates.status === OrderStatus.COMPLETED);
      const isChangingToDelivered = willBeDelivered && !wasDelivered;
      const isChangingFromDelivered = wasDelivered && !willBeDelivered;

      // Atualizar no backend
      await api.put(`/orders/${orderId}`, updates);

      // Gerir movimentos de stock
      try {
        if (isChangingFromDelivered) {
          const movements = await stockService.getStockMovements();
          const orderMovements = movements.filter(m => m.sourceReference?.type === 'order' && m.sourceReference?.id === orderId);
          for (const m of orderMovements) await stockService.deleteStockMovement(m.id);
        }

        if (isChangingToDelivered) {
          const orderItems = (updates.items || existingOrder?.items || []) as OrderItem[];
          if (orderItems.length > 0) {
            await this._createStockRecordsForOrder(
              orderId,
              existingOrder?.orderNumber || orderId,
              getTodayDateString(),
              orderItems,
              updates.customerName ?? existingOrder?.customerName
            );
          }
        }
      } catch (stockError: any) {
        console.error('[updateOrder] stock error:', stockError);
      }

      return true;
    } catch (err) {
      console.error('[updateOrder]', err);
      return false;
    }
  },

  async _createStockRecordsForOrder(
    orderId: string,
    orderNumber: string,
    orderDateStr: string,
    orderItems: OrderItem[],
    customerName?: string
  ): Promise<void> {
    const stockItems: StockItem[] = orderItems
      .filter(item => item.quantity > 0)
      .map(item => {
        const parsed = parseProductName(item.productName || '');
        const baseName = parsed.baseName || (item.productName || '').trim();
        const variant = normalizeVariantForMovement(item.variantName || parsed.variant || undefined);
        return {
          productId: item.productId,
          productName: baseName,
          variant,
          quantity: -Math.abs(item.quantity),
          unit: item.unit || 'un'
        };
      });

    if (stockItems.length > 0) {
      const customerInfo = customerName ? ` (${customerName})` : '';
      const stockMovement: StockMovement = {
        id: '',
        date: orderDateStr,
        items: stockItems,
        notes: `Saída de stock via pedido ${orderNumber}${customerInfo}`,
        sourceReference: { type: 'order', id: orderId },
        createdAt: new Date().toISOString()
      };
      await stockService.ensureStockMovement(stockMovement);
    }
  },

  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      // Reverter stock se necessário
      try {
        const movements = await stockService.getStockMovements();
        const orderMovements = movements.filter(m => m.sourceReference?.type === 'order' && m.sourceReference?.id === orderId);
        for (const m of orderMovements) await stockService.deleteStockMovement(m.id);
      } catch {}

      await api.delete(`/orders/${orderId}`);
      return true;
    } catch { return false; }
  },

  async deleteOrders(orderIds: string[]): Promise<{ success: boolean; deleted: number; errors: string[] }> {
    try {
      await api.delete('/orders', { ids: orderIds });
      return { success: true, deleted: orderIds.length, errors: [] };
    } catch (err: any) {
      // Fallback: apagar um a um
      const errors: string[] = [];
      let deleted = 0;
      for (const id of orderIds) {
        const ok = await this.deleteOrder(id);
        if (ok) deleted++; else errors.push(id);
      }
      return { success: errors.length === 0, deleted, errors };
    }
  },

  async findDuplicateOrders(): Promise<Order[][]> {
    const orders = await this.getOrders();
    const byKey = new Map<string, Order[]>();
    for (const o of orders) {
      const orderNum = (o.orderNumber ?? '').trim();
      const datePart = (o.createdAt ?? '').toString().split('T')[0];
      const key = orderNum ? `${orderNum}-${datePart}` : `no-number-${o.id}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(o);
    }
    return Array.from(byKey.values()).filter(group => group.length > 1);
  },

  async removeDuplicateOrders(): Promise<{ removed: number; errors: string[] }> {
    const errors: string[] = [];
    let removed = 0;
    const groups = await this.findDuplicateOrders();
    for (const group of groups) {
      group.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      for (let i = 1; i < group.length; i++) {
        const ok = await this.deleteOrder(group[i].id);
        if (ok) removed++; else errors.push(`Pedido ${group[i].id.substring(0, 8)}...`);
      }
    }
    return { removed, errors };
  },

  async normalizeOrderProductNames(_orderId?: string): Promise<{ updated: number; errors: string[] }> {
    // Funcionalidade simplificada — lógica complexa delegada ao backend se necessário
    return { updated: 0, errors: [] };
  }
};

export default orderService;
