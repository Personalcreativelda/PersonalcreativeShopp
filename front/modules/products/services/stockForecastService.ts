/**
 * Serviço de previsão de stock e alertas.
 * Calcula necessidades semanais baseadas na média de vendas da semana passada.
 */

import type { Order, Product, ProductVariant } from '../../core/types/types';
import { OrderStatus } from '../../core/types/order';
import { getDateRangeFromPeriod } from '../../core/utils/dateUtils';
import { normalizeOrderStatus } from '../../core/services/serviceUtils';

export type StockAlertType = 'low_stock' | 'insufficient_for_week' | 'ok';

export interface StockForecastItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  currentStock: number;
  minStock: number;
  lastWeekSales: number;
  weeklyNeed: number;
  suggestedPurchase: number;
  unit: string;
  alertType: StockAlertType;
}

function normalizeDateStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeDateEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isOrderCompletedOrDelivered(order: Order): boolean {
  const status = normalizeOrderStatus(order);
  return status === OrderStatus.COMPLETED || status === OrderStatus.DELIVERED;
}

/**
 * Obtém vendas agregadas por produto/variante num período.
 * Chave: productId-variantId (ou productId-no-variant para produtos sem variante).
 */
export function getWeeklySalesByProduct(
  orders: Order[],
  start: Date,
  end: Date
): Map<string, number> {
  const startNorm = normalizeDateStart(start);
  const endNorm = normalizeDateEnd(end);

  const salesMap = new Map<string, number>();

  orders
    .filter(o => isOrderCompletedOrDelivered(o))
    .forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate < startNorm || orderDate > endNorm) return;

      (order.items || []).forEach(item => {
        const productId = item.productId || item.productName || '';
        const variantId = (item.variantId ?? 'no-variant').toString().trim() || 'no-variant';
        const key = `${productId}__${variantId}`;
        const q = Number(item.quantity) || 0;
        salesMap.set(key, (salesMap.get(key) || 0) + q);
      });
    });

  return salesMap;
}

/**
 * Obtém previsão de stock e alertas para todos os produtos/variantes.
 */
export function getStockForecast(products: Product[], orders: Order[]): StockForecastItem[] {
  const { start, end } = getDateRangeFromPeriod('lastWeek');
  const weeklySales = getWeeklySalesByProduct(orders, start, end);

  const result: StockForecastItem[] = [];

  products.forEach(product => {
    const unit = product.unit || 'un';

    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((variant: ProductVariant) => {
        const variantId = variant.id;
        const variantName = variant.name || '';
        const key = `${product.id}__${variantId}`;
        const lastWeekSales = weeklySales.get(key) || 0;
        const weeklyNeed = lastWeekSales;
        const currentStock = variant.stock ?? 0;
        const minStock = variant.minStock ?? 0;
        const variantUnit = variant.unit || unit;

        const deficitFromMin = Math.max(0, minStock - currentStock);
        const deficitFromWeek = Math.max(0, weeklyNeed - currentStock);
        const suggestedPurchase = Math.max(deficitFromMin, deficitFromWeek);

        let alertType: StockAlertType = 'ok';
        if (minStock > 0 && currentStock <= minStock) {
          alertType = 'low_stock';
        } else if (weeklyNeed > 0 && currentStock < weeklyNeed) {
          alertType = 'insufficient_for_week';
        }

        result.push({
          productId: product.id,
          productName: product.name,
          variantId,
          variantName,
          currentStock,
          minStock,
          lastWeekSales,
          weeklyNeed,
          suggestedPurchase,
          unit: variantUnit,
          alertType,
        });
      });
    } else {
      const key = `${product.id}__no-variant`;
      const lastWeekSales = weeklySales.get(key) || 0;
      const weeklyNeed = lastWeekSales;
      const currentStock = product.stock ?? 0;
      const minStock = product.minStock ?? 0;

      const deficitFromMin = Math.max(0, minStock - currentStock);
      const deficitFromWeek = Math.max(0, weeklyNeed - currentStock);
      const suggestedPurchase = Math.max(deficitFromMin, deficitFromWeek);

      let alertType: StockAlertType = 'ok';
      if (minStock > 0 && currentStock <= minStock) {
        alertType = 'low_stock';
      } else if (weeklyNeed > 0 && currentStock < weeklyNeed) {
        alertType = 'insufficient_for_week';
      }

      result.push({
        productId: product.id,
        productName: product.name,
        currentStock,
        minStock,
        lastWeekSales,
        weeklyNeed,
        suggestedPurchase,
        unit,
        alertType,
      });
    }
  });

  return result.sort((a, b) => {
    if (a.alertType !== b.alertType) {
      const order: Record<StockAlertType, number> = { low_stock: 0, insufficient_for_week: 1, ok: 2 };
      return order[a.alertType] - order[b.alertType];
    }
    return b.suggestedPurchase - a.suggestedPurchase;
  });
}
