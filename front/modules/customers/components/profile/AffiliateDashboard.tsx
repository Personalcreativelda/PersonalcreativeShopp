import React from 'react';
import { AffiliateProgram } from '../../../core/types/types';
import { Share2, Copy, Check, TrendingUp, Users, DollarSign, MousePointerClick, Download } from 'lucide-react';
import { StatsCard } from './StatsCard';

interface AffiliateDashboardProps {
 affiliateData: AffiliateProgram;
 onCopyLink: () => void;
 linkCopied: boolean;
}

export const AffiliateDashboard: React.FC<AffiliateDashboardProps> = ({
 affiliateData,
 onCopyLink,
 linkCopied
}) => {
 const stats = [
 {
 label: 'Total de Ganhos',
 value: `${affiliateData.totalEarnings.toFixed(2)} MT`,
 icon: DollarSign,
 color: 'text-green-600'
 },
 {
 label: 'Referências',
 value: affiliateData.totalReferrals.toString(),
 icon: Users,
 color: 'text-blue-600'
 },
 {
 label: 'Converséµes',
 value: affiliateData.totalConversions.toString(),
 icon: TrendingUp,
 color: 'text-purple-600'
 },
 {
 label: 'Taxa de Conversão',
 value: `${affiliateData.conversionRate.toFixed(1)}%`,
 icon: MousePointerClick,
 color: 'text-yellow-600'
 }
 ];

 return (
 <div className="space-y-8 animate-fadeIn">
 {/* Link de Afiliado */}
 <div className="bg-surface-raised rounded-2xl shadow-xl p-8 border border-border-default">
 <div className="flex items-center space-x-3 mb-6">
 <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
 <Share2 className="w-6 h-6 text-white" />
 </div>
 <h2 className="text-2xl font-bold text-content-primary">Seu Link de Afiliado</h2>
 </div>
 <div className="space-y-4">
 <div className="flex items-center space-x-3">
 <div className="flex-1 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-border-default">
 <p className="text-sm font-medium text-content-secondary mb-2">Cé³digo de Afiliado:</p>
 <p className="font-mono font-bold text-xl text-content-primary">{affiliateData.affiliateCode}</p>
 </div>
 <button
 onClick={onCopyLink}
 className={`p-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 ${
 linkCopied
 ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
 : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
 }`}
 >
 {linkCopied ? (
 <div className="flex items-center space-x-2">
 <Check className="w-5 h-5" />
 <span>Copiado!</span>
 </div>
 ) : (
 <div className="flex items-center space-x-2">
 <Copy className="w-5 h-5" />
 <span>Copiar</span>
 </div>
 )}
 </button>
 </div>
 <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
 <p className="text-sm font-medium text-content-secondary mb-2">Link Completo:</p>
 <p className="font-mono text-sm break-all text-content-primary">{affiliateData.affiliateLink}</p>
 </div>
 <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
 <p className="text-sm text-green-800 dark:text-green-300">
 ðŸ’¡ <strong>Dica:</strong> Partilhe este link e ganhe comisséµes quando algué©m fizer uma compra atravé©s dele!
 </p>
 </div>
 </div>
 </div>

 {/* Estaté­sticas com Gradientes */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <StatsCard
 label="Total de Ganhos"
 value={`${affiliateData.totalEarnings.toFixed(2)} MT`}
 icon={DollarSign}
 gradient="green"
 />
 <StatsCard
 label="Referências"
 value={affiliateData.totalReferrals.toString()}
 icon={Users}
 gradient="blue"
 />
 <StatsCard
 label="Converséµes"
 value={affiliateData.totalConversions.toString()}
 icon={TrendingUp}
 gradient="purple"
 />
 <StatsCard
 label="Taxa de Conversão"
 value={`${affiliateData.conversionRate.toFixed(1)}%`}
 icon={MousePointerClick}
 gradient="yellow"
 />
 </div>

 {/* Comisséµes */}
 <div className="bg-surface-raised rounded-2xl shadow-xl p-8 border border-border-default">
 <div className="flex items-center space-x-3 mb-6">
 <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
 <DollarSign className="w-6 h-6 text-white" />
 </div>
 <h3 className="text-2xl font-bold text-content-primary">Estrutura de Comisséµes</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border-2 border-green-200 dark:border-green-800 hover:scale-105 transition-transform">
 <div className="flex items-center justify-between mb-2">
 <span className="font-semibold text-content-primary">Nível 1 (Direto)</span>
 </div>
 <p className="text-3xl font-bold text-green-600 dark:text-green-400">{affiliateData.commissionRateLevel1}%</p>
 <p className="text-xs text-content-secondary mt-2">Comissão direta</p>
 </div>
 <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:scale-105 transition-transform">
 <div className="flex items-center justify-between mb-2">
 <span className="font-semibold text-content-primary">Nível 2 (Indireto)</span>
 </div>
 <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{affiliateData.commissionRateLevel2}%</p>
 <p className="text-xs text-content-secondary mt-2">Comissão indireta</p>
 </div>
 <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border-2 border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform">
 <div className="flex items-center justify-between mb-2">
 <span className="font-semibold text-content-primary">Recorrentes</span>
 </div>
 <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{affiliateData.commissionRateRecurring}%</p>
 <p className="text-xs text-content-secondary mt-2">Compras recorrentes</p>
 </div>
 </div>
 </div>

 {/* Materiais */}
 <div className="bg-surface-raised rounded-2xl shadow-xl p-8 border border-border-default">
 <div className="flex items-center space-x-3 mb-4">
 <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
 <Download className="w-6 h-6 text-white" />
 </div>
 <h3 className="text-2xl font-bold text-content-primary">Materiais de Marketing</h3>
 </div>
 <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border border-orange-200 dark:border-orange-800">
 <p className="text-content-secondary">
 Os materiais de marketing estaréo disponé­veis em breve. Use seu link de afiliado para partilhar e começar a ganhar comisséµes!
 </p>
 </div>
 </div>
 </div>
 );
};


