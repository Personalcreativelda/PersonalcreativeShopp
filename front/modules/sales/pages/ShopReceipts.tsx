import React, { useState, useMemo, useEffect } from 'react';
import { ShopReceipt, ShopReceiptItem, ShopReceiptSource, Product, FactoryOutput } from '../../core/types/types';
import {
 Package, Plus, Edit2, Trash2, Search, Filter, Calendar, FileSpreadsheet,
 FileText, X, Save, AlertTriangle, CheckCircle, ArrowRight, RefreshCw
} from 'lucide-react';
import { dataService } from '../../core/services/dataService';
import { Toast } from '../../core/components/ui/Toast';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, ViewModeToggle, ItemsPerPageSelect } from '../../core/components/filters';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { useMobile } from '../../core/hooks/useMobile';
import { createWorkbook, addWorksheet, addRowsFromJson, writeWorkbookToFile } from '../../core/services/excelService';
import { formatDateTimeForReport, formatDateOnly, getTodayDateString } from '../../core/utils/dateUtils';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import jsPDF from 'jspdf';

interface ShopReceiptsProps {
 products: Product[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

export const ShopReceipts: React.FC<ShopReceiptsProps> = ({ products, showToast }) => {
 const isMobile = useMobile(768);
 const [receipts, setReceipts] = useState<ShopReceipt[]>([]);
 const [factoryOutputs, setFactoryOutputs] = useState<FactoryOutput[]>([]);
 const [loading, setLoading] = useState(false);
 const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');

 // Filters
 const [searchQuery, setSearchQuery] = useState('');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('thisMonth');
 const [filterDateFrom, setFilterDateFrom] = useState<string>('');
 const [filterDateTo, setFilterDateTo] = useState<string>('');
 const [filterStatus, setFilterStatus] = useState<string>('ALL');
 const [filterSource, setFilterSource] = useState<string>('ALL');
 const [showFilters, setShowFilters] = useState(false);

 // Pagination
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(12);

 // Modal
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingReceipt, setEditingReceipt] = useState<ShopReceipt | null>(null);
 const [newReceipt, setNewReceipt] = useState({
 date: getTodayDateString(),
 reference: '',
 source: 'FORNECEDOR' as ShopReceiptSource,
 supplierId: '',
 supplierName: '',
 receivedBy: '',
 invoiceNumber: '',
 notes: '',
 status: 'pending' as 'pending' | 'completed' | 'cancelled'
 });
 const [receiptItems, setReceiptItems] = useState<ShopReceiptItem[]>([]);
 const [newItem, setNewItem] = useState({
 productId: '',
 productName: '',
 variantId: '',
 variantName: '',
 quantity: '',
 unit: '',
 costPrice: '',
 sellingPrice: '',
 notes: ''
 });

 const [confirmDialog, setConfirmDialog] = useState({
 isOpen: false,
 message: '',
 onConfirm: () => { },
 variant: 'warning' as 'danger' | 'warning' | 'info'
 });

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 setLoading(true);
 try {
 const [receiptsData, outputsData] = await Promise.all([
 dataService.getShopReceipts(),
 dataService.getFactoryOutputs()
 ]);
 setReceipts(receiptsData);
 setFactoryOutputs(outputsData);
 } catch (error) {
 console.error('Erro ao carregar dados:', error);
 showToast('Erro ao carregar dados', 'error');
 } finally {
 setLoading(false);
 }
 };

 const getDateRangeFromPeriod = (period: PeriodOption, customStart?: string, customEnd?: string): { start: Date; end: Date } => {
 const today = new Date();
 today.setHours(23, 59, 59, 999);

 if (period === 'today') {
 const start = new Date(today);
 start.setHours(0, 0, 0, 0);
 return { start, end: today };
 }
 if (period === 'yesterday') {
 const start = new Date(today);
 start.setDate(start.getDate() - 1);
 start.setHours(0, 0, 0, 0);
 const end = new Date(start);
 end.setHours(23, 59, 59, 999);
 return { start, end };
 }
 if (period === 'thisWeek') {
 const start = new Date(today);
 start.setDate(start.getDate() - start.getDay());
 start.setHours(0, 0, 0, 0);
 return { start, end: today };
 }
 if (period === 'lastWeek') {
 const end = new Date(today);
 end.setDate(end.getDate() - end.getDay() - 1);
 end.setHours(23, 59, 59, 999);
 const start = new Date(end);
 start.setDate(start.getDate() - 6);
 start.setHours(0, 0, 0, 0);
 return { start, end };
 }
 if (period === 'thisMonth') {
 const start = new Date(today.getFullYear(), today.getMonth(), 1);
 start.setHours(0, 0, 0, 0);
 return { start, end: today };
 }
 if (period === 'lastMonth') {
 const end = new Date(today.getFullYear(), today.getMonth(), 0);
 end.setHours(23, 59, 59, 999);
 const start = new Date(end.getFullYear(), end.getMonth(), 1);
 start.setHours(0, 0, 0, 0);
 return { start, end };
 }
 if (period === 'thisYear') {
 const start = new Date(today.getFullYear(), 0, 1);
 start.setHours(0, 0, 0, 0);
 return { start, end: today };
 }
 if (period === 'lastYear') {
 const start = new Date(today.getFullYear() - 1, 0, 1);
 start.setHours(0, 0, 0, 0);
 const end = new Date(today.getFullYear() - 1, 11, 31);
 end.setHours(23, 59, 59, 999);
 return { start, end };
 }
 if (period === 'custom' && customStart && customEnd) {
 const start = new Date(customStart);
 start.setHours(0, 0, 0, 0);
 const end = new Date(customEnd);
 end.setHours(23, 59, 59, 999);
 return { start, end };
 }
 // Fallback: este mês
 const start = new Date(today.getFullYear(), today.getMonth(), 1);
 start.setHours(0, 0, 0, 0);
 return { start, end: today };
 };

 const filteredReceipts = useMemo(() => {
 let filtered = [...receipts];

 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filtered = filtered.filter(r =>
 (r.reference && normalizeForSearch(r.reference).includes(query)) ||
 (r.receivedBy && normalizeForSearch(r.receivedBy).includes(query)) ||
 (r.supplierName && normalizeForSearch(r.supplierName).includes(query)) ||
 (r.notes && normalizeForSearch(r.notes).includes(query)) ||
 r.items.some(item => normalizeForSearch(item.productName).includes(query))
 );
 }

 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 filtered = filtered.filter(r => {
 const receiptDate = new Date(r.date);
 receiptDate.setHours(0, 0, 0, 0);
 return receiptDate >= start && receiptDate <= end;
 });

 if (filterStatus !== 'ALL') {
 filtered = filtered.filter(r => r.status === filterStatus);
 }

 if (filterSource !== 'ALL') {
 filtered = filtered.filter(r => r.source === filterSource);
 }

 filtered.sort((a, b) => {
 const dateA = new Date(a.date).getTime();
 const dateB = new Date(b.date).getTime();
 return dateB - dateA;
 });

 return filtered;
 }, [receipts, searchQuery, filterPeriod, filterDateFrom, filterDateTo, filterStatus, filterSource]);

 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, filterPeriod, filterDateFrom, filterDateTo, filterStatus, filterSource]);

 const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
 const paginatedReceipts = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredReceipts.slice(start, start + itemsPerPage);
 }, [filteredReceipts, currentPage, itemsPerPage]);

 const handleOpenModal = (receipt?: ShopReceipt) => {
 if (receipt) {
 setEditingReceipt(receipt);
 setNewReceipt({
 date: receipt.date,
 reference: receipt.reference || '',
 source: receipt.source,
 supplierId: receipt.supplierId || '',
 supplierName: receipt.supplierName || '',
 factoryOutputId: receipt.factoryOutputId || '',
 receivedBy: receipt.receivedBy,
 invoiceNumber: receipt.invoiceNumber || '',
 notes: receipt.notes || '',
 status: receipt.status
 });
 setReceiptItems([...receipt.items]);
 } else {
 setEditingReceipt(null);
 setNewReceipt({
 date: getTodayDateString(),
 reference: '',
 source: 'FABRICA',
 supplierId: '',
 supplierName: '',
 factoryOutputId: '',
 receivedBy: '',
 invoiceNumber: '',
 notes: '',
 status: 'pending'
 });
 setReceiptItems([]);
 }
 setIsModalOpen(true);
 };

 const handleAddItem = () => {
 if (!newItem.productName || !newItem.quantity || !newItem.unit) {
 showToast('Preencha nome do produto, quantidade e unidade', 'warning');
 return;
 }

 const item: ShopReceiptItem = {
 productId: newItem.productId || undefined,
 productName: newItem.productName,
 variantId: newItem.variantId || undefined,
 variantName: newItem.variantName || undefined,
 quantity: parseFloat(newItem.quantity),
 unit: newItem.unit,
 costPrice: newItem.costPrice ? parseFloat(newItem.costPrice) : undefined,
 sellingPrice: newItem.sellingPrice ? parseFloat(newItem.sellingPrice) : undefined,
 source: newItem.source,
 factoryOutputId: newItem.factoryOutputId || undefined,
 notes: newItem.notes || undefined
 };

 setReceiptItems([...receiptItems, item]);
 setNewItem({
 productId: '',
 productName: '',
 variantId: '',
 variantName: '',
 quantity: '',
 unit: '',
 costPrice: '',
 sellingPrice: '',
 source: newReceipt.source,
 factoryOutputId: '',
 notes: ''
 });
 };

 const handleRemoveItem = (index: number) => {
 setReceiptItems(receiptItems.filter((_, i) => i !== index));
 };

 const handleSaveReceipt = async () => {
 if (!newReceipt.receivedBy) {
 showToast('Informe quem recebeu', 'warning');
 return;
 }
 if (receiptItems.length === 0) {
 showToast('Adicione pelo menos um item', 'warning');
 return;
 }

 const totalItems = receiptItems.reduce((sum, item) => sum + item.quantity, 0);
 const totalCost = receiptItems.reduce((sum, item) => sum + (item.costPrice || 0) * item.quantity, 0);
 const totalValue = receiptItems.reduce((sum, item) => sum + (item.sellingPrice || 0) * item.quantity, 0);

 const receipt: ShopReceipt = {
 id: editingReceipt?.id || '',
 date: newReceipt.date,
 reference: newReceipt.reference || undefined,
 source: newReceipt.source,
 supplierId: newReceipt.supplierId || undefined,
 supplierName: newReceipt.supplierName || undefined,
 factoryOutputId: newReceipt.factoryOutputId || undefined,
 items: receiptItems,
 totalItems,
 totalCost,
 totalValue: totalValue > 0 ? totalValue : undefined,
 receivedBy: newReceipt.receivedBy,
 invoiceNumber: newReceipt.invoiceNumber || undefined,
 notes: newReceipt.notes || undefined,
 status: newReceipt.status,
 createdAt: editingReceipt?.createdAt || new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 createdBy: editingReceipt?.createdBy
 };

 try {
 if (editingReceipt) {
 const success = await dataService.updateShopReceipt(editingReceipt.id, receipt);
 if (success) {
 showToast('Recebimento atualizado com sucesso', 'success');
 setIsModalOpen(false);
 loadData();
 } else {
 showToast('Erro ao atualizar recebimento', 'error');
 }
 } else {
 const result = await dataService.createShopReceipt(receipt);
 if (result.receipt) {
 showToast('Recebimento criado com sucesso', 'success');
 setIsModalOpen(false);
 loadData();
 } else {
 showToast(result.error || 'Erro ao criar recebimento', 'error');
 }
 }
 } catch (error: any) {
 console.error('Erro ao salvar recebimento:', error);
 showToast('Erro ao salvar recebimento', 'error');
 }
 };

 const handleDeleteReceipt = (id: string) => {
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja excluir este recebimento?',
 onConfirm: async () => {
 try {
 const success = await dataService.deleteShopReceipt(id);
 if (success) {
 showToast('Recebimento exclué­do com sucesso', 'success');
 loadData();
 } else {
 showToast('Erro ao excluir recebimento', 'error');
 }
 } catch (error) {
 console.error('Erro ao excluir recebimento:', error);
 showToast('Erro ao excluir recebimento', 'error');
 }
 setConfirmDialog({ ...confirmDialog, isOpen: false });
 },
 variant: 'danger'
 });
 };

 const handleLoadFromFactoryOutput = (outputId: string) => {
 const output = factoryOutputs.find(o => o.id === outputId);
 if (!output) return;

 setNewReceipt({
 ...newReceipt,
 source: 'FABRICA',
 factoryOutputId: outputId,
 date: output.date,
 reference: output.reference || ''
 });

 const items: ShopReceiptItem[] = output.items.map(item => ({
 productId: item.productId,
 productName: item.productName,
 variantId: item.variantId,
 variantName: item.variantName,
 quantity: item.quantity,
 unit: item.unit,
 costPrice: item.costPrice,
 sellingPrice: item.sellingPrice,
 source: 'FABRICA',
 factoryOutputId: outputId
 }));

 setReceiptItems(items);
 showToast('Itens carregados da saé­da da fé¡brica', 'success');
 };

 const exportToExcel = async () => {
 try {
 if (filteredReceipts.length === 0) {
 showToast('Néo hé¡ dados para exportar', 'warning');
 return;
 }

 const exportData = filteredReceipts.flatMap(receipt =>
 receipt.items.map(item => ({
 'Data': receipt.date,
 'Referéªncia': receipt.reference || '',
 'Origem': receipt.source,
 'Fornecedor': receipt.supplierName || '',
 'Recebido por': receipt.receivedBy,
 'Produto': item.productName,
 'Variaçéo': item.variantName || '',
 'Quantidade': item.quantity,
 'Unidade': item.unit,
 'Preço Custo': item.costPrice || 0,
 'Preço Venda': item.sellingPrice || 0,
 'Status': receipt.status,
 'Observaçéµes': receipt.notes || ''
 }))
 );

 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Recebimentos');
 addRowsFromJson(ws, exportData as Record<string, unknown>[]);
 [12, 15, 12, 20, 15, 25, 15, 12, 8, 12, 12, 10, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 const periodLabel = filterPeriod === 'custom'
 ? `${filterDateFrom}_${filterDateTo}`
 : filterPeriod;
 const filename = `recebimentos_${periodLabel}_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportaçéo conclué­da: ${filteredReceipts.length} recebimentos`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };

 const exportToPDF = async () => {
 try {
 if (filteredReceipts.length === 0) {
 showToast('Néo hé¡ dados para exportar', 'warning');
 return;
 }

 showToast('Gerando PDF...', 'info');
 const pdf = new jsPDF('l', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;
 let yPos = margin;

 pdf.setFontSize(16);
 pdf.setFont('helvetica', 'bold');
 pdf.text('Relaté³rio de Recebimentos - Loja', pdfWidth / 2, yPos, { align: 'center' });
 yPos += 8;

 pdf.setFontSize(10);
 pdf.setFont('helvetica', 'normal');
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 pdf.text(`Peré­odo: ${formatDateOnly(start)} a ${formatDateOnly(end)}`, pdfWidth / 2, yPos, { align: 'center' });
 yPos += 8;

 const headers = ['Data', 'Ref', 'Origem', 'Produto', 'Qtd', 'Un', 'Custo', 'Status'];
 const colWidths = [25, 20, 20, 50, 15, 10, 20, 20];
 let xPos = margin;

 pdf.setFontSize(8);
 pdf.setFont('helvetica', 'bold');
 headers.forEach((header, i) => {
 pdf.text(header, xPos, yPos);
 xPos += colWidths[i];
 });
 yPos += 6;

 pdf.setFont('helvetica', 'normal');
 filteredReceipts.forEach(receipt => {
 receipt.items.forEach(item => {
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 xPos = margin;
 pdf.setFont('helvetica', 'bold');
 headers.forEach((header, i) => {
 pdf.text(header, xPos, yPos);
 xPos += colWidths[i];
 });
 yPos += 6;
 pdf.setFont('helvetica', 'normal');
 }

 xPos = margin;
 pdf.text(receipt.date, xPos, yPos);
 xPos += colWidths[0];
 pdf.text(receipt.reference || '', xPos, yPos);
 xPos += colWidths[1];
 pdf.text(receipt.source, xPos, yPos);
 xPos += colWidths[2];
 pdf.text(item.productName, xPos, yPos);
 xPos += colWidths[3];
 pdf.text(item.quantity.toString(), xPos, yPos);
 xPos += colWidths[4];
 pdf.text(item.unit, xPos, yPos);
 xPos += colWidths[5];
 pdf.text((item.costPrice || 0).toFixed(2), xPos, yPos);
 xPos += colWidths[6];
 pdf.text(receipt.status, xPos, yPos);
 yPos += 6;
 });
 });

 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 pdf.setFontSize(8);
 pdf.text(
 `Pé¡gina ${i} de ${totalPages} - ${formatDateTimeForReport(new Date())}`,
 pdfWidth / 2,
 pdfHeight - 5,
 { align: 'center' }
 );
 }

 const filename = `recebimentos_${filterPeriod}_${getTodayDateString()}.pdf`;
 pdf.save(filename);
 showToast(`PDF gerado: ${filteredReceipts.length} recebimentos`, 'success');
 } catch (error: any) {
 console.error('Erro ao gerar PDF:', error);
 showToast('Erro ao gerar PDF', 'error');
 }
 };

 const pendingOutputs = factoryOutputs.filter(o =>
 o.destination === 'LOJA' &&
 o.status === 'completed' &&
 !receipts.some(r => r.factoryOutputId === o.id)
 );

 return (
 <PageShell
 title="Recebimentos da Loja"
 actions={
 <div className="flex items-center gap-2">
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
 onClick={() => handleOpenModal()}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 >
 <Plus className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Novo Recebimento</span>
 </button>
 {isMobile && (
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${showFilters || searchQuery || filterPeriod !== 'thisMonth' || filterStatus !== 'ALL' || filterSource !== 'ALL'
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-gray-600 hover:bg-border-strong text-white'
 }`}
 >
 <Filter className="w-5 h-5" />
 {(searchQuery || filterPeriod !== 'thisMonth' || filterStatus !== 'ALL' || filterSource !== 'ALL') && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {[searchQuery, filterPeriod !== 'thisMonth' ? 1 : 0, filterStatus !== 'ALL' ? 1 : 0, filterSource !== 'ALL' ? 1 : 0].filter(Boolean).length}
 </span>
 )}
 </button>
 )}
 </div>
 }
 >
 {pendingOutputs.length > 0 && (
 <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
 <div className="flex items-center gap-2 mb-2">
 <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
 <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
 {pendingOutputs.length} Saé­da(s) da Fé¡brica aguardando recebimento
 </h3>
 </div>
 <div className="space-y-2">
 {pendingOutputs.slice(0, 3).map(output => (
 <div key={output.id} className="flex items-center justify-between text-sm">
 <span className="text-yellow-800 dark:text-yellow-300">
 {output.date} - {output.reference || 'Sem referéªncia'} ({output.totalItems} itens)
 </span>
 <button
 onClick={() => {
 handleLoadFromFactoryOutput(output.id);
 handleOpenModal();
 }}
 className="text-brand-600 hover:text-brand-700 font-medium"
 >
 Receber
 </button>
 </div>
 ))}
 </div>
 </div>
 )}

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
 placeholder="Buscar recebimentos..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />
 <div className="hidden sm:block">
 <select
 value={filterStatus}
 onChange={(e) => {
 setFilterStatus(e.target.value);
 setCurrentPage(1);
 }}
 className="px-3 py-1.5 text-xs border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="ALL">Todos Status</option>
 <option value="pending">Pendente</option>
 <option value="completed">Conclué­do</option>
 <option value="cancelled">Cancelado</option>
 </select>
 </div>
 <div className="hidden sm:block">
 <select
 value={filterSource}
 onChange={(e) => {
 setFilterSource(e.target.value);
 setCurrentPage(1);
 }}
 className="px-3 py-1.5 text-xs border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="ALL">Todas Origens</option>
 <option value="FABRICA">Fé¡brica</option>
 <option value="FORNECEDOR">Fornecedor</option>
 <option value="OUTRO">Outro</option>
 </select>
 </div>
 <div className="hidden sm:block">
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[6, 12, 24, 48, 96]}
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
 {(searchQuery || filterPeriod !== 'thisMonth' || filterStatus !== 'ALL' || filterSource !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterPeriod('thisMonth');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterStatus('ALL');
 setFilterSource('ALL');
 setCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </FilterBar>

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
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">Status</label>
 <select
 value={filterStatus}
 onChange={(e) => {
 setFilterStatus(e.target.value);
 setCurrentPage(1);
 }}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 >
 <option value="ALL">Todos</option>
 <option value="pending">Pendente</option>
 <option value="completed">Conclué­do</option>
 <option value="cancelled">Cancelado</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">Origem</label>
 <select
 value={filterSource}
 onChange={(e) => {
 setFilterSource(e.target.value);
 setCurrentPage(1);
 }}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 >
 <option value="ALL">Todas</option>
 <option value="FABRICA">Fé¡brica</option>
 <option value="FORNECEDOR">Fornecedor</option>
 <option value="OUTRO">Outro</option>
 </select>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">Peré­odo</label>
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
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-2">Itens por pé¡gina</label>
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[6, 12, 24, 48, 96]}
 label=""
 size="md"
 className="w-full"
 />
 </div>
 {(searchQuery || filterPeriod !== 'thisMonth' || filterStatus !== 'ALL' || filterSource !== 'ALL') && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterPeriod('thisMonth');
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterStatus('ALL');
 setFilterSource('ALL');
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

 {loading ? (
 <div className="flex justify-center items-center py-12">
 <RefreshCw className="w-8 h-8 animate-spin text-content-muted" />
 </div>
 ) : paginatedReceipts.length === 0 ? (
 <div className="text-center py-12 text-content-muted">
 <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
 <p>Nenhum recebimento encontrado</p>
 </div>
 ) : viewMode === 'grid' ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {paginatedReceipts.map(receipt => (
 <div key={receipt.id} className="bg-surface-raised rounded-lg border border-border-default p-4 shadow-sm">
 <div className="flex items-start justify-between mb-3">
 <div>
 <h3 className="font-semibold text-content-primary">{receipt.date}</h3>
 {receipt.reference && (
 <p className="text-xs text-content-muted">Ref: {receipt.reference}</p>
 )}
 </div>
 <span className={`px-2 py-1 text-xs rounded-full ${receipt.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
 receipt.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
 }`}>
 {receipt.status === 'completed' ? 'Conclué­do' : receipt.status === 'pending' ? 'Pendente' : 'Cancelado'}
 </span>
 </div>
 <div className="space-y-2 mb-3">
 <p className="text-sm text-content-secondary">
 <span className="font-medium">Origem:</span> {receipt.source}
 </p>
 <p className="text-sm text-content-secondary">
 <span className="font-medium">Recebido por:</span> {receipt.receivedBy}
 </p>
 <p className="text-sm text-content-secondary">
 <span className="font-medium">Itens:</span> {receipt.totalItems}
 </p>
 {receipt.totalCost > 0 && (
 <p className="text-sm text-content-secondary">
 <span className="font-medium">Custo Total:</span> {receipt.totalCost.toFixed(2)} MZN
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleOpenModal(receipt)}
 className="flex-1 px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
 >
 <Edit2 className="w-3 h-3" />
 Editar
 </button>
 <button
 onClick={() => handleDeleteReceipt(receipt.id)}
 className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="overflow-auto max-h-[calc(100vh-280px)] rounded-lg border border-border-default">
 <table className="w-full border-collapse">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Data</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Referéªncia</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Origem</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Itens</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Custo Total</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Recebido por</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Status</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">Açéµes</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedReceipts.map(receipt => (
 <tr key={receipt.id} className="hover:bg-surface-base">
 <td className="px-4 py-3 text-sm text-content-primary">{receipt.date}</td>
 <td className="px-4 py-3 text-sm text-content-secondary">{receipt.reference || '-'}</td>
 <td className="px-4 py-3 text-sm text-content-secondary">{receipt.source}</td>
 <td className="px-4 py-3 text-sm text-content-secondary">{receipt.totalItems}</td>
 <td className="px-4 py-3 text-sm text-content-secondary">
 {receipt.totalCost > 0 ? `${receipt.totalCost.toFixed(2)} MZN` : '-'}
 </td>
 <td className="px-4 py-3 text-sm text-content-secondary">{receipt.receivedBy}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 text-xs rounded-full ${receipt.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
 receipt.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
 }`}>
 {receipt.status === 'completed' ? 'Conclué­do' : receipt.status === 'pending' ? 'Pendente' : 'Cancelado'}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleOpenModal(receipt)}
 className="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
 title="Editar"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDeleteReceipt(receipt.id)}
 className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Excluir"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {totalPages > 1 && (
 <div className="flex justify-center items-center gap-2 mt-6">
 <button
 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="px-3 py-1.5 text-sm border border-border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="text-sm text-content-secondary">
 Pé¡gina {currentPage} de {totalPages}
 </span>
 <button
 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 className="px-3 py-1.5 text-sm border border-border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 )}

 {isModalOpen && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50 p-4">
 <div className="bg-surface-raised rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
 <div className="sticky top-0 bg-surface-raised border-b border-border-default p-4 flex items-center justify-between">
 <h2 className="text-xl font-bold text-content-primary">
 {editingReceipt ? 'Editar Recebimento' : 'Novo Recebimento'}
 </h2>
 <button
 onClick={() => setIsModalOpen(false)}
 className="p-1 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="p-6 space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data *</label>
 <input
 type="date"
 value={newReceipt.date}
 onChange={(e) => setNewReceipt({ ...newReceipt, date: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Referéªncia</label>
 <input
 type="text"
 value={newReceipt.reference}
 onChange={(e) => setNewReceipt({ ...newReceipt, reference: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 placeholder="Néºmero do documento"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Origem *</label>
 <select
 value={newReceipt.source}
 onChange={(e) => {
 setNewReceipt({ ...newReceipt, source: e.target.value as any });
 setNewItem({ ...newItem, source: e.target.value as any });
 }}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="FABRICA">Fé¡brica</option>
 <option value="FORNECEDOR">Fornecedor</option>
 <option value="OUTRO">Outro</option>
 </select>
 </div>
 {newReceipt.source === 'FABRICA' && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Saé­da da Fé¡brica</label>
 <select
 value={newReceipt.factoryOutputId}
 onChange={(e) => {
 const outputId = e.target.value;
 setNewReceipt({ ...newReceipt, factoryOutputId: outputId });
 if (outputId) {
 handleLoadFromFactoryOutput(outputId);
 }
 }}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="">Selecione uma saé­da</option>
 {factoryOutputs.filter(o => o.destination === 'LOJA').map(output => (
 <option key={output.id} value={output.id}>
 {output.date} - {output.reference || 'Sem referéªncia'} ({output.totalItems} itens)
 </option>
 ))}
 </select>
 </div>
 )}
 {newReceipt.source === 'FORNECEDOR' && (
 <>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Fornecedor</label>
 <input
 type="text"
 value={newReceipt.supplierName}
 onChange={(e) => setNewReceipt({ ...newReceipt, supplierName: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 placeholder="Nome do fornecedor"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Néºmero da Fatura</label>
 <input
 type="text"
 value={newReceipt.invoiceNumber}
 onChange={(e) => setNewReceipt({ ...newReceipt, invoiceNumber: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 placeholder="Néºmero da fatura"
 />
 </div>
 </>
 )}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Recebido por *</label>
 <input
 type="text"
 value={newReceipt.receivedBy}
 onChange={(e) => setNewReceipt({ ...newReceipt, receivedBy: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 placeholder="Nome da pessoa"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Status</label>
 <select
 value={newReceipt.status}
 onChange={(e) => setNewReceipt({ ...newReceipt, status: e.target.value as any })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 >
 <option value="pending">Pendente</option>
 <option value="completed">Conclué­do</option>
 <option value="cancelled">Cancelado</option>
 </select>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Observaçéµes</label>
 <textarea
 value={newReceipt.notes}
 onChange={(e) => setNewReceipt({ ...newReceipt, notes: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 rows={3}
 placeholder="Observaçéµes adicionais"
 />
 </div>

 <div className="border-t border-border-default pt-4">
 <h3 className="text-sm font-semibold text-content-primary mb-3">Itens do Recebimento</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Produto *</label>
 <input
 type="text"
 value={newItem.productName}
 onChange={(e) => setNewItem({ ...newItem, productName: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 placeholder="Nome do produto"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Variaçéo</label>
 <input
 type="text"
 value={newItem.variantName}
 onChange={(e) => setNewItem({ ...newItem, variantName: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 placeholder="Variaçéo (opcional)"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Quantidade *</label>
 <input
 type="number"
 step="0.01"
 value={newItem.quantity}
 onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 placeholder="0"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Unidade *</label>
 <input
 type="text"
 value={newItem.unit}
 onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 placeholder="kg, un, etc"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Preço de Custo</label>
 <input
 type="number"
 step="0.01"
 value={newItem.costPrice}
 onChange={(e) => setNewItem({ ...newItem, costPrice: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 placeholder="0.00"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Preço de Venda</label>
 <input
 type="number"
 step="0.01"
 value={newItem.sellingPrice}
 onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised"
 placeholder="0.00"
 />
 </div>
 </div>
 <button
 onClick={handleAddItem}
 className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Adicionar Item
 </button>
 </div>

 {receiptItems.length > 0 && (
 <div className="border-t border-border-default pt-4">
 <div className="space-y-2">
 {receiptItems.map((item, index) => (
 <div key={index} className="flex items-center justify-between p-3 bg-surface-base rounded-lg">
 <div className="flex-1">
 <p className="font-medium text-sm text-content-primary">
 {item.productName} {item.variantName && `- ${item.variantName}`}
 </p>
 <p className="text-xs text-content-secondary">
 {item.quantity} {item.unit}
 {item.costPrice && ` â€¢ ${item.costPrice.toFixed(2)} MZN`}
 </p>
 </div>
 <button
 onClick={() => handleRemoveItem(index)}
 className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 ))}
 </div>
 <div className="mt-3 p-3 bg-brand-50 dark:bg-brand-600/20 rounded-lg">
 <div className="flex justify-between text-sm">
 <span className="font-medium text-content-secondary">Total de Itens:</span>
 <span className="font-semibold text-content-primary">
 {receiptItems.reduce((sum, item) => sum + item.quantity, 0)}
 </span>
 </div>
 {receiptItems.some(item => item.costPrice) && (
 <div className="flex justify-between text-sm mt-1">
 <span className="font-medium text-content-secondary">Custo Total:</span>
 <span className="font-semibold text-content-primary">
 {receiptItems.reduce((sum, item) => sum + (item.costPrice || 0) * item.quantity, 0).toFixed(2)} MZN
 </span>
 </div>
 )}
 </div>
 </div>
 )}

 <div className="flex items-center gap-3 pt-4 border-t border-border-default">
 <button
 onClick={handleSaveReceipt}
 className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
 >
 <Save className="w-4 h-4" />
 Salvar Recebimento
 </button>
 <button
 onClick={() => setIsModalOpen(false)}
 className="px-4 py-2 border border-border-default text-content-secondary rounded-lg hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
 variant={confirmDialog.variant}
 />
 </PageShell>
 );
};

