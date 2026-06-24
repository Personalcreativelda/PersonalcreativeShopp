import React, { useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Placeholder from '@tiptap/extension-placeholder';
import api from '../../core/services/apiClient';

// ── Extension: FontSize ────────────────────────────────────────────────────
import { Extension } from '@tiptap/core';
const FontSize = Extension.create({
 name: 'fontSize',
 addGlobalAttributes() {
 return [{
 types: ['textStyle'],
 attributes: {
 fontSize: {
 default: null,
 parseHTML: el => el.style.fontSize?.replace(/['"]+/g, '') || null,
 renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
 },
 },
 }];
 },
 addCommands() {
 return {
 setFontSize: (fontSize: string) => ({ chain }: any) =>
 chain().setMark('textStyle', { fontSize }).run(),
 unsetFontSize: () => ({ chain }: any) =>
 chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
 } as any;
 },
});

// ── Types ──────────────────────────────────────────────────────────────────
interface RichTextEditorProps {
 value: string;
 onChange: (html: string) => void;
 placeholder?: string;
}

// ── Toolbar button ─────────────────────────────────────────────────────────
const Btn: React.FC<{ active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode }> =
 ({ active, disabled, title, onClick, children }) => (
 <button
 type="button"
 title={title}
 disabled={disabled}
 onClick={onClick}
 className={`p-1.5 rounded text-sm transition-colors ${
 active
 ? 'bg-brand-600 text-white'
 : 'text-content-secondary hover:bg-surface-base'
 } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
 >
 {children}
 </button>
 );

const Div = () => <div className="w-px h-5 bg-surface-base mx-0.5" />;

// ── Main Editor ────────────────────────────────────────────────────────────
export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
 const imageInputRef = useRef<HTMLInputElement>(null);

 const editor = useEditor({
 extensions: [
 StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
 Underline,
 TextStyle,
 FontSize,
 FontFamily,
 Color,
 Highlight.configure({ multicolor: true }),
 TextAlign.configure({ types: ['heading', 'paragraph'] }),
 Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand-600 underline' } }),
 Image.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'max-w-full rounded-xl my-2' } }),
 Placeholder.configure({ placeholder: placeholder || 'Escreva o conteúdo do artigo...' }),
 ],
 content: value,
 onUpdate: ({ editor }) => onChange(editor.getHTML()),
 editorProps: {
 attributes: { class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3' },
 },
 });

 const uploadImage = useCallback(async (file: File) => {
 if (!editor) return;
 const reader = new FileReader();
 reader.onload = async (ev) => {
 const imageData = ev.target?.result as string;
 try {
 const res = await (api as any).post('/upload/base64', { imageData, folder: 'blog' });
 const url = res?.url || imageData;
 editor.chain().focus().setImage({ src: url }).run();
 } catch {
 // fallback: inserir base64 directamente
 editor.chain().focus().setImage({ src: imageData }).run();
 }
 };
 reader.readAsDataURL(file);
 }, [editor]);

 const setLink = useCallback(() => {
 if (!editor) return;
 const prev = editor.getAttributes('link').href;
 const url = window.prompt('URL do link:', prev || 'https://');
 if (url === null) return;
 if (!url) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
 editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
 }, [editor]);

 const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
 const FONTS = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
 const COLORS = ['#000000', '#374151', '#dc2626', '#16a34a', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#ffffff'];

 if (!editor) return null;

 return (
 <div className="border border-border-default rounded-xl overflow-hidden bg-surface-raised">
 {/* ── TOOLBAR ── */}
 <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border-default bg-surface-base">

 {/* Histórico */}
 <Btn title="Desfazer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↩</Btn>
 <Btn title="Refazer (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↪</Btn>
 <Div />

 {/* Formato de texto */}
 <select
 title="Parágrafo / Título"
 className="text-xs px-1.5 py-1 rounded border border-border-default bg-surface-raised text-content-secondary"
 value={
 editor.isActive('heading', { level: 1 }) ? 'h1' :
 editor.isActive('heading', { level: 2 }) ? 'h2' :
 editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
 }
 onChange={e => {
 const v = e.target.value;
 if (v === 'p') editor.chain().focus().setParagraph().run();
 else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) as any }).run();
 }}
 >
 <option value="p">Parágrafo</option>
 <option value="h1">Título 1</option>
 <option value="h2">Título 2</option>
 <option value="h3">Título 3</option>
 </select>

 {/* Família de fonte */}
 <select
 title="Fonte"
 className="text-xs px-1.5 py-1 rounded border border-border-default bg-surface-raised text-content-secondary"
 onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
 defaultValue=""
 >
 <option value="">Fonte</option>
 {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
 </select>

 {/* Tamanho */}
 <select
 title="Tamanho"
 className="text-xs px-1.5 py-1 rounded border border-border-default bg-surface-raised text-content-secondary"
 onChange={e => (editor as any).chain().focus().setFontSize(e.target.value).run()}
 defaultValue=""
 >
 <option value="">Tamanho</option>
 {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
 </select>

 <Div />

 {/* Negrito / Itálico / Sublinhado / Riscado */}
 <Btn active={editor.isActive('bold')} title="Negrito (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
 <Btn active={editor.isActive('italic')} title="Itálico (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
 <Btn active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
 <Btn active={editor.isActive('strike')} title="Riscado" onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
 <Btn active={editor.isActive('highlight')} title="Realçar" onClick={() => editor.chain().focus().toggleHighlight().run()}>🖊</Btn>

 <Div />

 {/* Cor do texto */}
 <span className="flex items-center gap-0.5">
 {COLORS.map(c => (
 <button
 key={c}
 type="button"
 title={`Cor: ${c}`}
 onClick={() => editor.chain().focus().setColor(c).run()}
 className="w-4 h-4 rounded border border-border-default"
 style={{ backgroundColor: c }}
 />
 ))}
 <input type="color" title="Cor personalizada"
 className="w-6 h-5 rounded border border-border-default cursor-pointer p-0"
 onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
 </span>

 <Div />

 {/* Alinhamento */}
 <Btn active={editor.isActive({ textAlign: 'left' })} title="Alinhar esquerda" onClick={() => editor.chain().focus().setTextAlign('left').run()}>⬅</Btn>
 <Btn active={editor.isActive({ textAlign: 'center' })} title="Centralizar" onClick={() => editor.chain().focus().setTextAlign('center').run()}>↔</Btn>
 <Btn active={editor.isActive({ textAlign: 'right' })} title="Alinhar direita" onClick={() => editor.chain().focus().setTextAlign('right').run()}>➡</Btn>
 <Btn active={editor.isActive({ textAlign: 'justify' })} title="Justificar" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>☰</Btn>

 <Div />

 {/* Listas */}
 <Btn active={editor.isActive('bulletList')} title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()}>• —</Btn>
 <Btn active={editor.isActive('orderedList')} title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. —</Btn>
 <Btn active={editor.isActive('blockquote')} title="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()}>" "</Btn>
 <Btn active={editor.isActive('code')} title="Código inline" onClick={() => editor.chain().focus().toggleCode().run()}>{`<>`}</Btn>
 <Btn active={editor.isActive('codeBlock')} title="Bloco de código" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{`{ }`}</Btn>

 <Div />

 {/* Link */}
 <Btn active={editor.isActive('link')} title="Inserir link" onClick={setLink}>🔗</Btn>

 {/* Imagem */}
 <Btn title="Inserir imagem" onClick={() => imageInputRef.current?.click()}>🖼</Btn>
 <input
 ref={imageInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }}
 />

 {/* Linha horizontal */}
 <Btn title="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Btn>

 {/* Limpar formatação */}
 <Btn title="Limpar formatação" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>✕</Btn>
 </div>

 {/* ── EDITOR AREA ── */}
 <EditorContent editor={editor} />

 {/* Contador de palavras */}
 <div className="px-4 py-1.5 border-t border-border-default text-xs text-content-muted text-right">
 {editor.getText().trim().split(/\s+/).filter(Boolean).length} palavras
 </div>
 </div>
 );
};

export default RichTextEditor;
