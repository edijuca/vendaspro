/**
 * Erro seguro: registra detalhes no servidor mas devolve mensagem genérica ao cliente.
 * Evita vazar SQL errors, caminhos de arquivo, stack traces, etc.
 */
export function safeError(res: { status: (n: number) => { json: (body: unknown) => void } }, status: number, message: string, debug?: string) {
  if (debug) console.error(`[VendasPRO API] ${status} ${message}`, debug);
  res.status(status).json({ success: false, error: message });
}
