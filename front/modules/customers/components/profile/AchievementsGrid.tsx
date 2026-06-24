import React from 'react';
import { CustomerAchievement } from '../../../core/types/types';
import { Award, Star, Trophy, Target, Share2, TrendingUp } from 'lucide-react';

interface AchievementsGridProps {
 achievements: CustomerAchievement[];
}

const getAchievementIcon = (type: string) => {
 switch (type) {
 case 'first_purchase':
 return <Star className="w-full h-full text-yellow-500" />;
 case 'loyal_customer':
 return <Award className="w-full h-full text-blue-500" />;
 case 'big_spender':
 return <TrendingUp className="w-full h-full text-green-500" />;
 case 'social_butterfly':
 return <Share2 className="w-full h-full text-purple-500" />;
 case 'reviewer_expert':
 return <Target className="w-full h-full text-red-500" />;
 default:
 return <Trophy className="w-full h-full text-content-muted" />;
 }
};

const getAchievementLabel = (type: string) => {
 const labels: Record<string, string> = {
 first_purchase: 'Primeira Compra',
 loyal_customer: 'Cliente Fiel',
 big_spender: 'Grande Comprador',
 social_butterfly: 'Borboleta Social',
 reviewer_expert: 'Especialista em Reviews',
 sharing_champion: 'Campeéo de Partilhas',
 perfect_attendance: 'Assiduidade Perfeita',
 early_adopter: 'Primeiro a Adotar'
 };
 return labels[type] || type;
};

export const AchievementsGrid: React.FC<AchievementsGridProps> = ({ achievements }) => {
 if (achievements.length === 0) {
 return (
 <div className="text-center py-12 text-content-muted">
 <Award className="w-16 h-16 text-content-muted mx-auto mb-4" />
 <p className="text-lg font-medium mb-2">Nenhuma conquista ainda</p>
 <p className="text-sm">Continue comprando e participando para desbloquear conquistas!</p>
 </div>
 );
 }

 return (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
 {achievements.map((achievement, index) => (
 <div
 key={achievement.id}
 className="group relative bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/30 dark:via-amber-900/20 dark:to-yellow-800/30 rounded-xl md:rounded-2xl p-3 md:p-6 text-center border-2 border-yellow-300 dark:border-yellow-700 hover:border-yellow-400 dark:hover:border-yellow-600 hover:scale-105 md:hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-2xl overflow-hidden"
 style={{ animationDelay: `${index * 100}ms` }}
 >
 {/* Shine effect */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
 
 {/* Glow effect */}
 <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
 
 <div className="relative z-10">
 <div className="flex justify-center mb-2 md:mb-4 transform group-hover:scale-110 transition-transform duration-300">
 <div className="p-2 md:p-3 bg-surface-raised/50 rounded-full">
 <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
 {getAchievementIcon(achievement.achievementType)}
 </div>
 </div>
 </div>
 <h3 className="font-bold text-content-primary text-xs md:text-sm mb-1 md:mb-2 line-clamp-2">
 {getAchievementLabel(achievement.achievementType)}
 </h3>
 <p className="text-[10px] md:text-xs text-content-secondary font-medium">
 {new Date(achievement.unlockedAt).toLocaleDateString('pt-MZ', {
 month: 'short',
 year: 'numeric'
 })}
 </p>
 </div>
 </div>
 ))}
 </div>
 );
};


