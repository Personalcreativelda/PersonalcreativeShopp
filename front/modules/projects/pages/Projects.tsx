import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import {
  FolderKanban, Plus, Loader2, X, Pencil, Trash2,
  CheckCircle2, Circle, Clock, AlertCircle, ChevronRight,
  User, Calendar, Flag,
} from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }

type Project = {
  id: number; name: string; description: string; status: string; priority: string;
  start_date: string; end_date: string; manager_name: string; color: string;
  task_count: number; done_count: number;
};
type Task = {
  id: number; project_id: number; title: string; description: string;
  status: string; priority: string; assigned_name: string; due_date: string; position: number;
};

const STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
const STATUS_LABELS: Record<string, string> = { todo: 'A Fazer', in_progress: 'Em Progresso', review: 'Revisão', done: 'Concluído' };
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  in_progress: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
  review: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800',
  done: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
};
const PROJECT_STATUSES: Record<string, string> = { active: 'Activo', on_hold: 'Em Pausa', completed: 'Concluído', cancelled: 'Cancelado' };

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-lg animate-modal-enter">
        <div className="flex items-center justify-between p-5 border-b border-border-default">
          <h3 className="font-semibold text-content-primary">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Projects({ showToast }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [modal, setModal] = useState<'project' | 'task' | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const [projForm, setProjForm] = useState({ name: '', description: '', status: 'active', priority: 'medium', start_date: '', end_date: '', color: '#635BFF' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '' });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Project[]>('/projects');
      setProjects(data);
    } catch { showToast?.('Erro ao carregar projectos', 'error'); }
    finally { setLoading(false); }
  }, []);

  const loadTasks = useCallback(async (projectId: number) => {
    setLoadingTasks(true);
    try {
      const data = await api.get<Task[]>(`/projects/${projectId}/tasks`);
      setTasks(data);
    } catch { showToast?.('Erro ao carregar tarefas', 'error'); }
    finally { setLoadingTasks(false); }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) loadTasks(selectedProject.id);
  }, [selectedProject, loadTasks]);

  const openProject = (p: Project) => setSelectedProject(p);

  const saveProject = async () => {
    setSaving(true);
    try {
      if (editingProject) await api.put(`/projects/${editingProject.id}`, projForm);
      else await api.post('/projects', projForm);
      showToast?.('Guardado', 'success'); setModal(null); setEditingProject(null); loadProjects();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  const saveTask = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      if (editingTask) await api.put(`/projects/tasks/${editingTask.id}`, taskForm);
      else await api.post(`/projects/${selectedProject.id}/tasks`, taskForm);
      showToast?.('Tarefa guardada', 'success'); setModal(null); setEditingTask(null); loadTasks(selectedProject.id);
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  const moveTask = async (task: Task, newStatus: string) => {
    try {
      await api.put(`/projects/tasks/${task.id}`, { ...task, status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch { showToast?.('Erro ao mover tarefa', 'error'); }
  };

  const deleteTask = async (id: number) => {
    try {
      await api.delete(`/projects/tasks/${id}`);
      showToast?.('Eliminado', 'success');
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch { showToast?.('Erro', 'error'); }
  };

  const deleteProject = async (id: number) => {
    if (!confirm('Eliminar projecto e todas as suas tarefas?')) return;
    try { await api.delete(`/projects/${id}`); showToast?.('Eliminado', 'success'); loadProjects(); setSelectedProject(null); }
    catch { showToast?.('Erro', 'error'); }
  };

  const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  const progress = selectedProject && selectedProject.task_count > 0
    ? Math.round((selectedProject.done_count / selectedProject.task_count) * 100)
    : 0;

  return (
    <PageShell title="Projectos" description="Gestão de projectos e tarefas em kanban"
      actions={
        <button onClick={() => { setEditingProject(null); setProjForm({ name:'', description:'', status:'active', priority:'medium', start_date:'', end_date:'', color:'#635BFF' }); setModal('project'); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Projecto
        </button>
      }>

      {selectedProject ? (
        /* ── KANBAN VIEW ──────────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedProject(null)} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedProject.color }} />
            <h2 className="text-xl font-bold text-content-primary">{selectedProject.name}</h2>
            <span className="ml-auto text-sm text-content-muted">{selectedProject.done_count}/{selectedProject.task_count} tarefas • {progress}%</span>
            <button onClick={() => { setTaskForm({ title:'', description:'', status:'todo', priority:'medium', due_date:'' }); setEditingTask(null); setModal('task'); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Tarefa
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          {loadingTasks ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STATUSES.map(col => (
                <div key={col} className={`rounded-xl border p-3 space-y-2 ${STATUS_COLORS[col]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-content-secondary uppercase tracking-wide">{STATUS_LABELS[col]}</span>
                    <span className="text-xs text-content-muted bg-surface-raised px-1.5 py-0.5 rounded-full">{tasksByStatus(col).length}</span>
                  </div>
                  {tasksByStatus(col).map(task => (
                    <div key={task.id} className="bg-surface-raised rounded-lg p-3 shadow-sm border border-border-default/50 group">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-content-primary leading-snug flex-1">{task.title}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => { setEditingTask(task); setTaskForm({ title: task.title, description: task.description||'', status: task.status, priority: task.priority, due_date: task.due_date?.slice(0,10)||'' }); setModal('task'); }} className="p-1 rounded hover:bg-surface-overlay text-content-muted"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => deleteTask(task.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {task.description && <p className="text-xs text-content-muted mt-1 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Flag className={`w-3 h-3 ${PRIORITY_COLORS[task.priority]}`} />
                        {task.due_date && <span className="text-xs text-content-muted flex items-center gap-0.5"><Calendar className="w-3 h-3" />{task.due_date.slice(0,10)}</span>}
                        {task.assigned_name && <span className="text-xs text-content-muted flex items-center gap-0.5"><User className="w-3 h-3" />{task.assigned_name}</span>}
                      </div>
                      {col !== 'done' && (
                        <select value={task.status} onChange={e => moveTask(task, e.target.value)}
                          className="mt-2 w-full text-xs border border-border-default rounded-md px-1.5 py-1 bg-surface-base text-content-secondary focus:outline-none">
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                  {tasksByStatus(col).length === 0 && (
                    <p className="text-xs text-center text-content-muted py-4">Vazio</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── PROJECTS LIST ────────────────────────────────────────────────── */
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => {
              const prog = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
              return (
                <div key={p.id} className="bg-surface-raised border border-border-default rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => openProject(p)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <h3 className="font-semibold text-content-primary truncate">{p.name}</h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditingProject(p); setProjForm({ name: p.name, description: p.description||'', status: p.status, priority: p.priority, start_date: p.start_date?.slice(0,10)||'', end_date: p.end_date?.slice(0,10)||'', color: p.color||'#635BFF' }); setModal('project'); }} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteProject(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-content-muted mb-3 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between text-xs text-content-muted mb-2">
                    <span>{p.done_count}/{p.task_count} tarefas</span>
                    <span>{prog}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: `${prog}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-overlay text-content-secondary">{PROJECT_STATUSES[p.status]}</span>
                    {p.manager_name && <span className="text-xs text-content-muted">{p.manager_name}</span>}
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && (
              <div className="col-span-3 text-center py-16 text-content-muted">
                <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum projecto criado</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Modal Projecto */}
      {modal === 'project' && (
        <Modal title={editingProject ? 'Editar Projecto' : 'Novo Projecto'} onClose={() => { setModal(null); setEditingProject(null); }}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nome *</label>
              <input value={projForm.name} onChange={e => setProjForm(p=>({...p,name:e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea value={projForm.description} onChange={e => setProjForm(p=>({...p,description:e.target.value}))} rows={2} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Estado</label>
                <select value={projForm.status} onChange={e => setProjForm(p=>({...p,status:e.target.value}))} className={inputCls}>
                  {Object.entries(PROJECT_STATUSES).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prioridade</label>
                <select value={projForm.priority} onChange={e => setProjForm(p=>({...p,priority:e.target.value}))} className={inputCls}>
                  <option value="low">Baixa</option><option value="medium">Média</option>
                  <option value="high">Alta</option><option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Data Início</label>
                <input type="date" value={projForm.start_date} onChange={e => setProjForm(p=>({...p,start_date:e.target.value}))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data Fim</label>
                <input type="date" value={projForm.end_date} onChange={e => setProjForm(p=>({...p,end_date:e.target.value}))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Cor</label>
              <div className="flex items-center gap-3">
                <input type="color" value={projForm.color} onChange={e => setProjForm(p=>({...p,color:e.target.value}))} className="h-9 w-14 rounded cursor-pointer border border-border-default" />
                <span className="text-sm text-content-secondary">{projForm.color}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setModal(null); setEditingProject(null); }} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
              <button onClick={saveProject} disabled={saving || !projForm.name}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tarefa */}
      {modal === 'task' && (
        <Modal title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'} onClose={() => { setModal(null); setEditingTask(null); }}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Título *</label>
              <input value={taskForm.title} onChange={e => setTaskForm(p=>({...p,title:e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea value={taskForm.description} onChange={e => setTaskForm(p=>({...p,description:e.target.value}))} rows={2} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Estado</label>
                <select value={taskForm.status} onChange={e => setTaskForm(p=>({...p,status:e.target.value}))} className={inputCls}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prioridade</label>
                <select value={taskForm.priority} onChange={e => setTaskForm(p=>({...p,priority:e.target.value}))} className={inputCls}>
                  <option value="low">Baixa</option><option value="medium">Média</option>
                  <option value="high">Alta</option><option value="urgent">Urgente</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Data Limite</label>
                <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(p=>({...p,due_date:e.target.value}))} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setModal(null); setEditingTask(null); }} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
              <button onClick={saveTask} disabled={saving || !taskForm.title}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

export default Projects;
