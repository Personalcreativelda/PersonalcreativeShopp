import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { authService } from '../../auth/services/authService';
import { Logo } from '../../core/components/ui/Logo';

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return Math.min(s, 3);
}

const BAR_COLOR = ['bg-red-500', 'bg-red-500', 'bg-yellow-400', 'bg-green-500'];
const BAR_LABEL = ['', 'Fraca', 'Média', 'Forte'];

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const s = strength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) return setError('Link inválido. Solicite um novo email de recuperação.');
    if (password !== confirm) return setError('As passwords não coincidem.');
    if (s < 2) return setError('A password é demasiado fraca.');

    setLoading(true);
    const { success: ok, error: err } = await (authService as any).applyPasswordReset(token, password);
    setLoading(false);
    if (ok) {
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } else {
      setError(err || 'Erro ao redefinir senha.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-raised rounded-2xl shadow-xl p-8 border border-border-default">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo className="h-8" isDarkMode={document.documentElement.classList.contains('dark')} />
          </div>
          {success ? (
            <div>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-content-primary mb-2">Senha Redefinida!</h1>
              <p className="text-content-muted">A sua senha foi alterada com sucesso. A redirecionar...</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-content-primary mb-1">Nova Senha</h1>
              <p className="text-content-muted text-sm">Escolha uma senha forte para a sua conta</p>
            </>
          )}
        </div>

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {!token && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 p-3 rounded-lg text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                Link inválido ou expirado. Solicite um novo email de recuperação.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-border-strong rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-green-500 outline-none text-sm"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${s >= i ? BAR_COLOR[s] : 'bg-surface-overlay dark:bg-white/[0.1]'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{BAR_LABEL[s]}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-border-strong rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-green-500 outline-none text-sm"
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> A guardar...</> : 'Guardar Nova Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
