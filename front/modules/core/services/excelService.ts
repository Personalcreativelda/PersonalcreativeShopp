/**
 * Serviço de exportação/importação Excel usando ExcelJS.
 * Substitui a biblioteca xlsx (SheetJS) para evitar vulnerabilidades conhecidas.
 */

import ExcelJS from 'exceljs';

export type Workbook = ExcelJS.Workbook;
export type Worksheet = ExcelJS.Worksheet;

/**
 * Cria um novo livro Excel.
 */
export function createWorkbook(): Workbook {
  return new ExcelJS.Workbook();
}

/**
 * Adiciona uma folha ao livro e devolve a Worksheet.
 */
export function addWorksheet(workbook: Workbook, sheetName: string): Worksheet {
  return workbook.addWorksheet(sheetName, { headerFooter: { firstHeader: '', firstFooter: '' } });
}

export interface AddRowsFromJsonOptions {
  skipHeader?: boolean;
  startRow?: number;
}

/**
 * Adiciona linhas a uma folha a partir de um array de objetos.
 * As chaves do primeiro objeto definem as colunas.
 */
export function addRowsFromJson(
  worksheet: Worksheet,
  data: Record<string, unknown>[],
  options: AddRowsFromJsonOptions = {}
): void {
  if (data.length === 0) return;

  const keys = Object.keys(data[0]);
  const startRow = options.startRow ?? 1;

  const rowData = data.map((obj) => {
    const row: Record<string, unknown> = {};
    keys.forEach((k) => {
      row[k] = obj[k] ?? '';
    });
    return row;
  });

  if (options.startRow != null && options.startRow > 1) {
    rowData.forEach((row, i) => {
      const r = worksheet.getRow(options.startRow! + i);
      keys.forEach((key, colIndex) => {
        r.getCell(colIndex + 1).value = row[key];
      });
      r.commit();
    });
  } else {
    if (!options.skipHeader) {
      worksheet.columns = keys.map((k) => ({ header: k, key: k, width: 16 }));
    }
    worksheet.addRows(rowData);
  }
}

/**
 * Adiciona dados JSON a uma folha a partir de uma célula de origem (para relatórios com cabeçalho).
 * Equivalente a XLSX.utils.sheet_add_json com origin.
 */
export function addJsonToSheetAt(
  worksheet: Worksheet,
  data: Record<string, unknown>[],
  startRow: number,
  startCol: number = 1,
  options: { skipHeader?: boolean } = {}
): void {
  if (data.length === 0) return;

  const keys = Object.keys(data[0]);

  data.forEach((obj, i) => {
    const rowNum = startRow + i;
    const r = worksheet.getRow(rowNum);
    keys.forEach((key, colIndex) => {
      r.getCell(startCol + colIndex).value = obj[key] ?? '';
    });
    r.commit();
  });
}

/** Cores para tabela de stock (relatório) — fundos claros, texto escuro */
const STOCK_TABLE_COLORS = {
  headerBg: 'FFd1fae5',       // verde claro
  rowBg: 'FFFFFFFF',           // branco
  rowAlt: 'FFF3f4f6',          // cinza muito claro (alternado)
  valorGreen: 'FFd1fae5',
  valorPink: 'FFfce7f3',
  totalsBg: 'FFe5e7eb',       // cinza claro para linha de totais
  fontDark: 'FF000000',
};

/** Cores para relatório de stock (cabeçalho igual à UI: emerald-800 + branco) */
const STOCK_REPORT_COLORS = {
  headerBg: 'FF065f46',       // emerald-800 (igual à UI)
  headerFont: 'FFFFFFFF',     // branco
  rowBg: 'FFFFFFFF',
  rowAlt: 'FFF3f4f6',
  valorGreen: 'FFd1fae5',
  totalsBg: 'FFe5e7eb',
  fontDark: 'FF000000',
};

export interface ApplyStockReportStyleOptions {
  titleRow: number;
  headerRow: number;
  totalRow: number;
  valorColumnIndices: number[];
  numCols: number;
}

/**
 * Aplica estilo ao relatório de stock: título, cabeçalho verde escuro com texto branco,
 * linhas de dados com colunas VALOR a verde claro, linha de totais em destaque.
 */
export function applyStockReportStyle(worksheet: Worksheet, options: ApplyStockReportStyleOptions): void {
  const { titleRow, headerRow, totalRow, valorColumnIndices, numCols } = options;
  const valorSet = new Set(valorColumnIndices);

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (colNumber > numCols) return;
      if (rowNumber === titleRow) {
        cell.font = { bold: true, size: 12, color: { argb: STOCK_REPORT_COLORS.fontDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      } else if (rowNumber === headerRow) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STOCK_REPORT_COLORS.headerBg } };
        cell.font = { color: { argb: STOCK_REPORT_COLORS.headerFont }, bold: true };
      } else if (rowNumber === totalRow) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STOCK_REPORT_COLORS.totalsBg } };
        cell.font = { color: { argb: STOCK_REPORT_COLORS.fontDark }, bold: true };
      } else {
        const isValorCol = valorSet.has(colNumber);
        const rowBg = rowNumber % 2 === 0 ? STOCK_REPORT_COLORS.rowAlt : STOCK_REPORT_COLORS.rowBg;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isValorCol ? STOCK_REPORT_COLORS.valorGreen : rowBg },
        };
        cell.font = { color: { argb: STOCK_REPORT_COLORS.fontDark }, bold: false };
      }
      cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'right' };
    });
    row.commit();
  });
}

/**
 * Aplica estilo à tabela de stock no Excel: cabeçalho e linhas com fundos claros,
 * colunas VALOR (5 e 11) verde claro, colunas VALOR (7 e 9) rosa claro.
 * Última linha tratada como totais (fundo cinza claro, negrito).
 * Colunas 1–3 alinhadas à esquerda, 4–11 à direita.
 */
export function applyStockTableStyle(worksheet: Worksheet): void {
  const rowCount = worksheet.rowCount;
  worksheet.eachRow((row, rowNumber) => {
    const isHeader = rowNumber === 1;
    const isTotals = rowNumber === rowCount && rowCount > 1;
    row.eachCell((cell, colNumber) => {
      if (isHeader) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STOCK_TABLE_COLORS.headerBg } };
        cell.font = { color: { argb: STOCK_TABLE_COLORS.fontDark }, bold: true };
      } else if (isTotals) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STOCK_TABLE_COLORS.totalsBg } };
        cell.font = { color: { argb: STOCK_TABLE_COLORS.fontDark }, bold: true };
      } else {
        const isValorGreen = colNumber === 5 || colNumber === 11;
        const isValorPink = colNumber === 7 || colNumber === 9;
        const rowBg = rowNumber % 2 === 0 ? STOCK_TABLE_COLORS.rowAlt : STOCK_TABLE_COLORS.rowBg;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: isValorGreen ? STOCK_TABLE_COLORS.valorGreen : isValorPink ? STOCK_TABLE_COLORS.valorPink : rowBg,
          },
        };
        cell.font = { color: { argb: STOCK_TABLE_COLORS.fontDark }, bold: false };
      }
      cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'right' };
    });
    row.commit();
  });
}

/**
 * Escreve o livro para um ficheiro e dispara o download no browser.
 */
export async function writeWorkbookToFile(workbook: Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lê um ficheiro Excel (ArrayBuffer) e devolve o conteúdo da primeira folha em formato CSV.
 * Usado para importação (ex.: Sales) que depois faz parse do CSV.
 */
export async function readWorkbookToCsv(arrayBuffer: ArrayBuffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return '';

  const rows: string[] = [];
  worksheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      let text = '';
      if (v != null && typeof v === 'object') {
        if ('result' in v) text = String((v as { result: unknown }).result);
        else if ('richText' in v) {
          const rt = (v as { richText: Array<{ text: string }> }).richText;
          text = rt.map((t) => t.text).join('');
        } else text = String(v);
      } else if (v != null) {
        text = String(v);
      }
      cells.push(text.replace(/"/g, '""'));
    });
    rows.push(cells.map((c) => `"${c}"`).join(','));
  });

  return rows.join('\n');
}
