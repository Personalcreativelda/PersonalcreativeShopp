import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Mail, MessageCircle, Loader2, RefreshCw, ExternalLink, Paperclip, X as XIcon } from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';

interface Customer {
 id: string;
 name: string;
 email: string;
 phone?: string;
 order_count: number;
 points: number;
}

interface Campaign {
 id: string;
 title: string;
 subject?: string;
 channel: 'email' | 'whatsapp';
 recipient_count: number;
 created_by_name?: string;
 created_at: string;
}

interface WALink {
 name: string;
 phone: string;
 link: string;
}

export const Marketing: React.FC<{ showToast: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
 const [tab, setTab] = useState<'email' | 'whatsapp'>('email');
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [campaigns, setCampaigns] = useState<Campaign[]>([]);
 const [loadingCustomers, setLoadingCustomers] = useState(true);
 const [selectedIds, setSelectedIds] = useState<string[]>([]);
 const [sendToAll, setSendToAll] = useState(false);
 const [showHistory, setShowHistory] = useState(false);

 // Email form
 const [subject, setSubject] = useState('');
 const [body, setBody] = useState('');
 const [attachments, setAttachments] = useState<{ filename: string; content: string }[]>([]);
 const [sending, setSending] = useState(false);

 // WhatsApp form
 const [waMessage, setWaMessage] = useState('Olá {nome}! Temos novidades especiais para si. Visite a nossa loja em {link}');
 const [waLinks, setWaLinks] = useState<WALink[]>([]);
 const [waResult, setWaResult] = useState<{ mode: string; sent?: number; failed?: number } | null>(null);
 const [generatingWA, setGeneratingWA] = useState(false);

 useEffect(() => {
 api.get<Customer[]>('/marketing/customers')
 .then(setCustomers)
 .catch(() => showToast('Erro ao carregar clientes', 'error'))
 .finally(() => setLoadingCustomers(false));
 api.get<Campaign[]>('/marketing/campaigns').then(setCampaigns).catch(() => {});
 }, []);

 const toggleCustomer = (id: string) => {
 setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
 };

 const recipientCount = sendToAll ? customers.length : selectedIds.length;

 const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 files.forEach(file => {
 const reader = new FileReader();
 reader.onload = ev => {
 const dataUrl = ev.target?.result as string;
 const content = dataUrl.split(',')[1]; // base64 sem prefixo
 setAttachments(prev => [...prev, { filename: file.name, content }]);
 };
 reader.readAsDataURL(file);
 });
 e.target.value = '';
 };

 const handleSendEmail = async () => {
 if (!subject.trim() || !body.trim()) return showToast('Assunto e corpo são obrigatórios', 'error');
 if (!sendToAll && selectedIds.length === 0) return showToast('Selecione pelo menos um destinatário', 'error');
 setSending(true);
 try {
 const r = await api.post<{ sent: number }>('/marketing/send-email', { subject, body, attachments, recipientIds: selectedIds, sendToAll });
 showToast(`Email enviado para ${r.sent} clientes`, 'success');
 setSubject(''); setBody(''); setSelectedIds([]); setSendToAll(false); setAttachments([]);
 api.get<Campaign[]>('/marketing/campaigns').then(setCampaigns).catch(() => {});
 } catch (err: any) {
 showToast(err.message || 'Erro ao enviar campanha', 'error');
 } finally {
 setSending(false);
 }
 };

 const handleSendWA = async () => {
 if (!waMessage.trim()) return showToast('Mensagem obrigatória', 'error');
 if (!sendToAll && selectedIds.length === 0) return showToast('Selecione pelo menos um destinatário', 'error');
 setGeneratingWA(true);
 setWaLinks([]); setWaResult(null);
 try {
 const r = await api.post<any>('/marketing/whatsapp-send', { message: waMessage, recipientIds: selectedIds, sendToAll });
 if (r.mode === 'api') {
 setWaResult(r);
 showToast(`WhatsApp enviado: ${r.sent} sucesso, ${r.failed} falha`, r.failed > 0 ? 'info' : 'success');
 } else {
 setWaLinks(r.links || []);
 showToast(`${r.count} links gerados — clique para enviar`, 'info');
 }
 api.get<Campaign[]>('/marketing/campaigns').then(setCampaigns).catch(() => {});
 } catch (err: any) {
 showToast(err.message || 'Erro ao enviar WhatsApp', 'error');
 } finally {
 setGeneratingWA(false);
 }
 };

 const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

 return (
 <PageShell title="Marketing" actions={
 <button onClick={() => setShowHistory(v => !v)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-default text-content-secondary hover:bg-surface-raised text-sm">
 <RefreshCw className="w-4 h-4" /> Histórico
 </button>
 }>
 {/* Histórico */}
 {showHistory && (
 <div className="mb-6 bg-surface-overlay rounded-xl border border-border-default overflow-hidden">
 <div className="px-4 py-3 border-b border-border-default font-semibold text-content-primary text-sm">Campanhas Enviadas</div>
 {campaigns.length === 0 ? (
 <p className="p-4 text-content-muted text-sm">Nenhuma campanha enviada ainda.</p>
 ) : campaigns.map(c => (
 <div key={c.id} className="flex items-center gap-4 px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-raised/50">
 <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${c.channel === 'email' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
 {c.channel === 'email' ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
 </span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-content-primary truncate">{c.title}</p>
 <p className="text-xs text-content-muted">{c.recipient_count} destinatários · {c.created_by_name}</p>
 </div>
 <span className="text-xs text-content-muted whitespace-nowrap">{fmtDate(c.created_at)}</span>
 </div>
 ))}
 </div>
 )}

 {/* Tabs */}
 <div className="flex gap-1 bg-surface-raised p-1 rounded-xl w-fit mb-6">
 {(['email', 'whatsapp'] as const).map(t => (
 <button key={t} onClick={() => setTab(t)}
 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary hover:text-content-primary'}`}
 >
 {t === 'email' ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
 {t === 'email' ? 'Email' : 'WhatsApp'}
 </button>
 ))}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
 {/* Destinatários */}
 <div className="lg:col-span-2 bg-surface-overlay rounded-xl border border-border-default overflow-hidden">
 <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
 <div className="flex items-center gap-2 font-semibold text-content-primary text-sm">
 <Users className="w-4 h-4" /> Destinatários
 {recipientCount > 0 && <span className="bg-brand-600 text-white text-xs rounded-full px-2 py-0.5">{recipientCount}</span>}
 </div>
 <label className="flex items-center gap-1.5 text-xs text-content-secondary cursor-pointer">
 <input type="checkbox" checked={sendToAll} onChange={e => { setSendToAll(e.target.checked); setSelectedIds([]); }} className="accent-brand-600" />
 Todos
 </label>
 </div>
 <div className="max-h-80 overflow-y-auto divide-y divide-border-default">
 {loadingCustomers ? (
 <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-content-muted" /></div>
 ) : customers.map(c => (
 <label key={c.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-raised/50 ${sendToAll ? 'opacity-40 pointer-events-none' : ''}`}>
 <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleCustomer(c.id)} className="accent-brand-600 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-content-primary truncate">{c.name}</p>
 <p className="text-xs text-content-muted truncate">{tab === 'email' ? c.email : (c.phone || 'Sem telemóvel')}</p>
 </div>
 <span className="text-xs text-content-muted whitespace-nowrap">{c.order_count} pedidos</span>
 </label>
 ))}
 </div>
 </div>

 {/* Formulário */}
 <div className="lg:col-span-3 space-y-4">
 {tab === 'email' ? (
 <div className="bg-surface-overlay rounded-xl border border-border-default p-5 space-y-4">
 <h3 className="font-semibold text-content-primary flex items-center gap-2"><Mail className="w-4 h-4" /> Compor Email</h3>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Assunto</label>
 <input
 value={subject} onChange={e => setSubject(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="Ex: Novidades exclusivas para si!"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Mensagem (HTML ou texto simples)</label>
 <textarea
 value={body} onChange={e => setBody(e.target.value)}
 rows={8}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y font-mono"
 placeholder="<h2>Olá!</h2><p>Temos novidades especiais...</p>"
 />
 <p className="text-xs text-content-muted mt-1">Pode usar HTML para formatação rica.</p>
 </div>
 {/* Anexos */}
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1.5">Anexos (opcional)</label>
 <div className="flex flex-wrap gap-2">
 {attachments.map((a, i) => (
 <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-raised rounded-lg border border-border-default text-xs text-content-primary">
 <Paperclip className="w-3 h-3 text-content-muted flex-shrink-0" />
 <span className="max-w-[120px] truncate">{a.filename}</span>
 <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-content-muted hover:text-red-500 ml-0.5">
 <XIcon className="w-3 h-3" />
 </button>
 </div>
 ))}
 <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-border-default rounded-lg text-xs text-content-muted cursor-pointer hover:border-brand-500 hover:text-brand-600 transition-colors">
 <Paperclip className="w-3 h-3" /> Adicionar ficheiro
 <input type="file" multiple className="hidden" onChange={handleAttachment} />
 </label>
 </div>
 </div>
 <button
 onClick={handleSendEmail}
 disabled={sending || recipientCount === 0}
 className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
 >
 {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> A enviar...</> : <><Send className="w-4 h-4" /> Enviar para {recipientCount} clientes</>}
 </button>
 </div>
 ) : (
 <div className="bg-surface-overlay rounded-xl border border-border-default p-5 space-y-4">
 <h3 className="font-semibold text-content-primary flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Mensagem WhatsApp</h3>
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Mensagem</label>
 <textarea
 value={waMessage} onChange={e => setWaMessage(e.target.value)}
 rows={4}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
 />
 {/* Variáveis clicáveis */}
 <div className="flex flex-wrap gap-1.5 mt-2">
 <span className="text-xs text-content-muted mr-1">Inserir variável:</span>
 {['{nome}', '{loja}', '{link}', '{telefone}', '{pedido}', '{pontos}'].map(v => (
   <button key={v} type="button"
     onClick={() => setWaMessage(m => m + v)}
     className="px-2 py-0.5 rounded-md bg-surface-raised border border-border-default text-xs text-content-secondary hover:text-brand-600 hover:border-brand-500 transition-colors font-mono"
   >{v}</button>
 ))}
 </div>
 </div>
 <div className="bg-surface-raised rounded-lg px-3 py-2.5 text-xs text-content-secondary space-y-1 border border-border-default">
 <p className="font-semibold text-content-primary">💬 WhatsApp Business API (envio automático)</p>
 <p>Para envio automático, define no servidor (Coolify → backend → variáveis de ambiente):</p>
 <div className="font-mono bg-surface-overlay rounded px-2 py-1.5 mt-1 space-y-0.5 text-xs">
   <div><span className="text-brand-500">WHATSAPP_ACCESS_TOKEN</span>=EAAx...</div>
   <div><span className="text-brand-500">WHATSAPP_PHONE_NUMBER_ID</span>=12345678</div>
   <div><span className="text-brand-500">WHATSAPP_API_VERSION</span>=v19.0</div>
 </div>
 <p className="text-content-muted">Sem essas variáveis, gera links para envio manual.</p>
 </div>
 <button
 onClick={handleSendWA}
 disabled={generatingWA || recipientCount === 0}
 className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
 >
 {generatingWA ? <><Loader2 className="w-4 h-4 animate-spin" /> A enviar...</> : <><MessageCircle className="w-4 h-4" /> Enviar para {recipientCount} clientes</>}
 </button>
 {waResult && (
 <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm">
 ✅ Enviado via API: <strong>{waResult.sent}</strong> com sucesso
 {(waResult.failed || 0) > 0 && <span className="text-red-500"> · {waResult.failed} falha(s)</span>}
 </div>
 )}
 {waLinks.length > 0 && (
 <div className="space-y-2 max-h-60 overflow-y-auto">
 <p className="text-xs font-medium text-content-secondary">Clique em cada link para abrir o WhatsApp:</p>
 {waLinks.map((l, i) => (
 <a key={i} href={l.link} target="_blank" rel="noopener noreferrer"
 className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-default hover:bg-surface-raised/50 transition-colors group">
 <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
 {l.name.charAt(0).toUpperCase()}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-content-primary">{l.name}</p>
 <p className="text-xs text-content-muted">+{l.phone}</p>
 </div>
 <ExternalLink className="w-4 h-4 text-content-muted group-hover:text-green-600 transition-colors" />
 </a>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </PageShell>
 );
};

export default Marketing;
