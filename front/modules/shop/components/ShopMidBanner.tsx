import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, X, Settings, Loader2, Check, Image as ImageIcon, ArrowRight,
} from 'lucide-react';
import api from '../../core/services/apiClient';
import uploadService from '../../../services/uploadService';
import { Product } from '../../core/types/types';

interface MidBanner {
  id: number | null;
  imageUrl: string | null;
  title: string;
  subtitle: string;
  buttonText: string;
  productSlug: string | null;
  productId: string | null;
  bgColor: string;
  isActive: boolean;
}

interface ShopMidBannerProps {
  isAdmin?: boolean;
  products?: Product[];
  uploadImage?: (file: File) => Promise<string | null>;
}

const DEFAULT: MidBanner = {
  id: null,
  imageUrl: null,
  title: 'Produto em Destaque',
  subtitle: 'Descubra os benefícios dos nossos produtos naturais selecionados',
  buttonText: 'Ver Produto',
  productSlug: null,
  productId: null,
  bgColor: '#ea580c',
  isActive: true,
};

const BG_PRESETS = [
  '#ea580c', '#16a34a', '#2563eb', '#9333ea',
  '#dc2626', '#0891b2', '#78350f', '#1f2937',
];

export const ShopMidBanner: React.FC<ShopMidBannerProps> = ({ isAdmin = false, products = [], uploadImage }) => {
  const navigate = useNavigate();
  const [banner, setBanner] = useState<MidBanner | null | 'empty'>('empty');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MidBanner>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<MidBanner | null>('/banners/mid')
      .then(data => setBanner(data ?? null))
      .catch(() => setBanner(null));
  }, []);

  // Não renderiza nada se não houver banner e não for admin
  if (banner === 'empty') return null; // ainda a carregar
  if (!banner && !isAdmin) return null;

  const openEdit = () => {
    setDraft(banner ? { ...banner } : { ...DEFAULT });
    setEditing(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadService.uploadImage(file, 'banners', 1920);
      if (result?.url) setDraft(prev => ({ ...prev, imageUrl: result.url }));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleProductChange = (productId: string) => {
    if (!productId) {
      setDraft(prev => ({ ...prev, productId: null, productSlug: null }));
      return;
    }
    const product = products.find(p => p.id === productId);
    setDraft(prev => ({
      ...prev,
      productId: product?.id || null,
      productSlug: product?.slug || null,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/banners/mid', {
        imageUrl: draft.imageUrl,
        title: draft.title,
        subtitle: draft.subtitle,
        buttonText: draft.buttonText,
        productSlug: draft.productSlug,
        productId: draft.productId,
        bgColor: draft.bgColor,
      });
      setBanner({ ...draft });
      setEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleClick = () => {
    if (!banner) return;
    if (banner.productSlug) {
      navigate(`/loja/produto/${banner.productSlug}`);
    } else {
      document.getElementById('produtos-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ── Placeholder para admin quando ainda não tem banner ───────────
  if (!banner && isAdmin) {
    return (
      <section className="w-full px-4 py-4">
        <button
          onClick={openEdit}
          className="w-full h-28 border-2 border-dashed border-gray-300 dark:border-border-strong flex flex-col items-center justify-center gap-2 text-content-muted hover:border-green-400 hover:text-green-500 transition-colors"
        >
          <ImageIcon className="w-7 h-7" />
          <span className="text-sm font-medium">Adicionar banner intermédio (largura total)</span>
        </button>
        {editing && renderModal()}
      </section>
    );
  }

  const imgUrl = banner?.imageUrl ? uploadService.getPublicUrl(banner.imageUrl) : null;

  function renderModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-border-default">
            <h2 className="text-lg font-bold text-content-primary">Banner Promocional</h2>
            <button onClick={() => setEditing(false)} className="p-2 text-content-muted hover:text-gray-600 hover:bg-surface-overlay rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Imagem */}
            <div>
              <label className="block text-sm font-semibold text-content-secondary mb-1">
                Imagem <span className="text-content-muted font-normal">Recomendado: 1920×600px · proporção 16:5</span>
              </label>
              <div className="relative rounded-xl overflow-hidden bg-surface-overlay border-2 border-dashed border-gray-300 dark:border-border-strong h-36 flex items-center justify-center">
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
                placeholder="Ex: Novo! Chá de Hibisco Premium"
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
                placeholder="Ex: Rico em vitamina C e antioxidantes"
              />
            </div>

            {/* Botão */}
            <div>
              <label className="block text-sm font-semibold text-content-secondary mb-1">Texto do botão</label>
              <input
                type="text"
                value={draft.buttonText}
                onChange={e => setDraft(prev => ({ ...prev, buttonText: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
                placeholder="Ex: Comprar Agora"
              />
            </div>

            {/* Produto */}
            <div>
              <label className="block text-sm font-semibold text-content-secondary mb-1">
                Produto em destaque <span className="text-content-muted font-normal">(opcional)</span>
              </label>
              <select
                value={draft.productId || ''}
                onChange={e => handleProductChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
              >
                <option value="">— Nenhum (botão vai para a lista) —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-semibold text-content-secondary mb-2">Pré-visualização</label>
              <div
                className="relative rounded-2xl overflow-hidden h-24 flex items-center px-6"
                style={{ backgroundColor: draft.bgColor }}
              >
                {draft.imageUrl && (
                  <img
                    src={uploadService.getPublicUrl(draft.imageUrl)}
                    alt=""
                    className="absolute right-0 top-0 h-full w-2/5 object-cover object-left"
                  />
                )}
                <div className="relative z-10 text-white">
                  <p className="font-extrabold text-base leading-tight">{draft.title || 'Título'}</p>
                  <p className="text-white/75 text-xs mt-0.5 line-clamp-1">{draft.subtitle}</p>
                  <button className="mt-1.5 bg-white text-gray-900 text-[10px] font-bold px-3 py-1 rounded-lg inline-flex items-center gap-1">
                    {draft.buttonText || 'Ver'} <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
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
    );
  }

  return (
    <section className="w-full mt-8">
      <div
        className="relative w-full overflow-hidden cursor-pointer group flex items-center"
        style={{ backgroundColor: banner!.bgColor, height: 'clamp(280px, calc(100vw / 3.2), 600px)' }}
        onClick={handleClick}
      >
        {/* Imagem cobre o banner todo */}
        {imgUrl && (
          <>
            <img
              src={imgUrl}
              alt={banner!.title}
              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}

        {/* Conteúdo de texto — centrado verticalmente, alinhado à esquerda */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-xl drop-shadow-lg">
            {banner!.productSlug && (
              <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full mb-3 border border-white/30">
                Produto em destaque
              </span>
            )}
            <h2 className="font-extrabold text-white leading-tight mb-3" style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}>
              {banner!.title}
            </h2>
            {banner!.subtitle && (
              <p className="text-white/80 mb-6 leading-relaxed" style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)' }}>
                {banner!.subtitle}
              </p>
            )}
            <button className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-surface-base active:scale-95 transition-all shadow-lg hover:shadow-xl text-sm md:text-base">
              {banner!.buttonText}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Botão de edição (admin) */}
        {isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); openEdit(); }}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 z-20"
          >
            <Settings className="w-3.5 h-3.5" />
            Editar Banner
          </button>
        )}
      </div>

      {editing && renderModal()}
    </section>
  );
};
