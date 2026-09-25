import express from 'express';
import { getDb } from '../db';
import { authMid, requireRole } from '../middleware';

export function registerSettings(app: express.Express) {
  app.get('/api/settings', authMid, (_req, res) => {
    try {
      const s = getDb().prepare('SELECT * FROM company_settings WHERE id = 1').get() as any;
      res.json({ success: true, data: s || {} });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put('/api/settings', authMid, requireRole('admin', 'gerente'), (req: any, res) => {
    try {
      const d = getDb();
      const f: string[] = []; const v: any[] = [];
      for (const k of ['name','tradeName','cnpj','ie','address','phone','email','pixKey','pixKeyType','pixBeneficiaryName','pixCity','defaultMarginPercent','cardFeePercent','withdrawalLimit'] as const) {
        if (req.body[k] !== undefined) {
          f.push(`${k} = ?`);
          v.push(req.body[k]);
        }
      }
      if (f.length) {
        v.push(1);
        d.prepare(`UPDATE company_settings SET ${f.join(', ')} WHERE id = ?`).run(...v);
      }
      res.json({ success: true, data: null });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
