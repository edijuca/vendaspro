import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '..', 'vendaspro.db');

let db: Database.Database;

const BACKUP_KEEP = 5;

function rotateBackup() {
  const dir = path.dirname(DB_PATH);
  const stem = path.basename(DB_PATH).replace(/\.db$/, '');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.copyFileSync(DB_PATH, path.join(dir, `${stem}-${stamp}.db.bak`));
  const re = new RegExp(
    `^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.db\\.bak$`,
  );
  const olds = fs.readdirSync(dir).filter(f => re.test(f)).sort();
  while (olds.length > BACKUP_KEEP) {
    try { fs.unlinkSync(path.join(dir, olds.shift() as string)); } catch { /* ignore */ }
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  const existedBefore = fs.existsSync(DB_PATH);
  let needsCashMigration = false;
  if (existedBefore) {
    const probe = new Database(DB_PATH, { readonly: true });
    const cols = probe.prepare('PRAGMA table_info(cash_registers)').all().map((c: any) => c.name);
    const movCols = probe.prepare('PRAGMA table_info(cash_movements)').all().map((c: any) => c.name);
    const setCols = probe.prepare('PRAGMA table_info(company_settings)').all().map((c: any) => c.name);
    needsCashMigration =
      (cols.length > 0 && (!cols.includes('closingBalance') || !cols.includes('code') || !cols.includes('operatorId') || !cols.includes('closedBy')))
      || (movCols.length > 0 && (!movCols.includes('reason') || !movCols.includes('operatorId')))
      || (setCols.length > 0 && !setCols.includes('withdrawalLimit'));
    probe.close();
  }

  if (needsCashMigration) {
    try { fs.copyFileSync(DB_PATH, `${DB_PATH}.bak`); } catch { /* ignore */ }
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Backup rotativo a cada inicialização, antes das migrações
  if (existedBefore && !process.env.VP_SKIP_BACKUP) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      rotateBackup();
    } catch { /* ignore */ }
  }

  db.function('fold', { deterministic: true }, (v: unknown) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'caixa', active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, parentId TEXT, description TEXT, marginPercent REAL DEFAULT 0, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, cnpjCpf TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, barcode TEXT NOT NULL, sku TEXT NOT NULL, categoryId TEXT, category TEXT NOT NULL, brandId TEXT, brand TEXT, supplierId TEXT, unit TEXT NOT NULL DEFAULT 'UN', price REAL NOT NULL DEFAULT 0, costPrice REAL NOT NULL DEFAULT 0, marginPercent REAL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0, minStock INTEGER NOT NULL DEFAULT 0, idealStock INTEGER NOT NULL DEFAULT 0, maxStock INTEGER NOT NULL DEFAULT 0, allowNegative INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, iconType TEXT NOT NULL DEFAULT 'general', colorTheme TEXT, FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL, FOREIGN KEY (brandId) REFERENCES brands(id) ON DELETE SET NULL, FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL, cpf TEXT, email TEXT, phone TEXT, creditLimit REAL NOT NULL DEFAULT 0, currentDebt REAL NOT NULL DEFAULT 0, creditStatus TEXT NOT NULL DEFAULT 'liberado', dueDays INTEGER DEFAULT 30, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, timestamp TEXT NOT NULL, terminal TEXT NOT NULL DEFAULT 'PDV-01', operator TEXT NOT NULL, subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, paymentMethod TEXT NOT NULL, customerId TEXT, customerName TEXT DEFAULT 'Consumidor Final', customerCpf TEXT, status TEXT NOT NULL DEFAULT 'concluida', cancelledAt TEXT, cancelReason TEXT, cashRegisterId TEXT, FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, saleId TEXT NOT NULL, productId TEXT NOT NULL, productName TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unitPrice REAL NOT NULL DEFAULT 0, originalPrice REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, productId TEXT NOT NULL, productName TEXT NOT NULL, type TEXT NOT NULL, operation TEXT NOT NULL DEFAULT 'saida', quantity INTEGER NOT NULL DEFAULT 0, previousStock INTEGER NOT NULL DEFAULT 0, newStock INTEGER NOT NULL DEFAULT 0, unitCost REAL NOT NULL DEFAULT 0, totalValue REAL NOT NULL DEFAULT 0, reason TEXT NOT NULL, timestamp TEXT NOT NULL, operator TEXT NOT NULL, operatorId TEXT, referenceDocument TEXT, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cash_registers (id TEXT PRIMARY KEY, openedAt TEXT NOT NULL, closedAt TEXT, openingBalance REAL DEFAULT 0, balance REAL DEFAULT 0, salesTotal REAL DEFAULT 0, closingBalance REAL DEFAULT 0, countedBalance REAL DEFAULT 0, difference REAL DEFAULT 0, status TEXT NOT NULL DEFAULT 'aberto', operator TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cash_movements (id TEXT PRIMARY KEY, cashRegisterId TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, description TEXT, timestamp TEXT NOT NULL, operator TEXT, referenceId TEXT, FOREIGN KEY (cashRegisterId) REFERENCES cash_registers(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, name TEXT NOT NULL, productId TEXT NOT NULL, discountType TEXT NOT NULL DEFAULT 'percent', discountValue REAL NOT NULL DEFAULT 0, minQuantity INTEGER NOT NULL DEFAULT 1, startDate TEXT NOT NULL, endDate TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS company_settings (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL DEFAULT 'VendasPRO', tradeName TEXT NOT NULL DEFAULT 'Minha Loja', cnpj TEXT NOT NULL DEFAULT '', ie TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', pixKey TEXT, pixKeyType TEXT, pixBeneficiaryName TEXT, pixCity TEXT, defaultMarginPercent REAL DEFAULT 40, cardFeePercent REAL DEFAULT 3);
    CREATE TABLE IF NOT EXISTS sequences (prefix TEXT PRIMARY KEY, current_value INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
  `);

  const cols = db.prepare('PRAGMA table_info(cash_registers)').all().map((c: any) => c.name);
  const alters = [
    ['closingBalance', 'ALTER TABLE cash_registers ADD COLUMN closingBalance REAL DEFAULT 0'],
    ['countedBalance', 'ALTER TABLE cash_registers ADD COLUMN countedBalance REAL DEFAULT 0'],
    ['difference', 'ALTER TABLE cash_registers ADD COLUMN difference REAL DEFAULT 0'],
    ['code', 'ALTER TABLE cash_registers ADD COLUMN code TEXT'],
    ['operatorId', 'ALTER TABLE cash_registers ADD COLUMN operatorId TEXT'],
    ['closedBy', 'ALTER TABLE cash_registers ADD COLUMN closedBy TEXT'],
  ] as const;
  for (const [name, sql] of alters) {
    if (!cols.includes(name)) db.exec(sql);
  }

  const movCols = db.prepare('PRAGMA table_info(cash_movements)').all().map((c: any) => c.name);
  const movAlters = [
    ['reason', 'ALTER TABLE cash_movements ADD COLUMN reason TEXT'],
    ['operatorId', 'ALTER TABLE cash_movements ADD COLUMN operatorId TEXT'],
  ] as const;
  for (const [name, sql] of movAlters) {
    if (!movCols.includes(name)) db.exec(sql);
  }

  const setCols = db.prepare('PRAGMA table_info(company_settings)').all().map((c: any) => c.name);
  if (setCols.length > 0 && !setCols.includes('withdrawalLimit')) {
    db.exec('ALTER TABLE company_settings ADD COLUMN withdrawalLimit REAL DEFAULT 0');
  }

  const custCols = db.prepare('PRAGMA table_info(customers)').all().map((c: any) => c.name);
  if (custCols.length > 0 && !custCols.includes('active')) {
    db.exec('ALTER TABLE customers ADD COLUMN active INTEGER DEFAULT 1');
    db.exec('UPDATE customers SET active = 1 WHERE active IS NULL');
  }

  const saleCols = db.prepare('PRAGMA table_info(sales)').all().map((c: any) => c.name);
  if (saleCols.length > 0 && !saleCols.includes('cashRegisterId')) {
    try { fs.copyFileSync(DB_PATH, `${DB_PATH}.bak`); } catch { /* ignore */ }
    db.exec('ALTER TABLE sales ADD COLUMN cashRegisterId TEXT');
  }

  const chk = db.prepare('SELECT COUNT(*) as c FROM sequences').get() as any;
  if (chk.c === 0) {
    const ins = db.prepare('INSERT INTO sequences (prefix, current_value) VALUES (?, ?)');
    ['USR','CAT','MRC','FOR','PRD','CLI','VND','MOV','REG','PROM','CMP'].forEach(p => ins.run(p, 0));
  }
  const cf = db.prepare("SELECT id FROM customers WHERE name LIKE '%Consumidor Final%'").get();
  if (!cf) db.prepare("INSERT INTO customers (id, code, name, creditLimit, currentDebt, creditStatus, dueDays) VALUES ('cons-final','CLI-000000','Consumidor Final (Sem CPF)',0,0,'liberado',0)").run();
  const st = db.prepare('SELECT id FROM company_settings WHERE id = 1').get();
  if (!st) db.prepare("INSERT INTO company_settings (id,name,tradeName) VALUES (1,'VendasPRO','Minha Loja')").run();

  // Integridade: bloqueia exclusão direta (DELETE) das tabelas de histórico.
  // As FKs ON DELETE CASCADE apagariam itens de venda/movimentos silenciosamente;
  // o único caminho permitido é soft-delete (active=0) ou cancelamento (status).
  const guarded = ['sales', 'sale_items', 'products', 'customers', 'stock_movements', 'cash_registers', 'cash_movements'];
  for (const t of guarded) {
    db.exec(`CREATE TRIGGER IF NOT EXISTS trg_guard_${t} BEFORE DELETE ON ${t}
             BEGIN SELECT RAISE(ABORT, 'Integridade: exclusao direta nao e permitida (use desativar/cancelar)'); END`);
  }

  seed();
  return db;
}

export function nextCode(p: string): string {
  const d = getDb();
  const s = d.prepare('SELECT current_value FROM sequences WHERE prefix = ?').get(p) as any;
  const v = (s?.current_value || 0) + 1;
  d.prepare('INSERT OR REPLACE INTO sequences (prefix, current_value) VALUES (?, ?)').run(p, v);
  return `${p}-${String(v).padStart(6, '0')}`;
}

function seed() {
  const d = getDb();
  const c = d.prepare('SELECT COUNT(*) as c FROM products').get() as any;
  if (c.c > 0) return;
  let seedPass = process.env.VP_SEED_PASSWORD;
  if (!seedPass) {
    seedPass = crypto.randomBytes(9).toString('base64url');
    console.log(`[seed] Senha admin gerada: ${seedPass} (defina VP_SEED_PASSWORD para controlar)`);
  }
  const h = bcrypt.hashSync(seedPass, 10);
  const insU = d.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)');
  insU.run('usr-001','Admin','admin@vendaspro.com',h,'admin');
  insU.run('usr-002','Caixa','caixa@vendaspro.com',h,'caixa');
  const insC = d.prepare('INSERT INTO categories (id,code,name) VALUES (?,?,?)');
  insC.run('cat-001',nextCode('CAT'),'Bebidas');
  insC.run('cat-002',nextCode('CAT'),'Snacks');
  insC.run('cat-003',nextCode('CAT'),'Confeitarias');
  insC.run('cat-004',nextCode('CAT'),'Materiais');

  const insB = d.prepare('INSERT INTO brands (id,code,name) VALUES (?,?,?)');
  insB.run('brd-001',nextCode('MRC'),'Garoto');
  insB.run('brd-002',nextCode('MRC'),'Coca-Cola');
  insB.run('brd-003',nextCode('MRC'),'Pepsi');
  insB.run('brd-004',nextCode('MRC'),'Premius');
  insB.run('brd-005',nextCode('MRC'),'Arisco');

  const insP = d.prepare(`INSERT INTO products (id,code,name,barcode,sku,categoryId,category,brandId,brand,unit,price,costPrice,stock,minStock,iconType) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const prods = [
    ['Coca-Cola Lata 350ml','7896001051156','CCO-350','cat-001','brd-002',5.50,3.20,50,10,'drink'],
    ['Coca-Cola 600ml','7896001051118','CCO-600','cat-001','brd-002',7.50,4.20,30,8,'drink'],
    ['Guarana Antarctica 350ml','7896001051262','GUA-350','cat-001','brd-003',5.50,3.10,40,10,'drink'],
    ['Brahma 600ml','7896001051460','BRA-600','cat-001','brd-001',8.50,4.50,20,5,'drink'],
    ['Snack Chips BBQ 50g','','CHP-BBQ','cat-002','brd-004',4.50,2.20,60,15,'snack'],
    ['Sanduíche Natural Frango 240g','','SAN-FRANGO','cat-002','brd-005',9.90,5.00,25,8,'snack'],
    ['Água Comfort 500ml','7891020750023','AGU-500','cat-001',null,3.50,1.80,100,20,'drink'],
    ['Paçoca 50g','','PAC-50','cat-002',null,3.00,1.50,80,20,'candy'],
    ['Biscoito Maizena Recheado','','BIS-MAIZENA','cat-002',null,3.50,1.80,70,15,'snack'],
    ['Balas Pirulito 14g','','BALA-PIRU','cat-002',null,1.50,0.80,200,30,'candy'],
  ] as const;
  prods.forEach(([n,bc,sku,catId,brId,p,cp,st,min,ico]) => {
    insP.run(`prd-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, nextCode('PRD'), n, bc, sku, catId, catId, brId, brId, 'UN', p, cp, st, min, ico);
  });
}
