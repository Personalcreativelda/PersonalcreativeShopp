/**
 * Página de visualização de lotes de stock.
 * Mostra detalhes de cada lote (quantidade, custo unitário, valor, origem) para rastreabilidade FIFO.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
 RefreshCw,
 ArrowUpDown,
 ArrowUp,
 ArrowDown,
 Layers,
 Eye,
 Edit2,
 PackageX,
 Trash2,
 ShieldCheck,
} from 'lucide-react';
import { Product } from '../../core/types/types';
import { stockLotsService, StockLotRow } from '../services/stockLotsService';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, SelectFilter, ItemsPerPageSelect, Pagination, ViewModeToggle } from '../../core/components/filters';
import { getDateRangeFromPeriod, toDateStringInTimezone, getTodayDateString } from '../../core/utils/dateUtils';
import { useMobile } from '../../core/hooks/useMobile';
import { LotDetailModal } from '../components/modals/LotDetailModal';
import { LotEditModal } from '../components/modals/LotEditModal';
import { LotIntegrityModal } from '../components/modals/LotIntegrityModal';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';

interface StockLotsPageProps {
 products: Product[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

type SortField = 'productName' | 'variantName' | 'quantity' | 'unitCost' | 'totalValue' | 'receivedAt' | 'sourceType';
type GroupBy = 'none' | 'product' | 'source' | 'date';

export const StockLotsPage: React.FC<StockLotsPageProps> = ({ products, showToast }) => {
 const isMobile = useMobile(768);
 const [lots, setLots] = useState<StockLotRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [filterSource, setFilterSource] = useState<string>('all');
 const [filterPeriod, setFilterPeriod] = useState<string>('all');
 const [filterDateFrom, setFilterDateFrom] = useState<string>('');
 const [filterDateTo, setFilterDateTo] = useState<string>('');
 const [includeConsumed, setIncludeConsumed] = useState(true);
 const [viewMode, setViewMode] = useState<'cards' | 'table'>(isMobile ? 'cards' : 'table');
 const [groupBy, setGroupBy] = useState<GroupBy>('product');
 const [sortField, setSortField] = useState<SortField>('receivedAt');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(100);
 const [viewingLot, setViewingLot] = useState<StockLotRow | null>(null);
 const [editingLot, setEditingLot] = useState<StockLotRow | null>(null);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [deletingBulk, setDeletingBulk] = useState(false);
 const [confirmBulkZero, setConfirmBulkZero] = useState<{ count: number } | null>(null);
 const [confirmBulkDelete, setConfirmBulkDelete] = useState<{ count: number } | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [editingUnitCostLotId, setEditingUnitCostLotId] = useState<string | null>(null);
 const [editingUnitCostValue, setEditingUnitCostValue] = useState<string>('');
 const [showIntegrityModal, setShowIntegrityModal] = useState(false);
 const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

 const loadData = async () => {
 setLoading(true);
 try {
 const filters: { sourceType?: string; includeConsumed?: boolean } = {};
 if (filterSource && filterSource !== 'all') filters.sourceType = filterSource;
 filters.includeConsumed = includeConsumed;
 const data = await stockLotsService.getStockLots(filters);
 setLots(data);
 } catch {
 showToast('Erro ao carregar lotes', 'error');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 }, [filterSource, includeConsumed]);

 const filteredLots = useMemo(() => {
 let result = lots;
 if (searchQuery.trim()) {
 const q = normalizeForSearch(searchQuery);
 result = result.filter(
 (l) =>
 normalizeForSearch(l.productName).includes(q) ||
 (l.variantName && normalizeForSearch(l.variantName).includes(q))
 );
 }
 if (filterPeriod && filterPeriod !== 'all') {
 let startStr: string;
 let endStr: string;
 if (filterPeriod === 'custom') {
 if (!filterDateFrom && !filterDateTo) {
 return result;
 }
 startStr = filterDateFrom || '1970-01-01';
 endStr = filterDateTo || '9999-12-31';
 } else {
 const { start, end } = getDateRangeFromPeriod(filterPeriod as any);
 startStr = toDateStringInTimezone(start);
 endStr = toDateStringInTimezone(end);
 }
 result = result.filter((l) => {
 const received = l.receivedAt ? l.receivedAt.slice(0, 10) : '';
 return received && received >= startStr && received <= endStr;
 });
 }
 return result;
 }, [lots, searchQuery, filterPeriod, filterDateFrom, filterDateTo]);

 const sortedLots = useMemo(() => {
 const list = [...filteredLots];
 list.sort((a, b) => {
 let cmp = 0;
 switch (sortField) {
 case 'productName':
 cmp = (a.productName || '').localeCompare(b.productName || '');
 break;
 case 'variantName':
 cmp = (a.variantName || '').localeCompare(b.variantName || '');
 break;
 case 'quantity':
 cmp = a.quantity - b.quantity;
 break;
 case 'unitCost':
 cmp = a.unitCost - b.unitCost;
 break;
 case 'totalValue':
 cmp = a.totalValue - b.totalValue;
 break;
 case 'receivedAt':
 cmp = (a.receivedAt || '').localeCompare(b.receivedAt || '');
 break;
 case 'sourceType':
 cmp = (a.sourceType || '').localeCompare(b.sourceType || '');
 break;
 }
 return sortDirection === 'asc' ? cmp : -cmp;
 });
 return list;
 }, [filteredLots, sortField, sortDirection]);

 const totalPages = Math.max(1, Math.ceil(sortedLots.length / itemsPerPage));
 const paginatedLots = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return sortedLots.slice(start, start + itemsPerPage);
 }, [sortedLots, currentPage, itemsPerPage]);

 const paginatedGrouped = useMemo(() => {
 if (groupBy === 'none') return [{ key: '', lots: paginatedLots }];
 const map = new Map<string, StockLotRow[]>();
 for (const lot of paginatedLots) {
 let key: string;
 if (groupBy === 'product') key = `${lot.productName ?? ''}|${lot.variantName ?? ''}`;
 else if (groupBy === 'source') key = lot.sourceType ?? 'manual';
 else if (groupBy === 'date') {
 const d = lot.receivedAt ? new Date(lot.receivedAt) : new Date();
 key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 } else key = '';
 if (!map.has(key)) map.set(key, []);
 map.get(key)!.push(lot);
 }
 return Array.from(map.entries()).map(([key, lots]) => ({ key, lots }));
 }, [paginatedLots, groupBy]);

 const totals = useMemo(() => {
 const qty = filteredLots.reduce((s, l) => s + l.quantity, 0);
 const val = filteredLots.reduce((s, l) => s + l.totalValue, 0);
 return { quantity: qty, value: val, count: filteredLots.length };
 }, [filteredLots]);

 const handleSort = (field: SortField) => {
 if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
 else {
 setSortField(field);
 setSortDirection(field === 'receivedAt' || field === 'productName' ? 'asc' : 'desc');
 }
 };

 const getSortIcon = (field: SortField) => {
 if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-content-muted opacity-50" />;
 return sortDirection === 'asc' ? (
 <ArrowUp className="w-3 h-3 text-brand-600 dark:text-brand-400" />
 ) : (
 <ArrowDown className="w-3 h-3 text-brand-600 dark:text-brand-400" />
 );
 };

 const formatDate = (s: string) => (s ? new Date(s).toLocaleDateString('pt-PT', { dateStyle: 'short' }) : '—');
 const formatMoney = (n: number) => n.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 const formatQty = (n: number) => n.toLocaleString('pt-MZ', { minimumFractionDigits: 2 });

 const toggleSelectAll = () => {
 if (selectedIds.size === paginatedLots.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(paginatedLots.map((l) => l.id)));
 }
 };

 const toggleSelectRow = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const selectConsumedOnly = () => {
 const consumed = paginatedLots.filter((l) => l.quantity === 0).map((l) => l.id);
 setSelectedIds(new Set(consumed));
 };

 useEffect(() => {
 const el = selectAllCheckboxRef.current;
 if (el) {
 el.indeterminate =
 paginatedLots.length > 0 && selectedIds.size > 0 && selectedIds.size < paginatedLots.length;
 }
 }, [selectedIds.size, paginatedLots.length]);

 useEffect(() => {
 setSelectedIds(new Set());
 }, [currentPage, itemsPerPage, filterSource, filterPeriod, filterDateFrom, filterDateTo, searchQuery, includeConsumed]);

 const handleInlineUnitCostSave = async (lot: StockLotRow) => {
 const parsed = parseFloat(editingUnitCostValue.replace(',', '.'));
 if (isNaN(parsed) || parsed < 0) {
 showToast('Custo unitário inválido', 'error');
 setEditingUnitCostLotId(null);
 return;
 }
 if (Math.abs(parsed - lot.unitCost) < 0.001) {
 setEditingUnitCostLotId(null);
 return;
 }
 setDeletingId(lot.id);
 try {
 const result = await stockLotsService.updateLot(lot.id, { unitCost: parsed });
 if (result.success) {
 showToast('Custo unitário actualizado', 'success');
 setEditingUnitCostLotId(null);
 await loadData();
 } else {
 showToast(result.error ?? 'Erro ao actualizar', 'error');
 }
 } catch {
 showToast('Erro ao actualizar custo', 'error');
 } finally {
 setDeletingId(null);
 }
 };

 const handleDeleteSingle = async (lot: StockLotRow) => {
 if (!window.confirm(`Eliminar o lote "${lot.productName} - ${lot.variantName}"? Esta acção é irreversível.`)) return;
 setDeletingId(lot.id);
 try {
 const result = await stockLotsService.deleteLot(lot.id);
 if (result.success) {
 showToast('Lote eliminado', 'success');
 await loadData();
 } else {
 showToast(result.error || 'Erro ao eliminar lote', 'error');
 }
 } catch {
 showToast('Erro ao eliminar lote', 'error');
 } finally {
 setDeletingId(null);
 }
 };

 const handleBulkDelete = async () => {
 if (!confirmBulkDelete || selectedIds.size === 0) return;
 setDeletingBulk(true);
 try {
 const ids = Array.from(selectedIds);
 const { deletedCount, errors } = await stockLotsService.deleteLots(ids);
 setSelectedIds(new Set());
 setConfirmBulkDelete(null);
 await loadData();
 if (errors.length > 0) {
 showToast(`${deletedCount} eliminado(s), ${errors.length} falharam`, 'warning');
 } else {
 showToast(
 deletedCount === 1 ? 'Lote eliminado' : `${deletedCount} lotes eliminados`,
 'success'
 );
 }
 } catch {
 showToast('Erro ao eliminar lotes', 'error');
 } finally {
 setDeletingBulk(false);
 }
 };

 const handleBulkSetZero = async () => {
 if (!confirmBulkZero || selectedIds.size === 0) return;
 setDeletingBulk(true);
 try {
 const ids = Array.from(selectedIds);
 const { updatedCount, errors } = await stockLotsService.setLotsQuantityToZero(ids);
 setSelectedIds(new Set());
 setConfirmBulkZero(null);
 await loadData();
 if (errors.length > 0) {
 showToast(
 `${updatedCount} actualizado(s), ${errors.length} falharam`,
 'warning'
 );
 } else {
 showToast(
 updatedCount === 1 ? 'Lote actualizado (stock = 0)' : `${updatedCount} lotes actualizados (stock = 0)`,
 'success'
 );
 }
 } catch {
 showToast('Erro ao actualizar lotes', 'error');
 } finally {
 setDeletingBulk(false);
 }
 };

 return (
 <div className="relative pb-20">
 <PageShell
 title="Lotes de Stock"
 description="Visualização de lotes por produto e variante — custos de compra e rastreabilidade FIFO"
 actions={
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setShowIntegrityModal(true)}
 className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
 title="Verificar integridade dos lotes"
 >
 <ShieldCheck className="w-5 h-5" />
 <span>Verificar Integridade</span>
 </button>
 <button
 type="button"
 onClick={loadData}
 disabled={loading}
 className="inline-flex items-center gap-2 px-4 py-2 bg-surface-raised hover:bg-surface-overlay border border-border-default rounded-lg transition-colors disabled:opacity-50"
 >
 <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
 <span>Atualizar</span>
 </button>
 </div>
 }
 >
 <FilterBar>
 <ViewModeToggle
 value={viewMode}
 onChange={(v) => { setViewMode(v); setCurrentPage(1); }}
 size="compact"
 />
 <div className="h-4 w-px bg-surface-base flex-shrink-0" />
 <SearchInput
 value={searchQuery}
 onChange={setSearchQuery}
 placeholder="Buscar produto ou variante..."
 size="compact"
 className="flex-1 min-w-[160px] max-w-[300px]"
 />
 <label className="flex items-center gap-1.5 px-2 py-1 text-xs border border-border-default rounded bg-surface-raised cursor-pointer whitespace-nowrap flex-shrink-0" title="Incluir lotes totalmente consumidos (quantity 0)">
 <input
 type="checkbox"
 checked={includeConsumed}
 onChange={(e) => { setIncludeConsumed(e.target.checked); setCurrentPage(1); }}
 className="rounded w-3 h-3"
 />
 <span className="text-content-secondary">Consumidos</span>
 </label>
 <SelectFilter
 value={filterPeriod}
 onChange={(v) => {
 setFilterPeriod(v);
 if (v !== 'custom') { setFilterDateFrom(''); setFilterDateTo(''); }
 setCurrentPage(1);
 }}
 ariaLabel="Período"
 options={[
 { value: 'all', label: 'Todos os períodos' },
 { value: 'today', label: 'Hoje' },
 { value: 'yesterday', label: 'Ontem' },
 { value: 'thisWeek', label: 'Esta semana' },
 { value: 'lastWeek', label: 'Semana passada' },
 { value: 'thisMonth', label: 'Este mês' },
 { value: 'lastMonth', label: 'Mês passado' },
 { value: 'thisYear', label: 'Este ano' },
 { value: 'lastYear', label: 'Ano passado' },
 { value: 'custom', label: 'Período personalizado' },
 ]}
 size="compact"
 />
 {filterPeriod === 'custom' && (
 <div className="flex items-center gap-1.5 flex-shrink-0">
 <input
 type="date"
 value={filterDateFrom}
 onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
 max={filterDateTo || getTodayDateString()}
 className="px-2 py-1 text-xs border border-border-default rounded bg-surface-raised text-content-primary"
 />
 <span className="text-xs text-content-muted">até</span>
 <input
 type="date"
 value={filterDateTo}
 onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
 min={filterDateFrom}
 max={getTodayDateString()}
 className="px-2 py-1 text-xs border border-border-default rounded bg-surface-raised text-content-primary"
 />
 </div>
 )}
 <SelectFilter
 value={filterSource}
 onChange={(v) => { setFilterSource(v); setCurrentPage(1); }}
 ariaLabel="Origem"
 options={[
 { value: 'all', label: 'Todas as origens' },
 { value: 'purchase', label: 'Compra' },
 { value: 'adjustment', label: 'Ajuste' },
 { value: 'manual', label: 'Manual' },
 { value: 'migration', label: 'Migração' },
 ]}
 size="compact"
 />
 <SelectFilter
 value={groupBy}
 onChange={(v) => { setGroupBy(v as GroupBy); setCurrentPage(1); }}
 ariaLabel="Agrupar"
 options={[
 { value: 'none', label: 'Sem agrupamento' },
 { value: 'product', label: 'Por produto' },
 { value: 'source', label: 'Por origem' },
 { value: 'date', label: 'Por data' },
 ]}
 size="compact"
 />
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
 options={[25, 50, 100, 200]}
 label=""
 size="compact"
 />
 </FilterBar>

 {loading ? (
 <div className="flex items-center justify-center py-16 text-content-muted">
 <RefreshCw className="w-8 h-8 animate-spin mr-2" />
 A carregar lotes...
 </div>
 ) : paginatedLots.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-content-muted">
 <Layers className="w-12 h-12 mb-3 opacity-50" />
 <p>Nenhum lote encontrado</p>
 </div>
 ) : (
 <>
 {selectedIds.size > 0 && (
 <div className="flex flex-wrap items-center gap-3 px-3 py-2 mb-3 bg-brand-50 dark:bg-brand-600/15 border border-brand-200 dark:border-brand-800 rounded-lg">
 <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
 {selectedIds.size} lote(s) selecionado(s)
 </span>
 <button
 type="button"
 onClick={() => setSelectedIds(new Set())}
 className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
 >
 Desmarcar todos
 </button>
 {paginatedLots.some((l) => l.quantity === 0) && (
 <button
 type="button"
 onClick={selectConsumedOnly}
 className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
 >
 Selecionar apenas consumidos
 </button>
 )}
 <button
 type="button"
 onClick={() => setConfirmBulkZero({ count: selectedIds.size })}
 disabled={deletingBulk}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors disabled:opacity-50"
 >
 {deletingBulk ? (
 <span className="inline-block w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
 ) : (
 <PackageX className="w-4 h-4" />
 )}
 <span>Definir stock a 0</span>
 </button>
 <button
 type="button"
 onClick={() => setConfirmBulkDelete({ count: selectedIds.size })}
 disabled={deletingBulk}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
 >
 {deletingBulk ? (
 <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 <span>Eliminar selecionados</span>
 </button>
 </div>
 )}
 {viewMode === 'table' ? (
 <div className="overflow-x-auto -mx-4 sm:mx-0">
 <table className="min-w-full divide-y divide-border-default">
 <thead>
 <tr>
 <th className="px-2 py-2 w-10 text-center">
 <input
 ref={selectAllCheckboxRef}
 type="checkbox"
 aria-label="Selecionar todos"
 checked={
 paginatedLots.length > 0 &&
 selectedIds.size === paginatedLots.length
 }
 onChange={toggleSelectAll}
 className="rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </th>
 <th className="px-3 py-2 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 <button type="button" onClick={() => handleSort('productName')} className="flex items-center gap-1 hover:text-content-primary">
 Produto {getSortIcon('productName')}
 </button>
 </th>
 <th className="px-3 py-2 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 <button type="button" onClick={() => handleSort('variantName')} className="flex items-center gap-1 hover:text-content-primary">
 Variante {getSortIcon('variantName')}
 </button>
 </th>
 <th className="px-3 py-2 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Origem</th>
 <th className="px-3 py-2 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
 <button type="button" onClick={() => handleSort('quantity')} className="flex items-center gap-1 hover:text-content-primary ml-auto">
 Qtd. {getSortIcon('quantity')}
 </button>
 </th>
 <th className="px-3 py-2 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
 <button type="button" onClick={() => handleSort('unitCost')} className="flex items-center gap-1 hover:text-content-primary ml-auto">
 Custo Unit. {getSortIcon('unitCost')}
 </button>
 </th>
 <th className="px-3 py-2 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
 <button type="button" onClick={() => handleSort('totalValue')} className="flex items-center gap-1 hover:text-content-primary ml-auto">
 Valor {getSortIcon('totalValue')}
 </button>
 </th>
 <th className="px-3 py-2 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 <button type="button" onClick={() => handleSort('receivedAt')} className="flex items-center gap-1 hover:text-content-primary">
 Data {getSortIcon('receivedAt')}
 </button>
 </th>
 <th className="px-3 py-2 w-24" />
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default bg-surface-base">
 {paginatedGrouped.map((group) => (
 <React.Fragment key={group.key || 'main'}>
 {group.key && (
 <tr className="bg-surface-base">
 <td colSpan={9} className="px-3 py-1.5 text-xs font-semibold text-content-secondary uppercase">
 {groupBy === 'product' && group.key.split('|')[0]}
 {groupBy === 'source' && stockLotsService.getSourceTypeLabel(group.key)}
 {groupBy === 'date' && formatDate(group.key)}
 </td>
 </tr>
 )}
 {group.lots.map((lot) => (
 <tr
 key={lot.id}
 className={`hover:bg-surface-raised/50 cursor-pointer ${selectedIds.has(lot.id) ? 'bg-brand-50 dark:bg-brand-600/15' : ''}`}
 onClick={() => setViewingLot(lot)}
 >
 <td className="px-2 py-2 w-10 text-center" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 aria-label="Selecionar lote"
 checked={selectedIds.has(lot.id)}
 onChange={() => toggleSelectRow(lot.id)}
 className="rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </td>
 <td className="px-3 py-2 text-sm text-content-primary">{lot.productName || '—'}</td>
 <td className="px-3 py-2 text-sm text-content-secondary">{lot.variantName || '—'}</td>
 <td className="px-3 py-2 text-sm text-content-secondary">
 {stockLotsService.getSourceTypeLabel(lot.sourceType)}
 {lot.invoiceNumber && <span className="ml-1 text-xs text-content-muted">({lot.invoiceNumber})</span>}
 </td>
 <td className="px-3 py-2 text-sm text-right">
 {formatQty(lot.quantity)} {lot.unit}
 {lot.quantity === 0 && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(Consumido)</span>}
 </td>
 <td
 className="px-3 py-2 text-sm text-right"
 onClick={(e) => e.stopPropagation()}
 >
 {editingUnitCostLotId === lot.id ? (
 <div className="flex items-center justify-end gap-1">
 <input
 type="text"
 value={editingUnitCostValue}
 onChange={(e) => setEditingUnitCostValue(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') handleInlineUnitCostSave(lot);
 if (e.key === 'Escape') { setEditingUnitCostLotId(null); setEditingUnitCostValue(''); }
 }}
 onBlur={() => handleInlineUnitCostSave(lot)}
 autoFocus
 className="w-20 px-2 py-0.5 text-right text-sm border border-brand-500 rounded bg-surface-raised"
 />
 <span className="text-content-muted text-xs">MTn</span>
 </div>
 ) : (
 <button
 type="button"
 onClick={() => {
 setEditingUnitCostLotId(lot.id);
 setEditingUnitCostValue(String(lot.unitCost));
 }}
 className="hover:bg-surface-raised rounded px-1 -mx-1"
 title="Clicar para editar"
 >
 {formatMoney(lot.unitCost)} MTn
 </button>
 )}
 </td>
 <td className="px-3 py-2 text-sm text-right font-medium">{formatMoney(lot.totalValue)} MTn</td>
 <td className="px-3 py-2 text-sm text-content-secondary">{formatDate(lot.receivedAt)}</td>
 <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
 <div className="flex gap-1">
 <button type="button" onClick={() => setViewingLot(lot)} className="p-1 text-content-muted hover:text-brand-600" title="Ver detalhes"><Eye className="w-4 h-4" /></button>
 <button type="button" onClick={() => setEditingLot(lot)} className="p-1 text-content-muted hover:text-brand-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
 <button type="button" onClick={() => handleDeleteSingle(lot)} disabled={deletingId === lot.id} className="p-1 text-content-muted hover:text-red-600 disabled:opacity-50" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
 </div>
 </td>
 </tr>
 ))}
 </React.Fragment>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {paginatedGrouped.map((group) => (
 <React.Fragment key={group.key || 'main'}>
 {group.key && (
 <div className="col-span-full mt-4 first:mt-0">
 <h3 className="text-sm font-semibold text-content-secondary uppercase">
 {groupBy === 'product' && group.key.split('|')[0]}
 {groupBy === 'source' && stockLotsService.getSourceTypeLabel(group.key)}
 {groupBy === 'date' && formatDate(group.key)}
 </h3>
 </div>
 )}
 {group.lots.map((lot) => (
 <div
 key={lot.id}
 className={`bg-surface-raised rounded-lg border p-4 transition-colors cursor-pointer ${
 selectedIds.has(lot.id)
 ? 'border-brand-500 dark:border-brand-400 ring-2 ring-brand-500/30'
 : 'border-border-default hover:border-brand-500/50'
 }`}
 onClick={() => setViewingLot(lot)}
 >
 <div className="flex justify-between items-start mb-2">
 <div className="flex items-start gap-2">
 <input
 type="checkbox"
 checked={selectedIds.has(lot.id)}
 onChange={(e) => { e.stopPropagation(); toggleSelectRow(lot.id); }}
 className="mt-0.5 rounded border-border-default text-brand-600 focus:ring-brand-500 shrink-0"
 onClick={(e) => e.stopPropagation()}
 />
 <div>
 <p className="font-medium text-content-primary">{lot.productName || '—'}</p>
 <p className="text-sm text-content-secondary">{lot.variantName || '—'}</p>
 </div>
 </div>
 <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
 <button type="button" onClick={() => setViewingLot(lot)} className="p-1 text-content-muted hover:text-brand-600" title="Ver detalhes"><Eye className="w-4 h-4" /></button>
 <button type="button" onClick={() => setEditingLot(lot)} className="p-1 text-content-muted hover:text-brand-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
 <button type="button" onClick={() => handleDeleteSingle(lot)} disabled={deletingId === lot.id} className="p-1 text-content-muted hover:text-red-600 disabled:opacity-50" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
 </div>
 </div>
 <p className="text-xs text-content-muted mb-1">{stockLotsService.getSourceTypeLabel(lot.sourceType)}{lot.invoiceNumber ? ` • ${lot.invoiceNumber}` : ''}</p>
 <p className="text-sm">{formatQty(lot.quantity)} {lot.unit} {lot.quantity === 0 && <span className="text-amber-600 dark:text-amber-400">(Consumido)</span>}</p>
 <p className="text-sm">
 {editingUnitCostLotId === lot.id ? (
 <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
 <input
 type="text"
 value={editingUnitCostValue}
 onChange={(e) => setEditingUnitCostValue(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') handleInlineUnitCostSave(lot);
 if (e.key === 'Escape') { setEditingUnitCostLotId(null); setEditingUnitCostValue(''); }
 }}
 onBlur={() => handleInlineUnitCostSave(lot)}
 autoFocus
 className="w-20 px-2 py-0.5 text-right text-sm border border-brand-500 rounded bg-surface-raised"
 />
 <span className="text-content-muted text-xs">MTn</span>
 </div>
 ) : (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setEditingUnitCostLotId(lot.id); setEditingUnitCostValue(String(lot.unitCost)); }}
 className="hover:bg-surface-raised rounded px-1 -mx-1 text-left"
 title="Clicar para editar"
 >
 Custo: {formatMoney(lot.unitCost)} MTn
 </button>
 )}
 </p>
 <p className="font-medium text-green-600 dark:text-green-400">{formatMoney(lot.totalValue)} MTn</p>
 <p className="text-xs text-content-muted mt-1">{formatDate(lot.receivedAt)}</p>
 </div>
 ))}
 </React.Fragment>
 ))}
 </div>
 )}

 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-border-default">
 <div className="text-sm text-content-muted">
 Total: {totals.count} lote(s) — {formatQty(totals.quantity)} un — {formatMoney(totals.value)} MTn
 </div>
 <Pagination
 currentPage={currentPage}
 totalItems={sortedLots.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setCurrentPage}
 />
 </div>
 </>
 )}
 </PageShell>

 <LotDetailModal
 open={!!viewingLot}
 lot={viewingLot}
 onClose={() => setViewingLot(null)}
 onEdit={(lot) => { setViewingLot(null); setEditingLot(lot); }}
 />
 <LotIntegrityModal
 open={showIntegrityModal}
 onClose={() => setShowIntegrityModal(false)}
 showToast={showToast}
 onRefresh={loadData}
 />
 <LotEditModal
 open={!!editingLot}
 lot={editingLot}
 onClose={() => setEditingLot(null)}
 onSaved={loadData}
 showToast={showToast}
 />
 <ConfirmDialog
 isOpen={!!confirmBulkZero}
 title="Definir stock a 0"
 message={
 confirmBulkZero
 ? `Definir a quantidade de ${confirmBulkZero.count} lote(s) para 0? Os lotes ficarão marcados como consumidos.`
 : ''
 }
 confirmText="Definir a 0"
 cancelText="Cancelar"
 variant="warning"
 onConfirm={handleBulkSetZero}
 onCancel={() => setConfirmBulkZero(null)}
 />
 <ConfirmDialog
 isOpen={!!confirmBulkDelete}
 title="Eliminar lotes"
 message={
 confirmBulkDelete
 ? `Eliminar ${confirmBulkDelete.count} lote(s)? Esta acção é irreversível e remove os lotes permanentemente.`
 : ''
 }
 confirmText="Eliminar"
 cancelText="Cancelar"
 variant="danger"
 onConfirm={handleBulkDelete}
 onCancel={() => setConfirmBulkDelete(null)}
 />
 </div>
 );
};
