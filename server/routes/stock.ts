import express from 'express';
import { getDb, nextCode } from '../db';
import { authMid } from '../middleware';

export const stockRouter = express.Router();
stockRouter.use(authMid);

stockRouter.get('/', (req, res) => {
  try {
    const f = req.query;
    const p: any[] = [];
    let sql = 'SELECT * FROM stock_movements WHERE 1=1';
    if (f.productId) { sql += ' AND productId = ?'; p.push(f.productId); }
    if (f.type) { sql += ' AND type = ?'; p.push(f.type); }
    if (f.operation) { sql += ' AND operation = ?'; p.push(f.operation); }
    if (f.startDate) { sql += ' AND timestamp >= ?'; p.push(f.startDate); }
    if (f.endDate) { sql += ' AND timestamp <= ?'; p.push(f.endDate); }
    sql += ' ORDER BY timestamp DESC LIMIT 500';
    res.json({ success: true, data: getDb().prepare(sql).all(...p) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

stockRouter.get('/summary', (_req, res) => {
  try {
    const s = getDb().prepare(`SELECT
      SUM(CASE WHEN operation='saida' THEN quantity ELSE 0 END) as saidas,
      SUM(CASE WHEN operation='entrada' THEN quantity ELSE 0 END) as entradas,
      COUNT(DISTINCT productId) as produtos
      FROM stock_movements`).get() as any;
    res.json({
      success: true,
      data: {
        saidas: s?.saidas || 0,
        entradas: s?.entradas || 0,
        produtos: s?.produtos || 0,
        produtos_movimentados: s?.produtos || 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

stockRouter.post('/', (req: any, res) => {
  try {
    const d = getDb();
    const { productId, type, quantity, unitCost, reason, operation } = req.body;
    const op: 'entrada' | 'saida' = operation === 'entrada' ? 'entrada' : 'saida';
    const qty = Number(quantity) || 0;
    if (!productId || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Produto e quantidade são obrigatórios' });
    }

    const id = `mov-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    let resultId = id;

    const tx = d.transaction(() => {
      const prod = d.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId) as any;
      if (!prod) throw new Error('Produto não encontrado');
      const prev = prod.stock;
      const delta = op === 'entrada' ? qty : -qty;
      const nx = prev + delta;
      if (nx < 0 && !prod.allowNegative) {
        throw new Error(`Estoque insuficiente (disponível: ${prev})`);
      }
      d.prepare('UPDATE products SET stock = ? WHERE id = ?').run(nx, productId);
      const productName = prod.name;
      const cost = Number(unitCost) || 0;
      d.prepare(`INSERT INTO stock_movements (id,code,productId,productName,type,operation,quantity,previousStock,newStock,unitCost,totalValue,reason,timestamp,operator,operatorId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, nextCode('MOV'), productId, productName,
        type || (op === 'entrada' ? 'ENTRADA_MANUAL' : 'SAIDA_MANUAL'),
        op, qty, prev, nx, cost, qty * cost,
        reason || '', new Date().toISOString(), req.user.name, req.user.id
      );
    });

    try {
      tx();
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: { id: resultId } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
