import React, { useState } from 'react';
import { ModalPortal } from '../ui/ModalPortal';
import { X, Mail, Loader2 } from 'lucide-react';
import { authService } from '../../../auth/services/authService';

interface ForgotPasswordModalProps {
 onClose: () => void;
 onSuccess?: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose, onSuccess }) => {
 const [email, setEmail] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError('');

 const { error: resetError } = await authService.resetPassword(email.trim());

 if (resetError) {
 setError(resetError);
 setLoading(false);
 } else {
 setSuccess(true);
 setLoading(false);
 if (onSuccess) {
 setTimeout(() => {
 onSuccess();
 onClose();
 }, 3000);
 }
 }
 };

 return (
 <ModalPortal open onClose={onClose} zIndex={10001} className="p-4">
 <div className="bg-surface-raised rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 relative animate-scaleIn">
 <button
 onClick={onClose}
 className="absolute top-4 right-4 text-content-muted hover:text-content-secondary transition-colors"
 >
 <X className="w-5 h-5" />
 </button>

 {success ? (
 <div className="text-center py-4">
 <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
 <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
 </div>
 <h2 className="text-2xl font-bold text-content-primary mb-2">
 Email Enviado!
 </h2>
 <p className="text-content-secondary mb-4">
 Enviamos um link de recuperaçéo de senha para <strong>{email}</strong>
 </p>
 <p className="text-sm text-content-muted">
 Verifique sua caixa de entrada e siga as instruçéµes para redefinir sua senha.
 </p>
 </div>
 ) : (
 <>
 <div className="text-center mb-6">
 <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
 <Mail className="w-8 h-8 text-brand-600 dark:text-brand-400" />
 </div>
 <h2 className="text-2xl font-bold text-content-primary mb-2">
 Esqueceu sua senha?
 </h2>
 <p className="text-content-secondary text-sm">
 Digite seu email e enviaremos um link para redefinir sua senha
 </p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Email
 </label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full px-4 py-3 rounded-lg border border-border-default focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
 placeholder="seu@email.com"
 required
 autoFocus
 />
 </div>

 {error && (
 <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center">
 {error}
 </div>
 )}

 <div className="flex space-x-3 pt-2">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 px-4 py-3 rounded-lg border border-border-default text-content-secondary font-medium hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={loading}
 className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
 >
 {loading ? (
 <>
 <Loader2 className="w-5 h-5 animate-spin mr-2" />
 Enviando...
 </>
 ) : (
 'Enviar Link'
 )}
 </button>
 </div>
 </form>
 </>
 )}
 </div>
 </ModalPortal>
 );
};



