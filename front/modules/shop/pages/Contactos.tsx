import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, MessageSquare, Send, Instagram, Facebook } from 'lucide-react';
import { PageHeroBanner } from '../components/PageHeroBanner';

const Contactos: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Abre WhatsApp com a mensagem pré-preenchida
    const text = encodeURIComponent(
      `Olá Naturerva!\n\nNome: ${form.name}\nEmail: ${form.email}\nTelefone: ${form.phone}\n\nMensagem:\n${form.message}`
    );
    window.open(`https://wa.me/258874209440?text=${text}`, '_blank');
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div className="min-h-screen bg-surface-base">

      <PageHeroBanner
        pageKey="contactos"
        defaultTitle="Fale Connosco"
        defaultSubtitle="Estamos aqui para ajudar. Escolha a forma mais conveniente de nos contactar."
        defaultIcon={<MessageSquare className="w-7 h-7" />}
        defaultBgColor="#0f766e"
      />

      <section className="py-14 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10">

          {/* Informações de contacto */}
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-content-primary mb-6">Informações de Contacto</h2>

            {[
              {
                icon: <Phone className="w-5 h-5" />,
                label: 'Telefone / WhatsApp',
                value: '+258 84 420 9440',
                href: 'https://wa.me/258874209440',
                color: 'text-green-600 bg-green-59440 dark:bg-green-900/20',
              },
              {
                icon: <Mail className="w-5 h-5" />,
                label: 'Email',
                value: 'info@naturerva.co.mz',
                href: 'mailto:info@naturerva.co.mz',
                color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
              },
              {
                icon: <MapPin className="w-5 h-5" />,
                label: 'Localização',
                value: 'Beira, Moçambique',
                href: undefined,
                color: 'text-red-500 bg-red-50 dark:bg-red-900/20',
              },
              {
                icon: <Clock className="w-5 h-5" />,
                label: 'Horário de Atendimento',
                value: 'Seg – Sáb: 8h00 às 17h00',
                href: undefined,
                color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  {item.icon}
                </span>
                <div>
                  <p className="text-xs text-content-muted mb-0.5">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-content-primary hover:text-green-600 dark:hover:text-green-400 transition-colors">
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-content-primary">{item.value}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Redes sociais */}
            <div className="pt-4 border-t border-border-default">
              <p className="text-xs text-content-muted mb-3">Siga-nos nas redes sociais</p>
              <div className="flex gap-3">
                <a href="https://instagram.com/naturervamz" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                  <Instagram className="w-4 h-4" /> Instagram
                </a>
                <a href="https://facebook.com/naturervamz" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                  <Facebook className="w-4 h-4" /> Facebook
                </a>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="bg-surface-base rounded-2xl p-6 border border-border-default">
            <h2 className="text-xl font-bold text-content-primary mb-5">Envie uma Mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Nome</label>
                <input
                  type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="O seu nome"
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-surface-raised text-sm text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Email</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="o.seu@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-surface-raised text-sm text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Telefone</label>
                <input
                  type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+258 8X XXX XXXX"
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-surface-raised text-sm text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Mensagem</label>
                <textarea
                  required rows={4} value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Escreva a sua mensagem..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-surface-raised text-sm text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                {sent ? 'A abrir WhatsApp...' : 'Enviar via WhatsApp'}
              </button>
              <p className="text-xs text-center text-content-muted">
                A mensagem será enviada via WhatsApp.
              </p>
            </form>
          </div>

        </div>
      </section>

    </div>
  );
};

export default Contactos;
