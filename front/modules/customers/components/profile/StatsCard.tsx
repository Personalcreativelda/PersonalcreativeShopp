import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
 label: string;
 value: string | number;
 icon: LucideIcon;
 gradient: 'green' | 'blue' | 'purple' | 'yellow' | 'orange' | 'pink';
 trend?: {
 value: number;
 isPositive: boolean;
 };
 subtitle?: string;
}

const gradientClasses = {
 green: 'from-green-500 to-green-600',
 blue: 'from-blue-500 to-blue-600',
 purple: 'from-purple-500 to-purple-600',
 yellow: 'from-yellow-500 to-yellow-600',
 orange: 'from-orange-500 to-orange-600',
 pink: 'from-pink-500 to-pink-600'
};

const iconBgClasses = {
 green: 'bg-green-100 dark:bg-green-900/30',
 blue: 'bg-blue-100 dark:bg-blue-900/30',
 purple: 'bg-purple-100 dark:bg-purple-900/30',
 yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
 orange: 'bg-orange-100 dark:bg-orange-900/30',
 pink: 'bg-pink-100 dark:bg-pink-900/30'
};

const iconTextClasses = {
 green: 'text-green-600 dark:text-green-400',
 blue: 'text-blue-600 dark:text-blue-400',
 purple: 'text-purple-600 dark:text-purple-400',
 yellow: 'text-yellow-600 dark:text-yellow-400',
 orange: 'text-orange-600 dark:text-orange-400',
 pink: 'text-pink-600 dark:text-pink-400'
};

export const StatsCard: React.FC<StatsCardProps> = ({
 label,
 value,
 icon: Icon,
 gradient,
 trend,
 subtitle
}) => {
 return (
 <div className="group relative bg-surface-raised rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-border-default hover:scale-105">
 {/* Gradient overlay on hover */}
 <div className={`absolute inset-0 bg-gradient-to-br ${gradientClasses[gradient]} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
 
 <div className="p-4 md:p-6 relative z-10">
 <div className="flex items-start justify-between mb-3 md:mb-4">
 <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${iconBgClasses[gradient]} transition-transform group-hover:scale-110`}>
 <Icon className={`w-5 h-5 md:w-6 md:h-6 ${iconTextClasses[gradient]}`} />
 </div>
 {trend && (
 <div className={`flex items-center space-x-1 text-sm font-medium ${
 trend.isPositive ? 'text-green-600' : 'text-red-600'
 }`}>
 <span>{trend.isPositive ? 'â†‘' : 'â†“'}</span>
 <span>{Math.abs(trend.value)}%</span>
 </div>
 )}
 </div>
 
 <div>
 <p className="text-xs md:text-sm font-medium text-content-secondary mb-1">
 {label}
 </p>
 <p className="text-xl md:text-3xl font-bold text-content-primary mb-1">
 {typeof value === 'number' ? value.toLocaleString('pt-MZ') : value}
 </p>
 {subtitle && (
 <p className="text-[10px] md:text-xs text-content-muted">
 {subtitle}
 </p>
 )}
 </div>
 </div>
 </div>
 );
};


