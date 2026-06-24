import React, { useState, useMemo, useRef } from 'react';
import { Product, StockReport, StockMovement } from '../../../core/types/types';
import {
 Package,
 Download,
 FileText,
 BarChart3,
 DollarSign,
 TrendingUp
} from 'lucide-react';
import { PeriodFilter, PeriodOption } from '../forms/PeriodFilter';
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
 ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useStockMovements } from '../../../core/hooks/useStockMovements';
import { addPDFHeader, addPDFFooter } from '../../../core/services/reportService';
import { toDateStringInTimezone } from '../../../core/utils/dateUtils';

interface StockReportsProps {
 products: Product[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

export const StockReports: React.FC<StockReportsProps> = ({ products, showToast }) => {
 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('today');
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');
 const [reportData, setReportData] = useState<StockReport | null>(null);
 const reportRef = useRef<HTMLDivElement>(null);

 // Hook do mé³dulo stock
 const { movements: stockMovements, getStockMovements, loading } = useStockMovements();

 React.useEffect(() => {
 loadStockMovements();
 }, [getStockMovements]);

 const loadStockMovements = async () => {
 try {
 await getStockMovements();
 } catch (error) {
 console.error('Erro ao carregar movimentos de stock:', error);
 }
 };

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
 stockMovements: stockMovements.filter(movement => {
 const movementDate = normalizeDateStart(new Date(movement.date));
 return movementDate >= start && movementDate <= end;
 })
 };
 }, [stockMovements, selectedPeriod, customStartDate, customEndDate]);

 const calculateStockReport = (): StockReport => {
 const lowStockItems = products
 .filter(p => p.minStock && p.stock < p.minStock)
 .map(p => ({
 productName: p.name,
 currentStock: p.stock,
 minStock: p.minStock || 0,
 unit: p.unit
 }));

 const movements = filteredData.stockMovements.flatMap(movement =>
 movement.items.map(item => ({
 date: movement.date,
 type: movement.category === 'Entrada' ? 'entry' as const : 'exit' as const,
 productName: item.productName,
 quantity: item.quantity
 }))
 );

 const totalCost = products.reduce((sum, p) => sum + ((p.costPrice || 0) * p.stock), 0);
 const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
 const profitMargin = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

 return {
 totalProducts: products.length,
 totalValue,
 lowStockItems,
 movements,
 valuation: { totalCost, totalValue, profitMargin }
 };
 };

 const generateReport = () => {
 try {
 const data = calculateStockReport();
 setReportData(data);
 showToast('Relaté³rio gerado com sucesso', 'success');
 } catch (error) {
 console.error('Erro ao gerar relaté³rio:', error);
 showToast('Erro ao gerar relaté³rio', 'error');
 }
 };

 const exportReport = async () => {
 if (!reportData || !reportRef.current) {
 showToast('Gere o relaté³rio primeiro', 'warning');
 return;
 }

 try {
 showToast('Gerando PDF...', 'info');

 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
 const filename = `relatorio_stock_${startStr}_${endStr}.pdf`;

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
 const startY = await addPDFHeader(pdf, 'Relaté³rio de Stock', {
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

 // Adicionar rodapé© em todas as pé¡ginas
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

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

 const stockStatusData = reportData ? [
 { name: 'Stock Baixo', value: reportData.lowStockItems.length, color: '#ef4444' },
 { name: 'Stock Normal', value: Math.max(0, reportData.totalProducts - reportData.lowStockItems.length), color: '#10b981' }
 ] : [];

 const lowStockChartData = reportData?.lowStockItems.slice(0, 10).map((item) => ({
 name: item.productName.length > 20 ? item.productName.substring(0, 20) + '...' : item.productName,
 stock: item.currentStock,
 minStock: item.minStock,
 deficit: Math.max(0, item.minStock - item.currentStock)
 })) || [];

 return (
 <div className="space-y-6">
 <div className="bg-surface-raised rounded-lg shadow p-6 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-bold text-content-primary flex items-center gap-2">
 <BarChart3 className="w-6 h-6 text-brand-500" />
 Relaté³rios de Stock
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
 Gerar Relaté³rio
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
 <Package className="w-7 h-7 text-brand-500" />
 Relaté³rio de Stock
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Produtos</p>
 <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{reportData.totalProducts}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-green-700 dark:text-green-300">Valor Total do Stock</p>
 <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <p className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(reportData.totalValue)}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Margem de Lucro</p>
 <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{reportData.valuation.profitMargin.toFixed(1)}%</p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

 {reportData.lowStockItems.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default bg-red-50 dark:bg-red-900/20">
 <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
 Produtos com Stock Baixo ({reportData.lowStockItems.length})
 </h3>
 </div>
 <div className="overflow-auto max-h-[400px]">
 <table className="w-full">
 <thead className="bg-surface-base/50 sticky top-0 z-10">
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
 {reportData.lowStockItems.map((item, index) => {
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
 )}
 </div>
 );
};


