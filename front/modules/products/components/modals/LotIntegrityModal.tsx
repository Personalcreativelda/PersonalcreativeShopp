/**
 * Modal para verificação de integridade de lotes de stock.
 * Detecta lotes antigos com stock inconsistente e lotes duplicados,
 * oferecendo correcção e consolidação automática.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import {
 X,
 AlertTriangle,
 CheckCircle,
 RefreshCw,
 Wrench,
 Layers,
 Package,
 Calendar,
 ShieldCheck,
 Copy,
 Merge
} from 'lucide-react';
import {
 lotIntegrityService,
 LotIntegrityReport,
 LotIntegrityIssue,
 DuplicateLotGroup,
 LotIntegrityProgressCallback
} from '../../services/lotIntegrityService';
import { stockLotsService } from '../../services/stockLotsService';

interface LotIntegrityModalProps {
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

type TabKey = 'stale' | 'duplicates';

export const LotIntegrityModal: React.FC<LotIntegrityModalProps> = ({
 open,
 onClose,
 showToast,
 onRefresh
}) => {
 const [loading, setLoading] = useState(false);
 const [fixing, setFixing] = useState(false);
 const [progress, setProgress] = useState<ProgressState | null>(null);
 const [activeTab, setActiveTab] = useState<TabKey>('duplicates');

 // Stale lots state
 const [staleReport, setStaleReport] = useState<LotIntegrityReport | null>(null);

 // Duplicate lots state
 const [duplicateGroups, setDuplicateGroups] = useState<DuplicateLotGroup[] | null>(null);

 const handleProgress: LotIntegrityProgressCallback = useCallback(
 (stage, current, total, message) => {
 setProgress({ stage, current, total, message });
 },
 []
 );

 const loadAll = async () => {
 setLoading(true);
 setProgress({ stage: 'A verificar integridade...', current: 0, total: 100 });
 try {
 // Run both checks
 const [staleResult, dupResult] = await Promise.all([
 lotIntegrityService.detectStaleLots(handleProgress),
 lotIntegrityService.detectDuplicateLots(handleProgress)
 ]);
 setStaleReport(staleResult);
 setDuplicateGroups(dupResult);

 // Auto-select the tab with most issues
 if (dupResult.length > 0 && staleResult.issues.length === 0) {
 setActiveTab('duplicates');
 } else if (staleResult.issues.length > 0 && dupResult.length === 0) {
 setActiveTab('stale');
 }
 } catch (e: any) {
 showToast('Erro ao verificar integridade dos lotes', 'error');
 console.error('[LotIntegrityModal] loadAll:', e);
 } finally {
 setLoading(false);
 setProgress(null);
 }
 };

 // Fix stale lots
 const handleFixStale = async () => {
 if (!staleReport || staleReport.issues.length === 0) return;
 setFixing(true);
 setProgress({ stage: 'A corrigir...', current: 0, total: 100 });

 try {
 const result = await lotIntegrityService.fixStaleLots(
 staleReport.issues,
 handleProgress
 );
 if (result.fixed > 0) {
 showToast(
 `${result.fixed} lote(s) corrigido(s)${result.errors.length > 0 ? `, ${result.errors.length} erro(s)` : ''}`,
 result.errors.length > 0 ? 'warning' : 'success'
 );
 } else {
 showToast('Nenhum lote para corrigir', 'info');
 }
 setProgress({ stage: 'A actualizar...', current: 0, total: 100 });
 await loadAll();
 onRefresh?.();
 } catch (e: any) {
 showToast(e.message || 'Erro ao corrigir lotes', 'error');
 } finally {
 setFixing(false);
 setProgress(null);
 }
 };

 // Consolidate duplicate lots
 const handleConsolidate = async () => {
 if (!duplicateGroups || duplicateGroups.length === 0) return;
 setFixing(true);
 setProgress({ stage: 'A consolidar...', current: 0, total: 100 });

 try {
 const result = await lotIntegrityService.consolidateDuplicateLots(
 duplicateGroups,
 handleProgress
 );
 if (result.consolidated > 0) {
 showToast(
 `${result.consolidated} grupo(s) consolidado(s), ${result.lotsRemoved} lote(s) removido(s)${result.errors.length > 0 ? `, ${result.errors.length} erro(s)` : ''}`,
 result.errors.length > 0 ? 'warning' : 'success'
 );
 } else {
 showToast('Nenhum duplicado para consolidar', 'info');
 }
 setProgress({ stage: 'A actualizar...', current: 0, total: 100 });
 await loadAll();
 onRefresh?.();
 } catch (e: any) {
 showToast(e.message || 'Erro ao consolidar lotes', 'error');
 } finally {
 setFixing(false);
 setProgress(null);
 }
 };

 useEffect(() => {
 if (open && !staleReport && !duplicateGroups) {
 loadAll();
 }
 }, [open]);

 if (!open) return null;

 const formatDate = (s: string) =>
 s ? new Date(s).toLocaleDateString('pt-PT', { dateStyle: 'short' }) : '—';
 const formatQty = (n: number) =>
 n.toLocaleString('pt-MZ', { minimumFractionDigits: 2 });
 const formatMoney = (n: number) =>
 n.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

 const totalIssues = (staleReport?.summary.issuesFound ?? 0) + (duplicateGroups?.length ?? 0);
 const totalDuplicateLots = duplicateGroups?.reduce((s, g) => s + g.lotCount - 1, 0) ?? 0;

 return (
 <ModalPortal open={open} onClose={onClose}>
 <div className="bg-surface-raised rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <div className="flex items-center gap-2">
 <ShieldCheck className="w-5 h-5 text-emerald-600" />
 <h2 className="text-lg font-semibold text-content-primary">
 Integridade de Lotes
 </h2>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={loadAll}
 disabled={loading || fixing}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 title="Verificar novamente"
 >
 <RefreshCw
 className={`w-5 h-5 text-content-muted ${loading ? 'animate-spin' : ''}`}
 />
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
 <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
 <p className="text-content-secondary mb-2">
 {progress.stage}
 </p>
 <div className="w-full max-w-xs bg-surface-base rounded-full h-2.5 mb-2">
 <div
 className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
 style={{
 width: `${Math.min(100, (progress.current / progress.total) * 100)}%`
 }}
 />
 </div>
 <p className="text-xs text-content-muted">
 {Math.round((progress.current / progress.total) * 100)}%
 </p>
 {progress.message && (
 <p className="text-xs text-content-muted mt-1">{progress.message}</p>
 )}
 </div>
 ) : staleReport || duplicateGroups ? (
 <div className="space-y-4">
 {/* Status geral */}
 {totalIssues === 0 ? (
 <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
 <CheckCircle className="w-6 h-6 text-emerald-500" />
 <div>
 <p className="font-medium text-emerald-700 dark:text-emerald-300">
 Lotes em ordem!
 </p>
 <p className="text-sm text-emerald-600 dark:text-emerald-400">
 Sem lotes inconsistentes nem duplicados.
 </p>
 </div>
 </div>
 ) : (
 <>
 {/* Tabs */}
 <div className="flex border-b border-border-default">
 <button
 onClick={() => setActiveTab('duplicates')}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
 activeTab === 'duplicates'
 ? 'border-blue-500 text-blue-600 dark:text-blue-400'
 : 'border-transparent text-content-muted hover:text-content-secondary '
 }`}
 >
 <span className="flex items-center gap-1.5">
 <Copy className="w-4 h-4" />
 Duplicados
 {(duplicateGroups?.length ?? 0) > 0 && (
 <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
 {duplicateGroups?.length}
 </span>
 )}
 </span>
 </button>
 <button
 onClick={() => setActiveTab('stale')}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
 activeTab === 'stale'
 ? 'border-amber-500 text-amber-600 dark:text-amber-400'
 : 'border-transparent text-content-muted hover:text-content-secondary '
 }`}
 >
 <span className="flex items-center gap-1.5">
 <AlertTriangle className="w-4 h-4" />
 Stock Inconsistente
 {(staleReport?.summary.issuesFound ?? 0) > 0 && (
 <span className="px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
 {staleReport?.summary.issuesFound}
 </span>
 )}
 </span>
 </button>
 </div>

 {/* Tab: Duplicates */}
 {activeTab === 'duplicates' && (
 <div className="space-y-3">
 {duplicateGroups && duplicateGroups.length > 0 ? (
 <>
 <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
 <div className="flex items-center gap-2 mb-1">
 <Copy className="w-4 h-4 text-blue-500" />
 <p className="font-medium text-blue-700 dark:text-blue-300 text-sm">
 {duplicateGroups.length} grupo(s) de lotes duplicados
 ({totalDuplicateLots} lotes redundantes)
 </p>
 </div>
 <p className="text-xs text-blue-600 dark:text-blue-400">
 Lotes com o mesmo produto, variante, factura, custo e data
 serão consolidados num único lote.
 </p>
 </div>

 <button
 onClick={handleConsolidate}
 disabled={fixing}
 className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-2 text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
 >
 {fixing ? (
 <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Merge className="w-4 h-4" />
 )}
 Consolidar {duplicateGroups.length} grupo(s) —
 remover {totalDuplicateLots} duplicado(s)
 </button>

 <div className="space-y-2 max-h-64 overflow-y-auto">
 {duplicateGroups.map((group) => (
 <div
 key={group.key}
 className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
 >
 <div className="flex items-start gap-2">
 <Copy className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-medium text-sm text-content-primary">
 {group.productName}
 </span>
 {group.variantName &&
 group.variantName !== group.productName && (
 <span className="text-xs text-content-muted">
 {group.variantName}
 </span>
 )}
 <span className="px-1.5 py-0.5 text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
 ×{group.lotCount} lotes
 </span>
 </div>
 <div className="flex items-center gap-3 mt-1 text-xs text-content-secondary flex-wrap">
 <span className="flex items-center gap-1">
 <Layers className="w-3 h-3" />
 {group.sourceLabel}
 {group.invoiceNumber && (
 <span className="text-content-muted">
 ({group.invoiceNumber})
 </span>
 )}
 </span>
 <span className="flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 {formatDate(group.receivedAt)}
 </span>
 <span>
 Custo: {formatMoney(group.unitCost)} MTn
 </span>
 </div>
 <div className="mt-1.5 text-sm text-content-secondary">
 Total: {formatQty(group.totalQuantity)} →{' '}
 <span className="text-blue-600 dark:text-blue-400 font-medium">
 será 1 lote de {formatQty(group.totalQuantity)}
 </span>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </>
 ) : (
 <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-emerald-500" />
 <p className="text-sm text-emerald-700 dark:text-emerald-300">
 Nenhum lote duplicado encontrado.
 </p>
 </div>
 )}
 </div>
 )}

 {/* Tab: Stale / Inconsistent */}
 {activeTab === 'stale' && (
 <div className="space-y-3">
 {staleReport && staleReport.issues.length > 0 ? (
 <>
 {/* Sumário */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-xl font-bold text-content-primary">
 {staleReport.summary.totalLotsChecked}
 </p>
 <p className="text-xs text-content-muted">Verificados</p>
 </div>
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-xl font-bold text-content-primary">
 {staleReport.summary.lotsWithStock}
 </p>
 <p className="text-xs text-content-muted">Com Stock</p>
 </div>
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
 {staleReport.summary.issuesFound}
 </p>
 <p className="text-xs text-content-muted">Inconsistentes</p>
 </div>
 <div className="p-3 bg-surface-base/50 rounded-lg text-center">
 <p className="text-xl font-bold text-red-600 dark:text-red-400">
 {formatQty(staleReport.summary.totalExcessStock)}
 </p>
 <p className="text-xs text-content-muted">Excesso</p>
 </div>
 </div>

 <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
 <p className="text-sm text-amber-700 dark:text-amber-300">
 Estes lotes mostram stock que, com base nos movimentos de
 saída, já deveria ter sido consumido.
 </p>
 </div>

 <button
 onClick={handleFixStale}
 disabled={fixing}
 className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg flex items-center gap-2 text-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
 >
 {fixing ? (
 <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
 ) : (
 <Wrench className="w-4 h-4" />
 )}
 Corrigir {staleReport.summary.issuesFound} lote(s)
 — definir stock a 0
 </button>

 <div className="space-y-2 max-h-64 overflow-y-auto">
 {staleReport.issues.map((issue) => (
 <div
 key={issue.lotId}
 className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
 >
 <div className="flex items-start gap-2">
 <Package className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-medium text-sm text-content-primary">
 {issue.productName}
 </span>
 {issue.variantName &&
 issue.variantName !== issue.productName && (
 <span className="text-xs text-content-muted">
 {issue.variantName}
 </span>
 )}
 </div>
 <div className="flex items-center gap-3 mt-1 text-xs text-content-secondary flex-wrap">
 <span className="flex items-center gap-1">
 <Layers className="w-3 h-3" />
 {issue.sourceLabel}
 {issue.invoiceNumber && (
 <span className="text-content-muted">
 ({issue.invoiceNumber})
 </span>
 )}
 </span>
 <span className="flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 {formatDate(issue.receivedAt)}
 </span>
 </div>
 <div className="flex items-center gap-3 mt-1.5 text-sm">
 <span className="text-red-600 dark:text-red-400">
 Actual: {formatQty(issue.currentQuantity)}
 </span>
 <span className="text-content-muted">→</span>
 <span className="text-emerald-600 dark:text-emerald-400">
 Esperado: {formatQty(issue.expectedQuantity)}
 </span>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </>
 ) : (
 <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-emerald-500" />
 <p className="text-sm text-emerald-700 dark:text-emerald-300">
 Nenhum lote com stock inconsistente encontrado.
 </p>
 </div>
 )}
 </div>
 )}
 </>
 )}
 </div>
 ) : (
 <div className="text-center py-12 text-content-muted">
 Clique em actualizar para verificar a integridade dos lotes
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between p-4 border-t border-border-default">
 <p className="text-xs text-content-muted">
 {staleReport &&
 `Verificado: ${new Date(staleReport.generatedAt).toLocaleString('pt-PT')}`}
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
