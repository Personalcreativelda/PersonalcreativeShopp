import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, Package, LogOut, Award, TrendingUp, Warehouse, ChevronLeft, ChevronRight, ChevronDown, ShoppingBag, Egg, UserCheck, Repeat, Truck, FileText, BarChart3, ArrowLeftRight, Wallet, Download, Activity, ArrowRight, Upload, Globe, CreditCard, Megaphone, Target, Share2, Eye, MapPin, Store, Image, Tv, List, Layers, Ruler, Tag, ClipboardCheck, Scale, AlertTriangle, Shield, Boxes, BookOpen, Building2, UserCog, FolderKanban, Headphones, Clock, MessageSquare, RefreshCw, FolderOpen } from 'lucide-react';
import { User, UserRole } from '../../../core/types/types';
import { useLanguage } from '../../../core/contexts/LanguageContext';

const ROLE_LABELS: Record<string, string> = {
 'SUPER_ADMIN': 'Super Administrador',
 'ADMIN': 'Administrador',
 'GESTOR_VENDAS': 'Gestor de Vendas',
 'GESTOR_BLOG': 'Gestor de Blog',
 'VENDEDOR': 'Vendedor',
 'LOGISTICA': 'Logística',
 'GERENTE': 'Gerente',
 'AFILIADO': 'Afiliado',
 'STAFF': 'Staff',
 'CLIENTE': 'Cliente',
};

function getRoleLabel(user: User): string {
 if ((user as any).roleDisplayName) return (user as any).roleDisplayName;
 const primary = ((user.roles?.[0] || user.role) ?? 'STAFF').toUpperCase();
 return ROLE_LABELS[primary] || primary.replace(/_/g, ' ');
}
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { LanguageFlag } from '../ui/LanguageFlag';
import { usePermissions } from '../../../core/hooks/usePermissions';
import { uploadService } from '../../../../services/uploadService';
import api from '../../services/apiClient';
import { invalidateLogoCache } from '../../services/systemSettingsService';

const BASE_PATH = '/';

interface SidebarProps {
 currentUser: User;
 activePage: string;
 onNavigate: (page: string) => void;
 onLogout: () => void;
 isDarkMode: boolean;
 isOpen: boolean;
 onToggle: () => void;
}

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
 path?: string;
 children?: SubMenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
 currentUser,
 activePage,
 onNavigate,
 onLogout,
 isDarkMode,
 isOpen,
 onToggle
}) => {
 const navigate = useNavigate();
 const { t, language, setLanguage } = useLanguage();
 const { hasPermission } = usePermissions(currentUser);
 const logoInputRef = useRef<HTMLInputElement>(null);
 const [uploadingLogo, setUploadingLogo] = useState(false);
 const LOGO_ROLES = ['SUPER_ADMIN', 'ADMIN'];
 const canChangeLogo = (currentUser.roles?.some(r => LOGO_ROLES.includes(r.toUpperCase())) ?? false)
 || LOGO_ROLES.includes((currentUser.role ?? '').toUpperCase());

 const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setUploadingLogo(true);
 try {
 const result = await uploadService.uploadImage(file, 'logo', 1600);
 if (result?.url) {
 await api.put('/tax/config', { logoUrl: result.url });
 invalidateLogoCache();
 window.dispatchEvent(new Event('logo:updated'));
 }
 } catch { /* silent */ } finally {
 setUploadingLogo(false);
 e.target.value = '';
 }
 };

 // State for enabled modules
 const [enabledModules, setEnabledModules] = React.useState<Record<string, boolean>>({});

 // Load modules config
 React.useEffect(() => {
 const loadModulesConfig = () => {
 try {
 const stored = localStorage.getItem('system_modules_config');
 if (stored) {
 setEnabledModules(JSON.parse(stored));
 } else {
 // If no config, assume all enabled by default
 setEnabledModules({});
 }
 } catch (e) {
 console.warn('Error parsing modules config', e);
 }
 };

 loadModulesConfig();

 // Listen for updates
 const handleUpdate = () => loadModulesConfig();
 window.addEventListener('modules_updated', handleUpdate);

 return () => window.removeEventListener('modules_updated', handleUpdate);
 }, []);

 // Helper to check if a module is enabled
 const isModuleEnabled = (moduleId: string) => {
 // If no config exists (empty object), assume enabled (default behavior)
 if (Object.keys(enabledModules).length === 0) return true;

 // Explicitly check for false (undefined means enabled by default for safety, or map strict IDs)
 // Mapping internal IDs to Module IDs from ModuleSettings.tsx
 const moduleMap: Record<string, string> = {
 'dashboard': 'dashboard',
 'orders': 'orders',
 'sales': 'sales',
 'customers': 'customers',
 'purchases': 'purchases',
 'products': 'products',
 'stock-management': 'stock-management',
 'users': 'users',
 'tracking': 'dashboard', // Linked to dashboard
 };

 const configId = moduleMap[moduleId];
 if (!configId) return true; // Always show if not mapped to a toggleable module

 return enabledModules[configId] !== false;
 };

 // Estado para controlar quais submenus estão expandidos
 const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
 // Carregar estado salvo do localStorage
 try {
 const saved = localStorage.getItem('sidebar_expanded_menus');
 return saved ? JSON.parse(saved) : {};
 } catch {
 return {};
 }
 });

 // Salvar estado de expansão no localStorage
 useEffect(() => {
 localStorage.setItem('sidebar_expanded_menus', JSON.stringify(expandedMenus));
 }, [expandedMenus]);

 // Obter pathname atual para destacar submenu ativo
 const location = useLocation();

 // Estrutura do menu com submenus (definida aqui para usar no useEffect)
 const menuItemsWithChildren: { id: string; children?: { path: string }[] }[] = [
 { id: 'sales', children: [{ path: '/admin/pos' }, { path: '/admin/caixa' }, { path: '/admin/vendas/pedidos' }, { path: '/admin/cotacoes' }, { path: '/admin/vendas/clientes' }, { path: '/admin/vendas' }] },
 { id: 'purchases', children: [{ path: '/admin/compras' }, { path: '/admin/compras/por-produto' }, { path: '/admin/compras/fornecedores' }, { path: '/admin/compras-flow' }] },
 { id: 'products', children: [{ path: '/admin/produtos' }, { path: '/admin/produtos/categorias' }, { path: '/admin/produtos/unidades' }, { path: '/admin/produtos/etiquetas' }] },
 { id: 'stock-management', children: [{ path: '/admin/stock' }, { path: '/admin/stock/alertas' }, { path: '/admin/stock/movimentos' }, { path: '/admin/stock/lotes' }, { path: '/admin/stock/auditoria' }, { path: '/admin/stock/ajustes' }] },
 { id: 'users', children: [{ path: '/admin/usuarios' }, { path: '/admin/usuarios/roles' }] },
 { id: 'financas', children: [{ path: '/admin/financas' }, { path: '/admin/faturas' }, { path: '/admin/contas-pagar' }, { path: '/admin/razao-geral' }] },
 { id: 'hr', children: [{ path: '/admin/rh' }] },
 { id: 'projects', children: [{ path: '/admin/projectos' }] },
 { id: 'helpdesk', children: [{ path: '/admin/helpdesk' }] },
 { id: 'timesheets', children: [{ path: '/admin/timesheets' }] },
 { id: 'messaging', children: [{ path: '/admin/mensagens' }] },
 { id: 'subscriptions', children: [{ path: '/admin/assinaturas' }] },
 { id: 'documents', children: [{ path: '/admin/documentos' }] },
 ];

 // Auto-expandir apenas o menu que contém a rota atual
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

 // Se encontrou um menu ativo, expandir apenas esse e colapsar os outros
 if (activeMenuId) {
 setExpandedMenus(prev => {
 // Verificar se já está no estado correto para evitar loops
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

 // Toggle expansão de um menu (comportamento accordion - fecha outros)
 const toggleMenuExpansion = (menuId: string) => {
 setExpandedMenus(prev => {
 const isCurrentlyExpanded = prev[menuId];
 // Se está a expandir, fechar todos os outros (accordion)
 // Se está a colapsar, apenas colapsar este
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

 // Estrutura do menu com submenus
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
 { id: 'sales-orders', label: 'Pedidos', icon: ShoppingCart, path: '/admin/vendas/pedidos' },
 { id: 'cotacoes', label: 'Cotações', icon: FileText, path: '/admin/cotacoes' },
 { id: 'sales-customers', label: 'Clientes', icon: Users, path: '/admin/vendas/clientes' },
 { id: 'sales-summaries', label: 'Resumos', icon: List, path: '/admin/vendas' },
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
 { id: 'purchase-flow', label: 'Fluxo PO / GRN', icon: ClipboardCheck, path: '/admin/compras-flow' },
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
 { id: 'hr', label: 'Recursos Humanos', icon: UserCog, permission: 'hr.view', path: '/admin/rh' },
 { id: 'projects', label: 'Projectos', icon: FolderKanban, permission: 'projects.view', path: '/admin/projectos' },
 { id: 'helpdesk', label: 'Central de Ajuda', icon: Headphones, permission: 'helpdesk.view', path: '/admin/helpdesk' },
 { id: 'timesheets', label: 'Planilhas de Horas', icon: Clock, permission: 'timesheets.view', path: '/admin/timesheets' },
 { id: 'messaging', label: 'Mensagens', icon: MessageSquare, permission: 'messaging.view', path: '/admin/mensagens' },
 { id: 'subscriptions', label: 'Assinaturas', icon: RefreshCw, permission: 'subscriptions.view', path: '/admin/assinaturas' },
 { id: 'documents', label: 'Documentos', icon: FolderOpen, permission: 'documents.view', path: '/admin/documentos' },
 ];

 // Filtrar itens baseado apenas nas permisséµes (sistema simplificado)
 const filteredMenuItems = useMemo(() => {
 return allMenuItems.filter(item => {
 // 1. Check Module status
 if (!isModuleEnabled(item.id)) return false;

 // 2. Check User Permission
 if (!item.permission) return true;
 return hasPermission(item.permission);
 });
 }, [hasPermission, t, enabledModules]);

 // --- Visual helpers (CSS only, sem lógica) ---
 const activeItemStyle: React.CSSProperties = {
 background: 'color-mix(in srgb, var(--brand-600) 12%, transparent)',
 color: 'var(--brand-600)',
 fontWeight: 600,
 };
 // Separadores visuais antes destes grupos (apenas CSS)
 const GROUP_STARTERS = new Set(['sales', 'logistics']);

 return (
 <>
 <div className={`bg-surface-raised h-screen border-r border-border-default flex flex-col fixed left-0 top-0 z-10 hidden md:flex transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
 {/* Header */}
 <div className={`flex items-center border-b border-border-default transition-all duration-300 ${isOpen ? 'px-4 py-2 justify-start' : 'px-2 py-2 justify-center'}`}>
 <div className="relative group flex-shrink-0">
 <button onClick={() => navigate('/')} className="flex items-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
 {isOpen ? (
 <Logo variant="full" width={160} height={48} className="h-10 w-auto object-contain" isDarkMode={isDarkMode} />
 ) : (
 <Logo variant="icon" width={40} height={40} className="w-10 h-10 object-contain" isDarkMode={isDarkMode} />
 )}
 </button>
 {canChangeLogo && (
 <>
 <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
 <button
 onClick={() => logoInputRef.current?.click()}
 disabled={uploadingLogo}
 title="Trocar logotipo"
 className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
 >
 {uploadingLogo
 ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
 : <Upload className="w-5 h-5 text-white drop-shadow" />}
 </button>
 </>
 )}
 </div>
 </div>

 <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
 {filteredMenuItems.map((item) => {
 const groupSeparator = null;
 const Icon = item.icon;
 const hasChildren = item.children && item.children.length > 0;
 const isExpanded = expandedMenus[item.id];

 // Verificar se algum submenu está ativo
 const isSubmenuActive = hasChildren && item.children?.some(
 child => location.pathname === child.path || location.pathname.startsWith(child.path + '/')
 );
 const isActive = activePage === item.id || activePage.startsWith(item.id + '-') || isSubmenuActive;

 // Sidebar fechado - mostrar apenas ícones com tooltip
 if (!isOpen) {
 if (hasChildren) {
 return (
 <React.Fragment key={item.id}>
 {groupSeparator}
 <div className="relative group">
 <button
 onClick={() => onNavigate(item.id)}
 title={item.label}
 className={`w-full flex items-center justify-center py-2.5 px-2 rounded-lg transition-all duration-150 text-sm font-medium relative ${isActive
 ? ''
 : 'text-content-secondary hover:bg-black/[0.04] dark:hover:bg-surface-raised/[0.05] hover:text-content-primary'
 }`}
 style={isActive ? activeItemStyle : undefined}
 >
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'text-content-muted'}`} />
 </button>
 {/* Tooltip com submenus ao hover quando sidebar fechado */}
 <div className="absolute left-full ml-2 top-0 bg-surface-raised border border-border-strong text-content-primary text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg min-w-[160px]">
 <div className="px-3 py-2 font-medium border-b border-border-default text-content-primary">
 {item.label}
 </div>
 <div className="py-1">
 {item.children?.map(child => {
 const ChildIcon = child.icon;

 // Find the best match among siblings for tooltip logic
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
 onClick={() => navigate(child.path)}
 className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isChildActive
 ? 'bg-brand-600/15 dark:bg-brand-600/25 text-brand-700 dark:text-brand-300 font-medium'
 : 'text-content-secondary hover:bg-surface-base hover:text-content-primary'
 }`}
 >
 {ChildIcon && <ChildIcon className="w-4 h-4" />}
 <span>{child.label}</span>
 </button>
 );
 })}
 </div>
 <div className="absolute right-full top-3 border-4 border-transparent border-r-surface-raised"></div>
 </div>
 </div>
 </React.Fragment>
 );
 }

 return (
 <React.Fragment key={item.id}>
 {groupSeparator}
 <button
 onClick={() => onNavigate(item.id)}
 title={item.label}
 className={`w-full flex items-center justify-center py-2.5 px-2 rounded-lg transition-all duration-150 text-sm font-medium relative group ${isActive
 ? ''
 : 'text-content-secondary hover:bg-black/[0.04] dark:hover:bg-surface-raised/[0.05] hover:text-content-primary'
 }`}
 style={isActive ? activeItemStyle : undefined}
 >
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'text-content-muted'}`} />
 <div className="absolute left-full ml-2 px-2 py-1 bg-surface-raised border border-border-strong text-content-primary text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
 {item.label}
 <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-raised"></div>
 </div>
 </button>
 </React.Fragment>
 );
 }

 // Sidebar aberto - mostrar menu completo com accordion
 if (hasChildren) {
 return (
 <React.Fragment key={item.id}>
 {groupSeparator}
 <div className="space-y-1">
 {/* Menu principal com seta de expansão */}
 <button
 onClick={() => toggleMenuExpansion(item.id)}
 className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${isActive
 ? ''
 : 'text-content-secondary hover:bg-black/[0.04] dark:hover:bg-surface-raised/[0.05] hover:text-content-primary'
 }`}
 style={isActive ? activeItemStyle : undefined}
 >
 <div className="flex items-center space-x-3">
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'text-content-muted'}`} />
 <span className="truncate">{item.label}</span>
 </div>
 <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? '' : 'text-content-muted'}`} />
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
 onClick={() => navigate(child.path)}
 className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${isChildActive
 ? 'bg-brand-600/15 dark:bg-brand-600/25 text-brand-700 dark:text-brand-300 font-medium border-l-2 border-l-brand-600 dark:border-l-brand-400'
 : 'text-content-primary hover:bg-surface-raised/60'
 }`}
 >
 {ChildIcon && <ChildIcon className={`w-4 h-4 flex-shrink-0 ${isChildActive ? 'text-brand-600 dark:text-brand-400' : 'text-content-secondary'}`} />}
 <span className="truncate">{child.label}</span>
 </button>
 );
 })}
 </div>
 </div>
 </div>
 </React.Fragment>
 );
 }

 // Item sem submenus
 return (
 <React.Fragment key={item.id}>
 {groupSeparator}
 <button
 onClick={() => onNavigate(item.id)}
 className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${isActive
 ? ''
 : 'text-content-secondary hover:bg-black/[0.04] dark:hover:bg-surface-raised/[0.05] hover:text-content-primary'
 }`}
 style={isActive ? activeItemStyle : undefined}
 >
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'text-content-muted'}`} />
 <span className="truncate">{item.label}</span>
 </button>
 </React.Fragment>
 );
 })}
 </nav>

 <div className={`border-t border-border-default ${isOpen ? 'p-2' : 'p-2'}`}>
 {/* Menu Inferior */}

 {/* Perfil do Usuário */}
 <button
 onClick={() => onNavigate('profile')}
 className={`w-full flex items-center ${isOpen ? 'space-x-2 px-2 py-2 mb-2' : 'justify-center py-2 mb-2'} rounded-lg hover:bg-surface-raised transition-colors relative group`}
 title={!isOpen ? currentUser.name : ''}
 >
 <span style={{ borderRadius: '50%', boxShadow: '0 0 0 2px var(--brand-600)', flexShrink: 0, display: 'inline-flex' }}>
 <Avatar
 src={currentUser.avatar}
 alt={currentUser.name}
 name={currentUser.name}
 size="sm"
 />
 </span>
 {isOpen && (
 <div className="flex-1 min-w-0 text-left">
 <p className="text-xs font-medium text-content-primary truncate">{currentUser.name}</p>
 <p className="text-[10px] text-content-muted truncate">
 {getRoleLabel(currentUser)}
 </p>
 </div>
 )}
 </button>

 {/* Switch de Idioma */}
 <div className={`mb-2 ${isOpen ? '' : ''}`}>
 {isOpen ? (
 <div className="flex gap-0.5 rounded-lg overflow-hidden border border-border-strong bg-surface-base">
 <button
 onClick={() => setLanguage('pt')}
 title="Português"
 className={`flex-1 px-2 py-2 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1 ${language === 'pt'
 ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 shadow-sm scale-105'
 : 'text-content-secondary hover:bg-surface-raised hover:scale-102'
 }`}
 >
 <LanguageFlag language="pt" size="sm" />
 <span>PT</span>
 </button>
 <button
 onClick={() => setLanguage('en')}
 title="English"
 className={`flex-1 px-2 py-2 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1 ${language === 'en'
 ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 shadow-sm scale-105'
 : 'text-content-secondary hover:bg-surface-raised hover:scale-102'
 }`}
 >
 <LanguageFlag language="en" size="sm" />
 <span>EN</span>
 </button>
 </div>
 ) : (
 <button
 onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
 title={language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
 className="w-full py-2 rounded-lg text-content-secondary hover:bg-surface-raised transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1"
 >
 <LanguageFlag language={language === 'pt' ? 'en' : 'pt'} size="sm" />
 </button>
 )}
 </div>

 {/* Botões de Ação */}
 <div className={`flex ${isOpen ? 'space-x-2' : 'flex-col space-y-2'}`}>
 <button
 onClick={() => navigate('/')}
 title="Voltar ao Site"
 className={`flex items-center justify-center ${isOpen ? 'flex-1 px-3 py-2' : 'w-full py-2'} rounded-lg text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors relative group`}
 >
 <Globe className="w-4 h-4" />
 </button>
 <button
 onClick={onLogout}
 title={t.auth.logout}
 className={`flex items-center justify-center ${isOpen ? 'flex-1 px-3 py-2' : 'w-full py-2'} rounded-lg text-content-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors relative group`}
 >
 <LogOut className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>

 {/* Toggle Button */}
 <button
 onClick={onToggle}
 className={`hidden md:flex fixed top-1/2 ${isOpen ? 'left-[252px]' : 'left-[76px]'} -translate-y-1/2 -translate-x-1/2 z-30 bg-surface-raised border-2 border-border-strong rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-surface-base hover:border-brand-500 dark:hover:border-brand-400`}
 aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
 >
 {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
 </button>
 </>
 );
};

