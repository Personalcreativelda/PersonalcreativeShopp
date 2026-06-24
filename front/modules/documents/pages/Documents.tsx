import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import uploadService from '../../../services/uploadService';
import {
  FolderOpen, File, Plus, Loader2, X, Trash2, Upload,
  FolderPlus, Search, ChevronRight, ArrowLeft,
} from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }
type Folder = { id: number; name: string; doc_count: number; subfolder_count: number; created_by_name: string; };
type Doc = { id: number; name: string; file_url: string; file_size: number; mime_type: string; folder_name: string; created_by_name: string; created_at: string; };

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

function fmtSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.startsWith('video/')) return '🎥';
  if (mime.startsWith('audio/')) return '🎵';
  return '📄';
}

export function Documents({ showToast }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [folderStack, setFolderStack] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<Doc[] | null>(null);
  const [modal, setModal] = useState<'folder' | null>(null);
  const [folderName, setFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = useCallback(async (folderId?: number) => {
    setLoading(true);
    try {
      const params = folderId ? `?folder_id=${folderId}` : '';
      const [f, d] = await Promise.all([
        api.get<Folder[]>(`/docs/folders${params}`),
        api.get<Doc[]>(`/docs${params}`),
      ]);
      setFolders(f); setDocs(d);
    } catch { showToast?.('Erro ao carregar', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(currentFolder?.id); }, [currentFolder, load]);

  useEffect(() => {
    if (!q.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await api.get<Doc[]>(`/docs/search?q=${encodeURIComponent(q)}`);
        setSearchResults(results);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const openFolder = (f: Folder) => {
    setFolderStack(prev => currentFolder ? [...prev, currentFolder] : prev);
    setCurrentFolder(f);
  };

  const goBack = () => {
    const prev = folderStack[folderStack.length - 1] || null;
    setFolderStack(s => s.slice(0, -1));
    setCurrentFolder(prev);
  };

  const createFolder = async () => {
    setSaving(true);
    try {
      await api.post('/docs/folders', { name: folderName, parent_id: currentFolder?.id || null });
      showToast?.('Pasta criada', 'success'); setModal(null); setFolderName(''); load(currentFolder?.id);
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadService.uploadImage(file, 'documents', 9999);
      if (!result?.url) throw new Error('Falha no upload');
      await api.post('/docs', {
        name: file.name, file_url: result.url,
        file_size: file.size, mime_type: file.type,
        folder_id: currentFolder?.id || null,
      });
      showToast?.('Ficheiro carregado', 'success'); load(currentFolder?.id);
    } catch (e: any) { showToast?.(e.message || 'Erro no upload', 'error'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const deleteDoc = async (id: number) => {
    if (!confirm('Eliminar documento?')) return;
    try { await api.delete(`/docs/${id}`); showToast?.('Eliminado', 'success'); load(currentFolder?.id); }
    catch { showToast?.('Erro', 'error'); }
  };

  const deleteFolder = async (id: number) => {
    if (!confirm('Eliminar pasta e todo o conteúdo?')) return;
    try { await api.delete(`/docs/folders/${id}`); showToast?.('Eliminado', 'success'); load(currentFolder?.id); }
    catch { showToast?.('Erro', 'error'); }
  };

  const displayDocs = searchResults !== null ? searchResults : docs;

  return (
    <PageShell title="Documentos" description="Gestão de ficheiros e pastas internas"
      actions={
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 border border-border-default rounded-xl text-sm font-medium text-content-secondary hover:bg-surface-overlay disabled:opacity-50 transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Carregar Ficheiro
          </button>
          <button onClick={() => { setFolderName(''); setModal('folder'); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
            <FolderPlus className="w-4 h-4" /> Nova Pasta
          </button>
        </div>
      }>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => { setCurrentFolder(null); setFolderStack([]); }} className="text-content-muted hover:text-content-primary flex items-center gap-1">
          <FolderOpen className="w-4 h-4" /> Raiz
        </button>
        {folderStack.map((f, i) => (
          <React.Fragment key={f.id}>
            <ChevronRight className="w-3 h-3 text-content-muted" />
            <button onClick={() => { const stack = folderStack.slice(0, i); setFolderStack(stack); setCurrentFolder(f); }} className="text-content-muted hover:text-content-primary">{f.name}</button>
          </React.Fragment>
        ))}
        {currentFolder && (
          <>
            <ChevronRight className="w-3 h-3 text-content-muted" />
            <span className="text-content-primary font-medium">{currentFolder.name}</span>
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar documentos…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
      ) : (
        <div className="space-y-2">
          {/* Back button */}
          {currentFolder && !searchResults && (
            <button onClick={goBack} className="flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-overlay rounded-lg transition-colors w-full text-left">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          )}

          {/* Folders */}
          {!searchResults && folders.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-surface-raised border border-border-default rounded-xl hover:bg-surface-overlay transition-colors cursor-pointer group"
              onClick={() => openFolder(f)}>
              <FolderOpen className="w-5 h-5 text-yellow-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-content-primary">{f.name}</p>
                <p className="text-xs text-content-muted">{f.doc_count} ficheiros · {f.subfolder_count} subpastas</p>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteFolder(f.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Documents */}
          {displayDocs.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-surface-raised border border-border-default rounded-xl hover:bg-surface-overlay transition-colors group">
              <span className="text-xl shrink-0">{mimeIcon(d.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-content-primary truncate">{d.name}</p>
                <p className="text-xs text-content-muted">{fmtSize(d.file_size)} · {d.created_by_name || '—'} {d.folder_name ? `· 📁 ${d.folder_name}` : ''}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={d.file_url} target="_blank" rel="noreferrer"
                  className="px-2.5 py-1.5 text-xs border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">
                  Abrir
                </a>
                <button onClick={() => deleteDoc(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {folders.length === 0 && displayDocs.length === 0 && (
            <div className="text-center py-16 text-content-muted">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{searchResults !== null ? 'Nenhum resultado' : 'Pasta vazia'}</p>
            </div>
          )}
        </div>
      )}

      {modal === 'folder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm animate-modal-enter">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h3 className="font-semibold text-content-primary">Nova Pasta</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Nome da Pasta *</label>
                <input value={folderName} onChange={e => setFolderName(e.target.value)} className={inputCls} placeholder="Ex: Contratos 2026" autoFocus />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
                <button onClick={createFolder} disabled={saving || !folderName.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default Documents;
