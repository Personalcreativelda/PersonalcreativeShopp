import React, { useState } from 'react';
import { Check, X, MessageSquare } from 'lucide-react';

interface ApprovalButtonProps {
 approvalId: string;
 onApprove: (approvalId: string, notes?: string) => Promise<void>;
 onReject: (approvalId: string, notes?: string) => Promise<void>;
 compact?: boolean;
}

/**
 * Componente de botões de aprovação/rejeição
 * 
 * @example
 * <ApprovalButton
 * approvalId={approval.id}
 * onApprove={async (id, notes) => await approve(id, notes)}
 * onReject={async (id, notes) => await reject(id, notes)}
 * />
 */
export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
 approvalId,
 onApprove,
 onReject,
 compact = false,
}) => {
 const [showNotesModal, setShowNotesModal] = useState<'approve' | 'reject' | null>(null);
 const [notes, setNotes] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleApprove = async () => {
 setShowNotesModal('approve');
 };

 const handleReject = async () => {
 setShowNotesModal('reject');
 };

 const handleSubmit = async () => {
 setIsSubmitting(true);
 try {
 if (showNotesModal === 'approve') {
 await onApprove(approvalId, notes);
 } else if (showNotesModal === 'reject') {
 await onReject(approvalId, notes);
 }
 setShowNotesModal(null);
 setNotes('');
 } catch (error) {
 console.error('Erro ao processar aprovação:', error);
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <>
 <div className={`flex gap-2 ${compact ? 'flex-col' : ''}`}>
 <button
 onClick={handleApprove}
 className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
 >
 <Check className="w-4 h-4" />
 {!compact && 'Aprovar'}
 </button>
 <button
 onClick={handleReject}
 className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
 >
 <X className="w-4 h-4" />
 {!compact && 'Rejeitar'}
 </button>
 </div>

 {/* Notes Modal */}
 {showNotesModal && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50">
 <div className="bg-surface-raised rounded-lg shadow-xl max-w-md w-full mx-4">
 <div className="p-6">
 <div className="flex items-center gap-3 mb-4">
 <MessageSquare className="w-6 h-6 text-content-secondary" />
 <h3 className="text-lg font-semibold text-content-primary">
 {showNotesModal === 'approve' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
 </h3>
 </div>

 <div className="mb-4">
 <label htmlFor="notes" className="block text-sm font-medium text-content-secondary mb-2">
 Notas {showNotesModal === 'reject' && <span className="text-red-500">*</span>}
 </label>
 <textarea
 id="notes"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={4}
 className="w-full px-3 py-2 border border-border-default rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
 placeholder={
 showNotesModal === 'approve'
 ? 'Adicione notas opcionais...'
 : 'Explique o motivo da rejeição...'
 }
 required={showNotesModal === 'reject'}
 />
 </div>

 <div className="flex gap-3 justify-end">
 <button
 onClick={() => {
 setShowNotesModal(null);
 setNotes('');
 }}
 className="px-4 py-2 text-content-secondary bg-surface-raised border border-border-default rounded-md hover:bg-surface-base transition-colors"
 disabled={isSubmitting}
 >
 Cancelar
 </button>
 <button
 onClick={handleSubmit}
 className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${showNotesModal === 'approve'
 ? 'bg-green-600 hover:bg-green-700'
 : 'bg-red-600 hover:bg-red-700'
 }`}
 disabled={isSubmitting || (showNotesModal === 'reject' && !notes.trim())}
 >
 {isSubmitting ? 'Processando...' : 'Confirmar'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 );
};
