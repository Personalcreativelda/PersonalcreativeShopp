import React, { useMemo } from 'react';
import { CustomerInsight } from '../../../core/types/types';
import { 
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
 LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart 
} from 'recharts';
import { TrendingUp, ShoppingBag, Calendar, Award } from 'lucide-react';
import { StatsCard } from './StatsCard';

interface InsightsChartProps {
 insights: CustomerInsight[];
 customer?: any;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export const InsightsChart: React.FC<InsightsChartProps> = ({ insights, customer }) => {
 const purchaseFrequency = insights.find(i => i.insightType === 'purchase_frequency');
 const avgOrderValue = insights.find(i => i.insightType === 'avg_order_value');
 const lifetimeValue = insights.find(i => i.insightType === 'lifetime_value');

 // Dados simulados para gráficos (em produção, viriam do backend)
 const monthlyData = useMemo(() => {
 const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
 return months.map(month => ({
 month,
 valor: Math.floor(Math.random() * 5000) + 1000,
 pedidos: Math.floor(Math.random() * 10) + 1
 }));
 }, []);

 const categoryData = useMemo(() => {
 return [
 { name: 'Frutas', value: 35 },
 { name: 'Verduras', value: 25 },
 { name: 'Produtos Lácteos', value: 20 },
 { name: 'Outros', value: 20 }
 ];
 }, []);

 return (
 <div className="space-y-8">
 {/* Stats Cards com gradientes */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <StatsCard
 label="Frequência de Compras"
 value={purchaseFrequency?.value ? `${purchaseFrequency.value} dias` : 'N/A'}
 icon={Calendar}
 gradient="blue"
 />
 <StatsCard
 label="Valor Médio por Pedido"
 value={avgOrderValue?.value ? `${avgOrderValue.value.toFixed(2)} MT` : 'N/A'}
 icon={ShoppingBag}
 gradient="green"
 />
 <StatsCard
 label="Valor Total do Cliente"
 value={lifetimeValue?.value ? `${lifetimeValue.value.toFixed(2)} MT` : customer?.totalSpent?.toFixed(2) + ' MT' || '0.00 MT'}
 icon={TrendingUp}
 gradient="purple"
 />
 <StatsCard
 label="Total de Pedidos"
 value={customer?.totalOrders || 0}
 icon={Award}
 gradient="yellow"
 />
 </div>

 {/* Gráfico de Evolução Mensal */}
 <div className="bg-surface-raised rounded-2xl shadow-lg p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h3 className="text-xl font-bold text-content-primary mb-1">
 Evolução de Compras
 </h3>
 <p className="text-sm text-content-secondary">
 Valor gasto e número de pedidos por mês
 </p>
 </div>
 <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
 <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
 </div>
 </div>
 <div className="h-80">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={monthlyData}>
 <defs>
 <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 <linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
 <XAxis 
 dataKey="month" 
 className="text-xs"
 tick={{ fill: '#6b7280' }}
 />
 <YAxis 
 yAxisId="left"
 className="text-xs"
 tick={{ fill: '#6b7280' }}
 />
 <YAxis 
 yAxisId="right"
 orientation="right"
 className="text-xs"
 tick={{ fill: '#6b7280' }}
 />
 <Tooltip 
 contentStyle={{
 backgroundColor: '#1f2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 />
 <Area
 yAxisId="left"
 type="monotone"
 dataKey="valor"
 stroke="#10b981"
 strokeWidth={3}
 fill="url(#colorValor)"
 name="Valor (MT)"
 />
 <Line
 yAxisId="right"
 type="monotone"
 dataKey="pedidos"
 stroke="#3b82f6"
 strokeWidth={3}
 dot={{ fill: '#3b82f6', r: 4 }}
 name="Pedidos"
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Gráficos lado a lado */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Gráfico de Barras - Valor por Mês */}
 <div className="bg-surface-raised rounded-2xl shadow-lg p-6">
 <h3 className="text-lg font-bold text-content-primary mb-6">
 Valor Gasto Mensal
 </h3>
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyData}>
 <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
 <XAxis 
 dataKey="month" 
 className="text-xs"
 tick={{ fill: '#6b7280' }}
 />
 <YAxis 
 className="text-xs"
 tick={{ fill: '#6b7280' }}
 />
 <Tooltip 
 contentStyle={{
 backgroundColor: '#1f2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 formatter={(value: any) => [`${value} MT`, 'Valor']}
 />
 <Bar dataKey="valor" fill="#10b981" radius={[8, 8, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Gráfico de Pizza - Categorias */}
 <div className="bg-surface-raised rounded-2xl shadow-lg p-6">
 <h3 className="text-lg font-bold text-content-primary mb-6">
 Distribuição por Categoria
 </h3>
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={categoryData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
 outerRadius={80}
 fill="#8884d8"
 dataKey="value"
 >
 {categoryData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip 
 contentStyle={{
 backgroundColor: '#1f2937',
 border: 'none',
 borderRadius: '8px',
 color: '#fff'
 }}
 />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </div>
 </div>
 </div>
 );
};


