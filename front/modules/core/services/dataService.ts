
import { parseProductName, extractLocalDate, normalizeOrderStatus, getPaidAmount } from './serviceUtils';
import { productService } from '../../products/services/productService';
import { customerService } from '../../customers/services/customerService';
import { orderService } from '../../sales/services/orderService';
import { salesService } from '../../sales/services/salesService';
import { purchaseService } from '../../products/services/purchaseService';
import { supplierService } from '../../products/services/supplierService';
import { userService } from './userService';
import { stockService } from '../../products/services/stockService';
import { Order, Customer, Product, Sale, SaleItem, CustomerAction, CustomerFeedback, CustomerInsight, Supplier, Purchase, PurchaseRequest, OrderStatus, StockMovement, Activity, ShopReceipt, FactoryOutput } from '../types/types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30000; // 30 segundos

const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

const setCached = <T>(key: string, data: T): void => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

const getOrSetCache = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  // Verificar se jé¡ existe uma requisiçéo em andamento
  const existing = cache.get(key);
  if (existing?.promise) {
    return existing.promise;
  }

  // Verificar cache
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Criar nova requisiçéo
  const promise = fetcher();
  cache.set(key, {
    data: null as any,
    timestamp: Date.now(),
    promise
  });

  try {
    const data = await promise;
    setCached(key, data);
    // Remover promise do cache apé³s completar
    const entry = cache.get(key);
    if (entry) {
      entry.promise = undefined;
    }
    return data;
  } catch (error) {
    // Em caso de erro, remover do cache
    cache.delete(key);
    throw error;
  }
};

const clearCache = (key?: string): void => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};

// Helper to check for valid UUID format
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Helper to handle Supabase errors gracefully
const handleSupabaseError = (context: string, error: any) => {
  // Error 42P01: relation (table) does not exist
  if (error?.code === '42P01') {
    console.warn(`[${context}] Tabelas néo encontradas no Supabase. A usar dados Mock. Execute o SQL em ConfiguraçéƒÂµes.`);
    return true; // Indicates handled as "missing table"
  }
  // Error PGRST205: table not found in schema cache (PostgREST/Supabase specific)
  if (error?.code === 'PGRST205' || (error?.message && error.message.includes('Could not find the table'))) {
    console.warn(`[${context}] Tabela néo encontrada no schema cache do Supabase. Execute a migraçéo SQL necessé¡ria.`);
    return true; // Indicates handled as "missing table"
  }
  // Error 42703: column does not exist
  if (error?.code === '42703') {
    console.warn(`[${context}] Coluna em falta no banco de dados. Atualize o Schema nas ConfiguraçéƒÂµes.`, error.message);
    return true;
  }

  console.error(`[${context}] Erro:`, error.message || error);
  return false;
};

export const dataService = {
  clearCache: (key?: string) => clearCache(key),

  getProducts: (): Promise<Product[]> => productService.getProducts(),
  getCustomers: (): Promise<Customer[]> => customerService.getCustomers(),
  getOrders: (): Promise<Order[]> => orderService.getOrders(),
  getNextOrderNumber: (): Promise<string> => orderService.getNextOrderNumber(),
  checkOrderNumberExists: (orderNumber: string): Promise<boolean> => orderService.checkOrderNumberExists(orderNumber),
  createOrder: async (order: Order): Promise<{ order: Order | null; customerCreated?: boolean; customerUpdated?: boolean }> =>
    orderService.createOrder(order),
  deleteOrder: async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const ok = await orderService.deleteOrder(orderId);
      return { success: ok, error: ok ? undefined : 'Erro ao apagar pedido.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erro ao apagar pedido.' };
    }
  },
  deleteOrders: (orderIds: string[]): Promise<{ success: boolean; deleted: number; errors: string[] }> =>
    orderService.deleteOrders(orderIds),
  updateOrder: (orderId: string, updates: Partial<Order>): Promise<boolean> =>
    orderService.updateOrder(orderId, updates),
  updateOrderStatus: (orderId: string, status: OrderStatus): Promise<boolean> =>
    orderService.updateOrder(orderId, { status }),
  getSales: (): Promise<Sale[]> => salesService.getSales(),
  getPurchases: (): Promise<Purchase[]> => purchaseService.getPurchases(),
  getPurchaseRequests: async (): Promise<PurchaseRequest[]> => {
    try { return await (await import('../../products/services/purchaseRequestService')).purchaseRequestService.getRequests(); }
    catch { return []; }
  },
  getSuppliers: (): Promise<Supplier[]> => supplierService.getSuppliers(),

  getCustomersCount: (): Promise<number> => customerService.getCustomersCount(),
  getOrdersCount: (): Promise<number> => orderService.getOrdersCount(),
  getProductsCount: (): Promise<number> => productService.getProductsCount(),
  getSalesCount: (): Promise<number> => salesService.getSalesCount(),
  getPurchasesCount: (): Promise<number> => purchaseService.getPurchasesCount(),
  getSuppliersCount: (): Promise<number> => supplierService.getSuppliersCount(),

  async getDashboardCounts(): Promise<{ customers: number; orders: number; products: number; sales: number; purchases: number; suppliers: number }> {
    const [customers, orders, products, sales, purchases, suppliers] = await Promise.all([
      customerService.getCustomersCount(),
      orderService.getOrdersCount(),
      productService.getProductsCount(),
      salesService.getSalesCount(),
      purchaseService.getPurchasesCount(),
      supplierService.getSuppliersCount()
    ]);
    return { customers, orders, products, sales, purchases, suppliers };
  },

  createSupplier: async (supplier: Supplier): Promise<{ supplier?: Supplier; error?: string }> =>
    supplierService.createSupplier(supplier),
  updateSupplier: (id: string, updates: Partial<Supplier>): Promise<boolean> =>
    supplierService.updateSupplier(id, updates),
  deleteSupplier: (id: string): Promise<boolean> =>
    supplierService.deleteSupplier(id),

  createPurchase: async (purchase: Purchase, updateStock = false): Promise<{ purchase: Purchase }> => {
    const result = await purchaseService.createPurchase(purchase, updateStock);
    return { purchase: result.purchase ?? ({ ...purchase, id: `temp-${Date.now()}` } as Purchase) };
  },
  updatePurchase: (id: string, updates: Partial<Purchase>, updateStock = false): Promise<boolean> =>
    purchaseService.updatePurchase(id, updates, updateStock),
  deletePurchase: (id: string, revertStock = false): Promise<boolean> =>
    purchaseService.deletePurchase(id, revertStock),
  getUsers: () => userService.getUsers(),
  getSalesManagers: () => userService.getSalesManagers(),
  getOrderVendors: () => userService.getOrderVendors(),
  getUnits: () => productService.getUnits(),
  getCustomerActions: async (): Promise<CustomerAction[]> => [],
  getCustomerFeedbacks: async (): Promise<CustomerFeedback[]> => [],
  getCustomerInsights: async (_days?: number): Promise<CustomerInsight[]> => {
    try {
      const [customers, orders] = await Promise.all([
        customerService.getCustomers(),
        orderService.getOrders()
      ]);
      const insights: CustomerInsight[] = customers.map(c => {
        const customerOrders = orders.filter(o => o.customerId === c.id && normalizeOrderStatus(o) !== OrderStatus.CANCELLED);
        const mostRecentOrder = customerOrders.sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0];
        const lastOrderDate = c.lastOrderDate || mostRecentOrder?.createdAt;
        let daysSinceLastOrder: number;
        if (!lastOrderDate) {
          daysSinceLastOrder = c.totalOrders === 0 ? Infinity : 0;
        } else {
          daysSinceLastOrder = Math.floor(
            (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
          );
        }
        let riskLevel: 'high' | 'medium' | 'low' = 'low';
        if (daysSinceLastOrder === Infinity || daysSinceLastOrder > 90 || c.totalOrders === 0) {
          riskLevel = 'high';
        } else if (daysSinceLastOrder > 60) {
          riskLevel = 'medium';
        }
        let suggestedAction = '';
        if (riskLevel === 'high') {
          suggestedAction = c.totalOrders === 0 ? 'Primeiro contacto comercial' : 'Re-ativação: contactar cliente';
        } else if (riskLevel === 'medium') {
          suggestedAction = 'Propor oferta ou lembrete';
        }
        return {
          id: `insight-${c.id}`,
          customerId: c.id,
          customerName: c.name,
          tier: c.tier,
          riskLevel,
          daysSinceLastOrder,
          totalSpent: c.totalSpent || 0,
          totalOrders: c.totalOrders || 0,
          lastOrderDate: lastOrderDate || undefined,
          suggestedAction,
          insightType: 'churn_risk',
          value: daysSinceLastOrder === Infinity ? 999 : daysSinceLastOrder,
          calculatedAt: new Date().toISOString()
        };
      });
      return insights;
    } catch {
      return [];
    }
  },

  getStockMovements: (): Promise<StockMovement[]> => stockService.getStockMovements(),
  getActivities: async (): Promise<Activity[]> => [],
  getShopReceipts: async (): Promise<ShopReceipt[]> => [],
  createShopReceipt: async (receipt: ShopReceipt): Promise<{ receipt: ShopReceipt | null; error?: string }> => ({ receipt }),
  updateShopReceipt: async (id: string, receipt: Partial<ShopReceipt>): Promise<boolean> => true,
  deleteShopReceipt: async (id: string): Promise<boolean> => true,
  getFactoryOutputs: async (): Promise<FactoryOutput[]> => [],

  getSaleByDate: (date: string): Promise<Sale | null> => salesService.getSaleByDate(date),
  createSale: async (sale: Sale): Promise<{ sale: Sale }> => {
    const dateOnly = (sale.date || '').split('T')[0];
    const existing = await salesService.getSaleByDate(dateOnly || sale.date || '');
    if (existing?.id) {
      const payload: Sale = {
        ...sale,
        id: existing.id,
        date: dateOnly || sale.date,
        createdAt: existing.createdAt,
      };
      const ok = await salesService.updateSale(existing.id, payload);
      if (ok) return { sale: { ...payload, id: existing.id } };
    }
    const result = await salesService.createSale(sale);
    return { sale: result.sale ?? ({ ...sale, id: `temp-${Date.now()}` } as Sale) };
  },
  updateSale: (id: string, updates: Partial<Sale>): Promise<boolean> => salesService.updateSale(id, updates),
  deleteSale: async (id: string): Promise<{ success: boolean }> => {
    const ok = await salesService.deleteSale(id);
    return { success: ok };
  },
  deleteSales: (ids: string[]): Promise<{ success: boolean; deleted?: number }> => salesService.deleteSales(ids),

  async syncDailySaleFromOrders(date: string, _preserveNotesAndReceived?: boolean): Promise<{ sale: Sale | null; error?: string }> {
    const dateOnly = date.split('T')[0];
    const orders = await orderService.getOrders();
    const ordersOfDate = orders.filter(o => {
      const od = extractLocalDate(o.createdAt || '');
      return od === dateOnly && normalizeOrderStatus(o) !== OrderStatus.CANCELLED;
    });
    const itemsMap = new Map<string, SaleItem>();
    let totalDeliveries = 0;
    let totalPaymentsReceived = 0;
    for (const order of ordersOfDate) {
      const deliveryFee = Number((order as any).deliveryFee ?? order.deliveryFee ?? 0) || 0;
      totalDeliveries += deliveryFee;
      totalPaymentsReceived += getPaidAmount(order);
      for (const it of order.items || []) {
        const key = `${it.productId}-${(it as any).variantId ?? ''}`;
        const existing = itemsMap.get(key);
        const q = Number(it.quantity) || 0;
        const p = Number((it as any).priceAtTime ?? it.price) || 0;
        const total = q * p;
        if (existing) {
          existing.quantity += q;
          (existing as SaleItem).total = (existing as SaleItem).total ?? 0;
          (existing as SaleItem).total! += total;
        } else {
          const variantName = (it as any).variantName ?? parseProductName(it.productName || '').variant ?? undefined;
          itemsMap.set(key, {
            id: it.id || `item-${Math.random().toString(36).slice(2, 9)}`,
            productId: it.productId,
            productName: it.productName,
            variantId: (it as any).variantId,
            variantName,
            quantity: q,
            price: p,
            unit: it.unit,
            total
          });
        }
      }
    }
    const saleItems = Array.from(itemsMap.values());
    const totalSales = saleItems.reduce((s, i) => s + ((i as SaleItem).total ?? i.quantity * i.price), 0);
    const valueReceived = totalPaymentsReceived > 0 ? totalPaymentsReceived : undefined;
    const difference = valueReceived != null ? valueReceived - (totalSales + totalDeliveries) : undefined;
    const existing = await salesService.getSaleByDate(dateOnly);
    const salePayload: Sale = {
      id: existing?.id ?? '',
      date: dateOnly,
      items: saleItems,
      totalSales,
      totalDeliveries,
      valueReceived,
      difference,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      notes: existing?.notes ?? `Gerado a partir de ${ordersOfDate.length} pedido(s) do dia ${new Date(dateOnly).toLocaleDateString('pt-MZ')}`
    };
    if (existing?.id) {
      const ok = await salesService.updateSale(existing.id, salePayload);
      if (!ok) return { sale: null, error: 'Erro ao atualizar resumo' };
      return { sale: { ...salePayload, id: existing.id } };
    }
    const created = await salesService.createSale(salePayload);
    return { sale: created.sale };
  },

  async parseSpreadsheetSalesSummary(_text: string, _products: Product[]): Promise<{ sales: Array<{ date: string; totalSales: number; totalDeliveries: number; items: Array<{ productName: string; quantity: number; total: number; price: number; unit?: string; matchedProduct?: Product }>; notes?: string }>; errors: string[] }> {
    return { sales: [], errors: ['Importação por planilha ainda não implementada. Use "Criar a partir de pedidos" ou adicione manualmente.'] };
  }
};

