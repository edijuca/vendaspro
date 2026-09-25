import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { authMid, JWT_SECRET } from '../middleware';
import { safeError } from '../utils/safeError';

export const authRouter = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});

authRouter.post('/login', loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    const u = getDb().prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any;
    if (!u || !bcrypt.compareSync(password, u.password)) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha inválidos' });
    }
    const token = jwt.sign({ id: u.id, name: u.name, role: u.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, data: { token, user: { id: u.id, name: u.name, email: u.email, role: u.role } } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

authRouter.get('/me', authMid, (req: any, res) => res.json({ success: true, data: req.user }));
