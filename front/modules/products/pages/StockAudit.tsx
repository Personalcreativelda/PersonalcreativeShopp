/**
 * Página principal de Auditoria de Stock
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus, Eye, Edit, Trash2, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Product, StockAudit, StockAuditStatus, UserRole } from '../../core/types/types';
import { stockAuditService } from '../services/stockAuditService';
import { CreateAuditModal } from '../components/modals/CreateAuditModal';
import { AuditCountModal } from '../components/modals/AuditCountModal';
import { useLanguage } from '../../core/contexts/LanguageContext';
import { useAppAuth } from '../../auth/hooks/useAppAuth';
import { formatDateOnly, formatDateTime } from '../../core/utils/dateUtils';
import { PageShell } from '../../core/components/layout/PageShell';

interface StockAuditProps {
 products: Product[];
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const STATUS_LABELS: Record<StockAuditStatus, string> = {
 [StockAuditStatus.DRAFT]: 'Rascunho',
 [StockAuditStatus.COMPLETED]: 'Completa',
 [StockAuditStatus.APPLIED]: 'Aplicada'
};

const STATUS_ICONS: Record<StockAuditStatus, React.ReactNode> = {
 [StockAuditStatus.DRAFT]: <Clock className="w-4 h-4" />,
 [StockAuditStatus.COMPLETED]: <CheckCircle className="w-4 h-4" />,
 [StockAuditStatus.APPLIED]: <CheckCircle className="w-4 h-4" />
};

const STATUS_COLORS: Record<StockAuditStatus, string> = {
 [StockAuditStatus.DRAFT]: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
 [StockAuditStatus.COMPLETED]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
 [StockAuditStatus.APPLIED]: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
};

export const StockAuditPage: React.FC<StockAuditProps> = ({ products, showToast }) => {
 const navigate = useNavigate();
 const { t } = useLanguage();
 const { currentUser } = useAppAuth();
 const isSuperAdmin = (currentUser as any)?.isSuperAdmin === true || currentUser?.role === UserRole.ADMIN;
 const [audits, setAudits] = useState<StockAudit[]>([]);
 const [loading, setLoading] = useState(true);
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showCountModal, setShowCountModal] = useState(false);
 const [selectedAudit, setSelectedAudit] = useState<StockAudit | null>(null);

 // Status labels usando traduções
 const STATUS_LABELS: Record<StockAuditStatus, string> = {
 [StockAuditStatus.DRAFT]: t.common.draft || 'Rascunho',
 [StockAuditStatus.COMPLETED]: t.stock.completeAudit || 'Completa',
 [StockAuditStatus.APPLIED]: t.common.applied || 'Aplicada'
 };

 useEffect(() => {
 loadAudits();
 }, []);

 const loadAudits = async () => {
 setLoading(true);
 try {
 const data = await stockAuditService.getAudits();
 setAudits(data);
 } catch (error) {
 showToast(t.stock.errorLoadingAudits, 'error');
 } finally {
 setLoading(false);
 }
 };

 const handleDelete = async (audit: StockAudit) => {
 if (audit.status !== StockAuditStatus.DRAFT && !isSuperAdmin) {
 showToast(t.stock.onlyDraftCanDelete, 'warning');
 return;
 }

 const message = audit.status !== StockAuditStatus.DRAFT && isSuperAdmin
 ? (t.stock.confirmDeleteAuditAnyStatus || 'Eliminar esta auditoria? Esta ação não pode ser desfeita.')
 : `${t.stock.confirmDeleteAudit} ${audit.auditDate}?`;
 if (!window.confirm(message)) return;

 const allowAnyStatus = isSuperAdmin && audit.status !== StockAuditStatus.DRAFT;
 const result = await stockAuditService.deleteAudit(audit.id, { allowAnyStatus });
 if (result.success) {
 showToast(t.stock.auditDeleted, 'success');
 loadAudits();
 } else {
 showToast(result.error || t.stock.errorDeletingAudit, 'error');
 }
 };

 const handleOpenCount = (audit: StockAudit) => {
 setSelectedAudit(audit);
 setShowCountModal(true);
 };

 const handleOpenReport = (audit: StockAudit) => {
 navigate(`/admin/stock/auditoria/relatorio/${audit.id}`);
 };

 const formatDate = (dateStr: string) => formatDateOnly(dateStr);
 const formatDateTimeDisplay = (dateStr: string) => formatDateTime(dateStr);

 return (
 <PageShell
 title={t.stock.auditTitle}
 description={t.stock.auditDescription || 'Registe contagens físicas e compare com o sistema'}
 compactHeaderMobile
 actions={
 <button
 onClick={() => setShowCreateModal(true)}
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Plus className="w-4 h-4" />
 {t.stock.startAudit}
 </button>
 }
 >
 {/* Stats Cards */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 <div className="bg-surface-raised rounded-xl p-4 border border-border-default">
 <p className="text-sm text-content-muted">{t.common.total} {t.stock.audit}</p>
 <p className="text-2xl font-bold text-content-primary mt-1">{audits.length}</p>
 </div>
 <div className="bg-surface-raised rounded-xl p-4 border border-border-default">
 <p className="text-sm text-content-muted">{t.common.draft}</p>
 <p className="text-2xl font-bold text-yellow-600 mt-1">
 {audits.filter(a => a.status === StockAuditStatus.DRAFT).length}
 </p>
 </div>
 <div className="bg-surface-raised rounded-xl p-4 border border-border-default">
 <p className="text-sm text-content-muted">{t.common.completed}</p>
 <p className="text-2xl font-bold text-blue-600 mt-1">
 {audits.filter(a => a.status === StockAuditStatus.COMPLETED).length}
 </p>
 </div>
 <div className="bg-surface-raised rounded-xl p-4 border border-border-default">
 <p className="text-sm text-content-muted">{t.common.applied}</p>
 <p className="text-2xl font-bold text-green-600 mt-1">
 {audits.filter(a => a.status === StockAuditStatus.APPLIED).length}
 </p>
 </div>
 </div>

 {/* Audits List */}
 <div className="bg-surface-raised rounded-xl border border-border-default shadow-sm">
 <div className="p-4 border-b border-border-default">
 <h2 className="font-semibold text-content-primary">
 {t.stock.auditHistory || 'Histórico de Auditorias'}
 </h2>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-12">
 <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
 </div>
 ) : audits.length === 0 ? (
 <div className="text-center py-12">
 <ClipboardCheck className="w-12 h-12 text-content-muted mx-auto mb-3" />
 <p className="text-content-secondary">
 {t.stock.noAudits || 'Nenhuma auditoria registada'}
 </p>
 <button
 onClick={() => setShowCreateModal(true)}
 className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 text-sm font-medium"
 >
 <Plus className="w-4 h-4" />
 {t.stock.createFirstAudit || 'Criar Primeira Auditoria'}
 </button>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted">{t.common.date}</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted">{t.common.description}</th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted">{t.common.scope}</th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted">{t.stock.status}</th>
 <th className="px-4 py-3 text-center text-xs font-medium text-content-muted">{t.common.createdAt}</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted">{t.common.actions}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default">
 {audits.map(audit => (
 <tr key={audit.id} className="hover:bg-surface-base transition-colors">
 <td className="px-4 py-3 text-sm font-medium text-content-primary">
 {formatDate(audit.auditDate)}
 </td>
 <td className="px-4 py-3 text-sm text-content-secondary">
 {audit.description || '-'}
 </td>
 <td className="px-4 py-3 text-center">
 <span className="text-xs px-2 py-0.5 bg-surface-base border border-border-default text-content-secondary rounded">
 {audit.scope === 'all' ? t.common.all : audit.scope === 'selected' ? t.common.selected : t.common.category}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[audit.status]}`}>
 {STATUS_ICONS[audit.status]}
 {STATUS_LABELS[audit.status]}
 </span>
 </td>
 <td className="px-4 py-3 text-center text-xs text-content-muted">
 {formatDateTimeDisplay(audit.createdAt)}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-end gap-2">
 {(audit.status === StockAuditStatus.DRAFT || isSuperAdmin) && (
 <button
 onClick={() => handleOpenCount(audit)}
 className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
 title={t.stock.registerCounts || 'Registar contagens'}
 >
 <Edit className="w-4 h-4" />
 </button>
 )}
 {(audit.status === StockAuditStatus.COMPLETED || audit.status === StockAuditStatus.APPLIED) && (
 <button
 onClick={() => handleOpenReport(audit)}
 className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
 title={t.stock.viewReport || 'Ver relatório'}
 >
 <FileText className="w-4 h-4" />
 </button>
 )}
 {(audit.status === StockAuditStatus.DRAFT || isSuperAdmin) && (
 <button
 onClick={() => handleDelete(audit)}
 className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
 title={t.common.delete}
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
 )}
 </div>

 <CreateAuditModal
 open={showCreateModal}
 onClose={() => setShowCreateModal(false)}
 products={products}
 onSuccess={loadAudits}
 showToast={showToast}
 />

 <AuditCountModal
 open={showCountModal}
 onClose={() => {
 setShowCountModal(false);
 setSelectedAudit(null);
 }}
 audit={selectedAudit}
 onSuccess={loadAudits}
 showToast={showToast}
 isSuperAdmin={isSuperAdmin}
 />
 </PageShell>
 );
};
