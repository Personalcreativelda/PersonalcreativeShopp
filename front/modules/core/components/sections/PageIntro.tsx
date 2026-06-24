import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface PageIntroProps {
 title: string;
 description: string;
 icon?: LucideIcon;
 actions?: React.ReactNode;
 variant?: 'default' | 'hero' | 'minimal';
 className?: string;
}

export const PageIntro: React.FC<PageIntroProps> = ({
 title,
 description,
 icon: Icon,
 actions,
 variant = 'default',
 className = ''
}) => {
 const baseClasses = "relative z-10";
 
 const variantClasses = {
 default: "py-12 px-4 bg-surface-raised/90 backdrop-blur-md rounded-2xl border border-border-default shadow-lg",
 hero: "py-16 px-4 bg-gradient-to-br from-brand-50/80 via-surface-raised/80 to-brand-50/80 dark:from-brand-900/20 dark:via-surface-raised/80 dark:to-brand-900/20 backdrop-blur-md rounded-3xl border border-brand-200/50 dark:border-brand-800/50 shadow-xl",
 minimal: "py-8 px-4"
 };

 return (
 <section className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
 <div className="max-w-4xl mx-auto text-center">
 {Icon && (
 <div className="flex justify-center mb-6">
 <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
 <Icon className="w-8 h-8 text-green-600 dark:text-green-400" />
 </div>
 </div>
 )}
 
 <h2 className={`font-bold text-content-primary mb-4 ${
 variant === 'hero' ? 'text-4xl md:text-5xl' : 
 variant === 'minimal' ? 'text-2xl md:text-3xl' : 
 'text-3xl md:text-4xl'
 }`}>
 {title}
 </h2>
 
 <p className={`text-content-secondary mb-6 ${
 variant === 'hero' ? 'text-lg md:text-xl' : 
 variant === 'minimal' ? 'text-base' : 
 'text-base md:text-lg'
 } max-w-2xl mx-auto leading-relaxed`}>
 {description}
 </p>
 
 {actions && (
 <div className="flex flex-wrap justify-center gap-4 mt-8">
 {actions}
 </div>
 )}
 </div>
 </section>
 );
};


