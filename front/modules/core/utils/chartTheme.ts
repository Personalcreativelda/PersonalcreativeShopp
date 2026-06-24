/**
 * Chart theme presets for Recharts (grid, axes, tooltip) and bar/line colors.
 * getChartTheme() reads CSS variables live from the document so it always
 * matches the current light/dark token set without hardcoding colours.
 */

export type ChartThemeId = 'light' | 'dark';

export interface ChartThemeConfig {
  grid: { stroke: string; strokeOpacity: number };
  tick: { fill: string };
  tooltip: {
    contentStyle: { backgroundColor: string; color: string; border: string; borderRadius: string; boxShadow?: string };
    cursor: { fill: string };
    labelStyle?: { color: string };
  };
  colors: {
    ordersBar: string;
    salesBar: string;
    lineChart: string;
    lineChartDot: string;
  };
  tierColors: Record<string, string>;
}

const lightTierColors: Record<string, string> = {
  Bronze: '#b45309',
  Prata:  '#6b7280',
  Ouro:   '#d97706',
  default: '#635BFF',
};

const darkTierColors: Record<string, string> = {
  Bronze: '#f59e0b',
  Prata:  '#9ca3af',
  Ouro:   '#fbbf24',
  default: '#818cf8',
};

/** Returns current chart theme by reading live CSS custom properties. */
export function getChartTheme(): ChartThemeConfig {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  if (typeof document === 'undefined') {
    // SSR fallback
    return buildTheme(false, {});
  }

  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();

  return buildTheme(isDark, { get });
}

function buildTheme(
  isDark: boolean,
  { get }: { get?: (v: string) => string }
): ChartThemeConfig {
  const css = get ?? (() => '');

  const gridColor    = css('--chart-grid')         || (isDark ? '#38383a' : '#D4DEE9');
  const tickColor    = css('--chart-tick')         || (isDark ? '#8d8d92' : '#697386');
  const tooltipBg    = css('--chart-tooltip-bg')   || (isDark ? '#2c2c2e' : '#1d1d1f');
  const tooltipText  = css('--chart-tooltip-text') || (isDark ? '#f5f5f7' : '#f5f5f7');

  return {
    grid: {
      stroke: gridColor,
      strokeOpacity: isDark ? 0.5 : 0.55,
    },
    tick: { fill: tickColor },
    tooltip: {
      contentStyle: {
        backgroundColor: tooltipBg,
        color: tooltipText,
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
        borderRadius: '10px',
        boxShadow: isDark
          ? '0 8px 24px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.18)',
      },
      cursor: {
        fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      },
      labelStyle: {
        color: isDark ? '#8d8d92' : '#9ca3af',
      },
    },
    colors: {
      ordersBar:    isDark ? '#34d399' : '#10b981',
      salesBar:     isDark ? '#818cf8' : '#635BFF',
      lineChart:    isDark ? '#818cf8' : '#635BFF',
      lineChartDot: isDark ? '#818cf8' : '#635BFF',
    },
    tierColors: isDark ? darkTierColors : lightTierColors,
  };
}

export const chartThemes = {
  light: buildTheme(false, {}),
  dark:  buildTheme(true,  {}),
};

/** Get fill color for tier bar by tier name (Bronze, Prata, Ouro, etc.). */
export function getTierBarColor(tierName: string): string {
  const theme = getChartTheme();
  return theme.tierColors[tierName] ?? theme.tierColors.default;
}
