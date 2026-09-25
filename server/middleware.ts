import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

function resolveSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    const file = path.resolve(process.cwd(), '.jwt_secret');
    const s = fs.readFileSync(file, 'utf8').trim();
    if (s) return s;
  } catch { /* arquivo inexistente */ }
  throw new Error('JWT_SECRET não definida — defina a env ou crie .jwt_secret (iniciar.bat gera)');
}

export const JWT_SECRET = resolveSecret();

export function authMid(req: any, res: any, next: any) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ success: false, error: 'Não autorizado' });
  try {
    req.user = jwt.verify(h.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Sem permissão para esta operação' });
    }
    next();
  };
}
