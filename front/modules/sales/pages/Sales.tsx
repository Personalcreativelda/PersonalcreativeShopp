import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sale, SaleItem, Product, Order, OrderStatus, SaleType } from '../../core/types/types';
import { Plus, Search, Upload, Loader2, Edit2, Eye, Trash2, Save, X, Calendar, DollarSign, Package, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Image as ImageIcon, CheckSquare, Square, BarChart3, FileText, Grid3x3, List, Download, LayoutGrid, Table, Filter, FileSpreadsheet, Check, RefreshCw, ShoppingCart } from 'lucide-react';
import { dataService } from '../../core/services/dataService';
import { parseProductName, normalizeForSearch, hasPaymentProof, getPaidAmount } from '../../core/services/serviceUtils';
import { Toast } from '../../core/components/ui/Toast';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';
import { ModalPortal } from '../../core/components/ui/ModalPortal';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, ViewModeToggle, ItemsPerPageSelect, SelectFilter } from '../../core/components/filters';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { useMobile } from '../../core/hooks/useMobile';
import jsPDF from 'jspdf';
import { createWorkbook, addWorksheet, addJsonToSheetAt, writeWorkbookToFile, readWorkbookToCsv } from '../../core/services/excelService';
import { addPDFHeader, addPDFFooter, getBrandColors, addExcelHeader, formatExcelTableHeaders, formatExcelDataCells, addExcelFooter } from '../../core/services/reportService';
import { formatDateTime, formatDateOnly, formatDateWithOptions, getTodayDateString, toDateStringInTimezone } from '../../core/utils/dateUtils';

interface SalesProps {
 sales: Sale[];
 products: Product[];
 orders: Order[];
 totalSalesCount?: number | null;
 onAddSale: (sale: Sale) => void;
 onUpdateSale?: (sale: Sale) => void;
 onDeleteSale?: (saleId: string) => void;
 onDeleteSales?: (saleIds: string[]) => void;
 onImportComplete?: () => void;
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
 defaultTab?: TabType;
}

type SortField = 'date' | 'totalSales' | 'totalDeliveries' | 'received' | 'difference';
type SortDirection = 'asc' | 'desc';
type TabType = 'summaries' | 'byProduct';
type ProductSortField = 'product' | 'quantity' | 'value' | 'orderCount' | 'lastSale';
type ProductGroupMode = 'with-variants' | 'without-variants';

interface ProductSaleSummary {
 productId: string;
 productName: string;
 variant: string | null;
 totalQuantity: number;
 totalValue: number;
 orderCount: number;
 customers: Array<{ id: string; name: string }>;
 lastSaleDate: string;
}

export const Sales: React.FC<SalesProps> = ({ 
 sales, 
 products,
 orders,
 totalSalesCount,
 onAddSale, 
 onUpdateSale, 
 onDeleteSale, 
 onDeleteSales,
 onImportComplete,
 showToast,
 defaultTab = 'summaries'
}) => {
 // Hook para detectar mobile
 const isMobile = useMobile(768);
 const [viewMode, setViewMode] = useState<'cards' | 'list'>(isMobile ? 'cards' : 'list');
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [createMode, setCreateMode] = useState<'fromOrders' | 'manual'>('fromOrders');
 const [ordersDate, setOrdersDate] = useState(getTodayDateString());

 // Selection State
 const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);

 // View Mode State
 const [viewingSale, setViewingSale] = useState<Sale | null>(null);
 const [isViewModalOpen, setIsViewModalOpen] = useState(false);
 const [isUpdatingSummary, setIsUpdatingSummary] = useState(false);

 // Edit Mode State
 const [isEditing, setIsEditing] = useState(false);
 const [editSaleData, setEditSaleData] = useState<Sale | null>(null);
 const [editProductSearchQuery, setEditProductSearchQuery] = useState('');
 const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

 // Manual Form State
 const [newSaleDate, setNewSaleDate] = useState(getTodayDateString());
 const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
 const [productSearchQuery, setProductSearchQuery] = useState('');
 const [newSaleNotes, setNewSaleNotes] = useState('');
 const [newSaleTotalDeliveries, setNewSaleTotalDeliveries] = useState(0);
 const [newSaleValueReceived, setNewSaleValueReceived] = useState<number | undefined>(undefined);
 
 
 // WhatsApp/Image Import State
 const [isImporting, setIsImporting] = useState(false);
 const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
 const [importResult, setImportResult] = useState<{success: number, errors: number, details?: string[]} | null>(null);
 const [showImportDetails, setShowImportDetails] = useState(false);
 const [imageFile, setImageFile] = useState<File | null>(null);
 const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null);
 const [spreadsheetFile, setSpreadsheetFile] = useState<File | null>(null);
 const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
 
 // Preview State
 const [previewData, setPreviewData] = useState<{
 sales: Array<{
 date: string;
 items: Array<{
 originalText: string;
 productName: string;
 quantity: number;
 unit: string;
 price: number;
 total: number;
 matchedProduct: Product | null;
 needsManualMatch: boolean;
 }>;
 totalSales: number;
 totalDeliveries: number;
 notes?: string;
 isDuplicate?: boolean;
 }>;
 errors: string[];
 } | null>(null);
 const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
 const [editingPreviewSaleIndex, setEditingPreviewSaleIndex] = useState<number | null>(null);
 const [productMatchModal, setProductMatchModal] = useState<{
 isOpen: boolean;
 saleIndex: number;
 itemIndex: number;
 searchQuery: string;
 }>({
 isOpen: false,
 saleIndex: -1,
 itemIndex: -1,
 searchQuery: ''
 });


 // Filters State
 const [searchQuery, setSearchQuery] = useState('');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('all');
 const [filterDateFrom, setFilterDateFrom] = useState<string>('');
 const [filterDateTo, setFilterDateTo] = useState<string>('');
 const [filterSaleType, setFilterSaleType] = useState<SaleType | 'ALL'>('ALL');
 const [showFilters, setShowFilters] = useState(false);
 

 // Sorting State
 const [sortField, setSortField] = useState<SortField>('date');
 const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

 // Pagination State
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(12);
 
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

 // Sync state
 const [isSyncing, setIsSyncing] = useState(false);

 const navigate = useNavigate();

 // Tab: Resumos | Por Produto - sincronizado com a rota (defaultTab muda sem remontar)
 const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
 useEffect(() => { setActiveTab(defaultTab); }, [defaultTab]);

 const switchTab = (tab: TabType) => {
 if (tab === 'summaries') navigate('/admin/vendas');
 else navigate('/admin/vendas/por-produto');
 };
 // By-product tab state
 const [byProductSearchQuery, setByProductSearchQuery] = useState('');
 const [productGroupMode, setProductGroupMode] = useState<ProductGroupMode>('with-variants');
 const [productSortField, setProductSortField] = useState<ProductSortField>('product');
 const [productSortDirection, setProductSortDirection] = useState<SortDirection>('desc');
 const [productCurrentPage, setProductCurrentPage] = useState(1);
 const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductSaleSummary | null>(null);
 const [isProductHistoryModalOpen, setIsProductHistoryModalOpen] = useState(false);
 const [filterOrderStatus, setFilterOrderStatus] = useState<string>('ALL');

 const formatMoney = (value: number) => {
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 const shouldIncludeInTotals = (order: Order): boolean => {
 // Excluir pedidos cancelados dos totais
 const status = order.status?.toString() || '';
 return status !== OrderStatus.CANCELLED && status !== 'Cancelado';
 };

 // ------------------------------------------------------------------
 // FILTER HELPERS
 // ------------------------------------------------------------------
 // Funçéo auxiliar para obter intervalo de datas do peré­odo
 const getDateRangeFromPeriod = (period: PeriodOption, customStart?: string, customEnd?: string): { start: Date; end: Date } => {
 const today = new Date();
 let start = new Date();
 let end = new Date();

 switch (period) {
 case 'all':
 start = new Date(2000, 0, 1);
 start.setHours(0, 0, 0, 0);
 end = new Date(2099, 11, 31);
 end.setHours(23, 59, 59, 999);
 break;
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

 // ------------------------------------------------------------------
 // SORTING HELPERS
 // ------------------------------------------------------------------
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

 // Auto-calculate valueReceived from orders payments when date changes
 useEffect(() => {
 if (!ordersDate || !isModalOpen) return;
 
 const selectedDate = new Date(ordersDate);
 selectedDate.setHours(0, 0, 0, 0);
 
 const ordersOfDate = orders.filter(order => {
 const orderDate = new Date(order.createdAt);
 orderDate.setHours(0, 0, 0, 0);
 return orderDate.getTime() === selectedDate.getTime() && shouldIncludeInTotals(order);
 });

 if (ordersOfDate.length > 0) {
 let totalPaymentsReceived = 0;
 
 ordersOfDate.forEach(order => {
 // Usar helper getPaidAmount para calcular valor recebido (considera comprovativos)
 totalPaymentsReceived += getPaidAmount(order);
 });
 
 // Auto-fill valueReceived if not manually set and there are payments
 if (newSaleValueReceived === undefined && totalPaymentsReceived > 0) {
 setNewSaleValueReceived(totalPaymentsReceived);
 }
 }
 }, [ordersDate, orders, isModalOpen]); // Only recalculate when date or orders change

 // Export sale summary to PDF
 const exportSaleToPDF = async (sale: Sale) => {
 try {
 showToast('Gerando PDF...', 'info');
 
 const pdf = new jsPDF('p', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 15;

 // Sale Date
 const saleDate = new Date(sale.date);
 const dateStr = formatDateWithOptions(saleDate, { 
 day: '2-digit', 
 month: '2-digit', 
 year: 'numeric' 
 });

 // Adicionar cabeçalho com branding
 const filters: Array<{ label: string; value: string }> = [
 { label: 'Data da Venda', value: dateStr },
 { label: 'Total de Itens', value: sale.items.length.toString() }
 ];

 let yPos = await addPDFHeader(pdf, 'Resumo de Venda', {
 period: dateStr,
 filters,
 orientation: 'portrait',
 });

 // Items Table Header com branding
 yPos += 5;
 const colors = getBrandColors();
 pdf.setFontSize(11);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(...colors.primaryRgb);
 pdf.text('Itens', margin, yPos);
 yPos += 6;

 // Calcular largura disponé­vel e proporçéµes das colunas
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = [3.0, 1.2, 0.8, 1.0, 1.5, 1.5]; // Product, Variação, Qtd, Unit, Unit Price, Total
 const totalProportion = colProportions.reduce((sum, prop) => sum + prop, 0);
 const colWidths = colProportions.map(prop => (prop / totalProportion) * availableWidth);
 
 // Calcular posiçéµes X das colunas
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 // Table headers com cor da marca
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255); // Branco
 
 // Desenhar reté¢ngulo de fundo para cabeçalho
 pdf.setFillColor(...colors.primaryRgb);
 pdf.rect(margin, yPos - 4, availableWidth, 6, 'F');
 
 pdf.text('Produto', colX[0], yPos);
 pdf.text('Variação', colX[1], yPos);
 pdf.text('Qtd', colX[2], yPos);
 pdf.text('Un', colX[3], yPos);
 pdf.text('Preço Unit.', colX[4], yPos);
 pdf.text('Total', colX[5], yPos);
 
 // Linha sob cabeçalho
 yPos += 3;
 pdf.setDrawColor(...colors.primaryRgb);
 pdf.setLineWidth(0.5);
 pdf.line(margin, yPos, pdfWidth - margin, yPos);
 yPos += 5;

 // Agrupar por productId para juntar todas as variações do mesmo produto; fallback para productName
 const groups = new Map<string, { items: typeof sale.items; totalQty: number; totalValue: number; displayName: string }>();
 for (const item of sale.items) {
 const key = item.productId ?? item.productName ?? '';
 if (!groups.has(key)) {
 groups.set(key, { items: [], totalQty: 0, totalValue: 0, displayName: item.productName || '' });
 }
 const g = groups.get(key)!;
 g.items.push(item);
 g.totalQty += item.quantity;
 g.totalValue += (item.total ?? item.quantity * item.price);
 if (item.productName && (!g.displayName || item.productName.length < g.displayName.length)) {
 g.displayName = item.productName;
 }
 }

 // Items com alterné¢ncia de cores (itens + linhas de subtotal)
 pdf.setFont('helvetica', 'normal');
 pdf.setFontSize(9);
 pdf.setTextColor(0, 0, 0); // Preto
 let lineIndex = 0;
 const maxProductLength = Math.floor(colWidths[0] / 2);

 groups.forEach((group, key) => {
 const displayName = group.displayName || key;
 group.items.forEach((item, i) => {
 if (yPos > pdfHeight - 40) {
 pdf.addPage();
 yPos = margin;
 }
 const isEvenRow = lineIndex % 2 === 0;
 if (isEvenRow) {
 pdf.setFillColor(249, 250, 251); // Cinza muito claro
 pdf.rect(margin, yPos - 3, availableWidth, 4, 'F');
 }
 const productLabel = i === 0
 ? (displayName.length > maxProductLength ? displayName.substring(0, maxProductLength - 3) + '...' : displayName)
 : '—';
 const variantLabel = item.variantName ?? '—';
 const itemTotal = item.total ?? item.quantity * item.price;
 pdf.text(productLabel, colX[0], yPos);
 pdf.text(variantLabel, colX[1], yPos);
 pdf.text(item.quantity.toString(), colX[2], yPos);
 pdf.text(item.unit || 'un', colX[3], yPos);
 pdf.text(formatMoney(item.price), colX[4], yPos);
 pdf.setFont('helvetica', 'bold');
 pdf.text(formatMoney(itemTotal), colX[5], yPos);
 pdf.setFont('helvetica', 'normal');
 yPos += 6;
 lineIndex += 1;
 });
 // Linha Subtotal: {displayName}
 if (yPos > pdfHeight - 40) {
 pdf.addPage();
 yPos = margin;
 }
 pdf.setFillColor(243, 244, 246); // bg-surface-base
 pdf.rect(margin, yPos - 3, availableWidth, 4, 'F');
 pdf.setFont('helvetica', 'bold');
 const subLabel = `Subtotal: ${displayName.length > maxProductLength ? displayName.substring(0, maxProductLength - 3) + '...' : displayName}`;
 pdf.text(subLabel, colX[0], yPos);
 pdf.text('—', colX[1], yPos);
 pdf.text(group.totalQty.toString(), colX[2], yPos);
 pdf.text('—', colX[3], yPos);
 pdf.text('—', colX[4], yPos);
 pdf.text(formatMoney(group.totalValue), colX[5], yPos);
 pdf.setFont('helvetica', 'normal');
 yPos += 6;
 lineIndex += 1;
 });

 // Totals section com destaque
 yPos += 5;
 if (yPos > pdfHeight - 60) {
 pdf.addPage();
 yPos = margin;
 }

 // Linha separadora com cor da marca
 pdf.setDrawColor(...colors.primaryRgb);
 pdf.setLineWidth(0.5);
 pdf.line(margin, yPos, pdfWidth - margin, yPos);
 yPos += 8;

 pdf.setFontSize(11);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(...colors.primaryRgb);
 pdf.text('Resumo Financeiro', margin, yPos);
 yPos += 8;

 pdf.setFontSize(10);
 pdf.setTextColor(0, 0, 0); // Preto
 
 // Total Sales
 pdf.setFont('helvetica', 'bold');
 pdf.text('Total de Vendas:', margin, yPos);
 pdf.text(formatMoney(sale.totalSales), pdfWidth - margin, yPos, { align: 'right' });
 yPos += 7;

 // Total Deliveries
 if (sale.totalDeliveries > 0) {
 pdf.setFont('helvetica', 'normal');
 pdf.text('Total de Entregas:', margin, yPos);
 pdf.text(formatMoney(sale.totalDeliveries), pdfWidth - margin, yPos, { align: 'right' });
 yPos += 7;
 }

 // Value Received
 if (sale.valueReceived !== undefined && sale.valueReceived > 0) {
 pdf.text('Valor Recebido na Conta:', margin, yPos);
 pdf.text(formatMoney(sale.valueReceived), pdfWidth - margin, yPos, { align: 'right' });
 yPos += 7;
 }

 // Difference com cor condicional
 if (sale.difference !== undefined && sale.difference !== 0) {
 pdf.setFont('helvetica', 'bold');
 const diffColor = sale.difference < 0 
 ? [220, 53, 53] // Vermelho para negativo
 : [16, 185, 129]; // Verde da marca para positivo
 pdf.setTextColor(...diffColor);
 pdf.text('Diferença:', margin, yPos);
 pdf.text(formatMoney(sale.difference), pdfWidth - margin, yPos, { align: 'right' });
 pdf.setTextColor(0, 0, 0); // Reset color
 yPos += 7;
 }

 // Notes
 if (sale.notes) {
 yPos += 5;
 if (yPos > pdfHeight - 40) {
 pdf.addPage();
 yPos = margin;
 }
 
 pdf.setFontSize(11);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(...colors.primaryRgb);
 pdf.text('Notas:', margin, yPos);
 yPos += 6;
 
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0);
 const notesLines = pdf.splitTextToSize(sale.notes, pdfWidth - (margin * 2));
 notesLines.forEach((line: string) => {
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 }
 pdf.text(line, margin, yPos);
 yPos += 5;
 });
 }

 // Footer com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Generate filename
 const filename = `resumo_venda_${dateStr.replace(/\//g, '-')}.pdf`;
 
 // Save PDF
 pdf.save(filename);
 showToast('PDF gerado com sucesso!', 'success');
 } catch (error) {
 console.error('Erro ao gerar PDF:', error);
 showToast('Erro ao gerar PDF. Tente novamente.', 'error');
 }
 };

 // Handle spreadsheet upload
 const handleSpreadsheetUpload = async () => {
 if (!spreadsheetFile && !spreadsheetUrl) {
 showToast('Por favor, selecione uma planilha ou informe uma URL', 'error');
 return;
 }
 setIsImporting(true);
 
 try {
 let text = '';
 
 // If URL is provided, fetch from URL
 if (spreadsheetUrl) {
 try {
 showToast('Carregando planilha da URL...', 'info');
 const response = await fetch(spreadsheetUrl);
 if (!response.ok) {
 throw new Error(`Erro ao carregar URL: ${response.status} ${response.statusText}`);
 }
 text = await response.text();
 showToast('Planilha carregada da URL! Processando...', 'success');
 } catch (urlError: any) {
 console.error('Erro ao carregar URL:', urlError);
 showToast(`Erro ao carregar URL: ${urlError.message || 'Erro desconhecido'}. Verifique se a URL esté¡ acessé­vel publicamente.`, 'error');
 setIsImporting(false);
 return;
 }
 } else if (spreadsheetFile) {
 // Process file upload
 if (spreadsheetFile.name.endsWith('.csv')) {
 // Read CSV file
 text = await spreadsheetFile.text();
 } else if (spreadsheetFile.name.endsWith('.xlsx') || spreadsheetFile.name.endsWith('.xls')) {
 try {
 const arrayBuffer = await spreadsheetFile.arrayBuffer();
 text = await readWorkbookToCsv(arrayBuffer);
 } catch (excelError: any) {
 console.error('Erro ao processar Excel:', excelError);
 showToast(`Erro ao processar arquivo Excel: ${excelError.message || 'Erro desconhecido'}. Tente exportar como CSV.`, 'error');
 setIsImporting(false);
 return;
 }
 } else {
 showToast('Formato de arquivo néo suportado. Use CSV ou Excel (.csv, .xlsx, .xls)', 'error');
 setIsImporting(false);
 return;
 }
 }
 
 // Parse spreadsheet data
 const previewData = await dataService.parseSpreadsheetSalesSummary(text, products);
 
 // Mark duplicates in preview
 const previewWithDuplicates = {
 ...previewData,
 sales: previewData.sales.map(sale => ({
 ...sale,
 isDuplicate: isDuplicateSale(sale)
 }))
 };
 
 setPreviewData(previewWithDuplicates);
 setIsImporting(false);
 
 const duplicateCount = previewWithDuplicates.sales.filter(s => s.isDuplicate).length;
 if (previewData.errors.length > 0) {
 showToast(`Planilha processada! ${previewData.sales.length} resumo(s) encontrado(s) com ${previewData.errors.length} erro(s). Verifique os detalhes.`, 'warning');
 } else {
 if (duplicateCount > 0) {
 showToast(`âœ… Planilha processada! ${previewData.sales.length} resumo(s) encontrado(s)! ${duplicateCount} duplicado(s) detectado(s).`, 'warning');
 } else {
 showToast(`âœ… Planilha processada! ${previewData.sales.length} resumo(s) de venda encontrado(s)!`, 'success');
 }
 }
 } catch (error: any) {
 console.error('Erro ao processar planilha:', error);
 showToast(`Erro ao processar planilha: ${error.message || 'Erro desconhecido'}`, 'error');
 setIsImporting(false);
 }
 };

 // Handle image upload (OCR would be implemented here)
 const handleImageUpload = async () => {
 if (!imageFile) {
 showToast('Por favor, selecione uma imagem', 'error');
 return;
 }
 setIsImporting(true);
 setOcrProgress({ status: 'Inicializando OCR...', progress: 0 });
 
 try {
 // Dynamic import of Tesseract to avoid loading it if not needed
 const { createWorker } = await import('tesseract.js');
 
 setOcrProgress({ status: 'Carregando modelo de idioma...', progress: 10 });
 
 // Create Tesseract worker
 const worker = await createWorker('por'); // Portuguese language
 
 setOcrProgress({ status: 'Processando imagem...', progress: 30 });
 
 // Perform OCR on the image with progress callback
 // Note: We can't pass setState directly to worker, so we'll update progress after recognition
 const { data: { text } } = await worker.recognize(imageFile);
 
 setOcrProgress({ status: 'Finalizando...', progress: 95 });
 
 // Terminate worker
 await worker.terminate();
 
 if (!text || text.trim().length === 0) {
 showToast('Néo foi possé­vel extrair texto da imagem. Tente uma imagem com melhor qualidade.', 'error');
 setIsImporting(false);
 setOcrProgress(null);
 return;
 }
 
 // Debug: log extracted text (first 500 chars)
 console.log('Texto extraé­do pelo OCR (primeiros 500 caracteres):', text.substring(0, 500));
 console.log('Texto completo extraé­do:', text);
 
 setOcrProgress({ status: 'Processando texto extraído...', progress: 98 });
 
 // Importação por OCR/texto desativada – usar planilha Excel/CSV
 setPreviewData({ sales: [], errors: ['Importação por OCR/texto não disponível. Use planilha Excel ou CSV.'] });
 setIsImporting(false);
 setOcrProgress(null);
 showToast('Importação por imagem/OCR não disponível. Use planilha Excel ou CSV.', 'warning');
 } catch (error: any) {
 console.error('Erro ao processar imagem:', error);
 showToast(`Erro ao processar imagem: ${error.message || 'Erro desconhecido'}`, 'error');
 setIsImporting(false);
 setOcrProgress(null);
 }
 };

 // Check if sale is duplicate - improved version
 const isDuplicateSale = (previewSale: typeof previewData.sales[0]): boolean => {
 if (!previewSale.date) return false;
 
 // Parse date from DD.MM.YYYY format
 const dateParts = previewSale.date.split('.');
 if (dateParts.length !== 3) return false;
 
 const previewDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
 
 return sales.some(existingSale => {
 const existingDate = toDateStringInTimezone(new Date(existingSale.date));
 
 // Compare dates
 if (existingDate !== previewDate) return false;
 
 // Toleré¢ncia para valores moneté¡rios (0.01 MT)
 const amountTolerance = 0.01;
 const salesDiff = Math.abs(existingSale.totalSales - previewSale.totalSales);
 const deliveriesDiff = Math.abs((existingSale.totalDeliveries || 0) - (previewSale.totalDeliveries || 0));
 
 // Se os valores são muito diferentes, néo é© duplicado
 if (salesDiff > amountTolerance || deliveriesDiff > amountTolerance) return false;
 
 // Comparar néºmero de itens (se for muito diferente, pode néo ser o mesmo resumo)
 const itemsCountDiff = Math.abs(existingSale.items.length - previewSale.items.length);
 if (itemsCountDiff > 2) return false; // Permite diferença de até© 2 itens
 
 return true;
 });
 };

 // Save preview sales
 const handleSavePreviewSales = async () => {
 if (!previewData) return;
 
 // Filter out duplicates before processing
 const salesToProcess = previewData.sales.filter(s => !s.isDuplicate);
 const totalSales = salesToProcess.length;
 const duplicateCount = previewData.sales.length - totalSales;
 
 if (totalSales === 0) {
 showToast('Todos os resumos são duplicados. Nenhum resumo seré¡ salvo.', 'warning');
 return;
 }
 
 setIsImporting(true);
 setSaveProgress({ current: 0, total: totalSales, percentage: 0 });
 
 let successCount = 0;
 let errorCount = 0;
 const errors: string[] = [];
 const duplicates: string[] = [];
 
 const processSale = async (previewSale: typeof previewData.sales[0], index: number) => {
 try {
 // Parse date
 const dateParts = previewSale.date.split('.');
 const saleDate = dateParts.length === 3 
 ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`
 : getTodayDateString();
 
 // Double check if duplicate (shouldn't happen if we filtered, but just in case)
 if (isDuplicateSale(previewSale)) {
 duplicates.push(`Data ${previewSale.date}: Resumo jé¡ existe`);
 const current = index + 1;
 const percentage = Math.round((current / totalSales) * 100);
 setSaveProgress({ current, total: totalSales, percentage });
 return;
 }
 
 // Convert preview sale to Sale
 const saleItems: SaleItem[] = previewSale.items.map(item => {
 const productName = item.matchedProduct?.name || item.productName;
 const pricePerUnit = item.quantity > 0 ? item.total / item.quantity : item.price;
 const variantName = parseProductName(productName).variant ?? undefined;
 return {
 id: `item-${Math.random().toString(36).slice(2, 9)}`,
 productId: item.matchedProduct?.id,
 productName: productName,
 variantName,
 quantity: item.quantity,
 unit: item.unit,
 price: pricePerUnit,
 total: item.total
 };
 });
 
 const sale: Sale = {
 id: '',
 date: saleDate,
 items: saleItems,
 totalSales: previewSale.totalSales,
 totalDeliveries: previewSale.totalDeliveries || 0,
 createdAt: new Date().toISOString(),
 notes: previewSale.notes
 };
 
 const result = await dataService.createSale(sale);
 if (result.sale) {
 successCount++;
 } else {
 errorCount++;
 errors.push(`Data ${previewSale.date}: Falha ao criar.`);
 }
 } catch (e: any) {
 errorCount++;
 errors.push(`Data ${previewSale.date}: ${e.message}`);
 }
 
 const current = index + 1;
 const percentage = Math.round((current / totalSales) * 100);
 setSaveProgress({ current, total: totalSales, percentage });
 };
 
 // Process all sales sequentially (only non-duplicates)
 for (let i = 0; i < salesToProcess.length; i++) {
 await processSale(salesToProcess[i], i);
 if (i < salesToProcess.length - 1) {
 await new Promise(resolve => setTimeout(resolve, 10));
 }
 }
 
 setIsImporting(false);
 setImportResult({
 success: successCount,
 errors: errorCount,
 details: [...errors, ...(duplicateCount > 0 ? [`âš ï¸ ${duplicateCount} resumo(s) duplicado(s) ignorado(s)`] : [])]
 });
 
 let message = '';
 if (successCount > 0) {
 message = `âœ… ${successCount} resumo(s) salvo(s) com sucesso!`;
 if (duplicateCount > 0) {
 message += ` (${duplicateCount} duplicado(s) ignorado(s))`;
 }
 if (errorCount > 0) {
 message += ` (${errorCount} erro(s))`;
 }
 showToast(message, 'success');
 if (onImportComplete) {
 setTimeout(() => {
 onImportComplete();
 }, 1000);
 }
 } else if (duplicateCount > 0) {
 showToast(`âš ï¸ Todos os resumos jé¡ existem (${duplicateCount} duplicado(s) ignorado(s))`, 'warning');
 } else {
 showToast(`âŒ Nenhum resumo foi salvo. Verifique os erros.`, 'error');
 }
 
 setTimeout(() => {
 setSaveProgress(null);
 }, 2000);
 };

 // Manual form logic
 const handleAddItemManual = (productId: string) => {
 const product = products.find(p => p.id === productId);
 if (!product) return;
 const existing = selectedItems.find(i => i.productId === productId);
 if (existing) {
 setSelectedItems(selectedItems.map(i => 
 i.productId === productId 
 ? {...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price} 
 : i
 ));
 } else {
 setSelectedItems([...selectedItems, { 
 productId: product.id, 
 productName: product.name, 
 quantity: 1, 
 price: product.price,
 total: product.price,
 unit: product.unit
 }]);
 }
 };

 const handleUpdateItemQuantity = (productId: string, quantity: number) => {
 if (quantity <= 0) {
 setSelectedItems(selectedItems.filter(i => i.productId !== productId));
 } else {
 setSelectedItems(selectedItems.map(i => 
 i.productId === productId 
 ? {...i, quantity, total: quantity * i.price} 
 : i
 ));
 }
 };

 const handleUpdateItemPrice = (productId: string, price: number) => {
 if (price < 0) return;
 setSelectedItems(selectedItems.map(i => 
 i.productId === productId 
 ? {...i, price, total: i.quantity * price} 
 : i
 ));
 };

 const handleRemoveItem = (productId: string) => {
 setSelectedItems(selectedItems.filter(i => i.productId !== productId));
 };

 const calculateManualTotal = () => selectedItems.reduce((acc, item) => acc + item.total, 0);

 // Create sale from orders of a specific date
 const handleCreateFromOrders = async () => {
 if (!ordersDate) {
 showToast('Por favor, selecione uma data', 'error');
 return;
 }

 // Filter orders by date (compare only the date part, not time) and exclude cancelled
 const selectedDate = new Date(ordersDate);
 selectedDate.setHours(0, 0, 0, 0);
 
 const ordersOfDate = orders.filter(order => {
 const orderDate = new Date(order.createdAt);
 orderDate.setHours(0, 0, 0, 0);
 return orderDate.getTime() === selectedDate.getTime() && shouldIncludeInTotals(order);
 });

 if (ordersOfDate.length === 0) {
 showToast('Nenhum pedido encontrado para esta data (excluindo cancelados)', 'warning');
 return;
 }

 // Check if a sale summary already exists for this date
 try {
 console.log(`[handleCreateFromOrders] Verificando se existe resumo para data: ${ordersDate}`);
 const existingSale = await dataService.getSaleByDate(ordersDate);
 
 if (existingSale) {
 console.log(`[handleCreateFromOrders] ✅ Resumo existente encontrado (ID: ${existingSale.id}). Atualizando...`);
 // Update existing sale using syncDailySaleFromOrders
 // This will recalculate from orders and preserve notes/valueReceived if they were manually set
 const syncResult = await dataService.syncDailySaleFromOrders(ordersDate, true);
 
 if (syncResult.sale) {
 // Update the sale in the local state
 if (onUpdateSale) {
 onUpdateSale(syncResult.sale);
 }
 showToast(`Resumo existente atualizado com ${ordersOfDate.length} pedido(s) do dia`, 'success');
 resetModal();
 return;
 } else {
 console.error(`[handleCreateFromOrders] ❌ Erro ao atualizar resumo: ${syncResult.error}`);
 showToast(`Erro ao atualizar resumo existente: ${syncResult.error || 'Erro desconhecido'}`, 'error');
 return;
 }
 } else {
 console.log(`[handleCreateFromOrders] ℹ️ Nenhum resumo existente encontrado. Criando novo...`);
 }
 } catch (error: any) {
 console.error('[handleCreateFromOrders] ❌ Erro ao verificar resumo existente:', error);
 // Continue with creation if check fails
 }

 // No existing sale found, create new one
 // Group items by productId + variantId (align with syncDailySaleFromOrders)
 const itemsMap = new Map<string, SaleItem>();
 let totalDeliveries = 0;
 let totalPaymentsReceived = 0;

 ordersOfDate.forEach(order => {
 // Add delivery fee to total deliveries
 if (order.isDelivery && order.deliveryFee) {
 totalDeliveries += order.deliveryFee;
 }

 // Usar helper getPaidAmount para calcular valor recebido (considera comprovativos dos pedidos)
 totalPaymentsReceived += getPaidAmount(order);

 order.items.forEach(orderItem => {
 const key = `${orderItem.productId ?? ''}-${(orderItem as { variantId?: string }).variantId ?? ''}`;
 const pricePerUnit = (orderItem as { priceAtTime?: number }).priceAtTime ?? orderItem.price;
 const itemTotal = pricePerUnit * orderItem.quantity;
 if (itemsMap.has(key)) {
 const existingItem = itemsMap.get(key)!;
 existingItem.quantity += orderItem.quantity;
 (existingItem as SaleItem).total = ((existingItem as SaleItem).total ?? 0) + itemTotal;
 existingItem.price = ((existingItem as SaleItem).total ?? 0) / existingItem.quantity;
 } else {
 const variantName = (orderItem as { variantName?: string }).variantName ?? parseProductName(orderItem.productName).variant ?? undefined;
 itemsMap.set(key, {
 id: orderItem.id || `item-${Math.random().toString(36).slice(2, 9)}`,
 productId: orderItem.productId,
 productName: orderItem.productName,
 variantId: (orderItem as { variantId?: string }).variantId,
 variantName,
 quantity: orderItem.quantity,
 unit: orderItem.unit || 'un',
 price: pricePerUnit,
 total: itemTotal
 });
 }
 });
 });

 const saleItems = Array.from(itemsMap.values());
 const totalSales = saleItems.reduce((sum, item) => sum + item.total, 0);

 if (saleItems.length === 0) {
 showToast('Nenhum item encontrado nos pedidos desta data', 'warning');
 return;
 }

 // Use calculated payments if valueReceived is not manually set, otherwise use manual value
 const finalValueReceived = newSaleValueReceived !== undefined ? newSaleValueReceived : (totalPaymentsReceived > 0 ? totalPaymentsReceived : undefined);
 const difference = finalValueReceived !== undefined 
 ? finalValueReceived - (totalSales + totalDeliveries)
 : undefined;

 const newSale: Sale = {
 id: `s${Date.now()}`,
 date: ordersDate,
 items: saleItems,
 totalSales,
 totalDeliveries,
 valueReceived: finalValueReceived,
 difference,
 createdAt: new Date().toISOString(),
 notes: `Gerado a partir de ${ordersOfDate.length} pedido(s) do dia ${formatDateOnly(ordersDate)}`
 };

 onAddSale(newSale);
 showToast(`Resumo criado com sucesso a partir de ${ordersOfDate.length} pedido(s)`, 'success');
 resetModal();
 };

 const handleManualSubmit = () => {
 if (selectedItems.length === 0) {
 showToast('Por favor, adicione pelo menos um item é  venda', 'error');
 return;
 }
 
 const totalSales = calculateManualTotal();
 const totalDeliveries = newSaleTotalDeliveries || 0;
 const valueReceived = newSaleValueReceived;
 // Calcular diferença: valor recebido - (total de vendas + entregas)
 const difference = valueReceived !== undefined 
 ? valueReceived - (totalSales + totalDeliveries)
 : undefined;
 
 const newSale: Sale = {
 id: `s${Date.now()}`,
 date: newSaleDate,
 items: selectedItems,
 totalSales,
 totalDeliveries,
 valueReceived,
 difference,
 createdAt: new Date().toISOString(),
 notes: newSaleNotes || undefined
 };
 onAddSale(newSale);
 resetModal();
 };

 // Filter products by search query
 const filteredProducts = useMemo(() => {
 if (!productSearchQuery.trim()) return products;
 const query = normalizeForSearch(productSearchQuery);
 return products.filter(p => 
 normalizeForSearch(p.name).includes(query) ||
 (p.category && normalizeForSearch(p.category).includes(query))
 );
 }, [products, productSearchQuery]);

 const resetModal = () => {
 setIsModalOpen(false);
 setIsEditing(false);
 setEditSaleData(null);
 setEditingSaleId(null);
 setSelectedItems([]);
 setNewSaleDate(getTodayDateString());
 setNewSaleNotes('');
 setNewSaleTotalDeliveries(0);
 setNewSaleValueReceived(undefined);
 setOrdersDate(getTodayDateString());
 setImportResult(null);
 setPreviewData(null);
 setEditingPreviewSaleIndex(null);
 setProductMatchModal({ isOpen: false, saleIndex: -1, itemIndex: -1, searchQuery: '' });
 setProductSearchQuery('');
 setEditProductSearchQuery('');
 setSaveProgress(null);
 setIsImporting(false);
 setShowImportDetails(false);
 setCreateMode('fromOrders');
 };

 // Sincronizar TODOS os pedidos existentes como resumos
 const handleSyncAllFromOrders = async () => {
 const validOrders = orders.filter(o => {
 const s = o.status?.toString() || '';
 return s !== OrderStatus.CANCELLED && s !== 'Cancelado';
 });
 if (validOrders.length === 0) {
 showToast('Nenhum pedido válido para sincronizar', 'warning');
 return;
 }

 // Agrupar pedidos por data
 const ordersByDate = new Map<string, typeof orders>();
 for (const order of validOrders) {
 const raw = order.createdAt || '';
 const dateStr = raw ? toDateStringInTimezone(new Date(raw)) : null;
 if (!dateStr) continue;
 if (!ordersByDate.has(dateStr)) ordersByDate.set(dateStr, []);
 ordersByDate.get(dateStr)!.push(order);
 }
 if (ordersByDate.size === 0) { showToast('Não foram encontradas datas com pedidos', 'warning'); return; }

 setIsSyncing(true);
 let created = 0;
 let updated = 0;
 let skipped = 0;

 for (const [date, dayOrders] of Array.from(ordersByDate.entries()).sort()) {
 const itemsMap = new Map<string, SaleItem>();
 let totalDeliveries = 0;
 let totalPaymentsReceived = 0;

 for (const order of dayOrders) {
 const fee = Number((order as any).deliveryFee ?? 0) || 0;
 if (order.isDelivery && fee) totalDeliveries += fee;
 totalPaymentsReceived += getPaidAmount(order);
 for (const it of order.items || []) {
 const key = `${it.productId ?? ''}-${(it as any).variantId ?? ''}`;
 const p = Number((it as any).priceAtTime ?? it.price) || 0;
 const q = Number(it.quantity) || 0;
 const total = q * p;
 const ex = itemsMap.get(key);
 if (ex) {
 ex.quantity += q;
 ex.total = (ex.total ?? 0) + total;
 ex.price = (ex.total ?? 0) / ex.quantity;
 } else {
 const variantName = (it as any).variantName ?? parseProductName(it.productName || '').variant ?? undefined;
 itemsMap.set(key, { id: it.id || `i-${Math.random().toString(36).slice(2,9)}`, productId: it.productId, productName: it.productName, variantId: (it as any).variantId, variantName, quantity: q, price: p, unit: it.unit || 'un', total });
 }
 }
 }

 const saleItems = Array.from(itemsMap.values());
 if (saleItems.length === 0) { skipped++; continue; }

 const totalSalesAmt = saleItems.reduce((s, i) => s + (i.total ?? i.quantity * i.price), 0);
 const valueReceived = totalPaymentsReceived > 0 ? totalPaymentsReceived : undefined;
 const difference = valueReceived != null ? valueReceived - (totalSalesAmt + totalDeliveries) : undefined;

 const existingSale = sales.find(s => (s.date || '').split('T')[0] === date);
 const payload: Sale = {
 id: existingSale?.id ?? '',
 date,
 items: saleItems,
 totalSales: totalSalesAmt,
 totalDeliveries,
 valueReceived,
 difference,
 createdAt: existingSale?.createdAt ?? new Date().toISOString(),
 notes: existingSale?.notes ?? `Gerado de ${dayOrders.length} pedido(s) de ${formatDateOnly(date)}`
 };

 // dataService.createSale verifica internamente se já existe e atualiza
 const result = await dataService.createSale(payload);
 if (result.sale) {
 if (existingSale?.id && onUpdateSale) { onUpdateSale(result.sale); updated++; }
 else { onAddSale(result.sale); created++; }
 }
 }

 setIsSyncing(false);
 const total = created + updated;
 if (total > 0) {
 showToast(`✅ ${total} resumo(s) sincronizado(s) — ${created} novo(s), ${updated} atualizado(s)`, 'success');
 if (onImportComplete) setTimeout(() => onImportComplete(), 500);
 } else {
 showToast('Nenhum resumo foi criado (pedidos sem itens?)', 'warning');
 }
 };

 // Filtered and sorted sales
 const filteredAndSortedSales = useMemo(() => {
 let filtered = [...sales];

 // Filter by saleType
 if (filterSaleType !== 'ALL') {
 filtered = filtered.filter(sale => sale.saleType === filterSaleType);
 }

 // Search filter
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filtered = filtered.filter(sale => {
 const dateStr = formatDateOnly(sale.date);
 return normalizeForSearch(dateStr).includes(query) || 
 (sale.notes && normalizeForSearch(sale.notes).includes(query)) ||
 sale.items.some(item => normalizeForSearch(item.productName).includes(query));
 });
 }

 // Apply period filter using getDateRangeFromPeriod
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 filtered = filtered.filter(sale => {
 const saleDate = new Date(sale.date);
 saleDate.setHours(0, 0, 0, 0);
 const normalizedStart = new Date(start);
 normalizedStart.setHours(0, 0, 0, 0);
 const normalizedEnd = new Date(end);
 normalizedEnd.setHours(23, 59, 59, 999);
 return saleDate >= normalizedStart && saleDate <= normalizedEnd;
 });

 // Sort
 filtered.sort((a, b) => {
 let comparison = 0;

 switch (sortField) {
 case 'date':
 comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
 break;
 case 'totalSales':
 comparison = a.totalSales - b.totalSales;
 break;
 case 'totalDeliveries':
 comparison = (a.totalDeliveries || 0) - (b.totalDeliveries || 0);
 break;
 case 'received':
 comparison = (a.valueReceived || 0) - (b.valueReceived || 0);
 break;
 case 'difference':
 comparison = (a.difference || 0) - (b.difference || 0);
 break;
 default:
 return 0;
 }

 return sortDirection === 'asc' ? comparison : -comparison;
 });

 return filtered;
 }, [sales, searchQuery, filterPeriod, filterDateFrom, filterDateTo, sortField, sortDirection]);

 // Reset pagination when filters change
 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, filterPeriod, filterDateFrom, filterDateTo, filterSaleType, sortField, sortDirection]);

 // Pagination
 const totalPages = Math.ceil(filteredAndSortedSales.length / itemsPerPage);
 const paginatedSales = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredAndSortedSales.slice(start, start + itemsPerPage);
 }, [filteredAndSortedSales, currentPage, itemsPerPage]);

 // By-product: filter orders by period and status, then aggregate by product (and variant)
 const productSales = useMemo(() => {
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startNorm = new Date(start.getFullYear(), start.getMonth(), start.getDate());
 const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate());
 endNorm.setHours(23, 59, 59, 999);

 let filtered = orders.filter(order => {
 if (!shouldIncludeInTotals(order)) return false;
 if (filterOrderStatus !== 'ALL') {
 const s = (order.status?.toString() || '').toLowerCase();
 if (filterOrderStatus === 'delivered' && s !== 'delivered' && s !== 'entregue') return false;
 if (filterOrderStatus === 'pending' && s !== 'pending' && s !== 'pendente') return false;
 if (filterOrderStatus === 'processing' && s !== 'processing' && s !== 'em processamento') return false;
 }
 const orderDate = new Date(order.createdAt);
 orderDate.setHours(0, 0, 0, 0);
 return orderDate >= startNorm && orderDate <= endNorm;
 });

 const productMap = new Map<string, ProductSaleSummary>();
 const customerMap = new Map<string, Set<string>>();
 const orderIdsByProduct = new Map<string, Set<string>>();

 filtered.forEach(order => {
 (order.items || []).forEach((item: { productId: string; productName: string; variantName?: string; variant?: string; quantity: number; price?: number; priceAtTime?: number }) => {
 const variant = (item.variantName ?? (item as { variant?: string }).variant ?? '').trim() || null;
 const productKey = productGroupMode === 'without-variants'
 ? item.productId
 : `${item.productId}-${variant || 'no-variant'}`;

 if (!productMap.has(productKey)) {
 productMap.set(productKey, {
 productId: item.productId,
 productName: item.productName,
 variant: productGroupMode === 'without-variants' ? null : variant,
 totalQuantity: 0,
 totalValue: 0,
 orderCount: 0,
 customers: [],
 lastSaleDate: order.createdAt || ''
 });
 customerMap.set(productKey, new Set());
 orderIdsByProduct.set(productKey, new Set());
 }

 const summary = productMap.get(productKey)!;
 const unitPrice = (item as { priceAtTime?: number }).priceAtTime ?? item.price ?? 0;
 summary.totalQuantity += item.quantity || 0;
 summary.totalValue += (unitPrice * (item.quantity || 0));
 orderIdsByProduct.get(productKey)!.add(order.id);
 if (!customerMap.get(productKey)!.has(order.customerId)) {
 customerMap.get(productKey)!.add(order.customerId);
 summary.customers.push({ id: order.customerId, name: order.customerName || '' });
 }
 if (order.createdAt && (!summary.lastSaleDate || new Date(order.createdAt) > new Date(summary.lastSaleDate))) {
 summary.lastSaleDate = order.createdAt;
 }
 });
 });

 productMap.forEach((summary, key) => {
 const orderIds = orderIdsByProduct.get(key);
 summary.orderCount = orderIds ? orderIds.size : 0;
 });

 let result = Array.from(productMap.values());
 if (byProductSearchQuery.trim()) {
 const q = normalizeForSearch(byProductSearchQuery);
 result = result.filter(p =>
 normalizeForSearch(p.productName).includes(q) || (p.variant && normalizeForSearch(p.variant).includes(q))
 );
 }
 result.sort((a, b) => {
 let aVal: number | string, bVal: number | string;
 switch (productSortField) {
 case 'product':
 aVal = `${a.productName} ${a.variant || ''}`.toLowerCase();
 bVal = `${b.productName} ${b.variant || ''}`.toLowerCase();
 return productSortDirection === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
 case 'quantity':
 aVal = a.totalQuantity; bVal = b.totalQuantity; break;
 case 'value':
 aVal = a.totalValue; bVal = b.totalValue; break;
 case 'orderCount':
 aVal = a.orderCount; bVal = b.orderCount; break;
 case 'lastSale':
 aVal = new Date(a.lastSaleDate).getTime(); bVal = new Date(b.lastSaleDate).getTime(); break;
 default:
 return 0;
 }
 if (productSortDirection === 'asc') return (aVal as number) > (bVal as number) ? 1 : -1;
 return (aVal as number) < (bVal as number) ? 1 : -1;
 });
 return result;
 }, [orders, filterPeriod, filterDateFrom, filterDateTo, filterOrderStatus, productGroupMode, byProductSearchQuery, productSortField, productSortDirection]);

 const productSalesTotalPages = Math.ceil(productSales.length / itemsPerPage);
 const paginatedProductSales = useMemo(() => {
 const start = (productCurrentPage - 1) * itemsPerPage;
 return productSales.slice(start, start + itemsPerPage);
 }, [productSales, productCurrentPage, itemsPerPage]);

 // Totais da aba Por Produto (para os cards no fim da tabela)
 const byProductTotals = useMemo(() => {
 const quantity = productSales.reduce((acc, p) => acc + (p.totalQuantity ?? 0), 0);
 const value = productSales.reduce((acc, p) => acc + (p.totalValue ?? 0), 0);
 const orderCount = productSales.reduce((acc, p) => acc + (p.orderCount ?? 0), 0);
 return { quantity, value, orderCount, productCount: productSales.length };
 }, [productSales]);

 // Toggle selection
 const toggleSaleSelection = (saleId: string) => {
 setSelectedSaleIds(prev => 
 prev.includes(saleId) 
 ? prev.filter(id => id !== saleId)
 : [...prev, saleId]
 );
 };

 const toggleSelectAll = () => {
 if (selectedSaleIds.length === paginatedSales.length && 
 paginatedSales.every(s => selectedSaleIds.includes(s.id))) {
 setSelectedSaleIds([]); // Deselect all
 } else {
 setSelectedSaleIds(paginatedSales.map(s => s.id)); // Select all on current page
 }
 };

 // Delete functions
 const handleDeleteSale = (saleId: string) => {
 if (!onDeleteSale) return;
 setConfirmDialog({
 isOpen: true,
 message: 'Deseja realmente apagar este resumo de venda?',
 variant: 'danger',
 onConfirm: () => {
 onDeleteSale(saleId);
 setSelectedSaleIds(prev => prev.filter(id => id !== saleId));
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
 }
 });
 };

 const handleBulkDelete = () => {
 if (!onDeleteSales || selectedSaleIds.length === 0) return;
 setConfirmDialog({
 isOpen: true,
 message: `Deseja realmente apagar ${selectedSaleIds.length} resumo(s) de venda?`,
 variant: 'danger',
 onConfirm: () => {
 onDeleteSales(selectedSaleIds);
 setSelectedSaleIds([]);
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
 }
 });
 };

 // Edit functions
 const handleEditSale = (sale: Sale) => {
 const saleCopy = JSON.parse(JSON.stringify(sale));
 setEditSaleData(saleCopy);
 setEditingSaleId(sale.id);
 setIsEditing(true);
 setEditProductSearchQuery('');
 setIsModalOpen(true);
 };

 const handleUpdateSummaryFromOrders = async () => {
 if (!viewingSale?.date || !onUpdateSale) return;
 setIsUpdatingSummary(true);
 try {
 const syncResult = await dataService.syncDailySaleFromOrders(viewingSale.date, true);
 if (syncResult.sale) {
 onUpdateSale(syncResult.sale);
 setViewingSale(syncResult.sale);
 showToast('Resumo actualizado a partir dos pedidos do dia.', 'success');
 } else {
 showToast(syncResult.error || 'Erro ao actualizar resumo.', 'error');
 }
 } catch (e: unknown) {
 showToast('Erro ao actualizar resumo. Tente novamente.', 'error');
 } finally {
 setIsUpdatingSummary(false);
 }
 };

 const cancelEditing = () => {
 setIsEditing(false);
 setEditSaleData(null);
 setEditingSaleId(null);
 setIsModalOpen(false);
 };

 const saveEdit = () => {
 if (editSaleData && onUpdateSale) {
 if (editSaleData.items.length === 0) {
 showToast('Adicione pelo menos um item é  venda', 'error');
 return;
 }
 if (editSaleData.totalSales <= 0) {
 showToast('O valor total de vendas deve ser maior que zero', 'error');
 return;
 }
 // Recalculate total from items
 const calculatedTotal = editSaleData.items.reduce((sum, item) => sum + item.total, 0);
 editSaleData.totalSales = calculatedTotal;
 
 // Recalculate difference: valor recebido - (total de vendas + entregas)
 const totalDeliveries = editSaleData.totalDeliveries || 0;
 if (editSaleData.valueReceived !== undefined) {
 editSaleData.difference = editSaleData.valueReceived - (calculatedTotal + totalDeliveries);
 }
 
 onUpdateSale(editSaleData);
 cancelEditing();
 }
 };

 const handleEditItemChange = (index: number, field: keyof SaleItem, value: any) => {
 if (!editSaleData) return;
 const newItems = [...editSaleData.items];
 newItems[index] = { ...newItems[index], [field]: value };
 
 // Recalculate total if price or quantity changed
 if (field === 'price' || field === 'quantity') {
 newItems[index].total = newItems[index].quantity * newItems[index].price;
 }
 
 const newTotal = newItems.reduce((acc, item) => acc + item.total, 0);
 
 setEditSaleData({
 ...editSaleData,
 items: newItems,
 totalSales: newTotal
 });
 };

 const handleUpdateEditItemPrice = (index: number, price: number) => {
 if (price < 0) return;
 handleEditItemChange(index, 'price', price);
 };

 const handleUpdateEditItemQuantity = (index: number, quantity: number) => {
 if (quantity <= 0) {
 handleRemoveEditItem(index);
 return;
 }
 handleEditItemChange(index, 'quantity', quantity);
 };

 const handleRemoveEditItem = (index: number) => {
 if (!editSaleData) return;
 const newItems = editSaleData.items.filter((_, i) => i !== index);
 const newTotal = newItems.reduce((acc, item) => acc + item.total, 0);
 setEditSaleData({ ...editSaleData, items: newItems, totalSales: newTotal });
 };

 const handleAddEditItem = (productId: string) => {
 if (!editSaleData) return;
 const product = products.find(p => p.id === productId);
 if (!product) return;

 const existingIndex = editSaleData.items.findIndex(i => i.productId === productId);
 let newItems;
 if (existingIndex >= 0) {
 newItems = [...editSaleData.items];
 newItems[existingIndex].quantity += 1;
 newItems[existingIndex].total = newItems[existingIndex].quantity * newItems[existingIndex].price;
 } else {
 newItems = [...editSaleData.items, {
 productId: product.id,
 productName: product.name,
 quantity: 1,
 price: product.price,
 total: product.price,
 unit: product.unit
 }];
 }
 const newTotal = newItems.reduce((acc, item) => acc + item.total, 0);
 setEditSaleData({ ...editSaleData, items: newItems, totalSales: newTotal });
 };

 const handleAssociateProduct = (itemIndex: number, productId: string) => {
 if (!editSaleData) return;
 const product = products.find(p => p.id === productId);
 if (!product) return;

 const newItems = [...editSaleData.items];
 newItems[itemIndex] = {
 ...newItems[itemIndex],
 productId: product.id,
 productName: product.name,
 price: newItems[itemIndex].price || product.price,
 total: newItems[itemIndex].quantity * (newItems[itemIndex].price || product.price)
 };
 
 const newTotal = newItems.reduce((acc, item) => acc + item.total, 0);
 setEditSaleData({ ...editSaleData, items: newItems, totalSales: newTotal });
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

 // Funçéo para exportar vendas para Excel
 const exportToExcel = async () => {
 try {
 if (filteredAndSortedSales.length === 0) {
 showToast('Néo hé¡ vendas para exportar', 'warning');
 return;
 }

 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 // Preparar Informações do peré­odo e filtros
 const periodLabel = filterPeriod === 'custom'
 ? `${formatDateOnly(start)} a ${formatDateOnly(end)}`
 : filterPeriod === 'today' ? 'Hoje'
 : filterPeriod === 'yesterday' ? 'Ontem'
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
 filters.push({ label: 'Total de vendas', value: filteredAndSortedSales.length.toString() });

 // Preparar dados para exportaçéo
 const exportData = filteredAndSortedSales.map(sale => {
 const saleDate = new Date(sale.date);
 const totalAmount = sale.totalSales + (sale.totalDeliveries || 0);
 const difference = (sale.valueReceived || 0) - totalAmount;

 return {
 'Data': formatDateOnly(saleDate),
 'Itens': sale.items.length,
 'Vendas': sale.totalSales,
 'Entregas': sale.totalDeliveries || 0,
 'Total': totalAmount,
 'Recebido': sale.valueReceived || 0,
 'Diferença': difference,
 'Notas': sale.notes || '',
 'Produtos': sale.items.map(item => `${item.quantity}${item.unit} ${item.productName}`).join('; ')
 };
 });

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Vendas');

 const headerRow = await addExcelHeader(ws, 'Gestão de Vendas', {
 period: periodLabel,
 filters,
 startRow: 0,
 });

 const headers = ['Data', 'Itens', 'Vendas', 'Entregas', 'Total', 'Recebido', 'Diferença', 'Notas', 'Produtos'];
 formatExcelTableHeaders(ws, headers, headerRow, 0);

 const dataStartRow = headerRow + 1;
 addJsonToSheetAt(ws, exportData as Record<string, unknown>[], dataStartRow + 1, 1, { skipHeader: true });

 const dataEndRow = dataStartRow + exportData.length - 1;
 formatExcelDataCells(ws, dataStartRow, dataEndRow, 0, headers.length - 1, {
 alternateRowColors: true,
 numberFormat: '#,##0.00',
 });

 [12, 8, 15, 15, 15, 15, 15, 40, 60].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 await addExcelFooter(ws, dataEndRow, { showCompanyInfo: true });

 const periodLabelFile = filterPeriod === 'custom' 
 ? `${startStr}_${endStr}`
 : filterPeriod;
 const filename = `vendas_${periodLabelFile}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportaçéo para Excel conclué­da: ${filteredAndSortedSales.length} vendas`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 // Funçéo para exportar vendas para PDF
 const exportToPDF = async () => {
 try {
 if (filteredAndSortedSales.length === 0) {
 showToast('Néo hé¡ vendas para exportar', 'warning');
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
 : filterPeriod === 'yesterday' ? 'Ontem'
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
 filters.push({ label: 'Total de vendas', value: filteredAndSortedSales.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Gestão de Vendas', {
 period: periodLabel,
 filters,
 orientation: 'landscape',
 });

 // Totais com destaque
 const colors = getBrandColors();
 const totalSales = filteredAndSortedSales.reduce((sum, s) => sum + s.totalSales, 0);
 const totalDeliveries = filteredAndSortedSales.reduce((sum, s) => sum + (s.totalDeliveries || 0), 0);
 const totalReceived = filteredAndSortedSales.reduce((sum, s) => sum + (s.valueReceived || 0), 0);
 const totalDifference = totalReceived - totalSales - totalDeliveries;

 pdf.setFontSize(11);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(...colors.primaryRgb);
 pdf.text('Resumo:', margin, yPos);
 yPos += 6;
 
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0); // Preto
 pdf.text(`Vendas: ${formatMoney(totalSales)}`, margin, yPos);
 pdf.text(`Entregas: ${formatMoney(totalDeliveries)}`, margin + 60, yPos);
 pdf.text(`Total: ${formatMoney(totalSales + totalDeliveries)}`, margin + 120, yPos);
 pdf.text(`Recebido: ${formatMoney(totalReceived)}`, margin + 180, yPos);
 pdf.text(`Diferença: ${formatMoney(totalDifference)}`, margin + 240, yPos);
 yPos += 10;

 // Tabela de vendas com cabeçalho destacado
 // Calcular largura disponé­vel
 const availableWidth = pdfWidth - (margin * 2);
 
 // Proporçéµes relativas das colunas (baseadas na importé¢ncia/conteéºdo)
 const colProportions = [1.2, 0.8, 1.5, 1.5, 1.5, 1.5, 1.5, 2.5]; // 8 colunas
 const totalProportion = colProportions.reduce((sum, prop) => sum + prop, 0);
 
 // Calcular larguras proporcionais
 const colWidths = colProportions.map(prop => (prop / totalProportion) * availableWidth);
 
 // Calcular posiçéµes X das colunas
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 // Cabeçalho da tabela com cor da marca
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255); // Branco
 
 // Desenhar reté¢ngulo de fundo para cabeçalho
 pdf.setFillColor(...colors.primaryRgb);
 pdf.rect(margin, yPos - 4, pdfWidth - (margin * 2), 6, 'F');

 pdf.text('Data', colX[0], yPos);
 pdf.text('Itens', colX[1], yPos);
 pdf.text('Vendas', colX[2], yPos);
 pdf.text('Entregas', colX[3], yPos);
 pdf.text('Total', colX[4], yPos);
 pdf.text('Recebido', colX[5], yPos);
 pdf.text('Diferença', colX[6], yPos);
 pdf.text('Notas', colX[7], yPos);

 // Linha sob cabeçalho
 yPos += 3;
 pdf.setDrawColor(...colors.primaryRgb);
 pdf.setLineWidth(0.5);
 pdf.line(margin, yPos, pdfWidth - margin, yPos);
 yPos += 5;

 // Dados da tabela com alterné¢ncia de cores
 pdf.setFont('helvetica', 'normal');
 pdf.setFontSize(8);
 pdf.setTextColor(0, 0, 0); // Preto

 filteredAndSortedSales.forEach((sale, index) => {
 // Verificar se precisa de nova pé¡gina
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 }

 // Alterné¢ncia de cores nas linhas
 const isEvenRow = index % 2 === 0;
 if (isEvenRow) {
 pdf.setFillColor(249, 250, 251); // Cinza muito claro
 pdf.rect(margin, yPos - 3, pdfWidth - (margin * 2), 4, 'F');
 }

 const saleDate = new Date(sale.date);
 const totalAmount = sale.totalSales + (sale.totalDeliveries || 0);
 const difference = (sale.valueReceived || 0) - totalAmount;

 pdf.text(formatDateOnly(saleDate), colX[0], yPos);
 pdf.text(sale.items.length.toString(), colX[1], yPos);
 pdf.text(formatMoney(sale.totalSales), colX[2], yPos);
 pdf.text(formatMoney(sale.totalDeliveries || 0), colX[3], yPos);
 pdf.text(formatMoney(totalAmount), colX[4], yPos);
 pdf.text(formatMoney(sale.valueReceived || 0), colX[5], yPos);
 pdf.text(formatMoney(difference), colX[6], yPos);
 
 // Notas (truncar se muito longo)
 const notes = sale.notes || '';
 const maxNotesLength = 50;
 const truncatedNotes = notes.length > maxNotesLength ? notes.substring(0, maxNotesLength) + '...' : notes;
 pdf.text(truncatedNotes, colX[7], yPos);

 yPos += 5;
 });

 // Rodapé© com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 // Gerar nome do arquivo
 const periodLabelFile = filterPeriod === 'custom' 
 ? `${startStr}_${endStr}`
 : filterPeriod;
 const filename = `vendas_${periodLabelFile}_${getTodayDateString()}.pdf`;

 // Salvar arquivo
 pdf.save(filename);
 showToast(`Exportaçéo para PDF conclué­da: ${filteredAndSortedSales.length} vendas`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 const exportProductSalesToExcel = async () => {
 try {
 if (productSales.length === 0) {
 showToast('Não há produtos para exportar', 'warning');
 return;
 }
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
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
 if (byProductSearchQuery.trim()) filters.push({ label: 'Pesquisa', value: byProductSearchQuery });
 filters.push({ label: 'Total de produtos', value: productSales.length.toString() });
 const exportData = productSales.map(item => ({
 'Produto': item.productName,
 'Variação': item.variant || '',
 'Quantidade Total': item.totalQuantity,
 'Valor Total': item.totalValue,
 'Nº Vendas': item.orderCount,
 'Clientes': item.customers.map(c => c.name).join(', '),
 'Última Venda': formatDateOnly(item.lastSaleDate)
 }));
 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Vendas por Produto');
 const headerRow = await addExcelHeader(ws, 'Vendas por Produto', { period: periodLabel, filters, startRow: 0 });
 const headers = ['Produto', 'Variação', 'Quantidade Total', 'Valor Total', 'Nº Vendas', 'Clientes', 'Última Venda'];
 formatExcelTableHeaders(ws, headers, headerRow, 0);
 const dataStartRow = headerRow + 1;
 addJsonToSheetAt(ws, exportData as Record<string, unknown>[], dataStartRow + 1, 1, { skipHeader: true });
 const dataEndRow = dataStartRow + exportData.length - 1;
 formatExcelDataCells(ws, dataStartRow, dataEndRow, 0, headers.length - 1, { alternateRowColors: true, numberFormat: '#,##0.00' });
 [25, 20, 15, 15, 12, 30, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
 await addExcelFooter(ws, dataEndRow, { showCompanyInfo: true });
 const periodLabelFile = filterPeriod === 'custom' ? `${startStr}_${endStr}` : filterPeriod;
 const filename = `vendas_por_produto_${periodLabelFile}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação para Excel concluída: ${productSales.length} produtos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 const exportProductSalesToPDF = async () => {
 try {
 if (productSales.length === 0) {
 showToast('Não há produtos para exportar', 'warning');
 return;
 }
 showToast('Gerando PDF...', 'info');
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
 const periodLabel = `${formatDateOnly(start)} a ${formatDateOnly(end)}`;
 const pdf = new jsPDF('p', 'mm', 'a4');
 const margin = 15;
 const colors = getBrandColors();
 let yPos = await addPDFHeader(pdf, 'Vendas por Produto', { period: periodLabel, orientation: 'portrait' });
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255);
 pdf.setFillColor(...colors.primaryRgb);
 const colWidths = [45, 15, 22, 28, 18, 45];
 const totalW = colWidths.reduce((a, b) => a + b, 0);
 pdf.rect(margin, yPos - 4, totalW, 6, 'F');
 pdf.text('Produto', margin, yPos);
 pdf.text('Variação', margin + colWidths[0], yPos);
 pdf.text('Qtd', margin + colWidths[0] + colWidths[1], yPos);
 pdf.text('Valor Total', margin + colWidths[0] + colWidths[1] + colWidths[2], yPos);
 pdf.text('Nº Vendas', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos);
 pdf.text('Clientes', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPos);
 yPos += 8;
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0);
 productSales.slice(0, 30).forEach((item, i) => {
 if (yPos > 270) { pdf.addPage(); yPos = margin + 10; }
 if (i % 2 === 0) pdf.setFillColor(249, 250, 251);
 else pdf.setFillColor(255, 255, 255);
 pdf.rect(margin, yPos - 3, totalW, 5, 'F');
 const prod = item.productName.length > 22 ? item.productName.substring(0, 19) + '...' : item.productName;
 pdf.text(prod, margin, yPos);
 pdf.text(item.variant || '—', margin + colWidths[0], yPos);
 pdf.text(String(item.totalQuantity), margin + colWidths[0] + colWidths[1], yPos);
 pdf.text(formatMoney(item.totalValue), margin + colWidths[0] + colWidths[1] + colWidths[2], yPos);
 pdf.text(String(item.orderCount), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos);
 const cust = item.customers.slice(0, 2).map(c => c.name).join(', ') + (item.customers.length > 2 ? '...' : '');
 pdf.text(cust.length > 18 ? cust.substring(0, 15) + '...' : cust, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPos);
 yPos += 6;
 });
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }
 pdf.save(`vendas_por_produto_${startStr}_${endStr}.pdf`);
 showToast('Exportação para PDF concluída', 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 return (
 <PageShell
 title="Resumos de Vendas"
 actions={
 <div className="flex items-center gap-2">
 {activeTab === 'summaries' && (
 <>
 {selectedSaleIds.length > 0 && (
 <button
 onClick={handleBulkDelete}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 <span className="hidden sm:inline">Apagar ({selectedSaleIds.length})</span>
 </button>
 )}
 <button
 onClick={handleSyncAllFromOrders}
 disabled={isSyncing || orders.length === 0}
 className="px-4 py-2 bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
 title="Gerar resumos automaticamente a partir de todos os pedidos"
 >
 <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
 <span className="hidden sm:inline">{isSyncing ? 'A sincronizar...' : 'Sincronizar'}</span>
 </button>
 <button
 onClick={() => setIsModalOpen(true)}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors"
 >
 <Plus className="w-4 h-4" />
 <span className="hidden sm:inline">Novo Resumo</span>
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
 {isMobile && (
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
 showFilters || searchQuery || filterPeriod !== 'all' || filterDateFrom || filterDateTo
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-gray-600 hover:bg-border-strong text-white'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {(searchQuery || filterPeriod !== 'all' || filterDateFrom || filterDateTo || filterSaleType !== 'ALL') && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {[searchQuery, filterPeriod !== 'all' ? 1 : 0, filterDateFrom ? 1 : 0, filterSaleType !== 'ALL' ? 1 : 0].filter(Boolean).length}
 </span>
 )}
 </button>
 )}
 </>
 )}
 {activeTab === 'byProduct' && (
 <>
 <button
 onClick={exportProductSalesToExcel}
 className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar para Excel"
 >
 <FileSpreadsheet className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Excel</span>
 </button>
 <button
 onClick={exportProductSalesToPDF}
 className="bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar para PDF"
 >
 <FileText className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">PDF</span>
 </button>
 </>
 )}
 </div>
 }
 >

 {/* ── Tab bar ── */}
 <div className="flex border-b border-border-default mb-4 -mt-2">
 <button
 onClick={() => switchTab('summaries')}
 className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
 activeTab === 'summaries'
 ? 'border-brand-600 text-brand-600 dark:text-brand-400'
 : 'border-transparent text-content-muted hover:text-content-secondary hover:border-border-default'
 }`}
 >
 <BarChart3 className="w-4 h-4" />
 Resumos
 </button>
 <button
 onClick={() => switchTab('byProduct')}
 className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
 activeTab === 'byProduct'
 ? 'border-brand-600 text-brand-600 dark:text-brand-400'
 : 'border-transparent text-content-muted hover:text-content-secondary hover:border-border-default'
 }`}
 >
 <Package className="w-4 h-4" />
 Por Produto
 </button>
 </div>

 {/* Resumos Tab */}
 {activeTab === 'summaries' && (
 <>
 {/* Barra Integrada: Controles, Filtros e Açéµes - Uma Linha - Fixa no Mobile */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <ViewModeToggle
 value={viewMode === 'cards' ? 'cards' : 'table'}
 onChange={(mode) => setViewMode(mode === 'cards' ? 'cards' : 'list')}
 size="compact"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SearchInput
 value={searchQuery}
 onChange={(val) => setSearchQuery(val)}
 placeholder="Buscar vendas..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 {/* Itens por pé¡gina - Oculto no Mobile */}
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

 {/* Botéo Limpar Filtros - Oculto no Mobile */}
 {(searchQuery || filterPeriod !== 'all' || filterDateFrom || filterDateTo || filterSaleType !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterPeriod('all');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterSaleType('ALL');
 setCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}

 {/* Separador - Oculto no Mobile */}
 <div className="hidden sm:block h-4 w-px bg-surface-base flex-shrink-0" />

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
 {/* Filtros lado a lado */}
 <div className="grid grid-cols-2 gap-3">
 {/* Itens por pé¡gina */}
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

 {/* Filtro Tipo de Venda */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Tipo de Venda
 </label>
 <SelectFilter
 value={filterSaleType}
 onChange={(val) => {
 setFilterSaleType(val as SaleType | 'ALL');
 setCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Todos' },
 { value: 'factory_direct', label: 'Fé¡brica' },
 { value: 'store_retail', label: 'Loja' },
 { value: 'factory_to_store', label: 'Fé¡bricaâ†’Loja' }
 ]}
 className="w-full"
 size="md"
 />
 </div>
 </div>
 
 {/* Filtro Peré­odo - Linha separada */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
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

 {/* Botéo Limpar Filtros */}
 {(searchQuery || filterPeriod !== 'all' || filterDateFrom || filterDateTo || filterSaleType !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterPeriod('all');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterSaleType('ALL');
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

 {/* Sales View - Cards or List */}
 {viewMode === 'cards' ? (
 /* Cards View */
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {paginatedSales.map((sale) => {
 const saleDate = new Date(sale.date);
 const dateStr = formatDateWithOptions(saleDate, { day: '2-digit', month: '2-digit', year: 'numeric' });
 const isSelected = selectedSaleIds.includes(sale.id);
 
 return (
 <div
 key={sale.id}
 className={`bg-surface-raised rounded-lg p-4 shadow-sm border-2 transition-all cursor-pointer ${
 isSelected 
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20' 
 : 'border-border-default hover:border-brand-300 dark:hover:border-brand-600'
 }`}
 onClick={() => toggleSaleSelection(sale.id)}
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleSaleSelection(sale.id)}
 onClick={(e) => e.stopPropagation()}
 className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
 />
 <Calendar className="w-4 h-4 text-content-muted" />
 <span className="font-semibold text-content-primary">{dateStr}</span>
 </div>
 <div className="flex gap-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setViewingSale(sale);
 setIsViewModalOpen(true);
 }}
 className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
 title="Visualizar resumo"
 >
 <Eye className="w-4 h-4" />
 </button>
 {onUpdateSale && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleEditSale(sale);
 }}
 className="p-1 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
 title="Editar resumo"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDeleteSale && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteSale(sale.id);
 }}
 className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Apagar resumo"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 <div className="space-y-2 mb-3">
 <div className="text-sm text-content-secondary">
 {sale.items.length} item(ns)
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-secondary">Total de Vendas:</span>
 <span className="font-bold text-brand-600 dark:text-brand-400">
 {formatMoney(sale.totalSales)}
 </span>
 </div>
 {sale.totalDeliveries > 0 && (
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-secondary">Total de Entregas:</span>
 <span className="font-semibold text-content-secondary">
 {formatMoney(sale.totalDeliveries)}
 </span>
 </div>
 )}
 {sale.valueReceived !== undefined && sale.valueReceived > 0 && (
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-secondary">Valor Recebido:</span>
 <span className="font-semibold text-content-secondary">
 {formatMoney(sale.valueReceived)}
 </span>
 </div>
 )}
 {sale.difference !== undefined && sale.difference !== 0 && (
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-secondary">Diferença:</span>
 <span className={`font-semibold ${
 sale.difference < 0 
 ? 'text-red-600 dark:text-red-400' 
 : 'text-green-600 dark:text-green-400'
 }`}>
 {formatMoney(sale.difference)}
 </span>
 </div>
 )}
 </div>

 {sale.notes && (
 <div className="mt-3 pt-3 border-t border-border-default">
 <div className="text-xs text-content-muted">Notas:</div>
 <div className="text-sm text-content-secondary">{sale.notes}</div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 ) : (
 /* List View */
 <div className="bg-surface-raised rounded-lg shadow-sm border border-border-default overflow-hidden">
 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full text-left border-collapse">
 <thead className="bg-surface-base /50 sticky top-0 z-10">
 <tr>
 <th className="w-10 px-2 py-2 text-left">
 {onDeleteSales && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 toggleSelectAll();
 }}
 className="flex items-center justify-center p-1 rounded hover:bg-surface-base transition-colors"
 title={selectedSaleIds.length > 0 && paginatedSales.every(s => selectedSaleIds.includes(s.id)) ? 'Desselecionar todos' : 'Selecionar todos'}
 >
 {selectedSaleIds.length > 0 && paginatedSales.every(s => selectedSaleIds.includes(s.id)) ? (
 <CheckSquare className="w-4 h-4 text-brand-600 dark:text-brand-400 fill-brand-100 dark:fill-brand-900/50" />
 ) : (
 <Square className="w-4 h-4 text-content-muted hover:text-content-secondary dark:hover:text-content-muted" />
 )}
 </button>
 )}
 </th>
 <th 
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${
 sortField === 'date' 
 ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/20' 
 : 'text-content-secondary'
 }`}
 onClick={() => handleSort('date')}
 >
 <div className="flex items-center gap-1">
 DATA
 {getSortIcon('date')}
 </div>
 </th>
 <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary min-w-[80px]">ITENS</th>
 <th 
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${
 sortField === 'totalSales' 
 ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/20' 
 : 'text-content-secondary'
 }`}
 onClick={() => handleSort('totalSales')}
 >
 <div className="flex items-center justify-end gap-1">
 VENDAS
 {getSortIcon('totalSales')}
 </div>
 </th>
 <th 
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${
 sortField === 'totalDeliveries' 
 ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/20' 
 : 'text-content-secondary'
 }`}
 onClick={() => handleSort('totalDeliveries')}
 >
 <div className="flex items-center justify-end gap-1">
 ENTREGAS
 {getSortIcon('totalDeliveries')}
 </div>
 </th>
 <th 
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${
 sortField === 'received' 
 ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/20' 
 : 'text-content-secondary'
 }`}
 onClick={() => handleSort('received')}
 >
 <div className="flex items-center justify-end gap-1">
 RECEBIDO
 {getSortIcon('received')}
 </div>
 </th>
 <th 
 className={`px-3 py-2 text-right text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors ${
 sortField === 'difference' 
 ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/20' 
 : 'text-content-secondary'
 }`}
 onClick={() => handleSort('difference')}
 >
 <div className="flex items-center justify-end gap-1">
 DIFERENé‡A
 {getSortIcon('difference')}
 </div>
 </th>
 <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary min-w-[150px]">NOTAS</th>
 <th className="w-10 px-2 py-2"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedSales.map((sale) => {
 const saleDate = new Date(sale.date);
 const dateStr = formatDateWithOptions(saleDate, { day: '2-digit', month: '2-digit', year: 'numeric' });
 const isSelected = selectedSaleIds.includes(sale.id);
 
 return (
 <tr
 key={sale.id}
 className={`hover:bg-surface-base/50 transition-colors cursor-pointer ${
 isSelected ? 'bg-brand-50 dark:bg-brand-600/20' : ''
 }`}
 onClick={() => toggleSaleSelection(sale.id)}
 >
 {onDeleteSales && (
 <td 
 className="px-2 py-2"
 onClick={(e) => { e.stopPropagation(); toggleSaleSelection(sale.id); }}
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
 <td className="px-3 py-2">
 <div className="flex items-center gap-1 text-xs text-content-secondary">
 <Calendar className="w-3 h-3" />
 <span>
 {dateStr}
 </span>
 </div>
 </td>
 <td className="px-3 py-2">
 <span className="text-sm text-content-secondary">{sale.items.length} item(ns)</span>
 </td>
 <td className="px-3 py-2 text-right">
 <span className="font-bold text-sm text-brand-600 dark:text-brand-400">{formatMoney(sale.totalSales)}</span>
 </td>
 <td className="px-3 py-2 text-right">
 {sale.totalDeliveries > 0 ? (
 <span className="font-semibold text-sm text-content-secondary">{formatMoney(sale.totalDeliveries)}</span>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 )}
 </td>
 <td className="px-3 py-2 text-right">
 {sale.valueReceived !== undefined && sale.valueReceived > 0 ? (
 <span className="font-semibold text-sm text-content-secondary">{formatMoney(sale.valueReceived)}</span>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 )}
 </td>
 <td className="px-3 py-2 text-right">
 {sale.difference !== undefined && sale.difference !== 0 ? (
 <span className={`font-semibold text-sm ${
 sale.difference < 0 
 ? 'text-red-600 dark:text-red-400' 
 : 'text-green-600 dark:text-green-400'
 }`}>
 {formatMoney(sale.difference)}
 </span>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 )}
 </td>
 <td className="px-3 py-2">
 {sale.notes ? (
 <div className="max-w-xs">
 <div className="text-xs text-content-muted truncate" title={sale.notes}>
 {sale.notes}
 </div>
 </div>
 ) : (
 <span className="text-sm text-content-muted">-</span>
 )}
 </td>
 <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
 <div className="flex items-center justify-center gap-1">
 <button
 onClick={() => {
 setViewingSale(sale);
 setIsViewModalOpen(true);
 }}
 className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
 title="Visualizar resumo"
 >
 <Eye className="w-4 h-4" />
 </button>
 {onUpdateSale && (
 <button
 onClick={() => handleEditSale(sale)}
 className="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
 title="Editar resumo"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDeleteSale && (
 <button
 onClick={() => handleDeleteSale(sale.id)}
 className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Apagar resumo"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </td>
 </tr>
 );
 })}
 {/* Totals Row */}
 {paginatedSales.length > 0 && (() => {
 const totals = filteredAndSortedSales.reduce((acc, sale) => {
 acc.totalSales += sale.totalSales;
 acc.totalDeliveries += sale.totalDeliveries;
 acc.valueReceived += sale.valueReceived || 0;
 acc.difference += sale.difference || 0;
 return acc;
 }, { totalSales: 0, totalDeliveries: 0, valueReceived: 0, difference: 0 });
 
 return (
 <tr className="bg-surface-base/50 font-bold border-t-2 border-border-default">
 <td className={`px-3 py-2 ${onDeleteSales ? '' : 'hidden'}`}></td>
 <td className="px-3 py-2" colSpan={2}>
 <span className="text-sm text-content-primary">TOTAL ({filteredAndSortedSales.length} resumo(s))</span>
 </td>
 <td className="px-3 py-2 text-right">
 <span className="text-sm text-brand-600 dark:text-brand-400">{formatMoney(totals.totalSales)}</span>
 </td>
 <td className="px-3 py-2 text-right">
 <span className="text-sm text-content-primary">{formatMoney(totals.totalDeliveries)}</span>
 </td>
 <td className="px-3 py-2 text-right">
 <span className="text-sm text-content-primary">{formatMoney(totals.valueReceived)}</span>
 </td>
 <td className="px-3 py-2 text-right">
 <span className={`text-sm ${
 totals.difference < 0 
 ? 'text-red-600 dark:text-red-400' 
 : totals.difference > 0
 ? 'text-green-600 dark:text-green-400'
 : 'text-content-primary'
 }`}>
 {formatMoney(totals.difference)}
 </span>
 </td>
 <td className="px-3 py-2" colSpan={2}></td>
 </tr>
 );
 })()}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Resumo em cards - Final da tabela (como em Pedidos) */}
 {filteredAndSortedSales.length > 0 && (() => {
 const summaryTotals = filteredAndSortedSales.reduce((acc, sale) => {
 acc.totalSales += sale.totalSales;
 acc.totalDeliveries += sale.totalDeliveries;
 acc.valueReceived += sale.valueReceived || 0;
 acc.difference += sale.difference || 0;
 return acc;
 }, { totalSales: 0, totalDeliveries: 0, valueReceived: 0, difference: 0 });
 return (
 <div className="mt-4 sm:mt-6 pt-4 border-t border-border-default space-y-4">
 <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-content-secondary">
 <span>
 <span className="hidden sm:inline">Mostrando </span>
 <strong className="text-content-primary text-content-primary">{paginatedSales.length}</strong>
 <span className="hidden sm:inline"> de </span>
 <span className="sm:hidden"> / </span>
 <strong className="text-content-primary text-content-primary">{totalSalesCount ?? filteredAndSortedSales.length}</strong>
 <span className="hidden sm:inline"> resumo(s)</span>
 </span>
 {filterDateFrom && filterDateTo && (
 <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded bg-surface-base">
 {formatDateWithOptions(filterDateFrom, { day: '2-digit', month: '2-digit' })} – {formatDateWithOptions(filterDateTo, { day: '2-digit', month: '2-digit', year: 'numeric' })}
 </span>
 )}
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
 <div className="rounded-xl border border-border-default bg-surface-raised p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Vendas</p>
 <p className="text-lg sm:text-xl font-bold text-brand-600 dark:text-brand-400 truncate" title={formatMoney(summaryTotals.totalSales)}>
 {formatMoney(summaryTotals.totalSales)}
 </p>
 </div>
 <div className="rounded-xl border border-border-default bg-surface-raised p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Entregas</p>
 <p className="text-lg sm:text-xl font-bold text-content-primary truncate" title={formatMoney(summaryTotals.totalDeliveries)}>
 {formatMoney(summaryTotals.totalDeliveries)}
 </p>
 </div>
 <div className="rounded-xl border border-border-default bg-surface-raised p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Recebido</p>
 <p className="text-lg sm:text-xl font-bold text-content-primary truncate" title={formatMoney(summaryTotals.valueReceived)}>
 {formatMoney(summaryTotals.valueReceived)}
 </p>
 </div>
 <div className={`rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-shadow ${
 summaryTotals.difference < 0
 ? 'border-red-500/50 bg-red-500/5 dark:bg-red-500/10'
 : summaryTotals.difference > 0
 ? 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10'
 : 'border-border-default bg-surface-raised '
 }`}>
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">Diferença</p>
 <p className={`text-lg sm:text-xl font-bold truncate ${
 summaryTotals.difference < 0
 ? 'text-red-600 dark:text-red-400'
 : summaryTotals.difference > 0
 ? 'text-green-600 dark:text-green-400'
 : 'text-content-primary'
 }`} title={formatMoney(summaryTotals.difference)}>
 {formatMoney(summaryTotals.difference)}
 </p>
 </div>
 </div>
 </div>
 );
 })()}

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-center gap-2">
 <button
 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 disabled={currentPage === 1}
 className="p-2 border border-border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="px-4 py-2 text-sm text-content-secondary">
 Pé¡gina {currentPage} de {totalPages}
 </span>
 <button
 onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
 disabled={currentPage === totalPages}
 className="p-2 border border-border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 )}

 {/* Empty State */}
 {paginatedSales.length === 0 && (
 <div className="text-center py-12">
 <Package className="w-16 h-16 text-content-muted mx-auto mb-4" />
 <p className="text-content-secondary">
 {sales.length === 0
 ? orders.length > 0
 ? 'Nenhum resumo criado ainda. Clique em "Sincronizar" para gerar resumos a partir dos seus pedidos.'
 : 'Nenhum resumo de venda encontrado. Comece adicionando um novo resumo.'
 : filteredAndSortedSales.length === 0
 ? 'Nenhum resumo encontrado com os filtros aplicados.'
 : 'Nenhum resumo nesta página.'}
 </p>
 {sales.length === 0 && orders.length > 0 && (
 <button
 onClick={handleSyncAllFromOrders}
 disabled={isSyncing}
 className="mt-4 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2 mx-auto disabled:opacity-50"
 >
 <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
 {isSyncing ? 'A sincronizar...' : `Sincronizar ${orders.length} pedido(s) como resumos`}
 </button>
 )}
 {sales.length > 0 && filteredAndSortedSales.length === 0 && (
 <button
 onClick={() => {
 setFilterPeriod('all');
 setFilterDateFrom('');
 setFilterDateTo('');
 setSearchQuery('');
 setCurrentPage(1);
 }}
 className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
 >
 Limpar Filtros
 </button>
 )}
 </div>
 )}

 </>
 )}

 {/* Por Produto Tab */}
 {activeTab === 'byProduct' && (
 <>
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <SearchInput
 value={byProductSearchQuery}
 onChange={(val) => setByProductSearchQuery(val)}
 placeholder="Buscar produtos..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />
 <div className="h-4 w-px bg-surface-base flex-shrink-0" />
 <div className="flex items-center gap-2 px-3 py-2 bg-surface-base rounded-lg">
 <button
 onClick={() => setProductGroupMode('with-variants')}
 className={`px-3 py-1 text-xs font-medium rounded transition-colors ${productGroupMode === 'with-variants' ? 'bg-brand-600 text-white' : 'text-content-secondary hover:text-content-primary '}`}
 title="Mostrar produtos com variações separadas"
 >
 Com Variações
 </button>
 <button
 onClick={() => setProductGroupMode('without-variants')}
 className={`px-3 py-1 text-xs font-medium rounded transition-colors ${productGroupMode === 'without-variants' ? 'bg-brand-600 text-white' : 'text-content-secondary hover:text-content-primary '}`}
 title="Agrupar todas as variações por produto"
 >
 Produto Fixo
 </button>
 </div>
 <div className="hidden sm:block">
 <SelectFilter
 value={filterOrderStatus}
 onChange={(val) => { setFilterOrderStatus(val); setProductCurrentPage(1); }}
 options={[
 { value: 'ALL', label: 'Todos Status' },
 { value: 'delivered', label: 'Entregue' },
 { value: 'pending', label: 'Pendente' },
 { value: 'processing', label: 'Em processamento' }
 ]}
 size="compact"
 />
 </div>
 <div className="h-4 w-px bg-surface-base flex-shrink-0" />
 <PeriodFilter
 selectedPeriod={filterPeriod}
 onPeriodChange={(period) => {
 setFilterPeriod(period);
 if (period !== 'custom') { setFilterDateFrom(''); setFilterDateTo(''); }
 setProductCurrentPage(1);
 }}
 customStartDate={filterDateFrom}
 customEndDate={filterDateTo}
 onCustomDatesChange={(start, end) => { setFilterDateFrom(start); setFilterDateTo(end); setProductCurrentPage(1); }}
 />
 <div className="h-4 w-px bg-surface-base flex-shrink-0" />
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => { setItemsPerPage(val); setProductCurrentPage(1); }}
 size="compact"
 />
 </FilterBar>

 <div className="bg-surface-raised rounded-lg shadow-sm border border-border-default overflow-hidden">
 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors" onClick={() => { if (productSortField === 'product') setProductSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setProductSortField('product'); setProductSortDirection('asc'); } }}>
 <div className="flex items-center gap-1">Produto {productSortField === 'product' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors" onClick={() => { if (productSortField === 'quantity') setProductSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setProductSortField('quantity'); setProductSortDirection('desc'); } }}>
 <div className="flex items-center gap-1">Quantidade Total {productSortField === 'quantity' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors" onClick={() => { if (productSortField === 'value') setProductSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setProductSortField('value'); setProductSortDirection('desc'); } }}>
 <div className="flex items-center gap-1">Valor Total {productSortField === 'value' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors" onClick={() => { if (productSortField === 'orderCount') setProductSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setProductSortField('orderCount'); setProductSortDirection('desc'); } }}>
 <div className="flex items-center gap-1">Nº Vendas {productSortField === 'orderCount' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Clientes</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase tracking-wider">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedProductSales.map((item, index) => (
 <tr key={`${item.productId}-${item.variant || 'no-variant'}`} className={`hover:bg-surface-base/50 transition-colors ${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/50'}`}>
 <td className="px-4 py-3 text-sm text-content-primary">
 <div><div className="font-medium">{item.productName}</div>{item.variant && <div className="text-xs text-content-muted mt-1">{item.variant}</div>}</div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-primary">
 <div className="flex items-center gap-2"><Package className="w-4 h-4 text-content-muted" />{item.totalQuantity}</div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">{formatMoney(item.totalValue)}</td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-secondary">
 <div className="flex items-center gap-1"><ShoppingCart className="w-4 h-4 text-content-muted" />{item.orderCount}</div>
 </td>
 <td className="px-4 py-3">
 <div className="flex flex-wrap gap-1">
 {item.customers.slice(0, 3).map((c, idx) => (
 <span key={idx} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">{c.name}</span>
 ))}
 {item.customers.length > 3 && <span className="text-xs px-2 py-1 bg-surface-base text-content-secondary dark:text-content-muted rounded">+{item.customers.length - 3}</span>}
 {item.customers.length === 0 && <span className="text-xs text-content-muted">-</span>}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
 <button onClick={() => { setSelectedProductForHistory(item); setIsProductHistoryModalOpen(true); }} className="p-1.5 text-content-muted hover:text-brand-600 transition-colors" title="Ver histórico"><Eye className="w-4 h-4" /></button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Cards de totais - Por Produto */}
 {productSales.length > 0 && (
 <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
 <div className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-sm">
 <div className="flex items-center gap-2 text-content-muted text-xs font-medium uppercase tracking-wider mb-1">
 <Package className="w-4 h-4" />
 Quantidade total
 </div>
 <div className="text-lg sm:text-xl font-bold text-content-primary">
 {byProductTotals.quantity.toLocaleString('pt-MZ')}
 </div>
 </div>
 <div className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-sm">
 <div className="flex items-center gap-2 text-content-muted text-xs font-medium uppercase tracking-wider mb-1">
 <DollarSign className="w-4 h-4" />
 Valor total
 </div>
 <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
 {formatMoney(byProductTotals.value)}
 </div>
 </div>
 <div className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-sm">
 <div className="flex items-center gap-2 text-content-muted text-xs font-medium uppercase tracking-wider mb-1">
 <ShoppingCart className="w-4 h-4" />
 Nº vendas
 </div>
 <div className="text-lg sm:text-xl font-bold text-content-primary">
 {byProductTotals.orderCount.toLocaleString('pt-MZ')}
 </div>
 </div>
 <div className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-sm">
 <div className="flex items-center gap-2 text-content-muted text-xs font-medium uppercase tracking-wider mb-1">
 <BarChart3 className="w-4 h-4" />
 Produtos
 </div>
 <div className="text-lg sm:text-xl font-bold text-content-primary">
 {byProductTotals.productCount.toLocaleString('pt-MZ')}
 </div>
 </div>
 </div>
 )}

 {paginatedProductSales.length === 0 && (
 <div className="text-center py-12">
 <Package className="w-16 h-16 text-content-muted mx-auto mb-4" />
 <p className="text-content-muted">
 {productSales.length === 0 ? 'Nenhum produto encontrado nas vendas do período selecionado.' : 'Nenhum resultado encontrado com os filtros aplicados.'}
 </p>
 </div>
 )}

 {productSalesTotalPages > 1 && (
 <div className="mt-4 flex justify-center gap-2">
 <button onClick={() => setProductCurrentPage(p => Math.max(1, p - 1))} disabled={productCurrentPage === 1} className="px-3 py-1.5 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-base disabled:opacity-50">
 <ChevronLeft className="w-4 h-4 inline" />
 </button>
 <span className="px-3 py-1.5 text-sm text-content-secondary">Página {productCurrentPage} de {productSalesTotalPages}</span>
 <button onClick={() => setProductCurrentPage(p => Math.min(productSalesTotalPages, p + 1))} disabled={productCurrentPage === productSalesTotalPages} className="px-3 py-1.5 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-base disabled:opacity-50">
 <ChevronRight className="w-4 h-4 inline" />
 </button>
 </div>
 )}

 </>
 )}

 {/* Modal */}
 <ModalPortal open={isModalOpen} onClose={resetModal}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
 {/* Modal Header */}
 <div className="p-6 border-b border-border-default flex items-center justify-between">
 <h2 className="text-2xl font-bold text-content-primary">
 {isEditing ? 'Editar Resumo de Venda' : 'Novo Resumo de Venda'}
 </h2>
 <button
 onClick={resetModal}
 className="p-2 text-content-muted hover:text-content-secondary dark:hover:text-content-muted rounded-lg transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>


 {/* Tab Selector for Create Mode */}
 {!isEditing && (
 <div className="px-6 border-b border-border-default flex gap-0">
 <button
 onClick={() => setCreateMode('fromOrders')}
 className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
 createMode === 'fromOrders'
 ? 'border-brand-600 text-brand-600 dark:text-brand-400'
 : 'border-transparent text-content-muted hover:text-content-secondary dark:hover:text-content-muted'
 }`}
 >
 <ShoppingCart className="w-4 h-4" />
 A partir de Pedidos
 </button>
 <button
 onClick={() => setCreateMode('manual')}
 className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
 createMode === 'manual'
 ? 'border-brand-600 text-brand-600 dark:text-brand-400'
 : 'border-transparent text-content-muted hover:text-content-secondary dark:hover:text-content-muted'
 }`}
 >
 <FileText className="w-4 h-4" />
 Manual
 </button>
 </div>
 )}

 {/* Modal Content */}
 <div className="p-6 overflow-y-auto flex-1">
 {/* Edit Mode Content */}
 {isEditing && editSaleData && (
 <div className="space-y-6">
 {/* Aviso sobre valores calculados automaticamente */}
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
 <p className="text-sm text-blue-800 dark:text-blue-200">
 <strong>ℹ️ Valores calculados automaticamente:</strong> Os valores de vendas, entregas e itens são calculados automaticamente a partir dos pedidos entregues do dia. Apenas as notas e o valor recebido podem ser editados manualmente.
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 <Calendar className="w-4 h-4 inline mr-1" /> Data da Venda <span className="text-xs text-content-muted">(Somente leitura)</span>
 </label>
 <input 
 type="date" 
 readOnly
 disabled
 className="w-full px-4 py-2 border border-border-default dark:text-content-muted rounded-lg cursor-not-allowed opacity-60" 
 value={editSaleData.date} 
 />
 </div>

 {editSaleData.items.length > 0 && (
 <div className="space-y-1.5">
 <h4 className="font-semibold text-content-primary text-sm">Itens ({editSaleData.items.length}) <span className="text-xs text-content-muted font-normal">(Somente leitura)</span></h4>
 <div className="bg-surface-base /50 rounded-lg overflow-hidden border border-border-default">
 <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-medium text-content-muted border-b border-border-default bg-surface-base/80">
 <div className="col-span-5">Produto</div>
 <div className="col-span-1 text-right">Un</div>
 <div className="col-span-2 text-right">Qtde</div>
 <div className="col-span-2 text-right">P. Unit.</div>
 <div className="col-span-2 text-right">Total</div>
 </div>
 <div className="max-h-48 overflow-y-auto">
 {editSaleData.items.map((item, idx) => (
 <div
 key={idx}
 className="grid grid-cols-12 gap-2 px-3 py-1.5 text-sm border-b border-border-default /50 last:border-0 hover:bg-surface-base/50"
 >
 <div className="col-span-5 min-w-0 flex items-center gap-1">
 <span className="text-content-primary truncate">{item.productName}</span>
 {!item.productId && (
 <span className="text-orange-600 dark:text-orange-400 flex-shrink-0" title="Produto não associado">⚠</span>
 )}
 </div>
 <div className="col-span-1 text-right text-content-muted text-xs self-center">{item.unit}</div>
 <div className="col-span-2 text-right text-content-secondary tabular-nums">{item.quantity}</div>
 <div className="col-span-2 text-right text-content-secondary tabular-nums">{formatMoney(item.price)}</div>
 <div className="col-span-2 text-right font-medium text-content-primary tabular-nums">{formatMoney(item.total)}</div>
 </div>
 ))}
 </div>
 <div className="px-3 py-2 border-t border-border-default flex justify-between items-center bg-surface-raised/50">
 <span className="text-sm font-semibold text-content-primary">Total de Vendas</span>
 <span className="text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums">{formatMoney(editSaleData.totalSales)}</span>
 </div>
 </div>
 </div>
 )}

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Total de Entregas (MT) <span className="text-xs text-content-muted">(Calculado automaticamente)</span>
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={editSaleData.totalDeliveries}
 readOnly
 disabled
 className="w-full px-4 py-2 border border-border-default dark:text-content-muted rounded-lg cursor-not-allowed opacity-60"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Valor Recebido na Conta (MT)
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={editSaleData.valueReceived ?? ''}
 onChange={(e) => {
 const valueReceived = e.target.value === '' ? undefined : parseFloat(e.target.value);
 const totalSales = editSaleData.items.reduce((sum, item) => sum + item.total, 0);
 const totalDeliveries = editSaleData.totalDeliveries || 0;
 const difference = valueReceived !== undefined 
 ? valueReceived - (totalSales + totalDeliveries)
 : undefined;
 setEditSaleData({ ...editSaleData, valueReceived, difference });
 }}
 placeholder="Opcional"
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 {editSaleData.valueReceived !== undefined && editSaleData.difference !== undefined && (
 <p className={`mt-1 text-xs font-medium ${
 editSaleData.difference < 0 
 ? 'text-red-600 dark:text-red-400' 
 : 'text-green-600 dark:text-green-400'
 }`}>
 Diferença: {formatMoney(editSaleData.difference)}
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Notas
 </label>
 <textarea
 value={editSaleData.notes || ''}
 onChange={(e) => setEditSaleData({ ...editSaleData, notes: e.target.value })}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 rows={3}
 />
 </div>
 </div>
 )}

 {!isEditing && createMode === 'manual' && (
 <div className="space-y-6">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 <Calendar className="w-4 h-4 inline mr-1" /> Data da Venda
 </label>
 <input 
 type="date" 
 className="w-full px-4 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-brand-500" 
 value={newSaleDate} 
 onChange={e => setNewSaleDate(e.target.value)} 
 />
 </div>
 
 {/* Localização sempre seré¡ LOJA - todas as vendas são registadas na loja */}

 {selectedItems.length > 0 && (
 <div className="space-y-3">
 <h4 className="font-semibold text-content-primary">Itens ({selectedItems.length})</h4>
 <div className="bg-surface-base /50 rounded-lg p-4 space-y-3">
 {selectedItems.map((item, idx) => (
 <div key={idx} className="bg-surface-raised p-3 rounded-lg border border-border-default">
 <div className="flex items-start justify-between mb-2">
 <div className="flex-1">
 <div className="font-medium text-content-primary">{item.productName}</div>
 <div className="text-xs text-content-muted">{item.unit}</div>
 </div>
 <button
 onClick={() => handleRemoveItem(item.productId!)}
 className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">
 Quantidade
 </label>
 <input
 type="number"
 min="1"
 value={item.quantity}
 onChange={(e) => handleUpdateItemQuantity(item.productId!, parseFloat(e.target.value) || 1)}
 className="w-full px-2 py-1 border border-border-default rounded-lg text-sm"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">
 Preço Unit.
 </label>
 <div className="relative">
 <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-content-muted" />
 <input
 type="number"
 min="0"
 step="0.01"
 value={item.price}
 onChange={(e) => handleUpdateItemPrice(item.productId!, parseFloat(e.target.value) || 0)}
 className="w-full pl-7 pr-2 py-1 border border-border-default rounded-lg text-sm"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">
 Total
 </label>
 <div className="px-2 py-1 text-sm font-semibold text-content-primary">
 {formatMoney(item.total)}
 </div>
 </div>
 </div>
 </div>
 ))}
 <div className="pt-3 border-t border-border-default flex justify-between items-center">
 <span className="text-lg font-semibold text-content-primary">Total:</span>
 <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
 {formatMoney(calculateManualTotal())}
 </span>
 </div>
 </div>
 </div>
 )}

 <div className="space-y-3">
 <h4 className="font-semibold text-content-primary">Adicionar Produtos</h4>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-muted" />
 <input
 type="text"
 placeholder="Pesquisar produtos..."
 value={productSearchQuery}
 onChange={(e) => setProductSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
 {filteredProducts.map(p => {
 const isAdded = selectedItems.some(i => i.productId === p.id);
 return (
 <button 
 key={p.id} 
 onClick={() => handleAddItemManual(p.id)} 
 className={`text-left p-3 border rounded-lg transition-all ${
 isAdded
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20'
 : 'border-border-default hover:border-brand-300'
 }`}
 >
 <div className="font-medium text-sm text-content-primary mb-1">{p.name}</div>
 <div className="font-semibold text-brand-600 dark:text-brand-400 text-sm">
 {formatMoney(p.price)} / {p.unit}
 </div>
 </button>
 );
 })}
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Total de Entregas (MT)
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={newSaleTotalDeliveries}
 onChange={(e) => setNewSaleTotalDeliveries(parseFloat(e.target.value) || 0)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Valor Recebido na Conta (MT)
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={newSaleValueReceived ?? ''}
 onChange={(e) => {
 const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
 setNewSaleValueReceived(value);
 }}
 placeholder="Opcional"
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 {newSaleValueReceived !== undefined && (
 <p className={`mt-1 text-xs font-medium ${
 (newSaleValueReceived - (calculateManualTotal() + newSaleTotalDeliveries)) < 0
 ? 'text-red-600 dark:text-red-400' 
 : 'text-green-600 dark:text-green-400'
 }`}>
 Diferença: {formatMoney(newSaleValueReceived - (calculateManualTotal() + newSaleTotalDeliveries))}
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Notas
 </label>
 <textarea
 value={newSaleNotes}
 onChange={(e) => setNewSaleNotes(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 rows={3}
 />
 </div>
 </div>
 )}

 {false && !isEditing && (
 <div className="space-y-6">
 <div 
 className="border-2 border-dashed border-border-default rounded-lg p-8 text-center transition-colors hover:border-brand-400 dark:hover:border-brand-500"
 onDragOver={(e) => {
 e.preventDefault();
 e.stopPropagation();
 }}
 onDrop={(e) => {
 e.preventDefault();
 e.stopPropagation();
 const files = e.dataTransfer.files;
 if (files.length > 0 && files[0].type.startsWith('image/')) {
 setImageFile(files[0]);
 showToast('Imagem carregada! Clique em "Processar Imagem" para continuar.', 'success');
 }
 }}
 >
 <input 
 type="file" 
 accept="image/*" 
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) {
 setImageFile(file);
 showToast('Imagem carregada! Clique em "Processar Imagem" para continuar.', 'success');
 }
 }} 
 className="hidden" 
 id="image-upload"
 />
 <label htmlFor="image-upload" className="cursor-pointer block">
 <ImageIcon className="w-12 h-12 text-content-muted mx-auto mb-2" />
 <p className="text-sm font-medium text-content-secondary mb-2">
 {imageFile ? (
 <span className="text-brand-600 dark:text-brand-400">{imageFile.name}</span>
 ) : (
 'Clique para carregar ou arraste uma imagem aqui'
 )}
 </p>
 <p className="text-xs text-content-muted mb-1">
 Formatos suportados: JPG, PNG
 </p>
 <p className="text-xs text-content-muted">
 Ou pressione <kbd className="px-1.5 py-0.5 bg-surface-base rounded text-xs">Ctrl+V</kbd> para colar uma imagem
 </p>
 {imageFile && (
 <div className="mt-4">
 <img 
 src={URL.createObjectURL(imageFile)} 
 alt="Preview" 
 className="max-h-48 mx-auto rounded-lg border border-border-default"
 />
 </div>
 )}
 </label>
 </div>
 {ocrProgress && (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="text-content-secondary">{ocrProgress.status}</span>
 <span className="text-brand-600 dark:text-brand-400 font-semibold">
 {Math.round(ocrProgress.progress)}%
 </span>
 </div>
 <div className="w-full bg-surface-base rounded-full h-2">
 <div 
 className="bg-brand-600 h-2 rounded-full transition-all duration-300"
 style={{ width: `${ocrProgress.progress}%` }}
 />
 </div>
 </div>
 )}
 <button
 onClick={handleImageUpload}
 disabled={isImporting || !imageFile}
 className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isImporting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 {ocrProgress ? ocrProgress.status : 'Processando...'}
 </>
 ) : (
 <>
 <Upload className="w-4 h-4" />
 Processar Imagem
 </>
 )}
 </button>
 </div>
 )}

 {!isEditing && createMode === 'fromOrders' && (
 <div className="space-y-6">
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <p className="text-sm text-blue-800 dark:text-blue-200">
 <strong>Gerar resumo a partir de pedidos:</strong> Selecione uma data e o sistema iré¡ agrupar todos os pedidos daquela data em um resumo de vendas.
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Data dos Pedidos
 </label>
 <input
 type="date"
 value={ordersDate}
 onChange={(e) => setOrdersDate(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>

 {ordersDate && (() => {
 const selectedDate = new Date(ordersDate);
 selectedDate.setHours(0, 0, 0, 0);
 
 const ordersOfDate = orders.filter(order => {
 const orderDate = new Date(order.createdAt);
 orderDate.setHours(0, 0, 0, 0);
 return orderDate.getTime() === selectedDate.getTime() && shouldIncludeInTotals(order);
 });

 if (ordersOfDate.length > 0) {
 // Calculate totals
 const itemsMap = new Map<string, { quantity: number; total: number; price: number }>();
 let totalDeliveries = 0;
 let totalPaymentsReceived = 0;

 ordersOfDate.forEach(order => {
 if (order.isDelivery && order.deliveryFee) {
 totalDeliveries += order.deliveryFee;
 }
 
 // Usar helper getPaidAmount para calcular valor recebido (considera comprovativos dos pedidos)
 totalPaymentsReceived += getPaidAmount(order);
 
 order.items.forEach(item => {
 const key = item.productName.toLowerCase().trim();
 if (itemsMap.has(key)) {
 const existing = itemsMap.get(key)!;
 existing.quantity += item.quantity;
 existing.total += item.priceAtTime * item.quantity;
 existing.price = existing.total / existing.quantity;
 } else {
 itemsMap.set(key, {
 quantity: item.quantity,
 total: item.priceAtTime * item.quantity,
 price: item.priceAtTime
 });
 }
 });
 });

 const totalSales = Array.from(itemsMap.values()).reduce((sum, item) => sum + item.total, 0);

 return (
 <div className="bg-surface-base /50 rounded-lg p-4 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-content-secondary">
 Pedidos encontrados: {ordersOfDate.length}
 </span>
 <span className="text-sm font-medium text-content-secondary">
 Itens éºnicos: {itemsMap.size}
 </span>
 </div>
 
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {Array.from(itemsMap.entries()).map(([key, item]) => (
 <div key={key} className="flex justify-between items-center p-2 bg-surface-raised rounded">
 <span className="text-sm text-content-secondary capitalize">
 {key}
 </span>
 <div className="flex gap-4 text-sm">
 <span className="text-content-secondary">
 {item.quantity} un
 </span>
 <span className="font-semibold text-content-primary">
 {formatMoney(item.total)}
 </span>
 </div>
 </div>
 ))}
 </div>

 <div className="pt-3 border-t border-border-default space-y-2">
 <div className="flex justify-between">
 <span className="text-sm font-medium text-content-secondary">Total de Vendas:</span>
 <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatMoney(totalSales)}</span>
 </div>
 {totalDeliveries > 0 && (
 <div className="flex justify-between">
 <span className="text-sm font-medium text-content-secondary">Total de Entregas:</span>
 <span className="text-sm font-bold text-content-primary">{formatMoney(totalDeliveries)}</span>
 </div>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Valor Recebido na Conta (MT) - Opcional
 {totalPaymentsReceived > 0 && (
 <span className="ml-2 text-xs text-content-muted">
 (Calculado: {formatMoney(totalPaymentsReceived)})
 </span>
 )}
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={newSaleValueReceived ?? ''}
 onChange={(e) => {
 const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
 setNewSaleValueReceived(value);
 }}
 placeholder={totalPaymentsReceived > 0 ? formatMoney(totalPaymentsReceived) : "Opcional"}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 {(newSaleValueReceived !== undefined || totalPaymentsReceived > 0) && (
 <p className={`mt-1 text-xs font-medium ${
 ((newSaleValueReceived ?? totalPaymentsReceived) - (totalSales + totalDeliveries)) < 0
 ? 'text-red-600 dark:text-red-400' 
 : 'text-green-600 dark:text-green-400'
 }`}>
 Diferença: {formatMoney((newSaleValueReceived ?? totalPaymentsReceived) - (totalSales + totalDeliveries))}
 </p>
 )}
 </div>
 </div>
 );
 } else {
 return (
 <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
 <p className="text-sm text-yellow-800 dark:text-yellow-200">
 Nenhum pedido encontrado para esta data.
 </p>
 </div>
 );
 }
 })()}
 </div>
 )}

 {false && !isEditing && (
 <div className="space-y-6">
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <p className="text-sm text-blue-800 dark:text-blue-200">
 <strong>Formato esperado:</strong> Planilha com produtos nas linhas, datas nas colunas. 
 Para cada data, deve haver colunas de quantidade (QT.) e valor (VALOR).
 </p>
 </div>
 
 {/* URL Input */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Ou importe diretamente de uma URL do Google Sheets:
 </label>
 <div className="flex gap-2">
 <input
 type="text"
 value={spreadsheetUrl}
 onChange={(e) => {
 setSpreadsheetUrl(e.target.value);
 if (e.target.value) setSpreadsheetFile(null); // Clear file when URL is entered
 }}
 placeholder="Cole aqui o link do Google Sheets (formato TSV/CSV)"
 className="flex-1 px-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 />
 {spreadsheetUrl && (
 <button
 onClick={() => {
 setSpreadsheetUrl('');
 }}
 className="px-3 py-2 text-content-muted hover:text-content-secondary dark:text-content-muted "
 title="Limpar URL"
 >
 <X className="w-5 h-5" />
 </button>
 )}
 </div>
 <p className="text-xs text-content-muted mt-1">
 Dica: Use o link de publicaçéo do Google Sheets (formato TSV ou CSV)
 </p>
 </div>

 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-border-default"></div>
 </div>
 <div className="relative flex justify-center text-sm">
 <span className="px-2 bg-surface-raised text-content-secondary">OU</span>
 </div>
 </div>

 <div 
 className="border-2 border-dashed border-border-default rounded-lg p-8 text-center transition-colors hover:border-brand-400 dark:hover:border-brand-500"
 onDragOver={(e) => {
 e.preventDefault();
 e.stopPropagation();
 }}
 onDrop={(e) => {
 e.preventDefault();
 e.stopPropagation();
 const files = e.dataTransfer.files;
 if (files.length > 0) {
 const file = files[0];
 if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
 setSpreadsheetFile(file);
 setSpreadsheetUrl(''); // Clear URL when file is selected
 showToast('Planilha carregada! Clique em "Processar Planilha" para continuar.', 'success');
 } else {
 showToast('Por favor, selecione um arquivo CSV ou Excel (.csv, .xlsx, .xls)', 'error');
 }
 }
 }}
 >
 <input 
 type="file" 
 accept=".csv,.xlsx,.xls" 
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) {
 setSpreadsheetFile(file);
 setSpreadsheetUrl(''); // Clear URL when file is selected
 showToast('Planilha carregada! Clique em "Processar Planilha" para continuar.', 'success');
 }
 }} 
 className="hidden" 
 id="spreadsheet-upload"
 />
 <label htmlFor="spreadsheet-upload" className="cursor-pointer block">
 <Upload className="w-12 h-12 text-content-muted mx-auto mb-2" />
 <p className="text-sm font-medium text-content-secondary mb-2">
 {spreadsheetFile ? (
 <span className="text-brand-600 dark:text-brand-400">{spreadsheetFile.name}</span>
 ) : (
 'Clique para carregar ou arraste uma planilha aqui'
 )}
 </p>
 <p className="text-xs text-content-muted">
 Formatos suportados: CSV, Excel (.csv, .xlsx, .xls)
 </p>
 </label>
 </div>
 <button
 onClick={handleSpreadsheetUpload}
 disabled={isImporting || (!spreadsheetFile && !spreadsheetUrl)}
 className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isImporting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Processando...
 </>
 ) : (
 <>
 <Upload className="w-4 h-4" />
 Processar Planilha
 </>
 )}
 </button>
 </div>
 )}

 {/* Preview Data */}
 {previewData && previewData.sales.length > 0 && (
 <div className="mt-6 space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-content-primary">
 Pré©-visualizaçéo ({previewData.sales.length} resumo(s))
 {previewData.sales.filter(s => s.isDuplicate).length > 0 && (
 <span className="ml-2 text-orange-600 dark:text-orange-400 text-sm font-normal">
 ({previewData.sales.filter(s => s.isDuplicate).length} duplicado(s))
 </span>
 )}
 </h3>
 <div className="flex gap-2">
 {previewData.sales.filter(s => s.isDuplicate).length > 0 && (
 <button
 onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
 className={`px-3 py-1 text-sm rounded-lg transition-colors ${
 showDuplicatesOnly
 ? 'bg-orange-500 text-white'
 : 'bg-surface-base text-content-secondary'
 }`}
 >
 {showDuplicatesOnly ? 'Mostrar Todos' : 'Apenas Duplicados'}
 </button>
 )}
 <button
 onClick={() => setPreviewData(null)}
 className="text-sm text-content-muted hover:text-content-secondary dark:hover:text-content-muted"
 >
 Limpar
 </button>
 </div>
 </div>
 
 {previewData.sales
 .filter(sale => !showDuplicatesOnly || sale.isDuplicate)
 .map((previewSale, saleIdx) => (
 <div 
 key={saleIdx} 
 className={`rounded-lg p-4 border-2 ${
 previewSale.isDuplicate 
 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700' 
 : 'bg-surface-base /50 border-border-default'
 }`}
 >
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className="font-semibold text-content-primary">
 Data: {previewSale.date}
 </div>
 {previewSale.isDuplicate && (
 <span className="px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded">
 DUPLICADO
 </span>
 )}
 </div>
 <div className="text-sm text-content-secondary">
 Total: {formatMoney(previewSale.totalSales)} | Entregas: {formatMoney(previewSale.totalDeliveries || 0)}
 </div>
 </div>
 <div className="space-y-2">
 {previewSale.items.map((item, itemIdx) => (
 <div key={itemIdx} className="text-sm text-content-secondary">
 {item.quantity} {item.unit} {item.productName} - {formatMoney(item.total)}
 {item.needsManualMatch && (
 <span className="ml-2 text-orange-600 dark:text-orange-400 text-xs">
 (Produto néo encontrado)
 </span>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}

 {saveProgress && (
 <div className="mt-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-content-secondary">
 Salvando... {saveProgress.current} de {saveProgress.total}
 </span>
 <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
 {saveProgress.percentage}%
 </span>
 </div>
 <div className="w-full bg-surface-base rounded-full h-2">
 <div 
 className="bg-brand-600 h-2 rounded-full transition-all duration-300"
 style={{ width: `${saveProgress.percentage}%` }}
 />
 </div>
 </div>
 )}

 {importResult && (
 <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
 <div className="flex items-center justify-between mb-2">
 <span className="font-semibold text-blue-900 dark:text-blue-200">
 Resultado: {importResult.success} sucesso, {importResult.errors} erro(s)
 </span>
 <button
 onClick={() => setShowImportDetails(!showImportDetails)}
 className="text-sm text-blue-700 dark:text-blue-300"
 >
 {showImportDetails ? 'Ocultar' : 'Ver detalhes'}
 </button>
 </div>
 {showImportDetails && importResult.details && (
 <div className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
 {importResult.details.map((detail, idx) => (
 <div key={idx}>{detail}</div>
 ))}
 </div>
 )}
 </div>
 )}

 {!saveProgress && (
 <div className="mt-4 space-y-2">
 {previewData.sales.filter(s => s.isDuplicate).length > 0 && (
 <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-2">
 <p className="text-sm text-orange-800 dark:text-orange-200">
 âš ï¸ <strong>{previewData.sales.filter(s => s.isDuplicate).length}</strong> resumo(s) duplicado(s) seréo ignorados automaticamente ao salvar.
 </p>
 </div>
 )}
 <button
 onClick={handleSavePreviewSales}
 className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center justify-center gap-2"
 >
 <Save className="w-4 h-4" />
 Salvar {previewData.sales.filter(s => !s.isDuplicate).length} Resumo(s)
 {previewData.sales.filter(s => s.isDuplicate).length > 0 && (
 <span className="text-sm opacity-90">
 ({previewData.sales.filter(s => s.isDuplicate).length} duplicado(s) ignorados)
 </span>
 )}
 </button>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Modal Footer */}
 {isEditing ? (
 <div className="p-6 border-t border-border-default flex justify-end gap-3">
 <button
 onClick={cancelEditing}
 className="px-4 py-2 border border-border-default rounded-lg hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={saveEdit}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
 >
 Salvar Alterações
 </button>
 </div>
 ) : (
 <div className="p-6 border-t border-border-default flex justify-end gap-3">
 <button
 onClick={resetModal}
 className="px-4 py-2 border border-border-default rounded-lg hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={createMode === 'manual' ? handleManualSubmit : handleCreateFromOrders}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
 >
 {createMode === 'manual' ? 'Salvar Resumo' : 'Criar Resumo'}
 </button>
 </div>
 )}
 </div>
 </ModalPortal>

 {/* View Modal - alinhado ao layout Detalhes da Compra */}
 <ModalPortal open={!!(isViewModalOpen && viewingSale)} onClose={() => { setIsViewModalOpen(false); setViewingSale(null); }}>
 {viewingSale && (
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
 <div className="p-6 border-b border-border-default flex justify-between items-center flex-shrink-0">
 <h2 className="text-xl font-bold text-content-primary">Detalhes do Resumo de Venda</h2>
 <div className="flex gap-2">
 <button
 onClick={() => { if (viewingSale) exportSaleToPDF(viewingSale); }}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
 title="Exportar para PDF"
 >
 <Download className="w-4 h-4" />
 Exportar PDF
 </button>
 {onUpdateSale && (
 <>
 <button
 onClick={handleUpdateSummaryFromOrders}
 disabled={isUpdatingSummary}
 className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
 title="Actualizar resumo a partir dos pedidos do dia"
 >
 {isUpdatingSummary ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <RefreshCw className="w-4 h-4" />
 )}
 Actualizar
 </button>
 <button
 onClick={() => { setIsViewModalOpen(false); handleEditSale(viewingSale); }}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
 >
 <Edit2 className="w-4 h-4" />
 Editar
 </button>
 </>
 )}
 <button
 onClick={() => { setIsViewModalOpen(false); setViewingSale(null); }}
 className="text-content-muted hover:text-content-secondary dark:hover:text-content-muted"
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>

 <div className="p-6 overflow-y-auto flex-1 space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data</label>
 <p className="text-content-primary">
 {formatDateOnly(viewingSale.date)}
 </p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Total de Vendas</label>
 <p className="text-content-primary">{formatMoney(viewingSale.totalSales ?? 0)}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Valor Recebido</label>
 <p className="text-content-primary">
 {viewingSale.valueReceived !== undefined && viewingSale.valueReceived > 0
 ? formatMoney(viewingSale.valueReceived)
 : '—'}
 </p>
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
 // Agrupar por productId para juntar todas as variações do mesmo produto; fallback para productName
 const groups = new Map<string, { items: typeof viewingSale.items; totalQty: number; totalValue: number; displayName: string }>();
 for (const item of viewingSale.items) {
 const key = item.productId ?? item.productName ?? '';
 if (!groups.has(key)) {
 groups.set(key, { items: [], totalQty: 0, totalValue: 0, displayName: item.productName || '' });
 }
 const g = groups.get(key)!;
 g.items.push(item);
 g.totalQty += item.quantity;
 g.totalValue += (item.total ?? item.quantity * item.price);
 // Nome de exibição do grupo = nome mais curto (base do produto, ex. "Pato Normal")
 if (item.productName && (!g.displayName || item.productName.length < g.displayName.length)) {
 g.displayName = item.productName;
 }
 }
 const rows: React.ReactNode[] = [];
 groups.forEach((group, key) => {
 const displayName = group.displayName || key;
 group.items.forEach((item, i) => {
 rows.push(
 <tr key={`${key}-${i}`} className="bg-surface-raised">
 <td className="px-3 py-2">
 {i === 0 ? (
 <span className="flex items-center gap-1">
 {displayName}
 {item.productId && (
 <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" title="Produto associado" />
 )}
 </span>
 ) : '—'}
 </td>
 <td className="px-3 py-2">{item.variantName ?? '—'}</td>
 <td className="px-3 py-2 text-right">{item.quantity}</td>
 <td className="px-3 py-2">{item.unit ?? 'un'}</td>
 <td className="px-3 py-2 text-right">{formatMoney(item.price)}</td>
 <td className="px-3 py-2 text-right">{formatMoney(item.total ?? item.quantity * item.price)}</td>
 </tr>
 );
 });
 rows.push(
 <tr key={`sub-${key}`} className="bg-surface-base font-medium">
 <td className="px-3 py-2" colSpan={2}>Subtotal: {displayName}</td>
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
 <span className="text-lg font-semibold text-content-primary">Total:</span>
 <span className="text-lg font-semibold text-green-600 dark:text-green-400">
 {formatMoney(viewingSale.totalSales ?? 0)}
 </span>
 </div>
 </div>
 {viewingSale.totalDeliveries !== undefined && viewingSale.totalDeliveries > 0 && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Total de Entregas</label>
 <p className="text-content-primary">{formatMoney(viewingSale.totalDeliveries)}</p>
 </div>
 )}
 {viewingSale.valueReceived !== undefined && viewingSale.valueReceived > 0 && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Valor Recebido na Conta</label>
 <p className="text-content-primary">{formatMoney(viewingSale.valueReceived)}</p>
 </div>
 )}
 {viewingSale.difference !== undefined && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Diferença (Valor Recebido - Total Vendas - Entregas)
 </label>
 <p className={`font-semibold ${
 viewingSale.difference < 0 ? 'text-red-600 dark:text-red-400' : viewingSale.difference > 0 ? 'text-green-600 dark:text-green-400' : 'text-content-primary'
 }`}>
 {formatMoney(viewingSale.difference)}
 </p>
 </div>
 )}
 {viewingSale.notes && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Notas</label>
 <p className="text-content-primary whitespace-pre-wrap">{viewingSale.notes}</p>
 </div>
 )}
 <div className="pt-4 border-t border-border-default">
 <div className="grid grid-cols-2 gap-4 text-sm text-content-secondary">
 <div>
 <span className="font-medium">Criado em:</span>{' '}
 {formatDateTime(viewingSale.createdAt)}
 </div>
 {viewingSale.updatedAt && (
 <div>
 <span className="font-medium">Atualizado em:</span>{' '}
 {formatDateTime(viewingSale.updatedAt)}
 </div>
 )}
 </div>
 </div>
 </div>
 <div className="p-4 border-t border-border-default flex-shrink-0">
 <button
 onClick={() => { setIsViewModalOpen(false); setViewingSale(null); }}
 className="w-full px-4 py-2 bg-gray-600 hover:bg-border-strong dark:hover:bg-surface-base0 text-white rounded-lg font-medium"
 >
 Fechar
 </button>
 </div>
 </div>
 )}
 </ModalPortal>

 {/* Modal Histórico Vendas por Produto */}
 {isProductHistoryModalOpen && selectedProductForHistory && (() => {
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startNorm = new Date(start.getFullYear(), start.getMonth(), start.getDate());
 const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate());
 endNorm.setHours(23, 59, 59, 999);
 const historyOrders = orders.filter(order => {
 if (!shouldIncludeInTotals(order)) return false;
 const orderDate = new Date(order.createdAt);
 orderDate.setHours(0, 0, 0, 0);
 if (orderDate < startNorm || orderDate > endNorm) return false;
 const hasItem = (order.items || []).some((it: { productId: string; variantName?: string; variant?: string }) => {
 const variant = (it.variantName ?? (it as { variant?: string }).variant ?? '').trim() || null;
 const keyMatch = productGroupMode === 'without-variants'
 ? it.productId === selectedProductForHistory.productId
 : it.productId === selectedProductForHistory.productId && (variant || 'no-variant') === (selectedProductForHistory.variant || 'no-variant');
 return keyMatch;
 });
 return hasItem;
 }).map(order => {
 const matchingItems = (order.items || []).filter((it: { productId: string; variantName?: string; variant?: string; quantity: number; price?: number; priceAtTime?: number }) => {
 const variant = (it.variantName ?? (it as { variant?: string }).variant ?? '').trim() || null;
 const keyMatch = productGroupMode === 'without-variants'
 ? it.productId === selectedProductForHistory.productId
 : it.productId === selectedProductForHistory.productId && (variant || 'no-variant') === (selectedProductForHistory.variant || 'no-variant');
 return keyMatch;
 });
 const qty = matchingItems.reduce((s, it) => s + (it.quantity || 0), 0);
 const val = matchingItems.reduce((s, it) => s + ((it as { priceAtTime?: number }).priceAtTime ?? it.price ?? 0) * (it.quantity || 0), 0);
 return { order, qty, val };
 }).sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());
 return (
 <ModalPortal open onClose={() => { setIsProductHistoryModalOpen(false); setSelectedProductForHistory(null); }}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
 <div className="p-6 border-b border-border-default flex justify-between items-center flex-shrink-0">
 <h2 className="text-xl font-bold text-content-primary">Histórico de vendas: {selectedProductForHistory.productName}{selectedProductForHistory.variant ? ` (${selectedProductForHistory.variant})` : ''}</h2>
 <button onClick={() => { setIsProductHistoryModalOpen(false); setSelectedProductForHistory(null); }} className="p-2 text-content-muted hover:text-content-secondary dark:hover:text-content-muted rounded-lg transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="p-6 overflow-y-auto flex-1">
 <div className="overflow-x-auto rounded-lg border border-border-default">
 <table className="w-full text-sm text-left">
 <thead className="bg-surface-base text-content-secondary">
 <tr>
 <th className="px-3 py-2 font-medium">Data</th>
 <th className="px-3 py-2 font-medium">Pedido</th>
 <th className="px-3 py-2 font-medium">Cliente</th>
 <th className="px-3 py-2 font-medium text-right">Qtd</th>
 <th className="px-3 py-2 font-medium text-right">Valor</th>
 </tr>
 </thead>
 <tbody className="text-content-primary divide-y divide-gray-200 dark:divide-gray-600">
 {historyOrders.map(({ order, qty, val }) => (
 <tr key={order.id} className="bg-surface-raised">
 <td className="px-3 py-2">{formatDateOnly(order.createdAt)}</td>
 <td className="px-3 py-2">{order.orderNumber || order.id.slice(0, 8)}</td>
 <td className="px-3 py-2">{order.customerName || '-'}</td>
 <td className="px-3 py-2 text-right">{qty}</td>
 <td className="px-3 py-2 text-right">{formatMoney(val)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {historyOrders.length === 0 && (
 <p className="text-content-muted text-center py-4">Nenhum pedido encontrado no período.</p>
 )}
 </div>
 <div className="p-4 border-t border-border-default flex-shrink-0">
 <button onClick={() => { setIsProductHistoryModalOpen(false); setSelectedProductForHistory(null); }} className="w-full px-4 py-2 bg-gray-600 hover:bg-border-strong dark:hover:bg-surface-base0 text-white rounded-lg font-medium">
 Fechar
 </button>
 </div>
 </div>
 </ModalPortal>
 );
 })()}

 {/* Confirmation Dialog */}
 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })}
 variant={confirmDialog.variant}
 />
 </PageShell>
 );
};


