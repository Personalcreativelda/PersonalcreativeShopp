// Orders Component
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Order, OrderItem, OrderStatus, Product, ProductVariant, DeliveryZone, User, UserRole } from '../../core/types/types';
import { Plus, Filter, CheckCircle, Clock, Truck, XCircle, Search, Package, Printer, Eye, Upload, FileSpreadsheet, Loader2, Edit2, Trash2, Save, X, CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, DollarSign, User as UserIcon, Smartphone, MapPin, ShoppingCart, FileText, Download } from 'lucide-react';
import { createWorkbook, addWorksheet, addJsonToSheetAt, writeWorkbookToFile } from '../../core/services/excelService';
import jsPDF from 'jspdf';
import { dataService } from '../../core/services/dataService';
import { addPDFHeader, addPDFFooter, getBrandColors, addExcelHeader, addExcelFooter, formatExcelTableHeaders, formatExcelDataCells } from '../../core/services/reportService';
import { Toast } from '../../core/components/ui/Toast';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';
import { DeliveryZoneSelector } from '../../core/components/forms/DeliveryZoneSelector';
import { usePermissions } from '../../core/hooks/usePermissions';
import { useMobile } from '../../core/hooks/useMobile';
import { OrderSteps } from '../components/orders/OrderSteps';
import { ProductGrid } from '../../products/components/ui/ProductGrid';
import { OrderItemEditor } from '../components/orders/OrderItemEditor';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, ItemsPerPageSelect, SearchInput, SelectFilter, ViewModeToggle } from '../../core/components/filters';
import { formatDateOnly, formatDateWithOptions, getTodayDateString, toDateStringInTimezone, extractLocalDate } from '../../core/utils/dateUtils';
import { normalizeForSearch, normalizeOrderStatus, hasPaymentProof, getPaidAmount } from '../../core/services/serviceUtils';
import { useTrackAction } from '../../auth/components/TrackedPage';
import { appSystemConfig } from '../../../config/appConfig';
import { downloadBlob } from '../../core/services/apiClient';

interface OrdersProps {
 orders: Order[];
 products: Product[];
 customers: Customer[];
 totalOrdersCount?: number | null;
 currentUser?: User | null;
 onAddOrder: (order: Order) => void;
 onUpdateStatus: (orderId: string, status: OrderStatus) => void;
 onDeleteOrder?: (orderId: string) => void;
 onDeleteOrders?: (orderIds: string[]) => void;
 onEditOrder?: (order: Order) => void;
 onImportComplete?: () => void; // Callback após importação bem-sucedida
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
}

declare global {
 interface Window {
 google: any;
 }
}

type SortField = 'date' | 'customer' | 'amount' | 'status' | 'id' | 'sales' | 'deliveries' | 'received' | 'difference';
type SortDirection = 'asc' | 'desc';

export const Orders: React.FC<OrdersProps> = ({ orders, products, customers, totalOrdersCount, currentUser, onAddOrder, onUpdateStatus, onDeleteOrder, onDeleteOrders, onEditOrder, onImportComplete, showToast }) => {
 // Hook para detectar mobile
 const isMobile = useMobile(768);
 const trackAction = useTrackAction();

 const { hasPermission } = usePermissions(currentUser);

 // Verificar permissões
 const canEdit = hasPermission('orders.edit');
 const canDelete = hasPermission('orders.delete');
 const canCreate = hasPermission('orders.create');
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');
 const [filterCreatedBy, setFilterCreatedBy] = useState<string | 'ALL'>('ALL');
 const [users, setUsers] = useState<User[]>([]);
 const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

 // Selection State
 const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

 // Edit Mode State
 const [isEditing, setIsEditing] = useState(false);
 const [editOrderData, setEditOrderData] = useState<Order | null>(null);
 const [editProductSearchQuery, setEditProductSearchQuery] = useState('');

 // Manual Form State
 const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
 const [newOrderCustomerPhone, setNewOrderCustomerPhone] = useState('');
 const [newOrderDate, setNewOrderDate] = useState(getTodayDateString());
 const [newOrderDeliveryLocation, setNewOrderDeliveryLocation] = useState('');
 const [newOrderIsDelivery, setNewOrderIsDelivery] = useState(false);
 const [newOrderDeliveryFee, setNewOrderDeliveryFee] = useState(0);
 const [newOrderDeliveryZoneId, setNewOrderDeliveryZoneId] = useState('');
 const [newOrderDeliveryZoneName, setNewOrderDeliveryZoneName] = useState('');
 const [suggestedCustomer, setSuggestedCustomer] = useState<Customer | null>(null);
 const [showCustomerSuggestion, setShowCustomerSuggestion] = useState(false);
 const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
 const [newOrderNumber, setNewOrderNumber] = useState('');
 const [newOrderStatus, setNewOrderStatus] = useState<OrderStatus>(OrderStatus.PENDING);
 const [newOrderPaymentStatus, setNewOrderPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('unpaid');
 const [newOrderAmountPaid, setNewOrderAmountPaid] = useState(0);
 const [newOrderPaymentProof, setNewOrderPaymentProof] = useState('');
 const [newOrderPaymentProofText, setNewOrderPaymentProofText] = useState('');
 const [newOrderNotes, setNewOrderNotes] = useState('');
 const [orderNumberError, setOrderNumberError] = useState('');
 const [isCheckingOrderNumber, setIsCheckingOrderNumber] = useState(false);
 const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
 const [productSearchQuery, setProductSearchQuery] = useState('');
 const [variantSelectionModal, setVariantSelectionModal] = useState<{
 isOpen: boolean;
 product: Product | null;
 isEditMode: boolean;
 }>({
 isOpen: false,
 product: null,
 isEditMode: false
 });
 const [variantSearchQuery, setVariantSearchQuery] = useState('');
 const [variantSortBy, setVariantSortBy] = useState<'name' | 'price' | 'stock'>('name');
 const [itemSearchQuery, setItemSearchQuery] = useState(''); // Busca nos itens adicionados

 // Steps State (para novo sistema de steps)
 const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
 const [step1Valid, setStep1Valid] = useState(false);
 const [step2Valid, setStep2Valid] = useState(false);
 const [isSavingOrder, setIsSavingOrder] = useState(false);

 // Location State (removido - não usado mais)

 // View Mode State - padrão: tabela no desktop, cards no mobile
 const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');

 // CSV/Excel State
 const [csvFile, setCsvFile] = useState<File | null>(null);
 const [fileType, setFileType] = useState<'csv' | 'excel' | 'auto'>('auto');
 const [isImporting, setIsImporting] = useState(false);
 const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
 const [importResult, setImportResult] = useState<{ success: number, errors: number, details?: string[], productsCreated?: number, customersCreated?: number, customersUpdated?: number } | null>(null);
 const [showImportDetails, setShowImportDetails] = useState(false);
 const [showCsvFormat, setShowCsvFormat] = useState(false);
 const [expandedOrderItems, setExpandedOrderItems] = useState<Set<string>>(new Set());
 const [expandedOrderNotes, setExpandedOrderNotes] = useState<Set<string>>(new Set());

 // Estados para controlar seções colapsáveis no modal de novo pedido (todas abertas por padrão)
 const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
 'customer', 'products', 'orderItems', 'delivery', 'payment', 'orderInfo'
 ]));

 // Estados para controlar seções colapsáveis no modal de editar pedido
 const [expandedEditSections, setExpandedEditSections] = useState<Set<string>>(new Set([
 'customer',
 'items',
 'products', // Step 2: Adicionar Produtos
 'orderItems' // Step 2: Itens do Pedido
 ]));

 const toggleSection = (section: string) => {
 const newSet = new Set(expandedSections);
 if (newSet.has(section)) {
 newSet.delete(section);
 } else {
 newSet.add(section);
 }
 setExpandedSections(newSet);
 };

 const toggleEditSection = (section: string) => {
 const newSet = new Set(expandedEditSections);
 if (newSet.has(section)) {
 newSet.delete(section);
 } else {
 newSet.add(section);
 }
 setExpandedEditSections(newSet);
 };

 // Steps no modal Editar Pedido (mesmo padrão do Novo Pedido)
 const [editCurrentStep, setEditCurrentStep] = useState<1 | 2 | 3 | 4>(1);
 const editStep1Valid = useMemo(() => !!(editOrderData?.customerName?.trim()), [editOrderData?.customerName]);
 const editStep2Valid = useMemo(() => (editOrderData?.items?.length ?? 0) > 0, [editOrderData?.items?.length]);
 const handleEditNextStep = () => {
 if (editCurrentStep === 1 && editStep1Valid) setEditCurrentStep(2);
 else if (editCurrentStep === 2 && editStep2Valid) setEditCurrentStep(3);
 else if (editCurrentStep === 3) setEditCurrentStep(4);
 };
 const handleEditPreviousStep = () => {
 if (editCurrentStep === 2) setEditCurrentStep(1);
 else if (editCurrentStep === 3) setEditCurrentStep(2);
 else if (editCurrentStep === 4) setEditCurrentStep(3);
 };
 const handleEditStepChange = (step: number) => {
 if (step === 1) setEditCurrentStep(1);
 else if (step === 2 && editStep1Valid) setEditCurrentStep(2);
 else if (step === 3 && editStep1Valid && editStep2Valid) setEditCurrentStep(3);
 else if (step === 4 && editStep1Valid && editStep2Valid) setEditCurrentStep(4);
 };

 // CSV Preview State
 const [csvPreviewData, setCsvPreviewData] = useState<{
 orders: Array<{
 rowIndex: number;
 customerName: string;
 customerPhone: string;
 date: string;
 items: Array<{
 originalText: string;
 productName: string;
 quantity: number;
 unit: string;
 price: number;
 matchedProduct: Product | null;
 matchedVariant: ProductVariant | null;
 needsManualMatch: boolean;
 matchConfidence?: number;
 }>;
 totalAmount: number;
 isDelivery: boolean;
 deliveryFee: number;
 deliveryLocation: string;
 customerCategory: string;
 notes: string;
 matchedCustomer: Customer | null;
 isNewCustomer: boolean;
 customerTier: string | null;
 }>;
 errors: string[];
 } | null>(null);
 const [editingPreviewOrderIndex, setEditingPreviewOrderIndex] = useState<number | null>(null);
 const [productMatchModal, setProductMatchModal] = useState<{
 isOpen: boolean;
 orderIndex: number;
 itemIndex: number;
 searchQuery: string;
 }>({
 isOpen: false,
 orderIndex: -1,
 itemIndex: -1,
 searchQuery: ''
 });

 // Estado para guardar contexto de associação de produto com variação
 const [pendingProductMatch, setPendingProductMatch] = useState<{
 orderIndex: number;
 itemIndex: number;
 product: Product;
 } | null>(null);

 // Advanced Filters State
 const [searchQuery, setSearchQuery] = useState('');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('today');
 const [filterDateFrom, setFilterDateFrom] = useState<string>('');
 const [filterDateTo, setFilterDateTo] = useState<string>('');
 const [filterDelivery, setFilterDelivery] = useState<'all' | 'yes' | 'no'>('all');
 const [filterPayment, setFilterPayment] = useState<'ALL' | 'paid' | 'unpaid' | 'partial'>('ALL');
 const [showFilters, setShowFilters] = useState(false);
 // Nota: filtros avançados foram compactados para dropdowns na barra

 // Função auxiliar para obter intervalo de datas do período
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
 case 'thisWeek':
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
 start.setDate(diff);
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisMonth':
 start = new Date(today.getFullYear(), today.getMonth(), 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
 end.setTime(lastDayOfMonth.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisYear':
 start = new Date(today.getFullYear(), 0, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfYear = new Date(today.getFullYear(), 11, 31);
 end.setTime(lastDayOfYear.getTime());
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
 const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
 end.setTime(lastDayLastMonth.getTime());
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

 // Sorting State
 const [sortField, setSortField] = useState<SortField>('date');
 const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

 // Pagination State
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(12);

 // Confirmation Dialog
 const [confirmDialog, setConfirmDialog] = useState<{
 isOpen: boolean;
 title?: string;
 message: string;
 confirmText?: string;
 onConfirm: () => void;
 variant?: 'danger' | 'warning' | 'info';
 }>({
 isOpen: false,
 message: '',
 onConfirm: () => { },
 variant: 'warning'
 });

 const formatMoney = (value: number) => {
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 // Função para normalizar string (remover acentos, lowercase)
 const normalizeString = (str: string): string => {
 return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
 };

 // Função para detectar cliente existente
 const findExistingCustomer = (name: string, phone: string): Customer | null => {
 if (!name.trim() && !phone.trim()) return null;

 const normalizedPhone = phone.replace(/\D/g, '');
 const normalizedName = normalizeString(name);

 // 1. Tentar encontrar por telefone (se tiver mais de 5 dé­gitos)
 if (normalizedPhone.length > 5) {
 const foundByPhone = customers.find(c => {
 const customerPhone = c.phone.replace(/\D/g, '');
 return customerPhone === normalizedPhone;
 });
 if (foundByPhone) return foundByPhone;
 }

 // 2. Tentar encontrar por nome (match exato normalizado)
 if (normalizedName.length > 2) {
 const foundByName = customers.find(c => {
 const customerName = normalizeString(c.name);
 return customerName === normalizedName;
 });
 if (foundByName) return foundByName;
 }

 return null;
 };

 // Handler para mudança no nome do cliente
 const handleCustomerNameChange = (value: string) => {
 setNewOrderCustomerName(value);
 if (value.trim() && newOrderCustomerPhone.trim()) {
 const existing = findExistingCustomer(value, newOrderCustomerPhone);
 if (existing && existing.id !== selectedCustomerId) {
 setSuggestedCustomer(existing);
 setShowCustomerSuggestion(true);
 }
 }
 };

 // Handler para mudança no telefone do cliente
 const handleCustomerPhoneChange = (value: string) => {
 setNewOrderCustomerPhone(value);
 if (value.trim() && newOrderCustomerName.trim()) {
 const existing = findExistingCustomer(newOrderCustomerName, value);
 if (existing && existing.id !== selectedCustomerId) {
 setSuggestedCustomer(existing);
 setShowCustomerSuggestion(true);
 }
 }
 };

 // Handler para aceitar cliente sugerido
 const handleAcceptSuggestedCustomer = () => {
 if (suggestedCustomer) {
 setSelectedCustomerId(suggestedCustomer.id);
 setNewOrderCustomerName(suggestedCustomer.name);
 setNewOrderCustomerPhone(suggestedCustomer.phone);
 setSuggestedCustomer(null);
 setShowCustomerSuggestion(false);
 showToast(`Cliente "${suggestedCustomer.name}" associado ao pedido`, 'success');
 }
 };

 // Handler para ignorar cliente sugerido
 const handleIgnoreSuggestedCustomer = () => {
 setSuggestedCustomer(null);
 setShowCustomerSuggestion(false);
 };

 // Helper functions for fixed prices (same logic as in dataService)
 const normalizeProductNameForPrice = (name: string): string => {
 return name.toUpperCase()
 .trim()
 .replace(/\s+/g, ' ')
 .replace(/é/g, 'A')
 .replace(/é‰/g, 'E')
 .replace(/é/g, 'I')
 .replace(/é“/g, 'O')
 .replace(/éš/g, 'U')
 .replace(/é‡/g, 'C')
 .replace(/éƒ/g, 'A')
 .replace(/é•/g, 'O');
 };

 const getFixedProductPrice = (productName: string, quantity: number, unit: string): number | null => {
 const FIXED_PRODUCT_PRICES: Record<string, number> = {
 'AMENDOIM PILADO 500G': 160,
 'BATATA DOCE 1KG': 80,
 'COCO RALADO 500G': 70,
 'CODORNA 12UN': 1080,
 'CODORNIZ VIVO UN': 70,
 'COUVE 350G': 60,
 'FARINHA DE MANDIOCA 1KG': 100,
 'FRANGO NORMAL UN': 310,
 'FRANGO FUMADO UN': 335,
 'GALINHA CAFREAL UN': 400,
 'GALINHA CAFREAL FUMADA UN': 425,
 'MAé‡ANICA SECA 1KG': 200,
 'MANDIOCA FRESCA 1KG': 60,
 'MANGA SECA 1KG': 300,
 'MATAPA 1KG': 180,
 'MBOA 350G': 60,
 'MEL 700ML': 650,
 'NHANGANA 1KG': 180,
 'OLEO DE COCO 150ML': 180,
 'OLEO DE COCO 700ML': 650,
 'OLEO DE MAFURA 150ML': 280,
 'OLEO DE MAFURA 700ML': 850,
 'OVOS DE CODORNA 12UN': 80,
 'OVOS DE GALINHA UN': 30,
 'OVOS DE PATO UN': 35,
 'PATO FUMADO UN': 425,
 'PATO NORMAL UN': 400,
 'PINTOS DE GALINHA': 100,
 'POLPA DE ABACATE 500G': 150,
 'POLPA DE ANANAS 500G': 150,
 'POLPA DE LARANJA 500G': 150,
 'POLPA DE MAé‡ANICA 1KG': 300,
 'POLPA DE MAFILUA 500G': 150,
 'POLPA DE MANGA 500G': 150,
 'POLPA DE MARACUJé 1KG': 300,
 'POLPA DE MARACUJé 500G': 150,
 'POLPA DE MASSALA 500G': 150,
 'POLPA DE MELANCIA 500G': 150,
 'POLPA DE PAPAIA 500G': 150,
 'POLPA DE TAMARINO 1KG': 300,
 'POLPA DE TANGERINA 500G': 150,
 };

 const normalized = normalizeProductNameForPrice(productName);

 if (FIXED_PRODUCT_PRICES[normalized]) {
 return FIXED_PRODUCT_PRICES[normalized];
 }

 if (normalized.includes('PATO NORMAL') || normalized.includes('PATO FUMADO')) {
 if (unit === 'kg') return 200;
 if (normalized.includes('PATO NORMAL')) return 400;
 if (normalized.includes('PATO FUMADO')) return 425;
 }

 if (normalized.includes('FRANGO NORMAL')) {
 if (unit === 'kg') return 155;
 return 310;
 }

 if (normalized.includes('FRANGO FUMADO')) {
 if (unit === 'kg') return 167.5;
 return 335;
 }

 if (normalized.includes('GALINHA CAFREAL')) {
 if (normalized.includes('FUMADA')) {
 if (unit === 'kg') return 212.5;
 return 425;
 }
 if (unit === 'kg') return 200;
 return 400;
 }

 return null;
 };

 // ------------------------------------------------------------------
 // FILTERING & SORTING LOGIC
 // ------------------------------------------------------------------
 const filteredAndSortedOrders = useMemo(() => {
 // Obter intervalo de datas do período selecionado
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 // Normalizar status dos pedidos (aplicar migração de estados antigos)
 let result = orders.map(order => ({
 ...order,
 status: normalizeOrderStatus(order)
 }));

 // Status filter
 if (filterStatus !== 'ALL') {
 result = result.filter(o => o.status === filterStatus);
 }

 // Search query (nome do cliente, telefone, ID externo, número do pedido)
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 result = result.filter(o =>
 normalizeForSearch(o.customerName).includes(query) ||
 normalizeForSearch(o.customerPhone || '').includes(query) ||
 (o.externalId && normalizeForSearch(o.externalId).includes(query)) ||
 (o.orderNumber && normalizeForSearch(o.orderNumber).includes(query)) ||
 normalizeForSearch(o.id).includes(query)
 );
 }

 // Date range filter usando o período selecionado
 result = result.filter(o => {
 const orderDate = new Date(o.createdAt);
 orderDate.setHours(0, 0, 0, 0);
 const normalizedStart = new Date(start);
 normalizedStart.setHours(0, 0, 0, 0);
 const normalizedEnd = new Date(end);
 normalizedEnd.setHours(23, 59, 59, 999);
 return orderDate >= normalizedStart && orderDate <= normalizedEnd;
 });

 // Delivery filter
 if (filterDelivery === 'yes') {
 result = result.filter(o => o.isDelivery);
 } else if (filterDelivery === 'no') {
 result = result.filter(o => !o.isDelivery);
 }

 // Vendedor filter
 if (filterCreatedBy !== 'ALL') {
 result = result.filter(o => o.createdBy === filterCreatedBy);
 }

 // Payment filter
 if (filterPayment !== 'ALL') {
 if (filterPayment === 'paid') {
 // Filtrar apenas pedidos totalmente pagos (valor pago >= total)
 result = result.filter(o => {
 const paidAmount = getPaidAmount(o);
 const totalAmount = o.totalAmount || 0;
 return paidAmount >= totalAmount && paidAmount > 0;
 });
 } else if (filterPayment === 'unpaid') {
 // Filtrar apenas pedidos entregues e não pagos (valor pago = 0)
 // Excluir pedidos cancelados, pendentes e parcialmente pagos
 result = result.filter(o => {
 const normalizedStatus = normalizeOrderStatus(o);
 // Apenas pedidos entregues
 const isDelivered = normalizedStatus === OrderStatus.DELIVERED || normalizedStatus === 'Entregue';
 if (!isDelivered) return false;

 // Verificar se não está pago (paidAmount === 0)
 const paidAmount = getPaidAmount(o);
 return paidAmount === 0;
 });
 } else if (filterPayment === 'partial') {
 // Filtrar apenas pedidos entregues parcialmente pagos (0 < paidAmount < totalAmount)
 // Excluir pedidos cancelados e pendentes
 result = result.filter(o => {
 const normalizedStatus = normalizeOrderStatus(o);
 // Apenas pedidos entregues
 const isDelivered = normalizedStatus === OrderStatus.DELIVERED || normalizedStatus === 'Entregue';
 if (!isDelivered) return false;

 // Verificar se está parcialmente pago (0 < paidAmount < totalAmount)
 const paidAmount = getPaidAmount(o);
 const totalAmount = o.totalAmount || 0;
 return paidAmount > 0 && paidAmount < totalAmount;
 });
 }
 }

 // Sorting
 result.sort((a, b) => {
 let comparison = 0;

 switch (sortField) {
 case 'date':
 comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
 break;
 case 'customer':
 comparison = a.customerName.localeCompare(b.customerName);
 break;
 case 'amount':
 comparison = a.totalAmount - b.totalAmount;
 break;
 case 'status':
 comparison = a.status.localeCompare(b.status);
 break;
 case 'id':
 // Ordenar por número do pedido (orderNumber), se disponível, senão usar externalId ou id
 const aOrderNumber = a.orderNumber || a.externalId || a.id;
 const bOrderNumber = b.orderNumber || b.externalId || b.id;

 // Extrair números para comparação numérica (ex: "1908" vs "1912")
 const aNumeric = aOrderNumber.toString().replace(/\D/g, '');
 const bNumeric = bOrderNumber.toString().replace(/\D/g, '');

 if (aNumeric && bNumeric) {
 // Comparação numérica se ambos têm números
 comparison = parseInt(aNumeric, 10) - parseInt(bNumeric, 10);
 } else {
 // Fallback para comparaçéo de strings
 comparison = aOrderNumber.toString().localeCompare(bOrderNumber.toString());
 }
 break;
 case 'sales':
 // VENDAS = totalAmount - deliveryFee
 const aSales = a.totalAmount - (a.deliveryFee || 0);
 const bSales = b.totalAmount - (b.deliveryFee || 0);
 comparison = aSales - bSales;
 break;
 case 'deliveries':
 // ENTREGAS = deliveryFee
 const aDeliveries = a.deliveryFee || 0;
 const bDeliveries = b.deliveryFee || 0;
 comparison = aDeliveries - bDeliveries;
 break;
 case 'received':
 // RECEBIDO = valor pago (usar helper)
 comparison = getPaidAmount(a) - getPaidAmount(b);
 break;
 case 'difference':
 // DIFERENÇA = recebido - total
 const aDiff = getPaidAmount(a) - a.totalAmount;
 const bDiff = getPaidAmount(b) - b.totalAmount;
 comparison = aDiff - bDiff;
 break;
 }

 return sortDirection === 'asc' ? comparison : -comparison;
 });

 return result;
 }, [orders, filterStatus, searchQuery, filterPeriod, filterDateFrom, filterDateTo, filterDelivery, filterCreatedBy, filterPayment, sortField, sortDirection, getDateRangeFromPeriod]);

 // Pagination
 const totalPages = Math.ceil(filteredAndSortedOrders.length / itemsPerPage);
 const paginatedOrders = useMemo(() => {
 const startIndex = (currentPage - 1) * itemsPerPage;
 return filteredAndSortedOrders.slice(startIndex, startIndex + itemsPerPage);
 }, [filteredAndSortedOrders, currentPage, itemsPerPage]);

 // Load locations removed - não usado mais

 // Carregar lista de gestores de venda para filtro de vendedor
 useEffect(() => {
 const loadUsers = async () => {
 try {
 // Filtro de vendedor: mostrar apenas utilizadores que criaram pedidos
 const orderVendorsList = await dataService.getOrderVendors();
 setUsers(orderVendorsList);
 } catch (error) {
 console.error('Erro ao carregar usuários:', error);
 }
 };
 loadUsers();
 }, []);

 // Reset pagination when filters change
 useEffect(() => {
 setCurrentPage(1);
 }, [filterStatus, searchQuery, filterDateFrom, filterDateTo, filterDelivery, filterCreatedBy, filterPayment, sortField, sortDirection]);

 // Calcular total dos pedidos filtrados
 const totalFilteredAmount = useMemo(() => {
 return filteredAndSortedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
 }, [filteredAndSortedOrders]);

 const getEffectivePaymentStatus = (order: Order): 'paid' | 'partial' | 'unpaid' => {
 const paid = getPaidAmount(order);
 if (paid >= (order.totalAmount || 0)) return 'paid';
 if (paid > 0) return 'partial';
 return 'unpaid';
 };

 const getPaymentStatusLabel = (status: 'paid' | 'partial' | 'unpaid'): string => {
 if (status === 'paid') return 'Pago';
 if (status === 'partial') return 'Parcial';
 return 'Não Pago';
 };

 const getPaymentStatusTooltip = (order: Order): string => {
 if (!hasPaymentProof(order)) return 'Sem comprovativo: considerado Não Pago';
 const effective = getEffectivePaymentStatus(order);
 return `Pagamento: ${getPaymentStatusLabel(effective)}`;
 };

 const shouldIncludeInTotals = (order: Order): boolean => {
 // Excluir pedidos cancelados dos totais
 const normalizedStatus = normalizeOrderStatus(order);
 return normalizedStatus !== OrderStatus.CANCELLED;
 };

 // Calcular totais de vendas, entregas, total, valor recebido e diferença
 const totals = useMemo(() => {
 return filteredAndSortedOrders.reduce((acc, order) => {
 // Cancelados não entram em vendas nem totais do resumo
 if (!shouldIncludeInTotals(order)) return acc;

 const deliveryFee = order.isDelivery && order.deliveryFee ? order.deliveryFee : 0;
 const salesAmount = order.totalAmount - deliveryFee;

 acc.totalSales += salesAmount; // VENDAS (produtos sem entrega)
 acc.totalAmount += order.totalAmount; // TOTAL
 acc.totalDeliveries += deliveryFee; // ENTREGAS

 // Valor Recebido (regra: sem comprovativo => 0)
 acc.valueReceived += getPaidAmount(order);

 return acc;
 }, {
 totalSales: 0, // VENDAS
 totalDeliveries: 0, // ENTREGAS
 totalAmount: 0, // TOTAL
 valueReceived: 0 // RECEBIDO
 });
 }, [filteredAndSortedOrders]);

 // Calcular diferença total
 const totalDifference = totals.valueReceived - totals.totalAmount;

 const handleSort = (field: SortField) => {
 if (sortField === field) {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField(field);
 setSortDirection('desc');
 }
 };

 const getSortIcon = (field: SortField) => {
 if (sortField !== field) {
 return <ArrowUpDown className="w-3 h-3 text-content-muted opacity-50" />;
 }
 return sortDirection === 'asc'
 ? <ArrowUp className="w-3 h-3 text-brand-600 dark:text-brand-400" />
 : <ArrowDown className="w-3 h-3 text-brand-600 dark:text-brand-400" />;
 };

 const clearFilters = () => {
 setSearchQuery('');
 setFilterPeriod('today');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterDelivery('all');
 setFilterStatus('ALL');
 setFilterCreatedBy('ALL');
 setFilterPayment('ALL');
 };

 // ------------------------------------------------------------------
 // SELECTION LOGIC
 // ------------------------------------------------------------------
 const toggleSelectOrder = (orderId: string) => {
 if (selectedOrderIds.includes(orderId)) {
 setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
 } else {
 setSelectedOrderIds([...selectedOrderIds, orderId]);
 }
 };

 const toggleSelectAll = () => {
 if (selectedOrderIds.length === paginatedOrders.length &&
 paginatedOrders.every(o => selectedOrderIds.includes(o.id))) {
 setSelectedOrderIds([]); // Deselect all
 } else {
 setSelectedOrderIds(paginatedOrders.map(o => o.id)); // Select all on current page
 }
 };

 const handleBulkDelete = () => {
 if (selectedOrderIds.length === 0) return;

 const orderCount = selectedOrderIds.length;
 const orderText = orderCount === 1 ? 'pedido' : 'pedidos';
 const totalValue = filteredAndSortedOrders
 .filter(o => selectedOrderIds.includes(o.id))
 .reduce((sum, o) => sum + o.totalAmount, 0);

 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja apagar ${orderCount} ${orderText}? Esta ação não pode ser desfeita.\n\nValor total: ${formatMoney(totalValue)}`,
 title: orderCount === 1 ? 'Apagar pedido?' : 'Apagar pedidos selecionados?',
 confirmText: 'Apagar',
 variant: 'danger',
 onConfirm: () => {
 if (onDeleteOrders) {
 trackAction('delete', { entity: 'order', entityIds: selectedOrderIds });
 onDeleteOrders(selectedOrderIds);
 setSelectedOrderIds([]);
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 // ------------------------------------------------------------------
 // BULK EDIT LOGIC
 // ------------------------------------------------------------------
 const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
 const [bulkEditStatus, setBulkEditStatus] = useState<OrderStatus | ''>('');

 // ------------------------------------------------------------------
 // DUPLICATE DETECTION LOGIC
 // ------------------------------------------------------------------
 const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
 const [duplicateGroups, setDuplicateGroups] = useState<Array<{
 orders: Order[];
 keepOrderId: string | null;
 }>>([]);
 const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);

 // Função para encontrar duplicados
 const findDuplicateOrders = () => {
 setIsScanningDuplicates(true);

 // Agrupar pedidos por critérios de duplicação
 const groups = new Map<string, Order[]>();

 orders.forEach(order => {
 const normalizedName = order.customerName.trim().toLowerCase();
 const normalizedPhone = order.customerPhone.trim().replace(/\s/g, '');
 const orderDate = extractLocalDate(order.createdAt);
 const amount = Math.round(order.totalAmount * 100) / 100; // Arredondar para 2 casas decimais

 // Criar chave única para identificar duplicados
 // Formato: nome|telefone|data|valor
 const key = `${normalizedName}|${normalizedPhone || 'SEM_TELEFONE'}|${orderDate}|${amount}`;

 if (!groups.has(key)) {
 groups.set(key, []);
 }
 groups.get(key)!.push(order);
 });

 // Filtrar apenas grupos com mais de 1 pedido (duplicados)
 const duplicateGroupsArray = Array.from(groups.values())
 .filter(group => group.length > 1)
 .map(group => ({
 orders: group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), // Mais recente primeiro
 keepOrderId: group[0].id // Por padrão, manter o mais recente
 }));

 setDuplicateGroups(duplicateGroupsArray);
 setIsScanningDuplicates(false);
 setIsDuplicateModalOpen(true);
 };

 // Função para remover duplicados
 const handleRemoveDuplicates = () => {
 if (duplicateGroups.length === 0) return;

 // Coletar IDs de pedidos para remover (todos exceto o que será mantido)
 const ordersToDelete: string[] = [];

 duplicateGroups.forEach(group => {
 if (group.keepOrderId) {
 // Adicionar todos os outros pedidos do grupo para remoçéo
 group.orders
 .filter(o => o.id !== group.keepOrderId)
 .forEach(o => ordersToDelete.push(o.id));
 }
 });

 if (ordersToDelete.length === 0) {
 showToast('Nenhum pedido duplicado selecionado para remover', 'warning');
 return;
 }

 const totalValue = orders
 .filter(o => ordersToDelete.includes(o.id))
 .reduce((sum, o) => sum + o.totalAmount, 0);

 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja remover ${ordersToDelete.length} pedido(s) duplicado(s)? Esta ação não pode ser desfeita.\n\nValor total: ${formatMoney(totalValue)}\n\nSerão mantidos ${duplicateGroups.length} pedido(s) (um de cada grupo).`,
 title: 'Remover pedidos duplicados?',
 confirmText: 'Remover',
 variant: 'danger',
 onConfirm: () => {
 if (onDeleteOrders) {
 trackAction('delete', { entity: 'order', entityIds: ordersToDelete });
 onDeleteOrders(ordersToDelete);
 setIsDuplicateModalOpen(false);
 setDuplicateGroups([]);
 showToast(`âœ… ${ordersToDelete.length} pedido(s) duplicado(s) removido(s) com sucesso!`, 'success');
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 const handleBulkStatusUpdate = async () => {
 if (selectedOrderIds.length === 0 || !bulkEditStatus) return;

 const orderCount = selectedOrderIds.length;
 const orderText = orderCount === 1 ? 'pedido' : 'pedidos';

 // Validar stock antes de entregar pedidos em massa
 if (bulkEditStatus === OrderStatus.DELIVERED) {
 try {
 const loja = await dataService.getLocationByCode('LOJA');
 if (!loja) {
 showToast('Localização LOJA não encontrada. Não é possível completar os pedidos.', 'error');
 return;
 }

 const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
 const stockErrors: string[] = [];

 for (const order of selectedOrders) {
 // Só validar se o pedido ainda não está DELIVERED
 if (order.status === OrderStatus.DELIVERED) continue;

 for (const item of order.items) {
 if (!item.productId) {
 stockErrors.push(`Pedido ${order.orderNumber || order.id.substring(0, 8)}: Item "${item.productName}" sem ID válido`);
 continue;
 }

 const availability = await dataService.checkStockAvailability(
 item.productId,
 item.variantId || null,
 loja.id,
 item.quantity
 );

 if (!availability.available) {
 stockErrors.push(
 `Pedido ${order.orderNumber || order.id.substring(0, 8)}: ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} - ${availability.message || 'Stock insuficiente'}`
 );
 }
 }
 }

 if (stockErrors.length > 0) {
 const errorMessage = stockErrors.length > 5
 ? `${stockErrors.slice(0, 5).join('\n')}\n... e mais ${stockErrors.length - 5} erro(s)`
 : stockErrors.join('\n');

 showToast(
 `Não é possível completar os pedidos. Erros de stock:\n${errorMessage}`,
 'error',
 10000
 );
 return;
 }
 } catch (error: any) {
 console.error('Erro ao validar stock em massa:', error);
 showToast('Erro ao validar stock. Tente novamente.', 'error');
 return;
 }
 }

 setConfirmDialog({
 isOpen: true,
 message: `Deseja atualizar o status de ${orderCount} ${orderText} para "${bulkEditStatus}"?`,
 variant: 'info',
 onConfirm: () => {
 selectedOrderIds.forEach(id => {
 trackAction('update', { entity: 'order', entityId: id, changes: { status: bulkEditStatus } });
 onUpdateStatus(id, bulkEditStatus as OrderStatus);
 });
 setSelectedOrderIds([]);
 setIsBulkEditOpen(false);
 setBulkEditStatus('');
 showToast(`Status de ${orderCount} ${orderText} atualizado para "${getStatusLabel(bulkEditStatus as OrderStatus)}"`, 'success');
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };


 const handleTextPaste = async () => {
 // Funcionalidade de importação CSV/TEXT removida
 showToast('Funcionalidade de importação removida', 'info');
 };

 const handleCsvUpload = async () => {
 if (!csvFile) return;
 setIsImporting(true);

 try {
 const fileName = csvFile.name.toLowerCase();
 const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

 if (isExcel) {
 // Importar Excel
 try {
 const previewData = await dataService.parseExcelForPreview(csvFile, products);
 setCsvPreviewData(previewData);
 setIsImporting(false);
 } catch (error: any) {
 console.error('Erro ao processar Excel:', error);
 showToast(`Erro ao processar arquivo Excel: ${error.message || 'Erro desconhecido'}`, 'error');
 setIsImporting(false);
 }
 } else {
 // Importar CSV com melhor encoding
 const reader = new FileReader();

 reader.onload = async (e) => {
 try {
 // Tentar diferentes encodings
 const arrayBuffer = e.target?.result as ArrayBuffer;
 if (!arrayBuffer) {
 throw new Error('Não foi possível ler o arquivo');
 }
 const text = await dataService.readFileWithEncoding(arrayBuffer, csvFile.name);
 const previewData = await dataService.parseCSVForPreview(text, products);
 setCsvPreviewData(previewData);
 setIsImporting(false);
 } catch (error: any) {
 console.error('Erro ao processar CSV:', error);
 showToast(`Erro ao processar arquivo CSV: ${error.message || 'Erro desconhecido'}`, 'error');
 setIsImporting(false);
 }
 };

 reader.onerror = () => {
 console.error('Erro ao ler arquivo');
 showToast('Erro ao ler o arquivo. Por favor, tente novamente.', 'error');
 setIsImporting(false);
 };

 reader.readAsArrayBuffer(csvFile);
 }
 } catch (error: any) {
 console.error('Erro geral ao processar arquivo:', error);
 showToast(`Erro ao processar arquivo: ${error.message || 'Erro desconhecido'}`, 'error');
 setIsImporting(false);
 }
 };

 // Função para verificar se um pedido já existe (duplicado)
 const isDuplicateOrder = (previewOrder: typeof csvPreviewData.orders[0], orderDate: string): boolean => {
 const normalizedCustomerName = previewOrder.customerName.trim().toLowerCase();
 const normalizedPhone = previewOrder.customerPhone.trim().replace(/\s/g, '');
 const orderDateObj = new Date(orderDate);
 const orderDateStr = toDateStringInTimezone(orderDateObj);

 // Tolerância para valores monetários (0.01 MT)
 const amountTolerance = 0.01;

 return orders.some(existingOrder => {
 // Comparar nome do cliente (case-insensitive)
 const existingName = existingOrder.customerName.trim().toLowerCase();
 if (existingName !== normalizedCustomerName) return false;

 // Comparar telefone (normalizado, sem espaços)
 // Se ambos têm telefone, devem ser iguais
 // Se um tem e outro não, não é duplicado (pode ser cliente diferente com mesmo nome)
 const existingPhone = existingOrder.customerPhone.trim().replace(/\s/g, '');
 if (normalizedPhone && existingPhone) {
 // Ambos têm telefone - devem ser iguais
 if (existingPhone !== normalizedPhone) return false;
 } else if (normalizedPhone || existingPhone) {
 // Um tem telefone e outro não - não é duplicado
 return false;
 }
 // Se ambos não têm telefone, continuar verificação

 // Comparar data (mesmo dia)
 const existingDateStr = extractLocalDate(existingOrder.createdAt);
 if (existingDateStr !== orderDateStr) return false;

 // Comparar valor total (com tolerância)
 const amountDiff = Math.abs(existingOrder.totalAmount - previewOrder.totalAmount);
 if (amountDiff > amountTolerance) return false;

 // Se passou todas as verificações, é duplicado
 return true;
 });
 };

 const handleSavePreviewOrders = async () => {
 if (!csvPreviewData) return;

 // Validar se há produtos não associados
 const unmatchedItems = csvPreviewData.orders.reduce((sum, order) =>
 sum + order.items.filter(item => !item.matchedProduct && item.needsManualMatch).length, 0
 );

 if (unmatchedItems > 0) {
 const proceed = window.confirm(
 `âš ï¸ ${unmatchedItems} produto(s) não estão associados a produtos do sistema.\n\n` +
 `Os pedidos serão salvos, mas esses itens não terão referência ao produto.\n\n` +
 `Deseja continuar mesmo assim?`
 );
 if (!proceed) return;
 }

 const totalOrders = csvPreviewData.orders.length;
 setIsImporting(true);
 setSaveProgress({ current: 0, total: totalOrders, percentage: 0 });

 let successCount = 0;
 let errorCount = 0;
 let duplicateCount = 0;
 let customersCreatedCount = 0;
 let customersUpdatedCount = 0;
 let autoMatchedProductsCount = 0;
 let manualMatchedProductsCount = 0;
 const errors: string[] = [];
 const duplicates: string[] = [];
 const customerIdsProcessed = new Set<string>(); // Para evitar contar o mesmo cliente múltiplas vezes

 // Processar em background com pequenos delays para não bloquear a UI
 const processOrder = async (previewOrder: typeof csvPreviewData.orders[0], index: number) => {
 try {
 // Parse date
 const dateParts = previewOrder.date.split('/');
 const createdAt = dateParts.length === 3
 ? new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])).toISOString()
 : new Date().toISOString();

 // Verificar se é duplicado ANTES de processar
 if (isDuplicateOrder(previewOrder, createdAt)) {
 duplicateCount++;
 duplicates.push(`Linha ${previewOrder.rowIndex} (${previewOrder.customerName}): Pedido já existe`);
 // Atualizar progresso mesmo para duplicados
 const current = index + 1;
 const percentage = Math.round((current / totalOrders) * 100);
 setSaveProgress({ current, total: totalOrders, percentage });
 return; // Não processar duplicados
 }
 // Converter preview order para Order
 // Usar o nome do CSV mesmo sem produto associado
 // Usar o valor total do CSV como valor do pedido
 const totalQuantity = previewOrder.items.reduce((sum, i) => sum + i.quantity, 0);

 const orderItems: OrderItem[] = previewOrder.items.map(item => {
 // Se tem produto associado, usar o nome do produto do sistema
 // Se não tem, usar o nome do CSV (mantém o nome original)
 const productName = item.matchedProduct?.name || item.productName;

 // Contar associações
 if (item.matchedProduct) {
 if (!item.needsManualMatch) {
 autoMatchedProductsCount++;
 } else {
 manualMatchedProductsCount++;
 }
 }

 // Calcular preço por unidade
 // Prioridade: usar preço editado manualmente, senão distribuir proporcionalmente pelo total do CSV
 let pricePerUnit = 0;

 if (item.price > 0 && item.quantity > 0) {
 // Se tem preço editado manualmente, usar esse
 pricePerUnit = item.price / item.quantity;
 } else if (totalQuantity > 0) {
 // Distribuir o total do CSV proporcionalmente pela quantidade
 const itemWeight = item.quantity / totalQuantity;
 const itemTotalPrice = previewOrder.totalAmount * itemWeight;
 pricePerUnit = item.quantity > 0 ? itemTotalPrice / item.quantity : 0;
 }

 return {
 productId: item.matchedProduct?.id, // Pode ser undefined se não associado
 variantId: item.matchedVariant?.id, // Incluir variantId se houver
 productName: productName, // Nome do CSV ou do produto associado
 quantity: item.quantity,
 unit: item.unit,
 priceAtTime: pricePerUnit > 0 ? pricePerUnit : 0
 };
 });

 // Usar customerId do matchedCustomer se existir
 const customerId = previewOrder.matchedCustomer?.id || '';

 // Usar o valor total do CSV como valor do pedido
 const order: Order = {
 id: '',
 customerId: customerId, // Usar ID do cliente detectado se existir
 customerName: previewOrder.customerName,
 customerPhone: previewOrder.customerPhone,
 items: orderItems,
 totalAmount: previewOrder.totalAmount, // Usar valor do CSV
 status: OrderStatus.DELIVERED,
 createdAt,
 source: 'Direct',
 isDelivery: previewOrder.isDelivery,
 deliveryLocation: previewOrder.deliveryLocation,
 deliveryFee: previewOrder.deliveryFee,
 externalId: previewOrder.notes
 ? `CSV-${previewOrder.rowIndex}-${Date.now().toString().slice(-4)}|NOTAS:${previewOrder.notes}`
 : `CSV-${previewOrder.rowIndex}-${Date.now().toString().slice(-4)}`,
 createdBy: currentUser?.id,
 createdByName: currentUser?.name
 };

 const result = await dataService.createOrder(order);
 if (result.order) {
 successCount++;
 trackAction('create', { entity: 'order', entityId: result.order.id, changes: { customerName: order.customerName, source: 'csv_import' } });

 // Rastrear clientes criados/atualizados (evitar duplicatas)
 if (result.order.customerId && !customerIdsProcessed.has(result.order.customerId)) {
 if (result.customerCreated) {
 customersCreatedCount++;
 }
 if (result.customerUpdated) {
 customersUpdatedCount++;
 }
 customerIdsProcessed.add(result.order.customerId);
 }
 } else {
 errorCount++;
 errors.push(`Linha ${previewOrder.rowIndex} (${previewOrder.customerName}): Falha ao criar.`);
 }
 } catch (e: any) {
 errorCount++;
 errors.push(`Linha ${previewOrder.rowIndex} (${previewOrder.customerName}): ${e.message}`);
 }

 // Atualizar progresso
 const current = index + 1;
 const percentage = Math.round((current / totalOrders) * 100);
 setSaveProgress({ current, total: totalOrders, percentage });
 };

 // Processar todos os pedidos em sequência com pequenos delays
 for (let i = 0; i < csvPreviewData.orders.length; i++) {
 await processOrder(csvPreviewData.orders[i], i);
 // Pequeno delay para não bloquear a UI (10ms entre cada pedido)
 if (i < csvPreviewData.orders.length - 1) {
 await new Promise(resolve => setTimeout(resolve, 10));
 }
 }

 setIsImporting(false);

 // Preparar detalhes do resultado
 const details: string[] = [];
 if (autoMatchedProductsCount > 0) {
 details.push(`âœ… ${autoMatchedProductsCount} produto(s) associado(s) automaticamente`);
 }
 if (manualMatchedProductsCount > 0) {
 details.push(`ðŸ”— ${manualMatchedProductsCount} produto(s) associado(s) manualmente`);
 }
 if (unmatchedItems > 0) {
 details.push(`âš ï¸ ${unmatchedItems} produto(s) não associado(s)`);
 }
 if (duplicateCount > 0) {
 details.push(`âš ï¸ ${duplicateCount} pedido(s) duplicado(s) ignorado(s)`);
 }
 details.push(...errors);

 setImportResult({
 success: successCount,
 errors: errorCount,
 details: details,
 customersCreated: customersCreatedCount,
 customersUpdated: customersUpdatedCount
 });

 // Mostrar notificaçéo de conclusão
 let message = '';
 if (successCount > 0) {
 message = `âœ… ${successCount} pedido(s) salvos com sucesso!`;
 if (autoMatchedProductsCount > 0) {
 message += ` ${autoMatchedProductsCount} produto(s) auto-associado(s).`;
 }
 if (customersCreatedCount > 0 || customersUpdatedCount > 0) {
 message += ` ${customersCreatedCount + customersUpdatedCount} cliente(s) atualizado(s).`;
 }
 if (duplicateCount > 0) {
 message += ` (${duplicateCount} duplicado(s) ignorado(s))`;
 }
 if (errorCount > 0) {
 message += ` (${errorCount} erro(s))`;
 }
 showToast(message, 'success');
 if (onImportComplete) {
 // Não fechar automaticamente - deixar o usuário ver o resultado
 setTimeout(() => {
 onImportComplete();
 }, 1000);
 }
 } else if (duplicateCount > 0) {
 showToast(`âš ï¸ Todos os pedidos já existem (${duplicateCount} duplicado(s) ignorado(s))`, 'warning');
 } else {
 showToast(`âŒ Nenhum pedido foi salvo. Verifique os erros.`, 'error');
 }

 // Limpar progresso após 2 segundos
 setTimeout(() => {
 setSaveProgress(null);
 }, 2000);
 };



 // ------------------------------------------------------------------
 // MANUAL FORM LOGIC
 // ------------------------------------------------------------------

 // Função auxiliar para verificar estoque disponível
 // originalOrderItems: itens originais do pedido (quando editando) - o stock já foi deduzido para estes itens
 const checkStockAvailability = (product: Product, variant: ProductVariant | null, requestedQuantity: number, currentItems: OrderItem[], originalOrderItems?: OrderItem[]): { available: boolean; availableStock: number; message: string } => {
 let availableStock = 0;

 if (variant) {
 availableStock = variant.stock ?? 0;
 } else {
 if (product.variants && product.variants.length > 0) {
 availableStock = product.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
 } else {
 availableStock = 0;
 }
 }

 // Se estamos editando um pedido existente, adicionar de volta o stock dos itens originais
 // (porque o stock já foi deduzido quando o pedido foi criado/entregue)
 if (originalOrderItems && originalOrderItems.length > 0) {
 const originalQuantity = originalOrderItems
 .filter(item => {
 if (variant) {
 return item.productId === product.id && item.variantId === variant.id;
 } else {
 return item.productId === product.id && !item.variantId;
 }
 })
 .reduce((sum, item) => sum + item.quantity, 0);

 // Adicionar de volta o stock dos itens originais
 availableStock += originalQuantity;
 }

 // Subtrair quantidade já adicionada no pedido atual
 const alreadyInOrder = currentItems
 .filter(item => {
 if (variant) {
 return item.productId === product.id && item.variantId === variant.id;
 } else {
 return item.productId === product.id && !item.variantId;
 }
 })
 .reduce((sum, item) => sum + item.quantity, 0);

 const remainingStock = availableStock - alreadyInOrder;
 const canAdd = requestedQuantity <= remainingStock;

 const productName = variant ? `${product.name} ${variant.name}` : product.name;
 const message = canAdd
 ? ''
 : remainingStock <= 0
 ? `âš ï¸ Sem estoque disponível para ${productName}. Estoque: ${availableStock}`
 : `âš ï¸ Estoque insuficiente para ${productName}. Disponível: ${remainingStock}, Solicitado: ${requestedQuantity}`;

 return {
 available: canAdd,
 availableStock: remainingStock,
 message
 };
 };

 const handleAddItemManual = (productId: string) => {
 const product = products.find(p => p.id === productId);
 if (!product) return;

 // Se o produto tem variações, mostrar modal de seleção
 // Verificar tanto variants quanto hasVariants para garantir compatibilidade
 const hasVariants = (product.variants && product.variants.length > 0) || product.hasVariants;

 if (hasVariants) {
 setVariantSelectionModal({
 isOpen: true,
 product: product,
 isEditMode: false
 });
 return;
 }

 // Verificar estoque antes de adicionar
 const stockCheck = checkStockAvailability(product, null, 1, selectedItems);
 if (!stockCheck.available) {
 showToast(stockCheck.message, 'warning');
 return;
 }

 // Produto sem variações - adicionar diretamente
 const existing = selectedItems.find(i => i.productId === productId && !i.variantId);
 if (existing) {
 // Verificar estoque antes de incrementar quantidade
 const newQuantity = existing.quantity + 1;
 const stockCheckIncrement = checkStockAvailability(product, null, newQuantity, selectedItems);
 if (!stockCheckIncrement.available) {
 showToast(stockCheckIncrement.message, 'warning');
 return;
 }
 setSelectedItems(selectedItems.map(i =>
 i.productId === productId && !i.variantId
 ? { ...i, quantity: newQuantity }
 : i
 ));
 } else {
 setSelectedItems([...selectedItems, {
 productId: product.id,
 productName: product.name,
 quantity: 1,
 priceAtTime: product.price,
 unit: product.unit
 }]);
 setExpandedSections(prev => new Set(prev).add('orderItems'));
 }
 };

 const handleAddItemWithVariant = (product: Product, variant: ProductVariant) => {
 // Se há um pendingProductMatch, estamos associando produto na pré-visualização
 if (pendingProductMatch && csvPreviewData) {
 const newOrders = [...csvPreviewData.orders];
 const order = newOrders[pendingProductMatch.orderIndex];
 const item = order.items[pendingProductMatch.itemIndex];

 // Atualizar item com produto e variação associados
 item.matchedProduct = product;
 item.matchedVariant = variant;
 item.needsManualMatch = false;

 // Recalcular preço usando preço da variação
 const fixedPrice = getFixedProductPrice(item.productName, item.quantity, item.unit);
 if (fixedPrice !== null) {
 item.price = fixedPrice * item.quantity;
 } else {
 item.price = variant.price * item.quantity;
 }

 setCsvPreviewData({ ...csvPreviewData, orders: newOrders });
 setPendingProductMatch(null);
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 return;
 }

 if (variantSelectionModal.isEditMode) {
 handleAddEditItemWithVariant(product, variant);
 return;
 }

 // Verificar estoque antes de adicionar
 const stockCheck = checkStockAvailability(product, variant, 1, selectedItems);
 if (!stockCheck.available) {
 showToast(stockCheck.message, 'warning');
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 return;
 }

 const displayName = variant.name ? `${product.name} ${variant.name}` : product.name;

 // Verificar se já existe item com mesmo produto e variação
 const existing = selectedItems.find(i =>
 i.productId === product.id && i.variantId === variant.id
 );

 if (existing) {
 // Verificar estoque antes de incrementar quantidade
 const newQuantity = existing.quantity + 1;
 const stockCheckIncrement = checkStockAvailability(product, variant, newQuantity, selectedItems);
 if (!stockCheckIncrement.available) {
 showToast(stockCheckIncrement.message, 'warning');
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 return;
 }
 setSelectedItems(selectedItems.map(i =>
 i.productId === product.id && i.variantId === variant.id
 ? { ...i, quantity: newQuantity }
 : i
 ));
 } else {
 setSelectedItems([...selectedItems, {
 productId: product.id,
 variantId: variant.id,
 variantName: variant.name,
 productName: displayName,
 quantity: 1,
 priceAtTime: variant.price,
 unit: variant.unit || product.unit
 }]);
 setExpandedSections(prev => new Set(prev).add('orderItems'));
 }

 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 };

 const handleUpdateItemQuantity = (itemIndex: number, quantity: number) => {
 if (quantity <= 0) {
 setSelectedItems(selectedItems.filter((_, i) => i !== itemIndex));
 return;
 }

 const item = selectedItems[itemIndex];
 if (!item) return;

 const product = products.find(p => p.id === item.productId);
 if (!product) {
 // Se néo encontrar o produto, permitir atualizar mesmo assim (pode ser produto removido)
 setSelectedItems(selectedItems.map((item, i) =>
 i === itemIndex ? { ...item, quantity } : item
 ));
 return;
 }

 // Encontrar a variação se existir
 const variant = item.variantId
 ? product.variants?.find(v => v.id === item.variantId) || null
 : null;

 // Verificar estoque antes de atualizar quantidade
 // Remover o item atual da lista para calcular o estoque disponível corretamente
 const itemsWithoutCurrent = selectedItems.filter((_, i) => i !== itemIndex);
 const stockCheck = checkStockAvailability(product, variant, quantity, itemsWithoutCurrent);

 if (!stockCheck.available) {
 showToast(stockCheck.message, 'warning');
 return;
 }

 setSelectedItems(selectedItems.map((item, i) =>
 i === itemIndex ? { ...item, quantity } : item
 ));
 };

 const handleUpdateItemPrice = (itemIndex: number, price: number) => {
 if (price < 0) return;
 setSelectedItems(selectedItems.map((item, i) =>
 i === itemIndex ? { ...item, priceAtTime: price } : item
 ));
 };

 const handleRemoveItem = (itemIndex: number) => {
 setSelectedItems(selectedItems.filter((_, i) => i !== itemIndex));
 };

 // Função para alterar variação de um item
 const handleUpdateItemVariant = (itemIndex: number, variantId: string) => {
 const item = selectedItems[itemIndex];
 if (!item) return;

 const product = products.find(p => p.id === item.productId);
 if (!product || !product.variants) return;

 const variant = product.variants.find(v => v.id === variantId);
 if (!variant) return;

 // Atualizar item com nova variação
 setSelectedItems(selectedItems.map((it, i) =>
 i === itemIndex
 ? {
 ...it,
 variantId: variant.id,
 variantName: variant.name,
 priceAtTime: variant.price,
 unit: variant.unit || product.unit
 }
 : it
 ));
 };

 const calculateManualTotal = () => selectedItems.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);

 // Validação do Step 1 (Cliente): nome preenchido
 useEffect(() => {
 setStep1Valid(newOrderCustomerName.trim().length > 0);
 }, [newOrderCustomerName]);

 // Validação do Step 2 (Produtos): pelo menos um item
 useEffect(() => {
 setStep2Valid(selectedItems.length > 0);
 }, [selectedItems.length]);

 // Preencher número do pedido ao abrir o modal (último + 1)
 useEffect(() => {
 if (isModalOpen) {
 dataService.getNextOrderNumber().then(next => {
 setNewOrderNumber(prev => (prev === '' ? next : prev));
 }).catch(() => setNewOrderNumber('1'));
 }
 }, [isModalOpen]);

 // Função para adicionar produto ao carrinho
 const handleSelectProduct = (product: Product, variant?: ProductVariant) => {
 const variantToUse = variant || product.variants?.find(v => v.isDefault) || product.variants?.[0];
 const price = variantToUse?.price || product.price;
 const unit = variantToUse?.unit || product.unit || 'un';
 const variantName = variantToUse?.name;
 const variantId = variantToUse?.id;

 // Verificar se o item já existe
 const existingIndex = selectedItems.findIndex(
 item => item.productId === product.id && item.variantId === variantId
 );

 if (existingIndex >= 0) {
 // Se já existe, aumentar quantidade
 setSelectedItems(selectedItems.map((item, i) =>
 i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
 ));
 } else {
 // Adicionar novo item
 const newItem: OrderItem = {
 productId: product.id,
 productName: product.name,
 variantId: variantId,
 variantName: variantName,
 quantity: 1,
 unit: unit,
 priceAtTime: price
 };
 setSelectedItems([...selectedItems, newItem]);
 }
 showToast(`${product.name} adicionado ao pedido`, 'success', 2000);
 };

 // Navegação entre steps (4 passos: Cliente, Produtos, Entrega, Pagamento)
 const handleNextStep = () => {
 if (currentStep === 1 && step1Valid) setCurrentStep(2);
 else if (currentStep === 2 && step2Valid) setCurrentStep(3);
 else if (currentStep === 3) setCurrentStep(4);
 };

 const handlePreviousStep = () => {
 if (currentStep === 2) setCurrentStep(1);
 else if (currentStep === 3) setCurrentStep(2);
 else if (currentStep === 4) setCurrentStep(3);
 };

 const handleStepChange = (step: number) => {
 if (step === 1) setCurrentStep(1);
 else if (step === 2 && step1Valid) setCurrentStep(2);
 else if (step === 3 && step1Valid && step2Valid) setCurrentStep(3);
 else if (step === 4 && step1Valid && step2Valid) setCurrentStep(4);
 };

 const handleManualSubmit = async () => {
 if (!newOrderCustomerName.trim()) {
 showToast('Por favor, insira o nome do cliente', 'error');
 return;
 }
 if (selectedItems.length === 0) {
 showToast('Por favor, adicione pelo menos um item ao pedido', 'error');
 return;
 }

 // Verificar se o número do pedido já existe (quando o utilizador alterou o número)
 if (newOrderNumber.trim()) {
 setIsCheckingOrderNumber(true);
 try {
 const exists = await dataService.checkOrderNumberExists(newOrderNumber.trim());
 if (exists) {
 setOrderNumberError('Este número de pedido já existe. Por favor, escolha outro número.');
 showToast('Este número de pedido já existe. Por favor, escolha outro número.', 'error');
 setIsCheckingOrderNumber(false);
 return;
 }
 } catch (_) {
 showToast('Erro ao verificar número do pedido. Tente novamente.', 'error');
 setIsCheckingOrderNumber(false);
 return;
 }
 setIsCheckingOrderNumber(false);
 }

 const totalAmount = calculateManualTotal() + (newOrderIsDelivery ? newOrderDeliveryFee : 0);

 const newOrder: Order = {
 id: `o${Date.now()}`,
 customerId: selectedCustomerId || `temp_${Date.now()}`,
 customerName: newOrderCustomerName.trim(),
 customerPhone: newOrderCustomerPhone.trim(),
 items: selectedItems,
 totalAmount: totalAmount,
 status: newOrderStatus,
 createdAt: newOrderDate ? new Date(newOrderDate + 'T00:00:00').toISOString() : new Date().toISOString(),
 source: 'Direct',
 isDelivery: newOrderIsDelivery,
 deliveryLocation: newOrderIsDelivery ? newOrderDeliveryLocation : undefined,
 deliveryFee: newOrderIsDelivery ? newOrderDeliveryFee : 0,
 deliveryZoneId: newOrderIsDelivery && newOrderDeliveryZoneId ? newOrderDeliveryZoneId : undefined,
 deliveryZoneName: newOrderIsDelivery && newOrderDeliveryZoneName ? newOrderDeliveryZoneName : undefined,
 orderNumber: newOrderNumber.trim() || undefined,
 paymentStatus: newOrderPaymentStatus,
 amountPaid: newOrderAmountPaid,
 paymentProof: newOrderPaymentProof.trim() || undefined,
 paymentProofText: newOrderPaymentProofText.trim() || undefined,
 notes: newOrderNotes.trim() || undefined,
 createdBy: currentUser?.id,
 createdByName: currentUser?.name
 };

 setIsSavingOrder(true);
 try {
 await onAddOrder(newOrder);
 trackAction('create', { entity: 'order', changes: { customerName: newOrder.customerName, totalAmount: newOrder.totalAmount } });
 resetModal();
 } catch (err) {
 showToast('Erro ao salvar o pedido. Tente novamente.', 'error', 5000);
 console.error('[Orders] handleManualSubmit error:', err);
 } finally {
 setIsSavingOrder(false);
 }
 };

 // Produtos com stock (pelo menos uma unidade): por variação ou produto sem variações
 const productsWithStock = useMemo(() => {
 return products.filter(p => {
 if (p.variants && p.variants.length > 0) {
 return p.variants.some(v => (v.stock ?? 0) > 0);
 }
 return (p.stock ?? 0) > 0;
 });
 }, [products]);

 // Filter products by search query (aplicado sobre productsWithStock)
 const filteredProducts = useMemo(() => {
 let list = productsWithStock;
 if (!productSearchQuery.trim()) return list;
 const query = normalizeForSearch(productSearchQuery);
 return list.filter(p =>
 normalizeForSearch(p.name).includes(query) ||
 (p.category && normalizeForSearch(p.category).includes(query))
 );
 }, [productsWithStock, productSearchQuery]);

 // Filtrar itens adicionados
 const filteredItems = useMemo(() => {
 if (!itemSearchQuery.trim()) return selectedItems;
 const query = normalizeForSearch(itemSearchQuery);
 return selectedItems.filter(item =>
 normalizeForSearch(item.productName).includes(query) ||
 (item.variantName && normalizeForSearch(item.variantName).includes(query)) ||
 (item.unit && normalizeForSearch(item.unit).includes(query))
 );
 }, [selectedItems, itemSearchQuery]);

 // Agrupar produtos por categoria
 const productsByCategory = useMemo(() => {
 const grouped = new Map<string, typeof filteredProducts>();
 filteredProducts.forEach(product => {
 const category = product.category || 'Sem Categoria';
 if (!grouped.has(category)) {
 grouped.set(category, []);
 }
 grouped.get(category)!.push(product);
 });
 return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
 }, [filteredProducts]);

 // Progresso do formulário (4 passos: 25% por passo)
 const formProgress = useMemo(() => Math.round((currentStep / 4) * 100), [currentStep]);

 const resetModal = () => {
 setIsModalOpen(false);
 setSelectedItems([]);
 setNewOrderCustomerName('');
 setNewOrderCustomerPhone('');
 setNewOrderDate(getTodayDateString());
 setNewOrderDeliveryLocation('');
 setNewOrderIsDelivery(false);
 setNewOrderDeliveryFee(0);
 setNewOrderDeliveryZoneId('');
 setNewOrderDeliveryZoneName('');
 setSuggestedCustomer(null);
 setShowCustomerSuggestion(false);
 setSelectedCustomerId('');
 setNewOrderNumber('');
 setNewOrderStatus(OrderStatus.PENDING);
 setNewOrderPaymentStatus('unpaid');
 setNewOrderAmountPaid(0);
 setNewOrderPaymentProof('');
 setNewOrderPaymentProofText('');
 setNewOrderNotes('');
 setOrderNumberError('');
 setIsCheckingOrderNumber(false);
 setCsvFile(null);
 setImportResult(null);
 setCsvPreviewData(null);
 setEditingPreviewOrderIndex(null);
 setProductMatchModal({ isOpen: false, orderIndex: -1, itemIndex: -1, searchQuery: '' });
 setProductSearchQuery('');
 setSaveProgress(null);
 // Reset steps
 setCurrentStep(1);
 setStep1Valid(false);
 setIsSavingOrder(false);
 setIsImporting(false);
 setShowImportDetails(false);
 setShowCsvFormat(false);
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setItemSearchQuery('');
 setStep2Valid(false);
 // Resetar seções colapsáveis para o estado padrão (cliente, produtos, entrega, pagamento expandidos)
 setExpandedSections(new Set(['customer', 'products', 'orderItems', 'delivery', 'payment', 'orderInfo']));
 setVariantSearchQuery('');
 };

 // ------------------------------------------------------------------
 // EDIT LOGIC
 // ------------------------------------------------------------------
 const startEditing = () => {
 if (selectedOrder) {
 const order = selectedOrder as Order & { paymentProofText?: string; paymentProof?: string };
 setEditOrderData({
 ...JSON.parse(JSON.stringify(selectedOrder)),
 paymentProofText: order.paymentProofText ?? '',
 paymentProof: order.paymentProof ?? ''
 });
 setIsEditing(true);
 setEditCurrentStep(1);
 setEditProductSearchQuery('');
 }
 };

 const cancelEditing = () => {
 setIsEditing(false);
 setEditOrderData(null);
 };

 const saveEdit = () => {
 if (editOrderData && onEditOrder) {
 // Recalcular total incluindo taxa de entrega antes de salvar
 const itemsTotal = editOrderData.items.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 const finalTotal = itemsTotal + deliveryFee;

 const updatedOrder = {
 ...editOrderData,
 totalAmount: finalTotal
 };

 onEditOrder(updatedOrder);
 trackAction('update', { entity: 'order', entityId: updatedOrder.id, changes: { items: updatedOrder.items?.length, totalAmount: finalTotal } });
 setSelectedOrder(updatedOrder);
 setIsEditing(false);
 }
 };

 // Atualizar total quando taxa de entrega ou itens mudarem
 useEffect(() => {
 if (editOrderData) {
 const itemsTotal = editOrderData.items.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 const newTotal = itemsTotal + deliveryFee;

 if (Math.abs(newTotal - editOrderData.totalAmount) > 0.01) {
 setEditOrderData({
 ...editOrderData,
 totalAmount: newTotal
 });
 }
 }
 }, [editOrderData?.items, editOrderData?.isDelivery, editOrderData?.deliveryFee]);

 const handleEditItemChange = (index: number, field: keyof OrderItem, value: any) => {
 if (!editOrderData) return;
 const newItems = [...editOrderData.items];
 newItems[index] = { ...newItems[index], [field]: value };

 const itemsTotal = newItems.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 const newTotal = itemsTotal + deliveryFee;

 setEditOrderData({
 ...editOrderData,
 items: newItems,
 totalAmount: newTotal
 });
 };

 const handleUpdateEditItemPrice = (index: number, price: number) => {
 if (price < 0) return;
 handleEditItemChange(index, 'priceAtTime', price);
 };

 const handleRemoveEditItem = (index: number) => {
 if (!editOrderData) return;
 const newItems = editOrderData.items.filter((_, i) => i !== index);
 const itemsTotal = newItems.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 const newTotal = itemsTotal + deliveryFee;
 setEditOrderData({ ...editOrderData, items: newItems, totalAmount: newTotal });
 };

 const handleAddEditItem = (productId: string) => {
 if (!editOrderData) return;
 const product = products.find(p => p.id === productId);
 if (!product) return;

 // Se o produto tem variações, mostrar modal de seleção
 if (product.variants && product.variants.length > 0) {
 setVariantSelectionModal({
 isOpen: true,
 product: product,
 isEditMode: true
 });
 return;
 }

 // Verificar estoque antes de adicionar
 // Passar itens originais do pedido para considerar stock já deduzido
 const stockCheck = checkStockAvailability(product, null, 1, editOrderData.items, selectedOrder?.items);
 if (!stockCheck.available) {
 showToast(stockCheck.message, 'warning');
 return;
 }

 const existingIndex = editOrderData.items.findIndex(i => i.productId === productId && !i.variantId);
 let newItems;
 if (existingIndex >= 0) {
 // Verificar estoque antes de incrementar quantidade
 const newQuantity = editOrderData.items[existingIndex].quantity + 1;
 const stockCheckIncrement = checkStockAvailability(product, null, newQuantity, editOrderData.items, selectedOrder?.items);
 if (!stockCheckIncrement.available) {
 showToast(stockCheckIncrement.message, 'warning');
 return;
 }
 newItems = [...editOrderData.items];
 newItems[existingIndex].quantity = newQuantity;
 } else {
 newItems = [...editOrderData.items, {
 productId: product.id,
 productName: product.name,
 quantity: 1,
 priceAtTime: product.price,
 unit: product.unit
 }];
 }
 const itemsTotal = newItems.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 const newTotal = itemsTotal + deliveryFee;
 setEditOrderData({ ...editOrderData, items: newItems, totalAmount: newTotal });
 };

 const handleAddEditItemWithVariant = (product: Product, variant: ProductVariant) => {
 if (!editOrderData) return;

 // Verificar estoque antes de adicionar
 // Passar itens originais do pedido para considerar stock já deduzido
 const stockCheck = checkStockAvailability(product, variant, 1, editOrderData.items, selectedOrder?.items);
 if (!stockCheck.available) {
 showToast(stockCheck.message, 'warning');
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 return;
 }

 const displayName = variant.name ? `${product.name} ${variant.name}` : product.name;

 const existingIndex = editOrderData.items.findIndex(i =>
 i.productId === product.id && i.variantId === variant.id
 );

 let newItems;
 if (existingIndex >= 0) {
 // Verificar estoque antes de incrementar quantidade
 const newQuantity = editOrderData.items[existingIndex].quantity + 1;
 const stockCheckIncrement = checkStockAvailability(product, variant, newQuantity, editOrderData.items, selectedOrder?.items);
 if (!stockCheckIncrement.available) {
 showToast(stockCheckIncrement.message, 'warning');
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 return;
 }
 newItems = [...editOrderData.items];
 newItems[existingIndex].quantity = newQuantity;
 } else {
 newItems = [...editOrderData.items, {
 productId: product.id,
 variantId: variant.id,
 variantName: variant.name,
 productName: displayName,
 quantity: 1,
 priceAtTime: variant.price,
 unit: variant.unit || product.unit
 }];
 }

 const itemsTotal = newItems.reduce((acc, item) => acc + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 const newTotal = itemsTotal + deliveryFee;
 setEditOrderData({ ...editOrderData, items: newItems, totalAmount: newTotal });
 setVariantSelectionModal({ isOpen: false, product: null, isEditMode: false });
 setVariantSearchQuery('');
 };

 /** Usado pelo ProductGrid no modal Editar: adiciona produto (com variação opcional) aos itens do pedido em edição. */
 const handleEditSelectProduct = (product: Product, variant?: ProductVariant) => {
 const variantToUse = variant || product.variants?.find(v => v.isDefault) || product.variants?.[0];
 if (variantToUse) {
 handleAddEditItemWithVariant(product, variantToUse);
 } else {
 handleAddEditItem(product.id);
 }
 showToast(`${product.name} adicionado ao pedido`, 'success', 2000);
 };

 /** Atualiza a variação de um item na edição do pedido (usado pelo OrderItemEditor). */
 const handleUpdateEditItemVariant = (index: number, variantId: string) => {
 if (!editOrderData) return;
 const item = editOrderData.items[index];
 if (!item) return;
 const product = products.find(p => p.id === item.productId);
 if (!product) return;
 const variant = product.variants?.find(v => v.id === variantId);
 if (!variant) return;
 const newItems = [...editOrderData.items];
 newItems[index] = {
 ...item,
 variantId: variant.id,
 variantName: variant.name,
 productName: product.name,
 priceAtTime: variant.price,
 unit: variant.unit || product.unit
 };
 const itemsTotal = newItems.reduce((acc, i) => acc + (i.priceAtTime * i.quantity), 0);
 const deliveryFee = editOrderData.isDelivery ? (editOrderData.deliveryFee || 0) : 0;
 setEditOrderData({ ...editOrderData, items: newItems, totalAmount: itemsTotal + deliveryFee });
 };

 const handleUpdateEditItemQuantity = (index: number, quantity: number) => {
 if (!editOrderData) return;
 if (quantity <= 0) {
 handleRemoveEditItem(index);
 return;
 }

 const item = editOrderData.items[index];
 if (!item) return;

 const product = products.find(p => p.id === item.productId);
 if (!product) {
 // Se néo encontrar o produto, permitir atualizar mesmo assim (pode ser produto removido)
 handleEditItemChange(index, 'quantity', quantity);
 return;
 }

 // Encontrar a variação se existir
 const variant = item.variantId
 ? product.variants?.find(v => v.id === item.variantId) || null
 : null;

 // Verificar estoque antes de atualizar quantidade
 // Remover o item atual da lista para calcular o estoque disponível corretamente
 const itemsWithoutCurrent = editOrderData.items.filter((_, i) => i !== index);
 // Passar itens originais do pedido para considerar stock já deduzido
 const stockCheck = checkStockAvailability(product, variant, quantity, itemsWithoutCurrent, selectedOrder?.items);

 if (!stockCheck.available) {
 showToast(stockCheck.message, 'warning');
 return;
 }

 handleEditItemChange(index, 'quantity', quantity);
 };

 // Filter products for edit mode
 const filteredEditProducts = useMemo(() => {
 if (!editProductSearchQuery.trim()) return products;
 const query = normalizeForSearch(editProductSearchQuery);
 return products.filter(p =>
 normalizeForSearch(p.name).includes(query) ||
 (p.category && normalizeForSearch(p.category).includes(query))
 );
 }, [products, editProductSearchQuery]);

 const handleDelete = () => {
 if (selectedOrder && onDeleteOrder) {
 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja apagar este pedido? Esta ação não pode ser desfeita.\n\nCliente: ${selectedOrder.customerName}\nValor: ${formatMoney(selectedOrder.totalAmount)}\n${selectedOrder.orderNumber ? `Nº: ${selectedOrder.orderNumber}` : ''}`,
 title: 'Apagar pedido?',
 confirmText: 'Apagar',
 variant: 'danger',
 onConfirm: () => {
 trackAction('delete', { entity: 'order', entityId: selectedOrder.id });
 onDeleteOrder(selectedOrder.id);
 setSelectedOrder(null);
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 }
 };

 // ------------------------------------------------------------------
 // PRINT LOGIC
 // ------------------------------------------------------------------
 const handlePrint = async (order: Order) => {
 // Carregar config fiscal (best-effort)
 let tax = { companyName: 'NaturErva', companyNuit: '', companyAddress: '', vatRate: 16 };
 try {
 const apiMod = await import('../../core/services/apiClient');
 const cfg = await apiMod.default.get<typeof tax>('/tax/config');
 if (cfg?.companyName) tax = cfg as typeof tax;
 } catch {}

 const vatMult = 1 + tax.vatRate / 100;
 const itemsSubtotal = order.items.reduce((s, it) => s + (it.priceAtTime ?? it.price ?? 0) * it.quantity, 0);
 const baseIva = itemsSubtotal / vatMult;
 const ivaAmt = itemsSubtotal - baseIva;

 const itemsHtml = order.items.map(item => {
 const unitPrice = (item.priceAtTime ?? item.price ?? 0);
 const lineTotal = unitPrice * item.quantity;
 return `<tr>
 <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0">${item.quantity} ${item.unit || 'un'}</td>
 <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0">${item.productName}${item.variantName ? ` · ${item.variantName}` : ''}</td>
 <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right">${unitPrice.toFixed(2)} MT</td>
 <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${lineTotal.toFixed(2)} MT</td>
 </tr>`;
 }).join('');

 const printWindow = window.open('', '', 'width=750,height=950');
 if (!printWindow) return;

 printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo #${order.orderNumber || order.id.slice(0,8)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #16a34a;margin-bottom:16px}
.brand{font-size:20px;font-weight:800;color:#16a34a}
.brand-sub{font-size:10px;color:#555;margin-top:2px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.box{background:#f8fdf8;border:1px solid #d1fae5;border-radius:6px;padding:10px}
.box-label{font-size:9px;text-transform:uppercase;color:#16a34a;font-weight:700;letter-spacing:.5px;margin-bottom:4px}
.box-val{font-size:12px;color:#111;line-height:1.6}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
thead th{background:#16a34a;color:#fff;padding:7px 4px;font-size:11px;text-align:left}
thead th:last-child,thead th:nth-child(3){text-align:right}
.totals{margin-left:auto;width:270px;font-size:12px;border-collapse:collapse}
.totals td{padding:4px 6px}
.totals .sep td{border-top:1px solid #e5e7eb;padding-top:8px}
.totals .bold td{font-weight:700;font-size:14px;color:#16a34a}
.iva-note{font-size:10px;color:#888;text-align:right;margin-top:4px}
.track-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;margin-top:12px;display:flex;align-items:center;gap:10px}
.track-code{font-family:monospace;font-size:15px;font-weight:700;letter-spacing:2px;color:#1d4ed8}
.footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:10px;text-align:center;font-size:10px;color:#888}
</style></head><body>

<div class="header">
 <div>
 <div class="brand">${tax.companyName}</div>
 <div class="brand-sub">natural é saudável · NUIT: ${tax.companyNuit || '—'}</div>
 ${tax.companyAddress ? `<div style="font-size:10px;color:#666;margin-top:2px">${tax.companyAddress}</div>` : ''}
 </div>
 <div style="text-align:right">
 <div style="font-size:16px;font-weight:700">RECIBO</div>
 <div style="font-size:12px;color:#555">#${order.orderNumber || order.id.slice(0,8)}</div>
 <div style="font-size:11px;color:#777">${formatDateOnly(order.createdAt)}</div>
 </div>
</div>

<div class="grid">
 <div class="box">
 <div class="box-label">Cliente</div>
 <div class="box-val">
 <strong>${order.customerName}</strong><br>
 ${order.customerPhone ? `Tel: ${order.customerPhone}<br>` : ''}
 ${order.isDelivery && order.deliveryLocation ? `📍 ${order.deliveryLocation}` : '🏪 Levantamento em loja'}
 ${order.deliveryZoneName ? `<br><span style="font-size:10px;color:#555">${order.deliveryZoneName}</span>` : ''}
 </div>
 </div>
 <div class="box">
 <div class="box-label">Pagamento</div>
 <div class="box-val">
 Estado: <strong style="color:${order.paymentStatus === 'paid' ? '#16a34a' : '#dc2626'}">${order.paymentStatus === 'paid' ? '✓ Pago' : order.paymentStatus === 'partial' ? 'Parcial' : '✗ Não Pago'}</strong><br>
 ${order.paymentMethod ? `Método: ${order.paymentMethod}<br>` : ''}
 ${(order.amountPaid ?? 0) > 0 ? `Recebido: <strong>${(order.amountPaid ?? 0).toFixed(2)} MT</strong>` : ''}
 </div>
 </div>
</div>

<table>
 <thead><tr>
 <th>Qtd</th><th>Descrição</th>
 <th style="text-align:right">P.Unit.</th>
 <th style="text-align:right">Total</th>
 </tr></thead>
 <tbody>${itemsHtml}</tbody>
</table>

<table class="totals">
 <tbody>
 ${order.isDelivery && (order.deliveryFee ?? 0) > 0 ?
 `<tr><td>Subtotal artigos:</td><td style="text-align:right">${itemsSubtotal.toFixed(2)} MT</td></tr>
 <tr><td>Entrega${order.deliveryZoneName ? ` (${order.deliveryZoneName})` : ''}:</td><td style="text-align:right">${(order.deliveryFee ?? 0).toFixed(2)} MT</td></tr>` : ''}
 ${(order.discountAmount ?? 0) > 0 ?
 `<tr><td style="color:#16a34a">Desconto${order.couponCode ? ` (${order.couponCode})` : ''}:</td><td style="text-align:right;color:#16a34a">- ${(order.discountAmount ?? 0).toFixed(2)} MT</td></tr>` : ''}
 <tr class="sep bold"><td>TOTAL c/IVA:</td><td style="text-align:right">${(order.totalAmount ?? 0).toFixed(2)} MT</td></tr>
 </tbody>
</table>
<p class="iva-note">Base s/IVA: ${baseIva.toFixed(2)} MT &nbsp;|&nbsp; IVA ${tax.vatRate}%: ${ivaAmt.toFixed(2)} MT &nbsp;|&nbsp; NUIT emitente: ${tax.companyNuit || '—'}</p>

${order.trackingCode ? `<div class="track-box"><span style="font-size:10px;color:#1d4ed8;font-weight:700">RASTREIO</span><span class="track-code">${order.trackingCode}</span><span style="font-size:10px;color:#555">natur-erva.co.mz/minha-conta/encomendas</span></div>` : ''}

<div class="footer">
 ${tax.companyName} · NUIT ${tax.companyNuit || '—'} · IVA incluído à taxa de ${tax.vatRate}%<br>
 Obrigado pela sua preferência! 🌿
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
 printWindow.document.close();
 };

 const getStatusIcon = (status: OrderStatus) => {
 switch (status) {
 case OrderStatus.PENDING: return <Clock className="w-4 h-4 text-yellow-500" />;
 case OrderStatus.PROCESSING: return <Package className="w-4 h-4 text-blue-500" />;
 case OrderStatus.DELIVERED: return <CheckCircle className="w-4 h-4 text-green-500" />;
 case OrderStatus.CANCELLED: return <XCircle className="w-4 h-4 text-red-500" />;
 default: return <Clock className="w-4 h-4 text-content-muted" />;
 }
 };

 // Função para traduzir estados de pedido para português
 const getStatusLabel = (status: OrderStatus): string => {
 switch (status) {
 case OrderStatus.PENDING: return 'Pendente';
 case OrderStatus.PROCESSING: return 'Em Processamento';
 case OrderStatus.DELIVERED: return 'Entregue';
 case OrderStatus.CANCELLED: return 'Cancelado';
 default: return status;
 }
 };

 // Função para exportar pedidos para Excel
 const exportToExcel = async () => {
 try {
 if (filteredAndSortedOrders.length === 0) {
 showToast('Não há pedidos para exportar', 'warning');
 return;
 }

 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 // Preparar Informações do peré­odo e filtros
 const periodLabel = filterPeriod === 'custom'
 ? `${formatDateOnly(start)} a ${formatDateOnly(end)}`
 : filterPeriod === 'today' ? 'Hoje'
 : filterPeriod === 'thisWeek' ? 'Esta Semana'
 : filterPeriod === 'thisMonth' ? 'Este Mês'
 : filterPeriod === 'thisYear' ? 'Este Ano'
 : filterPeriod === 'lastWeek' ? 'Semana passada'
 : filterPeriod === 'lastMonth' ? 'Mês passado'
 : filterPeriod === 'lastYear' ? 'Ano passado'
 : `${formatDateOnly(start)} a ${formatDateOnly(end)}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: searchQuery });
 }
 if (filterStatus !== 'ALL') {
 filters.push({ label: 'Status', value: getStatusLabel(filterStatus) });
 }
 if (filterDelivery !== 'all') {
 filters.push({ label: 'Entrega', value: filterDelivery === 'yes' ? 'Sim' : 'Não' });
 }
 if (filterPayment !== 'ALL') {
 const paymentLabel = filterPayment === 'paid' ? 'Pagos'
 : filterPayment === 'unpaid' ? 'Não Pagos'
 : filterPayment === 'partial' ? 'Parcial'
 : 'Pagamento';
 filters.push({ label: 'Pagamento', value: paymentLabel });
 }
 filters.push({ label: 'Total de pedidos', value: filteredAndSortedOrders.length.toString() });

 // Preparar dados para exportaçéo
 const exportData = filteredAndSortedOrders.map(order => {
 const orderDate = new Date(order.createdAt);
 const normalizedStatus = normalizeOrderStatus(order);
 const salesAmount = order.totalAmount - (order.deliveryFee || 0);
 const receivedAmount = getPaidAmount(order);
 // Pedidos cancelados não mostram diferença (mostrar 0 ou vazio)
 const difference = normalizedStatus === OrderStatus.CANCELLED ? 0 : (receivedAmount - order.totalAmount);

 return {
 'Pedido': order.orderNumber || order.externalId || order.id.substring(0, 8),
 'Data': formatDateOnly(orderDate),
 'Cliente': order.customerName,
 'Telefone': order.customerPhone || '',
 'Status': getStatusLabel(normalizedStatus),
 'Vendedor': order.createdByName || 'Sistema',
 'Pagamento': getEffectivePaymentStatus(order) === 'paid' ? 'Pago' : getEffectivePaymentStatus(order) === 'partial' ? 'Parcial' : 'Não Pago',
 'Vendas': salesAmount,
 'Entregas': order.deliveryFee || 0,
 'Total': order.totalAmount,
 'Recebido': receivedAmount,
 'Diferença': difference,
 'É Entrega': order.isDelivery ? 'Sim' : 'Não',
 'Localização': order.deliveryLocation || '',
 'Itens': order.items.map(item => `${item.quantity}${item.unit} ${item.productName}${item.variantName ? ` ${item.variantName}` : ''}`).join('; '),
 'Notas': order.notes || ''
 };
 });

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Pedidos');

 const headerRow = await addExcelHeader(ws, 'Gestão de Pedidos', {
 period: periodLabel,
 filters,
 startRow: 0,
 });

 const headers = ['Pedido', 'Data', 'Cliente', 'Telefone', 'Status', 'Vendedor', 'Pagamento', 'Vendas', 'Entregas', 'Total', 'Recebido', 'Diferença', 'É Entrega', 'Localização', 'Itens', 'Notas'];
 formatExcelTableHeaders(ws, headers, headerRow, 0);

 const dataStartRow = headerRow + 1;
 addJsonToSheetAt(ws, exportData as Record<string, unknown>[], dataStartRow + 1, 1, { skipHeader: true });

 const dataEndRow = dataStartRow + exportData.length - 1;
 formatExcelDataCells(ws, dataStartRow, dataEndRow, 0, headers.length - 1, {
 alternateRowColors: true,
 numberFormat: '#,##0.00',
 });

 [12, 12, 25, 15, 12, 12, 12, 12, 12, 12, 12, 10, 25, 50, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 await addExcelFooter(ws, dataEndRow, { showCompanyInfo: true });

 const periodLabelFile = filterPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : filterPeriod;
 const filename = `pedidos_${periodLabelFile}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportaçéo para Excel conclué­da: ${filteredAndSortedOrders.length} pedidos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 // Função para exportar pedidos para PDF
 const exportToPDF = async () => {
 try {
 if (filteredAndSortedOrders.length === 0) {
 showToast('Não há pedidos para exportar', 'warning');
 return;
 }

 showToast('Gerando PDF...', 'info');

 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar Informações do peré­odo e filtros
 const periodLabel = filterPeriod === 'custom'
 ? `${formatDateOnly(start)} a ${formatDateOnly(end)}`
 : filterPeriod === 'today' ? 'Hoje'
 : filterPeriod === 'thisWeek' ? 'Esta Semana'
 : filterPeriod === 'thisMonth' ? 'Este Mês'
 : filterPeriod === 'thisYear' ? 'Este Ano'
 : filterPeriod === 'lastWeek' ? 'Semana passada'
 : filterPeriod === 'lastMonth' ? 'Mês passado'
 : filterPeriod === 'lastYear' ? 'Ano passado'
 : `${formatDateOnly(start)} a ${formatDateOnly(end)}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: searchQuery });
 }
 if (filterStatus !== 'ALL') {
 filters.push({ label: 'Status', value: getStatusLabel(filterStatus) });
 }
 if (filterDelivery !== 'all') {
 filters.push({ label: 'Entrega', value: filterDelivery === 'yes' ? 'Sim' : 'Não' });
 }
 if (filterPayment !== 'ALL') {
 const paymentLabel = filterPayment === 'paid' ? 'Pagos'
 : filterPayment === 'unpaid' ? 'Não Pagos'
 : filterPayment === 'partial' ? 'Parcial'
 : 'Pagamento';
 filters.push({ label: 'Pagamento', value: paymentLabel });
 }
 filters.push({ label: 'Total de pedidos', value: filteredAndSortedOrders.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Gestão de Pedidos', {
 period: periodLabel,
 filters,
 orientation: 'landscape',
 });

 // Totais com destaque
 const colors = getBrandColors();
 pdf.setFontSize(11);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(...colors.primaryRgb);
 pdf.text('Resumo:', margin, yPos);
 yPos += 6;

 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0); // Preto
 pdf.text(`Vendas: ${formatMoney(totals.totalSales)}`, margin, yPos);
 pdf.text(`Entregas: ${formatMoney(totals.totalDeliveries)}`, margin + 60, yPos);
 pdf.text(`Total: ${formatMoney(totals.totalAmount)}`, margin + 120, yPos);
 pdf.text(`Recebido: ${formatMoney(totals.valueReceived)}`, margin + 180, yPos);
 pdf.text(`Diferença: ${formatMoney(totalDifference)}`, margin + 240, yPos);
 yPos += 10;

 // Tabela de pedidos com cabeçalho destacado
 // Calcular largura disponível
 const availableWidth = pdfWidth - (margin * 2);

 // Proporções relativas das colunas (baseadas na importância/conteúdo)
 const colProportions = [1.0, 1.0, 2.0, 1.2, 1.5, 1.0, 1.2, 1.5, 1.5, 1.5, 1.5, 1.0]; // 12 colunas (adicionada Vendedor)
 const totalProportion = colProportions.reduce((sum, prop) => sum + prop, 0);

 // Calcular larguras proporcionais
 const colWidths = colProportions.map(prop => (prop / totalProportion) * availableWidth);

 // Calcular posições X das colunas
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 // Cabeçalho da tabela com cor da marca
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255); // Branco

 // Desenhar retângulo de fundo para cabeçalho
 pdf.setFillColor(...colors.primaryRgb);
 pdf.rect(margin, yPos - 4, pdfWidth - (margin * 2), 6, 'F');

 pdf.text('Pedido', colX[0], yPos);
 pdf.text('Data', colX[1], yPos);
 pdf.text('Cliente', colX[2], yPos);
 pdf.text('Status', colX[3], yPos);
 pdf.text('Vendedor', colX[4], yPos);
 pdf.text('Pag.', colX[5], yPos);
 pdf.text('Vendas', colX[6], yPos);
 pdf.text('Entregas', colX[7], yPos);
 pdf.text('Total', colX[8], yPos);
 pdf.text('Recebido', colX[9], yPos);
 pdf.text('Diferença', colX[10], yPos);

 // Linha sob cabeçalho
 yPos += 3;
 pdf.setDrawColor(...colors.primaryRgb);
 pdf.setLineWidth(0.5);
 pdf.line(margin, yPos, pdfWidth - margin, yPos);
 yPos += 5;

 // Dados da tabela com alternância de cores
 pdf.setFont('helvetica', 'normal');
 pdf.setFontSize(8);
 pdf.setTextColor(0, 0, 0); // Preto

 filteredAndSortedOrders.forEach((order, index) => {
 // Verificar se precisa de nova página
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 }

 // Alternância de cores nas linhas
 const isEvenRow = index % 2 === 0;
 if (isEvenRow) {
 pdf.setFillColor(249, 250, 251); // Cinza muito claro
 pdf.rect(margin, yPos - 3, pdfWidth - (margin * 2), 4, 'F');
 }

 const orderDate = new Date(order.createdAt);
 const normalizedStatus = normalizeOrderStatus(order);
 const salesAmount = order.totalAmount - (order.deliveryFee || 0);
 const receivedAmount = getPaidAmount(order);
 // Pedidos cancelados não mostram diferença (mostrar 0)
 const difference = normalizedStatus === OrderStatus.CANCELLED ? 0 : (receivedAmount - order.totalAmount);
 const paymentStatus = getEffectivePaymentStatus(order) === 'paid' ? 'Pago' : getEffectivePaymentStatus(order) === 'partial' ? 'Parcial' : 'Não Pago';

 pdf.text(order.orderNumber || order.externalId?.substring(0, 8) || order.id.substring(0, 8), colX[0], yPos);
 pdf.text(formatDateOnly(orderDate), colX[1], yPos);
 pdf.text(order.customerName.substring(0, 20), colX[2], yPos);
 pdf.text(getStatusLabel(normalizedStatus).substring(0, 10), colX[3], yPos);
 pdf.text((order.createdByName || 'Sistema').substring(0, 15), colX[4], yPos);
 pdf.text(paymentStatus.substring(0, 5), colX[5], yPos);
 pdf.text(formatMoney(salesAmount), colX[6], yPos);
 pdf.text(formatMoney(order.deliveryFee || 0), colX[7], yPos);
 pdf.text(formatMoney(order.totalAmount), colX[8], yPos);
 pdf.text(formatMoney(receivedAmount), colX[9], yPos);
 pdf.text(formatMoney(difference), colX[10], yPos);

 yPos += 5;
 });

 // Rodapé com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Gerar nome do arquivo
 const periodLabelFile = filterPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : filterPeriod;
 const filename = `pedidos_${periodLabelFile}_${getTodayDateString()}.pdf`;

 // Salvar arquivo
 pdf.save(filename);
 showToast(`Exportaçéo para PDF conclué­da: ${filteredAndSortedOrders.length} pedidos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 return (
 <div className="relative pb-20">
 <PageShell
 title="Pedidos"
 actions={
 <div className="flex items-center gap-2">
 {canCreate && (
 <button
 onClick={() => setIsModalOpen(true)}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 >
 <Plus className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Novo Pedido</span>
 </button>
 )}
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
 {/* Botéo Filtros - Apenas no Mobile */}
 {isMobile && (
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${showFilters || searchQuery || filterPeriod !== 'today' || filterDateFrom || filterDateTo || filterStatus !== 'ALL' || filterDelivery !== 'all' || filterCreatedBy !== 'ALL' || filterPayment !== 'ALL'
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-gray-600 hover:bg-border-strong text-white'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {(searchQuery || filterPeriod !== 'today' || filterDateFrom || filterDateTo || filterStatus !== 'ALL' || filterDelivery !== 'all' || filterCreatedBy !== 'ALL' || filterPayment !== 'ALL') && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {[searchQuery, filterPeriod !== 'today' ? 1 : 0, filterDateFrom ? 1 : 0, filterStatus !== 'ALL' ? 1 : 0, filterDelivery !== 'all' ? 1 : 0, filterCreatedBy !== 'ALL' ? 1 : 0, filterPayment !== 'ALL' ? 1 : 0].filter(Boolean).length}
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
 value={searchQuery}
 onChange={(val) => setSearchQuery(val)}
 placeholder="Buscar pedidos..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 {/* Status (dropdown) - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterStatus}
 onChange={(val) => {
 setFilterStatus(val as OrderStatus | 'ALL');
 setCurrentPage(1);
 }}
 ariaLabel="Filtrar por status"
 options={[
 { value: 'ALL', label: 'Estado' },
 ...Object.values(OrderStatus).map((s) => ({ value: s, label: getStatusLabel(s) })),
 ]}
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Entrega (dropdown) - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterDelivery}
 onChange={(val) => {
 setFilterDelivery(val as 'all' | 'yes' | 'no');
 setCurrentPage(1);
 }}
 ariaLabel="Filtrar por entrega"
 options={[
 { value: 'all', label: 'Entregas' },
 { value: 'yes', label: 'Sim' },
 { value: 'no', label: 'Não' },
 ]}
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Vendedor (dropdown) - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterCreatedBy}
 onChange={(val) => {
 setFilterCreatedBy(val as string | 'ALL');
 setCurrentPage(1);
 }}
 ariaLabel="Filtrar por vendedor"
 options={[
 { value: 'ALL', label: 'Vendedor' },
 ...users.map(user => ({ value: user.id, label: user.name || user.email || 'Usuário' })),
 ]}
 className="flex-shrink-0"
 size="compact"
 />
 </div>

 {/* Pagamento (dropdown) - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterPayment}
 onChange={(val) => {
 setFilterPayment(val as 'ALL' | 'paid' | 'unpaid' | 'partial');
 setCurrentPage(1);
 }}
 ariaLabel="Filtrar por pagamento"
 options={[
 { value: 'ALL', label: 'Pagamento' },
 { value: 'paid', label: 'Pagos' },
 { value: 'unpaid', label: 'Não Pagos' },
 { value: 'partial', label: 'Parcial' },
 ]}
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
 options={[6, 12, 24, 48, 96, 500]}
 label=""
 size="compact"
 className="flex-shrink-0"
 />
 </div>

 {/* Filtro Peré­odo - Oculto no Mobile */}
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

 {/* Botéo Limpar Filtros - Oculto no Mobile */}
 {(searchQuery || filterPeriod !== 'today' || filterDateFrom || filterDateTo || filterStatus !== 'ALL' || filterDelivery !== 'all' || filterCreatedBy !== 'ALL' || filterPayment !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterPeriod('today');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterStatus('ALL');
 setFilterDelivery('all');
 setFilterCreatedBy('ALL');
 setFilterPayment('ALL');
 setCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default dark:border-border-strong rounded text-content-secondary dark:text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
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
 className="p-1 rounded-lg hover:bg-surface-base dark:hover:bg-surface-base transition-colors"
 >
 <X className="w-4 h-4 text-content-muted" />
 </button>
 </div>

 <div className="space-y-3">
 {/* Filtros lado a lado */}
 <div className="grid grid-cols-2 gap-3">
 {/* Status */}
 <div>
 <label className="block text-xs font-medium text-content-secondary dark:text-content-secondary mb-2">
 Estado
 </label>
 <SelectFilter
 value={filterStatus}
 onChange={(val) => {
 setFilterStatus(val as OrderStatus | 'ALL');
 setCurrentPage(1);
 }}
 ariaLabel="Filtrar por status"
 options={[
 { value: 'ALL', label: 'Todos' },
 ...Object.values(OrderStatus).map((s) => ({ value: s, label: getStatusLabel(s) })),
 ]}
 className="w-full"
 size="md"
 />
 </div>

 {/* Entrega */}
 <div>
 <label className="block text-xs font-medium text-content-secondary dark:text-content-secondary mb-2">
 Entregas
 </label>
 <SelectFilter
 value={filterDelivery}
 onChange={(val) => {
 setFilterDelivery(val as 'all' | 'yes' | 'no');
 setCurrentPage(1);
 }}
 ariaLabel="Filtrar por entrega"
 options={[
 { value: 'all', label: 'Todas' },
 { value: 'yes', label: 'Sim' },
 { value: 'no', label: 'Não' },
 ]}
 className="w-full"
 size="md"
 />
 </div>
 </div>

 {/* Segunda linha lado a lado */}
 <div className="grid grid-cols-2 gap-3">
 {/* Itens por página */}
 <div>
 <label className="block text-xs font-medium text-content-secondary dark:text-content-secondary mb-2">
 Itens por página
 </label>
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[6, 12, 24, 48, 96, 500]}
 label=""
 size="md"
 className="w-full"
 />
 </div>

 {/* Filtro Peré­odo */}
 <div>
 <label className="block text-xs font-medium text-content-secondary dark:text-content-secondary mb-2">
 Peré­odo
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
 </div>

 {/* Botéo Limpar Filtros */}
 {(searchQuery || filterPeriod !== 'today' || filterDateFrom || filterDateTo || filterStatus !== 'ALL' || filterDelivery !== 'all' || filterCreatedBy !== 'ALL' || filterPayment !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterPeriod('today');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterStatus('ALL');
 setFilterDelivery('all');
 setFilterCreatedBy('ALL');
 setFilterPayment('ALL');
 setCurrentPage(1);
 }}
 className="w-full px-4 py-2 text-sm border border-border-default dark:border-border-strong rounded-lg text-content-secondary dark:text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base transition-colors flex items-center justify-center gap-2"
 >
 <X className="w-4 h-4" />
 Limpar Filtros
 </button>
 )}
 </div>
 </div>
 )}


 {/* Grid View */}
 {viewMode === 'grid' && (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
 {paginatedOrders.map(order => {
 const isSelected = selectedOrderIds.includes(order.id);
 const isItemsExpanded = expandedOrderItems.has(order.id);
 const isNotesExpanded = expandedOrderNotes.has(order.id);

 // Extrair notas do externalId se existirem
 let notes = '';
 if (order.externalId && order.externalId.includes('|NOTAS:')) {
 const notesMatch = order.externalId.match(/\|NOTAS:(.+)$/);
 if (notesMatch) {
 notes = notesMatch[1];
 }
 }
 // Remover a parte das notas do externalId para exibiçéo
 const displayExternalId = order.externalId ? order.externalId.split('|NOTAS:')[0] : null;

 const toggleItems = (e: React.MouseEvent) => {
 e.stopPropagation();
 const newSet = new Set(expandedOrderItems);
 if (isItemsExpanded) {
 newSet.delete(order.id);
 } else {
 newSet.add(order.id);
 }
 setExpandedOrderItems(newSet);
 };

 const toggleNotes = (e: React.MouseEvent) => {
 e.stopPropagation();
 const newSet = new Set(expandedOrderNotes);
 if (isNotesExpanded) {
 newSet.delete(order.id);
 } else {
 newSet.add(order.id);
 }
 setExpandedOrderNotes(newSet);
 };

 return (
 <div
 key={order.id}
 className={`bg-surface-raised rounded-xl shadow-sm border p-5 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group relative ${isSelected ? 'border-brand-500 ring-1 ring-brand-500 dark:border-brand-500' : 'border-border-default '
 }`}
 onClick={() => { setSelectedOrder(order); setIsEditing(false); }}
 >
 {/* Selection Checkbox */}
 {canDelete && onDeleteOrders && (
 <div
 className="absolute top-4 right-4 z-10"
 onClick={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}
 >
 {isSelected ? (
 <CheckSquare className="w-5 h-5 text-brand-600 dark:text-brand-400 fill-brand-100 dark:fill-brand-900/50" />
 ) : (
 <Square className="w-5 h-5 text-content-muted hover:text-content-muted" />
 )}
 </div>
 )}

 {order.isDelivery && (
 <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 rounded-t-xl"></div>
 )}
 <div className="flex-1">
 {/* Header: Nome e Telefone na mesma linha */}
 <div className="flex justify-between items-start mb-3 pr-6">
 <div className="flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-bold text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{order.customerName}</h3>
 {order.customerPhone && (
 <span className="text-xs text-content-muted flex items-center gap-1">
 <Smartphone className="w-3 h-3" />
 {order.customerPhone}
 </span>
 )}
 </div>
 </div>
 </div>

 {/* Data, ID e Status na mesma linha */}
 <div className="flex items-center gap-3 mb-3 flex-wrap">
 <div className="flex items-center gap-2">
 <Calendar className="w-3 h-3 text-content-muted" />
 <span className="text-xs text-content-muted">
 {formatDateWithOptions(order.createdAt, {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric'
 })}
 </span>
 </div>
 {order.orderNumber && (
 <span className="bg-brand-100 dark:bg-brand-900/20 px-2 py-0.5 rounded text-xs text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800">
 #{order.orderNumber}
 </span>
 )}
 {displayExternalId && !order.orderNumber && (
 <span className="bg-surface-base dark:bg-surface-base px-1.5 py-0.5 rounded text-xs text-content-secondary dark:text-content-secondary font-mono">
 #{displayExternalId}
 </span>
 )}
 <div className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 border bg-surface-base dark:bg-surface-base dark:border-border-strong dark:text-content-secondary`}>
 {getStatusIcon(normalizeOrderStatus(order))}
 <span>{getStatusLabel(normalizeOrderStatus(order))}</span>
 </div>
 {order.createdByName && (
 <div className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 border bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 text-blue-700 dark:text-blue-300">
 <UserIcon className="w-3 h-3" />
 <span>{order.createdByName}</span>
 </div>
 )}
 {/* Status de Pagamento (regra do comprovativo aplicada) */}
 {(() => {
 const effective = getEffectivePaymentStatus(order);
 const baseClass = 'px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 border';
 const colorClass =
 effective === 'paid'
 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
 : effective === 'partial'
 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
 : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';

 return (
 <div
 className={`${baseClass} ${colorClass}`}
 title={getPaymentStatusTooltip(order)}
 aria-label={getPaymentStatusTooltip(order)}
 >
 {effective === 'paid' && <CheckCircle className="w-4 h-4" />}
 {effective === 'partial' && <Clock className="w-4 h-4" />}
 {effective === 'unpaid' && <XCircle className="w-4 h-4" />}
 </div>
 );
 })()}
 </div>

 {/* Botéo para mostrar/ocultar itens com valores */}
 <button
 onClick={toggleItems}
 className="w-full flex items-center justify-between text-sm text-content-secondary hover:text-content-primary mb-2 p-2 rounded-lg hover:bg-surface-base dark:hover:bg-surface-base/50 transition-colors"
 >
 <div className="flex items-center gap-3">
 <span className="font-medium">
 {order.items.length} item(ns)
 </span>
 <div className="flex items-center gap-3 text-xs">
 <div>
 <span className="text-content-muted">VENDAS: </span>
 <span className="font-semibold text-content-secondary dark:text-content-secondary">
 {formatMoney(order.totalAmount - (order.deliveryFee || 0))}
 </span>
 </div>
 {order.isDelivery && order.deliveryFee && (
 <div>
 <span className="text-content-muted">ENTREGAS: </span>
 <span className="font-semibold text-content-secondary dark:text-content-secondary">
 {formatMoney(order.deliveryFee)}
 </span>
 </div>
 )}
 </div>
 </div>
 {isItemsExpanded ? (
 <ChevronUp className="w-4 h-4" />
 ) : (
 <ChevronDown className="w-4 h-4" />
 )}
 </button>

 {/* Informações de Pagamento e Diferença - Compacto */}
 <div className="flex items-center justify-between text-xs mb-2">
 <div className="flex items-center gap-3">
 <div>
 <span className="text-content-muted">RECEBIDO: </span>
 <span className="font-semibold text-content-secondary dark:text-content-secondary">
 {(() => {
 const amountReceived = getPaidAmount(order);
 return amountReceived > 0 ? formatMoney(amountReceived) : '-';
 })()}
 </span>
 </div>
 {(() => {
 const normalizedStatus = normalizeOrderStatus(order);
 // Pedidos cancelados não mostram diferença
 if (normalizedStatus === OrderStatus.CANCELLED) {
 return null;
 }
 const amountReceived = getPaidAmount(order);
 const difference = amountReceived - order.totalAmount;
 return difference !== 0 ? (
 <div>
 <span className="text-content-muted">DIFERENÇA: </span>
 <span className={`font-semibold ${difference < 0
 ? 'text-red-600 dark:text-red-400'
 : 'text-green-600 dark:text-green-400'
 }`}>
 {formatMoney(difference)}
 </span>
 </div>
 ) : null;
 })()}
 </div>
 </div>

 {/* Itens do pedido (ocultos por padrão) */}
 {isItemsExpanded && (
 <div className="space-y-2 mb-3 bg-surface-base dark:bg-surface-base p-3 rounded-lg">
 {order.items.map((item, idx) => (
 <div key={idx} className="flex justify-between text-sm text-content-secondary dark:text-content-secondary">
 <span>{item.quantity}{item.unit} {item.productName}{item.variantName ? ` ${item.variantName}` : ''}</span>
 <span className="text-content-muted">{formatMoney((item.priceAtTime ?? item.price ?? 0) * item.quantity)}</span>
 </div>
 ))}
 </div>
 )}

 {/* Notas (ocultas por padrão, abaixo dos itens) */}
 {notes && (
 <>
 <button
 onClick={toggleNotes}
 className="w-full flex items-center justify-between text-xs text-content-muted hover:text-content-secondary dark:hover:text-content-muted mb-2 p-1.5 rounded hover:bg-surface-base dark:hover:bg-surface-base/50 transition-colors"
 >
 <span className="flex items-center gap-1">
 ðŸ“ Notas
 </span>
 {isNotesExpanded ? (
 <ChevronUp className="w-3 h-3" />
 ) : (
 <ChevronDown className="w-3 h-3" />
 )}
 </button>
 {isNotesExpanded && (
 <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
 <p className="text-xs text-blue-800 dark:text-blue-200">{notes}</p>
 </div>
 )}
 </>
 )}
 </div>

 {/* Footer com açéo */}
 <div className="pt-4 border-t border-border-default flex justify-between items-center">
 <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatMoney(order.totalAmount)}</span>
 <Eye className="w-5 h-5 text-content-muted" />
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* List View - Tabela */}
 {viewMode === 'list' && (
 <div className="overflow-auto max-h-[calc(100vh-280px)] rounded-lg border border-border-default">
 <table className="w-full border-collapse">
 {/* Cabeçalho da Tabela */}
 <thead className="bg-surface-base dark:bg-surface-base sticky top-0 z-10 border-b border-border-default dark:border-border-default">
 <tr>
 {canDelete && onDeleteOrders && (
 <th className="w-10 px-2 py-2 text-left">
 {canDelete && onDeleteOrders && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 toggleSelectAll();
 }}
 className="flex items-center justify-center p-1 rounded hover:bg-surface-base transition-colors"
 title={selectedOrderIds.length > 0 && paginatedOrders.every(o => selectedOrderIds.includes(o.id)) ? 'Desselecionar todos' : 'Selecionar todos'}
 >
 {selectedOrderIds.length > 0 && paginatedOrders.every(o => selectedOrderIds.includes(o.id)) ? (
 <CheckSquare className="w-4 h-4 text-brand-600 dark:text-brand-400 fill-brand-100 dark:fill-brand-900/50" />
 ) : (
 <Square className="w-4 h-4 text-content-muted hover:text-content-secondary dark:hover:text-content-muted" />
 )}
 </button>
 )}
 </th>
 )}
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[80px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'id'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('id')}
 >
 <div className="flex items-center gap-1">
 PEDIDO
 {getSortIcon('id')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[150px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'customer'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('customer')}
 >
 <div className="flex items-center gap-1">
 CLIENTE
 {getSortIcon('customer')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'date'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('date')}
 >
 <div className="flex items-center gap-1">
 DATA
 {getSortIcon('date')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'status'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('status')}
 >
 <div className="flex items-center gap-1">
 STATUS
 {getSortIcon('status')}
 </div>
 </th>
 <th
 className="px-3 py-2 text-left text-xs font-semibold min-w-[120px] text-content-primary dark:text-content-muted"
 >
 <div className="flex items-center gap-1">
 <UserIcon className="w-3 h-3" />
 VENDEDOR
 </div>
 </th>
 <th
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'sales'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('sales')}
 >
 <div className="flex items-center justify-end gap-1">
 VENDAS
 {getSortIcon('sales')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'deliveries'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('deliveries')}
 >
 <div className="flex items-center justify-end gap-1">
 ENTREGAS
 {getSortIcon('deliveries')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'amount'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('amount')}
 >
 <div className="flex items-center justify-end gap-1">
 TOTAL
 {getSortIcon('amount')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'received'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('received')}
 >
 <div className="flex items-center justify-end gap-1">
 RECEBIDO
 {getSortIcon('received')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'difference'
 ? 'text-white bg-brand-600 dark:bg-brand-700'
 : 'text-content-primary dark:text-content-muted'
 }`}
 onClick={() => handleSort('difference')}
 >
 <div className="flex items-center justify-end gap-1">
 DIFERENÇA
 {getSortIcon('difference')}
 </div>
 </th>
 <th className="w-10 px-2 py-2"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedOrders.map(order => {
 const isSelected = selectedOrderIds.includes(order.id);
 const isItemsExpanded = expandedOrderItems.has(order.id);
 const isNotesExpanded = expandedOrderNotes.has(order.id);

 // Extrair notas do externalId se existirem
 let notes = '';
 if (order.externalId && order.externalId.includes('|NOTAS:')) {
 const notesMatch = order.externalId.match(/\|NOTAS:(.+)$/);
 if (notesMatch) {
 notes = notesMatch[1];
 }
 }
 // Remover a parte das notas do externalId para exibição
 const displayExternalId = order.externalId ? order.externalId.split('|NOTAS:')[0] : null;

 const toggleItems = (e: React.MouseEvent) => {
 e.stopPropagation();
 const newSet = new Set(expandedOrderItems);
 if (isItemsExpanded) {
 newSet.delete(order.id);
 } else {
 newSet.add(order.id);
 }
 setExpandedOrderItems(newSet);
 };

 const toggleNotes = (e: React.MouseEvent) => {
 e.stopPropagation();
 const newSet = new Set(expandedOrderNotes);
 if (isNotesExpanded) {
 newSet.delete(order.id);
 } else {
 newSet.add(order.id);
 }
 setExpandedOrderNotes(newSet);
 };

 return (
 <React.Fragment key={order.id}>
 <tr
 className={`bg-surface-raised hover:bg-surface-base dark:hover:bg-surface-base transition-colors cursor-pointer group ${isSelected ? 'bg-brand-50 dark:bg-brand-600/20 border-l-2 border-l-brand-600 dark:border-l-brand-400' : ''
 } ${order.isDelivery ? 'border-l-2 border-l-purple-500' : ''}`}
 onClick={() => { setSelectedOrder(order); setIsEditing(false); }}
 >
 {/* Checkbox */}
 {canDelete && onDeleteOrders && (
 <td
 className="px-2 py-2"
 onClick={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}
 >
 <div className="flex items-center justify-center">
 {isSelected ? (
 <CheckSquare className="w-4 h-4 text-brand-600 dark:text-brand-400 fill-brand-100 dark:fill-brand-900/50" />
 ) : (
 <Square className="w-4 h-4 text-content-muted hover:text-content-muted" />
 )}
 </div>
 </td>
 )}

 {/* Número do Pedido */}
 <td className="px-3 py-2">
 {order.orderNumber ? (
 <span className="bg-brand-100 dark:bg-brand-900/20 px-2 py-0.5 rounded text-xs text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800">
 #{order.orderNumber}
 </span>
 ) : displayExternalId ? (
 <span className="bg-surface-base dark:bg-surface-base px-2 py-0.5 rounded text-xs text-content-secondary dark:text-content-secondary font-mono">
 #{displayExternalId}
 </span>
 ) : (
 <span className="text-xs text-content-muted">-</span>
 )}
 </td>

 {/* Cliente */}
 <td className="px-3 py-2">
 <span className="font-medium text-sm text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
 {order.customerName}
 </span>
 </td>

 {/* Data */}
 <td className="px-3 py-2">
 <div className="flex items-center gap-1 text-xs text-content-secondary">
 <Calendar className="w-3 h-3" />
 <span>
 {formatDateWithOptions(order.createdAt, {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric'
 })}
 </span>
 </div>
 </td>

 {/* Status */}
 <td className="px-3 py-2">
 <div className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 border bg-surface-base dark:bg-surface-base dark:border-border-strong dark:text-content-secondary w-fit">
 <span className="[&>svg]:w-3 [&>svg]:h-3">
 {getStatusIcon(normalizeOrderStatus(order))}
 </span>
 <span>{getStatusLabel(normalizeOrderStatus(order))}</span>
 </div>
 </td>

 {/* VENDEDOR */}
 <td className="px-3 py-2">
 <div className="flex items-center gap-1 text-xs text-content-secondary">
 {order.createdByName ? (
 <>
 <UserIcon className="w-3 h-3" />
 <span className="font-medium">{order.createdByName}</span>
 </>
 ) : (
 <span className="text-content-muted italic">Sistema</span>
 )}
 </div>
 </td>

 {/* VENDAS (valor dos produtos, sem entrega) */}
 <td className="px-3 py-2 text-right">
 {(() => {
 const salesAmount = order.totalAmount - (order.deliveryFee || 0);
 return (
 <span className="font-semibold text-sm text-content-secondary dark:text-content-secondary">
 {formatMoney(salesAmount)}
 </span>
 );
 })()}
 </td>

 {/* ENTREGAS */}
 <td className="px-3 py-2 text-right">
 {order.isDelivery && order.deliveryFee ? (
 <span className="font-semibold text-sm text-content-secondary dark:text-content-secondary">
 {formatMoney(order.deliveryFee)}
 </span>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 )}
 </td>

 {/* TOTAL */}
 <td className="px-3 py-2 text-right">
 <span className="font-bold text-sm text-brand-600 dark:text-brand-400">
 {formatMoney(order.totalAmount)}
 </span>
 </td>

 {/* RECEBIDO */}
 <td className="px-3 py-2 text-right">
 {(() => {
 const amountReceived = getPaidAmount(order);
 const effective = getEffectivePaymentStatus(order);
 return (
 <div className="flex items-center justify-end gap-2">
 <span
 className="inline-flex"
 title={getPaymentStatusTooltip(order)}
 aria-label={getPaymentStatusTooltip(order)}
 >
 {effective === 'paid' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
 {effective === 'partial' && <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
 {effective === 'unpaid' && <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
 </span>
 {amountReceived > 0 ? (
 <span className="font-semibold text-sm text-content-secondary dark:text-content-secondary">
 {formatMoney(amountReceived)}
 </span>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 )}
 </div>
 );
 })()}
 </td>

 {/* DIFERENÇA */}
 <td className="px-3 py-2 text-right">
 {(() => {
 const normalizedStatus = normalizeOrderStatus(order);
 // Pedidos cancelados não mostram diferença
 if (normalizedStatus === OrderStatus.CANCELLED) {
 return <span className="text-sm text-content-muted">-</span>;
 }
 const amountReceived = getPaidAmount(order);
 const difference = amountReceived - order.totalAmount;
 return difference !== 0 ? (
 <span className={`font-semibold text-sm ${difference < 0
 ? 'text-red-600 dark:text-red-400'
 : 'text-green-600 dark:text-green-400'
 }`}>
 {formatMoney(difference)}
 </span>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 );
 })()}
 </td>

 {/* Ações */}
 <td className="px-2 py-2">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSelectedOrder(order);
 setIsEditing(false);
 }}
 className="p-1.5 text-content-muted hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-base dark:hover:bg-surface-base rounded transition-colors"
 title="Ver detalhes"
 >
 <Eye className="w-4 h-4" />
 </button>
 </td>
 </tr>

 {/* Linha expandida para itens */}
 {isItemsExpanded && (
 <tr className="bg-surface-base/50">
 <td colSpan={canDelete && onDeleteOrders ? 11 : 10} className="px-3 py-2 border-t border-border-default">
 <div className="space-y-1">
 <div className="text-xs font-semibold text-content-secondary mb-1">Itens do Pedido:</div>
 {order.items.map((item, idx) => (
 <div key={idx} className="flex justify-between text-xs text-content-secondary dark:text-content-secondary py-0.5 pl-4">
 <span>{item.quantity}{item.unit} {item.productName}{item.variantName ? ` ${item.variantName}` : ''}</span>
 <span className="text-content-secondary font-medium">{formatMoney((item.priceAtTime ?? item.price ?? 0) * item.quantity)}</span>
 </div>
 ))}
 </div>
 </td>
 </tr>
 )}

 {/* Linha expandida para notas */}
 {notes && isNotesExpanded && (
 <tr className="bg-blue-50 dark:bg-blue-900/20">
 <td colSpan={canDelete && onDeleteOrders ? 11 : 10} className="px-3 py-2 border-t border-blue-200 dark:border-blue-800">
 <div className="p-2">
 <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">Notas:</div>
 <p className="text-xs text-blue-900 dark:text-blue-200">{notes}</p>
 </div>
 </td>
 </tr>
 )}
 </React.Fragment>
 );
 })}
 </tbody>
 </table>
 </div>
 )}


 {/* Resumo em cards - Final da tabela */}
 {filteredAndSortedOrders.length > 0 && (
 <div className="mt-4 sm:mt-6 pt-4 border-t border-border-default space-y-4">
 <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-content-secondary">
 <span>
 <span className="hidden sm:inline">Mostrando </span>
 <strong className="text-content-primary">{paginatedOrders.length}</strong>
 <span className="hidden sm:inline"> de </span>
 <span className="sm:hidden"> / </span>
 <strong className="text-content-primary">{totalOrdersCount ?? filteredAndSortedOrders.length}</strong>
 <span className="hidden sm:inline"> pedido(s)</span>
 </span>
 {filterDateFrom && filterDateTo && (
 <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded bg-surface-base dark:bg-surface-raised">
 {formatDateWithOptions(filterDateFrom, { day: '2-digit', month: '2-digit' })} – {formatDateWithOptions(filterDateTo, { day: '2-digit', month: '2-digit', year: 'numeric' })}
 </span>
 )}
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
 <div className="rounded-xl border border-border-default bg-surface-raised dark:bg-surface-base p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Vendas</p>
 <p className="text-lg sm:text-xl font-bold text-content-primary truncate" title={formatMoney(totals.totalSales)}>
 {formatMoney(totals.totalSales)}
 </p>
 </div>
 <div className="rounded-xl border border-border-default bg-surface-raised dark:bg-surface-base p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Entregas</p>
 <p className="text-lg sm:text-xl font-bold text-content-primary truncate" title={formatMoney(totals.totalDeliveries)}>
 {formatMoney(totals.totalDeliveries)}
 </p>
 </div>
 <div className="rounded-xl border-2 border-brand-500/50 bg-brand-500/5 dark:bg-brand-500/10 p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1">Total</p>
 <p className="text-lg sm:text-xl font-bold text-brand-600 dark:text-brand-400 truncate" title={formatMoney(totals.totalAmount)}>
 {formatMoney(totals.totalAmount)}
 </p>
 </div>
 <div className="rounded-xl border border-border-default bg-surface-raised dark:bg-surface-base p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Recebido</p>
 <p className="text-lg sm:text-xl font-bold text-content-primary truncate" title={formatMoney(totals.valueReceived)}>
 {formatMoney(totals.valueReceived)}
 </p>
 </div>
 <div className={`rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-shadow ${
 totalDifference < 0
 ? 'border-red-500/50 bg-red-500/5 dark:bg-red-500/10'
 : totalDifference > 0
 ? 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10'
 : 'border-border-default bg-surface-raised dark:bg-surface-base'
 }`}>
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Diferença</p>
 <p className={`text-lg sm:text-xl font-bold truncate ${
 totalDifference < 0
 ? 'text-red-600 dark:text-red-400'
 : totalDifference > 0
 ? 'text-green-600 dark:text-green-400'
 : 'text-content-primary'
 }`} title={formatMoney(totalDifference)}>
 {formatMoney(totalDifference)}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex justify-center items-center gap-2 mt-6">
 <button
 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="px-3 py-2 rounded-lg border border-border-default dark:border-border-strong bg-surface-raised text-content-secondary dark:text-content-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base dark:hover:bg-surface-base flex items-center gap-1"
 >
 <ChevronLeft className="w-4 h-4" /> Anterior
 </button>

 <div className="flex gap-1">
 {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
 let pageNum;
 if (totalPages <= 5) {
 pageNum = i + 1;
 } else if (currentPage <= 3) {
 pageNum = i + 1;
 } else if (currentPage >= totalPages - 2) {
 pageNum = totalPages - 4 + i;
 } else {
 pageNum = currentPage - 2 + i;
 }

 return (
 <button
 key={pageNum}
 onClick={() => setCurrentPage(pageNum)}
 className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
 ? 'bg-brand-600 text-white'
 : 'bg-surface-raised text-content-secondary dark:text-content-secondary border border-border-default dark:border-border-strong hover:bg-surface-base dark:hover:bg-surface-base'
 }`}
 >
 {pageNum}
 </button>
 );
 })}
 </div>

 <button
 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 className="px-3 py-2 rounded-lg border border-border-default dark:border-border-strong bg-surface-raised text-content-secondary dark:text-content-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base dark:hover:bg-surface-base flex items-center gap-1"
 >
 Próxima <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 )}

 {/* Floating Action Bar */}
 {selectedOrderIds.length > 0 && (
 <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#1d1d1f] dark:bg-surface-raised text-[#f5f5f7] dark:text-content-primary border border-border-default px-6 py-3 rounded-full shadow-2xl z-40 flex items-center space-x-4 animate-fade-in-up">
 <span className="font-bold text-sm">{selectedOrderIds.length} selecionados</span>
 <div className="h-4 w-px bg-border-strong dark:bg-surface-base"></div>
 <button
 onClick={() => setIsBulkEditOpen(true)}
 className="flex items-center text-brand-400 dark:text-brand-600 hover:text-brand-300 dark:hover:text-brand-700 text-sm font-medium transition-colors"
 >
 <Edit2 className="w-4 h-4 mr-2" /> Editar Status
 </button>
 {canDelete && onDeleteOrders && (
 <button
 onClick={handleBulkDelete}
 className="flex items-center text-red-400 dark:text-red-600 hover:text-red-300 dark:hover:text-red-700 text-sm font-medium transition-colors"
 >
 <Trash2 className="w-4 h-4 mr-2" /> Apagar
 </button>
 )}
 <button
 onClick={() => setSelectedOrderIds([])}
 className="ml-2 text-content-muted hover:text-content-primary"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 )}

 {/* Bulk Edit Modal */}
 {isBulkEditOpen && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4">
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-md w-full p-6">
 <h3 className="text-lg font-bold text-content-primary mb-4">
 Editar Status em Massa
 </h3>
 <p className="text-sm text-content-secondary mb-4">
 Atualizar status de {selectedOrderIds.length} pedido(s) selecionado(s)
 </p>
 <div className="space-y-3">
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary">
 Novo Status
 </label>
 <select
 value={bulkEditStatus}
 onChange={(e) => setBulkEditStatus(e.target.value)}
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg"
 >
 <option value="">Selecione um status</option>
 {Object.values(OrderStatus).map(status => (
 <option key={status} value={status}>{getStatusLabel(status)}</option>
 ))}
 </select>
 </div>
 <div className="flex justify-end gap-3 mt-6">
 <button
 onClick={() => {
 setIsBulkEditOpen(false);
 setBulkEditStatus('');
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base rounded-lg"
 >
 Cancelar
 </button>
 <button
 onClick={handleBulkStatusUpdate}
 disabled={!bulkEditStatus}
 className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Atualizar
 </button>
 </div>
 </div>
 </div>
 )}

 {selectedOrder && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4">
 <div className={`bg-surface-raised rounded-xl shadow-2xl w-full overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh] ${isEditing ? 'max-w-4xl' : 'max-w-lg'}`}>
 <div className="bg-surface-base dark:bg-surface-base p-4 border-b dark:border-border-strong flex justify-between items-center flex-shrink-0">
 <div>
 <h3 className="font-bold text-content-primary text-lg">
 {isEditing ? 'Editar Pedido' : 'Detalhes do Pedido'}
 </h3>
 <p className="text-xs text-content-muted">ID: {selectedOrder.externalId || selectedOrder.id}</p>
 </div>
 <button onClick={() => { if (isEditing) cancelEditing(); setSelectedOrder(null); }} className="text-content-muted hover:text-content-secondary p-2 rounded-full hover:bg-surface-base">
 <XCircle className="w-6 h-6" />
 </button>
 </div>

 {/* Barra de steps no Editar - mesmo padrão do Novo Pedido */}
 {isEditing && editOrderData && (
 <div className="flex-shrink-0 border-b border-border-default px-6 py-4 bg-surface-raised">
 <OrderSteps
 currentStep={editCurrentStep}
 totalSteps={4}
 onStepChange={handleEditStepChange}
 step1Valid={editStep1Valid}
 step2Valid={editStep2Valid}
 canGoNext={editCurrentStep === 1 ? editStep1Valid : editCurrentStep === 2 ? editStep2Valid : true}
 onNext={handleEditNextStep}
 onPrevious={handleEditPreviousStep}
 onSave={saveEdit}
 isSaving={false}
 showSaveOnAllSteps
 />
 </div>
 )}

 <div className="p-6 overflow-y-auto flex-1">
 {!isEditing ? (
 <>
 <div className="flex items-center justify-between mb-6 bg-surface-base dark:bg-surface-base p-3 rounded-lg border border-border-default ">
 <div className="flex items-center gap-2">
 {getStatusIcon(normalizeOrderStatus(selectedOrder))}
 <span className="font-medium text-sm text-content-secondary">{getStatusLabel(normalizeOrderStatus(selectedOrder))}</span>
 </div>
 <div className="relative">
 <select
 value={selectedOrder.status}
 onChange={(e) => {
 const newStatus = e.target.value as OrderStatus;
 trackAction('update', { entity: 'order', entityId: selectedOrder.id, changes: { status: newStatus } });
 onUpdateStatus(selectedOrder.id, newStatus);
 setSelectedOrder({ ...selectedOrder, status: newStatus });
 showToast(`Status alterado para "${getStatusLabel(newStatus)}"`, 'success');
 }}
 className="text-xs bg-surface-raised border border-border-default dark:border-border-strong text-content-secondary px-3 py-1.5 rounded-lg hover:bg-surface-base dark:hover:bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer appearance-none pr-8"
 >
 {Object.values(OrderStatus).map(status => (
 <option key={status} value={status}>{getStatusLabel(status)}</option>
 ))}
 </select>
 <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-6">
 <div>
 <p className="text-xs text-content-muted uppercase">Cliente</p>
 <p className="font-medium">{selectedOrder.customerName}</p>
 <p className="text-sm text-content-secondary">{selectedOrder.customerPhone}</p>
 </div>
 <div className="text-right">
 <p className="text-xs text-content-muted uppercase">Data</p>
 <p className="text-sm">{formatDateOnly(selectedOrder.createdAt)}</p>
 </div>
 </div>
 {selectedOrder.createdByName && (
 <div className="mb-4 p-3 bg-surface-base dark:bg-surface-base rounded-lg border border-border-default ">
 <div className="flex items-center gap-2">
 <UserIcon className="w-4 h-4 text-content-muted" />
 <div>
 <p className="text-xs text-content-muted uppercase">Vendedor</p>
 <p className="font-medium text-sm text-content-secondary">{selectedOrder.createdByName}</p>
 </div>
 </div>
 </div>
 )}
 {selectedOrder.isDelivery && (
 <div className="mb-6 space-y-3">
 <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-900/30 text-sm text-purple-800 dark:text-purple-300">
 <div className="flex items-start">
 <Truck className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
 <div className="flex-1">
 <span className="font-bold block mb-1">Informações de Entrega</span>
 <p className="mb-1"><strong>Endereço:</strong> {selectedOrder.deliveryLocation}</p>
 {selectedOrder.deliveryZoneName && (
 <p className="mb-1"><strong>Zona:</strong> {selectedOrder.deliveryZoneName}</p>
 )}
 {selectedOrder.deliveryFee && selectedOrder.deliveryFee > 0 && (
 <p className="mb-1"><strong>Taxa de Entrega:</strong> {formatMoney(selectedOrder.deliveryFee)}</p>
 )}
 {selectedOrder.deliveryAddressFormatted && (
 <p className="text-xs mt-2 opacity-80">{selectedOrder.deliveryAddressFormatted}</p>
 )}
 </div>
 </div>
 </div>

 {/* Mapa com Localização */}
 </div>
 )}
 {selectedOrder.orderNumber && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase">Número do Pedido</p>
 <p className="font-medium">{selectedOrder.orderNumber}</p>
 </div>
 )}
 {(selectedOrder.paymentStatus || selectedOrder.paymentProof || selectedOrder.paymentProofText) && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase mb-1">Status de Pagamento</p>
 <div className="flex items-center gap-2">
 {(() => {
 const effective = getEffectivePaymentStatus(selectedOrder);
 const paidAmount = getPaidAmount(selectedOrder);
 return (
 <>
 {effective === 'paid' && (
 <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
 )}
 {effective === 'partial' && (
 <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
 )}
 {effective === 'unpaid' && (
 <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
 )}
 <span className="font-medium">
 {effective === 'paid' ? 'Pago' : effective === 'partial' ? 'Parcial' : 'Não Pago'}
 </span>
 {paidAmount > 0 && (
 <span className="text-sm text-content-secondary">
 ({formatMoney(paidAmount)} / {formatMoney(selectedOrder.totalAmount)})
 </span>
 )}
 </>
 );
 })()}
 </div>
 {getPaidAmount(selectedOrder) > 0 && getPaidAmount(selectedOrder) < selectedOrder.totalAmount && (
 <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
 Dé­vida: {formatMoney(selectedOrder.totalAmount - getPaidAmount(selectedOrder))}
 </p>
 )}
 </div>
 )}
 {(selectedOrder.paymentProof || selectedOrder.paymentProofText) && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase mb-2">Comprovativo de Pagamento</p>
 {selectedOrder.paymentProofText && (
 <div className="bg-surface-base dark:bg-surface-base p-3 rounded-lg text-sm text-content-secondary dark:text-content-secondary mb-2">
 {selectedOrder.paymentProofText}
 </div>
 )}
 {selectedOrder.paymentProof && (
 <div className="mt-2">
 <img
 src={selectedOrder.paymentProof}
 alt="Comprovativo"
 className="max-w-full h-auto rounded-lg border border-border-default dark:border-border-strong"
 onError={(e) => {
 (e.target as HTMLImageElement).style.display = 'none';
 }}
 />
 </div>
 )}
 </div>
 )}
 {selectedOrder.notes && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase mb-1">Observações</p>
 <p className="text-sm text-content-secondary dark:text-content-secondary bg-surface-base dark:bg-surface-base p-3 rounded-lg">{selectedOrder.notes}</p>
 </div>
 )}
 <div className="border-t border-border-default pt-4">
 <h4 className="font-bold text-content-secondary dark:text-content-secondary text-sm mb-3">Itens</h4>
 <div className="space-y-2">
 {selectedOrder.items.map((item, i) => (
 <div key={i} className="flex justify-between text-sm">
 <span className="text-content-secondary"><span className="font-bold text-content-primary">{item.quantity}{item.unit}</span> {item.productName}{item.variantName ? ` ${item.variantName}` : ''}</span>
 <span className="font-medium">{formatMoney((item.priceAtTime ?? item.price ?? 0) * item.quantity)}</span>
 </div>
 ))}
 </div>

 {/* Resumo Financeiro */}
 <div className="border-t border-border-default mt-4 pt-4 space-y-2">
 {/* Total dos Itens */}
 <div className="flex justify-between items-center text-sm">
 <span className="text-content-secondary">Total dos Itens:</span>
 <span className="font-semibold text-content-primary">
 {formatMoney(selectedOrder.items.reduce((sum, item) => sum + ((item.priceAtTime ?? item.price ?? 0) * item.quantity), 0))}
 </span>
 </div>

 {/* Valor da Entrega (se houver) */}
 {selectedOrder.isDelivery && selectedOrder.deliveryFee && selectedOrder.deliveryFee > 0 && (
 <div className="flex justify-between items-center text-sm">
 <span className="text-content-secondary">Entrega:</span>
 <span className="font-semibold text-content-primary">
 {formatMoney(selectedOrder.deliveryFee)}
 </span>
 </div>
 )}

 {/* Total Geral */}
 <div className="flex justify-between items-center pt-2 border-t border-border-default">
 <span className="font-bold text-lg text-content-primary">Total:</span>
 <span className="font-bold text-xl text-brand-600 dark:text-brand-400">{formatMoney(selectedOrder.totalAmount)}</span>
 </div>
 </div>
 </div>
 </>
 ) : (
 <div className="space-y-6">
 {editOrderData && (
 <>
 {/* Step 1: Cliente */}
 {editCurrentStep === 1 && (
 <div className="space-y-6">
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl p-4">
 <h4 className="font-semibold text-content-primary flex items-center gap-2">
 <UserIcon className="w-4 h-4" /> Cliente
 </h4>
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Nome do Cliente <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.customerName}
 onChange={e => setEditOrderData({ ...editOrderData, customerName: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Telefone
 </label>
 <input
 type="text"
 placeholder="84XXXXXXXXX"
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.customerPhone}
 onChange={e => setEditOrderData({ ...editOrderData, customerPhone: e.target.value })}
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 <Calendar className="w-4 h-4 inline mr-1" /> Data do Pedido
 </label>
 <input
 type="date"
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.createdAt ? (() => {
 const date = new Date(editOrderData.createdAt);
 // Usar métodos locais para evitar problemas de timezone
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const day = String(date.getDate()).padStart(2, '0');
 return `${year}-${month}-${day}`;
 })() : ''}
 onChange={e => {
 const dateValue = e.target.value;
 if (dateValue) {
 // Criar data no timezone local para evitar conversões indesejadas
 const [year, month, day] = dateValue.split('-').map(Number);
 const localDate = new Date(year, month - 1, day, 12, 0, 0); // Usar meio-dia para evitar problemas de DST
 setEditOrderData({
 ...editOrderData,
 createdAt: localDate.toISOString()
 });
 }
 }}
 />
 </div>
 </div>
 </div>

 {/* Vendedor (só para admin) */}
 {((currentUser as any)?.isSuperAdmin || currentUser?.role === UserRole.ADMIN) && (
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl p-4">
 <h4 className="font-semibold text-content-primary flex items-center gap-2">
 <UserIcon className="w-4 h-4" /> Vendedor
 </h4>
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Vendedor que Criou o Pedido
 </label>
 <select
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.createdBy || ''}
 onChange={e => {
 const selectedUserId = e.target.value;
 const selectedUser = users.find(u => u.id === selectedUserId);
 setEditOrderData({
 ...editOrderData,
 createdBy: selectedUserId || undefined,
 createdByName: selectedUser?.name || undefined
 });
 }}
 >
 <option value="">Sistema (não identificado)</option>
 {users.length > 0 ? (
 users.map(user => (
 <option key={user.id} value={user.id}>
 {user.name || user.email || `Usuário ${user.id.substring(0, 8)}`}
 </option>
 ))
 ) : (
 <option disabled>Carregando usuários...</option>
 )}
 </select>
 <p className="text-xs text-content-muted mt-1">
 Apenas super administradores podem alterar o vendedor do pedido
 </p>
 {users.length === 0 && (
 <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
 Nenhum usuário encontrado. Verifique o console para mais detalhes.
 </p>
 )}
 {users.length > 0 && (
 <p className="text-xs text-green-600 dark:text-green-400 mt-1">
 ✓ {users.length} usuário(s) disponível(is)
 </p>
 )}
 </div>
 </div>
 )}

 </div>
 )}

 {/* Step 3: Entrega */}
 {editCurrentStep === 3 && (
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl p-4">
 <h4 className="font-semibold text-content-primary flex items-center gap-2">
 <Truck className="w-4 h-4" /> Entrega
 </h4>
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="editIsDelivery"
 checked={editOrderData.isDelivery}
 onChange={(e) => setEditOrderData({
 ...editOrderData,
 isDelivery: e.target.checked,
 deliveryLocation: e.target.checked ? editOrderData.deliveryLocation : undefined
 })}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 />
 <label htmlFor="editIsDelivery" className="text-sm font-medium text-content-secondary dark:text-content-secondary flex items-center gap-2 cursor-pointer">
 <Truck className="w-4 h-4" /> Pedido com entrega
 </label>
 </div>
 {editOrderData.isDelivery && (
 <div className="space-y-4">
 {/* Seletor de Zona */}
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-2">
 Zona de Entrega
 </label>
 <DeliveryZoneSelector
 selectedZoneId={editOrderData.deliveryZoneId}
 selectedZoneName={editOrderData.deliveryZoneName}
 onZoneSelect={(zone) => {
 if (zone) {
 setEditOrderData({
 ...editOrderData,
 deliveryZoneId: zone.id,
 deliveryZoneName: zone.name,
 deliveryFee: zone.price
 });
 } else {
 setEditOrderData({
 ...editOrderData,
 deliveryZoneId: undefined,
 deliveryZoneName: undefined,
 deliveryFee: 0
 });
 }
 }}
 showPrice={true}
 />
 </div>

 {/* Campo de Endereço Texto */}
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Endereço de Entrega
 </label>
 <textarea
 rows={3}
 placeholder="Digite o endereço completo (rua, bairro, cidade)..."
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
 value={editOrderData.deliveryLocation || ''}
 onChange={e => setEditOrderData({ ...editOrderData, deliveryLocation: e.target.value })}
 />
 </div>

 {/* Taxa de Entrega (editável) */}
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Taxa de Entrega (MT)
 </label>
 <input
 type="number"
 step="0.01"
 placeholder="0.00"
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.deliveryFee || 0}
 onChange={e => setEditOrderData({ ...editOrderData, deliveryFee: parseFloat(e.target.value) || 0 })}
 />
 {editOrderData.deliveryZoneName && (
 <p className="text-xs text-content-muted mt-1">
 Zona: {editOrderData.deliveryZoneName} - Preço padrão aplicado
 </p>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Step 1: Número e Status (continuação) */}
 {editCurrentStep === 1 && (
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl p-4">
 <h4 className="font-semibold text-content-primary flex items-center gap-2">
 <Package className="w-4 h-4" /> Pedido
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">Número do Pedido</label>
 <input
 type="text"
 placeholder="Ex: #1846"
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.orderNumber || ''}
 onChange={e => setEditOrderData({ ...editOrderData, orderNumber: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">Status do Pedido</label>
 <select
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.status}
 onChange={e => setEditOrderData({ ...editOrderData, status: e.target.value as OrderStatus })}
 >
 {Object.values(OrderStatus).map(status => (
 <option key={status} value={status}>{getStatusLabel(status)}</option>
 ))}
 </select>
 </div>
 </div>
 </div>
 )}

 {/* Step 4: Pagamento */}
 {editCurrentStep === 4 && (
 <div className="space-y-6">
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl p-4">
 <h4 className="font-semibold text-content-primary flex items-center gap-2">
 <DollarSign className="w-4 h-4" /> Pagamento
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Status de Pagamento
 </label>
 <select
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.paymentStatus || 'unpaid'}
 onChange={e => {
 const newStatus = e.target.value as 'paid' | 'unpaid' | 'partial';
 setEditOrderData({
 ...editOrderData,
 paymentStatus: newStatus,
 amountPaid: newStatus === 'paid' ? editOrderData.totalAmount : (newStatus === 'partial' ? (editOrderData.amountPaid || 0) : 0)
 });
 }}
 >
 <option value="unpaid">Não Pago</option>
 <option value="partial">Parcial</option>
 <option value="paid">Pago</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Valor Pago (MT)
 </label>
 <input
 type="number"
 step="0.01"
 placeholder="0.00"
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.amountPaid || 0}
 onChange={e => {
 const paid = parseFloat(e.target.value) || 0;
 const total = editOrderData.totalAmount;
 let newStatus: 'paid' | 'unpaid' | 'partial' = 'unpaid';
 if (paid >= total) {
 newStatus = 'paid';
 } else if (paid > 0) {
 newStatus = 'partial';
 }
 setEditOrderData({
 ...editOrderData,
 amountPaid: paid,
 paymentStatus: newStatus
 });
 }}
 />
 {editOrderData.amountPaid && editOrderData.amountPaid < editOrderData.totalAmount && (
 <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
 Dé­vida: {formatMoney(editOrderData.totalAmount - (editOrderData.amountPaid || 0))}
 </p>
 )}
 </div>
 </div>
 <div className="mt-4">
 <label className="block text-sm font-medium text-content-secondary dark:text-content-secondary mb-1">
 Comprovativo de Pagamento (Texto)
 </label>
 <textarea
 rows={4}
 placeholder="Cole aqui o texto do comprovativo de pagamento..."
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.paymentProofText || ''}
 onChange={e => setEditOrderData({ ...editOrderData, paymentProofText: e.target.value })}
 />
 </div>
 </div>
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl p-4">
 <h4 className="font-semibold text-content-primary flex items-center gap-2">
 <Edit2 className="w-4 h-4" /> Observações
 </h4>
 <textarea
 rows={4}
 placeholder="Adicione observações, notas ou informações adicionais..."
 className="w-full px-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={editOrderData.notes || ''}
 onChange={e => setEditOrderData({ ...editOrderData, notes: e.target.value })}
 />
 </div>
 </div>
 )}

 {/* Step 2: Itens do Pedido + Adicionar Produtos */}
 {editCurrentStep === 2 && (
 <div className="space-y-6">
 {editOrderData.items.length > 0 && (
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl overflow-hidden">
 <button
 type="button"
 onClick={() => toggleEditSection('orderItems')}
 className="w-full flex items-center justify-between p-4 text-left font-semibold text-content-primary hover:bg-surface-base dark:hover:bg-surface-base/50 transition-colors"
 >
 <span className="flex items-center gap-2">
 <ShoppingCart className="w-4 h-4" /> Itens do Pedido ({editOrderData.items.length})
 </span>
 {expandedEditSections.has('orderItems') ? (
 <ChevronUp className="w-5 h-5 text-content-muted" />
 ) : (
 <ChevronDown className="w-5 h-5 text-content-muted" />
 )}
 </button>
 {expandedEditSections.has('orderItems') && (
 <div className="px-4 pb-4 space-y-4">
 <div className="space-y-3 max-h-96 overflow-y-auto">
 {editOrderData.items.map((item, itemIdx) => {
 const product = products.find(p => p.id === item.productId);
 const selectedVariant = product?.variants?.find(v => v.id === item.variantId) || null;
 const isPriceModified = product && selectedVariant
 ? item.priceAtTime !== selectedVariant.price
 : product && item.priceAtTime !== product.price;
 const stockCheck = product
 ? checkStockAvailability(product, selectedVariant, item.quantity, editOrderData.items.filter((_, idx) => idx !== itemIdx), selectedOrder?.items)
 : { available: true, availableStock: 0, message: '' };

 return (
 <OrderItemEditor
 key={`${item.productId}-${item.variantId || 'none'}-${itemIdx}`}
 item={item}
 itemIndex={itemIdx}
 product={product}
 selectedVariant={selectedVariant}
 onUpdateQuantity={handleUpdateEditItemQuantity}
 onUpdatePrice={handleUpdateEditItemPrice}
 onRemove={handleRemoveEditItem}
 onVariantChange={handleUpdateEditItemVariant}
 stockCheck={stockCheck}
 isPriceModified={isPriceModified}
 formatMoney={formatMoney}
 />
 );
 })}
 {editOrderData.isDelivery && editOrderData.deliveryFee > 0 && (
 <div className="pt-2 border-t border-border-default dark:border-border-strong flex justify-between items-center">
 <span className="text-sm text-content-secondary">
 Taxa de Entrega {editOrderData.deliveryZoneName && `(${editOrderData.deliveryZoneName})`}
 </span>
 <span className="text-sm font-medium text-content-primary">
 {formatMoney(editOrderData.deliveryFee)}
 </span>
 </div>
 )}
 <div className="pt-4 border-t border-border-default flex justify-between items-center">
 <span className="text-lg font-semibold text-content-primary">Total dos Itens:</span>
 <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
 {formatMoney(editOrderData.totalAmount)}
 </span>
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 {/* Adicionar Produtos - mesmo layout minimalista (list) do Novo Pedido */}
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl overflow-hidden">
 <button
 type="button"
 onClick={() => toggleEditSection('products')}
 className="w-full flex items-center justify-between p-4 text-left font-semibold text-content-primary hover:bg-surface-base dark:hover:bg-surface-base/50 transition-colors"
 >
 <span className="flex items-center gap-2">
 <Package className="w-4 h-4" /> Produtos
 </span>
 {expandedEditSections.has('products') ? (
 <ChevronUp className="w-5 h-5 text-content-muted" />
 ) : (
 <ChevronDown className="w-5 h-5 text-content-muted" />
 )}
 </button>
 {expandedEditSections.has('products') && (
 <div className="px-4 pb-4 space-y-4">
 <ProductGrid
 products={productsWithStock}
 selectedItems={editOrderData.items}
 onSelectProduct={handleEditSelectProduct}
 searchQuery={editProductSearchQuery}
 onSearchChange={setEditProductSearchQuery}
 viewMode="list"
 showThumbnails={false}
 showVariantSelector
 showCategoryFilter={false}
 useCalculatedStockForVariants
 />
 </div>
 )}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 )}
 </div>

 <div className="p-4 bg-surface-base dark:bg-surface-base border-t dark:border-border-strong flex justify-between items-center flex-shrink-0">
 {!isEditing ? (
 <>
 <div className="flex gap-2">
 <button onClick={() => handlePrint(selectedOrder)} className="p-2 text-content-secondary border dark:border-border-strong rounded-lg hover:bg-surface-base transition-colors" title="Imprimir">
 <Printer className="w-5 h-5" />
 </button>
 <button
 onClick={() => downloadBlob(`/pdf/order/${selectedOrder.id}`, `fatura-${selectedOrder.orderNumber || selectedOrder.id}.pdf`).catch(() => {})}
 className="p-2 text-content-secondary border dark:border-border-strong rounded-lg hover:bg-surface-base transition-colors"
 title="Descarregar Fatura PDF"
 >
 <Download className="w-5 h-5" />
 </button>
 {canDelete && onDeleteOrder && (
 <button onClick={handleDelete} className="p-2 text-red-600 dark:text-red-400 border dark:border-border-strong rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Apagar">
 <Trash2 className="w-5 h-5" />
 </button>
 )}
 </div>
 <div className="flex gap-2">
 {canEdit && onEditOrder && (
 <button onClick={startEditing} className="flex items-center text-brand-600 dark:text-brand-400 font-medium px-4 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
 <Edit2 className="w-4 h-4 mr-2" /> Editar
 </button>
 )}
 <button onClick={() => setSelectedOrder(null)} className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 transition-colors">Fechar</button>
 </div>
 </>
 ) : (
 <div className="flex justify-between items-center w-full">
 <div className="text-sm text-content-secondary">
 {editOrderData && (
 <span className="font-medium">
 {editOrderData.items.length} item(s) • Total: <span className="text-brand-600 dark:text-brand-400 font-bold">{formatMoney(editOrderData.totalAmount)}</span>
 </span>
 )}
 </div>
 <button
 onClick={cancelEditing}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg transition-colors text-sm"
 >
 Cancelar
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Add Order Modal */}
 {isModalOpen && (
 <div className="fixed inset-0 modal-overlay z-50 flex items-end sm:items-center justify-center sm:p-4">
 <div className="bg-surface-raised w-full max-w-5xl h-[96dvh] sm:h-auto sm:max-h-[92vh] rounded-t-2xl sm:rounded-xl flex flex-col animate-modal-enter">
 {/* Mobile drag handle */}
 <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
 <div className="w-10 h-1 rounded-full bg-border-strong opacity-50" />
 </div>
 {/* Header */}
 <div className="px-5 py-4 border-b border-border-default flex-shrink-0 flex justify-between items-center">
 <div>
 <h3 className="text-lg sm:text-xl font-bold text-content-primary">Novo Pedido</h3>
 <p className="text-xs sm:text-sm text-content-muted mt-0.5 hidden sm:block">Preencha os dados abaixo para criar um novo pedido</p>
 </div>
 <button onClick={resetModal} className="text-content-muted hover:text-content-secondary p-2 hover:bg-surface-base rounded-full transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Two-column flat form */}
 <div className="flex-1 overflow-y-auto">
 <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-border-default">

 {/* Left: Customer + Products */}
 <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
 {/* Customer */}
 <div>
 <h4 className="text-sm font-semibold text-content-primary flex items-center gap-2 mb-3">
 <UserIcon className="w-4 h-4 text-brand-600" /> Informações do Cliente
 </h4>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">
 Nome <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 placeholder="Nome completo"
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderCustomerName}
 onChange={e => {
 const value = e.target.value;
 setNewOrderCustomerName(value);
 if (value.trim() && newOrderCustomerPhone.trim()) {
 const existing = findExistingCustomer(value, newOrderCustomerPhone);
 if (existing && existing.id !== selectedCustomerId) {
 setSuggestedCustomer(existing);
 setShowCustomerSuggestion(true);
 }
 }
 }}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Telefone</label>
 <input
 type="text"
 placeholder="84XXXXXXXXX"
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderCustomerPhone}
 onChange={e => {
 const value = e.target.value;
 setNewOrderCustomerPhone(value);
 if (value.trim() && newOrderCustomerName.trim()) {
 const existing = findExistingCustomer(newOrderCustomerName, value);
 if (existing && existing.id !== selectedCustomerId) {
 setSuggestedCustomer(existing);
 setShowCustomerSuggestion(true);
 }
 }
 }}
 />
 </div>
 </div>
 {showCustomerSuggestion && suggestedCustomer && (
 <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
 <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
 Cliente encontrado: {suggestedCustomer.name}
 </p>
 <div className="flex gap-2">
 <button
 onClick={() => {
 setSelectedCustomerId(suggestedCustomer.id);
 setNewOrderCustomerName(suggestedCustomer.name);
 setNewOrderCustomerPhone(suggestedCustomer.phone || '');
 setShowCustomerSuggestion(false);
 }}
 className="px-3 py-1 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
 >
 Usar este cliente
 </button>
 <button
 onClick={() => {
 setShowCustomerSuggestion(false);
 setSuggestedCustomer(null);
 }}
 className="px-3 py-1 bg-surface-base text-content-secondary rounded text-sm hover:bg-surface-base"
 >
 Ignorar
 </button>
 </div>
 </div>
 )}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">
 <Calendar className="w-3.5 h-3.5 inline mr-1" /> Data do Pedido
 </label>
 <input
 type="date"
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderDate}
 onChange={e => setNewOrderDate(e.target.value)}
 />
 </div>
 </div>
 </div>

 {/* Products */}
 <div>
 <h4 className="text-sm font-semibold text-content-primary flex items-center gap-2 mb-3">
 <Package className="w-4 h-4 text-brand-600" /> Produtos
 </h4>
 <ProductGrid
 products={productsWithStock}
 selectedItems={selectedItems}
 onSelectProduct={handleSelectProduct}
 searchQuery={productSearchQuery}
 onSearchChange={setProductSearchQuery}
 viewMode="list"
 showThumbnails={false}
 showVariantSelector
 showCategoryFilter={false}
 useCalculatedStockForVariants
 />
 </div>

 {/* Selected items */}
 {selectedItems.length > 0 && (
 <div>
 <h4 className="text-sm font-semibold text-content-primary flex items-center gap-2 mb-3">
 <ShoppingCart className="w-4 h-4 text-brand-600" /> Itens do Pedido ({selectedItems.length})
 </h4>
 <div className="space-y-3 max-h-72 overflow-y-auto">
 {selectedItems.map((item, itemIdx) => {
 const product = products.find(p => p.id === item.productId);
 const selectedVariant = product?.variants?.find(v => v.id === item.variantId) || null;
 const isPriceModified = product && selectedVariant
 ? item.priceAtTime !== selectedVariant.price
 : product && item.priceAtTime !== product.price;
 const stockCheck = product
 ? checkStockAvailability(product, selectedVariant, item.quantity, selectedItems.filter((_, i) => i !== itemIdx))
 : { available: true, availableStock: 0, message: '' };
 return (
 <OrderItemEditor
 key={`${item.productId}-${item.variantId || 'none'}-${itemIdx}`}
 item={item}
 itemIndex={itemIdx}
 product={product}
 selectedVariant={selectedVariant}
 onUpdateQuantity={handleUpdateItemQuantity}
 onUpdatePrice={handleUpdateItemPrice}
 onRemove={handleRemoveItem}
 onVariantChange={handleUpdateItemVariant}
 stockCheck={stockCheck}
 isPriceModified={isPriceModified}
 formatMoney={formatMoney}
 />
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* Right: Delivery + Payment + Additional + Summary */}
 <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 border-t md:border-t-0 border-border-default">
 {/* Delivery */}
 <div>
 <h4 className="text-sm font-semibold text-content-primary flex items-center gap-2 mb-3">
 <Truck className="w-4 h-4 text-brand-600" /> Entrega
 </h4>
 <div className="space-y-3">
 <label className="flex items-center gap-2.5 cursor-pointer">
 <input
 type="checkbox"
 id="isDelivery"
 checked={newOrderIsDelivery}
 onChange={(e) => setNewOrderIsDelivery(e.target.checked)}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 />
 <span className="text-sm text-content-secondary">Pedido com entrega</span>
 </label>
 {newOrderIsDelivery && (
 <div className="space-y-3 pt-1">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Zona de Entrega</label>
 <DeliveryZoneSelector
 selectedZoneId={newOrderDeliveryZoneId}
 selectedZoneName={newOrderDeliveryZoneName}
 onZoneSelect={(zone) => {
 if (zone) {
 setNewOrderDeliveryZoneId(zone.id);
 setNewOrderDeliveryZoneName(zone.name);
 setNewOrderDeliveryFee(zone.price);
 } else {
 setNewOrderDeliveryZoneId('');
 setNewOrderDeliveryZoneName('');
 setNewOrderDeliveryFee(0);
 }
 }}
 showPrice={true}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Endereço de Entrega</label>
 <input
 type="text"
 placeholder="Endereço completo"
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderDeliveryLocation}
 onChange={e => setNewOrderDeliveryLocation(e.target.value)}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Taxa de Entrega (MT)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 placeholder="0.00"
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderDeliveryFee}
 onChange={e => setNewOrderDeliveryFee(parseFloat(e.target.value) || 0)}
 />
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Payment */}
 <div>
 <h4 className="text-sm font-semibold text-content-primary flex items-center gap-2 mb-3">
 <DollarSign className="w-4 h-4 text-brand-600" /> Pagamento
 </h4>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Status de Pagamento</label>
 <select
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderPaymentStatus}
 onChange={e => {
 const newStatus = e.target.value as 'paid' | 'unpaid' | 'partial';
 setNewOrderPaymentStatus(newStatus);
 const total = calculateManualTotal() + (newOrderIsDelivery ? newOrderDeliveryFee : 0);
 if (newStatus === 'paid') {
 setNewOrderAmountPaid(total);
 } else if (newStatus === 'unpaid') {
 setNewOrderAmountPaid(0);
 }
 }}
 >
 <option value="unpaid">Não Pago</option>
 <option value="partial">Parcial</option>
 <option value="paid">Pago</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Valor Pago (MT)</label>
 <input
 type="number"
 step="0.01"
 placeholder="0.00"
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderAmountPaid}
 onChange={e => {
 const paid = parseFloat(e.target.value) || 0;
 const total = calculateManualTotal() + (newOrderIsDelivery ? newOrderDeliveryFee : 0);
 let newStatus: 'paid' | 'unpaid' | 'partial' = 'unpaid';
 if (paid >= total) {
 newStatus = 'paid';
 } else if (paid > 0) {
 newStatus = 'partial';
 }
 setNewOrderAmountPaid(paid);
 setNewOrderPaymentStatus(newStatus);
 }}
 />
 </div>
 </div>
 </div>

 {/* Additional Info */}
 <div>
 <h4 className="text-sm font-semibold text-content-primary flex items-center gap-2 mb-3">
 <Package className="w-4 h-4 text-brand-600" /> Informações Adicionais
 </h4>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Número do Pedido</label>
 <input
 type="text"
 placeholder="Ex: #1846"
 className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
 orderNumberError
 ? 'border-red-500 dark:border-red-500 dark:bg-surface-base dark:text-content-primary'
 : 'border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary'
 }`}
 value={newOrderNumber}
 onChange={async (e) => {
 const value = e.target.value;
 setNewOrderNumber(value);
 setOrderNumberError('');
 if (value.trim()) {
 setIsCheckingOrderNumber(true);
 try {
 const exists = await dataService.checkOrderNumberExists(value.trim());
 if (exists) {
 setOrderNumberError('Este número já existe');
 }
 } catch (_) {
 setOrderNumberError('');
 } finally {
 setIsCheckingOrderNumber(false);
 }
 }
 }}
 disabled={isCheckingOrderNumber}
 />
 {isCheckingOrderNumber && (
 <p className="text-xs text-content-muted mt-1">Verificando...</p>
 )}
 {orderNumberError && (
 <p className="text-xs text-red-600 dark:text-red-400 mt-1">{orderNumberError}</p>
 )}
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Status do Pedido</label>
 <select
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderStatus}
 onChange={e => setNewOrderStatus(e.target.value as OrderStatus)}
 >
 {Object.values(OrderStatus).map(status => (
 <option key={status} value={status}>{getStatusLabel(status)}</option>
 ))}
 </select>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Observações</label>
 <textarea
 rows={3}
 placeholder="Notas ou informações adicionais sobre este pedido..."
 className="w-full px-3 py-2 text-sm border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 value={newOrderNotes}
 onChange={e => setNewOrderNotes(e.target.value)}
 />
 </div>
 </div>
 </div>

 {/* Summary */}
 <div className="rounded-xl bg-surface-base border border-border-default p-4 space-y-2">
 <h4 className="text-sm font-semibold text-content-primary mb-2">Resumo</h4>
 <div className="flex justify-between text-sm">
 <span className="text-content-secondary">Subtotal:</span>
 <span className="font-medium text-content-primary">{formatMoney(calculateManualTotal())}</span>
 </div>
 {newOrderIsDelivery && newOrderDeliveryFee > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-content-secondary">Taxa de Entrega:</span>
 <span className="font-medium text-content-primary">{formatMoney(newOrderDeliveryFee)}</span>
 </div>
 )}
 <div className="flex justify-between text-base pt-2 border-t border-border-default">
 <span className="font-bold text-content-primary">Total:</span>
 <span className="font-bold text-brand-600 dark:text-brand-400">
 {formatMoney(calculateManualTotal() + (newOrderIsDelivery ? newOrderDeliveryFee : 0))}
 </span>
 </div>
 </div>
 </div>

 </div>
 </div>

 {/* Footer */}
 <div className="px-4 py-3 sm:p-5 border-t border-border-default flex-shrink-0 flex justify-between items-center gap-3">
 <div className="text-sm text-content-secondary">
 {selectedItems.length > 0 && (
 <span className="font-medium">
 {selectedItems.length} item(s) • Total:{' '}
 <span className="text-brand-600 dark:text-brand-400 font-bold">
 {formatMoney(calculateManualTotal() + (newOrderIsDelivery ? newOrderDeliveryFee : 0))}
 </span>
 </span>
 )}
 </div>
 <div className="flex gap-3">
 <button
 onClick={resetModal}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg font-medium text-sm transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={handleManualSubmit}
 disabled={!newOrderCustomerName.trim() || selectedItems.length === 0 || isCheckingOrderNumber || !!orderNumberError || isSavingOrder}
 className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 font-medium text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
 >
 {isCheckingOrderNumber ? (
 <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
 ) : isSavingOrder ? (
 <><Loader2 className="w-4 h-4 animate-spin" /> A guardar...</>
 ) : (
 <><Save className="w-4 h-4" /> Salvar Pedido</>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Variant Selection Modal */}
 {variantSelectionModal.isOpen && variantSelectionModal.product && (() => {
 const variants = variantSelectionModal.product.variants || [];

 // Filtrar variações pela pesquisa
 const filteredVariants = variants.filter(v => {
 if (!variantSearchQuery.trim()) return true;
 const query = normalizeForSearch(variantSearchQuery);
 return normalizeForSearch(v.name).includes(query) ||
 normalizeForSearch(v.unit || '').includes(query) ||
 formatMoney(v.price).toLowerCase().includes(query);
 });

 // Ordenar variações
 const sortedVariants = [...filteredVariants].sort((a, b) => {
 if (variantSortBy === 'name') {
 return a.name.localeCompare(b.name);
 } else if (variantSortBy === 'price') {
 return a.price - b.price;
 }
 return 0;
 });

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4">
 <div className="bg-surface-raised rounded-xl max-w-2xl w-full animate-modal-enter max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default ">
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-xl font-bold text-content-primary">
 Selecionar Variação: {variantSelectionModal.product.name}
 </h3>
 <button
 onClick={() => {
 setVariantSelectionModal({ isOpen: false, product: null });
 setVariantSearchQuery('');
 }}
 className="text-content-muted hover:text-content-secondary p-2 hover:bg-surface-base dark:hover:bg-surface-base rounded-full transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Busca */}
 <div className="relative mb-4">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-muted" />
 <input
 type="text"
 placeholder="Buscar variações..."
 value={variantSearchQuery}
 onChange={(e) => setVariantSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500"
 />
 </div>

 {/* Ordenaçéo */}
 <div className="flex gap-2 mb-4">
 <button
 onClick={() => setVariantSortBy('name')}
 className={`px-3 py-1 text-sm rounded transition-colors ${variantSortBy === 'name'
 ? 'bg-brand-600 text-white'
 : 'bg-surface-base dark:bg-surface-base text-content-secondary dark:text-content-secondary'
 }`}
 >
 Ordenar por Nome
 </button>
 <button
 onClick={() => setVariantSortBy('price')}
 className={`px-3 py-1 text-sm rounded transition-colors ${variantSortBy === 'price'
 ? 'bg-brand-600 text-white'
 : 'bg-surface-base dark:bg-surface-base text-content-secondary dark:text-content-secondary'
 }`}
 >
 Ordenar por Preço
 </button>
 </div>
 </div>

 <div className="p-6">
 {sortedVariants.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {sortedVariants.map(variant => {
 const isSelected = selectedItems.some(
 item => item.productId === variantSelectionModal.product!.id && item.variantId === variant.id
 );
 const quantity = selectedItems.find(
 item => item.productId === variantSelectionModal.product!.id && item.variantId === variant.id
 )?.quantity || 0;

 return (
 <button
 key={variant.id}
 onClick={() => {
 handleAddItemWithVariant(variantSelectionModal.product!, variant);
 setVariantSelectionModal({ isOpen: false, product: null });
 setVariantSearchQuery('');
 }}
 className={`p-4 border-2 rounded-lg text-left transition-all ${isSelected
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20'
 : 'border-border-default dark:border-border-strong hover:border-brand-300 dark:hover:border-brand-500'
 }`}
 >
 <div className="flex items-center justify-between mb-2">
 <div className="font-semibold text-content-primary">
 {variant.name}
 </div>
 {isSelected && (
 <div className="text-brand-600 dark:text-brand-400 font-bold">
 {quantity}x
 </div>
 )}
 </div>
 <div className="text-sm text-content-secondary">
 {formatMoney(variant.price)} / {variant.unit}
 </div>
 {variant.stock !== undefined && (
 <div className="text-xs text-content-muted mt-1">
 Stock: {variant.stock} {variant.unit}
 </div>
 )}
 </button>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-12 text-content-muted">
 <p className="mb-2">Nenhuma variação encontrada</p>
 <button
 onClick={() => setVariantSearchQuery('')}
 className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
 >
 Limpar busca
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 );
 })()}

 {/* Product Match Modal */}
 {/* Product Match Modal */}
 {productMatchModal.isOpen && csvPreviewData && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50 p-4">
 <div className="bg-surface-raised rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
 <div className="p-6 border-b border-border-default">
 <h3 className="text-lg font-bold text-content-primary mb-2">
 Associar Produto
 </h3>
 <p className="text-sm text-content-secondary">
 Produto do CSV: <strong>{csvPreviewData.orders[productMatchModal.orderIndex]?.items[productMatchModal.itemIndex]?.productName}</strong>
 </p>
 </div>

 <div className="p-6 flex-1 overflow-y-auto">
 <div className="relative mb-4">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-muted" />
 <input
 type="text"
 placeholder="Pesquisar produtos..."
 value={productMatchModal.searchQuery}
 onChange={(e) => setProductMatchModal({ ...productMatchModal, searchQuery: e.target.value })}
 className="w-full pl-10 pr-4 py-2 border border-border-default dark:border-border-strong dark:bg-surface-base dark:text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500"
 />
 </div>

 <div className="space-y-2 max-h-96 overflow-y-auto">
 {products
 .filter(p =>
 !productMatchModal.searchQuery ||
 normalizeForSearch(p.name).includes(normalizeForSearch(productMatchModal.searchQuery))
 )
 .map(product => (
 <button
 key={product.id}
 onClick={() => {
 if (csvPreviewData) {
 const newOrders = [...csvPreviewData.orders];
 const order = newOrders[productMatchModal.orderIndex];
 const item = order.items[productMatchModal.itemIndex];

 // Se o produto tem variações, mostrar modal de seleção de variação
 const hasVariants = (product.variants && product.variants.length > 0) || product.hasVariants;

 if (hasVariants && product.variants && product.variants.length > 0) {
 // Guardar contexto para atualizar após seleção de variação
 setPendingProductMatch({
 orderIndex: productMatchModal.orderIndex,
 itemIndex: productMatchModal.itemIndex,
 product: product
 });
 // Abrir modal de seleção de variação
 setVariantSelectionModal({
 isOpen: true,
 product: product,
 isEditMode: false
 });
 // Fechar modal de associação de produto
 setProductMatchModal({ isOpen: false, orderIndex: -1, itemIndex: -1, searchQuery: '' });
 } else {
 // Produto sem variações - associar diretamente
 item.matchedProduct = product;
 item.matchedVariant = null;
 item.needsManualMatch = false;

 // Recalcular preço usando preço fixo ou preço do produto
 const fixedPrice = getFixedProductPrice(item.productName, item.quantity, item.unit);
 if (fixedPrice !== null) {
 if (item.unit === 'kg' && (item.productName.toUpperCase().includes('PATO') ||
 item.productName.toUpperCase().includes('FRANGO') ||
 item.productName.toUpperCase().includes('GALINHA'))) {
 item.price = fixedPrice * item.quantity;
 } else {
 item.price = fixedPrice * item.quantity;
 }
 } else {
 item.price = product.price * item.quantity;
 }

 setCsvPreviewData({ ...csvPreviewData, orders: newOrders });
 setProductMatchModal({ isOpen: false, orderIndex: -1, itemIndex: -1, searchQuery: '' });
 }
 }
 }}
 className="w-full text-left p-3 border border-border-default dark:border-border-strong rounded-lg hover:border-brand-500 dark:hover:border-brand-600 hover:bg-surface-base dark:hover:bg-surface-base transition-colors"
 >
 <div className="font-medium text-content-primary">{product.name}</div>
 <div className="text-sm text-content-muted">{product.category}</div>
 <div className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1">
 {formatMoney(product.price)} / {product.unit}
 </div>
 </button>
 ))}
 </div>

 {products.filter(p =>
 !productMatchModal.searchQuery ||
 normalizeForSearch(p.name).includes(normalizeForSearch(productMatchModal.searchQuery))
 ).length === 0 && (
 <div className="text-center py-8 text-content-muted">
 Nenhum produto encontrado
 </div>
 )}
 </div>

 <div className="p-6 border-t border-border-default flex justify-end gap-3">
 <button
 onClick={() => setProductMatchModal({ isOpen: false, orderIndex: -1, itemIndex: -1, searchQuery: '' })}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base rounded-lg"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Duplicate Detection Modal */}
 {isDuplicateModalOpen && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4">
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
 <div className="p-6 border-b border-border-default flex-shrink-0">
 <div className="flex justify-between items-center">
 <div>
 <h3 className="text-xl font-bold text-content-primary">
 Pedidos Duplicados Encontrados
 </h3>
 <p className="text-sm text-content-secondary mt-1">
 {duplicateGroups.length} grupo(s) de duplicados encontrado(s)
 </p>
 </div>
 <button
 onClick={() => {
 setIsDuplicateModalOpen(false);
 setDuplicateGroups([]);
 }}
 className="text-content-muted hover:text-content-secondary p-2 rounded-full hover:bg-surface-base"
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6">
 {isScanningDuplicates ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 <span className="ml-3 text-content-secondary">Analisando pedidos...</span>
 </div>
 ) : duplicateGroups.length === 0 ? (
 <div className="text-center py-12">
 <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
 <p className="text-lg font-medium text-content-primary mb-2">
 Nenhum duplicado encontrado!
 </p>
 <p className="text-sm text-content-secondary">
 Todos os pedidos são únicos.
 </p>
 </div>
 ) : (
 <div className="space-y-4">
 {duplicateGroups.map((group, groupIndex) => (
 <div
 key={groupIndex}
 className="border border-border-default rounded-lg p-4 bg-surface-base dark:bg-surface-base"
 >
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-content-primary">
 Grupo {groupIndex + 1}: {group.orders[0].customerName}
 </h4>
 <span className="text-sm text-content-secondary">
 {group.orders.length} pedido(s) duplicado(s)
 </span>
 </div>

 <div className="space-y-2">
 {group.orders.map((order, orderIndex) => {
 const isSelected = group.keepOrderId === order.id;
 return (
 <div
 key={order.id}
 className={`p-3 rounded-lg border-2 transition-all ${isSelected
 ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
 : 'border-border-default dark:border-border-strong bg-surface-raised cursor-pointer hover:border-border-default'
 }`}
 onClick={() => {
 const newGroups = [...duplicateGroups];
 newGroups[groupIndex].keepOrderId = order.id;
 setDuplicateGroups(newGroups);
 }}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 {isSelected && (
 <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
 )}
 <span className={`font-medium ${isSelected ? 'text-green-700 dark:text-green-300' : 'text-content-primary'}`}>
 {isSelected ? 'âœ“ MANTER ESTE' : 'Remover'}
 </span>
 {order.externalId && (
 <span className="text-xs text-content-muted">
 {order.externalId}
 </span>
 )}
 </div>
 <div className="text-sm text-content-secondary">
 <span>ðŸ“… {formatDateOnly(order.createdAt)}</span>
 <span className="mx-2">•</span>
 <span>ðŸ’° {formatMoney(order.totalAmount)}</span>
 {order.customerPhone && (
 <>
 <span className="mx-2">•</span>
 <span>ðŸ“ž {order.customerPhone}</span>
 </>
 )}
 </div>
 <div className="text-xs text-content-muted mt-1">
 {order.items.length} item(s) • Status: {getStatusLabel(order.status)}
 </div>
 </div>
 <div className="ml-4">
 <div className={`px-2 py-1 rounded text-xs font-medium ${isSelected
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
 : 'bg-surface-base text-content-secondary dark:text-content-secondary'
 }`}>
 {isSelected ? 'MANTER' : 'REMOVER'}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {duplicateGroups.length > 0 && (
 <div className="p-6 border-t border-border-default flex justify-between items-center flex-shrink-0">
 <div className="text-sm text-content-secondary">
 <strong className="text-content-primary">
 {duplicateGroups.reduce((sum, g) => sum + g.orders.length - 1, 0)} pedido(s)
 </strong> seréo removidos
 </div>
 <div className="flex gap-3">
 <button
 onClick={() => {
 setIsDuplicateModalOpen(false);
 setDuplicateGroups([]);
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base rounded-lg"
 >
 Cancelar
 </button>
 <button
 onClick={handleRemoveDuplicates}
 className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
 >
 <Trash2 className="w-4 h-4 inline mr-2" />
 Remover Duplicados
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Duplicate Detection Modal */}
 {isDuplicateModalOpen && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4">
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
 <div className="p-6 border-b border-border-default flex-shrink-0">
 <div className="flex justify-between items-center">
 <div>
 <h3 className="text-xl font-bold text-content-primary">
 Pedidos Duplicados Encontrados
 </h3>
 <p className="text-sm text-content-secondary mt-1">
 {duplicateGroups.length} grupo(s) de duplicados encontrado(s)
 </p>
 </div>
 <button
 onClick={() => {
 setIsDuplicateModalOpen(false);
 setDuplicateGroups([]);
 }}
 className="text-content-muted hover:text-content-secondary p-2 rounded-full hover:bg-surface-base"
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6">
 {isScanningDuplicates ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 <span className="ml-3 text-content-secondary">Analisando pedidos...</span>
 </div>
 ) : duplicateGroups.length === 0 ? (
 <div className="text-center py-12">
 <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
 <p className="text-lg font-medium text-content-primary mb-2">
 Nenhum duplicado encontrado!
 </p>
 <p className="text-sm text-content-secondary">
 Todos os pedidos são únicos.
 </p>
 </div>
 ) : (
 <div className="space-y-4">
 {duplicateGroups.map((group, groupIndex) => (
 <div
 key={groupIndex}
 className="border border-border-default rounded-lg p-4 bg-surface-base dark:bg-surface-base"
 >
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-content-primary">
 Grupo {groupIndex + 1}: {group.orders[0].customerName}
 </h4>
 <span className="text-sm text-content-secondary">
 {group.orders.length} pedido(s) duplicado(s)
 </span>
 </div>

 <div className="space-y-2">
 {group.orders.map((order, orderIndex) => {
 const isSelected = group.keepOrderId === order.id;
 return (
 <div
 key={order.id}
 className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${isSelected
 ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
 : 'border-border-default dark:border-border-strong bg-surface-raised hover:border-border-default'
 }`}
 onClick={() => {
 const newGroups = [...duplicateGroups];
 newGroups[groupIndex].keepOrderId = order.id;
 setDuplicateGroups(newGroups);
 }}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 {isSelected && (
 <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
 )}
 <span className={`font-medium ${isSelected ? 'text-green-700 dark:text-green-300' : 'text-content-primary'}`}>
 {isSelected ? 'âœ“ MANTER ESTE' : 'Remover'}
 </span>
 {order.externalId && (
 <span className="text-xs text-content-muted">
 {order.externalId}
 </span>
 )}
 </div>
 <div className="text-sm text-content-secondary">
 <span>ðŸ“… {formatDateOnly(order.createdAt)}</span>
 <span className="mx-2">•</span>
 <span>ðŸ’° {formatMoney(order.totalAmount)}</span>
 {order.customerPhone && (
 <>
 <span className="mx-2">•</span>
 <span>ðŸ“ž {order.customerPhone}</span>
 </>
 )}
 </div>
 <div className="text-xs text-content-muted mt-1">
 {order.items.length} item(s) • Status: {getStatusLabel(order.status)}
 </div>
 </div>
 <div className="ml-4">
 <div className={`px-2 py-1 rounded text-xs font-medium ${isSelected
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
 : 'bg-surface-base text-content-secondary dark:text-content-secondary'
 }`}>
 {isSelected ? 'MANTER' : 'REMOVER'}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {duplicateGroups.length > 0 && (
 <div className="p-6 border-t border-border-default flex justify-between items-center flex-shrink-0">
 <div className="text-sm text-content-secondary">
 <strong className="text-content-primary">
 {duplicateGroups.reduce((sum, g) => sum + g.orders.length - 1, 0)} pedido(s)
 </strong> seréo removidos
 </div>
 <div className="flex gap-3">
 <button
 onClick={() => {
 setIsDuplicateModalOpen(false);
 setDuplicateGroups([]);
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base rounded-lg"
 >
 Cancelar
 </button>
 <button
 onClick={handleRemoveDuplicates}
 className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
 >
 <Trash2 className="w-4 h-4" />
 Remover Duplicados
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Customer Suggestion Modal */}
 {showCustomerSuggestion && suggestedCustomer && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4">
 <div className="bg-surface-raised rounded-xl max-w-md w-full animate-modal-enter p-6">
 <div className="flex items-start gap-4">
 <div className="flex-shrink-0">
 <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
 <UserIcon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
 </div>
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-semibold text-content-primary mb-2">
 Cliente Existente Encontrado
 </h3>
 <p className="text-sm text-content-secondary mb-4">
 Encontramos um cliente com nome ou telefone similar:
 </p>
 <div className="bg-surface-base dark:bg-surface-base rounded-lg p-4 mb-4">
 <div className="space-y-2">
 <div>
 <span className="text-xs text-content-muted">Nome:</span>
 <p className="font-medium text-content-primary">{suggestedCustomer.name}</p>
 </div>
 {suggestedCustomer.phone && (
 <div>
 <span className="text-xs text-content-muted">Telefone:</span>
 <p className="font-medium text-content-primary">{suggestedCustomer.phone}</p>
 </div>
 )}
 {suggestedCustomer.tier && (
 <div>
 <span className="text-xs text-content-muted">Categoria:</span>
 <p className="font-medium text-content-primary">{suggestedCustomer.tier}</p>
 </div>
 )}
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={handleAcceptSuggestedCustomer}
 className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors"
 >
 Usar Este Cliente
 </button>
 <button
 onClick={handleIgnoreSuggestedCustomer}
 className="px-4 py-2 bg-surface-base text-content-secondary dark:text-content-secondary rounded-lg hover:bg-surface-base font-medium transition-colors"
 >
 Continuar Como Novo
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Confirmation Dialog */}
 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 title={confirmDialog.title}
 message={confirmDialog.message}
 confirmText={confirmDialog.confirmText}
 cancelText="Cancelar"
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } })}
 variant={confirmDialog.variant}
 />
 </PageShell>
 </div>
 );
};


