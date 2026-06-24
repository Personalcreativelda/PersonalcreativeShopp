/**
 * Utilitários de data/hora para o sistema.
 *
 * CONVENÇÃO DE FUSO HORÁRIO:
 * O sistema usa exclusivamente Africa/Maputo (UTC+2) para todas as datas de negócio.
 * - Exibição: formatDateTime, formatDateOnly, formatDateTimeForReport
 * - Armazenamento/API: YYYY-MM-DD em Maputo via getTodayDateString, toDateStringInTimezone, extractLocalDate
 * - Evitar: new Date().toISOString().split('T')[0] (usa UTC; em Maputo pode deslocar o dia)
 */

export const APP_TIMEZONE = 'Africa/Maputo' as const;
export const APP_LOCALE = 'pt-MZ' as const;

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
};

const dateTimeLongOptions: Intl.DateTimeFormatOptions = {
  ...dateTimeOptions,
  month: 'long'
};

const dateOnlyOptions: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
};

/**
 * Converte valor para Date (string ISO ou Date).
 */
function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
}

/**
 * Formata data e hora para exibição (DD/MM/AAAA, HH:MM) em hora de Maputo.
 */
export function formatDateTime(value: Date | string | number): string {
  return toDate(value).toLocaleString(APP_LOCALE, dateTimeOptions);
}

/**
 * Formata data e hora com nome longo do mês (ex.: 30 de janeiro de 2026, 00:58) em hora de Maputo.
 */
export function formatDateTimeLong(value: Date | string | number): string {
  return toDate(value).toLocaleString(APP_LOCALE, dateTimeLongOptions);
}

/**
 * Formata apenas a data (DD/MM/AAAA) em hora de Maputo.
 */
export function formatDateOnly(value: Date | string | number): string {
  return toDate(value).toLocaleDateString(APP_LOCALE, dateOnlyOptions);
}

/**
 * Formata data/hora para uso genérico (ex.: relatórios, PDF) em hora de Maputo.
 */
export function formatDateTimeForReport(value: Date | string | number): string {
  return toDate(value).toLocaleString(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Formata apenas a data com opções (ex.: weekday, month: 'long') em hora de Maputo.
 */
export function formatDateWithOptions(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleDateString(APP_LOCALE, { timeZone: APP_TIMEZONE, ...options });
}

// ------------------------------------------------------------------
// FUNÇÕES DE DATA PARA USO EM SERVIÇOS (formato YYYY-MM-DD)
// ------------------------------------------------------------------

const isoDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Devolve a data de hoje no formato YYYY-MM-DD no timezone de Maputo.
 * Usar em vez de new Date().toISOString().split('T')[0]
 */
export function getTodayDateString(): string {
  return isoDateFormatter.format(new Date());
}

/**
 * Data padrão do stock inicial (01/01 do ano corrente).
 * Usado por get_stock_period_summary, stockReportService, modais de ajuste e selecção de variantes
 * para garantir consistência entre ecrãs.
 */
export function getStockSnapshotDate(): string {
  return `${new Date().getFullYear()}-01-01`;
}

/**
 * Extrai a data (YYYY-MM-DD) de um ISO string, respeitando o timezone de Maputo.
 * Se o input já for YYYY-MM-DD, devolve directamente.
 * Se for um ISO timestamp, converte para a data local de Maputo.
 */
export function extractLocalDate(isoString: string): string {
  if (!isoString) return getTodayDateString();

  // Se já é formato YYYY-MM-DD, devolver directamente
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString;
  }

  // Para ISO timestamps, converter para data local de Maputo
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return getTodayDateString();

  return isoDateFormatter.format(date);
}

/**
 * Converte um Date para string YYYY-MM-DD no timezone de Maputo.
 */
export function toDateStringInTimezone(date: Date): string {
  return isoDateFormatter.format(date);
}

/**
 * Obtém a data actual no timezone de Maputo como { year, month, day }.
 * Usado internamente para cálculos de períodos.
 */
function getTodayInTimezone(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  
  return { year, month, day };
}

/** Offset de Maputo em horas (UTC+2). Usado para criar datas no fuso correcto. */
const MAPUTO_UTC_OFFSET_HOURS = 2;

/** Retorna o dia da semana (0=Dom, 6=Sáb) de uma data em Maputo. */
function getDayOfWeekInMaputo(date: Date): number {
  const s = date.toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[s] ?? 0;
}

/**
 * Cria um Date a partir de uma data no timezone de Maputo.
 * O Date resultante representa o início ou fim desse dia em Africa/Maputo.
 * Evita new Date(year, month, day) que usa o timezone do browser.
 */
function createDateInTimezone(year: number, month: number, day: number, endOfDay = false): Date {
  if (endOfDay) {
    // 23:59:59.999 Maputo = (24 - 2 - 1)h = 21:59:59.999 UTC no mesmo dia civil
    return new Date(Date.UTC(year, month, day, 24 - MAPUTO_UTC_OFFSET_HOURS - 1, 59, 59, 999));
  }
  // 00:00 Maputo = 22:00 UTC do dia anterior
  return new Date(Date.UTC(year, month, day, -MAPUTO_UTC_OFFSET_HOURS, 0, 0, 0));
}

/** Período para filtros (alinhado com PeriodFilter). */
export type PeriodOption =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'lastWeek'
  | 'lastMonth'
  | 'lastYear'
  | 'custom';

/**
 * Devolve o intervalo de datas (start/end) para um período e datas custom opcionais.
 * Usado com PeriodFilter para filtrar listas por data.
 * As datas são calculadas com base no timezone de Africa/Maputo.
 */
export function getDateRangeFromPeriod(
  period: PeriodOption,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const { year, month, day } = getTodayInTimezone();
  const todayDate = createDateInTimezone(year, month, day);
  let start: Date;
  let end: Date;

  switch (period) {
    case 'all':
      start = createDateInTimezone(2000, 0, 1);
      end = createDateInTimezone(2099, 11, 31, true);
      break;
    case 'today':
      start = createDateInTimezone(year, month, day);
      end = createDateInTimezone(year, month, day, true);
      break;
    case 'yesterday':
      start = createDateInTimezone(year, month, day - 1);
      end = createDateInTimezone(year, month, day - 1, true);
      break;
    case 'thisWeek': {
      const dayOfWeek = getDayOfWeekInMaputo(todayDate);
      const diff = day - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start = createDateInTimezone(year, month, diff);
      end = createDateInTimezone(year, month, day, true);
      break;
    }
    case 'thisMonth':
      start = createDateInTimezone(year, month, 1);
      end = createDateInTimezone(year, month + 1, 0, true);
      break;
    case 'thisYear':
      start = createDateInTimezone(year, 0, 1);
      end = createDateInTimezone(year, 11, 31, true);
      break;
    case 'lastWeek': {
      const dayOfWeek = getDayOfWeekInMaputo(todayDate);
      const diff = day - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
      start = createDateInTimezone(year, month, diff);
      end = createDateInTimezone(year, month, diff + 6, true);
      break;
    }
    case 'lastMonth':
      start = createDateInTimezone(year, month - 1, 1);
      end = createDateInTimezone(year, month, 0, true);
      break;
    case 'lastYear':
      start = createDateInTimezone(year - 1, 0, 1);
      end = createDateInTimezone(year - 1, 11, 31, true);
      break;
    case 'custom':
      if (customStart && customEnd) {
        const [sYear, sMonth, sDay] = customStart.split('-').map(Number);
        const [eYear, eMonth, eDay] = customEnd.split('-').map(Number);
        start = createDateInTimezone(sYear, sMonth - 1, sDay);
        end = createDateInTimezone(eYear, eMonth - 1, eDay, true);
      } else {
        start = createDateInTimezone(year, month, day);
        end = createDateInTimezone(year, month, day, true);
      }
      break;
    default:
      start = createDateInTimezone(year, month, day);
      end = createDateInTimezone(year, month, day, true);
  }

  return { start, end };
}
