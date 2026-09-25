import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from './db';
import { authMid } from './middleware';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { salesRouter } from './routes/sales';
import { stockRouter } from './routes/stock';
import { customersRouter } from './routes/customers';
import { cashRouter } from './routes/cash';
import { entitiesRouter } from './routes/entities';
import { promotionsRouter } from './routes/promotions';
import { reportsRouter } from './routes/reports';
import { registerSettings } from './routes/settings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3001;
const DIST = path.resolve(__dirname, '..', 'dist');

const app = express();
export { app };
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  try {
    getDb();
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/stock', stockRouter);
app.use('/api/customers', customersRouter);
app.use('/api/cash', cashRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/reports', reportsRouter);
registerSettings(app);

app.use('/api', authMid, (_req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
});

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: 'Rota não encontrada' });
    }
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

if (!process.env.VITEST) {
  app.listen(PORT, () => {
    getDb();
    console.log(`VendasPRO backend rodando em http://localhost:${PORT} (v1.1.0)`);
    if (fs.existsSync(DIST)) {
      console.log(`Servindo frontend em ${DIST}`);
    }
  });
}
