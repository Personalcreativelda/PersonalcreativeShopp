import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, PurchaseRequest, Supplier, Product, ProductVariant, ProductType, ProductUnit, PurchaseItem } from '../../../core/types/types';
import type { OrderItem } from '../../../core/types/order';
import { Plus, Search, Edit2, Eye, Trash2, X, Calendar, DollarSign, Package, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ShoppingCart, CheckCircle, Clock, User, FileText, Printer, Table, Grid, LayoutGrid, Filter, FileSpreadsheet, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { ProductGrid } from './ProductGrid';
import { createWorkbook, addWorksheet, addJsonToSheetAt, writeWorkbookToFile } from '../../../core/services/excelService';
import jsPDF from 'jspdf';
import { dataService } from '../../../core/services/dataService';
import { authService } from '../../../auth/services/authService';
import { Toast } from '../../../core/components/ui/Toast';
import { ConfirmDialog } from '../../../core/components/ui/ConfirmDialog';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { PeriodFilter, PeriodOption } from '../../../core/components/forms/PeriodFilter';
import { useMobile } from '../../../core/hooks/useMobile';
import { PageShell } from '../../../core/components/layout/PageShell';
import { FilterBar, SearchInput, ViewModeToggle, ItemsPerPageSelect, SelectFilter, Pagination } from '../../../core/components/filters';
import { normalizeForSearch } from '../../../core/services/serviceUtils';
import { addPDFHeader, addPDFFooter, getBrandColors, addExcelHeader, formatExcelTableHeaders, formatExcelDataCells, addExcelFooter } from '../../../core/services/reportService';
import { appSystemConfig } from '../../../../config/appConfig';
import { getTodayDateString, toDateStringInTimezone } from '../../../core/utils/dateUtils';

interface PurchasesProps {
 purchases: Purchase[];
 purchaseRequests: PurchaseRequest[];
 suppliers: Supplier[];
 products: Product[];
 totalPurchasesCount?: number | null;
 onAddPurchase: (purchase: Purchase) => void;
 onUpdatePurchase?: (purchase: Purchase) => void;
 onDeletePurchase?: (purchaseId: string) => void;
 onAddPurchaseRequest: (request: PurchaseRequest) => void;
 onUpdatePurchaseRequest?: (request: PurchaseRequest) => void;
 onDeletePurchaseRequest?: (requestId: string) => void;
 onAddSupplier: (supplier: Supplier) => void;
 onUpdateSupplier?: (supplier: Supplier) => void;
 onDeleteSupplier?: (supplierId: string) => void;
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
 defaultTab?: TabType;
}

interface ProductPurchaseSummary {
 productId: string;
 productName: string;
 variant: string | null;
 totalQuantity: number;
 totalValue: number;
 purchaseCount: number;
 suppliers: Array<{ id: string, name: string }>;
 invoices: Array<{ number: string, date: string, purchaseId: string }>;
 lastPurchaseDate: string;
}

interface SupplierStats {
 supplierId: string;
 supplierName: string;
 supplier: Supplier;
 totalPurchases: number;
 totalValue: number;
 totalPaid: number;
 pendingAmount: number;
 lastPurchaseDate: string | null;
 purchases: Purchase[];
}

type TabType = 'purchases' | 'suppliers' | 'byProduct';
type SupplierDebtFilter = 'ALL' | 'WITH_DEBT' | 'NO_DEBT';
type SupplierSortField = 'name' | 'totalValue' | 'pendingAmount' | 'totalPurchases';
type SortField = 'date' | 'totalAmount' | 'supplier';
type ProductSortField = 'product' | 'quantity' | 'value' | 'purchaseCount' | 'lastPurchase';
type ViewMode = 'grid' | 'list';
type PaymentStatusFilter = 'ALL' | 'paid' | 'partial' | 'unpaid';
type ProductGroupMode = 'with-variants' | 'without-variants';

export const Purchases: React.FC<PurchasesProps> = ({
 purchases,
 purchaseRequests,
 suppliers,
 products,
 totalPurchasesCount,
 onAddPurchase,
 onUpdatePurchase,
 onDeletePurchase,
 onAddPurchaseRequest,
 onUpdatePurchaseRequest,
 onDeletePurchaseRequest,
 onAddSupplier,
 onUpdateSupplier,
 onDeleteSupplier,
 showToast,
 defaultTab = 'purchases'
}) => {
 // Hook para detectar mobile
 const isMobile = useMobile(768);

 const [currentUser, setCurrentUser] = useState<any>(null);

 useEffect(() => {
 const loadUser = async () => {
 const user = await authService.getCurrentUser();
 setCurrentUser(user);
 };
 loadUser();
 }, []);

 const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
 useEffect(() => { setActiveTab(defaultTab); }, [defaultTab]);
 const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
 const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
 const [isViewModalOpen, setIsViewModalOpen] = useState(false);
 const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
 const [purchaseForInvoicePreview, setPurchaseForInvoicePreview] = useState<Purchase | null>(null);
 const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'grid' : 'list');

 // Period filter state
 const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('thisMonth');
 const [customStartDate, setCustomStartDate] = useState<string>('');
 const [customEndDate, setCustomEndDate] = useState<string>('');
 const [showFilters, setShowFilters] = useState(false);
 const [filterPaymentStatus, setFilterPaymentStatus] = useState<PaymentStatusFilter>('ALL');

 // Purchase form state
 const [newPurchaseDate, setNewPurchaseDate] = useState(getTodayDateString());
 const [selectedSupplier, setSelectedSupplier] = useState<string>('');

 const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
 const [productSearchQuery, setProductSearchQuery] = useState('');
 const [selectedProductForVariant, setSelectedProductForVariant] = useState<string | null>(null);
 const [showNewVariantForm, setShowNewVariantForm] = useState<string | null>(null);
 const [newVariantData, setNewVariantData] = useState({ name: '', costPrice: 0, price: 0, unit: '' });
 const [showNewProductForm, setShowNewProductForm] = useState(false);
 const [newProductData, setNewProductData] = useState({ name: '', costPrice: 0, unit: 'un', category: '' });
 const [unitsList, setUnitsList] = useState<ProductUnit[]>([]);
 const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState('');
 const [purchasePaymentStatus, setPurchasePaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
 const [purchaseAmountPaid, setPurchaseAmountPaid] = useState<number>(0);
 const [purchaseNotes, setPurchaseNotes] = useState('');
 const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
 const [purchaseProductsSectionOpen, setPurchaseProductsSectionOpen] = useState(true);
 const [purchaseItemsSectionOpen, setPurchaseItemsSectionOpen] = useState(true);

 // Carregar unidades do sistema
 React.useEffect(() => {
 const loadUnits = async () => {
 try {
 const units = await dataService.getUnits();
 setUnitsList(units.filter(u => u.isActive));
 } catch (error) {
 console.error('Erro ao carregar unidades:', error);
 }
 };
 loadUnits();
 }, []);


 // Supplier form state
 const [supplierName, setSupplierName] = useState('');
 const [supplierContactPerson, setSupplierContactPerson] = useState('');
 const [supplierPhone, setSupplierPhone] = useState('');
 const [supplierEmail, setSupplierEmail] = useState('');
 const [supplierAddress, setSupplierAddress] = useState('');
 const [supplierNotes, setSupplierNotes] = useState('');
 const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

 // Filters and sorting
 const [searchQuery, setSearchQuery] = useState('');
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [sortField, setSortField] = useState<SortField>('date');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
 const [productSortField, setProductSortField] = useState<ProductSortField>('product');
 const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('asc');
 const [currentPage, setCurrentPage] = useState(1);
 const [productCurrentPage, setProductCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(12);

 // Product purchase history modal
 const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductPurchaseSummary | null>(null);
 const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

 // Product grouping mode
 const [productGroupMode, setProductGroupMode] = useState<ProductGroupMode>('with-variants');

 // Supplier detail modal and filters
 const [selectedSupplierStats, setSelectedSupplierStats] = useState<SupplierStats | null>(null);
 const [isSupplierDetailModalOpen, setIsSupplierDetailModalOpen] = useState(false);
 const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
 const [supplierDebtFilter, setSupplierDebtFilter] = useState<SupplierDebtFilter>('ALL');
 const [supplierSortField, setSupplierSortField] = useState<SupplierSortField>('name');
 const [supplierSortDirection, setSupplierSortDirection] = useState<'asc' | 'desc'>('asc');
 const [supplierViewMode, setSupplierViewMode] = useState<ViewMode>('grid');

 /** Obtém o próximo número de fatura com base na última fatura criada (ordenada por data). */
 const getNextInvoiceNumber = useMemo(() => {
 return (year: number): string => {
 const withInv = purchases
 .filter(p => (p.invoiceNumber ?? '').trim().toUpperCase().startsWith('FAT-'))
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 if (withInv.length === 0) return `FAT-${year}-001`;
 const lastInv = withInv[0].invoiceNumber!.trim();
 const parts = lastInv.split('-');
 const lastPart = parts[parts.length - 1];
 const num = parseInt(lastPart, 10);
 const next = (isNaN(num) ? 0 : num) + 1;
 return `FAT-${year}-${String(next).padStart(3, '0')}`;
 };
 }, [purchases]);

 const nextInvoicePlaceholder = useMemo(() => {
 const year = new Date(newPurchaseDate).getFullYear();
 return getNextInvoiceNumber(year);
 }, [getNextInvoiceNumber, newPurchaseDate]);

 // Reset pagination when filters change
 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, selectedPeriod, customStartDate, customEndDate, filterPaymentStatus]);

 useEffect(() => {
 setProductCurrentPage(1);
 }, [productSearchQuery, selectedPeriod, customStartDate, customEndDate, filterPaymentStatus]);

 // Calculate date range from period filter
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
 case 'dayBeforeYesterday':
 start.setDate(today.getDate() - 2);
 start.setHours(0, 0, 0, 0);
 end.setDate(today.getDate() - 2);
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisWeek': {
 // Segunda-feira da semana atual
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajustar para segunda-feira
 start.setDate(diff);
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 }
 case 'lastWeek': {
 // Segunda-feira da semana passada
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7; // Semana passada
 start.setDate(diff);
 start.setHours(0, 0, 0, 0);
 // Domingo da semana passada
 end.setDate(diff + 6);
 end.setHours(23, 59, 59, 999);
 break;
 }
 case 'last7days':
 start.setDate(today.getDate() - 6);
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 case 'last30days':
 start.setDate(today.getDate() - 29);
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
 case 'lastMonth':
 start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
 start.setHours(0, 0, 0, 0);
 const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
 end.setTime(lastDay.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'last3Months':
 start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 case 'last6Months':
 start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
 start.setHours(0, 0, 0, 0);
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
 const lastDayOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
 end.setTime(lastDayOfLastYear.getTime());
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

 const [confirmDialog, setConfirmDialog] = useState<{
 isOpen: boolean;
 message: string;
 onConfirm: () => void;
 variant?: 'danger' | 'warning' | 'info';
 }>({
 isOpen: false,
 message: '',
 onConfirm: () => { },
 variant: 'warning'
 });

 // Get product purchase history
 const getProductPurchaseHistory = (productId: string, variant: string | null) => {
 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);

 return purchases
 .filter(p => {
 if (!p.date) return false;
 try {
 const purchaseDate = new Date(p.date);
 if (isNaN(purchaseDate.getTime())) return false;

 const purchaseDateNormalized = new Date(Date.UTC(
 purchaseDate.getFullYear(),
 purchaseDate.getMonth(),
 purchaseDate.getDate()
 ));
 const startNormalized = new Date(Date.UTC(
 start.getFullYear(),
 start.getMonth(),
 start.getDate()
 ));
 const endNormalized = new Date(Date.UTC(
 end.getFullYear(),
 end.getMonth(),
 end.getDate()
 ));

 return purchaseDateNormalized >= startNormalized && purchaseDateNormalized <= endNormalized;
 } catch (error) {
 return false;
 }
 })
 .filter(p => {
 if (filterPaymentStatus !== 'ALL') {
 if (filterPaymentStatus === 'paid') return p.paymentStatus === 'paid';
 if (filterPaymentStatus === 'partial') return p.paymentStatus === 'partial';
 if (filterPaymentStatus === 'unpaid') return p.paymentStatus === 'unpaid';
 }
 return true;
 })
 .map(p => {
 // If grouping without variants, get all items for this product
 if (productGroupMode === 'without-variants') {
 const items = p.items.filter(i => i.productId === productId);
 if (items.length === 0) return null;
 // Aggregate all items into one
 const aggregatedItem: PurchaseItem = {
 id: items[0].id,
 productId: productId,
 productName: items[0].productName,
 quantity: items.reduce((sum, i) => sum + i.quantity, 0),
 unitPrice: items.reduce((sum, i) => sum + (i.unitPrice || i.costPrice || 0), 0) / items.length,
 totalPrice: items.reduce((sum, i) => sum + (i.totalPrice || i.total || 0), 0),
 variant: null,
 unit: items[0].unit,
 costPrice: items.reduce((sum, i) => sum + (i.costPrice || i.unitPrice || 0), 0) / items.length,
 total: items.reduce((sum, i) => sum + (i.total || i.totalPrice || 0), 0)
 };
 return { ...p, item: aggregatedItem };
 } else {
 // Original behavior: match specific variant
 const normalizedVariant = variant && variant.trim() ? variant.trim() : null;
 const item = p.items.find(i => {
 const itemVariant = i.variant && i.variant.trim() ? i.variant.trim() : null;
 return i.productId === productId && itemVariant === normalizedVariant;
 });
 return item ? { ...p, item } : null;
 }
 })
 .filter((p): p is Purchase & { item: PurchaseItem } => p !== null)
 .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
 };

 const formatMoney = (value: number) => {
 return value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' }).replace(/MZN/gi, 'MT');
 };

 // Filtered products (mantido para "Criar produto" quando não encontrar)
 const filteredProducts = useMemo(() => {
 if (!productSearchQuery.trim()) return products;
 const query = normalizeForSearch(productSearchQuery);
 return products.filter(p =>
 normalizeForSearch(p.name).includes(query) ||
 (p.category && normalizeForSearch(p.category).includes(query))
 );
 }, [products, productSearchQuery]);

 // Mapear purchaseItems para o formato OrderItem (para ProductGrid - mesmo sistema dos pedidos)
 const selectedItemsForGrid = useMemo((): OrderItem[] => {
 return purchaseItems.map((item, index) => {
 const product = products.find(p => p.id === item.productId);
 const variantId = item.variant
 ? product?.variants?.find(v => v.name === item.variant)?.id
 : undefined;
 return {
 id: item.id ?? `pitem_${index}`,
 productId: item.productId,
 productName: item.productName,
 variantId,
 variantName: item.variant,
 quantity: item.quantity,
 price: item.costPrice ?? item.total ?? 0,
 unit: item.unit
 };
 });
 }, [purchaseItems, products]);

 // Purchase item management
 const handleAddPurchaseItem = (productId: string, variantName?: string) => {
 const product = products.find(p => p.id === productId);
 if (!product) return;

 // Se tem variação existente, usar dados da variação
 let variant: ProductVariant | undefined;
 if (variantName && product.variants) {
 variant = product.variants.find(v => v.name === variantName);
 }

 const existing = purchaseItems.find(i =>
 i.productId === productId &&
 ((variantName && i.variant === variantName) || (!variantName && !i.variant))
 );

 if (existing) {
 setPurchaseItems(purchaseItems.map(i =>
 i.productId === productId &&
 ((variantName && i.variant === variantName) || (!variantName && !i.variant))
 ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.costPrice, totalPrice: (i.quantity + 1) * i.costPrice }
 : i
 ));
 } else {
 const newId = `pitem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
 const cost = variant ? (variant.costPrice || 0) : (product.costPrice || 0);
 const unit = variant?.unit ?? product.unit;
 const newItem: PurchaseItem = {
 id: newId,
 productId: product.id,
 productName: product.name,
 quantity: 1,
 unitPrice: cost,
 totalPrice: cost,
 variant: variant?.name,
 unit,
 costPrice: cost,
 total: cost
 };
 setPurchaseItems([...purchaseItems, newItem]);
 }
 };


 const handleCreateNewProduct = async () => {
 if (!newProductData.name.trim()) {
 showToast('O nome do produto é obrigatório', 'error');
 return;
 }

 if (newProductData.costPrice <= 0) {
 showToast('O preço de compra deve ser maior que zero', 'error');
 return;
 }

 // Validar unidade
 if (!newProductData.unit) {
 showToast('Selecione uma unidade', 'error');
 return;
 }

 // Verificar se a unidade existe no sistema
 const unitExists = unitsList.some(u => u.abbreviation === newProductData.unit);
 if (!unitExists) {
 showToast(`Unidade "${newProductData.unit}" não encontrada no sistema. Por favor, crie a unidade primeiro em Gestão de Produtos.`, 'error');
 return;
 }

 try {
 const newProduct = await dataService.addProduct({
 name: newProductData.name.trim(),
 price: newProductData.costPrice * 1.5, // Estimar preço de venda
 costPrice: newProductData.costPrice,
 type: ProductType.FRESH,
 category: newProductData.category || 'Geral',
 stock: 0,
 minStock: 5,
 unit: newProductData.unit
 });

 if (newProduct) {
 showToast(`Produto "${newProductData.name.trim()}" criado com sucesso!`, 'success');
 // Adicionar é  compra
 handleAddPurchaseItem(newProduct.id, undefined);
 // Limpar formulário
 setShowNewProductForm(false);
 setNewProductData({ name: '', costPrice: 0, unit: 'un', category: '' });
 // Recarregar produtos
 window.dispatchEvent(new CustomEvent('products-updated'));
 } else {
 showToast('Erro ao criar produto', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao criar produto:', error);
 showToast('Erro ao criar produto', 'error');
 }
 };

 const handleUpdatePurchaseItem = (index: number, updates: Partial<PurchaseItem>) => {
 const updated = [...purchaseItems];
 updated[index] = { ...updated[index], ...updates };
 const cost = updated[index].costPrice ?? updated[index].unitPrice ?? 0;
 if (updates.quantity !== undefined || updates.costPrice !== undefined || updates.unitPrice !== undefined) {
 updated[index].total = updated[index].quantity * cost;
 updated[index].totalPrice = updated[index].total;
 if (updates.costPrice !== undefined) updated[index].unitPrice = updates.costPrice;
 }
 setPurchaseItems(updated);
 };

 const handleRemovePurchaseItem = (index: number) => {
 setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
 };

 const purchaseTotal = useMemo(() => {
 return purchaseItems.reduce((sum, item) => sum + item.total, 0);
 }, [purchaseItems]);


 const getInvoiceHtml = (purchase: Purchase): string => {
 const logoUrl = appSystemConfig.logo_light || appSystemConfig.logo_icon || '';
 const companyName = appSystemConfig.company_name || 'Quinta NICY';
 const primary = appSystemConfig.primary_color || '#35A754';
 const secondary = appSystemConfig.secondary_color || '#88E032';
 const systemName = appSystemConfig.system_name || '';

 const supplierName = purchase.supplierName || purchase.supplierLocationName || 'Fornecedor não especificado';
 const supplierType = purchase.supplierLocationName ? 'Local Comercial' : 'Fornecedor Externo';
 const itemRows = purchase.items.map(item => {
 const unitPrice = item.costPrice ?? item.unitPrice ?? 0;
 const total = item.total ?? item.totalPrice ?? item.quantity * unitPrice;
 return `
 <tr>
 <td>${item.productName}</td>
 <td>${item.variant || '-'}</td>
 <td>${item.quantity} ${item.unit || ''}</td>
 <td class="num">${formatMoney(unitPrice)}</td>
 <td class="num">${formatMoney(total)}</td>
 </tr>
 `;
 }).join('');

 return `<!DOCTYPE html>
<html>
 <head>
 <meta charset="utf-8">
 <title>Fatura - ${purchase.invoiceNumber || purchase.id}</title>
 <style>
 :root {
 --brand-primary: ${primary};
 --brand-secondary: ${secondary};
 }
 * { box-sizing: border-box; }
 body {
 font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
 color: #1f2937;
 background: #fff;
 padding: 24px 32px;
 margin: 0;
 line-height: 1.5;
 }
 .invoice-card {
 max-width: 800px;
 margin: 0 auto;
 background: #fff;
 border-radius: 12px;
 box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
 overflow: hidden;
 }
 .invoice-header {
 background: var(--brand-primary);
 color: #fff;
 padding: 20px 24px;
 display: flex;
 align-items: center;
 justify-content: space-between;
 flex-wrap: wrap;
 gap: 16px;
 }
 .invoice-header-left {
 display: flex;
 align-items: center;
 gap: 16px;
 flex-wrap: wrap;
 }
 .invoice-logo-wrap {
 background: #fff;
 padding: 10px 14px;
 border-radius: 8px;
 box-shadow: 0 1px 3px rgba(0,0,0,0.12);
 display: flex;
 align-items: center;
 justify-content: center;
 }
 .invoice-header img {
 max-height: 48px;
 width: auto;
 display: block;
 }
 .invoice-header .company-text {
 font-size: 1.5rem;
 font-weight: 700;
 letter-spacing: -0.02em;
 color: #166534;
 }
 .invoice-header .company-text-wrap {
 background: #fff;
 padding: 10px 14px;
 border-radius: 8px;
 box-shadow: 0 1px 3px rgba(0,0,0,0.12);
 }
 .invoice-header .doc-title {
 font-size: 0.95rem;
 font-weight: 600;
 opacity: 0.95;
 }
 .invoice-header .doc-number {
 font-size: 0.85rem;
 opacity: 0.9;
 }
 .invoice-header .system-name {
 font-size: 0.75rem;
 opacity: 0.85;
 width: 100%;
 margin-top: 2px;
 }
 .invoice-body { padding: 24px; }
 .info-block {
 margin-bottom: 24px;
 }
 .info-block p {
 margin: 6px 0;
 color: #1f2937;
 }
 .info-block strong { color: #374151; }
 .items-table-wrap {
 border: 1px solid #e5e7eb;
 border-radius: 8px;
 overflow: hidden;
 margin: 20px 0;
 }
 .items-table {
 width: 100%;
 border-collapse: collapse;
 font-size: 0.9rem;
 }
 .items-table thead tr {
 background: var(--brand-primary);
 color: #fff;
 }
 .items-table th {
 padding: 12px 14px;
 text-align: left;
 font-weight: 600;
 }
 .items-table td {
 padding: 10px 14px;
 border-bottom: 1px solid #e5e7eb;
 }
 .items-table tbody tr:nth-child(even) { background: #f9fafb; }
 .items-table tbody tr:last-child td { border-bottom: none; }
 .items-table .num { text-align: right; }
 .totals-block {
 margin-top: 24px;
 padding: 16px 20px;
 background: #f0fdf4;
 border: 1px solid var(--brand-primary);
 border-radius: 8px;
 }
 .totals-block p {
 margin: 6px 0;
 display: flex;
 justify-content: space-between;
 align-items: center;
 font-weight: 600;
 }
 .totals-block .total-main { font-size: 1.1rem; }
 .invoice-footer {
 margin-top: 24px;
 text-align: center;
 font-size: 0.8rem;
 color: #6b7280;
 }
 @page {
 size: A4;
 margin: 12mm;
 }
 @media print {
 html, body {
 margin: 0;
 padding: 0;
 background: #fff;
 -webkit-print-color-adjust: exact;
 print-color-adjust: exact;
 }
 body { padding: 0 16px; }
 .invoice-card {
 max-width: 100%;
 box-shadow: none;
 border-radius: 0;
 border: none;
 }
 .invoice-header,
 .invoice-logo-wrap,
 .company-text-wrap,
 .items-table thead tr,
 .totals-block {
 -webkit-print-color-adjust: exact;
 print-color-adjust: exact;
 }
 .invoice-header { background: var(--brand-primary) !important; }
 .items-table thead tr { background: var(--brand-primary) !important; }
 .invoice-logo-wrap,
 .company-text-wrap { background: #fff !important; }
 .totals-block { background: #f0fdf4 !important; }
 .items-table tbody tr:nth-child(even) { background: #f9fafb !important; }
 }
 </style>
 </head>
 <body>
 <div class="invoice-card">
 <div class="invoice-header">
 <div class="invoice-header-left">
 ${logoUrl ? `<div class="invoice-logo-wrap"><img src="${logoUrl}" alt="${companyName}" /></div>` : `<div class="company-text-wrap"><span class="company-text">${companyName}</span></div>`}
 <div>
 <div class="doc-title">FATURA DE COMPRA</div>
 <div class="doc-number">Número: ${purchase.invoiceNumber || purchase.id}</div>
 ${systemName ? `<div class="system-name">${systemName}</div>` : ''}
 </div>
 </div>
 </div>
 <div class="invoice-body">
 <div class="info-block">
 <p><strong>${supplierType}:</strong> ${supplierName}</p>
 <p><strong>Data:</strong> ${new Date(purchase.date).toLocaleDateString('pt-MZ')}</p>
 ${purchase.notes ? `<p><strong>Notas:</strong> ${purchase.notes}</p>` : ''}
 </div>
 <div class="items-table-wrap">
 <table class="items-table">
 <thead>
 <tr>
 <th>Produto</th>
 <th>Variação</th>
 <th>Quantidade</th>
 <th class="num">Preço Unit.</th>
 <th class="num">Total</th>
 </tr>
 </thead>
 <tbody>
 ${itemRows}
 </tbody>
 </table>
 </div>
 <div class="totals-block">
 <p class="total-main"><span>Total:</span><span>${formatMoney(purchase.totalAmount)}</span></p>
 ${purchase.amountPaid && purchase.amountPaid > 0 ? `<p><span>Pago:</span><span>${formatMoney(purchase.amountPaid)}</span></p>` : ''}
 ${purchase.amountPaid != null && purchase.amountPaid < purchase.totalAmount ? `<p><span>Pendente:</span><span>${formatMoney(purchase.totalAmount - purchase.amountPaid)}</span></p>` : ''}
 </div>
 ${appSystemConfig.company_website ? `<div class="invoice-footer">${companyName} &mdash; ${appSystemConfig.company_website}</div>` : ''}
 </div>
 </div>
 </body>
</html>`;
 };

 const handlePrintInvoice = (purchase: Purchase) => {
 const printWindow = window.open('', '_blank');
 if (!printWindow) return;
 printWindow.document.write(getInvoiceHtml(purchase));
 printWindow.document.close();
 setTimeout(() => {
 printWindow.focus();
 printWindow.print();
 printWindow.onafterprint = () => printWindow.close();
 }, 300);
 };

 const downloadInvoicePDF = (purchase: Purchase) => {
 const companyName = appSystemConfig.company_name || 'Quinta NICY';
 const systemName = appSystemConfig.system_name || '';
 const supplierName = purchase.supplierName || purchase.supplierLocationName || 'Fornecedor não especificado';
 const supplierType = purchase.supplierLocationName ? 'Local Comercial' : 'Fornecedor Externo';
 const invoiceNum = purchase.invoiceNumber || purchase.id;
 const colors = getBrandColors();
 const pdf = new jsPDF('p', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 15;
 let y = margin;

 // Cabeçalho verde
 const headerH = 28;
 pdf.setFillColor(...colors.primaryRgb);
 pdf.rect(0, 0, pdfWidth, headerH, 'F');

 // Caixa branca do logo/nome à esquerda
 const boxW = 42;
 const boxH = 18;
 const boxX = margin;
 const boxY = (headerH - boxH) / 2;
 pdf.setFillColor(255, 255, 255);
 pdf.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
 pdf.setFontSize(11);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(22, 101, 52);
 pdf.text(companyName, boxX + boxW / 2, boxY + boxH / 2 + 2, { align: 'center', maxWidth: boxW - 4 });

 // Texto à direita do cabeçalho (branco)
 pdf.setFontSize(10);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255);
 pdf.text('FATURA DE COMPRA', pdfWidth - margin, boxY + 5, { align: 'right' });
 pdf.setFont('helvetica', 'normal');
 pdf.setFontSize(9);
 pdf.text(`Número: ${invoiceNum}`, pdfWidth - margin, boxY + 11, { align: 'right' });
 if (systemName) pdf.text(systemName, pdfWidth - margin, boxY + 17, { align: 'right' });

 y = headerH + 14;

 // Info fornecedor e data
 pdf.setFontSize(10);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(31, 41, 55);
 pdf.text(`${supplierType}: ${supplierName}`, margin, y);
 y += 7;
 pdf.setFont('helvetica', 'normal');
 pdf.text(`Data: ${new Date(purchase.date).toLocaleDateString('pt-MZ')}`, margin, y);
 y += 10;

 // Tabela: cabeçalho
 const colW = [70, 35, 25, 28, 32];
 const tableWidth = colW.reduce((a, b) => a + b, 0);
 const rowH = 8;
 pdf.setFillColor(...colors.primaryRgb);
 pdf.rect(margin, y, tableWidth, rowH, 'F');
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255);
 let x = margin;
 ['Produto', 'Variação', 'Qtd', 'Preço Unit.', 'Total'].forEach((txt, i) => {
 pdf.text(txt, x + 2, y + 5.5, { maxWidth: colW[i] - 4 });
 x += colW[i];
 });
 y += rowH;

 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(31, 41, 55);
 pdf.setFontSize(9);

 purchase.items.forEach((item, idx) => {
 if (y + rowH > pdfHeight - 25) {
 pdf.addPage();
 y = margin;
 pdf.setFillColor(...colors.primaryRgb);
 pdf.rect(margin, y, tableWidth, rowH, 'F');
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255);
 x = margin;
 ['Produto', 'Variação', 'Qtd', 'Preço Unit.', 'Total'].forEach((txt, i) => {
 pdf.text(txt, x + 2, y + 5.5, { maxWidth: colW[i] - 4 });
 x += colW[i];
 });
 y += rowH;
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(31, 41, 55);
 }
 if (idx % 2 === 1) {
 pdf.setFillColor(249, 250, 251);
 pdf.rect(margin, y, tableWidth, rowH, 'F');
 }
 const unitPrice = item.costPrice ?? item.unitPrice ?? 0;
 const total = item.total ?? item.totalPrice ?? item.quantity * unitPrice;
 x = margin;
 pdf.text(item.productName, x + 2, y + 5.5, { maxWidth: colW[0] - 4 });
 x += colW[0];
 pdf.text(item.variant || '-', x + 2, y + 5.5, { maxWidth: colW[1] - 4 });
 x += colW[1];
 pdf.text(`${item.quantity} ${item.unit || ''}`.trim(), x + 2, y + 5.5, { maxWidth: colW[2] - 4 });
 x += colW[2];
 pdf.text(formatMoney(unitPrice), x + colW[3] - 2, y + 5.5, { align: 'right' });
 x += colW[3];
 pdf.text(formatMoney(total), x + colW[4] - 2, y + 5.5, { align: 'right' });
 y += rowH;
 });

 y += 8;

 // Bloco totais
 pdf.setFillColor(240, 253, 244);
 pdf.setDrawColor(...colors.primaryRgb);
 pdf.setLineWidth(0.3);
 const totH = purchase.amountPaid != null ? 22 : 14;
 pdf.roundedRect(margin, y, 80, totH, 2, 2, 'FD');
 pdf.setFont('helvetica', 'bold');
 pdf.setFontSize(10);
 pdf.setTextColor(31, 41, 55);
 pdf.text(`Total: ${formatMoney(purchase.totalAmount)}`, margin + 6, y + 8);
 if (purchase.amountPaid != null && purchase.amountPaid > 0) {
 pdf.text(`Pago: ${formatMoney(purchase.amountPaid)}`, margin + 6, y + 14);
 }
 if (purchase.amountPaid != null && purchase.amountPaid < purchase.totalAmount) {
 pdf.text(`Pendente: ${formatMoney(purchase.totalAmount - purchase.amountPaid)}`, margin + 6, y + 20);
 }
 y += totH + 8;

 if (appSystemConfig.company_website && y < pdfHeight - 20) {
 pdf.setFontSize(8);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(107, 114, 128);
 pdf.text(`${companyName} — ${appSystemConfig.company_website}`, pdfWidth / 2, y, { align: 'center' });
 }

 const fileName = `Fatura-${String(invoiceNum).replace(/\s/g, '-')}.pdf`;
 pdf.save(fileName);
 };

 // Submit handlers
 const handleSubmitPurchase = async () => {
 if (purchaseItems.length === 0) {
 showToast('Adicione pelo menos um item à compra', 'error');
 return;
 }

 // Validar que pelo menos um fornecedor está selecionado
 if (!selectedSupplier) {
 showToast('Selecione um fornecedor externo', 'error');
 return;
 }



 const supplier = suppliers.find(s => s.id === selectedSupplier);

 // Gerar número de fatura automaticamente se não fornecido (baseado na última fatura + 1)
 let invoiceNumber = purchaseInvoiceNumber.trim();
 if (!invoiceNumber && !editingPurchase) {
 const year = new Date(newPurchaseDate).getFullYear();
 invoiceNumber = getNextInvoiceNumber(year);
 }

 const purchase: Purchase = {
 id: editingPurchase?.id || '',
 supplierId: selectedSupplier,
 supplierName: supplier?.name || '',
 supplierLocationId: undefined,
 supplierLocationName: undefined,
 date: newPurchaseDate,
 invoiceNumber: invoiceNumber || undefined,
 items: purchaseItems,
 totalAmount: purchaseTotal,
 paymentStatus: purchasePaymentStatus,
 amountPaid: purchasePaymentStatus === 'paid' ? purchaseTotal : purchasePaymentStatus === 'partial' ? purchaseAmountPaid : undefined,
 paymentDate: purchasePaymentStatus === 'paid' ? newPurchaseDate : undefined,
 notes: purchaseNotes || undefined,
 createdAt: editingPurchase?.createdAt || new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };

 if (editingPurchase) {
 if (onUpdatePurchase) {
 onUpdatePurchase(purchase);
 }
 } else {
 onAddPurchase(purchase);
 }

 resetPurchaseForm();
 };


 const handleSubmitSupplier = async () => {
 if (!supplierName.trim()) {
 showToast('O nome do fornecedor é obrigatório', 'error');
 return;
 }

 const supplier: Supplier = {
 id: editingSupplier?.id || '',
 name: supplierName,
 contactPerson: supplierContactPerson || undefined,
 phone: supplierPhone || undefined,
 email: supplierEmail || undefined,
 address: supplierAddress || undefined,
 notes: supplierNotes || undefined,
 isActive: true,
 createdAt: editingSupplier?.createdAt || new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };

 if (editingSupplier) {
 if (onUpdateSupplier) {
 onUpdateSupplier(supplier);
 }
 } else {
 onAddSupplier(supplier);
 }

 resetSupplierForm();
 };

 // Reset forms
 const resetPurchaseForm = () => {
 setIsPurchaseModalOpen(false);
 setEditingPurchase(null);
 setNewPurchaseDate(getTodayDateString());
 setSelectedSupplier('');
 setPurchaseItems([]);
 setProductSearchQuery('');
 setPurchaseInvoiceNumber('');
 setPurchasePaymentStatus('unpaid');
 setPurchaseAmountPaid(0);
 setPurchaseNotes('');
 setSelectedProductForVariant(null);
 setShowNewVariantForm(null);
 setNewVariantData({ name: '', costPrice: 0, price: 0, unit: '' });
 setShowNewProductForm(false);
 setNewProductData({ name: '', costPrice: 0, unit: 'un', category: '' });
 setPurchaseProductsSectionOpen(true);
 setPurchaseItemsSectionOpen(true);
 };

 const resetSupplierForm = () => {
 setIsSupplierModalOpen(false);
 setEditingSupplier(null);
 setSupplierName('');
 setSupplierContactPerson('');
 setSupplierPhone('');
 setSupplierEmail('');
 setSupplierAddress('');
 setSupplierNotes('');
 };

 // Edit handlers
 const handleEditPurchase = (purchase: Purchase) => {
 setEditingPurchase(purchase);
 setNewPurchaseDate(purchase.date);
 setSelectedSupplier(purchase.supplierId || '');
 setPurchaseItems(purchase.items);
 setPurchaseInvoiceNumber(purchase.invoiceNumber || '');
 setPurchasePaymentStatus(purchase.paymentStatus);
 setPurchaseAmountPaid(purchase.amountPaid || 0);
 setPurchaseNotes(purchase.notes || '');
 setIsPurchaseModalOpen(true);
 };


 const handleEditSupplier = (supplier: Supplier) => {
 setEditingSupplier(supplier);
 setSupplierName(supplier.name);
 setSupplierContactPerson(supplier.contactPerson || '');
 setSupplierPhone(supplier.phone || '');
 setSupplierEmail(supplier.email || '');
 setSupplierAddress(supplier.address || '');
 setSupplierNotes(supplier.notes || '');
 setIsSupplierModalOpen(true);
 };

 // Delete handlers
 const handleDeletePurchase = (id: string) => {
 if (!onDeletePurchase) return;
 setConfirmDialog({
 isOpen: true,
 message: 'Deseja realmente apagar esta compra?',
 variant: 'danger',
 onConfirm: () => {
 onDeletePurchase(id);
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 const handleDeleteSupplier = (id: string) => {
 if (!onDeleteSupplier) return;
 setConfirmDialog({
 isOpen: true,
 message: 'Deseja realmente apagar este fornecedor?',
 variant: 'danger',
 onConfirm: () => {
 onDeleteSupplier(id);
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 // Filtered and sorted purchases
 const filteredAndSortedPurchases = useMemo(() => {
 let filtered = [...purchases];

 // Apply period filter
 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);

 filtered = filtered.filter(p => {
 if (!p.date) return false;

 try {
 // Normalizar data da compra para comparação correta
 let purchaseDate: Date;

 if (typeof p.date === 'string') {
 // Se é string, pode ser YYYY-MM-DD ou ISO string
 // Criar Date usando apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
 const dateStr = p.date.split('T')[0]; // Remove parte do tempo se existir
 const [year, month, day] = dateStr.split('-').map(Number);

 // Validar valores antes de criar Date
 if (isNaN(year) || isNaN(month) || isNaN(day)) {
 return false;
 }

 purchaseDate = new Date(year, month - 1, day);
 } else {
 purchaseDate = new Date(p.date);
 }

 // Verificar se a data é válida
 if (isNaN(purchaseDate.getTime())) {
 return false;
 }

 // Normalizar para início do dia para comparação (usar UTC para evitar problemas de timezone)
 const purchaseDateNormalized = new Date(Date.UTC(
 purchaseDate.getFullYear(),
 purchaseDate.getMonth(),
 purchaseDate.getDate()
 ));

 // Normalizar start e end também para UTC
 const startNormalized = new Date(Date.UTC(
 start.getFullYear(),
 start.getMonth(),
 start.getDate()
 ));

 const endNormalized = new Date(Date.UTC(
 end.getFullYear(),
 end.getMonth(),
 end.getDate()
 ));

 // Comparar datas normalizadas
 return purchaseDateNormalized >= startNormalized && purchaseDateNormalized <= endNormalized;
 } catch (error) {
 console.error('Erro ao processar data da compra:', p.date, error);
 return false;
 }
 });

 // Apply search filter
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filtered = filtered.filter(p =>
 (p.supplierName && normalizeForSearch(p.supplierName).includes(query)) ||
 (p.supplierLocationName && normalizeForSearch(p.supplierLocationName).includes(query)) ||
 (p.invoiceNumber && normalizeForSearch(p.invoiceNumber).includes(query)) ||
 (p.notes && normalizeForSearch(p.notes).includes(query)) ||
 p.items.some(item => normalizeForSearch(item.productName).includes(query))
 );
 }

 // Apply payment status filter
 if (filterPaymentStatus !== 'ALL') {
 filtered = filtered.filter(p => {
 if (filterPaymentStatus === 'paid') {
 return p.paymentStatus === 'paid';
 } else if (filterPaymentStatus === 'partial') {
 return p.paymentStatus === 'partial';
 } else if (filterPaymentStatus === 'unpaid') {
 return p.paymentStatus === 'unpaid';
 }
 return true;
 });
 }

 // Apply sorting
 filtered.sort((a, b) => {
 let aValue: any;
 let bValue: any;

 switch (sortField) {
 case 'date':
 aValue = new Date(a.date).getTime();
 bValue = new Date(b.date).getTime();
 break;
 case 'totalAmount':
 aValue = a.totalAmount;
 bValue = b.totalAmount;
 break;
 case 'supplier':
 aValue = a.supplierName || a.supplierLocationName || '';
 bValue = b.supplierName || b.supplierLocationName || '';
 break;
 default:
 return 0;
 }

 if (sortDirection === 'asc') {
 return aValue > bValue ? 1 : -1;
 } else {
 return aValue < bValue ? 1 : -1;
 }
 });

 return filtered;
 }, [purchases, searchQuery, selectedPeriod, customStartDate, customEndDate, filterPaymentStatus, sortField, sortDirection]);

 // Calculate totals for the filtered period
 const periodTotals = useMemo(() => {
 const total = filteredAndSortedPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
 const paid = filteredAndSortedPurchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
 const pending = total - paid;
 const count = filteredAndSortedPurchases.length;

 return { total, paid, pending, count };
 }, [filteredAndSortedPurchases]);

 // Aggregate purchases by product/variant
 const productPurchases = useMemo(() => {
 // Apply same filters as filteredAndSortedPurchases
 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);

 let filtered = purchases.filter(p => {
 if (!p.date) return false;
 try {
 const purchaseDate = new Date(p.date);
 if (isNaN(purchaseDate.getTime())) return false;

 const purchaseDateNormalized = new Date(Date.UTC(
 purchaseDate.getFullYear(),
 purchaseDate.getMonth(),
 purchaseDate.getDate()
 ));
 const startNormalized = new Date(Date.UTC(
 start.getFullYear(),
 start.getMonth(),
 start.getDate()
 ));
 const endNormalized = new Date(Date.UTC(
 end.getFullYear(),
 end.getMonth(),
 end.getDate()
 ));

 return purchaseDateNormalized >= startNormalized && purchaseDateNormalized <= endNormalized;
 } catch (error) {
 return false;
 }
 });

 // Apply payment status filter
 if (filterPaymentStatus !== 'ALL') {
 filtered = filtered.filter(p => {
 if (filterPaymentStatus === 'paid') return p.paymentStatus === 'paid';
 if (filterPaymentStatus === 'partial') return p.paymentStatus === 'partial';
 if (filterPaymentStatus === 'unpaid') return p.paymentStatus === 'unpaid';
 return true;
 });
 }

 // Group by product and variant (or just product if grouping without variants)
 const productMap = new Map<string, ProductPurchaseSummary>();
 const supplierMap = new Map<string, Set<string>>();
 const invoiceMap = new Map<string, Set<{ number: string, date: string, purchaseId: string }>>();

 filtered.forEach(purchase => {
 purchase.items.forEach(item => {
 // Normalize variant: treat null, undefined, and empty string as "no variant"
 const variant = item.variant && item.variant.trim() ? item.variant.trim() : null;

 // If grouping without variants, ignore the variant in the key
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
 purchaseCount: 0,
 suppliers: [],
 invoices: [],
 lastPurchaseDate: purchase.date || ''
 });
 supplierMap.set(productKey, new Set());
 invoiceMap.set(productKey, new Set());
 }

 const summary = productMap.get(productKey)!;
 summary.totalQuantity += item.quantity || 0;
 summary.totalValue += item.totalPrice || 0;
 summary.purchaseCount += 1;

 // Add supplier if not already added
 const supplierId = purchase.supplierId || '';
 const supplierName = purchase.supplierName || purchase.supplierLocationName || '';
 if (supplierId && supplierName && !supplierMap.get(productKey)!.has(supplierId)) {
 supplierMap.get(productKey)!.add(supplierId);
 summary.suppliers.push({ id: supplierId, name: supplierName });
 }

 // Add invoice if exists
 if (purchase.invoiceNumber) {
 const invoiceKey = `${purchase.invoiceNumber}-${purchase.id}`;
 if (!invoiceMap.get(productKey)!.has(invoiceKey)) {
 invoiceMap.get(productKey)!.add(invoiceKey);
 summary.invoices.push({
 number: purchase.invoiceNumber,
 date: purchase.date || '',
 purchaseId: purchase.id
 });
 }
 }

 // Update last purchase date
 if (purchase.date && (!summary.lastPurchaseDate || new Date(purchase.date) > new Date(summary.lastPurchaseDate))) {
 summary.lastPurchaseDate = purchase.date;
 }
 });
 });

 // Convert map to array
 let result = Array.from(productMap.values());

 // Apply search filter
 if (productSearchQuery.trim()) {
 const query = normalizeForSearch(productSearchQuery);
 result = result.filter(p =>
 normalizeForSearch(p.productName).includes(query) ||
 (p.variant && normalizeForSearch(p.variant).includes(query))
 );
 }

 // Apply sorting
 result.sort((a, b) => {
 let aValue: any;
 let bValue: any;

 switch (productSortField) {
 case 'product':
 aValue = `${a.productName} ${a.variant || ''}`.toLowerCase();
 bValue = `${b.productName} ${b.variant || ''}`.toLowerCase();
 break;
 case 'quantity':
 aValue = a.totalQuantity;
 bValue = b.totalQuantity;
 break;
 case 'value':
 aValue = a.totalValue;
 bValue = b.totalValue;
 break;
 case 'purchaseCount':
 aValue = a.purchaseCount;
 bValue = b.purchaseCount;
 break;
 case 'lastPurchase':
 aValue = new Date(a.lastPurchaseDate).getTime();
 bValue = new Date(b.lastPurchaseDate).getTime();
 break;
 default:
 return 0;
 }

 if (productSortDirection === 'asc') {
 return aValue > bValue ? 1 : -1;
 } else {
 return aValue < bValue ? 1 : -1;
 }
 });

 return result;
 }, [purchases, productSearchQuery, selectedPeriod, customStartDate, customEndDate, filterPaymentStatus, productSortField, productSortDirection, productGroupMode]);

 // Pagination for product purchases
 const productTotalPages = Math.ceil(productPurchases.length / itemsPerPage);
 const paginatedProductPurchases = useMemo(() => {
 const start = (productCurrentPage - 1) * itemsPerPage;
 return productPurchases.slice(start, start + itemsPerPage);
 }, [productPurchases, productCurrentPage, itemsPerPage]);

 // Calculate totals for product purchases
 const productTotals = useMemo(() => {
 const totalProducts = productPurchases.length;
 const totalQuantity = productPurchases.reduce((sum, p) => sum + p.totalQuantity, 0);
 const totalValue = productPurchases.reduce((sum, p) => sum + p.totalValue, 0);
 return { totalProducts, totalQuantity, totalValue };
 }, [productPurchases]);

 // Calculate supplier statistics
 const supplierStats = useMemo(() => {
 const statsMap = new Map<string, SupplierStats>();

 // Get date range from period filter
 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);

 // Filter purchases by period
 const filteredPurchases = purchases.filter(p => {
 if (!p.date) return false;
 const purchaseDate = new Date(p.date);
 const startDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0));
 const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999));
 const purchaseDateUTC = new Date(Date.UTC(purchaseDate.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate()));
 return purchaseDateUTC >= startDate && purchaseDateUTC <= endDate;
 });

 // Initialize with all active suppliers
 suppliers.filter(s => s.isActive).forEach(supplier => {
 statsMap.set(supplier.id, {
 supplierId: supplier.id,
 supplierName: supplier.name,
 supplier: supplier,
 totalPurchases: 0,
 totalValue: 0,
 totalPaid: 0,
 pendingAmount: 0,
 lastPurchaseDate: null,
 purchases: []
 });
 });

 // Aggregate purchase data (using filtered purchases)
 filteredPurchases.forEach(purchase => {
 const supplierId = purchase.supplierId;
 if (statsMap.has(supplierId)) {
 const stats = statsMap.get(supplierId)!;
 stats.totalPurchases += 1;
 stats.totalValue += purchase.totalAmount || 0;
 stats.totalPaid += purchase.amountPaid || 0;
 stats.purchases.push(purchase);

 // Update last purchase date
 if (purchase.date && (!stats.lastPurchaseDate ||
 new Date(purchase.date) > new Date(stats.lastPurchaseDate))) {
 stats.lastPurchaseDate = purchase.date;
 }
 }
 });

 // Calculate pending amount and sort purchases
 statsMap.forEach(stats => {
 stats.pendingAmount = stats.totalValue - stats.totalPaid;
 // Sort purchases by date (most recent first)
 stats.purchases.sort((a, b) =>
 new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
 );
 });

 // Return only suppliers with purchases in the selected period
 return Array.from(statsMap.values()).filter(s => s.totalPurchases > 0);
 }, [suppliers, purchases, selectedPeriod, customStartDate, customEndDate]);

 // Filter and sort supplier stats
 const filteredAndSortedSupplierStats = useMemo(() => {
 let result = [...supplierStats];

 // Apply search filter
 if (supplierSearchQuery.trim()) {
 const query = normalizeForSearch(supplierSearchQuery);
 result = result.filter(s =>
 normalizeForSearch(s.supplierName).includes(query) ||
 (s.supplier.contactPerson && normalizeForSearch(s.supplier.contactPerson).includes(query)) ||
 (s.supplier.phone && normalizeForSearch(s.supplier.phone).includes(query))
 );
 }

 // Apply debt filter
 if (supplierDebtFilter === 'WITH_DEBT') {
 result = result.filter(s => s.pendingAmount > 0);
 } else if (supplierDebtFilter === 'NO_DEBT') {
 result = result.filter(s => s.pendingAmount <= 0);
 }

 // Apply sorting
 result.sort((a, b) => {
 let aValue: any;
 let bValue: any;

 switch (supplierSortField) {
 case 'name':
 aValue = a.supplierName.toLowerCase();
 bValue = b.supplierName.toLowerCase();
 break;
 case 'totalValue':
 aValue = a.totalValue;
 bValue = b.totalValue;
 break;
 case 'pendingAmount':
 aValue = a.pendingAmount;
 bValue = b.pendingAmount;
 break;
 case 'totalPurchases':
 aValue = a.totalPurchases;
 bValue = b.totalPurchases;
 break;
 default:
 return 0;
 }

 if (supplierSortDirection === 'asc') {
 return aValue > bValue ? 1 : -1;
 } else {
 return aValue < bValue ? 1 : -1;
 }
 });

 return result;
 }, [supplierStats, supplierSearchQuery, supplierDebtFilter, supplierSortField, supplierSortDirection]);

 // Calculate supplier totals for display
 const supplierTotals = useMemo(() => {
 const totalSuppliers = filteredAndSortedSupplierStats.length;
 const totalValue = filteredAndSortedSupplierStats.reduce((sum, s) => sum + s.totalValue, 0);
 const totalPaid = filteredAndSortedSupplierStats.reduce((sum, s) => sum + s.totalPaid, 0);
 const totalPending = filteredAndSortedSupplierStats.reduce((sum, s) => sum + s.pendingAmount, 0);
 return { totalSuppliers, totalValue, totalPaid, totalPending };
 }, [filteredAndSortedSupplierStats]);

 const totalPages = Math.ceil(filteredAndSortedPurchases.length / itemsPerPage);
 const paginatedPurchases = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredAndSortedPurchases.slice(start, start + itemsPerPage);
 }, [filteredAndSortedPurchases, currentPage, itemsPerPage]);

 // Funçéo para exportar compras para Excel
 const exportToExcel = async () => {
 try {
 if (filteredAndSortedPurchases.length === 0) {
 showToast('Não há compras para exportar', 'warning');
 return;
 }

 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 // Preparar Informações do período e filtros
 const periodLabel = selectedPeriod === 'custom'
 ? `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`
 : selectedPeriod === 'today' ? 'Hoje'
 : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês'
 : selectedPeriod === 'thisYear' ? 'Este Ano'
 : selectedPeriod === 'lastWeek' ? 'Semana passada'
 : selectedPeriod === 'lastMonth' ? 'Mês passado'
 : selectedPeriod === 'lastYear' ? 'Ano passado'
 : `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: searchQuery });
 }
 if (filterPaymentStatus !== 'ALL') {
 filters.push({ label: 'Status Pagamento', value: filterPaymentStatus === 'paid' ? 'Pago' : filterPaymentStatus === 'partial' ? 'Parcial' : 'Não Pago' });
 }
 filters.push({ label: 'Total de compras', value: filteredAndSortedPurchases.length.toString() });

 // Preparar dados para exportaçéo
 const exportData = filteredAndSortedPurchases.map(purchase => {
 const purchaseDate = new Date(purchase.date);
 const pending = purchase.totalAmount - (purchase.amountPaid || 0);

 return {
 'Data': purchaseDate.toLocaleDateString('pt-PT'),
 'Fornecedor': purchase.supplierName || purchase.supplierLocationName || '',
 'Tipo': purchase.supplierLocationName ? 'Local Comercial' : 'Fornecedor Externo',
 'Fatura': purchase.invoiceNumber || '',
 'Itens': purchase.items.length,
 'Total': purchase.totalAmount,
 'Pago': purchase.amountPaid || 0,
 'Pendente': pending,
 'Status Pagamento': purchase.paymentStatus === 'paid' ? 'Pago' : purchase.paymentStatus === 'partial' ? 'Parcial' : 'Não Pago',
 'Produtos': purchase.items.map(item => `${item.quantity}${item.unit} ${item.productName}${item.variant ? ` (${item.variant})` : ''}`).join('; '),
 'Notas': purchase.notes || ''
 };
 });

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Compras');

 const headerRow = await addExcelHeader(ws, 'Gestão de Compras', {
 period: periodLabel,
 filters,
 startRow: 0,
 });

 const headers = ['Data', 'Fornecedor', 'Fatura', 'Itens', 'Total', 'Pago', 'Pendente', 'Status Pagamento', 'Produtos', 'Notas'];
 formatExcelTableHeaders(ws, headers, headerRow, 0);

 const dataStartRow = headerRow + 1;
 addJsonToSheetAt(ws, exportData as Record<string, unknown>[], dataStartRow + 1, 1, { skipHeader: true });

 const dataEndRow = dataStartRow + exportData.length - 1;
 formatExcelDataCells(ws, dataStartRow, dataEndRow, 0, headers.length - 1, {
 alternateRowColors: true,
 numberFormat: '#,##0.00',
 });

 [12, 25, 15, 8, 15, 15, 15, 15, 60, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 await addExcelFooter(ws, dataEndRow, { showCompanyInfo: true });

 const periodLabelFile = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `compras_${periodLabelFile}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação para Excel concluída: ${filteredAndSortedPurchases.length} compras`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 // Funçéo para exportar compras para PDF
 const exportToPDF = async () => {
 try {
 if (filteredAndSortedPurchases.length === 0) {
 showToast('Não há compras para exportar', 'warning');
 return;
 }

 showToast('Gerando PDF...', 'info');

 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar Informações do período e filtros
 const periodLabel = selectedPeriod === 'custom'
 ? `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`
 : selectedPeriod === 'today' ? 'Hoje'
 : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês'
 : selectedPeriod === 'thisYear' ? 'Este Ano'
 : selectedPeriod === 'lastWeek' ? 'Semana passada'
 : selectedPeriod === 'lastMonth' ? 'Mês passado'
 : selectedPeriod === 'lastYear' ? 'Ano passado'
 : `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (searchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: searchQuery });
 }
 if (filterPaymentStatus !== 'ALL') {
 filters.push({ label: 'Status Pagamento', value: filterPaymentStatus === 'paid' ? 'Pago' : filterPaymentStatus === 'partial' ? 'Parcial' : 'Não Pago' });
 }
 filters.push({ label: 'Total de compras', value: filteredAndSortedPurchases.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Gestão de Compras', {
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
 pdf.text(`Total: ${formatMoney(periodTotals.total)}`, margin, yPos);
 pdf.text(`Pago: ${formatMoney(periodTotals.paid)}`, margin + 60, yPos);
 pdf.text(`Pendente: ${formatMoney(periodTotals.pending)}`, margin + 120, yPos);
 pdf.text(`NÂº Compras: ${periodTotals.count}`, margin + 180, yPos);
 yPos += 10;

 // Tabela de compras com cabeçalho destacado
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = [1.2, 2.0, 1.2, 0.8, 1.5, 1.5, 1.5, 1.5]; // 8 colunas
 const totalProportion = colProportions.reduce((sum, prop) => sum + prop, 0);
 const colWidths = colProportions.map(prop => (prop / totalProportion) * availableWidth);

 const headers = ['Data', 'Fornecedor', 'Fatura', 'Itens', 'Total', 'Pago', 'Pendente', 'Status'];
 const headerHeight = 8;

 // Cabeçalho da tabela
 pdf.setFillColor(...colors.primaryRgb);
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255);

 let xPos = margin;
 headers.forEach((header, idx) => {
 pdf.rect(xPos, yPos, colWidths[idx], headerHeight, 'F');
 pdf.text(header, xPos + 2, yPos + 5, { maxWidth: colWidths[idx] - 4, align: 'left' });
 xPos += colWidths[idx];
 });
 yPos += headerHeight;

 // Linhas de dados
 pdf.setFontSize(8);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0);

 filteredAndSortedPurchases.forEach((purchase, idx) => {
 // Verificar se precisa de nova página
 if (yPos + 8 > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 }

 // Cor alternada para linhas
 if (idx % 2 === 0) {
 pdf.setFillColor(245, 245, 245);
 pdf.rect(margin, yPos, availableWidth, 8, 'F');
 }

 const purchaseDate = new Date(purchase.date);
 const pending = purchase.totalAmount - (purchase.amountPaid || 0);
 const statusText = purchase.paymentStatus === 'paid' ? 'Pago' : purchase.paymentStatus === 'partial' ? 'Parcial' : 'Não Pago';

 const rowData = [
 purchaseDate.toLocaleDateString('pt-PT'),
 purchase.supplierName || purchase.supplierLocationName || '',
 purchase.invoiceNumber || '-',
 purchase.items.length.toString(),
 formatMoney(purchase.totalAmount),
 formatMoney(purchase.amountPaid || 0),
 formatMoney(pending),
 statusText
 ];

 xPos = margin;
 rowData.forEach((cell, cellIdx) => {
 pdf.text(cell, xPos + 2, yPos + 5, { maxWidth: colWidths[cellIdx] - 4, align: 'left' });
 xPos += colWidths[cellIdx];
 });

 yPos += 8;
 });

 // Adicionar rodapé em todas as páginas
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 await addPDFFooter(pdf, {
 page: i,
 totalPages,
 showCompanyInfo: true,
 });
 }

 // Salvar arquivo
 const periodLabelFile = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `compras_${periodLabelFile}_${getTodayDateString()}.pdf`;
 pdf.save(filename);
 showToast(`Exportação para PDF concluída: ${filteredAndSortedPurchases.length} compras`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 // Função para exportar compras por produto para Excel
 const exportProductPurchasesToExcel = async () => {
 try {
 if (productPurchases.length === 0) {
 showToast('Não há produtos para exportar', 'warning');
 return;
 }

 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 // Preparar Informações do período e filtros
 const periodLabel = selectedPeriod === 'custom'
 ? `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`
 : selectedPeriod === 'today' ? 'Hoje'
 : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês'
 : selectedPeriod === 'thisYear' ? 'Este Ano'
 : selectedPeriod === 'lastWeek' ? 'Semana passada'
 : selectedPeriod === 'lastMonth' ? 'Mês passado'
 : selectedPeriod === 'lastYear' ? 'Ano passado'
 : `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (productSearchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: productSearchQuery });
 }
 if (filterPaymentStatus !== 'ALL') {
 filters.push({ label: 'Status Pagamento', value: filterPaymentStatus === 'paid' ? 'Pago' : filterPaymentStatus === 'partial' ? 'Parcial' : 'Não Pago' });
 }
 filters.push({ label: 'Total de produtos', value: productPurchases.length.toString() });

 // Preparar dados para exportação
 const exportData = productPurchases.map(item => {
 return {
 'Produto': item.productName,
 'Variação': item.variant || '',
 'Quantidade Total': item.totalQuantity,
 'Valor Total': item.totalValue,
 'Nº de Compras': item.purchaseCount,
 'Fornecedores': item.suppliers.map(s => s.name).join(', '),
 'Faturas': item.invoices.map(inv => inv.number).join(', '),
 'Última Compra': new Date(item.lastPurchaseDate).toLocaleDateString('pt-PT')
 };
 });

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Compras por Produto');

 const headerRow = await addExcelHeader(ws, 'Compras por Produto', {
 period: periodLabel,
 filters,
 startRow: 0,
 });

 const headers = ['Produto', 'Variação', 'Quantidade Total', 'Valor Total', 'Nº de Compras', 'Fornecedores', 'Faturas', 'Última Compra'];
 formatExcelTableHeaders(ws, headers, headerRow, 0);

 const dataStartRow = headerRow + 1;
 addJsonToSheetAt(ws, exportData as Record<string, unknown>[], dataStartRow + 1, 1, { skipHeader: true });

 const dataEndRow = dataStartRow + exportData.length - 1;
 formatExcelDataCells(ws, dataStartRow, dataEndRow, 0, headers.length - 1, {
 alternateRowColors: true,
 numberFormat: '#,##0.00',
 });

 [25, 20, 15, 15, 12, 30, 30, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 await addExcelFooter(ws, dataEndRow, { showCompanyInfo: true });

 const periodLabelFile = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `compras_por_produto_${periodLabelFile}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação para Excel concluída: ${productPurchases.length} produtos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 // Função para exportar compras por produto para PDF
 const exportProductPurchasesToPDF = async () => {
 try {
 if (productPurchases.length === 0) {
 showToast('Não há produtos para exportar', 'warning');
 return;
 }

 showToast('Gerando PDF...', 'info');

 const { start, end } = getDateRangeFromPeriod(selectedPeriod, customStartDate, customEndDate);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);

 const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar Informações do período e filtros
 const periodLabel = selectedPeriod === 'custom'
 ? `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`
 : selectedPeriod === 'today' ? 'Hoje'
 : selectedPeriod === 'thisWeek' ? 'Esta Semana'
 : selectedPeriod === 'thisMonth' ? 'Este Mês'
 : selectedPeriod === 'thisYear' ? 'Este Ano'
 : selectedPeriod === 'lastWeek' ? 'Semana passada'
 : selectedPeriod === 'lastMonth' ? 'Mês passado'
 : selectedPeriod === 'lastYear' ? 'Ano passado'
 : `${start.toLocaleDateString('pt-PT')} a ${end.toLocaleDateString('pt-PT')}`;

 const filters: Array<{ label: string; value: string }> = [];
 if (productSearchQuery.trim()) {
 filters.push({ label: 'Pesquisa', value: productSearchQuery });
 }
 if (filterPaymentStatus !== 'ALL') {
 filters.push({ label: 'Status Pagamento', value: filterPaymentStatus === 'paid' ? 'Pago' : filterPaymentStatus === 'partial' ? 'Parcial' : 'Não Pago' });
 }
 filters.push({ label: 'Total de produtos', value: productPurchases.length.toString() });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Compras por Produto', {
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
 pdf.text(`Total de Produtos: ${productTotals.totalProducts}`, margin, yPos);
 pdf.text(`Quantidade Total: ${productTotals.totalQuantity}`, margin + 60, yPos);
 pdf.text(`Valor Total: ${formatMoney(productTotals.totalValue)}`, margin + 120, yPos);
 yPos += 10;

 // Tabela de produtos com cabeçalho destacado
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = [2.0, 1.5, 1.0, 1.5, 1.0, 1.5, 1.5, 1.0]; // 8 colunas
 const totalProportion = colProportions.reduce((sum, prop) => sum + prop, 0);
 const colWidths = colProportions.map(prop => (prop / totalProportion) * availableWidth);

 const headers = ['Produto', 'Variação', 'Qtd Total', 'Valor Total', 'Nº Comp', 'Fornecedores', 'Faturas', 'Última Compra'];
 const headerHeight = 8;

 // Cabeçalho da tabela
 pdf.setFillColor(...colors.primaryRgb);
 pdf.setFontSize(9);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(255, 255, 255);

 let xPos = margin;
 headers.forEach((header, idx) => {
 pdf.rect(xPos, yPos, colWidths[idx], headerHeight, 'F');
 pdf.text(header, xPos + 2, yPos + 5, { maxWidth: colWidths[idx] - 4, align: 'left' });
 xPos += colWidths[idx];
 });
 yPos += headerHeight;

 // Linhas de dados
 pdf.setFontSize(8);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0);

 productPurchases.forEach((item, idx) => {
 // Verificar se precisa de nova página
 if (yPos + 8 > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 }

 // Cor alternada para linhas
 if (idx % 2 === 0) {
 pdf.setFillColor(245, 245, 245);
 pdf.rect(margin, yPos, availableWidth, 8, 'F');
 }

 const suppliersText = item.suppliers.slice(0, 2).map(s => s.name).join(', ') + (item.suppliers.length > 2 ? '...' : '');
 const invoicesText = item.invoices.slice(0, 2).map(inv => inv.number).join(', ') + (item.invoices.length > 2 ? '...' : '');

 const rowData = [
 item.productName,
 item.variant || '-',
 item.totalQuantity.toString(),
 formatMoney(item.totalValue),
 item.purchaseCount.toString(),
 suppliersText || '-',
 invoicesText || '-',
 new Date(item.lastPurchaseDate).toLocaleDateString('pt-PT')
 ];

 xPos = margin;
 rowData.forEach((cell, cellIdx) => {
 pdf.text(cell, xPos + 2, yPos + 5, { maxWidth: colWidths[cellIdx] - 4, align: 'left' });
 xPos += colWidths[cellIdx];
 });

 yPos += 8;
 });

 // Adicionar rodapé em todas as páginas
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 await addPDFFooter(pdf, {
 page: i,
 totalPages,
 showCompanyInfo: true,
 });
 }

 // Salvar arquivo
 const periodLabelFile = selectedPeriod === 'custom'
 ? `${startStr}_${endStr}`
 : selectedPeriod;
 const filename = `compras_por_produto_${periodLabelFile}_${getTodayDateString()}.pdf`;
 pdf.save(filename);
 showToast(`Exportação para PDF concluída: ${productPurchases.length} produtos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };

 // Contar filtros ativos para mobile
 const activeFiltersCount = [
 searchQuery ? 1 : 0,
 selectedPeriod !== 'thisMonth' ? 1 : 0,
 customStartDate ? 1 : 0,
 filterPaymentStatus !== 'ALL' ? 1 : 0
 ].filter(Boolean).length;

 return (
 <PageShell
 title="Gestão de Compras"
 actions={
 <div className="flex items-center gap-2">
 {activeTab === 'purchases' && (
 <>
 <button
 onClick={() => setIsPurchaseModalOpen(true)}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 >
 <Plus className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Nova Compra</span>
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
 className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${showFilters || activeFiltersCount > 0
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-gray-600 hover:bg-gray-700 text-white'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {activeFiltersCount > 0 && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {activeFiltersCount}
 </span>
 )}
 </button>
 )}
 </>
 )}
 {activeTab === 'byProduct' && (
 <>
 <button
 onClick={exportProductPurchasesToExcel}
 className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar para Excel"
 >
 <FileSpreadsheet className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Excel</span>
 </button>
 <button
 onClick={exportProductPurchasesToPDF}
 className="bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar para PDF"
 >
 <FileText className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">PDF</span>
 </button>
 </>
 )}
 {activeTab === 'suppliers' && (
 <button
 onClick={() => setIsSupplierModalOpen(true)}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 >
 <Plus className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Novo Fornecedor</span>
 </button>
 )}
 </div>
 }
 >
 {/* Tabs removidas - navegação agora é pelo sidebar com submenus */}

 {/* Purchases Tab */}
 {activeTab === 'purchases' && (
 <>
 {/* FilterBar - Filtros principais visíveis no desktop */}
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
 placeholder="Buscar compras..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 {/* Filtros - Ocultos no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterPaymentStatus}
 onChange={(val) => {
 setFilterPaymentStatus(val as PaymentStatusFilter);
 setCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Status Pagamento' },
 { value: 'paid', label: 'Pago' },
 { value: 'partial', label: 'Parcial' },
 { value: 'unpaid', label: 'Não Pago' },
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por status de pagamento"
 />
 </div>

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

 <div className="hidden sm:block flex-shrink-0 relative" style={{ zIndex: 50 }}>
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
 </div>

 {/* Botão Limpar Filtros - Oculto no Mobile */}
 {(searchQuery || selectedPeriod !== 'thisMonth' || customStartDate || customEndDate || filterPaymentStatus !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setSelectedPeriod('thisMonth');
 setCustomStartDate('');
 setCustomEndDate('');
 setFilterPaymentStatus('ALL');
 setCurrentPage(1);
 }}
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
 {/* Primeira linha de filtros */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Status Pagamento
 </label>
 <SelectFilter
 value={filterPaymentStatus}
 onChange={(val) => {
 setFilterPaymentStatus(val as PaymentStatusFilter);
 setCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Todos' },
 { value: 'paid', label: 'Pago' },
 { value: 'partial', label: 'Parcial' },
 { value: 'unpaid', label: 'Não Pago' },
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

 {/* Segunda linha - Período */}
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
 </div>

 {/* Botão Limpar Filtros */}
 {(searchQuery || selectedPeriod !== 'thisMonth' || customStartDate || customEndDate || filterPaymentStatus !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setSelectedPeriod('thisMonth');
 setCustomStartDate('');
 setCustomEndDate('');
 setFilterPaymentStatus('ALL');
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

 {/* Sorting */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <span className="text-sm text-content-secondary font-medium">Ordenar por:</span>
 <div className="flex gap-2">
 {(['date', 'totalAmount', 'supplier'] as SortField[]).map(field => (
 <button
 key={field}
 onClick={() => {
 if (sortField === field) {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField(field);
 setSortDirection('desc');
 }
 }}
 className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${sortField === field
 ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
 : 'bg-surface-base text-content-secondary hover:bg-surface-base'
 }`}
 >
 {field === 'date' ? 'Data' : field === 'totalAmount' ? 'Valor' : 'Fornecedor'}
 {sortField === field && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </button>
 ))}
 </div>
 </div>
 <div className="text-sm text-content-muted">
 Mostrando {paginatedPurchases.length} de {totalPurchasesCount ?? filteredAndSortedPurchases.length} compras
 </div>
 </div>

 {/* Purchases List - Cards View */}
 {viewMode === 'grid' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {paginatedPurchases.map(purchase => (
 <div
 key={purchase.id}
 className="bg-surface-raised rounded-lg p-4 shadow-sm border border-border-default hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4 text-content-muted" />
 <span className="text-sm font-medium text-content-secondary">
 {new Date(purchase.date).toLocaleDateString('pt-MZ')}
 </span>
 </div>
 <div className="flex gap-1">
 <button
 onClick={() => setPurchaseForInvoicePreview(purchase)}
 className="p-1 text-content-muted hover:text-blue-600 transition-colors"
 title="Imprimir fatura"
 >
 <Printer className="w-4 h-4" />
 </button>
 <button
 onClick={() => {
 setViewingPurchase(purchase);
 setIsViewModalOpen(true);
 }}
 className="p-1 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver detalhes"
 >
 <Eye className="w-4 h-4" />
 </button>
 {onUpdatePurchase && (
 <button
 onClick={() => handleEditPurchase(purchase)}
 className="p-1 text-content-muted hover:text-blue-600 transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDeletePurchase && (
 <button
 onClick={() => handleDeletePurchase(purchase.id)}
 className="p-1 text-content-muted hover:text-red-600 transition-colors"
 title="Apagar"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 <div className="space-y-2">
 <div className="flex items-center gap-2 text-sm">
 <User className="w-4 h-4 text-content-muted" />
 <span className="text-content-secondary font-medium">{purchase.supplierName || 'Sem fornecedor'}</span>
 </div>
 {purchase.invoiceNumber && (
 <div className="text-sm text-content-secondary">
 <FileText className="w-3 h-3 inline mr-1" />
 Fatura: {purchase.invoiceNumber}
 </div>
 )}
 <div className="flex items-center gap-2 text-sm">
 <Package className="w-4 h-4 text-content-muted" />
 <span>{purchase.items.length} item(ns)</span>
 </div>
 <div className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400">
 <DollarSign className="w-4 h-4" />
 {formatMoney(purchase.totalAmount)}
 </div>
 <div className={`text-xs px-2 py-1 rounded-full inline-block ${purchase.paymentStatus === 'paid'
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
 : purchase.paymentStatus === 'partial'
 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
 : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
 }`}>
 {purchase.paymentStatus === 'paid' ? 'Pago' : purchase.paymentStatus === 'partial' ? 'Parcial' : 'Não pago'}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Purchases List - Table View */}
 {viewMode === 'list' && (
 <div className="bg-surface-raised rounded-lg shadow-sm border border-border-default overflow-hidden">
 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (sortField === 'date') {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField('date');
 setSortDirection('desc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Data
 {sortField === 'date' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (sortField === 'supplier') {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField('supplier');
 setSortDirection('desc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Fornecedor
 {sortField === 'supplier' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Fatura
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Itens
 </th>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (sortField === 'totalAmount') {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField('totalAmount');
 setSortDirection('desc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Valor Total
 {sortField === 'totalAmount' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Status Pagamento
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
 Ações
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedPurchases.map((purchase, index) => (
 <tr
 key={purchase.id}
 className={`hover:bg-surface-base/50 transition-colors ${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/50'
 }`}
 >
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-primary">
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4 text-content-muted" />
 {new Date(purchase.date).toLocaleDateString('pt-MZ')}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-primary">
 <div className="flex items-center gap-2">
 <User className="w-4 h-4 text-content-muted" />
 <div>
 {purchase.supplierName || purchase.supplierLocationName || 'Sem fornecedor'}
 {purchase.supplierLocationName && (
 <span className="ml-1 text-xs text-content-muted">(Local)</span>
 )}
 </div>
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-secondary">
 {purchase.invoiceNumber || '-'}
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-secondary">
 <div className="flex items-center gap-1">
 <Package className="w-4 h-4 text-content-muted" />
 {purchase.items.length}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
 {formatMoney(purchase.totalAmount)}
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <span className={`text-xs px-2 py-1 rounded-full inline-block ${purchase.paymentStatus === 'paid'
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
 : purchase.paymentStatus === 'partial'
 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
 : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
 }`}>
 {purchase.paymentStatus === 'paid' ? 'Pago' : purchase.paymentStatus === 'partial' ? 'Parcial' : 'Não pago'}
 </span>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => setPurchaseForInvoicePreview(purchase)}
 className="p-1.5 text-content-muted hover:text-blue-600 transition-colors"
 title="Imprimir fatura"
 >
 <Printer className="w-4 h-4" />
 </button>
 <button
 onClick={() => {
 setViewingPurchase(purchase);
 setIsViewModalOpen(true);
 }}
 className="p-1.5 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver detalhes"
 >
 <Eye className="w-4 h-4" />
 </button>
 {onUpdatePurchase && (
 <button
 onClick={() => handleEditPurchase(purchase)}
 className="p-1.5 text-content-muted hover:text-blue-600 transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDeletePurchase && (
 <button
 onClick={() => handleDeletePurchase(purchase.id)}
 className="p-1.5 text-content-muted hover:text-red-600 transition-colors"
 title="Apagar"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Empty State */}
 {paginatedPurchases.length === 0 && (
 <div className="text-center py-12">
 <ShoppingCart className="w-16 h-16 text-content-muted mx-auto mb-4" />
 <p className="text-content-muted">
 {filteredAndSortedPurchases.length === 0
 ? 'Nenhuma compra registada. Clique em "Nova Compra" para começar.'
 : 'Nenhum resultado encontrado com os filtros aplicados.'}
 </p>
 </div>
 )}

 {/* Totais e Paginaçéo */}
 <div className="mt-6 space-y-4">
 {/* Totais */}
 <div className="bg-surface-raised rounded-lg border border-border-default p-4">
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div className="flex flex-wrap items-center gap-6">
 <div className="flex items-center gap-2">
 <DollarSign className="w-5 h-5 text-content-muted" />
 <span className="text-sm text-content-secondary">Total:</span>
 <span className="text-lg font-semibold text-content-primary">{formatMoney(periodTotals.total)}</span>
 </div>
 <div className="flex items-center gap-2">
 <CheckCircle className="w-5 h-5 text-green-500" />
 <span className="text-sm text-content-secondary">Pago:</span>
 <span className="text-lg font-semibold text-green-600 dark:text-green-400">{formatMoney(periodTotals.paid)}</span>
 </div>
 <div className="flex items-center gap-2">
 <Clock className="w-5 h-5 text-orange-500" />
 <span className="text-sm text-content-secondary">Pendente:</span>
 <span className="text-lg font-semibold text-orange-600 dark:text-orange-400">{formatMoney(periodTotals.pending)}</span>
 </div>
 <div className="flex items-center gap-2">
 <ShoppingCart className="w-5 h-5 text-blue-500" />
 <span className="text-sm text-content-secondary">NÂº Compras:</span>
 <span className="text-lg font-semibold text-content-primary">{periodTotals.count}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <Pagination
 mode="simple"
 currentPage={currentPage}
 totalItems={totalPurchasesCount ?? filteredAndSortedPurchases.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setCurrentPage}
 />
 )}
 </div>
 </>
 )}

 {/* By Product Tab */}
 {activeTab === 'byProduct' && (
 <>
 {/* FilterBar - Filtros principais visíveis no desktop */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <ViewModeToggle
 value={viewMode === 'grid' ? 'cards' : 'table'}
 onChange={(mode) => setViewMode(mode === 'cards' ? 'grid' : 'list')}
 size="compact"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SearchInput
 value={productSearchQuery}
 onChange={(val) => setProductSearchQuery(val)}
 placeholder="Buscar produtos..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 {/* Product Grouping Toggle */}
 <div className="flex items-center gap-2 px-3 py-2 bg-surface-base rounded-lg">
 <button
 onClick={() => setProductGroupMode('with-variants')}
 className={`px-3 py-1 text-xs font-medium rounded transition-colors ${productGroupMode === 'with-variants'
 ? 'bg-brand-600 text-white'
 : 'text-content-secondary hover:text-content-primary '
 }`}
 title="Mostrar produtos com variações separadas"
 >
 Com Variações
 </button>
 <button
 onClick={() => setProductGroupMode('without-variants')}
 className={`px-3 py-1 text-xs font-medium rounded transition-colors ${productGroupMode === 'without-variants'
 ? 'bg-brand-600 text-white'
 : 'text-content-secondary hover:text-content-primary '
 }`}
 title="Agrupar todas as variações por produto"
 >
 Produto Fixo
 </button>
 </div>

 {/* Filtros - Ocultos no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterPaymentStatus}
 onChange={(val) => {
 setFilterPaymentStatus(val as PaymentStatusFilter);
 setProductCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Todos Status' },
 { value: 'paid', label: 'Pago' },
 { value: 'partial', label: 'Parcial' },
 { value: 'unpaid', label: 'Não Pago' }
 ]}
 size="compact"
 />
 </div>

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={(period) => {
 setSelectedPeriod(period);
 if (period !== 'custom') {
 setCustomStartDate('');
 setCustomEndDate('');
 }
 setProductCurrentPage(1);
 }}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 setProductCurrentPage(1);
 }}
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setProductCurrentPage(1);
 }}
 size="compact"
 />
 </FilterBar>

 {/* Product Purchases Grid View */}
 {viewMode === 'grid' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {paginatedProductPurchases.map((item) => (
 <div
 key={`${item.productId}-${item.variant || 'no-variant'}`}
 className="bg-surface-raised rounded-lg p-4 shadow-sm border border-border-default hover:shadow-md transition-shadow"
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <h3 className="font-semibold text-content-primary">{item.productName}</h3>
 {item.variant && (
 <p className="text-xs text-content-muted mt-1">{item.variant}</p>
 )}
 </div>
 <button
 onClick={() => {
 setSelectedProductForHistory(item);
 setIsHistoryModalOpen(true);
 }}
 className="p-1.5 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver histórico"
 >
 <Eye className="w-4 h-4" />
 </button>
 </div>

 <div className="space-y-2 text-sm">
 <div className="flex items-center gap-2">
 <Package className="w-4 h-4 text-content-muted" />
 <span className="text-content-secondary">Quantidade:</span>
 <span className="font-semibold text-content-primary">{item.totalQuantity}</span>
 </div>
 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-green-500" />
 <span className="text-content-secondary">Valor Total:</span>
 <span className="font-semibold text-green-600 dark:text-green-400">{formatMoney(item.totalValue)}</span>
 </div>
 <div className="flex items-center gap-2">
 <ShoppingCart className="w-4 h-4 text-blue-500" />
 <span className="text-content-secondary">Compras:</span>
 <span className="font-semibold text-content-primary">{item.purchaseCount}</span>
 </div>
 {item.suppliers.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 {item.suppliers.slice(0, 2).map((s, idx) => (
 <span key={idx} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
 {s.name}
 </span>
 ))}
 {item.suppliers.length > 2 && (
 <span className="text-xs px-2 py-1 bg-surface-base text-content-secondary rounded">
 +{item.suppliers.length - 2}
 </span>
 )}
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Product Purchases List - Table View */}
 {viewMode === 'list' && (
 <div className="bg-surface-raised rounded-lg shadow-sm border border-border-default overflow-hidden">
 <div className="overflow-auto max-h-[calc(100vh-280px)]">
 <table className="w-full">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (productSortField === 'product') {
 setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setProductSortField('product');
 setProductSortDirection('asc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Produto
 {productSortField === 'product' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (productSortField === 'quantity') {
 setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setProductSortField('quantity');
 setProductSortDirection('desc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Quantidade Total
 {productSortField === 'quantity' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (productSortField === 'value') {
 setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setProductSortField('value');
 setProductSortDirection('desc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Valor Total
 {productSortField === 'value' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th
 className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => {
 if (productSortField === 'purchaseCount') {
 setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setProductSortField('purchaseCount');
 setProductSortDirection('desc');
 }
 }}
 >
 <div className="flex items-center gap-1">
 Nº Compras
 {productSortField === 'purchaseCount' && (productSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Fornecedores
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Faturas
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
 Ações
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedProductPurchases.map((item, index) => (
 <tr
 key={`${item.productId}-${item.variant || 'no-variant'}`}
 className={`hover:bg-surface-base/50 transition-colors ${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/50'
 }`}
 >
 <td className="px-4 py-3 text-sm text-content-primary">
 <div>
 <div className="font-medium">{item.productName}</div>
 {item.variant && (
 <div className="text-xs text-content-muted mt-1">{item.variant}</div>
 )}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-primary">
 <div className="flex items-center gap-2">
 <Package className="w-4 h-4 text-content-muted" />
 {item.totalQuantity}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
 {formatMoney(item.totalValue)}
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-content-secondary">
 <div className="flex items-center gap-1">
 <ShoppingCart className="w-4 h-4 text-content-muted" />
 {item.purchaseCount}
 </div>
 </td>
 <td className="px-4 py-3">
 <div className="flex flex-wrap gap-1">
 {item.suppliers.slice(0, 3).map((s, idx) => (
 <span key={idx} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
 {s.name}
 </span>
 ))}
 {item.suppliers.length > 3 && (
 <span className="text-xs px-2 py-1 bg-surface-base text-content-secondary rounded">
 +{item.suppliers.length - 3}
 </span>
 )}
 {item.suppliers.length === 0 && (
 <span className="text-xs text-content-muted">-</span>
 )}
 </div>
 </td>
 <td className="px-4 py-3">
 <div className="flex flex-wrap gap-1">
 {item.invoices.slice(0, 3).map((inv, idx) => (
 <span key={idx} className="text-xs px-2 py-1 bg-surface-base text-content-secondary rounded">
 {inv.number}
 </span>
 ))}
 {item.invoices.length > 3 && (
 <span className="text-xs px-2 py-1 bg-surface-base text-content-secondary rounded">
 +{item.invoices.length - 3}
 </span>
 )}
 {item.invoices.length === 0 && (
 <span className="text-xs text-content-muted">-</span>
 )}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
 <button
 onClick={() => {
 setSelectedProductForHistory(item);
 setIsHistoryModalOpen(true);
 }}
 className="p-1.5 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver histórico"
 >
 <Eye className="w-4 h-4" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Empty State */}
 {paginatedProductPurchases.length === 0 && (
 <div className="text-center py-12">
 <Package className="w-16 h-16 text-content-muted mx-auto mb-4" />
 <p className="text-content-muted">
 {productPurchases.length === 0
 ? 'Nenhum produto encontrado nas compras do período selecionado.'
 : 'Nenhum resultado encontrado com os filtros aplicados.'}
 </p>
 </div>
 )}

 {/* Totais e Paginação */}
 <div className="mt-6 space-y-4">
 {/* Totais */}
 <div className="bg-surface-raised rounded-lg border border-border-default p-4">
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div className="flex flex-wrap items-center gap-6">
 <div className="flex items-center gap-2">
 <Package className="w-5 h-5 text-content-muted" />
 <span className="text-sm text-content-secondary">Produtos:</span>
 <span className="text-lg font-semibold text-content-primary">{productTotals.totalProducts}</span>
 </div>
 <div className="flex items-center gap-2">
 <ShoppingCart className="w-5 h-5 text-blue-500" />
 <span className="text-sm text-content-secondary">Quantidade Total:</span>
 <span className="text-lg font-semibold text-content-primary">{productTotals.totalQuantity}</span>
 </div>
 <div className="flex items-center gap-2">
 <DollarSign className="w-5 h-5 text-green-500" />
 <span className="text-sm text-content-secondary">Valor Total:</span>
 <span className="text-lg font-semibold text-green-600 dark:text-green-400">{formatMoney(productTotals.totalValue)}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Pagination */}
 {productTotalPages > 1 && (
 <Pagination
 mode="simple"
 currentPage={productCurrentPage}
 totalItems={productPurchases.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setProductCurrentPage}
 />
 )}
 </div>
 </>
 )}


 {/* Suppliers Tab */}
 {activeTab === 'suppliers' && (
 <>
 {/* FilterBar */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <ViewModeToggle
 value={supplierViewMode === 'grid' ? 'cards' : 'table'}
 onChange={(mode) => setSupplierViewMode(mode === 'cards' ? 'grid' : 'list')}
 size="compact"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SearchInput
 value={supplierSearchQuery}
 onChange={(val) => setSupplierSearchQuery(val)}
 placeholder="Buscar fornecedores..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SelectFilter
 value={supplierDebtFilter}
 onChange={(val) => setSupplierDebtFilter(val as SupplierDebtFilter)}
 options={[
 { value: 'ALL', label: 'Todos' },
 { value: 'WITH_DEBT', label: 'Com Dívida' },
 { value: 'NO_DEBT', label: 'Sem Dívida' }
 ]}
 size="compact"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <PeriodFilter
 selectedPeriod={selectedPeriod}
 onPeriodChange={(period) => {
 setSelectedPeriod(period);
 if (period !== 'custom') {
 setCustomStartDate('');
 setCustomEndDate('');
 }
 }}
 customStartDate={customStartDate}
 customEndDate={customEndDate}
 onCustomDatesChange={(start, end) => {
 setCustomStartDate(start);
 setCustomEndDate(end);
 }}
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SelectFilter
 value={supplierSortField}
 onChange={(val) => setSupplierSortField(val as SupplierSortField)}
 options={[
 { value: 'name', label: 'Nome' },
 { value: 'totalValue', label: 'Valor Total' },
 { value: 'pendingAmount', label: 'Dívida' },
 { value: 'totalPurchases', label: 'Nº Compras' }
 ]}
 size="compact"
 />

 <button
 onClick={() => setSupplierSortDirection(supplierSortDirection === 'asc' ? 'desc' : 'asc')}
 className="p-2 text-content-secondary hover:text-content-primary transition-colors"
 title={supplierSortDirection === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
 >
 {supplierSortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
 </button>
 </FilterBar>

 {/* Supplier Table View */}
 {supplierViewMode === 'list' ? (
 <div className="overflow-auto max-h-[calc(100vh-280px)] rounded-lg border border-border-default">
 <table className="w-full text-sm">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase">
 Fornecedor
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase">
 Telefone
 </th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted uppercase">
 Compras
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Valor Total
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Pago
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Dívida
 </th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted uppercase">
 Última Compra
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Ações
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {filteredAndSortedSupplierStats.map((stats, index) => (
 <tr
 key={stats.supplierId}
 className={`${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/50'} hover:bg-surface-base/50 transition-colors`}
 >
 <td className="px-4 py-3">
 <div>
 <p className="font-medium text-content-primary">{stats.supplierName}</p>
 {stats.supplier.contactPerson && (
 <p className="text-xs text-content-muted">{stats.supplier.contactPerson}</p>
 )}
 </div>
 </td>
 <td className="px-4 py-3 text-content-secondary">
 {stats.supplier.phone || '-'}
 </td>
 <td className="px-4 py-3 text-center">
 <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
 <ShoppingCart className="w-3 h-3" />
 {stats.totalPurchases}
 </span>
 </td>
 <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
 {formatMoney(stats.totalValue)}
 </td>
 <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
 {formatMoney(stats.totalPaid)}
 </td>
 <td className={`px-4 py-3 text-right font-medium ${stats.pendingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 {formatMoney(stats.pendingAmount)}
 </td>
 <td className="px-4 py-3 text-center text-content-secondary">
 {stats.lastPurchaseDate
 ? new Date(stats.lastPurchaseDate).toLocaleDateString('pt-MZ')
 : '-'
 }
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => {
 setSelectedSupplierStats(stats);
 setIsSupplierDetailModalOpen(true);
 }}
 className="p-1 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver detalhes"
 >
 <Eye className="w-4 h-4" />
 </button>
 {onUpdateSupplier && (
 <button
 onClick={() => handleEditSupplier(stats.supplier)}
 className="p-1 text-content-muted hover:text-blue-600 transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDeleteSupplier && (
 <button
 onClick={() => handleDeleteSupplier(stats.supplierId)}
 className="p-1 text-content-muted hover:text-red-600 transition-colors"
 title="Apagar"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 <tfoot className="bg-surface-base font-medium">
 <tr>
 <td colSpan={2} className="px-4 py-3 text-right text-content-secondary">
 Total:
 </td>
 <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">
 {supplierTotals.totalSuppliers}
 </td>
 <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
 {formatMoney(supplierTotals.totalValue)}
 </td>
 <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
 {formatMoney(supplierTotals.totalPaid)}
 </td>
 <td className={`px-4 py-3 text-right ${supplierTotals.totalPending > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 {formatMoney(supplierTotals.totalPending)}
 </td>
 <td colSpan={2}></td>
 </tr>
 </tfoot>
 </table>
 </div>
 ) : (
 /* Supplier Cards Grid */
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredAndSortedSupplierStats.map(stats => (
 <div
 key={stats.supplierId}
 className="bg-surface-raised rounded-lg p-4 shadow-sm border border-border-default hover:shadow-md transition-shadow"
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <h3 className="font-semibold text-lg text-content-primary">{stats.supplierName}</h3>
 {stats.supplier.contactPerson && (
 <p className="text-sm text-content-muted">{stats.supplier.contactPerson}</p>
 )}
 {stats.supplier.phone && (
 <p className="text-xs text-content-muted">{stats.supplier.phone}</p>
 )}
 </div>
 <div className="flex gap-1">
 <button
 onClick={() => {
 setSelectedSupplierStats(stats);
 setIsSupplierDetailModalOpen(true);
 }}
 className="p-1.5 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver detalhes"
 >
 <Eye className="w-4 h-4" />
 </button>
 {onUpdateSupplier && (
 <button
 onClick={() => handleEditSupplier(stats.supplier)}
 className="p-1.5 text-content-muted hover:text-blue-600 transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDeleteSupplier && (
 <button
 onClick={() => handleDeleteSupplier(stats.supplierId)}
 className="p-1.5 text-content-muted hover:text-red-600 transition-colors"
 title="Apagar"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 text-sm mt-4 pt-3 border-t border-border-default">
 <div className="flex items-center gap-2">
 <ShoppingCart className="w-4 h-4 text-blue-500" />
 <span className="text-content-secondary">{stats.totalPurchases} compras</span>
 </div>
 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-green-500" />
 <span className="text-green-600 dark:text-green-400 font-medium">{formatMoney(stats.totalValue)}</span>
 </div>
 <div className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-blue-500" />
 <span className="text-content-secondary">Pago: {formatMoney(stats.totalPaid)}</span>
 </div>
 <div className="flex items-center gap-2">
 <Clock className="w-4 h-4 text-orange-500" />
 <span className={`font-medium ${stats.pendingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 Dívida: {formatMoney(stats.pendingAmount)}
 </span>
 </div>
 </div>

 {stats.lastPurchaseDate && (
 <div className="mt-3 pt-2 border-t border-border-default text-xs text-content-muted flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 Última compra: {new Date(stats.lastPurchaseDate).toLocaleDateString('pt-MZ')}
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {/* Empty State */}
 {filteredAndSortedSupplierStats.length === 0 && (
 <div className="text-center py-12">
 <User className="w-16 h-16 text-content-muted mx-auto mb-4" />
 <p className="text-content-muted">
 {supplierStats.length === 0
 ? 'Nenhum fornecedor registado. Clique em "Novo Fornecedor" para começar.'
 : 'Nenhum fornecedor encontrado com os filtros aplicados.'}
 </p>
 </div>
 )}

 {/* Totais */}
 <div className="mt-6">
 <div className="bg-surface-raised rounded-lg border border-border-default p-4">
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div className="flex flex-wrap items-center gap-6">
 <div className="flex items-center gap-2">
 <User className="w-5 h-5 text-content-muted" />
 <span className="text-sm text-content-secondary">Fornecedores:</span>
 <span className="text-lg font-semibold text-content-primary">{supplierTotals.totalSuppliers}</span>
 </div>
 <div className="flex items-center gap-2">
 <DollarSign className="w-5 h-5 text-green-500" />
 <span className="text-sm text-content-secondary">Total Comprado:</span>
 <span className="text-lg font-semibold text-green-600 dark:text-green-400">{formatMoney(supplierTotals.totalValue)}</span>
 </div>
 <div className="flex items-center gap-2">
 <CheckCircle className="w-5 h-5 text-blue-500" />
 <span className="text-sm text-content-secondary">Total Pago:</span>
 <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">{formatMoney(supplierTotals.totalPaid)}</span>
 </div>
 <div className="flex items-center gap-2">
 <Clock className="w-5 h-5 text-orange-500" />
 <span className="text-sm text-content-secondary">Total Pendente:</span>
 <span className={`text-lg font-semibold ${supplierTotals.totalPending > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 {formatMoney(supplierTotals.totalPending)}
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </>
 )}

 {/* Purchase Modal */}
 <ModalPortal open={!!isPurchaseModalOpen} onClose={resetPurchaseForm}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default flex justify-between items-center sticky top-0 bg-surface-raised z-10">
 <h2 className="text-xl font-bold text-content-primary">
 {editingPurchase ? 'Editar Compra' : 'Nova Compra'}
 </h2>
 <button onClick={resetPurchaseForm} className="text-content-muted hover:text-content-secondary ">
 <X className="w-6 h-6" />
 </button>
 </div>

 <div className="p-6 space-y-4">
 {/* Toggle para escolher tipo de fornecedor */}


 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Data
 </label>
 <input
 type="date"
 value={newPurchaseDate}
 onChange={(e) => setNewPurchaseDate(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Fornecedor Externo *
 </label>
 <select
 value={selectedSupplier}
 onChange={(e) => setSelectedSupplier(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 >
 <option value="">Selecione um fornecedor</option>
 {suppliers.filter(s => s.isActive).map(s => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>

 <>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Número da Fatura
 <span className="ml-2 text-xs text-content-muted font-normal">(gerado automaticamente se vazio)</span>
 </label>
 <input
 type="text"
 value={purchaseInvoiceNumber}
 onChange={(e) => setPurchaseInvoiceNumber(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 placeholder={`Ex: ${nextInvoicePlaceholder} (ou deixe vazio para gerar automaticamente)`}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Status de Pagamento
 </label>
 <select
 value={purchasePaymentStatus}
 onChange={(e) => {
 setPurchasePaymentStatus(e.target.value as 'unpaid' | 'partial' | 'paid');
 if (e.target.value === 'paid') {
 setPurchaseAmountPaid(purchaseTotal);
 }
 }}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 >
 <option value="unpaid">Não pago</option>
 <option value="partial">Parcial</option>
 <option value="paid">Pago</option>
 </select>
 </div>
 {purchasePaymentStatus === 'partial' && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Valor Pago
 </label>
 <input
 type="number"
 step="0.01"
 value={purchaseAmountPaid}
 onChange={(e) => setPurchaseAmountPaid(parseFloat(e.target.value) || 0)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 )}
 </>
 </div>

 {/* Secção Produtos — mesmo sistema dos pedidos (ProductGrid) */}
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl overflow-hidden">
 <button
 type="button"
 onClick={() => setPurchaseProductsSectionOpen(!purchaseProductsSectionOpen)}
 className="w-full flex items-center justify-between p-4 text-left font-semibold text-content-primary hover:bg-surface-base dark:hover:bg-surface-base/50 transition-colors"
 >
 <span className="flex items-center gap-2">
 <Package className="w-4 h-4" /> Produtos
 </span>
 {purchaseProductsSectionOpen ? (
 <ChevronUp className="w-5 h-5 text-content-muted" />
 ) : (
 <ChevronDown className="w-5 h-5 text-content-muted" />
 )}
 </button>
 {purchaseProductsSectionOpen && (
 <div className="px-4 pb-4 space-y-4">
 {/* Opção criar produto quando pesquisa não encontra */}
 {filteredProducts.length === 0 && productSearchQuery.trim() && !showNewProductForm && (
 <div className="p-3 border border-border-default rounded-lg">
 <button
 onClick={() => {
 setShowNewProductForm(true);
 setNewProductData({
 name: productSearchQuery.trim(),
 costPrice: 0,
 unit: 'un',
 category: ''
 });
 }}
 className="w-full px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center justify-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Criar produto &quot;{productSearchQuery.trim()}&quot;
 </button>
 </div>
 )}
 {showNewProductForm && (
 <div className="p-3 bg-surface-base border border-border-default rounded-lg">
 <div className="space-y-2">
 <input
 type="text"
 placeholder="Nome do produto"
 value={newProductData.name}
 onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded"
 autoFocus
 />
 <div className="flex gap-2">
 <input
 type="number"
 step="0.01"
 min="0"
 placeholder="Preço de compra"
 value={newProductData.costPrice || ''}
 onChange={(e) => setNewProductData({ ...newProductData, costPrice: parseFloat(e.target.value) || 0 })}
 className="flex-1 px-3 py-2 text-sm border border-border-default rounded"
 />
 <select
 value={newProductData.unit}
 onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value })}
 className="w-24 px-3 py-2 text-sm border border-border-default rounded"
 >
 <option value="">Unidade</option>
 {unitsList.map(unit => (
 <option key={unit.id} value={unit.abbreviation}>
 {unit.abbreviation}
 </option>
 ))}
 </select>
 </div>
 <div className="flex gap-2">
 <button
 onClick={handleCreateNewProduct}
 className="flex-1 px-3 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded"
 >
 Criar e Adicionar
 </button>
 <button
 onClick={() => {
 setShowNewProductForm(false);
 setNewProductData({ name: '', costPrice: 0, unit: 'un', category: '' });
 }}
 className="px-3 py-2 text-sm bg-surface-base hover:bg-gray-400 text-content-secondary rounded"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 )}
 <ProductGrid
 products={products}
 selectedItems={selectedItemsForGrid}
 onSelectProduct={(product, variant) => handleAddPurchaseItem(product.id, variant?.name)}
 searchQuery={productSearchQuery}
 onSearchChange={setProductSearchQuery}
 viewMode="list"
 showThumbnails={false}
 showVariantSelector
 showCategoryFilter={false}
 includeZeroStockVariants
 />
 </div>
 )}
 </div>

 {/* Secção Itens da Compra — estilo alinhado aos pedidos */}
 {purchaseItems.length > 0 && (
 <div className="space-y-4 border border-border-default dark:border-border-strong rounded-xl overflow-hidden">
 <button
 type="button"
 onClick={() => setPurchaseItemsSectionOpen(!purchaseItemsSectionOpen)}
 className="w-full flex items-center justify-between p-4 text-left font-semibold text-content-primary hover:bg-surface-base dark:hover:bg-surface-base/50 transition-colors"
 >
 <span className="flex items-center gap-2">
 <ShoppingCart className="w-4 h-4" /> Itens da Compra ({purchaseItems.length})
 </span>
 {purchaseItemsSectionOpen ? (
 <ChevronUp className="w-5 h-5 text-content-muted" />
 ) : (
 <ChevronDown className="w-5 h-5 text-content-muted" />
 )}
 </button>
 {purchaseItemsSectionOpen && (
 <div className="px-4 pb-4 space-y-4">
 <div className="space-y-3 max-h-96 overflow-y-auto">
 {purchaseItems.map((item, index) => {
 const product = products.find(p => p.id === item.productId);
 const hasVariants = product?.variants && product.variants.length > 0;

 return (
 <div key={item.id ?? index} className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg border border-border-default">
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-content-primary">
 {item.productName}
 </div>
 {hasVariants && (
 <select
 value={item.variant || ''}
 onChange={(e) => {
 const variantName = e.target.value;
 const variant = product?.variants?.find(v => v.name === variantName);
 handleUpdatePurchaseItem(index, {
 variant: variantName || undefined,
 unit: variant?.unit || product?.unit || item.unit,
 costPrice: variant?.costPrice ?? product?.costPrice ?? item.costPrice
 });
 }}
 className="mt-1 w-full max-w-[180px] px-2 py-1.5 text-xs border border-border-default rounded"
 >
 <option value="">Selecione uma variação</option>
 {product?.variants?.map(v => (
 <option key={v.id} value={v.name}>
 {v.name} — {formatMoney(v.costPrice || 0)}
 </option>
 ))}
 </select>
 )}
 {!hasVariants && item.variant && (
 <div className="text-xs text-content-muted mt-1">Variação: {item.variant}</div>
 )}
 </div>
 <input
 type="number"
 step="0.01"
 min="0"
 value={item.quantity}
 onChange={(e) => handleUpdatePurchaseItem(index, { quantity: parseFloat(e.target.value) || 0 })}
 className="w-16 px-2 py-1.5 text-sm border border-border-default rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 />
 <span className="text-xs text-content-muted w-6">{item.unit || 'un'}</span>
 <input
 type="number"
 step="0.01"
 min="0"
 value={item.costPrice}
 onChange={(e) => handleUpdatePurchaseItem(index, { costPrice: parseFloat(e.target.value) || 0 })}
 className="w-20 px-2 py-1.5 text-sm border border-border-default rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 placeholder="Preço"
 />
 <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 tabular-nums min-w-[70px] text-right">
 {formatMoney(item.total ?? item.quantity * (item.costPrice ?? 0))}
 </span>
 <button
 type="button"
 onClick={() => handleRemovePurchaseItem(index)}
 className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Remover item"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 );
 })}
 </div>
 <div className="pt-4 border-t border-border-default flex justify-between items-center">
 <span className="text-lg font-semibold text-content-primary">Total:</span>
 <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
 {formatMoney(purchaseTotal)}
 </span>
 </div>
 </div>
 )}
 </div>
 )}

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Notas
 </label>
 <textarea
 value={purchaseNotes}
 onChange={(e) => setPurchaseNotes(e.target.value)}
 rows={3}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 placeholder="Adicione notas sobre esta compra..."
 />
 </div>

 <div className="flex gap-2">
 <button
 onClick={handleSubmitPurchase}
 className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
 >
 Salvar
 </button>
 <button
 onClick={resetPurchaseForm}
 className="px-4 py-2 border border-border-default rounded-lg hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 </ModalPortal>

 {/* Supplier Modal - Similar structure */}
 <ModalPortal open={!!isSupplierModalOpen} onClose={resetSupplierForm}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-2xl w-full">
 <div className="p-6 border-b border-border-default flex justify-between items-center">
 <h2 className="text-xl font-bold text-content-primary">
 {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
 </h2>
 <button onClick={resetSupplierForm} className="text-content-muted hover:text-content-secondary">
 <X className="w-6 h-6" />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Nome *
 </label>
 <input
 type="text"
 value={supplierName}
 onChange={(e) => setSupplierName(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Pessoa de Contacto
 </label>
 <input
 type="text"
 value={supplierContactPerson}
 onChange={(e) => setSupplierContactPerson(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Telefone
 </label>
 <input
 type="text"
 value={supplierPhone}
 onChange={(e) => setSupplierPhone(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Email
 </label>
 <input
 type="email"
 value={supplierEmail}
 onChange={(e) => setSupplierEmail(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Endereço
 </label>
 <textarea
 value={supplierAddress}
 onChange={(e) => setSupplierAddress(e.target.value)}
 rows={2}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Notas
 </label>
 <textarea
 value={supplierNotes}
 onChange={(e) => setSupplierNotes(e.target.value)}
 rows={3}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 </div>
 <div className="flex gap-2">
 <button
 onClick={handleSubmitSupplier}
 className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
 >
 Salvar
 </button>
 <button
 onClick={resetSupplierForm}
 className="px-4 py-2 border border-border-default rounded-lg"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 </ModalPortal>

 {/* View Purchase Modal */}
 <ModalPortal open={!!(isViewModalOpen && viewingPurchase)} onClose={() => { setIsViewModalOpen(false); setViewingPurchase(null); }} zIndex={10001}>
 {viewingPurchase && (
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default flex justify-between items-center">
 <h2 className="text-xl font-bold text-content-primary">Detalhes da Compra</h2>
 <div className="flex gap-2">
 <button
 onClick={() => setPurchaseForInvoicePreview(viewingPurchase)}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
 title="Imprimir fatura"
 >
 <Printer className="w-4 h-4" />
 Imprimir Fatura
 </button>
 <button
 onClick={() => {
 setIsViewModalOpen(false);
 setViewingPurchase(null);
 }}
 className="text-content-muted hover:text-content-secondary"
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data</label>
 <p className="text-content-primary">
 {new Date(viewingPurchase.date).toLocaleDateString('pt-MZ')}
 </p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Fornecedor</label>
 <p className="text-content-primary">{viewingPurchase.supplierName || 'Sem fornecedor'}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Fatura</label>
 <p className="text-content-primary">{viewingPurchase.invoiceNumber || '—'}</p>
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
 const groups = new Map<string, { items: typeof viewingPurchase.items; totalQty: number; totalValue: number }>();
 for (const item of viewingPurchase.items) {
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
 <td className="px-3 py-2 text-right">{formatMoney(item.total ?? item.totalPrice ?? 0)}</td>
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
 <span className="text-lg font-semibold text-content-primary">Total:</span>
 <span className="text-lg font-semibold text-green-600 dark:text-green-400">
 {formatMoney(viewingPurchase.totalAmount)}
 </span>
 </div>
 </div>
 {viewingPurchase.notes && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Notas</label>
 <p className="text-content-primary">{viewingPurchase.notes}</p>
 </div>
 )}
 </div>
 </div>
 )}
 </ModalPortal>

 {/* Product Purchase History Modal */}
 <ModalPortal open={!!(isHistoryModalOpen && selectedProductForHistory)} onClose={() => { setIsHistoryModalOpen(false); setSelectedProductForHistory(null); }}>
 {selectedProductForHistory && (
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default flex justify-between items-center">
 <div>
 <h2 className="text-xl font-bold text-content-primary">
 Histórico de Compras - {selectedProductForHistory.productName}
 </h2>
 {selectedProductForHistory.variant && (
 <p className="text-sm text-content-muted mt-1">
 Variação: {selectedProductForHistory.variant}
 </p>
 )}
 </div>
 <button
 onClick={() => {
 setIsHistoryModalOpen(false);
 setSelectedProductForHistory(null);
 }}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 <div className="p-6">
 {(() => {
 const history = getProductPurchaseHistory(selectedProductForHistory.productId, selectedProductForHistory.variant);
 const totalPurchases = history.length;
 const totalQuantity = history.reduce((sum, p) => sum + (p.item.quantity || 0), 0);
 const totalValue = history.reduce((sum, p) => sum + (p.item.totalPrice || p.item.total || 0), 0);

 return (
 <>
 <div className="overflow-x-auto rounded-lg border border-border-default mb-6">
 <table className="w-full text-sm text-left">
 <thead className="bg-surface-base text-content-secondary">
 <tr>
 <th className="px-4 py-3 font-medium">Data</th>
 <th className="px-4 py-3 font-medium">Fornecedor</th>
 <th className="px-4 py-3 font-medium">Fatura</th>
 <th className="px-4 py-3 font-medium text-right">Quantidade</th>
 <th className="px-4 py-3 font-medium text-right">Preço Unitário</th>
 <th className="px-4 py-3 font-medium text-right">Total</th>
 <th className="px-4 py-3 font-medium">Status Pagamento</th>
 <th className="px-4 py-3 font-medium text-center">Ações</th>
 </tr>
 </thead>
 <tbody className="text-content-primary divide-y divide-gray-200 dark:divide-gray-600">
 {history.length === 0 ? (
 <tr>
 <td colSpan={8} className="px-4 py-8 text-center text-content-muted">
 Nenhuma compra encontrada para este produto no período selecionado.
 </td>
 </tr>
 ) : (
 history.map((purchase) => (
 <tr key={purchase.id} className="hover:bg-surface-base/50">
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4 text-content-muted" />
 {new Date(purchase.date || '').toLocaleDateString('pt-MZ')}
 </div>
 </td>
 <td className="px-4 py-3">
 {purchase.supplierName || purchase.supplierLocationName || 'Sem fornecedor'}
 </td>
 <td className="px-4 py-3">
 {purchase.invoiceNumber || '-'}
 </td>
 <td className="px-4 py-3 text-right">
 {purchase.item.quantity}
 </td>
 <td className="px-4 py-3 text-right">
 {formatMoney(purchase.item.unitPrice || purchase.item.costPrice || 0)}
 </td>
 <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
 {formatMoney(purchase.item.totalPrice || purchase.item.total || 0)}
 </td>
 <td className="px-4 py-3">
 <span className={`text-xs px-2 py-1 rounded-full inline-block ${purchase.paymentStatus === 'paid'
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
 : purchase.paymentStatus === 'partial'
 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
 : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
 }`}>
 {purchase.paymentStatus === 'paid' ? 'Pago' : purchase.paymentStatus === 'partial' ? 'Parcial' : 'Não pago'}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <button
 type="button"
 onClick={() => {
 setViewingPurchase(purchase);
 setIsViewModalOpen(true);
 setIsHistoryModalOpen(false);
 }}
 className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-content-secondary hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-base rounded-lg transition-colors"
 title="Ver detalhes da compra"
 >
 <Eye className="w-4 h-4" />
 Detalhes
 </button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 {history.length > 0 && (
 <div className="pt-4 border-t border-border-default">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="flex items-center gap-2">
 <ShoppingCart className="w-5 h-5 text-blue-500" />
 <div>
 <p className="text-sm text-content-secondary">Total de Compras</p>
 <p className="text-lg font-semibold text-content-primary">{totalPurchases}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Package className="w-5 h-5 text-content-muted" />
 <div>
 <p className="text-sm text-content-secondary">Quantidade Total</p>
 <p className="text-lg font-semibold text-content-primary">{totalQuantity}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <DollarSign className="w-5 h-5 text-green-500" />
 <div>
 <p className="text-sm text-content-secondary">Valor Total</p>
 <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatMoney(totalValue)}</p>
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 );
 })()}
 </div>
 </div>
 )}
 </ModalPortal>

 {/* Supplier Detail Modal */}
 <ModalPortal open={!!(isSupplierDetailModalOpen && selectedSupplierStats)} onClose={() => { setIsSupplierDetailModalOpen(false); setSelectedSupplierStats(null); }} zIndex={10000}>
 {selectedSupplierStats && (
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="p-6 border-b border-border-default flex justify-between items-start">
 <div>
 <h2 className="text-2xl font-bold text-content-primary">
 {selectedSupplierStats.supplierName}
 </h2>
 <div className="mt-2 space-y-1 text-sm text-content-secondary">
 {selectedSupplierStats.supplier.contactPerson && (
 <p className="flex items-center gap-2">
 <User className="w-4 h-4" />
 {selectedSupplierStats.supplier.contactPerson}
 </p>
 )}
 {selectedSupplierStats.supplier.phone && (
 <p className="flex items-center gap-2">
 <FileText className="w-4 h-4" />
 {selectedSupplierStats.supplier.phone}
 </p>
 )}
 {selectedSupplierStats.supplier.email && (
 <p className="flex items-center gap-2">
 <FileText className="w-4 h-4" />
 {selectedSupplierStats.supplier.email}
 </p>
 )}
 {selectedSupplierStats.supplier.address && (
 <p className="flex items-center gap-2">
 <FileText className="w-4 h-4" />
 {selectedSupplierStats.supplier.address}
 </p>
 )}
 </div>
 </div>
 <button
 onClick={() => {
 setIsSupplierDetailModalOpen(false);
 setSelectedSupplierStats(null);
 }}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-6 h-6" />
 </button>
 </div>

 {/* Statistics Cards */}
 <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
 <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
 <ShoppingCart className="w-5 h-5" />
 <span className="text-sm font-medium">Total Compras</span>
 </div>
 <p className="text-2xl font-bold text-content-primary">
 {selectedSupplierStats.totalPurchases}
 </p>
 </div>
 <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
 <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
 <DollarSign className="w-5 h-5" />
 <span className="text-sm font-medium">Valor Total</span>
 </div>
 <p className="text-2xl font-bold text-green-600 dark:text-green-400">
 {formatMoney(selectedSupplierStats.totalValue)}
 </p>
 </div>
 <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
 <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
 <CheckCircle className="w-5 h-5" />
 <span className="text-sm font-medium">Total Pago</span>
 </div>
 <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
 {formatMoney(selectedSupplierStats.totalPaid)}
 </p>
 </div>
 <div className={`rounded-lg p-4 ${selectedSupplierStats.pendingAmount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
 <div className={`flex items-center gap-2 mb-1 ${selectedSupplierStats.pendingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 <Clock className="w-5 h-5" />
 <span className="text-sm font-medium">Dívida Pendente</span>
 </div>
 <p className={`text-2xl font-bold ${selectedSupplierStats.pendingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 {formatMoney(selectedSupplierStats.pendingAmount)}
 </p>
 </div>
 </div>

 {/* Purchase History */}
 <div className="p-6 pt-0">
 <h3 className="text-lg font-semibold text-content-primary mb-4">
 Histórico de Compras
 </h3>

 {selectedSupplierStats.purchases.length === 0 ? (
 <div className="text-center py-8">
 <ShoppingCart className="w-12 h-12 text-content-muted mx-auto mb-2" />
 <p className="text-content-muted">
 Nenhuma compra registada para este fornecedor.
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto rounded-lg border border-border-default">
 <table className="w-full text-sm">
 <thead className="bg-surface-base">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase">
 Data
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase">
 Fatura
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase">
 Itens
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Valor
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Pago
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Pendente
 </th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted uppercase">
 Status
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase">
 Ações
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {selectedSupplierStats.purchases.map((purchase, index) => {
 const pending = (purchase.totalAmount || 0) - (purchase.amountPaid || 0);
 return (
 <tr
 key={purchase.id}
 className={`${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/50'} hover:bg-surface-base/50 transition-colors`}
 >
 <td className="px-4 py-3 whitespace-nowrap">
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4 text-content-muted" />
 {new Date(purchase.date || '').toLocaleDateString('pt-MZ')}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-content-secondary">
 {purchase.invoiceNumber || '-'}
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <div className="flex items-center gap-1">
 <Package className="w-4 h-4 text-content-muted" />
 {purchase.items?.length || 0}
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-content-primary">
 {formatMoney(purchase.totalAmount || 0)}
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right text-blue-600 dark:text-blue-400">
 {formatMoney(purchase.amountPaid || 0)}
 </td>
 <td className={`px-4 py-3 whitespace-nowrap text-right font-medium ${pending > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 {formatMoney(pending)}
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-center">
 <span className={`text-xs px-2 py-1 rounded-full inline-block ${purchase.paymentStatus === 'paid'
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
 : purchase.paymentStatus === 'partial'
 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
 : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
 }`}>
 {purchase.paymentStatus === 'paid' ? 'Pago' : purchase.paymentStatus === 'partial' ? 'Parcial' : 'Não pago'}
 </span>
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right">
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => {
 setViewingPurchase(purchase);
 setIsViewModalOpen(true);
 }}
 className="p-1 text-content-muted hover:text-brand-600 transition-colors"
 title="Ver detalhes"
 >
 <Eye className="w-4 h-4" />
 </button>
 <button
 onClick={() => setPurchaseForInvoicePreview(purchase)}
 className="p-1 text-content-muted hover:text-blue-600 transition-colors"
 title="Ver fatura"
 >
 <Printer className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 <tfoot className="bg-surface-base font-medium">
 <tr>
 <td colSpan={3} className="px-4 py-3 text-right text-content-secondary">
 Total:
 </td>
 <td className="px-4 py-3 text-right text-content-primary">
 {formatMoney(selectedSupplierStats.totalValue)}
 </td>
 <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
 {formatMoney(selectedSupplierStats.totalPaid)}
 </td>
 <td className={`px-4 py-3 text-right ${selectedSupplierStats.pendingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
 {formatMoney(selectedSupplierStats.pendingAmount)}
 </td>
 <td colSpan={2}></td>
 </tr>
 </tfoot>
 </table>
 </div>
 )}
 </div>

 {/* Supplier Notes */}
 {selectedSupplierStats.supplier.notes && (
 <div className="p-6 pt-0">
 <h4 className="text-sm font-medium text-content-secondary mb-2">Notas</h4>
 <p className="text-sm text-content-secondary bg-surface-base rounded-lg p-3">
 {selectedSupplierStats.supplier.notes}
 </p>
 </div>
 )}
 </div>
 )}
 </ModalPortal>

 {/* Modal Pré-visualização da Fatura */}
 <ModalPortal open={!!purchaseForInvoicePreview} onClose={() => setPurchaseForInvoicePreview(null)}>
 {purchaseForInvoicePreview && (
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
 <div className="p-4 border-b border-border-default flex justify-between items-center flex-shrink-0">
 <h2 className="text-lg font-bold text-content-primary">Pré-visualização da Fatura</h2>
 <button
 onClick={() => setPurchaseForInvoicePreview(null)}
 className="text-content-muted hover:text-content-secondary "
 aria-label="Fechar"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="flex-1 overflow-hidden min-h-0 p-4">
 <iframe
 title="Preview da fatura"
 srcDoc={getInvoiceHtml(purchaseForInvoicePreview)}
 className="w-full h-full min-h-[50vh] max-h-[70vh] border border-border-default rounded-lg bg-surface-raised"
 />
 </div>
 <div className="p-4 border-t border-border-default flex justify-end gap-2 flex-shrink-0">
 <button
 onClick={() => setPurchaseForInvoicePreview(null)}
 className="px-4 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base"
 >
 Fechar
 </button>
 <button
 onClick={() => {
 handlePrintInvoice(purchaseForInvoicePreview);
 setPurchaseForInvoicePreview(null);
 }}
 className="px-4 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base flex items-center gap-2"
 >
 <Printer className="w-4 h-4" />
 Imprimir
 </button>
 <button
 onClick={() => {
 downloadInvoicePDF(purchaseForInvoicePreview);
 setPurchaseForInvoicePreview(null);
 }}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2"
 >
 <Download className="w-4 h-4" />
 Descarregar PDF
 </button>
 </div>
 </div>
 )}
 </ModalPortal>

 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } })}
 variant={confirmDialog.variant}
 />
 </PageShell>
 );
};



