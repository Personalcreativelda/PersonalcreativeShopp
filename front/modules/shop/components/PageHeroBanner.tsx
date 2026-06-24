import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Settings, Loader2, Check, Image as ImageIcon } from 'lucide-react';
import api from '../../core/services/apiClient';
import uploadService from '../../../services/uploadService';
import { authService } from '../../auth/services/authService';

interface PageBanner {
  id: number | null;
  imageUrl: string | null;
  title: string;
  subtitle: string;
  bgColor: string;
}

interface PageHeroBannerProps {
  pageKey: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultIcon: React.ReactNode;
  defaultBgColor?: string;
  extra?: React.ReactNode;
}

const BG_PRESETS = [
  '#14532d', '#16a34a', '#0f766e', '#1d4ed8',
  '#7c3aed', '#b91c1c', '#78350f', '#1f2937',
];

const DEFAULT_BG = '#14532d';

export const PageHeroBanner: React.FC<PageHeroBannerProps> = ({
  pageKey,
  defaultTitle,
  defaultSubtitle,
  defaultIcon,
  defaultBgColor = DEFAULT_BG,
  extra,
}) => {
  const [banner, setBanner] = useState<PageBanner | null | 'loading'>('loading');
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PageBanner>({ id: null, imageUrl: null, title: defaultTitle, subtitle: defaultSubtitle, bgColor: defaultBgColor });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<PageBanner | null>(`/banners/page/${pageKey}`)
      .then(data => setBanner(data ?? null))
      .catch(() => setBanner(null));

    authService.getCurrentUser().then(user => {
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.isSuperAdmin) {
        setIsAdmin(true);
      }
    }).catch(() => {});
  }, [pageKey]);

  const openEdit = () => {
    setDraft(banner && banner !== 'loading'
      ? { ...banner }
      : { id: null, imageUrl: null, title: defaultTitle, subtitle: defaultSubtitle, bgColor: defaultBgColor }
    );
    setEditing(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadService.uploadImage(file, 'banners');
      if (result?.url) setDraft(prev => ({ ...prev, imageUrl: result.url }));
    } catch {
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/banners/page/${pageKey}`, {
        imageUrl: draft.imageUrl,
        title: draft.title,
        subtitle: draft.subtitle,
        bgColor: draft.bgColor,
      });
      setBanner({ ...draft });
      setEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (banner === 'loading') {
    return (
      <section
        className="relative overflow-hidden bg-surface-overlay dark:bg-white/[0.06] animate-pulse"
        style={{ minHeight: '220px' }}
      />
    );
  }

  const activeBanner = banner;
  const imgUrl = activeBanner?.imageUrl ? uploadService.getPublicUrl(activeBanner.imageUrl) : null;
  const bgColor = activeBanner?.bgColor || defaultBgColor;
  const title = activeBanner?.title || defaultTitle;
  const subtitle = activeBanner?.subtitle || defaultSubtitle;

  return (
    <>
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: bgColor, minHeight: '220px' }}
      >
        {imgUrl && (
          <>
            <img
              src={imgUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/55" />
          </>
        )}

        {!imgUrl && (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 60%),
                radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)`
            }}
          />
        )}

        <div className="relative z-10 py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            {!imgUrl && (
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl mb-5 text-white">
                {defaultIcon}
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{title}</h1>
            <p className="text-white/80 max-w-xl mx-auto">{subtitle}</p>
            {extra}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={openEdit}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors z-20"
          >
            <Settings className="w-3.5 h-3.5" />
            Editar Banner
          </button>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h2 className="text-lg font-bold text-content-primary">Banner da Página</h2>
              <button onClick={() => setEditing(false)} className="p-2 text-content-muted hover:text-gray-600 hover:bg-surface-overlay rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Imagem */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-1">
                  Imagem <span className="text-content-muted font-normal">Recomendado: 1400×400px</span>
                </label>
                <div className="relative rounded-xl overflow-hidden bg-surface-overlay border-2 border-dashed border-gray-300 dark:border-border-strong h-32 flex items-center justify-center">
                  {draft.imageUrl ? (
                    <>
                      <img src={uploadService.getPublicUrl(draft.imageUrl)} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="flex gap-2">
                          <label className="cursor-pointer bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-gray-100">
                            <Upload className="w-4 h-4" /> Trocar
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                          </label>
                          <button onClick={() => setDraft(prev => ({ ...prev, imageUrl: null }))} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-red-700">
                            <X className="w-4 h-4" /> Remover
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-500 hover:text-green-600 transition-colors">
                      {uploading ? <Loader2 className="w-8 h-8 animate-spin text-green-600" /> : (
                        <>
                          <ImageIcon className="w-8 h-8" />
                          <span className="text-sm font-medium">Clique para carregar imagem</span>
                        </>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* Cor de fundo */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-2">Cor de fundo</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {BG_PRESETS.map(color => (
                    <button
                      key={color}
                      onClick={() => setDraft(prev => ({ ...prev, bgColor: color }))}
                      className={`w-8 h-8 rounded-full border-4 transition-transform hover:scale-110 ${draft.bgColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={draft.bgColor}
                    onChange={e => setDraft(prev => ({ ...prev, bgColor: e.target.value }))}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                    title="Cor personalizada"
                  />
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-1">Título</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
                />
              </div>

              {/* Subtítulo */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={draft.subtitle}
                  onChange={e => setDraft(prev => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-border-default">
              <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-surface-overlay text-content-secondary rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !draft.title}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> A guardar...</> : <><Check className="w-4 h-4" /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
