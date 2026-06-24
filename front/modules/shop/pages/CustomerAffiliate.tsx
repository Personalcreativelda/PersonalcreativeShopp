import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Copy, Check, Loader2, Gift, Users, TrendingUp, Clock,
  Download, Smartphone, CreditCard, ExternalLink, Plus, X, AlertCircle
} from 'lucide-react';
import api from '../../core/services/apiClient';

interface AffiliateProfile {
  id: string;
  referral_code: string;
  status: string;
  commission_rate: number;
  total_earned: number;
  pending_balance: number;
  available_balance: number;
  withdrawn_balance: number;
  total_referrals: number;
  created_at: string;
}

interface Commission {
  id: string;
  order_number?: string;
  referred_name?: string;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  account_info: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_notes?: string;
  created_at: string;
}

const STAT_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Pendente',  cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  approved: { label: 'Aprovado',  cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  paid:     { label: 'Pago',      cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
};

const fmt = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });

export const CustomerAffiliate: React.FC = () => {
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wdForm, setWdForm] = useState({ amount: '', method: 'mpesa', accountInfo: '' });
  const [wdLoading, setWdLoading] = useState(false);
  const [wdError, setWdError] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const aff = await api.get<AffiliateProfile>('/affiliates/me').catch(() => null);
      if (aff) {
        setAffiliate(aff);
        const [comms, wds] = await Promise.all([
          api.get<Commission[]>('/affiliates/commissions').catch(() => []),
          api.get<Withdrawal[]>('/affiliates/withdrawals').catch(() => []),
        ]);
        setCommissions(comms);
        setWithdrawals(wds);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      await api.post('/affiliates/join', {});
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Erro ao aderir ao programa');
    } finally {
      setJoining(false);
    }
  };

  const copy = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWdError('');
    const amt = parseFloat(wdForm.amount);
    if (!amt || amt < 100) return setWdError('Valor mínimo: 100 MT');
    if (!wdForm.accountInfo.trim()) return setWdError('Indica a conta de destino');
    if (affiliate && amt > Number(affiliate.available_balance)) return setWdError('Saldo insuficiente');

    setWdLoading(true);
    try {
      await api.post('/affiliates/withdraw', { amount: amt, method: wdForm.method, accountInfo: wdForm.accountInfo });
      setShowWithdraw(false);
      setWdForm({ amount: '', method: 'mpesa', accountInfo: '' });
      await loadAll();
    } catch (err: any) {
      setWdError(err.message || 'Erro ao solicitar levantamento');
    } finally {
      setWdLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-content-muted" />
    </div>
  );

  const referralLink = affiliate ? `${window.location.origin}/?ref=${affiliate.referral_code}` : '';

  return (
    <div className="min-h-screen bg-surface-base py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/minha-conta')} className="p-2 rounded-lg hover:bg-surface-overlay transition-colors text-content-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Programa de Afiliados</h1>
            <p className="text-sm text-content-muted">
              Ganha {affiliate ? `${Number(affiliate.commission_rate).toFixed(0)}%` : '5%'} de comissão por cada compra dos teus referidos
            </p>
          </div>
        </div>

        {!affiliate ? (
          /* ── CTA ────────────────────────────────────────────── */
          <>
            <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-8 text-white shadow-lg">
              <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-5">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-3">Torna-te Afiliado</h2>
              <p className="text-center text-green-100 mb-6 text-sm leading-relaxed">
                Partilha o teu link e ganha <strong>5% de comissão</strong> em cada compra feita pelos teus amigos e seguidores.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  'Regista-te gratuitamente em segundos',
                  'Partilha o teu link único de afiliado',
                  'Recebe comissão automática por cada compra',
                  'Levanta o saldo via M-Pesa ou banco',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-green-50">{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3.5 bg-white text-green-700 font-bold rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Aderir ao Programa Gratuito
              </button>
            </div>

            {/* Como funciona */}
            <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
              <h2 className="font-semibold text-content-primary mb-4">Como Funciona</h2>
              <div className="space-y-4">
                {[
                  { n: '1', title: 'Regista-te', desc: 'Clica em "Aderir" e obtém o teu código de referência único.' },
                  { n: '2', title: 'Partilha o link', desc: 'Partilha nas redes sociais ou envia directamente aos teus amigos.' },
                  { n: '3', title: 'Ganha comissão', desc: 'Cada vez que alguém compra usando o teu código, ganhas 5% do valor.' },
                  { n: '4', title: 'Levanta o saldo', desc: 'Quando tiveres 100 MT ou mais, solicita o levantamento via M-Pesa.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {n}
                    </div>
                    <div>
                      <p className="font-medium text-content-primary text-sm">{title}</p>
                      <p className="text-xs text-content-muted mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── Código de referência ─────────────────────────── */}
            <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="font-semibold text-content-primary">O Teu Código</h2>
                <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${affiliate.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 text-red-700'}`}>
                  {affiliate.status === 'active' ? 'Activo' : 'Suspenso'}
                </span>
              </div>
              <div className="bg-surface-overlay rounded-xl p-4 flex items-center justify-between gap-3 mb-3">
                <span className="text-2xl font-mono font-bold tracking-widest text-content-primary">
                  {affiliate.referral_code}
                </span>
                <button
                  onClick={() => copy(affiliate.referral_code, 'code')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {copied === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === 'code' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <button
                onClick={() => copy(referralLink, 'link')}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-border-default rounded-xl text-sm text-content-muted hover:bg-surface-overlay transition-colors"
              >
                {copied === 'link' ? <Check className="w-4 h-4 text-green-500" /> : <ExternalLink className="w-4 h-4" />}
                {copied === 'link' ? 'Link copiado!' : 'Copiar Link de Referência'}
              </button>
              <p className="text-xs text-content-muted mt-2 text-center truncate">{referralLink}</p>
            </div>

            {/* ── Stats grid ───────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: TrendingUp, color: 'text-green-500', label: 'Total Ganho', value: `${Number(affiliate.total_earned).toFixed(2)} MT` },
                { icon: Clock, color: 'text-yellow-500', label: 'Pendente (rev.)', value: `${Number(affiliate.pending_balance).toFixed(2)} MT` },
                { icon: Download, color: 'text-blue-500', label: 'Disponível', value: `${Number(affiliate.available_balance).toFixed(2)} MT` },
                { icon: Users, color: 'text-purple-500', label: 'Referidos', value: String(affiliate.total_referrals) },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className="bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default">
                  <Icon className={`w-5 h-5 ${color} mb-2`} />
                  <p className="text-xl font-bold text-content-primary">{value}</p>
                  <p className="text-xs text-content-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Levantar saldo ───────────────────────────────── */}
            {Number(affiliate.available_balance) >= 100 && !showWithdraw && (
              <button
                onClick={() => setShowWithdraw(true)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Levantar Saldo — {Number(affiliate.available_balance).toFixed(2)} MT disponível
              </button>
            )}

            {Number(affiliate.available_balance) > 0 && Number(affiliate.available_balance) < 100 && !showWithdraw && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                Precisas de pelo menos 100 MT para levantar. Tens {Number(affiliate.available_balance).toFixed(2)} MT disponível.
              </div>
            )}

            {showWithdraw && (
              <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-content-primary">Solicitar Levantamento</h2>
                  <button onClick={() => { setShowWithdraw(false); setWdError(''); }} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">
                      Valor (MT) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number" min="100" step="0.01"
                      max={Number(affiliate.available_balance)}
                      value={wdForm.amount}
                      onChange={e => setWdForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-border-default bg-surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="100.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Disponível: {Number(affiliate.available_balance).toFixed(2)} MT • Mínimo: 100 MT</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">Método de Pagamento</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([['mpesa', 'M-Pesa', Smartphone], ['bank', 'Banco', CreditCard]] as const).map(([val, lbl, Icon]) => (
                        <button
                          key={val} type="button"
                          onClick={() => setWdForm(f => ({ ...f, method: val }))}
                          className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${wdForm.method === val ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-border-default text-content-muted'}`}
                        >
                          <Icon className="w-4 h-4" />{lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-1">
                      {wdForm.method === 'mpesa' ? 'Número M-Pesa' : 'IBAN / Conta Bancária'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={wdForm.accountInfo}
                      onChange={e => setWdForm(f => ({ ...f, accountInfo: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-border-default bg-surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder={wdForm.method === 'mpesa' ? '+258 84 000 0000' : 'MZ59 0000 0000 0000 0000 000'}
                    />
                  </div>
                  {wdError && <p className="text-sm text-red-500">{wdError}</p>}
                  <button
                    type="submit" disabled={wdLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {wdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Confirmar Levantamento
                  </button>
                </form>
              </div>
            )}

            {/* ── Comissões ────────────────────────────────────── */}
            {commissions.length > 0 && (
              <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-default overflow-hidden">
                <div className="px-5 py-4 border-b border-border-default">
                  <h2 className="font-semibold text-content-primary">Comissões Geradas</h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {commissions.map(c => {
                    const s = STAT_STATUS[c.status];
                    return (
                      <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-content-primary truncate">
                            {c.referred_name ? `Compra de ${c.referred_name}` : `Pedido #${c.order_number || '...'}`}
                          </p>
                          <p className="text-xs text-content-muted">{fmt(c.created_at)} · {Number(c.commission_rate).toFixed(0)}% de {Number(c.order_amount).toFixed(2)} MT</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">+{Number(c.commission_amount).toFixed(2)} MT</p>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${s.cls}`}>{s.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Histórico de levantamentos ───────────────────── */}
            {withdrawals.length > 0 && (
              <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-default overflow-hidden">
                <div className="px-5 py-4 border-b border-border-default">
                  <h2 className="font-semibold text-content-primary">Histórico de Levantamentos</h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {withdrawals.map(w => {
                    const s = STAT_STATUS[w.status];
                    return (
                      <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-content-primary">{w.method.toUpperCase()} — {w.account_info}</p>
                          <p className="text-xs text-content-muted">{fmt(w.created_at)}</p>
                          {w.admin_notes && <p className="text-xs text-content-muted mt-0.5">{w.admin_notes}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-content-primary">{Number(w.amount).toFixed(2)} MT</p>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${s.cls}`}>{s.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {commissions.length === 0 && withdrawals.length === 0 && (
              <div className="text-center py-12 text-content-muted">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Ainda não tens comissões. Partilha o teu código!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerAffiliate;
