import React, { useMemo, useEffect, useState } from 'react';
import { Customer, Order, OrderStatus, Sale, Product, Purchase, PurchaseRequest, StockMovement, Activity } from '../../core/types/types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getChartTheme } from '../../core/utils/chartTheme';
import { TrendingUp, Users, ShoppingBag, Clock, Calendar, DollarSign, TrendingDown, Award, Package, Percent, CreditCard, Truck, Settings, ExternalLink, AlertTriangle } from 'lucide-react';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { useDashboardPreferences } from '../../core/hooks/useDashboardPreferences';
import { DashboardSettings } from '../../admin/components/settings/DashboardSettings';
import { useLanguage } from '../../core/contexts/LanguageContext';
import { normalizeOrderStatus } from '../../core/services/serviceUtils';
import { getDateRangeFromPeriod } from '../../core/utils/dateUtils';
import { getStockForecast, type StockForecastItem } from '../../products/services/stockForecastService';

export interface DashboardCounts {
 customers: number;
 orders: number;
 products: number;
 sales: number;
 purchases: number;
 suppliers: number;
}

interface DashboardProps {
 orders: Order[];
 customers: Customer[];
 sales: Sale[];
 products?: Product[];
 purchases?: Purchase[];
 purchaseRequests?: PurchaseRequest[];
 counts?: DashboardCounts | null;
 onNavigate?: (page: string) => void;
}

type GroupedLowStockItem = Omit<StockForecastItem, 'variantId' | 'variantName'> & {
 alertType: 'low_stock';
 lowVariantCount: number;
 totalVariantCount: number;
 criticalDeficit: number;
 bestMonthSalesFlow: number;
};

type MinStockBasis = 'manual' | 'last_week_sales' | 'last_month_sales' | 'best_month_sales';

// ── Advanced KPIs widget (server-side) ────────────────────────────────────────
import api from '../services/apiClient';

function useAdvancedKPIs() {
  const [kpis, setKpis] = React.useState<any>(null);
  React.useEffect(() => {
    api.get('/reports/kpis').then(setKpis).catch(() => {});
  }, []);
  return kpis;
}

function AdvancedKPIBanner() {
  const kpis = useAdvancedKPIs();
  if (!kpis) return null;
  const growth = kpis.revenue?.growth;
  const ar     = kpis.ar;

  const items = [
    {
      label: 'Receita (30 dias)',
      value: `${Number(kpis.revenue?.current || 0).toFixed(0)} MT`,
      sub: growth !== null ? `${growth >= 0 ? '+' : ''}${growth?.toFixed(1)}% vs período anterior` : undefined,
      subColor: growth === null ? '' : growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500',
      color: 'text-content-primary',
    },
    {
      label: 'POS',
      value: `${Number(kpis.revenue?.pos || 0).toFixed(0)} MT`,
      sub: `Online: ${Number(kpis.revenue?.online || 0).toFixed(0)} MT`,
      subColor: 'text-content-muted',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'A Receber (Faturas)',
      value: `${Number(ar?.outstanding || 0).toFixed(0)} MT`,
      sub: ar?.overdueCount > 0 ? `⚠ ${ar.overdueCount} vencida${ar.overdueCount > 1 ? 's' : ''}` : 'Sem vencidas',
      subColor: ar?.overdueCount > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400',
      color: ar?.outstanding > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Encomendas (30d)',
      value: String(kpis.orders?.count || 0),
      sub: `Ticket médio: ${Number(kpis.orders?.avgValue || 0).toFixed(0)} MT`,
      subColor: 'text-content-muted',
      color: 'text-content-primary',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
      {items.map(item => (
        <div key={item.label} className="bg-surface-raised border border-border-default rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-content-muted mb-1.5">{item.label}</p>
          <p className={`text-lg font-bold font-mono leading-tight ${item.color}`}>{item.value}</p>
          {item.sub && <p className={`text-xs mt-1 ${item.subColor}`}>{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export const Dashboard: React.FC<DashboardProps> = ({ orders, customers, sales, products = [], purchases = [], purchaseRequests = [], counts, onNavigate }) => {
 const { t } = useLanguage();
 const [selectedPeriod, setSelectedPeriod] = React.useState<PeriodOption>('today');
 const [customStartDate, setCustomStartDate] = React.useState<string>('');
 const [customEndDate, setCustomEndDate] = React.useState<string>('');
 const [productsSoldView, setProductsSoldView] = React.useState<'fixos' | 'variáveis'>('fixos');
 const [productsPurchasedView, setProductsPurchasedView] = React.useState<'fixos' | 'variáveis'>('fixos');
 const [topProductsView, setTopProductsView] = React.useState<'fixos' | 'variáveis'>('fixos');
 const [salesEvolutionPeriod, setSalesEvolutionPeriod] = React.useState<'7D' | '30D' | '90D'>('7D');

 const salesEvolutionData = useMemo(() => {
 const days = salesEvolutionPeriod === '7D' ? 7 : salesEvolutionPeriod === '30D' ? 30 : 90;
 const toLocalDateStr = (iso: string) => {
 const d = new Date(iso);
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 };
 return Array.from({ length: days }, (_, i) => {
 const d = new Date();
 d.setDate(d.getDate() - (days - 1 - i));
 const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 const label = salesEvolutionPeriod === '7D'
 ? d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')
 : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
 // Mesma lógica do KPI: orders não cancelados, campo totalAmount
 const vendas = orders
 .filter(o => o.status !== OrderStatus.CANCELLED && toLocalDateStr(o.createdAt) === dateStr)
 .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
 return { name: label, vendas };
 });
 }, [salesEvolutionPeriod, orders]);

 // Dashboard preferences
 const { isCardVisible, setIsConfigOpen, getVisibleCards } = useDashboardPreferences();

 // Obter cards visíveis ordenados para garantir ordem correta
 const visibleCards = getVisibleCards();

 // Additional data states


 // Handle navigation
 const handleCardClick = (linkTo?: string) => {
 if (linkTo && onNavigate) {
 onNavigate(linkTo);
 }
 };

 // Helper to normalize date to start of day (removes time component)
 const normalizeDateStart = (date: Date): Date => {
 const normalized = new Date(date);
 normalized.setHours(0, 0, 0, 0);
 return normalized;
 };

 // Helper to normalize date to end of day
 const normalizeDateEnd = (date: Date): Date => {
 const normalized = new Date(date);
 normalized.setHours(23, 59, 59, 999);
 return normalized;
 };

 // Get date range based on selected period
 const getDateRange = (): { start: Date; end: Date } => {
 const today = new Date();
 let start = new Date();
 let end = new Date();

 switch (selectedPeriod) {
 case 'today':
 start = normalizeDateStart(today);
 end = normalizeDateEnd(today);
 break;
 case 'yesterday':
 const yesterday = new Date(today);
 yesterday.setDate(today.getDate() - 1);
 start = normalizeDateStart(yesterday);
 end = normalizeDateEnd(yesterday);
 break;
 case 'dayBeforeYesterday':
 const dayBeforeYesterday = new Date(today);
 dayBeforeYesterday.setDate(today.getDate() - 2);
 start = normalizeDateStart(dayBeforeYesterday);
 end = normalizeDateEnd(dayBeforeYesterday);
 break;
 case 'last7days':
 start = new Date(today);
 start.setDate(today.getDate() - 6);
 start = normalizeDateStart(start);
 end = normalizeDateEnd(today);
 break;
 case 'thisWeek':
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
 const weekStart = new Date(today);
 weekStart.setDate(diff);
 start = normalizeDateStart(weekStart);
 end = normalizeDateEnd(today);
 break;
 case 'lastWeek':
 const lastWeekDayOfWeek = today.getDay();
 const lastWeekDiff = today.getDate() - lastWeekDayOfWeek + (lastWeekDayOfWeek === 0 ? -6 : 1) - 7;
 const lastWeekStart = new Date(today);
 lastWeekStart.setDate(lastWeekDiff);
 start = normalizeDateStart(lastWeekStart);
 const lastWeekEnd = new Date(today);
 lastWeekEnd.setDate(lastWeekDiff + 6);
 end = normalizeDateEnd(lastWeekEnd);
 break;
 case 'last30days':
 start = new Date(today);
 start.setDate(today.getDate() - 29);
 start = normalizeDateStart(start);
 end = normalizeDateEnd(today);
 break;
 case 'thisMonth':
 start = new Date(today.getFullYear(), today.getMonth(), 1);
 start = normalizeDateStart(start);
 // Last day of current month
 const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
 end = normalizeDateEnd(lastDayOfMonth);
 break;
 case 'lastMonth':
 start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
 start = normalizeDateStart(start);
 const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
 end = normalizeDateEnd(lastDay);
 break;
 case 'last3Months':
 start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
 start = normalizeDateStart(start);
 end = normalizeDateEnd(today);
 break;
 case 'last6Months':
 start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
 start = normalizeDateStart(start);
 end = normalizeDateEnd(today);
 break;
 case 'thisYear':
 start = new Date(today.getFullYear(), 0, 1);
 start = normalizeDateStart(start);
 const lastDayOfYear = new Date(today.getFullYear(), 11, 31);
 end = normalizeDateEnd(lastDayOfYear);
 break;
 case 'lastYear':
 start = new Date(today.getFullYear() - 1, 0, 1);
 start = normalizeDateStart(start);
 const lastDayOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
 end = normalizeDateEnd(lastDayOfLastYear);
 break;
 case 'custom':
 if (customStartDate && customEndDate) {
 // Parse dates and normalize to start/end of day
 start = normalizeDateStart(new Date(customStartDate));
 end = normalizeDateEnd(new Date(customEndDate));
 } else {
 // Fallback to today if custom dates not set
 start = normalizeDateStart(today);
 end = normalizeDateEnd(today);
 }
 break;
 }

 return { start, end };
 };

 // Filter orders by selected period
 const filteredOrders = useMemo(() => {
 const { start, end } = getDateRange();
 return orders.filter(order => {
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);
 return orderDate >= normalizedStart && orderDate <= normalizedEnd;
 });
 }, [orders, selectedPeriod, customStartDate, customEndDate]);

 // Filter sales by selected period
 const filteredSales = useMemo(() => {
 const { start, end } = getDateRange();
 return sales.filter(sale => {
 // sale.date is a string in format "YYYY-MM-DD"
 const saleDate = normalizeDateStart(new Date(sale.date + 'T00:00:00'));
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);
 return saleDate >= normalizedStart && saleDate <= normalizedEnd;
 });
 }, [sales, selectedPeriod, customStartDate, customEndDate]);

 // Filter purchases by selected period
 const filteredPurchases = useMemo(() => {
 const { start, end } = getDateRange();
 return purchases.filter(purchase => {
 // purchase.orderDate might be a string or undefined
 if (!purchase.orderDate) return false;
 const purchaseDate = normalizeDateStart(new Date(purchase.orderDate));
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);
 return purchaseDate >= normalizedStart && purchaseDate <= normalizedEnd;
 });
 }, [purchases, selectedPeriod, customStartDate, customEndDate]);

 // Get previous period for comparison
 const getPreviousPeriod = (): { start: Date; end: Date } => {
 const { start, end } = getDateRange();
 const duration = end.getTime() - start.getTime();
 const prevEnd = new Date(start.getTime() - 1);
 prevEnd.setHours(23, 59, 59, 999);
 const prevStart = new Date(prevEnd.getTime() - duration);
 prevStart.setHours(0, 0, 0, 0);

 // Normalize dates
 return {
 start: normalizeDateStart(prevStart),
 end: normalizeDateEnd(prevEnd)
 };
 };

 const previousPeriodOrders = useMemo(() => {
 const { start, end } = getPreviousPeriod();
 return orders.filter(order => {
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);
 return orderDate >= normalizedStart && orderDate <= normalizedEnd;
 });
 }, [orders, selectedPeriod, customStartDate, customEndDate]);

 // Filter sales for previous period
 const previousPeriodSales = useMemo(() => {
 const { start, end } = getPreviousPeriod();
 return sales.filter(sale => {
 // sale.date is a string in format "YYYY-MM-DD"
 const saleDate = normalizeDateStart(new Date(sale.date + 'T00:00:00'));
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);
 return saleDate >= normalizedStart && saleDate <= normalizedEnd;
 });
 }, [sales, selectedPeriod, customStartDate, customEndDate]);

 // Previous period purchases
 const previousPeriodPurchases = useMemo(() => {
 const { start, end } = getPreviousPeriod();
 return purchases.filter(purchase => {
 if (!purchase.orderDate) return false;
 const purchaseDate = normalizeDateStart(new Date(purchase.orderDate));
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);
 return purchaseDate >= normalizedStart && purchaseDate <= normalizedEnd;
 });
 }, [purchases, selectedPeriod, customStartDate, customEndDate]);

 const formatMoney = (value: number) => {
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 const formatPercent = (value: number) => {
 return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
 };

 // Calculate metrics for current period
 const currentPeriodOrders = filteredOrders.filter(o => o.status !== OrderStatus.CANCELLED).length;
 const currentPeriodSales = filteredOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .reduce((acc, order) => acc + order.totalAmount, 0);

 const currentPeriodPurchasesTotal = filteredPurchases.reduce((acc, p) => acc + p.totalAmount, 0);

 const currentPeriodAvgTicket = currentPeriodOrders > 0 ? currentPeriodSales / currentPeriodOrders : 0;

 // Calculate metrics for previous period - USE ORDERS for sales calculation
 const previousPeriodOrdersCount = previousPeriodOrders.filter(o => o.status !== OrderStatus.CANCELLED).length;
 const previousPeriodSalesTotal = previousPeriodOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .reduce((acc, order) => acc + order.totalAmount, 0);

 const previousPeriodPurchasesTotal = previousPeriodPurchases.reduce((acc, p) => acc + p.totalAmount, 0);

 const previousPeriodAvgTicket = previousPeriodOrdersCount > 0 ? previousPeriodSalesTotal / previousPeriodOrdersCount : 0;

 // Calculate growth percentages
 const salesGrowth = previousPeriodSalesTotal > 0
 ? ((currentPeriodSales - previousPeriodSalesTotal) / previousPeriodSalesTotal) * 100
 : (currentPeriodSales > 0 ? 100 : 0);

 const purchasesGrowth = previousPeriodPurchasesTotal > 0
 ? ((currentPeriodPurchasesTotal - previousPeriodPurchasesTotal) / previousPeriodPurchasesTotal) * 100
 : (currentPeriodPurchasesTotal > 0 ? 100 : 0);

 const ordersGrowth = previousPeriodOrdersCount > 0
 ? ((currentPeriodOrders - previousPeriodOrdersCount) / previousPeriodOrdersCount) * 100
 : (currentPeriodOrders > 0 ? 100 : 0);

 const avgTicketGrowth = previousPeriodAvgTicket > 0
 ? ((currentPeriodAvgTicket - previousPeriodAvgTicket) / previousPeriodAvgTicket) * 100
 : (currentPeriodAvgTicket > 0 ? 100 : 0);

 // Additional stats
 const activeOrders = filteredOrders.filter(o =>
 o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED
 ).length;

 const completedOrders = filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).length;
 const completionRate = currentPeriodOrders > 0 ? (completedOrders / currentPeriodOrders) * 100 : 0;

 // New customers in period - customers who made their first order in this period
 const newCustomersInPeriod = useMemo(() => {
 const { start, end } = getDateRange();
 const customerFirstOrders = new Map<string, Date>();

 // Find first order date for each customer
 orders.forEach(order => {
 if (order.status === OrderStatus.CANCELLED) return;
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 const customerId = order.customerId || order.customerName;

 if (!customerFirstOrders.has(customerId)) {
 customerFirstOrders.set(customerId, orderDate);
 } else {
 const existingDate = customerFirstOrders.get(customerId)!;
 if (orderDate < existingDate) {
 customerFirstOrders.set(customerId, orderDate);
 }
 }
 });

 // Count customers whose first order is in the selected period
 let count = 0;
 customerFirstOrders.forEach((firstOrderDate) => {
 if (firstOrderDate >= normalizeDateStart(start) && firstOrderDate <= normalizeDateEnd(end)) {
 count++;
 }
 });

 return count;
 }, [orders, selectedPeriod, customStartDate, customEndDate]);

 // Clientes no período: clientes únicos que compraram no período
 const customersInPeriod = useMemo(() => {
 const ids = new Set<string>();
 filteredOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .forEach(order => {
 const key = order.customerId || order.customerName;
 if (key) ids.add(key);
 });
 return ids.size;
 }, [filteredOrders]);

 // Top customers
 const topCustomers = useMemo(() => {
 const customerMap = new Map<string, { name: string; orders: number; total: number }>();

 filteredOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .forEach(order => {
 const existing = customerMap.get(order.customerName) || {
 name: order.customerName,
 orders: 0,
 total: 0
 };
 existing.orders += 1;
 existing.total += order.totalAmount;
 customerMap.set(order.customerName, existing);
 });

 return Array.from(customerMap.values())
 .sort((a, b) => b.total - a.total)
 .slice(0, 5);
 }, [filteredOrders]);

 // Lista produtos vendidos: Fixos (por produto) e Variáveis (por produto+variante)
 const productsSoldByProduct = useMemo(() => {
 const map = new Map<string, { productName: string; quantity: number; revenue: number }>();
 filteredOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .forEach(order => {
 order.items.forEach(item => {
 const key = item.productId || item.productName;
 const revenue = item.quantity * ((item as { priceAtTime?: number }).priceAtTime ?? item.price);
 const existing = map.get(key) || { productName: item.productName, quantity: 0, revenue: 0 };
 existing.quantity += item.quantity;
 existing.revenue += revenue;
 map.set(key, existing);
 });
 });
 return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
 }, [filteredOrders]);

 const productsSoldByVariant = useMemo(() => {
 const map = new Map<string, { productName: string; variantName: string; quantity: number; revenue: number }>();
 filteredOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .forEach(order => {
 order.items.forEach(item => {
 const variantKey = (item.variantName || item.variantId || '').trim();
 const key = `${item.productId || item.productName}__${variantKey}`;
 const revenue = item.quantity * ((item as { priceAtTime?: number }).priceAtTime ?? item.price);
 const existing = map.get(key) || {
 productName: item.productName,
 variantName: variantKey || '—',
 quantity: 0,
 revenue: 0
 };
 existing.quantity += item.quantity;
 existing.revenue += revenue;
 map.set(key, existing);
 });
 });
 return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
 }, [filteredOrders]);

 // Top 5 produtos mais vendidos (fixos ou variáveis) — derivado das listas
 const topProductsDisplay = useMemo(() => {
 if (topProductsView === 'fixos') {
 return productsSoldByProduct.slice(0, 5).map(row => ({
 name: row.productName,
 quantity: row.quantity,
 revenue: row.revenue
 }));
 }
 return productsSoldByVariant.slice(0, 5).map(row => ({
 name: row.variantName && row.variantName !== '—' ? `${row.productName} · ${row.variantName}` : row.productName,
 quantity: row.quantity,
 revenue: row.revenue
 }));
 }, [topProductsView, productsSoldByProduct, productsSoldByVariant]);

 // Lista produtos comprados: Fixos (por produto) e Variáveis (por produto+variante)
 const productsPurchasedByProduct = useMemo(() => {
 const map = new Map<string, { productName: string; quantity: number; total: number }>();
 filteredPurchases.forEach(purchase => {
 (purchase.items || []).forEach((item: { productId: string; productName: string; quantity: number; totalPrice?: number; unitPrice?: number }) => {
 const key = item.productId || item.productName;
 const total = item.totalPrice ?? item.quantity * (item.unitPrice ?? 0);
 const existing = map.get(key) || { productName: item.productName, quantity: 0, total: 0 };
 existing.quantity += item.quantity;
 existing.total += total;
 map.set(key, existing);
 });
 });
 return Array.from(map.values()).sort((a, b) => b.total - a.total);
 }, [filteredPurchases]);

 const productsPurchasedByVariant = useMemo(() => {
 const map = new Map<string, { productName: string; variantName: string; quantity: number; total: number }>();
 filteredPurchases.forEach(purchase => {
 (purchase.items || []).forEach((item: { productId: string; productName: string; variant?: string; quantity: number; totalPrice?: number; unitPrice?: number }) => {
 const v = (item.variant || '').trim();
 const key = `${item.productId || item.productName}__${v}`;
 const total = item.totalPrice ?? item.quantity * (item.unitPrice ?? 0);
 const existing = map.get(key) || {
 productName: item.productName,
 variantName: v || '—',
 quantity: 0,
 total: 0
 };
 existing.quantity += item.quantity;
 existing.total += total;
 map.set(key, existing);
 });
 });
 return Array.from(map.values()).sort((a, b) => b.total - a.total);
 }, [filteredPurchases]);

 // Orders chart data based on period (count orders, not sales amount)
 const getOrdersChartData = () => {
 const { start, end } = getDateRange();
 const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

 // For periods <= 7 days, show daily
 // For periods <= 35 days (about a month), show weekly
 // For longer periods, show monthly
 if (daysDiff <= 7) {
 // Daily breakdown
 const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
 const data = [];
 for (let i = 0; i <= daysDiff; i++) {
 const d = new Date(start);
 d.setDate(start.getDate() + i);
 const dayStart = normalizeDateStart(d);
 const dayEnd = normalizeDateEnd(d);

 const dayOrders = filteredOrders
 .filter(o => {
 const orderDate = normalizeDateStart(new Date(o.createdAt));
 return orderDate >= dayStart && orderDate <= dayEnd &&
 o.status !== OrderStatus.CANCELLED;
 }).length;

 data.push({
 name: days[d.getDay()],
 fullDate: d.toLocaleDateString('pt-PT'),
 orders: dayOrders
 });
 }
 return data;
 } else if (daysDiff <= 35) {
 // Weekly breakdown
 const data = [];
 let currentWeekStart = new Date(start);
 currentWeekStart = normalizeDateStart(currentWeekStart);
 const normalizedEnd = normalizeDateEnd(end);

 while (currentWeekStart <= normalizedEnd) {
 const weekEnd = new Date(currentWeekStart);
 weekEnd.setDate(weekEnd.getDate() + 6);
 if (weekEnd > normalizedEnd) weekEnd.setTime(normalizedEnd.getTime());
 const normalizedWeekEnd = normalizeDateEnd(weekEnd);

 const weekOrders = filteredOrders
 .filter(o => {
 const orderDate = normalizeDateStart(new Date(o.createdAt));
 return orderDate >= currentWeekStart && orderDate <= normalizedWeekEnd &&
 o.status !== OrderStatus.CANCELLED;
 }).length;

 data.push({
 name: `Sem ${data.length + 1}`,
 fullDate: `${currentWeekStart.toLocaleDateString('pt-PT')} - ${normalizedWeekEnd.toLocaleDateString('pt-PT')}`,
 orders: weekOrders
 });

 currentWeekStart = new Date(currentWeekStart);
 currentWeekStart.setDate(currentWeekStart.getDate() + 7);
 currentWeekStart = normalizeDateStart(currentWeekStart);
 }
 return data;
 } else {
 // Monthly breakdown
 const data = [];
 let currentMonthStart = new Date(start.getFullYear(), start.getMonth(), 1);
 currentMonthStart = normalizeDateStart(currentMonthStart);
 const normalizedEnd = normalizeDateEnd(end);

 while (currentMonthStart <= normalizedEnd) {
 const monthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
 if (monthEnd > normalizedEnd) monthEnd.setTime(normalizedEnd.getTime());
 const normalizedMonthEnd = normalizeDateEnd(monthEnd);

 const monthOrders = filteredOrders
 .filter(o => {
 const orderDate = normalizeDateStart(new Date(o.createdAt));
 return orderDate >= currentMonthStart && orderDate <= normalizedMonthEnd &&
 o.status !== OrderStatus.CANCELLED;
 }).length;

 const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
 data.push({
 name: monthNames[currentMonthStart.getMonth()],
 fullDate: currentMonthStart.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
 orders: monthOrders
 });

 currentMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1);
 currentMonthStart = normalizeDateStart(currentMonthStart);
 }
 return data;
 }
 };

 const ordersChartData = getOrdersChartData();

 // Sales chart data based on period (from sales summaries)
 const getSalesChartData = () => {
 const { start, end } = getDateRange();
 const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

 // For periods <= 7 days, show daily
 // For periods <= 35 days (about a month), show weekly
 // For longer periods, show monthly
 if (daysDiff <= 7) {
 // Daily breakdown
 const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
 const data = [];
 for (let i = 0; i <= daysDiff; i++) {
 const d = new Date(start);
 d.setDate(start.getDate() + i);
 const dayStart = normalizeDateStart(d);
 const dayEnd = normalizeDateEnd(d);

 const daySales = filteredOrders
 .filter(o => {
 const orderDate = normalizeDateStart(new Date(o.createdAt));
 return orderDate >= dayStart && orderDate <= dayEnd &&
 o.status !== OrderStatus.CANCELLED;
 })
 .reduce((acc, order) => acc + order.totalAmount, 0);

 data.push({
 name: days[d.getDay()],
 fullDate: d.toLocaleDateString('pt-PT'),
 sales: daySales
 });
 }
 return data;
 } else if (daysDiff <= 35) {
 // Weekly breakdown
 const data = [];
 let currentWeekStart = new Date(start);
 currentWeekStart = normalizeDateStart(currentWeekStart);
 const normalizedEnd = normalizeDateEnd(end);

 while (currentWeekStart <= normalizedEnd) {
 const weekEnd = new Date(currentWeekStart);
 weekEnd.setDate(weekEnd.getDate() + 6);
 if (weekEnd > normalizedEnd) weekEnd.setTime(normalizedEnd.getTime());
 const normalizedWeekEnd = normalizeDateEnd(weekEnd);

 const weekSales = filteredOrders
 .filter(o => {
 const orderDate = normalizeDateStart(new Date(o.createdAt));
 return orderDate >= currentWeekStart && orderDate <= normalizedWeekEnd &&
 o.status !== OrderStatus.CANCELLED;
 })
 .reduce((acc, order) => acc + order.totalAmount, 0);

 data.push({
 name: `Sem ${data.length + 1}`,
 fullDate: `${currentWeekStart.toLocaleDateString('pt-PT')} - ${normalizedWeekEnd.toLocaleDateString('pt-PT')}`,
 sales: weekSales
 });

 currentWeekStart = new Date(currentWeekStart);
 currentWeekStart.setDate(currentWeekStart.getDate() + 7);
 currentWeekStart = normalizeDateStart(currentWeekStart);
 }
 return data;
 } else {
 // Monthly breakdown
 const data = [];
 let currentMonthStart = new Date(start.getFullYear(), start.getMonth(), 1);
 currentMonthStart = normalizeDateStart(currentMonthStart);
 const normalizedEnd = normalizeDateEnd(end);

 while (currentMonthStart <= normalizedEnd) {
 const monthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
 if (monthEnd > normalizedEnd) monthEnd.setTime(normalizedEnd.getTime());
 const normalizedMonthEnd = normalizeDateEnd(monthEnd);

 const monthSales = filteredOrders
 .filter(o => {
 const orderDate = normalizeDateStart(new Date(o.createdAt));
 return orderDate >= currentMonthStart && orderDate <= normalizedMonthEnd &&
 o.status !== OrderStatus.CANCELLED;
 })
 .reduce((acc, order) => acc + order.totalAmount, 0);

 const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
 data.push({
 name: monthNames[currentMonthStart.getMonth()],
 fullDate: currentMonthStart.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
 sales: monthSales
 });

 currentMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1);
 currentMonthStart = normalizeDateStart(currentMonthStart);
 }
 return data;
 }
 };

 const salesChartData = getSalesChartData();

 // Profit Margin Calculation
 const totalCost = useMemo(() => {
 // Soma dos custos dos produtos vendidos
 let cost = 0;
 filteredOrders
 .filter(o => o.status !== OrderStatus.CANCELLED)
 .forEach(order => {
 order.items.forEach(item => {
 const product = products.find(p => p.id === item.productId);
 if (product) {
 const costPrice = product.costPrice || 0;
 cost += item.quantity * costPrice;
 }
 });
 });
 return cost;
 }, [filteredOrders, products]);

 const profitMargin = currentPeriodSales > 0
 ? ((currentPeriodSales - totalCost) / currentPeriodSales) * 100
 : 0;

 const profitAmount = currentPeriodSales - totalCost;

 // Delivery Insights
 const deliveryOrders = filteredOrders.filter(o => o.isDelivery).length;
 const deliveryRate = currentPeriodOrders > 0 ? (deliveryOrders / currentPeriodOrders) * 100 : 0;
 const totalDeliveryFees = filteredOrders
 .filter(o => o.isDelivery)
 .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

 // Payment Status Insights
 const unpaidOrders = filteredOrders.filter(o =>
 o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial'
 ).length;
 const totalUnpaidAmount = filteredOrders
 .filter(o => o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial')
 .reduce((sum, o) => {
 if (o.paymentStatus === 'unpaid') return sum + o.totalAmount;
 if (o.paymentStatus === 'partial') return sum + (o.totalAmount - (o.amountPaid || 0));
 return sum;
 }, 0);

 const chartTheme = getChartTheme();

 // Previsão de stock (vendas semana passada)
 const stockForecastData = useMemo(
 () => getStockForecast(products, orders),
 [products, orders]
 );
 const minStockBasis = useMemo<MinStockBasis>(() => {
 if (typeof window === 'undefined') return 'manual';
 const value = window.localStorage.getItem('stock.min_stock_basis');
 if (value === 'last_week_sales' || value === 'last_month_sales' || value === 'best_month_sales' || value === 'manual') {
 return value;
 }
 return 'manual';
 }, []);
 const salesByProduct = useMemo(() => {
 const weekly = new Map<string, number>();
 const monthly = new Map<string, number>();
 const bestMonth = new Map<string, number>();
 const monthlyByProduct = new Map<string, Map<string, number>>();

 const normalizeStart = (date: Date) => {
 const d = new Date(date);
 d.setHours(0, 0, 0, 0);
 return d;
 };
 const normalizeEnd = (date: Date) => {
 const d = new Date(date);
 d.setHours(23, 59, 59, 999);
 return d;
 };

 const { start: lwStartRaw, end: lwEndRaw } = getDateRangeFromPeriod('lastWeek');
 const { start: lmStartRaw, end: lmEndRaw } = getDateRangeFromPeriod('lastMonth');
 const lwStart = normalizeStart(lwStartRaw);
 const lwEnd = normalizeEnd(lwEndRaw);
 const lmStart = normalizeStart(lmStartRaw);
 const lmEnd = normalizeEnd(lmEndRaw);

 for (const order of orders) {
 const status = normalizeOrderStatus(order);
 if (status !== OrderStatus.COMPLETED && status !== OrderStatus.DELIVERED) continue;

 const orderDate = new Date(order.createdAt);
 if (Number.isNaN(orderDate.getTime())) continue;
 const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

 for (const item of order.items || []) {
 const productId = (item.productId || '').trim();
 if (!productId) continue;
 const quantity = Number(item.quantity) || 0;
 if (quantity <= 0) continue;

 if (orderDate >= lwStart && orderDate <= lwEnd) {
 weekly.set(productId, (weekly.get(productId) || 0) + quantity);
 }
 if (orderDate >= lmStart && orderDate <= lmEnd) {
 monthly.set(productId, (monthly.get(productId) || 0) + quantity);
 }

 const monthMap = monthlyByProduct.get(productId) || new Map<string, number>();
 monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + quantity);
 monthlyByProduct.set(productId, monthMap);
 }
 }

 for (const [productId, monthMap] of monthlyByProduct.entries()) {
 let best = 0;
 for (const value of monthMap.values()) {
 if (value > best) best = value;
 }
 bestMonth.set(productId, best);
 }

 return { weekly, monthly, bestMonth };
 }, [orders]);
 const productMinStockMap = useMemo(() => {
 const map = new Map<string, number>();
 for (const product of products) {
 map.set(product.id, Number(product.minStock || 0));
 }
 return map;
 }, [products]);
 const lowStockItemsGrouped = useMemo<GroupedLowStockItem[]>(() => {
 const grouped = new Map<string, GroupedLowStockItem>();

 for (const item of stockForecastData) {
 const manualMinStock = productMinStockMap.get(item.productId) ?? Number(item.minStock || 0);
 const weeklySalesFlow = salesByProduct.weekly.get(item.productId) ?? 0;
 const monthlySalesFlow = salesByProduct.monthly.get(item.productId) ?? 0;
 const bestMonthSalesFlow = salesByProduct.bestMonth.get(item.productId) ?? 0;
 const dynamicMinStock = (() => {
 if (minStockBasis === 'last_week_sales') return weeklySalesFlow;
 if (minStockBasis === 'last_month_sales') return monthlySalesFlow;
 if (minStockBasis === 'best_month_sales') return bestMonthSalesFlow;
 return manualMinStock;
 })();
 const existing = grouped.get(item.productId);
 if (existing) {
 existing.currentStock += item.currentStock;
 existing.lastWeekSales += item.lastWeekSales;
 existing.weeklyNeed += item.weeklyNeed;
 existing.suggestedPurchase += item.suggestedPurchase;
 existing.totalVariantCount += 1;
 existing.minStock = dynamicMinStock;
 existing.bestMonthSalesFlow = bestMonthSalesFlow;
 if (item.alertType === 'low_stock') {
 existing.lowVariantCount += 1;
 existing.criticalDeficit += Math.max(0, item.minStock - item.currentStock);
 }
 if (!existing.unit && item.unit) {
 existing.unit = item.unit;
 }
 continue;
 }

 grouped.set(item.productId, {
 productId: item.productId,
 productName: item.productName,
 currentStock: item.currentStock,
 minStock: dynamicMinStock,
 lastWeekSales: item.lastWeekSales,
 weeklyNeed: item.weeklyNeed,
 suggestedPurchase: item.suggestedPurchase,
 unit: item.unit,
 alertType: 'low_stock',
 lowVariantCount: item.alertType === 'low_stock' ? 1 : 0,
 totalVariantCount: 1,
 criticalDeficit: item.alertType === 'low_stock' ? Math.max(0, item.minStock - item.currentStock) : 0,
 bestMonthSalesFlow,
 });
 }

 return Array.from(grouped.values())
 .filter(item => item.minStock > 0 && item.currentStock < item.minStock)
 .sort((a, b) => {
 if (a.bestMonthSalesFlow !== b.bestMonthSalesFlow) {
 return b.bestMonthSalesFlow - a.bestMonthSalesFlow;
 }
 const deficitA = Math.max(0, a.minStock - a.currentStock);
 const deficitB = Math.max(0, b.minStock - b.currentStock);
 if (deficitA !== deficitB) {
 return deficitB - deficitA;
 }
 if (a.criticalDeficit !== b.criticalDeficit) {
 return b.criticalDeficit - a.criticalDeficit;
 }
 if (a.lowVariantCount !== b.lowVariantCount) {
 return b.lowVariantCount - a.lowVariantCount;
 }
 if (a.suggestedPurchase !== b.suggestedPurchase) {
 return b.suggestedPurchase - a.suggestedPurchase;
 }
 return a.productName.localeCompare(b.productName);
 });
 }, [stockForecastData, productMinStockMap, salesByProduct, minStockBasis]);
 const insufficientForWeekItems = useMemo(
 () => stockForecastData.filter(i => i.alertType === 'insufficient_for_week'),
 [stockForecastData]
 );

 // Ordem dos insights: KPI cards (pequenos) e widgets (gráficos/listas) preenchem o espaço sem separar por categoria
 const KPI_CARD_IDS = new Set(['total-purchases', 'active-orders', 'customers-in-period', 'total-sales', 'total-orders', 'avg-ticket', 'completion-rate', 'new-customers']);
 const WIDGET_CARD_IDS = new Set(['orders-chart', 'sales-chart', 'low-stock', 'stock-forecast', 'top-products', 'top-customers', 'products-sold-list', 'products-purchased-list', 'delivery-stats', 'payment-status']);
 const kpiCardsInOrder = useMemo(() => visibleCards.filter(c => KPI_CARD_IDS.has(c.id)), [visibleCards]);
 const widgetCardsInOrder = useMemo(() => visibleCards.filter(c => WIDGET_CARD_IDS.has(c.id)), [visibleCards]);

 const cardBaseClass = 'bg-surface-raised p-3 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex items-start justify-between transition-all min-h-[90px] sm:min-h-[120px]';
 const cardClickClass = onNavigate ? 'cursor-pointer active:scale-[0.98] hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/50' : '';

 return (
 <div className="space-y-6">
 <DashboardSettings />
 <div className="flex flex-col gap-3 sm:gap-4">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
 <div className="flex-1 min-w-0">
 <h2 className="text-xl sm:text-2xl font-bold text-content-primary tracking-tight">{t.dashboard.overview}</h2>
 <p className="text-xs sm:text-sm text-content-muted mt-1 flex items-center">
 <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 flex-shrink-0" />
 <span>{t.dashboard.realtimeData}</span>
 </p>
 </div>
 <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
 <button
 onClick={() => setIsConfigOpen(true)}
 className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-content-primary bg-surface-raised border border-border-strong rounded-lg hover:bg-surface-base active:scale-95 transition-all min-h-[44px] sm:min-h-[auto] shadow-sm"
 title={t.dashboard.customizeDashboard}
 >
 <Settings className="w-4 h-4 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">{t.dashboard.customize}</span>
 </button>
 <div className="flex-1 sm:flex-shrink-0 min-w-0">
 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={setSelectedPeriod}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 setSelectedPeriod('custom');
 }}
 />
 </div>
 </div>
 </div>
 </div>

 {/* KPIs avançados (servidor) — visível apenas se activado nas preferências */}
         {isCardVisible('kpi-banner') && <AdvancedKPIBanner />}

         {/* Grelha única de KPI cards — preenche o espaço pela ordem das preferências */}
 {kpiCardsInOrder.length > 0 && (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
 {kpiCardsInOrder.map((card) => {
 const id = card.id;
 if (id === 'total-purchases') {
 return (
 <div key={id} onClick={() => handleCardClick('purchases')} className={`${cardBaseClass} ${cardClickClass}`}>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between mb-1">
 <p className="text-xs sm:text-sm font-medium text-content-muted truncate">{t.dashboard.totalPurchases}</p>
 {onNavigate && <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 text-content-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1" />}
 </div>
 <h3 className="text-sm sm:text-xl lg:text-2xl font-bold text-content-primary mt-1 sm:mt-2 break-all">{formatMoney(currentPeriodPurchasesTotal)}</h3>
 <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
 {purchasesGrowth >= 0 ? <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500 rotate-180 flex-shrink-0" /> : <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 rotate-180 flex-shrink-0" />}
 <span className={`text-xs font-medium ${purchasesGrowth >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatPercent(purchasesGrowth)}</span>
 </div>
 </div>
 <div className="p-1.5 sm:p-2.5 lg:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex-shrink-0 ml-1.5 sm:ml-3">
 <ShoppingBag className="w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-red-600 dark:text-red-400" />
 </div>
 </div>
 );
 }
 if (id === 'active-orders') {
 return (
 <div key={id} onClick={() => handleCardClick('orders')} className={`${cardBaseClass} ${cardClickClass}`}>
 <div className="flex items-center justify-between h-full min-w-0 flex-1">
 <div>
 <p className="text-xs sm:text-sm font-medium text-content-muted">{t.dashboard.activeOrders}</p>
 <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-content-primary mt-1 sm:mt-2">{activeOrders}</h3>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg shrink-0">
 <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
 </div>
 </div>
 </div>
 );
 }
 if (id === 'customers-in-period') {
 return (
 <div key={id} onClick={() => handleCardClick('customers')} className={`${cardBaseClass} ${cardClickClass}`}>
 <div className="flex items-center justify-between h-full min-w-0 flex-1">
 <div>
 <p className="text-xs sm:text-sm font-medium text-content-muted">Clientes no Período</p>
 <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-content-primary mt-1 sm:mt-2">{customersInPeriod}</h3>
 <p className="text-xs text-content-muted mt-2">clientes únicos que compraram</p>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg shrink-0">
 <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
 </div>
 </div>
 </div>
 );
 }
 if (id === 'total-sales') {
 return (
 <div key={id} onClick={() => handleCardClick('sales')} className={`${cardBaseClass} ${cardClickClass}`} style={{}}>
 <div className="flex-1 min-w-0">
 <p className="text-xs sm:text-sm font-medium text-content-muted truncate">Vendas do Período</p>
 <h3 className="text-lg sm:text-xl lg:text-[2rem] font-bold text-content-primary mt-1 sm:mt-2 break-all">{formatMoney(currentPeriodSales)}</h3>
 <div className="flex items-center gap-1.5 sm:gap-2 mt-2">
 {salesGrowth >= 0 ? <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" /> : <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />}
 <span className={`text-xs font-medium ${salesGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatPercent(salesGrowth)}</span>
 </div>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-brand-50 dark:bg-brand-900/20 ml-1.5 sm:ml-2" style={{ borderRadius: 'var(--radius-md, 8px)' }}>
 <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
 </div>
 </div>
 );
 }
 if (id === 'total-orders') {
 return (
 <div key={id} onClick={() => handleCardClick('orders')} className={`${cardBaseClass} ${cardClickClass}`} style={{}}>
 <div className="flex-1 min-w-0">
 <p className="text-xs sm:text-sm font-medium text-content-muted truncate">Pedidos do Período</p>
 <h3 className="text-xl sm:text-2xl lg:text-[2rem] font-bold text-content-primary mt-1 sm:mt-2">{currentPeriodOrders}</h3>
 <div className="flex items-center gap-1.5 sm:gap-2 mt-2">
 {ordersGrowth >= 0 ? <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" /> : <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />}
 <span className={`text-xs font-medium ${ordersGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatPercent(ordersGrowth)}</span>
 </div>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-brand-50 dark:bg-brand-900/20 ml-1.5 sm:ml-2" style={{ borderRadius: 'var(--radius-md, 8px)' }}>
 <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
 </div>
 </div>
 );
 }
 if (id === 'avg-ticket') {
 return (
 <div key={id} className={cardBaseClass} style={{}}>
 <div className="flex-1 min-w-0">
 <p className="text-xs sm:text-sm font-medium text-content-muted">Ticket Médio do Período</p>
 <h3 className="text-lg sm:text-xl lg:text-[2rem] font-bold text-content-primary mt-1 sm:mt-2 break-all">{formatMoney(currentPeriodAvgTicket)}</h3>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-brand-50 dark:bg-brand-900/20 ml-1.5 sm:ml-2" style={{ borderRadius: 'var(--radius-md, 8px)' }}>
 <Award className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
 </div>
 </div>
 );
 }
 if (id === 'completion-rate') {
 return (
 <div key={id} className={cardBaseClass} style={{}}>
 <div className="flex-1 min-w-0">
 <p className="text-xs sm:text-sm font-medium text-content-muted">Taxa de Conclusão do Período</p>
 <h3 className="text-xl sm:text-2xl lg:text-[2rem] font-bold text-content-primary mt-1 sm:mt-2">{completionRate.toFixed(1)}%</h3>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-brand-50 dark:bg-brand-900/20 ml-1.5 sm:ml-2" style={{ borderRadius: 'var(--radius-md, 8px)' }}>
 <Percent className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
 </div>
 </div>
 );
 }
 if (id === 'new-customers') {
 return (
 <div key={id} onClick={() => handleCardClick('customers')} className={`${cardBaseClass} ${cardClickClass}`}>
 <div className="flex-1 min-w-0">
 <p className="text-xs sm:text-sm font-medium text-content-muted">Novos Clientes no Período</p>
 <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-content-primary mt-1 sm:mt-2">{newCustomersInPeriod}</h3>
 <p className="text-xs text-content-muted mt-1">primeira compra no período</p>
 </div>
 <div className="p-1.5 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg ml-1.5 sm:ml-2">
 <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
 </div>
 </div>
 );
 }
 return null;
 })}
 </div>
 )}





 {/* Grelha única de widgets (gráfico de evolução + outros cards) */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">

 {/* Gráfico de evolução de vendas */}
 <div
 className="bg-surface-raised rounded-xl border border-border-default dark:border-white/[0.07] p-4 sm:p-5 lg:p-6 shadow-sm"
 style={{}}
 >
 <div className="flex items-center justify-between mb-4 sm:mb-5">
 <h3 className="text-base sm:text-lg font-bold text-content-primary">Evolução de Vendas</h3>
 <div className="flex gap-1">
 {(['7D', '30D', '90D'] as const).map((p) => (
 <button
 key={p}
 onClick={() => setSalesEvolutionPeriod(p)}
 className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
 salesEvolutionPeriod === p
 ? 'text-white'
 : 'text-content-muted hover:bg-black/[0.04] dark:hover:bg-surface-raised/[0.05]'
 }`}
 style={salesEvolutionPeriod === p ? { background: 'var(--brand-600)' } : undefined}
 >
 {p}
 </button>
 ))}
 </div>
 </div>
 <div className="h-44 sm:h-52 lg:h-60">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={salesEvolutionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid.stroke} strokeOpacity={chartTheme.grid.strokeOpacity} />
 <XAxis
 dataKey="name"
 axisLine={false}
 tickLine={false}
 tick={{ fill: chartTheme.tick.fill, fontSize: 10 }}
 interval={salesEvolutionPeriod === '7D' ? 0 : salesEvolutionPeriod === '30D' ? 4 : 14}
 />
 <YAxis
 axisLine={false}
 tickLine={false}
 tick={{ fill: chartTheme.tick.fill, fontSize: 10 }}
 tickFormatter={(v: number) => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`}
 />
 <Tooltip
 contentStyle={chartTheme.tooltip.contentStyle}
 labelStyle={chartTheme.tooltip.labelStyle}
 formatter={(value: number) => [value.toLocaleString('pt-PT', { minimumFractionDigits: 2 }) + ' MT', 'Vendas']}
 />
 <Line
 type="monotone"
 dataKey="vendas"
 stroke="var(--brand-600)"
 strokeWidth={2}
 dot={false}
 activeDot={{ r: 4, fill: 'var(--brand-600)' }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>

 {widgetCardsInOrder.length > 0 && (<>
 {widgetCardsInOrder.map((card) => {
 const id = card.id;
 if (id === 'orders-chart') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex flex-col">
 <div className="flex items-center justify-between min-h-[2.25rem] sm:min-h-[2.5rem] mb-3 sm:mb-4">
 <h3 className="text-base sm:text-lg font-bold text-content-primary">Pedidos por Período</h3>
 </div>
 <div className="h-36 sm:h-48 lg:h-64 flex-1 min-h-0">
 {ordersChartData.every(d => d.orders === 0) ? (
 <div className="h-full flex flex-col items-center justify-center text-content-muted">
 <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
 <p className="text-sm">Sem pedidos registados neste período.</p>
 </div>
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={ordersChartData}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid.stroke} strokeOpacity={chartTheme.grid.strokeOpacity} />
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick.fill, fontSize: 10 }} className="text-[10px] sm:text-xs" />
 <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick.fill, fontSize: 10 }} className="text-[10px] sm:text-xs" />
 <Tooltip cursor={chartTheme.tooltip.cursor} contentStyle={chartTheme.tooltip.contentStyle} formatter={(value: number) => [`${value}`, 'Pedidos']} labelStyle={chartTheme.tooltip.labelStyle} />
 <Bar dataKey="orders" fill={chartTheme.colors.ordersBar} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 </div>
 );
 }
 if (id === 'sales-chart') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex flex-col">
 <div className="flex items-center justify-between min-h-[2.25rem] sm:min-h-[2.5rem] mb-3 sm:mb-4">
 <h3 className="text-base sm:text-lg font-bold text-content-primary">Vendas por Período</h3>
 </div>
 <div className="h-36 sm:h-48 lg:h-64 flex-1 min-h-0">
 {salesChartData.every(d => d.sales === 0) ? (
 <div className="h-full flex flex-col items-center justify-center text-content-muted">
 <DollarSign className="w-8 h-8 mb-2 opacity-50" />
 <p className="text-sm">Sem vendas registadas neste período.</p>
 </div>
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={salesChartData}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid.stroke} strokeOpacity={chartTheme.grid.strokeOpacity} />
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick.fill, fontSize: 10 }} className="text-[10px] sm:text-xs" />
 <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick.fill, fontSize: 10 }} className="text-[10px] sm:text-xs" />
 <Tooltip cursor={chartTheme.tooltip.cursor} contentStyle={chartTheme.tooltip.contentStyle} formatter={(value: number) => [`${formatMoney(value)}`, 'Vendas']} labelStyle={chartTheme.tooltip.labelStyle} />
 <Bar dataKey="sales" fill={chartTheme.colors.salesBar} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 </div>
 );
 }
 if (id === 'low-stock') {
 return (
 <div key={id} onClick={() => handleCardClick('stock-alerts')} className={`bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex flex-col ${onNavigate ? 'cursor-pointer hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/40 transition-all' : ''}`}>
 <div className="flex items-center justify-between min-h-[2.25rem] sm:min-h-[2.5rem] mb-3 sm:mb-4">
 <h3 className="text-base sm:text-lg font-bold text-content-primary flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-500" />
 Stock Baixo
 </h3>
 {onNavigate && <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Ver todos</span>}
 </div>
 {lowStockItemsGrouped.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 gap-3">
 <Package className="w-12 h-12 opacity-30" style={{ color: 'var(--brand-600)' }} />
 <div className="text-center">
 <p className="text-sm" className="text-content-muted">Nenhum produto com stock baixo</p>
 <p className="text-xs mt-1" className="text-content-muted">Todos os produtos estão com stock adequado</p>
 </div>
 </div>
 ) : (
 <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
 {lowStockItemsGrouped.map(item => (
 <div key={item.productId} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
 <span className="text-sm text-content-primary truncate flex-1">
 {item.productName}
 </span>
 <span className="text-sm font-medium text-amber-600 dark:text-amber-400 flex-shrink-0 ml-2">
 {item.currentStock} / {item.minStock} {item.unit}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 }
 if (id === 'stock-forecast') {
 return (
 <div key={id} onClick={() => handleCardClick('stock-alerts')} className={`bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex flex-col ${onNavigate ? 'cursor-pointer hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/40 transition-all' : ''}`}>
 <div className="flex items-center justify-between min-h-[2.25rem] sm:min-h-[2.5rem] mb-3 sm:mb-4">
 <h3 className="text-base sm:text-lg font-bold text-content-primary flex items-center gap-2">
 <TrendingUp className="w-5 h-5 text-orange-500" />
 Previsão Semanal
 </h3>
 {onNavigate && <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Ver todos</span>}
 </div>
 {insufficientForWeekItems.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 gap-3">
 <TrendingUp className="w-12 h-12 opacity-30" style={{ color: 'var(--brand-600)' }} />
 <div className="text-center">
 <p className="text-sm" className="text-content-muted">Stock suficiente para a semana</p>
 <p className="text-xs mt-1" className="text-content-muted">Registe vendas para ver previsões de reposição</p>
 </div>
 </div>
 ) : (
 <div className="space-y-2">
 {insufficientForWeekItems.slice(0, 5).map((item, idx) => (
 <div key={`${item.productId}-${item.variantId ?? ''}-${idx}`} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
 <span className="text-sm text-content-primary truncate flex-1">
 {item.productName}{item.variantName ? ` (${item.variantName})` : ''}
 </span>
 <span className="text-sm font-medium text-orange-600 dark:text-orange-400 flex-shrink-0 ml-2">
 Sugerido: {item.suggestedPurchase} {item.unit}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 }
 if (id === 'top-products') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex flex-col">
 <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 min-h-[2.25rem] sm:min-h-[2.5rem]">
 <h3 className="text-base sm:text-lg font-bold text-content-primary flex-1 min-w-0">Produtos Mais Vendidos</h3>
 <div className="flex rounded-lg border border-border-strong p-0.5 bg-surface-base flex-shrink-0">
 <button type="button" onClick={() => setTopProductsView('fixos')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${topProductsView === 'fixos' ? 'bg-brand-500 text-white' : 'text-content-muted hover:text-content-primary'}`}>Fixos</button>
 <button type="button" onClick={() => setTopProductsView('variáveis')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${topProductsView === 'variáveis' ? 'bg-brand-500 text-white' : 'text-content-muted hover:text-content-primary'}`}>Variáveis</button>
 </div>
 </div>
 {topProductsDisplay.length === 0 ? (
 <div className="h-48 sm:h-56 lg:h-64 flex-1 min-h-0 flex flex-col items-center justify-center text-content-muted">
 <Package className="w-8 h-8 mb-2 opacity-50" />
 <p className="text-sm">Sem produtos vendidos neste período</p>
 </div>
 ) : (
 <div className="space-y-3 min-h-[12rem] sm:min-h-[14rem] lg:min-h-[16rem]">
 {topProductsDisplay.map((product, index) => (
 <div key={product.name} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg active:scale-[0.98] transition-transform">
 <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
 <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0 ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-content-muted' : index === 2 ? 'bg-orange-600' : 'bg-surface-base'}`}>
 {index + 1}
 </div>
 <div className="min-w-0 flex-1">
 <p className="font-medium text-sm sm:text-base text-content-primary truncate">{product.name}</p>
 <p className="text-xs text-content-muted">{product.quantity.toFixed(1)} unidades</p>
 </div>
 </div>
 <div className="text-right flex-shrink-0 ml-2">
 <p className="font-bold text-sm sm:text-base text-content-primary">{formatMoney(product.revenue)}</p>
 <p className="text-xs text-content-muted">Receita</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 }
 if (id === 'top-customers') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07]">
 <h3 className="text-base sm:text-lg font-bold text-content-primary mb-3 sm:mb-4">Clientes Mais Valiosos</h3>
 {topCustomers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 gap-3">
 <Users className="w-12 h-12 opacity-30" style={{ color: 'var(--brand-600)' }} />
 <div className="text-center">
 <p className="text-sm" className="text-content-muted">Sem clientes neste período</p>
 <p className="text-xs mt-1" className="text-content-muted">Registe uma venda para ver clientes aqui</p>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 {topCustomers.map((customer, index) => (
 <div key={customer.name} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg active:scale-[0.98] transition-transform">
 <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
 <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0 ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-content-muted' : index === 2 ? 'bg-orange-600' : 'bg-surface-base'}`}>
 {index + 1}
 </div>
 <div className="min-w-0 flex-1">
 <p className="font-medium text-sm sm:text-base text-content-primary truncate">{customer.name}</p>
 <p className="text-xs text-content-muted">{customer.orders} pedido{customer.orders !== 1 ? 's' : ''}</p>
 </div>
 </div>
 <div className="text-right flex-shrink-0 ml-2">
 <p className="font-bold text-sm sm:text-base text-content-primary">{formatMoney(customer.total)}</p>
 <p className="text-xs text-content-muted">Total gasto</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 }
 if (id === 'products-sold-list') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07] flex flex-col">
 <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 min-h-[2.25rem] sm:min-h-[2.5rem]">
 <h3 className="text-base sm:text-lg font-bold text-content-primary flex-1 min-w-0">Lista Produtos Vendidos no Período</h3>
 <div className="flex rounded-lg border border-border-strong p-0.5 bg-surface-base flex-shrink-0">
 <button type="button" onClick={() => setProductsSoldView('fixos')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${productsSoldView === 'fixos' ? 'bg-brand-500 text-white' : 'text-content-muted hover:text-content-primary'}`}>Fixos</button>
 <button type="button" onClick={() => setProductsSoldView('variáveis')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${productsSoldView === 'variáveis' ? 'bg-brand-500 text-white' : 'text-content-muted hover:text-content-primary'}`}>Variáveis</button>
 </div>
 </div>
 {productsSoldView === 'fixos' ? (
 productsSoldByProduct.length === 0 ? (
 <div className="h-48 sm:h-56 lg:h-64 flex-1 min-h-0 flex flex-col items-center justify-center text-content-muted"><Package className="w-8 h-8 mb-2 opacity-50" /><p className="text-sm">Sem produtos vendidos neste período</p></div>
 ) : (
 <div className="space-y-2 min-h-[12rem] sm:min-h-[14rem] lg:min-h-[16rem] max-h-64 overflow-y-auto flex-1 min-h-0">
 {productsSoldByProduct.slice(0, 15).map((row, i) => (
 <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg">
 <div className="min-w-0 flex-1"><p className="font-medium text-sm text-content-primary truncate">{row.productName}</p><p className="text-xs text-content-muted">{row.quantity.toFixed(1)} un.</p></div>
 <p className="font-bold text-sm text-content-primary flex-shrink-0 ml-2">{formatMoney(row.revenue)}</p>
 </div>
 ))}
 </div>
 )
 ) : (
 productsSoldByVariant.length === 0 ? (
 <div className="h-48 sm:h-56 lg:h-64 flex-1 min-h-0 flex flex-col items-center justify-center text-content-muted"><Package className="w-8 h-8 mb-2 opacity-50" /><p className="text-sm">Sem produtos vendidos neste período</p></div>
 ) : (
 <div className="space-y-2 min-h-[12rem] sm:min-h-[14rem] lg:min-h-[16rem] max-h-64 overflow-y-auto flex-1 min-h-0">
 {productsSoldByVariant.slice(0, 15).map((row, i) => (
 <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg">
 <div className="min-w-0 flex-1"><p className="font-medium text-sm text-content-primary truncate">{row.productName}</p><p className="text-xs text-content-muted">{row.variantName} · {row.quantity.toFixed(1)} un.</p></div>
 <p className="font-bold text-sm text-content-primary flex-shrink-0 ml-2">{formatMoney(row.revenue)}</p>
 </div>
 ))}
 </div>
 )
 )}
 </div>
 );
 }
 if (id === 'products-purchased-list') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07]">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
 <h3 className="text-base sm:text-lg font-bold text-content-primary">Lista Produtos Comprados no Período</h3>
 <div className="flex rounded-lg border border-border-strong p-0.5 bg-surface-base">
 <button type="button" onClick={() => setProductsPurchasedView('fixos')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${productsPurchasedView === 'fixos' ? 'bg-brand-500 text-white' : 'text-content-muted hover:text-content-primary'}`}>Fixos</button>
 <button type="button" onClick={() => setProductsPurchasedView('variáveis')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${productsPurchasedView === 'variáveis' ? 'bg-brand-500 text-white' : 'text-content-muted hover:text-content-primary'}`}>Variáveis</button>
 </div>
 </div>
 {productsPurchasedView === 'fixos' ? (
 productsPurchasedByProduct.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 gap-3">
 <ShoppingBag className="w-12 h-12 opacity-30" style={{ color: 'var(--brand-600)' }} />
 <div className="text-center">
 <p className="text-sm" className="text-content-muted">Sem compras neste período</p>
 <p className="text-xs mt-1" className="text-content-muted">Registe compras no período para ver os dados</p>
 </div>
 </div>
 ) : (
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {productsPurchasedByProduct.slice(0, 15).map((row, i) => (
 <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg">
 <div className="min-w-0 flex-1"><p className="font-medium text-sm text-content-primary truncate">{row.productName}</p><p className="text-xs text-content-muted">{row.quantity.toFixed(1)} un.</p></div>
 <p className="font-bold text-sm text-content-primary flex-shrink-0 ml-2">{formatMoney(row.total)}</p>
 </div>
 ))}
 </div>
 )
 ) : (
 productsPurchasedByVariant.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 gap-3">
 <ShoppingBag className="w-12 h-12 opacity-30" style={{ color: 'var(--brand-600)' }} />
 <div className="text-center">
 <p className="text-sm" className="text-content-muted">Sem compras neste período</p>
 <p className="text-xs mt-1" className="text-content-muted">Registe compras no período para ver os dados</p>
 </div>
 </div>
 ) : (
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {productsPurchasedByVariant.slice(0, 15).map((row, i) => (
 <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg">
 <div className="min-w-0 flex-1"><p className="font-medium text-sm text-content-primary truncate">{row.productName}</p><p className="text-xs text-content-muted">{row.variantName} · {row.quantity.toFixed(1)} un.</p></div>
 <p className="font-bold text-sm text-content-primary flex-shrink-0 ml-2">{formatMoney(row.total)}</p>
 </div>
 ))}
 </div>
 )
 )}
 </div>
 );
 }
 if (id === 'delivery-stats') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07]">
 <h3 className="text-base sm:text-lg font-bold text-content-primary mb-3 sm:mb-4 flex items-center gap-2"><Truck className="w-5 h-5" />Estatísticas de Entrega</h3>
 <div className="space-y-3 sm:space-y-4">
 <div className="flex items-center justify-between p-3 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg min-h-[44px]"><span className="text-sm text-content-muted">Pedidos com Entrega</span><span className="font-bold text-content-primary">{deliveryOrders}</span></div>
 <div className="flex items-center justify-between p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg"><span className="text-sm text-content-muted">Taxa de Entrega</span><span className="font-bold text-content-primary">{deliveryRate.toFixed(1)}%</span></div>
 <div className="flex items-center justify-between p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg"><span className="text-sm text-content-muted">Total Taxas de Entrega</span><span className="font-bold text-content-primary">{formatMoney(totalDeliveryFees)}</span></div>
 </div>
 </div>
 );
 }
 if (id === 'payment-status') {
 return (
 <div key={id} className="bg-surface-raised p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border border-border-default dark:border-white/[0.07]">
 <h3 className="text-base sm:text-lg font-bold text-content-primary mb-3 sm:mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" />Status de Pagamento</h3>
 <div className="space-y-3 sm:space-y-4">
 <div className="flex items-center justify-between p-3 sm:p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg min-h-[44px]"><span className="text-sm text-content-muted">Pedidos Pagos</span><span className="font-bold text-green-600 dark:text-green-400">{currentPeriodOrders - unpaidOrders}</span></div>
 <div className="flex items-center justify-between p-3 bg-surface-base dark:bg-white/[0.05] rounded-lg"><span className="text-sm text-content-muted">Pedidos Não Pagos</span><span className="font-bold text-red-600 dark:text-red-400">{unpaidOrders}</span></div>
 <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"><span className="text-sm text-content-muted">Valor Pendente</span><span className="font-bold text-yellow-600 dark:text-yellow-400">{formatMoney(totalUnpaidAmount)}</span></div>
 </div>
 </div>
 );
 }
 return null;
 })}
 </>)}

 </div>

 </div >
 );
};

export default Dashboard;
