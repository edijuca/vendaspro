import { productCreateSchema, productUpdateSchema } from '../utils/validate';
import express from 'express';
import { getDb, nextCode } from '../db';
import { authMid, requireRole } from '../middleware';
import { uid } from '../utils/id';
import { safeError } from '../utils/safeError';

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
      const escaped = fold(s).replace(/[\\\\%_]/g, '\\\\$&');
      const prefix = `${escaped}%`;
      sql += ` AND (fold(p.name) LIKE ? ESCAPE '\\\\' OR fold(p.barcode) LIKE ? ESCAPE '\\\\' OR fold(p.sku) LIKE ? ESCAPE '\\\\' OR fold(p.code) LIKE ? ESCAPE '\\\\')`;
      p.push(prefix, prefix, prefix, prefix);
    }
    sql += ' ORDER BY p.name';
    res.json({ success: true, data: getDb().prepare(sql).all(...p) });
  } catch (e: any) {
    safeError(res, 500, 'Erro ao listar produtos', e.message);
  }
});

productsRouter.get('/barcode/:bc', (req, res) => {
  try {
    const d = getDb();
    const bcRaw = (req.params.bc || '').trim();
    const folded = bcRaw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const escaped = folded.replace(/[\\\\%_]/g, '\\\\$&');
    const exact = d.prepare('SELECT * FROM products WHERE (barcode = ? OR sku = ? OR code = ?) AND active = 1').get(bcRaw, bcRaw, bcRaw);
    if (exact) {
      return res.json({ success: true, data: exact });
    }
    const prefix = d
      .prepare("SELECT * FROM products WHERE (fold(barcode) LIKE ? ESCAPE '\\\\' OR fold(sku) LIKE ? ESCAPE '\\\\' OR fold(code) LIKE ? ESCAPE '\\\\') AND active = 1 ORDER BY barcode LIMIT 1")
      .get(`${escaped}%`, `${escaped}%`, `${escaped}%`);
    res.json({ success: true, data: prefix || null });
  } catch (e: any) {
    safeError(res, 500, 'Erro ao buscar por código de barras', e.message);
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
    safeError(res, 500, 'Erro ao buscar produto', e.message);
  }
});

productsRouter.post('/', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const parsed = productCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Dados inválidos: ' + parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
    }
    const body = parsed.data;
    const d = getDb();
    const id = uid('prd');
    let catName = body.category || '';
    if (!catName && body.categoryId) {
      const c = d.prepare('SELECT name FROM categories WHERE id = ?').get(body.categoryId) as any;
      catName = c?.name || '';
    }
    let brandName = body.brand || '';
    if (!brandName && body.brandId) {
      const b = d.prepare('SELECT name FROM brands WHERE id = ?').get(body.brandId) as any;
      brandName = b?.name || '';
    }
    const code = nextCode('PRD');
    d.prepare(`INSERT INTO products (id,code,name,barcode,sku,categoryId,category,brandId,brand,supplierId,unit,price,costPrice,stock,minStock,iconType,colorTheme) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, code, body.name, body.barcode || '', body.sku || '',
      body.categoryId || null, catName, body.brandId || null, brandName,
      body.supplierId || null,
      body.unit || 'UN', body.price || 0, body.costPrice || 0, body.stock || 0, body.minStock || 0,
      body.iconType || 'general', body.colorTheme || null
    );
    res.json({ success: true, data: { id, code } });
  } catch (e: any) {
    safeError(res, 500, 'Erro ao criar produto', e.message);
  }
});

productsRouter.put('/:id', requireRole('admin', 'gerente'), (req: any, res) => {
  try {
    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Dados inválidos: ' + parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
    }
    const body = parsed.data;
    const d = getDb();
    const e = d.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    const f: string[] = []; const v: any[] = [];
    for (const k of ['name','barcode','sku','category','brand','unit','price','costPrice','stock','minStock','idealStock','maxStock','iconType','colorTheme','supplierId'] as const) {
      if ((body as any)[k] !== undefined) {
        f.push(`${k} = ?`);
        v.push(k === 'supplierId' ? ((body as any)[k] || null) : (body as any)[k]);
      }
    }
    if ((body as any).categoryId !== undefined) {
      f.push('categoryId = ?');
      v.push((body as any).categoryId || null);
      let catName = (body as any).category || '';
      if (!catName && (body as any).categoryId) {
        const c = d.prepare('SELECT name FROM categories WHERE id = ?').get((body as any).categoryId) as any;
        catName = c?.name || '';
      }
      f.push('category = ?'); v.push(catName);
    }
    if ((body as any).brandId !== undefined) {
      f.push('brandId = ?');
      v.push((body as any).brandId || null);
      let brandName = (body as any).brand || '';
      if (!brandName && (body as any).brandId) {
        const b = d.prepare('SELECT name FROM brands WHERE id = ?').get((body as any).brandId) as any;
        brandName = b?.name || '';
      }
      f.push('brand = ?'); v.push(brandName);
    }
    if ((body as any).allowNegative !== undefined) {
      f.push('allowNegative = ?');
      v.push((body as any).allowNegative ? 1 : 0);
    }
    if ((body as any).active !== undefined) {
      f.push('active = ?');
      v.push((body as any).active ? 1 : 0);
    }
    if (!f.length) return res.json({ success: true, data: null });
    v.push(req.params.id);
    d.prepare(`UPDATE products SET ${f.join(', ')} WHERE id = ?`).run(...v);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro ao atualizar produto', e.message);
  }
});

productsRouter.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    getDb().prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: null });
  } catch (e: any) {
    safeError(res, 500, 'Erro ao desativar produto', e.message);
  }
});
