import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, RefreshCw, ChevronRight, Loader2, Gift, Star, Copy, Check, TrendingUp } from 'lucide-react';

const getInitials = (name: string) =>
  (name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

const UserAvatar: React.FC<{ user: any; size?: 'md' | 'lg' }> = ({ user, size = 'lg' }) => {
  const dim = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 overflow-hidden`}
      style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 4px 12px rgba(5,150,105,0.35)' }}
    >
      {user?.avatar
        ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
        : <span>{getInitials(user?.name)}</span>
      }
    </div>
  );
};
import api from '../../core/services/apiClient';
import { Order } from '../../core/types/order';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', processing: 'Em Processamento',
  out_for_delivery: 'A Caminho', delivered: 'Entregue',
  completed: 'Concluído', cancelled: 'Cancelado',
};

interface AffiliateSnippet {
  referral_code: string;
  available_balance: number;
  total_earned: number;
  total_referrals: number;
}

const MEDALS = [
  { label: 'Semente',       emoji: '🌱', min: 0,    max: 99,       gradient: 'from-amber-400 to-yellow-500',   textColor: 'text-amber-700',   bg: 'bg-amber-50 dark:bg-amber-900/20'  },
  { label: 'Raiz',          emoji: '🌿', min: 100,  max: 299,      gradient: 'from-green-400 to-green-500',    textColor: 'text-green-700',   bg: 'bg-green-50 dark:bg-green-900/20'  },
  { label: 'Broto',         emoji: '🌾', min: 300,  max: 699,      gradient: 'from-emerald-400 to-teal-500',   textColor: 'text-teal-700',    bg: 'bg-teal-50 dark:bg-teal-900/20'    },
  { label: 'Flor',          emoji: '🌸', min: 700,  max: 1499,     gradient: 'from-pink-400 to-rose-500',      textColor: 'text-pink-700',    bg: 'bg-pink-50 dark:bg-pink-900/20'    },
  { label: 'Planta Mestre', emoji: '🌳', min: 1500, max: Infinity, gradient: 'from-green-600 to-emerald-700',  textColor: 'text-green-800',   bg: 'bg-green-50 dark:bg-green-900/30'  },
];

const getMedal = (pts: number) => MEDALS.find(m => pts >= m.min && pts <= m.max) || MEDALS[0];
const getNextMedal = (pts: number) => {
  const idx = MEDALS.findIndex(m => pts >= m.min && pts <= m.max);
  return idx < MEDALS.length - 1 ? MEDALS[idx + 1] : null;
};

function PointsCard({ points }: { points: number }) {
  const medal = getMedal(points);
  const next = getNextMedal(points);
  const progress = next ? Math.round(((points - medal.min) / (next.min - medal.min)) * 100) : 100;

  return (
    <div className={`rounded-2xl p-5 shadow-sm border border-border-default ${medal.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-content-primary text-sm">Nível de Fidelidade</span>
        </div>
        <span className="text-2xl">{medal.emoji}</span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className={`text-3xl font-bold bg-gradient-to-r ${medal.gradient} bg-clip-text text-transparent`}>
          {points}
        </span>
        <span className="text-sm text-content-muted mb-1">pontos</span>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${medal.bg} ${medal.textColor} border border-current/20`}>
        {medal.emoji} {medal.label}
      </div>

      {next ? (
        <div>
          <div className="flex justify-between text-xs text-content-muted mb-1">
            <span>{points} pts</span>
            <span>{next.emoji} {next.label} em {next.min - points} pts</span>
          </div>
          <div className="w-full bg-surface-overlay dark:bg-white/[0.1] rounded-full h-2">
            <div
              className={`h-2 rounded-full bg-gradient-to-r ${medal.gradient} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-content-muted mt-1.5">
            1 ponto por cada 10 MT gasto
          </p>
        </div>
      ) : (
        <p className="text-xs font-medium text-green-700 dark:text-green-400">
          🎉 Nível máximo atingido!
        </p>
      )}

      {/* Todas as medalhas */}
      <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-200/60 dark:border-white/[0.06]">
        {MEDALS.map(m => (
          <div
            key={m.label}
            title={`${m.emoji} ${m.label} — ${m.min} pts`}
            className={`flex-1 text-center py-1.5 rounded-lg text-xs transition-all ${
              points >= m.min ? `bg-gradient-to-b ${m.gradient} text-white shadow-sm` : 'bg-surface-overlay text-content-muted opacity-50'
            }`}
          >
            <div>{m.emoji}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CustomerDashboard: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState<AffiliateSnippet | null | false>(null);
  const [copied, setCopied] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);

  useEffect(() => {
    api.get<Order[]>('/orders/my-orders')
      .then(data => setOrders(data.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get<AffiliateSnippet>('/affiliates/me')
      .then(data => setAffiliate(data))
      .catch(() => setAffiliate(false));
    api.get<{ points: number }>('/loyalty/me')
      .then(data => setLoyaltyPoints(data.points || 0))
      .catch(() => {});
  }, []);

  const totalSpent = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const points = loyaltyPoints;

  const copyTracking = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-surface-base py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Cabeçalho */}
        <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
          <div className="flex items-center gap-4">
            <UserAvatar user={currentUser} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-content-muted mb-0.5">Área de Membro</p>
              <h1 className="text-xl font-bold text-content-primary leading-tight">Olá, {currentUser?.name?.split(' ')[0] || 'Cliente'}!</h1>
              <p className="text-sm text-content-muted truncate">{currentUser?.email}</p>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default text-center">
            <ShoppingBag className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-content-primary">{loading ? '—' : orders.length}+</p>
            <p className="text-sm text-content-muted">Encomendas</p>
          </div>
          <div className="bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default text-center">
            <RefreshCw className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-content-primary">{loading ? '—' : totalSpent.toFixed(0)}</p>
            <p className="text-sm text-content-muted">MT gastos</p>
          </div>
        </div>

        {/* Pontos e Medalhas */}
        <PointsCard points={points} />

        {/* Últimas encomendas */}
        <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-default overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
            <h2 className="font-semibold text-content-primary">Últimas Encomendas</h2>
            <button onClick={() => navigate('/minha-conta/encomendas')} className="text-sm text-green-600 dark:text-green-400 hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-content-muted text-sm">Nenhuma encomenda ainda.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map(o => (
                <div
                  key={o.id}
                  onClick={() => navigate(`/minha-conta/encomendas/${o.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-overlay/50 transition-colors text-left cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-content-primary text-sm">Pedido #{o.orderNumber || o.id.slice(0,8)}</p>
                    {o.trackingCode && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-content-muted font-mono">{o.trackingCode}</span>
                        <button
                          onClick={e => { e.stopPropagation(); copyTracking(o.trackingCode!); }}
                          className="text-content-muted hover:text-green-600 transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-content-muted">{new Date(o.createdAt).toLocaleDateString('pt-MZ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-content-primary">{o.totalAmount?.toFixed(2)} MT</p>
                    <span className="text-xs text-gray-500">{STATUS_LABEL[o.status] || o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cartão de afiliado */}
        {affiliate === false ? (
          <button
            onClick={() => navigate('/minha-conta/afiliado')}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white text-left hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <Gift className="w-5 h-5" />
              <span className="font-semibold text-sm">Programa de Afiliados</span>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </div>
            <p className="text-xs text-green-100">Ganha 5% de comissão indicando amigos. Regista-te grátis →</p>
          </button>
        ) : affiliate ? (
          <button
            onClick={() => navigate('/minha-conta/afiliado')}
            className="w-full bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default hover:border-green-500 dark:hover:border-green-500 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-semibold text-sm text-content-primary">Afiliado — {affiliate.referral_code}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-content-primary">{Number(affiliate.total_earned).toFixed(0)} MT</p>
                <p className="text-xs text-gray-500">Ganho</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{Number(affiliate.available_balance).toFixed(0)} MT</p>
                <p className="text-xs text-gray-500">Disponível</p>
              </div>
              <div>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{affiliate.total_referrals}</p>
                <p className="text-xs text-gray-500">Referidos</p>
              </div>
            </div>
          </button>
        ) : null}

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/minha-conta/encomendas')}
            className="flex items-center gap-3 bg-surface-raised rounded-xl p-4 shadow-sm border border-border-default hover:border-green-500 dark:hover:border-green-500 transition-colors text-left"
          >
            <ShoppingBag className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium text-content-primary">As minhas encomendas</span>
          </button>
          <button
            onClick={() => navigate('/minha-conta/reembolsos')}
            className="flex items-center gap-3 bg-surface-raised rounded-xl p-4 shadow-sm border border-border-default hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left"
          >
            <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium text-content-primary">Reembolsos</span>
          </button>
          <button
            onClick={() => navigate('/minha-conta/afiliado')}
            className="col-span-2 flex items-center gap-3 bg-surface-raised rounded-xl p-4 shadow-sm border border-border-default hover:border-green-500 dark:hover:border-green-500 transition-colors text-left"
          >
            <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium text-content-primary">Programa de Afiliados</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
