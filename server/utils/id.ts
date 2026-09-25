/**
 * Gera IDs únicos usando UUID v4.
 * Substitui a abordagem insegura `prd-${Date.now()}` / `mov-${Date.now()}-${Math.random()}`.
 */
export function uid(prefix: string): string {
  const u = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${u.replace(/-/g, '').slice(0, 24)}`;
}
