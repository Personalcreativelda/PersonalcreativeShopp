import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import { Clock, Plus, Loader2, X, Trash2 } from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }
type Entry = { id: number; employee_name: string; project_name: string; task_title: string; date: string; hours: number; description: string; billable: boolean; };
type Employee = { id: number; full_name: string; };
type Project = { id: number; name: string; };

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

export function Timesheets({ showToast }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_id: '', project_id: '', date: new Date().toISOString().slice(0,10), hours: '', description: '', billable: false });

  const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
  const billableHours = entries.filter(e => e.billable).reduce((s, e) => s + Number(e.hours), 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, emp, proj] = await Promise.all([
        api.get<Entry[]>('/projects/timesheets'),
        api.get<Employee[]>('/hr/employees'),
        api.get<Project[]>('/projects'),
      ]);
      setEntries(e); setEmployees(emp); setProjects(proj);
    } catch { showToast?.('Erro ao carregar', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/projects/timesheets', form);
      showToast?.('Registo guardado', 'success'); setModal(false); load();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try { await api.delete(`/projects/timesheets/${id}`); showToast?.('Eliminado', 'success'); load(); }
    catch { showToast?.('Erro', 'error'); }
  };

  return (
    <PageShell title="Planilhas de Horas" description="Registo de horas trabalhadas por projecto e funcionário"
      actions={
        <button onClick={() => { setForm({ employee_id:'', project_id:'', date: new Date().toISOString().slice(0,10), hours:'', description:'', billable:false }); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Novo Registo
        </button>
      }>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Horas', value: totalHours.toFixed(1) + 'h', color: 'text-content-primary' },
          { label: 'Horas Facturáveis', value: billableHours.toFixed(1) + 'h', color: 'text-green-600' },
          { label: 'Registos', value: entries.length, color: 'text-brand-600' },
        ].map(s => (
          <div key={s.label} className="bg-surface-raised border border-border-default rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-content-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-raised rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border-default">
              {['Data', 'Funcionário', 'Projecto', 'Tarefa', 'Horas', 'Descrição', 'Fac.', ''].map(h => (
                <th key={h} className="text-left py-3 px-3 text-xs font-medium text-content-muted">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b border-border-default/50 hover:bg-surface-overlay/50">
                  <td className="py-3 px-3 text-content-secondary">{e.date?.slice(0,10)}</td>
                  <td className="py-3 px-3 font-medium text-content-primary">{e.employee_name || '—'}</td>
                  <td className="py-3 px-3 text-content-secondary">{e.project_name || '—'}</td>
                  <td className="py-3 px-3 text-content-secondary">{e.task_title || '—'}</td>
                  <td className="py-3 px-3 font-medium text-content-primary">{Number(e.hours).toFixed(1)}h</td>
                  <td className="py-3 px-3 text-content-secondary max-w-xs truncate">{e.description || '—'}</td>
                  <td className="py-3 px-3">{e.billable ? <span className="text-green-600 text-xs font-medium">Sim</span> : <span className="text-content-muted text-xs">Não</span>}</td>
                  <td className="py-3 px-3">
                    <button onClick={() => del(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-content-muted">Nenhum registo</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-md animate-modal-enter">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h3 className="font-semibold text-content-primary">Novo Registo de Horas</h3>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Funcionário</label>
                  <select value={form.employee_id} onChange={e => setForm(p=>({...p,employee_id:e.target.value}))} className={inputCls}>
                    <option value="">Seleccionar…</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Projecto</label>
                  <select value={form.project_id} onChange={e => setForm(p=>({...p,project_id:e.target.value}))} className={inputCls}>
                    <option value="">Nenhum</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Horas *</label>
                  <input type="number" step="0.5" min="0.5" max="24" value={form.hours} onChange={e => setForm(p=>({...p,hours:e.target.value}))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Descrição</label>
                <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
                <input type="checkbox" checked={form.billable} onChange={e => setForm(p=>({...p,billable:e.target.checked}))} className="rounded" />
                Factурável ao cliente
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
                <button onClick={save} disabled={saving || !form.hours}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default Timesheets;
