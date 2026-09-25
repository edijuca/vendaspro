# VendasPRO — Documentação Completa do Projeto

**Versão:** 1.0.0  
**Data de criação:** 23/09/2026  
**Última atualização:** 24/09/2026  
**Status:** ✅ Produzível — sistema completo, testado e deployável  
**Observação:** CSS migrado de Tailwind CSS 4 para sistema próprio baseado em Gestão Mais Simples (GMS). O Tailwind foi removido da stack.

---

## 📋 Visão Geral

Sistema completo de PDV e gestão para pequenos negócios, construído do zero com React + Express + SQLite — **inspirado no Gestão Mais Simples**, mas 100% novo (nada copiado do ConveniencePDV).

### O que faz

| Módulo | Descrição |
|---|---|
| **PDV (Ponto de Venda)** | Venda rápida com carrinho, desconto, seleção de cliente, múltiplos métodos de pagamento (dinheiro, PIX, cartão crédito/débito **parcelado 1x–12x**, fiado), validação de estoque com sons de feedback, decremento automático de estoque |
| **PDV — Atalhos** | F2 código, F3 excluir, F4 quantidade, F5 nova venda, F6 consulta de preço, F7 cadastro rápido de cliente, F8 busca, F9 focar cliente, F10/F12 finalizar, **Ctrl+Enter confirma a venda**; dropdown de busca navegável por ↑↓/Enter |
| **PIX + Cupom** | QR Code PIX (payload EMVCo com CRC16) copiável na finalização e cupom pós-venda 80/58mm com impressão pelo navegador |
| **Dashboard** | Período Hoje/7/30 dias, KPIs comparados ao período anterior (faturamento, vendas, ticket médio, canceladas), status do caixa, gráfico de vendas por dia, formas de pagamento com participação %, top produtos, últimas vendas, alertas de estoque baixo / fiados em aberto / promoções vencendo, auto-refresh 60s |
| **Produtos** | CRUD completo com código de barras, SKU, categorias, marcas, controle de estoque mínimo |
| **Estoque** | Histórico de movimentações (entradas/saídas), resumo geral, alerta de estoque baixo |
| **Vendas** | Histórico completo, cancelamento com devolução de estoque |
| **Clientes** | Cadastro com limite de crédito, status (liberado/bloqueado/suspenso/inadimplente) |
| **Caixa** | Abertura/fechamento de registros, controle de saldo e vendas totais, suprimento e sangria |
| **Scanner de Código de Barras** | Leitura via webcam (html5-qrcode) com lanterna, modo contínuo, seleção de câmera e entrada manual |
| **Autenticação** | Login com JWT, roles (admin/gerente/caixa) |
| **Configurações** | Dados da empresa, chave PIX, margens e taxas padrão |

---

## 🛠 Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| **Frontend** | React | 19.0.1 |
|  | Vite | 6.2.3 |
|  | TypeScript | ~5.8.2 |
|  | React DOM | 19.0.1 |
|  | html5-qrcode | 2.3.8 |
|  | Lucide React | 0.546.0 |
|  | QRCode | 1.5.4 |
| **Backend** | Node.js | v22.23.2 |
|  | Express | 4.21.2 |
|  | better-sqlite3 | 13.0.3 |
|  | bcryptjs | 3.0.3 |
|  | jsonwebtoken | 9.0.2 |
|  | cors | 2.8.6 |
| **Banco** | SQLite | arquivo local `vendaspro.db` |
| **CSS** | Sistema próprio (GMS baseado) | — (substituiu Tailwind CSS 4) |

> **Nota sobre CSS:** O projeto usava Tailwind CSS 4. Foi migrado para um sistema de classes utilitárias próprio, baseado no design system do Gestão Mais Simples (GMS): paleta `--navy #1e293b`, `--bg #f8fafc`, `--surface #ffffff`, `--text #1e293b`, `--muted #64748b`, `--brand #f97316` (laranja VendasPRO), `--primary #3b82f6` (azul GMS), `--success #10b981`, `--danger #ef4444`, `--warning #f59e0b`. Tipografia: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.

---

## 📦 Instalação

```bash
cd vendaspro
npm install
```

> **Nota para desenvolvimento:** O `npm install` instala todas as dependências. Tailwind CSS 4 e suas dependências foram removidos do `package.json` (agora é sistema próprio de CSS). Não há mais `@tailwindcss/vite` nem `tailwindcss` no `devDependencies`.

---

## 🏃 Como usar

### Modo desenvolvimento (recomendado)

```bash
npm run dev
```

Inicia backend (porta 3001) e frontend (porta 5173) simultaneamente.

Ou manualmente:

```bash
# Terminal 1 — Backend
npx tsx server/index.ts
# Terminal 2 — Frontend
npx vite --port=5173 --host=0.0.0.0
```

### Modo produção

```bash
npm run build    # Gera a pasta dist/
npm start        # Roda apenas o backend (frontend estático servido por ele)
```

> **Nota:** O backend serve também o frontend buildado. Para build, o Vite gera `dist/`. O backend serve `dist/` como estáticos.

### Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Backend + Frontend simultâneos |
| `npm run dev:backend` | Apenas backend (tsx watch) |
| `npm run dev:frontend` | Apenas frontend (Vite) |
| `npm run build` | Build de produção (Vite) |
| `npm run preview` | Preview do build |
| `npm run lint` | Verificação TypeScript (`tsc --noEmit`) |
| `npm test` | Testes API (vitest + supertest, 31 testes) |
| `npm start` | Backend em produção (`tsx server/index.ts`) |

---

## 🔑 Credenciais padrão

| Role | E-mail | Senha |
|---|---|---|
| **Admin** | admin@vendaspro.com | admin123 |
| **Caixa** | caixa@vendaspro.com | admin123 |

> Os usuários são criados automaticamente pelo seed do banco na primeira inicialização.

---

## 📁 Estrutura do projeto

```
vendaspro/
├── package.json              # Dependências + scripts
├── vite.config.ts            # Configuração Vite (sem Tailwind)
├── tsconfig.json             # Configuração TypeScript (strict: true)
├── index.html                # HTML entry point do frontend
├── README.md                 # Visão geral + API
├── iniciar.bat               # Script Windows (backend + frontend)
├── iniciar.sh                # Script Unix (backend + frontend)
├── PLAN.md                   # Plano de trabalho com status
├── server/
│   ├── index.ts              # Bootstrap Express (71 linhas): rotas + static dist
│   ├── db.ts                 # Schema, seed, migrações, sequences, triggers anti-DELETE, backup rotativo
│   ├── middleware.ts         # authMid (JWT), requireRole
│   ├── routes/               # auth, products, sales, stock, customers,
│   │                         # cash, entities, promotions, reports, settings
│   └── tests/api.test.ts     # Suíte vitest + supertest (31 testes)
├── src/
│   ├── main.tsx              # Entry point React
│   ├── App.tsx               # Shell + navegação entre views (173 linhas)
│   ├── api.ts                # Cliente fetch para API (135 linhas)
│   ├── types.ts              # Interfaces TypeScript (207 linhas)
│   ├── AuthContext.tsx       # Contexto de autenticação JWT
│   ├── global.css            # Sistema de CSS próprio (base GMS, 2.506 linhas)
│   ├── utils/
│   │   ├── audio.ts          # Sons de feedback (scanner, venda, erro)
│   │   └── pixPayload.ts     # Payload PIX EMVCo + CRC16 + QR Code
│   └── components/
│       ├── LoginScreen.tsx   # Tela de login (106 linhas)
│       ├── Sidebar.tsx       # Sidebar de navegação (60 linhas)
│       ├── CameraBarcodeScannerModal.tsx  # Scanner (427 linhas)
│       ├── PriceConsultModal.tsx          # Consulta de preço — F6
│       ├── QuickCustomerModal.tsx         # Cadastro rápido de cliente — F7
│       ├── ReceiptModal.tsx               # Cupom 80/58mm + impressão + QR PIX
│       └── views/            # PDVPage (1.155), DashboardPage (539),
│                             # Produtos, Estoque, Vendas, Clientes, Caixa,
│                             # Cadastros, Promocoes, Relatorios, Configuracoes
└── node_modules/             # (instalado via npm install)
```

---

## 🔌 API Endpoints

Base: `http://localhost:3001/api`

### Auth

| Método | Path | Descrição |
|---|---|---|
| POST | `/auth/login` | Login (email + password) → retorna JWT + user |
| GET | `/auth/me` | Perfil do usuário logado (requer JWT) |

### Products (Produtos)

| Método | Path | Descrição |
|---|---|---|
| GET | `/products` | Listar ativos (filtros `?search=`, `?includeInactive=1`) |
| GET | `/products/:id` | Detalhar produto |
| GET | `/products/barcode/:bc` | Buscar por código de barras |
| POST | `/products` | Criar produto |
| PUT | `/products/:id` | Atualizar produto (inclui reativar via `active`) |
| DELETE | `/products/:id` | Desativar produto (soft-delete, mantém histórico) |

### Sales (Vendas)

| Método | Path | Descrição |
|---|---|---|
| GET | `/sales` | Histórico de vendas (com filtro `?status=`) |
| GET | `/sales/:id` | Detalhes da venda |
| POST | `/sales` | Criar venda (itens, pagamento, cliente) |
| PUT | `/sales/:id/cancel` | Cancelar venda (devolve estoque) |

### Customers (Clientes)

| Método | Path | Descrição |
|---|---|---|
| GET | `/customers` | Listar ativos (`?includeInactive=1` inclui arquivados) |
| GET | `/customers/:id` | Detalhar cliente |
| POST | `/customers` | Criar cliente |
| PUT | `/customers/:id` | Atualizar cliente (arquivar/reativar via `active`) |
| POST | `/customers/:id/payments` | Receber pagamento de fiado (parcial/total) |

### Stock (Estoque)

| Método | Path | Descrição |
|---|---|---|
| GET | `/stock` | Histórico de movimentações (filtros query) |
| GET | `/stock/summary` | Resumo geral (saídas, entradas, produtos afetados) |
| POST | `/stock` | Registrar movimentação manual |

### Cash (Caixa)

| Método | Path | Descrição |
|---|---|---|
| GET | `/cash/registers` | Listar todos os registros de caixa |
| GET | `/cash/registers/current` | Caixa atual aberto |
| GET | `/cash/registers/:id` | Detalhar registro (+ resumo da sessão) |
| GET | `/cash/registers/:id/summary` | Resumo (saldo esperado, vendas, por pagamento) |
| GET | `/cash/registers/:id/report` | Relatório do caixa (movimentações) |
| POST | `/cash/registers/open` | Abrir novo registro de caixa |
| POST | `/cash/registers/:id/close` | Fechar registro de caixa (contagem/diferença) |
| POST | `/cash/registers/:id/reopen` | Reabrir caixa fechado (admin) |
| GET | `/cash/movements` | Movimentações de um caixa (filtro `?cashRegisterId=`) |
| POST | `/cash/movements` | Registrar suprimento/sangria |

### Settings (Configurações da empresa)

| Método | Path | Descrição |
|---|---|---|
| GET | `/settings` | Obter configurações da empresa |
| PUT | `/settings` | Atualizar configurações |

### Entities (Entidades auxiliares)

| Método | Path | Descrição |
|---|---|---|
| GET | `/entities/categories` | Listar categorias |
| GET | `/entities/brands` | Listar marcas |
| GET | `/entities/suppliers` | Listar fornecedores |
| GET | `/entities/users` | Listar usuários |
| POST | `/entities/categories` | Criar categoria |
| POST | `/entities/brands` | Criar marca |
| POST | `/entities/suppliers` | Criar fornecedor |
| PUT/DELETE | `/entities/{categories,brands,suppliers,users}` | Atualizar/inativar (admin) |

### Promotions (Promoções)

| Método | Path | Descrição |
|---|---|---|
| GET | `/promotions` | Listar ativas (`?includeInactive=1` inclui inativas) |
| GET | `/promotions/active` | Promoções vigentes (hoje entre início e fim) |
| POST | `/promotions` | Criar promoção |
| PUT | `/promotions/:id` | Atualizar promoção (reativar via `active`) |
| DELETE | `/promotions/:id` | Desativar promoção (soft-delete) |

### Reports (Relatórios — admin/gerente)

| Método | Path | Descrição |
|---|---|---|
| GET | `/reports/sales?from=&to=` | Faturamento, contagem, canceladas (`cancelled` em R$ + `cancelledCount`), descontos, ticket médio, por pagamento, por dia (60d) e top produtos |
| GET | `/reports/stock-low` | Produtos com estoque ≤ mínimo (até 200) |

---

## 📊 Banco de dados

### Arquitetura

- **SQLite** em arquivo local: `vendaspro.db`
- **Seed automático:** ao first start, cria 10 produtos reais (Coca-Cola, Guaraná, Brahma, etc.), 4 categorias, 5 marcas, 2 usuários (admin + caixa)
- **Schema:** tabelas `users`, `categories`, `brands`, `suppliers`, `products`, `customers`, `sales`, `sale_items`, `stock_movements`, `cash_registers`, `cash_movements`, `promotions`, `company_settings`, `sequences`

### Integridade e backup

- **Triggers anti-DELETE:** `trg_guard_<tabela>` com `RAISE(ABORT)` em `sales`, `sale_items`, `products`, `customers`, `stock_movements`, `cash_registers` e `cash_movements` — bloqueiam exclusão direta (inclusive SQL manual); os únicos caminhos são soft-delete (`active=0`) e cancelamento (`status`)
- **Soft-delete com reativação:** produtos (`DELETE` inativa, `PUT active=1` reativa), promoções, clientes (arquivamento via `active`); listas aceitam `?includeInactive=1`
- **Dashboard "Fiados em aberto"** inclui clientes arquivados com dívida (`includeInactive=true`)
- **Backup rotativo:** a cada inicialização, antes das migrações, copia para `vendaspro-<timestamp>.db.bak` e mantém as **últimas 5 gerações** (`wal_checkpoint` antes da cópia)
- **Backup de migração:** `vendaspro.db.bak` (geração única) apenas antes de migrações de schema

### Products seed (10 itens)

| # | Nome | Código | Marca | Preço | Estoque |
|---|---|---|---|---|---|
| 1 | Coca-Cola Lata 350ml | CCO-350 | Coca-Cola | R$ 5,50 | 50 |
| 2 | Coca-Cola 600ml | CCO-600 | Coca-Cola | R$ 7,50 | 30 |
| 3 | Guaraná Antarctica 350ml | GUA-350 | Antarctica | R$ 5,50 | 40 |
| 4 | Brahma 600ml | BRA-600 | Brahma | R$ 8,50 | 20 |
| 5 | Snack Chips BBQ 50g | CHP-BBQ | — | R$ 4,50 | 60 |
| 6 | Sanduíche Natural Frango 240g | SAN-FRANGO | — | R$ 9,90 | 25 |
| 7 | Água Comfort 500ml | AGU-500 | Comfort | R$ 3,50 | 100 |
| 8 | Paçoca 50g | PAC-50 | — | R$ 3,00 | 80 |
| 9 | Biscoito Maizena Recheado | BIS-MAIZENA | — | R$ 3,50 | 70 |
| 10 | Balas Pirulito 14g | BALA-PIRU | — | R$ 1,50 | 200 |

---

## 🎨 Sistema de design (CSS)

### Paleta de cores

| Variável | Valor | Uso |
|---|---|---|
| `--navy` | `#1e293b` | Fundo sidebar, texto dark |
| `--bg` | `#f8fafc` | Fundo da página |
| `--surface` | `#ffffff` | Fundo cards, inputs, modais |
| `--text` | `#1e293b` | Texto principal |
| `--muted` | `#64748b` | Texto secundário |
| `--muted-light` | `#94a3b8` | Texto leve |
| `--border` | `#cbd5e1` | Bordas |
| `--border-light` | `#e2e8f0` | Bordas claras |
| `--brand` | `#f97316` | **Marca VendasPRO (laranja)** — botões primários, logo |
| `--brand-dark` | `#ea580c` | Hover laranja |
| `--brand-light` | `#fff7ed` | Fundo laranja claro |
| `--brand-soft` | `#ffedd5` | Fundo laranja soft |
| `--brand-border` | `#fed7aa` | Borda laranja |
| `--primary` | `#3b82f6` | **Azul GMS** — ícones, accents |
| `--primary-dark` | `#2563eb` | Hover azul |
| `--success` | `#10b981` | Sucesso, estoque OK |
| `--success-light` | `#d1fae5` | Fundo sucesso |
| `--danger` | `#ef4444` | Erro, estoque negativo |
| `--danger-light` | `#fee2e2` | Fundo erro |
| `--warning` | `#f59e0b` | Aviso, estoque baixo |
| `--warning-light` | `#fef3c7` | Fundo aviso |
| `--teal` | `#00b894` | Reservado |

### Tipografia

```
font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

### Classes utilitárias (mapeamento Tailwind → GMS)

> Todas as classes do JSX (App.tsx, componentes) foram mantidas — o `global.css` agora implementa as mesmas classes utilitárias que o Tailwind fornecia, mas usando variáveis GMS.

| Categoria | Exemplos |
|---|---|
| **Background** | `.bg-white`, `.bg-slate-50`, `.bg-orange-500`, `.bg-black\\/40` |
| **Text** | `.text-white`, `.text-slate-400`, `.text-orange-600`, `.text-red-500`, `.text-sm`, `.text-xs`, `.text-lg`, `.font-bold`, `.font-semibold`, `.truncate` |
| **Flex** | `.flex`, `.flex-col`, `.items-center`, `.justify-between`, `.gap-1` a `.gap-4`, `.flex-1`, `.flex-shrink-0` |
| **Grid** | `.grid`, `.grid-cols-1` a `.grid-cols-4`, `.gap-2` a `.gap-4` |
| **Spacing** | `.p-1` a `.p-6`, `.px-2` a `.px-4`, `.py-1` a `.py-3`, `.mb-1` a `.mb-5`, `.mt-1` a `.mt-6`, `.mx-4`, `.ml-auto` |
| **Border** | `.border`, `.border-t`, `.border-b`, `.border-r`, `.border-slate-100`, `.border-orange-500` |
| **Radius** | `.rounded-sm` a `.rounded-2xl`, `.rounded-full` |
| **Shadow** | `.shadow-sm`, `.shadow-md`, `.shadow-lg`, `.shadow-xl`, `.shadow-2xl` |
| **Display** | `.block`, `.inline-block`, `.inline`, `.inline-flex`, `.fixed`, `.relative`, `.z-10`, `.z-50`, `.z-100`, `.min-h-screen` |
| **Width/Height** | `.w-full`, `.w-10`, `.w-8`, `.w-16`, `.w-80`, `.w-14`, `.h-10`, `.h-14`, `.h-8`, `.h-full`, `.max-w-sm`, `.max-w-md`, `.max-w-2xl` |
| **Overflow** | `.overflow-hidden`, `.overflow-y-auto`, `.overflow-x-auto` |
| **Hover** | `.hover\:bg-slate-100:hover`, `.hover\:text-orange-700:hover`, `.hover\:shadow-sm:hover` etc. |
| **Divide** | `.divide-y`, `.divide-y > * + *` (linhas separadoras) |
| **Hidden** | `.hidden-mobile` (display none em mobile) |
| **Selected** | `.selected`, `[aria-selected="true"]` |
| **Específicos** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-sm`, `.btn-lg`, `.input`, `.label`, `.select`, `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-neutral`, `.badge-info`, `.card`, `.icon-btn`, `.icon-btn-sm`, `.spinner` |
| **Dashboard** | `.dash-toolbar`, `.dash-range`/`.dash-range-btn`, `.dash-kpi`, `.dash-delta`, `.dash-caixa`/`.dash-caixa-stats`, `.dash-two`/`.dash-three`, `.dash-chart`/`.dash-chart-bar`, `.dash-pay`/`.dash-pay-track`, `.dash-list-row` |

---

## 🔐 Autenticação

- **JWT** com jsonwebtoken, token de 8h de validade
- Token armazenado no **localStorage** (frontend)
- Header `Authorization: Bearer <token>` em todas as requisições autenticadas
- Roles: `admin` (acesso total), `gerente` (cadastros, promoções, relatórios), `caixa` (operacional: PDV, vendas, clientes, caixa, estoque, dashboard)
- Relatórios agregados (`/api/reports/sales`) exigem admin/gerente — no dashboard, o perfil caixa usa o fallback **"Resumo local"** (cálculo a partir das últimas 200 vendas)
- Backend valida JWT em todas as rotas protegidas

---

## 📦 Build e deployment

### Build de produção

```bash
npm run build
```

Gera `dist/` com o frontend compilado. O backend serve `dist/` como estáticos em produção.

### Arquivo de inicialização

| Arquivo | Sistema | Uso |
|---|---|---|
| `iniciar.bat` | Windows | Abre dois terminais: backend (3001) + frontend (5173) |
| `iniciar.sh` | Unix/Linux | Roda backend + frontend em background |

---

## ✅ Status + decisões

### Fases concluídas

| Fase | Status | Itens |
|---|---|---|
| **1 — Fundação** | ✅ | package.json, vite.config.ts, tsconfig.json, index.html, server (bootstrap + rotas), banco, auth, produtos, vendas, estoque, clientes, caixa, configurações, seed, api.ts, types.ts |
| **2 — PDV** | ✅ | PDVPage (carrinho, pagamento, checkout, cliente) |
| **3 — Gestão** | ✅ | DashboardPage, ProdutosView, ClientesView, EstoqueView, VendasView, CaixaView, ConfiguracoesView, CadastrosView, PromocoesView, RelatoriosView |
| **4 — Extras** | ✅ | Header, Sidebar, LoginScreen, global.css, scripts de inicialização, README |
| **5 — Porte do PDV (ConvenienciaPDV)** | ✅ | utils/audio.ts, utils/pixPayload.ts, scanner redesenhado, PriceConsultModal, QuickCustomerModal, ReceiptModal, validação de estoque, parcelas 1x–12x, painel QR PIX |
| **6 — UX do PDV + Dashboard** | ✅ | setas no dropdown, atalhos F7/F9/F2, Ctrl+Enter, Dashboard completo (períodos, KPIs, gráficos, alertas, auto-refresh), `cancelledCount` no backend |

### Decisões de arquitetura

- **Backend modular:** bootstrap em `server/index.ts` (71 linhas) + rotas separadas em `server/routes/*` (auth, products, sales, stock, customers, cash, entities, promotions, reports, settings)
- **Seed pré-carregado:** 10 produtos reais para teste imediato
- **Scanner opcional:** Modal de scanner via html5-qrcode, não obrigatório
- **CSS próprio (GMS):** Migrado de Tailwind CSS 4 para sistema de classes utilitárias baseado no design system do Gestão Mais Simples — remove dependência externa, fidelidade visual ao referência
- **Dashboard com fallback:** perfil sem acesso a `/api/reports/sales` (caixa) recebe "Resumo local" calculado no cliente em vez de erro
- **Testes no servidor:** vitest + supertest cobrindo as rotas da API (`server/tests/api.test.ts`)

### Erros resolvidos

| Erro | Resolução |
|---|---|
| FOREIGN KEY no seed | IDs de categorias/marcas fixos em vez de aleatórios |
| `tsc` não encontra React types | Instalado `@types/react` e `@types/react-dom` |
| Imports de tipos no api.ts | Adicionado import explícito das interfaces |
| Import path LoginScreen/Sidebar | Corrigido de `./` para `../` |
| Type mismatch no AuthContext | Cast `as any` no role |
| **CSS Tailwind removido** | Migrado para sistema GMS próprio — `@tailwindcss/vite` e `tailwindcss` removidos do package.json, `global.css` reescrito com variáveis e classes utilitárias GMS |

---

## ✅ Testes validados

### Validação atual (24/09/2026)

| Teste | Status | Detalhe |
|---|---|---|
| TypeScript (`npm run lint`) | ✅ | `tsc --noEmit` exit 0 |
| Testes API (`npm test`) | ✅ | vitest + supertest — **31/31 passed** |
| Build (`npm run build`) | ✅ | Vite build sem avisos |

### Validação inicial (23/09/2026)

| Teste | Status | Detalhe |
|---|---|---|
| TypeScript (`npx tsc --noEmit`) | ✅ | Exit 0 — compila limpo (sem erros) |
| Backend (porta 3001) | ✅ | Health OK, v1.0.0 respondendo |
| Frontend (porta 5173) | ✅ | HTTP 200, servindo a app |
| Login admin | ✅ | admin@vendaspro.com / admin123 → role: admin |
| Login caixa | ✅ | caixa@vendaspro.com / admin123 → role: caixa |
| Categorias | ✅ | 4 registros |
| Marcas | ✅ | 5 registros |
| Produtos | ✅ | 10 registros (seed) |
| Produto por código | ✅ | 7896001051156 → Coca-Cola Lata 350ml |
| Vendas | ✅ | 0 (sem histórico — esperado para seed) |
| Caixas | ✅ | 0 (sem caixa aberto — esperado) |
| Estoque | ✅ | 0 movimentações (sem histórico — esperado) |
| Resumo estoque | ✅ | `{"saidas":null,"entradas":null,"produtos":0}` |
| Configurações | ✅ | Empresa: "Minha Loja" |

---

## 🔮 Próximos passos (extensões futuras)

- [x] Relatórios por período — `RelatoriosView` + Dashboard com comparativos
- [x] Cupom de venda 80/58mm com impressão (`ReceiptModal`) — cupom não fiscal
- [ ] Emissão fiscal NF-e / SAT / CF-e
- [ ] Portal do cliente (consultar saldo de fiado)
- [ ] Integração com marketplace (Amazon, Mercado Livre)
- [ ] Múltiplos estabelecimentos (multi-tenant)

---

## 📄 Arquivos relacionados

| Arquivo | Descrição |
|---|---|
| `server/index.ts` | Bootstrap Express (71 linhas) |
| `server/routes/*` | 10 módulos de rota (auth, products, sales, stock, customers, cash, entities, promotions, reports, settings) |
| `server/tests/api.test.ts` | Suíte de testes API (vitest + supertest, 31 testes) |
| `src/App.tsx` | Shell + navegação entre views (173 linhas) |
| `src/api.ts` | Cliente de API (135 linhas) |
| `src/types.ts` | Interfaces TypeScript (207 linhas) |
| `src/global.css` | Sistema de CSS próprio baseado em GMS (2.506 linhas) |
| `src/AuthContext.tsx` | Contexto de autenticação |
| `src/utils/audio.ts` | Sons de feedback (beep de scanner/venda/erro) |
| `src/utils/pixPayload.ts` | Payload PIX EMVCo + CRC16 + QR Code |
| `src/components/LoginScreen.tsx` | Tela de login (106 linhas) |
| `src/components/Sidebar.tsx` | Sidebar de navegação (60 linhas) |
| `src/components/CameraBarcodeScannerModal.tsx` | Scanner de código de barras (427 linhas) |
| `src/components/PriceConsultModal.tsx` | Consulta de preço — F6 (120 linhas) |
| `src/components/QuickCustomerModal.tsx` | Cadastro rápido de cliente — F7 (155 linhas) |
| `src/components/ReceiptModal.tsx` | Cupom 80/58mm + impressão (225 linhas) |
| `src/components/views/PDVPage.tsx` | PDV venda + checkout (1.155 linhas) |
| `src/components/views/DashboardPage.tsx` | Dashboard com períodos/KPIs/alertas (539 linhas) |
| `vite.config.ts` | Configuração Vite (sem Tailwind) |
| `tsconfig.json` | Configuração TypeScript (strict: true) |
| `package.json` | Dependências + scripts |
| `index.html` | HTML entry point |
| `README.md` | Visão geral + API |
| `PLAN.md` | Plano de trabalho com status |
| `iniciar.bat` | Script Windows de inicialização |
| `iniciar.sh` | Script Unix de inicialização |

---

> **Projetos relacionados:**
> - **ConveniencePDV:** `C:\Users\Usuario\ConvenienciaPDV` — React 19 + Vite 6 + Tailwind 4, localStorage-only SPA (sem servidor)
> - **img-to-html (skill):** `C:\Users\Usuario\AppData\Local\hermes\skills\img-to-html` — pipeline para converter imagens/mocks em HTML+CSS+JS estáticos
> - **design-systems/vendaspro-gms:** `C:\Users\Usuario\design-systems\vendaspro-gms` — mock HTML estático do design system GMS (referência visual)

---

*Fim da documentação. VendasPRO v1.0.0 — Pronto para uso.*
