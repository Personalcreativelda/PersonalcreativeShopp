import React, { useState } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';

interface RequestApprovalModalProps {
 isOpen: boolean;
 onClose: () => void;
 actionType: string;
 entityType: string;
 entityId: string;
 entityData?: any;
 onSubmit: (reason: string) => Promise<void>;
}

/**
 * Modal para solicitar aprovação de ações críticas
 * 
 * @example
 * <RequestApprovalModal
 * isOpen={showModal}
 * onClose={() => setShowModal(false)}
 * actionType="delete_product"
 * entityType="product"
 * entityId={productId}
 * entityData={product}
 * onSubmit={async (reason) => {
 * await requestApproval({ ...params, reason });
 * }}
 * />
 */
export const RequestApprovalModal: React.FC<RequestApprovalModalProps> = ({
 isOpen,
 onClose,
 actionType,
 entityType,
 entityId,
 entityData,
 onSubmit,
}) => {
 const [reason, setReason] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState('');

 if (!isOpen) return null;

 const getActionLabel = (action: string): string => {
 const labels: Record<string, string> = {
 delete_product: 'Apagar Produto',
 delete_sale: 'Apagar Venda',
 delete_customer: 'Apagar Cliente',
 adjust_stock: 'Ajustar Stock',
 high_discount: 'Aplicar Desconto Elevado',
 cancel_sale: 'Cancelar Venda',
 delete_purchase: 'Apagar Compra',
 manage_roles: 'Alterar Roles de Utilizador',
 };
 return labels[action] || action;
 };

 const getEntityLabel = (type: string): string => {
 const labels: Record<string, string> = {
 product: 'Produto',
 sale: 'Venda',
 customer: 'Cliente',
 stock_adjustment: 'Ajuste de Stock',
 purchase: 'Compra',
 user: 'Utilizador',
 };
 return labels[type] || type;
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!reason.trim()) {
 setError('Por favor, forneça uma justificativa para esta solicitação');
 return;
 }

 setIsSubmitting(true);
 setError('');

 try {
 await onSubmit(reason);
 setReason('');
 onClose();
 } catch (err: any) {
 setError(err.message || 'Erro ao enviar solicitação');
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50">
 <div className="bg-surface-raised rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b">
 <h2 className="text-xl font-semibold text-content-primary">
 Solicitar Aprovação
 </h2>
 <button
 onClick={onClose}
 className="text-content-muted hover:text-content-secondary transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Content */}
 <form onSubmit={handleSubmit} className="p-6 space-y-6">
 {/* Alert Info */}
 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
 <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
 <div className="text-sm text-blue-800">
 <p className="font-medium mb-1">Permissão Necessária</p>
 <p>
 Você não tem permissão para executar esta ação diretamente.
 A solicitação será enviada para aprovação de um gestor.
 </p>
 </div>
 </div>

 {/* Action Details */}
 <div className="space-y-3">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Ação Solicitada
 </label>
 <div className="px-4 py-2 bg-surface-base rounded-md text-content-primary">
 {getActionLabel(actionType)}
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Tipo de Entidade
 </label>
 <div className="px-4 py-2 bg-surface-base rounded-md text-content-primary">
 {getEntityLabel(entityType)}
 </div>
 </div>

 {entityData && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Detalhes
 </label>
 <div className="px-4 py-2 bg-surface-base rounded-md text-content-primary text-sm">
 {entityData.name && <p><strong>Nome:</strong> {entityData.name}</p>}
 {entityData.code && <p><strong>Código:</strong> {entityData.code}</p>}
 {entityData.total && <p><strong>Total:</strong> {entityData.total}</p>}
 </div>
 </div>
 )}
 </div>

 {/* Reason Input */}
 <div>
 <label htmlFor="reason" className="block text-sm font-medium text-content-secondary mb-1">
 Justificativa <span className="text-red-500">*</span>
 </label>
 <textarea
 id="reason"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={4}
 className="w-full px-3 py-2 border border-border-default rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
 placeholder="Explique o motivo desta solicitação..."
 required
 />
 <p className="mt-1 text-xs text-content-muted">
 Forneça uma justificativa clara para facilitar a aprovação
 </p>
 </div>

 {/* Error Message */}
 {error && (
 <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
 <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
 <p className="text-sm text-red-800">{error}</p>
 </div>
 )}

 {/* Actions */}
 <div className="flex gap-3 justify-end pt-4 border-t">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-content-secondary bg-surface-raised border border-border-default rounded-md hover:bg-surface-base transition-colors"
 disabled={isSubmitting}
 >
 Cancelar
 </button>
 <button
 type="submit"
 className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 disabled={isSubmitting || !reason.trim()}
 >
 {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
