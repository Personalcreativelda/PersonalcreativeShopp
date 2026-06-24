import React, { useState, useEffect } from 'react';
import { getSystemSettings } from '../../../core/services/systemSettingsService';

interface LogoProps {
 className?: string;
 width?: number | string;
 height?: number | string;
 variant?: 'full' | 'icon'; // full = logo completo, icon = logo é­cone para sidebar fechado
 isDarkMode?: boolean; // Para determinar qual logo usar (light ou dark)
}

export const Logo: React.FC<LogoProps> = ({ 
 className = '', 
 width = 'auto', 
 height = 'auto',
 variant = 'full',
 isDarkMode = false
}) => {
 // URLs padrão (fallback)
 const defaultFullLogoUrl = "/logo.png";
 const defaultIconLogoUrl = "/favicon.png";

 // Inicializar com URL padréo imediatamente para garantir que o logotipo apareça
 const [logoUrl, setLogoUrl] = useState<string>(
 variant === 'icon' ? defaultIconLogoUrl : defaultFullLogoUrl
 );

 useEffect(() => {
 const loadLogo = async () => {
 try {
 const settings = await getSystemSettings();
 if (variant === 'icon') {
 if (settings.logo_icon) setLogoUrl(settings.logo_icon);
 } else {
 if (isDarkMode && settings.logo_dark) {
 setLogoUrl(settings.logo_dark);
 } else if (!isDarkMode && settings.logo_light) {
 setLogoUrl(settings.logo_light);
 } else {
 const customLogo = settings.logo_light || settings.logo_dark;
 if (customLogo) setLogoUrl(customLogo);
 }
 }
 } catch {
 // silently use default
 }
 };

 loadLogo();
 window.addEventListener('logo:updated', loadLogo);
 return () => window.removeEventListener('logo:updated', loadLogo);
 }, [variant, isDarkMode]);

 return (
 <img 
 src={logoUrl}
 alt={variant === 'icon' ? "Natur Erva Icon" : "Natur Erva Logo"} 
 className={`${className} object-contain`}
 width={width}
 height={height}
 style={{ 
 maxWidth: '100%', 
 width: width === 'auto' ? 'auto' : `${width}px`,
 height: height === 'auto' ? 'auto' : `${height}px`,
 display: 'block',
 objectFit: 'contain'
 }}
 loading="lazy"
 onError={(e) => {
 // Tratar erro silenciosamente - sempre tentar usar URL padréo
 const target = e.target as HTMLImageElement;
 const fallbackUrl = variant === 'icon' ? defaultIconLogoUrl : defaultFullLogoUrl;
 
 // Se néo for a URL padréo, tentar carregar a padréo
 if (target.src !== defaultFullLogoUrl && target.src !== defaultIconLogoUrl) {
 target.src = fallbackUrl;
 }
 // Se jé¡ for a URL padréo e ainda assim falhar, manter visé­vel (pode ser problema de rede)
 // Néo esconder a imagem para garantir que o logotipo sempre apareça
 }}
 />
 );
};


