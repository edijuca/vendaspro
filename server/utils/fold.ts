/**
 * Normaliza texto para busca insensível a acentos, maiúsculas/minúsculas e aquiros.
 * Mesma lógica usada no SQLite (db.ts) e replicada aqui para uso no JS (frontend e rotas).
 */
export function fold(v: string): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Escape para LIKE com o caractere de escape `\`.
 * Uso: fold(search).replace(/[\\\\%_]/g, '\\\\$&')
 */
export function escapeLike(v: string): string {
  return fold(v).replace(/[\\\\%_]/g, '\\\\$&');
}
