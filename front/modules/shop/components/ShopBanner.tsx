import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, X, Settings, Loader2, Check, Image as ImageIcon,
  ArrowRight, Plus, Trash2, ChevronLeft, ChevronRight,
  GripVertical, Pencil,
} from 'lucide-react';
import api from '../../core/services/apiClient';
import uploadService from '../../../services/uploadService';
import { Product } from '../../core/types/types';

interface BannerConfig {
  id: number | null;
  imageUrl: string | null;
  title: string;
  subtitle: string;
  buttonText: string;
  productSlug: string | null;
  productId: string | null;
  bgColor: string;
  sortOrder: number;
  isActive: boolean;
}

interface ShopBannerProps {
  isAdmin?: boolean;
  products?: Product[];
  uploadImage?: (file: File) => Promise<string | null>;
}

const DEFAULT_SLIDE: Omit<BannerConfig, 'id'> = {
  imageUrl: null,
  title: 'Saúde Natural & Bem-Estar',
  subtitle: 'Descubra o poder da natureza com produtos 100% naturais e selecionados',
  buttonText: 'Explorar Produtos',
  productSlug: null,
  productId: null,
  bgColor: '#14532d',
  sortOrder: 0,
  isActive: true,
};

const BG_PRESETS = [
  { color: '#14532d', label: 'Verde' },
  { color: '#7c2d12', label: 'Castanho' },
  { color: '#1e3a5f', label: 'Azul' },
  { color: '#4a1d96', label: 'Roxo' },
  { color: '#78350f', label: 'Âmbar' },
  { color: '#1f2937', label: 'Escuro' },
];

export const ShopBanner: React.FC<ShopBannerProps> = ({ isAdmin = false, products = [], uploadImage }) => {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<BannerConfig[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<BannerConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slider auto-advance
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const loadSlides = useCallback(async () => {
    try {
      const data = await api.get<BannerConfig[]>('/banners/active');
      setSlides(Array.isArray(data) ? data : [data as unknown as BannerConfig]);
    } catch {
      setSlides([{ ...DEFAULT_SLIDE, id: null }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSlides(); }, [loadSlides]);

  const goTo = useCallback((index: number) => {
    setCurrent(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length]);

  // Auto-advance
  useEffect(() => {
    if (slides.length <= 1) return;
    autoRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, 5000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [slides.length]);

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); };

  const handleSlideClick = (slide: BannerConfig) => {
    if (slide.productSlug) {
      navigate(`/loja/produto/${slide.productSlug}`);
    } else {
      document.getElementById('produtos-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ─── Admin helpers ────────────────────────────────────────────────
  const openCreate = () => {
    setEditing({ ...DEFAULT_SLIDE, id: null, sortOrder: slides.length });
    setIsNew(true);
  };

  const openEdit = (slide: BannerConfig) => {
    setEditing({ ...slide });
    setIsNew(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const result = await uploadService.uploadImage(file, 'banners', 1920);
      if (result?.url) setEditing(prev => prev ? { ...prev, imageUrl: result.url } : prev);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleProductChange = (productId: string) => {
    if (!editing) return;
    if (!productId) {
      setEditing(prev => prev ? { ...prev, productId: null, productSlug: null } : prev);
      return;
    }
    const product = products.find(p => p.id === productId);
    setEditing(prev => prev ? {
      ...prev,
      productId: product?.id || null,
      productSlug: product?.slug || null,
    } : prev);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.post<BannerConfig>('/banners', {
          imageUrl: editing.imageUrl,
          title: editing.title,
          subtitle: editing.subtitle,
          buttonText: editing.buttonText,
          productSlug: editing.productSlug,
          productId: editing.productId,
          bgColor: editing.bgColor,
        });
        setSlides(prev => [...prev, created]);
      } else {
        await api.put(`/banners/${editing.id}`, {
          imageUrl: editing.imageUrl,
          title: editing.title,
          subtitle: editing.subtitle,
          buttonText: editing.buttonText,
          productSlug: editing.productSlug,
          productId: editing.productId,
          bgColor: editing.bgColor,
          isActive: editing.isActive,
        });
        setSlides(prev => prev.map(s => s.id === editing.id ? editing : s));
      }
      setEditing(null);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number | null) => {
    if (!id || !confirm('Eliminar este slide?')) return;
    try {
      await api.delete(`/banners/${id}`);
      setSlides(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const moveSlide = async (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= slides.length) return;
    const reordered = [...slides];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setSlides(reordered);
    // persist order
    try {
      await Promise.all(reordered.map((s, i) =>
        s.id ? api.patch(`/banners/${s.id}/order`, { sortOrder: i }) : Promise.resolve()
      ));
    } catch {}
  };

  // ─── Skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="w-full" style={{ height: 'clamp(280px, calc(100vw / 3.2), 600px)' }}>
        <div className="w-full h-full bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-700 animate-pulse" />
      </section>
    );
  }

  const activeSlide = slides[current] ?? slides[0];
  if (!activeSlide) return null;

  const bgImg = activeSlide.imageUrl ? uploadService.getPublicUrl(activeSlide.imageUrl) : null;

  return (
    <>
      {/* ── Slider ───────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden" style={{ height: 'clamp(280px, calc(100vw / 3.2), 600px)' }}>

        {/* Slides track */}
        <div
          ref={trackRef}
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide, i) => {
            const img = slide.imageUrl ? uploadService.getPublicUrl(slide.imageUrl) : null;
            return (
              <div
                key={slide.id ?? i}
                className="relative w-full flex-shrink-0 h-full flex items-center"
                style={{ backgroundColor: slide.bgColor }}
              >
                {/* Imagem de fundo — cobre o banner todo */}
                {img ? (
                  <>
                    <img
                      src={img}
                      alt={slide.title}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                    {/* overlay subtil só para legibilidade do texto */}
                    <div className="absolute inset-0 bg-black/40" />
                  </>
                ) : (
                  <div className="absolute inset-0" style={{
                    background: `linear-gradient(135deg, ${slide.bgColor} 0%, ${slide.bgColor}cc 100%)`,
                  }} />
                )}

                {/* Conteúdo */}
                <div className="relative w-full max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-start gap-6">
                  <div className="text-white max-w-xl z-10 drop-shadow-lg">
                    {slide.productSlug && (
                      <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full mb-3 border border-white/30">
                        Produto em destaque
                      </span>
                    )}
                    <h2 className="font-extrabold leading-tight mb-3"
                      style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}>
                      {slide.title}
                    </h2>
                    <p className="text-white/80 mb-6 leading-relaxed"
                      style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)' }}>
                      {slide.subtitle}
                    </p>
                    <button
                      onClick={() => handleSlideClick(slide)}
                      className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-surface-base active:scale-95 transition-all shadow-lg hover:shadow-xl text-sm md:text-base"
                    >
                      {slide.buttonText}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Setas */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => { stopAuto(); goTo(current - 1 < 0 ? slides.length - 1 : current - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => { stopAuto(); goTo((current + 1) % slides.length); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { stopAuto(); goTo(i); }}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 h-2.5 bg-white shadow-md'
                    : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        )}

        {/* Botão gestão (admin) */}
        {isAdmin && (
          <button
            onClick={() => setManaging(true)}
            className="absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Gerir Slides
          </button>
        )}
      </section>

      {/* ── Modal de gestão ──────────────────────────────────────── */}
      {managing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h2 className="text-lg font-bold text-content-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-green-600" />
                Gerir Slides do Banner
              </h2>
              <button onClick={() => setManaging(false)} className="p-2 text-content-muted hover:text-gray-600 hover:bg-surface-overlay rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {slides.map((slide, i) => {
                const thumb = slide.imageUrl ? uploadService.getPublicUrl(slide.imageUrl) : null;
                return (
                  <div
                    key={slide.id ?? i}
                    className="flex items-center gap-3 p-3 bg-surface-overlay rounded-xl border border-border-default"
                  >
                    {/* Miniatura */}
                    <div
                      className="w-20 h-14 rounded-lg flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: slide.bgColor }}
                    >
                      {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-white text-sm truncate">{slide.title}</p>
                      <p className="text-xs text-content-muted truncate">{slide.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => moveSlide(i, -1)} disabled={i === 0} className="p-1.5 text-content-muted hover:text-gray-600 disabled:opacity-30 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                        <GripVertical className="w-4 h-4 rotate-90" />
                      </button>
                      <button onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} className="p-1.5 text-content-muted hover:text-gray-600 disabled:opacity-30 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                        <GripVertical className="w-4 h-4 -rotate-90" />
                      </button>
                      <button onClick={() => { openEdit(slide); setManaging(false); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(slide.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => { openCreate(); setManaging(false); }}
                className="w-full py-3 border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Adicionar novo slide
              </button>
            </div>

            <div className="p-5 border-t border-border-default">
              <button onClick={() => setManaging(false)} className="w-full py-2.5 bg-surface-overlay text-content-secondary rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de edição / criação ─────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h2 className="text-lg font-bold text-content-primary">
                {isNew ? 'Novo Slide' : 'Editar Slide'}
              </h2>
              <button onClick={() => setEditing(null)} className="p-2 text-content-muted hover:text-gray-600 hover:bg-surface-overlay rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Imagem */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-2">
                  Imagem do slide
                  <span className="text-content-muted font-normal ml-2">Recomendado: 1920×600px · proporção 16:5</span>
                </label>
                <div className="relative rounded-xl overflow-hidden bg-surface-overlay border-2 border-dashed border-gray-300 dark:border-border-strong h-44 flex items-center justify-center">
                  {editing.imageUrl ? (
                    <>
                      <img src={uploadService.getPublicUrl(editing.imageUrl)} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="flex gap-2">
                          <label className="cursor-pointer bg-white text-gray-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-gray-100">
                            <Upload className="w-4 h-4" /> Trocar
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                          </label>
                          <button onClick={() => setEditing(prev => prev ? { ...prev, imageUrl: null } : prev)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-red-700">
                            <X className="w-4 h-4" /> Remover
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-500 hover:text-green-600 transition-colors">
                      {uploading ? <Loader2 className="w-10 h-10 animate-spin text-green-600" /> : (
                        <>
                          <ImageIcon className="w-10 h-10" />
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
                <label className="block text-sm font-semibold text-content-secondary mb-2">
                  Cor de fundo
                  <span className="text-content-muted font-normal ml-2">(visível quando não há imagem ou como overlay)</span>
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {BG_PRESETS.map(p => (
                    <button
                      key={p.color}
                      onClick={() => setEditing(prev => prev ? { ...prev, bgColor: p.color } : prev)}
                      title={p.label}
                      className={`w-8 h-8 rounded-full border-4 transition-transform hover:scale-110 ${editing.bgColor === p.color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: p.color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={editing.bgColor}
                    onChange={e => setEditing(prev => prev ? { ...prev, bgColor: e.target.value } : prev)}
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
                  value={editing.title}
                  onChange={e => setEditing(prev => prev ? { ...prev, title: e.target.value } : prev)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
                  placeholder="Ex: Saúde Natural em Cada Produto"
                />
              </div>

              {/* Subtítulo */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-1">Subtítulo</label>
                <textarea
                  value={editing.subtitle}
                  onChange={e => setEditing(prev => prev ? { ...prev, subtitle: e.target.value } : prev)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary resize-none"
                />
              </div>

              {/* Botão */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-1">Texto do botão</label>
                <input
                  type="text"
                  value={editing.buttonText}
                  onChange={e => setEditing(prev => prev ? { ...prev, buttonText: e.target.value } : prev)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
                  placeholder="Ex: Ver Produto, Comprar Agora..."
                />
              </div>

              {/* Produto */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-1">
                  Produto em destaque <span className="text-content-muted font-normal">(opcional)</span>
                </label>
                <select
                  value={editing.productId || ''}
                  onChange={e => handleProductChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-border-strong rounded-xl focus:ring-2 focus:ring-green-500 bg-surface-raised text-content-primary"
                >
                  <option value="">— Sem produto (botão vai para a lista) —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-semibold text-content-secondary mb-2">Pré-visualização</label>
                <div
                  className="relative rounded-xl overflow-hidden h-32 flex items-center"
                  style={{ backgroundColor: editing.bgColor }}
                >
                  {editing.imageUrl && (
                    <>
                      <img src={uploadService.getPublicUrl(editing.imageUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${editing.bgColor}ee 35%, transparent)` }} />
                    </>
                  )}
                  <div className="relative px-6">
                    <p className="text-white font-extrabold text-lg leading-tight">{editing.title || 'Título'}</p>
                    <p className="text-white/70 text-xs mt-1 line-clamp-1">{editing.subtitle}</p>
                    <button className="mt-2 bg-white text-gray-900 text-xs font-bold px-4 py-1.5 rounded-lg inline-flex items-center gap-1">
                      {editing.buttonText || 'Ver Produto'} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-border-default">
              <button
                onClick={() => { setEditing(null); if (managing) setManaging(true); }}
                className="flex-1 py-2.5 bg-surface-overlay text-content-secondary rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.title}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> A guardar...</> : <><Check className="w-4 h-4" /> Guardar slide</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
