import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, ChevronLeft, Loader2, RefreshCw, Plus, X, Check } from 'lucide-react';
import api from '../../core/services/apiClient';

interface RefundRequest {
  id: string;
  orderId: string;
  orderNumber?: string;
  reason: string;
  details?: string;
  photos?: string[];
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: string;
}

const REASONS = [
  'Produto danificado',
  'Produto errado',
  'Não recebi o pedido',
  'Qualidade inferior ao esperado',
  'Pedido duplicado',
  'Outro motivo',
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pendente',  className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  approved: { label: 'Aprovado',  className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  rejected: { label: 'Rejeitado', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

export const CustomerRefunds: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as any) || {};
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!prefill.orderId);
  const [form, setForm] = useState({ orderId: prefill.orderId || '', reason: REASONS[0], details: '' });
  const [photoFiles, setPhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get<RefundRequest[]>('/refunds/my-refunds')
      .then(setRefunds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - photoFiles.length;
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoFiles(prev => [...prev, { file, preview: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!form.orderId.trim()) return setSubmitError('ID do pedido é obrigatório');
    setSubmitting(true);
    try {
      const photos = photoFiles.map(p => p.preview);
      const created = await api.post<RefundRequest>('/refunds', { ...form, photos });
      setRefunds(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ orderId: '', reason: REASONS[0], details: '' });
      setPhotoFiles([]);
    } catch (err: any) {
      setSubmitError(err?.message || 'Erro ao enviar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-surface-base py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/minha-conta')} className="p-2 rounded-lg hover:bg-surface-overlay transition-colors text-content-muted">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-content-primary">Reembolsos</h1>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Solicitar
            </button>
          )}
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-content-primary">Novo Pedido de Reembolso</h2>
              <button onClick={() => { setShowForm(false); setSubmitError(''); setPhotoFiles([]); }} className="p-1.5 rounded-lg hover:bg-surface-overlay text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  ID / Número do Pedido <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.orderId}
                  onChange={e => setForm(f => ({ ...f, orderId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-border-default bg-surface-raised text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="Cole aqui o ID do pedido"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Encontra o ID na página das tuas encomendas.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Motivo <span className="text-red-500">*</span></label>
                <select
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-border-default bg-surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Detalhes</label>
                <textarea
                  value={form.details}
                  onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-border-default bg-surface-raised text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
                  placeholder="Descreve o problema em detalhe..."
                />
              </div>

              {/* Upload de fotos */}
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">
                  Fotos <span className="text-xs text-content-muted font-normal">(opcional · máx. 3)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {photoFiles.map((p, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border-default flex-shrink-0">
                      <img src={p.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {photoFiles.length < 3 && (
                    <label className="w-20 h-20 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 dark:border-border-default rounded-xl cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-colors flex-shrink-0">
                      <Camera className="w-5 h-5 text-content-muted" />
                      <span className="text-[10px] text-content-muted">Adicionar</span>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoAdd}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-content-muted mt-1.5">Envia fotos do produto para facilitar a análise.</p>
              </div>

              {submitError && <p className="text-sm text-red-500">{submitError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Enviar Pedido de Reembolso
              </button>
            </form>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-content-muted" /></div>
        ) : refunds.length === 0 && !showForm ? (
          <div className="text-center py-16 text-content-muted">
            <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="mb-3">Ainda não tens pedidos de reembolso.</p>
          </div>
        ) : refunds.length > 0 ? (
          <div className="space-y-3">
            <h2 className="font-semibold text-content-primary text-sm">Histórico</h2>
            {refunds.map(r => {
              const s = STATUS_LABEL[r.status];
              return (
                <div key={r.id} className="bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-content-primary">Pedido #{r.orderNumber || r.orderId.slice(0,8)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>{s.label}</span>
                      </div>
                      <p className="text-sm text-content-muted">{r.reason}</p>
                      {r.details && <p className="text-xs text-gray-500 mt-1">{r.details}</p>}
                      {r.photos && r.photos.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {r.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 rounded-lg overflow-hidden border border-border-default hover:opacity-80 transition-opacity flex-shrink-0">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {r.adminNotes && (
                        <div className="mt-2 bg-surface-overlay rounded-lg px-3 py-2 text-xs text-content-muted">
                          <span className="font-medium">Resposta: </span>{r.adminNotes}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-content-muted whitespace-nowrap">{fmtDate(r.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CustomerRefunds;
