import React, { useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { getApiToken } from '../../../core/services/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3060/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ImportRow {
 nome: string;
 categoria?: string;
 unidade?: string;
 preco_venda?: string;
 preco_custo?: string;
 stock?: string;
 stock_minimo?: string;
 barcode?: string;
 image?: string;
 image2?: string;
 image3?: string;
 image4?: string;
 mostrar_na_loja?: string;
 descricao?: string;
 descricao_longa?: string;
 beneficios?: string;
 como_usar?: string;
 ingredientes?: string;
 variante_nome?: string;
 variante_preco_venda?: string;
 variante_preco_custo?: string;
 variante_stock?: string;
 variante_padrao?: string;
}

interface ImportResult {
 imported: number;
 skipped: number;
 errors: Array<{ nome: string; reason: string }>;
}

interface Props {
 open: boolean;
 onClose: () => void;
 onSuccess: () => void;
 showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// ── Colunas da planilha ───────────────────────────────────────────────────────

const COLUMNS = [
 { key: 'nome', header: 'nome', width: 32, note: '* Obrigatório' },
 { key: 'categoria', header: 'categoria', width: 22 },
 { key: 'unidade', header: 'unidade', width: 12, note: 'Ex: un, kg, l, cx' },
 { key: 'preco_venda', header: 'preco_venda', width: 16 },
 { key: 'preco_custo', header: 'preco_custo', width: 16 },
 { key: 'stock', header: 'stock', width: 12 },
 { key: 'stock_minimo', header: 'stock_minimo', width: 14 },
 { key: 'barcode', header: 'barcode', width: 20, note: 'Código de barras (EAN-13 recomendado)' },
 { key: 'image', header: 'image', width: 50, note: 'URL da imagem principal' },
 { key: 'image2', header: 'image2', width: 50 },
 { key: 'image3', header: 'image3', width: 50 },
 { key: 'image4', header: 'image4', width: 50 },
 { key: 'mostrar_na_loja', header: 'mostrar_na_loja', width: 16, note: 'Sim ou Nao' },
 { key: 'descricao', header: 'descricao', width: 40 },
 { key: 'descricao_longa', header: 'descricao_longa', width: 40 },
 { key: 'beneficios', header: 'beneficios', width: 40 },
 { key: 'como_usar', header: 'como_usar', width: 40 },
 { key: 'ingredientes', header: 'ingredientes', width: 40 },
 { key: 'variante_nome', header: 'variante_nome', width: 24, note: 'Deixar vazio para produto fixo' },
 { key: 'variante_preco_venda', header: 'variante_preco_venda', width: 20 },
 { key: 'variante_preco_custo', header: 'variante_preco_custo', width: 20 },
 { key: 'variante_stock', header: 'variante_stock', width: 16 },
 { key: 'variante_padrao', header: 'variante_padrao', width: 16, note: 'Sim ou Nao (só 1 por produto)' },
];

const EXAMPLE_ROWS: ImportRow[] = [
 {
 nome: 'Aloe Vera Gel',
 categoria: 'Cosmética Natural',
 unidade: 'un',
 preco_venda: '1360',
 preco_custo: '680',
 stock: '50',
 stock_minimo: '5',
 barcode: '2001234567890',
 mostrar_na_loja: 'Sim',
 descricao: 'Gel puro de Aloe Vera',
 beneficios: 'Hidratante e regenerador',
 como_usar: 'Aplicar na pele limpa',
 ingredientes: 'Aloe Barbadensis',
 },
 {
 nome: 'Collagène',
 categoria: 'Suplementos Naturais',
 unidade: 'un',
 mostrar_na_loja: 'Sim',
 barcode: '2009876543210',
 descricao: 'Colágeno hidrolisado',
 variante_nome: '60 Cápsulas',
 variante_preco_venda: '4850',
 variante_preco_custo: '2400',
 variante_stock: '60',
 variante_padrao: 'Sim',
 },
 {
 nome: 'Collagène',
 variante_nome: '120 Cápsulas',
 variante_preco_venda: '8500',
 variante_preco_custo: '4200',
 variante_stock: '40',
 variante_padrao: 'Nao',
 },
];

// ── Gerar template Excel ──────────────────────────────────────────────────────

async function downloadTemplate() {
 const wb = new ExcelJS.Workbook();

 // ── Folha principal ─────────────────────────────────────────────────────────
 const ws = wb.addWorksheet('Produtos');

 ws.columns = COLUMNS.map(c => ({ key: c.key, header: c.header, width: c.width }));

 // Estilo do cabeçalho
 ws.getRow(1).eachCell(cell => {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065f46' } };
 cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
 cell.border = { bottom: { style: 'thin', color: { argb: 'FF047857' } } };
 cell.alignment = { horizontal: 'center', vertical: 'middle' };
 });
 ws.getRow(1).height = 24;

 // Colunas de variantes em azul escuro
 const variantCols = ['variante_nome', 'variante_preco_venda', 'variante_preco_custo', 'variante_stock', 'variante_padrao'];
 variantCols.forEach(key => {
 const colIdx = COLUMNS.findIndex(c => c.key === key) + 1;
 if (colIdx > 0) {
 ws.getColumn(colIdx).header = key;
 ws.getRow(1).getCell(colIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
 }
 });

 // Linhas de exemplo
 EXAMPLE_ROWS.forEach((row, i) => {
 const r = ws.addRow(COLUMNS.map(c => (row as any)[c.key] ?? ''));
 r.eachCell(cell => {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF0fdf4' : 'FFFFFFFF' } };
 cell.font = { size: 10 };
 cell.alignment = { vertical: 'middle' };
 });
 r.height = 20;
 });

 // Congelar cabeçalho
 ws.views = [{ state: 'frozen', ySplit: 1 }];

 // ── Folha de instruções ─────────────────────────────────────────────────────
 const wi = wb.addWorksheet('Instruções');
 wi.getColumn(1).width = 80;

 const lines = [
 ['GUIA DE PREENCHIMENTO DA PLANILHA DE PRODUTOS', true],
 [''],
 ['CAMPOS OBRIGATÓRIOS', true],
 [' • nome — Nome do produto (obrigatório em todas as linhas)'],
 [''],
 ['PRODUTO FIXO (sem variações)', true],
 [' Preencha: nome, categoria, unidade, preco_venda, preco_custo, stock, stock_minimo, mostrar_na_loja'],
 [' Deixe as colunas variante_* em branco.'],
 [''],
 ['PRODUTO COM VARIAÇÕES', true],
 [' • Use uma linha por variação, repetindo o nome do produto em cada linha.'],
 [' • Preencha variante_nome, variante_preco_venda, variante_preco_custo, variante_stock.'],
 [' • Marque variante_padrao = "Sim" em apenas UMA variação por produto.'],
 [' • Campos como barcode, image, categoria só precisam ser preenchidos na 1ª linha do produto.'],
 [''],
 ['CÓDIGO DE BARRAS (barcode)', true],
 [' • Formato recomendado: EAN-13 (13 dígitos). Ex: 2001234567890'],
 [' • Se deixar em branco, pode gerar automaticamente na página de Etiquetas.'],
 [' • O código é atribuído ao produto e permite leitura por scanner.'],
 [''],
 ['IMAGENS (image, image2, image3, image4)', true],
 [' • Preencha com a URL completa da imagem. Ex: https://cdn.exemplo.com/imagem.jpg'],
 [' • Aceita URLs do MinIO ou qualquer URL pública acessível.'],
 [' • image = imagem principal; image2/3/4 = imagens adicionais.'],
 [''],
 ['VALORES BOOLEANOS', true],
 [' • Sim / Nao (ou Yes/No, 1/0, True/False)'],
 [''],
 ['PREÇOS E STOCK', true],
 [' • Use ponto (.) ou vírgula (,) como separador decimal. Ex: 1360.50 ou 1360,50'],
 [''],
 ['DICAS', true],
 [' • Produtos com o mesmo nome já existente serão ignorados (não duplicados).'],
 [' • É possível importar centenas de produtos de uma só vez.'],
 [' • Use "Exportar" para baixar todos os produtos actuais e ver o formato correcto.'],
 ];

 lines.forEach(([text, bold]) => {
 const row = wi.addRow([text]);
 if (bold) {
 row.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF065f46' } };
 } else {
 row.getCell(1).font = { size: 10 };
 }
 row.height = 18;
 });

 // Download
 const buffer = await wb.xlsx.writeBuffer();
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'template_produtos_naturerva.xlsx';
 a.click();
 URL.revokeObjectURL(url);
}

// ── Parser de ficheiro Excel ──────────────────────────────────────────────────

async function parseExcelFile(file: File): Promise<ImportRow[]> {
 const buffer = await file.arrayBuffer();
 const wb = new ExcelJS.Workbook();
 await wb.xlsx.load(buffer);

 const ws = wb.worksheets[0];
 if (!ws) throw new Error('Ficheiro Excel sem folhas');

 const headers: string[] = [];
 const rows: ImportRow[] = [];

 ws.eachRow((row, rowNum) => {
 if (rowNum === 1) {
 row.eachCell({ includeEmpty: true }, cell => {
 const v = cell.value;
 let text = '';
 if (v && typeof v === 'object') {
 if ('richText' in v) text = (v as any).richText.map((t: any) => t.text).join('');
 else if ('result' in v) text = String((v as any).result);
 else text = String(v);
 } else if (v != null) {
 text = String(v);
 }
 headers.push(text.toLowerCase().trim());
 });
 return;
 }

 const obj: Record<string, string> = {};
 let hasData = false;
 row.eachCell({ includeEmpty: true }, (cell, colNum) => {
 const header = headers[colNum - 1];
 if (!header) return;
 const v = cell.value;
 let text = '';
 if (v && typeof v === 'object') {
 if ('richText' in v) text = (v as any).richText.map((t: any) => t.text).join('');
 else if ('result' in v) text = String((v as any).result ?? '');
 else text = String(v);
 } else if (v != null) {
 text = String(v);
 }
 obj[header] = text.trim();
 if (text.trim()) hasData = true;
 });

 if (hasData && obj['nome']) rows.push(obj as unknown as ImportRow);
 });

 return rows;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'results';

export const ProductImportModal: React.FC<Props> = ({ open, onClose, onSuccess, showToast }) => {
 const [step, setStep] = useState<Step>('upload');
 const [rows, setRows] = useState<ImportRow[]>([]);
 const [filename, setFilename] = useState('');
 const [importing, setImporting] = useState(false);
 const [result, setResult] = useState<ImportResult | null>(null);
 const [dragOver, setDragOver] = useState(false);
 const fileRef = useRef<HTMLInputElement>(null);

 const reset = () => {
 setStep('upload');
 setRows([]);
 setFilename('');
 setResult(null);
 setImporting(false);
 };

 const handleClose = () => { reset(); onClose(); };

 const handleFile = async (file: File) => {
 if (!file.name.match(/\.(xlsx|xls)$/i)) {
 showToast('Apenas ficheiros .xlsx são suportados', 'error');
 return;
 }
 try {
 const parsed = await parseExcelFile(file);
 if (parsed.length === 0) {
 showToast('Nenhuma linha com dados encontrada no ficheiro', 'warning');
 return;
 }
 setRows(parsed);
 setFilename(file.name);
 setStep('preview');
 } catch (err: any) {
 showToast('Erro ao ler ficheiro: ' + err.message, 'error');
 }
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 setDragOver(false);
 const file = e.dataTransfer.files[0];
 if (file) handleFile(file);
 };

 const handleImport = async () => {
 setImporting(true);
 try {
 const token = getApiToken();
 const headers: Record<string, string> = { 'Content-Type': 'application/json' };
 if (token) headers['Authorization'] = `Bearer ${token}`;

 const res = await fetch(`${API_BASE}/import/products`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ rows }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Erro ao importar');

 setResult(data);
 setStep('results');
 if (data.imported > 0) onSuccess();
 } catch (err: any) {
 showToast('Erro: ' + err.message, 'error');
 } finally {
 setImporting(false);
 }
 };

 if (!open) return null;

 // Resumo de produtos únicos no preview
 const uniqueProducts = [...new Set(rows.map(r => r.nome))];

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
 <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
 <div className="flex items-center gap-3">
 <FileSpreadsheet className="w-6 h-6 text-green-600" />
 <div>
 <h2 className="text-lg font-bold text-content-primary">Importar Produtos via Planilha</h2>
 <p className="text-xs text-content-muted">
 {step === 'upload' && 'Faça download do template, preencha e importe'}
 {step === 'preview' && `${uniqueProducts.length} produto(s) encontrado(s) em "${filename}"`}
 {step === 'results' && 'Resultado da importação'}
 </p>
 </div>
 </div>
 <button onClick={handleClose} className="p-2 rounded-lg hover:bg-surface-base transition-colors">
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Steps indicator */}
 <div className="flex items-center gap-2 px-6 pt-4 text-xs text-content-muted">
 {(['upload', 'preview', 'results'] as Step[]).map((s, i) => (
 <React.Fragment key={s}>
 <span className={`px-2 py-0.5 rounded-full font-medium ${step === s ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'text-content-muted'}`}>
 {i + 1}. {s === 'upload' ? 'Upload' : s === 'preview' ? 'Pré-visualização' : 'Resultado'}
 </span>
 {i < 2 && <ChevronRight className="w-3 h-3" />}
 </React.Fragment>
 ))}
 </div>

 {/* Body */}
 <div className="flex-1 overflow-y-auto p-6">

 {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
 {step === 'upload' && (
 <div className="space-y-6">
 {/* Download template */}
 <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
 <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">1. Descarregue o Template</h3>
 <p className="text-sm text-green-700 dark:text-green-400 mb-3">
 O template já contém os cabeçalhos correctos e exemplos de produtos fixos e com variações.
 </p>
 <button
 onClick={downloadTemplate}
 className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Download className="w-4 h-4" />
 Descarregar Template Excel
 </button>
 </div>

 {/* Upload zone */}
 <div>
 <h3 className="font-semibold text-content-primary mb-3">2. Carregue a Planilha Preenchida</h3>
 <div
 onDragOver={e => { e.preventDefault(); setDragOver(true); }}
 onDragLeave={() => setDragOver(false)}
 onDrop={handleDrop}
 onClick={() => fileRef.current?.click()}
 className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
 dragOver
 ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
 : 'border-border-default hover:border-green-400 hover:bg-surface-base'
 }`}
 >
 <Upload className="w-10 h-10 mx-auto mb-3 text-content-muted" />
 <p className="text-sm font-medium text-content-secondary">
 Arraste o ficheiro aqui ou clique para seleccionar
 </p>
 <p className="text-xs text-content-muted mt-1">Suporta .xlsx</p>
 <input
 ref={fileRef}
 type="file"
 accept=".xlsx,.xls"
 className="hidden"
 onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
 />
 </div>
 </div>

 {/* Instructions */}
 <div className="bg-surface-base rounded-xl p-4 text-sm text-content-secondary space-y-1">
 <p className="font-medium text-content-secondary mb-2">Regras importantes:</p>
 <p>• A coluna <code className="bg-surface-base px-1 rounded">nome</code> é obrigatória em todas as linhas.</p>
 <p>• Para produto <strong>fixo</strong>: deixe as colunas <code className="bg-surface-base px-1 rounded">variante_*</code> em branco.</p>
 <p>• Para produto com <strong>variações</strong>: repita o nome em múltiplas linhas, uma por variação.</p>
 <p>• Produtos com o mesmo nome já existente serão <strong>ignorados</strong> (não duplicados).</p>
 <p>• Imagens são adicionadas manualmente após a importação.</p>
 </div>
 </div>
 )}

 {/* ── STEP 2: Preview ────────────────────────────────────────────── */}
 {step === 'preview' && (
 <div className="space-y-4">
 <div className="flex items-center gap-4 text-sm">
 <span className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-3 py-1 rounded-full font-medium">
 {uniqueProducts.length} produto(s) únicos
 </span>
 <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-3 py-1 rounded-full font-medium">
 {rows.length} linha(s) total
 </span>
 <button
 onClick={() => { reset(); setStep('upload'); }}
 className="ml-auto text-content-muted hover:text-content-secondary underline text-xs"
 >
 Carregar outro ficheiro
 </button>
 </div>

 <div className="overflow-x-auto rounded-xl border border-border-default">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-surface-base">
 {['Nome', 'Categoria', 'Unidade', 'Preço Venda', 'Preço Custo', 'Stock', 'Barcode', 'Imagem', 'Variante', 'V. Preço', 'V. Padrão'].map(h => (
 <th key={h} className="px-3 py-2 text-left font-semibold text-content-secondary whitespace-nowrap">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
 {rows.slice(0, 50).map((row, i) => (
 <tr key={i} className={i % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-base/50'}>
 <td className="px-3 py-1.5 font-medium text-content-primary">{row.nome}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.categoria || '—'}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.unidade || 'un'}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.preco_venda || '—'}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.preco_custo || '—'}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.stock || '—'}</td>
 <td className="px-3 py-1.5 font-mono text-xs text-content-secondary">{row.barcode || '—'}</td>
 <td className="px-3 py-1.5 text-content-muted max-w-[120px] truncate text-xs" title={row.image}>{row.image ? '✓ URL' : '—'}</td>
 <td className="px-3 py-1.5 text-blue-700 dark:text-blue-400">{row.variante_nome || '—'}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.variante_preco_venda || '—'}</td>
 <td className="px-3 py-1.5 text-content-secondary">{row.variante_padrao || '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 {rows.length > 50 && (
 <p className="text-xs text-center text-content-muted py-2">
 A mostrar 50 de {rows.length} linhas
 </p>
 )}
 </div>
 </div>
 )}

 {/* ── STEP 3: Results ────────────────────────────────────────────── */}
 {step === 'results' && result && (
 <div className="space-y-4">
 {/* Summary cards */}
 <div className="grid grid-cols-3 gap-4">
 <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center border border-green-200 dark:border-green-800">
 <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
 <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.imported}</p>
 <p className="text-sm text-green-600 dark:text-green-400">Importados</p>
 </div>
 <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center border border-yellow-200 dark:border-yellow-800">
 <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
 <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{result.skipped}</p>
 <p className="text-sm text-yellow-600 dark:text-yellow-400">Ignorados (já existiam)</p>
 </div>
 <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center border border-red-200 dark:border-red-800">
 <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
 <p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.errors.length - result.skipped}</p>
 <p className="text-sm text-red-500 dark:text-red-400">Erros</p>
 </div>
 </div>

 {/* Error list */}
 {result.errors.length > 0 && (
 <div>
 <h4 className="font-semibold text-content-secondary mb-2 text-sm">Detalhes:</h4>
 <div className="max-h-48 overflow-y-auto rounded-xl border border-border-default">
 {result.errors.map((e, i) => (
 <div key={i} className="flex items-start gap-2 px-4 py-2 border-b border-border-default last:border-0">
 <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
 <div className="text-xs">
 <span className="font-medium text-content-primary">{e.nome}</span>
 <span className="text-content-muted ml-2">— {e.reason}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between px-6 py-4 border-t border-border-default bg-surface-base/50">
 <button
 onClick={handleClose}
 className="px-4 py-2 text-sm text-content-secondary hover:bg-surface-base rounded-lg transition-colors"
 >
 {step === 'results' ? 'Fechar' : 'Cancelar'}
 </button>

 <div className="flex items-center gap-3">
 {step === 'preview' && (
 <button
 onClick={handleImport}
 disabled={importing || rows.length === 0}
 className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
 >
 {importing ? (
 <>
 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
 A importar...
 </>
 ) : (
 <>
 <Upload className="w-4 h-4" />
 Importar {uniqueProducts.length} produto(s)
 </>
 )}
 </button>
 )}

 {step === 'results' && result && result.imported > 0 && (
 <button
 onClick={() => { reset(); }}
 className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 Importar mais
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};
