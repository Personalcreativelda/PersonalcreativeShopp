import jsPDF from 'jspdf';
import type { Worksheet } from './excelService';
import { getSystemSettings, type SystemSettings } from './systemSettingsService';
import { formatDateTimeForReport } from '../utils/dateUtils';

/**
 * Serviço unificado para geraçéo de relaté³rios PDF e Excel
 * com branding da Quinta Nicy
 */

// Cache para logo e configurações
let cachedLogo: string | null = null;
let cachedSettings: SystemSettings | null = null;

/**
 * Converte cor hex para RGB
 */
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [16, 185, 129]; // Fallback para cor padréo da marca
};

/**
 * Obté©m cores da marca
 */
export const getBrandColors = (): { primary: string; secondary: string; primaryRgb: [number, number, number]; secondaryRgb: [number, number, number] } => {
  const primary = '#10b981'; // emerald-500
  const secondary = '#059669'; // emerald-600
  return {
    primary,
    secondary,
    primaryRgb: hexToRgb(primary),
    secondaryRgb: hexToRgb(secondary),
  };
};

/**
 * Carrega logo da empresa
 */
export const loadCompanyLogo = async (): Promise<string | null> => {
  if (cachedLogo) {
    return cachedLogo;
  }

  try {
    const settings = await getSystemSettings();
    cachedSettings = settings;
    
    // Preferir logo_light para relaté³rios (geralmente melhor contraste)
    const logoUrl = settings.logo_light || settings.logo_dark || settings.logo_icon;
    
    if (!logoUrl) {
      return null;
    }

    // Se for SVG, tentar converter para imagem
    if (logoUrl.endsWith('.svg')) {
      // Para SVG, vamos tentar carregar como imagem
      // jsPDF néo suporta SVG diretamente, entéo precisamos converter
      try {
        const response = await fetch(logoUrl);
        const svgText = await response.text();
        
        // Criar um canvas para converter SVG para PNG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const img = new Image();
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        
        return new Promise((resolve) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            cachedLogo = dataUrl;
            resolve(dataUrl);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
          };
          img.src = url;
        });
      } catch (error) {
        console.warn('Erro ao converter SVG para imagem:', error);
        return null;
      }
    } else {
      // Para PNG/JPG, carregar diretamente
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            cachedLogo = dataUrl;
            resolve(dataUrl);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
        return null;
      }
    }
  } catch (error) {
    console.warn('Erro ao carregar configurações do sistema:', error);
    return null;
  }
};

/**
 * Obté©m Informações da empresa
 */
export const getCompanyInfo = async (): Promise<{ name: string; website: string; email?: string; phone?: string; address?: string }> => {
  if (cachedSettings) {
    return {
      name: cachedSettings.company_name || 'Natur Erva',
      website: cachedSettings.company_website || 'https://natur-erva.co.mz',
      email: cachedSettings.company_email,
      phone: cachedSettings.company_phone,
      address: cachedSettings.company_address,
    };
  }

  const settings = await getSystemSettings();
  cachedSettings = settings;
  
  return {
    name: settings.company_name || 'Natur Erva',
    website: settings.company_website || 'https://natur-erva.co.mz',
    email: settings.company_email,
    phone: settings.company_phone,
    address: settings.company_address,
  };
};

/**
 * Adiciona cabeçalho ao PDF com logo e branding
 */
export const addPDFHeader = async (
  pdf: jsPDF,
  title: string,
  options?: {
    period?: string;
    filters?: Array<{ label: string; value: string }>;
    orientation?: 'portrait' | 'landscape';
  }
): Promise<number> => {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let yPos = margin;

  const colors = getBrandColors();
  const companyInfo = await getCompanyInfo();
  const logo = await loadCompanyLogo();

  // Logo no topo (esquerda)
  if (logo) {
    try {
      const logoWidth = 40;
      const logoHeight = 15;
      pdf.addImage(logo, 'PNG', margin, yPos, logoWidth, logoHeight);
      yPos += logoHeight + 5;
    } catch (error) {
      console.warn('Erro ao adicionar logo ao PDF:', error);
      // Continuar sem logo
    }
  } else {
    // Fallback: texto da empresa
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.primaryRgb);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyInfo.name, margin, yPos + 5);
    yPos += 8;
  }

  // Linha decorativa com cor da marca
  pdf.setDrawColor(...colors.primaryRgb);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pdfWidth - margin, yPos);
  yPos += 8;

  // Té­tulo do relaté³rio
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 0); // Preto
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, pdfWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // Informações do período e filtros
  if (options?.period) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60); // Cinza escuro
    pdf.text(`Peré­odo: ${options.period}`, pdfWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  if (options?.filters && options.filters.length > 0) {
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    options.filters.forEach((filter) => {
      pdf.text(`${filter.label}: ${filter.value}`, pdfWidth / 2, yPos, { align: 'center' });
      yPos += 4;
    });
  }

  // Informações da empresa (discretas)
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120); // Cinza claro
  pdf.setFont('helvetica', 'normal');
  pdf.text(companyInfo.website, pdfWidth - margin, yPos, { align: 'right' });
  yPos += 5;

  // Linha separadora antes do conteéºdo
  pdf.setDrawColor(...colors.primaryRgb);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pdfWidth - margin, yPos);
  yPos += 8;

  return yPos;
};

/**
 * Adiciona rodapé© ao PDF com numeraçéo de pé¡ginas
 */
export const addPDFFooter = (
  pdf: jsPDF,
  pageNumber: number,
  totalPages: number,
  options?: {
    showCompanyInfo?: boolean;
  }
): void => {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const colors = getBrandColors();

  // Linha decorativa acima do rodapé©
  pdf.setDrawColor(...colors.primaryRgb);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pdfHeight - 15, pdfWidth - margin, pdfHeight - 15);

  // Numeraçéo de pé¡ginas e data
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'normal');
  
  const footerText = `Pé¡gina ${pageNumber} de ${totalPages} - Gerado em ${formatDateTimeForReport(new Date())}`;
  pdf.text(footerText, pdfWidth / 2, pdfHeight - 8, { align: 'center' });

  // Informações da empresa (opcional)
  if (options?.showCompanyInfo) {
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Natur Erva', margin, pdfHeight - 8);
  }
};

/** Cor hex para ARGB (ExcelJS). */
const hexToArgb = (hex: string): string => {
  const h = hex.replace('#', '');
  return 'FF' + (h.length === 6 ? h : h.padStart(6, '0')).toUpperCase();
};

/**
 * Adiciona cabeçalho formatado ao Excel (ExcelJS)
 */
export const addExcelHeader = (
  worksheet: Worksheet,
  title: string,
  options?: {
    period?: string;
    filters?: Array<{ label: string; value: string }>;
    startRow?: number;
  }
): number => {
  const colors = getBrandColors();
  let currentRow = options?.startRow ?? 0;
  const primaryArgb = hexToArgb(colors.primary);

  // Título principal (mesclar células) – ExcelJS é 1-based
  const r = currentRow + 1;
  worksheet.mergeCells(r, 1, r, 11);
  const titleCell = worksheet.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  currentRow++;

  if (options?.period) {
    const pr = currentRow + 1;
    worksheet.mergeCells(pr, 1, pr, 11);
    const periodCell = worksheet.getCell(pr, 1);
    periodCell.value = `Período: ${options.period}`;
    periodCell.font = { size: 11 };
    periodCell.alignment = { horizontal: 'center' };
    currentRow++;
  }

  if (options?.filters && options.filters.length > 0) {
    for (const filter of options.filters) {
      const fr = currentRow + 1;
      worksheet.mergeCells(fr, 1, fr, 11);
      const filterCell = worksheet.getCell(fr, 1);
      filterCell.value = `${filter.label}: ${filter.value}`;
      filterCell.font = { size: 10 };
      filterCell.alignment = { horizontal: 'center' };
      currentRow++;
    }
  }

  currentRow++;
  return currentRow;
};

/**
 * Formata cabeçalhos de tabela no Excel com cores da marca (ExcelJS)
 */
export const formatExcelTableHeaders = (
  worksheet: Worksheet,
  headers: string[],
  startRow: number,
  startCol: number = 0
): void => {
  const colors = getBrandColors();
  const primaryArgb = hexToArgb(colors.primary);
  const secondaryArgb = hexToArgb(colors.secondary);
  const row = startRow + 1;

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(row, startCol + index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: secondaryArgb } },
      bottom: { style: 'thin', color: { argb: secondaryArgb } },
      left: { style: 'thin', color: { argb: secondaryArgb } },
      right: { style: 'thin', color: { argb: secondaryArgb } },
    };
  });
};

/**
 * Formata células de dados no Excel com bordas e alternância de cores (ExcelJS)
 */
export const formatExcelDataCells = (
  worksheet: Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  options?: {
    alternateRowColors?: boolean;
    numberFormat?: string;
  }
): void => {
  const borderStyle = {
    top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
  };

  for (let row = startRow; row <= endRow; row++) {
    const isEvenRow = (row - startRow) % 2 === 0;
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getCell(row + 1, col + 1);
      cell.border = borderStyle;
      if (options?.alternateRowColors && isEvenRow) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
      if (options?.numberFormat && typeof cell.value === 'number') {
        cell.numFmt = options.numberFormat;
      }
    }
  }
};

/**
 * Adiciona rodapé ao Excel (ExcelJS)
 */
export const addExcelFooter = async (
  worksheet: Worksheet,
  row: number,
  options?: {
    showCompanyInfo?: boolean;
  }
): Promise<number> => {
  const companyInfo = await getCompanyInfo();
  row++;
  const r = row + 1;

  const dateCell = worksheet.getCell(r, 1);
  dateCell.value = `Gerado em ${formatDateTimeForReport(new Date())}`;
  dateCell.font = { size: 9, italic: true };
  dateCell.alignment = { horizontal: 'left' };

  if (options?.showCompanyInfo) {
    const companyCell = worksheet.getCell(r, 6);
    companyCell.value = companyInfo.name;
    companyCell.font = { size: 9, italic: true };
    companyCell.alignment = { horizontal: 'right' };
  }

  return row;
};

/**
 * Calcula larguras proporcionais das colunas
 */
export const calculateColumnWidths = (
  availableWidth: number,
  proportions: number[]
): number[] => {
  const totalProportion = proportions.reduce((sum, prop) => sum + prop, 0);
  return proportions.map(prop => (prop / totalProportion) * availableWidth);
};

/**
 * Adiciona cabeçalho de tabela padronizado com cores da marca
 */
export const addPDFTableHeader = (
  pdf: jsPDF,
  headers: string[],
  colX: number[],
  yPos: number,
  margin: number,
  pdfWidth: number
): number => {
  const colors = getBrandColors();
  
  // Desenhar reté¢ngulo de fundo para cabeçalho
  pdf.setFillColor(...colors.primaryRgb);
  pdf.rect(margin, yPos - 4, pdfWidth - (margin * 2), 6, 'F');
  
  // Texto dos cabeçalhos em branco
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255); // Branco
  
  headers.forEach((header, index) => {
    if (colX[index] !== undefined) {
      pdf.text(header, colX[index], yPos);
    }
  });
  
  // Linha sob cabeçalho
  yPos += 3;
  pdf.setDrawColor(...colors.primaryRgb);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pdfWidth - margin, yPos);
  yPos += 5;
  
  return yPos;
};

/** Opções de estilo por coluna para addPDFTableRow (índice 0-based, rgb 0-255) */
export interface PDFTableRowColumnFill {
  colIndex: number;
  rgb: [number, number, number];
}

export interface PDFTableRowColumnTextColor {
  colIndex: number;
  rgb: [number, number, number];
}

/**
 * Adiciona linha de tabela com alternância de cores.
 * Suporta modo "relatório escuro": rowBackgroundRgb + textColorRgb + columnFillOverrides para colunas VALOR.
 */
export const addPDFTableRow = (
  pdf: jsPDF,
  data: string[],
  colX: number[],
  yPos: number,
  index: number,
  margin: number,
  pdfWidth: number,
  options?: {
    fontSize?: number;
    alternateColors?: boolean;
    rowBackgroundRgb?: [number, number, number];
    textColorRgb?: [number, number, number];
    columnFillOverrides?: PDFTableRowColumnFill[];
    columnTextColorOverrides?: PDFTableRowColumnTextColor[];
  }
): number => {
  const fontSize = options?.fontSize || 8;
  const alternateColors = options?.alternateColors !== false;
  const rowBg = options?.rowBackgroundRgb;
  const defaultTextColor = options?.textColorRgb ?? [0, 0, 0];
  const columnOverrides = options?.columnFillOverrides ?? [];
  const columnTextOverrides = options?.columnTextColorOverrides ?? [];
  const rowHeight = 4;

  // Larguras derivadas: colWidths[i] = colX[i+1] - colX[i]; última coluna = até margem direita
  const colWidths: number[] = colX.map((x, i) =>
    i < colX.length - 1 ? colX[i + 1] - colX[i] : pdfWidth - margin - colX[i]
  );

  // Fundo da linha inteira (modo escuro ou alternância)
  if (rowBg) {
    pdf.setFillColor(...rowBg);
    pdf.rect(margin, yPos - 3, pdfWidth - margin * 2, rowHeight, 'F');
  } else if (alternateColors) {
    const isEvenRow = index % 2 === 0;
    if (isEvenRow) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, yPos - 3, pdfWidth - margin * 2, rowHeight, 'F');
    }
  }

  // Overrides por coluna (ex.: VALOR em verde/rosa)
  columnOverrides.forEach(({ colIndex, rgb }) => {
    if (colX[colIndex] !== undefined && colWidths[colIndex] !== undefined) {
      pdf.setFillColor(...rgb);
      pdf.rect(colX[colIndex], yPos - 3, colWidths[colIndex], rowHeight, 'F');
    }
  });

  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', 'normal');

  const textColorMap = new Map(columnTextOverrides.map((o) => [o.colIndex, o.rgb]));

  data.forEach((cell, colIndex) => {
    if (colX[colIndex] !== undefined) {
      const cellColor = textColorMap.get(colIndex) ?? defaultTextColor;
      pdf.setTextColor(...cellColor);
      pdf.text(cell, colX[colIndex], yPos);
    }
  });

  yPos += 5;
  return yPos;
};

/**
 * Adiciona seçéo de resumo padronizada
 */
export const addPDFSummarySection = (
  pdf: jsPDF,
  title: string,
  items: Array<{ label: string; value: string }>,
  yPos: number,
  margin: number
): number => {
  const colors = getBrandColors();
  
  // Té­tulo da seçéo com cor da marca
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...colors.primaryRgb);
  pdf.text(title, margin, yPos);
  yPos += 6;
  
  // Itens do resumo
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0); // Preto
  
  items.forEach((item) => {
    pdf.text(`${item.label}: ${item.value}`, margin, yPos);
    yPos += 5;
  });
  
  yPos += 3;
  return yPos;
};

/**
 * Limpa cache (éºtil para testes ou quando configurações mudam)
 */
export const clearReportCache = (): void => {
  cachedLogo = null;
  cachedSettings = null;
};


