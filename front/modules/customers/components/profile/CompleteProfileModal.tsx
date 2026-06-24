import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { dataService } from '../../../core/services/dataService';
import { customerProfileService } from '../../services/customerProfileService';
import { Customer } from '../../../core/types/types';
import { Toast } from '../ui/Toast';

interface CompleteProfileModalProps {
 customer: Customer;
 onClose: () => void;
 onSuccess: () => void;
 showToast?: (message: string, type: Toast['type'], duration?: number) => void;
}

export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
 customer,
 onClose,
 onSuccess,
 showToast
}) => {
 const [email, setEmail] = useState(customer.email || '');
 const [address, setAddress] = useState(customer.address || '');
 const [phone, setPhone] = useState(customer.phone || '');
 const [isLoading, setIsLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!email || !address) {
 showToast?.('Email e endereço são obrigaté³rios', 'error');
 return;
 }

 setIsLoading(true);
 try {
 // Atualizar cliente
 const success = await dataService.updateCustomer(customer.id, {
 ...customer,
 email,
 address,
 phone
 });

 if (success) {
 // Registrar açéo de completar perfil
 const actionResult = await customerProfileService.recordAction(
 customer.id,
 'completar_perfil',
 50
 );

 if (actionResult) {
 showToast?.('Perfil completado! Ganhou 50 pontos.', 'success');
 onSuccess();
 onClose();
 } else {
 showToast?.('Perfil atualizado, mas houve erro ao registrar pontos. Tente novamente.', 'warning');
 onSuccess();
 onClose();
 }
 } else {
 showToast?.('Erro ao atualizar perfil. Tente novamente.', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao completar perfil:', error);
 showToast?.(error?.message || 'Erro ao completar perfil. Tente novamente.', 'error');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4 animate-fadeIn">
 <div className="bg-surface-raised rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border-default">
 <h2 className="text-2xl font-bold text-content-primary">
 Completar Perfil
 </h2>
 <button
 onClick={onClose}
 className="p-2 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="p-6 space-y-6">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Email *
 </label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="seu@email.com"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Endereço *
 </label>
 <textarea
 value={address}
 onChange={(e) => setAddress(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="Digite seu endereço completo"
 rows={3}
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Telefone
 </label>
 <input
 type="tel"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="+258 XX XXX XXXX"
 />
 </div>

 {/* Reward info */}
 <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
 <p className="text-sm text-green-800 dark:text-green-300">
 ðŸŽ <strong>Recompensa:</strong> Ao completar seu perfil, vocéª ganharé¡ <strong>50 pontos</strong>!
 </p>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border-default">
 <button
 type="button"
 onClick={onClose}
 className="px-5 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={isLoading}
 className="px-5 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center space-x-2"
 >
 {isLoading ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 <span>Salvando...</span>
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 <span>Salvar e Ganhar Pontos</span>
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};



