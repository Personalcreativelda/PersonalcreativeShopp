import React, { useState, useMemo, useRef } from 'react';
import { Sale, Order, SalesReport } from '../../../core/types/types';
import { 
 TrendingUp, 
 ShoppingCart, 
 DollarSign, 
 Download, 
 FileText,
 BarChart,
 PieChart as PieChartIcon
} from 'lucide-react';
import { PeriodFilter, PeriodOption } from '../forms/PeriodFilter';
import { 
 BarChart as RechartsBarChart, 
 Bar, 
 PieChart, 
 Pie, 
 Cell, 
 XAxis, 
 YAxis, 
 CartesianGrid, 
 Tooltip, 
 Legend, 
 ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { addPDFHeader, addPDFFooter } from '../../../core/services/reportService';
import { toDateStringInTimezone } from '../../../core/utils/dateUtils';

interface SalesReportsProps {
 sales: Sale[];
 orders: Order[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

export const SalesReports: React.FC<SalesReportsProps> = ({ sales, orders, showToast }) => {
 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('today');
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');
 const [reportData, setReportData] = useState<SalesReport | null>(null);
 const reportRef = useRef<HTMLDivElement>(null);

 const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

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

 const filteredData = useMemo(() => {
 const { start, end } = getDateRange();
 
 return {
 orders: orders.filter(order => {
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 return orderDate >= start && orderDate <= end;
 }),
 sales: sales.filter(sale => {
 const saleDate = normalizeDateStart(new Date(sale.date));
 return saleDate >= start && saleDate <= end;
 })
 };
 }, [orders, sales, selectedPeriod, customStartDate, customEndDate]);

 const calculateSalesReport = (): SalesReport => {
 const { orders, sales } = filteredData;
 
 // Calcular total de vendas baseado em TODOS os pedidos do período
 // Não filtrar por paymentStatus - considerar todos os pedidos para o relatório de vendas
 const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
 
 const totalOrders = orders.length;
 const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

 // Calcular vendas por produto baseado em TODOS os pedidos do período
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

 const generateReport = () => {
 try {
 const data = calculateSalesReport();
 setReportData(data);
 showToast('Relatório gerado com sucesso', 'success');
 } catch (error) {
 console.error('Erro ao gerar relatório:', error);
 showToast('Erro ao gerar relatório', 'error');
 }
 };

 const exportReport = async () => {
 if (!reportData || !reportRef.current) {
 showToast('Gere o relatório primeiro', 'warning');
 return;
 }

 try {
 showToast('Gerando PDF...', 'info');
 
 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
 const filename = `relatorio_vendas_${startStr}_${endStr}.pdf`;

 const element = reportRef.current;
 const canvas = await html2canvas(element, {
 scale: 2,
 useCORS: true,
 logging: false,
 backgroundColor: '#ffffff',
 allowTaint: true
 });

 const imgData = canvas.toDataURL('image/png');
 const pdf = new jsPDF('p', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 
 const imgWidth = canvas.width;
 const imgHeight = canvas.height;
 const margin = 15;
 const headerHeight = 35;
 const maxWidth = pdfWidth - (margin * 2);
 const maxHeight = pdfHeight - headerHeight - margin;
 
 const widthRatio = maxWidth / imgWidth;
 const heightRatio = maxHeight / imgHeight;
 const ratio = Math.min(widthRatio, heightRatio);
 
 const imgScaledWidth = imgWidth * ratio;
 const imgScaledHeight = imgHeight * ratio;

 // Adicionar cabeçalho com branding
 const periodLabel = `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;
 const startY = await addPDFHeader(pdf, 'Relatório de Vendas', {
 period: periodLabel,
 orientation: 'portrait',
 });
 let heightLeft = imgScaledHeight;
 let position = startY;

 pdf.addImage(imgData, 'PNG', margin, position, imgScaledWidth, imgScaledHeight);
 heightLeft -= (pdfHeight - position - margin);

 while (heightLeft > 0) {
 position = margin - (imgScaledHeight - heightLeft);
 pdf.addPage();
 pdf.addImage(imgData, 'PNG', margin, position, imgScaledWidth, imgScaledHeight);
 heightLeft -= (pdfHeight - margin * 2);
 }

 // Adicionar rodapé em todas as páginas
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 pdf.save(filename);
 showToast('Relatório exportado em PDF com sucesso', 'success');
 } catch (error) {
 console.error('Erro ao exportar PDF:', error);
 showToast('Erro ao exportar relatório em PDF', 'error');
 }
 };

 const formatCurrency = (value: number) => {
 return new Intl.NumberFormat('pt-MZ', {
 style: 'currency',
 currency: 'MZN'
 }).format(value);
 };

 const chartData = reportData?.topProducts.slice(0, 10).map((product) => ({
 name: product.productName.length > 20 ? product.productName.substring(0, 20) + '...' : product.productName,
 value: product.totalValue,
 quantity: product.quantity,
 percentage: product.percentage
 })) || [];

 const pieData = reportData?.topProducts.slice(0, 8).map((product) => ({
 name: product.productName.length > 15 ? product.productName.substring(0, 15) + '...' : product.productName,
 value: product.totalValue,
 percentage: product.percentage
 })) || [];

 return (
 <div className="space-y-6">
 <div className="bg-surface-raised rounded-lg shadow p-6 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-bold text-content-primary flex items-center gap-2">
 <BarChart className="w-6 h-6 text-brand-500" />
 Relatórios de Vendas
 </h2>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Período
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
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
 >
 <FileText className="w-4 h-4" />
 Gerar Relatório
 </button>
 <button
 onClick={exportReport}
 disabled={!reportData}
 className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Download className="w-4 h-4" />
 Exportar PDF
 </button>
 </div>
 </div>

 {reportData && (
 <div ref={reportRef} className="bg-surface-raised rounded-lg shadow p-6 space-y-6">
 <h2 className="text-2xl font-bold text-content-primary mb-6 flex items-center gap-2">
 <TrendingUp className="w-7 h-7 text-brand-500" />
 Relatório de Vendas
 </h2>
 
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Vendas</p>
 <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(reportData.totalSales)}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-green-700 dark:text-green-300">Total de Pedidos</p>
 <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <p className="text-3xl font-bold text-green-700 dark:text-green-300">{reportData.totalOrders}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Valor Médio por Pedido</p>
 <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(reportData.averageOrderValue)}</p>
 </div>
 </div>

 {reportData.topProducts.length > 0 && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-6">
 <h3 className="text-lg font-semibold text-content-primary mb-4">Top Produtos por Valor</h3>
 <ResponsiveContainer width="100%" height={300}>
 <RechartsBarChart data={chartData}>
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
 </RechartsBarChart>
 </ResponsiveContainer>
 </div>

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

 {reportData.topProducts.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Produtos Mais Vendidos</h3>
 </div>
 <div className="overflow-auto max-h-[400px]">
 <table className="w-full">
 <thead className="bg-surface-base/50 sticky top-0 z-10">
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
 {reportData.topProducts.map((product, index) => (
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
 )}
 </div>
 );
};


