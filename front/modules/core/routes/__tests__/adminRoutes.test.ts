import { describe, it, expect } from 'vitest';
import {
  ADMIN_ROUTE_MAP,
  getAdminPath,
  getActivePageFromPath,
} from '../adminRoutes';

describe('adminRoutes', () => {
  describe('ADMIN_ROUTE_MAP', () => {
    it('contém mapeamento para dashboard', () => {
      expect(ADMIN_ROUTE_MAP['dashboard']).toBe('/admin');
    });

    it('contém mapeamento para orders', () => {
      expect(ADMIN_ROUTE_MAP['orders']).toBe('/admin/pedidos');
    });

    it('contém mapeamento para sales, customers, products', () => {
      expect(ADMIN_ROUTE_MAP['sales']).toBe('/admin/vendas');
      expect(ADMIN_ROUTE_MAP['customers']).toBe('/admin/clientes');
      expect(ADMIN_ROUTE_MAP['products']).toBe('/admin/produtos');
    });
  });

  describe('getAdminPath', () => {
    it('retorna path para pageId conhecido', () => {
      expect(getAdminPath('dashboard')).toBe('/admin');
      expect(getAdminPath('orders')).toBe('/admin/pedidos');
      expect(getAdminPath('sales')).toBe('/admin/vendas');
    });

    it('retorna /admin para pageId desconhecido', () => {
      expect(getAdminPath('unknown-page')).toBe('/admin');
      expect(getAdminPath('')).toBe('/admin');
    });
  });

  describe('getActivePageFromPath', () => {
    it('retorna dashboard para /admin e /admin/', () => {
      expect(getActivePageFromPath('/admin')).toBe('dashboard');
      expect(getActivePageFromPath('/admin/')).toBe('dashboard');
    });

    it('retorna pageId correto para paths admin', () => {
      expect(getActivePageFromPath('/admin/pedidos')).toBe('orders');
      expect(getActivePageFromPath('/admin/vendas')).toBe('sales');
      expect(getActivePageFromPath('/admin/clientes')).toBe('customers');
      expect(getActivePageFromPath('/admin/produtos')).toBe('products');
      expect(getActivePageFromPath('/admin/compras')).toBe('purchases');
      expect(getActivePageFromPath('/admin/stock')).toBe('stock-management');
      expect(getActivePageFromPath('/admin/galeria')).toBe('media');
      expect(getActivePageFromPath('/admin/estatisticas')).toBe('tracking');
      expect(getActivePageFromPath('/admin/series')).toBe('series-management');
      expect(getActivePageFromPath('/admin/usuarios')).toBe('users');
      expect(getActivePageFromPath('/admin/perfis')).toBe('profile');
    });

    it('retorna dashboard para path desconhecido em /admin', () => {
      expect(getActivePageFromPath('/admin/xyz')).toBe('dashboard');
    });

    it('retorna dashboard para /admin/dividas (rota removida)', () => {
      expect(getActivePageFromPath('/admin/dividas')).toBe('dashboard');
    });

    it('normaliza path com barra final (exceto /admin/)', () => {
      expect(getActivePageFromPath('/admin/pedidos/')).toBe('orders');
    });
  });
});
