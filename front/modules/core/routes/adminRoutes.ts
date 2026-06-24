/**
 * Mapeamento centralizado de rotas admin
 * 
 * Define o mapeamento entre pageId (usado internamente) e paths (URLs)
 * para evitar duplicação e garantir consistência.
 */

/**
 * Mapeamento de pageId para path admin
 */
export const ADMIN_ROUTE_MAP: Record<string, string> = {
  'dashboard': '/admin',
  // Vendas - com submenus (inclui pedidos e clientes)
  'sales': '/admin/vendas',
  'sales-orders': '/admin/vendas/pedidos',
  'sales-customers': '/admin/vendas/clientes',
  'sales-summaries': '/admin/vendas',
  'sales-by-product': '/admin/vendas/por-produto',
  // Rotas antigas para compatibilidade (redirecionam para novos paths)
  'orders': '/admin/vendas/pedidos',
  'customers': '/admin/vendas/clientes',
  // Produtos - com submenus
  'products': '/admin/produtos',
  'products-list': '/admin/produtos',
  'products-categories': '/admin/produtos/categorias',
  'products-units': '/admin/produtos/unidades',
  'products-labels': '/admin/produtos/etiquetas',
  // Compras - com submenus
  'purchases': '/admin/compras',
  'purchases-list': '/admin/compras',
  'purchases-by-product': '/admin/compras/por-produto',
  'purchases-suppliers': '/admin/compras/fornecedores',
  // Stock - com submenus
  'stock-management': '/admin/stock',
  'stock-products': '/admin/stock',
  'stock-movements': '/admin/stock/movimentos',
  'stock-alerts': '/admin/stock/alertas',
  'stock-adjustments': '/admin/stock/ajustes',
  'stock-lots': '/admin/stock/lotes',
  'stock-audit': '/admin/stock/auditoria',
  // Media
  'media': '/admin/galeria',
  'tracking': '/admin/estatisticas',
  // Usuários - com submenus
  'users': '/admin/usuarios',
  'users-list': '/admin/usuarios',
  'users-roles': '/admin/usuarios/roles',
  // Cupões
  'coupons': '/admin/cupoes',
  // Reembolsos
  'refunds': '/admin/reembolsos',
  // Afiliados
  'affiliates': '/admin/afiliados',
  // Logística
  'logistics': '/admin/logistica',
  // Zonas de entrega
  'delivery-zones': '/admin/zonas-entrega',
  // Marketing
  'marketing': '/admin/marketing',
  // Blog
  'blog': '/admin/blog',
  // Caixa (gestão de sessões) e POS (interface de venda)
  'pos': '/admin/caixa',
  'caixa': '/admin/caixa',
  'pos-sell': '/admin/pos',
  // Cotações
  'cotacoes': '/admin/cotacoes',
  // Finanças / IVA
  'financas': '/admin/financas',
  // Faturas
  'invoices': '/admin/faturas',
  // Fluxo de compras completo
  'purchase-flow': '/admin/compras-flow',
  // KPI Analytics
  'kpis': '/admin/kpis',
  // Contas a Pagar (AP)
  'ap': '/admin/contas-pagar',
  // Razão Geral / Ledger
  'ledger': '/admin/razao-geral',
  // RH
  'hr': '/admin/rh',
  // Projectos
  'projects': '/admin/projectos',
  // Helpdesk
  'helpdesk': '/admin/helpdesk',
  // Planilhas de Horas
  'timesheets': '/admin/timesheets',
  // Mensagens
  'messaging': '/admin/mensagens',
  // Assinaturas
  'subscriptions': '/admin/assinaturas',
  // Documentos
  'documents': '/admin/documentos',
  // Perfil
  'profile': '/admin/perfis'
};

/**
 * Obtém o path admin a partir de um pageId
 * @param pageId - ID da página (ex: 'dashboard', 'orders')
 * @returns Path da rota admin ou '/admin' como fallback
 */
export const getAdminPath = (pageId: string): string => {
  return ADMIN_ROUTE_MAP[pageId] || '/admin';
};

/**
 * Obtém o pageId a partir de um pathname
 * @param pathname - Pathname da URL (ex: '/admin/pedidos')
 * @returns PageId correspondente ou 'dashboard' como fallback
 */
export const getActivePageFromPath = (pathname: string): string => {
  // Normalizar pathname
  const normalizedPath = pathname.endsWith('/') && pathname !== '/admin/' 
    ? pathname.slice(0, -1) 
    : pathname;

  // Casos especiais
  if (normalizedPath === '/admin' || normalizedPath === '/admin/') {
    return 'dashboard';
  }

  // Mapeamento direto para sub-rotas (mais específico primeiro)
  const subRouteMap: Record<string, string> = {
    '/admin/caixa': 'sales',
    '/admin/pos': 'sales',
    '/admin/cotacoes': 'sales',
    '/admin/vendas/pedidos': 'sales',
    '/admin/vendas/clientes': 'sales',
    '/admin/vendas/por-produto': 'sales',
    '/admin/compras/por-produto': 'purchases',
    '/admin/compras/fornecedores': 'purchases',
    '/admin/produtos/categorias': 'products',
    '/admin/produtos/unidades': 'products',
    '/admin/produtos/etiquetas': 'products',
    '/admin/stock/movimentos': 'stock-management',
    '/admin/stock/alertas': 'stock-management',
    '/admin/stock/ajustes': 'stock-management',
    '/admin/stock/lotes': 'stock-management',
    '/admin/stock/auditoria': 'stock-management',
    '/admin/usuarios/roles': 'users',
  };

  // Verificar sub-rotas primeiro
  for (const [subPath, pageId] of Object.entries(subRouteMap)) {
    if (normalizedPath === subPath || normalizedPath.startsWith(subPath + '/')) {
      return pageId;
    }
  }

  // Buscar no mapeamento: paths mais longos primeiro para que
  // '/admin/vendas' case com 'sales' e não com 'dashboard' (/admin)
  const entries = Object.entries(ADMIN_ROUTE_MAP).sort(([, a], [, b]) => b.length - a.length);
  for (const [pageId, path] of entries) {
    if (normalizedPath === path || normalizedPath.startsWith(path + '/')) {
      // Retornar o pageId principal (sem sufixo como -list, -summaries)
      const mainPageId = pageId.split('-')[0];
      // Mapear de volta para IDs conhecidos
      const knownIds = ['dashboard', 'orders', 'sales', 'caixa', 'customers', 'products', 'purchases', 'stock-management', 'media', 'tracking', 'users', 'profile'];
      if (knownIds.includes(pageId)) {
        return pageId;
      }
      // Para sub-páginas, retornar o ID pai
      if (pageId.includes('-')) {
        const parentMap: Record<string, string> = {
          'sales-orders': 'sales',
          'sales-customers': 'sales',
          'sales-summaries': 'sales',
          'sales-by-product': 'sales',
          'products-list': 'products',
          'products-categories': 'products',
          'products-units': 'products',
          'products-labels': 'products',
          'purchases-list': 'purchases',
          'purchases-by-product': 'purchases',
          'purchases-suppliers': 'purchases',
          'stock-products': 'stock-management',
          'stock-movements': 'stock-management',
          'stock-alerts': 'stock-management',
          'stock-adjustments': 'stock-management',
          'stock-lots': 'stock-management',
          'stock-audit': 'stock-management',
          'users-list': 'users',
          'users-roles': 'users',
        };
        return parentMap[pageId] || pageId;
      }
      return pageId;
    }
  }

  return 'dashboard';
};
