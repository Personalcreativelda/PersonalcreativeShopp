import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { CustomerAction } from '../../../core/types/types';

interface PointsChartProps {
 actions: CustomerAction[];
 currentPoints: number;
}

export const PointsChart: React.FC<PointsChartProps> = ({ actions, currentPoints }) => {
 const chartData = useMemo(() => {
 if (actions.length === 0) {
 // Retornar dados vazios com ponto inicial
 return [{ date: new Date().toLocaleDateString('pt-MZ', { month: 'short', day: 'numeric' }), points: 0 }];
 }

 // Agrupar por data e somar pontos
 const pointsByDate = new Map<string, number>();
 let runningTotal = 0;

 actions
 .slice()
 .reverse() // Do mais antigo para o mais recente
 .forEach(action => {
 const date = new Date(action.createdAt).toLocaleDateString('pt-MZ', { month: 'short', day: 'numeric' });
 runningTotal += action.pointsEarned;
 pointsByDate.set(date, runningTotal);
 });

 // Converter para array e adicionar ponto atual
 const data = Array.from(pointsByDate.entries()).map(([date, points]) => ({
 date,
 points: Math.round(points)
 }));

 // Adicionar ponto atual se não estiver na lista
 if (data.length > 0 && data[data.length - 1].points !== currentPoints) {
 data.push({
 date: 'Agora',
 points: currentPoints
 });
 }

 return data.length > 0 ? data : [{ date: 'Agora', points: currentPoints }];
 }, [actions, currentPoints]);

 return (
 <div className="bg-surface-raised rounded-2xl shadow-lg p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h3 className="text-lg font-bold text-content-primary mb-1">
 Evolução de Pontos
 </h3>
 <p className="text-sm text-content-secondary">
 Seu progresso ao longo do tempo
 </p>
 </div>
 <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
 <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
 </div>
 </div>

 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chartData}>
 <defs>
 <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
 <XAxis 
 dataKey="date" 
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
 formatter={(value: any) => [`${value} pontos`, 'Pontos']}
 />
 <Area
 type="monotone"
 dataKey="points"
 stroke="#10b981"
 strokeWidth={3}
 fill="url(#colorPoints)"
 dot={{ fill: '#10b981', r: 4 }}
 activeDot={{ r: 6 }}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 );
};


