
/**
 * Convert hex color to RGB object
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
};

/**
 * Mix two colors
 * @param color1 Hex color 1
 * @param color2 Hex color 2
 * @param weight Weight of color 2 (0 to 1)
 */
const mixColors = (color1: string, color2: string, weight: number): string => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) return color1;

    const r = Math.round(rgb1.r * (1 - weight) + rgb2.r * weight);
    const g = Math.round(rgb1.g * (1 - weight) + rgb2.g * weight);
    const b = Math.round(rgb1.b * (1 - weight) + rgb2.b * weight);

    const rr = (r.toString(16).length === 1 ? '0' : '') + r.toString(16);
    const gg = (g.toString(16).length === 1 ? '0' : '') + g.toString(16);
    const bb = (b.toString(16).length === 1 ? '0' : '') + b.toString(16);

    return `#${rr}${gg}${bb}`;
};

/**
 * Generate a tint (lighter version mixed with white)
 */
export const tint = (hex: string, weight: number): string => {
    return mixColors(hex, '#ffffff', weight);
};

/**
 * Generate a shade (darker version mixed with black)
 */
export const shade = (hex: string, weight: number): string => {
    return mixColors(hex, '#000000', weight);
};

/**
 * Calculate appropriate text color (black or white) for a background
 */
export const getContrastColor = (hex: string): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';

    // Calculate YIQ brightness
    const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;

    // Returns black text for bright backgrounds, white for dark
    return yiq >= 128 ? '#000000' : '#ffffff';
};

export const FONT_OPTIONS = [
  { value: 'Inter',   label: 'Inter',     stack: '"Inter", sans-serif' },
  { value: 'Poppins', label: 'Poppins',   stack: '"Poppins", sans-serif' },
  { value: 'DM Sans', label: 'DM Sans',   stack: '"DM Sans", sans-serif' },
  { value: 'Nunito',  label: 'Nunito',    stack: '"Nunito", sans-serif' },
  { value: 'Roboto',  label: 'Roboto',    stack: '"Roboto", sans-serif' },
  { value: 'System',  label: 'Sistema',   stack: 'system-ui, -apple-system, sans-serif' },
] as const;

export const RADIUS_OPTIONS = [
  { value: 'sharp',   label: 'Recto',         preview: 'rounded-none' },
  { value: 'default', label: 'Padrão',         preview: 'rounded-lg' },
  { value: 'rounded', label: 'Arredondado',    preview: 'rounded-2xl' },
  { value: 'pill',    label: 'Pílula',         preview: 'rounded-full' },
] as const;

export const COLOR_PRESETS = [
  { label: 'Verde Natura',  value: '#059669' },
  { label: 'Esmeralda',     value: '#10b981' },
  { label: 'Azul',          value: '#2563eb' },
  { label: 'Índigo',        value: '#4f46e5' },
  { label: 'Violeta',       value: '#7c3aed' },
  { label: 'Rosa',          value: '#db2777' },
  { label: 'Laranja',       value: '#ea580c' },
  { label: 'Âmbar',         value: '#d97706' },
  { label: 'Cinza Escuro',  value: '#374151' },
  { label: 'Ardósia',       value: '#0f172a' },
];

export const applyFontFamily = (font: string): void => {
  const found = FONT_OPTIONS.find(f => f.value === font);
  const stack = found ? found.stack : FONT_OPTIONS[0].stack;

  if (font && font !== 'System') {
    const linkId = 'theme-google-font';
    const existing = document.getElementById(linkId) as HTMLLinkElement | null;
    const fontQuery = font.replace(/ /g, '+');
    const href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@400;500;600;700&display=swap`;
    if (!existing) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    } else if (existing.href !== href) {
      existing.href = href;
    }
  }

  document.documentElement.style.setProperty('--font-body', stack);
  document.body.style.fontFamily = stack;
};

export const applyBorderRadius = (preset: string): void => {
  const scale: Record<string, Record<string, string>> = {
    sharp:   { sm: '1px',   md: '2px',   lg: '2px',   xl: '2px' },
    default: { sm: '4px',   md: '8px',   lg: '12px',  xl: '16px' },
    rounded: { sm: '8px',   md: '14px',  lg: '22px',  xl: '28px' },
    pill:    { sm: '999px', md: '999px', lg: '999px', xl: '999px' },
  };
  const s = scale[preset] || scale['default'];
  const root = document.documentElement;
  root.style.setProperty('--radius-sm', s.sm);
  root.style.setProperty('--radius-md', s.md);
  root.style.setProperty('--radius-lg', s.lg);
  root.style.setProperty('--radius-xl', s.xl);
};

/**
 * Generate a color palette and apply it to CSS variables
 * @param primaryHex The primary brand color in hex format
 */
export const applyTheme = (primaryHex: string) => {
    if (!primaryHex || !/^#[0-9A-F]{6}$/i.test(primaryHex)) return;

    const root = document.documentElement;

    // Base (500)
    root.style.setProperty('--brand-500', primaryHex);

    // Generate Shades & Tints correctly
    // Tints (Lighter)
    root.style.setProperty('--brand-400', tint(primaryHex, 0.2));
    root.style.setProperty('--brand-300', tint(primaryHex, 0.4));
    root.style.setProperty('--brand-200', tint(primaryHex, 0.6));
    root.style.setProperty('--brand-100', tint(primaryHex, 0.8));
    root.style.setProperty('--brand-50', tint(primaryHex, 0.95)); // Very light tint

    // Shades (Darker)
    root.style.setProperty('--brand-600', shade(primaryHex, 0.1));
    root.style.setProperty('--brand-700', shade(primaryHex, 0.2));
    root.style.setProperty('--brand-800', shade(primaryHex, 0.3));
    root.style.setProperty('--brand-900', shade(primaryHex, 0.4));

    // Contrast Text
    root.style.setProperty('--brand-contrast', getContrastColor(primaryHex));

    // Sync brand-logo-* vars — stored as "R G B" channels so Tailwind opacity modifiers work
    const logoRgb      = hexToRgb(shade(primaryHex, 0.05));
    const logoLightRgb = hexToRgb(tint(primaryHex, 0.30));
    if (logoRgb)      root.style.setProperty('--brand-logo-dark',  `${logoRgb.r} ${logoRgb.g} ${logoRgb.b}`);
    if (logoLightRgb) root.style.setProperty('--brand-logo-light', `${logoLightRgb.r} ${logoLightRgb.g} ${logoLightRgb.b}`);
};

// ── Theme Presets ────────────────────────────────────────────────────────────

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  previewColors: string[];   // [brand, surface, text]
  brandColor: string;
  font: string;
  radius: string;
  lightVars: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Moderno · violeta · sombras marcadas',
    previewColors: ['#675DFF', '#F4F7FA', '#414552'],
    brandColor: '#675DFF',
    font: 'Inter',
    radius: 'default',
    lightVars: {
      '--surface-base':    '#F4F7FA',
      '--surface-raised':  '#FFFFFF',
      '--surface-overlay': '#ECF1F6',
      '--text-primary':    '#414552',
      '--text-secondary':  '#3C4257',
      '--text-muted':      '#697386',
      '--border-default':  '#D4DEE9',
      '--border-strong':   '#9BAEC8',
      '--shadow-sm':  '0 1px 3px rgba(0,0,0,0.08)',
      '--shadow-md':  '0 5px 15px rgba(0,0,0,0.12), 0 15px 35px rgba(48,49,61,0.08)',
      '--shadow-lg':  '0 10px 24px rgba(0,0,0,0.15), 0 20px 48px rgba(48,49,61,0.10)',
      '--shadow-xl':  '0 20px 40px rgba(0,0,0,0.18), 0 30px 60px rgba(48,49,61,0.12)',
      '--shadow-2xl': '0 30px 60px rgba(0,0,0,0.25)',
    },
  },
  {
    id: 'naturerva',
    name: 'NaturErva',
    description: 'Minimalista · verde · inspirado Apple',
    previewColors: ['#059669', '#f5f5f7', '#1d1d1f'],
    brandColor: '#059669',
    font: 'Inter',
    radius: 'default',
    lightVars: {
      '--surface-base':    '#f5f5f7',
      '--surface-raised':  '#ffffff',
      '--surface-overlay': '#fbfbfd',
      '--text-primary':    '#1d1d1f',
      '--text-secondary':  '#424245',
      '--text-muted':      '#6e6e73',
      '--border-default':  '#d2d2d7',
      '--border-strong':   '#b0b0b7',
      '--shadow-sm':  '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-md':  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-lg':  '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)',
      '--shadow-xl':  '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
      '--shadow-2xl': '0 25px 50px rgba(0,0,0,0.25)',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Limpo · monocromático · sem distrações',
    previewColors: ['#18181b', '#fafafa', '#18181b'],
    brandColor: '#18181b',
    font: 'Inter',
    radius: 'sharp',
    lightVars: {
      '--surface-base':    '#fafafa',
      '--surface-raised':  '#ffffff',
      '--surface-overlay': '#f4f4f5',
      '--text-primary':    '#18181b',
      '--text-secondary':  '#52525b',
      '--text-muted':      '#a1a1aa',
      '--border-default':  '#e4e4e7',
      '--border-strong':   '#d4d4d8',
      '--shadow-sm':  '0 1px 2px rgba(0,0,0,0.06)',
      '--shadow-md':  '0 2px 4px rgba(0,0,0,0.08)',
      '--shadow-lg':  '0 4px 8px rgba(0,0,0,0.10)',
      '--shadow-xl':  '0 8px 16px rgba(0,0,0,0.12)',
      '--shadow-2xl': '0 16px 32px rgba(0,0,0,0.16)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Profundo · azul · tranquilo',
    previewColors: ['#0070f3', '#f0f4ff', '#0a1929'],
    brandColor: '#0070f3',
    font: 'Inter',
    radius: 'rounded',
    lightVars: {
      '--surface-base':    '#f0f4ff',
      '--surface-raised':  '#ffffff',
      '--surface-overlay': '#e8eeff',
      '--text-primary':    '#0a1929',
      '--text-secondary':  '#1e3a5f',
      '--text-muted':      '#5b7ba8',
      '--border-default':  '#c8d8f0',
      '--border-strong':   '#9ab8d8',
      '--shadow-sm':  '0 1px 3px rgba(0,70,180,0.08)',
      '--shadow-md':  '0 4px 12px rgba(0,70,180,0.12)',
      '--shadow-lg':  '0 8px 24px rgba(0,70,180,0.15)',
      '--shadow-xl':  '0 16px 40px rgba(0,70,180,0.18)',
      '--shadow-2xl': '0 32px 64px rgba(0,70,180,0.22)',
    },
  },
];

/**
 * Apply a full theme preset (surface/text/border/shadow CSS vars + brand + font + radius).
 * Calling with overrideBrandColor keeps the preset surfaces but uses a custom brand color.
 */
export const applyThemePreset = (presetId: string, overrideBrandColor?: string): void => {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (!preset) return;

  const root = document.documentElement;
  // Save the preset ID so removeDarkModeVars can restore it
  root.dataset.themePreset = presetId;
  if (overrideBrandColor) root.dataset.themeBrand = overrideBrandColor;

  // Map hex vars → their RGB-triplet counterparts (needed for Tailwind opacity modifiers)
  const RGB_MAP: Record<string, string> = {
    '--surface-base':    '--surface-base-rgb',
    '--surface-raised':  '--surface-raised-rgb',
    '--surface-overlay': '--surface-overlay-rgb',
    '--border-default':  '--border-default-rgb',
    '--border-strong':   '--border-strong-rgb',
  };
  Object.entries(preset.lightVars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
    if (RGB_MAP[k]) {
      const rgb = hexToRgb(v);
      if (rgb) root.style.setProperty(RGB_MAP[k], `${rgb.r} ${rgb.g} ${rgb.b}`);
    }
  });

  applyTheme(overrideBrandColor || preset.brandColor);
  applyFontFamily(preset.font);
  applyBorderRadius(preset.radius);
};

// ── Dark mode CSS vars ──────────────────────────────────────────────────────
// Must be set as inline styles to override light-mode inline styles from applyThemePreset.
// Mirrors the .dark block in front/index.html exactly.
const DARK_VARS: Record<string, string> = {
  '--surface-base':       '#0a0a0a',
  '--surface-raised':     '#1c1c1e',
  '--surface-overlay':    '#111113',
  '--surface-base-rgb':    '10 10 10',
  '--surface-raised-rgb':  '28 28 30',
  '--surface-overlay-rgb': '17 17 19',
  '--text-primary':       '#f5f5f7',
  '--text-secondary':     '#aeaeb2',
  '--text-muted':         '#8d8d92',
  '--border-default':     '#38383a',
  '--border-strong':      '#48484a',
  '--border-default-rgb':  '56 56 58',
  '--border-strong-rgb':   '72 72 74',
  '--color-success':      '#32d74b',
  '--color-error':        '#ff453a',
  '--color-warning':      '#ffd60a',
  '--color-info':         '#0a84ff',
  '--chart-grid':         '#38383a',
  '--chart-tick':         '#8d8d92',
  '--chart-tooltip-bg':   '#2c2c2e',
  '--chart-tooltip-text': '#f5f5f7',
  '--shadow-sm':  '0 1px 3px rgba(0,0,0,0.3)',
  '--shadow-md':  '0 4px 12px rgba(0,0,0,0.4)',
  '--shadow-lg':  '0 8px 24px rgba(0,0,0,0.5)',
  '--shadow-xl':  '0 16px 40px rgba(0,0,0,0.6)',
  '--shadow-2xl': '0 32px 64px rgba(0,0,0,0.7)',
};

/**
 * Enable dark mode: adds the `dark` class AND sets dark CSS vars as inline styles,
 * overriding any light-mode vars previously set by applyThemePreset.
 */
export const applyDarkModeVars = (): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('dark');
  Object.entries(DARK_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
};

/**
 * Disable dark mode: removes the `dark` class AND removes dark CSS var overrides,
 * exposing the light-mode vars set by applyThemePreset.
 */
export const removeDarkModeVars = (): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark');
  Object.keys(DARK_VARS).forEach(k => root.style.removeProperty(k));
  // Re-apply the saved light preset so its surface/text/border vars are active again
  const savedPreset = root.dataset.themePreset;
  const savedBrand  = root.dataset.themeBrand;
  if (savedPreset) applyThemePreset(savedPreset, savedBrand);
};

