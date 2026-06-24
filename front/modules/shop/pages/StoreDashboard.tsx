import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order, OrderStatus, StockMovement } from '../../core/types/types';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign
} from 'lucide-react';
import { stockService } from '../../products/services/stockService';
import { Toast } from '../../core/components/ui/Toast';
import { PageShell } from '../../core/components/layout/PageShell';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { useMobile } from '../../core/hooks/useMobile';

interface StoreDashboardProps {
  products: Product[];
  orders: Order[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  products,
  orders,
  showToast
}) => {
  const isMobile = useMobile(768);
  const [loading, setLoading] = useState(false);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const movements = await stockService.getStockMovements();
      setStockMovements(movements);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      showToast('Erro ao carregar dados do dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Get date range from period
  const getDateRangeFromPeriod = (period: PeriodOption, customStart?: string, customEnd?: string): { start: Date; end: Date } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (period === 'custom' && customStart && customEnd) {
      return {
        start: new Date(customStart),
        end: new Date(customEnd)
      };
    }

    const start = new Date(today);
    const end = new Date(today);

    switch (period) {
      case 'today':
        return { start, end };
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        return { start, end };
      case 'thisWeek':
        start.setDate(start.getDate() - start.getDay());
        return { start, end };
      case 'lastWeek':
        start.setDate(start.getDate() - start.getDay() - 7);
        end.setDate(end.getDate() - start.getDay() - 1);
        return { start, end };
      case 'thisMonth':
        start.setDate(1);
        return { start, end };
      case 'lastMonth':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        end.setMonth(end.getMonth());
        end.setDate(0);
        return { start, end };
      case 'thisYear':
        start.setMonth(0, 1);
        return { start, end };
      case 'lastYear':
        start.setFullYear(start.getFullYear() - 1);
        start.setMonth(0, 1);
        end.setFullYear(end.getFullYear() - 1);
        end.setMonth(11, 31);
        return { start, end };
      default:
        return { start, end };
    }
  };

  // Total stock: fonte única product.variants[].stock (todos os produtos têm ≥1 variante)
  const totalStockLoja = useMemo(() => {
    let total = 0;
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          total += variant.stock ?? 0;
        });
      }
    });
    return total;
  }, [products]);

  // Calculate pending orders
  const pendingOrders = useMemo(() => {
    return orders.filter(o =>
      o.status === OrderStatus.PENDING ||
      o.status === OrderStatus.PROCESSING ||
      o.status === OrderStatus.OUT_FOR_DELIVERY
    ).length;
  }, [orders]);

  // Calculate completed orders in period
  const completedOrdersInPeriod = useMemo(() => {
    const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
    return orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= start &&
        orderDate <= end &&
        o.status === OrderStatus.COMPLETED;
    }).length;
  }, [orders, selectedPeriod, customStartDate, customEndDate]);

  // Calculate total sales in period
  const totalSalesInPeriod = useMemo(() => {
    const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
    return orders
      .filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= start &&
          orderDate <= end &&
          o.status === OrderStatus.COMPLETED;
      })
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders, selectedPeriod, customStartDate, customEndDate]);

  // Low stock alerts: fonte única product.variants[].stock / variant.minStock
  const lowStockAlerts = useMemo(() => {
    const alerts: Array<{
      productId: string;
      productName: string;
      variantId?: string;
      variantName?: string;
      currentStock: number;
      minStock: number;
      unit: string;
    }> = [];

    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          const currentStock = variant.stock ?? 0;
          const minStock = variant.minStock ?? 0;
          if (minStock > 0 && currentStock <= minStock) {
            alerts.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              variantName: variant.name,
              currentStock,
              minStock,
              unit: variant.unit || product.unit || 'un'
            });
          }
        });
      }
    });

    return alerts.sort((a, b) => a.currentStock - b.currentStock).slice(0, 10);
  }, [products]);

  // Top products by sales
  const topProductsBySales = useMemo(() => {
    const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);

    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();

    orders
      .filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= start &&
          orderDate <= end &&
          o.status === OrderStatus.COMPLETED;
      })
      .forEach(order => {
        order.items.forEach(item => {
          const key = item.productId || item.productName;
          const current = productSales.get(key) || { name: item.productName, quantity: 0, revenue: 0 };
          current.quantity += item.quantity;
          current.revenue += (item.priceAtTime ?? item.price ?? 0) * item.quantity;
          productSales.set(key, current);
        });
      });

    return Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders, selectedPeriod, customStartDate, customEndDate]);

  // Stock movements in period
  const stockMovementsInPeriod = useMemo(() => {
    const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
    return stockMovements.filter(m => {
      const movementDate = new Date(m.date);
      return movementDate >= start && movementDate <= end;
    });
  }, [stockMovements, selectedPeriod, customStartDate, customEndDate]);

  return (
    <PageShell
      title="Dashboard da Loja"
      actions={
        <div className="flex items-center gap-2">
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={(period) => {
              setSelectedPeriod(period);
              if (period !== 'custom') {
                setCustomStartDate('');
                setCustomEndDate('');
              }
            }}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomDatesChange={(start, end) => {
              setCustomStartDate(start);
              setCustomEndDate(end);
            }}
          />
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-content-muted">Carregando...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-raised rounded-lg p-6 shadow-sm border border-border-default">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-content-muted">
                  Stock Total na Loja
                </div>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-content-primary">
                {totalStockLoja.toLocaleString('pt-PT')}
              </div>
              <div className="text-xs text-content-muted mt-1">
                Itens disponé­veis
              </div>
            </div>

            <div className="bg-surface-raised rounded-lg p-6 shadow-sm border border-border-default">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-content-muted">
                  Pedidos Pendentes
                </div>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-content-primary">
                {pendingOrders}
              </div>
              <div className="text-xs text-content-muted mt-1">
                Aguardando processamento
              </div>
            </div>

            <div className="bg-surface-raised rounded-lg p-6 shadow-sm border border-border-default">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-content-muted">
                  Pedidos Completados
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-content-primary">
                {completedOrdersInPeriod}
              </div>
              <div className="text-xs text-content-muted mt-1">
                No peré­odo selecionado
              </div>
            </div>

            <div className="bg-surface-raised rounded-lg p-6 shadow-sm border border-border-default">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-content-muted">
                  Vendas do Peré­odo
                </div>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-content-primary">
                {totalSalesInPeriod.toLocaleString('pt-PT', { style: 'currency', currency: 'MZN' })}
              </div>
              <div className="text-xs text-content-muted mt-1">
                Receita total
              </div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {lowStockAlerts.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                  Alertas de Stock Baixo
                </h3>
              </div>
              <div className="space-y-2">
                {lowStockAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-surface-raised rounded">
                    <span className="text-sm text-content-primary">
                      {alert.productName}{alert.variantName ? ` (${alert.variantName})` : ''}
                    </span>
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {alert.currentStock} / {alert.minStock} {alert.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Products and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-raised rounded-lg p-6 shadow-sm border border-border-default">
              <h3 className="text-lg font-semibold text-content-primary mb-4">
                Top Produtos por Vendas
              </h3>
              <div className="space-y-2">
                {topProductsBySales.length > 0 ? (
                  topProductsBySales.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-surface-base dark:bg-white/[0.05] rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-content-muted w-6">
                          #{idx + 1}
                        </span>
                        <span className="text-sm text-content-primary">
                          {product.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-content-primary">
                          {product.quantity} un
                        </div>
                        <div className="text-xs text-content-muted">
                          {product.revenue.toLocaleString('pt-PT', { style: 'currency', currency: 'MZN' })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-content-muted text-center py-4">
                    Nenhuma venda no peré­odo
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-raised rounded-lg p-6 shadow-sm border border-border-default">
              <h3 className="text-lg font-semibold text-content-primary mb-4">
                Movimentaçéµes Recentes de Stock
              </h3>
              <div className="space-y-2">
                {stockMovementsInPeriod.slice(0, 5).map(movement => (
                  <div key={movement.id} className="flex items-center justify-between p-2 bg-surface-base dark:bg-white/[0.05] rounded">
                    <div>
                      <div className="text-sm font-medium text-content-primary">
                        {new Date(movement.date).toLocaleDateString('pt-MZ')}
                      </div>
                      <div className="text-xs text-content-muted">
                        {movement.items.length} item(ns)
                      </div>
                    </div>
                    <div className="text-xs text-content-muted">
                      {movement.sourceReference?.type || 'Manual'}
                    </div>
                  </div>
                ))}
                {stockMovementsInPeriod.length === 0 && (
                  <div className="text-sm text-content-muted text-center py-4">
                    Nenhuma movimentaçéo no peré­odo
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

