import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb, nextCode } from '../db';
import { authMid, requireRole } from '../middleware';
import { uid } from '../utils/id';
import { safeError } from '../utils/safeError';

export const entitiesRouter = express.Router();
entitiesRouter.use(authMid);

// Categories
entitiesRouter.get('/categories', (_req, res) => {
  try {
    res.json({ success: true, data: getDb().prepare('SELECT * FROM categories WHERE active = 1 ORDER BY name').all() });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.post('/categories', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    const id = uid('cat');
    getDb().prepare(`INSERT INTO categories (id,code,name,description,marginPercent) VALUES (?,?,?,?,?)`).run(
      id, nextCode('CAT'), req.body.name, req.body.description || '', req.body.marginPercent || 0
    );
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.put('/categories/:id', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name', 'description', 'marginPercent'] as const) {
      if (req.body[k] !== undefined) { f.push(`${k} = ?`); v.push(req.body[k]); }
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    getDb().prepare(`UPDATE categories SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.delete('/categories/:id', requireRole('admin', 'gerente'), (req, res) => {
  try {
    getDb().prepare('UPDATE categories SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

// Brands
entitiesRouter.get('/brands', (_req, res) => {
  try {
    res.json({ success: true, data: getDb().prepare('SELECT * FROM brands WHERE active = 1 ORDER BY name').all() });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.post('/brands', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    const id = uid('brd');
    getDb().prepare(`INSERT INTO brands (id,code,name) VALUES (?,?,?)`).run(id, nextCode('MRC'), req.body.name);
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.put('/brands/:id', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    if (req.body.name === undefined) return res.json({ success: true, data: null });
    getDb().prepare('UPDATE brands SET name = ? WHERE id = ?').run(req.body.name, req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.delete('/brands/:id', requireRole('admin', 'gerente'), (req, res) => {
  try {
    getDb().prepare('UPDATE brands SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

// Suppliers
entitiesRouter.get('/suppliers', (_req, res) => {
  try {
    res.json({ success: true, data: getDb().prepare('SELECT * FROM suppliers WHERE active = 1 ORDER BY name').all() });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.post('/suppliers', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    const id = uid('for');
    getDb().prepare(`INSERT INTO suppliers (id,code,name,cnpjCpf,phone,email) VALUES (?,?,?,?,?,?)`).run(
      id, nextCode('FOR'), req.body.name, req.body.cnpjCpf || '', req.body.phone || '', req.body.email || ''
    );
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.put('/suppliers/:id', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name', 'cnpjCpf', 'phone', 'email'] as const) {
      if (req.body[k] !== undefined) { f.push(`${k} = ?`); v.push(req.body[k]); }
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    getDb().prepare(`UPDATE suppliers SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
entitiesRouter.delete('/suppliers/:id', requireRole('admin', 'gerente'), (req, res) => {
  try {
    getDb().prepare('UPDATE suppliers SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

// Users
entitiesRouter.get('/users', requireRole('admin', 'gerente'), (_req, res) => {
  try {
    res.json({
      success: true,
      data: getDb().prepare('SELECT id,name,email,role,active FROM users ORDER BY name').all(),
    });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

entitiesRouter.post('/users', requireRole('admin'), (req: any, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Nome, e-mail e senha são obrigatórios' });
    }
    if (!['admin', 'gerente', 'caixa'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Perfil inválido' });
    }
    const exists = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) return res.status(400).json({ success: false, error: 'E-mail já cadastrado' });
    const id = uid('usr');
    getDb().prepare('INSERT INTO users (id,name,email,password,role,active) VALUES (?,?,?,?,?,1)').run(
      id, name, email, bcrypt.hashSync(password, 10), role
    );
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

entitiesRouter.put('/users/:id', requireRole('admin'), (req: any, res) => {
  try {
    const d = getDb();
    const u = d.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!u) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name', 'email', 'role', 'active'] as const) {
      if (req.body[k] !== undefined) {
        f.push(`${k} = ?`);
        v.push(k === 'active' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    if (req.body.password) {
      f.push('password = ?');
      v.push(bcrypt.hashSync(req.body.password, 10));
    }
    if (req.body.role !== undefined && !['admin', 'gerente', 'caixa'].includes(req.body.role)) {
      return res.status(400).json({ success: false, error: 'Perfil inválido' });
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    d.prepare(`UPDATE users SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

entitiesRouter.delete('/users/:id', requireRole('admin'), (req: any, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ success: false, error: 'Não é possível desativar o próprio usuário' });
    }
    getDb().prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
