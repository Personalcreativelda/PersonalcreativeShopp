import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Eye, Globe, FileText, Image, X, Save, Loader2, Tag, RefreshCw } from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';
import { RichTextEditor } from '../components/RichTextEditor';

interface BlogPost {
 id: string;
 title: string;
 slug: string;
 summary?: string;
 content?: string;
 coverImage?: string;
 authorName?: string;
 status: 'draft' | 'published';
 tags: string[];
 views: number;
 publishedAt?: string;
 createdAt: string;
}

const EMPTY_FORM = { title: '', summary: '', content: '', tags: '', status: 'draft' as const, coverImageData: '' };

export const Blog: React.FC<{ showToast: (m: string, t: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
 const [posts, setPosts] = useState<BlogPost[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editing, setEditing] = useState<BlogPost | null>(null);
 const [form, setForm] = useState(EMPTY_FORM);
 const [coverPreview, setCoverPreview] = useState('');
 const [saving, setSaving] = useState(false);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const fileRef = useRef<HTMLInputElement>(null);

 const load = async () => {
 setLoading(true);
 try { setPosts(await api.get<BlogPost[]>('/blog')); }
 catch { showToast('Erro ao carregar posts', 'error'); }
 finally { setLoading(false); }
 };

 useEffect(() => { load(); }, []);

 const openNew = () => {
 setEditing(null);
 setForm(EMPTY_FORM);
 setCoverPreview('');
 setShowForm(true);
 };

 const openEdit = (p: BlogPost) => {
 setEditing(p);
 setForm({ title: p.title, summary: p.summary || '', content: p.content || '', tags: p.tags.join(', '), status: p.status, coverImageData: '' });
 setCoverPreview(p.coverImage || '');
 setShowForm(true);
 };

 const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 const reader = new FileReader();
 reader.onload = ev => {
 const data = ev.target?.result as string;
 setForm(f => ({ ...f, coverImageData: data }));
 setCoverPreview(data);
 };
 reader.readAsDataURL(file);
 e.target.value = '';
 };

 const handleSave = async () => {
 if (!form.title.trim()) return showToast('Título obrigatório', 'error');
 setSaving(true);
 try {
 const payload = {
 title: form.title,
 summary: form.summary,
 content: form.content,
 tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
 status: form.status,
 ...(form.coverImageData ? { coverImageData: form.coverImageData } : {}),
 };
 if (editing) {
 const updated = await api.put<BlogPost>(`/blog/${editing.id}`, payload);
 setPosts(prev => prev.map(p => p.id === editing.id ? updated : p));
 showToast('Post atualizado', 'success');
 } else {
 const created = await api.post<BlogPost>('/blog', payload);
 setPosts(prev => [created, ...prev]);
 showToast('Post criado', 'success');
 }
 setShowForm(false);
 } catch (err: any) {
 showToast(err.message || 'Erro ao guardar post', 'error');
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 if (!confirm('Apagar este post?')) return;
 setDeletingId(id);
 try {
 await api.delete(`/blog/${id}`);
 setPosts(prev => prev.filter(p => p.id !== id));
 showToast('Post apagado', 'success');
 } catch { showToast('Erro ao apagar post', 'error'); }
 finally { setDeletingId(null); }
 };

 const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });

 return (
 <PageShell
 title="Blog"
 subtitle="Gestão de artigos e publicações"
 actions={
 <div className="flex gap-2">
 <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 border border-border-default rounded-lg text-sm text-content-secondary hover:bg-surface-raised transition-colors">
 <RefreshCw className="w-4 h-4" /> Atualizar
 </button>
 <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
 <Plus className="w-4 h-4" /> Novo Post
 </button>
 </div>
 }
 >
 {/* Form Modal */}
 {showForm && (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
 <div className="bg-surface-raised rounded-2xl w-full max-w-3xl my-8 shadow-2xl border border-border-default">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
 <h2 className="text-lg font-semibold text-content-primary">
 {editing ? 'Editar Post' : 'Novo Post'}
 </h2>
 <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-surface-base text-content-muted">
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="p-6 space-y-4">
 {/* Cover image */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">Imagem de Capa</label>
 <div className="flex items-center gap-4">
 {coverPreview ? (
 <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-border-default flex-shrink-0">
 <img src={coverPreview} alt="" className="w-full h-full object-cover" />
 <button type="button" onClick={() => { setCoverPreview(''); setForm(f => ({ ...f, coverImageData: '' })); }}
 className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5">
 <X className="w-3 h-3" />
 </button>
 </div>
 ) : (
 <div className="w-32 h-20 rounded-xl border-2 border-dashed border-border-default flex items-center justify-center flex-shrink-0">
 <Image className="w-6 h-6 text-content-muted" />
 </div>
 )}
 <label className="flex items-center gap-2 px-3 py-2 border border-border-default rounded-lg cursor-pointer hover:border-brand-500 text-sm text-content-muted transition-colors">
 <Image className="w-4 h-4" /> {coverPreview ? 'Trocar imagem' : 'Adicionar capa'}
 <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
 </label>
 </div>
 </div>

 {/* Título */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Título *</label>
 <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
 className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-surface-raised text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="Título do artigo..." />
 </div>

 {/* Resumo */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Resumo</label>
 <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={2}
 className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-surface-raised text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Breve descrição do artigo..." />
 </div>

 {/* Conteúdo — Editor Rico */}
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">Conteúdo</label>
 <RichTextEditor
 value={form.content}
 onChange={content => setForm(f => ({ ...f, content }))}
 placeholder="Escreva o conteúdo do artigo..."
 />
 </div>

 {/* Tags e Status */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 <Tag className="w-3.5 h-3.5 inline mr-1" />Tags
 </label>
 <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
 className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-surface-raised text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="saúde, nutrição, ervas" />
 <p className="text-xs text-content-muted mt-1">Separadas por vírgula</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Estado</label>
 <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
 className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-surface-raised text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
 <option value="draft">Rascunho</option>
 <option value="published">Publicado</option>
 </select>
 </div>
 </div>
 </div>

 <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-default">
 <button onClick={() => setShowForm(false)} className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg text-sm transition-colors">
 Cancelar
 </button>
 <button onClick={handleSave} disabled={saving}
 className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 {editing ? 'Guardar Alterações' : 'Publicar Post'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Lista */}
 {loading ? (
 <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
 ) : posts.length === 0 ? (
 <div className="text-center py-20 text-content-muted">
 <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p className="mb-4">Ainda não há posts. Crie o primeiro artigo!</p>
 <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
 <Plus className="w-4 h-4" /> Criar Primeiro Post
 </button>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
 {posts.map(post => (
 <div key={post.id} className="bg-surface-raised rounded-xl border border-border-default shadow-sm overflow-hidden flex flex-col group">
 {/* Cover */}
 {post.coverImage ? (
 <div className="aspect-video overflow-hidden bg-surface-base">
 <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
 </div>
 ) : (
 <div className="aspect-video bg-surface-base flex items-center justify-center">
 <FileText className="w-10 h-10 text-content-muted opacity-20" />
 </div>
 )}

 {/* Content */}
 <div className="p-4 flex-1 flex flex-col gap-2">
 <div className="flex items-start justify-between gap-2">
 <h3 className="font-semibold text-sm text-content-primary leading-snug line-clamp-2 flex-1">{post.title}</h3>
 <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${post.status === 'published' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-surface-base text-content-muted border border-border-default'}`}>
 {post.status === 'published' ? 'Publicado' : 'Rascunho'}
 </span>
 </div>

 {post.summary && (
 <p className="text-xs text-content-muted line-clamp-2 leading-relaxed">{post.summary}</p>
 )}

 <div className="flex items-center gap-2 flex-wrap text-[10px] text-content-muted mt-auto pt-1">
 <span>{fmtDate(post.createdAt)}</span>
 {post.authorName && <span>· {post.authorName}</span>}
 <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{post.views}</span>
 {post.tags.length > 0 && (
 <span className="bg-surface-base border border-border-default rounded px-1.5 py-0.5">
 {post.tags[0]}
 </span>
 )}
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-end gap-1 px-3 py-2.5 border-t border-border-default bg-surface-base">
 <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
 className="p-1.5 rounded-lg hover:bg-surface-raised text-content-muted hover:text-brand-600 transition-colors" title="Ver no site">
 <Globe className="w-3.5 h-3.5" />
 </a>
 <button onClick={() => openEdit(post)}
 className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors" title="Editar">
 <Edit2 className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => handleDelete(post.id)} disabled={deletingId === post.id}
 className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50" title="Apagar">
 {deletingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </PageShell>
 );
};

export default Blog;
