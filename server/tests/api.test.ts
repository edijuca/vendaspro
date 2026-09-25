import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpDb = path.join(
  os.tmpdir(),
  `vendaspro-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
);
process.env.DB_PATH = tmpDb;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'vendaspro-test-secret';
process.env.VP_SEED_PASSWORD = process.env.VP_SEED_PASSWORD || 'TestAdmin123!';

let app: any;
let token = '';
let openRegId = '';

beforeAll(async () => {
  // Pré-existe o arquivo para que o backup rotativo de inicialização seja exercitado
  if (!fs.existsSync(tmpDb)) {
    const Database = (await import('better-sqlite3')).default;
    new Database(tmpDb).close();
  }
  ({ app } = await import('../index'));
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@vendaspro.com', password: 'TestAdmin123!' });
  expect(login.status).toBe(200);
  token = login.body.data.token;
});

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch { /* ignore */ }
  try { fs.unlinkSync(`${tmpDb}-wal`); } catch { /* ignore */ }
  try { fs.unlinkSync(`${tmpDb}-shm`); } catch { /* ignore */ }
  const stem = path.basename(tmpDb).replace(/\.db$/, '');
  try {
    for (const f of fs.readdirSync(os.tmpdir())) {
      if (f.startsWith(`${stem}-`) && f.endsWith('.db.bak')) {
        try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

async function firstProductId(): Promise<string> {
  const res = await request(app).get('/api/products').set(auth());
  expect(res.status).toBe(200);
  return res.body.data[0].id;
}

describe('auth e settings', () => {
  it('login com credenciais do seed', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vendaspro.com', password: 'TestAdmin123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('senha antiga admin123 não funciona', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vendaspro.com', password: 'admin123' });
    expect(res.status).toBe(401);
  });

  it('GET /settings sem token → 401', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  it('GET /settings com token → 200', async () => {
    const res = await request(app).get('/api/settings').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('venda: preço server-side, promo, estoque, caixa', () => {
  it('venda sem caixa aberto → 400', async () => {
    const productId = await firstProductId();
    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'dinheiro',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/caixa/i);
  });

  it('abre caixa', async () => {
    const res = await request(app)
      .post('/api/cash/registers/open')
      .set(auth())
      .send({ openingBalance: 100 });
    expect(res.status).toBe(200);
    openRegId = res.body.data.id;
    const cur = await request(app).get('/api/cash/registers/current').set(auth());
    expect(cur.body.data.status).toBe('aberto');
  });

  it('unitPrice adulterado do cliente é ignorado (usa preço do banco)', async () => {
    const list = await request(app).get('/api/products').set(auth());
    const p = list.body.data.find((x: any) => x.stock > 5 && x.price > 1);
    expect(p).toBeTruthy();
    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({
        items: [{ productId: p.id, quantity: 1, unitPrice: 0.01, total: 0.01 }],
        paymentMethod: 'dinheiro',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeCloseTo(p.price, 2);
  });

  it('promoção aplicada uma única vez (não em dobro)', async () => {
    const list = await request(app).get('/api/products').set(auth());
    const p = list.body.data.find((x: any) => x.stock > 10 && x.price > 2);
    const today = new Date();
    const start = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 86400000 * 7).toISOString().slice(0, 10);
    const promo = await request(app)
      .post('/api/promotions')
      .set(auth())
      .send({
        name: 'Promo Teste 10%',
        productId: p.id,
        discountType: 'percent',
        discountValue: 10,
        minQuantity: 1,
        startDate: start,
        endDate: end,
      });
    expect(promo.status).toBe(200);

    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({
        items: [{ productId: p.id, quantity: 2, unitPrice: p.price * 0.9 }],
        paymentMethod: 'pix',
      });
    expect(res.status).toBe(200);
    const expected = Math.round(p.price * 2 * 0.9 * 100) / 100;
    expect(res.body.data.total).toBeCloseTo(expected, 2);
  });

  it('estoque insuficiente sem allowNegative → 400', async () => {
    const list = await request(app).get('/api/products').set(auth());
    const p = list.body.data.find((x: any) => x.stock === 0 && !x.allowNegative)
      || list.body.data.find((x: any) => x.stock > 0 && !x.allowNegative);
    expect(p).toBeTruthy();
    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({
        items: [{ productId: p.id, quantity: p.stock + 50 }],
        paymentMethod: 'dinheiro',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/estoque/i);
  });

  it('cancelamento estorna no cashRegisterId original', async () => {
    const before = await request(app)
      .get(`/api/cash/registers/${openRegId}`)
      .set(auth())
      .catch(() => null);
    const curBefore = await request(app).get('/api/cash/registers/current').set(auth());
    const balanceBefore = curBefore.body.data.balance;
    const salesBefore = curBefore.body.data.salesTotal;

    const productId = await firstProductId();
    const sale = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'dinheiro',
      });
    expect(sale.status).toBe(200);

    const curMid = await request(app).get('/api/cash/registers/current').set(auth());
    expect(curMid.body.data.balance).toBeGreaterThan(balanceBefore);

    const cancel = await request(app)
      .put(`/api/sales/${sale.body.data.id}/cancel`)
      .set(auth())
      .send({ reason: 'teste' });
    expect(cancel.status).toBe(200);

    const curAfter = await request(app).get('/api/cash/registers/current').set(auth());
    expect(curAfter.body.data.balance).toBeCloseTo(balanceBefore, 2);
    expect(curAfter.body.data.salesTotal).toBeCloseTo(salesBefore, 2);
  });

  it('abertura com code REG e operatorId', async () => {
    const cur = await request(app).get('/api/cash/registers/current').set(auth());
    expect(cur.body.data.code).toMatch(/^REG-/);
    expect(cur.body.data.operatorId).toBeTruthy();
  });
});

describe('caixa: suprimento, sangria, fiado, formas, fechamento', () => {
  let openReg = '';
  let caixaToken = '';
  let customerId = '';

  const cur = async () => {
    const r = await request(app).get('/api/cash/registers/current').set(auth());
    return r.body.data;
  };

  beforeAll(async () => {
    const c = await cur();
    openReg = c.id;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'caixa@vendaspro.com', password: 'TestAdmin123!' });
    expect(login.status).toBe(200);
    caixaToken = login.body.data.token;
    const cust = await request(app)
      .post('/api/customers')
      .set(auth())
      .send({ name: 'Carlos Fiado', creditLimit: 1000 });
    customerId = cust.body.data.id;
  });

  it('suprimento de R$ 100 aumenta saldo físico e grava reason', async () => {
    const before = await cur();
    const res = await request(app)
      .post('/api/cash/movements')
      .set(auth())
      .send({ type: 'suprimento', amount: 100, description: 'Reforço de caixa', reason: 'Reforço de caixa' });
    expect(res.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance + 100, 2);
    const movs = await request(app)
      .get(`/api/cash/movements?cashRegisterId=${openReg}`)
      .set(auth());
    const m = movs.body.data.find((x: any) => x.id === res.body.data.id);
    expect(m.reason).toBe('Reforço de caixa');
  });

  it('sangria de R$ 30 reduz saldo mas não mexe salesTotal', async () => {
    const before = await cur();
    const res = await request(app)
      .post('/api/cash/movements')
      .set(auth())
      .send({ type: 'sangria', amount: 30, description: 'Retirada para cofre' });
    expect(res.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance - 30, 2);
    expect(after.salesTotal).toBeCloseTo(before.salesTotal, 2);
  });

  it('venda pix NÃO altera balance, só salesTotal (regressão G1)', async () => {
    const before = await cur();
    const productId = await firstProductId();
    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'pix' });
    expect(res.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance, 2);
    expect(after.salesTotal).toBeCloseTo(before.salesTotal + res.body.data.total, 2);
  });

  it('venda cartao_credito NÃO altera balance, só salesTotal', async () => {
    const before = await cur();
    const productId = await firstProductId();
    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'cartao_credito' });
    expect(res.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance, 2);
    expect(after.salesTotal).toBeCloseTo(before.salesTotal + res.body.data.total, 2);
  });

  it('venda fiado: não toca caixa, soma salesTotal, grava cashRegisterId, aumenta dívida', async () => {
    const before = await cur();
    const productId = await firstProductId();
    const custBefore = await request(app).get(`/api/customers/${customerId}`).set(auth());
    const res = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'fiado',
        customerId,
      });
    expect(res.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance, 2);
    expect(after.salesTotal).toBeCloseTo(before.salesTotal + res.body.data.total, 2);
    const sale = await request(app).get(`/api/sales/${res.body.data.id}`).set(auth());
    expect(sale.body.data.cashRegisterId).toBe(openReg);
    const custAfter = await request(app).get(`/api/customers/${customerId}`).set(auth());
    expect(custAfter.body.data.currentDebt).toBeCloseTo(
      custBefore.body.data.currentDebt + res.body.data.total,
      2
    );
  });

  it('recebimento de fiado em dinheiro aumenta o caixa', async () => {
    const before = await cur();
    const cust = await request(app).get(`/api/customers/${customerId}`).set(auth());
    const pay = Math.min(50, cust.body.data.currentDebt);
    expect(pay).toBeGreaterThan(0);
    const res = await request(app)
      .post(`/api/customers/${customerId}/payments`)
      .set(auth())
      .send({ amount: pay, description: 'Pagamento parcial' });
    expect(res.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance + pay, 2);
  });

  it('cancel de venda pix: salesTotal diminui, balance inalterado (regressão G2)', async () => {
    const productId = await firstProductId();
    const sale = await request(app)
      .post('/api/sales')
      .set(auth())
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'pix' });
    expect(sale.status).toBe(200);
    const before = await cur();
    const cancel = await request(app)
      .put(`/api/sales/${sale.body.data.id}/cancel`)
      .set(auth())
      .send({ reason: 'teste pix' });
    expect(cancel.status).toBe(200);
    const after = await cur();
    expect(after.balance).toBeCloseTo(before.balance, 2);
    expect(after.salesTotal).toBeCloseTo(before.salesTotal - sale.body.data.total, 2);
  });

  it('GET summary bate com a fórmula fundo+dinheiro+suprimentos-sangrias+recebimentos', async () => {
    const res = await request(app)
      .get(`/api/cash/registers/${openReg}/summary`)
      .set(auth());
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.openingBalance).toBeGreaterThanOrEqual(0);
    expect(s.expected).toBeCloseTo(
      s.openingBalance
      + s.movements.cashSales
      + s.movements.supplies
      - s.movements.withdrawals
      + s.movements.creditPayments
      + s.movements.cancels,
      2
    );
    expect(s.byPayment.length).toBeGreaterThan(0);
    expect(s.totalSales).toBeGreaterThanOrEqual(0);
  });

  it('GET /registers/:id existe e retorna registro', async () => {
    const res = await request(app)
      .get(`/api/cash/registers/${openReg}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(openReg);
    expect(res.body.data.summary).toBeTruthy();
  });

  it('sangria acima do limite: caixa → 403, admin → 200', async () => {
    await request(app)
      .put('/api/settings')
      .set(auth())
      .send({ withdrawalLimit: 50 });
    const over = await request(app)
      .post('/api/cash/movements')
      .set({ Authorization: `Bearer ${caixaToken}` })
      .send({ type: 'sangria', amount: 100, description: 'Acima do limite' });
    expect(over.status).toBe(403);
    expect(over.body.error).toMatch(/limite|autoriza/i);
    const adminOver = await request(app)
      .post('/api/cash/movements')
      .set(auth())
      .send({ type: 'sangria', amount: 60, description: 'Admin autoriza' });
    expect(adminOver.status).toBe(200);
    const under = await request(app)
      .post('/api/cash/movements')
      .set({ Authorization: `Bearer ${caixaToken}` })
      .send({ type: 'sangria', amount: 30, description: 'Dentro do limite' });
    expect(under.status).toBe(200);
    await request(app)
      .put('/api/settings')
      .set(auth())
      .send({ withdrawalLimit: 0 });
  });

  it('suprimento sem motivo → 400', async () => {
    const res = await request(app)
      .post('/api/cash/movements')
      .set(auth())
      .send({ type: 'suprimento', amount: 10, description: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/i);
  });

  it('fechamento com quebra de R$ 5 e relatório', async () => {
    const sum = await request(app)
      .get(`/api/cash/registers/${openReg}/summary`)
      .set(auth());
    const expected = sum.body.data.expected;
    const close = await request(app)
      .post(`/api/cash/registers/${openReg}/close`)
      .set(auth())
      .send({ countedBalance: expected - 5 });
    expect(close.status).toBe(200);
    expect(close.body.data.expected).toBeCloseTo(expected, 2);
    expect(close.body.data.difference).toBeCloseTo(5, 2);

    const curAfter = await request(app).get('/api/cash/registers/current').set(auth());
    expect(curAfter.body.data).toBeNull();

    const rep = await request(app)
      .get(`/api/cash/registers/${openReg}/report`)
      .set(auth());
    expect(rep.status).toBe(200);
    expect(rep.body.data.physical.verdict).toBe('quebra');
    expect(rep.body.data.physical.difference).toBeCloseTo(5, 2);
    expect(rep.body.data.byPayment.length).toBeGreaterThan(0);
  });

  it('reopen: caixa → 403, admin → 200 e status aberto', async () => {
    const denied = await request(app)
      .post(`/api/cash/registers/${openReg}/reopen`)
      .set({ Authorization: `Bearer ${caixaToken}` });
    expect(denied.status).toBe(403);
    const ok = await request(app)
      .post(`/api/cash/registers/${openReg}/reopen`)
      .set(auth());
    expect(ok.status).toBe(200);
    const curAfter = await request(app).get('/api/cash/registers/current').set(auth());
    expect(curAfter.body.data.status).toBe('aberto');
    expect(curAfter.body.data.countedBalance).toBe(0);
    expect(curAfter.body.data.difference).toBe(0);
  });

  it('segunda abertura → 400 Já existe um caixa aberto', async () => {
    const res = await request(app)
      .post('/api/cash/registers/open')
      .set(auth())
      .send({ openingBalance: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/já existe um caixa aberto/i);
  });

  it('recebimento de fiado com caixa fechado → 400', async () => {
    const open = await cur();
    const closeSum = await request(app)
      .get(`/api/cash/registers/${open.id}/summary`)
      .set(auth());
    await request(app)
      .post(`/api/cash/registers/${open.id}/close`)
      .set(auth())
      .send({ countedBalance: closeSum.body.data.expected });
    const cust = await request(app).get(`/api/customers/${customerId}`).set(auth());
    if (cust.body.data.currentDebt > 0) {
      const res = await request(app)
        .post(`/api/customers/${customerId}/payments`)
        .set(auth())
        .send({ amount: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/caixa aberto/i);
    }
    const reopen = await request(app)
      .post(`/api/cash/registers/${open.id}/reopen`)
      .set(auth());
    expect(reopen.status).toBe(200);
  });
});

describe('integridade: exclusão direta bloqueada e backup', () => {
  it('DELETE FROM é abortado pelos triggers nas tabelas de histórico', async () => {
    const { getDb } = await import('../db');
    const d = getDb();
    const tables = ['sales', 'sale_items', 'products', 'customers', 'stock_movements', 'cash_registers', 'cash_movements'];
    for (const t of tables) {
      expect(() => d.prepare(`DELETE FROM ${t}`).run(), `trigger da tabela ${t}`).toThrow(/Integridade/);
    }
  });

  it('soft delete de produto mantém a linha e filtra da lista padrão', async () => {
    const pid = await firstProductId();
    const del = await request(app).delete(`/api/products/${pid}`).set(auth());
    expect(del.status).toBe(200);
    const { getDb } = await import('../db');
    const row = getDb().prepare('SELECT active FROM products WHERE id = ?').get(pid) as any;
    expect(row).toBeTruthy();
    expect(row.active).toBe(0);
    const list = await request(app).get('/api/products').set(auth());
    expect(list.body.data.some((p: any) => p.id === pid)).toBe(false);
    const incl = await request(app).get('/api/products?includeInactive=1').set(auth());
    expect(incl.body.data.some((p: any) => p.id === pid)).toBe(true);
    const react = await request(app)
      .put(`/api/products/${pid}`)
      .set(auth())
      .send({ active: 1 });
    expect(react.status).toBe(200);
    const back = await request(app).get('/api/products').set(auth());
    expect(back.body.data.some((p: any) => p.id === pid)).toBe(true);
  });

  it('backup rotativo foi criado na inicialização', () => {
    const stem = path.basename(tmpDb).replace(/\.db$/, '');
    const baks = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(`${stem}-`) && f.endsWith('.db.bak'));
    expect(baks.length).toBeGreaterThan(0);
  });
});

describe('arquivamento: clientes e reativação de promoções', () => {
  it('cliente arquivado some da lista padrão, segue acessível e pode ser reativado', async () => {
    const created = await request(app)
      .post('/api/customers')
      .set(auth())
      .send({ name: 'Cliente Teste Arquivo', creditLimit: 100 });
    expect(created.status).toBe(200);
    const cid = created.body.data.id;

    const before = await request(app).get('/api/customers').set(auth());
    expect(before.body.data.some((c: any) => c.id === cid)).toBe(true);

    const arch = await request(app)
      .put(`/api/customers/${cid}`)
      .set(auth())
      .send({ active: 0 });
    expect(arch.status).toBe(200);

    const after = await request(app).get('/api/customers').set(auth());
    expect(after.body.data.some((c: any) => c.id === cid)).toBe(false);

    const incl = await request(app).get('/api/customers?includeInactive=1').set(auth());
    const found = incl.body.data.find((c: any) => c.id === cid);
    expect(found).toBeTruthy();
    expect(found.active).toBe(0);

    await request(app).put(`/api/customers/${cid}`).set(auth()).send({ active: 1 });
    const back = await request(app).get('/api/customers').set(auth());
    expect(back.body.data.some((c: any) => c.id === cid)).toBe(true);
  });

  it('promoção desativada fica em includeInactive e pode ser reativada', async () => {
    const pid = await firstProductId();
    const created = await request(app)
      .post('/api/promotions')
      .set(auth())
      .send({
        name: 'Promo Teste Integridade',
        productId: pid,
        discountType: 'percent',
        discountValue: 10,
        minQuantity: 1,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
    expect(created.status).toBe(200);
    const promoId = created.body.data.id;

    const del = await request(app).delete(`/api/promotions/${promoId}`).set(auth());
    expect(del.status).toBe(200);

    const list = await request(app).get('/api/promotions').set(auth());
    expect(list.body.data.some((p: any) => p.id === promoId)).toBe(false);

    const incl = await request(app).get('/api/promotions?includeInactive=1').set(auth());
    expect(incl.body.data.some((p: any) => p.id === promoId)).toBe(true);

    await request(app).put(`/api/promotions/${promoId}`).set(auth()).send({ active: 1 });
    const back = await request(app).get('/api/promotions').set(auth());
    expect(back.body.data.some((p: any) => p.id === promoId)).toBe(true);
  });
});
