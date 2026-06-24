import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Loader2, ChevronLeft } from 'lucide-react';
import api from '../../core/services/apiClient';
import { Order } from '../../core/types/order';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending:          { label: 'Pendente',          className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  processing:       { label: 'Em Processamento',  className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  out_for_delivery: { label: 'A Caminho',         className: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
  delivered:        { label: 'Entregue',           className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  completed:        { label: 'Concluído',          className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  cancelled:        { label: 'Cancelado',          className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

export const CustomerOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Order[]>('/orders/my-orders')
      .then(setOrders)
      .catch(() => setError('Erro ao carregar encomendas'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface-base py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/minha-conta')} className="p-2 rounded-lg hover:bg-surface-overlay transition-colors text-content-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-content-primary">As Minhas Encomendas</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-content-muted" /></div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-content-muted">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ainda não fizeste nenhuma encomenda.</p>
            <button onClick={() => navigate('/loja')} className="mt-4 text-green-600 hover:underline text-sm">Ir para a loja</button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const s = STATUS_LABEL[o.status] || { label: o.status, className: 'bg-gray-100 text-gray-600' };
              return (
                <button
                  key={o.id}
                  onClick={() => navigate(`/minha-conta/encomendas/${o.id}`)}
                  className="w-full bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default hover:border-green-500 dark:hover:border-green-600 transition-colors text-left flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-content-primary">Pedido #{o.orderNumber || o.id.slice(0,8)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-content-muted">
                      {new Date(o.createdAt).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-content-muted mt-1 truncate">
                      {Array.isArray(o.items) ? o.items.map((i: any) => i.productName).join(', ') : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-content-primary">{o.totalAmount?.toFixed(2)} MT</p>
                    <ChevronRight className="w-4 h-4 text-content-muted ml-auto mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOrders;
