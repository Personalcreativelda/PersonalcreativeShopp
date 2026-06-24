import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Order, Purchase, StockMovement, StockItem, OrderStatus, Sale, ProductVariant, StockAdjustment, StockAdjustmentReason, UserRole } from '../../core/types/types';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import { getTodayDateString, getStockSnapshotDate, toDateStringInTimezone, formatDateTime, formatDateOnly } from '../../core/utils/dateUtils';
import {
 Package,
 TrendingUp,
 TrendingDown,
 DollarSign,
 Calendar,
 Download,
 FileText,
 BarChart3,
 Search,
 Filter,
 ShoppingCart,
 ArrowUp,
 ArrowDown,
 Plus,
 Minus,
 X,
 Edit2,
 Save,
 Loader2,
 ChevronLeft,
 ChevronRight,
 CheckCircle2,
 Trash2,
 Eye,
 XCircle,
 AlertTriangle,
 RefreshCw,
 Settings
} from 'lucide-react';
import { stockService } from '../services/stockService';
import { stockAdjustmentService } from '../services/stockAdjustmentService';
import { stockReportService } from '../services/stockReportService';
import { stockIntegrityService } from '../services/stockIntegrityService';
import { stockConfigService, ValuationMethod } from '../services/stockConfigService';
import { purchaseService } from '../services/purchaseService';
import { orderService } from '../../sales/services/orderService';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { Toast } from '../../core/components/ui/Toast';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, ItemsPerPageSelect, SelectFilter, Pagination } from '../../core/components/filters';
import { useMobile } from '../../core/hooks/useMobile';
import { createWorkbook, addWorksheet, addRowsFromJson, addJsonToSheetAt, writeWorkbookToFile, applyStockReportStyle } from '../../core/services/excelService';
import jsPDF from 'jspdf';
import { addPDFHeader, addPDFFooter, getBrandColors, calculateColumnWidths, addPDFTableHeader, addPDFTableRow, addPDFSummarySection } from '../../core/services/reportService';
import { CreateMovementModal } from '../components/modals/CreateMovementModal';
import { StockIntegrityModal } from '../components/modals/StockIntegrityModal';
import { Modal } from '../components/shared/Modal';
import { parseProductName } from '../../core/services/serviceUtils';
import { useAppAuth } from '../../auth/hooks/useAppAuth';

type StockTabType = 'products' | 'movements' | 'settings';

interface StockManagementProps {
 products: Product[];
 orders: Order[];
 purchases: Purchase[];
 sales?: Sale[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
 defaultTab?: StockTabType;
}

interface StockPeriodData {
 productId: string;
 productName: string;
 variantId?: string;
 variantName?: string;
 unit: string;
 // Unidades
 initialStock: number;
 purchases: number;
 sales: number;
 adjustments?: number;
 finalStock: number;
 // Valores monetários (custo unitário usado nos cálculos)
 costPrice?: number;
 initialValue: number; // Valor do stock inicial (custo)
 purchasesValue: number; // Valor das compras (custo)
 salesValue: number; // Valor das saidas por vendas (custo)
 finalValue: number; // Valor do stock final (custo)
 profit: number; // Reservado para enriquecimento futuro
}

export const StockManagement: React.FC<StockManagementProps> = ({
 products,
 orders,
 purchases,
 sales = [],
 showToast,
 defaultTab = 'products'
}) => {
 // Hook para detectar mobile
 const isMobile = useMobile(768);
 const { currentUser } = useAppAuth();
 const isSuperAdmin = (currentUser as any)?.isSuperAdmin === true || currentUser?.role === UserRole.ADMIN;

 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(
 defaultTab === 'movements' ? 'thisMonth' : 'today'
 );
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');
 const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
 const [transactionCostsMap, setTransactionCostsMap] = useState<Map<string, number>>(new Map());
 const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
 // Stock inicial manual por data (ex.: 01/01/2026): quando período começa nesta data, usa quantidades guardadas
 const currentYear = new Date().getFullYear();
 const [stockInitialSnapshotDate, setStockInitialSnapshotDate] = useState<string>(() => `${currentYear}-01-01`);
 const [snapshotMap, setSnapshotMap] = useState<Map<string, number>>(new Map());
 const [showSnapshotSection, setShowSnapshotSection] = useState(false);
 const [snapshotEditMap, setSnapshotEditMap] = useState<Map<string, number>>(new Map());
 const [snapshotSearchQuery, setSnapshotSearchQuery] = useState('');
 const [snapshotSaving, setSnapshotSaving] = useState(false);
 const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [groupByVariant, setGroupByVariant] = useState(true); // Por padrão, filtrar por produtos variáveis
 const [includeZeroStock, setIncludeZeroStock] = useState(false); // Iniciar desmarcado por padrão
 const [viewMode, setViewMode] = useState<'units' | 'monetary'>('units');
 const [columnViewMode, setColumnViewMode] = useState<'all' | 'initial' | 'purchases' | 'sales' | 'final' | 'adjustments'>('final');
 const [refreshKey, setRefreshKey] = useState(0); // Para forçar recarregamento dos dados do período (API)
 const [activeTab, setActiveTab] = useState<StockTabType>(defaultTab);

 // O tab ativo é controlado por submenu/rota externa.
 useEffect(() => {
 setActiveTab(defaultTab);
 }, [defaultTab]);

 const [periodData, setPeriodData] = useState<StockPeriodData[]>([]);
 const [periodLoading, setPeriodLoading] = useState(false);
 const [periodDataReady, setPeriodDataReady] = useState(false);

 // Paginação para produtos
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(500);

 // Paginação para movimentos
 const [movementCurrentPage, setMovementCurrentPage] = useState(1);
 const [movementItemsPerPage, setMovementItemsPerPage] = useState(500);
 const [movementSortField, setMovementSortField] = useState<'date' | 'description' | 'product' | 'variant' | 'initialStock' | 'entry' | 'exit' | 'balance'>('date');
 const [movementSortDirection, setMovementSortDirection] = useState<'asc' | 'desc'>('desc'); // descendente por defeito: mais recentes primeiro

 // Filtros compartilhados (aplicáveis tanto para produtos quanto movimentos)
 const [filterType, setFilterType] = useState<'all' | 'entry' | 'exit'>('all');

 // Refs para diagnóstico: comparar totais por variante vs por produto (apenas em desenvolvimento)
 const variantTotalsRef = useRef<{ initial: number; final: number } | null>(null);
 const productTotalsRef = useRef<{ initial: number; final: number } | null>(null);

 // Estados para filtros mobile separados por tab
 const [showFiltersProducts, setShowFiltersProducts] = useState(false);
 const [showFiltersMovements, setShowFiltersMovements] = useState(false);

 // Reset paginaçéo quando filtros mudarem
 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, selectedPeriod, customStartDate, customEndDate]);

 useEffect(() => {
 setMovementCurrentPage(1);
 }, [searchQuery, selectedPeriod, customStartDate, customEndDate, filterType]);

 // Limpar seleções inválidas quando os movimentos mudarem (para evitar seleções de movimentos que não existem mais)
 useEffect(() => {
 if (stockMovements.length > 0 && selectedMovements.size > 0) {
 const validMovementIds = new Set(stockMovements.map(m => m.id));
 const validSelections = Array.from(selectedMovements).filter(id => validMovementIds.has(id));
 if (validSelections.length !== selectedMovements.size) {
 setSelectedMovements(new Set(validSelections));
 }
 } else if (stockMovements.length === 0 && selectedMovements.size > 0) {
 // Se não há movimentos, limpar todas as seleções
 setSelectedMovements(new Set());
 }
 }, [stockMovements.length]); // Usar apenas length para evitar loops

 // Estados para ações em massa
 const [selectedMovements, setSelectedMovements] = useState<Set<string>>(new Set());
 const [isDeletingMovements, setIsDeletingMovements] = useState(false);

 // Configurações de stock (valorização)
 const [valuationMethod, setValuationMethod] = useState<ValuationMethod>('fifo');
 const [valuationSaving, setValuationSaving] = useState(false);

 // Carregar método de valorização apenas quando abrir as configurações.
 useEffect(() => {
 if (activeTab !== 'settings') return;
 let mounted = true;
 stockConfigService.getValuationMethod().then((m) => {
 if (mounted) setValuationMethod(m);
 });
 return () => { mounted = false; };
 }, [activeTab]);

 const handleValuationMethodChange = async (method: ValuationMethod) => {
 setValuationSaving(true);
 const res = await stockConfigService.setValuationMethod(method);
 setValuationSaving(false);
 if (res.success) {
 setValuationMethod(method);
 showToast(`Método de valorização alterado para ${method.toUpperCase()}`, 'success');
 setRefreshKey((k) => k + 1);
 } else {
 showToast(res.error || 'Erro ao guardar método de valorização', 'error');
 }
 };

 // Funções para ações em massa (definidas no nível do componente)
 const handleSelectAllMovements = (allMovementIds: string[]) => {
 // Verificar se todos os movimentos da lista estão selecionados
 const allSelected = allMovementIds.length > 0 && allMovementIds.every(id => selectedMovements.has(id));

 if (allSelected) {
 // Desmarcar todos os movimentos da lista atual
 setSelectedMovements(prev => {
 const newSet = new Set(prev);
 allMovementIds.forEach(id => newSet.delete(id));
 return newSet;
 });
 } else {
 // Marcar todos os movimentos da lista
 setSelectedMovements(prev => {
 const newSet = new Set(prev);
 allMovementIds.forEach(id => newSet.add(id));
 return newSet;
 });
 }
 };

 const handleSelectMovement = (movementId: string) => {
 setSelectedMovements(prev => {
 const newSelected = new Set(prev);
 if (newSelected.has(movementId)) {
 newSelected.delete(movementId);
 } else {
 newSelected.add(movementId);
 }
 return newSelected;
 });
 };

 const handleDeleteSelectedMovements = async () => {
 if (selectedMovements.size === 0) {
 showToast('Selecione pelo menos um movimento para remover', 'warning');
 return;
 }

 if (!confirm(`Tem certeza que deseja remover ${selectedMovements.size} movimento(s)? Esta açéo néo pode ser desfeita.`)) {
 return;
 }

 setIsDeletingMovements(true);
 try {
 let deleted = 0;
 let errors: string[] = [];

 for (const movementId of selectedMovements) {
 try {
 const success = await stockService.deleteStockMovement(movementId);
 if (success) {
 deleted++;
 } else {
 errors.push(`Falha ao remover movimento ${movementId}`);
 }
 } catch (error: any) {
 errors.push(`Erro ao remover movimento ${movementId}: ${error.message}`);
 }
 }

 if (deleted > 0) {
 showToast(`${deleted} movimento(s) removido(s) com sucesso`, 'success');
 await loadStockMovements();
 setSelectedMovements(new Set());
 setRefreshKey(prev => prev + 1);
 }

 if (errors.length > 0) {
 showToast(`Alguns erros ocorreram: ${errors.join(', ')}`, 'warning');
 }
 } catch (error: any) {
 console.error('Erro ao remover movimentos:', error);
 showToast('Erro ao remover movimentos', 'error');
 } finally {
 setIsDeletingMovements(false);
 }
 };


 // Função helper para obter produtos filtrados para exportação (mesmos dados e ordem da tabela)
 const getFilteredProductsForExport = () => {
 return [...sortedData];
 };

 // Função helper para preparar dados filtrados para exportação
 const getFilteredDataForExport = () => {
 const { start, end } = getDateRange();
 const filteredMovementsForExport = stockMovements
 .filter(m => {
 const movementDate = new Date(m.date);
 movementDate.setHours(0, 0, 0, 0);
 const inPeriod = movementDate >= start && movementDate <= end;
 if (!inPeriod) return false;

 const BASE_DATE = new Date('2026-01-18');
 BASE_DATE.setHours(0, 0, 0, 0);

 const notes = m.notes?.toLowerCase() || '';
 const isFromPurchase = notes.includes('compra') ||
 notes.includes('entrada de stock via compra') ||
 notes.includes('entrada via compra');
 const isFromOrder = notes.includes('pedido') ||
 notes.includes('saída de stock via pedido') ||
 notes.includes('saída via pedido');
 const isManualAdjustment = notes.includes('ajuste direto na tabela') ||
 notes.includes('stock inicial ajustado') ||
 notes.includes('stock final ajustado') ||
 notes.includes('ajuste manual') ||
 notes.includes('reset histórico') ||
 notes.includes('stock inicial definido') ||
 notes.includes('verificar stock') ||
 notes.includes('validar stock');

 const isExitBeforeBaseDate = isFromOrder && movementDate < BASE_DATE;

 if ((isManualAdjustment && !isFromPurchase && !isFromOrder) || isExitBeforeBaseDate) {
 return false;
 }

 if (filterType !== 'all') {
 const hasEntry = m.items.some(i => i.quantity > 0);
 const hasExit = m.items.some(i => i.quantity < 0);
 if (filterType === 'entry' && !hasEntry) return false;
 if (filterType === 'exit' && !hasExit) return false;
 }

 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 const matchesNotes = (m.notes && normalizeForSearch(m.notes).includes(query)) || false;
 const matchesItems = m.items.some(i => {
 const productName = normalizeForSearch(i.productName || '');
 const variant = normalizeForSearch(i.variant || '');
 return productName.includes(query) || variant.includes(query);
 });
 if (!matchesNotes && !matchesItems) return false;
 }


 return true;
 });

 // Preparar dados para exportação (similar ao extractData)
 const exportData: any[] = [];
 filteredMovementsForExport.forEach(movement => {
 movement.items.forEach(item => {
 const notes = movement.notes?.toLowerCase() || '';
 const isPurchase = notes.includes('compra') || notes.includes('entrada de stock via compra') || notes.includes('entrada via compra');
 const isOrder = notes.includes('pedido') || notes.includes('saída de stock via pedido') || notes.includes('saída via pedido');

 let entry = 0;
 let exit = 0;

 if (isOrder) {
 if (item.quantity < 0) {
 exit = Math.abs(item.quantity);
 } else if (item.quantity > 0) {
 exit = Math.abs(item.quantity);
 }
 } else if (isPurchase) {
 if (item.quantity > 0) {
 entry = Math.abs(item.quantity);
 } else if (item.quantity < 0) {
 entry = Math.abs(item.quantity);
 }
 } else {
 entry = item.quantity > 0 ? Math.abs(item.quantity) : 0;
 exit = item.quantity < 0 ? Math.abs(item.quantity) : 0;
 }

 const product = products.find(p => p.id === item.productId || p.name.toLowerCase().trim() === item.productName.toLowerCase().trim());
 let variant: ProductVariant | undefined;
 let costPrice = 0;
 let price = 0;

 if (product) {
 if (item.variant && product.variants && product.variants.length > 0) {
 variant = product.variants.find(v =>
 v.name.toLowerCase().trim() === item.variant?.toLowerCase().trim() ||
 v.id === item.variant
 );
 costPrice = variant?.costPrice || product.costPrice || 0;
 price = variant?.price || product.price || 0;
 } else {
 costPrice = product.costPrice || 0;
 price = product.price || 0;
 }
 }

 const entryCost = (entry > 0 && item.unitPrice != null) ? item.unitPrice : costPrice;
 // Controlo de stock: saídas usam sempre custo (compra/FIFO), nunca preço de venda
 const exitCost = exit > 0
 ? (transactionCostsMap.get(`${movement.id}-${item.productId}-${item.variantId ?? variant?.id ?? 'null'}`) ?? costPrice)
 : costPrice;
 const entryValue = entry * entryCost;
 const exitValue = exit * exitCost;

 exportData.push({
 date: movement.date,
 description: movement.notes || '',
 productId: item.productId,
 productName: item.productName,
 variant: item.variant || '-',
 variantId: variant?.id,
 entry,
 exit,
 entryValue,
 exitValue,
 unit: item.unit || 'un',
 movementId: movement.id,
 notes: movement.notes || ''
 });
 });
 });

 // Agrupar se não estiver agrupando por variante
 let finalExportData = exportData;
 if (!groupByVariant) {
 const groupedData = new Map<string, any>();
 exportData.forEach(item => {
 const product = products.find(p => {
 if (item.productId && p.id === item.productId) return true;
 if (p.name.toLowerCase().trim() === item.productName.toLowerCase().trim()) return true;
 const itemNameLower = item.productName.toLowerCase().trim();
 const productNameLower = p.name.toLowerCase().trim();
 return itemNameLower.startsWith(productNameLower) || productNameLower.startsWith(itemNameLower);
 });

 const productBaseName = product ? product.name : item.productName.replace(/\s+\d+[.,]?\d*\s*(kg|g|un|dz|ml|l|m|cm|mm|fresco|seco)/gi, '').trim();
 const productBaseId = product ? product.id : item.productId;
 const key = `${productBaseId || productBaseName.toLowerCase().trim()}-${item.date}-${item.movementId}`;

 const existing = groupedData.get(key);
 if (existing) {
 existing.entry += item.entry;
 existing.exit += item.exit;
 existing.entryValue += item.entryValue;
 existing.exitValue += item.exitValue;
 existing.variant = '-';
 existing.productName = productBaseName;
 existing.productId = productBaseId || existing.productId;
 } else {
 groupedData.set(key, {
 ...item,
 variant: '-',
 productName: productBaseName,
 productId: productBaseId || item.productId
 });
 }
 });
 finalExportData = Array.from(groupedData.values());
 }

 // Ordenar por data e calcular saldos
 finalExportData.sort((a, b) => {
 const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
 if (dateCompare !== 0) return dateCompare;
 const aIsEntry = a.entry > 0;
 const bIsEntry = b.entry > 0;
 if (aIsEntry !== bIsEntry) {
 return aIsEntry ? -1 : 1;
 }
 return a.productName.localeCompare(b.productName);
 });

 // Calcular saldo inicial (snapshot + movimentos antes do periodo)
 // start ja foi declarado no inicio da funcao
 const normalizedStart = normalizeDateStart(start);
 const snapshotDateParsed = stockInitialSnapshotDate ? normalizeDateStart(new Date(stockInitialSnapshotDate)) : null;
 // >= para incluir quando o periodo comeca exactamente na data do snapshot
 const useSnapshot = snapshotDateParsed && normalizedStart >= snapshotDateParsed;

 // Inicializar mapa de saldos iniciais
 const preBalanceMap = new Map<string, number>();

 // Adicionar valores do snapshot se aplicavel
 if (useSnapshot && snapshotMap.size > 0) {
 products.forEach(product => {
 const effectiveVariants = product.variants && product.variants.length > 0
 ? product.variants
 : [{ id: `${product.id}-default`, name: product.name, isDefault: true }];
 effectiveVariants.forEach(variant => {
 const realVariantId = variant.id && !String(variant.id).includes('-default') ? variant.id : null;
 const snapshotKey = `${product.id}-${realVariantId ?? 'no-variant'}`;
 const snapshotValue = snapshotMap.get(snapshotKey) || 0;
 if (snapshotValue !== 0) {
 const variantName = groupByVariant ? (variant.name || product.name) : '-';
 const unit = product.unit || 'un';
 const balanceKey = groupByVariant
 ? `${product.name}-${variantName}-${unit}`
 : `${product.name}-${unit}`;
 preBalanceMap.set(balanceKey, snapshotValue);
 }
 });
 });
 }

 // Adicionar movimentos entre snapshot e inicio do periodo
 const movementsBeforePeriodForExport = stockMovements.filter(m => {
 const movementDate = normalizeDateStart(new Date(m.date));
 if (movementDate >= normalizedStart) return false;
 if (useSnapshot && snapshotDateParsed && movementDate <= snapshotDateParsed) return false;
 const notes = m.notes?.toLowerCase() || '';
 const isFromPurchase = notes.includes('compra') || notes.includes('entrada de stock via compra');
 const isFromOrder = notes.includes('pedido') || notes.includes('saida de stock via pedido');
 const isManualAdjustment = notes.includes('ajuste direto na tabela') || notes.includes('stock inicial');
 if (isManualAdjustment && !isFromPurchase && !isFromOrder) return false;
 return isFromPurchase || isFromOrder;
 });

 movementsBeforePeriodForExport.forEach(movement => {
 const notes = movement.notes?.toLowerCase() || '';
 const isOrder = notes.includes('pedido') || notes.includes('saida de stock via pedido');
 movement.items.forEach(item => {
 const entry = item.quantity > 0 ? Math.abs(item.quantity) : 0;
 const exit = item.quantity < 0 || isOrder ? Math.abs(item.quantity) : 0;
 const delta = isOrder ? -Math.abs(item.quantity) : (item.quantity > 0 ? Math.abs(item.quantity) : -Math.abs(item.quantity));
 const variantName = groupByVariant ? (item.variant || '-') : '-';
 const balanceKey = groupByVariant
 ? `${item.productName}-${variantName}-${item.unit || 'un'}`
 : `${item.productName}-${item.unit || 'un'}`;
 const current = preBalanceMap.get(balanceKey) ?? 0;
 preBalanceMap.set(balanceKey, current + (isOrder ? -exit : entry));
 });
 });

 // Calcular saldos
 const balanceMap = new Map<string, number>();
 const balanceValueMap = new Map<string, number>();
 const exportDataWithBalance = finalExportData.map(item => {
 const key = groupByVariant
 ? `${item.productName}-${item.variant}-${item.unit}`
 : `${item.productName}-${item.unit}`;

 if (!balanceMap.has(key)) {
 // Usar saldo inicial pre-calculado
 const preBalance = preBalanceMap.get(key) || 0;
 balanceMap.set(key, preBalance);
 const product = products.find(p => p.id === item.productId || p.name.toLowerCase().trim() === item.productName.toLowerCase().trim());
 if (product) {
 let costPrice = 0;
 if (groupByVariant && item.variantId && product.variants) {
 const variant = product.variants.find(v => v.id === item.variantId);
 costPrice = variant?.costPrice || product.costPrice || 0;
 } else {
 costPrice = product.costPrice || 0;
 }
 balanceValueMap.set(key, preBalance * costPrice);
 }
 }

 const initialStock = balanceMap.get(key) || 0;
 const initialStockValue = balanceValueMap.get(key) || 0;
 const newBalance = initialStock + item.entry - item.exit;
 const newBalanceValue = initialStockValue + item.entryValue - item.exitValue;
 balanceMap.set(key, newBalance);
 balanceValueMap.set(key, newBalanceValue);

 return {
 ...item,
 initialStock,
 initialStockValue,
 balance: newBalance,
 balanceValue: newBalanceValue
 };
 });

 // Ordenar como na tabela (movementSortField / movementSortDirection)
 const sortedForExport = [...exportDataWithBalance].sort((a, b) => {
 let compare = 0;
 switch (movementSortField) {
 case 'date':
 compare = new Date(a.date).getTime() - new Date(b.date).getTime();
 if (compare === 0) {
 const aIsEntry = a.entry > 0;
 const bIsEntry = b.entry > 0;
 if (aIsEntry !== bIsEntry) compare = aIsEntry ? -1 : 1;
 }
 break;
 case 'description':
 compare = (a.description || '').localeCompare(b.description || '');
 break;
 case 'product':
 compare = (a.productName || '').localeCompare(b.productName || '');
 break;
 case 'variant':
 compare = (a.variant || '').localeCompare(b.variant || '');
 break;
 case 'initialStock':
 compare = (a.initialStock || 0) - (b.initialStock || 0);
 break;
 case 'entry':
 compare = a.entry - b.entry;
 break;
 case 'exit':
 compare = a.exit - b.exit;
 break;
 case 'balance':
 compare = (a.balance || 0) - (b.balance || 0);
 break;
 default:
 compare = new Date(b.date).getTime() - new Date(a.date).getTime();
 }
 return movementSortDirection === 'asc' ? compare : -compare;
 });

 return sortedForExport;
 };

 // Função para exportar movimentos para Excel
 const exportToExcel = async (dataToExport: any[]) => {
 try {
 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 // Preparar dados para Excel
 const excelData = dataToExport.map(item => ({
 'Data': formatDateOnly(item.date),
 'Descrição': item.description || '',
 'Produto': item.productName || '',
 'Variação': groupByVariant ? (item.variant || '-') : '-',
 'Stock Inicial': viewMode === 'monetary'
 ? `${(item.initialStockValue || 0).toFixed(2)} MT`
 : `${(item.initialStock || 0).toFixed(2)} ${item.unit}`,
 'Entrada': item.entry > 0
 ? (viewMode === 'monetary'
 ? `${item.entryValue.toFixed(2)} MT`
 : `${item.entry.toFixed(2)} ${item.unit}`)
 : '-',
 'Saída': item.exit > 0
 ? (viewMode === 'monetary'
 ? `${item.exitValue.toFixed(2)} MT`
 : `${item.exit.toFixed(2)} ${item.unit}`)
 : '-',
 'Saldo': viewMode === 'monetary'
 ? `${(item.balanceValue || 0).toFixed(2)} MT`
 : `${item.balance.toFixed(2)} ${item.unit}`
 }));

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Movimentos de Stock');

 const periodLabelMeta = selectedPeriod === 'custom'
 ? `${startStr} a ${endStr}`
 : selectedPeriod === 'today' ? 'Hoje' : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês' : selectedPeriod === 'thisYear' ? 'Este Ano' : `${startStr} a ${endStr}`;
 const verLabelMov = filterType === 'all' ? 'Todos' : filterType === 'entry' ? 'Entrada' : 'Saída';
 ws.getRow(1).getCell(1).value = 'Período:';
 ws.getRow(1).getCell(2).value = periodLabelMeta;
 ws.getRow(2).getCell(1).value = 'Pesquisa:';
 ws.getRow(2).getCell(2).value = searchQuery.trim() || '-';
 ws.getRow(2).getCell(4).value = 'Variante:';
 ws.getRow(2).getCell(5).value = groupByVariant ? 'Sim' : 'Não';
 ws.getRow(2).getCell(7).value = 'Ver:';
 ws.getRow(2).getCell(8).value = verLabelMov;

 const movementDataStartRow = 4;
 const headerKeys = Object.keys(excelData[0] || {});
 const headerRow = ws.getRow(3);
 headerKeys.forEach((k, i) => headerRow.getCell(i + 1).value = k);
 headerRow.commit();
 addJsonToSheetAt(ws, excelData as Record<string, unknown>[], movementDataStartRow, 1);

 [12, 40, 25, 20, 18, 15, 15, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 const periodLabel = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `movimentos_stock_${periodLabel}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação para Excel concluída: ${dataToExport.length} movimentos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 // Função para exportar movimentos para PDF
 const exportToPDF = async (dataToExport: any[]) => {
 try {
 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar Informações do período e filtros
 const periodLabel = selectedPeriod === 'custom'
 ? `${formatDateOnly(start)} a ${formatDateOnly(end)}`
 : selectedPeriod === 'today' ? 'Hoje'
 : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês'
 : selectedPeriod === 'thisYear' ? 'Este Ano'
 : `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: searchQuery });
 }
 filters.push({ label: 'Variante', value: groupByVariant ? 'Sim' : 'Não' });
 filters.push({ label: 'Ver', value: filterType === 'all' ? 'Todos' : filterType === 'entry' ? 'Entrada' : 'Saída' });
 filters.push({ label: 'Modo', value: viewMode === 'monetary' ? 'Valores Monetários' : 'Unidades' });
 filters.push({ label: 'Total de movimentos', value: dataToExport.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Movimentos de Stock', {
 period: periodLabel,
 filters,
 orientation: 'landscape',
 });

 // Definir colunas da tabela com branding
 const colHeaders = groupByVariant
 ? ['Data', 'Descrição', 'Produto', 'Variação', 'Stock Inicial', 'Entrada', 'Saída', 'Saldo']
 : ['Data', 'Descrição', 'Produto', 'Stock Inicial', 'Entrada', 'Saída', 'Saldo'];

 // Calcular largura disponível e proporções das colunas
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = groupByVariant
 ? [1.0, 2.5, 1.5, 1.2, 1.2, 1.0, 1.0, 1.0] // Com variaçéo
 : [1.0, 2.5, 2.0, 1.2, 1.0, 1.0, 1.0]; // Sem variaçéo

 const colWidths = calculateColumnWidths(availableWidth, colProportions);

 // Calcular posições X das colunas
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 // Cabeçalho da tabela com branding
 yPos = addPDFTableHeader(pdf, colHeaders, colX, yPos, margin, pdfWidth);

 // Dados da tabela com alterné¢ncia de cores
 dataToExport.forEach((item, index) => {
 // Verificar se precisa de nova página
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 // Repetir cabeçalho em nova página
 yPos = addPDFTableHeader(pdf, colHeaders, colX, yPos, margin, pdfWidth);
 }

 const dateStr = formatDateOnly(item.date);
 const maxDescriptionLength = Math.floor(colWidths[1] / 2);
 const maxProductLength = Math.floor(colWidths[2] / 2);
 const description = (item.description || '').length > maxDescriptionLength
 ? (item.description || '').substring(0, maxDescriptionLength - 3) + '...'
 : (item.description || '');
 const productName = (item.productName || '').length > maxProductLength
 ? (item.productName || '').substring(0, maxProductLength - 3) + '...'
 : (item.productName || '');
 const variant = groupByVariant ? ((item.variant || '-').substring(0, 20)) : '';

 const initialStock = viewMode === 'monetary'
 ? `${(item.initialStockValue || 0).toFixed(2)} MT`
 : `${(item.initialStock || 0).toFixed(2)} ${item.unit}`;

 const entry = item.entry > 0
 ? (viewMode === 'monetary'
 ? `${item.entryValue.toFixed(2)} MT`
 : `${item.entry.toFixed(2)} ${item.unit}`)
 : '-';

 const exit = item.exit > 0
 ? (viewMode === 'monetary'
 ? `${item.exitValue.toFixed(2)} MT`
 : `${item.exit.toFixed(2)} ${item.unit}`)
 : '-';

 const balance = viewMode === 'monetary'
 ? `${(item.balanceValue || 0).toFixed(2)} MT`
 : `${item.balance.toFixed(2)} ${item.unit}`;

 const rowData = groupByVariant
 ? [dateStr, description, productName, variant, initialStock, entry, exit, balance]
 : [dateStr, description, productName, initialStock, entry, exit, balance];

 yPos = addPDFTableRow(pdf, rowData, colX, yPos, index, margin, pdfWidth, {
 fontSize: 8,
 alternateColors: true,
 });
 });

 // Seçéo de totais com branding
 const totalEntry = dataToExport.reduce((sum, item) => sum + item.entry, 0);
 const totalExit = dataToExport.reduce((sum, item) => sum + item.exit, 0);
 const totalEntryValue = dataToExport.reduce((sum, item) => sum + item.entryValue, 0);
 const totalExitValue = dataToExport.reduce((sum, item) => sum + item.exitValue, 0);

 const summaryItems = [
 {
 label: 'Entradas',
 value: viewMode === 'monetary'
 ? `${totalEntryValue.toFixed(2)} MT`
 : `${totalEntry.toFixed(2)}`
 },
 {
 label: 'Saídas',
 value: viewMode === 'monetary'
 ? `${totalExitValue.toFixed(2)} MT`
 : `${totalExit.toFixed(2)}`
 }
 ];
 yPos = addPDFSummarySection(pdf, 'Totais', summaryItems, yPos, margin);

 // Rodapé com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Gerar nome do arquivo
 const periodLabelForFilename = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `movimentos_stock_${periodLabelForFilename}_${getTodayDateString()}.pdf`;

 // Salvar PDF
 pdf.save(filename);
 showToast(`Exportação para PDF concluída: ${dataToExport.length} movimentos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 // Função para exportar produtos para Excel (11 colunas: NOME DO PRODUTO, VAR, UN, INICIAL, VALOR, ...)
 const exportProductsToExcel = async (dataToExport: StockPeriodData[]) => {
 try {
 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Produtos Stock');

 const periodLabelForMeta = selectedPeriod === 'custom'
 ? `${startStr} a ${endStr}`
 : selectedPeriod === 'today' ? 'Hoje' : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês' : selectedPeriod === 'thisYear' ? 'Este Ano' : `${startStr} a ${endStr}`;
 ws.getRow(1).getCell(1).value = `Relatório de Stock para o período ${periodLabelForMeta}`;
 const dataStartRow = 3;

 const { showInitial, showPurchases, showSales, showAdjustments, showFinal } = getProductColumnVisibility(dataToExport);

 const headers: string[] = ['NOME DO PRODUTO', 'VAR', 'UN', getUnitCostHeader()];
 if (showInitial) headers.push('INICIAL', 'VALOR');
 if (showPurchases) headers.push('COMPRAS', 'VALOR');
 if (showSales) headers.push('VENDAS', 'VALOR');
 if (showAdjustments) headers.push('AJUSTES', 'VALOR');
 if (showFinal) headers.push('FINAL', 'VALOR');

 const headerRow = ws.getRow(dataStartRow);
 headers.forEach((h, i) => headerRow.getCell(i + 1).value = h);
 headerRow.commit();

 dataToExport.forEach((item, idx) => {
 const row = ws.getRow(dataStartRow + 1 + idx);
 let col = 1;
 row.getCell(col++).value = item.productName || '';
 row.getCell(col++).value = item.variantName || '-';
 row.getCell(col++).value = item.unit;
 row.getCell(col++).value = Number((getDisplayedUnitCost(item) ?? 0).toFixed(2));
 if (showInitial) { row.getCell(col++).value = Number(item.initialStock.toFixed(2)); row.getCell(col++).value = Number(getInitialValue(item).toFixed(2)); }
 if (showPurchases) { row.getCell(col++).value = Number(item.purchases.toFixed(2)); row.getCell(col++).value = Number(getPurchasesValue(item).toFixed(2)); }
 if (showSales) { row.getCell(col++).value = Number(item.sales.toFixed(2)); row.getCell(col++).value = Number(getSalesValue(item).toFixed(2)); }
 if (showAdjustments) { row.getCell(col++).value = Number((item.adjustments ?? 0).toFixed(2)); row.getCell(col++).value = Number(getAdjustmentValue(item).toFixed(2)); }
 if (showFinal) { row.getCell(col++).value = Number(item.finalStock.toFixed(2)); row.getCell(col++).value = Number(getFinalValue(item).toFixed(2)); }
 row.commit();
 });

 const totals = dataToExport.reduce(
 (acc, item) => ({
 initialStock: acc.initialStock + item.initialStock,
 initialValue: acc.initialValue + getInitialValue(item),
 purchases: acc.purchases + item.purchases,
 purchasesValue: acc.purchasesValue + getPurchasesValue(item),
 sales: acc.sales + item.sales,
 salesValue: acc.salesValue + getSalesValue(item),
 adjustmentsValue: acc.adjustmentsValue + getAdjustmentValue(item),
 finalStock: acc.finalStock + item.finalStock,
 finalValue: acc.finalValue + getFinalValue(item),
 }),
 { initialStock: 0, initialValue: 0, purchases: 0, purchasesValue: 0, sales: 0, salesValue: 0, adjustmentsValue: 0, finalStock: 0, finalValue: 0 }
 );
 const totalsRowIndex = dataStartRow + 1 + dataToExport.length + 1;
 const totalsRow = ws.getRow(totalsRowIndex);
 let tcol = 1;
 totalsRow.getCell(tcol++).value = 'TOTAL';
 totalsRow.getCell(tcol++).value = '';
 totalsRow.getCell(tcol++).value = '';
 totalsRow.getCell(tcol++).value = '';
 if (showInitial) { totalsRow.getCell(tcol++).value = Number(totals.initialStock.toFixed(2)); totalsRow.getCell(tcol++).value = Number(totals.initialValue.toFixed(2)); }
 if (showPurchases) { totalsRow.getCell(tcol++).value = Number(totals.purchases.toFixed(2)); totalsRow.getCell(tcol++).value = Number(totals.purchasesValue.toFixed(2)); }
 if (showSales) { totalsRow.getCell(tcol++).value = Number(totals.sales.toFixed(2)); totalsRow.getCell(tcol++).value = Number(totals.salesValue.toFixed(2)); }
 if (showAdjustments) { totalsRow.getCell(tcol++).value = ''; totalsRow.getCell(tcol++).value = Number(totals.adjustmentsValue.toFixed(2)); }
 if (showFinal) { totalsRow.getCell(tcol++).value = Number(totals.finalStock.toFixed(2)); totalsRow.getCell(tcol++).value = Number(totals.finalValue.toFixed(2)); }
 totalsRow.commit();

 const numCols = headers.length;
 const valorColumnIndices = headers.map((_, i) => i + 1).filter((_, i) => headers[i] === 'VALOR');
 const totalRowIndex = dataStartRow + 1 + dataToExport.length + 1;
 applyStockReportStyle(ws, {
 titleRow: 1,
 headerRow: dataStartRow,
 totalRow: totalRowIndex,
 valorColumnIndices,
 numCols,
 });
 const defaultWidth = 12 as const;
 const widths: number[] = headers.map((_, i) => (i === 0 ? 28 : defaultWidth));
 widths.forEach((w, i) => { if (i + 1 <= numCols) ws.getColumn(i + 1).width = w; });

 const periodLabel = selectedPeriod === 'custom' ? `${startStr}_${endStr}` : selectedPeriod;
 const filename = `produtos_stock_${periodLabel}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação para Excel concluída: ${dataToExport.length} produtos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar produtos para Excel:', error);
 showToast('Erro ao exportar produtos para Excel', 'error');
 }
 };

 // Função para exportar produtos para PDF
 const exportProductsToPDF = async (dataToExport: StockPeriodData[]) => {
 try {
 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar Informações do período e filtros
 const periodLabel = selectedPeriod === 'custom'
 ? `${formatDateOnly(start)} a ${formatDateOnly(end)}`
 : selectedPeriod === 'today' ? 'Hoje'
 : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês'
 : selectedPeriod === 'thisYear' ? 'Este Ano'
 : `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: searchQuery });
 }
 filters.push({ label: 'Variante', value: groupByVariant ? 'Sim' : 'Não' });
 filters.push({ label: 'Ver colunas', value: columnViewMode === 'final' ? 'Final' : columnViewMode === 'initial' ? 'Inicial' : columnViewMode === 'purchases' ? 'Compras' : columnViewMode === 'sales' ? 'Vendas' : columnViewMode === 'adjustments' ? 'Ajustes' : 'Todos' });
 filters.push({ label: 'Modo', value: 'Unidades e Valores' });
 filters.push({ label: 'Total de produtos', value: dataToExport.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Produtos - Análise de Stock', {
 period: periodLabel,
 filters,
 orientation: 'landscape',
 });

 const {
 showInitial: showInitialPdf,
 showPurchases: showPurchasesPdf,
 showSales: showSalesPdf,
 showAdjustments: showAdjustmentsPdf,
 showFinal: showFinalPdf
 } = getProductColumnVisibility(dataToExport);

 const colHeaders: string[] = ['NOME DO PRODUTO', 'VAR', 'UN', getUnitCostHeader()];
 if (showInitialPdf) colHeaders.push('INICIAL', 'VALOR');
 if (showPurchasesPdf) colHeaders.push('COMPRAS', 'VALOR');
 if (showSalesPdf) colHeaders.push('VENDAS', 'VALOR');
 if (showAdjustmentsPdf) colHeaders.push('AJUSTES', 'VALOR');
 if (showFinalPdf) colHeaders.push('FINAL', 'VALOR');

 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = colHeaders.map((_, i) => (i < 4 ? 1 : 0.95));
 const colWidths = calculateColumnWidths(availableWidth, colProportions);

 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 yPos = addPDFTableHeader(pdf, colHeaders, colX, yPos, margin, pdfWidth);

 const stockRowStyle = {
 fontSize: 8 as const,
 alternateColors: false,
 rowBackgroundRgb: [55, 65, 81] as [number, number, number],
 textColorRgb: [255, 255, 255] as [number, number, number],
 columnFillOverrides: [] as Array<{ colIndex: number; rgb: [number, number, number] }>,
 columnTextColorOverrides: [] as Array<{ colIndex: number; rgb: [number, number, number] }>,
 };
 colHeaders.forEach((_, i) => {
 if (colHeaders[i] === 'VALOR') {
 const prev = colHeaders[i - 1];
 if (prev === 'INICIAL' || prev === 'FINAL') {
 stockRowStyle.columnFillOverrides.push({ colIndex: i, rgb: [209, 250, 229] });
 stockRowStyle.columnTextColorOverrides.push({ colIndex: i, rgb: [0, 0, 0] });
 } else {
 stockRowStyle.columnFillOverrides.push({ colIndex: i, rgb: [252, 231, 243] });
 stockRowStyle.columnTextColorOverrides.push({ colIndex: i, rgb: [0, 0, 0] });
 }
 }
 });

 dataToExport.forEach((item, index) => {
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 yPos = addPDFTableHeader(pdf, colHeaders, colX, yPos, margin, pdfWidth);
 }

 const rowData: string[] = [
 item.productName || '',
 item.variantName || '-',
 item.unit,
 (getDisplayedUnitCost(item) ?? 0).toFixed(2),
 ];
 if (showInitialPdf) { rowData.push(item.initialStock.toFixed(2), getInitialValue(item).toFixed(2)); }
 if (showPurchasesPdf) { rowData.push(item.purchases.toFixed(2), getPurchasesValue(item).toFixed(2)); }
 if (showSalesPdf) { rowData.push(item.sales.toFixed(2), getSalesValue(item).toFixed(2)); }
 if (showAdjustmentsPdf) { rowData.push((item.adjustments ?? 0).toFixed(2), getAdjustmentValue(item).toFixed(2)); }
 if (showFinalPdf) { rowData.push(item.finalStock.toFixed(2), getFinalValue(item).toFixed(2)); }

 yPos = addPDFTableRow(pdf, rowData, colX, yPos, index, margin, pdfWidth, stockRowStyle);
 });

 const totalInitialValue = dataToExport.reduce((sum, item) => sum + getInitialValue(item), 0);
 const totalFinalValue = dataToExport.reduce((sum, item) => sum + getFinalValue(item), 0);
 const totalPurchases = dataToExport.reduce((sum, item) => sum + item.purchases, 0);
 const totalSales = dataToExport.reduce((sum, item) => sum + item.sales, 0);
 const totalPurchasesValue = dataToExport.reduce((sum, item) => sum + getPurchasesValue(item), 0);
 const totalSalesValue = dataToExport.reduce((sum, item) => sum + getSalesValue(item), 0);
 const totalAdjValue = dataToExport.reduce((sum, item) => sum + getAdjustmentValue(item), 0);

 const summaryItems: Array<{ label: string; value: string }> = [
 { label: 'Valor Final Total', value: `${totalFinalValue.toFixed(2)} MT` },
 ];
 if (showInitialPdf) summaryItems.unshift({ label: 'Valor Inicial Total', value: `${totalInitialValue.toFixed(2)} MT` });
 if (showPurchasesPdf) summaryItems.push({ label: 'Total Compras (un)', value: `${totalPurchases.toFixed(2)}` }, { label: 'Total Compras (Valor)', value: `${totalPurchasesValue.toFixed(2)} MT` });
 if (showSalesPdf) summaryItems.push({ label: 'Total Vendas (un)', value: `${totalSales.toFixed(2)}` }, { label: 'Total Vendas (Valor)', value: `${totalSalesValue.toFixed(2)} MT` });
 if (showAdjustmentsPdf) summaryItems.push({ label: 'Total Ajustes (Valor)', value: `${totalAdjValue.toFixed(2)} MT` });
 yPos = addPDFSummarySection(pdf, 'Totais', summaryItems, yPos, margin);

 // Rodapé com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Gerar nome do arquivo
 const periodLabelForFilename = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `produtos_stock_${periodLabelForFilename}_${getTodayDateString()}.pdf`;

 // Salvar PDF
 pdf.save(filename);
 showToast(`Exportação para PDF concluída: ${dataToExport.length} produtos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar produtos para PDF:', error);
 showToast('Erro ao exportar produtos para PDF', 'error');
 }
 };

 // Estados para edição/criação de movimentos (modal CreateMovementModal)
 const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
 const [isCreateMovementModalOpen, setIsCreateMovementModalOpen] = useState(false);
 
 // Estados para modal de validação de integridade
 const [isIntegrityModalOpen, setIsIntegrityModalOpen] = useState(false);
 // Recalcular stock (alinhar lista ao relatório)
 const [recalcStockInProgress, setRecalcStockInProgress] = useState(false);

 // Estados para modais de detalhes (pedido/compra a partir do movimento)
 const [detailOrder, setDetailOrder] = useState<Order | null>(null);
 const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);

 // Estados para edição inline na tabela
 const [editingCell, setEditingCell] = useState<{ productId: string; variantId?: string; field: 'initialStock' | 'finalStock' } | null>(null);
 const [editingValue, setEditingValue] = useState<string>('');
 const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

 // Ordenação - padrão: nome do produto em ordem alfabética (A-Z)
 const [sortField, setSortField] = useState<'productName' | 'variantName' | 'unit' | 'costPrice' | 'initialStock' | 'purchases' | 'sales' | 'finalStock' | 'initialValue' | 'purchasesValue' | 'salesValue' | 'finalValue'>(
 'productName' // Padrão: ordem alfabética
 );
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

 useEffect(() => {
 // Silently sync products.stock → default variant stock for existing data
 stockService.syncProductStockToVariants().catch(() => {});
 loadStockMovements();
 }, []);

 // Carregar snapshot de stock inicial quando a data do snapshot mudar
 useEffect(() => {
 let cancelled = false;
 (async () => {
 if (!stockInitialSnapshotDate) return;
 const list = await stockService.getStockInitialSnapshot(stockInitialSnapshotDate);
 if (cancelled) return;
 const map = new Map<string, number>();
 list.forEach(({ productId, variantId, quantity }) => {
 const key = `${productId}-${variantId ?? 'no-variant'}`;
 map.set(key, quantity);
 });
 setSnapshotMap(map);
 })();
 return () => { cancelled = true; };
 }, [stockInitialSnapshotDate]);

 // Ao abrir a secção "Definir stock inicial", preencher snapshotEditMap com valores actuais (snapshot + 0 para em falta)
 useEffect(() => {
 if (!showSnapshotSection || !products.length) return;
 const next = new Map(snapshotMap);
 products.forEach(product => {
 const effectiveVariants = product.variants && product.variants.length > 0
 ? product.variants
 : [{ id: `${product.id}-default`, name: product.name, isDefault: true } as ProductVariant];
 effectiveVariants.forEach(variant => {
 const key = `${product.id}-${variant.id && !String(variant.id).includes('-default') ? variant.id : 'no-variant'}`;
 if (!next.has(key)) next.set(key, 0);
 });
 });
 setSnapshotEditMap(next);
 }, [showSnapshotSection, products, snapshotMap]);

 const loadStockMovements = async () => {
 try {
 const [movements, adjustments] = await Promise.all([
 stockService.getStockMovements(),
 stockAdjustmentService.getAdjustments()
 ]);
 setStockMovements(movements);
 setStockAdjustments(adjustments);
 const movementIds = movements.map(m => m.id);
 const costsMap = await stockService.getTransactionCostsForMovements(movementIds);
 setTransactionCostsMap(costsMap);
 } catch (error) {
 console.error('Erro ao carregar movimentos de stock:', error);
 showToast('Erro ao carregar movimentos de stock', 'error');
 }
 };

 const handleRecalculateStock = async () => {
 if (recalcStockInProgress) return;
 const msg = 'Alinhar o stock da lista de produtos ao relatório (snapshot + movimentos)? As quantidades em product_variants serão atualizadas.';
 if (!confirm(msg)) return;
 setRecalcStockInProgress(true);
 try {
 const result = await stockIntegrityService.fixStockDiscrepancies(
 false,
 (stage, current, total, message) => {
 if (message) showToast(message, 'info', 2000);
 }
 );
 if (result.errors.length > 0) {
 showToast(`${result.fixed} corrigidos; ${result.errors.length} erro(s): ${result.errors.slice(0, 2).join(', ')}`, result.fixed > 0 ? 'warning' : 'error');
 } else if (result.fixed > 0) {
 showToast(`Stock recalculado: ${result.fixed} variante(s) alinhadas ao relatório.`, 'success');
 } else {
 showToast('Nenhuma discrepância encontrada.', 'info');
 }
 } catch (e: any) {
 showToast(e?.message || 'Erro ao recalcular stock', 'error');
 } finally {
 setRecalcStockInProgress(false);
 }
 };

 const handleSaveMovementFromModal = async (movement: StockMovement) => {
 setLoading(true);
 try {
 if (editingMovement) {
 const success = await stockService.updateStockMovement(movement.id, movement);
 if (success) {
 showToast('Movimento atualizado com sucesso', 'success');
 await loadStockMovements();
 setIsCreateMovementModalOpen(false);
 setEditingMovement(null);
 } else {
 showToast('Erro ao atualizar movimento', 'error');
 }
 } else {
 const result = await stockService.createStockMovement(movement);
 if (result.stockMovement) {
 showToast('Movimento criado com sucesso', 'success');
 await loadStockMovements();
 setIsCreateMovementModalOpen(false);
 setEditingMovement(null);
 } else {
 showToast('Erro ao criar movimento', 'error');
 }
 }
 } catch (error) {
 console.error('Erro ao salvar movimento:', error);
 showToast('Erro ao salvar movimento', 'error');
 } finally {
 setLoading(false);
 }
 };

 const handleSaveStockInitialSnapshot = async () => {
 if (!stockInitialSnapshotDate) return;
 setSnapshotSaving(true);
 try {
 const items: { productId: string; variantId?: string | null; quantity: number }[] = [];
 products.forEach(product => {
 const effectiveVariants = product.variants && product.variants.length > 0
 ? product.variants
 : [{ id: `${product.id}-default`, name: product.name, isDefault: true } as ProductVariant];
 effectiveVariants.forEach(variant => {
 const key = `${product.id}-${variant.id && !String(variant.id).includes('-default') ? variant.id : 'no-variant'}`;
 const quantity = snapshotEditMap.get(key) ?? 0;
 items.push({
 productId: product.id,
 variantId: variant.id && String(variant.id).includes('-default') ? null : variant.id,
 quantity
 });
 });
 });
 const result = await stockService.saveStockInitialSnapshot(stockInitialSnapshotDate, items);
 if (result.success) {
 const list = await stockService.getStockInitialSnapshot(stockInitialSnapshotDate);
 const map = new Map<string, number>();
 list.forEach(({ productId, variantId, quantity }) => {
 map.set(`${productId}-${variantId ?? 'no-variant'}`, quantity);
 });
 setSnapshotMap(map);
 setSnapshotEditMap(map);
 showToast('Stock inicial guardado com sucesso', 'success');
 } else {
 showToast(result.error || 'Erro ao guardar stock inicial', 'error');
 }
 } catch (error) {
 console.error('Erro ao guardar stock inicial:', error);
 showToast('Erro ao guardar stock inicial', 'error');
 } finally {
 setSnapshotSaving(false);
 }
 };

 const handleSaveStockInitialSnapshotRow = async (key: string, productId: string, variantId: string | null, quantity: number) => {
 if (!stockInitialSnapshotDate) return;
 setSavingRowKey(key);
 try {
 const result = await stockService.saveStockInitialSnapshotItem(stockInitialSnapshotDate, {
 productId,
 variantId: variantId && !String(variantId).includes('-default') ? variantId : null,
 quantity
 });
 if (result.success) {
 setSnapshotMap(prev => { const next = new Map(prev); next.set(key, quantity); return next; });
 setSnapshotEditMap(prev => { const next = new Map(prev); next.set(key, quantity); return next; });
 showToast('Stock inicial guardado para esta linha', 'success');
 } else {
 showToast(result.error || 'Erro ao guardar', 'error');
 }
 } catch (error) {
 console.error('Erro ao guardar stock inicial (linha):', error);
 showToast('Erro ao guardar stock inicial', 'error');
 } finally {
 setSavingRowKey(null);
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

 /** Chave canónica produto+variante para que "Pato Normal"+1.6kg e "Pato Normal 1.6kg"+1.6kg deem a mesma chave. */
 const getCanonicalProductKey = (
 item: { productId?: string; productName?: string; variant?: string; unit?: string },
 productsList: Product[],
 byVariant: boolean
 ): { canonicalKey: string; productBaseName: string; variant: string } => {
 const name = (item.productName || '').trim();
 const itemVariant = (item.variant || '').trim();
 const unit = (item.unit || 'un').trim();
 const product = productsList.find(
 p =>
 (item.productId && p.id === item.productId) ||
 (name && p.name && p.name.toLowerCase().trim() === name.toLowerCase()) ||
 (name && p.name && name.toLowerCase().startsWith(p.name.toLowerCase().trim())) ||
 (name && p.name && p.name.toLowerCase().startsWith(name.toLowerCase()))
 );
 let productBaseName: string;
 let variant: string;
 if (product) {
 productBaseName = product.name;
 variant = itemVariant && itemVariant !== '-' ? itemVariant : (parseProductName(name).variant ?? '-');
 } else {
 const parsed = parseProductName(name);
 productBaseName = parsed.baseName || name;
 variant = itemVariant && itemVariant !== '-' ? itemVariant : (parsed.variant ?? '-');
 }
 const canonicalKey = byVariant ? `${productBaseName}-${variant}-${unit}` : `${productBaseName}-${unit}`;
 return { canonicalKey, productBaseName, variant };
 };

 /** Resolve pedido ligado ao movimento (saída) via sourceReference. */
 const getLinkedOrder = (movement: StockMovement): Order | null => {
 const refType = movement.sourceReference?.type as string | undefined;
 if (refType === 'order' && movement.sourceReference?.id) {
 const order = orders.find(o => o.id === movement.sourceReference!.id);
 return order ?? null;
 }
 return null;
 };

 /** Resolve compra ligada ao movimento (entrada): sourceReference ou número de fatura nas notas. */
 const getLinkedPurchase = (movement: StockMovement): Purchase | null => {
 const refType = movement.sourceReference?.type as string | undefined;
 if (refType === 'purchase' && movement.sourceReference?.id) {
 const purchase = purchases.find(p => p.id === movement.sourceReference!.id);
 return purchase ?? null;
 }
 const notes = movement.notes || '';
 const fatMatch = notes.match(/FAT-[\d\-]+/i);
 if (fatMatch) {
 const invoiceNumber = fatMatch[0].trim();
 const purchase = purchases.find(p => p.invoiceNumber === invoiceNumber);
 return purchase ?? null;
 }
 return null;
 };

 const formatMoney = (value: number) => {
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 // Helper para verificar se um pedido está concluído
 const isOrderCompleted = (order: Order): boolean => {
 return order.status === OrderStatus.COMPLETED ||
 (typeof order.status === 'string' && (
 order.status.toLowerCase() === 'entregue' ||
 order.status.toLowerCase() === 'concluído' ||
 order.status.toLowerCase() === 'completed' ||
 order.status.toLowerCase() === 'delivered'
 ));
 };

 // Helper para verificar matching de variante em itens de StockMovement
 const matchesVariantForItem = (
 itemVariantId: string | undefined,
 itemVariantName: string | undefined,
 searchVariantId: string | undefined,
 searchVariantName: string | undefined
 ): boolean => {
 if (searchVariantId && searchVariantName) {
 if (itemVariantName === searchVariantName) return true;
 if (itemVariantName && searchVariantName) {
 const itemNorm = itemVariantName.toLowerCase().trim().replace(/\s+/g, '');
 const searchNorm = searchVariantName.toLowerCase().trim().replace(/\s+/g, '');
 return itemNorm === searchNorm || itemNorm.includes(searchNorm) || searchNorm.includes(itemNorm);
 }
 } else if (searchVariantId && searchVariantId.includes('-default')) {
 return !itemVariantName;
 } else {
 return !itemVariantName;
 }
 return false;
 };

 // Helper para encontrar StockMovement base antes de uma data específica
 const findBaseStockMovement = (
 productId: string,
 variantId: string | undefined,
 variantName: string | undefined,
 beforeDate: Date
 ): { date: Date; quantity: number } | null => {
 let baseMovement: { date: Date; quantity: number } | null = null;
 const normalizedBeforeDate = normalizeDateStart(beforeDate);

 stockMovements.forEach(movement => {
 const movementDate = new Date(movement.date);
 const normalizedMovementDate = normalizeDateStart(movementDate);

 // Se a atualização é ANTES da data especificada
 if (normalizedMovementDate < normalizedBeforeDate) {
 movement.items.forEach(item => {
 const itemProductId = item.productId;
 const itemProductName = item.productName || '';

 // Verificar se corresponde ao produto
 if (itemProductId === productId ||
 itemProductName.toLowerCase().trim() === productId.toLowerCase().trim()) {

 // Verificar variante
 let variantMatches = false;
 if (variantId && variantName) {
 if (item.variant === variantName) {
 variantMatches = true;
 } else if (item.variant && variantName) {
 const itemVariantNormalized = item.variant.toLowerCase().trim().replace(/\s+/g, '');
 const searchVariantNormalized = variantName.toLowerCase().trim().replace(/\s+/g, '');
 variantMatches = itemVariantNormalized === searchVariantNormalized ||
 itemVariantNormalized.includes(searchVariantNormalized) ||
 searchVariantNormalized.includes(itemVariantNormalized);
 }
 } else if (variantId && variantId.includes('-default')) {
 variantMatches = !item.variant;
 } else {
 variantMatches = !item.variant;
 }

 if (variantMatches) {
 // Guardar o mais recente antes da data
 if (!baseMovement || movementDate > baseMovement.date) {
 baseMovement = { date: movementDate, quantity: item.quantity };
 }
 }
 }
 });
 }
 });

 return baseMovement;
 };

 // Helper para verificar se uma variante corresponde
 const matchesVariant = (
 itemVariantId: string | undefined,
 itemVariantName: string | undefined,
 searchVariantId: string | undefined,
 searchVariantName: string | undefined
 ): boolean => {
 if (searchVariantId && searchVariantName) {
 // Procurando por variante específica
 if (itemVariantId === searchVariantId) {
 return true;
 }
 if (itemVariantName && searchVariantName) {
 const itemNormalized = itemVariantName.toLowerCase().trim().replace(/\s+/g, '');
 const searchNormalized = searchVariantName.toLowerCase().trim().replace(/\s+/g, '');
 // Comparaçéo exata ou parcial
 return itemNormalized === searchNormalized ||
 itemNormalized.includes(searchNormalized) ||
 searchNormalized.includes(itemNormalized);
 }
 return false;
 } else {
 // Procurando por produto base (sem variante)
 return !itemVariantId && !itemVariantName;
 }
 };

 const getDateRange = (): { start: Date; end: Date } => {
 const today = new Date();
 const normalizedToday = normalizeDateStart(today);
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
 case 'thisWeek': {
 // Segunda-feira da semana atual
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajustar para segunda-feira
 const weekStart = new Date(today);
 weekStart.setDate(diff);
 start = normalizeDateStart(weekStart);
 end = normalizeDateEnd(today);
 break;
 }
 case 'lastWeek': {
 // Segunda-feira da semana passada
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7; // Semana passada
 const weekStart = new Date(today);
 weekStart.setDate(diff);
 start = normalizeDateStart(weekStart);
 // Domingo da semana passada
 const weekEnd = new Date(weekStart);
 weekEnd.setDate(weekStart.getDate() + 6);
 end = normalizeDateEnd(weekEnd);
 break;
 }
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
 const normalizedLastDayOfMonth = normalizeDateStart(lastDayOfMonth);
 // Se o fim do período é no futuro e não há movimentos futuros, limitar até hoje
 if (normalizedLastDayOfMonth > normalizedToday) {
 // Verificar se há movimentos após hoje
 const hasFutureMovements = stockMovements.some(m => {
 const movementDate = normalizeDateStart(new Date(m.date));
 return movementDate > normalizedToday;
 });
 end = hasFutureMovements ? normalizeDateEnd(lastDayOfMonth) : normalizeDateEnd(today);
 } else {
 end = normalizeDateEnd(lastDayOfMonth);
 }
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
 const normalizedLastDayOfYear = normalizeDateStart(lastDayOfYear);
 // Se o fim do período é no futuro e não há movimentos futuros, limitar até hoje
 if (normalizedLastDayOfYear > normalizedToday) {
 // Verificar se há movimentos após hoje
 const hasFutureMovements = stockMovements.some(m => {
 const movementDate = normalizeDateStart(new Date(m.date));
 return movementDate > normalizedToday;
 });
 end = hasFutureMovements ? normalizeDateEnd(lastDayOfYear) : normalizeDateEnd(today);
 } else {
 end = normalizeDateEnd(lastDayOfYear);
 }
 break;
 case 'lastYear':
 start = new Date(today.getFullYear() - 1, 0, 1);
 start = normalizeDateStart(start);
 const lastDayOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
 end = normalizeDateEnd(lastDayOfLastYear);
 break;
 case 'all':
 // Sem filtro - retornar datas muito antigas e futuras
 start = normalizeDateStart(new Date(1900, 0, 1));
 end = normalizeDateEnd(new Date(2100, 11, 31));
 break;
 case 'custom':
 if (customStartDate && customEndDate) {
 start = normalizeDateStart(new Date(customStartDate));
 const customEnd = normalizeDateEnd(new Date(customEndDate));
 const normalizedCustomEnd = normalizeDateStart(new Date(customEndDate));
 // Se o fim do período customizado é no futuro e não há movimentos futuros, limitar até hoje
 if (normalizedCustomEnd > normalizedToday) {
 const hasFutureMovements = stockMovements.some(m => {
 const movementDate = normalizeDateStart(new Date(m.date));
 return movementDate > normalizedToday;
 });
 end = hasFutureMovements ? customEnd : normalizeDateEnd(today);
 } else {
 end = customEnd;
 }
 } else {
 start = normalizeDateStart(today);
 end = normalizeDateEnd(today);
 }
 break;
 }

 return { start, end };
 };

 const handleSaveInlineFinalStock = async (item: StockPeriodData, newValue: number) => {
 if (isSavingAdjustment) return;
 const delta = newValue - item.finalStock;
 if (delta === 0) {
 setEditingCell(null);
 setEditingValue('');
 return;
 }
 setIsSavingAdjustment(true);
 try {
 const { end } = getDateRange();
 const endDate = toDateStringInTimezone(end);
 const result = await stockAdjustmentService.createAdjustment({
 productId: item.productId,
 productName: item.productName,
 variantId: item.variantId,
 variantName: item.variantName,
 quantity: delta,
 reason: StockAdjustmentReason.CORRECTION,
 notes: 'Ajuste directo na tabela (período seleccionado)',
 date: endDate,
 createdBy: currentUser?.id
 });
 if (result.adjustment) {
 setRefreshKey(k => k + 1);
 setEditingCell(null);
 setEditingValue('');
 showToast('Ajuste guardado com sucesso', 'success');
 await loadStockMovements();
 } else {
 showToast(result.error || 'Erro ao guardar ajuste', 'error');
 }
 } catch (e: any) {
 showToast(e?.message || 'Erro ao guardar ajuste', 'error');
 } finally {
 setIsSavingAdjustment(false);
 }
 };

 const handleCancelInlineEdit = () => {
 setEditingCell(null);
 setEditingValue('');
 };

 // Calcular stock final de um período específico (até uma data final)
 // allowNegative: quando true (ex.: stock inicial do período), devolve o saldo real para relatórios consistentes
 const calculateStockUpToDate = (product: Product, variantId: string | undefined, variantName: string | undefined, endDate: Date, allowNegative = false): number => {
 // Data do snapshot de stock inicial (ex.: 01/01/2026)
 const snapshotDate = stockInitialSnapshotDate ? new Date(stockInitialSnapshotDate) : null;
 if (snapshotDate) snapshotDate.setHours(0, 0, 0, 0);

 // Processar todos os movimentos até a data final (exclusive)
 const normalizedEndDate = normalizeDateStart(endDate);

 // Determinar a chave do snapshot para este produto/variante
 const realVariantId = variantId && !variantId.includes('-default') ? variantId : null;
 const snapshotKey = `${product.id}-${realVariantId ?? 'no-variant'}`;

 // Obter stock inicial do snapshot se a data final for após o snapshot
 let stock = 0;
 let startFromSnapshot = false;

 if (snapshotDate && snapshotMap.has(snapshotKey)) {
 // Se o endDate é depois ou igual a data do snapshot, usar o snapshot como base
 if (normalizedEndDate >= snapshotDate) {
 stock = snapshotMap.get(snapshotKey) || 0;
 startFromSnapshot = true;
 }
 }

 // Verificar se há movimentos disponíveis
 if (!stockMovements || stockMovements.length === 0) {
 return allowNegative ? stock : Math.max(0, stock);
 }

 // Variável para ignorar movimentos antes do snapshot
 const ignoreBeforeSnapshot = startFromSnapshot;

 // Debug desactivado
 if (false) {
 console.log(`[calculateStockUpToDate] âš ï¸ Nenhum movimento disponível para calcular stock até ${toDateStringInTimezone(normalizedEndDate)}`);
 return 0;
 }

 stockMovements.forEach(movement => {
 const movementDate = new Date(movement.date);
 const normalizedMovementDate = normalizeDateStart(movementDate);

 // Se estamos a usar snapshot, ignorar movimentos antes ou na data do snapshot
 if (ignoreBeforeSnapshot && snapshotDate && normalizedMovementDate <= snapshotDate) {
 return;
 }

 // Apenas movimentos antes do inicio do periodo actual
 if (normalizedMovementDate < normalizedEndDate) {
 const notes = movement.notes?.toLowerCase() || '';
 const isFromPurchase = notes.includes('compra') || notes.includes('entrada de stock via compra');
 const isFromOrder = notes.includes('pedido') || notes.includes('saída de stock via pedido');

 // Verificar se é movimento de saída anterior é  data base
 // Apenas processar movimentos de compras ou pedidos (ignorar ajustes manuais)
 if (isFromPurchase || isFromOrder) {

 if (!movement.items || movement.items.length === 0) {
 console.log(`[calculateStockUpToDate] âš ï¸ Movimento ${movement.date} não tem itens`);
 return;
 }

 movement.items.forEach(item => {
 // Verificar correspondência do produto (por ID ou nome)
 const productMatches = item.productId === product.id ||
 (item.productName && product.name &&
 item.productName.toLowerCase().trim() === product.name.toLowerCase().trim());

 if (productMatches) {
 let variantMatches = false;

 // Se temos variantId e variantName, tentar fazer match
 if (variantId && variantName) {
 // Match exato
 if (item.variant === variantName) {
 variantMatches = true;
 } else if (item.variant && variantName) {
 // Match normalizado (remover espaços e caracteres especiais)
 const itemVariantNormalized = item.variant.toLowerCase().trim().replace(/\s+/g, '');
 const searchVariantNormalized = variantName.toLowerCase().trim().replace(/\s+/g, '');
 variantMatches = itemVariantNormalized === searchVariantNormalized ||
 itemVariantNormalized.includes(searchVariantNormalized) ||
 searchVariantNormalized.includes(itemVariantNormalized);
 }
 } else if (variantId && variantId.includes('-default')) {
 // Variante virtual - produto sem variantes, item também não deve ter variante
 variantMatches = !item.variant || item.variant === '';
 } else {
 // Sem variante específica
 variantMatches = !item.variant || item.variant === '';
 }

 if (variantMatches) {
 // item.quantity pode ser positivo (entrada/compra) ou negativo (saida/venda)
 stock += item.quantity;
 }
 }
 });
 }
 }
 });

 const finalStock = allowNegative ? stock : Math.max(0, stock);
 console.log(`[calculateStockUpToDate] ðŸ“Š Resumo: ${movementsProcessed} movimentos processados, ${itemsMatched} itens correspondidos, stock final: ${finalStock} para ${product.name}${variantName ? ` (${variantName})` : ''}`);
 return finalStock;
 };

 // Calcular stock inicial (no início do período)
 // O stock inicial do período atual é o stock final do período anterior
 const calculateInitialStock = (product: Product, variantId?: string, variantName?: string): number => {
 const { start } = getDateRange();

 console.log(`[calculateInitialStock] Calculando stock inicial para período que começa em ${toDateStringInTimezone(start)}`);
 console.log(`[calculateInitialStock] Produto: ${product.name}${variantName ? ` (${variantName})` : ''}`);

 // Calcular stock final até o início do período atual (ou seja, stock final do período anterior)
 // allowNegative: true para mostrar valores reais no relatório por período (evita stock inicial 0 artificial)
 const initialStock = calculateStockUpToDate(product, variantId, variantName, start, true);
 console.log(`[calculateInitialStock] Stock inicial calculado: ${initialStock}`);
 return initialStock;
 };

 // Calcular compras no período
 const calculatePurchases = (product: Product, variantId?: string, variantName?: string): { quantity: number; value: number } => {
 // Usar movimentos em vez de purchases
 return calculatePurchasesFromMovements(product, variantId, variantName);
 };

 // Calcular compras a partir dos movimentos
 const calculatePurchasesFromMovements = (product: Product, variantId?: string, variantName?: string): { quantity: number; value: number } => {
 const { start, end } = getDateRange();
 let quantity = 0;
 let value = 0;

 stockMovements.forEach(movement => {
 const movementDate = new Date(movement.date);
 const normalizedMovementDate = normalizeDateStart(movementDate);
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);

 if (normalizedMovementDate >= normalizedStart && normalizedMovementDate <= normalizedEnd) {
 // Apenas movimentos de entrada (quantidade > 0)
 const notes = movement.notes?.toLowerCase() || '';
 const isEntry = notes.includes('compra') || notes.includes('entrada');

 if (isEntry) {
 movement.items.forEach(item => {
 const productMatches = item.productId === product.id ||
 item.productName?.toLowerCase().trim() === product.name.toLowerCase().trim();

 if (productMatches && item.quantity > 0) {
 let variantMatches = false;
 if (variantId && variantName) {
 if (item.variant === variantName) {
 variantMatches = true;
 } else if (item.variant && variantName) {
 const itemVariantNormalized = item.variant.toLowerCase().trim().replace(/\s+/g, '');
 const searchVariantNormalized = variantName.toLowerCase().trim().replace(/\s+/g, '');
 variantMatches = itemVariantNormalized === searchVariantNormalized ||
 itemVariantNormalized.includes(searchVariantNormalized) ||
 searchVariantNormalized.includes(itemVariantNormalized);
 }
 } else if (variantId && variantId.includes('-default')) {
 variantMatches = !item.variant;
 } else {
 variantMatches = !item.variant;
 }

 if (variantMatches) {
 quantity += Math.abs(item.quantity);
 // Buscar produto para obter costPrice
 const productForPrice = products.find(p => p.id === product.id);
 const costPrice = productForPrice?.costPrice || 0;
 value += costPrice * Math.abs(item.quantity);
 }
 }
 });
 }
 }
 });

 return { quantity, value };
 };

 // Calcular vendas a partir dos movimentos
 const calculateSalesFromMovements = (product: Product, variantId?: string, variantName?: string): { quantity: number; value: number } => {
 const { start, end } = getDateRange();
 let quantity = 0;
 let value = 0;

 stockMovements.forEach(movement => {
 const movementDate = new Date(movement.date);
 const normalizedMovementDate = normalizeDateStart(movementDate);
 const normalizedStart = normalizeDateStart(start);
 const normalizedEnd = normalizeDateEnd(end);

 if (normalizedMovementDate >= normalizedStart && normalizedMovementDate <= normalizedEnd) {
 // Apenas movimentos de saída (quantidade < 0)
 const notes = movement.notes?.toLowerCase() || '';
 const isExit = notes.includes('pedido') || notes.includes('saída');

 if (isExit) {
 movement.items.forEach(item => {
 const productMatches = item.productId === product.id ||
 item.productName?.toLowerCase().trim() === product.name.toLowerCase().trim();

 if (productMatches && item.quantity < 0) {
 let variantMatches = false;
 if (variantId && variantName) {
 if (item.variant === variantName) {
 variantMatches = true;
 } else if (item.variant && variantName) {
 const itemVariantNormalized = item.variant.toLowerCase().trim().replace(/\s+/g, '');
 const searchVariantNormalized = variantName.toLowerCase().trim().replace(/\s+/g, '');
 variantMatches = itemVariantNormalized === searchVariantNormalized ||
 itemVariantNormalized.includes(searchVariantNormalized) ||
 searchVariantNormalized.includes(itemVariantNormalized);
 }
 } else if (variantId && variantId.includes('-default')) {
 variantMatches = !item.variant;
 } else {
 variantMatches = !item.variant;
 }

 if (variantMatches) {
 quantity += Math.abs(item.quantity);
 // Buscar produto para obter price
 const productForPrice = products.find(p => p.id === product.id);
 const price = productForPrice?.price || 0;
 value += price * Math.abs(item.quantity);
 }
 }
 });
 }
 }
 });

 return { quantity, value };
 };

 // Calcular vendas no período (mantida para compatibilidade, mas não usada)
 const calculateSales = (product: Product, variantId?: string, variantName?: string): { quantity: number; value: number } => {
 // Usar movimentos em vez de orders
 return calculateSalesFromMovements(product, variantId, variantName);
 };

 // Calcular stock final (no fim do período)
 const calculateFinalStock = (initialStock: number, purchases: number, sales: number): number => {
 return Math.max(0, initialStock + purchases - sales);
 };

 // Calcular valor do stock (custo)
 const calculateStockValue = (quantity: number, product: Product, variantId?: string, variantName?: string): number => {
 let costPrice = 0;

 if (variantId && variantId.includes('-default')) {
 // Variante virtual - usar costPrice do produto base
 costPrice = product.costPrice || 0;
 } else if (variantId && product.variants && product.variants.length > 0) {
 const variant = product.variants.find(v => v.id === variantId || v.name === variantName);
 costPrice = variant?.costPrice || product.costPrice || 0;
 } else {
 costPrice = product.costPrice || 0;
 }

 return quantity * costPrice;
 };

 /** Chave para lookup no snapshot: productId + variantId (uuid) ou 'no-variant' para produto sem variantes. */
 const getSnapshotKey = (productId: string, variantId?: string | null): string => {
 if (!variantId || variantId.includes('-default')) return `${productId}-no-variant`;
 return `${productId}-${variantId}`;
 };

 /** Formata data em YYYY-MM-DD usando hora local (evita bug de timezone com toISOString). */
 const formatDateLocal = (date: Date): string => {
 const y = date.getFullYear();
 const m = String(date.getMonth() + 1).padStart(2, '0');
 const d = String(date.getDate()).padStart(2, '0');
 return `${y}-${m}-${d}`;
 };

 // Buscar dados do período via API (get_stock_period_summary)
 useEffect(() => {
 let cancelled = false;
 setPeriodDataReady(false);
 const loadFromApi = async () => {
 const { start, end } = getDateRange();
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
 setPeriodLoading(true);
 try {
 const snapshotDate = stockInitialSnapshotDate?.trim() || getStockSnapshotDate();
 const rows = await stockReportService.getStockPeriodSummary(
 startStr,
 endStr,
 snapshotDate,
 includeZeroStock
 );
 if (cancelled) return;
 const mapped: StockPeriodData[] = rows.map(r => ({
 productId: r.productId,
 productName: r.productName,
 variantId: r.variantId,
 variantName: r.variantName,
 unit: r.unit,
 initialStock: r.initialStock,
 purchases: r.purchases,
 sales: r.sales,
 adjustments: r.adjustments,
 finalStock: r.finalStock,
 costPrice: r.costPrice,
 initialValue: r.initialValue,
 purchasesValue: r.purchasesValue,
 salesValue: r.salesValue,
 finalValue: r.finalValue,
 profit: r.profit
 }));
 setPeriodData(mapped);
 setPeriodDataReady(true);
 } catch (e) {
 if (!cancelled) {
 setPeriodData([]);
 setPeriodDataReady(false);
 }
 } finally {
 if (!cancelled) setPeriodLoading(false);
 }
 };
 loadFromApi();
 return () => { cancelled = true; };
 }, [selectedPeriod, customStartDate, customEndDate, stockInitialSnapshotDate, refreshKey, includeZeroStock]);

 // Dados efectivos: sempre da API quando carregados; durante loading usa array vazio
 const effectivePeriodData = useMemo((): StockPeriodData[] => {
 if (periodDataReady && !periodLoading) {
 const apiData = periodData;
 if (groupByVariant) return apiData;
 // Agregar por produto quando groupByVariant é false
 const byProduct = new Map<string, StockPeriodData>();
 for (const row of apiData) {
 const key = row.productId;
 const existing = byProduct.get(key);
 if (!existing) {
 byProduct.set(key, { ...row, variantId: undefined, variantName: undefined });
 } else {
 existing.initialStock += row.initialStock;
 existing.purchases += row.purchases;
 existing.sales += row.sales;
 existing.adjustments = (existing.adjustments ?? 0) + (row.adjustments ?? 0);
 existing.finalStock += row.finalStock;
 existing.initialValue += row.initialValue;
 existing.purchasesValue += row.purchasesValue;
 existing.salesValue += row.salesValue;
 existing.finalValue += row.finalValue;
 existing.profit += row.profit;
 existing.costPrice = undefined;
 }
 }
 return Array.from(byProduct.values()).filter(item =>
 includeZeroStock
 || (
 item.initialStock > 0
 || item.purchases > 0
 || item.sales > 0
 || item.finalStock !== 0
 || (item.adjustments !== undefined && item.adjustments !== 0)
 )
 );
 }
 return [];
 }, [periodLoading, periodData, periodDataReady, groupByVariant, includeZeroStock]);

 // Filtrar por pesquisa e filtros compartilhados
 const filteredData = useMemo(() => {
 let filtered = effectivePeriodData;

 // Filtro por pesquisa
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filtered = filtered.filter(item =>
 normalizeForSearch(item.productName).includes(query) ||
 (item.variantName && normalizeForSearch(item.variantName).includes(query))
 );
 }


 // Filtro por tipo (entrada/saída) - mostrar apenas produtos com movimentos do tipo selecionado
 if (filterType !== 'all') {
 filtered = filtered.filter(item => {
 // Verificar se o produto tem compras (entradas) ou vendas (saídas) no período
 if (filterType === 'entry') {
 // Mostrar apenas produtos com compras (entradas)
 return item.purchases > 0;
 } else if (filterType === 'exit') {
 // Mostrar apenas produtos com vendas (saídas)
 return item.sales > 0;
 }
 return true;
 });
 }

 return filtered;
 }, [effectivePeriodData, searchQuery, filterType]);

 // Ordenar dados filtrados
 const sortedData = useMemo(() => {
 const sorted = [...filteredData];

 sorted.sort((a, b) => {
 let aValue: number | string = 0;
 let bValue: number | string = 0;

 switch (sortField) {
 case 'productName':
 aValue = a.productName.toLowerCase();
 bValue = b.productName.toLowerCase();
 break;
 case 'variantName':
 aValue = (a.variantName || '').toLowerCase();
 bValue = (b.variantName || '').toLowerCase();
 break;
 case 'unit':
 aValue = (a.unit || '').toLowerCase();
 bValue = (b.unit || '').toLowerCase();
 break;
 case 'costPrice':
 aValue = getDisplayedUnitCost(a) ?? 0;
 bValue = getDisplayedUnitCost(b) ?? 0;
 break;
 case 'initialStock':
 aValue = a.initialStock;
 bValue = b.initialStock;
 break;
 case 'purchases':
 aValue = a.purchases;
 bValue = b.purchases;
 break;
 case 'sales':
 aValue = a.sales;
 bValue = b.sales;
 break;
 case 'finalStock':
 aValue = a.finalStock;
 bValue = b.finalStock;
 break;
 case 'initialValue':
 aValue = getInitialValue(a);
 bValue = getInitialValue(b);
 break;
 case 'purchasesValue':
 aValue = getPurchasesValue(a);
 bValue = getPurchasesValue(b);
 break;
 case 'salesValue':
 aValue = getSalesValue(a);
 bValue = getSalesValue(b);
 break;
 case 'finalValue':
 aValue = getFinalValue(a);
 bValue = getFinalValue(b);
 break;
 default:
 aValue = a.finalStock;
 bValue = b.finalStock;
 }

 if (typeof aValue === 'string' && typeof bValue === 'string') {
 return sortDirection === 'asc'
 ? aValue.localeCompare(bValue)
 : bValue.localeCompare(aValue);
 } else {
 return sortDirection === 'asc'
 ? (aValue as number) - (bValue as number)
 : (bValue as number) - (aValue as number);
 }
 });

 return sorted;
 }, [filteredData, sortField, sortDirection]);

 // Dados paginados
 const paginatedData = useMemo(() => {
 const startIndex = (currentPage - 1) * itemsPerPage;
 const endIndex = startIndex + itemsPerPage;
 return sortedData.slice(startIndex, endIndex);
 }, [sortedData, currentPage, itemsPerPage]);

 // Total de páginas
 const totalPages = Math.ceil(sortedData.length / itemsPerPage);

 // Nota: Ordenação padrão é por nome do produto (A-Z) - definido no useState inicial
 // Não alteramos automaticamente ao mudar viewMode para manter consistência

 // Handler para ordenação
 const handleSort = (field: typeof sortField) => {
 if (sortField === field) {
 // Se já está ordenando por este campo, inverte a direção
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 // Se é um novo campo, define como decrescente por padrão
 setSortField(field);
 setSortDirection('desc');
 }
 };

 // Totais exibidos na vista Produtos: soma de periodData (filteredData).
 // Fonte: compras e vendas reconciliadas (purchases e orders), alinhadas com as páginas Compras e Vendas por produto.
 // Regra: custo unitario unico em todas as colunas (inicial, compras, vendas, final).
 function getEffectiveUnitCost(item: StockPeriodData): number {
 if (item.costPrice != null && Number.isFinite(item.costPrice) && item.costPrice > 0) return item.costPrice;
 if (item.finalStock !== 0) return item.finalValue / item.finalStock;
 if (item.initialStock > 0) return item.initialValue / item.initialStock;
 if (item.sales > 0) return item.salesValue / item.sales;
 if (item.purchases > 0) return item.purchasesValue / item.purchases;
 return 0;
 }

 function getDisplayedUnitCost(item: StockPeriodData): number | undefined {
 return getEffectiveUnitCost(item);
 }
 function getInitialValue(item: StockPeriodData): number {
 return item.initialStock * getEffectiveUnitCost(item);
 }
 function getPurchasesValue(item: StockPeriodData): number {
 return item.purchases * getEffectiveUnitCost(item);
 }
 function getSalesValue(item: StockPeriodData): number {
 return item.sales * getEffectiveUnitCost(item);
 }
 function getAdjustmentValue(item: StockPeriodData): number {
 return (item.adjustments ?? 0) * getEffectiveUnitCost(item);
 }
 function getFinalValue(item: StockPeriodData): number {
 return item.finalStock * getEffectiveUnitCost(item);
 }

 function getUnitCostHeader(): string {
 return 'CUSTO UNIT.';
 }

 function getProductColumnVisibility(data: StockPeriodData[]) {
 const hasPurchases = data.some(item => item.purchases !== 0);
 const hasSales = data.some(item => item.sales !== 0);
 const hasAdjustments = data.some(item => (item.adjustments ?? 0) !== 0 || getAdjustmentValue(item) !== 0);
 const compactAllView = columnViewMode === 'all' && !includeZeroStock;

 return {
 showInitial: columnViewMode === 'all' || columnViewMode === 'initial',
 showPurchases: columnViewMode === 'purchases' || (columnViewMode === 'all' && (!compactAllView || hasPurchases)),
 showSales: columnViewMode === 'sales' || (columnViewMode === 'all' && (!compactAllView || hasSales)),
 showAdjustments: columnViewMode === 'adjustments' || (columnViewMode === 'all' && (!compactAllView || hasAdjustments)),
 showFinal: columnViewMode === 'all' || columnViewMode === 'final',
 compactAllView,
 };
 }

 const totals = useMemo(() => {
 return filteredData.reduce((acc, item) => {
 const adj = item.adjustments ?? 0;
 return {
 initialStock: acc.initialStock + item.initialStock,
 purchases: acc.purchases + item.purchases,
 sales: acc.sales + item.sales,
 adjustments: acc.adjustments + adj,
 adjustmentsValue: acc.adjustmentsValue + getAdjustmentValue(item),
 finalStock: acc.finalStock + item.finalStock,
 initialValue: acc.initialValue + getInitialValue(item),
 purchasesValue: acc.purchasesValue + getPurchasesValue(item),
 salesValue: acc.salesValue + getSalesValue(item),
 finalValue: acc.finalValue + getFinalValue(item),
 profit: acc.profit + item.profit
 };
 }, {
 initialStock: 0,
 purchases: 0,
 sales: 0,
 adjustments: 0,
 adjustmentsValue: 0,
 finalStock: 0,
 initialValue: 0,
 purchasesValue: 0,
 salesValue: 0,
 finalValue: 0,
 profit: 0
 });
 }, [filteredData]);

 // Diagnóstico (apenas desenvolvimento): comparar totais por variante vs por produto
 if (import.meta.env?.DEV) {
 const initialSum = effectivePeriodData.reduce((a, i) => a + i.initialStock, 0);
 const finalSum = effectivePeriodData.reduce((a, i) => a + i.finalStock, 0);
 if (groupByVariant) variantTotalsRef.current = { initial: initialSum, final: finalSum };
 else productTotalsRef.current = { initial: initialSum, final: finalSum };
 }
 useEffect(() => {
 if (!import.meta.env?.DEV) return;
 const v = variantTotalsRef.current;
 const p = productTotalsRef.current;
 if (!v || !p) return;
 if (Math.abs(v.initial - p.initial) > 1e-6 || Math.abs(v.final - p.final) > 1e-6) {
 console.warn('[Stock] Diferença de totais entre vista por variante e por produto', { porVariante: v, porProduto: p });
 }
 }, [groupByVariant, effectivePeriodData]);

 const { start, end } = getDateRange();

 // Calcular filtros ativos para produtos
 const activeFiltersCountProducts = [
 searchQuery ? 1 : 0,
 selectedPeriod !== 'thisMonth' ? 1 : 0,
 customStartDate ? 1 : 0
 ].filter(Boolean).length;

 // Calcular filtros ativos para movimentos
 const activeFiltersCountMovements = [
 searchQuery ? 1 : 0,
 selectedPeriod !== 'thisMonth' ? 1 : 0,
 customStartDate ? 1 : 0,
 filterType !== 'all' ? 1 : 0,
 groupByVariant ? 1 : 0,
 viewMode !== 'units' ? 1 : 0
 ].filter(Boolean).length;

 // Preparar ações da página
 const pageActions = (
 <div className="flex items-center gap-1.5">
 {/* Recalcular stock: alinhar lista de produtos ao relatório */}
 <button
 type="button"
 onClick={handleRecalculateStock}
 disabled={recalcStockInProgress}
 className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
 title="Recalcular stock a partir de movimentos (alinhar lista ao relatório)"
 >
 {recalcStockInProgress ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
 </button>
 {/* Botão de Validação de Integridade */}
 <button
 type="button"
 onClick={() => setIsIntegrityModalOpen(true)}
 className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
 title="Validar integridade de stock"
 >
 <AlertTriangle className="w-5 h-5" />
 </button>
 {/* Ícone calendário: abrir modal Definir stock inicial */}
 <button
 type="button"
 onClick={() => setShowSnapshotSection(true)}
 className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border-default text-content-secondary hover:bg-surface-base/50 transition-colors"
 title="Definir stock inicial"
 >
 <Calendar className="w-5 h-5" />
 </button>
 {/* Menu de Exportação no topo */}
 <div className="relative group">
 <button
 className="h-10 w-10 sm:w-auto sm:px-3 inline-flex items-center justify-center sm:gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
 >
 <Download className="w-5 h-5" />
 <span className="hidden sm:inline">Exportar</span>
 </button>
 <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 bg-surface-raised border border-border-default rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] min-w-[180px]">
 {activeTab === 'products' ? (
 <>
 <button
 onClick={() => {
 const data = getFilteredProductsForExport();
 if (data.length === 0) {
 showToast('Nenhum produto para exportar com os filtros selecionados', 'warning');
 return;
 }
 exportProductsToExcel(data);
 }}
 className="w-full px-4 py-2 text-left text-sm text-content-secondary hover:bg-surface-base flex items-center gap-2"
 >
 <FileText className="w-4 h-4" />
 Produtos (Excel)
 </button>
 <button
 onClick={() => {
 const data = getFilteredProductsForExport();
 if (data.length === 0) {
 showToast('Nenhum produto para exportar com os filtros selecionados', 'warning');
 return;
 }
 exportProductsToPDF(data);
 }}
 className="w-full px-4 py-2 text-left text-sm text-content-secondary hover:bg-surface-base flex items-center gap-2"
 >
 <FileText className="w-4 h-4 text-red-500" />
 Produtos (PDF)
 </button>
 </>
 ) : (
 <>
 <button
 onClick={() => {
 const data = getFilteredDataForExport();
 if (data.length === 0) {
 showToast('Nenhum movimento para exportar com os filtros selecionados', 'warning');
 return;
 }
 exportToExcel(data);
 }}
 className="w-full px-4 py-2 text-left text-sm text-content-secondary hover:bg-surface-base flex items-center gap-2"
 >
 <FileText className="w-4 h-4" />
 Movimentos (Excel)
 </button>
 <button
 onClick={() => {
 const data = getFilteredDataForExport();
 if (data.length === 0) {
 showToast('Nenhum movimento para exportar com os filtros selecionados', 'warning');
 return;
 }
 exportToPDF(data);
 }}
 className="w-full px-4 py-2 text-left text-sm text-content-secondary hover:bg-surface-base flex items-center gap-2"
 >
 <FileText className="w-4 h-4 text-red-500" />
 Movimentos (PDF)
 </button>
 </>
 )}
 </div>
 </div>
 </div>
 );

 return (
 <PageShell
 title="Gestão de Stock"
 description="Análise completa de stock por período - unidades e valores monetários"
 actions={pageActions}
 compactHeaderMobile={true}
 className="space-y-4 md:space-y-6"
 >




 {/* Conteúdo das Abas */}
 {activeTab === 'products' && (
 <>
 {/* Modal: Definir stock inicial (abre pelo ícone de calendário no header) */}
 <Modal
 open={showSnapshotSection}
 onClose={() => setShowSnapshotSection(false)}
 title="Definir stock inicial do ano"
 maxWidth="xl"
 footer={
 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => setShowSnapshotSection(false)}
 className="px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-base transition-colors"
 >
 Fechar
 </button>
 <button
 type="button"
 onClick={handleSaveStockInitialSnapshot}
 disabled={snapshotSaving}
 className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
 >
 {snapshotSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 {snapshotSaving ? 'A guardar...' : 'Guardar stock inicial'}
 </button>
 </div>
 }
 >
 <p className="text-sm text-content-secondary mb-3">
 Defina a data e as quantidades com que começou o stock. Ao escolher um período que comece nesta data (ex.: &quot;Este ano&quot;), o relatório usará estes valores como Stock Inicial.
 </p>
 <div className="flex flex-wrap items-center gap-3 mb-4">
 <label className="flex items-center gap-2 text-sm text-content-secondary">
 Data de stock inicial:
 <input
 type="date"
 value={stockInitialSnapshotDate}
 onChange={(e) => setStockInitialSnapshotDate(e.target.value)}
 className="px-2 py-1.5 border border-border-default rounded bg-surface-raised text-content-primary text-sm"
 />
 </label>
 <div className="flex-1 min-w-[200px]">
 <div className="relative">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="text"
 placeholder="Pesquisar produtos..."
 value={snapshotSearchQuery}
 onChange={(e) => setSnapshotSearchQuery(e.target.value)}
 className="w-full pl-8 pr-3 py-1.5 border border-border-default rounded bg-surface-raised text-content-primary text-sm"
 />
 </div>
 </div>
 </div>
 <div className="max-h-[320px] overflow-auto border border-border-default rounded-lg">
 <table className="w-full text-sm">
 <thead className="sticky top-0 bg-surface-base">
 <tr>
 <th className="text-left px-3 py-2 text-content-secondary">Produto</th>
 <th className="text-left px-3 py-2 text-content-secondary">Variante / Unidade</th>
 <th className="text-right px-3 py-2 text-content-secondary">Quantidade inicial</th>
 <th className="text-center px-3 py-2 text-content-secondary w-24">Ações</th>
 </tr>
 </thead>
 <tbody>
 {(() => {
 const searchNorm = normalizeForSearch(snapshotSearchQuery);
 return products.flatMap(product => {
 const effectiveVariants = product.variants && product.variants.length > 0
 ? product.variants
 : [{ id: `${product.id}-default`, name: product.name, unit: product.unit || 'un', isDefault: true } as ProductVariant];
 return effectiveVariants.map(variant => {
 const key = `${product.id}-${variant.id && !String(variant.id).includes('-default') ? variant.id : 'no-variant'}`;
 const isVirtualDefault = variant.id && String(variant.id).includes('-default');
 const displayName = isVirtualDefault ? undefined : variant.name;
 const unit = variant.unit || product.unit || 'un';
 const searchText = normalizeForSearch(`${product.name} ${displayName ?? ''} ${unit}`);
 if (searchNorm && !searchText.includes(searchNorm)) return null;
 const qty = snapshotEditMap.get(key) ?? 0;
 const variantIdForSave = variant.id && !String(variant.id).includes('-default') ? variant.id : null;
 const isSaving = savingRowKey === key;
 return (
 <tr key={key} className="border-t border-border-default">
 <td className="px-3 py-2 text-content-primary">{product.name}</td>
 <td className="px-3 py-2 text-content-secondary">
 {displayName ? `${displayName} (${unit})` : unit}
 </td>
 <td className="px-3 py-2 text-right">
 <input
 type="number"
 min={0}
 step="any"
 value={qty}
 onChange={(e) => {
 const v = parseFloat(e.target.value);
 setSnapshotEditMap(prev => {
 const next = new Map(prev);
 next.set(key, Number.isNaN(v) ? 0 : v);
 return next;
 });
 }}
 className="w-24 px-2 py-1 border border-border-default rounded bg-surface-raised text-content-primary text-right text-sm"
 />
 </td>
 <td className="px-3 py-2 text-center">
 <button
 type="button"
 onClick={() => handleSaveStockInitialSnapshotRow(key, product.id, variantIdForSave, qty)}
 disabled={isSaving || snapshotSaving}
 className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-colors"
 title="Guardar stock inicial desta linha"
 >
 {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
 {isSaving ? '...' : 'Guardar'}
 </button>
 </td>
 </tr>
 );
 });
 }).filter(Boolean);
 })()}
 </tbody>
 </table>
 </div>
 </Modal>

 {/* FilterBar - Filtros principais visíveis no desktop */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 {/* Alternador de éreas (Produtos / Movimentos) */}
 <div className="hidden">
 <button
 onClick={() => setActiveTab('products')}
 className={`p-1.5 rounded transition-colors ${activeTab === 'products'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted'
 }`}
 title="Visualizar Produtos"
 >
 <Package className="w-4 h-4" />
 </button>
 <button
 onClick={() => setActiveTab('movements')}
 className={`p-1.5 rounded transition-colors ${activeTab === 'movements'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted'
 }`}
 title="Visualizar Movimentos"
 >
 <BarChart3 className="w-4 h-4" />
 </button>
 <button
 onClick={() => setActiveTab('settings')}
 className={`p-1.5 rounded transition-colors ${activeTab === 'settings'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted'
 }`}
 title="Configurações de Stock"
 >
 <Settings className="w-4 h-4" />
 </button>
 </div>

 {/* Separador removido - navegação via sidebar */}

 <SearchInput
 value={searchQuery}
 onChange={(val) => setSearchQuery(val)}
 placeholder="Buscar produtos..."
 size="compact"
 className="flex-1 min-w-0 sm:min-w-[120px] sm:max-w-[300px] flex-shrink-0"
 />


 {/* Controles de Visualizaçéo */}
 <label title="Agrupar por variante (uma linha por variante) ou por produto (uma linha por produto). Os totais são os mesmos." className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs border border-border-default rounded bg-surface-raised cursor-pointer whitespace-nowrap flex-shrink-0">
 <input
 type="checkbox"
 checked={groupByVariant}
 onChange={(e) => setGroupByVariant(e.target.checked)}
 className="rounded w-3 h-3"
 />
 <span className="text-xs text-content-secondary">Variante</span>
 </label>

 <label title="Incluir produtos com stock zero na tabela para permitir ajustes positivos directos" className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs border border-border-default rounded bg-surface-raised cursor-pointer whitespace-nowrap flex-shrink-0">
 <input
 type="checkbox"
 checked={includeZeroStock}
 onChange={(e) => {
 setIncludeZeroStock(e.target.checked);
 setCurrentPage(1);
 }}
 className="rounded w-3 h-3"
 />
 <span className="text-xs text-content-secondary">Stock zero</span>
 </label>

 <label className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
 <span className="text-xs text-content-secondary whitespace-nowrap">Ver:</span>
 <select
 value={columnViewMode}
 onChange={(e) => setColumnViewMode(e.target.value as typeof columnViewMode)}
 className="px-2 py-1 text-xs border border-border-default rounded bg-surface-raised text-content-primary"
 title="Modo de visualização das colunas"
 >
 <option value="all">Todos</option>
 <option value="initial">Inicial</option>
 <option value="purchases">Compras</option>
 <option value="sales">Vendas</option>
 <option value="final">Final</option>
 <option value="adjustments">Ajustes</option>
 </select>
 </label>

 <div className="hidden sm:block h-4 w-px bg-surface-base flex-shrink-0" />

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

 <div className="hidden sm:flex flex-shrink-0 items-center gap-3 relative" style={{ zIndex: 50 }}>
 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={(period) => {
 setSelectedPeriod(period);
 if (period !== 'custom') {
 setCustomStartDate('');
 setCustomEndDate('');
 }
 setCurrentPage(1);
 }}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 setCurrentPage(1);
 }}
 />
 <span className="text-sm text-content-secondary whitespace-nowrap" aria-label="Período visualizado">
 {(() => {
 const { start, end } = getDateRange();
 if (selectedPeriod === 'custom' && !customStartDate) return 'Selecione as datas';
 return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
 })()}
 </span>
 </div>


 {/* Botéo Limpar Filtros - Oculto no Mobile */}
 {(searchQuery || selectedPeriod !== 'thisMonth' || customStartDate || customEndDate) && (
 <button
 onClick={() => {
 setSearchQuery('');
 setSelectedPeriod('thisMonth');
 setCustomStartDate('');
 setCustomEndDate('');
 setCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}

 {/* Botéo Filtros - Apenas no Mobile */}
 {isMobile && (
 <button
 onClick={() => setShowFiltersProducts(!showFiltersProducts)}
 className={`h-10 px-3 rounded-lg border transition-colors flex items-center gap-2 flex-shrink-0 ${showFiltersProducts || activeFiltersCountProducts > 0
 ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
 : 'bg-surface-raised text-content-secondary border-border-default hover:bg-surface-base'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {activeFiltersCountProducts > 0 && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {activeFiltersCountProducts}
 </span>
 )}
 </button>
 )}
 </FilterBar>

 {/* Painel de Filtros Mobile - Fixo quando aberto */}
 {isMobile && showFiltersProducts && (
 <div className="sticky top-[60px] z-20 bg-surface-raised rounded-xl shadow-lg border border-border-default p-4 mb-4">
 <div className="flex items-center justify-between mb-4">
 <h4 className="text-sm font-semibold text-content-primary">Filtros</h4>
 <button
 onClick={() => setShowFiltersProducts(false)}
 className="p-1 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-4 h-4 text-content-muted" />
 </button>
 </div>

 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Itens por pé¡gina
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
 </div>

 {/* Controles de Visualizaçéo */}
 <div className="space-y-2">
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Visualizaçéo
 </label>
 <div className="flex flex-wrap items-center gap-3">
 <label title="Agrupar por variante (uma linha por variante) ou por produto (uma linha por produto). Os totais são os mesmos." className="flex items-center gap-2 px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised cursor-pointer">
 <input
 type="checkbox"
 checked={groupByVariant}
 onChange={(e) => setGroupByVariant(e.target.checked)}
 className="rounded"
 />
 <span className="text-sm text-content-secondary">Variante</span>
 </label>
 <label title="Incluir produtos com stock zero para permitir ajustes positivos directos" className="flex items-center gap-2 px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised cursor-pointer">
 <input
 type="checkbox"
 checked={includeZeroStock}
 onChange={(e) => {
 setIncludeZeroStock(e.target.checked);
 setCurrentPage(1);
 }}
 className="rounded"
 />
 <span className="text-sm text-content-secondary">Stock zero</span>
 </label>
 <label className="flex items-center gap-2">
 <span className="text-sm text-content-secondary">Ver:</span>
 <select
 value={columnViewMode}
 onChange={(e) => setColumnViewMode(e.target.value as typeof columnViewMode)}
 className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="all">Todos</option>
 <option value="initial">Inicial</option>
 <option value="purchases">Compras</option>
 <option value="sales">Vendas</option>
 <option value="final">Final</option>
 <option value="adjustments">Ajustes</option>
 </select>
 </label>
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Período
 </label>
 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={(period) => {
 setSelectedPeriod(period);
 if (period !== 'custom') {
 setCustomStartDate('');
 setCustomEndDate('');
 }
 setCurrentPage(1);
 }}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 setCurrentPage(1);
 }}
 />
 <p className="mt-2 text-sm text-content-secondary">
 {selectedPeriod === 'custom' && !customStartDate
 ? 'Selecione as datas'
 : (() => {
 const { start, end } = getDateRange();
 return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
 })()}
 </p>
 </div>

 {/* Botéo Limpar Filtros */}
 {(searchQuery || selectedPeriod !== 'thisMonth' || customStartDate || customEndDate) && (
 <button
 onClick={() => {
 setSearchQuery('');
 setSelectedPeriod('thisMonth');
 setCustomStartDate('');
 setCustomEndDate('');
 setCurrentPage(1);
 }}
 className="w-full px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors flex items-center justify-center gap-2"
 >
 <X className="w-4 h-4" />
 Limpar Filtros
 </button>
 )}
 </div>
 </div>
 )}
 {/* Tabela de Produtos (única vista) */}
 <div className="relative bg-surface-raised rounded-lg shadow overflow-hidden">
 {periodLoading && (
 <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/80 z-10 rounded-lg">
 <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
 </div>
 )}
 {/* Versão Desktop - Tabela */}
 <div className="hidden md:block overflow-auto max-h-[calc(100vh-280px)]">
 {(() => {
 const { showInitial, showPurchases, showSales, showFinal, showAdjustments } = getProductColumnVisibility(filteredData);
 const colCount = 4 + (showInitial ? 2 : 0) + (showPurchases ? 2 : 0) + (showSales ? 2 : 0) + (showAdjustments ? 2 : 0) + (showFinal ? 2 : 0);
 return (
 <table className="w-full">
 <thead className="bg-emerald-800 sticky top-0 z-10">
 <tr>
 <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('productName')}>
 <div className="flex items-center gap-1">NOME DO PRODUTO{sortField === 'productName' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('variantName')}>
 <div className="flex items-center gap-1">VAR{sortField === 'variantName' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('unit')}>
 <div className="flex items-center gap-1">UN{sortField === 'unit' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('costPrice')}>
 <div className="flex items-center justify-end gap-1">{getUnitCostHeader()}{sortField === 'costPrice' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 {showInitial && (
 <>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('initialStock')}>
 <div className="flex items-center justify-end gap-1">INICIAL{sortField === 'initialStock' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('initialValue')}>
 <div className="flex items-center justify-end gap-1">VALOR{sortField === 'initialValue' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 </>
 )}
 {showPurchases && (
 <>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('purchases')}>
 <div className="flex items-center justify-end gap-1">COMPRAS{sortField === 'purchases' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('purchasesValue')}>
 <div className="flex items-center justify-end gap-1">VALOR{sortField === 'purchasesValue' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 </>
 )}
 {showSales && (
 <>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('sales')}>
 <div className="flex items-center justify-end gap-1">VENDAS{sortField === 'sales' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('salesValue')}>
 <div className="flex items-center justify-end gap-1">VALOR{sortField === 'salesValue' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 </>
 )}
 {showAdjustments && (
 <>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider">AJUSTES</th>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider">VALOR</th>
 </>
 )}
 {showFinal && (
 <>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('finalStock')}>
 <div className="flex items-center justify-end gap-1">FINAL{sortField === 'finalStock' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-colors" onClick={() => handleSort('finalValue')}>
 <div className="flex items-center justify-end gap-1">VALOR{sortField === 'finalValue' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 </>
 )}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-surface-raised">
 {paginatedData.length === 0 ? (
 <tr>
 <td colSpan={colCount} className="px-4 py-8 text-center text-content-muted bg-surface-base">
 Nenhum dado encontrado para o período selecionado
 </td>
 </tr>
 ) : (
 paginatedData.map((item, index) => (
 <tr key={`${item.productId}-${item.variantId || 'base'}-${index}`} className={`${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/80'} hover:bg-surface-base`}>
 <td className="px-3 py-2 text-sm text-content-primary whitespace-nowrap">{item.productName}</td>
 <td className="px-3 py-2 text-sm text-content-primary whitespace-nowrap">{item.variantName || '-'}</td>
 <td className="px-3 py-2 text-sm text-content-primary whitespace-nowrap">{item.unit}</td>
 <td className="px-3 py-2 text-sm text-content-primary text-right">{getDisplayedUnitCost(item) != null ? getDisplayedUnitCost(item)!.toFixed(2) : '—'}</td>
 {showInitial && (
 <>
 <td className="px-3 py-2 text-sm text-content-primary text-right">{item.initialStock.toFixed(2)}</td>
 <td className="px-3 py-2 text-sm text-content-primary bg-green-100 dark:bg-green-900/50 text-right">{getInitialValue(item).toFixed(2)}</td>
 </>
 )}
 {showPurchases && (
 <>
 <td className="px-3 py-2 text-sm text-content-primary text-right">{item.purchases.toFixed(2)}</td>
 <td className="px-3 py-2 text-sm text-content-primary bg-pink-100 dark:bg-pink-900/50 text-right">{getPurchasesValue(item).toFixed(2)}</td>
 </>
 )}
 {showSales && (
 <>
 <td className="px-3 py-2 text-sm text-content-primary text-right">{item.sales.toFixed(2)}</td>
 <td className="px-3 py-2 text-sm text-content-primary bg-pink-100 dark:bg-pink-900/50 text-right">{getSalesValue(item).toFixed(2)}</td>
 </>
 )}
 {showAdjustments && (
 <>
 <td className="px-3 py-2 text-sm text-content-primary text-right">{(item.adjustments ?? 0).toFixed(2)}</td>
 <td className="px-3 py-2 text-sm text-content-primary /50 text-right">{getAdjustmentValue(item).toFixed(2)}</td>
 </>
 )}
 {showFinal && (
 <>
 <td className="px-3 py-2 text-sm text-content-primary text-right">
 {editingCell?.productId === item.productId && (editingCell?.variantId ?? '') === (item.variantId ?? '') && editingCell?.field === 'finalStock' ? (
 <div className="flex items-center justify-end gap-1">
 <input
 type="number"
 step="any"
 min={0}
 value={editingValue}
 onChange={(e) => setEditingValue(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 const v = parseFloat(editingValue);
 if (!Number.isNaN(v) && v >= 0) {
 handleSaveInlineFinalStock(item, v);
 }
 }
 if (e.key === 'Escape') handleCancelInlineEdit();
 }}
 onBlur={() => {
 const v = parseFloat(editingValue);
 if (!Number.isNaN(v) && v >= 0 && v !== item.finalStock) {
 handleSaveInlineFinalStock(item, v);
 } else if (Number.isNaN(v) || v < 0) {
 handleCancelInlineEdit();
 }
 }}
 disabled={isSavingAdjustment}
 autoFocus
 className="w-20 px-2 py-1 text-right border border-emerald-600 dark:border-emerald-500 rounded bg-surface-raised text-content-primary focus:ring-2 focus:ring-emerald-500"
 />
 {isSavingAdjustment ? (
 <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
 ) : (
 <>
 <button
 type="button"
 onClick={() => {
 const v = parseFloat(editingValue);
 if (!Number.isNaN(v) && v >= 0) handleSaveInlineFinalStock(item, v);
 }}
 className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
 title="Guardar"
 >
 <CheckCircle2 className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={handleCancelInlineEdit}
 className="p-1 text-content-muted hover:bg-surface-base rounded"
 title="Cancelar"
 >
 <XCircle className="w-4 h-4" />
 </button>
 </>
 )}
 </div>
 ) : (
 <div className="flex items-center justify-end gap-1">
 <span>{item.finalStock.toFixed(2)}</span>
 {isSuperAdmin && (
 <button
 type="button"
 onClick={() => {
 setEditingCell({ productId: item.productId, variantId: item.variantId, field: 'finalStock' });
 setEditingValue(String(item.finalStock));
 }}
 className="p-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded opacity-70 hover:opacity-100"
 title="Editar stock final (ajuste directo)"
 >
 <Edit2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 )}
 </td>
 <td className="px-3 py-2 text-sm text-content-primary bg-green-100 dark:bg-green-900/50 text-right">{getFinalValue(item).toFixed(2)}</td>
 </>
 )}
 </tr>
 ))
 )}
 </tbody>
 </table>
 );
 })()}
 </div>

 {/* Versão Mobile - Lista em cards */}
 <div className="md:hidden max-h-[calc(100vh-280px)] overflow-auto p-3 space-y-2">
 {(() => {
 const { showInitial, showPurchases, showSales, showFinal, showAdjustments } = getProductColumnVisibility(filteredData);
 if (paginatedData.length === 0) {
 return (
 <div className="px-4 py-8 text-center text-content-muted bg-surface-base rounded-lg">
 Nenhum dado encontrado para o período selecionado
 </div>
 );
 }

 return paginatedData.map((item, index) => (
 <div
 key={`${item.productId}-${item.variantId || 'base'}-mobile-${index}`}
 className="rounded-lg border border-border-default bg-surface-raised p-3"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="text-sm font-semibold text-content-primary truncate">{item.productName}</p>
 <p className="text-xs text-content-muted truncate">
 {item.variantName || '-'} • {item.unit}
 </p>
 </div>
 <div className="text-right shrink-0">
 <p className="text-[10px] uppercase tracking-wide text-content-muted">{getUnitCostHeader()}</p>
 <p className="text-sm font-medium text-content-primary">
 {getDisplayedUnitCost(item) != null ? getDisplayedUnitCost(item)!.toFixed(2) : '—'}
 </p>
 </div>
 </div>

 <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
 {showInitial && (
 <>
 <div className="rounded bg-surface-base /40 px-2 py-1.5 text-content-secondary">Inicial: {item.initialStock.toFixed(2)}</div>
 <div className="rounded bg-green-50 dark:bg-green-900/20 px-2 py-1.5 text-content-secondary">Valor: {getInitialValue(item).toFixed(2)}</div>
 </>
 )}
 {showPurchases && (
 <>
 <div className="rounded bg-surface-base /40 px-2 py-1.5 text-content-secondary">Compras: {item.purchases.toFixed(2)}</div>
 <div className="rounded bg-pink-50 dark:bg-pink-900/20 px-2 py-1.5 text-content-secondary">Valor: {getPurchasesValue(item).toFixed(2)}</div>
 </>
 )}
 {showSales && (
 <>
 <div className="rounded bg-surface-base /40 px-2 py-1.5 text-content-secondary">Vendas: {item.sales.toFixed(2)}</div>
 <div className="rounded bg-pink-50 dark:bg-pink-900/20 px-2 py-1.5 text-content-secondary">Valor: {getSalesValue(item).toFixed(2)}</div>
 </>
 )}
 {showAdjustments && (
 <>
 <div className="rounded bg-surface-base /40 px-2 py-1.5 text-content-secondary">Ajustes: {(item.adjustments ?? 0).toFixed(2)}</div>
 <div className="rounded bg-surface-base/50 px-2 py-1.5 text-content-secondary">Valor: {getAdjustmentValue(item).toFixed(2)}</div>
 </>
 )}
 {showFinal && (
 <>
 <div className="rounded bg-surface-base /40 px-2 py-1.5 text-content-secondary">Final: {item.finalStock.toFixed(2)}</div>
 <div className="rounded bg-green-50 dark:bg-green-900/20 px-2 py-1.5 text-content-secondary">Valor: {getFinalValue(item).toFixed(2)}</div>
 </>
 )}
 </div>
 </div>
 ));
 })()}
 </div>
 </div>

 {/* Cards de totais após a tabela */}
 <div className="mt-4">
 {(() => {
 const { showInitial, showPurchases, showSales, showAdjustments, showFinal } = getProductColumnVisibility(filteredData);
 const visibleCards = [showInitial, showPurchases, showSales, showAdjustments, showFinal].filter(Boolean).length;
 return (
 <div className={`grid gap-3 ${visibleCards > 1 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-1 max-w-xs'}`}>
 {showInitial && (
 <div className="bg-surface-raised rounded-lg shadow border border-border-default p-4">
 <p className="text-xs text-content-muted uppercase tracking-wide">Inicial</p>
 <p className="tabular-nums font-semibold text-content-primary mt-1">{totals.initialStock.toFixed(2)} <span className="text-xs font-normal text-content-muted">un</span></p>
 <p className="tabular-nums text-sm mt-0.5 font-medium text-green-700 dark:text-green-400">{totals.initialValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 })}</p>
 </div>
 )}
 {showPurchases && (
 <div className="bg-surface-raised rounded-lg shadow border border-amber-200 dark:border-amber-800 p-4">
 <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide">Compras</p>
 <p className="tabular-nums font-semibold text-content-primary mt-1">{totals.purchases.toFixed(2)} <span className="text-xs font-normal text-content-muted">un</span></p>
 <p className="tabular-nums text-sm mt-0.5 font-medium text-amber-700 dark:text-amber-400">+{totals.purchasesValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 })}</p>
 </div>
 )}
 {showSales && (
 <div className="bg-surface-raised rounded-lg shadow border border-red-200 dark:border-red-800 p-4">
 <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide">Vendas</p>
 <p className="tabular-nums font-semibold text-content-primary mt-1">{totals.sales.toFixed(2)} <span className="text-xs font-normal text-content-muted">un</span></p>
 <p className="tabular-nums text-sm mt-0.5 font-medium text-red-700 dark:text-red-400">-{totals.salesValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 })}</p>
 </div>
 )}
 {showAdjustments && (
 <div className="bg-surface-raised rounded-lg shadow border border-purple-200 dark:border-purple-800 p-4">
 <p className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide">Ajustes</p>
 <p className="tabular-nums font-semibold text-content-primary mt-1">{totals.adjustments.toFixed(2)} <span className="text-xs font-normal text-content-muted">un</span></p>
 <p className="tabular-nums text-sm mt-0.5 font-medium text-purple-700 dark:text-purple-400">{totals.adjustmentsValue >= 0 ? '+' : ''}{totals.adjustmentsValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 })}</p>
 </div>
 )}
 {showFinal && (
 <div className="bg-surface-raised rounded-lg shadow border border-blue-200 dark:border-blue-800 p-4">
 <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Final</p>
 <p className="tabular-nums font-semibold text-content-primary mt-1">{totals.finalStock.toFixed(2)} <span className="text-xs font-normal text-content-muted">un</span></p>
 <p className="tabular-nums text-sm mt-0.5 font-medium text-blue-700 dark:text-blue-400">{totals.finalValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 })}</p>
 </div>
 )}
 </div>
 );
 })()}
 <p className="mt-3 text-xs text-content-muted">
 {columnViewMode === 'all' && 'FINAL = INICIAL + COMPRAS - VENDAS + AJUSTES. '}
 {columnViewMode === 'all' && !includeZeroStock && 'No modo compacto, colunas sem movimentos no periodo sao ocultadas. '}
 {'O custo unitario e unico por linha e aplicado de forma consistente em inicial, compras, vendas, ajustes e final. '}
 {groupByVariant ? 'Totais por variante; valores usam custo por variante.' : 'Totais por produto (variantes agregadas); valores usam custo por variante. Os totais são iguais em ambas as vistas.'}
 </p>
 {(() => {
 const { start } = getDateRange();
 const periodStartStr = formatDateLocal(start);
 const usingSnapshot = Boolean(stockInitialSnapshotDate && periodStartStr >= stockInitialSnapshotDate);
 if (!usingSnapshot) return null;
 const formatted = stockInitialSnapshotDate ? formatDateOnly(stockInitialSnapshotDate + 'T12:00:00') : '';
 return (
 <p className="mt-2 text-xs text-content-secondary font-normal" title="Stock inicial definido manualmente">
 Stock inicial: definido manualmente em {formatted}
 </p>
 );
 })()}
 </div>

 {/* Paginação */}
 {totalPages > 1 && (
 <div className="mt-6">
 <Pagination
 mode="full"
 currentPage={currentPage}
 totalItems={sortedData.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setCurrentPage}
 showRangeText={true}
 />
 </div>
 )}
 </>
 )}

 {activeTab === 'movements' && (() => {
 const { start, end } = getDateRange();

 return (
 <div className="space-y-4">
 {/* FilterBar - Filtros principais visíveis no desktop */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 {/* Alternador de éreas (Produtos / Movimentos) */}
 <div className="hidden">
 <button
 onClick={() => setActiveTab('products')}
 className={`p-1.5 rounded transition-colors ${activeTab === 'products'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted'
 }`}
 title="Visualizar Produtos"
 >
 <Package className="w-4 h-4" />
 </button>
 <button
 onClick={() => setActiveTab('movements')}
 className={`p-1.5 rounded transition-colors ${activeTab === 'movements'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted'
 }`}
 title="Visualizar Movimentos"
 >
 <BarChart3 className="w-4 h-4" />
 </button>
 <button
 onClick={() => setActiveTab('settings')}
 className={`p-1.5 rounded transition-colors ${activeTab === 'settings'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted'
 }`}
 title="Configurações de Stock"
 >
 <Settings className="w-4 h-4" />
 </button>
 </div>

 <div className="hidden" />

 <SearchInput
 value={searchQuery}
 onChange={(val) => setSearchQuery(val)}
 placeholder="Buscar movimentos..."
 size="compact"
 className="flex-1 min-w-0 sm:min-w-[120px] sm:max-w-[300px] flex-shrink-0"
 />

 {/* Controles de Visualizaçéo */}
 <label title="Agrupar por variante (uma linha por variante) ou por produto (uma linha por produto). Os totais são os mesmos." className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs border border-border-default rounded bg-surface-raised cursor-pointer whitespace-nowrap flex-shrink-0">
 <input
 type="checkbox"
 checked={groupByVariant}
 onChange={(e) => setGroupByVariant(e.target.checked)}
 className="rounded w-3 h-3"
 />
 <span className="text-xs text-content-secondary">Variante</span>
 </label>

 <div className="hidden sm:flex items-center gap-0.5 border border-border-default rounded bg-surface-raised p-0.5 flex-shrink-0">
 <button
 onClick={() => setViewMode('units')}
 className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${viewMode === 'units'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-secondary'
 }`}
 >
 Unid.
 </button>
 <button
 onClick={() => setViewMode('monetary')}
 className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${viewMode === 'monetary'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-secondary'
 }`}
 >
 Valores
 </button>
 </div>

 <div className="hidden sm:block h-4 w-px bg-surface-base flex-shrink-0" />

 {/* Filtros - Ocultos no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterType}
 onChange={(val) => {
 setFilterType(val as 'all' | 'entry' | 'exit');
 setMovementCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Tipo' },
 { value: 'entry', label: 'Entradas' },
 { value: 'exit', label: 'Saídas' },
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por tipo de movimento"
 />
 </div>

 <div className="hidden sm:block">
 <ItemsPerPageSelect
 value={movementItemsPerPage}
 onChange={(val) => {
 setMovementItemsPerPage(val);
 setMovementCurrentPage(1);
 }}
 options={[6, 12, 24, 48, 96, 500]}
 label=""
 size="compact"
 className="flex-shrink-0"
 />
 </div>

 <div className="hidden sm:flex flex-shrink-0 items-center gap-3 relative" style={{ zIndex: 50 }}>
 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={(period) => {
 setSelectedPeriod(period);
 if (period !== 'custom') {
 setCustomStartDate('');
 setCustomEndDate('');
 }
 setMovementCurrentPage(1);
 }}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 setMovementCurrentPage(1);
 }}
 />
 <span className="text-sm text-content-secondary whitespace-nowrap" aria-label="Período visualizado">
 {selectedPeriod === 'custom' && !customStartDate ? 'Selecione as datas' : (() => {
 const { start, end } = getDateRange();
 return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
 })()}
 </span>
 </div>

 {/* Botéo Limpar Filtros - Oculto no Mobile */}
 {(searchQuery || filterType !== 'all' || selectedPeriod !== 'thisMonth' || customStartDate || customEndDate) && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterType('all');
 setSelectedPeriod('thisMonth');
 setCustomStartDate('');
 setCustomEndDate('');
 setMovementCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}

 {/* Botéo Filtros - Apenas no Mobile */}
 {isMobile && (
 <button
 onClick={() => setShowFiltersMovements(!showFiltersMovements)}
 className={`h-10 px-3 rounded-lg border transition-colors flex items-center gap-2 flex-shrink-0 ${showFiltersMovements || activeFiltersCountMovements > 0
 ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
 : 'bg-surface-raised text-content-secondary border-border-default hover:bg-surface-base'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {activeFiltersCountMovements > 0 && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {activeFiltersCountMovements}
 </span>
 )}
 </button>
 )}
 </FilterBar>

 {/* Painel de Filtros Mobile - Fixo quando aberto */}
 {isMobile && showFiltersMovements && (
 <div className="sticky top-[60px] z-20 bg-surface-raised rounded-xl shadow-lg border border-border-default p-4 mb-4">
 <div className="flex items-center justify-between mb-4">
 <h4 className="text-sm font-semibold text-content-primary">Filtros</h4>
 <button
 onClick={() => setShowFiltersMovements(false)}
 className="p-1 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-4 h-4 text-content-muted" />
 </button>
 </div>

 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Tipo
 </label>
 <SelectFilter
 value={filterType}
 onChange={(val) => {
 setFilterType(val as 'all' | 'entry' | 'exit');
 setMovementCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todos' },
 { value: 'entry', label: 'Entradas' },
 { value: 'exit', label: 'Saídas' },
 ]}
 className="w-full"
 size="md"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Itens por página
 </label>
 <ItemsPerPageSelect
 value={movementItemsPerPage}
 onChange={(val) => {
 setMovementItemsPerPage(val);
 setMovementCurrentPage(1);
 }}
 options={[6, 12, 24, 48, 96, 500]}
 label=""
 size="md"
 className="w-full"
 />
 </div>
 </div>

 {/* Controles de Visualizaçéo */}
 <div className="space-y-2">
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Visualizaçéo
 </label>
 <div className="flex items-center gap-3">
 <label title="Agrupar por variante (uma linha por variante) ou por produto (uma linha por produto). Os totais são os mesmos." className="flex items-center gap-2 px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised cursor-pointer">
 <input
 type="checkbox"
 checked={groupByVariant}
 onChange={(e) => setGroupByVariant(e.target.checked)}
 className="rounded"
 />
 <span className="text-sm text-content-secondary">Variante</span>
 </label>
 <div className="flex items-center gap-1 border border-border-default rounded-lg bg-surface-raised p-0.5">
 <button
 onClick={() => setViewMode('units')}
 className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'units'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-secondary'
 }`}
 >
 Unid.
 </button>
 <button
 onClick={() => setViewMode('monetary')}
 className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'monetary'
 ? 'bg-brand-600 text-white'
 : 'bg-transparent text-content-secondary'
 }`}
 >
 Valores
 </button>
 </div>
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Período
 </label>
 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={(period) => {
 setSelectedPeriod(period);
 if (period !== 'custom') {
 setCustomStartDate('');
 setCustomEndDate('');
 }
 setMovementCurrentPage(1);
 }}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 setMovementCurrentPage(1);
 }}
 />
 <p className="mt-2 text-sm text-content-secondary">
 {selectedPeriod === 'custom' && !customStartDate ? 'Selecione as datas' : (() => {
 const { start, end } = getDateRange();
 return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
 })()}
 </p>
 </div>

 {/* Botéo Limpar Filtros */}
 {(searchQuery || filterType !== 'all' || selectedPeriod !== 'thisMonth' || customStartDate || customEndDate) && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterType('all');
 setSelectedPeriod('thisMonth');
 setCustomStartDate('');
 setCustomEndDate('');
 setMovementCurrentPage(1);
 }}
 className="w-full px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors flex items-center justify-center gap-2"
 >
 <X className="w-4 h-4" />
 Limpar Filtros
 </button>
 )}
 </div>
 </div>
 )}

 {/* Lista de Movimentos */}
 {(() => {
 const filteredMovements = stockMovements
 .filter(m => {
 const normalizedMovementDate = normalizeDateStart(new Date(m.date));
 const inPeriod = normalizedMovementDate >= start && normalizedMovementDate <= end;
 if (!inPeriod) return false;

 // Data base: 18/01/2026 - não pode haver movimentos de saída antes desta data
 const BASE_DATE = normalizeDateStart(new Date('2026-01-18'));

 // Filtrar movimentos de ajuste manual (não são de compra nem venda)
 const notes = m.notes?.toLowerCase() || '';
 const isFromPurchase = notes.includes('compra') ||
 notes.includes('entrada de stock via compra') ||
 notes.includes('entrada via compra');
 const isFromOrder = notes.includes('pedido') ||
 notes.includes('saída de stock via pedido') ||
 notes.includes('saída via pedido');
 const isManualAdjustment = notes.includes('ajuste direto na tabela') ||
 notes.includes('stock inicial ajustado') ||
 notes.includes('stock final ajustado') ||
 notes.includes('ajuste manual') ||
 notes.includes('reset histórico') ||
 notes.includes('stock inicial definido') ||
 notes.includes('verificar stock') ||
 notes.includes('validar stock');

 // Verificar se é movimento de saída anterior é  data base
 const isExitBeforeBaseDate = isFromOrder && normalizedMovementDate < BASE_DATE;

 // Remover da exibição:
 // 1. Ajustes manuais que não são de compra nem venda
 // 2. Movimentos de saída anteriores à data base (18/01/2026)
 if ((isManualAdjustment && !isFromPurchase && !isFromOrder) || isExitBeforeBaseDate) {
 return false;
 }

 // Filtro por tipo (entrada/saída) - usar filtro compartilhado
 if (filterType !== 'all') {
 const hasEntry = m.items.some(i => i.quantity > 0);
 const hasExit = m.items.some(i => i.quantity < 0);
 if (filterType === 'entry' && !hasEntry) return false;
 if (filterType === 'exit' && !hasExit) return false;
 }

 // Filtro por pesquisa - usar searchQuery compartilhado (pesquisa abrangente)
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 // Pesquisar em notas do movimento
 const matchesNotes = (m.notes && normalizeForSearch(m.notes).includes(query)) || false;
 // Pesquisar em produtos e variantes dos itens
 const matchesItems = m.items.some(i => {
 const productName = normalizeForSearch(i.productName || '');
 const variant = normalizeForSearch(i.variant || '');
 return productName.includes(query) || variant.includes(query);
 });
 // Se não encontrou em nenhum lugar, filtrar
 if (!matchesNotes && !matchesItems) return false;
 }


 return true;
 })
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

 // Extrato em tabela (única vista)
 const extractData: Array<{
 date: string;
 createdAt: string;
 description: string;
 productId: string;
 productName: string;
 variant: string;
 variantId?: string;
 entry: number;
 exit: number;
 entryValue: number;
 exitValue: number;
 unit: string;
 movementId: string;
 notes: string;
 initialStock?: number;
 initialStockValue?: number;
 balance?: number;
 balanceValue?: number;
 }> = [];

 filteredMovements.forEach(movement => {
 movement.items.forEach(item => {
 // Determinar se é entrada ou saída baseado na descrição E na quantidade
 const notes = movement.notes?.toLowerCase() || '';
 const isPurchase = notes.includes('compra') || notes.includes('entrada de stock via compra') || notes.includes('entrada via compra');
 const isOrder = notes.includes('pedido') || notes.includes('saída de stock via pedido') || notes.includes('saída via pedido');

 // Se a descrição indica saída mas a quantidade é positiva, corrigir
 // Se a descrição indica entrada mas a quantidade é negativa, corrigir
 let entry = 0;
 let exit = 0;

 if (isOrder) {
 // É uma saída - quantidade deve ser negativa
 if (item.quantity < 0) {
 exit = Math.abs(item.quantity);
 } else if (item.quantity > 0) {
 // Movimento antigo incorreto - quantidade positiva mas é saída
 exit = Math.abs(item.quantity);
 }
 } else if (isPurchase) {
 // é‰ uma entrada - quantidade deve ser positiva
 if (item.quantity > 0) {
 entry = Math.abs(item.quantity);
 } else if (item.quantity < 0) {
 // Movimento antigo incorreto - quantidade negativa mas é entrada
 entry = Math.abs(item.quantity);
 }
 } else {
 // Fallback: usar o sinal da quantidade
 entry = item.quantity > 0 ? Math.abs(item.quantity) : 0;
 exit = item.quantity < 0 ? Math.abs(item.quantity) : 0;
 }

 // Buscar produto e variante para calcular valores monetários
 const product = products.find(p => p.id === item.productId || p.name.toLowerCase().trim() === item.productName.toLowerCase().trim());
 let variant: ProductVariant | undefined;
 let costPrice = 0;
 let price = 0;

 if (product) {
 if (item.variant && product.variants && product.variants.length > 0) {
 variant = product.variants.find(v =>
 v.name.toLowerCase().trim() === item.variant?.toLowerCase().trim() ||
 v.id === item.variant
 );
 costPrice = variant?.costPrice || product.costPrice || 0;
 price = variant?.price || product.price || 0;
 } else {
 costPrice = product.costPrice || 0;
 price = product.price || 0;
 }
 }

 // Controlo de stock: entradas = custo de compra (unitPrice); saídas = custo de stock_transactions (FIFO) ou costPrice
 const entryCost = (entry > 0 && item.unitPrice != null) ? item.unitPrice : costPrice;
 const exitCost = exit > 0
 ? (transactionCostsMap.get(`${movement.id}-${item.productId}-${item.variantId ?? variant?.id ?? 'null'}`) ?? costPrice)
 : costPrice;
 const entryValue = entry * entryCost;
 const exitValue = exit * exitCost;

 extractData.push({
 date: movement.date,
 createdAt: movement.createdAt || movement.date,
 description: movement.notes || '',
 productId: item.productId,
 productName: item.productName,
 variant: item.variant || '-',
 variantId: variant?.id,
 entry,
 exit,
 entryValue,
 exitValue,
 unit: item.unit || 'un',
 movementId: movement.id,
 notes: movement.notes || ''
 });
 });
 });

 // Agrupar por produto se groupByVariant estiver desativado
 if (!groupByVariant) {
 const groupedData = new Map<string, typeof extractData[0]>();

 extractData.forEach(item => {
 // Buscar produto base para obter o nome correto
 let productBaseName = item.productName;
 let productBaseId = item.productId;

 // Tentar encontrar o produto real
 // Primeiro por ID, depois por nome exato, depois por nome parcial
 const product = products.find(p => {
 if (item.productId && p.id === item.productId) return true;
 if (p.name.toLowerCase().trim() === item.productName.toLowerCase().trim()) return true;
 // Verificar se o nome do item contém o nome do produto (caso tenha variante no nome)
 const itemNameLower = item.productName.toLowerCase().trim();
 const productNameLower = p.name.toLowerCase().trim();
 return itemNameLower.startsWith(productNameLower) || productNameLower.startsWith(itemNameLower);
 });

 if (product) {
 productBaseName = product.name;
 productBaseId = product.id;
 } else {
 // Se não encontrar, tentar remover padrões comuns de variantes do nome
 // Ex: "Frango Fumado 1.3KG" -> "Frango Fumado"
 // Remover padrões como "1.3KG", "1,5kg", "12un", etc.
 productBaseName = item.productName
 .replace(/\s+\d+[.,]?\d*\s*(kg|g|un|dz|ml|l|m|cm|mm|fresco|seco)/gi, '')
 .trim();
 }

 // Criar chave única: produto base (ID ou nome normalizado) + data + movimento
 const productKey = productBaseId || productBaseName.toLowerCase().trim();
 const key = `${productKey}-${item.date}-${item.movementId}`;

 const existing = groupedData.get(key);

 if (existing) {
 // Somar quantidades e valores de todas as variantes do mesmo produto no mesmo movimento
 existing.entry += item.entry;
 existing.exit += item.exit;
 existing.entryValue += item.entryValue;
 existing.exitValue += item.exitValue;
 existing.variant = '-'; // Quando agrupado, não mostrar variante específica
 // Manter o nome base do produto (sem variante)
 existing.productName = productBaseName;
 existing.productId = productBaseId || existing.productId;
 } else {
 // Criar novo item agrupado com nome base do produto
 groupedData.set(key, {
 ...item,
 variant: '-',
 productName: productBaseName,
 productId: productBaseId || item.productId
 });
 }
 });

 // Converter de volta para array
 extractData.length = 0;
 extractData.push(...Array.from(groupedData.values()));
 }

 // Ordenar por data e hora (createdAt) para calcular saldo em ordem cronológica exacta
 extractData.sort((a, b) => {
 const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
 if (dateCompare !== 0) return dateCompare;
 return (a.createdAt || a.date).localeCompare(b.createdAt || b.date);
 });

 // Calcular saldo no inicio do periodo por produto/variante (saldo final do periodo anterior)
 const normalizedStart = normalizeDateStart(start);

 // Usar data do snapshot como base para ignorar movimentos anteriores
 const snapshotDateParsed = stockInitialSnapshotDate ? normalizeDateStart(new Date(stockInitialSnapshotDate)) : null;
 // >= para incluir quando o periodo comeca exactamente na data do snapshot
 const useSnapshot = snapshotDateParsed && normalizedStart >= snapshotDateParsed;

 const movementsBeforePeriod = stockMovements
 .filter(m => {
 const normalizedMovementDate = normalizeDateStart(new Date(m.date));
 if (normalizedMovementDate >= normalizedStart) return false;
 // Se usamos snapshot, ignorar movimentos antes ou na data do snapshot
 if (useSnapshot && snapshotDateParsed && normalizedMovementDate <= snapshotDateParsed) return false;
 const notes = m.notes?.toLowerCase() || '';
 const isFromPurchase = notes.includes('compra') ||
 notes.includes('entrada de stock via compra') ||
 notes.includes('entrada via compra');
 const isFromOrder = notes.includes('pedido') ||
 notes.includes('saida de stock via pedido') ||
 notes.includes('saida via pedido');
 const isManualAdjustment = notes.includes('ajuste direto na tabela') ||
 notes.includes('stock inicial ajustado') ||
 notes.includes('stock final ajustado') ||
 notes.includes('ajuste manual') ||
 notes.includes('reset historico') ||
 notes.includes('stock inicial definido') ||
 notes.includes('verificar stock') ||
 notes.includes('validar stock');
 if (isManualAdjustment && !isFromPurchase && !isFromOrder) return false;
 return true;
 })
 .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

 // Inicializar com valores do snapshot se disponivel
 const initialBalanceMap = new Map<string, number>();

 // Se usamos snapshot, inicializar o mapa com os valores do snapshot
 if (useSnapshot && snapshotMap.size > 0) {
 products.forEach(product => {
 const effectiveVariants = product.variants && product.variants.length > 0
 ? product.variants
 : [{ id: `${product.id}-default`, name: product.name, isDefault: true }];
 effectiveVariants.forEach(variant => {
 const realVariantId = variant.id && !String(variant.id).includes('-default') ? variant.id : null;
 const snapshotKey = `${product.id}-${realVariantId ?? 'no-variant'}`;
 const snapshotValue = snapshotMap.get(snapshotKey) || 0;
 if (snapshotValue !== 0) {
 // Criar chave canonica para o mapa de saldos
 const variantName = groupByVariant ? (variant.name || product.name) : '';
 const unit = product.variants?.find(v => v.id === variant.id)?.unit || product.unit || 'UN';
 const canonicalKey = groupByVariant
 ? `${product.name}-${variantName}-${unit}`
 : `${product.name}-${unit}`;
 initialBalanceMap.set(canonicalKey, snapshotValue);
 }
 });
 });
 }

 // Processar movimentos entre snapshot e inicio do periodo
 movementsBeforePeriod.forEach(movement => {
 const notes = movement.notes?.toLowerCase() || '';
 const isPurchase = notes.includes('compra') || notes.includes('entrada de stock via compra') || notes.includes('entrada via compra');
 const isOrder = notes.includes('pedido') || notes.includes('saida de stock via pedido') || notes.includes('saida via pedido');
 movement.items.forEach(item => {
 let entry = 0;
 let exit = 0;
 if (isOrder) {
 exit = item.quantity !== 0 ? Math.abs(item.quantity) : 0;
 } else if (isPurchase) {
 entry = item.quantity !== 0 ? Math.abs(item.quantity) : 0;
 } else {
 entry = item.quantity > 0 ? Math.abs(item.quantity) : 0;
 exit = item.quantity < 0 ? Math.abs(item.quantity) : 0;
 }
 const { canonicalKey } = getCanonicalProductKey(
 { productId: item.productId, productName: item.productName, variant: item.variant, unit: item.unit },
 products,
 groupByVariant
 );
 const current = initialBalanceMap.get(canonicalKey) ?? 0;
 initialBalanceMap.set(canonicalKey, current + entry - exit);
 });
 });

 // Agrupar movimentos por produto/variante e data para calcular saldo sequencialmente
 // Ordenar por data (mais antiga primeiro) para calcular saldo corretamente
 // Dentro da mesma data: entradas antes de saídas
 const sortedByDate = [...extractData].sort((a, b) => {
 const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
 if (dateCompare !== 0) return dateCompare;

 // Dentro da mesma data: entradas (entry > 0) antes de saídas (exit > 0)
 const aIsEntry = a.entry > 0;
 const bIsEntry = b.entry > 0;
 if (aIsEntry !== bIsEntry) {
 return aIsEntry ? -1 : 1; // Entradas primeiro
 }

 return a.productName.localeCompare(b.productName);
 });

 // Valor inicial do período por chave canónica (API get_stock_period_summary) para alinhar com relatório
 const initialValueMap = new Map<string, number>();
 effectivePeriodData.forEach(row => {
 const { canonicalKey } = getCanonicalProductKey(
 { productName: row.productName, variant: row.variantName ?? '-', unit: row.unit },
 products,
 groupByVariant
 );
 initialValueMap.set(canonicalKey, row.initialValue ?? 0);
 });

 const balanceMap = new Map<string, number>();
 const balanceValueMap = new Map<string, number>();
 const extractDataWithBalance = sortedByDate.map(item => {
 const { canonicalKey } = getCanonicalProductKey(
 { productId: item.productId, productName: item.productName, variant: item.variant, unit: item.unit },
 products,
 groupByVariant
 );
 const key = canonicalKey;

 // Inicializar com stock inicial se disponível (apenas na primeira vez que vemos este produto/variante)
 if (!balanceMap.has(key)) {
 const initialBalance = initialBalanceMap.get(key) || 0;
 balanceMap.set(key, initialBalance);

 // Valor inicial: preferir API (get_stock_period_summary); fallback para custo do produto
 if (initialValueMap.has(key)) {
 balanceValueMap.set(key, initialValueMap.get(key)!);
 } else {
 const product = products.find(p => p.id === item.productId || p.name.toLowerCase().trim() === item.productName.toLowerCase().trim());
 if (product) {
 let costPrice = 0;
 if (groupByVariant && item.variantId && product.variants) {
 const variant = product.variants.find(v => v.id === item.variantId);
 costPrice = variant?.costPrice || product.costPrice || 0;
 } else {
 costPrice = product.costPrice || 0;
 }
 balanceValueMap.set(key, initialBalance * costPrice);
 }
 }
 }

 // Stock inicial ANTES deste movimento (saldo atual antes de aplicar entrada/saída)
 const initialStockBeforeMovement = balanceMap.get(key) || 0;
 const initialStockValueBeforeMovement = balanceValueMap.get(key) || 0;

 // Aplicar entrada/saída e atualizar saldo
 const newBalance = initialStockBeforeMovement + item.entry - item.exit;
 balanceMap.set(key, newBalance);

 // Calcular valor do saldo
 const newBalanceValue = initialStockValueBeforeMovement + item.entryValue - item.exitValue;
 balanceValueMap.set(key, newBalanceValue);

 return {
 ...item,
 initialStock: initialStockBeforeMovement, // Stock antes deste movimento
 initialStockValue: initialStockValueBeforeMovement, // Valor do stock antes deste movimento
 balance: newBalance,
 balanceValue: newBalanceValue
 };
 });

 // Aplicar filtros de pesquisa também nos dados extraídos (para garantir consistência)
 let filteredExtractData = extractDataWithBalance;

 // Filtro por pesquisa - aplicar novamente nos dados extraídos
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filteredExtractData = filteredExtractData.filter(item => {
 const matchesDescription = normalizeForSearch(item.description || '').includes(query);
 const matchesProduct = normalizeForSearch(item.productName || '').includes(query);
 const matchesVariant = normalizeForSearch(item.variant || '').includes(query);
 return matchesDescription || matchesProduct || matchesVariant;
 });
 }


 // Filtro por tipo de movimento (entrada/saída)
 if (filterType !== 'all') {
 filteredExtractData = filteredExtractData.filter(item => {
 if (filterType === 'entry') return item.entry > 0;
 if (filterType === 'exit') return item.exit > 0;
 return true;
 });
 }

 // Ordenar dados para exibiçéo baseado no campo selecionado
 const sortedData = [...filteredExtractData].sort((a, b) => {
 let compare = 0;

 switch (movementSortField) {
 case 'date':
 compare = new Date(a.date).getTime() - new Date(b.date).getTime();
 // Mesma data: ordenar por hora (createdAt) para sequência cronológica exacta
 if (compare === 0) {
 compare = (a.createdAt || a.date).localeCompare(b.createdAt || b.date);
 }
 break;
 case 'description':
 compare = (a.description || '').localeCompare(b.description || '');
 break;
 case 'product':
 compare = a.productName.localeCompare(b.productName);
 break;
 case 'variant':
 compare = (a.variant || '').localeCompare(b.variant || '');
 break;
 case 'initialStock':
 compare = (a.initialStock || 0) - (b.initialStock || 0);
 break;
 case 'entry':
 compare = a.entry - b.entry;
 break;
 case 'exit':
 compare = a.exit - b.exit;
 break;
 case 'balance':
 compare = a.balance - b.balance;
 break;
 default:
 compare = new Date(b.date).getTime() - new Date(a.date).getTime();
 }

 return movementSortDirection === 'asc' ? compare : -compare;
 });

 // Calcular totais de entradas, saídas (unidades e valores) e saldos finais por produto/variante
 const totals = sortedData.reduce((acc, item) => ({
 entry: acc.entry + item.entry,
 exit: acc.exit + item.exit,
 entryValue: acc.entryValue + item.entryValue,
 exitValue: acc.exitValue + item.exitValue,
 balance: 0,
 balanceValue: 0
 }), { entry: 0, exit: 0, entryValue: 0, exitValue: 0, balance: 0, balanceValue: 0 });

 // Saldo final por produto/variante = saldo após o último movimento em ordem cronológica (independente da ordenação da tabela)
 if (sortedData.length > 0) {
 const chronologicalOrder = [...filteredExtractData].sort((a, b) => {
 const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
 if (dateCompare !== 0) return dateCompare;
 const aIsEntry = a.entry > 0;
 const bIsEntry = b.entry > 0;
 if (aIsEntry !== bIsEntry) return aIsEntry ? -1 : 1;
 return (a.productName || '').localeCompare(b.productName || '');
 });
 const finalBalances = new Map<string, number>();
 const finalBalanceValues = new Map<string, number>();
 chronologicalOrder.forEach(item => {
 const key = `${item.productName}-${item.variant}-${item.unit}`;
 finalBalances.set(key, item.balance ?? 0);
 finalBalanceValues.set(key, item.balanceValue ?? 0);
 });
 totals.balance = Array.from(finalBalances.values()).reduce((sum, balance) => sum + balance, 0);
 totals.balanceValue = Array.from(finalBalanceValues.values()).reduce((sum, val) => sum + val, 0);
 }

 // Paginação
 const totalPages = Math.ceil(sortedData.length / movementItemsPerPage);
 const startIndex = (movementCurrentPage - 1) * movementItemsPerPage;
 const endIndex = startIndex + movementItemsPerPage;
 const paginatedData = sortedData.slice(startIndex, endIndex);

 // Função para ordenar
 const handleSort = (field: typeof movementSortField) => {
 if (movementSortField === field) {
 setMovementSortDirection(movementSortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setMovementSortField(field);
 setMovementSortDirection('desc');
 }
 setMovementCurrentPage(1); // Resetar para primeira página ao ordenar
 };

 // Função para renderizar cabeçalho ordenável
 const SortableHeader = ({ field, children, className = '' }: { field: typeof movementSortField; children: React.ReactNode; className?: string }) => (
 <th
 className={`px-4 py-3 text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors ${className}`}
 onClick={() => handleSort(field)}
 >
 <div className="flex items-center gap-1">
 {children}
 {movementSortField === field && (
 movementSortDirection === 'asc' ? (
 <ArrowUp className="w-3 h-3" />
 ) : (
 <ArrowDown className="w-3 h-3" />
 )
 )}
 </div>
 </th>
 );

 // Usar funções definidas no nível do componente

 return (
 <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
 {/* Barra de ações em massa */}
 {selectedMovements.size > 0 && (
 <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
 {selectedMovements.size} movimento(s) selecionado(s)
 </span>
 <button
 onClick={handleDeleteSelectedMovements}
 disabled={isDeletingMovements}
 className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
 >
 {isDeletingMovements ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Removendo...
 </>
 ) : (
 <>
 <Trash2 className="w-4 h-4" />
 Remover Selecionados
 </>
 )}
 </button>
 </div>
 <button
 onClick={() => setSelectedMovements(new Set())}
 className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
 >
 Limpar Seleçéo
 </button>
 </div>
 )}

 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th className="px-4 py-3 text-center">
 <input
 type="checkbox"
 checked={selectedMovements.size === sortedData.length && sortedData.length > 0 && sortedData.every(item => selectedMovements.has(item.movementId))}
 onChange={() => handleSelectAllMovements(sortedData.map(item => item.movementId))}
 className="w-4 h-4 text-blue-600 bg-surface-base border-border-default rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 "
 />
 </th>
 <SortableHeader field="date" className="text-left text-content-muted">Data</SortableHeader>
 <SortableHeader field="description" className="text-left text-content-muted">Descrição</SortableHeader>
 <SortableHeader field="product" className="text-left text-content-muted">Produto</SortableHeader>
 {groupByVariant && (
 <SortableHeader field="variant" className="text-left text-content-muted">Variação</SortableHeader>
 )}
 <SortableHeader field="initialStock" className="text-right text-content-secondary">
 {viewMode === 'monetary' ? 'Stock Inicial (Valor)' : 'Stock Inicial'}
 </SortableHeader>
 <SortableHeader field="entry" className="text-right text-green-600 dark:text-green-400">
 {viewMode === 'monetary' ? 'Entrada (Valor)' : 'Entrada'}
 </SortableHeader>
 <SortableHeader field="exit" className="text-right text-red-600 dark:text-red-400">
 {viewMode === 'monetary' ? 'Saída (Valor)' : 'Saída'}
 </SortableHeader>
 <SortableHeader field="balance" className="text-right text-blue-600 dark:text-blue-400">
 {viewMode === 'monetary' ? 'Saldo (Valor)' : 'Saldo'}
 </SortableHeader>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted uppercase tracking-wider">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-surface-raised divide-y divide-gray-200 dark:divide-gray-700">
 {extractDataWithBalance.length === 0 ? (
 <tr>
 <td colSpan={groupByVariant ? 11 : 10} className="px-4 py-8 text-center text-content-muted">
 <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
 <p className="text-base font-medium mb-2">Nenhum movimento encontrado</p>
 <p className="text-sm">Tente ajustar os filtros ou sincronizar os movimentos.</p>
 </td>
 </tr>
 ) : (
 <>
 {paginatedData.map((item, idx) => {
 const movement = filteredMovements.find(m => m.id === item.movementId);
 const isEntry = item.entry > 0;
 const isExit = item.exit > 0;

 const isSelected = selectedMovements.has(item.movementId);

 return (
 <tr
 key={`${item.movementId}-${idx}`}
 className={`${isEntry ? 'bg-green-50/30 dark:bg-green-900/10 hover:bg-green-50/50 dark:hover:bg-green-900/20' : 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/50 dark:hover:bg-red-900/20'} ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
 >
 <td className="px-4 py-3 text-center">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => handleSelectMovement(item.movementId)}
 className="w-4 h-4 text-blue-600 bg-surface-base border-border-default rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 "
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-primary">
 {formatDateOnly(item.date)}
 </td>
 <td className="px-4 py-3 text-sm text-content-secondary max-w-md">
 <div className="truncate" title={item.description}>
 {item.description || '-'}
 </div>
 </td>
 <td className="px-4 py-3 text-sm font-medium text-content-primary">
 {item.productName}
 </td>
 {groupByVariant && (
 <td className="px-4 py-3 text-sm text-content-muted">
 {item.variant}
 </td>
 )}
 <td className="px-4 py-3 text-sm text-right">
 <span className={`font-medium ${(item.initialStock || 0) >= 0 ? 'text-content-secondary' : 'text-red-700 dark:text-red-400'}`}>
 {viewMode === 'monetary' ? (
 ((item.initialStockValue || 0)).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')
 ) : (
 `${(item.initialStock || 0).toFixed(2)} ${item.unit}`
 )}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-right">
 {item.entry > 0 ? (
 <span className="font-semibold text-green-700 dark:text-green-400">
 {viewMode === 'monetary' ? (
 `+${item.entryValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')}`
 ) : (
 `+${item.entry.toFixed(2)} ${item.unit}`
 )}
 </span>
 ) : (
 <span className="text-content-muted">-</span>
 )}
 </td>
 <td className="px-4 py-3 text-sm text-right">
 {item.exit > 0 ? (
 <span className="font-semibold text-red-700 dark:text-red-400">
 {viewMode === 'monetary' ? (
 `-${item.exitValue.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')}`
 ) : (
 `-${item.exit.toFixed(2)} ${item.unit}`
 )}
 </span>
 ) : (
 <span className="text-content-muted">-</span>
 )}
 </td>
 <td className="px-4 py-3 text-sm text-right">
 <span className={`font-bold ${(viewMode === 'monetary' ? item.balanceValue : item.balance) >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
 {viewMode === 'monetary' ? (
 (item.balanceValue || 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')
 ) : (
 `${item.balance.toFixed(2)} ${item.unit}`
 )}
 </span>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-center">
 {movement && (
 <div className="flex items-center justify-center gap-2">
 {isExit && getLinkedOrder(movement) && (
 <button
 onClick={() => setDetailOrder(getLinkedOrder(movement)!)}
 className="p-1 text-content-secondary hover:bg-surface-base dark:text-content-muted rounded transition-colors"
 title="Ver detalhes do pedido"
 >
 <Eye className="w-4 h-4" />
 </button>
 )}
 {isEntry && getLinkedPurchase(movement) && (
 <button
 onClick={() => setDetailPurchase(getLinkedPurchase(movement)!)}
 className="p-1 text-content-secondary hover:bg-surface-base dark:text-content-muted rounded transition-colors"
 title="Ver detalhes da compra"
 >
 <Eye className="w-4 h-4" />
 </button>
 )}
 <button
 onClick={() => {
 setEditingMovement(movement);
 setIsCreateMovementModalOpen(true);
 }}
 className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
 title="Editar movimento"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={async () => {
 if (confirm('Tem certeza que deseja apagar este movimento?')) {
 try {
 const success = await stockService.deleteStockMovement(movement.id);
 if (success) {
 showToast('Movimento apagado com sucesso', 'success');
 loadStockMovements();
 } else {
 showToast('Erro ao apagar movimento', 'error');
 }
 } catch (error) {
 console.error('Erro ao apagar movimento:', error);
 showToast('Erro ao apagar movimento', 'error');
 }
 }
 }}
 className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Apagar movimento"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 )}
 </td>
 </tr>
 );
 })}

 {/* Linha de totais: colSpan cobre checkbox até Stock Inicial para alinhar Entrada/Saída/Saldo */}
 {sortedData.length > 0 && (
 <tr className="bg-surface-base font-semibold border-t-2 border-border-default">
 <td colSpan={groupByVariant ? 7 : 6} className="px-4 py-3 text-sm text-content-primary">
 Total ({sortedData.length} movimento(s))
 </td>
 <td className="px-4 py-3 text-sm text-right">
 <span className="font-bold text-green-700 dark:text-green-400">
 {viewMode === 'monetary'
 ? `+${(totals.entryValue ?? 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')}`
 : `+${(totals.entry ?? 0).toFixed(2)}`}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-right">
 <span className="font-bold text-red-700 dark:text-red-400">
 {viewMode === 'monetary'
 ? `-${(totals.exitValue ?? 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')}`
 : `-${(totals.exit ?? 0).toFixed(2)}`}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-right">
 <span className="font-bold text-blue-700 dark:text-blue-400">
 {viewMode === 'monetary'
 ? (totals.balanceValue ?? 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/MZN/gi, 'MT')
 : (totals.balance ?? 0).toFixed(2)}
 </span>
 </td>
 <td className="px-4 py-3"></td>
 </tr>
 )}
 </>
 )}
 </tbody>
 </table>
 </div>

 {/* Paginação */}
 {
 totalPages > 1 && (
 <div className="mt-6">
 <Pagination
 mode="full"
 currentPage={movementCurrentPage}
 totalItems={sortedData.length}
 itemsPerPage={movementItemsPerPage}
 onPageChange={setMovementCurrentPage}
 showRangeText={true}
 />
 </div>
 )
 }
 </div >
 );
 })()}
 </div >
 );
 })()}

 {activeTab === 'settings' && (
 <div className="max-w-2xl mx-auto p-6 space-y-6">
 <div className="bg-surface-raised rounded-xl border border-border-default shadow-sm overflow-hidden">
 <div className="px-6 py-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Valorização de Stock</h3>
 <p className="text-sm text-content-secondary mt-1">
 Define como o custo das saídas (vendas, ajustes) é calculado a partir dos lotes em stock.
 </p>
 </div>
 <div className="p-6">
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Método de valorização
 </label>
 <select
 value={valuationMethod}
 onChange={(e) => handleValuationMethodChange(e.target.value as ValuationMethod)}
 disabled={valuationSaving}
 className="w-full max-w-md px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
 >
 <option value="fifo">FIFO (Primeiro a entrar, primeiro a sair)</option>
 <option value="lifo">LIFO (Último a entrar, primeiro a sair)</option>
 <option value="average">Custo médio ponderado</option>
 <option value="standard_cost">Custo padrão (produto)</option>
 </select>
 {valuationSaving && (
 <p className="mt-2 text-sm text-content-muted flex items-center gap-2">
 <Loader2 className="w-4 h-4 animate-spin" /> A guardar...
 </p>
 )}
 <p className="mt-4 text-xs text-content-muted">
 O método seleccionado afecta o custo das vendas e o valor do stock final nos relatórios.
 </p>
 </div>
 </div>
 <div className="hidden">
 <button onClick={() => setActiveTab('products')} className="p-1.5 rounded transition-colors bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted" title="Produtos"><Package className="w-4 h-4" /></button>
 <button onClick={() => setActiveTab('movements')} className="p-1.5 rounded transition-colors bg-transparent text-content-muted hover:text-content-secondary dark:text-content-muted dark:hover:text-content-muted" title="Movimentos"><BarChart3 className="w-4 h-4" /></button>
 <button onClick={() => setActiveTab('settings')} className="p-1.5 rounded transition-colors bg-brand-600 text-white" title="Configurações"><Settings className="w-4 h-4" /></button>
 </div>
 </div>
 )}

 {/* Modal Detalhes do Pedido (só leitura) */}
 {detailOrder && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
 <div className="bg-surface-raised rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
 <div className="bg-surface-base /50 p-4 border-b border-border-default flex justify-between items-center flex-shrink-0">
 <h3 className="font-bold text-content-primary text-lg">Detalhes do Pedido</h3>
 <button onClick={() => setDetailOrder(null)} className="text-content-muted hover:text-content-secondary dark:hover:text-content-muted p-2 rounded-full hover:bg-surface-base">
 <XCircle className="w-6 h-6" />
 </button>
 </div>
 <div className="p-6 overflow-y-auto flex-1 text-sm">
 <p className="text-xs text-content-muted mb-4">ID: {detailOrder.externalId || detailOrder.id}</p>
 <div className="flex items-center gap-2 mb-4 p-3 bg-surface-base /50 rounded-lg">
 <span className="font-medium text-content-secondary">Status:</span>
 <span className="text-content-primary">{String(detailOrder.status)}</span>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <p className="text-xs text-content-muted uppercase">Cliente</p>
 <p className="font-medium text-content-primary">{detailOrder.customerName}</p>
 <p className="text-content-secondary">{detailOrder.customerPhone}</p>
 </div>
 <div className="text-right">
 <p className="text-xs text-content-muted uppercase">Data</p>
 <p className="text-content-primary">{formatDateOnly(detailOrder.createdAt)}</p>
 </div>
 </div>
 {detailOrder.isDelivery && detailOrder.deliveryLocation && (
 <div className="mb-4 p-3 bg-surface-base /50 rounded-lg">
 <p className="text-xs text-content-muted uppercase mb-1">Entrega</p>
 <p className="text-content-primary">{detailOrder.deliveryLocation}</p>
 {detailOrder.deliveryFee != null && detailOrder.deliveryFee > 0 && (
 <p className="text-content-secondary mt-1">Taxa: {formatMoney(detailOrder.deliveryFee)}</p>
 )}
 </div>
 )}
 {detailOrder.orderNumber && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase">Nº Pedido</p>
 <p className="font-medium text-content-primary">{detailOrder.orderNumber}</p>
 </div>
 )}
 {(detailOrder.paymentStatus || detailOrder.amountPaid != null) && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase">Pagamento</p>
 <p className="text-content-primary">{detailOrder.paymentStatus === 'paid' ? 'Pago' : detailOrder.paymentStatus === 'partial' ? 'Parcial' : 'Não pago'}</p>
 {detailOrder.amountPaid != null && detailOrder.amountPaid > 0 && (
 <p className="text-content-secondary">{formatMoney(detailOrder.amountPaid)} / {formatMoney(detailOrder.totalAmount)}</p>
 )}
 </div>
 )}
 {detailOrder.paymentProofText && (
 <div className="mb-4 p-3 bg-surface-base /50 rounded-lg">
 <p className="text-xs text-content-muted uppercase mb-1">Comprovativo</p>
 <p className="text-content-secondary text-sm">{detailOrder.paymentProofText}</p>
 </div>
 )}
 {detailOrder.notes && (
 <div className="mb-4">
 <p className="text-xs text-content-muted uppercase">Observações</p>
 <p className="text-content-secondary">{detailOrder.notes}</p>
 </div>
 )}
 <div className="border-t border-border-default pt-4">
 <h4 className="font-bold text-content-secondary text-sm mb-3">Itens</h4>
 <div className="space-y-2">
 {detailOrder.items.map((item, i) => (
 <div key={i} className="flex justify-between text-sm">
 <span className="text-content-secondary">
 <span className="font-medium text-content-primary">{item.quantity}{item.unit || 'un'}</span>
 {' '}{item.productName}{item.variantName ? ` ${item.variantName}` : ''}
 </span>
 <span className="font-medium text-content-primary">
 {formatMoney(((item as { priceAtTime?: number }).priceAtTime ?? item.price) * item.quantity)}
 </span>
 </div>
 ))}
 </div>
 <div className="flex justify-between items-center mt-4 pt-3 border-t border-border-default">
 <span className="font-bold text-content-primary">Total</span>
 <span className="font-bold text-lg text-content-primary">{formatMoney(detailOrder.totalAmount)}</span>
 </div>
 </div>
 </div>
 <div className="p-4 border-t border-border-default flex-shrink-0">
 <button onClick={() => setDetailOrder(null)} className="w-full px-4 py-2 bg-gray-600 hover:bg-border-strong dark:hover:bg-surface-base0 text-white rounded-lg font-medium">
 Fechar
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Modal Detalhes da Compra (só leitura) */}
 {detailPurchase && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4" onClick={() => setDetailPurchase(null)}>
 <div className="bg-surface-raised rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
 <div className="p-6 border-b border-border-default flex justify-between items-center flex-shrink-0">
 <h2 className="text-xl font-bold text-content-primary">Detalhes da Compra</h2>
 <button onClick={() => setDetailPurchase(null)} className="text-content-muted hover:text-content-secondary dark:hover:text-content-muted p-2 rounded-full hover:bg-surface-base">
 <XCircle className="w-6 h-6" />
 </button>
 </div>
 <div className="p-6 overflow-y-auto flex-1 space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data</label>
 <p className="text-content-primary">{formatDateOnly(detailPurchase.date || detailPurchase.orderDate || '')}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Fornecedor</label>
 <p className="text-content-primary">{detailPurchase.supplierName || 'Sem fornecedor'}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Fatura</label>
 <p className="text-content-primary">{detailPurchase.invoiceNumber || '—'}</p>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">Itens</label>
 <div className="overflow-x-auto rounded-lg border border-border-default">
 <table className="w-full text-sm text-left">
 <thead className="bg-surface-base text-content-secondary">
 <tr>
 <th className="px-3 py-2 font-medium">Produto</th>
 <th className="px-3 py-2 font-medium">Variação</th>
 <th className="px-3 py-2 font-medium text-right">Qtd</th>
 <th className="px-3 py-2 font-medium">Unidade</th>
 <th className="px-3 py-2 font-medium text-right">Preço unit.</th>
 <th className="px-3 py-2 font-medium text-right">Total</th>
 </tr>
 </thead>
 <tbody className="text-content-primary divide-y divide-gray-200 dark:divide-gray-600">
 {(() => {
 const groups = new Map<string, { items: typeof detailPurchase.items; totalQty: number; totalValue: number }>();
 for (const item of detailPurchase.items) {
 const key = item.productName ?? item.productId ?? '';
 if (!groups.has(key)) groups.set(key, { items: [], totalQty: 0, totalValue: 0 });
 const g = groups.get(key)!;
 g.items.push(item);
 g.totalQty += item.quantity;
 g.totalValue += (item.total ?? item.totalPrice ?? item.quantity * (item.costPrice ?? item.unitPrice ?? 0));
 }
 const rows: React.ReactNode[] = [];
 groups.forEach((group, productName) => {
 group.items.forEach((item, i) => {
 rows.push(
 <tr key={`${productName}-${i}`} className="bg-surface-raised">
 <td className="px-3 py-2">{i === 0 ? item.productName : '—'}</td>
 <td className="px-3 py-2">{item.variant ?? '—'}</td>
 <td className="px-3 py-2 text-right">{item.quantity}</td>
 <td className="px-3 py-2">{item.unit ?? 'un'}</td>
 <td className="px-3 py-2 text-right">{formatMoney(item.costPrice ?? item.unitPrice ?? 0)}</td>
 <td className="px-3 py-2 text-right">{formatMoney(item.total ?? item.totalPrice ?? item.quantity * (item.unitPrice ?? item.costPrice ?? 0))}</td>
 </tr>
 );
 });
 rows.push(
 <tr key={`sub-${productName}`} className="bg-surface-base font-medium">
 <td className="px-3 py-2" colSpan={2}>Subtotal: {productName}</td>
 <td className="px-3 py-2 text-right">{group.totalQty}</td>
 <td className="px-3 py-2">—</td>
 <td className="px-3 py-2 text-right">—</td>
 <td className="px-3 py-2 text-right">{formatMoney(group.totalValue)}</td>
 </tr>
 );
 });
 return rows;
 })()}
 </tbody>
 </table>
 </div>
 </div>
 <div className="pt-2 border-t border-border-default">
 <div className="flex justify-between items-center">
 <span className="text-lg font-semibold text-content-primary">Total</span>
 <span className="text-lg font-semibold text-green-600 dark:text-green-400">{formatMoney(detailPurchase.totalAmount)}</span>
 </div>
 </div>
 {detailPurchase.notes && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Notas</label>
 <p className="text-content-primary">{detailPurchase.notes}</p>
 </div>
 )}
 </div>
 <div className="p-4 border-t border-border-default flex-shrink-0">
 <button onClick={() => setDetailPurchase(null)} className="w-full px-4 py-2 bg-gray-600 hover:bg-border-strong dark:hover:bg-surface-base0 text-white rounded-lg font-medium">
 Fechar
 </button>
 </div>
 </div>
 </div>
 )}

 <CreateMovementModal
 open={isCreateMovementModalOpen}
 onClose={() => {
 setIsCreateMovementModalOpen(false);
 setEditingMovement(null);
 }}
 products={products}
 editingMovement={editingMovement}
 onSave={handleSaveMovementFromModal}
 saving={loading}
 />

 {/* Modal de Validação de Integridade */}
 <StockIntegrityModal
 open={isIntegrityModalOpen}
 onClose={() => setIsIntegrityModalOpen(false)}
 showToast={showToast}
 onRefresh={() => loadStockMovements()}
 />
 </PageShell >
 );
};
