/**
 * Página dedicada para visualizar relatório de auditoria e aplicar ajustes
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, Info, Search, Filter, Loader2, Download, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { StockAudit, StockAuditItem, StockAuditStatus, StockAdjustmentReason } from '../../core/types/types';
import { stockAuditService } from '../services/stockAuditService';
import { useToast } from '../../core/contexts/ToastContext';
import { useLanguage } from '../../core/contexts/LanguageContext';
import { PageShell } from '../../core/components/layout/PageShell';
import { addPDFHeader, addPDFFooter, addPDFTableHeader, addPDFTableRow, getBrandColors, calculateColumnWidths } from '../../core/services/reportService';

const AUDIT_ADJUSTMENT_NOTES = 'Auditoria de stock, correção do stock de acordo com a contagem';

export const AuditReportPage: React.FC = () => {
 const { id: auditId } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { t } = useLanguage();

 const [audit, setAudit] = useState<StockAudit | null>(null);
 const [items, setItems] = useState<StockAuditItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [applying, setApplying] = useState(false);
 const [reverting, setReverting] = useState(false);
 const [applyProgress, setApplyProgress] = useState<{ phase: 'preparing' | 'applying'; current: number; total: number } | null>(null);
 const [exporting, setExporting] = useState(false);
 const [exportingExcel, setExportingExcel] = useState(false);
 const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [categories, setCategories] = useState<string[]>([]);

 useEffect(() => {
 if (auditId) {
 loadAuditAndItems();
 }
 }, [auditId]);

 const loadAuditAndItems = async () => {
 if (!auditId) return;

 setLoading(true);
 try {
 // Load audit details
 const audits = await stockAuditService.getAudits();
 const currentAudit = audits.find(a => a.id === auditId);

 if (!currentAudit) {
 showToast(t.stock.errorLoadingAudits || 'Auditoria não encontrada', 'error');
 navigate('/admin/stock/auditoria');
 return;
 }
 setAudit(currentAudit);

 // Load audit items
 const data = await stockAuditService.getAuditItems(auditId);
 setItems(data);

 // Extract unique categories from items
 const uniqueCategories = Array.from(new Set(data.filter(i => i.categoryName).map(i => i.categoryName!))).sort();
 setCategories(uniqueCategories);
 } catch (error) {
 showToast(t.messages.loadError || 'Erro ao carregar dados', 'error');
 } finally {
 setLoading(false);
 }
 };

 const itemsWithDiscrepancy = useMemo(() => {
 return items.filter(item =>
 item.discrepancy !== undefined &&
 item.discrepancy !== null &&
 item.discrepancy !== 0
 );
 }, [items]);

 const filteredItems = useMemo(() => {
 return items.filter(item => {
 // Filter by discrepancy if enabled
 if (showOnlyDiscrepancies) {
 const hasDiscrepancy = item.discrepancy !== undefined && item.discrepancy !== null && item.discrepancy !== 0;
 if (!hasDiscrepancy) return false;
 }

 // Filter by search term
 if (searchTerm) {
 const searchLower = searchTerm.toLowerCase();
 const matchesName = item.productName?.toLowerCase().includes(searchLower);
 if (!matchesName) return false;
 }

 // Filter by category
 if (selectedCategory !== 'all') {
 if (item.categoryName !== selectedCategory) return false;
 }

 return true;
 });
 }, [items, showOnlyDiscrepancies, searchTerm, selectedCategory]);

 const stats = useMemo(() => ({
 totalItems: items.length,
 itemsWithDiscrepancy: itemsWithDiscrepancy.length,
 positiveDiscrepancies: itemsWithDiscrepancy.filter(i => i.discrepancy! > 0).length,
 negativeDiscrepancies: itemsWithDiscrepancy.filter(i => i.discrepancy! < 0).length,
 }), [items, itemsWithDiscrepancy]);

 const handleApplyAdjustments = async () => {
 if (!audit || itemsWithDiscrepancy.length === 0) return;

 const confirmMsg = t.stock.confirmApplyAdjustments.replace('{count}', itemsWithDiscrepancy.length.toString());
 if (!window.confirm(confirmMsg)) return;

 const total = itemsWithDiscrepancy.length;
 setApplying(true);
 setApplyProgress({ phase: 'preparing', current: 0, total });
 try {
 for (let i = 0; i < itemsWithDiscrepancy.length; i++) {
 const item = itemsWithDiscrepancy[i];
 setApplyProgress({ phase: 'preparing', current: i + 1, total });
 await stockAuditService.updateAuditItemApproval(
 item.id,
 true,
 StockAdjustmentReason.CORRECTION,
 AUDIT_ADJUSTMENT_NOTES
 );
 }

 setApplyProgress({ phase: 'applying', current: 0, total: 0 });
 const result = await stockAuditService.applyAuditAdjustments(audit.id, audit.auditDate);

 if (result.success) {
 showToast(`${result.adjustmentsCreated} ${t.stock.adjustmentsAppliedSuccess}`, 'success');
 loadAuditAndItems();
 } else {
 showToast(result.error || t.stock.errorApplyingAdjustments, 'error');
 }
 } catch (error: any) {
 showToast(error.message || t.stock.errorApplyingAdjustments, 'error');
 } finally {
 setApplying(false);
 setApplyProgress(null);
 }
 };

 const handleRevertToCompleted = async () => {
 if (!audit || audit.status !== StockAuditStatus.APPLIED) return;
 if (!window.confirm('Reverter os ajustes aplicados e repor a auditoria como "Completa"? Poderá aplicar novamente. Os ajustes serão eliminados e o stock revertido.')) return;
 setReverting(true);
 try {
 const result = await stockAuditService.revertAuditToCompleted(audit.id);
 if (result.success) {
 showToast(`Auditoria reposta como Completa. ${result.revertedCount} ajuste(s) revertido(s). Pode aplicar novamente.`, 'success');
 loadAuditAndItems();
 } else {
 showToast(result.error || 'Erro ao reverter', 'error');
 }
 } catch (e: any) {
 showToast(e.message || 'Erro ao reverter', 'error');
 } finally {
 setReverting(false);
 }
 };

 const handleExportPDF = async () => {
 if (!audit || items.length === 0) return;

 setExporting(true);
 try {
 const pdf = new jsPDF('p', 'mm', 'a4');
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const margin = 10;
 const colors = getBrandColors();

 // Header
 const title = `${t.stock.auditTitle}`;
 const period = new Date(audit.auditDate).toLocaleDateString('pt-PT');
 let yPos = await addPDFHeader(pdf, title, {
 period,
 filters: audit.description ? [{ label: t.common.description, value: audit.description }] : []
 });

 // Summary Section
 pdf.setFontSize(12);
 pdf.setFont('helvetica', 'bold');
 pdf.setTextColor(...colors.primaryRgb);
 pdf.text(t.dashboard.overview || 'Resumo', margin, yPos);
 yPos += 7;

 pdf.setFontSize(10);
 pdf.setFont('helvetica', 'normal');
 pdf.setTextColor(0, 0, 0);

 const summaryItems = [
 { label: t.stock.totalItems, value: stats.totalItems.toString() },
 { label: t.stock.discrepanciesCount, value: stats.itemsWithDiscrepancy.toString() },
 { label: t.stock.positiveCount, value: stats.positiveDiscrepancies.toString() },
 { label: t.stock.negativeCount, value: stats.negativeDiscrepancies.toString() }
 ];

 summaryItems.forEach(item => {
 pdf.text(`${item.label}: ${item.value}`, margin, yPos);
 yPos += 5;
 });
 yPos += 5;

 // Table Header
 const availableWidth = pdfWidth - (margin * 2);
 const headers = [
 t.common.product,
 t.stock.unit || 'Unit',
 'Sistema',
 'Contagem',
 'Diferenças'
 ];
 const colWidths = calculateColumnWidths(availableWidth, [35, 15, 17, 17, 16]);
 const colX = [margin];
 for (let i = 1; i < colWidths.length; i++) {
 colX.push(colX[i - 1] + colWidths[i - 1]);
 }

 yPos = addPDFTableHeader(pdf, headers, colX, yPos, margin, pdfWidth);

 // Table Rows
 const itemsToExport = filteredItems.length > 0 ? filteredItems : items;

 itemsToExport.forEach((item, index) => {
 // Check page break
 if (yPos > 270) {
 pdf.addPage();
 yPos = margin + 10;
 yPos = addPDFTableHeader(pdf, headers, colX, yPos, margin, pdfWidth);
 }

 const fullProductName = item.variantName
 ? `${item.productName} (${item.variantName})`
 : (item.productName || '');

 const rowData = [
 fullProductName,
 item.unit || '-',
 item.systemQuantity.toFixed(2),
 item.countedQuantity !== undefined ? item.countedQuantity.toFixed(2) : '-',
 item.discrepancy !== undefined ? (item.discrepancy > 0 ? '+' : '') + item.discrepancy.toFixed(2) : '-'
 ];

 yPos = addPDFTableRow(pdf, rowData, colX, yPos, index, margin, pdfWidth);
 });

 // Footer for all pages
 const totalPages = pdf.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 pdf.setPage(i);
 addPDFFooter(pdf, i, totalPages, { showCompanyInfo: true });
 }

 pdf.save(`auditoria_${audit.id}_${period.replace(/\//g, '-')}.pdf`);
 showToast(t.messages.operationSuccess, 'success');
 } catch (error) {
 console.error('Error generating PDF:', error);
 showToast(t.messages.operationFailed, 'error');
 } finally {
 setExporting(false);
 }
 };

 const handleExportExcel = async () => {
 if (!audit || items.length === 0) return;

 setExportingExcel(true);
 try {
 const itemsToExport = filteredItems.length > 0 ? filteredItems : items;
 const period = new Date(audit.auditDate).toLocaleDateString('pt-PT');

 const rows = itemsToExport.map(item => ({
 Produto: item.productName || '',
 Variante: item.variantName || '',
 Categoria: item.categoryName || '',
 Unidade: item.unit || '-',
 Sistema: Number(item.systemQuantity ?? 0),
 Contagem: item.countedQuantity !== undefined ? Number(item.countedQuantity) : null,
 Diferenças: item.discrepancy !== undefined && item.discrepancy !== null ? Number(item.discrepancy) : null,
 Estado: audit.status,
 Data: period
 }));

 const worksheet = XLSX.utils.json_to_sheet(rows);
 const workbook = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');

 const safePeriod = period.replace(/\//g, '-');
 XLSX.writeFile(workbook, `auditoria_${audit.id}_${safePeriod}.xlsx`);

 showToast('Exportação Excel concluída com sucesso', 'success');
 } catch (error) {
 console.error('Error generating Excel:', error);
 showToast(t.messages.operationFailed, 'error');
 } finally {
 setExportingExcel(false);
 }
 };

 if (loading) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[400px]">
 <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
 <p className="text-content-secondary">{t.stock.loadingReport}</p>
 </div>
 );
 }

 if (!audit) return null;

 const canApply = audit.status === StockAuditStatus.COMPLETED;
 const canRevert = audit.status === StockAuditStatus.APPLIED;

 return (
 <PageShell
 title={t.stock.viewReport}
 description={audit.description || `Auditoria de ${new Date(audit.auditDate).toLocaleDateString('pt-PT')}`}
 compactHeaderMobile
 actions={
 <div className="flex items-center gap-2">
 <button
 onClick={() => navigate('/admin/stock/auditoria')}
 className="p-2 rounded-lg hover:bg-surface-base transition-colors text-content-secondary border border-border-default"
 title={t.common.back}
 >
 <ArrowLeft className="w-4 h-4" />
 </button>
 <button
 onClick={handleExportExcel}
 disabled={exportingExcel}
 className="flex items-center gap-2 px-3 py-2 bg-surface-raised border border-border-default text-content-secondary rounded-lg text-sm font-medium hover:bg-surface-base transition-colors disabled:opacity-50"
 >
 {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 <span className="hidden sm:inline">Excel</span>
 </button>
 <button
 onClick={handleExportPDF}
 disabled={exporting}
 className="flex items-center gap-2 px-3 py-2 bg-surface-raised border border-border-default text-content-secondary rounded-lg text-sm font-medium hover:bg-surface-base transition-colors disabled:opacity-50"
 >
 {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 <span className="hidden sm:inline">PDF</span>
 </button>
 </div>
 }
 >
 <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default flex flex-col min-h-[600px]">

 {/* Info Banner */}
 {canApply && stats.itemsWithDiscrepancy > 0 && (
 <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-border-default">
 <div className="flex items-start gap-2">
 <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
 <div className="text-sm text-blue-800 dark:text-blue-200">
 <p>{t.stock.auditReportApplyAllInstruction ?? 'Clique em Ajustar stock para aplicar todas as discrepâncias com o motivo: Auditoria de stock, correção do stock de acordo com a contagem.'}</p>
 </div>
 </div>
 </div>
 )}

 {/* Filters */}
 <div className="p-4 border-b border-border-default space-y-4">
 <div className="flex flex-col md:flex-row gap-4">
 {/* Search */}
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="text"
 placeholder={`${t.common.search || 'Pesquisar'}...`}
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-9 pr-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 outline-none"
 />
 </div>

 {/* Category Filter */}
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 text-content-muted" />
 <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value)}
 className="pl-3 pr-8 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 outline-none"
 >
 <option value="all">{t.common.all}</option>
 {categories.map(cat => (
 <option key={cat} value={cat}>{cat}</option>
 ))}
 </select>
 </div>
 </div>

 <label className="flex items-center gap-2 cursor-pointer w-fit">
 <input
 type="checkbox"
 checked={showOnlyDiscrepancies}
 onChange={(e) => setShowOnlyDiscrepancies(e.target.checked)}
 className="rounded border-border-default text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-content-secondary">
 {t.stock.showDiscrepanciesOnly}
 </span>
 </label>
 </div>

 {/* Table */}
 <div className="flex-1 overflow-auto">
 <table className="w-full border-collapse">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary">{t.common.product}</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary w-16">{t.stock.unit}</th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-secondary w-24">{t.stock.systemQuantity}</th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-secondary w-24">{t.stock.countedQuantity}</th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-secondary w-28">{t.stock.difference}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {filteredItems.length === 0 ? (
 <tr>
 <td colSpan={5} className="px-4 py-12 text-center text-content-muted">
 {t.stock.noItemsFound}
 </td>
 </tr>
 ) : (
 filteredItems.map(item => {
 const isLargeDiscrepancy = Math.abs(item.discrepancy || 0) > 10;

 return (
 <tr key={item.id} className="hover:bg-surface-base/50 transition-colors">
 <td className="px-4 py-3">
 <div className="flex flex-col">
 <span className="text-sm font-medium text-content-primary">{item.productName}</span>
 <div className="flex items-center gap-2 mt-0.5">
 {item.categoryName && (
 <span className="text-[10px] px-1.5 py-0.5 bg-surface-base text-content-secondary rounded uppercase tracking-wider font-semibold">
 {item.categoryName}
 </span>
 )}
 {item.variantName && (
 <span className="text-[10px] text-content-muted italic">
 {item.variantName}
 </span>
 )}
 </div>
 </div>
 </td>
 <td className="px-4 py-3 text-left text-sm text-content-secondary">
 {item.unit || '-'}
 </td>
 <td className="px-4 py-3 text-center text-sm text-content-primary font-mono">
 {item.systemQuantity.toFixed(2)}
 </td>
 <td className="px-4 py-3 text-center text-sm text-content-primary font-mono">
 {item.countedQuantity !== undefined ? item.countedQuantity.toFixed(2) : '-'}
 </td>
 <td className="px-4 py-3 text-center">
 {item.discrepancy !== undefined && item.discrepancy !== null ? (
 <div className="flex items-center justify-center gap-1.5">
 <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${item.discrepancy === 0
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
 : item.discrepancy > 0
 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
 : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
 }`}>
 {item.discrepancy > 0 ? '+' : ''}{item.discrepancy.toFixed(2)}
 </span>
 {isLargeDiscrepancy && (
 <AlertTriangle className="w-4 h-4 text-orange-500" title={t.stock.largeDiscrepancy} />
 )}
 </div>
 ) : '-'}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>

 {/* Footer with Stats and Actions */}
 <div className="p-4 bg-surface-base border-t border-border-default">
 <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
 {/* Stats Cards at Bottom */}
 <div className="flex flex-wrap items-center gap-4">
 <div className="px-4 py-2 bg-surface-raised rounded-lg border border-border-default shadow-sm min-w-[120px]">
 <p className="text-[10px] text-content-muted uppercase font-bold tracking-tight">{t.stock.totalItems}</p>
 <p className="text-xl font-bold text-content-primary">{stats.totalItems}</p>
 </div>
 <div className="px-4 py-2 bg-surface-raised rounded-lg border border-border-default shadow-sm min-w-[120px]">
 <p className="text-[10px] text-orange-500 uppercase font-bold tracking-tight">{t.stock.discrepanciesCount}</p>
 <p className="text-xl font-bold text-orange-600">{stats.itemsWithDiscrepancy}</p>
 </div>
 <div className="px-4 py-2 bg-surface-raised rounded-lg border border-border-default shadow-sm min-w-[120px]">
 <p className="text-[10px] text-green-500 uppercase font-bold tracking-tight">{t.stock.positiveCount}</p>
 <p className="text-xl font-bold text-green-600">{stats.positiveDiscrepancies}</p>
 </div>
 <div className="px-4 py-2 bg-surface-raised rounded-lg border border-border-default shadow-sm min-w-[120px]">
 <p className="text-[10px] text-red-500 uppercase font-bold tracking-tight">{t.stock.negativeCount}</p>
 <p className="text-xl font-bold text-red-600">{stats.negativeDiscrepancies}</p>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate('/admin/stock/auditoria')}
 className="px-6 py-2.5 text-content-secondary hover:bg-surface-base rounded-xl font-semibold transition-colors border border-border-default"
 >
 {t.common.close}
 </button>
 {canRevert && (
 <button
 onClick={handleRevertToCompleted}
 disabled={reverting}
 className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2"
 >
 {reverting ? (
 <>
 <Loader2 className="w-5 h-5 animate-spin" />
 A reverter...
 </>
 ) : (
 <>
 <RotateCcw className="w-5 h-5" />
 Repor para aplicar novamente
 </>
 )}
 </button>
 )}
 {canApply && stats.itemsWithDiscrepancy > 0 && (
 <button
 onClick={handleApplyAdjustments}
 disabled={applying}
 className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
 >
 {applying ? (
 <>
 <Loader2 className="w-5 h-5 animate-spin" />
 {t.stock.applyingAdjustments}
 </>
 ) : (
 <>
 <CheckCircle className="w-5 h-5" />
 {t.stock.applyAdjustmentsForAuditDate ?? t.stock.reviewAndApply}
 </>
 )}
 </button>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Modal de progresso ao aplicar ajustes - bloqueia a página até terminar */}
 {applying && (
 <div className="fixed inset-0 min-h-screen min-w-full z-[100] flex items-center justify-center modal-overlay">
 <div className="bg-surface-raised rounded-xl shadow-xl border border-border-default p-6 max-w-md mx-4 flex flex-col items-center gap-4">
 <Loader2 className="w-12 h-12 text-orange-500 animate-spin flex-shrink-0" />
 <div className="text-center space-y-2">
 <p className="text-lg font-semibold text-content-primary">
 {t.stock.applyingAdjustments}
 </p>
 {applyProgress && (
 <p className="text-sm text-content-secondary">
 {applyProgress.phase === 'preparing' && applyProgress.total > 0
 ? `${t.stock.applyingProgressItem ?? 'Item'} ${applyProgress.current} ${t.stock.applyingProgressOf ?? 'de'} ${applyProgress.total}`
 : applyProgress.phase === 'applying'
 ? (t.stock.applyingProgressSaving ?? 'A gravar no sistema...')
 : null}
 </p>
 )}
 <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
 {t.stock.applyingProgressDoNotLeave ?? 'Não feche esta janela. Aguarde até terminar.'}
 </p>
 </div>
 </div>
 </div>
 )}
 </PageShell>
 );
};
