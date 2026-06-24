import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, Order } from '../../core/types/types';
import { OrderStatus } from '../../core/types/order';
import { normalizeForSearch, normalizeOrderStatus } from '../../core/services/serviceUtils';
import { getDateRangeFromPeriod, getTodayDateString } from '../../core/utils/dateUtils';
import { Package, ShoppingCart, Download, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { getStockForecast, type StockAlertType, type StockForecastItem } from '../services/stockForecastService';
import { productService } from '../services/productService';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, SelectFilter, ItemsPerPageSelect, Pagination } from '../../core/components/filters';
import { createWorkbook, addWorksheet, addJsonToSheetAt, writeWorkbookToFile } from '../../core/services/excelService';
import jsPDF from 'jspdf';
import {
 addPDFHeader,
 addPDFFooter,
 addPDFTableHeader,
 addPDFTableRow,
 calculateColumnWidths,
} from '../../core/services/reportService';

interface StockAlertsProps {
 products: Product[];
 orders: Order[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
 onNavigate?: (page: string) => void;
}

type AlertFilter = 'all' | 'low_stock' | 'insufficient_for_week';
type ProductTypeFilter = 'all' | 'fixo' | 'variável';
type MinStockBasis = 'manual' | 'last_week_sales' | 'last_month_sales' | 'best_month_sales';
type SortField = 'productName' | 'variantName' | 'currentStock' | 'minStock' | 'lastWeekSales' | 'suggestedPurchase' | 'unit' | 'alertType';

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

export const StockAlerts: React.FC<StockAlertsProps> = ({ products, orders, showToast, onNavigate }) => {
 const navigate = useNavigate();
 const [searchQuery, setSearchQuery] = useState('');
 const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
 const [productTypeFilter, setProductTypeFilter] = useState<ProductTypeFilter>('fixo');
 const [minStockBasis, setMinStockBasis] = useState<MinStockBasis>(() => {
 if (typeof window === 'undefined') return 'manual';
 const saved = window.localStorage.getItem('stock.min_stock_basis');
 if (saved === 'last_week_sales' || saved === 'last_month_sales' || saved === 'best_month_sales' || saved === 'manual') {
 return saved;
 }
 return 'manual';
 });
 const [itemsPerPage, setItemsPerPage] = useState(25);
 const [currentPage, setCurrentPage] = useState(1);
 const [sortField, setSortField] = useState<SortField>('suggestedPurchase');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
 const [minStockOverrides, setMinStockOverrides] = useState<Record<string, number>>({});
 const [minStockDrafts, setMinStockDrafts] = useState<Record<string, string>>({});
 const [savingMinRowKey, setSavingMinRowKey] = useState<string | null>(null);

 useEffect(() => {
 if (typeof window === 'undefined') return;
 window.localStorage.setItem('stock.min_stock_basis', minStockBasis);
 }, [minStockBasis]);

 const forecastData = useMemo(() => getStockForecast(products, orders), [products, orders]);

 const productMinStockMap = useMemo(() => {
 const map = new Map<string, number>();
 for (const product of products) {
 map.set(product.id, Number(product.minStock || 0));
 }
 return map;
 }, [products]);

 const salesFactors = useMemo(() => {
 const byKeyLastWeek = new Map<string, number>();
 const byKeyLastMonth = new Map<string, number>();
 const byKeyBestMonth = new Map<string, number>();
 const monthlyByKey = new Map<string, Map<string, number>>();

 const { start: lastWeekStart, end: lastWeekEnd } = getDateRangeFromPeriod('lastWeek');
 const { start: lastMonthStart, end: lastMonthEnd } = getDateRangeFromPeriod('lastMonth');
 const lwStart = normalizeDateStart(lastWeekStart);
 const lwEnd = normalizeDateEnd(lastWeekEnd);
 const lmStart = normalizeDateStart(lastMonthStart);
 const lmEnd = normalizeDateEnd(lastMonthEnd);

 for (const order of orders) {
 const status = normalizeOrderStatus(order);
 if (status !== OrderStatus.COMPLETED && status !== OrderStatus.DELIVERED) continue;

 const orderDate = new Date(order.createdAt);
 if (Number.isNaN(orderDate.getTime())) continue;

 const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

 for (const item of order.items || []) {
 const productId = (item.productId || '').trim();
 if (!productId) continue;
 const variantId = (item.variantId ?? 'no-variant').toString().trim() || 'no-variant';
 const key = `${productId}__${variantId}`;
 const quantity = Number(item.quantity) || 0;
 if (quantity <= 0) continue;

 if (orderDate >= lwStart && orderDate <= lwEnd) {
 byKeyLastWeek.set(key, (byKeyLastWeek.get(key) || 0) + quantity);
 }
 if (orderDate >= lmStart && orderDate <= lmEnd) {
 byKeyLastMonth.set(key, (byKeyLastMonth.get(key) || 0) + quantity);
 }

 const monthMap = monthlyByKey.get(key) || new Map<string, number>();
 monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + quantity);
 monthlyByKey.set(key, monthMap);
 }
 }

 for (const [key, monthMap] of monthlyByKey.entries()) {
 let best = 0;
 for (const value of monthMap.values()) {
 if (value > best) best = value;
 }
 byKeyBestMonth.set(key, best);
 }

 const aggregateByProduct = (source: Map<string, number>) => {
 const byProduct = new Map<string, number>();
 for (const [key, value] of source.entries()) {
 const productId = key.split('__')[0];
 byProduct.set(productId, (byProduct.get(productId) || 0) + value);
 }
 return byProduct;
 };

 return {
 byKeyLastWeek,
 byKeyLastMonth,
 byKeyBestMonth,
 byProductLastWeek: aggregateByProduct(byKeyLastWeek),
 byProductLastMonth: aggregateByProduct(byKeyLastMonth),
 byProductBestMonth: aggregateByProduct(byKeyBestMonth),
 };
 }, [orders]);

 const getRowPersistenceKey = (item: StockForecastItem): string => {
 if (productTypeFilter === 'fixo') return `product:${item.productId}`;
 if (item.variantId) return `variant:${item.variantId}`;
 return `product:${item.productId}`;
 };

 const getBasisMinStock = (item: StockForecastItem): number => {
 const rowKey = `${item.productId}__${item.variantId ?? 'no-variant'}`;
 const persistenceKey = getRowPersistenceKey(item);
 const manualBase = item.variantId
 ? Number(item.minStock || 0)
 : Number(productMinStockMap.get(item.productId) ?? item.minStock ?? 0);
 const manualMin = minStockOverrides[persistenceKey] ?? manualBase;

 if (minStockBasis === 'last_week_sales') {
 return productTypeFilter === 'fixo'
 ? Number(salesFactors.byProductLastWeek.get(item.productId) || 0)
 : Number(salesFactors.byKeyLastWeek.get(rowKey) || 0);
 }
 if (minStockBasis === 'last_month_sales') {
 return productTypeFilter === 'fixo'
 ? Number(salesFactors.byProductLastMonth.get(item.productId) || 0)
 : Number(salesFactors.byKeyLastMonth.get(rowKey) || 0);
 }
 if (minStockBasis === 'best_month_sales') {
 return productTypeFilter === 'fixo'
 ? Number(salesFactors.byProductBestMonth.get(item.productId) || 0)
 : Number(salesFactors.byKeyBestMonth.get(rowKey) || 0);
 }
 return manualMin;
 };

 const effectiveData = useMemo((): StockForecastItem[] => {
 const source: StockForecastItem[] = (() => {
 if (productTypeFilter !== 'fixo') return forecastData;

 const byProduct = new Map<string, StockForecastItem>();
 for (const item of forecastData) {
 const existing = byProduct.get(item.productId);
 if (!existing) {
 byProduct.set(item.productId, { ...item, variantId: undefined, variantName: undefined });
 } else {
 existing.currentStock += item.currentStock;
 existing.lastWeekSales += item.lastWeekSales;
 existing.weeklyNeed += item.weeklyNeed;
 existing.suggestedPurchase += item.suggestedPurchase;
 }
 }
 return Array.from(byProduct.values());
 })();

 return source.map(item => {
 const minStock = getBasisMinStock(item);
 const deficitFromMin = Math.max(0, minStock - item.currentStock);
 const deficitFromWeek = Math.max(0, item.weeklyNeed - item.currentStock);
 const suggestedPurchase = Math.max(deficitFromMin, deficitFromWeek);

 let alertType: StockAlertType = 'ok';
 if (minStock > 0 && item.currentStock < minStock) alertType = 'low_stock';
 else if (item.weeklyNeed > 0 && item.currentStock < item.weeklyNeed) alertType = 'insufficient_for_week';

 return { ...item, minStock, suggestedPurchase, alertType };
 });
 }, [forecastData, productTypeFilter, minStockBasis, minStockOverrides, salesFactors, productMinStockMap]);

 const filteredData = useMemo(() => {
 const query = normalizeForSearch(searchQuery);
 let data = effectiveData;

 if (productTypeFilter === 'variável') {
 data = effectiveData.filter(item => !!item.variantId);
 }

 return data.filter(item => {
 const matchesSearch = !query
 || normalizeForSearch(item.productName).includes(query)
 || (item.variantName && normalizeForSearch(item.variantName).includes(query));
 const matchesAlertFilter = alertFilter === 'all' || item.alertType === alertFilter;
 return matchesSearch && matchesAlertFilter && item.alertType !== 'ok';
 });
 }, [effectiveData, searchQuery, alertFilter, productTypeFilter]);

 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, alertFilter, productTypeFilter, minStockBasis]);

 const handleSort = (field: SortField) => {
 if (sortField === field) {
 setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField(field);
 setSortDirection('asc');
 }
 setCurrentPage(1);
 };

 const sortedData = useMemo(() => {
 const sorted = [...filteredData];
 const mult = sortDirection === 'asc' ? 1 : -1;
 sorted.sort((a, b) => {
 let va: string | number = '';
 let vb: string | number = '';
 switch (sortField) {
 case 'productName': va = (a.productName || '').toLowerCase(); vb = (b.productName || '').toLowerCase(); break;
 case 'variantName': va = (a.variantName || '').toLowerCase(); vb = (b.variantName || '').toLowerCase(); break;
 case 'currentStock': va = a.currentStock; vb = b.currentStock; break;
 case 'minStock': va = a.minStock; vb = b.minStock; break;
 case 'lastWeekSales': va = a.lastWeekSales; vb = b.lastWeekSales; break;
 case 'suggestedPurchase': va = a.suggestedPurchase; vb = b.suggestedPurchase; break;
 case 'unit': va = (a.unit || '').toLowerCase(); vb = (b.unit || '').toLowerCase(); break;
 case 'alertType': va = a.alertType; vb = b.alertType; break;
 default: return 0;
 }
 if (typeof va === 'string' && typeof vb === 'string') return mult * va.localeCompare(vb);
 return mult * (Number(va) - Number(vb));
 });
 return sorted;
 }, [filteredData, sortField, sortDirection]);

 const paginatedData = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return sortedData.slice(start, start + itemsPerPage);
 }, [sortedData, currentPage, itemsPerPage]);

 const saveMinStockInline = async (item: StockForecastItem) => {
 if (minStockBasis !== 'manual') return;
 const key = `${item.productId}__${item.variantId ?? 'no-variant'}`;
 const draft = minStockDrafts[key];
 const parsed = Number.parseFloat(draft ?? `${item.minStock}`);
 if (!Number.isFinite(parsed) || parsed < 0) {
 showToast('Stock mínimo inválido', 'warning');
 setMinStockDrafts(prev => ({ ...prev, [key]: `${item.minStock}` }));
 return;
 }

 const rounded = Math.round(parsed * 100) / 100;
 if (Math.abs(rounded - item.minStock) < 0.00001) return;

 const persistenceKey = getRowPersistenceKey(item);
 setSavingMinRowKey(key);
 try {
 let ok = false;
 if (productTypeFilter === 'fixo' || !item.variantId) {
 ok = await productService.updateProduct(item.productId, { minStock: rounded });
 } else {
 ok = await productService.updateVariant(item.variantId, { minStock: rounded });
 }

 if (!ok) {
 showToast('Erro ao atualizar stock mínimo', 'error');
 return;
 }

 setMinStockOverrides(prev => ({ ...prev, [persistenceKey]: rounded }));
 showToast('Stock mínimo atualizado', 'success');
 } finally {
 setSavingMinRowKey(null);
 }
 };

 const handleNavigate = (path: string) => {
 if (onNavigate) onNavigate(path);
 else navigate(path);
 };

 const getAlertLabel = (type: StockAlertType): string => {
 if (type === 'low_stock') return 'Stock baixo';
 if (type === 'insufficient_for_week') return 'Previsão insuficiente';
 return '—';
 };

 const getAlertBadgeClass = (type: StockAlertType): string => {
 if (type === 'low_stock') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
 if (type === 'insufficient_for_week') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
 return '';
 };

 const getMinBasisLabel = () => {
 if (minStockBasis === 'manual') return 'Definido manualmente';
 if (minStockBasis === 'last_week_sales') return 'Vendas da semana passada';
 if (minStockBasis === 'last_month_sales') return 'Vendas do mês passado';
 return 'Vendas do melhor mês';
 };

 const exportToExcel = async () => {
 try {
 const excelData = sortedData.map(item => ({
 Produto: item.productName,
 Variante: item.variantName ?? '—',
 'Stock Atual': item.currentStock,
 Mín: item.minStock,
 'Vendas Sem. Passada': item.lastWeekSales,
 'Sugestão Compra': item.suggestedPurchase,
 Unidade: item.unit,
 'Tipo Alerta': getAlertLabel(item.alertType),
 }));

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Alertas de Stock');

 ws.getRow(1).getCell(1).value = 'Relatório:';
 ws.getRow(1).getCell(2).value = 'Alertas de Stock';
 ws.getRow(2).getCell(1).value = 'Data:';
 ws.getRow(2).getCell(2).value = new Date().toLocaleDateString('pt-PT');
 ws.getRow(3).getCell(1).value = 'Pesquisa:';
 ws.getRow(3).getCell(2).value = searchQuery.trim() || '-';
 ws.getRow(3).getCell(4).value = 'Tipo alerta:';
 ws.getRow(3).getCell(5).value = alertFilter === 'all' ? 'Todos' : alertFilter === 'low_stock' ? 'Stock baixo' : 'Previsão insuficiente';
 ws.getRow(3).getCell(7).value = 'Produto:';
 ws.getRow(3).getCell(8).value = productTypeFilter === 'all' ? 'Todos' : productTypeFilter === 'fixo' ? 'Fixos' : 'Variáveis';
 ws.getRow(4).getCell(1).value = 'Base do mínimo:';
 ws.getRow(4).getCell(2).value = getMinBasisLabel();

 const dataStartRow = 6;
 const headerKeys = Object.keys(excelData[0] || {});
 const headerRow = ws.getRow(5);
 headerKeys.forEach((key, i) => { headerRow.getCell(i + 1).value = key; });
 headerRow.commit();
 addJsonToSheetAt(ws, excelData as Record<string, unknown>[], dataStartRow, 1);

 [20, 15, 12, 8, 18, 16, 10, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 const filename = `alertas_stock_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação Excel concluída: ${sortedData.length} alertas`, 'success');
 } catch (error: unknown) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 const exportToPDF = async () => {
 try {
 const pdf = new jsPDF('l', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) filters.push({ label: 'Pesquisa', value: searchQuery });
 filters.push({ label: 'Tipo alerta', value: alertFilter === 'all' ? 'Todos' : alertFilter === 'low_stock' ? 'Stock baixo' : 'Previsão insuficiente' });
 filters.push({ label: 'Produto', value: productTypeFilter === 'all' ? 'Todos' : productTypeFilter === 'fixo' ? 'Fixos' : 'Variáveis' });
 filters.push({ label: 'Base do mínimo', value: getMinBasisLabel() });
 filters.push({ label: 'Total de alertas', value: sortedData.length.toString() });

 let yPos = await addPDFHeader(pdf, 'Alertas de Stock', {
 period: `Gerado em ${new Date().toLocaleDateString('pt-PT')}`,
 filters,
 orientation: 'landscape',
 });

 const colHeaders = ['Produto', 'Variante', 'Stock Atual', 'Mín.', 'Vendas Sem. Passada', 'Sugestão Compra', 'Unidade', 'Tipo Alerta'];
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = [2.0, 1.2, 0.9, 0.6, 1.2, 1.0, 0.6, 1.2];
 const colWidths = calculateColumnWidths(availableWidth, colProportions);
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
 colX.push(pdfWidth - margin);

 yPos = addPDFTableHeader(pdf, colHeaders, colX, yPos, margin, pdfWidth);

 sortedData.forEach((item, index) => {
 if (yPos > pdfHeight - 20) {
 pdf.addPage('l');
 yPos = margin;
 yPos = addPDFTableHeader(pdf, colHeaders, colX, yPos, margin, pdfWidth);
 }

 const rowData = [
 (item.productName || '').substring(0, 35),
 (item.variantName ?? '—').substring(0, 15),
 item.currentStock.toString(),
 item.minStock.toString(),
 item.lastWeekSales.toString(),
 item.suggestedPurchase.toString(),
 item.unit,
 getAlertLabel(item.alertType),
 ];
 yPos = addPDFTableRow(pdf, rowData, colX, yPos, index, margin, pdfWidth, { fontSize: 8, alternateColors: true });
 });

 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 pdf.save(`alertas_stock_${getTodayDateString()}.pdf`);
 showToast(`Exportação PDF concluída: ${sortedData.length} alertas`, 'success');
 } catch (error: unknown) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 return (
 <PageShell
 title="Alertas de Stock"
 description={`Previsão de necessidades baseada em ${getMinBasisLabel().toLowerCase()}`}
 actions={(
 <div className="flex items-center gap-2 flex-wrap">
 <button
 onClick={exportToExcel}
 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-content-primary bg-surface-raised border border-border-strong rounded-lg hover:bg-surface-base transition-colors"
 >
 <Download className="w-4 h-4" />
 Exportar Excel
 </button>
 <button
 onClick={exportToPDF}
 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-content-primary bg-surface-raised border border-border-strong rounded-lg hover:bg-surface-base transition-colors"
 >
 <FileText className="w-4 h-4" />
 Exportar PDF
 </button>
 <button
 onClick={() => handleNavigate('/admin/compras')}
 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
 >
 <ShoppingCart className="w-4 h-4" />
 Criar compra
 </button>
 </div>
 )}
 >
 <FilterBar className="mb-4">
 <div className="min-w-[200px] flex-1">
 <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Pesquisar produto..." size="compact" />
 </div>
 <SelectFilter<AlertFilter>
 value={alertFilter}
 onChange={setAlertFilter}
 options={[
 { value: 'all', label: 'Todos os alertas' },
 { value: 'low_stock', label: 'Stock baixo' },
 { value: 'insufficient_for_week', label: 'Previsão insuficiente' },
 ]}
 size="compact"
 ariaLabel="Filtrar por tipo"
 />
 <SelectFilter<ProductTypeFilter>
 value={productTypeFilter}
 onChange={setProductTypeFilter}
 options={[
 { value: 'all', label: 'Todos' },
 { value: 'fixo', label: 'Fixos' },
 { value: 'variável', label: 'Variáveis' },
 ]}
 size="compact"
 ariaLabel="Produto fixo/variável"
 />
 <SelectFilter<MinStockBasis>
 value={minStockBasis}
 onChange={setMinStockBasis}
 options={[
 { value: 'manual', label: 'Mínimo manual' },
 { value: 'last_week_sales', label: 'Vendas semana passada' },
 { value: 'last_month_sales', label: 'Vendas mês passado' },
 { value: 'best_month_sales', label: 'Vendas melhor mês' },
 ]}
 size="compact"
 ariaLabel="Base do mínimo"
 />
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
 options={[10, 25, 50, 100, 500]}
 size="compact"
 label="Itens por página:"
 />
 </FilterBar>

 <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
 {filteredData.length === 0 ? (
 <div className="p-12 text-center text-content-muted">
 <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
 <p className="font-medium">Nenhum alerta no momento</p>
 <p className="text-sm mt-1">Quando houver produtos com stock baixo ou previsão insuficiente, aparecerão aqui.</p>
 </div>
 ) : (
 <>
 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full text-sm">
 <thead className="sticky top-0 z-10 bg-surface-base shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
 <tr className="border-b border-border-default">
 <th className="text-left py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('productName')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Produto {sortField === 'productName' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('variantName')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Variante {sortField === 'variantName' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('currentStock')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Stock Atual {sortField === 'currentStock' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('minStock')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Mín. {sortField === 'minStock' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('lastWeekSales')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Vendas Sem. Passada {sortField === 'lastWeekSales' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('suggestedPurchase')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Sugestão Compra {sortField === 'suggestedPurchase' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('unit')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Unidade {sortField === 'unit' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 <th className="text-center py-3 px-4 font-medium text-content-secondary bg-surface-base">
 <button type="button" onClick={() => handleSort('alertType')} className="inline-flex items-center gap-1 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
 Tipo Alerta {sortField === 'alertType' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 </th>
 </tr>
 </thead>
 <tbody>
 {paginatedData.map((item, idx) => {
 const rowKey = `${item.productId}__${item.variantId ?? 'no-variant'}`;
 const isSaving = savingMinRowKey === rowKey;
 const draft = minStockDrafts[rowKey] ?? `${item.minStock}`;
 return (
 <tr
 key={`${item.productId}-${item.variantId ?? 'nv'}-${idx}`}
 className="border-b border-border-default last:border-b-0 hover:bg-surface-base/50"
 >
 <td className="py-3 px-4 font-medium text-content-primary text-left">{item.productName}</td>
 <td className="py-3 px-4 text-content-secondary text-center">{item.variantName ?? '—'}</td>
 <td className="py-3 px-4 text-content-primary text-center">{item.currentStock.toLocaleString('pt-PT')}</td>
 <td className="py-3 px-4 text-content-secondary text-center">
 {minStockBasis === 'manual' ? (
 <input
 type="number"
 min="0"
 step="0.01"
 value={draft}
 disabled={isSaving}
 onChange={(e) => setMinStockDrafts(prev => ({ ...prev, [rowKey]: e.target.value }))}
 onBlur={() => { void saveMinStockInline(item); }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
 if (e.key === 'Escape') {
 setMinStockDrafts(prev => ({ ...prev, [rowKey]: `${item.minStock}` }));
 (e.currentTarget as HTMLInputElement).blur();
 }
 }}
 className="input-number-simple w-24 mx-auto px-2 py-1 rounded border border-border-strong bg-surface-raised text-center text-content-primary disabled:opacity-60"
 />
 ) : (
 item.minStock.toLocaleString('pt-PT')
 )}
 </td>
 <td className="py-3 px-4 text-content-secondary text-center">{item.lastWeekSales.toLocaleString('pt-PT')}</td>
 <td className="py-3 px-4 font-medium text-content-primary text-center">{item.suggestedPurchase.toLocaleString('pt-PT')}</td>
 <td className="py-3 px-4 text-content-muted text-center">{item.unit}</td>
 <td className="py-3 px-4 text-center">
 <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getAlertBadgeClass(item.alertType)}`}>
 {getAlertLabel(item.alertType)}
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 <Pagination
 mode="simple"
 currentPage={currentPage}
 totalItems={filteredData.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setCurrentPage}
 showRangeText
 />
 </>
 )}
 </div>
 </PageShell>
 );
};
