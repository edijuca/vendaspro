import express from 'express';
import { getDb } from '../db';
import { authMid, requireRole } from '../middleware';

export const promotionsRouter = express.Router();
promotionsRouter.use(authMid);

promotionsRouter.get('/', (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === '1';
    const data = getDb().prepare(`
      SELECT pr.*, p.name as productName, p.price as productPrice
      FROM promotions pr
      LEFT JOIN products p ON p.id = pr.productId
      WHERE ${includeInactive ? '1=1' : 'pr.active = 1'}
      ORDER BY pr.startDate DESC
    `).all();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

promotionsRouter.get('/active', (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = getDb().prepare(`
      SELECT pr.*, p.name as productName, p.price as productPrice
      FROM promotions pr
      LEFT JOIN products p ON p.id = pr.productId
      WHERE pr.active = 1 AND pr.startDate <= ? AND pr.endDate >= ?
      ORDER BY pr.name
    `).all(today, today);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

promotionsRouter.post('/', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const { name, productId, discountType, discountValue, minQuantity, startDate, endDate } = req.body;
    if (!name || !productId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: nome, produto, datas' });
    }
    if (!['percent', 'fixed'].includes(discountType)) {
      return res.status(400).json({ success: false, error: 'Tipo de desconto inválido' });
    }
    const value = Number(discountValue) || 0;
    if (value <= 0) {
      return res.status(400).json({ success: false, error: 'Valor do desconto inválido' });
    }
    if (discountType === 'percent' && value > 100) {
      return res.status(400).json({ success: false, error: 'Percentual não pode exceder 100' });
    }
    const id = `prom-${Date.now()}`;
    getDb().prepare(`INSERT INTO promotions (id,name,productId,discountType,discountValue,minQuantity,startDate,endDate,active) VALUES (?,?,?,?,?,?,?,?,1)`).run(
      id, name, productId, discountType, value, Math.max(1, Number(minQuantity) || 1), startDate, endDate
    );
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

promotionsRouter.put('/:id', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name', 'productId', 'discountType', 'discountValue', 'minQuantity', 'startDate', 'endDate', 'active'] as const) {
      if (req.body[k] !== undefined) {
        f.push(`${k} = ?`);
        v.push(k === 'active' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    getDb().prepare(`UPDATE promotions SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

promotionsRouter.delete('/:id', requireRole('admin', 'gerente'), (req, res) => {
  try {
    getDb().prepare('UPDATE promotions SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
