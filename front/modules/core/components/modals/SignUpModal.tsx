import React, { useState, useCallback } from 'react';
import { ModalPortal } from '../ui/ModalPortal';
import { X, User, Mail, Lock, Phone, Loader2, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { authService } from '../../../auth/services/authService';
import { User as UserType } from '../../../core/types/types';
import { Logo } from '../ui/Logo';

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
 const { score } = getPasswordStrength(p);
 return score >= 3;
}

interface SignUpModalProps {
 onClose: () => void;
 onSuccess: (user: UserType) => void;
}

export const SignUpModal: React.FC<SignUpModalProps> = ({ onClose, onSuccess }) => {
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [phone, setPhone] = useState('');
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [referralCode, setReferralCode] = useState(() => {
 const params = new URLSearchParams(window.location.search);
 return params.get('ref') || localStorage.getItem('affiliate_ref') || '';
 });
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [copied, setCopied] = useState(false);

 const strength = getPasswordStrength(password);

 const handleGeneratePassword = useCallback(() => {
 const newPass = generateStrongPassword();
 setPassword(newPass);
 setConfirmPassword(newPass);
 setShowPassword(true);
 setShowConfirmPassword(true);
 }, []);

 const handleCopyPassword = useCallback(async () => {
 if (!password) return;
 try {
 await navigator.clipboard.writeText(password);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 } catch {
 setError('Não foi possível copiar a senha.');
 }
 }, [password]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError('');

 if (password !== confirmPassword) {
 setError('As senhas não coincidem.');
 setLoading(false);
 return;
 }

 if (!isStrongPassword(password)) {
 setError('A senha deve ser forte: 8+ caracteres, maiúsculas, minúsculas, números e símbolos.');
 setLoading(false);
 return;
 }

 const phoneDigits = phone.replace(/\D/g, '');
 if (phoneDigits.length < 9) {
 setError('O telefone deve ter pelo menos 9 dígitos.');
 setLoading(false);
 return;
 }

 const { user, error: signUpError } = await authService.signUp(
 name.trim(),
 email.trim(),
 password,
 phone.trim(),
 referralCode.trim() || undefined
 );

 if (user) {
 if (referralCode) localStorage.removeItem('affiliate_ref');
 onSuccess(user);
 onClose();
 } else {
 setError(signUpError || 'Erro ao criar conta.');
 setLoading(false);
 }
 };

 return (
 <ModalPortal open onClose={onClose} zIndex={10001} className="p-4">
 <div className="bg-surface-raised rounded-2xl shadow-2xl max-w-md w-full mx-auto max-h-[92dvh] overflow-y-auto border border-border-default animate-scaleIn relative">
 <button
 onClick={onClose}
 className="absolute top-4 right-4 text-content-muted hover:text-content-secondary transition-colors z-10"
 >
 <X className="w-4 h-4" />
 </button>

 <div className="px-6 sm:px-8 py-5 sm:py-6">
 <div className="text-center mb-3">
 <div className="mb-2 flex justify-center" style={{ maxWidth: '50%', margin: '0 auto' }}>
 <Logo className="h-4" isDarkMode={document.documentElement.classList.contains('dark')} />
 </div>
 <h2 className="text-lg font-bold text-content-primary mb-1">
 Criar Conta
 </h2>
 <p className="text-content-muted text-xs">
 Preencha os dados para criar sua conta
 </p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-3">
 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Nome Completo
 </label>
 <div className="relative">
 <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
 placeholder="Seu nome completo"
 required
 minLength={2}
 autoFocus
 />
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Email
 </label>
 <div className="relative">
 <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
 placeholder="seu@email.com"
 required
 />
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Telefone
 </label>
 <div className="relative">
 <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="tel"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
 placeholder="+258 84 123 4567"
 required
 />
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Código de Afiliado <span className="text-content-muted font-normal">(opcional)</span>
 </label>
 <input
 type="text"
 value={referralCode}
 onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
 className="w-full px-3.5 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all font-mono tracking-wider"
 placeholder="Ex: EKSO1234"
 maxLength={10}
 />
 <p className="text-[10px] text-content-muted mt-1">Se alguém te indicou, introduz o código para lhes atribuir crédito.</p>
 </div>

 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Senha
 </label>
 <div className="space-y-2">
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type={showPassword ? 'text' : 'password'}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full pl-9 pr-10 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
 placeholder="••••••••"
 required
 minLength={8}
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
 >
 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 <button
 type="button"
 onClick={handleGeneratePassword}
 className="px-2 py-2.5 rounded-lg border border-border-default text-content-secondary hover:bg-surface-base transition-colors flex items-center gap-1"
 title="Gerar senha forte"
 >
 <RefreshCw className="w-4 h-4" />
 <span className="text-xs hidden sm:inline">Gerar</span>
 </button>
 <button
 type="button"
 onClick={handleCopyPassword}
 disabled={!password}
 className="px-2 py-2.5 rounded-lg border border-border-default text-content-secondary hover:bg-surface-base disabled:opacity-50 transition-colors flex items-center gap-1"
 title="Copiar senha"
 >
 <Copy className="w-4 h-4" />
 {copied ? <span className="text-xs text-green-600">Copiado!</span> : <span className="text-xs hidden sm:inline">Copiar</span>}
 </button>
 </div>
 {password && (
 <div className="flex items-center gap-2">
 <div className="flex-1 h-1.5 bg-surface-base rounded-full overflow-hidden flex">
 <div
 className={`h-full transition-all ${
 strength.score === 1 ? 'bg-red-500' :
 strength.score === 2 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${(strength.score / 3) * 100}%` }}
 />
 </div>
 <span className={`text-xs font-medium ${
 strength.score === 1 ? 'text-red-600 dark:text-red-400' :
 strength.score === 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
 }`}>
 {strength.label}
 </span>
 </div>
 )}
 <p className="text-[10px] text-content-muted">
 Mín. 8 caracteres, maiúsculas, minúsculas, números e símbolos
 </p>
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Confirmar Senha
 </label>
 <div className="relative">
 <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type={showConfirmPassword ? 'text' : 'password'}
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 className="w-full pl-9 pr-10 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
 placeholder="••••••••"
 required
 minLength={8}
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
 >
 {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 {error && (
 <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg text-center">
 {error}
 </div>
 )}

 <div className="flex space-x-2 pt-1">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 border border-border-default text-content-secondary py-2.5 rounded-lg font-medium text-sm hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={loading}
 className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-2.5 rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
 >
 {loading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
 Criando...
 </>
 ) : (
 'Criar Conta'
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 </ModalPortal>
 );
};
