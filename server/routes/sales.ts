import express from 'express';
import { getDb, nextCode } from '../db';
import { authMid } from '../middleware';

function promoDiscount(d: any, productId: string, quantity: number, lineTotal: number) {
  const today = new Date().toISOString().slice(0, 10);
  const p = d.prepare(`
    SELECT * FROM promotions
    WHERE productId = ? AND active = 1 AND startDate <= ? AND endDate >= ? AND minQuantity <= ?
    ORDER BY CASE WHEN discountType = 'percent' THEN discountValue ELSE discountValue * 100 END DESC
    LIMIT 1
  `).get(productId, today, today, quantity) as any;
  if (!p) return { discount: 0, promoName: null as string | null };
  if (p.discountType === 'percent') {
    return { discount: Math.round(lineTotal * (p.discountValue / 100) * 100) / 100, promoName: p.name };
  }
  return { discount: Math.min(p.discountValue, lineTotal), promoName: p.name };
}

export const salesRouter = express.Router();
salesRouter.use(authMid);

salesRouter.get('/', (req, res) => {
  try {
    const st = (req.query.status as string) || '';
    let sql = 'SELECT s.*, (SELECT GROUP_CONCAT(si.productName || " x" || si.quantity, "; ") FROM sale_items si WHERE si.saleId = s.id) as items_summary FROM sales s';
    const p: any[] = [];
    if (st) { sql += ' WHERE s.status = ?'; p.push(st); }
    sql += ' ORDER BY s.timestamp DESC LIMIT 200';
    res.json({ success: true, data: getDb().prepare(sql).all(...p) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

salesRouter.get('/:id', (req, res) => {
  try {
    const s = getDb().prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ success: false, error: 'Venda não encontrada' });
    const items = getDb().prepare('SELECT * FROM sale_items WHERE saleId = ?').all(req.params.id);
    res.json({ success: true, data: { ...s, items } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

salesRouter.post('/', (req: any, res) => {
  try {
    const d = getDb();
    const id = `vnd-${Date.now()}`;
    const code = nextCode('VND');
    const { items, paymentMethod, customerId, customerName, customerCpf, discount: manualDiscount } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, error: 'Carrinho vazio' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: 'Forma de pagamento obrigatória' });
    }

    let customer: any = null;
    if (paymentMethod === 'fiado') {
      if (!customerId) {
        return res.status(400).json({ success: false, error: 'Venda fiado exige cliente' });
      }
      customer = d.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
      if (!customer) {
        return res.status(400).json({ success: false, error: 'Cliente não encontrado' });
      }
      if (customer.creditStatus !== 'liberado') {
        return res.status(400).json({ success: false, error: `Crédito ${customer.creditStatus} — venda fiado bloqueada` });
      }
    }

    const extraDiscount = Math.max(0, Math.round((Number(manualDiscount) || 0) * 100) / 100);
    let saleTotal = 0;
    const requiresCash = paymentMethod !== 'fiado';
    const affectsPhysicalCash = paymentMethod === 'dinheiro';

    const tx = d.transaction(() => {
      const reg = d.prepare("SELECT id FROM cash_registers WHERE status = 'aberto' LIMIT 1").get() as any;
      if (requiresCash && !reg) {
        throw new Error('Nenhum caixa aberto');
      }

      let subtotal = 0;
      let promoDiscountTotal = 0;
      const computed = items.map((item: any) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        if (quantity <= 0) throw new Error('Quantidade inválida');
        const product = d.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.productId) as any;
        if (!product) throw new Error('Produto não encontrado');
        const unitPrice = Math.max(0, Number(product.price) || 0);
        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        const { discount: promo, promoName } = promoDiscount(d, item.productId, quantity, lineTotal);
        subtotal += lineTotal;
        promoDiscountTotal += promo;
        const itemDiscount = Math.round(promo * 100) / 100;
        const total = Math.max(0, Math.round((lineTotal - itemDiscount) * 100) / 100);
        return {
          productId: item.productId,
          productName: product.name,
          quantity,
          unitPrice,
          originalPrice: unitPrice,
          discount: itemDiscount,
          total,
          promoName,
          stock: Number(product.stock) || 0,
          allowNegative: !!product.allowNegative,
        };
      });

      subtotal = Math.round(subtotal * 100) / 100;
      promoDiscountTotal = Math.round(promoDiscountTotal * 100) / 100;
      const discount = Math.min(Math.round((promoDiscountTotal + extraDiscount) * 100) / 100, subtotal);
      saleTotal = Math.max(0, Math.round((subtotal - promoDiscountTotal - extraDiscount) * 100) / 100);
      const total = saleTotal;

      if (paymentMethod === 'fiado' && customer) {
        if (customer.creditLimit > 0 && (customer.currentDebt + total) > customer.creditLimit) {
          throw new Error('Limite de crédito excedido');
        }
      }

      d.prepare(`INSERT INTO sales (id,code,timestamp,terminal,operator,subtotal,discount,total,paymentMethod,customerId,customerName,customerCpf,cashRegisterId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, code, new Date().toISOString(), 'PDV-01', req.user.name, subtotal, discount, total,
        paymentMethod, customerId || null,
        customerName || customer?.name || 'Consumidor Final',
        customerCpf || customer?.cpf || null,
        reg?.id || null
      );

      const insI = d.prepare(`INSERT INTO sale_items (saleId,productId,productName,quantity,unitPrice,originalPrice,discount,total) VALUES (?,?,?,?,?,?,?,?)`);
      const updS = d.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND active = 1');
      const insM = d.prepare(`INSERT INTO stock_movements (id,code,productId,productName,type,operation,quantity,previousStock,newStock,unitCost,totalValue,reason,timestamp,operator,operatorId,referenceDocument) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

      for (const item of computed) {
        insI.run(id, item.productId, item.productName, item.quantity, item.unitPrice, item.originalPrice, item.discount, item.total);
        const prev = item.stock;
        const nx = prev - item.quantity;
        if (nx < 0 && !item.allowNegative) {
          throw new Error(`Estoque insuficiente para ${item.productName} (disponível: ${prev})`);
        }
        updS.run(item.quantity, item.productId);
        insM.run(
          `mov-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, nextCode('MOV'),
          item.productId, item.productName, 'SAIDA_VENDA', 'saida', item.quantity,
          prev, nx, 0, 0,
          `Venda ${code}`, new Date().toISOString(), req.user.name, req.user.id, id
        );
      }

      if (paymentMethod === 'fiado' && customer) {
        d.prepare('UPDATE customers SET currentDebt = currentDebt + ? WHERE id = ?').run(total, customer.id);
      }

      if (reg) {
        const setSales = affectsPhysicalCash
          ? 'UPDATE cash_registers SET salesTotal = salesTotal + ?, balance = balance + ? WHERE id = ?'
          : 'UPDATE cash_registers SET salesTotal = salesTotal + ? WHERE id = ?';
        if (affectsPhysicalCash) {
          d.prepare(setSales).run(total, total, reg.id);
          d.prepare(`INSERT INTO cash_movements (id,cashRegisterId,type,amount,description,timestamp,operator,operatorId,referenceId) VALUES (?,?,?,?,?,?,?,?,?)`).run(
            `cm-${Date.now()}-${Math.random().toString(36).slice(2,4)}`, reg.id, 'sale', total,
            `Venda ${code}`, new Date().toISOString(), req.user.name, req.user.id, id
          );
        } else {
          d.prepare(setSales).run(total, reg.id);
        }
      }
    });

    try {
      tx();
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.includes('Limite') || msg.includes('Estoque') || msg.includes('caixa') || msg.includes('Quantidade') || msg.includes('não encontrado')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }
    res.json({ success: true, data: { id, code, total: saleTotal } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

salesRouter.put('/:id/cancel', (req: any, res) => {
  try {
    const d = getDb();
    const sale = d.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id) as any;
    if (!sale) return res.status(404).json({ success: false, error: 'Venda não encontrada' });
    if (sale.status !== 'concluida') return res.status(400).json({ success: false, error: 'Venda já cancelada' });

    const tx = d.transaction(() => {
      d.prepare("UPDATE sales SET status = 'cancelada', cancelledAt = ?, cancelReason = ? WHERE id = ?").run(
        new Date().toISOString(), req.body.reason || '', req.params.id
      );
      const items = d.prepare('SELECT * FROM sale_items WHERE saleId = ?').all(req.params.id) as any[];
      const insM = d.prepare(`INSERT INTO stock_movements (id,code,productId,productName,type,operation,quantity,previousStock,newStock,reason,timestamp,operator,operatorId,referenceDocument) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const item of items) {
        const prod = d.prepare('SELECT stock FROM products WHERE id = ?').get(item.productId) as any;
        const prev = prod?.stock || 0;
        const nx = prev + item.quantity;
        d.prepare('UPDATE products SET stock = ? WHERE id = ?').run(nx, item.productId);
        insM.run(
          `mov-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, nextCode('MOV'),
          item.productId, item.productName, 'CANCELAMENTO_VENDA', 'entrada', item.quantity,
          prev, nx, `Cancelamento da venda ${sale.code}`, new Date().toISOString(),
          req.user.name, req.user.id, sale.id
        );
      }

      if (sale.paymentMethod === 'fiado' && sale.customerId) {
        d.prepare('UPDATE customers SET currentDebt = MAX(0, currentDebt - ?) WHERE id = ?').run(sale.total, sale.customerId);
      }

      const affectsPhysicalCash = sale.paymentMethod === 'dinheiro';
      const targetRegId = sale.cashRegisterId;
      if (targetRegId) {
        const reg = d.prepare('SELECT * FROM cash_registers WHERE id = ?').get(targetRegId) as any;
        if (reg && reg.status === 'aberto') {
          if (affectsPhysicalCash) {
            d.prepare('UPDATE cash_registers SET salesTotal = salesTotal - ?, balance = balance - ? WHERE id = ?').run(sale.total, sale.total, targetRegId);
            d.prepare(`INSERT INTO cash_movements (id,cashRegisterId,type,amount,description,timestamp,operator,operatorId,referenceId) VALUES (?,?,?,?,?,?,?,?,?)`).run(
              `cm-${Date.now()}-${Math.random().toString(36).slice(2,4)}`, targetRegId, 'cancel', -sale.total,
              `Cancelamento ${sale.code}`, new Date().toISOString(), req.user.name, req.user.id, sale.id
            );
          } else {
            d.prepare('UPDATE cash_registers SET salesTotal = salesTotal - ? WHERE id = ?').run(sale.total, targetRegId);
          }
        }
      }
    });
    tx();
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
