import express from 'express';
import { getDb } from '../db';
import { authMid, requireRole } from '../middleware';

export const reportsRouter = express.Router();
reportsRouter.use(authMid);

function dateRange(req: any) {
  const from = (req.query.from as string) || '0000-01-01';
  let to = (req.query.to as string) || '9999-12-31';
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) to = `${to}T23:59:59.999`;
  return { from, to };
}

reportsRouter.get('/sales', requireRole('admin', 'gerente'), (req, res) => {
  try {
    const d = getDb();
    const { from, to } = dateRange(req);

    const totals = d.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'concluida' THEN total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'cancelada' THEN total ELSE 0 END), 0) as cancelled,
        COUNT(CASE WHEN status = 'cancelada' THEN 1 END) as cancelledCount,
        COALESCE(SUM(CASE WHEN status = 'concluida' THEN discount ELSE 0 END), 0) as discounts
      FROM sales
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(from, to) as any;

    const byPayment = d.prepare(`
      SELECT paymentMethod, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE status = 'concluida' AND timestamp >= ? AND timestamp <= ?
      GROUP BY paymentMethod
      ORDER BY total DESC
    `).all(from, to);

    const byDay = d.prepare(`
      SELECT substr(timestamp, 1, 10) as day, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE status = 'concluida' AND timestamp >= ? AND timestamp <= ?
      GROUP BY day
      ORDER BY day DESC
      LIMIT 60
    `).all(from, to);

    const topProducts = d.prepare(`
      SELECT si.productName, SUM(si.quantity) as quantity, SUM(si.total) as total
      FROM sale_items si
      JOIN sales s ON s.id = si.saleId
      WHERE s.status = 'concluida' AND s.timestamp >= ? AND s.timestamp <= ?
      GROUP BY si.productName
      ORDER BY total DESC
      LIMIT 15
    `).all(from, to);

    const count = totals.count || 0;
    const revenue = totals.revenue || 0;
    res.json({
      success: true,
      data: {
        from,
        to,
        count,
        revenue,
        cancelled: totals.cancelled || 0,
        cancelledCount: totals.cancelledCount || 0,
        discounts: totals.discounts || 0,
        avgTicket: count > 0 ? Math.round((revenue / count) * 100) / 100 : 0,
        byPayment,
        byDay,
        topProducts,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

reportsRouter.get('/stock-low', requireRole('admin', 'gerente'), (_req, res) => {
  try {
    const data = getDb().prepare(`
      SELECT id, code, name, stock, minStock, idealStock, price, categoryId, brandId
      FROM products
      WHERE active = 1 AND stock <= minStock
      ORDER BY stock ASC
      LIMIT 200
    `).all();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
