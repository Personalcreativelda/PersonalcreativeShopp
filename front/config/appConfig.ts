/**
 * Configuração do sistema (identidade corporativa e visual).
 * Alterar valores neste ficheiro para personalizar o sistema.
 * Overrides opcionais via variáveis de ambiente VITE_APP_*.
 */

export interface AppSystemSettings {
  system_name?: string;
  logo_light?: string;
  logo_dark?: string;
  logo_icon?: string;
  favicon?: string;
  primary_color?: string;
  secondary_color?: string;
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_website?: string;
  [key: string]: unknown;
}

const defaults: AppSystemSettings = {
  system_name: 'Natur Erva - Natural é saudável',
  logo_light: '/logo.png',
  logo_dark: '/logo.png',
  logo_icon: '/favicon.png',
  favicon: '/favicon.png',
  primary_color: '#2e7d32', // Deep Green
  secondary_color: '#8bc34a', // Light Green
  company_name: 'Natur Erva',
  company_email: 'geral@natur-erva.co.mz',
  company_phone: '+258 84 000 0000',
  company_address: 'Maputo, Moçambique',
  company_website: 'https://natur-erva.co.mz',
};

function getEnv(key: string): string | undefined {
  return typeof import.meta !== 'undefined' && import.meta.env && typeof (import.meta.env as Record<string, unknown>)[key] === 'string'
    ? (import.meta.env as Record<string, string>)[key]
    : undefined;
}

/** Configuração do sistema com overrides opcionais de env (VITE_APP_SYSTEM_NAME, etc.). */
export const appSystemConfig: AppSystemSettings = {
  ...defaults,
  ...(getEnv('VITE_APP_SYSTEM_NAME') && { system_name: getEnv('VITE_APP_SYSTEM_NAME') }),
  ...(getEnv('VITE_APP_COMPANY_NAME') && { company_name: getEnv('VITE_APP_COMPANY_NAME') }),
  ...(getEnv('VITE_APP_LOGO_LIGHT') && { logo_light: getEnv('VITE_APP_LOGO_LIGHT') }),
  ...(getEnv('VITE_APP_LOGO_DARK') && { logo_dark: getEnv('VITE_APP_LOGO_DARK') }),
  ...(getEnv('VITE_APP_LOGO_ICON') && { logo_icon: getEnv('VITE_APP_LOGO_ICON') }),
  ...(getEnv('VITE_APP_FAVICON') && { favicon: getEnv('VITE_APP_FAVICON') }),
  ...(getEnv('VITE_APP_PRIMARY_COLOR') && { primary_color: getEnv('VITE_APP_PRIMARY_COLOR') }),
  ...(getEnv('VITE_APP_SECONDARY_COLOR') && { secondary_color: getEnv('VITE_APP_SECONDARY_COLOR') }),
  ...(getEnv('VITE_APP_COMPANY_EMAIL') && { company_email: getEnv('VITE_APP_COMPANY_EMAIL') }),
  ...(getEnv('VITE_APP_COMPANY_PHONE') && { company_phone: getEnv('VITE_APP_COMPANY_PHONE') }),
  ...(getEnv('VITE_APP_COMPANY_ADDRESS') && { company_address: getEnv('VITE_APP_COMPANY_ADDRESS') }),
  ...(getEnv('VITE_APP_COMPANY_WEBSITE') && { company_website: getEnv('VITE_APP_COMPANY_WEBSITE') }),
};
