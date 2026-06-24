/**
 * Utilitários para geração e validação de slugs amigáveis para URLs
 */

/**
 * Remove acentos de uma string
 */
function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Gera um slug amigável a partir de um texto
 * @param text - Texto a ser convertido em slug
 * @returns Slug amigável (ex: "tu-podes", "1-introducao")
 */
export function generateSlug(text: string): string {
  if (!text) return '';
  
  // Converter para lowercase
  let slug = text.toLowerCase();
  
  // Remover acentos
  slug = removeAccents(slug);
  
  // Substituir espaços e underscores por hífens
  slug = slug.replace(/[\s_]+/g, '-');
  
  // Remover caracteres especiais, manter apenas letras, números e hífens
  slug = slug.replace(/[^a-z0-9-]/g, '');
  
  // Remover múltiplos hífens consecutivos
  slug = slug.replace(/-+/g, '-');
  
  // Remover hífens no início e fim
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
}

/**
 * Valida se um slug tem formato válido
 * @param slug - Slug a ser validado
 * @returns true se o slug é válido
 */
export function validateSlug(slug: string): boolean {
  if (!slug || slug.length === 0) return false;
  
  // Deve conter apenas letras minúsculas, números e hífens
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) return false;
  
  // Não deve começar ou terminar com hífen
  if (slug.startsWith('-') || slug.endsWith('-')) return false;
  
  // Não deve ter hífens consecutivos
  if (slug.includes('--')) return false;
  
  return true;
}

/**
 * Garante que um slug seja único adicionando um sufixo numérico se necessário
 * @param baseSlug - Slug base
 * @param existingSlugs - Array de slugs já existentes
 * @returns Slug único
 */
export function ensureUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }
  
  let counter = 1;
  let uniqueSlug = `${baseSlug}-${counter}`;
  
  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }
  
  return uniqueSlug;
}

/**
 * Gera slug para um capítulo no formato: {chapterNumber}-{slugifiedTitle}
 * @param chapterNumber - Número do capítulo
 * @param title - Título do capítulo
 * @returns Slug no formato "1-introducao"
 */
export function generateChapterSlug(chapterNumber: number, title: string): string {
  const titleSlug = generateSlug(title);
  return `${chapterNumber}-${titleSlug}`;
}

/**
 * Detecta se uma string é um UUID
 * @param str - String a ser verificada
 * @returns true se for um UUID
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
