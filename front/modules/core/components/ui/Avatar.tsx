import React, { useState } from 'react';

interface AvatarProps {
 src?: string;
 alt: string;
 name: string;
 size?: 'sm' | 'md' | 'lg' | 'xl';
 className?: string;
}

const sizeClasses = {
 sm: 'w-8 h-8 text-xs',
 md: 'w-9 h-9 sm:w-10 sm:h-10 text-sm',
 lg: 'w-12 h-12 text-base',
 xl: 'w-32 h-32 sm:w-40 sm:h-40 text-4xl sm:text-5xl'
};

export const Avatar: React.FC<AvatarProps> = ({
 src,
 alt,
 name,
 size = 'md',
 className = ''
}) => {
 const [hasError, setHasError] = useState(false);
 const [isLoading, setIsLoading] = useState(true);

 const getInitials = (name: string) => {
 return name
 .split(' ')
 .map(n => n[0])
 .join('')
 .toUpperCase()
 .substring(0, 2);
 };

 const handleError = () => {
 setHasError(true);
 setIsLoading(false);
 };

 const handleLoad = () => {
 setIsLoading(false);
 };

 const sizeClass = sizeClasses[size];
 // Verificar se className conté©m uma classe de arredondamento personalizada
 const hasCustomRounded = className.includes('rounded-');
 const roundedClass = hasCustomRounded ? '' : 'rounded-full';
 const baseClasses = `${roundedClass} flex-shrink-0 flex items-center justify-center font-semibold text-white bg-gradient-to-br from-brand-500 to-brand-600 ${sizeClass} ${className}`;

 // Se néo hé¡ src ou houve erro, mostrar apenas as iniciais
 if (!src || hasError) {
 return (
 <div className={baseClasses}>
 {getInitials(name)}
 </div>
 );
 }

 // Se hé¡ src, tentar mostrar a imagem
 // Extrair classe de arredondamento do className se existir
 const roundedMatch = className.match(/rounded-[a-z0-9-]+/);
 const imgRoundedClass = roundedMatch ? roundedMatch[0] : 'rounded-full';
 
 return (
 <div className={`relative ${sizeClass} ${className}`}>
 {isLoading && (
 <div className={`absolute inset-0 ${baseClasses} animate-pulse`}>
 {getInitials(name)}
 </div>
 )}
 <img
 src={src}
 alt={alt}
 className={`w-full h-full ${imgRoundedClass} object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
 onError={handleError}
 onLoad={handleLoad}
 />
 </div>
 );
};


