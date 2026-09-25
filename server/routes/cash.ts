import express from 'express';
import { getDb, nextCode } from '../db';
import { authMid, requireRole } from '../middleware';
import { uid } from '../utils/id';
import { safeError } from '../utils/safeError';

export const cashRouter = express.Router();
cashRouter.use(authMid);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeSessionSummary(d: any, reg: any) {
  const movRows = d.prepare(
    `SELECT type, SUM(amount) as total FROM cash_movements WHERE cashRegisterId = ? GROUP BY type`
  ).all(reg.id) as any[];
  const byType: Record<string, number> = {};
  for (const r of movRows) byType[r.type] = round2(r.total || 0);

  const salesByPayment = d.prepare(
    `SELECT paymentMethod, COUNT(*) as count, SUM(total) as total
     FROM sales WHERE cashRegisterId = ? AND status = 'concluida' GROUP BY paymentMethod`
  ).all(reg.id) as any[];
  const byPayment = salesByPayment.map((r: any) => ({
    method: r.paymentMethod,
    count: r.count,
    total: round2(r.total || 0),
  }));
  const totalSales = round2(byPayment.reduce((s: number, p: any) => s + p.total, 0));

  const cashSales = byPayment.find((p: any) => p.method === 'dinheiro')?.total || 0;
  const supplies = byType['suprimento'] || byType['entrada'] || 0;
  const withdrawals = byType['sangria'] || byType['saida'] || 0;
  const creditPayments = byType['recebimento'] || 0;
  const cancels = byType['cancel'] || 0;

  const expectedPhysical = round2(
    Number(reg.openingBalance || 0) + cashSales + supplies - withdrawals + creditPayments + cancels
  );
  const movements = d.prepare(
    'SELECT * FROM cash_movements WHERE cashRegisterId = ? ORDER BY timestamp DESC LIMIT 200'
  ).all(reg.id);

  return {
    openingBalance: round2(Number(reg.openingBalance || 0)),
    expected: expectedPhysical,
    expectedFromBalance: round2(Number(reg.balance || 0)),
    byPayment,
    totalSales,
    movements: {
      cashSales: round2(cashSales),
      supplies: round2(supplies),
      withdrawals: round2(withdrawals),
      creditPayments: round2(creditPayments),
      cancels: round2(cancels),
    },
    movementList: movements,
    status: reg.status,
  };
}

function getRegOr404(d: any, id: string, res: express.Response) {
  const r = d.prepare('SELECT * FROM cash_registers WHERE id = ?').get(id) as any;
  if (!r) {
    res.status(404).json({ success: false, error: 'Registro não encontrado' });
    return null;
  }
  return r;
}

cashRouter.get('/registers', (_req, res) => {
  try {
    res.json({ success: true, data: getDb().prepare('SELECT * FROM cash_registers ORDER BY openedAt DESC').all() });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.get('/registers/current', (_req, res) => {
  try {
    const r = getDb().prepare("SELECT * FROM cash_registers WHERE status = 'aberto' LIMIT 1").get();
    res.json({ success: true, data: r || null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.get('/registers/:id', (req, res) => {
  try {
    const d = getDb();
    const r = getRegOr404(d, req.params.id, res);
    if (!r) return;
    res.json({ success: true, data: { ...r, summary: computeSessionSummary(d, r) } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.get('/registers/:id/summary', (req, res) => {
  try {
    const d = getDb();
    const r = getRegOr404(d, req.params.id, res);
    if (!r) return;
    const summary = computeSessionSummary(d, r);
    res.json({
      success: true,
      data: {
        openingBalance: summary.openingBalance,
        expected: summary.expected,
        expectedFromBalance: summary.expectedFromBalance,
        byPayment: summary.byPayment,
        totalSales: summary.totalSales,
        movements: summary.movements,
        status: summary.status,
        closingBalance: r.closingBalance,
        countedBalance: r.countedBalance,
        difference: r.difference,
      },
    });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.get('/registers/:id/report', (req, res) => {
  try {
    const d = getDb();
    const r = getRegOr404(d, req.params.id, res);
    if (!r) return;
    const summary = computeSessionSummary(d, r);
    const counted = Number(r.countedBalance || 0);
    const expected = r.status === 'fechado' ? Number(r.closingBalance || 0) : summary.expected;
    const difference = round2(expected - counted);
    const verdict = r.status !== 'fechado' ? 'aberto'
      : Math.abs(difference) < 0.005 ? 'ok'
      : difference > 0 ? 'quebra' : 'sobra';
    res.json({
      success: true,
      data: {
        register: {
          id: r.id,
          code: r.code,
          operator: r.operator,
          openedAt: r.openedAt,
          closedAt: r.closedAt,
          status: r.status,
          closedBy: r.closedBy,
        },
        openingBalance: summary.openingBalance,
        byPayment: summary.byPayment,
        totalSales: summary.totalSales,
        movements: summary.movements,
        movementList: summary.movementList,
        physical: {
          expected,
          counted: r.status === 'fechado' ? counted : null,
          difference: r.status === 'fechado' ? difference : null,
          verdict,
        },
      },
    });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.post('/registers/open', requireRole('admin', 'gerente', 'caixa'), (req: any, res) => {
  try {
    const d = getDb();
    const open = d.prepare("SELECT id FROM cash_registers WHERE status = 'aberto' LIMIT 1").get();
    if (open) return res.status(400).json({ success: false, error: 'Já existe um caixa aberto' });
    const id = uid('reg');
    const code = nextCode('REG');
    const opening = Math.max(0, Number(req.body.openingBalance) || 0);
    d.prepare(`INSERT INTO cash_registers (id,code,openedAt,openingBalance,balance,salesTotal,operator,operatorId) VALUES (?,?,?,?,?,?,?,?)`).run(
      id, code, new Date().toISOString(), opening, opening, 0, req.user.name, req.user.id
    );
    res.json({ success: true, data: { id, code } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.post('/registers/:id/close', requireRole('admin', 'gerente', 'caixa'), (req: any, res) => {
  try {
    const d = getDb();
    const r = getRegOr404(d, req.params.id, res);
    if (!r) return;
    if (r.status !== 'aberto') return res.status(400).json({ success: false, error: 'Registro já fechado' });
    const summary = computeSessionSummary(d, r);
    const expected = summary.expected;
    const countedBalance = round2(Number(req.body.countedBalance) || 0);
    if (countedBalance < 0) return res.status(400).json({ success: false, error: 'Valor contado inválido' });
    const difference = round2(expected - countedBalance);
    const closedBy = req.user.role === 'admin' && req.body.closedBy ? String(req.body.closedBy) : req.user.name;
    d.prepare(
      `UPDATE cash_registers SET closedAt = ?, status = 'fechado', closingBalance = ?, countedBalance = ?, difference = ?, closedBy = ? WHERE id = ?`
    ).run(new Date().toISOString(), expected, countedBalance, difference, closedBy, req.params.id);
    res.json({ success: true, data: { expected, counted: countedBalance, difference } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.post('/registers/:id/reopen', requireRole('admin'), (req: any, res) => {
  try {
    const d = getDb();
    const r = getRegOr404(d, req.params.id, res);
    if (!r) return;
    if (r.status !== 'fechado') return res.status(400).json({ success: false, error: 'Caixa não está fechado' });
    const open = d.prepare("SELECT id FROM cash_registers WHERE status = 'aberto' LIMIT 1").get();
    if (open) return res.status(400).json({ success: false, error: 'Já existe um caixa aberto' });
    d.prepare(
      `UPDATE cash_registers SET status = 'aberto', closedAt = NULL, closedBy = NULL, closingBalance = 0, countedBalance = 0, difference = 0 WHERE id = ?`
    ).run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.get('/movements', (req, res) => {
  try {
    const rid = req.query.cashRegisterId as string;
    let sql = 'SELECT * FROM cash_movements';
    const p: any[] = [];
    if (rid) { sql += ' WHERE cashRegisterId = ?'; p.push(rid); }
    sql += ' ORDER BY timestamp DESC LIMIT 200';
    res.json({ success: true, data: getDb().prepare(sql).all(...p) });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});

cashRouter.post('/movements', requireRole('admin', 'gerente', 'caixa'), (req: any, res) => {
  try {
    const d = getDb();
    const type = String(req.body.type || '');
    const amount = round2(Number(req.body.amount) || 0);
    const allowed = ['suprimento', 'sangria', 'entrada', 'saida', 'recebimento', 'sale', 'cancel', 'ajuste'];
    if (!allowed.includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipo de movimento inválido' });
    }
    if (type === 'ajuste' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Ajuste restrito a admin' });
    }
    if (amount <= 0 && type !== 'ajuste') {
      return res.status(400).json({ success: false, error: 'Valor deve ser maior que zero' });
    }
    if (type === 'suprimento' && !String(req.body.description || req.body.reason || '').trim()) {
      return res.status(400).json({ success: false, error: 'Motivo do suprimento é obrigatório' });
    }
    if (type === 'sangria' && req.user.role !== 'admin') {
      const st = d.prepare('SELECT withdrawalLimit FROM company_settings WHERE id = 1').get() as any;
      const limit = Number(st?.withdrawalLimit) || 0;
      if (limit > 0 && amount > limit) {
        return res.status(403).json({ success: false, error: 'Sangria acima do limite — requer autorização do admin' });
      }
    }
    const reg = d.prepare("SELECT id FROM cash_registers WHERE status = 'aberto' LIMIT 1").get() as any;
    const cashRegisterId = req.body.cashRegisterId || reg?.id;
    if (!cashRegisterId) {
      return res.status(400).json({ success: false, error: 'Nenhum caixa aberto' });
    }

    const id = uid('cm');
    const reason = String(req.body.reason || req.body.description || '');
    const tx = d.transaction(() => {
      d.prepare(`INSERT INTO cash_movements (id,cashRegisterId,type,amount,description,reason,timestamp,operator,operatorId,referenceId) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        id, cashRegisterId, type, amount, req.body.description || reason, reason, new Date().toISOString(), req.user.name, req.user.id, req.body.referenceId || ''
      );
      const signed =
        type === 'suprimento' || type === 'entrada' || type === 'recebimento' ? amount :
        type === 'sangria' || type === 'saida' ? -amount :
        amount;
      if (type !== 'sale' && type !== 'cancel') {
        d.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(signed, cashRegisterId);
      }
    });
    tx();
    res.json({ success: true, data: { id } });
  } catch (e: any) {
    safeError(res, 500, 'Erro interno do servidor', e.message);
  }
});
