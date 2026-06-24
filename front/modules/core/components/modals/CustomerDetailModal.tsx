import React, { useState, useEffect } from 'react';
import { Customer, Order, CustomerAction, CustomerFeedback, LoyaltyTier, CustomerInsight, ActionStatus, ActionType } from '../../../core/types/types';
import {
 X, Phone, MessageCircle, Edit2, Award, Mail, MapPin, FileText, History,
 AlertTriangle, TrendingDown, Clock, DollarSign, BarChart3, Save, Eye,
 Plus, CheckCircle, Calendar, Trash2, Star, TrendingUp, Package, User
} from 'lucide-react';
import { dataService } from '../../../core/services/dataService';
import { formatDateTimeLong, formatDateOnly, formatDateWithOptions, extractLocalDate } from '../../../core/utils/dateUtils';
import { orderService } from '../../../sales/services/orderService';
import { useMobile } from '../../../core/hooks/useMobile';

interface CustomerDetailModalProps {
 customer: Customer;
 insight?: CustomerInsight | null;
 orders?: Order[];
 actions?: CustomerAction[];
 feedbacks?: CustomerFeedback[];
 onClose: () => void;
 onEdit?: (customer: Customer) => void;
 onCreateAction?: (customer: Customer) => void;
 onAddFeedback?: (customer: Customer) => void;
 onOrderClick?: (order: Order) => void;
 showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
 customer,
 insight,
 orders = [],
 actions = [],
 feedbacks = [],
 onClose,
 onEdit,
 onCreateAction,
 onAddFeedback,
 onOrderClick,
 showToast
}) => {
 const isMobile = useMobile(768);
 const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'insights' | 'actions' | 'feedbacks'>('overview');
 const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
 const [customerActions, setCustomerActions] = useState<CustomerAction[]>([]);
 const [customerFeedbacks, setCustomerFeedbacks] = useState<CustomerFeedback[]>([]);
 const [customerInsight, setCustomerInsight] = useState<CustomerInsight | null>(null);
 const [editingCustomerField, setEditingCustomerField] = useState<string | null>(null);
 const [editingCustomerData, setEditingCustomerData] = useState<Partial<Customer>>({});

 // Tipo simplificado usado em Loyalty.tsx
 type SimpleCustomerInsight = {
 customerId: string;
 customerName: string;
 daysSinceLastOrder: number;
 totalSpent: number;
 totalOrders: number;
 tier: LoyaltyTier;
 lastOrderDate?: string;
 riskLevel: 'low' | 'medium' | 'high';
 suggestedAction?: string;
 };
 const [notes, setNotes] = useState(customer.notes || '');
 const [isEditingNotes, setIsEditingNotes] = useState(false);
 const [isSavingNotes, setIsSavingNotes] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
 const [editingAction, setEditingAction] = useState<CustomerAction | null>(null);
 const [actionFormData, setActionFormData] = useState<{
 type: ActionType;
 status: ActionStatus;
 priority: 'low' | 'medium' | 'high' | '';
 scheduledDate: string;
 notes: string;
 }>({
 type: ActionType.PHONE_CALL,
 status: ActionStatus.PENDING,
 priority: '',
 scheduledDate: '',
 notes: ''
 });
 const [editingFeedback, setEditingFeedback] = useState<CustomerFeedback | null>(null);
 const [feedbackFormData, setFeedbackFormData] = useState<{
 rating: number;
 feedback: string;
 outcome: 'positive' | 'neutral' | 'negative' | 'sale' | 'no_interest';
 }>({
 rating: 5,
 feedback: '',
 outcome: 'positive'
 });

 // Carregar dados se néo foram fornecidos
 useEffect(() => {
 const loadData = async () => {
 if (orders.length === 0) {
 const allOrders = await orderService.getOrders();
 setCustomerOrders(allOrders.filter(o => o.customerId === customer.id));
 } else {
 setCustomerOrders(orders.filter(o => o.customerId === customer.id));
 }

 if (actions.length === 0) {
 const allActions = await dataService.getCustomerActions();
 setCustomerActions(allActions.filter(a => a.customerId === customer.id));
 } else {
 setCustomerActions(actions.filter(a => a.customerId === customer.id));
 }

 if (feedbacks.length === 0) {
 const allFeedbacks = await dataService.getCustomerFeedbacks();
 setCustomerFeedbacks(allFeedbacks.filter(f => f.customerId === customer.id));
 } else {
 setCustomerFeedbacks(feedbacks.filter(f => f.customerId === customer.id));
 }

 // Carregar insight se néo foi fornecido
 if (!insight) {
 const insights = await dataService.getCustomerInsights(30);
 const foundInsight = insights.find(i => i.customerId === customer.id);
 if (foundInsight) {
 setCustomerInsight(foundInsight);
 }
 } else {
 setCustomerInsight(insight);
 }
 };

 loadData();
 }, [customer.id, orders, actions, feedbacks, insight]);

 const formatMoney = (value: number | undefined | null): string => {
 if (value === undefined || value === null || isNaN(value)) {
 return '0,00 MT';
 }
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 const getTierColor = (tier: LoyaltyTier) => {
 switch (tier) {
 case LoyaltyTier.GOLD:
 return {
 bg: 'bg-yellow-100 dark:bg-yellow-900/30',
 text: 'text-yellow-800 dark:text-yellow-300',
 border: 'border-yellow-200 dark:border-yellow-800',
 badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900'
 };
 case LoyaltyTier.SILVER:
 return {
 bg: 'bg-surface-base',
 text: 'text-content-primary ',
 border: 'border-border-default',
 badge: 'bg-surface-base text-content-primary border-border-default '
 };
 case LoyaltyTier.BRONZE:
 return {
 bg: 'bg-orange-50 dark:bg-orange-900/30',
 text: 'text-orange-800 dark:text-orange-300',
 border: 'border-orange-200 dark:border-orange-800',
 badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-900'
 };
 default:
 return {
 bg: 'bg-surface-base',
 text: 'text-content-secondary',
 border: 'border-border-default',
 badge: 'bg-surface-base text-content-primary border-border-default '
 };
 }
 };

 const getTierIcon = (tier: LoyaltyTier) => {
 switch (tier) {
 case LoyaltyTier.GOLD: return '🥇';
 case LoyaltyTier.SILVER: return '🥈';
 case LoyaltyTier.BRONZE: return '🥉';
 default: return 'â­';
 }
 };

 const formatPhoneForWhatsApp = (phone: string) => {
 let cleanPhone = phone.replace(/\D/g, '');
 if (cleanPhone.length > 0 && !cleanPhone.startsWith('258')) {
 if (cleanPhone.startsWith('0')) {
 cleanPhone = '258' + cleanPhone.substring(1);
 } else {
 cleanPhone = '258' + cleanPhone;
 }
 }
 return cleanPhone;
 };

 const handleWhatsApp = () => {
 const formattedPhone = formatPhoneForWhatsApp(customer.phone);
 if (formattedPhone.length >= 9) {
 window.open(`https://wa.me/${formattedPhone}`, '_blank');
 } else {
 showToast?.('Néºmero de telefone invé¡lido', 'error');
 }
 };

 const handleCall = () => {
 const formattedPhone = formatPhoneForWhatsApp(customer.phone);
 if (formattedPhone.length >= 9) {
 window.location.href = `tel:+${formattedPhone}`;
 } else {
 showToast?.('Néºmero de telefone invé¡lido', 'error');
 }
 };

 const handleSaveNotes = async () => {
 setIsSavingNotes(true);
 try {
 const success = await dataService.updateCustomer(customer.id, { notes });
 if (success) {
 showToast?.('Notas guardadas com sucesso', 'success');
 setIsEditingNotes(false);
 } else {
 showToast?.('Erro ao guardar notas', 'error');
 }
 } catch (error: any) {
 showToast?.('Erro ao guardar notas: ' + (error.message || 'Erro desconhecido'), 'error');
 } finally {
 setIsSavingNotes(false);
 }
 };

 const handleOrderClick = (order: Order) => {
 if (onOrderClick) {
 onOrderClick(order);
 } else {
 setSelectedOrder(order);
 }
 };

 const sortedOrders = [...customerOrders].sort((a, b) =>
 new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
 );
 const sortedActions = [...customerActions].sort((a, b) =>
 new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
 );

 const averageOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;

 // Calcular produtos favoritos
 const favoriteProducts = React.useMemo(() => {
 const productMap = new Map<string, { name: string; quantity: number; revenue: number; lastOrder: Date }>();

 customerOrders.forEach(order => {
 if (order.items) {
 order.items.forEach((item: any) => {
 const productName = item.productName || item.name || 'Produto desconhecido';
 const existing = productMap.get(productName) || {
 name: productName,
 quantity: 0,
 revenue: 0,
 lastOrder: new Date(order.createdAt)
 };
 existing.quantity += item.quantity || 0;
 existing.revenue += (item.price || item.priceAtTime || 0) * (item.quantity || 0);
 const orderDate = new Date(order.createdAt);
 if (orderDate > existing.lastOrder) {
 existing.lastOrder = orderDate;
 }
 productMap.set(productName, existing);
 });
 }
 });

 return Array.from(productMap.values())
 .sort((a, b) => b.revenue - a.revenue)
 .slice(0, 5);
 }, [customerOrders]);

 // Calcular tendéªncia de gastos (éºltimos 3 meses vs anteriores)
 const spendingTrend = React.useMemo(() => {
 const now = new Date();
 const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
 const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

 const recentOrders = customerOrders.filter(o => new Date(o.createdAt) >= threeMonthsAgo);
 const previousOrders = customerOrders.filter(o => {
 const orderDate = new Date(o.createdAt);
 return orderDate >= sixMonthsAgo && orderDate < threeMonthsAgo;
 });

 const recentTotal = recentOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
 const previousTotal = previousOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

 const change = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 0;

 return {
 recent: recentTotal,
 previous: previousTotal,
 change,
 trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable'
 };
 }, [customerOrders]);

 // Calcular padréo de compra (dias da semana mais frequentes)
 const purchasePattern = React.useMemo(() => {
 const dayCounts: Record<string, number> = {};
 customerOrders.forEach(order => {
 const day = formatDateWithOptions(order.createdAt, { weekday: 'long' });
 dayCounts[day] = (dayCounts[day] || 0) + 1;
 });
 const sortedDays = Object.entries(dayCounts)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 3);
 return sortedDays;
 }, [customerOrders]);

 // Calcular tempo inativo
 let inactiveTime = '';
 if (customerInsight) {
 if (customerInsight.daysSinceLastOrder === Infinity) {
 inactiveTime = 'Nunca fez pedidos';
 } else {
 const days = customerInsight.daysSinceLastOrder;
 if (days < 7) {
 inactiveTime = `Hé¡ ${days} dia${days === 1 ? '' : 's'}`;
 } else if (days < 30) {
 const weeks = Math.floor(days / 7);
 inactiveTime = `Há ${weeks} semana${weeks === 1 ? '' : 's'}`;
 } else if (days < 365) {
 const months = Math.floor(days / 30);
 inactiveTime = `Há ${months} mês${months === 1 ? '' : 'es'}`;
 } else {
 const years = Math.floor(days / 365);
 inactiveTime = `Há mais de ${years} ano${years === 1 ? '' : 's'}`;
 }
 }
 } else if (customer.lastOrderDate) {
 const days = Math.floor((new Date().getTime() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));
 if (days < 7) {
 inactiveTime = `Há ${days} dia${days === 1 ? '' : 's'}`;
 } else if (days < 30) {
 const weeks = Math.floor(days / 7);
 inactiveTime = `Há ${weeks} semana${weeks === 1 ? '' : 's'}`;
 } else if (days < 365) {
 const months = Math.floor(days / 30);
 inactiveTime = `Há ${months} mês${months === 1 ? '' : 'es'}`;
 } else {
 const years = Math.floor(days / 365);
 inactiveTime = `Há mais de ${years} ano${years === 1 ? '' : 's'}`;
 }
 }

 const tierColors = getTierColor(customer.tier);
 const riskLevel = customerInsight?.riskLevel || 'low';
 const riskColors = {
 high: {
 bg: 'bg-red-50 dark:bg-red-900/20',
 border: 'border-red-200 dark:border-red-800',
 text: 'text-red-600 dark:text-red-400',
 badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900'
 },
 medium: {
 bg: 'bg-yellow-50 dark:bg-yellow-900/20',
 border: 'border-yellow-200 dark:border-yellow-800',
 text: 'text-yellow-600 dark:text-yellow-400',
 badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900'
 },
 low: {
 bg: 'bg-blue-50 dark:bg-blue-900/20',
 border: 'border-blue-200 dark:border-blue-800',
 text: 'text-blue-600 dark:text-blue-400',
 badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900'
 }
 };
 const riskStyle = riskColors[riskLevel];

 return (
 <>
 <div className={`fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex ${isMobile ? '' : 'items-center justify-center p-4'} transition-opacity duration-300`} onClick={onClose}>
 <div className={`w-full h-full ${isMobile ? '' : 'max-w-[90vw] max-h-[90vh] rounded-2xl'} bg-surface-raised/95 backdrop-blur-xl shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-fadeIn`} onClick={(e) => e.stopPropagation()}>
 {/* Header */}
 <div className={`flex-shrink-0 bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-900/80 dark:to-gray-900/60 backdrop-blur-md border-b border-border-default/50 ${isMobile ? 'p-3 sticky top-0 z-20' : 'p-4 sm:p-5 z-10'}`}>
 <div className="flex justify-between items-start mb-2.5">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1.5">
 <span className="text-2xl">{getTierIcon(customer.tier)}</span>
 <div>
 <h2 className="text-lg sm:text-xl font-bold text-content-primary">{customer.name}</h2>
 <p className="text-[10px] sm:text-xs text-content-muted">ID: {customer.id.slice(-9)}</p>
 </div>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {customerInsight && (
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${riskStyle.badge}`}>
 {riskLevel === 'high' ? 'Alto Risco' : riskLevel === 'medium' ? 'Médio Risco' : 'Baixo Risco'}
 </span>
 )}
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${tierColors.badge}`}>
 <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
 {customer.tier}
 </span>
 </div>
 </div>
 <div className="flex gap-1.5">
 {onEdit && (
 <button
 onClick={() => onEdit(customer)}
 className="p-1.5 text-content-muted hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
 title="Editar perfil"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 <button onClick={onClose} className="p-1.5 text-content-muted hover:text-content-secondary ">
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Botéµes de Açéo */}
 <div className={`flex gap-2.5 ${isMobile ? 'mb-2' : 'mb-3'}`}>
 <button
 onClick={handleWhatsApp}
 className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 font-medium text-xs sm:text-sm shadow-lg hover:shadow-xl transform hover:scale-[1.02]`}
 >
 <MessageCircle className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">WhatsApp</span>
 </button>
 <button
 onClick={handleCall}
 className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 font-medium text-xs sm:text-sm shadow-lg hover:shadow-xl transform hover:scale-[1.02]`}
 >
 <Phone className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">Ligar</span>
 </button>
 </div>

 {/* Tabs Navigation */}
 <div className="border-b border-border-default/50 -mx-3 sm:-mx-6 px-3 sm:px-6">
 <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
 {[
 { id: 'overview' as const, label: 'Visão Geral', icon: User },
 { id: 'orders' as const, label: 'Pedidos', icon: History, count: sortedOrders.length },
 { id: 'insights' as const, label: 'Insights', icon: TrendingUp },
 { id: 'actions' as const, label: 'Ações', icon: Phone, count: sortedActions.length },
 { id: 'feedbacks' as const, label: 'Feedbacks', icon: Star, count: customerFeedbacks.length }
 ].map(tab => {
 const Icon = tab.icon;
 const isActive = activeTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`relative flex items-center space-x-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 rounded-t-lg ${isActive
 ? 'text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/20'
 : 'text-content-muted hover:text-content-secondary hover:bg-surface-base/50'
 }`}
 >
 <Icon className="w-4 h-4" />
 <span>{tab.label}</span>
 {tab.count !== undefined && tab.count > 0 && (
 <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${isActive
 ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
 : 'bg-surface-base text-content-secondary'
 }`}>
 {tab.count}
 </span>
 )}
 {isActive && (
 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600 dark:from-brand-400 dark:to-brand-500 rounded-full" />
 )}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-3' : 'p-4 sm:p-5'}`}>
 {/* Tab Content */}
 {activeTab === 'overview' && (
 <div className="space-y-3">
 {/* Informações de Contato */}
 <div className="space-y-2 p-3 bg-surface-raised/60 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-sm">
 <div className="flex items-center justify-between text-content-secondary">
 <div className="flex items-center flex-1">
 <Phone className="w-4 h-4 mr-3 text-content-muted flex-shrink-0" />
 {editingCustomerField === 'phone' ? (
 <input
 type="tel"
 value={editingCustomerData.phone || customer.phone}
 onChange={(e) => setEditingCustomerData({ ...editingCustomerData, phone: e.target.value })}
 onBlur={async () => {
 if (editingCustomerData.phone && editingCustomerData.phone !== customer.phone) {
 const success = await dataService.updateCustomer(customer.id, { phone: editingCustomerData.phone });
 if (success) {
 showToast?.('Telefone atualizado com sucesso', 'success');
 setEditingCustomerField(null);
 } else {
 showToast?.('Erro ao atualizar telefone', 'error');
 }
 } else {
 setEditingCustomerField(null);
 }
 }}
 className="flex-1 px-2 py-1 border border-border-default rounded bg-surface-raised text-content-primary text-sm"
 autoFocus
 />
 ) : (
 <>
 <span className="font-medium">{customer.phone}</span>
 <button
 onClick={() => {
 setEditingCustomerField('phone');
 setEditingCustomerData({ phone: customer.phone });
 }}
 className="ml-2 p-1 text-content-muted hover:text-brand-600 dark:hover:text-brand-400"
 title="Editar telefone"
 >
 <Edit2 className="w-3 h-3" />
 </button>
 </>
 )}
 </div>
 </div>
 {customer.email && (
 <div className="flex items-center text-content-secondary">
 <Mail className="w-4 h-4 mr-3 text-content-muted flex-shrink-0" />
 <span>{customer.email}</span>
 <span className="ml-2 text-xs text-content-muted">(néo edité¡vel)</span>
 </div>
 )}
 <div className="flex items-start justify-between text-content-secondary">
 <div className="flex items-start flex-1">
 <MapPin className="w-4 h-4 mr-3 mt-0.5 text-content-muted flex-shrink-0" />
 {editingCustomerField === 'address' ? (
 <textarea
 value={editingCustomerData.address !== undefined ? editingCustomerData.address : (customer.address || '')}
 onChange={(e) => setEditingCustomerData({ ...editingCustomerData, address: e.target.value })}
 onBlur={async () => {
 const newAddress = editingCustomerData.address !== undefined ? editingCustomerData.address : (customer.address || '');
 if (newAddress !== (customer.address || '')) {
 const success = await dataService.updateCustomer(customer.id, { address: newAddress });
 if (success) {
 showToast?.('Endereço atualizado com sucesso', 'success');
 setEditingCustomerField(null);
 } else {
 showToast?.('Erro ao atualizar endereço', 'error');
 }
 } else {
 setEditingCustomerField(null);
 }
 }}
 className="flex-1 px-2 py-1 border border-border-default rounded bg-surface-raised text-content-primary text-sm resize-none"
 rows={2}
 autoFocus
 />
 ) : (
 <>
 <span className="flex-1">{customer.address || 'Néo especificado'}</span>
 <button
 onClick={() => {
 setEditingCustomerField('address');
 setEditingCustomerData({ address: customer.address || '' });
 }}
 className="ml-2 p-1 text-content-muted hover:text-brand-600 dark:hover:text-brand-400"
 title="Editar endereço"
 >
 <Edit2 className="w-3 h-3" />
 </button>
 </>
 )}
 </div>
 </div>
 </div>

 {/* Estaté­sticas */}
 <div className={`grid grid-cols-2 ${isMobile ? 'gap-2.5' : 'gap-3'}`}>
 <div className={`bg-gradient-to-br from-white/70 to-white/50 dark:from-gray-800/70 dark:to-gray-800/50 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-sm ${isMobile ? 'p-2.5' : 'p-3'} transition-transform hover:scale-[1.02]`}>
 <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-content-muted mb-1`}>Total Gasto</p>
 <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-content-primary`}>{formatMoney(customer.totalSpent)}</p>
 </div>
 <div className={`bg-gradient-to-br from-white/70 to-white/50 dark:from-gray-800/70 dark:to-gray-800/50 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-sm ${isMobile ? 'p-2.5' : 'p-3'} transition-transform hover:scale-[1.02]`}>
 <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-content-muted mb-1`}>Total de Pedidos</p>
 <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-content-primary`}>{customer.totalOrders}</p>
 </div>
 <div className={`bg-gradient-to-br from-white/70 to-white/50 dark:from-gray-800/70 dark:to-gray-800/50 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-sm ${isMobile ? 'p-2.5' : 'p-3'} transition-transform hover:scale-[1.02]`}>
 <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-content-muted mb-1`}>Ticket Médio</p>
 <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-content-primary`}>{formatMoney(averageOrderValue)}</p>
 </div>
 <div className={`bg-gradient-to-br from-white/70 to-white/50 dark:from-gray-800/70 dark:to-gray-800/50 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-sm ${isMobile ? 'p-2.5' : 'p-3'} transition-transform hover:scale-[1.02]`}>
 <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-content-muted mb-1`}>Tempo Inativo</p>
 <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-content-primary`}>{inactiveTime || 'N/A'}</p>
 </div>
 </div>

 {/* Ané¡lise e Recomendaçéµes */}
 {customerInsight && customerInsight.riskLevel === 'high' && (
 <div className={`${riskStyle.bg} ${riskStyle.border} border-2 rounded-lg p-4`}>
 <div className="flex items-start gap-3">
 <AlertTriangle className={`w-5 h-5 ${riskStyle.text} flex-shrink-0 mt-0.5`} />
 <div className="flex-1">
 <h3 className="font-semibold text-content-primary mb-2">Análise e Recomendações</h3>
 <p className="text-sm text-content-secondary mb-2">
 {customerInsight.daysSinceLastOrder === Infinity
 ? 'Cliente nunca fez pedidos - Primeiro contacto necessário'
 : customerInsight.daysSinceLastOrder >= 90
 ? `URGENTE: Cliente inativo há mais de 90 dias - Contacto prioritário${customerActions.length > 0 ? ' (Já existe ação recente)' : ''}`
 : 'Contato urgente necessário'}
 </p>
 {customerInsight.lastOrderDate && (
 <p className="text-xs text-content-secondary">
 Última compra: {formatDateWithOptions(customerInsight.lastOrderDate, {
 day: 'numeric',
 month: 'long',
 year: 'numeric'
 })}
 </p>
 )}
 {customerInsight.suggestedAction && (
 <p className="text-sm text-content-secondary mt-2">
 <TrendingDown className={`w-4 h-4 inline mr-1 ${riskStyle.text}`} />
 {customerInsight.suggestedAction}
 </p>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Notas */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <h3 className="font-bold text-content-primary flex items-center">
 <FileText className="w-4 h-4 mr-2" />
 Notas
 </h3>
 {!isEditingNotes && (
 <button
 onClick={() => setIsEditingNotes(true)}
 className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
 >
 Editar
 </button>
 )}
 </div>
 {isEditingNotes ? (
 <div className="space-y-2">
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={4}
 className="w-full px-3 py-2 rounded-lg border border-border-default focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
 placeholder="Adicione notas sobre este cliente..."
 />
 <div className="flex gap-2">
 <button
 onClick={handleSaveNotes}
 disabled={isSavingNotes}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
 >
 <Save className="w-4 h-4" />
 {isSavingNotes ? 'A guardar...' : 'Guardar'}
 </button>
 <button
 onClick={() => {
 setNotes(customer.notes || '');
 setIsEditingNotes(false);
 }}
 className="px-4 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors text-sm"
 >
 Cancelar
 </button>
 </div>
 </div>
 ) : (
 <div className="p-3 bg-surface-raised/60 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-sm min-h-[80px]">
 {notes ? (
 <p className="text-sm text-content-secondary whitespace-pre-wrap">{notes}</p>
 ) : (
 <p className="text-sm text-content-muted italic">Sem notas adicionadas</p>
 )}
 </div>
 )}
 </div>
 </div>
 )}

 {/* Tab: Pedidos */}
 {activeTab === 'orders' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-content-primary flex items-center">
 <History className="w-4 h-4 mr-2" />
 Histé³rico de Compras ({sortedOrders.length})
 </h3>
 </div>

 {sortedOrders.length === 0 ? (
 <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
 <p className="text-sm text-yellow-800 dark:text-yellow-300">
 O cliente tem {customer.totalOrders} pedido(s) registado(s) com total de {formatMoney(customer.totalSpent)},
 mas os detalhes dos pedidos néo estéo disponé­veis.
 </p>
 </div>
 ) : (
 <div className="space-y-2">
 {sortedOrders.map(order => (
 <div
 key={order.id}
 onClick={() => handleOrderClick(order)}
 className="border border-border-default/50 rounded-xl p-3 bg-surface-raised/60 backdrop-blur-sm hover:bg-surface-raised/80 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md transform hover:scale-[1.01]"
 >
 <div className="flex justify-between items-start mb-2">
 <div>
 <p className="font-medium text-content-primary text-sm">
 Pedido #{order.externalId || order.id.slice(-6)}
 </p>
 <p className="text-xs text-content-muted">
 {formatDateWithOptions(order.createdAt, {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 })}
 </p>
 </div>
 <div className="text-right">
 <p className="font-bold text-content-primary">{formatMoney(order.totalAmount)}</p>
 <p className="text-xs text-content-muted">{order.items?.length || 0} item(s)</p>
 </div>
 </div>
 {order.items && order.items.length > 0 && (
 <div className="mt-2 pt-2 border-t border-border-default">
 <p className="text-xs text-content-secondary truncate">
 {order.items[0].productName}
 {order.items.length > 1 && ` + ${order.items.length - 1} mais`}
 </p>
 </div>
 )}
 <div className="mt-2 flex items-center justify-between">
 {order.status && (
 <span className={`px-2 py-0.5 rounded-full text-xs ${order.status === 'Entregue'
 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
 : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
 }`}>
 {order.status}
 </span>
 )}
 <span className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1">
 <Eye className="w-3 h-3" />
 Ver detalhes
 </span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Tab: Insights */}
 {activeTab === 'insights' && (
 <div className="space-y-4">
 {/* Produtos Favoritos */}
 {favoriteProducts.length > 0 && (
 <div>
 <h3 className="font-bold text-content-primary mb-3 flex items-center">
 <Package className="w-4 h-4 mr-2" />
 Produtos Favoritos
 </h3>
 <div className="space-y-2">
 {favoriteProducts.map((product, index) => (
 <div key={index} className="border border-border-default rounded-lg p-3">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <p className="font-medium text-content-primary text-sm">{product.name}</p>
 <p className="text-xs text-content-muted mt-1">
 {product.quantity} unidade(s) â€¢ {formatMoney(product.revenue)}
 </p>
 <p className="text-xs text-content-muted mt-1">
 éšltima compra: {formatDateOnly(product.lastOrder)}
 </p>
 </div>
 <div className="text-right">
 <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
 #{index + 1}
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Tendéªncia de Gastos */}
 <div>
 <h3 className="font-bold text-content-primary mb-3 flex items-center">
 <TrendingUp className="w-4 h-4 mr-2" />
 Tendéªncia de Gastos
 </h3>
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-surface-base/50 rounded-lg p-3">
 <p className="text-xs text-content-muted mb-1">éšltimos 3 meses</p>
 <p className="text-lg font-bold text-content-primary">{formatMoney(spendingTrend.recent)}</p>
 </div>
 <div className="bg-surface-base/50 rounded-lg p-3">
 <p className="text-xs text-content-muted mb-1">3 meses anteriores</p>
 <p className="text-lg font-bold text-content-primary">{formatMoney(spendingTrend.previous)}</p>
 </div>
 </div>
 {spendingTrend.previous > 0 && (
 <div className={`mt-3 p-3 rounded-lg ${spendingTrend.trend === 'up'
 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
 : spendingTrend.trend === 'down'
 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
 : 'bg-surface-base/50 border border-border-default'
 }`}>
 <div className="flex items-center gap-2">
 {spendingTrend.trend === 'up' ? (
 <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
 ) : spendingTrend.trend === 'down' ? (
 <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
 ) : (
 <BarChart3 className="w-4 h-4 text-content-secondary" />
 )}
 <span className={`text-sm font-medium ${spendingTrend.trend === 'up'
 ? 'text-green-700 dark:text-green-300'
 : spendingTrend.trend === 'down'
 ? 'text-red-700 dark:text-red-300'
 : 'text-content-secondary'
 }`}>
 {spendingTrend.change > 0 ? '+' : ''}{spendingTrend.change.toFixed(1)}% vs peré­odo anterior
 </span>
 </div>
 </div>
 )}
 </div>

 {/* Padréo de Compra */}
 {purchasePattern.length > 0 && (
 <div>
 <h3 className="font-bold text-content-primary mb-3 flex items-center">
 <Calendar className="w-4 h-4 mr-2" />
 Padréo de Compra
 </h3>
 <div className="space-y-2">
 {purchasePattern.map(([day, count], index) => (
 <div key={day} className="flex items-center justify-between p-2 bg-surface-base/50 rounded-lg">
 <span className="text-sm text-content-secondary capitalize">{day}</span>
 <div className="flex items-center gap-2">
 <div className="w-24 h-2 bg-surface-base rounded-full overflow-hidden">
 <div
 className="h-full bg-brand-600 dark:bg-brand-400 rounded-full"
 style={{ width: `${(count / sortedOrders.length) * 100}%` }}
 />
 </div>
 <span className="text-xs font-medium text-content-secondary w-8 text-right">
 {count}
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Análise de Risco */}
 {customerInsight && (
 <div className={`${riskStyle.bg} ${riskStyle.border} border-2 rounded-lg p-4`}>
 <div className="flex items-start gap-3">
 <AlertTriangle className={`w-5 h-5 ${riskStyle.text} flex-shrink-0 mt-0.5`} />
 <div className="flex-1">
 <h3 className="font-semibold text-content-primary mb-2">Análise de Risco</h3>
 <p className="text-sm text-content-secondary mb-2">
 {customerInsight.daysSinceLastOrder === Infinity
 ? 'Cliente nunca fez pedidos - Primeiro contacto necessário'
 : customerInsight.daysSinceLastOrder >= 90
 ? `URGENTE: Cliente inativo há mais de 90 dias - Contacto prioritário`
 : 'Contato recomendado'}
 </p>
 {customerInsight.suggestedAction && (
 <p className="text-sm text-content-secondary mt-2">
 <TrendingDown className={`w-4 h-4 inline mr-1 ${riskStyle.text}`} />
 {customerInsight.suggestedAction}
 </p>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Tab: Ações */}
 {activeTab === 'actions' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-content-primary flex items-center">
 <Phone className="w-4 h-4 mr-2" />
 Ações Comerciais ({sortedActions.length})
 </h3>
 {onCreateAction && (
 <button
 onClick={() => onCreateAction(customer)}
 className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
 >
 <Plus className="w-4 h-4" />
 Nova Ação
 </button>
 )}
 </div>

 {sortedActions.length === 0 ? (
 <p className="text-content-muted text-sm">Nenhuma ação comercial registada.</p>
 ) : (
 <div className="space-y-2">
 {sortedActions.map(action => (
 <div key={action.id} className="border border-border-default rounded-lg p-3">
 <div className="flex justify-between items-start mb-2">
 <div className="flex-1">
 <p className="font-medium text-content-primary text-sm">{action.type}</p>
 {action.scheduledDate && (
 <p className="text-xs text-content-muted">
 Agendado: {formatDateOnly(action.scheduledDate)}
 </p>
 )}
 {action.completedDate && (
 <p className="text-xs text-content-muted">
 Conclué­do: {formatDateOnly(action.completedDate)}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 rounded-full text-xs ${action.status === ActionStatus.PENDING
 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
 : action.status === ActionStatus.COMPLETED
 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
 : action.status === ActionStatus.IN_PROGRESS
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
 : 'bg-surface-base text-content-secondary '
 }`}>
 {action.status}
 </span>
 <div className="flex gap-1">
 <button
 onClick={() => {
 setEditingAction(action);
 setActionFormData({
 type: action.type,
 status: action.status,
 priority: action.priority || '',
 scheduledDate: action.scheduledDate ? extractLocalDate(action.scheduledDate) : '',
 notes: action.notes || ''
 });
 }}
 className="p-1.5 text-content-secondary hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-base rounded transition-colors"
 title="Editar ação"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={async () => {
 if (confirm('Tem certeza que deseja apagar esta ação?')) {
 const success = await dataService.deleteCustomerAction(action.id);
 if (success) {
 setCustomerActions(prev => prev.filter(a => a.id !== action.id));
 if (showToast) {
 showToast('Açéo apagada com sucesso', 'success');
 }
 } else {
 if (showToast) {
 showToast('Erro ao apagar ação', 'error');
 }
 }
 }
 }}
 className="p-1.5 text-content-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-base rounded transition-colors"
 title="Apagar ação"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 {action.notes && (
 <p className="text-xs text-content-secondary mt-2">{action.notes}</p>
 )}
 {action.priority && (
 <p className="text-xs text-content-muted mt-1">
 Prioridade: {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Mé©dia' : 'Baixa'}
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Tab: Feedbacks */}
 {activeTab === 'feedbacks' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-content-primary flex items-center">
 <CheckCircle className="w-4 h-4 mr-2" />
 Feedbacks ({customerFeedbacks.length})
 </h3>
 {onAddFeedback && (
 <button
 onClick={() => onAddFeedback(customer)}
 className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
 >
 <Plus className="w-4 h-4" />
 Novo Feedback
 </button>
 )}
 </div>

 {customerFeedbacks.length === 0 ? (
 <p className="text-content-muted text-sm">Nenhum feedback registado.</p>
 ) : (
 <div className="space-y-2">
 {customerFeedbacks.map(feedback => (
 <div key={feedback.id} className="border border-border-default rounded-lg p-3">
 <div className="flex justify-between items-start mb-2">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 {feedback.rating && (
 <div className="flex items-center gap-1">
 {[1, 2, 3, 4, 5].map(star => (
 <Star
 key={star}
 className={`w-4 h-4 ${feedback.rating && feedback.rating >= star ? 'text-yellow-400 fill-current' : 'text-content-muted'}`}
 />
 ))}
 <span className="text-sm font-medium text-content-secondary ml-1">
 {feedback.rating}/5
 </span>
 </div>
 )}
 </div>
 {feedback.feedback && (
 <p className="text-sm text-content-secondary">{feedback.feedback}</p>
 )}
 {feedback.outcome && (
 <p className="text-xs text-content-muted mt-1">
 Resultado: {
 feedback.outcome === 'positive' ? 'Positivo' :
 feedback.outcome === 'negative' ? 'Negativo' :
 feedback.outcome === 'sale' ? 'Venda Realizada' :
 feedback.outcome === 'no_interest' ? 'Sem Interesse' :
 'Neutro'
 }
 </p>
 )}
 </div>
 <div className="flex items-center gap-2 ml-2">
 <span className="text-xs text-content-muted">
 {formatDateOnly(feedback.createdAt)}
 </span>
 <div className="flex gap-1">
 <button
 onClick={() => {
 setEditingFeedback(feedback);
 setFeedbackFormData({
 rating: feedback.rating || 5,
 feedback: feedback.feedback || '',
 outcome: feedback.outcome || 'positive'
 });
 }}
 className="p-1.5 text-content-secondary hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-base rounded transition-colors"
 title="Editar feedback"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={async () => {
 if (confirm('Tem certeza que deseja apagar este feedback?')) {
 const success = await dataService.deleteCustomerFeedback(feedback.id);
 if (success) {
 setCustomerFeedbacks(prev => prev.filter(f => f.id !== feedback.id));
 if (showToast) {
 showToast('Feedback apagado com sucesso', 'success');
 }
 } else {
 if (showToast) {
 showToast('Erro ao apagar feedback', 'error');
 }
 }
 }
 }}
 className="p-1.5 text-content-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-base rounded transition-colors"
 title="Apagar feedback"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Modal de Ediçéo de Açéo */}
 {editingAction && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-[60] flex items-center justify-center p-4 transition-opacity duration-300" onClick={() => setEditingAction(null)}>
 <div className="bg-surface-raised/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/20" onClick={(e) => e.stopPropagation()}>
 <div className="sticky top-0 bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-900/80 dark:to-gray-900/60 backdrop-blur-md border-b border-border-default/50 p-4 flex justify-between items-center z-10">
 <h3 className="text-lg font-bold text-content-primary">Editar Açéo Comercial</h3>
 <button
 onClick={() => setEditingAction(null)}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="p-4 space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Tipo</label>
 <select
 value={actionFormData.type}
 onChange={(e) => setActionFormData({ ...actionFormData, type: e.target.value as ActionType })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 {Object.values(ActionType).map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Status</label>
 <select
 value={actionFormData.status}
 onChange={(e) => setActionFormData({ ...actionFormData, status: e.target.value as ActionStatus })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 {Object.values(ActionStatus).map(status => (
 <option key={status} value={status}>{status}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Prioridade</label>
 <select
 value={actionFormData.priority}
 onChange={(e) => setActionFormData({ ...actionFormData, priority: e.target.value as 'low' | 'medium' | 'high' | '' })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="">Sem prioridade</option>
 <option value="low">Baixa</option>
 <option value="medium">Mé©dia</option>
 <option value="high">Alta</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data Agendada</label>
 <input
 type="date"
 value={actionFormData.scheduledDate}
 onChange={(e) => setActionFormData({ ...actionFormData, scheduledDate: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Notas</label>
 <textarea
 value={actionFormData.notes}
 onChange={(e) => setActionFormData({ ...actionFormData, notes: e.target.value })}
 rows={4}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary resize-none"
 placeholder="Adicione notas sobre esta ação..."
 />
 </div>
 <div className="flex gap-2 pt-2">
 <button
 onClick={async () => {
 const updateData: Partial<CustomerAction> = {
 type: actionFormData.type,
 status: actionFormData.status,
 priority: actionFormData.priority || undefined,
 scheduledDate: actionFormData.scheduledDate || undefined,
 notes: actionFormData.notes || undefined,
 ...(actionFormData.status === ActionStatus.COMPLETED && !editingAction.completedDate ? { completedDate: new Date().toISOString() } : {})
 };
 const success = await dataService.updateCustomerAction(editingAction.id, updateData);
 if (success) {
 setCustomerActions(prev => prev.map(a => a.id === editingAction.id ? { ...a, ...updateData } : a));
 setEditingAction(null);
 if (showToast) {
 showToast('Açéo atualizada com sucesso', 'success');
 }
 } else {
 if (showToast) {
 showToast('Erro ao atualizar ação', 'error');
 }
 }
 }}
 className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium"
 >
 Guardar
 </button>
 <button
 onClick={() => setEditingAction(null)}
 className="px-4 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Modal de Ediçéo de Feedback */}
 {editingFeedback && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-[60] flex items-center justify-center p-4 transition-opacity duration-300" onClick={() => setEditingFeedback(null)}>
 <div className="bg-surface-raised/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/20" onClick={(e) => e.stopPropagation()}>
 <div className="sticky top-0 bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-900/80 dark:to-gray-900/60 backdrop-blur-md border-b border-border-default/50 p-4 flex justify-between items-center z-10">
 <h3 className="text-lg font-bold text-content-primary">Editar Feedback</h3>
 <button
 onClick={() => setEditingFeedback(null)}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="p-4 space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">Avaliação</label>
 <div className="flex items-center gap-2">
 {[1, 2, 3, 4, 5].map(star => (
 <button
 key={star}
 type="button"
 onClick={() => setFeedbackFormData({ ...feedbackFormData, rating: star })}
 className="focus:outline-none"
 >
 <Star
 className={`w-8 h-8 transition-colors ${feedbackFormData.rating >= star
 ? 'text-yellow-400 fill-current'
 : 'text-content-muted hover:text-yellow-200'
 }`}
 />
 </button>
 ))}
 <span className="ml-2 text-sm font-medium text-content-secondary">
 {feedbackFormData.rating}/5
 </span>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Feedback</label>
 <textarea
 value={feedbackFormData.feedback}
 onChange={(e) => setFeedbackFormData({ ...feedbackFormData, feedback: e.target.value })}
 rows={4}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary resize-none"
 placeholder="Descreva o feedback..."
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Resultado</label>
 <select
 value={feedbackFormData.outcome}
 onChange={(e) => setFeedbackFormData({ ...feedbackFormData, outcome: e.target.value as 'positive' | 'neutral' | 'negative' | 'sale' | 'no_interest' })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="positive">Positivo</option>
 <option value="neutral">Neutro</option>
 <option value="negative">Negativo</option>
 <option value="sale">Venda Realizada</option>
 <option value="no_interest">Sem Interesse</option>
 </select>
 </div>
 <div className="flex gap-2 pt-2">
 <button
 onClick={async () => {
 const success = await dataService.updateCustomerFeedback(editingFeedback.id, {
 rating: feedbackFormData.rating,
 feedback: feedbackFormData.feedback,
 outcome: feedbackFormData.outcome
 });
 if (success) {
 setCustomerFeedbacks(prev => prev.map(f =>
 f.id === editingFeedback.id
 ? { ...f, rating: feedbackFormData.rating, feedback: feedbackFormData.feedback, outcome: feedbackFormData.outcome }
 : f
 ));
 setEditingFeedback(null);
 if (showToast) {
 showToast('Feedback atualizado com sucesso', 'success');
 }
 } else {
 if (showToast) {
 showToast('Erro ao atualizar feedback', 'error');
 }
 }
 }}
 className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium"
 >
 Guardar
 </button>
 <button
 onClick={() => setEditingFeedback(null)}
 className="px-4 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Modal de Detalhes do Pedido */}
 {selectedOrder && (
 <div className={`fixed inset-0 min-h-screen min-w-full modal-overlay z-[60] flex ${isMobile ? '' : 'items-center justify-center p-4'} transition-opacity duration-300`} onClick={() => setSelectedOrder(null)}>
 <div className={`bg-surface-raised/95 backdrop-blur-xl ${isMobile ? 'w-full h-full' : 'rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh]'} border border-white/20 overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
 <div className={`sticky top-0 bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-900/80 dark:to-gray-900/60 backdrop-blur-md border-b border-border-default/50 ${isMobile ? 'p-3' : 'p-4 sm:p-6'} flex justify-between items-start z-10`}>
 <div>
 <h3 className="text-xl font-bold text-content-primary">
 Pedido #{selectedOrder.externalId || selectedOrder.id.slice(-6)}
 </h3>
 <p className="text-sm text-content-muted mt-1">
 {formatDateTimeLong(selectedOrder.createdAt)}
 </p>
 </div>
 <button
 onClick={() => setSelectedOrder(null)}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-6 h-6" />
 </button>
 </div>

 <div className="p-4 sm:p-6 space-y-6">
 {/* Informações do Cliente */}
 <div>
 <h4 className="font-semibold text-content-primary mb-2">Cliente</h4>
 <p className="text-content-secondary">{selectedOrder.customerName || customer.name}</p>
 {selectedOrder.customerPhone && (
 <p className="text-sm text-content-muted mt-1">{selectedOrder.customerPhone}</p>
 )}
 </div>

 {/* Itens do Pedido */}
 <div>
 <h4 className="font-semibold text-content-primary mb-3">Itens ({selectedOrder.items?.length || 0})</h4>
 <div className="space-y-2">
 {selectedOrder.items && selectedOrder.items.length > 0 ? (
 selectedOrder.items.map((item, index) => (
 <div key={index} className="border border-border-default rounded-lg p-3">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <p className="font-medium text-content-primary">{item.productName}</p>
 {item.variant && (
 <p className="text-sm text-content-muted">Variação: {item.variant}</p>
 )}
 </div>
 <div className="text-right">
 <p className="font-bold text-content-primary">
 {formatMoney((item.price || 0) * (item.quantity || 0))}
 </p>
 <p className="text-sm text-content-muted">
 {item.quantity || 0} {item.unit || 'un'} é— {formatMoney(item.price || 0)}
 </p>
 </div>
 </div>
 </div>
 ))
 ) : (
 <p className="text-content-muted text-sm">Nenhum item disponé­vel</p>
 )}
 </div>
 </div>

 {/* Resumo */}
 <div className="border-t border-border-default pt-4">
 <div className="flex justify-between items-center mb-2">
 <span className="text-content-secondary">Subtotal</span>
 <span className="font-semibold text-content-primary">{formatMoney(selectedOrder.totalAmount)}</span>
 </div>
 {selectedOrder.deliveryFee && selectedOrder.deliveryFee > 0 && (
 <div className="flex justify-between items-center mb-2">
 <span className="text-content-secondary">Taxa de Entrega</span>
 <span className="font-semibold text-content-primary">{formatMoney(selectedOrder.deliveryFee)}</span>
 </div>
 )}
 <div className="flex justify-between items-center pt-2 border-t border-border-default">
 <span className="text-lg font-bold text-content-primary">Total</span>
 <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
 {formatMoney(selectedOrder.totalAmount + (selectedOrder.deliveryFee || 0))}
 </span>
 </div>
 </div>

 {/* Status e Notas */}
 {selectedOrder.status && (
 <div className="bg-surface-base/50 rounded-lg p-4">
 <h4 className="font-semibold text-content-primary mb-2">Status</h4>
 <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
 {selectedOrder.status}
 </span>
 </div>
 )}
 {selectedOrder.notes && (
 <div className="bg-surface-base/50 rounded-lg p-4">
 <h4 className="font-semibold text-content-primary mb-2">Notas</h4>
 <p className="text-sm text-content-secondary whitespace-pre-wrap">{selectedOrder.notes}</p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </>
 );
};


