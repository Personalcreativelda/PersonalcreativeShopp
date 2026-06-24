/**
 * Hook que centraliza todos os handlers de CRUD do App.
 * Recebe estado e setters do App e devolve um objeto com os handlers.
 * Reduz a complexidade do App.tsx e torna a lógica testável.
 */

import { useCallback } from 'react';
import { dataService } from '../services/dataService';
import type {
  Order,
  OrderStatus,
  Customer,
  Sale,
  Purchase,
  PurchaseRequest,
  Supplier
} from '../types/types';
import type { UseOperationProgressReturn } from './useOperationProgress';

export interface AppDataHandlersInput {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  products: import('../types/types').Product[];
  setProducts: React.Dispatch<React.SetStateAction<import('../types/types').Product[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  purchaseRequests: PurchaseRequest[];
  setPurchaseRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  loadData: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  operationProgress?: UseOperationProgressReturn;
}

export interface AppDataHandlersReturn {
  handleAddOrder: (newOrder: Order) => Promise<void>;
  handleUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  handleDeleteOrder: (orderId: string) => Promise<void>;
  handleBulkDeleteOrders: (orderIds: string[]) => Promise<void>;
  handleEditOrder: (updatedOrder: Order) => Promise<void>;
  handleDeleteCustomer: (customerId: string) => Promise<void>;
  handleBulkDeleteCustomers: (customerIds: string[]) => Promise<void>;
  handleUpdateCustomer: (updatedCustomer: Customer) => Promise<void>;
  handleAddSale: (newSale: Sale) => Promise<void>;
  handleUpdateSale: (updatedSale: Sale) => Promise<void>;
  handleDeleteSale: (saleId: string) => Promise<void>;
  handleBulkDeleteSales: (saleIds: string[]) => Promise<void>;
  handleAddPurchase: (newPurchase: Purchase) => Promise<void>;
  handleUpdatePurchase: (updatedPurchase: Purchase) => Promise<void>;
  handleDeletePurchase: (purchaseId: string) => Promise<void>;
  handleAddPurchaseRequest: (newRequest: PurchaseRequest) => Promise<void>;
  handleUpdatePurchaseRequest: (updatedRequest: PurchaseRequest) => Promise<void>;
  handleDeletePurchaseRequest: (requestId: string) => Promise<void>;
  handleAddSupplier: (newSupplier: Supplier) => Promise<void>;
  handleUpdateSupplier: (updatedSupplier: Supplier) => Promise<void>;
  handleDeleteSupplier: (supplierId: string) => Promise<void>;
}

export function useAppDataHandlers(input: AppDataHandlersInput): AppDataHandlersReturn {
  const {
    orders,
    setOrders,
    customers,
    setCustomers,
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
  } = input;

  const handleAddOrder = useCallback(async (newOrder: Order) => {
    if (!newOrder.customerName || newOrder.customerName.trim() === '') {
      showToast('Nome do cliente é obrigatório', 'error');
      return;
    }
    if (!newOrder.items || newOrder.items.length === 0) {
      showToast('Adicione pelo menos um item ao pedido', 'error');
      return;
    }
    if (newOrder.totalAmount <= 0) {
      showToast('O valor total do pedido deve ser maior que zero', 'error');
      return;
    }
    const result = await dataService.createOrder(newOrder);
    if (result.order) {
      setOrders(prev => [result.order!, ...prev]);
      const updatedCustomers = await dataService.getCustomers();
      setCustomers(updatedCustomers);
      showToast(`Pedido de ${newOrder.customerName} criado com sucesso!`, 'success');
    } else {
      showToast('Erro ao criar pedido. Verifique os dados e tente novamente.', 'error', 7000);
      throw new Error(result.error || 'Erro ao criar pedido');
    }
  }, [setOrders, setCustomers, showToast]);

  const handleUpdateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const success = await dataService.updateOrderStatus(orderId, status);
    if (success) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    }
  }, [setOrders]);

  const handleDeleteOrder = useCallback(async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    showToast('Pedido removido...', 'info', 2000);
    const result = await dataService.deleteOrder(orderId);
    if (!result.success) {
      if (orderToDelete) {
        setOrders(prev => [...prev, orderToDelete].sort((a, b) =>
          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
        ));
      }
      showToast(`Erro ao apagar: ${result.error || 'Erro desconhecido'}. Verifique as permissões nas configurações.`, 'error', 8000);
    } else {
      showToast('Pedido apagado com sucesso', 'success');
    }
  }, [orders, setOrders, showToast]);

  const handleBulkDeleteOrders = useCallback(async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    const ordersToDelete = orders.filter(o => orderIds.includes(o.id));
    setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
    showToast(`Removendo ${orderIds.length} pedidos...`, 'info', 2000);
    const result = await dataService.deleteOrders(orderIds);
    if (!result.success || result.errors.length > 0) {
      setOrders(prev => [...prev, ...ordersToDelete].sort((a, b) =>
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      ));
      const failedCount = orderIds.length - (result.deleted || 0);
      const errorMsg = result.errors.length > 0 ? result.errors[0] : 'Erro desconhecido ao apagar pedidos.';
      showToast(`Erro ao apagar ${failedCount} pedidos: ${errorMsg}. Verifique as permissões nas configurações.`, 'error', 8000);
    } else if (result.deleted && result.deleted > 0) {
      showToast(`${result.deleted} pedido(s) apagado(s) com sucesso`, 'success');
    }
  }, [orders, setOrders, showToast]);

  const handleEditOrder = useCallback(async (updatedOrder: Order) => {
    if (!updatedOrder.customerName || updatedOrder.customerName.trim() === '') {
      showToast('Nome do cliente é obrigatório', 'error');
      return;
    }
    if (!updatedOrder.items || updatedOrder.items.length === 0) {
      showToast('Adicione pelo menos um item ao pedido', 'error');
      return;
    }
    if (updatedOrder.totalAmount <= 0) {
      showToast('O valor total do pedido deve ser maior que zero', 'error');
      return;
    }
    const success = await dataService.updateOrder(updatedOrder.id, updatedOrder);
    if (success) {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      showToast('Pedido atualizado com sucesso', 'success');
      try {
        const updatedSales = await dataService.getSales();
        setSales(updatedSales);
      } catch {
        // ignore
      }
    } else {
      showToast('Erro ao atualizar pedido. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setOrders, setSales, showToast]);

  const handleDeleteCustomer = useCallback(async (customerId: string) => {
    const customerToDelete = customers.find(c => c.id === customerId);
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    setOrders(prev => prev.filter(o => o.customerId !== customerId));
    showToast('Cliente removido...', 'info', 2000);
    const success = await dataService.deleteCustomer(customerId);
    if (!success) {
      if (customerToDelete) setCustomers(prev => [...prev, customerToDelete]);
      showToast('Erro ao apagar cliente. Verifique as permissões nas configurações.', 'error', 8000);
    } else {
      showToast('Cliente apagado com sucesso', 'success');
    }
  }, [customers, setCustomers, setOrders, showToast]);

  const handleBulkDeleteCustomers = useCallback(async (customerIds: string[]) => {
    const customersToDelete = customers.filter(c => customerIds.includes(c.id));
    setCustomers(prev => prev.filter(c => !customerIds.includes(c.id)));
    setOrders(prev => prev.filter(o => !customerIds.includes(o.customerId!)));
    showToast(`Removendo ${customerIds.length} cliente(s)...`, 'info', 2000);
    const success = await dataService.deleteCustomers(customerIds);
    if (!success) {
      setCustomers(prev => [...prev, ...customersToDelete]);
      showToast('Erro ao apagar clientes. Verifique as permissões nas configurações.', 'error', 8000);
    } else {
      showToast(`${customerIds.length} cliente(s) apagado(s) com sucesso`, 'success');
    }
  }, [customers, setCustomers, setOrders, showToast]);

  const handleUpdateCustomer = useCallback(async (updatedCustomer: Customer) => {
    const success = await dataService.updateCustomer(updatedCustomer.id, updatedCustomer);
    if (success) {
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      showToast('Cliente atualizado com sucesso', 'success');
    } else {
      showToast('Erro ao atualizar cliente. Verifique os dados e tente novamente.', 'error', 7000);
      loadData();
    }
  }, [setCustomers, showToast, loadData]);

  const handleAddSale = useCallback(async (newSale: Sale) => {
    if (!newSale.items || newSale.items.length === 0) {
      showToast('Adicione pelo menos um item à venda', 'error');
      return;
    }
    if (newSale.totalSales <= 0) {
      showToast('O valor total de vendas deve ser maior que zero', 'error');
      return;
    }
    try {
      const existingSale = await dataService.getSaleByDate(newSale.date);
      if (existingSale) {
        const updatedSale: Sale = {
          ...existingSale,
          items: newSale.items,
          totalSales: newSale.totalSales,
          totalDeliveries: newSale.totalDeliveries,
          valueReceived: existingSale.valueReceived !== undefined ? existingSale.valueReceived : newSale.valueReceived,
          difference: existingSale.valueReceived !== undefined
            ? existingSale.valueReceived - (newSale.totalSales + newSale.totalDeliveries)
            : newSale.difference,
          notes: existingSale.notes && !existingSale.notes.includes('Gerado automaticamente') && !existingSale.notes.includes('Gerado a partir de')
            ? existingSale.notes
            : newSale.notes
        };
        const success = await dataService.updateSale(existingSale.id, updatedSale);
        if (success) {
          await loadData();
          showToast('Resumo existente atualizado com sucesso!', 'success');
        } else {
          showToast('Erro ao atualizar resumo existente. Verifique os dados e tente novamente.', 'error', 7000);
        }
        return;
      }
    } catch {
      // continue with create
    }
    const result = await dataService.createSale(newSale);
    if (result.sale) {
      setSales(prev => [result.sale!, ...prev]);
      showToast('Resumo de venda criado com sucesso!', 'success');
    } else {
      showToast('Erro ao criar resumo de venda. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setSales, loadData, showToast]);

  const handleUpdateSale = useCallback(async (updatedSale: Sale) => {
    if (!updatedSale.items || updatedSale.items.length === 0) {
      showToast('Adicione pelo menos um item à venda', 'error');
      return;
    }
    if (updatedSale.totalSales <= 0) {
      showToast('O valor total de vendas deve ser maior que zero', 'error');
      return;
    }
    const success = await dataService.updateSale(updatedSale.id, updatedSale);
    if (success) {
      setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
      showToast('Resumo de venda atualizado com sucesso', 'success');
    } else {
      showToast('Erro ao atualizar resumo de venda. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setSales, showToast]);

  const handleDeleteSale = useCallback(async (saleId: string) => {
    const saleToDelete = sales.find(s => s.id === saleId);
    setSales(prev => prev.filter(s => s.id !== saleId));
    showToast('Resumo de venda removido...', 'info', 2000);
    const result = await dataService.deleteSale(saleId);
    if (!result.success) {
      if (saleToDelete) {
        setSales(prev => [...prev, saleToDelete].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ));
      }
      showToast('Erro ao apagar resumo de venda. Verifique as permissões nas configurações.', 'error', 8000);
    } else {
      showToast('Resumo de venda apagado com sucesso', 'success');
    }
  }, [sales, setSales, showToast]);

  const handleBulkDeleteSales = useCallback(async (saleIds: string[]) => {
    if (saleIds.length === 0) return;
    const salesToDelete = sales.filter(s => saleIds.includes(s.id));
    setSales(prev => prev.filter(s => !saleIds.includes(s.id)));
    showToast(`Removendo ${saleIds.length} resumo(s) de venda...`, 'info', 2000);
    const result = await dataService.deleteSales(saleIds);
    if (!result.success || result.errors.length > 0) {
      setSales(prev => [...prev, ...salesToDelete].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      const failedCount = saleIds.length - (result.deleted || 0);
      const errorMsg = result.errors.length > 0 ? result.errors[0] : 'Erro desconhecido ao apagar resumos de venda.';
      showToast(`Erro ao apagar ${failedCount} resumo(s) de venda: ${errorMsg}. Verifique as permissões nas configurações.`, 'error', 8000);
    } else if (result.deleted && result.deleted > 0) {
      showToast(`${result.deleted} resumo(s) de venda apagado(s) com sucesso`, 'success');
    }
  }, [sales, setSales, showToast]);

  const handleAddPurchase = useCallback(async (newPurchase: Purchase) => {
    if (!newPurchase.items || newPurchase.items.length === 0) {
      showToast('Adicione pelo menos um item à compra', 'error');
      return;
    }
    
    // Usar overlay de progresso se disponível
    operationProgress?.startOperation(
      'A criar compra',
      `A processar ${newPurchase.items.length} item(s) e atualizar stock...`
    );
    
    try {
      const result = await dataService.createPurchase(newPurchase, true);
      if (result.purchase) {
        setPurchases(prev => [result.purchase!, ...prev]);
        showToast('Compra criada com sucesso! Stock atualizado automaticamente.', 'success');
        setTimeout(() => {
          loadData();
          window.dispatchEvent(new CustomEvent('products-updated'));
        }, 1000);
      } else {
        showToast(`Erro ao criar compra: ${result.error || 'Erro desconhecido'}`, 'error', 7000);
      }
    } finally {
      operationProgress?.endOperation();
    }
  }, [setPurchases, loadData, showToast, operationProgress]);

  const handleUpdatePurchase = useCallback(async (updatedPurchase: Purchase) => {
    // Usar overlay de progresso para operação crítica
    operationProgress?.startOperation(
      'A atualizar compra',
      'A verificar alterações e processar...'
    );
    
    try {
      const success = await dataService.updatePurchase(updatedPurchase.id, updatedPurchase, true);
      if (success) {
        setPurchases(prev => prev.map(p => p.id === updatedPurchase.id ? updatedPurchase : p));
        showToast('Compra atualizada com sucesso!', 'success');
        setTimeout(() => {
          loadData();
          window.dispatchEvent(new CustomEvent('products-updated'));
        }, 1000);
      } else {
        showToast('Erro ao atualizar compra. Verifique os dados e tente novamente.', 'error', 7000);
      }
    } finally {
      operationProgress?.endOperation();
    }
  }, [setPurchases, loadData, showToast, operationProgress]);

  const handleDeletePurchase = useCallback(async (purchaseId: string) => {
    const purchaseToDelete = purchases.find(p => p.id === purchaseId);
    
    // Usar overlay de progresso para operação crítica
    operationProgress?.startOperation(
      'A apagar compra',
      'A reverter stock e remover transações...'
    );
    
    try {
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      const success = await dataService.deletePurchase(purchaseId, true);
      if (!success) {
        if (purchaseToDelete) setPurchases(prev => [...prev, purchaseToDelete]);
        showToast('Erro ao apagar compra. Verifique as permissões nas configurações.', 'error', 8000);
      } else {
        showToast('Compra apagada com sucesso! Stock revertido automaticamente.', 'success');
        setTimeout(() => {
          loadData();
          window.dispatchEvent(new CustomEvent('products-updated'));
        }, 1000);
      }
    } finally {
      operationProgress?.endOperation();
    }
  }, [purchases, setPurchases, loadData, showToast, operationProgress]);

  const handleAddPurchaseRequest = useCallback(async (newRequest: PurchaseRequest) => {
    const result = await dataService.createPurchaseRequest(newRequest);
    if (result && result.purchaseRequest && !result.error && result.purchaseRequest.id) {
      setPurchaseRequests(prev => [result.purchaseRequest as PurchaseRequest, ...prev]);
      showToast('Pedido de compra criado com sucesso!', 'success');
    } else {
      showToast(result?.error || 'Erro ao criar pedido de compra. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setPurchaseRequests, showToast]);

  const handleUpdatePurchaseRequest = useCallback(async (updatedRequest: PurchaseRequest) => {
    const success = await dataService.updatePurchaseRequest(updatedRequest.id, updatedRequest);
    if (success) {
      setPurchaseRequests(prev => prev.map(pr => pr.id === updatedRequest.id ? updatedRequest : pr));
      showToast('Pedido de compra atualizado com sucesso', 'success');
    } else {
      showToast('Erro ao atualizar pedido de compra. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setPurchaseRequests, showToast]);

  const handleDeletePurchaseRequest = useCallback(async (requestId: string) => {
    const requestToDelete = purchaseRequests.find(pr => pr.id === requestId);
    setPurchaseRequests(prev => prev.filter(pr => pr.id !== requestId));
    showToast('Pedido de compra removido...', 'info', 2000);
    const success = await dataService.deletePurchaseRequest(requestId);
    if (!success) {
      if (requestToDelete) setPurchaseRequests(prev => [...prev, requestToDelete]);
      showToast('Erro ao apagar pedido de compra. Verifique as permissões nas configurações.', 'error', 8000);
    } else {
      showToast('Pedido de compra apagado com sucesso', 'success');
    }
  }, [purchaseRequests, setPurchaseRequests, showToast]);

  const handleAddSupplier = useCallback(async (newSupplier: Supplier) => {
    const result = await dataService.createSupplier(newSupplier);
    if (result && result.supplier && !result.error && result.supplier.id) {
      setSuppliers(prev => [result.supplier as Supplier, ...prev]);
      showToast('Fornecedor criado com sucesso!', 'success');
    } else {
      showToast(result?.error || 'Erro ao criar fornecedor. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setSuppliers, showToast]);

  const handleUpdateSupplier = useCallback(async (updatedSupplier: Supplier) => {
    const success = await dataService.updateSupplier(updatedSupplier.id, updatedSupplier);
    if (success) {
      setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
      showToast('Fornecedor atualizado com sucesso', 'success');
    } else {
      showToast('Erro ao atualizar fornecedor. Verifique os dados e tente novamente.', 'error', 7000);
    }
  }, [setSuppliers, showToast]);

  const handleDeleteSupplier = useCallback(async (supplierId: string) => {
    const supplierToDelete = suppliers.find(s => s.id === supplierId);
    setSuppliers(prev => prev.filter(s => s.id !== supplierId));
    showToast('Fornecedor removido...', 'info', 2000);
    const success = await dataService.deleteSupplier(supplierId);
    if (!success) {
      if (supplierToDelete) setSuppliers(prev => [...prev, supplierToDelete]);
      showToast('Erro ao apagar fornecedor. Verifique as permissões nas configurações.', 'error', 8000);
    } else {
      showToast('Fornecedor apagado com sucesso', 'success');
    }
  }, [suppliers, setSuppliers, showToast]);

  return {
    handleAddOrder,
    handleUpdateOrderStatus,
    handleDeleteOrder,
    handleBulkDeleteOrders,
    handleEditOrder,
    handleDeleteCustomer,
    handleBulkDeleteCustomers,
    handleUpdateCustomer,
    handleAddSale,
    handleUpdateSale,
    handleDeleteSale,
    handleBulkDeleteSales,
    handleAddPurchase,
    handleUpdatePurchase,
    handleDeletePurchase,
    handleAddPurchaseRequest,
    handleUpdatePurchaseRequest,
    handleDeletePurchaseRequest,
    handleAddSupplier,
    handleUpdateSupplier,
    handleDeleteSupplier
  };
}
