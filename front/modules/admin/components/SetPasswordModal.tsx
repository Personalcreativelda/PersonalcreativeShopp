import React, { useState, useCallback } from 'react';
import { Lock, X, RefreshCw } from 'lucide-react';

function getPasswordStrength(p: string): { score: number; label: string } {
 if (!p) return { score: 0, label: 'Fraca' };
 let score = 0;
 if (p.length >= 8) score++;
 if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
 if (/\d/.test(p)) score++;
 if (/[^a-zA-Z0-9]/.test(p)) score++;
 const labels = ['Fraca', 'Média', 'Forte'];
 const idx = Math.min(Math.max(score - 1, 0), 2);
 return { score: Math.min(score, 3), label: labels[idx] };
}

function generateStrongPassword(): string {
 const lower = 'abcdefghijklmnopqrstuvwxyz';
 const upper = lower.toUpperCase();
 const nums = '0123456789';
 const special = '!@#$%&*';
 const all = lower + upper + nums + special;
 let p = '';
 [upper, lower, nums, special].forEach(set => {
 p += set[Math.floor(Math.random() * set.length)];
 });
 for (let i = 4; i < 16; i++) p += all[Math.floor(Math.random() * all.length)];
 return p.split('').sort(() => Math.random() - 0.5).join('');
}

function isStrongPassword(p: string): boolean {
 return getPasswordStrength(p).score >= 3;
}

interface SetPasswordModalProps {
 isOpen: boolean;
 userIds: string[];
 onConfirm: (password: string) => Promise<void>;
 onClose: () => void;
}

export const SetPasswordModal: React.FC<SetPasswordModalProps> = ({
 isOpen,
 userIds,
 onConfirm,
 onClose
}) => {
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState('');

 const strength = getPasswordStrength(password);

 const handleGeneratePassword = useCallback(() => {
 const newPass = generateStrongPassword();
 setPassword(newPass);
 setConfirmPassword(newPass);
 setShowPassword(true);
 setError('');
 }, []);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 if (!password) {
 setError('Introduza uma senha.');
 return;
 }
 if (!isStrongPassword(password)) {
 setError('A senha deve ser forte: mínimo 8 caracteres, com maiúsculas, minúsculas, números e símbolos.');
 return;
 }
 if (password !== confirmPassword) {
 setError('As senhas não coincidem');
 return;
 }
 setIsSubmitting(true);
 try {
 await onConfirm(password);
 setPassword('');
 setConfirmPassword('');
 onClose();
 } catch {
 setError('Erro ao definir senha. Tente novamente.');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleClose = () => {
 if (!isSubmitting) {
 setPassword('');
 setConfirmPassword('');
 setError('');
 onClose();
 }
 };

 if (!isOpen) return null;

 const count = userIds.length;

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50 p-4">
 <div className="bg-surface-raised rounded-xl shadow-xl max-w-md w-full">
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <div className="flex items-center gap-2">
 <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
 <h2 className="text-lg font-bold text-content-primary">
 Definir Senha
 </h2>
 </div>
 <button
 onClick={handleClose}
 disabled={isSubmitting}
 className="text-content-muted hover:text-content-secondary disabled:opacity-50"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <form onSubmit={handleSubmit} className="p-4 space-y-4">
 <p className="text-sm text-content-secondary">
 {count === 1
 ? 'Defina uma nova senha para o usuário selecionado.'
 : `Defina uma nova senha para os ${count} usuários selecionados.`}
 </p>
 <div>
 <div className="flex items-center justify-between gap-2 mb-1">
 <label className="block text-sm font-medium text-content-secondary">
 Nova senha *
 </label>
 <button
 type="button"
 onClick={handleGeneratePassword}
 className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
 title="Gerar senha forte"
 >
 <RefreshCw className="w-3.5 h-3.5" />
 Gerar senha
 </button>
 </div>
 <input
 type={showPassword ? 'text' : 'password'}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="Mín. 8 caracteres, maiúsculas, minúsculas, números e símbolos"
 required
 minLength={8}
 />
 {password && (
 <div className="mt-1.5 flex items-center gap-2">
 <div className="flex-1 h-1.5 bg-surface-base rounded-full overflow-hidden">
 <div
 className={`h-full transition-all ${
 strength.score === 3 ? 'bg-green-500' : strength.score === 2 ? 'bg-yellow-500' : 'bg-red-500'
 }`}
 style={{ width: `${(strength.score / 3) * 100}%` }}
 />
 </div>
 <span className="text-xs text-content-muted">{strength.label}</span>
 </div>
 )}
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Confirmar senha *
 </label>
 <input
 type={showPassword ? 'text' : 'password'}
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="Repita a senha"
 required
 />
 </div>
 <label className="flex items-center gap-2 text-sm text-content-secondary">
 <input
 type="checkbox"
 checked={showPassword}
 onChange={(e) => setShowPassword(e.target.checked)}
 className="rounded"
 />
 Mostrar senha
 </label>
 {error && (
 <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
 )}
 <div className="flex gap-2 pt-2">
 <button
 type="submit"
 disabled={isSubmitting}
 className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {isSubmitting ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
 Aplicar...
 </>
 ) : (
 'Aplicar'
 )}
 </button>
 <button
 type="button"
 onClick={handleClose}
 disabled={isSubmitting}
 className="flex-1 bg-surface-base text-content-secondary py-2 rounded-lg font-medium hover:bg-surface-base disabled:opacity-50"
 >
 Cancelar
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
