import express from 'express';
import { getDb, nextCode } from '../db';
import { authMid, requireRole } from '../middleware';

export const productsRouter = express.Router();
productsRouter.use(authMid);

productsRouter.get('/', (req, res) => {
  try {
    const s = ((req.query.search as string) || '').trim();
    const includeInactive = req.query.includeInactive === '1';
    let sql = `SELECT p.*, c.name as category, b.name as brand
               FROM products p
               LEFT JOIN categories c ON p.categoryId = c.id
               LEFT JOIN brands b ON p.brandId = b.id
               WHERE ${includeInactive ? '1=1' : 'p.active = 1'}`;
    const p: any[] = [];
    if (s) {
      const fold = (v: string) =>
        v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const escaped = fold(s).replace(/[\\%_]/g, '\\$&');
      const prefix = `${escaped}%`;
      sql += ` AND (fold(p.name) LIKE ? ESCAPE '\\' OR fold(p.barcode) LIKE ? ESCAPE '\\' OR fold(p.sku) LIKE ? ESCAPE '\\' OR fold(p.code) LIKE ? ESCAPE '\\')`;
      p.push(prefix, prefix, prefix, prefix);
    }
    sql += ' ORDER BY p.name';
    res.json({ success: true, data: getDb().prepare(sql).all(...p) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

productsRouter.get('/barcode/:bc', (req, res) => {
  try {
    const d = getDb();
    const bcRaw = (req.params.bc || '').trim();
    const folded = bcRaw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const escaped = folded.replace(/[\\%_]/g, '\\$&');
    const exact = d.prepare('SELECT * FROM products WHERE (barcode = ? OR sku = ? OR code = ?) AND active = 1').get(bcRaw, bcRaw, bcRaw);
    if (exact) {
      return res.json({ success: true, data: exact });
    }
    const prefix = d
      .prepare("SELECT * FROM products WHERE (fold(barcode) LIKE ? ESCAPE '\\' OR fold(sku) LIKE ? ESCAPE '\\' OR fold(code) LIKE ? ESCAPE '\\') AND active = 1 ORDER BY barcode LIMIT 1")
      .get(`${escaped}%`, `${escaped}%`, `${escaped}%`);
    res.json({ success: true, data: prefix || null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

productsRouter.get('/:id', (req, res) => {
  try {
    const p = getDb().prepare(`SELECT p.*, c.name as category, b.name as brand
      FROM products p
      LEFT JOIN categories c ON p.categoryId = c.id
      LEFT JOIN brands b ON p.brandId = b.id
      WHERE p.id = ?`).get(req.params.id);
    if (!p) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    res.json({ success: true, data: p });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

productsRouter.post('/', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const d = getDb();
    const id = `prd-${Date.now()}`;
    let catName = req.body.category || '';
    if (!catName && req.body.categoryId) {
      const c = d.prepare('SELECT name FROM categories WHERE id = ?').get(req.body.categoryId) as any;
      catName = c?.name || '';
    }
    let brandName = req.body.brand || '';
    if (!brandName && req.body.brandId) {
      const b = d.prepare('SELECT name FROM brands WHERE id = ?').get(req.body.brandId) as any;
      brandName = b?.name || '';
    }
    const code = nextCode('PRD');
    d.prepare(`INSERT INTO products (id,code,name,barcode,sku,categoryId,category,brandId,brand,supplierId,unit,price,costPrice,stock,minStock,iconType,colorTheme) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, code, req.body.name, req.body.barcode || '', req.body.sku || '',
      req.body.categoryId || null, catName, req.body.brandId || null, brandName,
      req.body.supplierId || null,
      req.body.unit || 'UN', req.body.price || 0, req.body.costPrice || 0, req.body.stock || 0, req.body.minStock || 0,
      req.body.iconType || 'general', req.body.colorTheme || null
    );
    res.json({ success: true, data: { id, code } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

productsRouter.put('/:id', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const d = getDb();
    const e = d.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name','barcode','sku','category','brand','unit','price','costPrice','stock','minStock','idealStock','maxStock','iconType','colorTheme','supplierId'] as const) {
      if (req.body[k] !== undefined) {
        f.push(`${k} = ?`);
        v.push(k === 'supplierId' ? (req.body[k] || null) : req.body[k]);
      }
    }
    if (req.body.categoryId !== undefined) {
      f.push('categoryId = ?');
      v.push(req.body.categoryId || null);
      let catName = req.body.category || '';
      if (!catName && req.body.categoryId) {
        const c = d.prepare('SELECT name FROM categories WHERE id = ?').get(req.body.categoryId) as any;
        catName = c?.name || '';
      }
      f.push('category = ?'); v.push(catName);
    }
    if (req.body.brandId !== undefined) {
      f.push('brandId = ?');
      v.push(req.body.brandId || null);
      let brandName = req.body.brand || '';
      if (!brandName && req.body.brandId) {
        const b = d.prepare('SELECT name FROM brands WHERE id = ?').get(req.body.brandId) as any;
        brandName = b?.name || '';
      }
      f.push('brand = ?'); v.push(brandName);
    }
    if (req.body.allowNegative !== undefined) {
      f.push('allowNegative = ?');
      v.push(req.body.allowNegative ? 1 : 0);
    }
    if (req.body.active !== undefined) {
      f.push('active = ?');
      v.push(req.body.active ? 1 : 0);
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    d.prepare(`UPDATE products SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

productsRouter.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    getDb().prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
