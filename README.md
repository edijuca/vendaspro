# VendasPRO — Sistema de Gestão de Vendas e Estoque

Sistema completo de PDV e gestão para small businesses, construído do zero com React + Express + SQLite.

## 🚀 Funcionalidades

- **PDV (Ponto de Venda)** — Carrinho com quantidade, desconto, seleção de cliente, pagamento em dinheiro/PIX/cartões/**fiado** (parcelado 1x–12x), busca por código de barras (Enter), scanner de câmera (lanterna, modo contínuo, seleção de câmera, entrada manual) e validação de estoque com sons de feedback
- **PDV — Atalhos** — F2 código, F3 excluir, F4 quantidade, F5 nova venda, F6 consulta de preço, F7 cadastro rápido de cliente, F8 busca, F9 focar cliente, F10/F12 finalizar, **Ctrl+Enter confirma a venda**; dropdown de busca navegável por ↑↓/Enter
- **PIX + Cupom** — QR Code PIX (payload EMVCo com CRC16) copiável na finalização e cupom pós-venda 80/58mm com impressão (`ReceiptModal`)
- **Promoções** — Desconto percentual ou fixo por produto aplicado automaticamente no total da venda; desativar/reativar com lista de inativas
- **Fiado/Crediário** — Limite e status de crédito, débito da dívida, recebimento parcial, estorno no cancelamento
- **Dashboard** — Período Hoje/7/30 dias com KPIs comparados ao período anterior (faturamento, vendas, ticket médio, canceladas), status do caixa, gráfico de vendas por dia, participação por forma de pagamento, top produtos, alertas de estoque baixo, fiados em aberto e promoções vencendo; auto-refresh a cada 60s (perfil caixa usa "Resumo local")
- **Produtos** — CRUD com categoria/marca/fornecedor via cadastros, estoque mínimo, desativar/reativar (lista de inativos)
- **Estoque** — Movimentação manual (entrada/saída) que atualiza o saldo do produto
- **Vendas** — Histórico, cancelamento com devolução de estoque e estorno de fiado
- **Clientes** — Formulário completo (CPF, contato, limite, status) + recebimento de dívida; arquivamento sem perder dívida/histórico
- **Caixa** — Abertura/fechamento com contagem e diferença, suprimento e sangria
- **Cadastros** — Categorias, marcas, fornecedores e usuários (admin)
- **Relatórios** — Faturamento por período, ticket médio, por pagamento, top produtos, estoque baixo
- **Roles** — admin, gerente e caixa com permissões no backend (`requireRole`)
- **Configurações** — Dados da empresa, PIX, margens e taxas
- **Integridade de dados** — Triggers bloqueiam exclusão direta (`DELETE`) de vendas, itens, produtos, clientes e movimentos de estoque/caixa; soft-delete com reativação (produtos, promoções, clientes); backup rotativo (últimas 5 gerações, `vendaspro-<timestamp>.db.bak`) a cada inicialização

## 🛠 Tecnologias

| Camada | Tech |
|---|---|
| Frontend | React 19, Vite 6, CSS próprio, TypeScript, html5-qrcode, qrcode (QR PIX) |
| Backend | Node.js, Express, better-sqlite3, bcryptjs, jsonwebtoken |
| Banco | SQLite (arquivo local `vendaspro.db`) |
| Testes | Vitest + supertest (`server/tests/api.test.ts`) |

## 📦 Instalação

```bash
cd vendaspro
npm install
```

## 🏃 Como usar

### Modo desenvolvimento (recomendado)

```bash
npm run dev
```

Inicia backend (porta 3001) e frontend (porta 5173) simultaneamente.

### Validação

```bash
npm run lint   # TypeScript (tsc --noEmit)
npm test       # Testes API (vitest, 31 testes)
```

### Modo produção

```bash
npm run build    # Gera a pasta dist/
npm start        # Roda apenas o backend (frontend estático servido por ele)
```

### Credenciais padrão (após primeiro início)

| Role | E-mail | Senha |
|---|---|---|
| Admin | admin@vendaspro.com | admin123 |
| Caixa | caixa@vendaspro.com | admin123 |

## 📁 Estrutura

```
vendaspro/
├── server/
│   ├── index.ts            # Bootstrap + static dist
│   ├── db.ts               # Schema, seed, migrações
│   ├── middleware.ts        # authMid, requireRole
│   ├── routes/
│   │   ├── auth.ts, products.ts, sales.ts, stock.ts
│   │   ├── customers.ts, cash.ts, entities.ts
│   │   └── promotions.ts, reports.ts, settings.ts
│   └── tests/api.test.ts   # Suíte vitest/supertest (31 testes)
├── src/
│   ├── App.tsx             # Shell + navegação
│   ├── api.ts              # Cliente API (Bearer)
│   ├── types.ts
│   ├── AuthContext.tsx
│   ├── global.css
│   ├── utils/              # audio.ts (sons), pixPayload.ts (QR PIX)
│   └── components/
│       ├── LoginScreen.tsx
│       ├── Sidebar.tsx
│       ├── CameraBarcodeScannerModal.tsx
│       ├── PriceConsultModal.tsx        # Consulta de preço (F6)
│       ├── QuickCustomerModal.tsx       # Cadastro rápido de cliente (F7)
│       ├── ReceiptModal.tsx             # Cupom 80/58mm + impressão
│       └── views/          # PDV, Dashboard, Produtos, Estoque,
│                           # Vendas, Clientes, Caixa, Cadastros,
│                           # Promocoes, Relatorios, Configuracoes
├── package.json, vite.config.ts, tsconfig.json, PLAN.md
```

## 🔑 API Endpoints

| Módulo | Método | Path | Descrição |
|---|---|---|---|
| Auth | POST | `/api/auth/login` | Login |
| Auth | GET | `/api/auth/me` | Perfil atual |
| Products | GET/POST/PUT/DELETE | `/api/products` | CRUD (roles) |
| Products | GET | `/api/products/barcode/:bc` | Buscar por código |
| Sales | GET/POST | `/api/sales` | Histórico / criar (promo + fiado) |
| Sales | PUT | `/api/sales/:id/cancel` | Cancelar (estoque + fiado) |
| Customers | GET/POST/PUT | `/api/customers` | CRUD clientes |
| Customers | POST | `/api/customers/:id/payments` | Receber fiado |
| Stock | GET/POST | `/api/stock` | Movimentações (atualiza saldo) |
| Stock | GET | `/api/stock/summary` | Resumo |
| Cash | GET/POST | `/api/cash/registers` | Abertura/fechamento |
| Cash | GET/POST | `/api/cash/movements` | Suprimento/sangria |
| Entities | * | `/api/entities/{categories,brands,suppliers,users}` | Cadastros |
| Promotions | * | `/api/promotions` | Promoções |
| Reports | GET | `/api/reports/sales` | Faturamento por período (admin/gerente) |
| Reports | GET | `/api/reports/stock-low` | Estoque baixo |
| Settings | GET/PUT | `/api/settings` | Config. empresa |

## 📝 Licença

Uso livre para fins comerciais e pessoais.
