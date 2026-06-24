import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
 ReportCategory,
 ReportType,
 SalesReport,
 StockReport,
 CustomersReport,
 OrdersReport,
 Order,
 Sale,
 Product,
 Customer,
 StockMovement,
 Activity
} from '../../core/types/types';
import { useLanguage } from '../../core/contexts/LanguageContext';
import { dataService } from '../../core/services/dataService';
import { orderService } from '../../sales/services/orderService';
import { Toast } from '../../core/components/ui/Toast';
import {
 FileText,
 Download,
 Loader2,
 BarChart3,
 DollarSign,
 TrendingUp,
 Package,
 Users,
 ShoppingCart,
 FileSpreadsheet,
 ChevronDown
} from 'lucide-react';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { addPDFHeader, addPDFFooter } from '../../core/services/reportService';
import { PageShell } from '../components/layout/PageShell';
import { toDateStringInTimezone } from '../../core/utils/dateUtils';
import {
 BarChart,
 Bar,
 PieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
 LineChart,
 Line
} from 'recharts';

interface ReportsProps {
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
}

// Configuração de relatórios disponíveis por categoria (loja: vendas, stock, clientes, pedidos)
const reportConfig: Record<ReportCategory, { label: string; icon: any; reports: Array<{ type: ReportType; label: string }> }> = {
 [ReportCategory.SALES]: {
 label: 'Vendas',
 icon: TrendingUp,
 reports: [
 { type: 'sales_summary', label: 'Resumo de Vendas' },
 { type: 'sales_by_product', label: 'Vendas por Produto' },
 { type: 'sales_by_period', label: 'Vendas por Período' },
 { type: 'top_products', label: 'Produtos Mais Vendidos' },
 ]
 },
 [ReportCategory.STOCK]: {
 label: 'Stock',
 icon: Package,
 reports: [
 { type: 'stock_summary', label: 'Resumo de Stock' },
 { type: 'stock_movements', label: 'Movimentos de Stock' },
 { type: 'low_stock', label: 'Stock Baixo' },
 { type: 'stock_valuation', label: 'Avaliação de Stock' },
 ]
 },
 [ReportCategory.CUSTOMERS]: {
 label: 'Clientes',
 icon: Users,
 reports: [
 { type: 'customers_summary', label: 'Resumo de Clientes' },
 { type: 'loyalty_report', label: 'Relatório de Fidelização' },
 { type: 'top_customers', label: 'Top Clientes' },
 ]
 },
 [ReportCategory.ORDERS]: {
 label: 'Pedidos',
 icon: ShoppingCart,
 reports: [
 { type: 'orders_summary', label: 'Resumo de Pedidos' },
 { type: 'orders_by_status', label: 'Pedidos por Status' },
 { type: 'orders_by_period', label: 'Pedidos por Período' },
 { type: 'pending_orders', label: 'Pedidos Pendentes' },
 ]
 }
};

export const Reports: React.FC<ReportsProps> = ({ showToast }) => {
 const { t } = useLanguage();
 const [selectedCategory, setSelectedCategory] = useState<ReportCategory>(ReportCategory.SALES);
 const [selectedReport, setSelectedReport] = useState<ReportType>('sales_summary');
 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('today');
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');

 // Estados para dados
 const [orders, setOrders] = useState<Order[]>([]);
 const [sales, setSales] = useState<Sale[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
 const [activities, setActivities] = useState<Activity[]>([]);
 const [loading, setLoading] = useState(true);
 const [counts, setCounts] = useState<{ customers: number; orders: number; products: number; sales: number; purchases: number; suppliers: number } | null>(null);

 // Estados para relatórios gerados
 const [reportData, setReportData] = useState<any>(null);
 const reportRef = useRef<HTMLDivElement>(null);

 // Carregar dados iniciais
 useEffect(() => {
 loadData();
 }, []);

 // Resetar relatório quando mudar categoria ou tipo
 useEffect(() => {
 setReportData(null);
 }, [selectedCategory, selectedReport]);

 const loadData = async () => {
 setLoading(true);
 try {
 const [
 ordersData,
 salesData,
 productsData,
 customersData,
 stockMovementsData,
 activitiesData
 ] = await Promise.all([
 orderService.getOrders(),
 dataService.getSales(),
 dataService.getProducts(),
 dataService.getCustomers(),
 dataService.getStockMovements(),
 dataService.getActivities()
 ]);
 setOrders(ordersData);
 setSales(salesData);
 setProducts(productsData);
 setCustomers(customersData);
 setStockMovements(stockMovementsData);
 setActivities(activitiesData);
 } catch (error) {
 console.error('Erro ao carregar dados:', error);
 showToast('Erro ao carregar dados', 'error');
 } finally {
 setLoading(false);
 }
 };

 // Helper para normalizar datas
 const normalizeDateStart = (date: Date): Date => {
 const normalized = new Date(date);
 normalized.setHours(0, 0, 0, 0);
 return normalized;
 };

 const normalizeDateEnd = (date: Date): Date => {
 const normalized = new Date(date);
 normalized.setHours(23, 59, 59, 999);
 return normalized;
 };

 // Obter intervalo de datas
 const getDateRange = (): { start: Date; end: Date } => {
 const today = new Date();
 let start = new Date();
 let end = new Date();

 switch (selectedPeriod) {
 case 'today':
 start = normalizeDateStart(today);
 end = normalizeDateEnd(today);
 break;
 case 'last7days':
 start = new Date(today);
 start.setDate(today.getDate() - 6);
 start = normalizeDateStart(start);
 end = normalizeDateEnd(today);
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
 const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
 end = normalizeDateEnd(lastDayOfMonth);
 break;
 case 'lastMonth':
 start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
 start = normalizeDateStart(start);
 const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
 end = normalizeDateEnd(lastDay);
 break;
 case 'thisYear':
 start = new Date(today.getFullYear(), 0, 1);
 start = normalizeDateStart(start);
 const lastDayOfYear = new Date(today.getFullYear(), 11, 31);
 end = normalizeDateEnd(lastDayOfYear);
 break;
 case 'custom':
 if (customStartDate && customEndDate) {
 start = normalizeDateStart(new Date(customStartDate));
 end = normalizeDateEnd(new Date(customEndDate));
 } else {
 start = normalizeDateStart(today);
 end = normalizeDateEnd(today);
 }
 break;
 }

 return { start, end };
 };

 // Filtrar dados por período
 const filteredData = useMemo(() => {
 const { start, end } = getDateRange();
 return {
 orders: orders.filter(order => {
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 return orderDate >= start && orderDate <= end;
 }),
 sales: sales.filter(sale => {
 const saleDate = normalizeDateStart(new Date((sale as any).date || sale.createdAt));
 return saleDate >= start && saleDate <= end;
 }),
 stockMovements: stockMovements.filter(movement => {
 const movementDate = normalizeDateStart(new Date(movement.date));
 return movementDate >= start && movementDate <= end;
 }),
 activities: activities.filter(activity => {
 const activityDate = normalizeDateStart(new Date(activity.createdAt));
 return activityDate >= start && activityDate <= end;
 }),
 };
 }, [orders, sales, stockMovements, activities, selectedPeriod, customStartDate, customEndDate]);

 // Funções de cálculo de relatórios de vendas
 const calculateSalesReport = (): SalesReport => {
 const { orders, sales } = filteredData;
 const totalSales = orders
 .filter(o => o.paymentStatus === 'paid')
 .reduce((sum, o) => sum + (o.amountPaid || o.totalAmount), 0) +
 sales.reduce((sum, s) => sum + s.totalSales, 0);
 const totalOrders = orders.length;
 const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

 // Vendas por produto
 const productSales: Record<string, { quantity: number; totalValue: number }> = {};
 orders.forEach(order => {
 order.items.forEach(item => {
 if (!productSales[item.productName]) {
 productSales[item.productName] = { quantity: 0, totalValue: 0 };
 }
 productSales[item.productName].quantity += item.quantity;
 productSales[item.productName].totalValue += item.priceAtTime * item.quantity;
 });
 });

 const salesByProduct = Object.entries(productSales).map(([productName, data]) => ({
 productName,
 quantity: data.quantity,
 totalValue: data.totalValue
 }));

 // Top produtos
 const topProducts = salesByProduct
 .sort((a, b) => b.totalValue - a.totalValue)
 .slice(0, 10)
 .map(product => ({
 ...product,
 percentage: totalSales > 0 ? (product.totalValue / totalSales) * 100 : 0
 }));

 return {
 totalSales,
 totalOrders,
 averageOrderValue,
 salesByProduct,
 salesByPeriod: [],
 topProducts
 };
 };

 // Funçéµes de cé¡lculo de relaté³rios de stock
 const calculateStockReport = (): StockReport => {
 const lowStockItems = products
 .filter(p => p.minStock && p.stock < p.minStock)
 .map(p => ({
 productName: p.name,
 currentStock: p.stock,
 minStock: p.minStock || 0,
 unit: p.unit
 }));

 const movements = filteredData.stockMovements.flatMap(movement => {
 const isEntry = movement.source === 'purchase' || movement.source === 'return' ||
 (movement.notes || '').toLowerCase().includes('entrada') || (movement.notes || '').toLowerCase().includes('compra');
 const type = isEntry ? 'entry' as const : 'exit' as const;
 return movement.items.map(item => ({
 date: movement.date,
 type,
 productName: item.productName,
 quantity: item.quantity
 }));
 });

 const totalCost = products.reduce((sum, p) => sum + ((p.costPrice || 0) * p.stock), 0);
 const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
 const profitMargin = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

 return {
 totalProducts: counts?.products ?? products.length,
 totalValue,
 lowStockItems,
 movements,
 valuation: { totalCost, totalValue, profitMargin }
 };
 };

 // Funções de cálculo de relatórios de clientes
 const calculateCustomersReport = (): CustomersReport => {
 const { orders } = filteredData;
 const newCustomers = customers.filter(c => {
 const customerDate = normalizeDateStart(new Date(c.lastOrderDate));
 const { start } = getDateRange();
 return customerDate >= start;
 }).length;

 const activeCustomers = new Set(orders.map(o => o.customerId)).size;

 const customersByTier: Record<string, { count: number; totalSpent: number }> = {};
 customers.forEach(customer => {
 const tier = customer.tier;
 if (!customersByTier[tier]) {
 customersByTier[tier] = { count: 0, totalSpent: 0 };
 }
 customersByTier[tier].count++;
 customersByTier[tier].totalSpent += customer.totalSpent;
 });

 const topCustomers = customers
 .sort((a, b) => b.totalSpent - a.totalSpent)
 .slice(0, 10)
 .map(c => ({
 customerName: c.name,
 totalOrders: c.totalOrders,
 totalSpent: c.totalSpent,
 lastOrderDate: c.lastOrderDate
 }));

 const totalPoints = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);

 return {
 totalCustomers: counts?.customers ?? customers.length,
 newCustomers,
 activeCustomers,
 customersByTier: Object.entries(customersByTier).map(([tier, data]) => ({
 tier,
 ...data
 })),
 topCustomers,
 loyaltyStats: {
 totalPoints,
 pointsRedeemed: 0,
 activeMembers: customers.filter(c => (c.loyaltyPoints || 0) > 0).length
 }
 };
 };

 // Funçéµes de cé¡lculo de relaté³rios de pedidos
 const calculateOrdersReport = (): OrdersReport => {
 const { orders } = filteredData;
 const ordersByStatus: Record<string, { count: number; totalValue: number }> = {};
 orders.forEach(order => {
 const status = order.status;
 if (!ordersByStatus[status]) {
 ordersByStatus[status] = { count: 0, totalValue: 0 };
 }
 ordersByStatus[status].count++;
 ordersByStatus[status].totalValue += order.totalAmount;
 });

 const pendingOrders = orders
 .filter(o => o.status === 'Pendente' || o.status === 'Em Preparaçéo')
 .map(order => {
 const orderDate = new Date(order.createdAt);
 const today = new Date();
 const daysPending = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
 return {
 orderId: order.id,
 customerName: order.customerName,
 totalAmount: order.totalAmount,
 createdAt: order.createdAt,
 daysPending
 };
 })
 .sort((a, b) => b.daysPending - a.daysPending);

 return {
 totalOrders: orders.length,
 ordersByStatus: Object.entries(ordersByStatus).map(([status, data]) => ({
 status,
 ...data
 })),
 ordersByPeriod: [],
 pendingOrders,
 averageProcessingTime: 0
 };
 };

 // Gerar relaté³rio baseado na categoria e tipo selecionados
 const generateReport = () => {
 try {
 let data: any = null;

 switch (selectedCategory) {
 case ReportCategory.SALES:
 data = calculateSalesReport();
 break;
 case ReportCategory.STOCK:
 data = calculateStockReport();
 break;
 case ReportCategory.CUSTOMERS:
 data = calculateCustomersReport();
 break;
 case ReportCategory.ORDERS:
 data = calculateOrdersReport();
 break;
 }

 setReportData(data);
 showToast('Relaté³rio gerado com sucesso', 'success');
 } catch (error) {
 console.error('Erro ao gerar relaté³rio:', error);
 showToast('Erro ao gerar relaté³rio', 'error');
 }
 };

 // Exportar relaté³rio em PDF
 const exportReport = async () => {
 if (!reportData) {
 showToast('Gere o relaté³rio primeiro', 'warning');
 return;
 }

 if (!reportRef.current) {
 showToast('Erro ao exportar relaté³rio', 'error');
 return;
 }

 try {
 showToast('Gerando PDF...', 'info');

 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
 const categoryLabel = reportConfig[selectedCategory]?.label || selectedCategory;
 const reportLabel = reportConfig[selectedCategory]?.reports.find(r => r.type === selectedReport)?.label || selectedReport;

 const filename = `relatorio_${categoryLabel.toLowerCase().replace(/\s+/g, '_')}_${reportLabel.toLowerCase().replace(/\s+/g, '_')}_${startStr}_${endStr}.pdf`;

 // Capturar o elemento do relaté³rio
 const element = reportRef.current;
 const canvas = await html2canvas(element, {
 scale: 2,
 useCORS: true,
 logging: false,
 backgroundColor: '#ffffff',
 windowWidth: element.scrollWidth,
 windowHeight: element.scrollHeight,
 allowTaint: true
 });

 const imgData = canvas.toDataURL('image/png');
 const pdf = new jsPDF('p', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();

 // Dimenséµes da imagem em pixels
 const imgWidth = canvas.width;
 const imgHeight = canvas.height;

 // Calcular dimenséµes para caber na pé¡gina com margens
 const margin = 15;
 const headerHeight = 35;
 const maxWidth = pdfWidth - (margin * 2);
 const maxHeight = pdfHeight - headerHeight - margin;

 // Calcular proporçéo para caber na pé¡gina
 const widthRatio = maxWidth / imgWidth;
 const heightRatio = maxHeight / imgHeight;
 const ratio = Math.min(widthRatio, heightRatio);

 const imgScaledWidth = imgWidth * ratio;
 const imgScaledHeight = imgHeight * ratio;

 // Adicionar cabeçalho com branding
 const periodLabel = `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const startY = await addPDFHeader(pdf, `${categoryLabel} - ${reportLabel}`, {
 period: periodLabel,
 filters: [],
 orientation: 'portrait',
 });
 let heightLeft = imgScaledHeight;
 let position = startY;

 // Primeira pé¡gina
 pdf.addImage(imgData, 'PNG', margin, position, imgScaledWidth, imgScaledHeight);
 heightLeft -= (pdfHeight - position - margin);

 // Adicionar pé¡ginas adicionais se necessé¡rio
 while (heightLeft > 0) {
 position = margin - (imgScaledHeight - heightLeft);
 pdf.addPage();
 pdf.addImage(imgData, 'PNG', margin, position, imgScaledWidth, imgScaledHeight);
 heightLeft -= (pdfHeight - margin * 2);
 }

 // Adicionar rodapé© em todas as pé¡ginas
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Salvar PDF
 pdf.save(filename);

 showToast('Relaté³rio exportado em PDF com sucesso', 'success');
 } catch (error) {
 console.error('Erro ao exportar PDF:', error);
 showToast('Erro ao exportar relaté³rio em PDF', 'error');
 }
 };

 const formatCurrency = (value: number) => {
 return new Intl.NumberFormat('pt-MZ', {
 style: 'currency',
 currency: 'MZN'
 }).format(value);
 };

 // Obter opçéµes de relaté³rios para a categoria selecionada
 const availableReports = reportConfig[selectedCategory]?.reports || [];

 if (loading) {
 return (
 <div className="h-full flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
 </div>
 );
 }

 return (
 <PageShell title={t.reports.title} description="Gere e visualize relatórios detalhados do sistema" compactHeaderMobile>
 {/* Filtros */}
 <div className="bg-surface-raised rounded-xl border border-border-default shadow-sm p-5 space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 {t.reports.selectCategory}
 </label>
 <select
 value={selectedCategory}
 onChange={(e) => {
 setSelectedCategory(e.target.value as ReportCategory);
 const firstReport = reportConfig[e.target.value as ReportCategory]?.reports[0]?.type;
 if (firstReport) setSelectedReport(firstReport);
 }}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 >
 {Object.entries(reportConfig).map(([key, config]) => (
 <option key={key} value={key}>{config.label}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 {t.reports.selectReport}
 </label>
 <select
 value={selectedReport}
 onChange={(e) => setSelectedReport(e.target.value as ReportType)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 >
 {availableReports.map((report) => (
 <option key={report.type} value={report.type}>{report.label}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 {t.reports.period}
 </label>
 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={setSelectedPeriod}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 }}
 />
 </div>
 </div>

 <div className="flex gap-3">
 <button
 onClick={generateReport}
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
 >
 <FileText className="w-4 h-4" />
 {t.reports.generateReport}
 </button>
 <button
 onClick={exportReport}
 disabled={!reportData}
 className="flex items-center gap-2 px-4 py-2 border border-border-default text-content-secondary rounded-lg hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
 >
 <Download className="w-4 h-4" />
 {t.reports.exportReport}
 </button>
 </div>
 </div>

 {reportData && (
 <div ref={reportRef} className="bg-surface-raised rounded-xl border border-border-default shadow-sm p-5">
 <ReportRenderer
 category={selectedCategory}
 reportType={selectedReport}
 data={reportData}
 formatCurrency={formatCurrency}
 />
 </div>
 )}
 </PageShell>
 );
};

// Componente para renderizar diferentes tipos de relaté³rios
interface ReportRendererProps {
 category: ReportCategory;
 reportType: ReportType;
 data: any;
 formatCurrency: (value: number) => string;
}

const ReportRenderer: React.FC<ReportRendererProps> = ({ category, reportType, data, formatCurrency }) => {
 const { t } = useLanguage();

 switch (category) {
 case ReportCategory.SALES:
 return <SalesReportRenderer data={data} formatCurrency={formatCurrency} />;
 case ReportCategory.STOCK:
 return <StockReportRenderer data={data} formatCurrency={formatCurrency} />;
 case ReportCategory.CUSTOMERS:
 return <CustomersReportRenderer data={data} formatCurrency={formatCurrency} />;
 case ReportCategory.ORDERS:
 return <OrdersReportRenderer data={data} formatCurrency={formatCurrency} />;
 default:
 return <div className="text-content-muted">Tipo de relatório não suportado</div>;
 }
};

const SalesReportRenderer: React.FC<{ data: SalesReport; formatCurrency: (value: number) => string }> = ({ data, formatCurrency }) => {
 const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

 const chartData = data.topProducts.slice(0, 10).map((product, index) => ({
 name: product.productName.length > 20 ? product.productName.substring(0, 20) + '...' : product.productName,
 fullName: product.productName,
 value: product.totalValue,
 quantity: product.quantity,
 percentage: product.percentage
 }));

 const pieData = data.topProducts.slice(0, 8).map((product) => ({
 name: product.productName.length > 15 ? product.productName.substring(0, 15) + '...' : product.productName,
 value: product.totalValue,
 percentage: product.percentage
 }));

 return (
 <div className="space-y-6">
 <h2 className="text-2xl font-bold text-content-primary mb-6 flex items-center gap-2">
 <TrendingUp className="w-7 h-7 text-brand-500" />
 Relaté³rio de Vendas
 </h2>

 {/* Cards de Mé©tricas */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Vendas</p>
 <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(data.totalSales)}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-green-700 dark:text-green-300">Total de Pedidos</p>
 <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <p className="text-3xl font-bold text-green-700 dark:text-green-300">{data.totalOrders}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Valor Médio por Pedido</p>
 <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(data.averageOrderValue)}</p>
 </div>
 </div>

 {/* Gré¡ficos */}
 {data.topProducts.length > 0 && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Gré¡fico de Barras - Top Produtos */}
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Top Produtos por Valor</h3>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis
 dataKey="name"
 angle={-45}
 textAnchor="end"
 height={100}
 tick={{ fill: '#9CA3AF', fontSize: 11 }}
 />
 <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 formatter={(value: number) => formatCurrency(value)}
 />
 <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>

 {/* Gré¡fico de Pizza - Distribuiçéo */}
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Distribuiçéo de Vendas</h3>
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={pieData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
 outerRadius={100}
 fill="#8884d8"
 dataKey="value"
 >
 {pieData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 formatter={(value: number) => formatCurrency(value)}
 />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}

 {/* Tabela Melhorada */}
 {data.topProducts.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Produtos Mais Vendidos</h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base/50">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">#</th>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Produto</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Quantidade</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Valor Total</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">%</th>
 <th className="w-32 py-4 px-6 text-sm font-semibold text-content-primary">Distribuiçéo</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {data.topProducts.map((product, index) => (
 <tr key={index} className="hover:bg-surface-base/50 transition-colors">
 <td className="py-4 px-6 text-sm font-medium text-content-muted">{index + 1}</td>
 <td className="py-4 px-6 text-sm font-medium text-content-primary">{product.productName}</td>
 <td className="py-4 px-6 text-sm text-right text-content-secondary">{product.quantity.toFixed(2)}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-content-primary">{formatCurrency(product.totalValue)}</td>
 <td className="py-4 px-6 text-sm text-right text-content-secondary">{product.percentage.toFixed(1)}%</td>
 <td className="py-4 px-6">
 <div className="w-full bg-surface-base rounded-full h-2">
 <div
 className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
 style={{ width: `${product.percentage}%` }}
 />
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
};

const StockReportRenderer: React.FC<{ data: StockReport; formatCurrency: (value: number) => string }> = ({ data, formatCurrency }) => {
 const stockStatusData = [
 { name: 'Stock Baixo', value: data.lowStockItems.length, color: '#ef4444' },
 { name: 'Stock Normal', value: Math.max(0, data.totalProducts - data.lowStockItems.length), color: '#10b981' }
 ];

 const lowStockChartData = data.lowStockItems.slice(0, 10).map((item) => ({
 name: item.productName.length > 20 ? item.productName.substring(0, 20) + '...' : item.productName,
 stock: item.currentStock,
 minStock: item.minStock,
 deficit: Math.max(0, item.minStock - item.currentStock)
 }));

 return (
 <div className="space-y-6">
 <h2 className="text-2xl font-bold text-content-primary mb-6 flex items-center gap-2">
 <Package className="w-7 h-7 text-brand-500" />
 Relaté³rio de Stock
 </h2>

 {/* Cards de Mé©tricas */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Produtos</p>
 <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{data.totalProducts}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-green-700 dark:text-green-300">Valor Total do Stock</p>
 <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <p className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(data.totalValue)}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Margem de Lucro</p>
 <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{data.valuation.profitMargin.toFixed(1)}%</p>
 </div>
 </div>

 {/* Gré¡ficos */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Gré¡fico de Status do Stock */}
 {stockStatusData.some(item => item.value > 0) && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Status do Stock</h3>
 <ResponsiveContainer width="100%" height={250}>
 <PieChart>
 <Pie
 data={stockStatusData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={({ name, value }) => `${name}: ${value}`}
 outerRadius={80}
 fill="#8884d8"
 dataKey="value"
 >
 {stockStatusData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Gré¡fico de Stock Baixo */}
 {lowStockChartData.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Produtos com Stock Baixo</h3>
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={lowStockChartData} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
 <YAxis
 dataKey="name"
 type="category"
 width={120}
 tick={{ fill: '#9CA3AF', fontSize: 11 }}
 />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 />
 <Bar dataKey="stock" fill="#10b981" name="Stock Atual" radius={[0, 8, 8, 0]} />
 <Bar dataKey="minStock" fill="#f59e0b" name="Stock Mé­nimo" radius={[0, 8, 8, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>

 {/* Tabela de Stock Baixo Melhorada */}
 {data.lowStockItems.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default bg-red-50 dark:bg-red-900/20">
 <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
 Produtos com Stock Baixo ({data.lowStockItems.length})
 </h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base/50">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Produto</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Stock Atual</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Stock Mé­nimo</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Dé©fice</th>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Unidade</th>
 <th className="w-40 py-4 px-6 text-sm font-semibold text-content-primary">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {data.lowStockItems.map((item, index) => {
 const deficit = Math.max(0, item.minStock - item.currentStock);
 const percentage = item.minStock > 0 ? (item.currentStock / item.minStock) * 100 : 0;
 return (
 <tr key={index} className="hover:bg-surface-base/50 transition-colors">
 <td className="py-4 px-6 text-sm font-medium text-content-primary">{item.productName}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-red-600 dark:text-red-400">{item.currentStock}</td>
 <td className="py-4 px-6 text-sm text-right text-content-secondary">{item.minStock}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-orange-600 dark:text-orange-400">{deficit}</td>
 <td className="py-4 px-6 text-sm text-content-secondary">{item.unit}</td>
 <td className="py-4 px-6">
 <div className="flex items-center gap-2">
 <div className="w-full bg-surface-base rounded-full h-2">
 <div
 className={`h-2 rounded-full transition-all ${percentage >= 100 ? 'bg-green-500' :
 percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
 }`}
 style={{ width: `${Math.min(100, percentage)}%` }}
 />
 </div>
 <span className="text-xs text-content-muted">{percentage.toFixed(0)}%</span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
};

const CustomersReportRenderer: React.FC<{ data: CustomersReport; formatCurrency: (value: number) => string }> = ({ data, formatCurrency }) => {
 const topCustomersChartData = data.topCustomers.slice(0, 10).map((customer) => ({
 name: customer.customerName.length > 15 ? customer.customerName.substring(0, 15) + '...' : customer.customerName,
 fullName: customer.customerName,
 value: customer.totalSpent,
 orders: customer.totalOrders
 }));

 const tierChartData = data.customersByTier.map((tier) => ({
 name: tier.tier || 'Sem Tier',
 value: tier.count,
 totalSpent: tier.totalSpent
 }));

 return (
 <div className="space-y-6">
 <h2 className="text-2xl font-bold text-content-primary mb-6 flex items-center gap-2">
 <Users className="w-7 h-7 text-brand-500" />
 Relaté³rio de Clientes
 </h2>

 {/* Cards de Mé©tricas */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Clientes</p>
 <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{data.totalCustomers}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-green-700 dark:text-green-300">Novos Clientes</p>
 <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <p className="text-3xl font-bold text-green-700 dark:text-green-300">{data.newCustomers}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Clientes Ativos</p>
 <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{data.activeCustomers}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 rounded-xl shadow-sm border border-orange-200 dark:border-orange-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Pontos de Fidelizaçéo</p>
 <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
 </div>
 <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{data.loyaltyStats.totalPoints.toLocaleString('pt-PT')}</p>
 </div>
 </div>

 {/* Gré¡ficos */}
 {topCustomersChartData.length > 0 && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Top Clientes por Valor</h3>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={topCustomersChartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis
 dataKey="name"
 angle={-45}
 textAnchor="end"
 height={100}
 tick={{ fill: '#9CA3AF', fontSize: 11 }}
 />
 <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 formatter={(value: number) => formatCurrency(value)}
 />
 <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>

 {tierChartData.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Clientes por Tier</h3>
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={tierChartData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={({ name, value }) => `${name}: ${value}`}
 outerRadius={100}
 fill="#8884d8"
 dataKey="value"
 >
 {tierChartData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'][index % 4]} />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 )}

 {/* Tabela de Top Clientes */}
 {data.topCustomers.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Top Clientes</h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base/50">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">#</th>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Cliente</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Pedidos</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Total Gasto</th>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">éšltimo Pedido</th>
 <th className="w-32 py-4 px-6 text-sm font-semibold text-content-primary">Ranking</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {data.topCustomers.map((customer, index) => {
 const maxValue = data.topCustomers[0]?.totalSpent || 1;
 const percentage = (customer.totalSpent / maxValue) * 100;
 return (
 <tr key={index} className="hover:bg-surface-base/50 transition-colors">
 <td className="py-4 px-6">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
 index === 1 ? 'bg-surface-base text-content-secondary' :
 index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
 'bg-surface-base text-content-secondary'
 }`}>
 {index + 1}
 </div>
 </td>
 <td className="py-4 px-6 text-sm font-medium text-content-primary">{customer.customerName}</td>
 <td className="py-4 px-6 text-sm text-right text-content-secondary">{customer.totalOrders}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-content-primary">{formatCurrency(customer.totalSpent)}</td>
 <td className="py-4 px-6 text-sm text-content-secondary">{new Date(customer.lastOrderDate).toLocaleDateString('pt-PT')}</td>
 <td className="py-4 px-6">
 <div className="w-full bg-surface-base rounded-full h-2">
 <div
 className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
 style={{ width: `${percentage}%` }}
 />
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
};

const OrdersReportRenderer: React.FC<{ data: OrdersReport; formatCurrency: (value: number) => string }> = ({ data, formatCurrency }) => {
 const statusColors: Record<string, string> = {
 'Pendente': '#ef4444',
 'Em Preparaçéo': '#f59e0b',
 'Pronto': '#10b981',
 'Entregue': '#3b82f6',
 'Cancelado': '#6b7280'
 };

 const statusChartData = data.ordersByStatus.map((item) => ({
 name: item.status,
 value: item.count,
 totalValue: item.totalValue,
 color: statusColors[item.status] || '#6b7280'
 }));

 return (
 <div className="space-y-6">
 <h2 className="text-2xl font-bold text-content-primary mb-6 flex items-center gap-2">
 <ShoppingCart className="w-7 h-7 text-brand-500" />
 Relaté³rio de Pedidos
 </h2>

 {/* Cards de Mé©tricas */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Pedidos</p>
 <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{data.totalOrders}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-xl shadow-sm border border-red-200 dark:border-red-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-red-700 dark:text-red-300">Pedidos Pendentes</p>
 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
 </div>
 <p className="text-3xl font-bold text-red-700 dark:text-red-300">{data.pendingOrders.length}</p>
 </div>
 </div>

 {/* Gré¡fico de Status */}
 {statusChartData.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Pedidos por Status</h3>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={statusChartData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={({ name, value }) => `${name}: ${value}`}
 outerRadius={100}
 fill="#8884d8"
 dataKey="value"
 >
 {statusChartData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={statusChartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
 <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 formatter={(value: number) => [value, 'Pedidos']}
 />
 <Bar dataKey="value" radius={[8, 8, 0, 0]}>
 {statusChartData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}

 {/* Tabela de Status */}
 {data.ordersByStatus.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Distribuiçéo por Status</h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base/50">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Status</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Quantidade</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Valor Total</th>
 <th className="w-40 py-4 px-6 text-sm font-semibold text-content-primary">Percentual</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {data.ordersByStatus.map((item, index) => {
 const percentage = data.totalOrders > 0 ? (item.count / data.totalOrders) * 100 : 0;
 return (
 <tr key={index} className="hover:bg-surface-base/50 transition-colors">
 <td className="py-4 px-6">
 <div className="flex items-center gap-2">
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: statusColors[item.status] || '#6b7280' }}
 />
 <span className="text-sm font-medium text-content-primary">{item.status}</span>
 </div>
 </td>
 <td className="py-4 px-6 text-sm text-right text-content-secondary">{item.count}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-content-primary">{formatCurrency(item.totalValue)}</td>
 <td className="py-4 px-6">
 <div className="flex items-center gap-2">
 <div className="w-full bg-surface-base rounded-full h-2">
 <div
 className="h-2 rounded-full transition-all"
 style={{
 width: `${percentage}%`,
 backgroundColor: statusColors[item.status] || '#6b7280'
 }}
 />
 </div>
 <span className="text-xs text-content-muted w-12 text-right">{percentage.toFixed(1)}%</span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Tabela de Pedidos Pendentes */}
 {data.pendingOrders.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-red-200 dark:border-red-800 overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default bg-red-50 dark:bg-red-900/20">
 <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
 Pedidos Pendentes ({data.pendingOrders.length})
 </h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base/50">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Cliente</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Valor</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Dias Pendentes</th>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Data</th>
 <th className="w-32 py-4 px-6 text-sm font-semibold text-content-primary">Urgéªncia</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {data.pendingOrders.map((order, index) => {
 const urgencyColor = order.daysPending > 7 ? 'bg-red-500' : order.daysPending > 3 ? 'bg-yellow-500' : 'bg-green-500';
 return (
 <tr key={index} className="hover:bg-surface-base/50 transition-colors">
 <td className="py-4 px-6 text-sm font-medium text-content-primary">{order.customerName}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-content-primary">{formatCurrency(order.totalAmount)}</td>
 <td className="py-4 px-6 text-sm text-right font-semibold text-red-600 dark:text-red-400">{order.daysPending} dias</td>
 <td className="py-4 px-6 text-sm text-content-secondary">{new Date(order.createdAt).toLocaleDateString('pt-PT')}</td>
 <td className="py-4 px-6">
 <div className={`w-full ${urgencyColor} rounded-full h-2`} style={{ opacity: Math.min(1, order.daysPending / 10) }} />
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
};


