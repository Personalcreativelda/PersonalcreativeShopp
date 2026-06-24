import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import { MessageSquare, Plus, Loader2, X, Send, Users } from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }
type Conversation = { id: number; type: string; name: string; last_message: string; last_message_at: string; unread_count: number; members: { id: string; name: string; avatar_url: string }[]; };
type Message = { id: number; content: string; sender_name: string; sender_avatar: string; created_at: string; sender_id: string; };
type User = { id: string; name: string; avatar_url: string; };

export function Messaging({ showToast }: Props) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [newConvModal, setNewConvModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadConvs = useCallback(async () => {
    try {
      const data = await api.get<Conversation[]>('/messages/conversations');
      setConvs(data);
    } catch { showToast?.('Erro ao carregar conversas', 'error'); }
    finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (convId: number) => {
    setLoadingMsgs(true);
    try {
      const data = await api.get<Message[]>(`/messages/conversations/${convId}/messages`);
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    } catch { showToast?.('Erro', 'error'); }
    finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => { loadConvs(); api.get<User[]>('/messages/users').then(setUsers).catch(() => {}); }, [loadConvs]);
  useEffect(() => { if (active) loadMessages(active.id); }, [active, loadMessages]);

  // Polling simples a cada 5s quando há conversa activa
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => loadMessages(active.id), 5000);
    return () => clearInterval(iv);
  }, [active, loadMessages]);

  const send = async () => {
    if (!active || !newMsg.trim()) return;
    setSending(true);
    try {
      const msg = await api.post<Message>(`/messages/conversations/${active.id}/messages`, { content: newMsg });
      setMessages(prev => [...prev, msg]);
      setNewMsg('');
      setTimeout(scrollToBottom, 100);
      loadConvs();
    } catch { showToast?.('Erro ao enviar', 'error'); }
    finally { setSending(false); }
  };

  const createConv = async () => {
    if (!selectedUsers.length) return;
    try {
      const isGroup = selectedUsers.length > 1;
      const conv = await api.post<Conversation>('/messages/conversations', {
        type: isGroup ? 'group' : 'direct',
        name: isGroup ? (groupName || 'Grupo') : null,
        member_ids: selectedUsers,
      });
      setNewConvModal(false); setSelectedUsers([]); setGroupName('');
      await loadConvs();
      setActive(conv);
    } catch { showToast?.('Erro ao criar conversa', 'error'); }
  };

  const convName = (c: Conversation) => c.name || c.members?.map(m => m.name).join(', ') || 'Conversa';
  const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <PageShell title="Mensagens" description="Chat interno entre membros da equipa"
      actions={
        <button onClick={() => setNewConvModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Conversa
        </button>
      }>

      <div className="bg-surface-raised rounded-2xl border border-border-default overflow-hidden" style={{ height: '70vh' }}>
        <div className="flex h-full">
          {/* Sidebar conversas */}
          <div className="w-72 border-r border-border-default flex flex-col shrink-0">
            <div className="p-3 border-b border-border-default">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Conversas</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-content-muted" /></div>
              ) : convs.length === 0 ? (
                <p className="text-xs text-center text-content-muted py-8">Nenhuma conversa</p>
              ) : convs.map(c => (
                <button key={c.id} onClick={() => setActive(c)}
                  className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-surface-overlay transition-colors border-b border-border-default/30 ${active?.id === c.id ? 'bg-surface-overlay' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {c.type === 'group' ? <Users className="w-4 h-4" /> : convName(c).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-content-primary truncate">{convName(c)}</p>
                      {c.unread_count > 0 && <span className="shrink-0 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center">{c.unread_count}</span>}
                    </div>
                    {c.last_message && <p className="text-xs text-content-muted truncate">{c.last_message}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Área de mensagens */}
          <div className="flex-1 flex flex-col">
            {active ? (
              <>
                <div className="px-4 py-3 border-b border-border-default">
                  <p className="font-medium text-content-primary">{convName(active)}</p>
                  {active.members && <p className="text-xs text-content-muted">{active.members.map(m => m.name).join(', ')}</p>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-content-muted" /></div>
                  ) : messages.map(m => (
                    <div key={m.id} className="flex items-end gap-2">
                      <div className="w-7 h-7 rounded-full bg-surface-overlay text-content-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {m.sender_name?.charAt(0) || '?'}
                      </div>
                      <div className="max-w-sm">
                        <p className="text-xs text-content-muted mb-0.5">{m.sender_name} · {fmtTime(m.created_at)}</p>
                        <div className="bg-surface-overlay rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-content-primary">{m.content}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t border-border-default flex gap-2">
                  <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Escrever mensagem… (Enter para enviar)"
                    className="flex-1 px-3 py-2 text-sm border border-border-default rounded-xl bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button onClick={send} disabled={sending || !newMsg.trim()}
                    className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl disabled:opacity-50">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col gap-3 text-content-muted">
                <MessageSquare className="w-12 h-12 opacity-20" />
                <p className="text-sm">Selecciona uma conversa</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal nova conversa */}
      {newConvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm animate-modal-enter">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h3 className="font-semibold text-content-primary">Nova Conversa</h3>
              <button onClick={() => { setNewConvModal(false); setSelectedUsers([]); }} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {selectedUsers.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Nome do Grupo</label>
                  <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ex: Equipa de Vendas" className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-content-secondary mb-2">Seleccionar membros</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-overlay cursor-pointer">
                      <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={e => setSelectedUsers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} className="rounded" />
                      <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center text-xs font-bold">{u.name.charAt(0)}</div>
                      <span className="text-sm text-content-primary">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setNewConvModal(false); setSelectedUsers([]); }} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
                <button onClick={createConv} disabled={!selectedUsers.length}
                  className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                  Iniciar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default Messaging;
