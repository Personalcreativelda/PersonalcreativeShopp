import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Product, ProductVariant, OrderItem, Customer, UserRole, OrderStatus, DeliveryZone } from '../../core/types/types';
import { authService } from '../../auth/services/authService';
import { deliveryService } from '../../sales/services/deliveryService';
import { applyDarkModeVars, removeDarkModeVars } from '../../core/utils/theme';
import { productService } from '../../products/services/productService';
import api from '../../core/services/apiClient';
import { orderService } from '../../sales/services/orderService';
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';
import { trackingService } from '../../core/services/trackingService';
import { useShopTracking } from '../../core/hooks/useShopTracking';
import uploadService from '../../../services/uploadService';
import { useMobile } from '../../core/hooks/useMobile';
import { ShoppingCart, Search, User, LogIn, LogOut, Package, Plus, Minus, X, MapPin, Phone, Mail, Settings, Moon, Sun, Bell, CheckCircle, Eye, EyeOff, Loader2, Filter, ChevronRight, ChevronDown, Instagram, Facebook, Leaf, Droplet, Pill, Heart, Sparkles, Tag, Truck, Clock, Gift, Users, TrendingUp, XCircle } from 'lucide-react';
import { User as UserType } from '../../core/types/types';
import { Logo } from '../../core/components/ui/Logo';
import { ToastContainer, Toast } from '../../core/components/ui/Toast';
import { DeliveryZoneSelector } from '../../core/components/forms/DeliveryZoneSelector';
import { CustomerProfile } from '../../customers/pages/CustomerProfile';
import { ForgotPasswordModal } from '../../core/components/modals/ForgotPasswordModal';
import { SignUpModal } from '../../core/components/modals/SignUpModal';
import { LoginModal } from '../../core/components/modals/LoginModal';
import { ProductCard, ProductCardSkeleton } from '../../products/components/ui/ProductCard';
import { getSystemSettings, SystemSettings } from '../../core/services/systemSettingsService';
import { useShopContext } from '../../../contexts/ShopContext';
import { isUUID } from '../../core/utils/slugUtils';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import { ShopBanner } from '../components/ShopBanner';
import { uploadProductImage } from '../../../services/uploadService';
import { FAQSection } from '../components/FAQSection';
import { ProductCarousel } from '../components/ProductCarousel';
import { TestimonialsSection } from '../components/TestimonialsSection';
import { ShopInstagram } from '../components/ShopInstagram';
import { ShopMidBanner } from '../components/ShopMidBanner';
import { InlineAdBanner } from '../components/InlineAdBanner';

// Base path para deploy na raiz
const BASE_PATH = '/';

interface CartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  unit: string;
  image?: string;
}

interface ShopProps {
  currentUser?: UserType | null;
  onLogin?: (user: UserType) => void;
  onLogout?: () => void;
  /** Exigir login para aceder (loja/series). Se false, página acessível mas pode mostrar popup. */
  requireAuth?: boolean;
  /** Mostrar popup de login ao carregar (home acessível mas com prompt) */
  showLoginPrompt?: boolean;
}

export const Shop: React.FC<ShopProps> = ({ currentUser: propCurrentUser, onLogin, onLogout, requireAuth = true, showLoginPrompt = false }) => {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useMobile(768);

  // Usar contexto do Shop para compartilhar estado com Header
  // Sempre disponível dentro do ShopProvider
  const shopContext = useShopContext();

  // Ref para evitar dependências desnecessárias em useEffects
  const shopContextRef = useRef(shopContext);
  shopContextRef.current = shopContext;

  // Estados básicos primeiro - TODOS os estados necessários para os callbacks
  const [showLogin, setShowLogin] = useState((requireAuth || showLoginPrompt) && !propCurrentUser);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ type: string; value: number; discountAmount: number; code: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(propCurrentUser || null);

  // Ref para currentUser para usar em callbacks sem dependências
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Definir handleLoginClick IMEDIATAMENTE (antes de qualquer useEffect)
  // Isso garante que o callback esteja disponível o mais cedo possível
  const handleLoginClick = useCallback(() => {
    setShowLogin(true);
  }, []);

  // Definir callbacks ANTES dos useEffects para garantir disponibilidade imediata
  const handleCartClick = useCallback(() => {
    setShowCart(true);
  }, []);

  // handleProfileClick - será atualizado depois que setActiveBottomNav estiver disponível
  // Usar ref para setActiveBottomNav para evitar dependência circular
  const setActiveBottomNavRef = useRef<((nav: 'shop' | 'categories' | 'cart' | 'profile') => void) | null>(null);

  const handleProfileClick = useCallback(() => {
    if (currentUserRef.current) {
      navigate('/minha-conta');
    } else {
      setShowLogin(true);
    }
  }, [navigate]);

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('categoria') || 'all');
  const [priceRange, setPriceRange] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('popular');

  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Determinar activeBottomNav e selectedSeriesId baseado na rota
  const getActiveNavFromRoute = (): { nav: 'shop' | 'categories' | 'cart' | 'profile', seriesId: string | null, chapterId: string | null } => {
    const path = location.pathname;
    if (path === '/loja' || path === '/') {
      return { nav: 'shop', seriesId: null, chapterId: null };
    }
    return { nav: 'shop', seriesId: null, chapterId: null };
  };

  const routeState = getActiveNavFromRoute();
  const [activeBottomNav, setActiveBottomNav] = useState<'shop' | 'categories' | 'cart' | 'profile'>(routeState.nav);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(routeState.seriesId);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(routeState.chapterId);

  // Atualizar ref para setActiveBottomNav quando disponível
  useEffect(() => {
    setActiveBottomNavRef.current = setActiveBottomNav;
  }, []);

  // Sincronizar estado com rota quando rota mudar - memoizado
  useEffect(() => {
    const state = getActiveNavFromRoute();
    setActiveBottomNav(state.nav);
    setSelectedSeriesId(state.seriesId);
    setSelectedChapterId(state.chapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, params.id, params.seriesId, params.chapterId, params.seriesSlug, params.chapterSlug]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Array<{id: string; name: string; color: string; imageUrl?: string; isActive: boolean}>>([]);
  const [blogPosts, setBlogPosts] = useState<Array<{id: string; title: string; slug: string; summary?: string; coverImage?: string; tags: string[]; publishedAt?: string; createdAt: string}>>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [pendingAddToCart, setPendingAddToCart] = useState<{ product: Product; variant?: ProductVariant } | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({});

  // Order tracking
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingResult, setTrackingResult] = useState<{
    trackingCode: string; orderNumber: string; status: string;
    customerName: string; createdAt: string; updatedAt: string;
    deliveryZoneName?: string; isDelivery?: boolean;
  } | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  // Verificar se o utilizador atual é admin
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((currentUser as any)?.role || '');

  // Estados para checkout
  const [deliveryInfo, setDeliveryInfo] = useState({
    isDelivery: false,
    address: '',
    phone: '',
    email: '',
    name: '',
    deliveryZoneId: '',
    deliveryZoneName: '',
    deliveryFee: 0
  });

  // Inicializar dark mode - apenas uma vez
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark'; // Default light para loja
    setDarkMode(isDark);
    if (shopContextRef.current) {
      shopContextRef.current.setDarkMode(isDark);
    }
    if (isDark) {
      applyDarkModeVars();
    } else {
      removeDarkModeVars();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez na montagem

  const toggleTheme = useCallback(() => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      if (newMode) {
        applyDarkModeVars();
      } else {
        removeDarkModeVars();
      }
      return newMode;
    });
  }, []);

  // Callbacks já definidos acima para garantir disponibilidade imediata

  // Memoizar cartItemCount cedo (é usado nos efeitos abaixo)
  const cartItemCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  // Sincronizar estado com contexto - usando refs para evitar loops infinitos
  const prevSearchTermRef = useRef(searchTerm);
  const prevCartLengthRef = useRef(cartItemCount);
  const prevDarkModeRef = useRef(darkMode);

  useEffect(() => {
    if (!shopContext) return;

    // Só atualizar se realmente mudou
    if (prevSearchTermRef.current !== searchTerm) {
      prevSearchTermRef.current = searchTerm;
      shopContext.setSearchTerm(searchTerm);
    }
  }, [searchTerm, shopContext]);

  useEffect(() => {
    if (!shopContext) return;

    // Só atualizar se o count mudou
    if (prevCartLengthRef.current !== cartItemCount) {
      prevCartLengthRef.current = cartItemCount;
      shopContext.setCartItemCount(cartItemCount);
    }
  }, [cartItemCount, shopContext]);

  useEffect(() => {
    if (!shopContext) return;

    // Só atualizar se realmente mudou
    if (prevDarkModeRef.current !== darkMode) {
      prevDarkModeRef.current = darkMode;
      shopContext.setDarkMode(darkMode);
    }
  }, [darkMode, shopContext]);

  // Atualizar currentUserRef quando currentUser mudar
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!shopContext) return;
    const active = selectedCategory !== 'all' || priceRange !== '';
    shopContext.setHasActiveFilters(active);
  }, [selectedCategory, priceRange, shopContext]);

  // DEFINIR CALLBACKS IMEDIATAMENTE usando useLayoutEffect
  // useLayoutEffect executa de forma síncrona antes da pintura, garantindo que
  // os callbacks estejam disponíveis antes do Header renderizar novamente
  useLayoutEffect(() => {
    if (!shopContext) return;

    // Definir callbacks imediatamente - isso vai atualizar o contexto e forçar
    // re-render do PublicLayout e Header
    shopContext.setOnCartClick(handleCartClick);
    shopContext.setOnProfileClick(handleProfileClick);
    shopContext.setOnLoginClick(handleLoginClick);
    shopContext.setToggleTheme(toggleTheme);
    shopContext.setOnFilterClick(() => setShowFiltersPanel(true));
  }, [shopContext, handleCartClick, handleProfileClick, handleLoginClick, toggleTheme]);

  // Também garantir que os callbacks sejam atualizados quando mudarem
  useEffect(() => {
    if (!shopContext) return;

    shopContext.setOnCartClick(handleCartClick);
    shopContext.setOnProfileClick(handleProfileClick);
    shopContext.setOnLoginClick(handleLoginClick);
    shopContext.setToggleTheme(toggleTheme);
    shopContext.setOnFilterClick(() => setShowFiltersPanel(true));
  }, [shopContext, handleCartClick, handleProfileClick, handleLoginClick, toggleTheme]);

  // Funçéo para mostrar toast
  const showToast = (message: string, type: Toast['type'] = 'info', duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Usar ref para onLogin para evitar que checkAuth mude constantemente
  const onLoginRef = useRef(onLogin);
  useEffect(() => {
    onLoginRef.current = onLogin;
  }, [onLogin]);

  // Declarar todas as funções antes de serem usadas no useEffect
  const loadCategories = useCallback(async () => {
    try {
      const data = await api.get<any[]>('/categories');
      setCategories((data || []).filter((c: any) => c.isActive !== false));
    } catch {
      // falha silenciosa — a loja funciona sem categorias
    }
  }, []);

  // Carregar últimos posts do blog
  useEffect(() => {
    api.get<any[]>('/blog')
      .then(data => setBlogPosts((data || []).filter((p: any) => p.status === 'published').slice(0, 3)))
      .catch(() => {});
  }, []);

  // Aplicar filtro de categoria vindo do URL (?categoria=...)
  useEffect(() => {
    const cat = searchParams.get('categoria');
    if (cat) {
      setSelectedCategory(cat);
      document.getElementById('produtos-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams]);

  const loadSettings = useCallback(async () => {
    try {
      const loadedSettings = await getSystemSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  }, []);

  const loadCartFromStorage = useCallback(() => {
    const savedCart = localStorage.getItem('shop_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Erro ao carregar carrinho:', e);
      }
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Usar getProducts() normal - stock já está atualizado automaticamente nas ações (pedidos/compras)
      const allProducts = await productService.getProducts();

      // Mostrar todos os produtos visíveis na loja, incluindo esgotados (com badge Esgotado)
      const visibleProducts = allProducts.filter(p => p.showInShop !== false);
      setProducts(visibleProducts);

      // Inicializar filteredProducts
      setFilteredProducts(allProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      // Usar setToasts diretamente para evitar dependência de showToast
      setToasts(prev => [...prev, {
        id: `toast-${Date.now()}-${Math.random()}`,
        message: 'Erro ao carregar produtos. Tente novamente.',
        type: 'error' as const
      }]);
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Declarar checkAuth antes de ser usado no useEffect
  const checkAuth = useCallback(async () => {
    const user = await authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (onLoginRef.current) {
        onLoginRef.current(user);
      }
      setDeliveryInfo(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, []);

  // Refs para evitar múltiplas execuções do useEffect inicial
  const lastProcessedUserId = useRef<string | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const currentUserId = propCurrentUser?.id || null;

    // Só executar se o usuário mudou ou se é a primeira execução
    if (lastProcessedUserId.current === currentUserId && hasInitialized.current) {
      return;
    }

    lastProcessedUserId.current = currentUserId;
    hasInitialized.current = true;

    loadProducts();
    loadCategories();
    if (!propCurrentUser) {
      checkAuth();
    } else {
      setCurrentUser(propCurrentUser);
      setDeliveryInfo(prev => ({
        ...prev,
        name: propCurrentUser.name || '',
        email: propCurrentUser.email || '',
        phone: propCurrentUser.phone || ''
      }));
    }
    loadCartFromStorage();
    loadSettings();
    // Open cart if navigated from CartDrawer on another page
    if ((location.state as any)?.openCart) {
      setShowCart(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propCurrentUser?.id]); // Usar apenas o ID do usuário para evitar loops

  // Verificar sessão existente ao carregar (sem login automático)
  // Usar ref para onLogin para evitar loops
  const onLoginRefForSession = useRef(onLogin);
  useEffect(() => {
    onLoginRefForSession.current = onLogin;
  }, [onLogin]);

  useEffect(() => {
    const checkExistingSession = async () => {
      // Só verificar uma vez e apenas se não houver usuário
      if (autoLoginAttempted || currentUser || propCurrentUser) return;

      setAutoLoginAttempted(true);

      // Verificar se já existe sessão
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        if (onLoginRefForSession.current) {
          onLoginRefForSession.current(user);
        }
        setDeliveryInfo(prev => ({
          ...prev,
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || ''
        }));
        setShowWelcome(true);
      }
    };

    // Aguardar um pouco antes de verificar para não bloquear carregamento
    const timer = setTimeout(() => {
      checkExistingSession();
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoLoginAttempted, currentUser, propCurrentUser]);

  // Mostrar mensagem de boas-vindas quando usuário fizer login
  useEffect(() => {
    if (currentUser && !propCurrentUser) {
      setShowWelcome(true);
      // Esconder apé³s 4 segundos
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 4000);

      // Esconder ao scrollar
      const handleScroll = () => {
        if (window.scrollY > 50) {
          setShowWelcome(false);
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        clearTimeout(timer);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [currentUser, propCurrentUser]);

  // Hook de tracking da loja
  const {
    trackProductView,
    trackAddToCart: trackAddToCartAction,
    trackCheckoutStart,
    trackOrderComplete,
    trackSearch
  } = useShopTracking({ enabled: true, trackPageChanges: true });

  // Expor funçéµes de tracking globalmente para uso em componentes filhos
  // Usar ref para evitar dependência que muda constantemente
  const trackProductViewRef = useRef(trackProductView);
  useEffect(() => {
    trackProductViewRef.current = trackProductView;
  }, [trackProductView]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__trackProductView = (...args: any[]) => trackProductViewRef.current(...args);
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__trackProductView;
      }
    };
  }, []); // Executar apenas uma vez

  // Inicializar filteredProducts quando products mudar (apenas uma vez)
  const hasInitializedFiltered = useRef(false);
  const lastProductsLengthRef = useRef(0);

  useEffect(() => {
    // Só inicializar se products mudou de 0 para > 0
    if (products.length > 0 && lastProductsLengthRef.current === 0 && !hasInitializedFiltered.current) {
      hasInitializedFiltered.current = true;
      lastProductsLengthRef.current = products.length;
      setFilteredProducts(products);
    } else if (products.length !== lastProductsLengthRef.current) {
      lastProductsLengthRef.current = products.length;
    }
  }, [products.length, products]);

  // Debounce da pesquisa (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Helper: preço mínimo de um produto (variants ou price)
  const getProductMinPrice = (p: Product): number => {
    if (p.variants && p.variants.length > 0) {
      return Math.min(...p.variants.map(v => v.price ?? p.price ?? 0));
    }
    return p.price ?? 0;
  };

  // Memoizar filterProducts usando useMemo para evitar recriação e re-renders
  const filteredProductsMemo = useMemo(() => {
    let filtered = [...products];

    // Filtrar por categoria
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p =>
        (p.category || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filtrar por termo de busca (usar debounced)
    if (debouncedSearchTerm) {
      const term = normalizeForSearch(debouncedSearchTerm);
      filtered = filtered.filter(p =>
        normalizeForSearch(p.name).includes(term) ||
        normalizeForSearch(p.category || '').includes(term)
      );
    }

    // Filtrar por preço
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number);
      filtered = filtered.filter(p => {
        const price = getProductMinPrice(p);
        if (max !== undefined && !isNaN(max)) return price >= min && price < max;
        return price >= min; // "500+" => max é NaN
      });
    }

    // Ordenar
    if (sortOrder === 'popular') filtered.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
    else if (sortOrder === 'price_asc') filtered.sort((a, b) => getProductMinPrice(a) - getProductMinPrice(b));
    else if (sortOrder === 'price_desc') filtered.sort((a, b) => getProductMinPrice(b) - getProductMinPrice(a));
    else if (sortOrder === 'name_asc') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOrder === 'newest') filtered.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    return filtered;
  }, [products, debouncedSearchTerm, selectedCategory, priceRange, sortOrder]);

  // Rastrear busca em um useEffect separado para evitar loops
  // Usar refs para evitar dependências que mudam constantemente
  const trackSearchRef = useRef(trackSearch);
  const lastTrackedSearchRef = useRef<string>('');

  useEffect(() => {
    trackSearchRef.current = trackSearch;
  }, [trackSearch]);

  useEffect(() => {
    // Só rastrear se o termo de busca realmente mudou
    if (debouncedSearchTerm && lastTrackedSearchRef.current !== debouncedSearchTerm) {
      lastTrackedSearchRef.current = debouncedSearchTerm;
      // Usar setTimeout para evitar chamadas síncronas que podem causar loops
      setTimeout(() => {
        trackSearchRef.current(debouncedSearchTerm, filteredProductsMemo.length);
      }, 0);
    }
  }, [debouncedSearchTerm, filteredProductsMemo.length]);

  // Atualizar estado apenas quando o resultado filtrado mudar
  // Usar ref para rastrear o último valor e evitar atualizações desnecessárias
  const lastFilteredProductsRef = useRef<string>('');

  useEffect(() => {
    // Criar uma string única baseada nos IDs dos produtos para comparação
    const newIds = filteredProductsMemo.map(p => p.id).sort().join(',');

    // Só atualizar se realmente mudou
    if (lastFilteredProductsRef.current !== newIds) {
      lastFilteredProductsRef.current = newIds;
      setFilteredProducts(filteredProductsMemo);
    }
  }, [filteredProductsMemo]);

  // Secções da homepage
  const promoProducts = useMemo(() =>
    (products as Product[]).filter(p => p.promotionalPrice && p.promotionalPrice > 0 && p.promotionalPrice < p.price && p.showInShop !== false).slice(0, 12),
    [products]
  );
  const bestSellers = useMemo(() =>
    [...(products as Product[])].filter(p => p.showInShop !== false && (p.totalSold || 0) > 0)
      .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0)).slice(0, 12),
    [products]
  );
  const newestProducts = useMemo(() =>
    [...(products as Product[])].filter(p => p.showInShop !== false)
      .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime())
      .slice(0, 12),
    [products]
  );

  const saveCartToStorage = (cartItems: CartItem[]) => {
    localStorage.setItem('shop_cart', JSON.stringify(cartItems));
  };

  const addToCart = useCallback(async (product: Product, variant?: ProductVariant, quantityToAdd: number = 1) => {
    const variantToUse = variant || (product.variants?.find(v => v.isDefault) || product.variants?.[0]);
    const price = variantToUse?.price || product.price;
    const stock = variantToUse?.stock ?? product.stock ?? 0;
    const unit = variantToUse?.unit || product.unit;
    const variantId = variantToUse?.id;
    const variantName = variantToUse?.name;

    if (stock <= 0) {
      showToast('Produto sem stock disponível', 'warning');
      return;
    }

    const existingItem = cart.find(
      item => item.productId === product.id && item.variantId === variantId
    );

    if (existingItem) {
      if (existingItem.quantity + quantityToAdd > stock) {
        showToast(`Stock insuficiente. Apenas ${stock} unidades disponíveis.`, 'warning');
        return;
      }
      const updatedCart = cart.map(item =>
        item.productId === product.id && item.variantId === variantId
          ? { ...item, quantity: item.quantity + quantityToAdd }
          : item
      );
      setCart(updatedCart);
      saveCartToStorage(updatedCart);
      const displayName = variantName ? `${product.name} - ${variantName}` : product.name;
      showToast(`${displayName} adicionado ao carrinho`, 'success');
    } else {
      if (quantityToAdd > stock) {
        showToast(`Stock insuficiente. Apenas ${stock} unidades disponíveis.`, 'warning');
        return;
      }
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        variantId,
        variantName,
        quantity: quantityToAdd,
        price,
        unit,
        image: product.image
      };
      const updatedCart = [...cart, newItem];
      setCart(updatedCart);
      saveCartToStorage(updatedCart);
      const displayName = variantName ? `${product.name} - ${variantName}` : product.name;
      showToast(`${displayName} adicionado ao carrinho`, 'success');
    }

    // Rastrear açéo de adicionar ao carrinho usando o hook
    trackAddToCartAction(
      product.id,
      variantName ? `${product.name} - ${variantName}` : product.name,
      existingItem ? existingItem.quantity + 1 : 1,
      price
    );
  }, [showToast, trackAddToCartAction, cart, saveCartToStorage]);

  const updateCartQuantity = useCallback((productId: string, variantId: string | undefined, delta: number) => {
    const updatedCart = cart.map(item => {
      if (item.productId === productId && item.variantId === variantId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return null;

        // Verificar stock
        const product = products.find(p => p.id === productId);
        const variant = variantId ? product?.variants?.find(v => v.id === variantId) : null;
        const stock = variant?.stock ?? product?.variants?.[0]?.stock ?? 0;

        if (newQuantity > stock) {
          showToast('Stock insuficiente', 'warning');
          return item;
        }

        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean) as CartItem[];

    setCart(updatedCart);
    saveCartToStorage(updatedCart);
  }, [cart, products, saveCartToStorage, showToast]);

  const removeFromCart = useCallback((productId: string, variantId: string | undefined) => {
    const updatedCart = cart.filter(
      item => !(item.productId === productId && item.variantId === variantId)
    );
    setCart(updatedCart);
    saveCartToStorage(updatedCart);
  }, [cart, saveCartToStorage]);

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Atualizar activeBottomNav quando carrinho é fechado
  useEffect(() => {
    if (!showCart && activeBottomNav === 'cart') {
      setActiveBottomNav('home');
    }
  }, [showCart, activeBottomNav]);

  // Atualizar activeBottomNav quando perfil é© aberto/fechado
  useEffect(() => {
    if (showProfile && currentUser) {
      setActiveBottomNav('profile');
    } else if (!showProfile && activeBottomNav === 'profile') {
      setActiveBottomNav('home');
    }
  }, [showProfile, currentUser, activeBottomNav]);

  // Pré-preencher dados do checkout quando abrir e usuário estiver logado
  useEffect(() => {
    if (showCheckout && currentUser) {
      setDeliveryInfo(prev => ({
        ...prev,
        name: currentUser.name || prev.name,
        email: currentUser.email || prev.email,
        phone: currentUser.phone || prev.phone
      }));
    }
  }, [showCheckout, currentUser]);

  // Funçéo para verificar se perfil precisa ser completado (telefone obrigaté³rio)
  const needsProfileCompletion = (user: UserType | null): boolean => {
    if (!user) return false;
    const cleanPhone = user.phone?.replace(/\D/g, '') || '';
    return cleanPhone.length < 8;
  };

  // Funçéo para abrir checkout (verifica login e perfil primeiro)
  const openCheckout = () => {
    if (!currentUser) {
      setLoginMessage('É necessário iniciar sessão para finalizar o pedido. Você pode fazer login com Google ou criar uma conta.');
      setShowLogin(true);
      setPendingCheckout(true);
      return;
    }

    // Verificar se precisa completar perfil
    if (needsProfileCompletion(currentUser)) {
      setShowCompleteProfile(true);
      setPendingCheckout(true);
      return;
    }

    // Tudo ok, abrir checkout
    setShowCheckout(true);
    setPendingCheckout(false);
  };

  const handleLogin = async (emailOrPhone: string, password: string) => {
    const { user, error } = await authService.signIn(emailOrPhone, password);
    if (user) {
      setCurrentUser(user);
      setShowLogin(false);
      setLoginMessage(null);
      setDeliveryInfo(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));

      // Notificar componente pai sobre login
      if (onLogin) {
        onLogin(user);
      }

      // Se havia produto pendente, adicionar ao carrinho agora
      if (pendingAddToCart) {
        await addToCart(pendingAddToCart.product, pendingAddToCart.variant);
        setPendingAddToCart(null);
      }

      // Verificar se precisa completar perfil (telefone obrigaté³rio)
      if (needsProfileCompletion(user)) {
        setShowCompleteProfile(true);
      } else if (pendingCheckout) {
        // Se checkout estava pendente e perfil está completo, abrir checkout
        setShowCheckout(true);
        setPendingCheckout(false);
      }

      // Permanece na loja independente do role
      // Admins podem acessar a loja normalmente
    } else {
      showToast(error || 'Erro ao fazer login', 'error');
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setDeliveryInfo(prev => ({
      ...prev,
      name: '',
      email: '',
      phone: ''
    }));

    // Notificar componente pai sobre logout
    if (onLogout) {
      onLogout();
    }
  };

  const handleTrackOrder = async () => {
    const code = trackingInput.trim().toUpperCase();
    if (!code) return;
    setTrackingLoading(true);
    setTrackingError('');
    setTrackingResult(null);
    try {
      const result = await api.get<typeof trackingResult>(`/orders/tracking/${encodeURIComponent(code)}`);
      setTrackingResult(result);
    } catch (e: any) {
      setTrackingError(e.message || 'Código não encontrado');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleCheckout = async () => {
    // Verificar se usuário está logado
    if (!currentUser) {
      openCheckout();
      return;
    }

    // Verificar se precisa completar perfil
    if (needsProfileCompletion(currentUser)) {
      setShowCompleteProfile(true);
      setPendingCheckout(true);
      return;
    }

    if (cart.length === 0) {
      showToast('Adicione produtos ao carrinho', 'info');
      return;
    }

    // Usar dados do perfil do usuário
    const userName = currentUser.name || '';
    const userEmail = currentUser.email || '';
    const userPhone = currentUser.phone || '';

    if (!userPhone) {
      showToast('Telefone é© obrigaté³rio. Complete seu perfil primeiro.', 'warning');
      setShowCompleteProfile(true);
      return;
    }

    if (deliveryInfo.isDelivery && (!deliveryInfo.deliveryZoneId || !deliveryInfo.address)) {
      showToast('Selecione a zona de entrega e informe o endereço', 'warning');
      return;
    }

    // Usar customerId do usuário logado se disponível
    const customerId = currentUser?.customerId || '';

    // Gerar número do pedido automaticamente se não fornecido
    const orderNumber = await orderService.getNextOrderNumber();

    // Criar pedido
    const orderItems: OrderItem[] = cart.map(item => ({
      productId: item.productId,
      productName: item.variantName ? `${item.productName} - ${item.variantName}` : item.productName,
      quantity: item.quantity,
      unit: item.unit,
      priceAtTime: item.price
    }));

    const discountAmount = appliedCoupon?.discountAmount || 0;
    const totalAmount = Math.max(0, getCartTotal() + (deliveryInfo.isDelivery ? deliveryInfo.deliveryFee : 0) - discountAmount);

    const order = {
      id: '',
      customerId: customerId || '',
      customerName: userName,
      customerPhone: userPhone,
      items: orderItems,
      totalAmount,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
      source: 'Direct' as any,
      isDelivery: deliveryInfo.isDelivery,
      deliveryLocation: deliveryInfo.address,
      deliveryFee: deliveryInfo.isDelivery ? deliveryInfo.deliveryFee : 0,
      deliveryZoneId: deliveryInfo.deliveryZoneId || undefined,
      deliveryZoneName: deliveryInfo.deliveryZoneName || undefined,
      orderNumber: orderNumber,
      couponCode: appliedCoupon?.code || undefined,
      discountAmount: discountAmount || undefined
    };

    try {
      const result = await orderService.createOrder(order);
      if (result.order) {
        // Rastrear conclusão de pedido
        trackOrderComplete(result.order.id, totalAmount, orderItems);

        // Perfil já está completo (telefone foi verificado antes)

        // Limpar carrinho e cupão
        setCart([]);
        saveCartToStorage([]);
        setAppliedCoupon(null);
        setShowCheckout(false);
        setShowCart(false);
        showToast('Pedido criado com sucesso! Entraremos em contacto em breve.', 'success', 6000);
      } else {
        showToast('Erro ao criar pedido. Por favor, verifique os dados e tente novamente.', 'error', 8000);
      }
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);

      // Detectar erro de configuraçéo RLS
      if (error.message?.includes('RLS_CONFIG_REQUIRED') || error.message?.includes('row-level security') || error.message?.includes('permission denied')) {
        const isAuthenticated = !!currentUser;
        const errorMsg = isAuthenticated
          ? 'Erro de permissão: As polé­ticas de segurança do banco estéo bloqueando a criaçéo do pedido. Execute o script SQL no Supabase: sql/fixes/FIX_CUSTOMERS_ORDERS_PUBLIC_INSERT.sql'
          : 'Erro de configuraçéo: é‰ necessé¡rio configurar as permisséµes do banco de dados. Execute o script sql/fixes/FIX_CUSTOMERS_ORDERS_PUBLIC_INSERT.sql no Supabase SQL Editor.';

        showToast(errorMsg, 'error', 12000);
        console.error('ðŸ“‹ INSTRUé‡é•ES PARA CORRIGIR:');
        console.error('1. Acesse: https://supabase.com/dashboard');
        console.error('2. Selecione seu projeto');
        console.error('3. Vé¡ em SQL Editor â†’ New query');
        console.error('4. Abra o arquivo: sql/fixes/FIX_CUSTOMERS_ORDERS_PUBLIC_INSERT.sql');
        console.error('5. Copie todo o conteéºdo e cole no SQL Editor');
        console.error('6. Clique em Run (ou Ctrl+Enter)');
        console.error('7. Aguarde a confirmaçéo de sucesso');
        console.error('8. Tente criar o pedido novamente');
      } else {
        showToast(`Erro ao criar pedido: ${error.message || 'Erro desconhecido. Tente novamente.'}`, 'error', 8000);
      }
    }
  };

  const effectiveUser = currentUser || propCurrentUser;

  if (requireAuth && !effectiveUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col items-center justify-center p-8 relative z-10">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-content-primary">Natur Erva</h1>
          <p className="text-content-muted">
            Inicie sessão para aceder à loja. Pode fazer login com Google ou criar uma conta.
          </p>
          <button
            onClick={() => setShowLogin(true)}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Iniciar Sessão
          </button>
        </div>
        {showLogin && (
          <LoginModal
            onLogin={handleLogin}
            onClose={() => setShowLogin(false)}
            message="É necessário iniciar sessão para aceder à loja."
            onUserLogin={async (user) => {
              setCurrentUser(user);
              setShowLogin(false);
              if (onLogin) onLogin(user);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base transition-colors duration-300">

      {/* Renderizar Perfil do Cliente se showProfile for true */}
      {showProfile && currentUser ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8">
          <CustomerProfile
            user={currentUser}
            onBack={() => {
              setShowProfile(false);
              setActiveBottomNav('home');
            }}
            onLogout={handleLogout}
            showToast={showToast}
          />
        </main>
      ) : (
        <>
          {/* Mensagem de Boas-Vindas */}
          {currentUser && showWelcome && (
            <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-2 animate-fadeIn">
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 shadow-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm sm:text-base">
                      Olá, {currentUser.name.split(' ')[0]}! 👋
                    </p>
                    <p className="text-white/90 text-xs sm:text-sm">
                      Bem-vindo de volta à Natur Erva
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="text-white/80 hover:text-white transition-colors"
                  aria-label="Fechar mensagem"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}


          {/* ── HERO / BANNER ── */}
          {!isMobile && (
            <ShopBanner
              isAdmin={isAdmin}
              products={products}
              uploadImage={uploadProductImage}
            />
          )}

          {/* ── CATEGORIAS — oculto no mobile ── */}
          {categories.length > 0 && !isMobile && (
            <section className="max-w-7xl mx-auto px-4 relative z-10 -mt-16">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {categories.map((cat, idx) => {
                  const icons = [Leaf, Droplet, Pill, Heart, Sparkles, Tag];
                  const Icon = icons[idx % icons.length];
                  const count = products.filter(p =>
                    (p.category || '').toLowerCase() === cat.name.toLowerCase()
                  ).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name === selectedCategory ? 'all' : cat.name)}
                      className={`bg-surface-raised rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 w-full ${selectedCategory === cat.name ? 'ring-2 ring-green-500' : ''}`}
                    >
                      <div
                        className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: cat.color || '#22c55e' }}
                      >
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon className="w-8 h-8 text-white" />
                        )}
                      </div>
                      <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-white">{cat.name}</h3>
                      <p className="text-sm text-content-muted">{count} produtos</p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── BANNER PROMOCIONAL — visível em todos os tamanhos ── */}
          <section className={`max-w-7xl mx-auto px-4 ${isMobile ? 'mt-6' : 'mt-16'}`}>
              <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between">
                <div className="mb-4 md:mb-0">
                  <h3 className="text-3xl mb-2">Primeira Compra?</h3>
                  <p className="text-green-50">Fale connosco e descubra promoções exclusivas para novos clientes</p>
                </div>
                <a
                  href="https://wa.me/258874209440"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-green-700 px-6 py-3 rounded-lg hover:bg-green-50 transition-colors"
                >
                  Falar connosco
                </a>
              </div>
          </section>

          {/* ── SECÇÕES DE PRODUTOS ── */}
          {!loading && selectedCategory === 'all' && !debouncedSearchTerm && (
            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-2 space-y-10">
              <ProductCarousel
                title="Em Promoção"
                products={promoProducts}
                badge={promoProducts.length > 0 ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">
                    {promoProducts.length} {promoProducts.length === 1 ? 'oferta' : 'ofertas'}
                  </span>
                ) : undefined}
                onAddToCart={addToCart}
                onNotify={() => showToast('Será notificado quando disponível!', 'info', 4000)}
                currentUserName={currentUser?.name}
              />
              <ProductCarousel
                title="Mais Vendidos"
                products={bestSellers}
                onAddToCart={addToCart}
                onNotify={() => showToast('Será notificado quando disponível!', 'info', 4000)}
                currentUserName={currentUser?.name}
              />
              <ProductCarousel
                title="Novidades"
                products={newestProducts}
                onAddToCart={addToCart}
                onNotify={() => showToast('Será notificado quando disponível!', 'info', 4000)}
                currentUserName={currentUser?.name}
              />
            </section>
          )}

          {/* ── BANNER INTERMÉDIO (entre carrosséis e grid) ── */}
          <ShopMidBanner
            isAdmin={isAdmin}
            products={products}
            uploadImage={uploadProductImage}
          />

          {/* ── GRID DE PRODUTOS ── */}
          <main id="produtos-section" className="max-w-7xl mx-auto px-4 sm:px-8 py-16">

            {/* Barra de pesquisa + ordenação */}
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="relative w-64 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar produtos..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-border-default bg-surface-raised text-content-primary placeholder-content-muted text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-gray-600 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border-default bg-surface-raised text-content-secondary text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
              >
                <option value="popular">Mais Populares</option>
                <option value="newest">Mais Recentes</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="name_asc">Nome A-Z</option>
              </select>
            </div>

            {loading ? (
              <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5'}`}>
                {Array.from({ length: isMobile ? 6 : 8 }).map((_, index) => (
                  <ProductCardSkeleton key={index} isMobile={isMobile} />
                ))}
              </div>
            ) : filteredProductsMemo.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-block p-5 rounded-full bg-surface-raised shadow-md mb-4">
                  <Package className="h-12 w-12 text-content-muted" />
                </div>
                <p className="mt-2 text-content-muted">Nenhum produto encontrado</p>
                {selectedCategory !== 'all' && (
                  <button onClick={() => setSelectedCategory('all')} className="mt-3 text-green-600 dark:text-green-400 text-sm hover:underline">Limpar filtro</button>
                )}
              </div>
            ) : (
              <>
                {(() => {
                  const CHUNK = 8;
                  const gridClass = `grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5'}`;
                  const chunks: typeof filteredProductsMemo[] = [];
                  for (let i = 0; i < filteredProductsMemo.length; i += CHUNK) {
                    chunks.push(filteredProductsMemo.slice(i, i + CHUNK));
                  }
                  return chunks.map((chunk, chunkIndex) => (
                    <React.Fragment key={chunkIndex}>
                      <div className={gridClass}>
                        {chunk.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={addToCart}
                            onNotify={() => showToast('Será notificado quando este produto estiver disponível!', 'info', 4000)}
                            isMobile={isMobile}
                            currentUserName={currentUser?.name}
                          />
                        ))}
                      </div>
                      {chunkIndex < chunks.length - 1 && (
                        <InlineAdBanner
                          slot={(chunkIndex % 2) + 1}
                          isAdmin={isAdmin}
                          products={products}
                        />
                      )}
                    </React.Fragment>
                  ));
                })()}
              </>
            )}
          </main>

          {/* ── AVALIAÇÕES ── */}
          <TestimonialsSection />

          {/* ── PROGRAMA DE AFILIADOS ── */}
          <section className="py-4 px-4 pb-12">
            <div className="max-w-4xl mx-auto">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-8 text-white shadow-lg">
                <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                    <Gift className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1">Programa de Afiliados</h2>
                    <p className="text-green-100 text-sm leading-relaxed max-w-lg">
                      Partilha o teu link exclusivo e ganha <strong className="text-white">5% de comissão</strong> em cada compra feita pelos teus referidos. Sem limite de ganhos!
                    </p>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-green-200">
                      <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Comissões ilimitadas</span>
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Partilha com amigos e família</span>
                      <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Pagamento rápido</span>
                    </div>
                  </div>
                  <button
                    onClick={() => currentUser ? navigate('/minha-conta/afiliados') : setShowLogin(true)}
                    className="shrink-0 px-6 py-3 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors text-sm whitespace-nowrap"
                  >
                    {currentUser ? 'Ver o meu painel' : 'Aderir agora'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── BLOG — últimos artigos ── */}
          {blogPosts.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-14">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className={`font-bold text-content-primary ${isMobile ? 'text-xl' : 'text-2xl'}`}>Nossos Artigos</h2>
                  <p className="text-content-muted text-sm mt-1">Dicas de saúde e bem-estar natural</p>
                </div>
                <Link to="/blog" className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:underline">
                  Ver todos <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                {blogPosts.map(post => (
                  <Link key={post.id} to={`/blog/${post.slug}`}
                    className="group bg-surface-raised rounded-2xl overflow-hidden border border-border-default shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                    {post.coverImage ? (
                      <img src={post.coverImage} alt={post.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-44 bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
                        <Leaf className="w-10 h-10 text-green-400 opacity-40" />
                      </div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      {post.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {post.tags.slice(0, 2).map((t: string) => (
                            <span key={t} className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-[10px] font-medium">{t}</span>
                          ))}
                        </div>
                      )}
                      <h3 className="font-bold text-content-primary text-base leading-snug line-clamp-2 mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{post.title}</h3>
                      {post.summary && <p className="text-content-muted text-sm line-clamp-2 flex-1">{post.summary}</p>}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default text-xs text-content-muted">
                        <span>{new Date(post.publishedAt || post.createdAt).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="text-green-600 dark:text-green-400 font-medium group-hover:underline">Ler artigo →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── RASTREAR ENCOMENDA ── */}
          <section className="py-12 px-4">
            <div className="max-w-2xl mx-auto">
              <div className="bg-surface-raised rounded-2xl shadow-sm border border-border-default p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-content-primary">Rastrear Encomenda</h2>
                    <p className="text-sm text-content-muted">Insere o teu código de rastreio</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleTrackOrder()}
                    placeholder="Ex: NE-20260522-ABC123"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-border-strong bg-surface-base text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  />
                  <button
                    onClick={handleTrackOrder}
                    disabled={trackingLoading || !trackingInput.trim()}
                    className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    {trackingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Rastrear
                  </button>
                </div>
                {trackingError && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
                    <XCircle className="w-4 h-4 shrink-0" />{trackingError}
                  </div>
                )}
                {trackingResult && (() => {
                  const STATUS: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
                    pending:          { label: 'Pendente',          bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700',  icon: <Clock className="w-4 h-4" /> },
                    confirmed:        { label: 'Confirmado',        bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700',    icon: <CheckCircle className="w-4 h-4" /> },
                    processing:       { label: 'Em Processamento',  bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700',    icon: <Clock className="w-4 h-4" /> },
                    out_for_delivery: { label: 'A Caminho',         bg: 'bg-purple-50 dark:bg-purple-900/20',text: 'text-purple-700',  icon: <Truck className="w-4 h-4" /> },
                    delivered:        { label: 'Entregue',          bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700',   icon: <CheckCircle className="w-4 h-4" /> },
                    completed:        { label: 'Concluído',         bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700',   icon: <CheckCircle className="w-4 h-4" /> },
                    cancelled:        { label: 'Cancelado',         bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700',     icon: <XCircle className="w-4 h-4" /> },
                  };
                  const s = STATUS[trackingResult.status] ?? { label: trackingResult.status, bg: 'bg-surface-base', text: 'text-gray-700', icon: <Package className="w-4 h-4" /> };
                  return (
                    <div className="mt-4 rounded-xl border border-border-default overflow-hidden">
                      <div className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm ${s.bg} ${s.text}`}>{s.icon} {s.label}</div>
                      <div className="px-4 py-3 space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Pedido nº</span><span className="font-mono font-semibold text-content-primary">{trackingResult.orderNumber}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Código</span><span className="font-mono text-content-secondary">{trackingResult.trackingCode}</span></div>
                        {trackingResult.deliveryZoneName && <div className="flex justify-between"><span className="text-gray-500">Zona</span><span className="text-content-secondary">{trackingResult.deliveryZoneName}</span></div>}
                        <div className="flex justify-between"><span className="text-gray-500">Data do pedido</span><span className="text-content-secondary">{new Date(trackingResult.createdAt).toLocaleDateString('pt-MZ')}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <FAQSection />

          {/* ── INSTAGRAM ── */}
          <ShopInstagram />
        </>
      )}

      {/* Modal de Login */}
      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => {
            setShowLogin(false);
            setLoginMessage(null);
          }}
          message={loginMessage}
          onUserLogin={async (user) => {
            setCurrentUser(user);
            setShowLogin(false);
            setLoginMessage(null);
            setDeliveryInfo(prev => ({
              ...prev,
              name: user.name || '',
              email: user.email || '',
              phone: user.phone || ''
            }));
            if (onLogin) {
              onLogin(user);
            }
            // Se havia produto pendente, adicionar ao carrinho agora
            if (pendingAddToCart) {
              await addToCart(pendingAddToCart.product, pendingAddToCart.variant);
              setPendingAddToCart(null);
            }
            // Verificar se precisa completar perfil (telefone obrigaté³rio)
            if (needsProfileCompletion(user)) {
              setShowCompleteProfile(true);
            } else if (pendingCheckout) {
              // Se checkout estava pendente e perfil está completo, abrir checkout
              setShowCheckout(true);
              setPendingCheckout(false);
            }
          }}
        />
      )}

      {/* Carrinho */}
      {showCart && (
        <CartSidebar
          cart={cart}
          onUpdateQuantity={updateCartQuantity}
          onRemove={removeFromCart}
          onClose={() => {
            setShowCart(false);
            setActiveBottomNav('home');
          }}
          onCheckout={() => {
            setShowCart(false);
            setActiveBottomNav('home');
            // Rastrear iné­cio de checkout
            trackCheckoutStart(cart, getCartTotal());
            // Abrir checkout (verifica login e perfil primeiro)
            openCheckout();
          }}
          total={getCartTotal()}
          isMobile={isMobile}
        />
      )}

      {/* Modal de Completar Perfil */}
      {showCompleteProfile && currentUser && (
        <CompleteProfileModal
          currentUser={currentUser}
          onClose={() => {
            setShowCompleteProfile(false);
            setPendingCheckout(false);
          }}
          onSuccess={async () => {
            setShowCompleteProfile(false);
            // Atualizar usuário local (não bloqueia o fluxo)
            authService.getCurrentUser().then(updatedUser => {
              if (updatedUser) {
                setCurrentUser(updatedUser);
                if (onLogin) onLogin(updatedUser);
              }
            }).catch(() => {});
            // Abrir checkout independentemente de getCurrentUser ter sucesso
            if (pendingCheckout) {
              setShowCheckout(true);
              setPendingCheckout(false);
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Checkout */}
      {showCheckout && (
        <CheckoutModal
          deliveryInfo={deliveryInfo}
          onUpdateDeliveryInfo={setDeliveryInfo}
          onConfirm={handleCheckout}
          onClose={() => {
            setShowCheckout(false);
            setAppliedCoupon(null);
          }}
          total={getCartTotal()}
          cart={cart}
          currentUser={currentUser}
          onEditProfile={() => {
            setShowCheckout(false);
            navigate('/minha-conta');
          }}
          appliedCoupon={appliedCoupon}
          onApplyCoupon={setAppliedCoupon}
        />
      )}

      {/* Footer agora é compartilhado via PublicLayout */}





      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}} />
    </div>
  );
};

// Componente de Carrinho Lateral/Bottom Sheet - Moderno e Minimalista
const CartSidebar: React.FC<{
  cart: CartItem[];
  onUpdateQuantity: (productId: string, variantId: string | undefined, delta: number) => void;
  onRemove: (productId: string, variantId: string | undefined) => void;
  onClose: () => void;
  onCheckout: () => void;
  total: number;
  isMobile?: boolean;
}> = ({ cart, onUpdateQuantity, onRemove, onClose, onCheckout, total, isMobile = false }) => {
  return (
    <div
      className={`fixed inset-0 min-h-screen min-w-full ${isMobile ? 'z-[60]' : 'z-50'} flex`}
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 modal-overlay-bg" />

      {/* Carrinho - Sidebar no desktop, Bottom Sheet no mobile */}
      <div
        className={`relative ${isMobile ? 'ml-0 mt-auto w-full max-h-[90vh] rounded-t-2xl border-t border-b-0 animate-slide-in-up' : 'ml-auto w-full max-w-md h-full border-l border-t-0 animate-slide-in-right'} backdrop-blur-xl bg-surface-raised/[0.97] dark:bg-surface-raised/[0.96] shadow-2xl flex flex-col ${isMobile ? '' : 'border-l'} border-border-default/30 dark:border-white/[0.07]`}
        onClick={(e) => e.stopPropagation()}
        style={isMobile ? {
          maxHeight: '90vh',
          height: '90vh'
        } : {
          height: '100%'
        }}
      >
        {/* Header - Fixo no topo */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border-default/30 dark:border-white/[0.07] flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-content-primary">
              Carrinho
            </h2>
            <p className="text-sm text-content-muted mt-0.5">
              {cart.length} {cart.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-content-muted hover:text-gray-600 dark:hover:text-gray-300 hover:bg-surface-overlay transition-colors"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo - Scrollável com altura controlada */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            minHeight: 0, // Importante para flex funcionar corretamente
            WebkitOverflowScrolling: 'touch' // Scroll suave no iOS
          }}
        >
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 py-12">
              <div className="w-20 h-20 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
                <ShoppingCart className="h-10 w-10 text-content-muted" />
              </div>
              <p className="text-lg font-medium text-content-primary mb-2">
                Carrinho vazio
              </p>
              <p className="text-sm text-content-muted text-center max-w-xs">
                Adicione produtos ao carrinho para começar suas compras
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-3">
              {cart.map((item, index) => (
                <div
                  key={index}
                  className="group backdrop-blur-md bg-surface-raised/60 dark:bg-white/[0.06] rounded-xl p-4 hover:bg-white/80 dark:hover:bg-white/[0.09] transition-all border border-border-default/20 dark:border-white/[0.05] shadow-sm hover:shadow-md"
                >
                  <div className="flex gap-4">
                    {/* Imagem */}
                    <div className="flex-shrink-0">
                      {item.image ? (
                        <img
                          src={uploadService.getPublicUrl(item.image)}
                          alt={item.productName}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-surface-overlay dark:bg-white/[0.1] rounded-lg flex items-center justify-center">
                          <Package className="h-8 w-8 text-content-muted" />
                        </div>
                      )}
                    </div>

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-content-primary text-sm sm:text-base line-clamp-2 mb-1">
                        {item.productName}
                      </h3>
                      {item.variantName && (
                        <p className="text-xs sm:text-sm text-content-muted mb-2">
                          {item.variantName}
                        </p>
                      )}
                      <p className="text-sm sm:text-base font-semibold text-green-600 dark:text-green-400 mb-3">
                        {item.price.toFixed(2)} MT
                      </p>

                      {/* Controles de quantidade */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-surface-raised rounded-lg border border-border-default">
                          <button
                            onClick={() => onUpdateQuantity(item.productId, item.variantId, -1)}
                            className="p-1.5 sm:p-2 text-content-muted hover:text-gray-900 dark:hover:text-white hover:bg-surface-overlay rounded-l-lg transition-colors"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 sm:w-10 text-center font-semibold text-content-primary text-sm sm:text-base">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.productId, item.variantId, 1)}
                            className="p-1.5 sm:p-2 text-content-muted hover:text-gray-900 dark:hover:text-white hover:bg-surface-overlay rounded-r-lg transition-colors"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => onRemove(item.productId, item.variantId)}
                          className="p-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          aria-label="Remover item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer com total e botão - Sempre fixo na parte inferior */}
        {cart.length > 0 && (
          <div
            className="border-t border-border-default/30 dark:border-white/[0.07] backdrop-blur-xl bg-surface-raised/[0.97] dark:bg-surface-raised/[0.96] p-5 sm:p-6 space-y-4 flex-shrink-0"
            style={isMobile ? {
              paddingBottom: `max(1.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))`,
              boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
            } : {}}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-content-primary">
                Total
              </span>
              <span className="text-2xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">
                {total.toFixed(2)} MT
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3.5 sm:py-4 rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl shadow-green-500/30 transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              Finalizar Pedido
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes slide-in-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        .animate-slide-in-up {
          animation: slide-in-up 0.3s ease-out;
        }
      `}} />
    </div>
  );
};

// Componente de Completar Perfil
const CompleteProfileModal: React.FC<{
  currentUser: UserType;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}> = ({ currentUser, onClose, onSuccess, showToast }) => {
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar telefone
    const cleanPhone = phone.replace(/\D/g, '');
    if (!phone || cleanPhone.length < 8) {
      showToast('Telefone é© obrigaté³rio e deve ter pelo menos 8 dé­gitos', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.updateProfile(currentUser.id, {
        name: name.trim() || currentUser.name,
        phone: phone.trim()
      });

      if (result.success) {
        showToast('Perfil atualizado com sucesso!', 'success');
        onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Erro ao atualizar perfil', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar perfil', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="backdrop-blur-xl bg-surface-raised/[0.97] dark:bg-surface-raised/[0.96] rounded-2xl max-w-md w-full shadow-2xl border border-border-default/30 dark:border-white/[0.07] animate-scaleIn">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-content-primary">Completar Perfil</h2>
            <button onClick={onClose} className="p-2 rounded-xl text-content-muted hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60 backdrop-blur-md transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              Para finalizar seu pedido, precisamos do seu número de telefone/WhatsApp. Nossa equipe precisa entrar em contato com você.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-content-primary mb-2">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-border-default/30 dark:border-white/[0.07] rounded-xl bg-surface-raised/60 dark:bg-white/[0.06] backdrop-blur-md text-content-primary placeholder-content-muted focus:ring-2 focus:ring-green-500/50 dark:focus:ring-green-400/50 focus:border-green-500/50 dark:focus:border-green-400/50 transition-all shadow-sm"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-content-primary mb-2">
                Telefone/WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-border-default/30 dark:border-white/[0.07] rounded-xl bg-surface-raised/60 dark:bg-white/[0.06] backdrop-blur-md text-content-primary placeholder-content-muted focus:ring-2 focus:ring-green-500/50 dark:focus:ring-green-400/50 focus:border-green-500/50 dark:focus:border-green-400/50 transition-all shadow-sm"
                placeholder="+258 84 123 4567"
                required
                pattern="[+]?[\d\s()\-]{8,}"
                minLength={8}
              />
              <p className="text-xs text-content-muted mt-1">
                Nossa equipe precisa entrar em contato com você para confirmar o pedido
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-overlay dark:bg-white/[0.1] text-content-primary font-medium hover:bg-gray-300 dark:hover:bg-surface-overlay transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar e Continuar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Componente de Checkout
const CheckoutModal: React.FC<{
  deliveryInfo: any;
  onUpdateDeliveryInfo: (info: any) => void;
  onConfirm: () => void;
  onClose: () => void;
  total: number;
  cart: CartItem[];
  currentUser?: UserType | null;
  onEditProfile?: () => void;
  appliedCoupon: { type: string; value: number; discountAmount: number; code: string } | null;
  onApplyCoupon: (coupon: { type: string; value: number; discountAmount: number; code: string } | null) => void;
}> = ({ deliveryInfo, onUpdateDeliveryInfo, onConfirm, onClose, total, cart, currentUser, onEditProfile, appliedCoupon, onApplyCoupon }) => {
  const [couponInput, setCouponInput] = React.useState(appliedCoupon?.code || '');
  const [couponValidating, setCouponValidating] = React.useState(false);
  const [couponError, setCouponError] = React.useState('');

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponValidating(true);
    setCouponError('');
    try {
      const res = await api.post<{ valid: boolean; type: string; value: number; discountAmount: number; code: string; message: string }>(
        '/coupons/validate',
        { code: couponInput.trim(), totalAmount: total, deliveryFee: deliveryInfo.isDelivery ? deliveryInfo.deliveryFee : 0 }
      );
      if (res.valid) {
        onApplyCoupon({ type: res.type, value: res.value, discountAmount: res.discountAmount, code: res.code });
      } else {
        setCouponError(res.message || 'Cupão inválido');
        onApplyCoupon(null);
      }
    } catch {
      setCouponError('Erro ao validar cupão');
    } finally {
      setCouponValidating(false);
    }
  };

  const effectiveDeliveryFee = appliedCoupon?.type === 'free_shipping' ? 0 : (deliveryInfo.isDelivery ? deliveryInfo.deliveryFee : 0);
  const displayTotal = Math.max(0, total + (deliveryInfo.isDelivery ? deliveryInfo.deliveryFee : 0) - (appliedCoupon?.discountAmount || 0));

  return (
    <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="backdrop-blur-xl bg-surface-raised/[0.97] dark:bg-surface-raised/[0.96] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border-default/30 dark:border-white/[0.07] animate-scaleIn">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-content-primary">Finalizar Pedido</h2>
            <button onClick={onClose} className="p-2 rounded-xl text-content-muted hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60 backdrop-blur-md transition-all">
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <div className="space-y-5 sm:space-y-6">
            {/* Informações de Contacto - Somente Leitura */}
            {currentUser && (
              <div className="backdrop-blur-md bg-surface-raised/60 dark:bg-white/[0.06] rounded-xl p-4 sm:p-5 border border-border-default/30 dark:border-white/[0.07] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base sm:text-lg text-content-primary flex items-center">
                    <User className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                    Seus dados de contato
                  </h3>
                  {onEditProfile && (
                    <button
                      onClick={() => {
                        onClose();
                        onEditProfile();
                      }}
                      className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                    >
                      Editar no perfil
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">
                      Nome
                    </label>
                    <div className="px-4 py-2.5 rounded-xl bg-surface-overlay/50 text-content-primary">
                      {currentUser.name || 'Não informado'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">
                      Telefone/WhatsApp
                    </label>
                    <div className="px-4 py-2.5 rounded-xl bg-surface-overlay/50 text-content-primary">
                      {currentUser.phone || 'Não informado'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">
                      Email
                    </label>
                    <div className="px-4 py-2.5 rounded-xl bg-surface-overlay/50 text-content-primary">
                      {currentUser.email || 'Néo informado'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Opções de Entrega */}
            <div className="backdrop-blur-md bg-surface-raised/60 dark:bg-white/[0.06] rounded-xl p-4 sm:p-5 border border-border-default/30 dark:border-white/[0.07] shadow-sm">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={deliveryInfo.isDelivery}
                  onChange={(e) => onUpdateDeliveryInfo({ ...deliveryInfo, isDelivery: e.target.checked })}
                  className="mt-1 rounded border-gray-300 dark:border-border-strong text-green-600 focus:ring-green-500 dark:focus:ring-green-400"
                />
                <div className="flex-1">
                  <span className="font-semibold text-base text-content-primary block flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                    Preciso de entrega
                  </span>
                  <span className="text-xs text-content-muted mt-1 block">
                    {deliveryInfo.deliveryFee > 0
                      ? `Taxa de entrega: ${deliveryInfo.deliveryFee.toFixed(2)} MT`
                      : 'Selecione a zona de entrega para ver o preço'
                    }
                  </span>
                </div>
              </label>
              {deliveryInfo.isDelivery && (
                <div className="mt-4 pt-4 border-t border-border-default space-y-4">
                  {/* Seletor de Zona */}
                  <div>
                    <label className="block text-sm font-semibold text-content-primary mb-2">
                      Zona de Entrega <span className="text-red-500">*</span>
                    </label>
                    <DeliveryZoneSelector
                      key={`zone-selector-${deliveryInfo.isDelivery}`} // Força remontagem quando delivery é ativado
                      selectedZoneId={deliveryInfo.deliveryZoneId}
                      selectedZoneName={deliveryInfo.deliveryZoneName}
                      onZoneSelect={(zone) => {
                        if (zone) {
                          onUpdateDeliveryInfo({
                            ...deliveryInfo,
                            deliveryZoneId: zone.id,
                            deliveryZoneName: zone.name,
                            deliveryFee: zone.price
                          });
                        } else {
                          onUpdateDeliveryInfo({
                            ...deliveryInfo,
                            deliveryZoneId: '',
                            deliveryZoneName: '',
                            deliveryFee: 0
                          });
                        }
                      }}
                      showPrice={false}
                    />
                  </div>

                  {/* Campo de Endereço Texto */}
                  <div>
                    <label className="block text-sm font-semibold text-content-primary mb-2">
                      Endereço de Entrega <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={deliveryInfo.address}
                      onChange={(e) => onUpdateDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-border-strong rounded-lg bg-surface-raised text-content-primary placeholder-content-muted focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-green-500 dark:focus:border-green-400 transition-colors resize-none"
                      rows={3}
                      placeholder="Digite o endereço completo (rua, bairro, cidade)..."
                      required={deliveryInfo.isDelivery}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cupão de Desconto */}
            <div className="backdrop-blur-md bg-surface-raised/60 dark:bg-white/[0.06] rounded-xl p-4 sm:p-5 border border-border-default/30 dark:border-white/[0.07] shadow-sm">
              <h3 className="font-semibold text-base text-content-primary flex items-center mb-3">
                <Tag className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                Cupão de Desconto
              </h3>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">{appliedCoupon.code}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      {appliedCoupon.type === 'free_shipping' ? 'Envio grátis' : `${appliedCoupon.value}% de desconto`}
                      {' — '}-{appliedCoupon.discountAmount.toFixed(2)} MT
                    </p>
                  </div>
                  <button onClick={() => { onApplyCoupon(null); setCouponInput(''); setCouponError(''); }} className="text-green-600 hover:text-red-500 dark:text-green-400 transition-colors p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                      className="flex-1 px-4 py-2.5 border-2 border-border-default/30 dark:border-white/[0.07] rounded-xl bg-surface-raised/60 dark:bg-white/[0.06] text-content-primary placeholder-content-muted focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all text-sm font-mono uppercase"
                      placeholder="CÓDIGO DO CUPÃO"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponValidating || !couponInput.trim()}
                      className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                      {couponValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                    </button>
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Resumo do Pedido */}
            <div className="backdrop-blur-md bg-surface-raised/60 dark:bg-white/[0.06] rounded-xl p-4 sm:p-5 border border-border-default/30 dark:border-white/[0.07] shadow-sm">
              <h3 className="font-semibold text-base sm:text-lg mb-4 text-content-primary flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                Resumo do Pedido
              </h3>
              <div className="space-y-3 mb-4">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border-default last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-content-primary">
                        {item.productName} {item.variantName && `- ${item.variantName}`}
                      </p>
                      <p className="text-xs text-content-muted">
                        Quantidade: {item.quantity} {item.unit}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-content-primary ml-4">
                      {(item.price * item.quantity).toFixed(2)} MT
                    </span>
                  </div>
                ))}
              </div>
              {deliveryInfo.isDelivery && deliveryInfo.deliveryFee > 0 && (
                <div className="flex justify-between items-center py-2 border-t border-border-default mb-2">
                  <span className="text-sm text-content-secondary">
                    Taxa de Entrega {deliveryInfo.deliveryZoneName && `(${deliveryInfo.deliveryZoneName})`}
                  </span>
                  <span className={`text-sm font-medium ${appliedCoupon?.type === 'free_shipping' ? 'line-through text-content-muted' : 'text-content-primary'}`}>
                    {deliveryInfo.deliveryFee.toFixed(2)} MT
                  </span>
                </div>
              )}
              {appliedCoupon && appliedCoupon.discountAmount > 0 && (
                <div className="flex justify-between items-center py-2 border-t border-border-default mb-2">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Desconto ({appliedCoupon.code})
                  </span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    -{appliedCoupon.discountAmount.toFixed(2)} MT
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300 dark:border-border-strong">
                <span className="text-lg font-bold text-content-primary">Total</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {displayTotal.toFixed(2)} MT
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                onClick={onConfirm}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl shadow-green-500/30 transform hover:scale-[1.02] transition-all duration-200"
              >
                Confirmar Pedido
              </button>
              <button
                onClick={onClose}
                className="flex-1 backdrop-blur-md bg-surface-raised/60 dark:bg-white/[0.06] border border-border-default/30 dark:border-white/[0.07] text-content-secondary py-3 rounded-xl font-medium hover:bg-white/80 dark:hover:bg-white/[0.09] transition-all shadow-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente de Perfil do Cliente
// ProductCard moved to ../components/ProductCard.tsx
// ProductCardSkeleton moved to ../components/ProductCard.tsx

// CustomerProfileModal removido - usando CustomerProfile.tsx agora

// Componente de Sidebar de Categorias (Desktop)
const CategorySidebar: React.FC<{
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  isDarkMode: boolean;
}> = ({ categories, selectedCategory, onSelectCategory, isDarkMode }) => {
  return (
    <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24 h-[calc(100vh-120px)] overflow-y-auto pr-4 custom-scrollbar self-start">
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-content-primary mb-6 flex items-center gap-2">
          <Filter className="h-5 w-5 text-green-600 dark:text-green-400" />
          Categorias
        </h2>

        <button
          onClick={() => onSelectCategory('all')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200 group ${selectedCategory === 'all'
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/20'
            : 'text-content-secondary hover:bg-white/80 dark:hover:bg-white/[0.09] hover:pl-5'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg transition-colors ${selectedCategory === 'all' ? 'bg-white/20' : 'bg-surface-overlay/50 group-hover:bg-green-100 dark:group-hover:bg-green-900/30'
              }`}>
              <Package className="h-4 w-4" />
            </div>
            <span>Todos</span>
          </div>
          <ChevronRight className={`h-4 w-4 transition-transform ${selectedCategory === 'all' ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />
        </button>

        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-medium transition-all duration-200 group ${selectedCategory === category
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/20'
              : 'text-content-secondary hover:bg-white/80 dark:hover:bg-white/[0.09] hover:pl-5'
              }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg transition-colors ${selectedCategory === category ? 'bg-white/20' : 'bg-surface-overlay/50 group-hover:bg-green-100 dark:group-hover:bg-green-900/30'
                }`}>
                <Filter className="h-4 w-4" />
              </div>
              <span className="truncate">{category}</span>
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${selectedCategory === category ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />
          </button>
        ))}
      </div>
    </aside>
  );
};


