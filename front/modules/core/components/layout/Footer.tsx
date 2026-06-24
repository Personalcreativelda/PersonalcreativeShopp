import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Phone, Mail, Leaf } from 'lucide-react';
import { Logo } from '../ui/Logo';
import api from '../../../core/services/apiClient';

interface Category {
 id: string;
 name: string;
 isActive: boolean;
}

interface FooterProps {
 isShopMode?: boolean;
}

const FooterComponent: React.FC<FooterProps> = ({ isShopMode = false }) => {
 const [categories, setCategories] = useState<Category[]>([]);

 useEffect(() => {
 api.get('/categories')
 .then((data: any) => setCategories((data || []).filter((c: Category) => c.isActive !== false)))
 .catch(() => {});
 }, []);

 return (
 <footer className="mt-16 pb-20 md:pb-0" style={{ background: '#18181b', color: '#ffffff' }}>
 <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-8">

 <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">

 {/* Coluna 1 — Marca */}
 <div className="col-span-2 md:col-span-1">
 <div className="mb-4">
 <Logo width={130} height={44} isDarkMode={true} />
 </div>
 <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
 Produtos naturais de qualidade para a sua saúde e bem-estar, selecionados com cuidado.
 </p>
 <div className="flex gap-3 mt-5">
 <a href="https://www.instagram.com/naturervamz/" target="_blank" rel="noopener noreferrer"
 className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-purple-500/20" aria-label="Instagram">
 <Instagram className="h-4 w-4" />
 </a>
 <a href="https://www.facebook.com/naturervamz/" target="_blank" rel="noopener noreferrer"
 className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-blue-500/20" aria-label="Facebook">
 <Facebook className="h-4 w-4" />
 </a>
 <a href="https://wa.me/258874209440" target="_blank" rel="noopener noreferrer"
 className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-green-500/20" aria-label="WhatsApp">
 <Phone className="h-4 w-4" />
 </a>
 </div>
 </div>

 {/* Coluna 2 — Categorias reais */}
 <div>
 <h4 className="mb-4 font-semibold text-white text-sm uppercase tracking-wide flex items-center gap-2">
 <Leaf className="h-3.5 w-3.5 text-green-500" />
 Categorias
 </h4>
 <ul className="space-y-2.5 text-sm">
 {categories.length > 0 ? (
 categories.map(cat => (
 <li key={cat.id}>
 <Link
 to={`/loja?categoria=${encodeURIComponent(cat.name)}`}
 className="hover:text-green-400 transition-colors"
 style={{ color: 'rgba(255,255,255,0.55)' }}
 >
 {cat.name}
 </Link>
 </li>
 ))
 ) : (
 <li className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>A carregar...</li>
 )}
 </ul>
 </div>

 {/* Coluna 3 — Ajuda */}
 <div>
 <h4 className="mb-4 font-semibold text-white text-sm uppercase tracking-wide">Ajuda</h4>
 <ul className="space-y-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
 <li><Link to="/sobre" className="hover:text-green-400 transition-colors">Sobre Nós</Link></li>
 <li><Link to="/contactos" className="hover:text-green-400 transition-colors">Fale Connosco</Link></li>
 <li><Link to="/politica" className="hover:text-green-400 transition-colors">Política de Troca</Link></li>
 <li><Link to="/politica" className="hover:text-green-400 transition-colors">Perguntas Frequentes</Link></li>
 </ul>
 </div>

 {/* Coluna 4 — Contacto */}
 <div>
 <h4 className="mb-4 font-semibold text-white text-sm uppercase tracking-wide">Contacto</h4>
 <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>Receba ofertas exclusivas e novidades</p>
 <a href="mailto:info@natur-erva.co.mz" className="flex items-center gap-2 text-sm hover:text-green-400 transition-colors mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
 <Mail className="h-4 w-4 text-green-500 flex-shrink-0" />
 info@natur-erva.co.mz
 </a>
 <div className="flex gap-2">
 <input
 type="email"
 placeholder="Seu e-mail"
 className="flex-1 min-w-0 px-3 py-2 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 transition-colors"
 style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
 />
 <button className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 text-white">
 OK
 </button>
 </div>
 </div>
 </div>

 <div className="mt-10 pt-6 text-center text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
 © {new Date().getFullYear()} Natur Erva · Todos os direitos reservados
 </div>
 </div>
 </footer>
 );
};

export const Footer = memo(FooterComponent, (prev, next) => prev.isShopMode === next.isShopMode);
