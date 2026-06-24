import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

import { User, UserRole } from '../../../core/types/types';
import { Menu, X, LogOut, ChevronDown, User as UserIcon, Globe, LayoutDashboard, ShoppingCart, TrendingUp, Truck, Users, Package, ShoppingBag, BarChart3, Activity, FileText, ArrowLeftRight, Wallet, Repeat, Share2, Megaphone, Image, Tag, Ruler, List, ClipboardCheck, AlertTriangle, Scale, Shield, Boxes, Store, MapPin, CreditCard, BookOpen, Building2, UserCog, FolderKanban, Headphones, Clock, MessageSquare, RefreshCw, FolderOpen } from 'lucide-react';
import { useLanguage } from '../../../core/contexts/LanguageContext';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { usePermissions } from '../../../core/hooks/usePermissions';
import { useMobile } from '../../../core/hooks/useMobile';
import { Footer } from '../layout/Footer';

const BASE_PATH = '/';

interface LayoutProps {
 children: React.ReactNode;
 currentUser: User;
 activePage: string;
 onNavigate: (page: string) => void;
 onLogout: () => void;
 isDarkMode: boolean;
 toggleTheme: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
 children,
 currentUser,
 activePage,
 onNavigate,
 onLogout,
 isDarkMode,
 toggleTheme
}) => {
 const navigate = useNavigate();
 const { t, language, setLanguage } = useLanguage();
 const { hasPermission } = usePermissions(currentUser);
 const isMobile = useMobile(768);
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 // Removed duplicate state


 // Estado do sidebar com persistéªncia no localStorage
 const [sidebarOpen, setSidebarOpen] = useState(() => {
 const saved = localStorage.getItem('sidebarOpen');
 return saved ? saved === 'true' : false; // Padréo: fechado
 });

 // Salvar estado do sidebar no localStorage quando mudar
 useEffect(() => {
 localStorage.setItem('sidebarOpen', String(sidebarOpen));
 }, [sidebarOpen]);

 const toggleSidebar = () => {
 setSidebarOpen(prev => !prev);
 };

 // Obter pathname atual
 const location = useLocation();

 // Estrutura simplificada para verificação de rotas (definida antes do useEffect)
 const menuItemsWithChildren = [
 { id: 'sales', children: [{ path: '/admin/pos' }, { path: '/admin/caixa' }, { path: '/admin/cotacoes' }, { path: '/admin/vendas/pedidos' }, { path: '/admin/vendas/clientes' }, { path: '/admin/vendas' }, { path: '/admin/vendas/por-produto' }] },
 { id: 'purchases', children: [{ path: '/admin/compras' }, { path: '/admin/compras/por-produto' }, { path: '/admin/compras/fornecedores' }, { path: '/admin/compras-flow' }] },
 { id: 'products', children: [{ path: '/admin/produtos' }, { path: '/admin/produtos/categorias' }, { path: '/admin/produtos/unidades' }, { path: '/admin/produtos/etiquetas' }] },
 { id: 'stock-management', children: [{ path: '/admin/stock' }, { path: '/admin/stock/alertas' }, { path: '/admin/stock/movimentos' }, { path: '/admin/stock/lotes' }, { path: '/admin/stock/auditoria' }, { path: '/admin/stock/ajustes' }] },
 { id: 'users', children: [{ path: '/admin/usuarios' }, { path: '/admin/usuarios/roles' }] },
 { id: 'financas', children: [{ path: '/admin/financas' }, { path: '/admin/faturas' }, { path: '/admin/contas-pagar' }, { path: '/admin/razao-geral' }] },
 ];

 // Estado para controlar quais submenus estão expandidos no mobile
 const [mobileExpandedMenus, setMobileExpandedMenus] = useState<Record<string, boolean>>({});

 // Auto-expandir apenas o menu que contém a rota atual (mobile)
 useEffect(() => {
 const currentPath = location.pathname;
 let activeMenuId: string | null = null;

 // Encontrar qual menu pai contém a rota atual
 for (const item of menuItemsWithChildren) {
 if (item.children?.some(child =>
 currentPath === child.path || currentPath.startsWith(child.path + '/')
 )) {
 activeMenuId = item.id;
 break;
 }
 }

 // Se encontrou um menu ativo, expandir apenas esse
 if (activeMenuId) {
 setMobileExpandedMenus(prev => {
 const shouldUpdate = !prev[activeMenuId] ||
 Object.keys(prev).some(key => key !== activeMenuId && prev[key]);

 if (shouldUpdate) {
 const newState: Record<string, boolean> = {};
 menuItemsWithChildren.forEach(item => {
 newState[item.id] = item.id === activeMenuId;
 });
 return newState;
 }
 return prev;
 });
 }
 }, [location.pathname]);

 const toggleMobileMenuExpansion = (menuId: string) => {
 setMobileExpandedMenus(prev => {
 const isCurrentlyExpanded = prev[menuId];
 // Comportamento accordion - fecha outros ao expandir
 if (!isCurrentlyExpanded) {
 const newState: Record<string, boolean> = {};
 menuItemsWithChildren.forEach(item => {
 newState[item.id] = item.id === menuId;
 });
 return newState;
 } else {
 return { ...prev, [menuId]: false };
 }
 });
 };

 // Submenu item interface
 interface SubMenuItem {
 id: string;
 label: string;
 icon?: any;
 path: string;
 }

 // Main menu item interface with optional children
 interface MenuItem {
 id: string;
 label: string;
 icon: any;
 permission: string;
 children?: SubMenuItem[];
 }

 // Estrutura do menu com submenus (igual ao Sidebar)
 const allMenuItems: MenuItem[] = [
 { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, permission: 'dashboard.view' },
 {
 id: 'sales',
 label: t.nav.sales,
 icon: TrendingUp,
 permission: 'sales.view',
 children: [
 { id: 'pos-sell', label: 'Vender', icon: CreditCard, path: '/admin/pos' },
 { id: 'caixa', label: 'Caixa', icon: Store, path: '/admin/caixa' },
 { id: 'sales-orders', label: t.nav.orders, icon: ShoppingCart, path: '/admin/vendas/pedidos' },
 { id: 'cotacoes', label: 'Cotações', icon: FileText, path: '/admin/cotacoes' },
 { id: 'sales-customers', label: t.nav.customers, icon: Users, path: '/admin/vendas/clientes' },
 { id: 'sales-summaries', label: 'Resumos', icon: List, path: '/admin/vendas' },
 { id: 'sales-by-product', label: 'Por Produto', icon: Package, path: '/admin/vendas/por-produto' },
 ]
 },
 {
 id: 'purchases',
 label: t.nav.purchases,
 icon: ShoppingBag,
 permission: 'purchases.view',
 children: [
 { id: 'purchases-list', label: 'Compras', icon: ShoppingBag, path: '/admin/compras' },
 { id: 'purchases-by-product', label: 'Por Produto', icon: Package, path: '/admin/compras/por-produto' },
 { id: 'purchases-suppliers', label: 'Fornecedores', icon: Truck, path: '/admin/compras/fornecedores' },
 ]
 },
 {
 id: 'products',
 label: t.nav.products,
 icon: Package,
 permission: 'products.view',
 children: [
 { id: 'products-list', label: 'Produtos', icon: Package, path: '/admin/produtos' },
 { id: 'products-categories', label: 'Categorias', icon: Tag, path: '/admin/produtos/categorias' },
 { id: 'products-units', label: 'Unidades', icon: Ruler, path: '/admin/produtos/unidades' },
 { id: 'products-labels', label: 'Etiquetas', icon: ClipboardCheck, path: '/admin/produtos/etiquetas' },
 ]
 },
 {
 id: 'stock-management',
 label: t.nav.stock,
 icon: BarChart3,
 permission: 'products.view',
 children: [
 { id: 'stock-products', label: 'Produtos', icon: Package, path: '/admin/stock' },
 { id: 'stock-alerts', label: 'Alertas', icon: AlertTriangle, path: '/admin/stock/alertas' },
 { id: 'stock-movements', label: 'Movimentos', icon: ArrowLeftRight, path: '/admin/stock/movimentos' },
 { id: 'stock-lots', label: 'Lotes', icon: Boxes, path: '/admin/stock/lotes' },
 { id: 'stock-audit', label: 'Auditoria', icon: ClipboardCheck, path: '/admin/stock/auditoria' },
 { id: 'stock-adjustments', label: 'Ajustes', icon: Scale, path: '/admin/stock/ajustes' },
 ]
 },
 { id: 'media', label: t.nav.gallery, icon: Image, permission: 'media.view' },
 {
 id: 'users',
 label: t.nav.users,
 icon: Users,
 permission: 'users.view',
 children: [
 { id: 'users-list', label: 'Usuários', icon: Users, path: '/admin/usuarios' },
 { id: 'users-roles', label: 'Gerir Roles', icon: Shield, path: '/admin/usuarios/roles' },
 ]
 },
 { id: 'financas', label: 'Finanças', icon: Wallet, permission: 'finance.view', children: [
  { id: 'financas-iva', label: 'IVA / Configuração', icon: Wallet, path: '/admin/financas' },
  { id: 'invoices', label: 'Faturas', icon: ClipboardCheck, path: '/admin/faturas' },
  { id: 'ap', label: 'Contas a Pagar', icon: Building2, path: '/admin/contas-pagar' },
  { id: 'ledger', label: 'Razão Geral', icon: BookOpen, path: '/admin/razao-geral' },
 ] },
 { id: 'tracking', label: t.nav.statistics, icon: Activity, permission: 'analytics.view' },
 { id: 'logistics', label: 'Logística', icon: Truck, permission: 'logistics.manage' },
 { id: 'coupons', label: 'Cupões', icon: Tag, permission: 'sales.discount' },
 { id: 'refunds', label: 'Reembolsos', icon: Repeat, permission: 'orders.view' },
 { id: 'affiliates', label: 'Afiliados', icon: Share2, permission: 'users.view' },
 { id: 'marketing', label: 'Marketing', icon: Megaphone, permission: 'sales.view' },
 { id: 'blog', label: 'Blog', icon: FileText, permission: 'media.view' },
 { id: 'delivery-zones', label: 'Zonas de Entrega', icon: MapPin, permission: 'logistics.manage' },
 // Novos módulos
 { id: 'hr', label: 'Recursos Humanos', icon: UserCog, permission: 'hr.view' },
 { id: 'projects', label: 'Projectos', icon: FolderKanban, permission: 'projects.view' },
 { id: 'helpdesk', label: 'Central de Ajuda', icon: Headphones, permission: 'helpdesk.view' },
 { id: 'timesheets', label: 'Planilhas de Horas', icon: Clock, permission: 'timesheets.view' },
 { id: 'messaging', label: 'Mensagens', icon: MessageSquare, permission: 'messaging.view' },
 { id: 'subscriptions', label: 'Assinaturas', icon: RefreshCw, permission: 'subscriptions.view' },
 { id: 'documents', label: 'Documentos', icon: FolderOpen, permission: 'documents.view' },
 ];

 // State for enabled modules - using generic record logic like Sidebar
 const [enabledModules, setEnabledConfig] = useState<Record<string, boolean>>({});

 // Carregar módulos habilitados do local storage (consistente com Sidebar)
 useEffect(() => {
 const loadModulesConfig = () => {
 try {
 const stored = localStorage.getItem('system_modules_config');
 if (stored) {
 setEnabledConfig(JSON.parse(stored));
 } else {
 setEnabledConfig({});
 }
 } catch (e) {
 console.warn('Error parsing modules config', e);
 }
 };

 loadModulesConfig();

 const handleUpdate = () => loadModulesConfig();
 window.addEventListener('modules_updated', handleUpdate);
 return () => window.removeEventListener('modules_updated', handleUpdate);
 }, []);

 // Helper to check if a module is enabled (Shared logic from Sidebar)
 const isModuleEnabled = (moduleId: string) => {
 if (Object.keys(enabledModules).length === 0) return true;

 const moduleMap: Record<string, string> = {
 'dashboard': 'dashboard',
 'orders': 'orders',
 'sales': 'sales',
 'customers': 'customers',
 'purchases': 'purchases',
 'products': 'products',
 'stock-management': 'stock-management',
 'media': 'media',
 'users': 'users',
 'tracking': 'dashboard',
 'financas': 'financas',
 'logistics': 'logistics',
 'coupons': 'sales',
 'refunds': 'orders',
 'affiliates': 'affiliates',
 'marketing': 'marketing',
 'blog': 'media',
 'delivery-zones': 'logistics',
 // Novos módulos sempre activados se não houver config
 'hr': 'hr',
 'projects': 'projects',
 'helpdesk': 'helpdesk',
 'timesheets': 'timesheets',
 'messaging': 'messaging',
 'subscriptions': 'subscriptions',
 'documents': 'documents',
 };

 const configId = moduleMap[moduleId];
 if (!configId) return true;

 return enabledModules[configId] !== false;
 };

 // Mé³dulos administrativos que sempre aparecem para admins (mesmo com "all" selecionado)
 const adminModules = new Set(['users', 'roles', 'locations-management', 'admin-tracking', 'media', 'profile']);

 // Filtrar itens baseado apenas nas permissões (sincronizado com o Sidebar)
 const filteredMenuItems = useMemo(() => {
 return allMenuItems.filter(item => {
 // 1. Check Module status
 if (!isModuleEnabled(item.id)) return false;

 // 2. Check Permission
 if (!item.permission) return true;
 return hasPermission(item.permission);
 });
 }, [hasPermission, t, enabledModules]);

 const handleNavigate = (page: string) => {
 onNavigate(page);
 setMobileMenuOpen(false);
 };

 const handleLogout = () => {
 onLogout();
 setUserMenuOpen(false);
 setMobileMenuOpen(false);
 };

 // Calcular margin-left do conteúdo baseado no estado do sidebar
 const sidebarWidth = sidebarOpen ? 256 : 80; // 64px (w-20) quando fechado, 256px (w-64) quando aberto

 return (
 <div className="min-h-screen bg-surface-base flex transition-colors duration-300">
 {/* Desktop Sidebar */}
 {activePage !== 'shop' && (
 <Sidebar
 currentUser={currentUser}
 activePage={activePage}
 onNavigate={onNavigate}
 onLogout={handleLogout}
 isDarkMode={isDarkMode}
 isOpen={sidebarOpen}
 onToggle={toggleSidebar}
 />
 )}

 {/* Mobile Header */}
 {activePage !== 'shop' && (
 <div className="md:hidden fixed w-full bg-surface-raised z-30 border-b border-border-default shadow-md overflow-visible">
 <div className="px-4 sm:px-5 py-3 sm:py-3.5 flex justify-between items-center min-h-[56px] sm:min-h-[64px] relative">
 {/* Logo */}
 <div className="flex items-center min-w-0 flex-1">
 <button
 onClick={() => {
 navigate('/');
 }}
 className="flex-shrink-0 cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity touch-manipulation"
 >
 <Logo variant="full" width={150} height={46} className="h-[46px] w-auto max-w-[150px] object-contain" isDarkMode={isDarkMode} />
 </button>
 </div>

 {/* Right side buttons */}
 <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0 relative">
 {/* User Menu Button */}
 <div className="relative z-50">
 <button
 onClick={() => {
 setUserMenuOpen(!userMenuOpen);
 setMobileMenuOpen(false);
 }}
 className="flex items-center space-x-2 px-2 py-1.5 rounded-xl active:bg-surface-raised hover:bg-surface-raised/50 transition-all touch-manipulation min-h-[44px]"
 aria-label="Menu do usuário"
 >
 <div className="border-2 border-border-strong rounded-full shadow-sm">
 <Avatar
 src={currentUser.avatar}
 alt={currentUser.name}
 name={currentUser.name}
 size="md"
 />
 </div>
 <div className="hidden sm:flex flex-col items-start min-w-0">
 <span className="text-sm font-semibold text-content-primary truncate max-w-[120px]">
 {currentUser.name.split(' ')[0]}
 </span>
 <span className="text-xs text-content-muted truncate max-w-[120px]">
 {currentUser.name.split(' ').slice(1).join(' ') || ' '}
 </span>
 </div>
 <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-content-secondary transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
 </button>

 {/* User Dropdown Menu */}
 {userMenuOpen && (
 <>
 <div
 className="fixed inset-0 z-[50]"
 onClick={() => setUserMenuOpen(false)}
 />
 <div className="fixed right-2 top-[72px] sm:absolute sm:right-0 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-[90vw] sm:max-w-sm bg-surface-raised rounded-xl shadow-2xl border border-border-default z-[70] overflow-hidden max-h-[calc(100vh-120px)] overflow-y-auto">
 <div className="p-4 border-b border-border-default bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/20">
 <div className="flex items-center space-x-3">
 <div className="border-2 border-brand-200 dark:border-brand-700 rounded-full shadow-sm">
 <Avatar
 src={currentUser.avatar}
 alt={currentUser.name}
 name={currentUser.name}
 size="lg"
 />
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-base font-semibold text-content-primary truncate">{currentUser.name}</p>
 <p className="text-xs text-content-muted truncate mt-0.5">{currentUser.email}</p>
 <p className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-medium">
 {currentUser.roleDisplayName || (currentUser.role === UserRole.ADMIN ? t.ui.admin : t.ui.staff)}
 </p>
 </div>
 </div>
 </div>
 <div className="p-2">
 <button
 onClick={() => {
 setUserMenuOpen(false);
 setMobileMenuOpen(false);
 onNavigate('profile');
 }}
 className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-content-secondary hover:bg-surface-raised rounded-lg transition-colors touch-manipulation min-h-[44px]"
 >
 <UserIcon className="w-5 h-5" />
 <span>Meu Perfil</span>
 </button>
 <div className="flex gap-1 px-4 py-2">
 <button
 onClick={() => setLanguage('pt')}
 className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] ${language === 'pt' ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 ' : 'text-content-secondary hover:bg-surface-raised'}`}
 >
 PT
 </button>
 <button
 onClick={() => setLanguage('en')}
 className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] ${language === 'en' ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 ' : 'text-content-secondary hover:bg-surface-raised'}`}
 >
 EN
 </button>
 </div>
 <button
 onClick={() => {
 setUserMenuOpen(false);
 setMobileMenuOpen(false);
 navigate('/');
 }}
 className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-content-secondary hover:bg-surface-raised rounded-lg transition-colors touch-manipulation min-h-[44px]"
 >
 <Globe className="w-5 h-5" />
 <span>Voltar ao Site</span>
 </button>
 <button
 onClick={handleLogout}
 className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation min-h-[44px] mt-1"
 >
 <LogOut className="w-5 h-5" />
 <span>{t.auth.logout}</span>
 </button>
 </div>
 </div>
 </>
 )}
 </div>

 {/* Menu Toggle Button */}
 <button
 onClick={() => {
 setMobileMenuOpen(!mobileMenuOpen);
 setUserMenuOpen(false);
 }}
 className="p-2.5 sm:p-3 rounded-xl active:bg-surface-raised hover:bg-surface-raised/50 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
 aria-label="Menu de navegação"
 >
 {mobileMenuOpen ? (
 <X className="w-6 h-6 sm:w-7 sm:h-7 text-content-primary" />
 ) : (
 <Menu className="w-6 h-6 sm:w-7 sm:h-7 text-content-primary" />
 )}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Mobile Menu Sidebar */}
 {mobileMenuOpen && (
 <>
 <div
 className="md:hidden fixed inset-0 min-h-screen min-w-full z-40 modal-overlay transition-opacity"
 onClick={() => setMobileMenuOpen(false)}
 />
 <div
 className="md:hidden fixed left-0 top-0 h-full w-[85vw] max-w-sm bg-surface-raised z-50 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto"
 onClick={e => e.stopPropagation()}
 >
 {/* Menu Header */}
 <div className="px-4 py-4 flex items-center justify-start border-b border-border-default bg-gradient-to-r from-brand-50 to-brand-100/50 dark:bg-none dark:bg-surface-overlay">
 <div className="flex-shrink-0 flex items-center overflow-hidden">
 <button
 onClick={() => {
 navigate('/');
 }}
 className="cursor-pointer hover:opacity-80 transition-opacity"
 >
 <Logo width={220} height={70} className="h-16 w-auto max-w-[calc(100%-2rem)] object-contain" isDarkMode={isDarkMode} />
 </button>
 </div>
 </div>

 {/* Navigation Menu com Submenus Accordion */}
 <nav className="flex-1 py-3 sm:py-4 px-2 sm:px-3 space-y-1">
 {filteredMenuItems.map((item) => {
 const Icon = item.icon;
 const hasChildren = item.children && item.children.length > 0;
 const isExpanded = mobileExpandedMenus[item.id];

 // Verificar se algum submenu está ativo
 const isSubmenuActive = hasChildren && item.children?.some(
 child => location.pathname === child.path || location.pathname.startsWith(child.path + '/')
 );
 const isActive = activePage === item.id || activePage.startsWith(item.id + '-') || isSubmenuActive;

 if (hasChildren) {
 return (
 <div key={item.id} className="space-y-1">
 {/* Menu principal com seta de expansão */}
 <button
 onClick={() => toggleMobileMenuExpansion(item.id)}
 className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors text-sm font-medium touch-manipulation ${isActive
 ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 '
 : 'text-content-secondary active:bg-surface-raised hover:bg-surface-raised hover:text-content-primary'
 }`}
 >
 <div className="flex items-center space-x-3">
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-700 dark:text-brand-300 ' : 'text-content-muted'}`} />
 <span className="truncate">{item.label}</span>
 </div>
 <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? 'text-brand-700 dark:text-brand-300 ' : 'text-content-muted'}`} />
 </button>

 {/* Submenus com animação */}
 <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
 <div className="pl-4 space-y-0.5 pt-1">
 {item.children?.map(child => {
 const ChildIcon = child.icon;

 // Encontrar o melhor match entre os irmãos (o path mais longo que coincide)
 const matchingSiblings = item.children?.filter(c =>
 location.pathname === c.path || location.pathname.startsWith(c.path + '/')
 ) || [];
 const bestSiblingMatch = matchingSiblings.reduce((prev, curr) =>
 (curr.path.length > prev.path.length) ? curr : prev
 , matchingSiblings[0]);

 const isChildActive = child.id === bestSiblingMatch?.id;
 return (
 <button
 key={child.id}
 onClick={() => {
 navigate(child.path);
 setMobileMenuOpen(false);
 }}
 className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm touch-manipulation ${isChildActive
 ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border-l-2 border-l-brand-600 dark:border-l-brand-400'
 : 'text-content-secondary active:bg-surface-raised hover:bg-surface-raised hover:text-content-primary'
 }`}
 >
 {ChildIcon && <ChildIcon className={`w-4 h-4 flex-shrink-0 ${isChildActive ? 'text-brand-600 dark:text-brand-400' : 'text-content-muted'}`} />}
 <span className="truncate">{child.label}</span>
 </button>
 );
 })}
 </div>
 </div>
 </div>
 );
 }

 // Item sem submenus
 return (
 <button
 key={item.id}
 onClick={() => handleNavigate(item.id)}
 className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium touch-manipulation ${isActive
 ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 '
 : 'text-content-secondary active:bg-surface-raised hover:bg-surface-raised hover:text-content-primary'
 }`}
 >
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-700 dark:text-brand-300 ' : 'text-content-muted'}`} />
 <span className="truncate">{item.label}</span>
 </button>
 );
 })}
 </nav>

 {/* Menu Footer */}
 <div className="p-2 border-t border-border-default space-y-2">
 <div className="flex items-center space-x-2 px-2 py-1.5 rounded-lg bg-surface-base">
 <Avatar
 src={currentUser.avatar}
 alt={currentUser.name}
 name={currentUser.name}
 size="sm"
 className="bg-border-strong"
 />
 <div className="flex-1 min-w-0">
 <p className="text-xs font-medium text-content-primary truncate">{currentUser.name}</p>
 </div>
 </div>

 {/* Idioma PT / EN */}
 <div className="flex gap-1">
 <button
 onClick={() => setLanguage('pt')}
 className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${language === 'pt' ? 'border-brand-500 bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 ' : 'border-border-default text-content-secondary hover:bg-surface-raised'}`}
 >
 PT
 </button>
 <button
 onClick={() => setLanguage('en')}
 className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${language === 'en' ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20 text-brand-700 dark:text-brand-400' : 'border-border-default text-content-secondary hover:bg-surface-raised'}`}
 >
 EN
 </button>
 </div>

 {/* Botéo Voltar ao Site */}
 <button
 onClick={() => {
 setMobileMenuOpen(false);
 navigate('/');
 }}
 className="w-full flex items-center space-x-2 px-3 py-2 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-100 transition-colors"
 >
 <Globe className="w-4 h-4" />
 <span>Voltar ao Site</span>
 </button>

 {/* Botéo Sair */}
 <button
 onClick={handleLogout}
 className="w-full flex items-center space-x-2 px-3 py-2 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-100 transition-colors"
 >
 <LogOut className="w-4 h-4" />
 <span>{t.auth.logout}</span>
 </button>
 </div>
 </div>
 </>
 )}

 {/* Main Content */}
 <main
 className={`flex-1 p-3 sm:p-4 md:p-8 ${activePage === 'shop' ? 'pt-0' : 'pt-[88px] sm:pt-[88px] md:pt-4'} ${activePage === 'shop' ? 'pb-24' : 'pb-4'} md:pb-8 overflow-x-hidden text-content-primary transition-all duration-300`}
 style={{ marginLeft: (!isMobile && activePage !== 'shop') ? `${sidebarWidth}px` : '0' }}
 >
 {children}
 </main>

 </div>
 );
};

