
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { type User } from '../../core/types/types';
import { Logo } from '../../core/components/ui/Logo';
import { ForgotPasswordModal } from '../../core/components/modals/ForgotPasswordModal';

const RATE_LIMIT_KEY = 'admin_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const getLoginAttempts = (): { count: number; lockoutUntil: number | null } => {
  const stored = localStorage.getItem(RATE_LIMIT_KEY);
  if (!stored) return { count: 0, lockoutUntil: null };
  try {
    const data = JSON.parse(stored);
    if (data.lockoutUntil && Date.now() > data.lockoutUntil) {
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
  if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
    return { locked: true, remainingTime: Math.ceil((attempts.lockoutUntil - now) / 60000) };
  }
  const newCount = attempts.count + 1;
  if (newCount >= MAX_ATTEMPTS) {
    const lockoutUntil = now + LOCKOUT_DURATION;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: newCount, lockoutUntil }));
    return { locked: true, remainingTime: 15 };
  }
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: newCount, lockoutUntil: null }));
  return { locked: false };
};

const clearLoginAttempts = () => localStorage.removeItem(RATE_LIMIT_KEY);

const sanitizeInput = (input: string): string => input.trim().replace(/[<>]/g, '');

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 254) return false;
  const parts = email.split('@');
  return parts.length === 2 && parts[1].length <= 253;
};

export const AdminLogin = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    const attempts = getLoginAttempts();
    if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
      const remaining = Math.ceil((attempts.lockoutUntil - Date.now()) / 60000);
      setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${remaining} minutos.`);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLockoutMessage(null);

    const attempts = getLoginAttempts();
    if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
      const remaining = Math.ceil((attempts.lockoutUntil - Date.now()) / 60000);
      setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${remaining} minutos.`);
      setLoading(false);
      return;
    }

    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = password.trim();

    if (!sanitizedEmail || !sanitizedPassword) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }
    if (!validateEmail(sanitizedEmail)) {
      setError('Email inválido.');
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
        const isClientOnly =
          user.role === 'CLIENTE' ||
          (Array.isArray(user.roles) && user.roles.length === 1 && user.roles[0] === 'CLIENTE');

        if (isClientOnly) {
          recordFailedAttempt();
          setError('Acesso não autorizado. Esta área é restrita a administradores.');
          setLoading(false);
          return;
        }

        clearLoginAttempts();
        onLogin(user);
        navigate('/admin', { replace: true });
      } else {
        const lockout = recordFailedAttempt();
        if (lockout.locked) {
          setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${lockout.remainingTime} minutos.`);
        } else {
          setError('Credenciais inválidas. Verifique o seu email e senha.');
        }
      }
    } catch {
      const lockout = recordFailedAttempt();
      if (lockout.locked) {
        setLockoutMessage(`Muitas tentativas falhadas. Tente novamente em ${lockout.remainingTime} minutos.`);
      } else {
        setError('Erro ao fazer login. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // "dark" força as variáveis CSS do modo escuro da dashboard (definidas em index.html)
    <div className="dark min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="bg-surface-raised rounded-xl shadow-xl border border-border-default p-7">

          {/* Cabeçalho */}
          <div className="text-center mb-7">
            <div className="mb-3 flex justify-center">
              <Logo height={38} isDarkMode />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-brand-900/30 border border-brand-700/40 text-brand-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <ShieldCheck className="w-3 h-3" />
              Área Administrativa
            </div>
            <h1 className="text-lg font-bold text-content-primary">Acesso ao Painel</h1>
            <p className="text-content-muted text-xs mt-0.5">Restrito a administradores e staff</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1.5">Email</label>
              <input
                id="admin-email"
                name="email"
                autoComplete="email"
                type="email"
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-overlay border border-border-default text-content-primary placeholder-content-muted focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-sm"
                placeholder="admin@empresa.com"
                value={email}
                onChange={(e) => e.target.value.length <= 254 && setEmail(e.target.value)}
                maxLength={254}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1.5">Senha</label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-surface-overlay border border-border-default text-content-primary placeholder-content-muted focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-sm"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => e.target.value.length <= 128 && setPassword(e.target.value)}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-xs text-brand-400 hover:text-brand-300 hover:underline transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>

            {lockoutMessage && (
              <div className="text-orange-400 text-xs bg-orange-900/20 border border-orange-800/40 p-3 rounded-lg text-center">
                {lockoutMessage}
              </div>
            )}

            {error && (
              <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm mt-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Entrar no Painel
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border-default text-center">
            <a
              href="/"
              className="text-xs text-content-muted hover:text-content-secondary transition-colors"
            >
              ← Voltar à loja
            </a>
          </div>
        </div>
      </div>

      {showForgotPasswordModal && (
        <ForgotPasswordModal
          onClose={() => setShowForgotPasswordModal(false)}
          onSuccess={() => setShowForgotPasswordModal(false)}
        />
      )}
    </div>
  );
};
