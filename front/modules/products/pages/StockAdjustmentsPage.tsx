/**
 * Página de controlo de ajustes de stock
 * Lista, filtra e permite eliminar (reverter) ajustes.
 * Estrutura alinhada com Orders.tsx: PageShell, FilterBar, tabela ordenável, totais, paginação.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
 Plus,
 Trash2,
 Package,
 Edit,
 ArrowUpDown,
 ArrowUp,
 ArrowDown,
 ChevronLeft,
 ChevronRight,
 X,
} from 'lucide-react';
import { Product, StockAdjustment, StockAdjustmentReason, UserRole } from '../../core/types/types';
import { stockAdjustmentService, ADJUSTMENT_REASON_LABELS } from '../services/stockAdjustmentService';
import { StockAdjustmentModal } from '../components/modals/StockAdjustmentModal';
import { useLanguage } from '../../core/contexts/LanguageContext';
import { useAppAuth } from '../../auth/hooks/useAppAuth';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, SelectFilter, ItemsPerPageSelect } from '../../core/components/filters';
import { PeriodFilter, type PeriodOption } from '../../core/components/forms/PeriodFilter';
import { useMobile } from '../../core/hooks/useMobile';
import { getDateRangeFromPeriod, formatDateWithOptions, formatDateOnly, toDateStringInTimezone } from '../../core/utils/dateUtils';
import { useTrackAction } from '../../auth/components/TrackedPage';

type SortField = 'date' | 'productName' | 'quantity' | 'reason' | 'notes' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface StockAdjustmentsPageProps {
 products: Product[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const StockAdjustmentsPage: React.FC<StockAdjustmentsPageProps> = ({ products, showToast }) => {
 const { t } = useLanguage();
 const isMobile = useMobile(768);
 const trackAction = useTrackAction();
 const { currentUser } = useAppAuth();
 const isSuperAdmin = (currentUser as any)?.isSuperAdmin === true || currentUser?.role === UserRole.ADMIN;

 const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
 const [loading, setLoading] = useState(true);
 const [productSearch, setProductSearch] = useState('');
 const [filterReason, setFilterReason] = useState<StockAdjustmentReason | 'all'>('all');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('thisMonth');
 const [filterDateFrom, setFilterDateFrom] = useState<string>('');
 const [filterDateTo, setFilterDateTo] = useState<string>('');
 const [sortField, setSortField] = useState<SortField>('date');
 const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(12);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [deletingBulk, setDeletingBulk] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [editingAdjustment, setEditingAdjustment] = useState<StockAdjustment | null>(null);
 const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

 const loadData = async () => {
 setLoading(true);
 try {
 const list = await stockAdjustmentService.getAdjustments();
 setAdjustments(list);
 } catch (e) {
 showToast(t.stock.errorLoadingAudits || 'Erro ao carregar ajustes', 'error');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 }, []);

 const filteredAdjustments = useMemo(() => {
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 const startStr = toDateStringInTimezone(start);
 const endStr = toDateStringInTimezone(end);
 let list = adjustments.filter((a) => a.date >= startStr && a.date <= endStr);
 if (filterReason !== 'all') list = list.filter((a) => a.reason === filterReason);
 if (productSearch.trim()) {
 const q = productSearch.trim().toLowerCase();
 list = list.filter(
 (a) =>
 (a.productName || '').toLowerCase().includes(q) ||
 (a.variantName || '').toLowerCase().includes(q)
 );
 }
 return list;
 }, [adjustments, filterPeriod, filterDateFrom, filterDateTo, filterReason, productSearch]);

 const sortedAdjustments = useMemo(() => {
 const list = [...filteredAdjustments];
 list.sort((a, b) => {
 let comparison = 0;
 switch (sortField) {
 case 'date':
 comparison = a.date.localeCompare(b.date);
 break;
 case 'productName':
 comparison = (a.productName || '').localeCompare(b.productName || '');
 break;
 case 'quantity':
 comparison = a.quantity - b.quantity;
 break;
 case 'reason':
 comparison = a.reason.localeCompare(b.reason);
 break;
 case 'notes':
 comparison = (a.notes || '').localeCompare(b.notes || '');
 break;
 case 'createdAt':
 comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
 break;
 default:
 break;
 }
 return sortDirection === 'asc' ? comparison : -comparison;
 });
 return list;
 }, [filteredAdjustments, sortField, sortDirection]);

 const totalPages = Math.max(1, Math.ceil(sortedAdjustments.length / itemsPerPage));
 const paginatedAdjustments = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return sortedAdjustments.slice(start, start + itemsPerPage);
 }, [sortedAdjustments, currentPage, itemsPerPage]);

 useEffect(() => {
 setCurrentPage(1);
 setSelectedIds(new Set());
 }, [filterReason, productSearch, filterPeriod, filterDateFrom, filterDateTo]);

 const toggleSelectAll = () => {
 if (selectedIds.size === paginatedAdjustments.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(paginatedAdjustments.map((a) => a.id)));
 }
 };

 const toggleSelectRow = (id: string) => {
 const next = new Set(selectedIds);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 setSelectedIds(next);
 };

 useEffect(() => {
 setSelectedIds(new Set());
 }, [currentPage, itemsPerPage]);

 useEffect(() => {
 const el = selectAllCheckboxRef.current;
 if (el) {
 el.indeterminate =
 paginatedAdjustments.length > 0 &&
 selectedIds.size > 0 &&
 selectedIds.size < paginatedAdjustments.length;
 }
 }, [selectedIds.size, paginatedAdjustments.length]);

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
 return sortDirection === 'asc' ? (
 <ArrowUp className="w-3 h-3 text-brand-600 dark:text-brand-400" />
 ) : (
 <ArrowDown className="w-3 h-3 text-brand-600 dark:text-brand-400" />
 );
 };

 const totalsFromFiltered = useMemo(() => {
 let entries = 0;
 let exits = 0;
 for (const a of filteredAdjustments) {
 if (a.quantity >= 0) entries += a.quantity;
 else exits += Math.abs(a.quantity);
 }
 return {
 count: filteredAdjustments.length,
 entries,
 exits,
 };
 }, [filteredAdjustments]);

 const clearFilters = () => {
 setProductSearch('');
 setFilterReason('all');
 setFilterPeriod('thisMonth');
 setFilterDateFrom('');
 setFilterDateTo('');
 setCurrentPage(1);
 setSelectedIds(new Set());
 };

 const hasActiveFilters =
 productSearch.trim() !== '' ||
 filterReason !== 'all' ||
 filterPeriod !== 'thisMonth' ||
 filterDateFrom !== '' ||
 filterDateTo !== '';

 const handleDelete = async (adj: StockAdjustment) => {
 const message = t.stock.deleteAdjustmentConfirm || 'Eliminar este ajuste reverte o stock. Continuar?';
 if (!window.confirm(message)) return;
 setDeletingId(adj.id);
 try {
 const result = await stockAdjustmentService.deleteAdjustment(adj.id);
 if (result.success) {
 trackAction('delete', { entity: 'stock_adjustment', entityId: adj.id });
 showToast(t.stock.adjustmentDeleted || 'Ajuste eliminado', 'success');
 await loadData();
 } else {
 showToast(result.error || (t.stock.errorDeletingAdjustment || 'Erro ao eliminar ajuste'), 'error');
 }
 } finally {
 setDeletingId(null);
 }
 };

 const handleBulkDelete = async () => {
 if (selectedIds.size === 0) return;
 const count = selectedIds.size;
 const confirmMsg =
 t.stock.confirmDeleteAdjustments?.replace('{count}', String(count)) ||
 `Eliminar ${count} ajuste(s)? O stock será revertido para cada um. Continuar?`;
 if (!window.confirm(confirmMsg)) return;
 setDeletingBulk(true);
 try {
 trackAction('delete', { entity: 'stock_adjustment', entityIds: Array.from(selectedIds) });
 const { deletedCount, errors } = await stockAdjustmentService.deleteAdjustments(Array.from(selectedIds));
 setSelectedIds(new Set());
 await loadData();
 if (errors.length > 0) {
 showToast(
 t.stock.adjustmentsBulkDeletePartial?.replace('{deleted}', String(deletedCount)).replace('{failed}', String(errors.length)) ||
 `${deletedCount} eliminados, ${errors.length} falharam`,
 'warning'
 );
 } else {
 const msg =
 deletedCount === 1
 ? (t.stock.adjustmentDeleted || 'Ajuste eliminado')
 : (t.stock.adjustmentsBulkDeleted?.replace('{count}', String(deletedCount)) ||
 `${deletedCount} ajustes eliminados`);
 showToast(msg, 'success');
 }
 } catch (e) {
 showToast(t.stock.errorDeletingAdjustment || 'Erro ao eliminar ajustes', 'error');
 } finally {
 setDeletingBulk(false);
 }
 };

 const formatDate = (dateStr: string) => formatDateOnly(dateStr);

 const adjustmentsTitle = t.stock.adjustmentsTitle || 'Ajustes de Stock';
 const adjustmentsDescription =
 t.stock.adjustmentsDescription ||
 'Lista e controle de ajustes de stock (estragados, devoluções, correções, etc.)';
 const newAdjustmentLabel = t.stock.newAdjustment || 'Novo ajuste';
 const noAdjustmentsLabel = t.stock.noAdjustments || 'Nenhum ajuste encontrado';
 const showingLabel = t.common.showing ?? 'Mostrando';
 const ofLabel = t.common.of ?? 'de';
 const previousLabel = t.common.previous ?? 'Anterior';
 const nextLabel = t.common.next ?? 'Próxima';

 return (
 <div className="relative pb-20">
 <PageShell
 title={adjustmentsTitle}
 description={adjustmentsDescription}
 actions={
 <button
 type="button"
 onClick={() => { setEditingAdjustment(null); setShowCreateModal(true); }}
 className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-lg transition-colors"
 >
 <Plus className="w-5 h-5" />
 <span className="hidden sm:inline">{newAdjustmentLabel}</span>
 </button>
 }
 >
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <SearchInput
 value={productSearch}
 onChange={setProductSearch}
 placeholder={t.stock.productName || 'Nome do Produto'}
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />
 <div className="hidden sm:block">
 <SelectFilter
 value={filterReason}
 onChange={(val) => {
 setFilterReason(val as StockAdjustmentReason | 'all');
 setCurrentPage(1);
 }}
 ariaLabel={t.stock.adjustmentReason || 'Motivo'}
 options={[
 { value: 'all', label: t.stock.filterByReason || 'Todos os motivos' },
 ...(Object.values(StockAdjustmentReason) as StockAdjustmentReason[]).map((r) => ({
 value: r,
 label: ADJUSTMENT_REASON_LABELS[r],
 })),
 ]}
 className="flex-shrink-0"
 size="compact"
 />
 </div>
 <div className="hidden sm:block">
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[12, 24, 48, 96]}
 label=""
 size="compact"
 className="flex-shrink-0"
 />
 </div>
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
 {hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default dark:border-border-strong rounded text-content-secondary dark:text-content-secondary hover:bg-surface-base dark:hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title={t.common.clearFilters ?? 'Limpar filtros'}
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </FilterBar>

 <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
 {loading ? (
 <div className="flex justify-center py-12">
 <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
 </div>
 ) : filteredAdjustments.length === 0 ? (
 <div className="text-center py-12">
 <Package className="w-12 h-12 text-content-muted mx-auto mb-3" />
 <p className="text-content-secondary">{noAdjustmentsLabel}</p>
 <button
 type="button"
 onClick={() => setShowCreateModal(true)}
 className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
 >
 <Plus className="w-4 h-4" />
 {newAdjustmentLabel}
 </button>
 </div>
 ) : (
 <>
 {selectedIds.size > 0 && (
 <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-600/15 border-b border-border-default">
 <span className="text-sm font-medium text-brand-700 dark:text-brand-400">
 {selectedIds.size}{' '}
 {t.stock.selectedCount ?? (selectedIds.size === 1 ? 'selecionado' : 'selecionados')}
 </span>
 <button
 type="button"
 onClick={handleBulkDelete}
 disabled={deletingBulk}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
 >
 {deletingBulk ? (
 <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 <span>{t.stock.deleteSelected ?? 'Eliminar selecionados'}</span>
 </button>
 </div>
 )}
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base ">
 <tr>
 <th className="px-2 py-2 w-10 text-center text-content-primary dark:text-content-muted">
 <input
 ref={selectAllCheckboxRef}
 type="checkbox"
 aria-label={t.common.selectAll ?? 'Selecionar todos'}
 checked={
 paginatedAdjustments.length > 0 &&
 selectedIds.size === paginatedAdjustments.length
 }
 onChange={toggleSelectAll}
 className="rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[90px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'date' ? 'text-white bg-brand-600 dark:bg-brand-600/20' : 'text-content-primary dark:text-content-muted'}`}
 onClick={() => handleSort('date')}
 >
 <div className="flex items-center gap-1">
 {(t.common.date || 'DATA').toUpperCase()}
 {getSortIcon('date')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[140px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'productName' ? 'text-white bg-brand-600 dark:bg-brand-600/20' : 'text-content-primary dark:text-content-muted'}`}
 onClick={() => handleSort('productName')}
 >
 <div className="flex items-center gap-1">
 {(t.stock.productName || 'PRODUTO').toUpperCase()}
 {getSortIcon('productName')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[80px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'quantity' ? 'text-white bg-brand-600 dark:bg-brand-600/20' : 'text-content-primary dark:text-content-muted'}`}
 onClick={() => handleSort('quantity')}
 >
 <div className="flex items-center gap-1">
 {(t.stock.quantity || 'QTD').toUpperCase()}
 {getSortIcon('quantity')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[120px] cursor-pointer hover:bg-surface-base transition-colors ${sortField === 'reason' ? 'text-white bg-brand-600 dark:bg-brand-600/20' : 'text-content-primary dark:text-content-muted'}`}
 onClick={() => handleSort('reason')}
 >
 <div className="flex items-center gap-1">
 {(t.stock.adjustmentReason || 'MOTIVO').toUpperCase()}
 {getSortIcon('reason')}
 </div>
 </th>
 <th
 className={`px-3 py-2 text-left text-xs font-semibold min-w-[100px] cursor-pointer hover:bg-surface-base transition-colors hidden sm:table-cell ${sortField === 'notes' ? 'text-white bg-brand-600 dark:bg-brand-600/20' : 'text-content-primary dark:text-content-muted'}`}
 onClick={() => handleSort('notes')}
 >
 <div className="flex items-center gap-1">
 {(t.common.notes || 'NOTAS').toUpperCase()}
 {getSortIcon('notes')}
 </div>
 </th>
 <th className="px-3 py-2 text-right text-xs font-semibold min-w-[80px] text-content-primary dark:text-content-muted">
 {t.common.actions || 'AÇÕES'}
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedAdjustments.map((adj) => (
 <tr
 key={adj.id}
 className={`hover:bg-surface-base/50 ${selectedIds.has(adj.id) ? 'bg-brand-50 dark:bg-brand-600/15' : ''}`}
 >
 <td className="px-2 py-3 w-10 text-center">
 <input
 type="checkbox"
 aria-label="Selecionar linha"
 checked={selectedIds.has(adj.id)}
 onChange={() => toggleSelectRow(adj.id)}
 className="rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </td>
 <td className="px-4 py-3 text-sm font-medium text-content-primary whitespace-nowrap">
 {formatDate(adj.date)}
 </td>
 <td className="px-4 py-3 text-sm text-content-primary">
 <span>{adj.productName || '-'}</span>
 {adj.variantName && (
 <span className="block text-xs text-content-muted">
 {adj.variantName}
 </span>
 )}
 </td>
 <td className="px-4 py-3 text-sm font-medium">
 <span
 className={
 adj.quantity >= 0 ? 'text-green-600' : 'text-red-600'
 }
 >
 {adj.quantity >= 0 ? '+' : ''}
 {adj.quantity}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-content-secondary">
 {ADJUSTMENT_REASON_LABELS[adj.reason]}
 </td>
 <td
 className="px-4 py-3 text-sm text-content-secondary max-w-[200px] truncate hidden sm:table-cell"
 title={adj.notes}
 >
 {adj.notes || '-'}
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-1">
 {isSuperAdmin && (
 <button
 onClick={() => { setEditingAdjustment(adj); setShowCreateModal(true); }}
 className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
 title={t.common.edit || 'Editar'}
 >
 <Edit className="w-4 h-4" />
 </button>
 )}
 <button
 onClick={() => handleDelete(adj)}
 disabled={deletingId === adj.id}
 className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
 title={t.common.delete}
 >
 {deletingId === adj.id ? (
 <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Resumo e totais abaixo da tabela */}
 <div className="mt-4 sm:mt-6 pt-4 border-t border-border-default space-y-4">
 <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-content-secondary">
 <span>
 <span className="hidden sm:inline">{showingLabel} </span>
 <strong className="text-content-primary">{paginatedAdjustments.length}</strong>
 <span className="hidden sm:inline"> {ofLabel} </span>
 <span className="sm:hidden"> / </span>
 <strong className="text-content-primary">
 {filteredAdjustments.length}
 </strong>
 <span className="hidden sm:inline">
 {' '}
 {t.stock.adjustment || 'ajuste(s)'}
 </span>
 </span>
 {filterDateFrom && filterDateTo && (
 <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded bg-surface-base dark:bg-surface-raised">
 {formatDateWithOptions(filterDateFrom, {
 day: '2-digit',
 month: '2-digit',
 })}{' '}
 –{' '}
 {formatDateWithOptions(filterDateTo, {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric',
 })}
 </span>
 )}
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
 <div className="rounded-xl border-2 border-brand-500/50 bg-brand-500/5 dark:bg-brand-500/10 p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1">
 {t.common.total || 'Total'}
 </p>
 <p className="text-lg sm:text-xl font-bold text-brand-600 dark:text-brand-400 truncate">
 {totalsFromFiltered.count}
 </p>
 <p className="text-xs text-content-muted">
 {t.stock.adjustment || 'ajustes'}
 </p>
 </div>
 <div className="rounded-xl border border-border-default bg-surface-raised dark:bg-surface-base p-4 shadow-sm hover:shadow-md transition-shadow">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">
 {t.stock.entries || 'Entradas'}
 </p>
 <p className="text-lg sm:text-xl font-bold text-green-600 truncate">
 +{totalsFromFiltered.entries}
 </p>
 </div>
 <div className="rounded-xl border border-border-default bg-surface-raised dark:bg-surface-base p-4 shadow-sm hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
 <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-1">
 {t.stock.exits || 'Saídas'}
 </p>
 <p className="text-lg sm:text-xl font-bold text-red-600 truncate">
 -{totalsFromFiltered.exits}
 </p>
 </div>
 </div>
 </div>

 {/* Paginação */}
 {totalPages > 1 && (
 <div className="flex justify-center items-center gap-2 mt-6 pb-4">
 <button
 onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="px-3 py-2 rounded-lg border border-border-default dark:border-border-strong bg-surface-raised text-content-secondary dark:text-content-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base dark:hover:bg-surface-base flex items-center gap-1"
 >
 <ChevronLeft className="w-4 h-4" /> {previousLabel}
 </button>
 <div className="flex gap-1">
 {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
 let pageNum: number;
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
 className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
 currentPage === pageNum
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
 onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 className="px-3 py-2 rounded-lg border border-border-default dark:border-border-strong bg-surface-raised text-content-secondary dark:text-content-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base dark:hover:bg-surface-base flex items-center gap-1"
 >
 {nextLabel} <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 )}
 </>
 )}
 </div>
 </PageShell>

 <StockAdjustmentModal
 open={showCreateModal || !!editingAdjustment}
 onClose={() => { setShowCreateModal(false); setEditingAdjustment(null); }}
 products={products}
 onSuccess={() => { loadData(); setShowCreateModal(false); setEditingAdjustment(null); }}
 showToast={showToast}
 existingAdjustment={editingAdjustment}
 />
 </div>
 );
};
