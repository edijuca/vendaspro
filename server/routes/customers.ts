import express from 'express';
import { getDb, nextCode } from '../db';
import { authMid } from '../middleware';

export const customersRouter = express.Router();
customersRouter.use(authMid);

customersRouter.get('/', (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === '1';
    const data = getDb()
      .prepare(`SELECT * FROM customers WHERE ${includeInactive ? '1=1' : 'active = 1'} ORDER BY name`)
      .all();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

customersRouter.get('/:id', (req, res) => {
  try {
    const c = getDb().prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    res.json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

customersRouter.post('/', (req: any, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    const id = `cli-${Date.now()}`;
    getDb().prepare(`INSERT INTO customers (id,code,name,cpf,email,phone,creditLimit,currentDebt,creditStatus,dueDays) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id, nextCode('CLI'), req.body.name, req.body.cpf || '', req.body.email || '', req.body.phone || '',
      req.body.creditLimit || 0, 0, req.body.creditStatus || 'liberado', req.body.dueDays || 30
    );
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

customersRouter.put('/:id', (req: any, res) => {
  try {
    const d = getDb();
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name','cpf','email','phone','creditLimit','creditStatus','dueDays','active'] as const) {
      if (req.body[k] !== undefined) {
        f.push(`${k} = ?`);
        v.push(k === 'active' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    d.prepare(`UPDATE customers SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

customersRouter.post('/:id/payments', (req: any, res) => {
  try {
    const d = getDb();
    const amount = Math.round((Number(req.body.amount) || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ success: false, error: 'Valor inválido' });

    const cust = d.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id) as any;
    if (!cust) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    if (amount > cust.currentDebt + 0.009) {
      return res.status(400).json({ success: false, error: 'Valor maior que a dívida atual' });
    }
    const openReg = d.prepare("SELECT id FROM cash_registers WHERE status = 'aberto' LIMIT 1").get() as any;
    if (!openReg) {
      return res.status(400).json({ success: false, error: 'Nenhum caixa aberto para recebimento' });
    }

    const tx = d.transaction(() => {
      const newDebt = Math.max(0, Math.round((cust.currentDebt - amount) * 100) / 100);
      const newStatus = newDebt <= 0 && (cust.creditStatus === 'inadimplente')
        ? 'liberado'
        : cust.creditStatus;
      d.prepare('UPDATE customers SET currentDebt = ?, creditStatus = ? WHERE id = ?').run(newDebt, newStatus, cust.id);

      d.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(amount, openReg.id);
      d.prepare(`INSERT INTO cash_movements (id,cashRegisterId,type,amount,description,timestamp,operator,operatorId,referenceId) VALUES (?,?,?,?,?,?,?,?,?)`).run(
        `cm-${Date.now()}-${Math.random().toString(36).slice(2,4)}`, openReg.id, 'recebimento', amount,
        `Recebimento fiado — ${cust.name}`, new Date().toISOString(), req.user.name, req.user.id, cust.id
      );
    });
    tx();
    res.json({ success: true, data: { currentDebt: Math.max(0, cust.currentDebt - amount) } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
