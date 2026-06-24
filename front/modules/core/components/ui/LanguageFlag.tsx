import React from 'react';

interface LanguageFlagProps {
 language: 'pt' | 'en';
 size?: 'sm' | 'md' | 'lg';
 showLabel?: boolean;
}

export const LanguageFlag: React.FC<LanguageFlagProps> = ({
 language,
 size = 'md',
 showLabel = false
}) => {
 const flags = {
 pt: '🇵🇹',
 en: '🇬🇧'
 };

 const labels = {
 pt: 'Português',
 en: 'English'
 };

 const sizes = {
 sm: 'text-sm',
 md: 'text-base',
 lg: 'text-xl'
 };

 return (
 <span className="inline-flex items-center gap-1.5">
 <span className={sizes[size]} role="img" aria-label={labels[language]}>
 {flags[language]}
 </span>
 {showLabel && (
 <span className="text-xs font-medium">{labels[language]}</span>
 )}
 </span>
 );
};
