import { settingsUpdateSchema } from '../utils/validate';
import express from 'express';
import { getDb } from '../db';
import { authMid, requireRole } from '../middleware';

export function registerSettings(app: express.Express) {
  app.get('/api/settings', authMid, (_req, res) => {
    try {
      const s = getDb().prepare('SELECT * FROM company_settings WHERE id = 1').get() as any;
      res.json({ success: true, data: s || {} });
    } catch (e: any) {
      console.error('/api/settings GET error:', e);
      res.status(500).json({ success: false, error: 'Erro ao buscar configurações' });
    }
  });

  app.put('/api/settings', authMid, requireRole('admin', 'gerente'), (req: any, res) => {
    try {
      const parsed = settingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Dados inválidos: ' + parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
      }
      const body = parsed.data;
      const d = getDb();
      const f: string[] = []; const v: any[] = [];
      for (const k of ['name','tradeName','cnpj','ie','address','phone','email','pixKey','pixKeyType','pixBeneficiaryName','pixCity','defaultMarginPercent','cardFeePercent','withdrawalLimit'] as const) {
        if ((body as any)[k] !== undefined) {
          f.push(`${k} = ?`);
          v.push((body as any)[k]);
        }
      }
      if (f.length) {
        v.push(1);
        d.prepare(`UPDATE company_settings SET ${f.join(', ')} WHERE id = ?`).run(...v);
      }
      res.json({ success: true, data: null });
    } catch (e: any) {
      console.error('/api/settings PUT error:', e);
      res.status(500).json({ success: false, error: 'Erro ao atualizar configurações' });
    }
  });
}
