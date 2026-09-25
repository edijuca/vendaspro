/**
 * Normaliza texto para busca insensível a acentos, maiúsculas/minúsculas e aquiros.
 * Mesma lógica do SQLite (db.ts) — evita drift entre backend e frontend.
 */
export function fold(v: string): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
