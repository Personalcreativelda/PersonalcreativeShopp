
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { dataService } from './modules/core/services/dataService';
import { applyTheme, applyFontFamily, applyBorderRadius, applyThemePreset, applyDarkModeVars, removeDarkModeVars } from './modules/core/utils/theme';
import { type User, Order, OrderStatus, Product, Customer, Sale, Purchase, PurchaseRequest, Supplier, UserRole, ProductVariant } from './modules/core/types/types';

// Core Imports
import { Layout } from './modules/core/components/layout/Layout';
import { PageShell } from './modules/core/components/layout/PageShell';
import { Toast } from './modules/core/components/ui/Toast';
import { LanguageProvider } from './modules/core/contexts/LanguageContext';
import { Logo } from './modules/core/components/ui/Logo';
import { DashboardPreferencesProvider } from './modules/core/hooks/useDashboardPreferences';
import { LocationProvider } from './modules/core/contexts/LocationContext';
import { useVersionCheck } from './modules/core/hooks/useVersionCheck';
import { UpdateBanner } from './modules/core/components/ui/UpdateBanner';

// Pages - lazy loaded para reduzir bundle inicial (evitar 504)
const Dashboard = lazy(() => import('./modules/core/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Orders = lazy(() => import('./modules/sales/pages/Orders').then(m => ({ default: m.Orders })));
const Sales = lazy(() => import('./modules/sales/pages/Sales').then(m => ({ default: m.Sales })));
const Users = lazy(() => import('./modules/admin/pages/Users').then(m => ({ default: m.Users })));
const Roles = lazy(() => import('./modules/admin/pages/Roles').then(m => ({ default: m.Roles })));
const UserProfile = lazy(() => import('./modules/core/pages/UserProfile').then(m => ({ default: m.UserProfile })));
import { ProtectedRoute } from './modules/auth/components/ProtectedRoute';
import { TrackedPage } from './modules/auth/components/TrackedPage';
const Media = lazy(() => import('./modules/media/pages/Media').then(m => ({ default: m.Media })));
const Tracking = lazy(() => import('./modules/admin/pages/Tracking').then(m => ({ default: m.Tracking })));
const Customers = lazy(() => import('./modules/customers/pages/Customers').then(m => ({ default: m.Customers })));
const CustomerProfile = lazy(() => import('./modules/customers/pages/CustomerProfile').then(m => ({ default: m.CustomerProfile })));
const Purchases = lazy(() => import('./modules/products/components/ui/Purchases').then(m => ({ default: m.Purchases })));
const Products = lazy(() => import('./modules/products/pages/Products').then(m => ({ default: m.Products })));
const StockManagement = lazy(() => import('./modules/products/pages/StockManagement').then(m => ({ default: m.StockManagement })));
const StockAuditPage = lazy(() => import('./modules/products/pages/StockAudit').then(m => ({ default: m.StockAuditPage })));
const StockAdjustmentsPage = lazy(() => import('./modules/products/pages/StockAdjustmentsPage').then(m => ({ default: m.StockAdjustmentsPage })));
const StockLotsPage = lazy(() => import('./modules/products/pages/StockLotsPage').then(m => ({ default: m.StockLotsPage })));
const StockAlerts = lazy(() => import('./modules/products/pages/StockAlerts').then(m => ({ default: m.StockAlerts })));
const AuditReportPage = lazy(() => import('./modules/products/pages/AuditReportPage').then(m => ({ default: m.AuditReportPage })));
const EtiquetasPage = lazy(() => import('./modules/products/pages/EtiquetasPage').then(m => ({ default: m.EtiquetasPage })));
const ShopReceipts = lazy(() => import('./modules/sales/pages/ShopReceipts').then(m => ({ default: m.ShopReceipts })));
const POS = lazy(() => import('./modules/sales/pages/POS').then(m => ({ default: m.POS })));
const CaixaPage = lazy(() => import('./modules/sales/pages/CaixaPage').then(m => ({ default: m.CaixaPage })));
const QuotesPage = lazy(() => import('./modules/sales/pages/QuotesPage').then(m => ({ default: m.QuotesPage })));
const RemoteScannerPage = lazy(() => import('./modules/sales/pages/RemoteScannerPage').then(m => ({ default: m.RemoteScannerPage })));
const Financas = lazy(() => import('./modules/admin/pages/Financas').then(m => ({ default: m.Financas })));
const InvoicesPage = lazy(() => import('./modules/admin/pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })));
const PurchaseFlowPage = lazy(() => import('./modules/admin/pages/PurchaseFlowPage').then(m => ({ default: m.PurchaseFlowPage })));
const KPIPage    = lazy(() => import('./modules/admin/pages/KPIPage').then(m => ({ default: m.KPIPage })));
const APPage     = lazy(() => import('./modules/admin/pages/APPage').then(m => ({ default: m.APPage })));
const LedgerPage = lazy(() => import('./modules/admin/pages/LedgerPage').then(m => ({ default: m.LedgerPage })));
const Shop = lazy(() => import('./modules/shop/pages/Shop').then(m => ({ default: m.Shop })));
const ProductLandingPage = lazy(() => import('./modules/shop/pages/ProductLandingPage').then(m => ({ default: m.ProductLandingPage })));
const UserManagement = lazy(() => import('./modules/admin/pages/UserManagement').then(m => ({ default: m.UserManagement })));
const Coupons = lazy(() => import('./modules/admin/pages/Coupons').then(m => ({ default: m.Coupons })));
const AdminRefunds = lazy(() => import('./modules/admin/pages/Refunds').then(m => ({ default: m.Refunds })));
const CustomerDashboard = lazy(() => import('./modules/shop/pages/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));
const CustomerOrders = lazy(() => import('./modules/shop/pages/CustomerOrders').then(m => ({ default: m.CustomerOrders })));
const CustomerOrderDetail = lazy(() => import('./modules/shop/pages/CustomerOrderDetail').then(m => ({ default: m.CustomerOrderDetail })));
const OrderTrackingPage = lazy(() => import('./modules/shop/pages/OrderTrackingPage').then(m => ({ default: m.OrderTrackingPage })));
const CustomerRefunds = lazy(() => import('./modules/shop/pages/CustomerRefunds').then(m => ({ default: m.CustomerRefunds })));
const CustomerAffiliate = lazy(() => import('./modules/shop/pages/CustomerAffiliate').then(m => ({ default: m.CustomerAffiliate })));
const AdminAffiliates = lazy(() => import('./modules/admin/pages/Affiliates').then(m => ({ default: m.Affiliates })));
const AdminDeliveryZones = lazy(() => import('./modules/admin/pages/DeliveryZones').then(m => ({ default: m.DeliveryZones })));
const AdminLogistics = lazy(() => import('./modules/admin/pages/Logistics').then(m => ({ default: m.Logistics })));
const AdminMarketing = lazy(() => import('./modules/admin/pages/Marketing').then(m => ({ default: m.Marketing })));
const AdminBlog = lazy(() => import('./modules/admin/pages/Blog').then(m => ({ default: m.Blog })));
const BlogPage = lazy(() => import('./modules/shop/pages/BlogPage').then(m => ({ default: m.BlogPage })));
const BlogPostPage = lazy(() => import('./modules/shop/pages/BlogPostPage').then(m => ({ default: m.BlogPostPage })));
const ResetPasswordPage = lazy(() => import('./modules/shop/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const SobreNos = lazy(() => import('./modules/shop/pages/SobreNos'));
const Politica = lazy(() => import('./modules/shop/pages/Politica'));
const Contactos = lazy(() => import('./modules/shop/pages/Contactos'));
// Novos módulos
const HR            = lazy(() => import('./modules/hr/pages/HR').then(m => ({ default: m.HR })));
const Projects      = lazy(() => import('./modules/projects/pages/Projects').then(m => ({ default: m.Projects })));
const Helpdesk      = lazy(() => import('./modules/helpdesk/pages/Helpdesk').then(m => ({ default: m.Helpdesk })));
const Timesheets    = lazy(() => import('./modules/timesheets/pages/Timesheets').then(m => ({ default: m.Timesheets })));
const Messaging     = lazy(() => import('./modules/messaging/pages/Messaging').then(m => ({ default: m.Messaging })));
const Subscriptions = lazy(() => import('./modules/subscriptions/pages/Subscriptions').then(m => ({ default: m.Subscriptions })));
const Documents     = lazy(() => import('./modules/documents/pages/Documents').then(m => ({ default: m.Documents })));

// Services & Utils
import { Lock, User as UserIcon, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import { getSystemSettings, updateFavicon, updatePageTitle, invalidateLogoCache } from './modules/core/services/systemSettingsService';
import { ForgotPasswordModal } from './modules/core/components/modals/ForgotPasswordModal';
import { SignUpModal } from './modules/core/components/modals/SignUpModal';
import { LoginModal } from './modules/core/components/modals/LoginModal';
import { authService } from './modules/auth/services/authService';

// Base path para deploy na raiz
const BASE_PATH = '/';

const PageLoadingFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
  </div>
);

/** Wrapper que mostra popup de login em páginas acessíveis (ex: Sobre) */
const AboutUsWithLoginPrompt: React.FC<{
  currentUser: User | null;
  onLogin: (user: User) => void;
  children: React.ReactNode;
}> = ({ currentUser, onLogin, children }) => {
  const [showLogin, setShowLogin] = useState(!currentUser);

  useEffect(() => {
    if (currentUser) setShowLogin(false);
  }, [currentUser]);

  const handleLogin = useCallback(async (identifier: string, password: string) => {
    const { user, error } = await authService.signIn(identifier, password);
    if (user) {
      setShowLogin(false);
      onLogin(user);
    } else {
      throw new Error(error || 'Erro ao iniciar sessão');
    }
  }, [onLogin]);

  return (
    <>
      {children}
      {showLogin && !currentUser && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
          onUserLogin={(user) => {
            setShowLogin(false);
            onLogin(user);
          }}
          message={null}
        />
      )}
    </>
  );
};

// Rate limiting constants removed (moved to Login.tsx)
// Helper functions removed (moved to Login.tsx)

import { CompatibilityRedirect } from './components/CompatibilityRedirect';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShopProvider } from './contexts/ShopContext';
import { getAdminPath } from './modules/core/routes/adminRoutes';
import { useAppAuth } from './modules/auth/hooks/useAppAuth';
import { ForceStrongPasswordModal } from './modules/auth/components/ForceStrongPasswordModal';
import { useToast } from './modules/core/contexts/ToastContext';
import { useAppDataHandlers } from './modules/core/hooks/useAppDataHandlers';
import { useOperationProgress } from './modules/core/hooks/useOperationProgress';
import { OperationOverlay } from './modules/core/components/ui/OperationOverlay';
import { useAnalytics } from './modules/core/hooks/useAnalytics';
import { AdminLogin as AdminLoginPage } from './modules/auth/pages/AdminLogin';

// Layout / pages — lazy loaded
const Login = lazy(() => import('./modules/auth/pages/Login').then(m => ({ default: m.Login })));
const PublicLayout = lazy(() => import('./components/layouts/PublicLayout').then(m => ({ default: m.PublicLayout })));
const AdminLayout = lazy(() => import('./components/layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));

// Caminho do painel admin — aceita path simples (/painel) ou URL completo
const _adminUrl = import.meta.env.VITE_ADMIN_URL || '/painel';
const ADMIN_LOGIN_PATH = (() => {
  try { return new URL(_adminUrl).pathname; } catch { return _adminUrl.startsWith('/') ? _adminUrl : '/' + _adminUrl; }
})();

const App = () => {
  const navigate = useNavigate();
  useAnalytics();
  const { showToast } = useToast();
  const operationProgress = useOperationProgress();
  const {
    currentUser,
    setCurrentUser,
    isAuthLoading,
    isShopMode,
    activePage,
    handleLogin,
    handleLogout,
    setActivePage,
    setIsShopMode
  } = useAppAuth();
  const [darkMode, setDarkMode] = useState(true); // Default to Dark Mode
  const location = useRouterLocation();

  // Version Check
  const { hasUpdate, updateApp } = useVersionCheck();

  // App State
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ customers: number; orders: number; products: number; sales: number; purchases: number; suppliers: number } | null>(null);

  // Capturar código de afiliado do URL e persistir em localStorage para não se perder na navegação
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) localStorage.setItem('affiliate_ref', ref);
  }, []);

  // Initialize dark mode state from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    setDarkMode(isDark);
  }, []);

  // Sync darkMode state with localStorage on every route change.
  // This picks up changes made by the shop's own dark mode toggle.
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme !== null) {
      const isDark = savedTheme === 'dark';
      if (isDark !== darkMode) setDarkMode(isDark);
    }
  // Only re-sync when the route changes — not on every darkMode change (that would loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Apply dark class + CSS vars globally based on darkMode state.
  // Uses applyDarkModeVars / removeDarkModeVars so dark vars override
  // the light-mode inline styles set by applyThemePreset.
  useEffect(() => {
    if (darkMode) {
      applyDarkModeVars();
    } else {
      removeDarkModeVars();
    }
  }, [location.pathname, darkMode]);

  // Load system settings on mount - executar o mais cedo possé­vel
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const settings = await getSystemSettings();
        if (settings.favicon && settings.favicon !== '/favicon.ico') {
          // Sé³ atualizar se néo for o favicon padréo (que causa 404)
          updateFavicon(settings.favicon);
        }
        if (settings.system_name) {
          updatePageTitle(settings.system_name);
        }
        const preset = settings.theme_preset || 'stripe';
        const color = settings.primary_color || undefined;
        applyThemePreset(preset, color);
        // Individual overrides take precedence over preset defaults:
        if (settings.theme_font)   applyFontFamily(settings.theme_font);
        if (settings.theme_radius) applyBorderRadius(settings.theme_radius);
        // applyThemePreset sets light vars as inline styles. If dark mode is already
        // active those dark vars must be re-applied on top to win the cascade.
        if (localStorage.getItem('theme') === 'dark') applyDarkModeVars();
      } catch (error) {
        console.warn('Erro ao carregar configurações do sistema:', error);
      }
    };
    // Executar imediatamente, sem delay
    loadSystemSettings();

    // Recarrega título e favicon quando as settings são guardadas no painel
    const onLogoUpdated = () => loadSystemSettings();
    window.addEventListener('logo:updated', onLogoUpdated);
    return () => window.removeEventListener('logo:updated', onLogoUpdated);
  }, []);

  // Redirecionar pé¡ginas administrativas para Settings (apenas quando néo estamos em settings)


  const handleAdminLogin = useCallback((user: User) => {
    setCurrentUser(user);
  }, [setCurrentUser]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    // Apply immediately everywhere — don't wait for the effect to prevent flash
    if (newMode) applyDarkModeVars();
    else removeDarkModeVars();
  };


  // Declarar loadData antes de ser usado nos useEffects
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, o, s, pur, pr, sup, countsData] = await Promise.all([
        dataService.getProducts(),
        dataService.getCustomers(),
        dataService.getOrders(),
        dataService.getSales(),
        dataService.getPurchases(),
        dataService.getPurchaseRequests(),
        dataService.getSuppliers(),
        dataService.getDashboardCounts()
      ]);
      setProducts(p);
      setCustomers(c);
      setOrders(o);
      setSales(s);
      setPurchases(pur);
      setPurchaseRequests(pr);
      setSuppliers(sup);
      setCounts(countsData);
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadData();
      // Re-apply theme after login: invalidate cache so we get fresh settings with auth
      invalidateLogoCache();
      getSystemSettings().then(settings => {
        const preset = settings.theme_preset || 'stripe';
        const color = settings.primary_color || undefined;
        applyThemePreset(preset, color);
        // Individual overrides take precedence over preset defaults:
        if (settings.theme_font)   applyFontFamily(settings.theme_font);
        if (settings.theme_radius) applyBorderRadius(settings.theme_radius);
      }).catch(() => {});
    }
  }, [currentUser, loadData]);

  // AppDataLoader: recarregamento por mudança de local desativado (sistema de uma única loja).
  const AppDataLoader: React.FC<{ onLoadData: () => void }> = () => null;

  const handlers = useAppDataHandlers({
    orders,
    setOrders,
    customers,
    setCustomers,
    products,
    setProducts,
    sales,
    setSales,
    purchases,
    setPurchases,
    purchaseRequests,
    setPurchaseRequests,
    suppliers,
    setSuppliers,
    loadData,
    showToast,
    operationProgress
  });

  const handleAddOrder = handlers.handleAddOrder;
  const handleUpdateOrderStatus = handlers.handleUpdateOrderStatus;
  const handleDeleteOrder = handlers.handleDeleteOrder;
  const handleBulkDeleteOrders = handlers.handleBulkDeleteOrders;
  const handleEditOrder = handlers.handleEditOrder;
  const handleDeleteCustomer = handlers.handleDeleteCustomer;
  const handleBulkDeleteCustomers = handlers.handleBulkDeleteCustomers;
  const handleUpdateCustomer = handlers.handleUpdateCustomer;
  const handleAddSale = handlers.handleAddSale;
  const handleUpdateSale = handlers.handleUpdateSale;
  const handleDeleteSale = handlers.handleDeleteSale;
  const handleBulkDeleteSales = handlers.handleBulkDeleteSales;
  const handleAddPurchase = handlers.handleAddPurchase;
  const handleUpdatePurchase = handlers.handleUpdatePurchase;
  const handleDeletePurchase = handlers.handleDeletePurchase;
  const handleAddPurchaseRequest = handlers.handleAddPurchaseRequest;
  const handleUpdatePurchaseRequest = handlers.handleUpdatePurchaseRequest;
  const handleDeletePurchaseRequest = handlers.handleDeletePurchaseRequest;
  const handleAddSupplier = handlers.handleAddSupplier;
  const handleUpdateSupplier = handlers.handleUpdateSupplier;
  const handleDeleteSupplier = handlers.handleDeleteSupplier;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // Componente de rotas públicas
  const PublicRoutes = () => {
    return (
      <ShopProvider>
        <Routes>
          <Route element={
            <PublicLayout
              currentUser={currentUser}
              isDarkMode={darkMode}
              toggleTheme={toggleTheme}
              onLogout={handleLogout}
              onLogin={() => {
                // Login será tratado pelo Shop
              }}
            />
          }>
            <Route path="loja" element={
              <LocationProvider>
                <Shop currentUser={currentUser} onLogin={handleLogin} onLogout={handleLogout} requireAuth />
              </LocationProvider>
            } />
            <Route path="loja/produto/:slug" element={
              <LocationProvider>
                <ProductLandingPage />
              </LocationProvider>
            } />
            {/* Painel do cliente */}
            <Route path="minha-conta" element={currentUser ? <CustomerDashboard currentUser={currentUser} /> : <Navigate to="/" replace />} />
            <Route path="minha-conta/encomendas" element={currentUser ? <CustomerOrders /> : <Navigate to="/" replace />} />
            <Route path="minha-conta/encomendas/:id" element={currentUser ? <CustomerOrderDetail /> : <Navigate to="/" replace />} />
            <Route path="minha-conta/reembolsos" element={currentUser ? <CustomerRefunds /> : <Navigate to="/" replace />} />
            <Route path="minha-conta/afiliado" element={currentUser ? <CustomerAffiliate /> : <Navigate to="/" replace />} />
            {/* Páginas institucionais */}
            <Route path="blog" element={<Suspense fallback={<PageLoadingFallback />}><BlogPage /></Suspense>} />
            <Route path="blog/:slug" element={<Suspense fallback={<PageLoadingFallback />}><BlogPostPage currentUser={currentUser} /></Suspense>} />
            <Route path="sobre" element={<Suspense fallback={<PageLoadingFallback />}><SobreNos /></Suspense>} />
            <Route path="politica" element={<Suspense fallback={<PageLoadingFallback />}><Politica /></Suspense>} />
            <Route path="contactos" element={<Suspense fallback={<PageLoadingFallback />}><Contactos /></Suspense>} />
            <Route path="reset-password" element={<Suspense fallback={<PageLoadingFallback />}><ResetPasswordPage /></Suspense>} />
            {/* Rastreio público de encomendas — sem autenticação */}
            <Route path="rastrear-encomenda" element={<Suspense fallback={<PageLoadingFallback />}><OrderTrackingPage /></Suspense>} />
            {/* Scanner remoto POS — público, token na URL */}
            <Route path="scanner-remoto" element={<Suspense fallback={<PageLoadingFallback />}><RemoteScannerPage /></Suspense>} />
            {/* Home: mostra loja */}
            <Route index element={
              <LocationProvider>
                <Shop currentUser={currentUser} onLogin={handleLogin} onLogout={handleLogout} requireAuth={false} />
              </LocationProvider>
            } />
          </Route>
        </Routes>
      </ShopProvider>
    );
  };

  return (
    <LocationProvider>
      <DashboardPreferencesProvider>
        {hasUpdate && <UpdateBanner onUpdate={updateApp} />}
        {/* Overlay de operações críticas */}
        <OperationOverlay
          isVisible={operationProgress.operationState.isInProgress}
          title={operationProgress.operationState.title}
          message={operationProgress.operationState.message}
          progress={operationProgress.operationState.progress || undefined}
        />
        {!isAuthLoading && currentUser && currentUser.requiresStrongPassword === true && (
          <ForceStrongPasswordModal
            isOpen
            userId={currentUser.id}
            onSuccess={() => setCurrentUser(prev => prev ? { ...prev, requiresStrongPassword: false } : null)}
            onLogout={handleLogout}
          />
        )}
        <AppDataLoader onLoadData={loadData} />
        <CompatibilityRedirect />
        <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {currentUser ? (
            <Route path="/admin/*" element={
              <LanguageProvider>
                <ErrorBoundary
                  areaName="Área Admin"
                  onBack={() => navigate('/admin')}
                  backLabel="Voltar ao painel"
                >
                  <AdminLayout
                    currentUser={currentUser}
                    isDarkMode={darkMode}
                    toggleTheme={toggleTheme}
                    onLogout={handleLogout}
                  />
                </ErrorBoundary>
              </LanguageProvider>
            }>
              <Route index element={
                <ProtectedRoute user={currentUser} permission="dashboard.view">
                  <TrackedPage pagePath="/admin" pageTitle="Dashboard">
                    <Dashboard
                      orders={orders}
                      customers={customers}
                      sales={sales}
                      products={products}
                      purchases={purchases}
                      purchaseRequests={purchaseRequests}
                      counts={counts}
                      onNavigate={(page) => {
                        const route = getAdminPath(page);
                        navigate(route);
                      }}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="vendas" element={
                <ProtectedRoute user={currentUser} permission="sales.view">
                  <TrackedPage pagePath="/admin/vendas" pageTitle="Vendas">
                    <Sales
                      sales={sales}
                      products={products}
                      orders={orders}
                      totalSalesCount={counts?.sales}
                      onAddSale={handleAddSale}
                      onUpdateSale={handleUpdateSale}
                      onDeleteSale={handleDeleteSale}
                      onDeleteSales={handleBulkDeleteSales}
                      onImportComplete={() => {
                        loadData();
                      }}
                      showToast={showToast}
                      defaultTab="summaries"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="vendas/por-produto" element={
                <ProtectedRoute user={currentUser} permission="sales.view">
                  <TrackedPage pagePath="/admin/vendas/por-produto" pageTitle="Vendas por Produto">
                    <Sales
                      sales={sales}
                      products={products}
                      orders={orders}
                      totalSalesCount={counts?.sales}
                      onAddSale={handleAddSale}
                      onUpdateSale={handleUpdateSale}
                      onDeleteSale={handleDeleteSale}
                      onDeleteSales={handleBulkDeleteSales}
                      onImportComplete={() => {
                        loadData();
                      }}
                      showToast={showToast}
                      defaultTab="byProduct"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              {/* Pedidos - agora dentro de Vendas */}
              <Route path="vendas/pedidos" element={
                <ProtectedRoute user={currentUser} permission="orders.view">
                  <TrackedPage pagePath="/admin/vendas/pedidos" pageTitle="Pedidos">
                    <Orders
                      orders={orders}
                      products={products}
                      customers={customers}
                      currentUser={currentUser}
                      totalOrdersCount={counts?.orders}
                      onAddOrder={handleAddOrder}
                      onUpdateStatus={handleUpdateOrderStatus}
                      onDeleteOrder={handleDeleteOrder}
                      onDeleteOrders={handleBulkDeleteOrders}
                      onEditOrder={handleEditOrder}
                      onImportComplete={() => {
                        loadData();
                      }}
                      showToast={showToast}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              {/* Clientes - agora dentro de Vendas */}
              <Route path="vendas/clientes" element={
                <ProtectedRoute user={currentUser} permission="customers.view">
                  <TrackedPage pagePath="/admin/vendas/clientes" pageTitle="Clientes">
                    <Customers
                      customers={customers}
                      orders={orders}
                      totalCustomersCount={counts?.customers}
                      onDeleteCustomer={handleDeleteCustomer}
                      onDeleteCustomers={handleBulkDeleteCustomers}
                      onUpdateCustomer={handleUpdateCustomer}
                      showToast={showToast}
                      onReloadData={loadData}
                      currentUser={currentUser}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="caixa" element={
                <ProtectedRoute user={currentUser} permission="sales.view">
                  <TrackedPage pagePath="/admin/caixa" pageTitle="Caixa">
                    <CaixaPage showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="pos" element={
                <ProtectedRoute user={currentUser} permission="sales.view">
                  <TrackedPage pagePath="/admin/pos" pageTitle="Venda (POS)">
                    <POS showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="cotacoes" element={
                <ProtectedRoute user={currentUser} permission="sales.view">
                  <TrackedPage pagePath="/admin/cotacoes" pageTitle="Cotações">
                    <Suspense fallback={<PageLoadingFallback />}><QuotesPage /></Suspense>
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="financas" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/financas" pageTitle="Finanças / IVA">
                    <Financas showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="faturas" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/faturas" pageTitle="Faturas">
                    <InvoicesPage showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="compras-flow" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/compras-flow" pageTitle="Fluxo de Compras">
                    <PurchaseFlowPage showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="kpis" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/kpis" pageTitle="KPIs">
                    <KPIPage showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="contas-pagar" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/contas-pagar" pageTitle="Contas a Pagar">
                    <APPage showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="razao-geral" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/razao-geral" pageTitle="Razão Geral">
                    <LedgerPage showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              {/* ── Novos módulos ───────────────────────────────────────── */}
              <Route path="rh" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/rh" pageTitle="Recursos Humanos">
                    <HR showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="projectos" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/projectos" pageTitle="Projectos">
                    <Projects showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="helpdesk" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/helpdesk" pageTitle="Central de Ajuda">
                    <Helpdesk showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="timesheets" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/timesheets" pageTitle="Planilhas de Horas">
                    <Timesheets showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="mensagens" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/mensagens" pageTitle="Mensagens">
                    <Messaging showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="assinaturas" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/assinaturas" pageTitle="Assinaturas">
                    <Subscriptions showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="documentos" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/documentos" pageTitle="Documentos">
                    <Documents showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              {/* Rotas antigas mantidas para compatibilidade - redirecionam para novas */}
              <Route path="pedidos" element={<Navigate to="/admin/vendas/pedidos" replace />} />
              <Route path="clientes" element={<Navigate to="/admin/vendas/clientes" replace />} />
              <Route path="produtos" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/produtos" pageTitle="Produtos">
                    <Products key="tab-produtos" showToast={showToast} onReloadData={loadData} totalProductsCount={counts?.products} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="produtos/categorias" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/produtos/categorias" pageTitle="Categorias de Produtos">
                    <Products key="tab-categorias" showToast={showToast} onReloadData={loadData} totalProductsCount={counts?.products} showManagementTab="categories" />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="produtos/unidades" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/produtos/unidades" pageTitle="Unidades de Produtos">
                    <Products key="tab-unidades" showToast={showToast} onReloadData={loadData} totalProductsCount={counts?.products} showManagementTab="units" />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="produtos/etiquetas" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <EtiquetasPage />
                </ProtectedRoute>
              } />
              <Route path="compras" element={
                <ProtectedRoute user={currentUser} permission="purchases.view">
                  <TrackedPage pagePath="/admin/compras" pageTitle="Compras">
                    <Purchases
                      purchases={purchases}
                      purchaseRequests={purchaseRequests}
                      suppliers={suppliers}
                      products={products}
                      totalPurchasesCount={counts?.purchases}
                      onAddPurchase={handleAddPurchase}
                      onUpdatePurchase={handleUpdatePurchase}
                      onDeletePurchase={handleDeletePurchase}
                      onAddPurchaseRequest={handleAddPurchaseRequest}
                      onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
                      onDeletePurchaseRequest={handleDeletePurchaseRequest}
                      onAddSupplier={handleAddSupplier}
                      onUpdateSupplier={handleUpdateSupplier}
                      onDeleteSupplier={handleDeleteSupplier}
                      showToast={showToast}
                      defaultTab="purchases"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="compras/por-produto" element={
                <ProtectedRoute user={currentUser} permission="purchases.view">
                  <TrackedPage pagePath="/admin/compras/por-produto" pageTitle="Compras por Produto">
                    <Purchases
                      purchases={purchases}
                      purchaseRequests={purchaseRequests}
                      suppliers={suppliers}
                      products={products}
                      totalPurchasesCount={counts?.purchases}
                      onAddPurchase={handleAddPurchase}
                      onUpdatePurchase={handleUpdatePurchase}
                      onDeletePurchase={handleDeletePurchase}
                      onAddPurchaseRequest={handleAddPurchaseRequest}
                      onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
                      onDeletePurchaseRequest={handleDeletePurchaseRequest}
                      onAddSupplier={handleAddSupplier}
                      onUpdateSupplier={handleUpdateSupplier}
                      onDeleteSupplier={handleDeleteSupplier}
                      showToast={showToast}
                      defaultTab="byProduct"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="compras/fornecedores" element={
                <ProtectedRoute user={currentUser} permission="purchases.view">
                  <TrackedPage pagePath="/admin/compras/fornecedores" pageTitle="Fornecedores">
                    <Purchases
                      purchases={purchases}
                      purchaseRequests={purchaseRequests}
                      suppliers={suppliers}
                      products={products}
                      totalPurchasesCount={counts?.purchases}
                      onAddPurchase={handleAddPurchase}
                      onUpdatePurchase={handleUpdatePurchase}
                      onDeletePurchase={handleDeletePurchase}
                      onAddPurchaseRequest={handleAddPurchaseRequest}
                      onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
                      onDeletePurchaseRequest={handleDeletePurchaseRequest}
                      onAddSupplier={handleAddSupplier}
                      onUpdateSupplier={handleUpdateSupplier}
                      onDeleteSupplier={handleDeleteSupplier}
                      showToast={showToast}
                      defaultTab="suppliers"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock" pageTitle="Gestão de Stock">
                    <StockManagement
                      products={products}
                      orders={orders}
                      purchases={purchases}
                      sales={sales}
                      showToast={showToast}
                      defaultTab="products"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock/alertas" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock/alertas" pageTitle="Alertas de Stock">
                    <StockAlerts
                      products={products}
                      orders={orders}
                      showToast={showToast}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock/movimentos" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock/movimentos" pageTitle="Movimentos de Stock">
                    <StockManagement
                      products={products}
                      orders={orders}
                      purchases={purchases}
                      sales={sales}
                      showToast={showToast}
                      defaultTab="movements"
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock/auditoria" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock/auditoria" pageTitle="Auditoria de Stock">
                    <StockAuditPage
                      products={products}
                      showToast={showToast}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock/ajustes" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock/ajustes" pageTitle="Ajustes de Stock">
                    <StockAdjustmentsPage
                      products={products}
                      showToast={showToast}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock/lotes" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock/lotes" pageTitle="Lotes de Stock">
                    <StockLotsPage
                      products={products}
                      showToast={showToast}
                    />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="stock/auditoria/relatorio/:id" element={
                <ProtectedRoute user={currentUser} permission="products.view">
                  <TrackedPage pagePath="/admin/stock/auditoria/relatorio" pageTitle="Relatório de Auditoria">
                    <AuditReportPage />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="galeria" element={
                <ProtectedRoute user={currentUser} permission="media.view">
                  <TrackedPage pagePath="/admin/galeria" pageTitle="Galeria">
                    <Media showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="estatisticas" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <TrackedPage pagePath="/admin/estatisticas" pageTitle="Estatísticas">
                    <Tracking currentUser={currentUser} showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="usuarios" element={
                <ProtectedRoute user={currentUser} permission="users.view">
                  <UserManagement currentUser={currentUser} showToast={showToast} />
                </ProtectedRoute>
              } />
              <Route path="usuarios/staff" element={<Navigate to="/admin/usuarios" replace />} />
              <Route path="usuarios/clientes" element={<Navigate to="/admin/usuarios" replace />} />
              <Route path="usuarios/roles" element={
                <ProtectedRoute user={currentUser} permission="users.manage_roles">
                  <TrackedPage pagePath="/admin/usuarios/roles" pageTitle="Gerir Roles">
                    <PageShell title="Gerir Roles">
                      <Roles currentUser={currentUser} showToast={showToast} />
                    </PageShell>
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="cupoes" element={
                <ProtectedRoute user={currentUser} permission="admin.access">
                  <TrackedPage pagePath="/admin/cupoes" pageTitle="Cupões">
                    <Coupons showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="reembolsos" element={
                <ProtectedRoute user={currentUser} permission="orders.view">
                  <TrackedPage pagePath="/admin/reembolsos" pageTitle="Reembolsos">
                    <AdminRefunds showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="afiliados" element={
                <ProtectedRoute user={currentUser} permission="admin.access">
                  <TrackedPage pagePath="/admin/afiliados" pageTitle="Afiliados">
                    <AdminAffiliates currentUser={currentUser} showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="zonas-entrega" element={
                <ProtectedRoute user={currentUser} permission="admin.access">
                  <TrackedPage pagePath="/admin/zonas-entrega" pageTitle="Zonas de Entrega">
                    <AdminDeliveryZones showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="logistica" element={
                <ProtectedRoute user={currentUser} permission="logistics.manage">
                  <TrackedPage pagePath="/admin/logistica" pageTitle="Logística">
                    <AdminLogistics showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="marketing" element={
                <ProtectedRoute user={currentUser} permission="admin.access">
                  <TrackedPage pagePath="/admin/marketing" pageTitle="Marketing">
                    <AdminMarketing showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="blog" element={
                <ProtectedRoute user={currentUser} permission="admin.access">
                  <TrackedPage pagePath="/admin/blog" pageTitle="Blog">
                    <AdminBlog showToast={showToast} />
                  </TrackedPage>
                </ProtectedRoute>
              } />
              <Route path="perfis" element={
                <UserProfile
                  currentUser={currentUser!}
                  onBack={() => navigate('/admin')}
                  onUpdate={(updatedUser) => {
                    setCurrentUser(updatedUser);
                    showToast('Perfil atualizado com sucesso!', 'success');
                  }}
                  onLogout={handleLogout}
                  toggleTheme={toggleTheme}
                  isDarkMode={darkMode}
                />
              } />
            </Route>
          ) : (
            <Route path="/admin/*" element={<Navigate to={ADMIN_LOGIN_PATH} replace />} />
          )}
          {/* Rota de acesso ao painel admin — URL configurada via VITE_ADMIN_URL */}
          <Route path={ADMIN_LOGIN_PATH} element={
            currentUser ? (
              <Navigate to="/admin" replace />
            ) : (
              <ErrorBoundary areaName="Admin Login" onBack={() => window.location.href = '/'} backLabel="Voltar à loja">
                <AdminLoginPage onLogin={handleAdminLogin} />
              </ErrorBoundary>
            )
          } />
          <Route path="/*" element={
            <ErrorBoundary
              areaName="Página pública"
              onBack={() => navigate('/')}
              backLabel="Ir para início"
            >
              <PublicRoutes />
            </ErrorBoundary>
          } />
        </Routes>
        </Suspense>
      </DashboardPreferencesProvider>
    </LocationProvider>
  );
};

export default App;
