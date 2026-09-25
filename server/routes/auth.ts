import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { authMid, JWT_SECRET } from '../middleware';

export const authRouter = express.Router();

authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const u = getDb().prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any;
    if (!u || !bcrypt.compareSync(password, u.password)) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha inválidos' });
    }
    const token = jwt.sign({ id: u.id, name: u.name, role: u.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, data: { token, user: { id: u.id, name: u.name, email: u.email, role: u.role } } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

authRouter.get('/me', authMid, (req: any, res) => res.json({ success: true, data: req.user }));
