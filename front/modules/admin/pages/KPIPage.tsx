import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, AlertTriangle,
  Package, CreditCard, BarChart2, RefreshCw, Loader2,
} from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }

const fmt = (n: number) => `MT ${Number(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `MT ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `MT ${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

const PERIODS = [
  { label: '7 dias',  days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: '6 meses', days: 180 },
];

function dateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-content-muted">sem dados anteriores</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{value}%
    </span>
  );
}

function KPICard({ label, value, sub, icon, accent, growth }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string; growth?: number | null;
}) {
  return (
    <div className={`bg-surface-raised border border-border-default rounded-xl p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">{label}</span>
        <span className={`p-2 rounded-lg ${accent}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-content-primary">{value}</p>
      <div className="flex items-center gap-2 min-h-[18px]">
        {growth !== undefined && <GrowthBadge value={growth ?? null} />}
        {sub && <span className="text-xs text-content-muted">{sub}</span>}
      </div>
    </div>
  );
}

// Simple CSS bar chart — no external dependency
function BarChart({ data, valueKey, labelKey, color = 'bg-brand-500' }: {
  data: any[]; valueKey: string; labelKey: string; color?: string;
}) {
  if (!data.length) return <p className="text-sm text-content-muted text-center py-6">Sem dados</p>;
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => {
        const pct = Math.round((Number(d[valueKey]) / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-raised border border-border-default text-xs text-content-primary px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              {fmtShort(Number(d[valueKey]))}
            </div>
            <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
              <div className={`w-full rounded-t-md ${color} transition-all`} style={{ height: `${Math.max(pct, 2)}%` }} />
            </div>
            <span className="text-[10px] text-content-muted text-center truncate w-full">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function KPIPage({ showToast }: Props) {
  const [period, setPeriod] = useState(30);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = dateRange(period);
      const data = await api.get<any>(`/reports/kpis?from=${from}&to=${to}`);
      setKpis(data);
    } catch { showToast?.('Erro ao carregar KPIs', 'error'); }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const rev      = kpis?.revenue;
  const orders   = kpis?.orders;
  const ar       = kpis?.ar;
  const trend    = kpis?.trend || [];
  const topCust  = kpis?.topCustomers || [];
  const topProd  = kpis?.topProducts || [];
  const margin   = kpis?.grossMargin;
  const cogs     = kpis?.cogs || 0;
  const alerts   = kpis?.stockAlerts || 0;

  // Format trend months for display
  const trendDisplay = trend.map((t: any) => ({
    ...t,
    label: t.month ? t.month.slice(5) : '',
  }));

  return (
    <PageShell
      title="Painel de KPIs"
      description="Análise avançada de desempenho do negócio"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-base border border-border-default rounded-lg overflow-hidden">
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => setPeriod(p.days)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.days
                    ? 'bg-brand-600 text-white'
                    : 'text-content-muted hover:text-content-primary hover:bg-surface-raised'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 border border-border-default rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-base transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      {loading && !kpis ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : (
        <div className="space-y-6">

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Receita"
              value={fmtShort(rev?.current || 0)}
              sub={`anterior: ${fmtShort(rev?.previous || 0)}`}
              icon={<TrendingUp className="w-4 h-4 text-green-600" />}
              accent="bg-green-50 dark:bg-green-900/20"
              growth={rev?.growth ?? null}
            />
            <KPICard
              label="Encomendas"
              value={String(orders?.count || 0)}
              sub={`${orders?.uniqueCustomers || 0} clientes únicos`}
              icon={<ShoppingBag className="w-4 h-4 text-blue-600" />}
              accent="bg-blue-50 dark:bg-blue-900/20"
              growth={orders?.count && orders?.prevCount
                ? Math.round(((orders.count - orders.prevCount) / orders.prevCount) * 1000) / 10
                : null}
            />
            <KPICard
              label="Valor Médio"
              value={fmtShort(orders?.avgValue || 0)}
              sub={`desc: ${fmtShort(orders?.totalDiscounts || 0)}`}
              icon={<CreditCard className="w-4 h-4 text-purple-600" />}
              accent="bg-purple-50 dark:bg-purple-900/20"
            />
            <KPICard
              label="Margem Bruta"
              value={margin !== null && margin !== undefined ? `${margin}%` : '—'}
              sub={`COGS: ${fmtShort(cogs)}`}
              icon={<BarChart2 className="w-4 h-4 text-orange-600" />}
              accent="bg-orange-50 dark:bg-orange-900/20"
            />
          </div>

          {/* ── Secondary cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="POS"
              value={fmtShort(rev?.pos || 0)}
              sub={`${rev?.current ? Math.round((rev.pos / rev.current) * 100) : 0}% da receita`}
              icon={<ShoppingBag className="w-4 h-4 text-teal-600" />}
              accent="bg-teal-50 dark:bg-teal-900/20"
            />
            <KPICard
              label="Online"
              value={fmtShort(rev?.online || 0)}
              sub={`${rev?.current ? Math.round((rev.online / rev.current) * 100) : 0}% da receita`}
              icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
              accent="bg-indigo-50 dark:bg-indigo-900/20"
            />
            <KPICard
              label="A Receber"
              value={fmtShort(ar?.outstanding || 0)}
              sub={ar?.overdueCount ? `${ar.overdueCount} vencida${ar.overdueCount !== 1 ? 's' : ''}` : 'em dia'}
              icon={<CreditCard className="w-4 h-4 text-red-600" />}
              accent={ar?.overdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}
            />
            <KPICard
              label="Alertas de Stock"
              value={String(alerts)}
              sub={alerts > 0 ? 'produtos abaixo do mínimo' : 'stock OK'}
              icon={<AlertTriangle className="w-4 h-4 text-yellow-600" />}
              accent={alerts > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gray-50 dark:bg-gray-800'}
            />
          </div>

          {/* ── Trend chart ── */}
          {trendDisplay.length > 0 && (
            <div className="bg-surface-raised border border-border-default rounded-xl p-5">
              <h3 className="font-semibold text-content-primary mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-content-muted" />
                Receita Mensal (últimos 6 meses)
              </h3>
              <BarChart data={trendDisplay} valueKey="revenue" labelKey="label" color="bg-brand-500" />
            </div>
          )}

          {/* ── Top tables ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top customers */}
            <div className="bg-surface-raised border border-border-default rounded-xl p-5">
              <h3 className="font-semibold text-content-primary mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-content-muted" />
                Top 5 Clientes
              </h3>
              {topCust.length === 0 ? (
                <p className="text-sm text-content-muted text-center py-6">Sem dados no período</p>
              ) : (
                <div className="space-y-2">
                  {topCust.map((c: any, i: number) => {
                    const pct = rev?.current ? Math.round((c.revenue / rev.current) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-content-muted text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-content-primary truncate">{c.name}</p>
                          <div className="mt-1 h-1.5 bg-surface-base rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-content-primary">{fmtShort(c.revenue)}</p>
                          <p className="text-xs text-content-muted">{c.orders} enc.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top products */}
            <div className="bg-surface-raised border border-border-default rounded-xl p-5">
              <h3 className="font-semibold text-content-primary mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-content-muted" />
                Top 5 Produtos
              </h3>
              {topProd.length === 0 ? (
                <p className="text-sm text-content-muted text-center py-6">Sem dados no período</p>
              ) : (
                <div className="space-y-2">
                  {topProd.map((p: any, i: number) => {
                    const pct = rev?.current ? Math.round((p.revenue / rev.current) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-content-muted text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-content-primary truncate">{p.name || 'Produto'}</p>
                          <div className="mt-1 h-1.5 bg-surface-base rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-content-primary">{fmtShort(p.revenue)}</p>
                          <p className="text-xs text-content-muted">{p.qty} un.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── AR aging summary ── */}
          {ar?.outstanding > 0 && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              ar.overdue > 0
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${ar.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
              <div>
                <p className={`font-semibold text-sm ${ar.overdue > 0 ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                  {ar.overdue > 0
                    ? `${fmt(ar.overdue)} em faturas vencidas (${ar.overdueCount} fatura${ar.overdueCount !== 1 ? 's' : ''})`
                    : `${fmt(ar.outstanding)} a receber — tudo dentro do prazo`}
                </p>
                <p className="text-xs text-content-muted mt-0.5">Total em aberto: {fmt(ar.outstanding)} · Consulte Finanças → Contas a Receber</p>
              </div>
            </div>
          )}

          {/* ── Stock alerts ── */}
          {alerts > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
              <Package className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">
                  {alerts} produto{alerts !== 1 ? 's' : ''} abaixo do stock mínimo
                </p>
                <p className="text-xs text-content-muted mt-0.5">Consulte Stock → Alertas para ver os detalhes e criar requisições de compra</p>
              </div>
            </div>
          )}

        </div>
      )}
    </PageShell>
  );
}
