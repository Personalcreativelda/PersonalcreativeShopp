import React, { useState, useMemo, useEffect } from 'react';
import { Image, Upload, FileSpreadsheet, FileText, Plus, X, Filter, Trash2, Download, Eye, Loader2 } from 'lucide-react';
import { createWorkbook, addWorksheet, addRowsFromJson, writeWorkbookToFile } from '../../core/services/excelService';
import jsPDF from 'jspdf';
import { addPDFHeader, addPDFFooter, getBrandColors, calculateColumnWidths, addPDFTableHeader, addPDFTableRow } from '../../core/services/reportService';
import { useMobile } from '../../core/hooks/useMobile';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, ViewModeToggle, ItemsPerPageSelect, SelectFilter, Pagination } from '../../core/components/filters';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { getTodayDateString } from '../../core/utils/dateUtils';
import { MediaUploader } from '../components/MediaUploader';
import { MediaCard } from '../components/MediaCard';
import { MediaPreview } from '../components/MediaPreview';
import {
 listMediaFiles,
 searchMediaFiles,
 uploadMultipleMediaFiles,
 deleteMediaFile,
 deleteMultipleMediaFiles,
 formatFileSize
} from '../services/mediaService';
import type { MediaFile } from '../../core/types/types';
import { MediaCategory, MediaType } from '../../core/types/types';
import { Toast } from '../../core/components/ui/Toast';
import { normalizeForSearch } from '../../core/services/serviceUtils';

interface MediaProps {
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
}

export const Media: React.FC<MediaProps> = ({ showToast }) => {
 const isMobile = useMobile(768);
 
 // View Mode - Cards como padréo no mobile
 const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');
 
 // Estado de dados
 const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isUploading, setIsUploading] = useState(false);
 
 // Estado de filtros
 const [searchQuery, setSearchQuery] = useState('');
 const [filterType, setFilterType] = useState<string>('ALL');
 const [filterCategory, setFilterCategory] = useState<string>('ALL');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('all');
 const [filterDateFrom, setFilterDateFrom] = useState<string>('');
 const [filterDateTo, setFilterDateTo] = useState<string>('');
 const [showFilters, setShowFilters] = useState(false);
 
 // Paginaçéo
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(12);
 
 // Seleçéo méºltipla
 const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
 
 // Preview
 const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
 const [isPreviewOpen, setIsPreviewOpen] = useState(false);
 
 // Upload modal
 const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
 const [uploadCategory, setUploadCategory] = useState<MediaCategory>(MediaCategory.MEDIA_LIBRARY);
 
 // Funçéo auxiliar para obter intervalo de datas
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
 
 // Carregar arquivos
 const loadMediaFiles = async () => {
 setIsLoading(true);
 try {
 // Usar cache se disponé­vel - seré¡ muito mais ré¡pido
 const files = await listMediaFiles();
 setMediaFiles(files);
 if (files.length === 0) {
 console.warn('[Media] Nenhum arquivo encontrado no bucket');
 }
 } catch (error: any) {
 console.error('[Media] Erro ao carregar arquivos:', error);
 showToast(`Erro ao carregar arquivos de mé­dia: ${error.message}`, 'error');
 } finally {
 setIsLoading(false);
 }
 };
 
 useEffect(() => {
 loadMediaFiles();
 }, []);
 
 // Dados filtrados e ordenados
 const filteredAndSortedData = useMemo(() => {
 let filtered = [...mediaFiles];
 
 // Busca por nome
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filtered = filtered.filter(file => 
 normalizeForSearch(file.name).includes(query) ||
 normalizeForSearch(file.path).includes(query)
 );
 }
 
 // Filtro por tipo
 if (filterType !== 'ALL') {
 filtered = filtered.filter(file => file.type === filterType.toLowerCase());
 }
 
 // Filtro por categoria
 if (filterCategory !== 'ALL') {
 filtered = filtered.filter(file => file.category === filterCategory.toLowerCase());
 }
 
 // Filtro por período
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 filtered = filtered.filter(file => {
 const fileDate = new Date(file.createdAt);
 fileDate.setHours(0, 0, 0, 0);
 const normalizedStart = new Date(start);
 normalizedStart.setHours(0, 0, 0, 0);
 const normalizedEnd = new Date(end);
 normalizedEnd.setHours(23, 59, 59, 999);
 return fileDate >= normalizedStart && fileDate <= normalizedEnd;
 });
 
 // Ordenaçéo (por data de criaçéo, mais recente primeiro)
 filtered.sort((a, b) => {
 const dateA = new Date(a.createdAt).getTime();
 const dateB = new Date(b.createdAt).getTime();
 return dateB - dateA;
 });
 
 return filtered;
 }, [mediaFiles, searchQuery, filterType, filterCategory, filterPeriod, filterDateFrom, filterDateTo]);
 
 // Paginaçéo
 const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
 const paginatedData = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredAndSortedData.slice(start, start + itemsPerPage);
 }, [filteredAndSortedData, currentPage, itemsPerPage]);
 
 // Reset paginaçéo quando filtros mudam
 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, filterType, filterCategory, filterPeriod, filterDateFrom, filterDateTo]);
 
 // Upload de arquivos
 const handleUpload = async (files: File[]) => {
 setIsUploading(true);
 try {
 const result = await uploadMultipleMediaFiles(files, uploadCategory);
 
 if (result.success.length > 0) {
 showToast(`${result.success.length} arquivo(s) enviado(s) com sucesso`, 'success');
 await loadMediaFiles();
 setIsUploadModalOpen(false);
 }
 
 if (result.failed.length > 0) {
 const errors = result.failed.map(f => `${f.file.name}: ${f.error}`).join(', ');
 showToast(`Erro ao enviar alguns arquivos: ${errors}`, 'error', 8000);
 }
 } catch (error: any) {
 console.error('Erro ao fazer upload:', error);
 showToast('Erro ao fazer upload dos arquivos', 'error');
 } finally {
 setIsUploading(false);
 }
 };
 
 // Deletar arquivo
 const handleDelete = async (file: MediaFile) => {
 try {
 const success = await deleteMediaFile(file.path);
 if (success) {
 showToast('Arquivo deletado com sucesso', 'success');
 await loadMediaFiles();
 setSelectedFiles(prev => {
 const newSet = new Set(prev);
 newSet.delete(file.id);
 return newSet;
 });
 } else {
 showToast('Erro ao deletar arquivo', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao deletar arquivo:', error);
 showToast('Erro ao deletar arquivo', 'error');
 }
 };
 
 // Deletar méºltiplos arquivos
 const handleBulkDelete = async () => {
 if (selectedFiles.size === 0) return;
 
 if (!window.confirm(`Tem certeza que deseja deletar ${selectedFiles.size} arquivo(s)?`)) {
 return;
 }
 
 try {
 const filesToDelete = mediaFiles.filter(f => selectedFiles.has(f.id));
 const paths = filesToDelete.map(f => f.path);
 const result = await deleteMultipleMediaFiles(paths);
 
 if (result.success.length > 0) {
 showToast(`${result.success.length} arquivo(s) deletado(s) com sucesso`, 'success');
 await loadMediaFiles();
 setSelectedFiles(new Set());
 }
 
 if (result.failed.length > 0) {
 showToast(`Erro ao deletar alguns arquivos`, 'error');
 }
 } catch (error: any) {
 console.error('Erro ao deletar arquivos:', error);
 showToast('Erro ao deletar arquivos', 'error');
 }
 };
 
 // Seleçéo de arquivos
 const handleSelectFile = (file: MediaFile) => {
 setSelectedFiles(prev => {
 const newSet = new Set(prev);
 if (newSet.has(file.id)) {
 newSet.delete(file.id);
 } else {
 newSet.add(file.id);
 }
 return newSet;
 });
 };
 
 const handleSelectAll = () => {
 if (selectedFiles.size === paginatedData.length) {
 setSelectedFiles(new Set());
 } else {
 setSelectedFiles(new Set(paginatedData.map(f => f.id)));
 }
 };
 
 // Preview
 const handleView = (file: MediaFile) => {
 setPreviewFile(file);
 setIsPreviewOpen(true);
 };
 
 // Exportação Excel
 const exportToExcel = async () => {
 try {
 if (filteredAndSortedData.length === 0) {
 showToast('Néo hé¡ dados para exportar', 'warning');
 return;
 }
 
 const exportData = filteredAndSortedData.map(file => ({
 Nome: file.name,
 Tipo: file.type === 'image' ? 'Imagem' : file.type === 'document' ? 'Documento' : 'Outro',
 Categoria: file.category,
 Tamanho: formatFileSize(file.size),
 'Data de Criaçéo': new Date(file.createdAt).toLocaleDateString('pt-PT'),
 URL: file.url
 }));
 
 const wb = createWorkbook();
 const ws = addWorksheet(wb, 'Média');
 addRowsFromJson(ws, exportData as Record<string, unknown>[]);
 [30, 12, 15, 12, 15, 50].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

 const filename = `midia_${getTodayDateString()}.xlsx`;
 await writeWorkbookToFile(wb, filename);
 showToast(`Exportaçéo para Excel conclué­da: ${filteredAndSortedData.length} registros`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para Excel:', error);
 showToast('Erro ao exportar para Excel', 'error');
 }
 };
 
 // Exportaçéo PDF
 const exportToPDF = async () => {
 try {
 if (filteredAndSortedData.length === 0) {
 showToast('Néo hé¡ dados para exportar', 'warning');
 return;
 }
 
 showToast('Gerando PDF...', 'info');
 
 const pdf = new jsPDF('l', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = pdf.internal.pageSize.getHeight();
 const margin = 10;

 // Preparar Informações de filtros
 const filters: Array<{ label: string; value: string }> = [];
 filters.push({ label: 'Total de arquivos', value: filteredAndSortedData.length.toString() });
 filters.push({ label: 'Tipo', value: filterType === 'ALL' ? 'Todos' : filterType });
 filters.push({ label: 'Categoria', value: filterCategory === 'ALL' ? 'Todas' : filterCategory });
 filters.push({ label: 'Período', value: filterPeriod });

 // Adicionar cabeçalho com branding
 let yPos = await addPDFHeader(pdf, 'Biblioteca de Mé­dia', {
 filters,
 orientation: 'landscape',
 });
 
 // Tabela com branding
 const headers = ['Nome', 'Tipo', 'Categoria', 'Tamanho', 'Data'];
 
 // Calcular largura disponé­vel e proporçéµes das colunas
 const availableWidth = pdfWidth - (margin * 2);
 const colProportions = [3.0, 1.2, 1.5, 1.2, 1.2]; // 5 colunas
 const colWidths = calculateColumnWidths(availableWidth, colProportions);
 
 // Calcular posiçéµes X das colunas
 const colX: number[] = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 yPos = addPDFTableHeader(pdf, headers, colX, yPos, margin, pdfWidth);
 
 // Linhas da tabela com alterné¢ncia de cores
 filteredAndSortedData.forEach((file, index) => {
 if (yPos > pdfHeight - 20) {
 pdf.addPage();
 yPos = margin;
 // Repetir cabeçalho em nova pé¡gina
 yPos = addPDFTableHeader(pdf, headers, colX, yPos, margin, pdfWidth);
 }
 
 const maxNameLength = Math.floor(colWidths[0] / 2);
 const maxCategoryLength = Math.floor(colWidths[2] / 2);
 
 const rowData = [
 file.name.length > maxNameLength ? file.name.substring(0, maxNameLength - 3) + '...' : file.name,
 file.type === 'image' ? 'Imagem' : file.type === 'document' ? 'Doc' : 'Outro',
 file.category.length > maxCategoryLength ? file.category.substring(0, maxCategoryLength - 3) + '...' : file.category,
 formatFileSize(file.size),
 new Date(file.createdAt).toLocaleDateString('pt-PT')
 ];
 
 yPos = addPDFTableRow(pdf, rowData, colX, yPos, index, margin, pdfWidth, {
 fontSize: 8,
 alternateColors: true,
 });
 });
 
 // Rodapé© com branding
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }
 
 const filename = `midia_${getTodayDateString()}.pdf`;
 pdf.save(filename);
 showToast(`Exportaçéo para PDF conclué­da: ${filteredAndSortedData.length} registros`, 'success');
 } catch (error: any) {
 console.error('Erro ao exportar para PDF:', error);
 showToast('Erro ao exportar para PDF', 'error');
 }
 };
 
 const hasActiveFilters = searchQuery || filterType !== 'ALL' || filterCategory !== 'ALL' || filterPeriod !== 'thisMonth' || filterDateFrom || filterDateTo;
 
 return (
 <PageShell
 title="Biblioteca de Mé­dia"
 actions={
 <div className="flex items-center gap-2">
 <button
 onClick={() => setIsUploadModalOpen(true)}
 className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center shadow-lg transition-colors px-4 py-2"
 >
 <Plus className="w-5 h-5 mr-2" />
 <span className="hidden sm:inline">Upload</span>
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
 showFilters || hasActiveFilters
 ? 'bg-brand-600 text-white hover:bg-brand-700'
 : 'bg-gray-600 hover:bg-gray-700 text-white'
 }`}
 title="Filtros"
 >
 <Filter className="w-5 h-5" />
 {hasActiveFilters && (
 <span className="bg-surface-raised/20 px-1.5 py-0.5 rounded-full text-xs">
 {[searchQuery, filterType !== 'ALL' ? 1 : 0, filterCategory !== 'ALL' ? 1 : 0, filterPeriod !== 'thisMonth' ? 1 : 0].filter(Boolean).length}
 </span>
 )}
 </button>
 )}
 </div>
 }
 >
 {/* FilterBar */}
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
 placeholder="Buscar arquivos..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />
 
 <div className="hidden sm:block">
 <SelectFilter
 value={filterType}
 onChange={(val) => {
 setFilterType(val);
 setCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Todos os tipos' },
 { value: 'image', label: 'Imagens' },
 { value: 'document', label: 'Documentos' },
 { value: 'other', label: 'Outros' }
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por tipo de arquivo"
 />
 </div>
 
 <div className="hidden sm:block">
 <SelectFilter
 value={filterCategory}
 onChange={(val) => {
 setFilterCategory(val);
 setCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Todas as categorias' },
 { value: 'products', label: 'Produtos' },
 { value: 'avatars', label: 'Avatares' },
 { value: 'payment-proofs', label: 'Comprovativos' },
 { value: 'system', label: 'Sistema' },
 { value: 'documents', label: 'Documentos' },
 { value: 'media-library', label: 'Biblioteca' },
 { value: 'other', label: 'Outros' }
 ]}
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
 onClick={() => {
 setSearchQuery('');
 setFilterType('ALL');
 setFilterCategory('ALL');
 setFilterPeriod('all');
 setFilterDateFrom('');
 setFilterDateTo('');
 setCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </FilterBar>
 
 {/* Painel de Filtros Mobile */}
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
 <label className="block text-xs font-medium text-content-secondary mb-2">
 Tipo
 </label>
 <SelectFilter
 value={filterType}
 onChange={(val) => {
 setFilterType(val);
 setCurrentPage(1);
 }}
 options={[
 { value: 'ALL', label: 'Todos' },
 { value: 'image', label: 'Imagens' },
 { value: 'document', label: 'Documentos' },
 { value: 'other', label: 'Outros' }
 ]}
 className="w-full"
 size="md"
 ariaLabel="Filtrar por tipo de arquivo"
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
 options={[
 { value: 'ALL', label: 'Todas' },
 { value: 'products', label: 'Produtos' },
 { value: 'avatars', label: 'Avatares' },
 { value: 'payment-proofs', label: 'Comprovativos' },
 { value: 'system', label: 'Sistema' },
 { value: 'documents', label: 'Documentos' },
 { value: 'media-library', label: 'Biblioteca' },
 { value: 'other', label: 'Outros' }
 ]}
 className="w-full"
 size="md"
 ariaLabel="Filtrar por categoria"
 />
 </div>
 </div>
 
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
 
 {hasActiveFilters && (
 <button
 onClick={() => {
 setSearchQuery('');
 setFilterType('ALL');
 setFilterCategory('ALL');
 setFilterPeriod('all');
 setFilterDateFrom('');
 setFilterDateTo('');
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
 
 {/* Seleçéo méºltipla e açéµes em lote */}
 {selectedFiles.size > 0 && (
 <div className="bg-brand-50 dark:bg-brand-600/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3 flex items-center justify-between">
 <span className="text-sm font-medium text-brand-900 dark:text-brand-100">
 {selectedFiles.size} arquivo{selectedFiles.size !== 1 ? 's' : ''} selecionado{selectedFiles.size !== 1 ? 's' : ''}
 </span>
 <div className="flex gap-2">
 <button
 onClick={handleBulkDelete}
 className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
 >
 <Trash2 className="w-4 h-4" />
 Deletar
 </button>
 <button
 onClick={() => setSelectedFiles(new Set())}
 className="px-3 py-1.5 bg-surface-base hover:bg-surface-base text-content-secondary rounded-lg text-sm font-medium"
 >
 Cancelar
 </button>
 </div>
 </div>
 )}
 
 {/* Conteéºdo */}
 {isLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 </div>
 ) : paginatedData.length === 0 ? (
 <div className="text-center py-12">
 <Image className="w-16 h-16 mx-auto text-content-muted mb-4" />
 <p className="text-content-muted">
 {hasActiveFilters ? 'Nenhum arquivo encontrado com os filtros aplicados' : 'Nenhum arquivo encontrado'}
 </p>
 </div>
 ) : viewMode === 'grid' ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {paginatedData.map((file) => (
 <MediaCard
 key={file.id}
 file={file}
 onView={handleView}
 onDelete={handleDelete}
 isSelected={selectedFiles.has(file.id)}
 onSelect={handleSelectFile}
 />
 ))}
 </div>
 ) : (
 <div className="overflow-auto max-h-[calc(100vh-280px)] rounded-lg border border-border-default">
 <table className="w-full border-collapse">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th className="p-3 text-left">
 <input
 type="checkbox"
 checked={selectedFiles.size === paginatedData.length && paginatedData.length > 0}
 onChange={handleSelectAll}
 className="w-4 h-4 rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </th>
 <th className="p-3 text-left text-xs font-semibold text-content-secondary">Nome</th>
 <th className="p-3 text-left text-xs font-semibold text-content-secondary">Tipo</th>
 <th className="p-3 text-left text-xs font-semibold text-content-secondary">Categoria</th>
 <th className="p-3 text-left text-xs font-semibold text-content-secondary">Tamanho</th>
 <th className="p-3 text-left text-xs font-semibold text-content-secondary">Data</th>
 <th className="p-3 text-left text-xs font-semibold text-content-secondary">Açéµes</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedData.map((file) => (
 <tr key={file.id} className="hover:bg-surface-base/50">
 <td className="p-3">
 <input
 type="checkbox"
 checked={selectedFiles.has(file.id)}
 onChange={() => handleSelectFile(file)}
 className="w-4 h-4 rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </td>
 <td className="p-3">
 <div className="flex items-center gap-2">
 {file.type === 'image' ? (
 <img src={file.url} alt={file.name} className="w-10 h-10 object-cover rounded" />
 ) : (
 <FileText className="w-10 h-10 text-content-muted" />
 )}
 <span className="text-sm font-medium text-content-primary">{file.name}</span>
 </div>
 </td>
 <td className="p-3 text-sm text-content-secondary">
 {file.type === 'image' ? 'Imagem' : file.type === 'document' ? 'Documento' : 'Outro'}
 </td>
 <td className="p-3 text-sm text-content-secondary">{file.category}</td>
 <td className="p-3 text-sm text-content-secondary">{formatFileSize(file.size)}</td>
 <td className="p-3 text-sm text-content-secondary">
 {new Date(file.createdAt).toLocaleDateString('pt-PT')}
 </td>
 <td className="p-3">
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleView(file)}
 className="p-1.5 hover:bg-surface-base rounded transition-colors"
 title="Visualizar"
 >
 <Eye className="w-4 h-4 text-content-secondary" />
 </button>
 <button
 onClick={() => handleDelete(file)}
 className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Deletar"
 >
 <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 
 {/* Paginaçéo */}
 {totalPages > 1 && (
 <div className="flex justify-center items-center gap-2 mt-6">
 <Pagination
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 mode="full"
 />
 </div>
 )}
 
 {/* Modal de Upload */}
 {isUploadModalOpen && (
 <div className="fixed inset-0 min-h-screen min-w-full z-[100] modal-overlay flex items-center justify-center p-4" onClick={() => setIsUploadModalOpen(false)}>
 <div className="bg-surface-raised rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
 <div className="p-6 border-b border-border-default flex items-center justify-between">
 <h2 className="text-xl font-semibold text-content-primary">Upload de Arquivos</h2>
 <button
 onClick={() => setIsUploadModalOpen(false)}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>
 <div className="p-6">
 <div className="mb-4">
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Categoria
 </label>
 <SelectFilter
 value={uploadCategory}
 onChange={(val) => setUploadCategory(val as MediaCategory)}
 options={[
 { value: MediaCategory.MEDIA_LIBRARY, label: 'Biblioteca' },
 { value: MediaCategory.PRODUCTS, label: 'Produtos' },
 { value: MediaCategory.AVATARS, label: 'Avatares' },
 { value: MediaCategory.DOCUMENTS, label: 'Documentos' },
 { value: MediaCategory.PAYMENT_PROOFS, label: 'Comprovativos' },
 { value: MediaCategory.SYSTEM, label: 'Sistema' },
 { value: MediaCategory.OTHER, label: 'Outros' }
 ]}
 className="w-full"
 size="md"
 ariaLabel="Selecionar categoria de upload"
 />
 </div>
 <MediaUploader
 onUpload={handleUpload}
 category={uploadCategory}
 multiple={true}
 accept="image/*,.svg,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
 />
 </div>
 </div>
 </div>
 )}
 
 {/* Preview Modal */}
 <MediaPreview
 file={previewFile}
 isOpen={isPreviewOpen}
 onClose={() => {
 setIsPreviewOpen(false);
 setPreviewFile(null);
 }}
 />
 </PageShell>
 );
};


