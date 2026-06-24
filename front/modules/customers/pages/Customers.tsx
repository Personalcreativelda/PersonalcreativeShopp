import React, { useState, useMemo, useEffect } from 'react';
import { Customer, LoyaltyTier, Order, CustomerAction, CustomerFeedback, CustomerInsight, ActionType, ActionStatus, OrderStatus, type User } from '../../core/types/types';
import { Search, Award, Phone, Mail, MapPin, ChevronRight, History, ArrowDown, ArrowUp, Edit2, Trash2, Filter, X, ChevronLeft, ChevronsLeft, ChevronsRight, CheckSquare, Square, RefreshCw, MessageCircle, Save, Download, UserPlus, Calendar, Users, Merge, BarChart3, LayoutGrid, Table, FileSpreadsheet, FileText, AlertTriangle, Clock, CheckCircle, XCircle, Target, Plus, User as UserIcon } from 'lucide-react';
import { dataService } from '../../core/services/dataService';
import { Toast } from '../../core/components/ui/Toast';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';
import { CustomerDetailModal } from '../../core/components/modals/CustomerDetailModal';
import { useMobile } from '../../core/hooks/useMobile';
import { PageShell } from '../../core/components/layout/PageShell';
import { Tooltip } from '../../core/components/ui/Tooltip';
import { FilterBar, SearchInput, ViewModeToggle, SelectFilter, ItemsPerPageSelect, Pagination } from '../../core/components/filters';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { createWorkbook, addWorksheet, addRowsFromJson, writeWorkbookToFile } from '../../core/services/excelService';
import jsPDF from 'jspdf';
import { addPDFHeader, addPDFFooter, getBrandColors, calculateColumnWidths, addPDFTableHeader, addPDFTableRow } from '../../core/services/reportService';
import { normalizeForSearch, normalizeOrderStatus } from '../../core/services/serviceUtils';
import { getTodayDateString, toDateStringInTimezone } from '../../core/utils/dateUtils';
import { useTrackAction } from '../../auth/components/TrackedPage';

interface CustomersProps {
 customers: Customer[];
 orders: Order[];
 totalCustomersCount?: number | null;
 onDeleteCustomer?: (customerId: string) => void;
 onDeleteCustomers?: (customerIds: string[]) => void;
 onUpdateCustomer?: (customer: Customer) => void;
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
 onReloadData?: () => void;
 currentUser?: User | null;
}

type SortField = 'name' | 'spent' | 'orders' | 'date' | 'risk' | 'daysSince' | 'lastAction';

export const Customers: React.FC<CustomersProps> = ({ 
 customers, 
 orders,
 totalCustomersCount,
 onDeleteCustomer,
 onDeleteCustomers,
 onUpdateCustomer,
 showToast,
 onReloadData,
 currentUser
}) => {
 // Hook para detectar mobile
 const isMobile = useMobile(768);
 const trackAction = useTrackAction();

 const [searchTerm, setSearchTerm] = useState('');
 const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
 const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
 const [sortField, setSortField] = useState<SortField>('date');
 const [sortDesc, setSortDesc] = useState(true); // true = mais recente primeiro
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [showFilters, setShowFilters] = useState(false);
 const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(100);
 const [isDeleting, setIsDeleting] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [showMergeModal, setShowMergeModal] = useState(false);
 const [duplicateGroups, setDuplicateGroups] = useState<Array<{ customers: Customer[]; reason: string }>>([]);
 const [isMerging, setIsMerging] = useState(false);
 const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
 const [showActionModal, setShowActionModal] = useState(false);
 const [selectedActionCustomer, setSelectedActionCustomer] = useState<Customer | null>(null);
 // Confirmation Dialog
 const [confirmDialog, setConfirmDialog] = useState<{
 isOpen: boolean;
 message: string;
 onConfirm: () => void;
 variant?: 'danger' | 'warning' | 'info';
 }>({
 isOpen: false,
 message: '',
 onConfirm: () => {},
 variant: 'warning'
 });

 // Filtros
 const [filterTier, setFilterTier] = useState<LoyaltyTier | 'all'>('all');
 const [filterMinSpent, setFilterMinSpent] = useState('');
 const [filterMaxSpent, setFilterMaxSpent] = useState('');
 const [filterMinOrders, setFilterMinOrders] = useState('');
 const [filterMaxOrders, setFilterMaxOrders] = useState('');
 const [filterHasOrders, setFilterHasOrders] = useState<'all' | 'with' | 'without'>('all');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('thisYear');
 const [filterDateFrom, setFilterDateFrom] = useState('');
 const [filterDateTo, setFilterDateTo] = useState('');
 
 // Novos filtros de fidelização e ações
 const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');
 const [filterDaysSince, setFilterDaysSince] = useState<'all' | '30' | '60' | '90' | '180'>('all');
 const [filterHasNotes, setFilterHasNotes] = useState<'all' | 'yes' | 'no'>('all');
 const [filterHasActions, setFilterHasActions] = useState<'all' | 'yes' | 'no'>('all');
 const [filterLastActionType, setFilterLastActionType] = useState<string>('ALL');
 const [filterLastActionStatus, setFilterLastActionStatus] = useState<string>('ALL');
 const [filterPendingActions, setFilterPendingActions] = useState<'all' | 'yes' | 'no'>('all');
 
 // Dados adicionais para fidelização e ações
 const [customerActions, setCustomerActions] = useState<CustomerAction[]>([]);
 const [customerFeedbacks, setCustomerFeedbacks] = useState<CustomerFeedback[]>([]);
 const [customerInsights, setCustomerInsights] = useState<CustomerInsight[]>([]);
 const [loadingActions, setLoadingActions] = useState(false);
 const [loadingInsights, setLoadingInsights] = useState(false);

 // Funções auxiliares para cálculos
 const getCustomerDaysSince = (customer: Customer): number => {
 if (!customer.lastOrderDate) {
 return customer.totalOrders === 0 ? Infinity : 0;
 }
 const lastOrder = new Date(customer.lastOrderDate);
 const now = new Date();
 return Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
 };

 const getCustomerRiskLevel = (customer: Customer): 'low' | 'medium' | 'high' => {
 const daysSince = getCustomerDaysSince(customer);
 if (daysSince === Infinity || daysSince > 90 || customer.totalOrders === 0) {
 return 'high';
 } else if (daysSince > 60) {
 return 'medium';
 }
 return 'low';
 };

 const getCustomerLastAction = (customerId: string): CustomerAction | null => {
 const actions = customerActions.filter(a => a.customerId === customerId);
 if (actions.length === 0) return null;
 return actions.sort((a, b) => {
 const dateA = new Date(a.completedDate || a.scheduledDate || a.createdAt).getTime();
 const dateB = new Date(b.completedDate || b.scheduledDate || b.createdAt).getTime();
 return dateB - dateA;
 })[0];
 };

 const getCustomerPendingActionsCount = (customerId: string): number => {
 return customerActions.filter(a => 
 a.customerId === customerId && 
 (a.status === ActionStatus.PENDING || a.status === ActionStatus.IN_PROGRESS)
 ).length;
 };

 // Função auxiliar para obter intervalo de datas do período
 // Enriquecer clientes com lastOrderDate derivado de orders quando ausente (para cálculo correto de risco e tempo)
 const customersWithLastOrder = useMemo(() => {
 return customers.map(c => {
 if (c.lastOrderDate) return c;
 const customerOrders = orders.filter(o => o.customerId === c.id && normalizeOrderStatus(o) !== OrderStatus.CANCELLED);
 const mostRecent = customerOrders.sort((a, b) =>
 new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
 )[0];
 return { ...c, lastOrderDate: mostRecent?.createdAt };
 });
 }, [customers, orders]);

 const getDateRangeFromPeriod = (period: PeriodOption, customStart?: string, customEnd?: string): { start: Date; end: Date } => {
 const today = new Date();
 let start = new Date();
 let end = new Date();

 switch (period) {
 case 'today':
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 case 'yesterday':
 start.setDate(today.getDate() - 1);
 start.setHours(0, 0, 0, 0);
 end.setDate(today.getDate() - 1);
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisWeek': {
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
 start.setDate(diff);
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 }
 case 'thisMonth':
 start = new Date(today.getFullYear(), today.getMonth(), 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
 end.setTime(lastDayOfMonth.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'lastWeek': {
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
 start.setDate(diff);
 start.setHours(0, 0, 0, 0);
 end.setDate(diff + 6);
 end.setHours(23, 59, 59, 999);
 break;
 }
 case 'lastMonth':
 start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
 end.setTime(lastDayOfLastMonth.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisYear':
 start = new Date(today.getFullYear(), 0, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfYear = new Date(today.getFullYear(), 11, 31);
 end.setTime(lastDayOfYear.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'lastYear':
 start = new Date(today.getFullYear() - 1, 0, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
 end.setTime(lastDayLastYear.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'custom':
 if (customStart && customEnd) {
 start = new Date(customStart);
 start.setHours(0, 0, 0, 0);
 end = new Date(customEnd);
 end.setHours(23, 59, 59, 999);
 } else {
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 }
 break;
 }

 return { start, end };
 };

 // Aplicar filtros
 const filteredCustomers = useMemo(() => {
 return customersWithLastOrder.filter(c => {
 // Filtro de pesquisa (expandido para incluir ID e notas)
 const norm = normalizeForSearch(searchTerm);
 const matchesSearch = searchTerm === '' || 
 normalizeForSearch(c.name).includes(norm) ||
 normalizeForSearch(c.phone || '').includes(norm) ||
 (c.email && normalizeForSearch(c.email).includes(norm)) ||
 normalizeForSearch(c.id).includes(norm) ||
 (c.notes && normalizeForSearch(c.notes).includes(norm));

 // Filtro de tier
 const matchesTier = filterTier === 'all' || c.tier === filterTier;

 // Filtro de gastos
 const minSpent = filterMinSpent ? parseFloat(filterMinSpent) : 0;
 const maxSpent = filterMaxSpent ? parseFloat(filterMaxSpent) : Infinity;
 const matchesSpent = c.totalSpent >= minSpent && c.totalSpent <= maxSpent;

 // Filtro de pedidos
 const minOrders = filterMinOrders ? parseInt(filterMinOrders) : 0;
 const maxOrders = filterMaxOrders ? parseInt(filterMaxOrders) : Infinity;
 const matchesOrders = c.totalOrders >= minOrders && c.totalOrders <= maxOrders;

 // Filtro de clientes com/sem pedidos
 const matchesHasOrders = 
 filterHasOrders === 'all' ||
 (filterHasOrders === 'with' && c.totalOrders > 0) ||
 (filterHasOrders === 'without' && c.totalOrders === 0);

 // Filtro por data do último pedido usando período
 let matchesDate = true;
 if (!c.lastOrderDate) {
 matchesDate = false; // Cliente sem pedidos não passa no filtro de data
 } else {
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const lastOrderDate = new Date(c.lastOrderDate);
 lastOrderDate.setHours(0, 0, 0, 0);
 const normalizedStart = new Date(start);
 normalizedStart.setHours(0, 0, 0, 0);
 const normalizedEnd = new Date(end);
 normalizedEnd.setHours(23, 59, 59, 999);
 matchesDate = lastOrderDate >= normalizedStart && lastOrderDate <= normalizedEnd;
 }

 // Filtro de risco de churn
 let matchesRisk = true;
 if (filterRisk !== 'all') {
 const riskLevel = getCustomerRiskLevel(c);
 matchesRisk = riskLevel === filterRisk;
 }

 // Filtro de dias sem comprar
 let matchesDaysSince = true;
 if (filterDaysSince !== 'all') {
 const daysSince = getCustomerDaysSince(c);
 const threshold = parseInt(filterDaysSince);
 matchesDaysSince = daysSince >= threshold;
 }

 // Filtro de notas
 let matchesNotes = true;
 if (filterHasNotes !== 'all') {
 const hasNotes = !!(c.notes && c.notes.trim().length > 0);
 matchesNotes = filterHasNotes === 'yes' ? hasNotes : !hasNotes;
 }

 // Filtro de ações comerciais
 let matchesActions = true;
 if (filterHasActions !== 'all') {
 const hasActions = customerActions.some(a => a.customerId === c.id);
 matchesActions = filterHasActions === 'yes' ? hasActions : !hasActions;
 }

 // Filtro de tipo de última ação
 let matchesLastActionType = true;
 if (filterLastActionType !== 'ALL') {
 const lastAction = getCustomerLastAction(c.id);
 matchesLastActionType = lastAction ? lastAction.type === filterLastActionType : false;
 }

 // Filtro de status da última ação
 let matchesLastActionStatus = true;
 if (filterLastActionStatus !== 'ALL') {
 const lastAction = getCustomerLastAction(c.id);
 matchesLastActionStatus = lastAction ? lastAction.status === filterLastActionStatus : false;
 }

 // Filtro de ações pendentes
 let matchesPendingActions = true;
 if (filterPendingActions !== 'all') {
 const pendingCount = getCustomerPendingActionsCount(c.id);
 matchesPendingActions = filterPendingActions === 'yes' ? pendingCount > 0 : pendingCount === 0;
 }

 return matchesSearch && matchesTier && matchesSpent && matchesOrders && matchesHasOrders && matchesDate &&
 matchesRisk && matchesDaysSince && matchesNotes && matchesActions && matchesLastActionType && 
 matchesLastActionStatus && matchesPendingActions;
 });
 }, [customersWithLastOrder, searchTerm, filterTier, filterMinSpent, filterMaxSpent, filterMinOrders, filterMaxOrders, filterHasOrders, filterPeriod, filterDateFrom, filterDateTo, filterRisk, filterDaysSince, filterHasNotes, filterHasActions, filterLastActionType, filterLastActionStatus, filterPendingActions, customerActions]);

 // Ordenação
 const sortedCustomers = useMemo(() => {
 return [...filteredCustomers].sort((a, b) => {
 let valA, valB;
 switch (sortField) {
 case 'name': 
 valA = a.name; valB = b.name; 
 return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
 case 'spent':
 valA = a.totalSpent || 0; valB = b.totalSpent || 0;
 break;
 case 'orders':
 valA = a.totalOrders || 0; valB = b.totalOrders || 0;
 break;
 case 'date':
 valA = new Date(a.lastOrderDate || 0).getTime(); valB = new Date(b.lastOrderDate || 0).getTime();
 break;
 case 'risk':
 const riskOrder = { 'high': 3, 'medium': 2, 'low': 1 };
 valA = riskOrder[getCustomerRiskLevel(a)]; valB = riskOrder[getCustomerRiskLevel(b)];
 break;
 case 'daysSince':
 valA = getCustomerDaysSince(a); valB = getCustomerDaysSince(b);
 break;
 case 'lastAction':
 const lastActionA = getCustomerLastAction(a.id);
 const lastActionB = getCustomerLastAction(b.id);
 valA = lastActionA ? new Date(lastActionA.completedDate || lastActionA.scheduledDate || lastActionA.createdAt).getTime() : 0;
 valB = lastActionB ? new Date(lastActionB.completedDate || lastActionB.scheduledDate || lastActionB.createdAt).getTime() : 0;
 break;
 default: return 0;
 }
 return sortDesc ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
 });
 }, [filteredCustomers, sortField, sortDesc, customerActions]);

 // Paginação
 const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
 const startIndex = (currentPage - 1) * itemsPerPage;
 const endIndex = startIndex + itemsPerPage;
 const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

 // Resetar página quando filtros mudarem
 useEffect(() => {
 setCurrentPage(1);
 }, [searchTerm, filterTier, filterMinSpent, filterMaxSpent, filterMinOrders, filterMaxOrders, filterHasOrders, filterPeriod, filterDateFrom, filterDateTo, itemsPerPage]);

 // Carregar dados adicionais (ações, feedbacks, insights)
 useEffect(() => {
 let isMounted = true;
 
 const loadData = async () => {
 if (!currentUser?.id) return;
 
 setLoadingActions(true);
 setLoadingInsights(true);
 
 try {
 const [actions, feedbacks, insights] = await Promise.all([
 dataService.getCustomerActions(),
 dataService.getCustomerFeedbacks(),
 dataService.getCustomerInsights(30)
 ]);
 
 if (isMounted) {
 setCustomerActions(actions || []);
 setCustomerFeedbacks(feedbacks || []);
 setCustomerInsights(insights || []);
 }
 } catch (error: any) {
 console.error('Erro ao carregar dados adicionais:', error);
 // Não mostrar toast para não poluir a interface
 } finally {
 if (isMounted) {
 setLoadingActions(false);
 setLoadingInsights(false);
 }
 }
 };
 
 loadData();
 
 return () => {
 isMounted = false;
 };
 }, [currentUser?.id]);


 // ── Sistema de Medalhas (igual ao painel do cliente) ──────────────────────
 const MEDALS = [
 { label: 'Semente', emoji: '🌱', min: 0, max: 99, gradient: 'from-amber-400 to-yellow-500', textColor: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
 { label: 'Raiz', emoji: '🌿', min: 100, max: 299, gradient: 'from-green-400 to-green-500', textColor: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/20', badge: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
 { label: 'Broto', emoji: '🌾', min: 300, max: 699, gradient: 'from-emerald-400 to-teal-500', textColor: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-900/20', badge: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' },
 { label: 'Flor', emoji: '🌸', min: 700, max: 1499, gradient: 'from-pink-400 to-rose-500', textColor: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 dark:bg-pink-900/20', badge: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700' },
 { label: 'Planta Mestre', emoji: '🌳', min: 1500, max: Infinity, gradient: 'from-green-600 to-emerald-700', textColor: 'text-green-800 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', badge: 'bg-green-200 text-green-900 border-green-400 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
 ];

 const getMedal = (totalSpent: number) => {
 const pts = Math.floor((totalSpent || 0) / 10);
 return MEDALS.find(m => pts >= m.min && pts <= m.max) || MEDALS[0];
 };

 // Manter retrocompatibilidade com código que usa getTierColor/getTierIcon
 const getTierColor = (tier: LoyaltyTier) => {
 const fallback = { bg: 'bg-surface-base', text: 'text-content-secondary', border: 'border-border-default', badge: 'bg-surface-base text-content-secondary ', card: 'bg-surface-base border-border-default' };
 return fallback;
 };
 const getTierIcon = (_tier: LoyaltyTier) => '⭐';

 const handleRecalculateTiers = async () => {
 setIsRecalculating(true);
 try {
 let updated = 0;
 const errors: string[] = [];

 for (const customer of customers) {
 const customerOrders = orders.filter(o => o.customerId === customer.id);
 const totalOrders = customerOrders.length;
 const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);

 // Calcular tier correto
 let newTier: LoyaltyTier;
 if (totalOrders > 15 || totalSpent > 20000) {
 newTier = LoyaltyTier.GOLD;
 } else if (totalOrders > 5 || totalSpent > 5000) {
 newTier = LoyaltyTier.SILVER;
 } else {
 newTier = LoyaltyTier.BRONZE;
 }

 // Atualizar se mudou
 if (customer.tier !== newTier) {
 const success = await dataService.updateCustomer(customer.id, { tier: newTier });
 if (success) {
 updated++;
 } else {
 errors.push(customer.name);
 }
 }
 }

 if (updated > 0 || errors.length > 0) {
 showToast(
 `${updated} cliente(s) atualizado(s).${errors.length > 0 ? ` ${errors.length} erro(s).` : ''}`,
 errors.length > 0 ? 'warning' : 'success'
 );
 // Recarregar dados
 if (onReloadData) {
 setTimeout(() => onReloadData(), 1000);
 }
 } else {
 showToast('Todos os clientes já estão com a classificação correta', 'info');
 }
 } catch (error: any) {
 showToast('Erro ao recalcular tiers: ' + (error.message || 'Erro desconhecido'), 'error');
 } finally {
 setIsRecalculating(false);
 }
 };

 // Função para formatar moeda
 const formatMoney = (value: number) => {
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 // Função para exportar clientes para Excel
 const exportToExcel = async () => {
 try {
 if (sortedCustomers.length === 0) {
 showToast('Não há clientes para exportar', 'warning');
 return;
 }

 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 // Preparar dados para exportação
 const exportData = sortedCustomers.map(c => {
 const lastAction = getCustomerLastAction(c.id);
 const riskLevel = getCustomerRiskLevel(c);
 const daysSince = getCustomerDaysSince(c);
 const pendingCount = getCustomerPendingActionsCount(c.id);
 
 return {
 'Nome': c.name,
 'Telefone': c.phone,
 'Email': c.email || '',
 'Endereço': c.address || '',
 'Nível Fidelização': c.tier,
 'Total Gasto': c.totalSpent || 0,
 'Pedidos': c.totalOrders || 0,
 'Último Pedido': c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('pt-PT') : '',
 'Dias sem Comprar': daysSince === Infinity ? 'Nunca' : daysSince.toString(),
 'Risco de Churn': riskLevel === 'high' ? 'Alto' : riskLevel === 'medium' ? 'Médio' : 'Baixo',
 'Última Ação': lastAction ? `${lastAction.type} (${new Date(lastAction.completedDate || lastAction.scheduledDate || lastAction.createdAt).toLocaleDateString('pt-PT')})` : '',
 'Ações Pendentes': pendingCount > 0 ? pendingCount.toString() : '0',
 'Notas': (c.notes || '').replace(/\n/g, ' ')
 };
 });

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Clientes');
 addRowsFromJson(ws, exportData as Record<string, unknown>[]);
 [25, 15, 30, 40, 18, 15, 12, 15, 15, 15, 30, 15, 40].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 const periodLabel = filterPeriod === 'custom' 
 ? `${startStr}_${endStr}`
 : filterPeriod;
 const filename = `clientes_${periodLabel}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação para Excel concluída: ${sortedCustomers.length} clientes`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 // Função para exportar clientes para PDF
 const exportToPDF = async () => {
 try {
 if (sortedCustomers.length === 0) {
 showToast('Não há clientes para exportar', 'warning');
 return;
 }

 showToast('Gerando PDF...', 'info');

 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar informações do período e filtros
 const periodLabel = filterPeriod === 'custom'
 ? `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`
 : filterPeriod === 'today' ? 'Hoje'
 : filterPeriod === 'yesterday' ? 'Ontem'
 : filterPeriod === 'thisWeek' ? 'Esta Semana'
 : filterPeriod === 'thisMonth' ? 'Este Mês'
 : filterPeriod === 'lastMonth' ? 'Mês Anterior'
 : filterPeriod === 'thisYear' ? 'Este Ano'
 : 'Todos';

 const filters: Array<{ label: string; value: string }> = [];
 if (searchTerm.trim()) {
 filters.push({ label: 'Pesquisa', value: searchTerm });
 }
 if (filterTier !== 'all') {
 filters.push({ label: 'Tier', value: filterTier });
 }
 filters.push({ label: 'Total de clientes', value: sortedCustomers.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Lista de Clientes', {
 period: periodLabel,
 filters,
 orientation: 'landscape',
 });

 // Tabela de clientes com branding
 // Calcular largura disponível e proporções das colunas
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = [2.5, 1.5, 1.0, 1.2, 1.0, 1.0, 0.8, 1.0, 0.8]; // 9 colunas
 const colWidths = calculateColumnWidths(availableWidth, colProportions);
 
 // Calcular posições X das colunas
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 const headers = ['Nome', 'Telefone', 'Tier', 'Total Gasto', 'Pedidos', 'Último Pedido', 'Risco', 'Dias sem Comprar', 'Ações Pendentes'];
 yPos = addPDFTableHeader(pdf, headers, colX, yPos, margin, pdfWidth);

 // Dados da tabela com alternância de cores
 sortedCustomers.forEach((customer, index) => {
 // Verificar se precisa de nova página
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 // Repetir cabeçalho em nova página
 yPos = addPDFTableHeader(pdf, headers, colX, yPos, margin, pdfWidth);
 }

 const maxNameLength = Math.floor(colWidths[0] / 2);
 const maxPhoneLength = Math.floor(colWidths[1] / 2);
 const riskLevel = getCustomerRiskLevel(customer);
 const daysSince = getCustomerDaysSince(customer);
 const pendingCount = getCustomerPendingActionsCount(customer.id);

 const rowData = [
 customer.name.length > maxNameLength ? customer.name.substring(0, maxNameLength - 3) + '...' : customer.name,
 customer.phone.length > maxPhoneLength ? customer.phone.substring(0, maxPhoneLength - 3) + '...' : customer.phone,
 customer.tier,
 formatMoney(customer.totalSpent || 0),
 (customer.totalOrders || 0).toString(),
 customer.lastOrderDate 
 ? new Date(customer.lastOrderDate).toLocaleDateString('pt-PT')
 : '-',
 riskLevel === 'high' ? 'Alto' : riskLevel === 'medium' ? 'Médio' : 'Baixo',
 daysSince === Infinity ? 'Nunca' : daysSince.toString(),
 pendingCount > 0 ? pendingCount.toString() : '0'
 ];

 yPos = addPDFTableRow(pdf, rowData, colX, yPos, index, margin, pdfWidth, {
 fontSize: 8,
 alternateColors: true,
 });
 });

 // Rodapé com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Gerar nome do arquivo
 const periodLabelFile = filterPeriod === 'custom' 
 ? `${toDateStringInTimezone(start)}_${toDateStringInTimezone(end)}`
 : filterPeriod;
 const filename = `clientes_${periodLabelFile}_${getTodayDateString()}.pdf`;

 // Salvar arquivo
 pdf.save(filename);
 showToast(`Exportação para PDF concluída: ${sortedCustomers.length} clientes`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 // Função para criar novo cliente
 const handleCreateCustomer = () => {
 const newCustomer: Customer = {
 id: '',
 name: '',
 phone: '',
 email: '',
 address: '',
 totalOrders: 0,
 totalSpent: 0,
 tier: LoyaltyTier.BRONZE,
 notes: '',
 lastOrderDate: ''
 };
 setEditingCustomer(newCustomer);
 };

 const SortIcon = ({ field }: { field: SortField }) => {
 if (sortField !== field) return null;
 return sortDesc ? <ArrowDown className="w-3 h-3 ml-1 inline" /> : <ArrowUp className="w-3 h-3 ml-1 inline" />;
 };

 const handleSort = (field: SortField) => {
 if (sortField === field) setSortDesc(!sortDesc);
 else {
 setSortField(field);
 setSortDesc(true);
 }
 };

 const handleSelectAll = () => {
 if (selectedIds.size === paginatedCustomers.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(paginatedCustomers.map(c => c.id)));
 }
 };

 const handleSelectCustomer = (customerId: string) => {
 const newSelected = new Set(selectedIds);
 if (newSelected.has(customerId)) {
 newSelected.delete(customerId);
 } else {
 newSelected.add(customerId);
 }
 setSelectedIds(newSelected);
 };

 const handleCreateBulkAction = async () => {
 if (selectedIds.size === 0 || !currentUser) return;
 
 setConfirmDialog({
 isOpen: true,
 message: `Deseja criar uma ação comercial para ${selectedIds.size} cliente${selectedIds.size > 1 ? 's' : ''} selecionado${selectedIds.size > 1 ? 's' : ''}?`,
 variant: 'info',
 onConfirm: async () => {
 setIsSaving(true);
 let successCount = 0;
 let errorCount = 0;
 
 for (const customerId of selectedIds) {
 try {
 const customer = customers.find(c => c.id === customerId);
 if (!customer) continue;
 
 const action = await dataService.createCustomerAction({
 customerId: customer.id,
 userId: currentUser.id,
 type: ActionType.PHONE_CALL,
 actionType: ActionType.PHONE_CALL,
 status: ActionStatus.PENDING,
 notes: `Ação criada em lote para ${customer.name}`,
 priority: 'medium',
 pointsEarned: 0
 });
 
 if (action) {
 successCount++;
 } else {
 errorCount++;
 }
 } catch (error) {
 console.error(`Erro ao criar ação para cliente ${customerId}:`, error);
 errorCount++;
 }
 }
 
 // Recarregar ações
 try {
 const actions = await dataService.getCustomerActions();
 setCustomerActions(actions || []);
 } catch (error) {
 console.error('Erro ao recarregar ações:', error);
 }
 
 setIsSaving(false);
 setSelectedIds(new Set());
 
 if (successCount > 0) {
 showToast(`${successCount} ação(ões) criada(s) com sucesso${errorCount > 0 ? `. ${errorCount} erro(s).` : '.'}`, errorCount > 0 ? 'warning' : 'success');
 } else {
 showToast('Erro ao criar ações', 'error');
 }
 }
 });
 };

 const handleBulkDelete = async () => {
 if (selectedIds.size === 0) return;
 
 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja apagar ${selectedIds.size} cliente${selectedIds.size > 1 ? 's' : ''}?\n\nEsta ação não pode ser desfeita.`,
 variant: 'danger',
 onConfirm: async () => {
 setIsDeleting(true);
 const idsToDelete = Array.from(selectedIds) as string[];
 trackAction('delete', { entity: 'customer', entityIds: idsToDelete });

 if (onDeleteCustomers) {
 onDeleteCustomers(idsToDelete);
 } else {
 await dataService.deleteCustomers(idsToDelete);
 }
 
 setSelectedIds(new Set());
 setIsDeleting(false);
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
 }
 });
 };

 const handleDelete = async (customerId: string, e: React.MouseEvent) => {
 e.stopPropagation();
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja apagar este cliente?\n\nEsta ação não pode ser desfeita.',
 variant: 'danger',
 onConfirm: async () => {
 trackAction('delete', { entity: 'customer', entityId: customerId });
 if (onDeleteCustomer) {
 onDeleteCustomer(customerId);
 } else {
 await dataService.deleteCustomer(customerId);
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
 }
 });
 };

 const handleEdit = (customer: Customer, e: React.MouseEvent) => {
 e.stopPropagation();
 setEditingCustomer({ ...customer });
 };

 const handleSaveEdit = async (formData: Customer) => {
 // Validações básicas
 if (!formData.name.trim()) {
 showToast('O nome é obrigatório', 'error');
 return;
 }

 setIsSaving(true);
 
 // Se não tem ID, é um novo cliente
 if (!formData.id) {
 const newCustomer = await dataService.addCustomer({
 name: formData.name,
 phone: formData.phone,
 email: formData.email,
 address: formData.address,
 notes: formData.notes
 });
 
 if (newCustomer) {
 trackAction('create', { entity: 'customer', entityId: newCustomer.id, changes: { name: newCustomer.name } });
 showToast('Cliente criado com sucesso', 'success');
 setEditingCustomer(null);
 if (onReloadData) {
 onReloadData();
 }
 } else {
 showToast('Erro ao criar cliente. Verifique se o telefone não está duplicado.', 'error');
 }
 } else {
 // Atualizar cliente existente
 const success = await dataService.updateCustomer(formData.id, formData);
 
 if (success) {
 trackAction('update', { entity: 'customer', entityId: formData.id, changes: { name: formData.name } });
 if (onUpdateCustomer) {
 onUpdateCustomer(formData);
 }
 setEditingCustomer(null);
 showToast('Cliente atualizado com sucesso', 'success');
 if (onReloadData) {
 onReloadData();
 }
 } else {
 showToast('Erro ao atualizar cliente', 'error');
 }
 }
 
 setIsSaving(false);
 };

 // Detectar clientes duplicados
 const detectDuplicates = () => {
 setIsDetectingDuplicates(true);
 try {
 const groups: Array<{ customers: Customer[]; reason: string }> = [];
 const processed = new Set<string>();

 // Agrupar por telefone (normalizado)
 const phoneMap = new Map<string, Customer[]>();
 customers.forEach(customer => {
 const normalizedPhone = customer.phone.replace(/\D/g, '');
 if (normalizedPhone.length >= 5) {
 if (!phoneMap.has(normalizedPhone)) {
 phoneMap.set(normalizedPhone, []);
 }
 phoneMap.get(normalizedPhone)!.push(customer);
 }
 });

 // Adicionar grupos com múltiplos clientes
 phoneMap.forEach((group, phone) => {
 if (group.length > 1) {
 groups.push({
 customers: group,
 reason: `Telefone: ${phone}`
 });
 group.forEach(c => processed.add(c.id));
 }
 });

 // Agrupar por nome similar (ignorando case e espaços)
 const nameMap = new Map<string, Customer[]>();
 customers.forEach(customer => {
 if (!processed.has(customer.id)) {
 const normalizedName = customer.name.toLowerCase().trim().replace(/\s+/g, ' ');
 if (!nameMap.has(normalizedName)) {
 nameMap.set(normalizedName, []);
 }
 nameMap.get(normalizedName)!.push(customer);
 }
 });

 // Adicionar grupos com múltiplos clientes
 nameMap.forEach((group, name) => {
 if (group.length > 1) {
 groups.push({
 customers: group,
 reason: `Nome: ${name}`
 });
 }
 });

 setDuplicateGroups(groups);
 setShowMergeModal(true);
 
 if (groups.length === 0) {
 showToast('Nenhum cliente duplicado encontrado', 'info');
 } else {
 showToast(`${groups.length} grupo(s) de clientes duplicados encontrado(s)`, 'success');
 }
 } catch (error: any) {
 showToast('Erro ao detectar duplicados: ' + (error.message || 'Erro desconhecido'), 'error');
 } finally {
 setIsDetectingDuplicates(false);
 }
 };

 // Mesclar clientes
 const handleMergeCustomers = async (primaryId: string, duplicateId: string) => {
 setIsMerging(true);
 try {
 const result = await dataService.mergeCustomers(primaryId, duplicateId);
 
 if (result.success) {
 showToast(
 `Clientes mesclados com sucesso! ${result.ordersTransferred} pedido(s) transferido(s).`,
 'success'
 );
 
 // Remover o grupo se não houver mais duplicados
 setDuplicateGroups(prev => 
 prev.map(group => ({
 ...group,
 customers: group.customers.filter(c => c.id !== duplicateId)
 })).filter(group => group.customers.length > 1)
 );
 
 if (onReloadData) {
 onReloadData();
 } else {
 setTimeout(() => window.location.reload(), 1000);
 }
 } else {
 showToast(`Erro ao mesclar clientes: ${result.error || 'Erro desconhecido'}`, 'error');
 }
 } catch (error: any) {
 showToast('Erro ao mesclar clientes: ' + (error.message || 'Erro desconhecido'), 'error');
 } finally {
 setIsMerging(false);
 }
 };

 // Componente CustomerDetail removido - agora usando CustomerDetailModal de ../components/CustomerDetailModal

 const EditModal = ({ customer }: { customer: Customer }) => {
 const [formData, setFormData] = useState<Customer>(customer);
 const [errors, setErrors] = useState<{ [key: string]: string }>({});
 const isNewCustomer = !customer.id;

 const validateForm = () => {
 const newErrors: { [key: string]: string } = {};
 if (!formData.name.trim()) {
 newErrors.name = 'Nome é obrigatório';
 }
 if (!formData.phone.trim()) {
 newErrors.phone = 'Telefone é obrigatório';
 } else if (!/^\d{9,15}$/.test(formData.phone.replace(/\D/g, ''))) {
 newErrors.phone = 'Telefone inválido';
 }
 if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
 newErrors.email = 'Email inválido';
 }
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleFieldChange = (field: keyof Customer, value: any) => {
 setFormData({ ...formData, [field]: value });
 if (errors[field]) {
 setErrors({ ...errors, [field]: '' });
 }
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4" onClick={() => setEditingCustomer(null)}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h2 className="text-xl font-bold text-content-primary">{isNewCustomer ? 'Novo Cliente' : 'Editar Cliente'}</h2>
 <button onClick={() => setEditingCustomer(null)} className="text-content-muted hover:text-content-secondary p-1">
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="space-y-3">
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <UserIcon className="w-3.5 h-3.5" />
 Nome *
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => handleFieldChange('name', e.target.value)}
 onBlur={validateForm}
 className={`w-full px-3 py-2 text-sm rounded-lg border ${
 errors.name ? 'border-red-500' : 'border-border-default'
 } focus:ring-2 focus:ring-brand-500 focus:border-transparent`}
 required
 />
 {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <Phone className="w-3.5 h-3.5" />
 Telefone (WhatsApp) *
 </label>
 <input
 type="text"
 value={formData.phone}
 onChange={(e) => handleFieldChange('phone', e.target.value)}
 onBlur={validateForm}
 className={`w-full px-3 py-2 text-sm rounded-lg border ${
 errors.phone ? 'border-red-500' : 'border-border-default'
 } focus:ring-2 focus:ring-brand-500 focus:border-transparent`}
 placeholder="258841234567"
 required
 />
 {errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone}</p>}
 <p className="text-[10px] text-content-muted mt-0.5">Código do país + número</p>
 </div>

 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <Mail className="w-3.5 h-3.5" />
 Email
 </label>
 <input
 type="email"
 value={formData.email || ''}
 onChange={(e) => handleFieldChange('email', e.target.value)}
 onBlur={validateForm}
 className={`w-full px-3 py-2 text-sm rounded-lg border ${
 errors.email ? 'border-red-500' : 'border-border-default'
 } focus:ring-2 focus:ring-brand-500 focus:border-transparent`}
 placeholder="cliente@email.com"
 />
 {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
 </div>
 </div>

 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <MapPin className="w-3.5 h-3.5" />
 Endereço
 </label>
 <input
 type="text"
 value={formData.address || ''}
 onChange={(e) => handleFieldChange('address', e.target.value)}
 className="w-full px-3 py-2 text-sm rounded-lg border border-border-default focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 placeholder="Endereço completo do cliente"
 />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <Award className="w-3.5 h-3.5" />
 Nível de Fidelização
 </label>
 <select
 value={formData.tier}
 onChange={(e) => handleFieldChange('tier', e.target.value as LoyaltyTier)}
 className="w-full px-3 py-2 text-sm rounded-lg border border-border-default focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 >
 <option value={LoyaltyTier.BRONZE}>Bronze</option>
 <option value={LoyaltyTier.SILVER}>Prata</option>
 <option value={LoyaltyTier.GOLD}>Ouro</option>
 </select>
 </div>
 </div>

 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <FileText className="w-3.5 h-3.5" />
 Notas
 </label>
 <textarea
 value={formData.notes || ''}
 onChange={(e) => handleFieldChange('notes', e.target.value)}
 rows={3}
 className="w-full px-3 py-2 text-sm rounded-lg border border-border-default focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
 placeholder="Adicione notas sobre este cliente..."
 />
 </div>
 </div>

 <div className="flex gap-2 mt-4 pt-4 border-t border-border-default">
 <button
 onClick={() => {
 if (validateForm()) {
 handleSaveEdit(formData);
 }
 }}
 disabled={isSaving}
 className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
 >
 {isSaving ? (
 <>
 <RefreshCw className="w-4 h-4 animate-spin" />
 A guardar...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Guardar
 </>
 )}
 </button>
 <button
 onClick={() => setEditingCustomer(null)}
 className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 );
 };

 // Verificar se há filtros ativos
 const hasActiveFilters = filterTier !== 'all' || filterMinSpent || filterMaxSpent || filterMinOrders || filterMaxOrders || filterHasOrders !== 'all' || filterPeriod !== 'thisYear' || filterDateFrom || filterDateTo || filterRisk !== 'all' || filterDaysSince !== 'all' || filterHasNotes !== 'all' || filterHasActions !== 'all' || filterLastActionType !== 'ALL' || filterLastActionStatus !== 'ALL' || filterPendingActions !== 'all';

 // Função para limpar filtros
 const clearFilters = () => {
 setFilterTier('all');
 setFilterMinSpent('');
 setFilterMaxSpent('');
 setFilterMinOrders('');
 setFilterMaxOrders('');
 setFilterHasOrders('all');
 setFilterPeriod('thisYear');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterRisk('all');
 setFilterDaysSince('all');
 setFilterHasNotes('all');
 setFilterHasActions('all');
 setFilterLastActionType('ALL');
 setFilterLastActionStatus('ALL');
 setFilterPendingActions('all');
 setSearchTerm('');
 setCurrentPage(1);
 };

 return (
 <PageShell
 title="Clientes"
 actions={
 <div className="flex items-center gap-2 flex-wrap">
 {selectedIds.size > 0 && (
 <>
 {currentUser && (
 <button
 onClick={handleCreateBulkAction}
 disabled={isSaving}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
 title="Criar ação comercial para clientes selecionados"
 >
 <Target className="w-4 h-4" />
 <span className="hidden sm:inline">Criar Ação ({selectedIds.size})</span>
 </button>
 )}
 <button
 onClick={handleBulkDelete}
 disabled={isDeleting}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
 >
 <Trash2 className="w-4 h-4" />
 <span className="hidden sm:inline">Apagar {selectedIds.size}</span>
 </button>
 </>
 )}
 <button
 onClick={handleCreateCustomer}
 className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
 title="Criar novo cliente"
 >
 <UserPlus className="w-4 h-4" />
 <span className="hidden sm:inline">Novo Cliente</span>
 </button>
 <button
 onClick={exportToExcel}
 className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar para Excel"
 >
 <FileSpreadsheet className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Excel</span>
 </button>
 <button
 onClick={exportToPDF}
 className="bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar para PDF"
 >
 <FileText className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">PDF</span>
 </button>
 <button
 onClick={detectDuplicates}
 disabled={isDetectingDuplicates}
 className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
 title="Detectar e mesclar clientes duplicados"
 >
 <Merge className={`w-4 h-4 ${isDetectingDuplicates ? 'animate-spin' : ''}`} />
 <span className="hidden sm:inline">{isDetectingDuplicates ? 'A detectar...' : 'Mesclar Duplicados'}</span>
 </button>
 {/* Botão Filtros - Apenas no Mobile */}
 {isMobile && (
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
 showFilters || hasActiveFilters
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-surface-overlay hover:bg-surface-base border border-border-default text-content-secondary hover:text-content-primary'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {hasActiveFilters && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {[filterTier !== 'all' ? 1 : 0, filterMinSpent ? 1 : 0, filterMaxSpent ? 1 : 0, filterMinOrders ? 1 : 0, filterMaxOrders ? 1 : 0, filterHasOrders !== 'all' ? 1 : 0, filterPeriod !== 'thisYear' ? 1 : 0, filterRisk !== 'all' ? 1 : 0, filterDaysSince !== 'all' ? 1 : 0, filterHasNotes !== 'all' ? 1 : 0, filterHasActions !== 'all' ? 1 : 0, filterLastActionType !== 'ALL' ? 1 : 0, filterLastActionStatus !== 'ALL' ? 1 : 0, filterPendingActions !== 'all' ? 1 : 0].filter(Boolean).length}
 </span>
 )}
 </button>
 )}
 </div>
 }
 >
 {/* Barra Integrada: Controles, Filtros e Ações - Uma Linha - Fixa no Mobile */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <ViewModeToggle
 value={viewMode === 'grid' ? 'cards' : 'table'}
 onChange={(mode) => setViewMode(mode === 'cards' ? 'grid' : 'list')}
 size="compact"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SearchInput
 value={searchTerm}
 onChange={(val) => setSearchTerm(val)}
 placeholder="Buscar por nome, telefone, email, ID ou notas..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 {/* Filtro Tier - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterTier}
 onChange={(val) => {
 setFilterTier(val as LoyaltyTier | 'all');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Tier' },
 { value: LoyaltyTier.BRONZE, label: 'Bronze' },
 { value: LoyaltyTier.SILVER, label: 'Prata' },
 { value: LoyaltyTier.GOLD, label: 'Ouro' }
 ]}
 placeholder="Tier"
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Filtro Risco - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterRisk}
 onChange={(val) => {
 setFilterRisk(val as 'all' | 'high' | 'medium' | 'low');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Risco' },
 { value: 'high', label: 'Alto' },
 { value: 'medium', label: 'Médio' },
 { value: 'low', label: 'Baixo' }
 ]}
 placeholder="Risco"
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Filtro Ações Pendentes - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterPendingActions}
 onChange={(val) => {
 setFilterPendingActions(val as 'all' | 'yes' | 'no');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Ações' },
 { value: 'yes', label: 'Com Pendentes' },
 { value: 'no', label: 'Sem Pendentes' }
 ]}
 placeholder="Ações"
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Filtro Dias sem Comprar - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterDaysSince}
 onChange={(val) => {
 setFilterDaysSince(val as 'all' | '30' | '60' | '90' | '180');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Dias' },
 { value: '30', label: '30+ dias' },
 { value: '60', label: '60+ dias' },
 { value: '90', label: '90+ dias' },
 { value: '180', label: '180+ dias' }
 ]}
 placeholder="Dias"
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Itens por página - Oculto no Mobile */}
 <div className="hidden sm:block">
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[25, 50, 100, 200, 500]}
 label=""
 size="compact"
 className="flex-shrink-0"
 />
 </div>

 {/* Filtro Período - Oculto no Mobile */}
 <div className="hidden sm:block flex-shrink-0 relative" style={{ zIndex: 50 }}>
 <PeriodFilter
 selectedPeriod={filterPeriod}
 onPeriodChange={(period) => {
 setFilterPeriod(period);
 if (period !== 'custom') {
 setFilterDateFrom('');
 setFilterDateTo('');
 }
 setCurrentPage(1);
 }}
 customStartDate={filterDateFrom}
 customEndDate={filterDateTo}
 onCustomDatesChange={(start, end) => {
 setFilterDateFrom(start);
 setFilterDateTo(end);
 setCurrentPage(1);
 }}
 />
 </div>

 {/* Botão Limpar Filtros - Oculto no Mobile */}
 {hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </FilterBar>

 {/* Painel de Filtros Mobile - Fixo quando aberto */}
 {isMobile && showFilters && (
 <div className="sticky top-[60px] z-20 bg-surface-raised rounded-xl shadow-lg border border-border-default p-4 mb-4">
 <div className="flex items-center justify-between mb-4">
 <h4 className="text-sm font-semibold text-content-primary">Filtros</h4>
 <button
 onClick={() => setShowFilters(false)}
 className="p-1 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-4 h-4 text-content-muted" />
 </button>
 </div>
 
 <div className="space-y-3">
 {/* Filtros lado a lado em grid 2 colunas */}
 <div className="grid grid-cols-2 gap-3">
 {/* Tier */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Tier
 </label>
 <SelectFilter
 value={filterTier}
 onChange={(val) => {
 setFilterTier(val as LoyaltyTier | 'all');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todos' },
 { value: LoyaltyTier.BRONZE, label: 'Bronze' },
 { value: LoyaltyTier.SILVER, label: 'Prata' },
 { value: LoyaltyTier.GOLD, label: 'Ouro' }
 ]}
 placeholder="Tier"
 className="w-full"
 size="md"
 />
 </div>

 {/* Itens por página */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Itens por página
 </label>
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[25, 50, 100, 200, 500]}
 label=""
 size="md"
 className="w-full"
 />
 </div>
 </div>

 {/* Período */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Período
 </label>
 <PeriodFilter
 selectedPeriod={filterPeriod}
 onPeriodChange={(period) => {
 setFilterPeriod(period);
 if (period !== 'custom') {
 setFilterDateFrom('');
 setFilterDateTo('');
 }
 setCurrentPage(1);
 }}
 customStartDate={filterDateFrom}
 customEndDate={filterDateTo}
 onCustomDatesChange={(start, end) => {
 setFilterDateFrom(start);
 setFilterDateTo(end);
 setCurrentPage(1);
 }}
 />
 </div>

 {/* Filtros Avançados */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Total Gasto (Mín)</label>
 <input
 type="number"
 value={filterMinSpent}
 onChange={(e) => setFilterMinSpent(e.target.value)}
 placeholder="0"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Total Gasto (Máx)</label>
 <input
 type="number"
 value={filterMaxSpent}
 onChange={(e) => setFilterMaxSpent(e.target.value)}
 placeholder="∞"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Nº de Pedidos (Mín)</label>
 <input
 type="number"
 value={filterMinOrders}
 onChange={(e) => setFilterMinOrders(e.target.value)}
 placeholder="0"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Nº de Pedidos (Máx)</label>
 <input
 type="number"
 value={filterMaxOrders}
 onChange={(e) => setFilterMaxOrders(e.target.value)}
 placeholder="∞"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Status de Pedidos</label>
 <select
 value={filterHasOrders}
 onChange={(e) => setFilterHasOrders(e.target.value as 'all' | 'with' | 'without')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="with">Com Pedidos</option>
 <option value="without">Sem Pedidos</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1 flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 Último Pedido (De)
 </label>
 <input
 type="date"
 value={filterDateFrom}
 onChange={(e) => setFilterDateFrom(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1 flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 Último Pedido (Até)
 </label>
 <input
 type="date"
 value={filterDateTo}
 onChange={(e) => setFilterDateTo(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 {/* Novos Filtros de Fidelização e Ações */}
 <div className="border-t border-border-default pt-3 mt-3">
 <h5 className="text-xs font-semibold text-content-secondary mb-3">Fidelização</h5>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Risco de Churn</label>
 <select
 value={filterRisk}
 onChange={(e) => setFilterRisk(e.target.value as 'all' | 'high' | 'medium' | 'low')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="high">Alto</option>
 <option value="medium">Médio</option>
 <option value="low">Baixo</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Dias sem Comprar</label>
 <select
 value={filterDaysSince}
 onChange={(e) => setFilterDaysSince(e.target.value as 'all' | '30' | '60' | '90' | '180')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="30">30+ dias</option>
 <option value="60">60+ dias</option>
 <option value="90">90+ dias</option>
 <option value="180">180+ dias</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Tem Notas</label>
 <select
 value={filterHasNotes}
 onChange={(e) => setFilterHasNotes(e.target.value as 'all' | 'yes' | 'no')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="yes">Sim</option>
 <option value="no">Não</option>
 </select>
 </div>
 </div>
 </div>

 <div className="border-t border-border-default pt-3 mt-3">
 <h5 className="text-xs font-semibold text-content-secondary mb-3">Ações Comerciais</h5>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Tem Ações</label>
 <select
 value={filterHasActions}
 onChange={(e) => setFilterHasActions(e.target.value as 'all' | 'yes' | 'no')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="yes">Sim</option>
 <option value="no">Não</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Ações Pendentes</label>
 <select
 value={filterPendingActions}
 onChange={(e) => setFilterPendingActions(e.target.value as 'all' | 'yes' | 'no')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="yes">Sim</option>
 <option value="no">Não</option>
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Tipo Última Ação</label>
 <select
 value={filterLastActionType}
 onChange={(e) => setFilterLastActionType(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="ALL">Todos</option>
 {Object.values(ActionType).map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Status Última Ação</label>
 <select
 value={filterLastActionStatus}
 onChange={(e) => setFilterLastActionStatus(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="ALL">Todos</option>
 {Object.values(ActionStatus).map(status => (
 <option key={status} value={status}>{status}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 </div>

 {/* Botão Limpar Filtros */}
 {hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="w-full px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors flex items-center justify-center gap-2"
 >
 <X className="w-4 h-4" />
 Limpar Filtros
 </button>
 )}
 </div>
 </div>
 )}

 {/* Painel de Filtros Avançados - Desktop */}
 {!isMobile && showFilters && (
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default p-4 mb-4">
 <div className="mb-3">
 <h4 className="text-sm font-semibold text-content-primary">Filtros Avançados</h4>
 <p className="text-xs text-content-muted">Filtros adicionais para busca mais específica</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Total Gasto (Mín)</label>
 <input
 type="number"
 value={filterMinSpent}
 onChange={(e) => setFilterMinSpent(e.target.value)}
 placeholder="0"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Total Gasto (Máx)</label>
 <input
 type="number"
 value={filterMaxSpent}
 onChange={(e) => setFilterMaxSpent(e.target.value)}
 placeholder="∞"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Nº de Pedidos (Mín)</label>
 <input
 type="number"
 value={filterMinOrders}
 onChange={(e) => setFilterMinOrders(e.target.value)}
 placeholder="0"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Nº de Pedidos (Máx)</label>
 <input
 type="number"
 value={filterMaxOrders}
 onChange={(e) => setFilterMaxOrders(e.target.value)}
 placeholder="∞"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Status de Pedidos</label>
 <select
 value={filterHasOrders}
 onChange={(e) => setFilterHasOrders(e.target.value as 'all' | 'with' | 'without')}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="with">Com Pedidos</option>
 <option value="without">Sem Pedidos</option>
 </select>
 </div>

 <div className="flex items-end">
 <button
 onClick={clearFilters}
 className="w-full px-4 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors text-sm"
 >
 Limpar Filtros
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Visualização - Cards ou Tabela */}
 {viewMode === 'grid' ? (
 /* Cards View */
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {paginatedCustomers.length === 0 ? (
 <div className="col-span-full text-center py-12 text-content-muted">
 Nenhum cliente encontrado
 </div>
 ) : (
 paginatedCustomers.map((customer) => {
 const isSelected = selectedIds.has(customer.id);
 
 return (
 <div
 key={customer.id}
 className={`bg-surface-raised rounded-lg p-4 shadow-sm border-2 transition-all cursor-pointer ${
 isSelected 
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20' 
 : 'border-border-default hover:border-brand-300 dark:hover:border-brand-600'
 }`}
 onClick={() => handleSelectCustomer(customer.id)}
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className="bg-brand-100 dark:bg-brand-900/30 rounded-full w-12 h-12 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-lg flex-shrink-0">
 {customer.name.charAt(0).toUpperCase()}
 </div>
 <div className="min-w-0 flex-1">
 <h3 className="font-semibold text-content-primary truncate">
 {customer.name}
 </h3>
 <p className="text-sm text-content-muted truncate">
 {customer.phone}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
 <button
 onClick={(e) => handleEdit(customer, e)}
 className="p-1.5 text-content-muted hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={(e) => handleDelete(customer.id, e)}
 className="p-1.5 text-content-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
 title="Apagar"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>

 <div className="space-y-2 mb-3">
 <div className="flex items-center justify-between">
 <span className="text-sm text-content-secondary">Fidelidade:</span>
 {(() => { const m = getMedal(customer.totalSpent); return (
 <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.badge}`}>
 {m.emoji} {m.label}
 </span>
 ); })()}
 </div>
 <div className="flex items-center justify-between pt-2 border-t border-border-default">
 <span className="text-sm text-content-secondary">Total Gasto:</span>
 <span className="font-semibold text-content-primary">
 {formatMoney(customer.totalSpent || 0)}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-content-secondary">Pedidos:</span>
 <span className="font-semibold text-content-primary">
 {customer.totalOrders || 0}
 </span>
 </div>
 {customer.lastOrderDate && (
 <div className="flex items-center justify-between pt-2 border-t border-border-default">
 <span className="text-sm text-content-secondary">Último Pedido:</span>
 <span className="text-sm text-content-secondary">
 {new Date(customer.lastOrderDate).toLocaleDateString('pt-PT')}
 </span>
 </div>
 )}
 {(() => {
 const lastAction = getCustomerLastAction(customer.id);
 if (lastAction) {
 const actionDate = new Date(lastAction.completedDate || lastAction.scheduledDate || lastAction.createdAt);
 const daysAgo = Math.floor((new Date().getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24));
 return (
 <div className="flex items-center justify-between pt-2 border-t border-border-default">
 <span className="text-sm text-content-secondary">Última Ação:</span>
 <span className="text-xs text-content-secondary">
 {lastAction.type} ({daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? '1d' : `${daysAgo}d`})
 </span>
 </div>
 );
 }
 return null;
 })()}
 <div className="flex items-center justify-between pt-2 border-t border-border-default">
 <span className="text-sm text-content-secondary">Risco:</span>
 {(() => {
 const riskLevel = getCustomerRiskLevel(customer);
 const riskColors = {
 high: 'text-red-600 dark:text-red-400',
 medium: 'text-yellow-600 dark:text-yellow-400',
 low: 'text-green-600 dark:text-green-400'
 };
 const riskIcons = {
 high: '🔴',
 medium: '🟡',
 low: '🟢'
 };
 return (
 <span className={`text-xs font-medium ${riskColors[riskLevel]}`}>
 {riskIcons[riskLevel]} {riskLevel === 'high' ? 'Alto' : riskLevel === 'medium' ? 'Médio' : 'Baixo'}
 </span>
 );
 })()}
 </div>
 {(() => {
 const daysSince = getCustomerDaysSince(customer);
 if (daysSince !== Infinity && daysSince > 0) {
 return (
 <div className="flex items-center justify-between pt-2 border-t border-border-default">
 <span className="text-sm text-content-secondary">Dias sem comprar:</span>
 <span className="text-xs text-content-secondary">
 {daysSince} dia{daysSince === 1 ? '' : 's'}
 </span>
 </div>
 );
 }
 return null;
 })()}
 {(() => {
 const pendingCount = getCustomerPendingActionsCount(customer.id);
 if (pendingCount > 0) {
 return (
 <div className="flex items-center justify-between pt-2 border-t border-border-default">
 <span className="text-sm text-content-secondary">Ações Pendentes:</span>
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
 {pendingCount}
 </span>
 </div>
 );
 }
 return null;
 })()}
 </div>

 <div className="flex items-center justify-between pt-3 border-t border-border-default">
 <div className="flex items-center gap-2">
 {currentUser && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSelectedActionCustomer(customer);
 setShowActionModal(true);
 }}
 className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"
 title="Criar ação comercial"
 >
 <Plus className="w-4 h-4" />
 </button>
 )}
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSelectedCustomer(customer);
 }}
 className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
 >
 Ver detalhes
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 <div
 onClick={(e) => {
 e.stopPropagation();
 handleSelectCustomer(customer.id);
 }}
 className="cursor-pointer"
 >
 {isSelected ? (
 <CheckSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
 ) : (
 <Square className="w-5 h-5 text-content-muted dark:text-content-secondary hover:text-content-muted" />
 )}
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>
 ) : (
 /* Table View */
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full text-left">
 <thead className="bg-surface-base border-b border-border-default sticky top-0 z-10">
 <tr>
 <th className="px-6 py-4">
 <button
 onClick={handleSelectAll}
 className="text-content-muted hover:text-content-secondary "
 >
 {selectedIds.size === paginatedCustomers.length && paginatedCustomers.length > 0 ? (
 <CheckSquare className="w-5 h-5" />
 ) : (
 <Square className="w-5 h-5" />
 )}
 </button>
 </th>
 <th className="px-6 py-4 font-semibold text-content-secondary text-sm cursor-pointer hover:bg-surface-base" onClick={() => handleSort('name')}>
 Cliente <SortIcon field="name" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs cursor-pointer hover:bg-surface-base" onClick={() => handleSort('tier')} title="Fidelização">
 <Award className="w-4 h-4 inline" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs cursor-pointer hover:bg-surface-base" onClick={() => handleSort('spent')}>
 Total <SortIcon field="spent" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs cursor-pointer hover:bg-surface-base" onClick={() => handleSort('orders')}>
 Ped. <SortIcon field="orders" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs hidden md:table-cell cursor-pointer hover:bg-surface-base" onClick={() => handleSort('date')} title="Último Pedido">
 <Calendar className="w-4 h-4 inline" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs hidden lg:table-cell cursor-pointer hover:bg-surface-base" onClick={() => handleSort('lastAction')} title="Última Ação">
 <History className="w-4 h-4 inline" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs hidden lg:table-cell cursor-pointer hover:bg-surface-base" onClick={() => handleSort('risk')} title="Risco">
 <AlertTriangle className="w-4 h-4 inline" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs hidden lg:table-cell cursor-pointer hover:bg-surface-base" onClick={() => handleSort('daysSince')} title="Dias sem Comprar">
 <Clock className="w-4 h-4 inline" />
 </th>
 <th className="px-4 py-3 font-semibold text-content-secondary text-xs hidden lg:table-cell" title="Ações Pendentes">
 <Target className="w-4 h-4 inline" />
 </th>
 <th className="px-6 py-4 font-semibold text-content-secondary text-sm">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default">
 {paginatedCustomers.map((customer) => (
 <tr 
 key={customer.id} 
 className={`hover:bg-surface-base/50 transition-colors ${
 selectedIds.has(customer.id) ? 'bg-brand-50 dark:bg-brand-600/20' : ''
 }`}
 >
 <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
 <button
 onClick={() => handleSelectCustomer(customer.id)}
 className="text-content-muted hover:text-content-secondary "
 >
 {selectedIds.has(customer.id) ? (
 <CheckSquare className="w-5 h-5 text-brand-600" />
 ) : (
 <Square className="w-5 h-5" />
 )}
 </button>
 </td>
 <td 
 className="px-6 py-4 cursor-pointer" 
 onClick={() => setSelectedCustomer(customer)}
 >
 <div className="flex items-center">
 <div className="bg-brand-100 dark:bg-brand-900/30 rounded-full w-10 h-10 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold mr-3">
 {customer.name.charAt(0)}
 </div>
 <div>
 <p className="font-medium text-content-primary">{customer.name}</p>
 <p className="text-xs text-content-muted">{customer.phone}</p>
 </div>
 </div>
 </td>
 <td className="px-4 py-3">
 {(() => { const m = getMedal(customer.totalSpent); return (
 <Tooltip content={`${m.label} — ${Math.floor((customer.totalSpent||0)/10)} pts`} position="top">
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border cursor-help ${m.badge}`}>
 {m.emoji} {m.label}
 </span>
 </Tooltip>
 ); })()}
 </td>
 <td className="px-4 py-3 text-content-primary font-medium text-sm">
 {formatMoney(customer.totalSpent)}
 </td>
 <td className="px-4 py-3 text-content-primary font-medium text-sm">
 {customer.totalOrders}
 </td>
 <td className="px-4 py-3 hidden md:table-cell">
 {customer.lastOrderDate ? (
 <Tooltip content={new Date(customer.lastOrderDate).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })} position="top">
 <Calendar className="w-4 h-4 text-content-muted cursor-help" />
 </Tooltip>
 ) : (
 <span className="text-content-muted dark:text-content-secondary">-</span>
 )}
 </td>
 <td className="px-4 py-3 hidden lg:table-cell">
 {(() => {
 const lastAction = getCustomerLastAction(customer.id);
 if (!lastAction) return <span className="text-content-muted dark:text-content-secondary">-</span>;
 const actionDate = new Date(lastAction.completedDate || lastAction.scheduledDate || lastAction.createdAt);
 const daysAgo = Math.floor((new Date().getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24));
 const getActionIcon = () => {
 if (lastAction.type === ActionType.PHONE_CALL) return <Phone className="w-4 h-4 text-content-muted cursor-help" />;
 if (lastAction.type === ActionType.EMAIL) return <Mail className="w-4 h-4 text-content-muted cursor-help" />;
 if (lastAction.type === ActionType.MESSAGE) return <MessageCircle className="w-4 h-4 text-content-muted cursor-help" />;
 return <History className="w-4 h-4 text-content-muted cursor-help" />;
 };
 return (
 <Tooltip content={`${lastAction.type} - ${daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? '1 dia atrás' : `${daysAgo} dias atrás`}`} position="top">
 {getActionIcon()}
 </Tooltip>
 );
 })()}
 </td>
 <td className="px-4 py-3 hidden lg:table-cell">
 {(() => {
 const riskLevel = getCustomerRiskLevel(customer);
 const riskColors = {
 high: 'bg-red-500',
 medium: 'bg-yellow-500',
 low: 'bg-green-500'
 };
 return (
 <Tooltip content={riskLevel === 'high' ? 'Risco Alto' : riskLevel === 'medium' ? 'Risco Médio' : 'Risco Baixo'} position="top">
 <div className={`w-2.5 h-2.5 rounded-full ${riskColors[riskLevel]} cursor-help`} />
 </Tooltip>
 );
 })()}
 </td>
 <td className="px-4 py-3 hidden lg:table-cell">
 {(() => {
 const daysSince = getCustomerDaysSince(customer);
 if (daysSince === Infinity) {
 return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-surface-base text-content-secondary">∞</span>;
 }
 const colorClass = daysSince === 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
 daysSince <= 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
 daysSince <= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
 return (
 <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
 {daysSince === 0 ? 'Hoje' : daysSince}
 </span>
 );
 })()}
 </td>
 <td className="px-4 py-3 hidden lg:table-cell">
 {(() => {
 const pendingCount = getCustomerPendingActionsCount(customer.id);
 return pendingCount > 0 ? (
 <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium bg-orange-500 text-white">
 {pendingCount}
 </span>
 ) : (
 <span className="text-content-muted dark:text-content-secondary">-</span>
 );
 })()}
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
 {currentUser && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSelectedActionCustomer(customer);
 setShowActionModal(true);
 }}
 className="p-1.5 text-content-muted hover:text-green-600 dark:hover:text-green-400 transition-colors"
 title="Criar ação comercial"
 >
 <Plus className="w-4 h-4" />
 </button>
 )}
 <button
 onClick={(e) => handleEdit(customer, e)}
 className="p-1.5 text-content-muted hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={(e) => handleDelete(customer.id, e)}
 className="p-1.5 text-content-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
 title="Apagar"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => setSelectedCustomer(customer)}
 className="p-1.5 text-content-muted hover:text-content-secondary transition-colors"
 title="Ver detalhes"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {paginatedCustomers.length === 0 && (
 <div className="p-8 text-center text-content-muted">
 Nenhum cliente encontrado.
 </div>
 )}
 </div>
 )}

 {/* Paginação */}
 {totalPages > 1 && (
 <div className="flex justify-center items-center gap-2 mt-6">
 <Pagination
 mode="full"
 currentPage={currentPage}
 totalItems={totalCustomersCount ?? sortedCustomers.length}
 itemsPerPage={itemsPerPage}
 onPageChange={(page) => setCurrentPage(page)}
 />
 </div>
 )}

 {selectedCustomer && (
 <CustomerDetailModal
 customer={selectedCustomer}
 orders={orders}
 actions={customerActions.filter(a => a.customerId === selectedCustomer.id)}
 feedbacks={customerFeedbacks.filter(f => f.customerId === selectedCustomer.id)}
 insight={customerInsights.find(i => i.customerId === selectedCustomer.id) || null}
 onClose={() => {
 setSelectedCustomer(null);
 if (onReloadData) {
 onReloadData();
 }
 }}
 onEdit={(customer) => {
 setSelectedCustomer(null);
 setEditingCustomer(customer);
 }}
 onCreateAction={(customer) => {
 setSelectedActionCustomer(customer);
 setShowActionModal(true);
 }}
 showToast={showToast}
 />
 )}
 {editingCustomer && <EditModal customer={editingCustomer} />}

 {/* Modal de Mesclar Clientes Duplicados */}
 {showMergeModal && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50 p-4">
 <div className="bg-surface-raised rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default">
 <div className="flex items-center justify-between">
 <h3 className="text-xl font-bold text-content-primary">
 Mesclar Clientes Duplicados
 </h3>
 <button
 onClick={() => {
 setShowMergeModal(false);
 setDuplicateGroups([]);
 }}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>

 <div className="p-6">
 {duplicateGroups.length === 0 ? (
 <p className="text-content-secondary text-center py-8">
 Nenhum cliente duplicado encontrado.
 </p>
 ) : (
 <div className="space-y-6">
 {duplicateGroups.map((group, groupIndex) => (
 <div
 key={groupIndex}
 className="border border-border-default rounded-lg p-4"
 >
 <div className="mb-3">
 <p className="text-sm font-medium text-content-muted">
 {group.reason}
 </p>
 <p className="text-xs text-content-muted mt-1">
 {group.customers.length} cliente(s) encontrado(s)
 </p>
 </div>

 <div className="space-y-3">
 {group.customers.map((customer, customerIndex) => {
 const customerOrders = orders.filter(o => o.customerId === customer.id);
 const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
 
 return (
 <div
 key={customer.id}
 className={`p-3 rounded-lg border-2 ${
 customerIndex === 0
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20'
 : 'border-border-default bg-surface-base/50'
 }`}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <p className="font-semibold text-content-primary">
 {customer.name}
 </p>
 {customerIndex === 0 && (
 <span className="px-2 py-0.5 text-xs font-medium bg-brand-600 text-white rounded">
 Principal
 </span>
 )}
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
 <div>
 <p className="text-content-muted">Telefone</p>
 <p className="text-content-primary">{customer.phone}</p>
 </div>
 <div>
 <p className="text-content-muted">Pedidos</p>
 <p className="text-content-primary">{customer.totalOrders}</p>
 </div>
 <div>
 <p className="text-content-muted">Total Gasto</p>
 <p className="text-content-primary">
 {new Intl.NumberFormat('pt-PT', {
 style: 'currency',
 currency: 'MZN',
 minimumFractionDigits: 2
 }).format(customer.totalSpent)}
 </p>
 </div>
 <div>
 <p className="text-content-muted">Tier</p>
 <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
 customer.tier === 'Ouro' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400' :
 customer.tier === 'Prata' ? 'bg-surface-base text-content-primary ' :
 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400'
 }`}>
 {customer.tier}
 </span>
 </div>
 </div>
 </div>
 {customerIndex > 0 && (
 <button
 onClick={() => {
 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja mesclar "${customer.name}" com "${group.customers[0].name}"? Todos os pedidos serão transferidos e o cliente duplicado será removido.`,
 onConfirm: () => handleMergeCustomers(group.customers[0].id, customer.id),
 variant: 'warning'
 });
 }}
 disabled={isMerging}
 className="ml-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
 >
 <Merge className="w-4 h-4" />
 Mesclar
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {group.customers.length > 2 && (
 <p className="text-xs text-content-muted mt-3">
 💡 Dica: Mescle os clientes duplicados um por vez, começando pelo que tem menos pedidos.
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="p-6 border-t border-border-default flex justify-end">
 <button
 onClick={() => {
 setShowMergeModal(false);
 setDuplicateGroups([]);
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg"
 >
 Fechar
 </button>
 </div>
 </div>
 </div>
 )}
 
 {/* Confirmation Dialog */}
 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })}
 variant={confirmDialog.variant}
 title="Confirmar Ação"
 confirmText="Confirmar"
 cancelText="Cancelar"
 />

 {/* Modal de Ação Comercial */}
 {showActionModal && selectedActionCustomer && currentUser && (
 <ActionModal
 customer={selectedActionCustomer}
 currentUser={currentUser}
 onClose={() => {
 setShowActionModal(false);
 setSelectedActionCustomer(null);
 }}
 onSuccess={async () => {
 // Recarregar ações
 try {
 const actions = await dataService.getCustomerActions();
 setCustomerActions(actions || []);
 } catch (error) {
 console.error('Erro ao recarregar ações:', error);
 }
 showToast('Ação criada com sucesso!', 'success');
 }}
 showToast={showToast}
 />
 )}
 </PageShell>
 );
};

// Componente Modal de Ação
const ActionModal: React.FC<{
 customer: Customer;
 currentUser: User;
 onClose: () => void;
 onSuccess: () => void;
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
}> = ({ customer, currentUser, onClose, onSuccess, showToast }) => {
 const [actionType, setActionType] = useState<ActionType>(ActionType.PHONE_CALL);
 const [actionStatus, setActionStatus] = useState<ActionStatus>(ActionStatus.PENDING);
 const [actionNotes, setActionNotes] = useState('');
 const [actionPriority, setActionPriority] = useState<'low' | 'medium' | 'high'>('medium');
 const [scheduledDate, setScheduledDate] = useState('');
 const [isSaving, setIsSaving] = useState(false);

 const handleSave = async () => {
 setIsSaving(true);
 try {
 const action = await dataService.createCustomerAction({
 customerId: customer.id,
 userId: currentUser.id,
 type: actionType,
 actionType: actionType,
 status: actionStatus,
 scheduledDate: scheduledDate || undefined,
 notes: actionNotes,
 priority: actionPriority,
 pointsEarned: 0
 });

 if (action) {
 onSuccess();
 onClose();
 setActionNotes('');
 setScheduledDate('');
 } else {
 showToast('Erro ao criar ação. Verifique se a tabela customer_actions existe no banco de dados.', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao criar ação:', error);
 showToast(`Erro ao criar ação: ${error.message || 'Erro desconhecido'}`, 'error');
 } finally {
 setIsSaving(false);
 }
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-[100] flex items-center justify-center p-4" onClick={onClose}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-3">
 <h3 className="text-lg font-bold text-content-primary">Nova Ação Comercial</h3>
 <button onClick={onClose} className="text-content-muted hover:text-content-secondary p-1">
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="mb-3 pb-3 border-b border-border-default">
 <p className="text-xs text-content-muted mb-0.5">Cliente</p>
 <p className="text-sm font-semibold text-content-primary">{customer.name}</p>
 </div>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <Phone className="w-3.5 h-3.5" />
 Tipo
 </label>
 <select
 value={actionType}
 onChange={(e) => setActionType(e.target.value as ActionType)}
 className="w-full px-2.5 py-1.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 >
 {Object.values(ActionType).map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <CheckCircle className="w-3.5 h-3.5" />
 Status
 </label>
 <select
 value={actionStatus}
 onChange={(e) => setActionStatus(e.target.value as ActionStatus)}
 className="w-full px-2.5 py-1.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 >
 {Object.values(ActionStatus).map(status => (
 <option key={status} value={status}>{status}</option>
 ))}
 </select>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <AlertTriangle className="w-3.5 h-3.5" />
 Prioridade
 </label>
 <select
 value={actionPriority}
 onChange={(e) => setActionPriority(e.target.value as 'low' | 'medium' | 'high')}
 className="w-full px-2.5 py-1.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 >
 <option value="low">Baixa</option>
 <option value="medium">Média</option>
 <option value="high">Alta</option>
 </select>
 </div>
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <Calendar className="w-3.5 h-3.5" />
 Data
 </label>
 <input
 type="datetime-local"
 value={scheduledDate}
 onChange={(e) => setScheduledDate(e.target.value)}
 className="w-full px-2.5 py-1.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 />
 </div>
 </div>
 <div>
 <label className="flex items-center gap-1 text-xs font-medium text-content-secondary mb-1">
 <FileText className="w-3.5 h-3.5" />
 Notas
 </label>
 <textarea
 value={actionNotes}
 onChange={(e) => setActionNotes(e.target.value)}
 rows={3}
 className="w-full px-2.5 py-1.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary resize-none focus:ring-2 focus:ring-brand-500"
 placeholder="Adicione notas sobre esta ação..."
 />
 </div>
 <div className="flex gap-2 pt-2 border-t border-border-default">
 <button
 onClick={handleSave}
 disabled={isSaving}
 className="flex-1 px-3 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {isSaving ? (
 <>
 <RefreshCw className="w-4 h-4 animate-spin" />
 A guardar...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Guardar
 </>
 )}
 </button>
 <button
 onClick={onClose}
 className="px-3 py-2 text-sm border border-border-default text-content-secondary rounded-lg hover:bg-surface-base"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};
