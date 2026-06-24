import React, { useState, useMemo, useRef } from 'react';
import { Customer, CustomersReport, Order } from '../../../core/types/types';
import {
 Users,
 Download,
 FileText,
 BarChart3,
 TrendingUp,
 ShoppingCart,
 DollarSign
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
import { useOrders } from '../../../core/hooks/useOrders';
import { addPDFHeader, addPDFFooter } from '../../../core/services/reportService';
import { toDateStringInTimezone } from '../../../core/utils/dateUtils';

interface CustomersReportsProps {
 customers: Customer[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

export const CustomersReports: React.FC<CustomersReportsProps> = ({ customers, showToast }) => {
 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('today');
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');
 const [reportData, setReportData] = useState<CustomersReport | null>(null);
 const reportRef = useRef<HTMLDivElement>(null);

 // Hook do mé³dulo vendas
 const { orders, getOrders, loading } = useOrders();

 React.useEffect(() => {
 loadOrders();
 }, [getOrders]);

 const loadOrders = async () => {
 try {
 await getOrders();
 } catch (error) {
 console.error('Erro ao carregar pedidos:', error);
 showToast('Erro ao carregar pedidos', 'error');
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
 orders: orders.filter(order => {
 const orderDate = normalizeDateStart(new Date(order.createdAt));
 return orderDate >= start && orderDate <= end;
 })
 };
 }, [orders, selectedPeriod, customStartDate, customEndDate]);

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
 totalCustomers: customers.length,
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

 const generateReport = () => {
 try {
 const data = calculateCustomersReport();
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
 const filename = `relatorio_clientes_${startStr}_${endStr}.pdf`;

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
 const startY = await addPDFHeader(pdf, 'Relaté³rio de Clientes', {
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

 const topCustomersChartData = reportData?.topCustomers.slice(0, 10).map((customer) => ({
 name: customer.customerName.length > 15 ? customer.customerName.substring(0, 15) + '...' : customer.customerName,
 fullName: customer.customerName,
 value: customer.totalSpent,
 orders: customer.totalOrders
 })) || [];

 const tierChartData = reportData?.customersByTier.map((tier) => ({
 name: tier.tier || 'Sem Tier',
 value: tier.count,
 totalSpent: tier.totalSpent
 })) || [];

 return (
 <div className="space-y-6">
 <div className="bg-surface-raised rounded-lg shadow p-6 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-bold text-content-primary flex items-center gap-2">
 <BarChart3 className="w-6 h-6 text-brand-500" />
 Relaté³rios de Clientes
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
 <Users className="w-7 h-7 text-brand-500" />
 Relaté³rio de Clientes
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Clientes</p>
 <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{reportData.totalCustomers}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-green-700 dark:text-green-300">Novos Clientes</p>
 <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <p className="text-3xl font-bold text-green-700 dark:text-green-300">{reportData.newCustomers}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Clientes Ativos</p>
 <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{reportData.activeCustomers}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 rounded-xl shadow-sm border border-orange-200 dark:border-orange-800">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Pontos de Fidelizaçéo</p>
 <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
 </div>
 <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{reportData.loyaltyStats.totalPoints.toLocaleString('pt-PT')}</p>
 </div>
 </div>

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

 {reportData.topCustomers.length > 0 && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Top Clientes</h3>
 </div>
 <div className="overflow-auto max-h-[400px]">
 <table className="w-full">
 <thead className="bg-surface-base/50 sticky top-0 z-10">
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
 {reportData.topCustomers.map((customer, index) => {
 const maxValue = reportData.topCustomers[0]?.totalSpent || 1;
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
 )}
 </div>
 );
};


