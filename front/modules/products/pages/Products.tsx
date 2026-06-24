import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, ProductType, ProductVariant } from '../../core/types/types';
import { Plus, Edit2, Trash2, Filter, Sprout, ArrowUpDown, ArrowUp, ArrowDown, Settings, X, Layers, Package, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet, Upload, Tag } from 'lucide-react';
import { productService } from '../services/productService';
import { Toast } from '../../core/components/ui/Toast';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';
import { ProductManagement } from '../components/ui/ProductManagement';
import { ProductFormModal } from '../components/modals/ProductFormModal';
import { ProductVariantModal } from '../components/modals/ProductVariantModal';
import { ProductImportModal } from '../components/modals/ProductImportModal';
import { LabelPrintModal } from '../components/modals/LabelPrintModal';
import uploadService, { uploadProductImage, deleteProductImage } from '../../../services/uploadService';
import { uploadVariantImage, validateImageFile } from '../../media/services/imageService';
import { useMobile } from '../../core/hooks/useMobile';
import { PageShell } from '../../core/components/layout/PageShell';
import type { ProductFormData } from '../components/modals/ProductFormModal';
import {
 FilterBar,
 SearchInput,
 ViewModeToggle,
 Pagination,
 ItemsPerPageSelect,
 SelectFilter
} from '../../core/components/filters';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import { createWorkbook, addWorksheet, addRowsFromJson, writeWorkbookToFile } from '../../core/services/excelService';
import { getTodayDateString } from '../../core/utils/dateUtils';
import { useTrackAction } from '../../auth/components/TrackedPage';

/** Uma linha da tabela: produto fixo (uma linha) ou variante de produto variável (uma linha por variante). */
type ProductTableRow =
 | { type: 'product'; product: Product }
 | { type: 'variant'; product: Product; variant: ProductVariant };

type ProductManagementTabType = 'categories' | 'units' | 'templates';

interface ProductsProps {
 products?: Product[];
 totalProductsCount?: number | null;
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
 onReloadData?: () => void;
 showManagementTab?: ProductManagementTabType;
}

export const Products: React.FC<ProductsProps> = ({ showToast, onReloadData, totalProductsCount, showManagementTab }) => {
 // Hook para detectar mobile
 const isMobile = useMobile(768);
 const trackAction = useTrackAction();

 const [products, setProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

 // Filters
 const [filterCategory, setFilterCategory] = useState('Todas');
 const [filterProductType, setFilterProductType] = useState<'all' | 'fixed' | 'variable'>('fixed');
 const [showFilters, setShowFilters] = useState(false);

 // Selection
 const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

 // View Mode - padrão: cards no mobile, tabela no desktop
 const [viewMode, setViewMode] = useState<'table' | 'cards'>(isMobile ? 'cards' : 'table');

 // Pagination
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(500);

 // Management Mode - mostrar automaticamente se showManagementTab está definido
 const [showManagement, setShowManagement] = useState(!!showManagementTab);

 // Sorting
 type SortField = 'name' | 'price' | 'costPrice' | 'margin' | 'stock' | 'updatedAt';
 type SortDirection = 'asc' | 'desc';
 const [sortField, setSortField] = useState<SortField>('updatedAt');
 const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

 // Modals: form (create/edit product) and variant management (per product)
 const [isProductFormOpen, setIsProductFormOpen] = useState(false);
 const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);

 // Track broken images
 const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

 // Confirmation Dialog
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

 // Form: product being edited (for form modal)
 const [editingProduct, setEditingProduct] = useState<Product | null>(null);

 // Import modal
 const [isImportOpen, setIsImportOpen] = useState(false);

 // Label print modal
 const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);

 // Categories and Units from management system (API returns id, name, abbreviation, isActive)
 const [categoriesList, setCategoriesList] = useState<Array<{ id: string; name: string; isActive?: boolean }>>([]);
 const [unitsList, setUnitsList] = useState<Array<{ id: string; name: string; abbreviation: string; isActive?: boolean }>>([]);
 const [loadingCategoriesUnits, setLoadingCategoriesUnits] = useState(true);

 // Removido sistema de localizações - produtos usam apenas campo stock tradicional

 const [gridKey, setGridKey] = React.useState(0);

 const loadProducts = async () => {
 setLoading(true);
 setBrokenImages(new Set()); // reset imagens marcadas como quebradas
 productService.clearCache('products'); // garantir dados frescos
 const data = await productService.getProducts();
 setProducts(data);
 setGridKey(k => k + 1); // forçar remount do grid para as animações repetirem
 setLoading(false);
 };

 // Memoizar loadCategoriesAndUnits para evitar recriação
 const loadCategoriesAndUnitsMemo = useCallback(async () => {
 setLoadingCategoriesUnits(true);
 try {
 const [categories, units] = await Promise.all([
 productService.getCategories(),
 productService.getUnits()
 ]);
 setCategoriesList((categories as unknown as Array<{ id: string; name: string; isActive?: boolean }>).filter(c => c.isActive !== false));
 setUnitsList((units as unknown as Array<{ id: string; name: string; abbreviation: string; isActive?: boolean }>).filter(u => u.isActive !== false));
 } catch (error) {
 console.error('Erro ao carregar categorias e unidades:', error);
 } finally {
 setLoadingCategoriesUnits(false);
 }
 }, []);

 // Load Initial Data
 React.useEffect(() => {
 loadProducts();
 loadCategoriesAndUnitsMemo();
 }, [loadCategoriesAndUnitsMemo]);

 // Recarregar produtos quando produtos são atualizados externamente (ex: após compra)
 React.useEffect(() => {
 const handleProductsUpdated = () => {
 console.log('[Products] Evento products-updated recebido, recarregando produtos...');
 loadProducts();
 };

 window.addEventListener('products-updated', handleProductsUpdated);

 return () => {
 window.removeEventListener('products-updated', handleProductsUpdated);
 };
 }, []);

 // Reload categories and units when returning from management
 useEffect(() => {
 if (!showManagement) {
 loadCategoriesAndUnitsMemo();
 }
 }, [showManagement, loadCategoriesAndUnitsMemo]);

 // Form defaults are handled inside ProductFormModal

 // Debounce da pesquisa (300ms)
 useEffect(() => {
 const timer = setTimeout(() => {
 setDebouncedSearchTerm(searchTerm);
 }, 300);

 return () => clearTimeout(timer);
 }, [searchTerm]);

 // Reset paginação quando filtros mudarem
 useEffect(() => {
 setCurrentPage(1);
 }, [debouncedSearchTerm, filterCategory, filterProductType, itemsPerPage]);

 // Unique Categories - combine from products and management system
 const productCategories = new Set(products.map(p => p.category).filter(Boolean));
 const managedCategories = categoriesList.map((c: { name: string }) => c.name);
 const allCategoriesSet = new Set([...Array.from(productCategories), ...managedCategories]);
 const categories = ['Todas', ...Array.from(allCategoriesSet).sort()];

 // Helper function to calculate total stock
 const calculateTotalStock = (product: Product): number => {
 if (product.variants && product.variants.length > 0) {
 return product.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
 }
 return product.stock ?? 0;
 };

 // Helper: produto fixo = sem variações (hasVariants = false)
 const isFixedProduct = (p: Product) =>
 !p.hasVariants || !p.variants?.length;
 // Helper: produto variável = com variantes reais (1 ou mais)
 const isVariableProduct = (p: Product) =>
 Boolean(p.hasVariants && p.variants && p.variants.length >= 1);

 // Filtro por pesquisa e categoria (lista de produtos)
 // Fixos = produtos sem variantes; Variáveis = produtos com variantes (1 ou mais); Todos = todos
 const filteredProducts = useMemo(() => {
 return products.filter(p => {
 const matchesSearch = normalizeForSearch(p.name).includes(normalizeForSearch(debouncedSearchTerm));
 const matchesCategory = filterCategory === 'Todas' || p.category === filterCategory;
 const matchesProductType =
 filterProductType === 'all' ||
 filterProductType === 'fixed' || // Fixos: mostrar todos os produtos (agrupados)
 (filterProductType === 'variable' && isVariableProduct(p));
 return matchesSearch && matchesCategory && matchesProductType;
 });
 }, [products, debouncedSearchTerm, filterCategory, filterProductType]);

 // Variante padrão (isDefault ou primeira) para preço de compra/venda quando produto tem variações
 const getDefaultVariant = (product: Product): ProductVariant | null => {
 if (!product.variants?.length) return null;
 const defaultV = product.variants.find(v => v.isDefault);
 return defaultV ?? product.variants[0] ?? null;
 };

 // Lista plana de linhas: Fixos = 1 linha por produto (todos, com preço padrão e stock soma); Variáveis = 1 linha por variante; Todos = fixos 1 linha + variáveis 1 linha por variante
 const tableRows = useMemo(() => {
 const rows: ProductTableRow[] = [];
 filteredProducts.forEach(product => {
 const fixed = isFixedProduct(product);
 const variable = isVariableProduct(product);
 if (filterProductType === 'fixed') {
 // Fixos: uma linha por produto (inclui variáveis agrupados)
 rows.push({ type: 'product', product });
 } else if (fixed) {
 rows.push({ type: 'product', product });
 } else if (variable && product.variants?.length) {
 product.variants.forEach(variant => {
 rows.push({ type: 'variant', product, variant });
 });
 }
 });
 return rows;
 }, [filteredProducts, filterProductType]);

 // Ordenação sobre a lista plana (produto com variantes usa variante padrão para preço)
 const sortedTableRows = useMemo(() => {
 const sorted = [...tableRows];
 sorted.sort((a, b) => {
 let aValue: string | number;
 let bValue: string | number;
 const getProduct = (r: ProductTableRow) => r.product;
 const getCostPrice = (r: ProductTableRow) => {
 if (r.type === 'variant') return r.variant.costPrice ?? 0;
 const p = r.product;
 const def = p.variants?.length ? getDefaultVariant(p) : null;
 return def ? (def.costPrice ?? 0) : (p.costPrice ?? 0);
 };
 const getPrice = (r: ProductTableRow) => {
 if (r.type === 'variant') return r.variant.price;
 const p = r.product;
 const def = p.variants?.length ? getDefaultVariant(p) : null;
 return def ? def.price : p.price;
 };
 switch (sortField) {
 case 'name':
 aValue = (a.type === 'variant' ? `${getProduct(a).name} ${a.variant.name}` : getProduct(a).name).toLowerCase();
 bValue = (b.type === 'variant' ? `${getProduct(b).name} ${b.variant.name}` : getProduct(b).name).toLowerCase();
 break;
 case 'price':
 aValue = getPrice(a);
 bValue = getPrice(b);
 break;
 case 'costPrice':
 aValue = getCostPrice(a);
 bValue = getCostPrice(b);
 break;
 case 'margin': {
 const getMargin = (r: ProductTableRow) => {
 const cost = getCostPrice(r);
 const sell = getPrice(r);
 return cost > 0 ? ((sell - cost) / cost) * 100 : 0;
 };
 aValue = getMargin(a);
 bValue = getMargin(b);
 break;
 }
 case 'stock':
 aValue = a.type === 'variant' ? a.variant.stock : calculateTotalStock(getProduct(a));
 bValue = b.type === 'variant' ? b.variant.stock : calculateTotalStock(getProduct(b));
 break;
 case 'updatedAt':
 aValue = getProduct(a).updatedAt || getProduct(a).createdAt || '';
 bValue = getProduct(b).updatedAt || getProduct(b).createdAt || '';
 break;
 default:
 return 0;
 }
 if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
 if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
 return 0;
 });
 return sorted;
 }, [tableRows, sortField, sortDirection]);

 // Paginação sobre linhas (vista tabela)
 const totalPages = Math.ceil(sortedTableRows.length / itemsPerPage);
 const paginatedTableRows = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return sortedTableRows.slice(start, start + itemsPerPage);
 }, [sortedTableRows, currentPage, itemsPerPage]);

 // Para vista cartões: lista de produtos filtrada e ordenada (por produto, não por linha)
 const filteredAndSortedProducts = useMemo(() => {
 const list = [...filteredProducts];
 list.sort((a, b) => {
 let aVal: any, bVal: any;
 switch (sortField) {
 case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
 case 'price': aVal = a.price; bVal = b.price; break;
 case 'costPrice': aVal = a.costPrice ?? 0; bVal = b.costPrice ?? 0; break;
 case 'margin': {
 const getMargin = (p: Product) => {
 const cost = p.variants?.length ? getDefaultVariant(p)?.costPrice ?? p.costPrice ?? 0 : (p.costPrice ?? 0);
 const sell = p.variants?.length ? getDefaultVariant(p)?.price ?? p.price : p.price;
 return cost > 0 ? ((sell - cost) / cost) * 100 : 0;
 };
 aVal = getMargin(a); bVal = getMargin(b); break;
 }
 case 'stock': aVal = calculateTotalStock(a); bVal = calculateTotalStock(b); break;
 case 'updatedAt': aVal = a.updatedAt || a.createdAt || ''; bVal = b.updatedAt || b.createdAt || ''; break;
 default: return 0;
 }
 if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
 if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
 return 0;
 });
 return list;
 }, [filteredProducts, sortField, sortDirection]);
 const paginatedProducts = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredAndSortedProducts.slice(start, start + itemsPerPage);
 }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

 const handleSort = (field: SortField) => {
 if (sortField === field) {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField(field);
 setSortDirection('asc');
 }
 };

 const getSortIcon = (field: SortField) => {
 if (sortField !== field) {
 return <ArrowUpDown className="w-4 h-4 ml-1 text-content-muted" />;
 }
 return sortDirection === 'asc'
 ? <ArrowUp className="w-4 h-4 ml-1 text-brand-600 dark:text-brand-400" />
 : <ArrowDown className="w-4 h-4 ml-1 text-brand-600 dark:text-brand-400" />;
 };

 const toggleProductSelection = (productId: string) => {
 const newSelected = new Set(selectedProducts);
 if (newSelected.has(productId)) {
 newSelected.delete(productId);
 } else {
 newSelected.add(productId);
 }
 setSelectedProducts(newSelected);
 };

 const toggleSelectAll = () => {
 const pageProductIds = [...new Set(paginatedTableRows.map(r => r.product.id))];
 const allSelected = pageProductIds.length > 0 && pageProductIds.every(id => selectedProducts.has(id));
 if (allSelected) {
 setSelectedProducts(prev => {
 const next = new Set(prev);
 pageProductIds.forEach(id => next.delete(id));
 return next;
 });
 } else {
 setSelectedProducts(prev => {
 const next = new Set(prev);
 pageProductIds.forEach(id => next.add(id));
 return next;
 });
 }
 };

 const handleBulkDelete = async () => {
 if (selectedProducts.size === 0) return;
 const count = selectedProducts.size;
 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja apagar ${count} produto(s)?\n\nEsta ação não pode ser desfeita.`,
 variant: 'danger',
 onConfirm: async () => {
 let successCount = 0;
 let errorCount = 0;
 trackAction('delete', { entity: 'product', entityIds: Array.from(selectedProducts) });
 for (const productId of selectedProducts) {
 const success = await productService.deleteProduct(productId);
 if (success) successCount++;
 else errorCount++;
 }
 setSelectedProducts(new Set());
 loadProducts();
 if (errorCount > 0) {
 showToast(`${successCount} produto(s) apagado(s) com sucesso. ${errorCount} erro(s) ao apagar.`, 'warning');
 } else {
 showToast(`${successCount} produto(s) apagado(s) com sucesso!`, 'success');
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 const formatMoney = (value: number) => {
 const formatted = value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
 return formatted.replace(/MZN/gi, 'MT').replace(/MTn/gi, 'MT');
 };

 const uploadProductImageAdapter = async (file: File, productId?: string): Promise<string | null> => {
 const url = await uploadProductImage(file);
 if (url) {
 return url;
 }
 console.error('[Upload Error]: failed to get URL');
 return null;
 };

 // Wrapper para adaptar deleteProductImage ao formato esperado pelo ProductFormModal
 const deleteProductImageAdapter = async (imageUrl: string): Promise<void | boolean> => {
 // Extrair filename da URL
 const filename = imageUrl.split('/').pop();
 if (!filename) return false;
 return await deleteProductImage(filename);
 };

 const handleSaveProductForm = async (data: ProductFormData) => {
 const payload: Partial<Product> = {
 name: data.name,
 category: data.category,
 price: data.price,
 costPrice: data.costPrice,
 minStock: data.minStock,
 unit: data.unit,
 image: data.image,
 image2: data.image2,
 image3: data.image3,
 image4: data.image4,
 showInShop: data.showInShop,
 type: ProductType.FRESH,
 stock: data.stock,
 description: (data as any).description || undefined,
 descriptionLong: (data as any).descriptionLong || undefined,
 benefits: (data as any).benefits || undefined,
 howToUse: (data as any).howToUse || undefined,
 ingredients: (data as any).ingredients || undefined,
 promotionalPrice: (data as any).promotionalPrice ?? null,
 barcode: (data as any).barcode || null,
 vatRegime: (data as any).vatRegime || 'standard',
 };
 let success = false;
 let productId: string | null = null;
 if (editingProduct) {
 success = await productService.updateProduct(editingProduct.id, payload);
 productId = editingProduct.id;
 } else {
 const result = await productService.addProduct(payload as Omit<Product, 'id'>);
 success = !!result;
 productId = result?.id || null;
 }
 if (success && productId) {
 if (editingProduct) {
 trackAction('update', { entity: 'product', entityId: productId, changes: { name: payload.name } });
 } else {
 trackAction('create', { entity: 'product', entityId: productId || '', changes: { name: payload.name } });
 }
 await loadProducts();
 setIsProductFormOpen(false);
 setEditingProduct(null);
 if (!editingProduct) {
 const list = await productService.getProducts();
 const newProduct = list.find((p) => p.id === productId);
 if (newProduct) {
 setVariantModalProduct(newProduct);
 showToast('Produto criado! Adicione variações no modal abaixo.', 'success');
 } else {
 showToast('Produto criado com sucesso.', 'success');
 }
 } else {
 showToast('Produto atualizado com sucesso.', 'success');
 }
 } else {
 showToast('Erro ao salvar produto. Verifique os dados e tente novamente.', 'error', 5000);
 }
 };

 const handleDelete = async (id: string) => {
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja apagar este produto?\n\nEsta ação não pode ser desfeita.',
 variant: 'danger',
 onConfirm: async () => {
 trackAction('delete', { entity: 'product', entityId: id });
 await productService.deleteProduct(id);
 loadProducts();
 showToast('Produto apagado com sucesso', 'success');
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 const handleEdit = (product: Product) => {
 setEditingProduct(product);
 setIsProductFormOpen(true);
 };

 const openVariantModal = (product: Product) => {
 setVariantModalProduct(product);
 };

 const handleImageError = (imageUrl: string) => {
 console.warn('[Products] Erro ao carregar imagem:', imageUrl);
 setBrokenImages((prev) => new Set([...prev, imageUrl]));
 };

 React.useEffect(() => {
 setSelectedProducts(new Set());
 }, [searchTerm, filterCategory, filterProductType]);

 if (showManagement) {
 return (
 <div className="space-y-6">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div>
 <h2 className="text-2xl font-bold text-content-primary">Gestão de Produtos</h2>
 <p className="text-sm text-content-muted">Categorias, Unidades e Templates de Variações</p>
 </div>
 <button
 onClick={() => setShowManagement(false)}
 className="bg-surface-raised border border-border-default text-content-secondary hover:bg-surface-base rounded-lg transition-colors flex items-center shadow-lg px-4 py-2"
 >
 <Package className="w-4 h-4" /> Voltar para Produtos
 </button>
 </div>
 <ProductManagement showToast={showToast} defaultTab={showManagementTab || 'categories'} />
 </div>
 );
 }

 const exportToExcel = async () => {
 try {
 if (products.length === 0) {
 showToast('Não há dados para exportar', 'warning');
 return;
 }

 const exportData: Record<string, unknown>[] = [];

 for (const product of products) {
 const hasVariants = product.variants && product.variants.length > 0;

 if (!hasVariants) {
 exportData.push({
 nome: product.name,
 categoria: product.category || '',
 unidade: product.unit || 'un',
 preco_venda: product.price ?? 0,
 preco_custo: product.costPrice ?? 0,
 stock: product.stock ?? 0,
 stock_minimo: product.minStock ?? 0,
 barcode: product.barcode || '',
 image: product.image || '',
 image2: product.image2 || '',
 image3: product.image3 || '',
 image4: product.image4 || '',
 mostrar_na_loja: product.showInShop ? 'Sim' : 'Nao',
 descricao: product.description || '',
 descricao_longa: product.descriptionLong || '',
 beneficios: product.benefits || '',
 como_usar: product.howToUse || '',
 ingredientes: product.ingredients || '',
 variante_nome: '',
 variante_preco_venda: '',
 variante_preco_custo: '',
 variante_stock: '',
 variante_padrao: '',
 });
 } else {
 product.variants!.forEach((v, i) => {
 exportData.push({
 nome: product.name,
 categoria: i === 0 ? (product.category || '') : '',
 unidade: i === 0 ? (product.unit || 'un') : '',
 preco_venda: '',
 preco_custo: '',
 stock: '',
 stock_minimo: '',
 barcode: i === 0 ? (product.barcode || '') : '',
 image: i === 0 ? (product.image || '') : '',
 image2: i === 0 ? (product.image2 || '') : '',
 image3: i === 0 ? (product.image3 || '') : '',
 image4: i === 0 ? (product.image4 || '') : '',
 mostrar_na_loja: i === 0 ? (product.showInShop ? 'Sim' : 'Nao') : '',
 descricao: i === 0 ? (product.description || '') : '',
 descricao_longa: i === 0 ? (product.descriptionLong || '') : '',
 beneficios: i === 0 ? (product.benefits || '') : '',
 como_usar: i === 0 ? (product.howToUse || '') : '',
 ingredientes: i === 0 ? (product.ingredients || '') : '',
 variante_nome: v.name,
 variante_preco_venda: v.price ?? '',
 variante_preco_custo: v.costPrice ?? '',
 variante_stock: v.stock ?? '',
 variante_padrao: v.isDefault ? 'Sim' : 'Nao',
 });
 });
 }
 }

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Produtos');
 addRowsFromJson(ws, exportData);

 // Style header row
 ws.getRow(1).eachCell(cell => {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065f46' } };
 cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
 cell.alignment = { horizontal: 'center', vertical: 'middle' };
 });
 ws.getRow(1).height = 24;
 ws.views = [{ state: 'frozen', ySplit: 1 }];

 // Alternate row colors
 for (let r = 2; r <= exportData.length + 1; r++) {
 ws.getRow(r).eachCell(cell => {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FFF0fdf4' : 'FFFFFFFF' } };
 cell.font = { size: 10 };
 });
 }

 const colWidths = [32, 22, 10, 14, 14, 10, 12, 18, 50, 50, 50, 50, 14, 36, 36, 36, 36, 36, 24, 18, 18, 14, 14];
 colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 const filename = `produtos_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportação concluída: ${products.length} produto(s)`, 'success');
 } catch (error) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 const pageActions = (
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowManagement(true)}
 className="bg-surface-raised border border-border-default text-content-secondary hover:bg-surface-base rounded-lg transition-colors flex items-center shadow-lg px-4 py-2"
 title="Gerir Categorias, Unidades e Templates"
 >
 <Settings className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Categorias</span>
 </button>
 <button
 onClick={() => setIsLabelPrintOpen(true)}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Imprimir etiquetas de produtos"
 >
 <Tag className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Etiquetas</span>
 </button>
 <button
 onClick={() => setIsImportOpen(true)}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Importar produtos via planilha"
 >
 <Upload className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Importar</span>
 </button>
 <button
 onClick={exportToExcel}
 className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 title="Exportar todos os produtos para Excel"
 >
 <FileSpreadsheet className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Exportar</span>
 </button>
 <button
 onClick={() => {
 setEditingProduct(null);
 setIsProductFormOpen(true);
 }}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 >
 <Plus className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Novo</span>
 </button>
 {/* Botão Filtros - Apenas no Mobile */}
 {isMobile && (
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${showFilters || searchTerm || filterCategory !== 'Todas' || filterProductType !== 'all'
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-gray-600 hover:bg-border-strong text-white'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {(searchTerm || filterCategory !== 'Todas' || filterProductType !== 'all') && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {[searchTerm ? 1 : 0, filterCategory !== 'Todas' ? 1 : 0, filterProductType !== 'all' ? 1 : 0].filter(Boolean).length}
 </span>
 )}
 </button>
 )}
 </div>
 );

 return (
 <PageShell
 title="Lista de Produtos"
 description="Gestão de produtos, preços, variações e categorias"
 actions={pageActions}
 >
 {/* FilterBar - Filtros principais visíveis no desktop */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <ViewModeToggle
 value={viewMode === 'cards' ? 'cards' : 'table'}
 onChange={(mode) => setViewMode(mode === 'cards' ? 'cards' : 'table')}
 size="compact"
 />

 <div className="h-4 w-px bg-surface-base flex-shrink-0" />

 <SearchInput
 value={searchTerm}
 onChange={(val) => setSearchTerm(val)}
 placeholder="Buscar produtos..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 {/* Filtro Fixos / Variáveis - Oculto no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterProductType}
 onChange={(val) => {
 setFilterProductType(val as 'all' | 'fixed' | 'variable');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todos' },
 { value: 'fixed', label: 'Fixos' },
 { value: 'variable', label: 'Variáveis' }
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Ver produtos fixos ou variáveis"
 />
 </div>

 {/* Filtros - Ocultos no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterCategory}
 onChange={(val) => {
 setFilterCategory(val);
 setCurrentPage(1);
 }}
 options={categories.map(c => ({ value: c, label: c }))}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por categoria"
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

 {/* Botão Limpar Filtros - Oculto no Mobile */}
 {(searchTerm || filterCategory !== 'Todas' || filterProductType !== 'all') && (
 <button
 onClick={() => {
 setSearchTerm('');
 setFilterCategory('Todas');
 setFilterProductType('all');
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
 Tipo
 </label>
 <SelectFilter
 value={filterProductType}
 onChange={(val) => {
 setFilterProductType(val as 'all' | 'fixed' | 'variable');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todos' },
 { value: 'fixed', label: 'Fixos' },
 { value: 'variable', label: 'Variáveis' }
 ]}
 className="w-full"
 size="md"
 ariaLabel="Ver produtos fixos ou variáveis"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Categoria
 </label>
 <SelectFilter
 value={filterCategory}
 onChange={(val) => {
 setFilterCategory(val);
 setCurrentPage(1);
 }}
 options={categories.map(c => ({ value: c, label: c }))}
 className="w-full"
 size="md"
 ariaLabel="Filtrar por categoria"
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

 {/* Botão Limpar Filtros */}
 {(searchTerm || filterCategory !== 'Todas' || filterProductType !== 'all') && (
 <button
 onClick={() => {
 setSearchTerm('');
 setFilterCategory('Todas');
 setFilterProductType('all');
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

 {/* Bulk Actions Bar */}
 {selectedProducts.size > 0 && (
 <div className="bg-brand-50 dark:bg-brand-600/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
 {selectedProducts.size} produto(s) selecionado(s)
 </span>
 <button
 onClick={() => setSelectedProducts(new Set())}
 className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 underline"
 >
 Desmarcar todos
 </button>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={handleBulkDelete}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 Apagar Selecionados
 </button>
 </div>
 </div>
 )}

 {/* Products View - Cards or Table */}
 {viewMode === 'cards' ? (
 /* Cards View */
 <div key={gridKey} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
 {loading ? (
 <div className="col-span-full text-center py-10 text-content-muted">A carregar...</div>
 ) : filteredAndSortedProducts.length === 0 ? (
 <div className="col-span-full text-center py-10 text-content-muted">Nenhum produto encontrado.</div>
 ) : (
 paginatedProducts.map(product => {
 const isSelected = selectedProducts.has(product.id);
 const hasVariants = product.hasVariants && product.variants && product.variants.length > 0;
 const totalStock = calculateTotalStock(product);
 const minStock = product.minStock || 5;
 const isLowStock = totalStock < minStock;

 return (
 <div
 key={product.id}
 className={`bg-surface-raised rounded-lg shadow-md overflow-hidden border-2 transition-all ${isSelected ? 'border-brand-500 dark:border-brand-400' : 'border-transparent'
 }`}
 >
 <div className="relative aspect-[4/3] bg-surface-base /60">
 {product.image && !brokenImages.has(product.image) ? (
 <img
 src={uploadService.getPublicUrl(product.image)}
 alt={product.name}
 className="w-full h-full object-contain p-2"
 onError={() => handleImageError(product.image)}
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <Sprout className="w-12 h-12 text-brand-600 dark:text-brand-400 opacity-40" />
 </div>
 )}
 <div className="absolute top-2 left-2">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleProductSelection(product.id)}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 />
 </div>
 </div>
 <div className="p-4">
 <div className="flex items-start justify-between mb-2">
 <div className="flex-1">
 <h3 className="font-semibold text-content-primary">{product.name}</h3>
 <p className="text-sm text-content-muted">{product.category}</p>
 {hasVariants && (
 <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
 ({product.variants?.length || 0} variações)
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center justify-between mb-3">
 <div>
 <p className="text-lg font-bold text-content-primary">
 {product.price.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' }).replace(/MZN/gi, 'MT')}
 </p>
 <p className={`text-sm font-medium ${isLowStock
 ? 'text-red-600 dark:text-red-400'
 : totalStock === 0
 ? 'text-content-muted'
 : 'text-content-secondary'
 }`}>
 Stock: {totalStock.toLocaleString('pt-MZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleEdit(product)}
 className="flex-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Edit2 className="w-4 h-4 inline mr-1" />
 Editar
 </button>
 <button
 onClick={() => openVariantModal(product)}
 className="px-3 py-2 bg-gray-600 hover:bg-border-strong text-white rounded-lg text-sm font-medium transition-colors"
 title="Gerir variações"
 >
 <Layers className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDelete(product.id)}
 className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>
 ) : (
 /* Table View */
 <div className="overflow-auto max-h-[calc(100vh-180px)]">
 <table className="w-full border-collapse">
 <thead className="sticky top-0 z-10">
 <tr className="bg-surface-base border-b border-border-default">
 <th className="px-2 py-4 text-center w-12">
 <input
 type="checkbox"
 checked={paginatedTableRows.length > 0 && paginatedTableRows.every(r => selectedProducts.has(r.product.id))}
 onChange={(e) => {
 if (e.target.checked) {
 setSelectedProducts(prev => {
 const next = new Set(prev);
 paginatedTableRows.forEach(r => next.add(r.product.id));
 return next;
 });
 } else {
 setSelectedProducts(prev => {
 const next = new Set(prev);
 paginatedTableRows.forEach(r => next.delete(r.product.id));
 return next;
 });
 }
 }}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 title="Selecionar todos"
 />
 </th>
 <th
 className="px-6 py-4 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('name')}
 >
 <div className="flex items-center">
 Nome do produto
 {getSortIcon('name')}
 </div>
 </th>
 <th
 className="px-6 py-4 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('costPrice')}
 >
 <div className="flex items-center">
 Preço de compra
 {getSortIcon('costPrice')}
 </div>
 </th>
 <th
 className="px-6 py-4 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('price')}
 >
 <div className="flex items-center">
 Preço de venda
 {getSortIcon('price')}
 </div>
 </th>
 <th
 className="px-6 py-4 text-center text-xs font-semibold text-content-secondary uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('margin')}
 >
 <div className="flex items-center justify-center">
 Margem %
 {getSortIcon('margin')}
 </div>
 </th>
 <th
 className="px-6 py-4 text-center text-xs font-semibold text-content-secondary uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('stock')}
 >
 <div className="flex items-center justify-center">
 Stock
 {getSortIcon('stock')}
 </div>
 </th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-surface-raised divide-y divide-gray-200 dark:divide-gray-700">
 {loading ? (
 <tr>
 <td colSpan={7} className="px-6 py-8 text-center text-content-muted">
 A carregar produtos...
 </td>
 </tr>
 ) : paginatedTableRows.length === 0 ? (
 <tr>
 <td colSpan={7} className="px-6 py-8 text-center text-content-muted">
 Nenhum produto encontrado.
 </td>
 </tr>
 ) : (
 paginatedTableRows.map((row) => {
 const product = row.product;
 const isSelected = selectedProducts.has(product.id);
 const rowKey = row.type === 'product' ? product.id : `${product.id}-${row.variant.id}`;
 const displayName = row.type === 'variant' ? `${product.name} ${row.variant.name}` : product.name;
 const image = row.type === 'variant' ? (row.variant.image || product.image) : product.image;
 // Produto com várias variantes em vista "Fixos": preço padrão (variante default) e stock = soma das variantes
 const defaultVariant = product.variants?.length ? getDefaultVariant(product) : null;
 const costPrice = row.type === 'variant' ? (row.variant.costPrice ?? 0) : (defaultVariant ? (defaultVariant.costPrice ?? 0) : (product.costPrice ?? 0));
 const price = row.type === 'variant' ? row.variant.price : (defaultVariant ? defaultVariant.price : product.price);
 const stock = row.type === 'variant' ? row.variant.stock : calculateTotalStock(product);
 const minStock = row.type === 'variant' ? (row.variant.minStock || 5) : (product.minStock || 5);
 const isLowStock = stock < minStock;

 return (
 <tr key={rowKey} className={`hover:bg-surface-base transition-colors ${isSelected ? 'bg-brand-50 dark:bg-brand-600/20' : ''}`}>
 <td className="px-2 py-4 text-center">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleProductSelection(product.id)}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 />
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-surface-base flex items-center justify-center flex-shrink-0 overflow-hidden">
 {image ? (
 <img src={uploadService.getPublicUrl(image)} alt={displayName} className="w-full h-full object-cover" />
 ) : (
 <Sprout className="w-5 h-5 text-brand-600 dark:text-brand-400" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-content-primary">{displayName}</div>
 <div className="text-sm text-content-muted">{product.category}</div>
 </div>
 </div>
 </td>
 <td className="px-6 py-4">
 <span className="font-medium text-content-primary">
 {costPrice.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' }).replace(/MZN/gi, 'MT')}
 </span>
 </td>
 <td className="px-6 py-4">
 <span className="font-medium text-content-primary">
 {price.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' }).replace(/MZN/gi, 'MT')}
 </span>
 </td>
 <td className="px-6 py-4 text-center">
 {costPrice > 0 ? (
 <span className={`font-semibold text-sm ${((price - costPrice) / costPrice) * 100 >= 30 ? 'text-emerald-600 dark:text-emerald-400' : ((price - costPrice) / costPrice) * 100 >= 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
 {(((price - costPrice) / costPrice) * 100).toFixed(1)}%
 </span>
 ) : (
 <span className="text-content-muted text-sm">—</span>
 )}
 </td>
 <td className="px-6 py-4 text-center">
 <div className="flex flex-col items-center">
 <span className={`font-medium ${stock < 0 ? 'text-red-600 dark:text-red-400' : isLowStock ? 'text-orange-600 dark:text-orange-400' : stock === 0 ? 'text-content-muted' : 'text-content-primary'}`}>
 {stock.toLocaleString('pt-MZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
 </span>
 {stock < 0 && <span className="text-xs text-red-600 dark:text-red-400">Stock negativo</span>}
 {isLowStock && stock > 0 && <span className="text-xs text-orange-600 dark:text-orange-400">Stock baixo</span>}
 {stock === 0 && <span className="text-xs text-red-600 dark:text-red-400">Sem stock</span>}
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center gap-2">
 <button onClick={() => handleEdit(product)} className="p-2 text-content-secondary hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-base rounded-lg transition-colors" title="Editar">
 <Edit2 className="w-4 h-4" />
 </button>
 <button onClick={() => openVariantModal(product)} className="p-2 text-content-secondary hover:text-content-secondary dark:hover:text-content-muted hover:bg-surface-base rounded-lg transition-colors" title="Gerir variações">
 <Layers className="w-4 h-4" />
 </button>
 <button onClick={() => handleDelete(product.id)} className="p-2 text-content-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-base rounded-lg transition-colors" title="Apagar">
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 )}

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
 <div className="text-sm text-content-secondary">
 Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, sortedTableRows.length)} de {sortedTableRows.length} itens
 </div>
 <div className="flex items-center gap-2">
 {/* Primeira página */}
 <button
 onClick={() => setCurrentPage(1)}
 disabled={currentPage === 1}
 className="p-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 title="Primeira página"
 >
 <ChevronsLeft className="w-4 h-4" />
 </button>

 {/* Página anterior */}
 <button
 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 disabled={currentPage === 1}
 className="p-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 title="Página anterior"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>

 {/* Seletor de página */}
 <div className="flex items-center gap-2 px-2">
 <span className="text-sm text-content-secondary">Página</span>
 <input
 type="number"
 min={1}
 max={totalPages}
 value={currentPage}
 onChange={(e) => {
 const page = parseInt(e.target.value);
 if (page >= 1 && page <= totalPages) {
 setCurrentPage(page);
 }
 }}
 onBlur={(e) => {
 const page = parseInt(e.target.value);
 if (isNaN(page) || page < 1) {
 setCurrentPage(1);
 } else if (page > totalPages) {
 setCurrentPage(totalPages);
 }
 }}
 className="w-16 px-2 py-1 text-center border border-border-default rounded-lg text-sm font-medium text-content-secondary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-500"
 />
 <span className="text-sm text-content-secondary">de {totalPages}</span>
 </div>

 {/* Página seguinte */}
 <button
 onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
 disabled={currentPage === totalPages}
 className="p-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 title="Próxima página"
 >
 <ChevronRight className="w-4 h-4" />
 </button>

 {/* Última página */}
 <button
 onClick={() => setCurrentPage(totalPages)}
 disabled={currentPage === totalPages}
 className="p-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 title="Última página"
 >
 <ChevronsRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 )}
 {/* ConfirmDialog */}
 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 variant={confirmDialog.variant}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } })}
 />

 <ProductFormModal
 open={isProductFormOpen}
 onClose={() => {
 setIsProductFormOpen(false);
 setEditingProduct(null);
 }}
 product={editingProduct}
 categories={categoriesList.map((c) => ({ id: c.id, name: c.name }))}
 units={unitsList.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation }))}
 onSave={handleSaveProductForm}
 showToast={showToast}
 uploadProductImage={uploadProductImageAdapter}
 deleteProductImage={deleteProductImageAdapter}
 validateImageFile={validateImageFile}
 />

 <ProductVariantModal
 open={!!variantModalProduct}
 onClose={() => setVariantModalProduct(null)}
 product={variantModalProduct}
 units={unitsList.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation }))}
 onProductUpdated={(updated) => {
 setVariantModalProduct(updated);
 loadProducts();
 }}
 showToast={showToast}
 uploadVariantImage={uploadVariantImage}
 validateImageFile={validateImageFile}
 />

 <ProductImportModal
 open={isImportOpen}
 onClose={() => setIsImportOpen(false)}
 onSuccess={() => { loadProducts(); showToast('Produtos importados com sucesso!', 'success'); }}
 showToast={showToast}
 />

 <LabelPrintModal
 products={products}
 preselected={selectedProducts.size > 0 ? products.filter(p => selectedProducts.has(p.id)) : []}
 open={isLabelPrintOpen}
 onClose={() => setIsLabelPrintOpen(false)}
 onBarcodeAssigned={() => { onReloadData?.(); loadProducts(); }}
 />
 </PageShell>
 );
}
