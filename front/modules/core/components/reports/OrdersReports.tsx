import React, { useState, useMemo, useRef } from 'react';
import { Order, OrdersReport } from '../../../core/types/types';
import { 
 ShoppingCart, 
 Download, 
 FileText,
 BarChart3
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
import { addPDFHeader, addPDFFooter } from '../../../core/services/reportService';
import { toDateStringInTimezone } from '../../../core/utils/dateUtils';

interface OrdersReportsProps {
 orders: Order[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

export const OrdersReports: React.FC<OrdersReportsProps> = ({ orders, showToast }) => {
 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('today');
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');
 const [reportData, setReportData] = useState<OrdersReport | null>(null);
 const reportRef = useRef<HTMLDivElement>(null);

 const statusColors: Record<string, string> = {
 'Pendente': '#ef4444',
 'Em Processamento': '#f59e0b',
 'Entregue': '#10b981',
 'Cancelado': '#6b7280'
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
 orders: orders.filter(order => {
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 return orderDate >= start && orderDate <= end;
 })
 };
 }, [orders, selectedPeriod, customStartDate, customEndDate]);

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
 .filter(o => {
 const status = o.status?.toLowerCase() || '';
 return status === 'pending' || status === 'pendente';
 })
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

 const generateReport = () => {
 try {
 const data = calculateOrdersReport();
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
 const filename = `relatorio_pedidos_${startStr}_${endStr}.pdf`;

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
 const startY = await addPDFHeader(pdf, 'Relaté³rio de Pedidos', {
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

 const statusChartData = reportData?.ordersByStatus.map((item) => ({
 name: item.status,
 value: item.count,
 totalValue: item.totalValue,
 color: statusColors[item.status] || '#6b7280'
 })) || [];

 return (
 <div className="space-y-6">
 <div className="bg-surface-raised rounded-lg shadow p-6 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-bold text-content-primary flex items-center gap-2">
 <BarChart3 className="w-6 h-6 text-brand-500" />
 Relaté³rios de Pedidos
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
 <ShoppingCart className="w-7 h-7 text-brand-500" />
 Relaté³rio de Pedidos
 </h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Pedidos</p>
 <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{reportData.totalOrders}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-xl shadow-sm border border-red-200 dark:border-red-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-red-700 dark:text-red-300">Pedidos Pendentes</p>
 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
 </div>
 <p className="text-3xl font-bold text-red-700 dark:text-red-300">{reportData.pendingOrders.length}</p>
 </div>
 </div>

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

 {reportData.ordersByStatus.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Distribuição por Status</h3>
 </div>
 <div className="overflow-auto max-h-[400px]">
 <table className="w-full">
 <thead className="bg-surface-base/50 sticky top-0 z-10">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Status</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Quantidade</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Valor Total</th>
 <th className="w-40 py-4 px-6 text-sm font-semibold text-content-primary">Percentual</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {reportData.ordersByStatus.map((item, index) => {
 const percentage = reportData.totalOrders > 0 ? (item.count / reportData.totalOrders) * 100 : 0;
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

 {reportData.pendingOrders.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-red-200 dark:border-red-800 overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default bg-red-50 dark:bg-red-900/20">
 <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
 <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
 Pedidos Pendentes ({reportData.pendingOrders.length})
 </h3>
 </div>
 <div className="overflow-auto max-h-[400px]">
 <table className="w-full">
 <thead className="bg-surface-base/50 sticky top-0 z-10">
 <tr>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Cliente</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Valor</th>
 <th className="text-right py-4 px-6 text-sm font-semibold text-content-primary">Dias Pendentes</th>
 <th className="text-left py-4 px-6 text-sm font-semibold text-content-primary">Data</th>
 <th className="w-32 py-4 px-6 text-sm font-semibold text-content-primary">Urgéªncia</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {reportData.pendingOrders.map((order, index) => {
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
 )}
 </div>
 );
};


