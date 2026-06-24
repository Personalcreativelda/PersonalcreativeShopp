import React from 'react';
import { Award, Crown, Star } from 'lucide-react';
import { LoyaltyTier } from '../../../core/types/types';

interface TierBadgeProps {
 tier: LoyaltyTier | string;
 size?: 'xs' | 'sm' | 'md' | 'lg';
 showIcon?: boolean;
}

const tierConfig: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
 [LoyaltyTier.BRONZE]: {
 color: 'text-amber-700 dark:text-amber-400',
 bgColor: 'bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
 icon: Star,
 label: 'Bronze'
 },
 'Bronze': {
 color: 'text-amber-700 dark:text-amber-400',
 bgColor: 'bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
 icon: Star,
 label: 'Bronze'
 },
 [LoyaltyTier.PRATA]: {
 color: 'text-content-secondary',
 bgColor: 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600',
 icon: Award,
 label: 'Prata'
 },
 'Prata': {
 color: 'text-content-secondary',
 bgColor: 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600',
 icon: Award,
 label: 'Prata'
 },
 [LoyaltyTier.OURO]: {
 color: 'text-yellow-700 dark:text-yellow-400',
 bgColor: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30',
 icon: Crown,
 label: 'Ouro'
 },
 'Ouro': {
 color: 'text-yellow-700 dark:text-yellow-400',
 bgColor: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30',
 icon: Crown,
 label: 'Ouro'
 }
};

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 'md', showIcon = true }) => {
 // Converter enum para string se necessário
 const tierString = typeof tier === 'string' ? tier : tier;
 const config = tierConfig[tierString] || tierConfig[LoyaltyTier.BRONZE] || tierConfig['Bronze'];
 const Icon = config.icon;
 
 const sizeClasses = {
 xs: 'px-1.5 py-0.5 text-[10px]',
 sm: 'px-2 py-1 text-xs',
 md: 'px-3 py-1.5 text-sm',
 lg: 'px-4 py-2 text-base'
 };
 
 const iconSizes = {
 xs: 'w-2.5 h-2.5',
 sm: 'w-3 h-3',
 md: 'w-4 h-4',
 lg: 'w-5 h-5'
 };

 return (
 <div className={`inline-flex items-center space-x-1.5 rounded-full font-semibold ${config.bgColor} ${config.color} ${sizeClasses[size]} shadow-sm`}>
 {showIcon && <Icon className={iconSizes[size]} />}
 <span>{config.label}</span>
 </div>
 );
};


