import React, { useState, useEffect } from 'react';
import { ModalPortal } from '../ui/ModalPortal';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { User } from '../../../core/types/types';
import { authService } from '../../../auth/services/authService';
import { Logo } from '../ui/Logo';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { SignUpModal } from './SignUpModal';
import { GoogleLogin } from '@react-oauth/google';

interface LoginModalProps {
 onLogin: (identifier: string, password: string) => void;
 onClose: () => void;
 onUserLogin?: (user: User) => void;
 message?: string | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onClose, onUserLogin, message }) => {
 const [identifier, setIdentifier] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [rememberMe, setRememberMe] = useState(false);
 const [googleLoading, setGoogleLoading] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
 const [showSignUpModal, setShowSignUpModal] = useState(false);

 useEffect(() => {
 // Check for saved email in localStorage
 const savedEmail = localStorage.getItem('naturerva_saved_email');
 if (savedEmail) {
 setIdentifier(savedEmail);
 setRememberMe(true);
 }
 }, []);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError('');

 try {
 if (rememberMe) {
 localStorage.setItem('naturerva_saved_email', identifier);
 } else {
 localStorage.removeItem('naturerva_saved_email');
 }

 const { user, error: loginError } = await authService.login(identifier, password);
 if (loginError) {
 setError(loginError);
 } else if (user) {
 if (onUserLogin) onUserLogin(user);
 onClose();
 }
 } catch (e: any) {
 setError(e.message || 'Erro ao fazer login.');
 } finally {
 setLoading(false);
 }
 };

 const handleGoogleSuccess = async (credentialResponse: any) => {
 setGoogleLoading(true);
 setError('');
 try {
 const { user, error: googleError } = await authService.signInWithGoogleCredential(credentialResponse.credential);
 if (user) {
 if (onUserLogin) onUserLogin(user);
 onClose();
 } else {
 setError(googleError || 'Erro ao autenticar com Google.');
 }
 } catch (e: any) {
 setError(e.message || 'Erro ao iniciar login com Google.');
 } finally {
 setGoogleLoading(false);
 }
 };

 return (
 <>
 <ModalPortal open onClose={onClose} zIndex={10000} className="p-4">
 <div className="bg-surface-raised rounded-2xl px-6 sm:px-8 py-5 sm:py-6 max-w-sm w-full mx-auto shadow-2xl border border-border-default animate-scaleIn max-h-[92dvh] overflow-y-auto">
 <div className="text-center mb-3">
 <div className="mb-2 flex justify-center" style={{ maxWidth: '50%', margin: '0 auto' }}>
 <Logo className="h-4" isDarkMode={document.documentElement.classList.contains('dark')} />
 </div>
 <h2 className="text-lg font-bold mb-1 text-content-primary">Entrar</h2>
 <p className="text-content-muted text-xs">Acesse sua conta para continuar</p>
 </div>

 {/* Mensagem explicativa quando login é forçado */}
 {message && (
 <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
 <p className="text-sm text-green-800 dark:text-green-300 text-center">
 {message}
 </p>
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-3">
 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Email ou Telefone
 </label>
 <input
 type="text"
 value={identifier}
 onChange={(e) => setIdentifier(e.target.value)}
 className="w-full px-3.5 py-2.5 text-sm border-2 border-white/20 rounded-lg bg-surface-raised/60 backdrop-blur-md text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 dark:focus:ring-green-400/50 focus:border-green-500/50 dark:focus:border-green-400/50 transition-all shadow-sm"
 placeholder="seu@email.com ou +258..."
 required
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-content-primary mb-1.5">
 Senha
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full px-3.5 py-2.5 pr-10 text-sm border-2 border-white/20 rounded-lg bg-surface-raised/60 backdrop-blur-md text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500/50 dark:focus:ring-green-400/50 focus:border-green-500/50 dark:focus:border-green-400/50 transition-all shadow-sm"
 placeholder="••••••••"
 required
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
 >
 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 <div className="flex items-center justify-between text-xs">
 <div className="flex items-center">
 <input
 id="remember-me-login"
 name="remember-me-login"
 type="checkbox"
 checked={rememberMe}
 onChange={(e) => setRememberMe(e.target.checked)}
 className="h-3.5 w-3.5 text-green-600 focus:ring-green-500 border-border-default rounded cursor-pointer"
 />
 <label htmlFor="remember-me-login" className="ml-1.5 block text-xs text-content-secondary cursor-pointer">
 Lembrar-me
 </label>
 </div>
 <button
 type="button"
 onClick={() => setShowForgotPasswordModal(true)}
 className="text-xs text-green-600 dark:text-green-400 hover:underline"
 >
 Esqueceu a senha?
 </button>
 </div>

 {error && (
 <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg text-center">
 {error}
 </div>
 )}

 <div className="flex space-x-2 pt-1">
 <button
 type="submit"
 disabled={googleLoading || loading}
 className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-2.5 rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl shadow-green-500/30 transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
 >
 {loading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
 Entrando...
 </>
 ) : (
 'Entrar'
 )}
 </button>
 <button
 type="button"
 onClick={onClose}
 className="flex-1 backdrop-blur-md bg-surface-raised/60 border border-white/20 text-content-secondary py-2.5 rounded-lg font-medium text-sm hover:bg-surface-raised/80 transition-all shadow-sm"
 >
 Cancelar
 </button>
 </div>

 {/* Divisor */}
 <div className="relative my-3">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-white/20"></div>
 </div>
 <div className="relative flex justify-center text-xs">
 <span className="px-2 bg-surface-raised/90 text-content-muted">ou</span>
 </div>
 </div>

 {/* Botão Google */}
 {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
 <div className="flex justify-center">
 {googleLoading
 ? <div className="flex items-center gap-2 text-content-muted text-sm py-1"><Loader2 className="w-4 h-4 animate-spin" /> A autenticar...</div>
 : <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Erro ao autenticar com Google.')} useOneTap={false} text="continue_with" shape="rectangular" />
 }
 </div>
 ) : (
 <button type="button" disabled className="w-full bg-surface-base text-content-muted font-medium py-2.5 px-4 rounded-lg border border-border-default flex justify-center items-center gap-2 text-sm opacity-50 cursor-not-allowed">
 <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#9ca3af" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#9ca3af" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#9ca3af" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#9ca3af" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
 Continuar com Google
 </button>
 )}

 <div className="text-center pt-2 border-t border-white/20">
 <p className="text-xs text-content-secondary">
 Não tem uma conta?{' '}
 <button
 type="button"
 onClick={() => setShowSignUpModal(true)}
 className="text-green-600 dark:text-green-400 hover:underline font-medium"
 >
 Criar conta
 </button>
 </p>
 </div>
 </form>
 </div>
 </ModalPortal>

 {showForgotPasswordModal && (
 <ForgotPasswordModal
 onClose={() => setShowForgotPasswordModal(false)}
 onSuccess={() => {
 setError('');
 setShowForgotPasswordModal(false);
 }}
 />
 )}

 {showSignUpModal && (
 <SignUpModal
 onClose={() => setShowSignUpModal(false)}
 onSuccess={(user) => {
 // Usuário já está logado após criar conta
 if (onUserLogin) {
 onUserLogin(user);
 }
 setShowSignUpModal(false);
 onClose();
 }}
 />
 )}
 </>
 );
};
