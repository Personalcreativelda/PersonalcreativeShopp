
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLanguage } from '../../core/contexts/LanguageContext';
import { Logo } from '../../core/components/ui/Logo';
import { authService } from '../../auth/services/authService';
import { GoogleLogin } from '@react-oauth/google';
import { ForgotPasswordModal } from '../../core/components/modals/ForgotPasswordModal';
import { SignUpModal } from '../../core/components/modals/SignUpModal';
import { type User } from '../../core/types/types';

// Rate limiting para prevenir brute force
const RATE_LIMIT_KEY = 'quintanicy_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos em milissegundos

const getLoginAttempts = (): { count: number; lockoutUntil: number | null } => {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) return { count: 0, lockoutUntil: null };

    try {
        const data = JSON.parse(stored);
        const now = Date.now();

        // Se o lockout expirou, resetar
        if (data.lockoutUntil && now > data.lockoutUntil) {
            localStorage.removeItem(RATE_LIMIT_KEY);
            return { count: 0, lockoutUntil: null };
        }

        return data;
    } catch {
        return { count: 0, lockoutUntil: null };
    }
};

const recordFailedAttempt = (): { locked: boolean; remainingTime?: number } => {
    const attempts = getLoginAttempts();
    const now = Date.now();

    // Se esté¡ em lockout, retornar tempo restante
    if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
        const remainingTime = Math.ceil((attempts.lockoutUntil - now) / 1000 / 60);
        return { locked: true, remainingTime };
    }

    const newCount = attempts.count + 1;

    if (newCount >= MAX_ATTEMPTS) {
        const lockoutUntil = now + LOCKOUT_DURATION;
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: newCount, lockoutUntil }));
        return { locked: true, remainingTime: LOCKOUT_DURATION / 1000 / 60 };
    }

    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: newCount, lockoutUntil: null }));
    return { locked: false };
};

const clearLoginAttempts = () => {
    localStorage.removeItem(RATE_LIMIT_KEY);
};

// Sanitizar input para prevenir XSS
const sanitizeInput = (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
};

// Validar email de forma mais rigorosa
const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;

    // Verificar comprimento mé¡ximo
    if (email.length > 254) return false;

    // Verificar domé­nio vé¡lido
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    if (parts[1].length > 253) return false;

    return true;
};

export const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const isGoogleConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [showSignUpModal, setShowSignUpModal] = useState(false);
    const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);

    useEffect(() => {
        // Check for saved email in localStorage
        const savedEmail = localStorage.getItem('quintanicy_saved_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }

        // Verificar se esté¡ em lockout
        const attempts = getLoginAttempts();
        if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
            const remainingTime = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
            setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${remainingTime} minutos.`);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setLockoutMessage(null);

        // Verificar rate limiting
        const attempts = getLoginAttempts();
        if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
            const remainingTime = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
            setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${remainingTime} minutos.`);
            setLoading(false);
            return;
        }

        // Validar e sanitizar inputs
        const sanitizedEmail = sanitizeInput(email);
        const sanitizedPassword = password.trim();

        if (!sanitizedEmail || !sanitizedPassword) {
            setError('Por favor, preencha todos os campos.');
            setLoading(false);
            return;
        }

        if (!validateEmail(sanitizedEmail)) {
            setError('Email invé¡lido. Por favor, verifique e tente novamente.');
            setLoading(false);
            return;
        }

        if (sanitizedPassword.length < 6) {
            setError('Senha deve ter pelo menos 6 caracteres.');
            setLoading(false);
            return;
        }

        try {
            const { user, error: loginError } = await authService.signIn(sanitizedEmail, sanitizedPassword);

            if (user) {
                // Limpar tentativas de login em caso de sucesso
                clearLoginAttempts();

                // Handle Remember Me
                if (rememberMe) {
                    localStorage.setItem('quintanicy_saved_email', sanitizedEmail);
                } else {
                    localStorage.removeItem('quintanicy_saved_email');
                }
                onLogin(user);
            } else {
                // Registrar tentativa falhada
                const lockout = recordFailedAttempt();
                if (lockout.locked) {
                    setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${lockout.remainingTime} minutos.`);
                }

                // Mensagem gené©rica para néo expor Informações sensé­veis
                setError('Credenciais invé¡lidas. Verifique seu email e senha e tente novamente.');
            }
        } catch (e) {
            // Registrar tentativa falhada
            const lockout = recordFailedAttempt();
            if (lockout.locked) {
                setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${lockout.remainingTime} minutos.`);
            }

            // Mensagem gené©rica
            setError('Erro ao fazer login. Tente novamente mais tarde.');
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
                onLogin(user);
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in-up border border-gray-100 dark:border-gray-700">
                <div className="text-center mb-8">
                    <div className="mb-4 flex justify-center">
                        <Logo className="h-10" isDarkMode={document.documentElement.classList.contains('dark')} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.ui.quintaNicy}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t.ui.systemTitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.auth.email}</label>
                        <input
                            id="email"
                            name="email"
                            autoComplete="email"
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Limitar comprimento e prevenir caracteres perigosos
                                if (value.length <= 254) {
                                    setEmail(value);
                                }
                            }}
                            maxLength={254}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.auth.password}</label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                autoComplete="current-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
                                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
                                value={password}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    // Limitar comprimento da senha
                                    if (value.length <= 128) {
                                        setPassword(value);
                                    }
                                }}
                                maxLength={128}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                {t.auth.rememberMe}
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowForgotPasswordModal(true)}
                            className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                        >
                            Esqueceu a senha?
                        </button>
                    </div>

                    {lockoutMessage && (
                        <div className="text-orange-600 dark:text-orange-400 text-sm bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg text-center border border-orange-200 dark:border-orange-800">
                            {lockoutMessage}
                        </div>
                    )}

                    {error && (
                        <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.auth.enterSystem}
                    </button>
                </form>

                {/* Divisor */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">ou</span>
                    </div>
                </div>

                {/* Botão Google */}
                {isGoogleConfigured ? (
                  <div className="flex justify-center">
                    {googleLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 py-2"><Loader2 className="w-5 h-5 animate-spin" /> A autenticar...</div>
                    ) : (
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Erro ao iniciar login com Google.')}
                        useOneTap={false}
                        text="continue_with"
                        shape="rectangular"
                        width="100%"
                      />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 font-medium py-3 px-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 flex justify-center items-center gap-3 cursor-not-allowed opacity-50"
                    title="Configure VITE_GOOGLE_CLIENT_ID para activar"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#9ca3af" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#9ca3af" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#9ca3af" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#9ca3af" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continuar com Google</span>
                  </button>
                )}

                <div className="mt-6 text-center pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Néo tem uma conta?{' '}
                        <button
                            type="button"
                            onClick={() => setShowSignUpModal(true)}
                            className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                        >
                            Criar conta
                        </button>
                    </p>
                </div>
            </div>

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
                        onLogin(user);
                        setShowSignUpModal(false);
                    }}
                />
            )}
        </div>
    );
};


