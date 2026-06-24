import React, { useState, useCallback } from 'react';
import { Lock, RefreshCw, LogOut } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';

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

interface ForceStrongPasswordModalProps {
  isOpen: boolean;
  userId: string;
  onSuccess: () => void;
  onLogout: () => void;
}

export const ForceStrongPasswordModal: React.FC<ForceStrongPasswordModalProps> = ({
  isOpen,
  userId,
  onSuccess,
  onLogout
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
      setError('As senhas não coincidem.');
      return;
    }
    if (!isSupabaseConfigured() || !supabase) {
      setError('Sistema não configurado. Tente mais tarde.');
      return;
    }
    setIsSubmitting(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão expirada ou inválida. Por favor, termine a sessão e inicie novamente.');
        setIsSubmitting(false);
        return;
      }

      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData.session) session = refreshData.session;

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        if (updateError.message?.toLowerCase().includes('reauthenticate') || (updateError as { code?: string }).code === 'reauthentication_needed') {
          setError('Para definir senha, confirme a sua identidade: termine a sessão, inicie novamente e tente de novo.');
        } else if ((updateError as { code?: string }).code === 'session_expired' || (updateError as { code?: string }).code === 'session_not_found') {
          setError('Sessão expirada. Termine a sessão e inicie novamente.');
        } else {
          setError(updateError.message || 'Erro ao atualizar senha.');
        }
        setIsSubmitting(false);
        return;
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ requires_strong_password: false })
        .eq('id', userId);
      if (profileError) {
        console.warn('Senha atualizada mas falha ao atualizar perfil:', profileError);
        // Ainda assim consideramos sucesso - o utilizador já trocou a senha
      }
      setPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch {
      setError('Erro ao definir senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Definir senha forte
            </h2>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Por segurança, deve definir uma senha forte para continuar a usar o sistema.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Mín. 8 caracteres, maiúsculas, minúsculas, números e símbolos"
              required
              minLength={8}
            />
            {password && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      strength.score === 3 ? 'bg-green-500' : strength.score === 2 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(strength.score / 3) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{strength.label}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmar senha *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Repita a senha"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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
                  A guardar...
                </>
              ) : (
                'Guardar e continuar'
              )}
            </button>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onLogout}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              Terminar sessão
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
