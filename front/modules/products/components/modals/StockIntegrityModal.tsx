/**
 * Modal para exibir relatório de integridade de stock
 * Mostra anomalias, movimentos em falta, duplicados, etc.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { X, AlertTriangle, CheckCircle, AlertCircle, Info, RefreshCw, Wrench, Trash2, FileWarning, Package } from 'lucide-react';
import { stockIntegrityService, StockIntegrityReport, StockIntegrityIssue, ProgressCallback } from '../../services/stockIntegrityService';

interface StockIntegrityModalProps {
 open: boolean;
 onClose: () => void;
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
 onRefresh?: () => void;
}

interface ProgressState {
 stage: string;
 current: number;
 total: number;
 message?: string;
}

const SEVERITY_STYLES = {
 error: {
 bg: 'bg-red-50 dark:bg-red-900/20',
 border: 'border-red-200 dark:border-red-800',
 text: 'text-red-700 dark:text-red-300',
 icon: <AlertTriangle className="w-4 h-4 text-red-500" />
 },
 warning: {
 bg: 'bg-yellow-50 dark:bg-yellow-900/20',
 border: 'border-yellow-200 dark:border-yellow-800',
 text: 'text-yellow-700 dark:text-yellow-300',
 icon: <AlertCircle className="w-4 h-4 text-yellow-500" />
 },
 info: {
 bg: 'bg-blue-50 dark:bg-blue-900/20',
 border: 'border-blue-200 dark:border-blue-800',
 text: 'text-blue-700 dark:text-blue-300',
 icon: <Info className="w-4 h-4 text-blue-500" />
 }
};

const ISSUE_TYPE_LABELS: Record<StockIntegrityIssue['type'], string> = {
 missing_movement: 'Movimento em Falta',
 orphan_movement: 'Movimento Órfão',
 duplicate_movement: 'Movimento Duplicado',
 stock_discrepancy: 'Discrepância de Stock',
 missing_transaction: 'Transação em Falta'
};

export const StockIntegrityModal: React.FC<StockIntegrityModalProps> = ({
 open,
 onClose,
 showToast,
 onRefresh
}) => {
 const [loading, setLoading] = useState(false);
 const [report, setReport] = useState<StockIntegrityReport | null>(null);
 const [fixing, setFixing] = useState(false);
 const [selectedFix, setSelectedFix] = useState<string | null>(null);
 const [progress, setProgress] = useState<ProgressState | null>(null);

 // Callback de progresso
 const handleProgress: ProgressCallback = useCallback((stage, current, total, message) => {
 setProgress({ stage, current, total, message });
 }, []);

 // Carregar relatório
 const loadReport = async () => {
 setLoading(true);
 setProgress({ stage: 'A iniciar...', current: 0, total: 100 });
 try {
 const result = await stockIntegrityService.generateIntegrityReport(undefined, handleProgress);
 setReport(result);
 } catch (e: any) {
 showToast('Erro ao gerar relatório', 'error');
 } finally {
 setLoading(false);
 setProgress(null);
 }
 };

 // Corrigir problemas
 const handleFix = async (fixType: 'duplicates' | 'orphans' | 'missing' | 'purchases' | 'discrepancies') => {
 setFixing(true);
 setSelectedFix(fixType);
 setProgress({ stage: 'A iniciar...', current: 0, total: 100 });
 
 try {
 let result;
 switch (fixType) {
 case 'duplicates':
 result = await stockIntegrityService.fixDuplicateMovements(false, handleProgress);
 if (result.removed > 0) {
 showToast(`${result.removed} movimentos duplicados removidos`, 'success');
 } else {
 showToast('Nenhum duplicado para remover', 'info');
 }
 if (result.errors.length > 0) {
 console.warn('[StockIntegrityModal] Erros ao remover duplicados:', result.errors);
 }
 break;
 case 'orphans':
 result = await stockIntegrityService.fixOrphanMovements(false, handleProgress);
 if (result.removed > 0) {
 showToast(`${result.removed} movimentos órfãos removidos`, 'success');
 } else {
 showToast('Nenhum órfão para remover', 'info');
 }
 if (result.errors.length > 0) {
 console.warn('[StockIntegrityModal] Erros ao remover órfãos:', result.errors);
 }
 break;
 case 'missing':
 result = await stockIntegrityService.fixMissingOrderMovements(false, handleProgress);
 if (result.fixed > 0) {
 showToast(`${result.fixed} movimentos de pedidos criados${result.skipped > 0 ? `, ${result.skipped} ignorados` : ''}`, 'success');
 } else if (result.skipped > 0) {
 showToast(`${result.skipped} pedidos ignorados (sem items)`, 'warning');
 } else {
 showToast('Nenhum movimento em falta', 'info');
 }
 if (result.errors.length > 0) {
 console.warn('[StockIntegrityModal] Erros ao criar movimentos:', result.errors);
 if (result.errors.length <= 3) {
 showToast(`${result.errors.length} erros: ${result.errors.slice(0, 2).join(', ')}`, 'warning');
 } else {
 showToast(`${result.errors.length} erros durante o processo`, 'warning');
 }
 }
 break;
 case 'purchases':
 result = await stockIntegrityService.fixMissingPurchaseMovements(false, handleProgress);
 if (result.fixed > 0) {
 showToast(`${result.fixed} movimentos de compras criados${result.skipped > 0 ? `, ${result.skipped} ignorados` : ''}`, 'success');
 } else if (result.skipped > 0) {
 showToast(`${result.skipped} compras ignoradas (sem items)`, 'warning');
 } else {
 showToast('Nenhum movimento de compra em falta', 'info');
 }
 if (result.errors.length > 0) {
 console.warn('[StockIntegrityModal] Erros ao criar movimentos de compras:', result.errors);
 }
 break;
 case 'discrepancies':
 result = await stockIntegrityService.fixStockDiscrepancies(false, handleProgress);
 if (result.fixed > 0) {
 showToast(`${result.fixed} discrepâncias de stock corrigidas`, 'success');
 // Mostrar detalhes no console
 console.log('[StockIntegrityModal] Discrepâncias corrigidas:', result.details);
 } else {
 showToast('Nenhuma discrepância para corrigir', 'info');
 }
 if (result.errors.length > 0) {
 console.warn('[StockIntegrityModal] Erros ao corrigir discrepâncias:', result.errors);
 }
 break;
 }
 
 // Recarregar relatório
 setProgress({ stage: 'A actualizar relatório...', current: 0, total: 100 });
 await loadReport();
 onRefresh?.();
 } catch (e: any) {
 showToast(e.message || 'Erro ao corrigir', 'error');
 } finally {
 setFixing(false);
 setSelectedFix(null);
 setProgress(null);
 }
 };

 useEffect(() => {
 if (open && !report) {
 loadReport();
 }
 }, [open]);

 if (!open) return null;

 return (
 <ModalPortal open={open} onClose={onClose}>
 <div className="bg-surface-raised rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <div className="flex items-center gap-2">
 <FileWarning className="w-5 h-5 text-orange-600" />
 <h2 className="text-lg font-semibold text-content-primary">
 Validação de Integridade
 </h2>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={loadReport}
 disabled={loading}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 title="Actualizar"
 >
 <RefreshCw className={`w-5 h-5 text-content-muted ${loading ? 'animate-spin' : ''}`} />
 </button>
 <button
 onClick={onClose}
 className="p-1 hover:bg-surface-base rounded-lg transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-4">
 {(loading || fixing) && progress ? (
 <div className="flex flex-col items-center justify-center py-12">
 <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
 <p className="text-content-secondary mb-2">{progress.stage}</p>
 {/* Barra de progresso */}
 <div className="w-full max-w-xs bg-surface-base rounded-full h-2.5 mb-2">
 <div 
 className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
 style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
 />
 </div>
 <p className="text-xs text-content-muted">{Math.round((progress.current / progress.total) * 100)}%</p>
 {progress.message && (
 <p className="text-xs text-content-muted mt-1">{progress.message}</p>
 )}
 </div>
 ) : loading ? (
 <div className="flex flex-col items-center justify-center py-12">
 <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
 <p className="text-content-secondary">A verificar integridade...</p>
 </div>
 ) : report ? (
 <div className="space-y-4">
 {/* Sumário */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-2xl font-bold text-content-primary">{report.checkedOrders}</p>
 <p className="text-xs text-content-muted">Pedidos</p>
 </div>
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-2xl font-bold text-content-primary">{report.checkedPurchases}</p>
 <p className="text-xs text-content-muted">Compras</p>
 </div>
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-2xl font-bold text-content-primary">{report.checkedMovements}</p>
 <p className="text-xs text-content-muted">Movimentos</p>
 </div>
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-2xl font-bold text-content-primary">{report.checkedProducts}</p>
 <p className="text-xs text-content-muted">Produtos</p>
 </div>
 </div>

 {report.movementCountByType && (
 <p className="text-xs text-content-muted">
 Movimentos por tipo: Pedidos {report.movementCountByType.order}, Compras {report.movementCountByType.purchase}, Ajustes {report.movementCountByType.adjustment} (incl. auditorias)
 {report.movementCountByType.other > 0 ? `, Outros ${report.movementCountByType.other}` : ''}.
 </p>
 )}

 {/* Status geral */}
 {report.summary.totalIssues === 0 ? (
 <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
 <CheckCircle className="w-6 h-6 text-green-500" />
 <div>
 <p className="font-medium text-green-700 dark:text-green-300">Tudo em ordem!</p>
 <p className="text-sm text-green-600 dark:text-green-400">Não foram encontrados problemas de integridade.</p>
 </div>
 </div>
 ) : (
 <>
 {/* Contadores de problemas */}
 <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
 <div className="flex items-center gap-2 mb-2">
 <AlertTriangle className="w-5 h-5 text-orange-500" />
 <p className="font-medium text-orange-700 dark:text-orange-300">
 {report.summary.totalIssues} problema{report.summary.totalIssues !== 1 ? 's' : ''} encontrado{report.summary.totalIssues !== 1 ? 's' : ''}
 </p>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
 <div className="flex items-center gap-1">
 <span className="w-2 h-2 bg-red-500 rounded-full" />
 <span className="text-content-secondary">{report.summary.errors} erros</span>
 </div>
 <div className="flex items-center gap-1">
 <span className="w-2 h-2 bg-yellow-500 rounded-full" />
 <span className="text-content-secondary">{report.summary.warnings} avisos</span>
 </div>
 <div className="flex items-center gap-1">
 <span className="w-2 h-2 bg-blue-500 rounded-full" />
 <span className="text-content-secondary">{report.summary.infos} info</span>
 </div>
 </div>
 </div>

 {/* Ações de correção */}
 <div className="flex flex-wrap gap-2">
 {report.summary.duplicateMovements > 0 && (
 <button
 onClick={() => handleFix('duplicates')}
 disabled={fixing}
 className="px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg flex items-center gap-2 text-sm hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors disabled:opacity-50"
 >
 {fixing && selectedFix === 'duplicates' ? (
 <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Wrench className="w-4 h-4" />
 )}
 Remover {report.summary.duplicateMovements} duplicado{report.summary.duplicateMovements !== 1 ? 's' : ''}
 </button>
 )}
 {report.summary.orphanMovements > 0 && (
 <button
 onClick={() => handleFix('orphans')}
 disabled={fixing}
 className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg flex items-center gap-2 text-sm hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors disabled:opacity-50"
 >
 {fixing && selectedFix === 'orphans' ? (
 <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 Remover {report.summary.orphanMovements} órfão{report.summary.orphanMovements !== 1 ? 's' : ''}
 </button>
 )}
 {/* Botão para criar movimentos de pedidos em falta */}
 {report.issues.some(i => i.type === 'missing_movement' && i.sourceType === 'order') && (
 <button
 onClick={() => handleFix('missing')}
 disabled={fixing}
 className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
 >
 {fixing && selectedFix === 'missing' ? (
 <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Package className="w-4 h-4" />
 )}
 Criar {report.issues.filter(i => i.type === 'missing_movement' && i.sourceType === 'order').length} mov. pedidos
 </button>
 )}
 {/* Botão para criar movimentos de compras em falta */}
 {report.issues.some(i => i.type === 'missing_movement' && i.sourceType === 'purchase') && (
 <button
 onClick={() => handleFix('purchases')}
 disabled={fixing}
 className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-2 text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
 >
 {fixing && selectedFix === 'purchases' ? (
 <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Package className="w-4 h-4" />
 )}
 Criar {report.issues.filter(i => i.type === 'missing_movement' && i.sourceType === 'purchase').length} mov. compras
 </button>
 )}
 {/* Botão para corrigir discrepâncias de stock */}
 {report.summary.stockDiscrepancies > 0 && (
 <button
 onClick={() => handleFix('discrepancies')}
 disabled={fixing}
 className="px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg flex items-center gap-2 text-sm hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
 >
 {fixing && selectedFix === 'discrepancies' ? (
 <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Wrench className="w-4 h-4" />
 )}
 Corrigir {report.summary.stockDiscrepancies} discrepância{report.summary.stockDiscrepancies !== 1 ? 's' : ''}
 </button>
 )}
 </div>

 {/* Lista de problemas */}
 <div className="space-y-2">
 <h3 className="font-medium text-content-primary">Detalhes</h3>
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {report.issues.map((issue, index) => {
 const style = SEVERITY_STYLES[issue.severity];
 return (
 <div
 key={index}
 className={`p-3 rounded-lg border ${style.bg} ${style.border}`}
 >
 <div className="flex items-start gap-2">
 {style.icon}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className={`text-xs font-medium px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
 {ISSUE_TYPE_LABELS[issue.type]}
 </span>
 {issue.sourceType && (
 <span className="text-xs text-content-muted">
 {issue.sourceType === 'order' ? 'Pedido' : 'Compra'}
 </span>
 )}
 </div>
 <p className={`text-sm mt-1 ${style.text}`}>
 {issue.description}
 </p>
 {issue.productName && (
 <p className="text-xs text-content-muted mt-1">
 Produto: {issue.productName}
 </p>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </>
 )}
 </div>
 ) : (
 <div className="text-center py-12 text-content-muted">
 Clique em actualizar para verificar a integridade
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between p-4 border-t border-border-default">
 <p className="text-xs text-content-muted">
 {report && `Gerado: ${new Date(report.generatedAt).toLocaleString('pt-PT')}`}
 </p>
 <button
 onClick={onClose}
 className="px-4 py-2 bg-surface-base hover:bg-surface-base text-content-secondary rounded-lg transition-colors"
 >
 Fechar
 </button>
 </div>
 </div>
 </ModalPortal>
 );
};
