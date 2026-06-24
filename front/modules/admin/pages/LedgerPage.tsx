import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, TrendingUp, TrendingDown, Scale, List,
  RefreshCw, Plus, X, Loader2, ChevronDown, ChevronUp,
  BarChart3, DollarSign, ArrowUpRight, ArrowDownRight, FileText
} from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';
import type { Toast } from '../../core/components/ui/Toast';

interface LedgerPageProps {
  showToast?: (msg: string, type: Toast['type']) => void;
}

interface Account { id: string; code: string; name: string; type: string; isActive: boolean; isSystem: boolean; description?: string; }
interface JournalLine { id: string; accountId: string; accountCode: string; accountName: string; description?: string; debit: number; credit: number; }
interface JournalEntry { id: string; entryNumber?: string; date: string; description?: string; reference?: string; source: string; status: string; totalDebit: number; totalCredit: number; createdByName?: string; createdAt: string; lines: JournalLine[]; }
interface PnL { period: { from: string; to: string }; revenue: number; cogs: number; grossProfit: number; opExpenses: number; operatingProfit: number; grossMargin: number; netMargin: number; prevRevenue: number; revenueGrowth: number | null; monthlyRevenue: { month: string; revenue: number }[]; expensesByAccount: { account: string; code: string; total: number }[]; }
interface BalanceSheet { asOf: string; assets: { cash: number; ar: number; stock: number; total: number }; liabilities: { ap: number; total: number }; equity: { retained: number; total: number }; }
interface AccountBalance { id: string; code: string; name: string; type: string; totalDebit: number; totalCredit: number; balance: number; }

const fmt     = (n: number) => `${Number(n || 0).toFixed(2)} MT`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-MZ') : '—';
const fmtPct  = (n: number | null) => n === null ? '—' : `${n > 0 ? '+' : ''}${n}%`;

const TYPE_LABELS: Record<string, string> = { asset: 'Activo', liability: 'Passivo', equity: 'Capital', revenue: 'Receita', expense: 'Despesa', cogs: 'CMV' };
const TYPE_COLOR: Record<string, string> = {
  asset:     'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  liability: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  equity:    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  revenue:   'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  expense:   'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
  cogs:      'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
};

const TAB = { PNL: 'pnl', BALANCE: 'balance', ACCOUNTS: 'accounts', ENTRIES: 'entries' } as const;
type Tab = typeof TAB[keyof typeof TAB];

const thisYear = new Date().getFullYear();
const today    = new Date().toISOString().slice(0, 10);

// ── Mini bar chart (CSS only) ─────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { month: string; revenue: number }[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="flex items-end gap-1.5 h-24 mt-2">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full rounded-t-sm bg-brand-500/80 dark:bg-brand-400/80 transition-all"
            style={{ height: `${Math.max(4, (d.revenue / max) * 80)}px` }} />
          <span className="text-[9px] text-content-muted truncate w-full text-center">{d.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Add Account Modal ─────────────────────────────────────────────────────────
function AddAccountModal({ onClose, onCreated, showToast }: { onClose: () => void; onCreated: () => void; showToast?: (msg: string, type: Toast['type']) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'expense', description: '' });
  const submit = async () => {
    if (!form.code || !form.name) { showToast?.('Código e nome são obrigatórios', 'error'); return; }
    setSaving(true);
    try { await api.post('/ledger/accounts', form); showToast?.('Conta criada!', 'success'); onCreated(); }
    catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-2xl w-full max-w-md border border-border-default p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-content-primary">Nova Conta</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-content-muted hover:bg-surface-base"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Código *</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="ex: 6950" className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Tipo *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Nome *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome da conta" className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Descrição</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base">Cancelar</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Criar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manual Journal Entry Modal ────────────────────────────────────────────────
function ManualEntryModal({ accounts, onClose, onCreated, showToast }: { accounts: Account[]; onClose: () => void; onCreated: () => void; showToast?: (msg: string, type: Toast['type']) => void }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate]     = useState(today);
  const [description, setDescription] = useState('');
  const [lines, setLines]   = useState([{ accountId: '', description: '', debit: 0, credit: 0 }, { accountId: '', description: '', debit: 0, credit: 0 }]);

  const addLine  = () => setLines(p => [...p, { accountId: '', description: '', debit: 0, credit: 0 }]);
  const removeLine = (i: number) => setLines(p => p.filter((_, j) => j !== i));
  const setLine  = (i: number, k: string, v: any) => setLines(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l));

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  const submit = async () => {
    if (!balanced) { showToast?.('Débitos ≠ Créditos. Lançamento desequilibrado.', 'error'); return; }
    if (lines.some(l => !l.accountId)) { showToast?.('Seleccione uma conta para cada linha', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/ledger/entries', { date, description, lines });
      showToast?.('Lançamento registado!', 'success');
      onCreated();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border-default">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default sticky top-0 bg-surface-raised z-10">
          <h2 className="font-bold text-content-primary flex items-center gap-2"><BookOpen className="w-5 h-5 text-content-muted" />Novo Lançamento Manual</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-content-muted hover:bg-surface-base"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Descrição</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Pagamento de renda" className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
            </div>
          </div>

          {/* Lines table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Linhas do Lançamento</p>
              <button onClick={addLine} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Linha</button>
            </div>
            <div className="border border-border-default rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-surface-base border-b border-border-default">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-muted">Conta</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-muted">Histórico</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-content-muted">Débito</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-content-muted">Crédito</th>
                  <th className="px-2 py-2" />
                </tr></thead>
                <tbody className="divide-y divide-border-default/40">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <select value={l.accountId} onChange={e => setLine(i, 'accountId', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-surface-base text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary">
                          <option value="">— seleccionar —</option>
                          {accounts.filter(a => a.isActive).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.description} onChange={e => setLine(i, 'description', e.target.value)} placeholder="Histórico" className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-surface-base text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} step={0.01} value={l.debit || ''} onChange={e => setLine(i, 'debit', Number(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-surface-base text-xs text-right focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} step={0.01} value={l.credit || ''} onChange={e => setLine(i, 'credit', Number(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-border-default bg-surface-base text-xs text-right focus:ring-2 focus:ring-brand-500 focus:outline-none text-content-primary" />
                      </td>
                      <td className="px-2 py-2">
                        {lines.length > 2 && <button onClick={() => removeLine(i)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X className="w-3 h-3" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-base border-t border-border-default">
                    <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-content-muted">Totais</td>
                    <td className={`px-3 py-2 text-xs font-bold text-right font-mono ${balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>{fmt(totalDebit)}</td>
                    <td className={`px-3 py-2 text-xs font-bold text-right font-mono ${balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>{fmt(totalCredit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {!balanced && totalDebit > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />Desequilíbrio: {fmt(Math.abs(totalDebit - totalCredit))}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base">Cancelar</button>
            <button onClick={submit} disabled={saving || !balanced} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}Registar Lançamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const LedgerPage: React.FC<LedgerPageProps> = ({ showToast }) => {
  const [tab, setTab]               = useState<Tab>(TAB.PNL);
  const [loading, setLoading]       = useState(false);
  const [pnl, setPnl]               = useState<PnL | null>(null);
  const [balance, setBalance]       = useState<BalanceSheet | null>(null);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [acctBalances, setAcctBalances] = useState<AccountBalance[]>([]);
  const [entries, setEntries]       = useState<JournalEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  const [fromDate, setFromDate] = useState(`${thisYear}-01-01`);
  const [toDate, setToDate]     = useState(today);
  const [asOf, setAsOf]         = useState(today);

  const [showAddAccount, setShowAddAccount]   = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === TAB.PNL) {
        const d = await api.get<PnL>(`/ledger/pnl?from=${fromDate}&to=${toDate}`);
        setPnl(d);
      } else if (tab === TAB.BALANCE) {
        const d = await api.get<BalanceSheet>(`/ledger/balance-sheet?asOf=${asOf}`);
        setBalance(d);
      } else if (tab === TAB.ACCOUNTS) {
        const [accts, balances] = await Promise.all([
          api.get<Account[]>('/ledger/accounts'),
          api.get<AccountBalance[]>(`/ledger/account-balances?from=${fromDate}&to=${toDate}`),
        ]);
        setAccounts(accts);
        setAcctBalances(balances);
      } else if (tab === TAB.ENTRIES) {
        const d = await api.get<{ entries: JournalEntry[]; total: number }>(`/ledger/entries?from=${fromDate}&to=${toDate}&limit=100`);
        setEntries(d.entries || []);
        setEntriesTotal(d.total || 0);
      }
    } catch { showToast?.('Erro ao carregar', 'error'); }
    setLoading(false);
  }, [tab, fromDate, toDate, asOf]);

  useEffect(() => { load(); }, [load]);

  const toggleEntry = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const TABS = [
    { id: TAB.PNL,      label: 'P&L', icon: <TrendingUp className="w-4 h-4" /> },
    { id: TAB.BALANCE,  label: 'Balanço', icon: <Scale className="w-4 h-4" /> },
    { id: TAB.ACCOUNTS, label: 'Plano de Contas', icon: <List className="w-4 h-4" /> },
    { id: TAB.ENTRIES,  label: 'Lançamentos', icon: <BookOpen className="w-4 h-4" /> },
  ];

  const groupedAccounts = accounts.reduce((g, a) => { (g[a.type] ||= []).push(a); return g; }, {} as Record<string, Account[]>);
  const balanceMap = Object.fromEntries(acctBalances.map(b => [b.id, b]));

  return (
    <PageShell title="Razão Geral" description="Demonstrações financeiras e plano de contas"
      actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg text-content-muted hover:bg-surface-base" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      } compactHeaderMobile>

      {/* Tabs */}
      <div className="border-b border-border-default -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8 mb-5">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400' : 'border-transparent text-content-muted hover:text-content-primary'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period selector */}
      {tab !== TAB.BALANCE && (
        <div className="flex flex-wrap items-center gap-3 mb-5 bg-surface-raised border border-border-default rounded-xl p-3">
          <span className="text-xs font-medium text-content-muted">Período:</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          <span className="text-content-muted text-xs">até</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          {[{ label: 'Este ano', from: `${thisYear}-01-01`, to: today }, { label: 'Este mês', from: `${today.slice(0,7)}-01`, to: today }, { label: 'Q1', from: `${thisYear}-01-01`, to: `${thisYear}-03-31` }, { label: 'Q2', from: `${thisYear}-04-01`, to: `${thisYear}-06-30` }].map(p => (
            <button key={p.label} onClick={() => { setFromDate(p.from); setToDate(p.to); }} className="px-2.5 py-1 text-xs font-medium border border-border-default rounded-lg text-content-muted hover:bg-surface-base transition-colors">{p.label}</button>
          ))}
        </div>
      )}
      {tab === TAB.BALANCE && (
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-medium text-content-muted">Reportado em:</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
        </div>
      )}

      {loading && <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>}

      {/* ── P&L ── */}
      {!loading && tab === TAB.PNL && pnl && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Receita', value: pnl.revenue, color: 'text-green-600 dark:text-green-400', icon: <TrendingUp className="w-5 h-5 text-green-600" />, sub: pnl.revenueGrowth !== null ? fmtPct(pnl.revenueGrowth) + ' vs ano ant.' : undefined },
              { label: 'CMV', value: pnl.cogs, color: 'text-yellow-600 dark:text-yellow-400', icon: <TrendingDown className="w-5 h-5 text-yellow-600" /> },
              { label: 'Lucro Bruto', value: pnl.grossProfit, color: pnl.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600', icon: <BarChart3 className="w-5 h-5 text-brand-600" />, sub: `Margem: ${pnl.grossMargin}%` },
              { label: 'Resultado Operacional', value: pnl.operatingProfit, color: pnl.operatingProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600', icon: <DollarSign className="w-5 h-5 text-brand-600" />, sub: `Margem líq.: ${pnl.netMargin}%` },
            ].map(k => (
              <div key={k.label} className="bg-surface-raised border border-border-default rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">{k.icon}<span className="text-xs text-content-muted font-medium">{k.label}</span></div>
                <p className={`text-xl font-bold font-mono ${k.color}`}>{fmt(k.value)}</p>
                {k.sub && <p className="text-xs text-content-muted mt-1">{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* P&L Statement + Monthly Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-raised border border-border-default rounded-xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-content-primary mb-4">Demonstração de Resultados</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Receita Total', value: pnl.revenue, bold: false, indent: 0, color: 'text-green-600 dark:text-green-400' },
                  { label: 'Custo das Mercadorias Vendidas', value: -pnl.cogs, bold: false, indent: 1, color: 'text-red-600 dark:text-red-400' },
                  { label: 'Lucro Bruto', value: pnl.grossProfit, bold: true, indent: 0, color: pnl.grossProfit >= 0 ? 'text-content-primary' : 'text-red-600', border: true },
                  { label: 'Despesas Operacionais', value: -pnl.opExpenses, bold: false, indent: 1, color: 'text-orange-600 dark:text-orange-400' },
                  { label: 'Resultado Operacional', value: pnl.operatingProfit, bold: true, indent: 0, color: pnl.operatingProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600', border: true },
                ].map((row, i) => (
                  <div key={i} className={`flex justify-between items-center py-1.5 ${row.border ? 'border-t border-border-default mt-2 pt-2' : ''}`} style={{ paddingLeft: row.indent * 16 }}>
                    <span className={row.bold ? 'font-semibold text-content-primary' : 'text-content-secondary'}>{row.label}</span>
                    <span className={`font-mono ${row.bold ? 'font-bold text-base' : ''} ${row.color}`}>{fmt(Math.abs(row.value))}{row.value < 0 ? ' (-)'  : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-raised border border-border-default rounded-xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-content-primary mb-1">Evolução Mensal da Receita</p>
              {pnl.monthlyRevenue.length > 0 ? <MiniBarChart data={pnl.monthlyRevenue} /> : <p className="text-xs text-content-muted mt-4">Sem dados para o período</p>}

              {pnl.expensesByAccount.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-2">Top Despesas (lançamentos)</p>
                  <div className="space-y-1.5">
                    {pnl.expensesByAccount.slice(0, 5).map(e => {
                      const max = pnl.expensesByAccount[0]?.total || 1;
                      return (
                        <div key={e.code} className="flex items-center gap-2">
                          <span className="text-xs text-content-muted w-8 font-mono shrink-0">{e.code}</span>
                          <div className="flex-1 bg-surface-base rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-orange-500/70" style={{ width: `${(e.total / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-mono text-content-secondary shrink-0">{fmt(e.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BALANCE SHEET ── */}
      {!loading && tab === TAB.BALANCE && balance && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Assets */}
          <div className="bg-surface-raised border border-border-default rounded-xl p-5 shadow-sm">
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" />ACTIVOS</p>
            <div className="space-y-3 text-sm">
              {[{ label: 'Caixa / Banco', value: balance.assets.cash }, { label: 'Contas a Receber (AR)', value: balance.assets.ar }, { label: 'Stock (valor estimado)', value: balance.assets.stock }].map(r => (
                <div key={r.label} className="flex justify-between"><span className="text-content-secondary">{r.label}</span><span className="font-mono font-medium text-content-primary">{fmt(r.value)}</span></div>
              ))}
              <div className="border-t border-border-default pt-3 flex justify-between font-bold">
                <span className="text-blue-600 dark:text-blue-400">Total Activos</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{fmt(balance.assets.total)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities */}
          <div className="bg-surface-raised border border-border-default rounded-xl p-5 shadow-sm">
            <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2"><ArrowDownRight className="w-4 h-4" />PASSIVOS</p>
            <div className="space-y-3 text-sm">
              {[{ label: 'Contas a Pagar (AP)', value: balance.liabilities.ap }].map(r => (
                <div key={r.label} className="flex justify-between"><span className="text-content-secondary">{r.label}</span><span className="font-mono font-medium text-content-primary">{fmt(r.value)}</span></div>
              ))}
              <div className="border-t border-border-default pt-3 flex justify-between font-bold">
                <span className="text-red-600 dark:text-red-400">Total Passivos</span>
                <span className="font-mono text-red-600 dark:text-red-400">{fmt(balance.liabilities.total)}</span>
              </div>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-surface-raised border border-border-default rounded-xl p-5 shadow-sm">
            <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mb-4 flex items-center gap-2"><Scale className="w-4 h-4" />CAPITAL PRÓPRIO</p>
            <div className="space-y-3 text-sm">
              {[{ label: 'Resultado Acumulado', value: balance.equity.retained }].map(r => (
                <div key={r.label} className="flex justify-between"><span className="text-content-secondary">{r.label}</span><span className={`font-mono font-medium ${r.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>{fmt(r.value)}</span></div>
              ))}
              <div className="border-t border-border-default pt-3 flex justify-between font-bold">
                <span className="text-purple-600 dark:text-purple-400">Total Capital</span>
                <span className={`font-mono ${balance.equity.total >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600'}`}>{fmt(balance.equity.total)}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-surface-base rounded-lg border border-border-default">
              <div className="flex justify-between text-xs"><span className="text-content-muted">Activos = Passivos + Capital</span>
                <span className={`font-mono font-bold ${Math.abs(balance.assets.total - balance.liabilities.total - balance.equity.total) < 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                  {fmt(balance.assets.total)} = {fmt(balance.liabilities.total + balance.equity.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNTS ── */}
      {!loading && tab === TAB.ACCOUNTS && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddAccount(true)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg">
              <Plus className="w-4 h-4" />Nova Conta
            </button>
          </div>
          {Object.entries(groupedAccounts).map(([type, accts]) => (
            <div key={type} className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border-default bg-surface-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLOR[type]}`}>{TYPE_LABELS[type]}</span>
                  <span className="text-xs text-content-muted">({accts.length} contas)</span>
                </div>
                <span className="text-xs font-mono font-semibold text-content-primary">
                  Saldo: {fmt(accts.reduce((s, a) => s + (balanceMap[a.id]?.balance || 0), 0))}
                </span>
              </div>
              <div className="divide-y divide-border-default/30">
                {accts.map(a => {
                  const bal = balanceMap[a.id];
                  return (
                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-base transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-content-muted w-12">{a.code}</span>
                        <span className={`text-sm ${a.isActive ? 'text-content-primary' : 'text-content-muted line-through'}`}>{a.name}</span>
                        {a.isSystem && <span className="text-[10px] bg-surface-base border border-border-default rounded px-1.5 text-content-muted">sistema</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        {bal && bal.totalDebit > 0 && <span className="text-blue-600 dark:text-blue-400">D: {fmt(bal.totalDebit)}</span>}
                        {bal && bal.totalCredit > 0 && <span className="text-red-600 dark:text-red-400">C: {fmt(bal.totalCredit)}</span>}
                        {bal && <span className={`font-semibold ${bal.balance >= 0 ? 'text-content-primary' : 'text-red-600'}`}>{fmt(bal.balance)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── JOURNAL ENTRIES ── */}
      {!loading && tab === TAB.ENTRIES && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-content-muted">{entriesTotal} lançamento(s)</p>
            <button onClick={() => setShowManualEntry(true)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg">
              <Plus className="w-4 h-4" />Novo Lançamento
            </button>
          </div>

          {!entries.length ? (
            <div className="py-12 text-center bg-surface-raised border border-border-default rounded-xl">
              <BookOpen className="w-8 h-8 text-content-muted mx-auto mb-2 opacity-40" />
              <p className="text-sm text-content-muted">Nenhum lançamento no período</p>
            </div>
          ) : (
            <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-border-default/40">
                {entries.map(e => (
                  <div key={e.id}>
                    <button onClick={() => toggleEntry(e.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-base transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-content-muted shrink-0">{fmtDate(e.date)}</span>
                        <span className="text-sm font-medium text-content-primary truncate">{e.description || e.reference || '—'}</span>
                        {e.source !== 'manual' && <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded px-1.5">{e.source}</span>}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm font-mono font-semibold text-content-primary">{fmt(e.totalDebit)}</span>
                        {expanded.has(e.id) ? <ChevronUp className="w-4 h-4 text-content-muted" /> : <ChevronDown className="w-4 h-4 text-content-muted" />}
                      </div>
                    </button>
                    {expanded.has(e.id) && e.lines.length > 0 && (
                      <div className="bg-surface-base border-t border-border-default/40 px-4 py-3">
                        <table className="w-full text-xs">
                          <thead><tr><th className="text-left text-content-muted pb-1">Conta</th><th className="text-left text-content-muted pb-1">Histórico</th><th className="text-right text-content-muted pb-1">Débito</th><th className="text-right text-content-muted pb-1">Crédito</th></tr></thead>
                          <tbody className="divide-y divide-border-default/30">
                            {e.lines.map(l => (
                              <tr key={l.id}>
                                <td className="py-1 font-mono text-content-muted">{l.accountCode} · {l.accountName}</td>
                                <td className="py-1 text-content-secondary">{l.description || '—'}</td>
                                <td className="py-1 text-right font-mono text-blue-600 dark:text-blue-400">{l.debit > 0 ? fmt(l.debit) : '—'}</td>
                                <td className="py-1 text-right font-mono text-red-600 dark:text-red-400">{l.credit > 0 ? fmt(l.credit) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddAccount && <AddAccountModal onClose={() => setShowAddAccount(false)} onCreated={() => { setShowAddAccount(false); load(); }} showToast={showToast} />}
      {showManualEntry && <ManualEntryModal accounts={accounts.length ? accounts : []} onClose={() => setShowManualEntry(false)} onCreated={() => { setShowManualEntry(false); load(); }} showToast={showToast} />}
    </PageShell>
  );
};
