import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Eye, Tag, ArrowLeft, Loader2, MessageCircle, Send, User, Trash2 } from 'lucide-react';
import api from '../../core/services/apiClient';

interface BlogPost {
  id: string; title: string; slug: string; summary?: string; content?: string;
  coverImage?: string; authorName?: string; tags: string[];
  views: number; publishedAt?: string; createdAt: string;
}

interface Comment {
  id: string; postId: string; userId?: string;
  authorName: string; authorAvatar?: string;
  content: string; createdAt: string;
}

interface BlogPostPageProps {
  currentUser?: { id: string; name: string; isSuperAdmin?: boolean; roles?: string[] } | null;
}

export const BlogPostPage: React.FC<BlogPostPageProps> = ({ currentUser }) => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [form, setForm] = useState({ content: '', authorName: '', authorEmail: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = currentUser?.isSuperAdmin || currentUser?.roles?.some(r => ['ADMIN', 'SUPER_ADMIN', 'GESTOR_BLOG'].includes(r));

  useEffect(() => {
    if (!slug) return;
    api.get<BlogPost>(`/blog/${slug}`)
      .then(p => { setPost(p); loadComments(p.id); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const loadComments = async (postId: string) => {
    setCommentsLoading(true);
    try {
      const data = await api.get<Comment[]>(`/blog/${postId}/comments`);
      setComments(data);
    } catch {}
    finally { setCommentsLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload: any = { content: form.content };
      if (!currentUser) {
        if (!form.authorName.trim()) { setSubmitError('Indique o seu nome'); setSubmitting(false); return; }
        payload.authorName = form.authorName;
        payload.authorEmail = form.authorEmail;
      }
      const created = await api.post<Comment>(`/blog/${post!.id}/comments`, payload);
      setComments(prev => [...prev, created]);
      setForm({ content: '', authorName: '', authorEmail: '' });
    } catch (err: any) {
      setSubmitError(err.message || 'Erro ao publicar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Apagar comentário?')) return;
    setDeletingId(commentId);
    try {
      await api.delete(`/blog/${post!.id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
    finally { setDeletingId(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-surface-base">
      <Loader2 className="w-8 h-8 animate-spin text-green-600" />
    </div>
  );

  if (notFound || !post) return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-content-primary mb-2">Artigo não encontrado</h1>
        <Link to="/blog" className="text-green-600 hover:underline">← Voltar ao Blog</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/blog" className="inline-flex items-center gap-2 text-green-600 hover:underline text-sm mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Blog
        </Link>

        {post.coverImage && (
          <img src={post.coverImage} alt={post.title} className="w-full h-64 md:h-80 object-cover rounded-2xl mb-8 shadow-md" />
        )}

        <h1 className="text-3xl md:text-4xl font-bold text-content-primary mb-4 leading-tight">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-content-muted mb-6">
          {post.authorName && <span>por <strong className="text-content-secondary">{post.authorName}</strong></span>}
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{fmtDate(post.publishedAt || post.createdAt)}</span>
          <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{post.views} leituras</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" />{comments.length} comentários</span>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map(t => (
              <span key={t} className="flex items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                <Tag className="w-3 h-3" />{t}
              </span>
            ))}
          </div>
        )}

        {post.summary && (
          <p className="text-lg text-content-secondary leading-relaxed mb-8 pb-8 border-b border-border-default font-medium">
            {post.summary}
          </p>
        )}

        {post.content && (
          <div
            className="prose prose-green dark:prose-invert max-w-none text-content-secondary leading-relaxed mb-16"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        )}

        {/* ── COMENTÁRIOS ── */}
        <div className="border-t border-border-default pt-10">
          <h2 className="text-xl font-bold text-content-primary mb-6 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            {comments.length > 0 ? `${comments.length} Comentário${comments.length !== 1 ? 's' : ''}` : 'Comentários'}
          </h2>

          {/* Lista de comentários */}
          {commentsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-content-muted">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ainda não há comentários. Seja o primeiro!</p>
            </div>
          ) : (
            <div className="space-y-5 mb-10">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center overflow-hidden">
                    {c.authorAvatar ? (
                      <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-green-700 dark:text-green-400">{initials(c.authorName)}</span>
                    )}
                  </div>
                  <div className="flex-1 bg-surface-raised rounded-2xl rounded-tl-sm px-4 py-3 border border-border-default">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-content-primary">{c.authorName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-content-muted">{fmtTime(c.createdAt)}</span>
                        {(isAdmin || currentUser?.id === c.userId) && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            className="p-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            {deletingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de comentário */}
          <div className="bg-surface-raised rounded-2xl border border-border-default p-5">
            <h3 className="font-semibold text-content-primary mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-green-600" />
              {currentUser ? `Comentar como ${currentUser.name}` : 'Deixar um comentário'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Campos para utilizadores não autenticados */}
              {!currentUser && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">Nome *</label>
                    <input
                      value={form.authorName}
                      onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-overlay text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="O seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">Email <span className="text-content-muted font-normal">(opcional)</span></label>
                    <input
                      type="email"
                      value={form.authorEmail}
                      onChange={e => setForm(f => ({ ...f, authorEmail: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-overlay text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">Comentário *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-overlay text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Partilhe a sua opinião sobre este artigo..."
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{submitError}</p>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-content-muted">Os comentários são moderados antes de aparecerem.</p>
                <button
                  type="submit"
                  disabled={submitting || !form.content.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Publicar Comentário
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPostPage;
