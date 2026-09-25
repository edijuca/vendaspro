# VendasPRO — Plano de Trabalho

**Objetivo:** Sistema de gestão de vendas e estoque (PDV), construído do zero, inspirado no Gestão Mais Simples.

**Stack:** React 19 + Vite 6 + CSS próprio (frontend) | Express + better-sqlite3 + bcryptjs + jsonwebtoken (backend) | SQLite (banco)

**Regras:** Código 100% novo. Nada copiado do ConveniencePDV.

---

## Status — PROJETO COMPLETO (Fases A+B+C+D+E) ✅

### Fase 1 — Fundação (API + Banco) ✅

| Tarefa | Arquivo | Status |
|---|---|---|
| 1.1–1.5 | Configs + shell | ✅ |
| 1.6 | `server/index.ts` (bootstrap + static) | ✅ |
| 1.7 | `server/db.ts` (schema, seed, migrações, nextCode) | ✅ |
| 1.8 | `server/middleware.ts` (authMid, requireRole) | ✅ |
| 1.9 | `server/routes/*` (auth, products, sales, stock, customers, cash, entities, promotions, reports, settings) | ✅ |
| 1.16 | `src/api.ts` (Authorization Bearer) | ✅ |
| 1.17 | `src/types.ts` | ✅ |

### Fase 2 — PDV ✅

| Tarefa | Arquivo | Status |
|---|---|---|
| 2.1–2.4 | PDV + carrinho + pagamento (inclui **fiado**) | ✅ |
| 2.5 | Scanner câmera + input código de barras | ✅ |
| 2.6 | Seleção de cliente + desconto + promoções | ✅ |

### Fase 3 — Gestão ✅

| Tarefa | Arquivo | Status |
|---|---|---|
| 3.1 | `views/DashboardPage.tsx` | ✅ |
| 3.2 | `views/ProdutosView.tsx` (selects de entidades) | ✅ |
| 3.3 | `views/ClientesView.tsx` (form completo + receber fiado) | ✅ |
| 3.4 | `views/EstoqueView.tsx` (movimentação manual) | ✅ |
| 3.5 | `views/VendasView.tsx` | ✅ |
| 3.6 | `views/CaixaView.tsx` (suprimento/sangria) | ✅ |
| 3.7 | `views/ConfiguracoesView.tsx` | ✅ |
| 3.8 | `views/CadastrosView.tsx` (categorias/marcas/fornecedores/usuários) | ✅ |
| 3.9 | `views/PromocoesView.tsx` | ✅ |
| 3.10 | `views/RelatoriosView.tsx` | ✅ |

### Fase 4 — Extras ✅

| Tarefa | Arquivo | Status |
|---|---|---|
| 4.1–4.6 | Header, Sidebar, Login, CSS, iniciar.bat, README | ✅ |

### Fase A — Correções de integração (B0–B8) ✅

| Bug | Problema | Correção |
|---|---|---|
| B0 | `api.ts` não enviava `Authorization` | Header `Bearer` automático |
| B1 | Fechar caixa: colunas inexistentes | `ALTER TABLE` + backup `.bak` |
| B2 | `POST /stock` não alterava produto | Transação com UPDATE |
| B3 | Dashboard lia campo inexistente | `produtos_movimentados` na API |
| B4 | `nextCode` 2× no produto | Código único |
| B5 | Cancelamento gravava estoque errado | Lê antes do UPDATE |
| B6 | Produção não funcionava | `tsx` + `express.static(dist)` |
| B7 | SQL `"aberto"` quebrava SQLite | Aspas simples |
| B8 | `PUT /settings` bind extra | `WHERE id = ?` |

### Fase B — Integração de módulos ✅

- CRUD categorias/marcas/fornecedores (soft-delete)
- CRUD usuários (admin) com bcrypt e perfis
- Movimentação manual de estoque com saldo real
- Suprimento/sangria de caixa
- Form completo de clientes + recebimento de fiado
- Scanner conectado ao PDV
- Selects de categoria/marca/fornecedor no produto

### Fase C — Novas funcionalidades ✅

- **Promoções:** CRUD + aplicação no total da venda (percentual/fixo)
- **Fiado:** valida limite/status, debita dívida, recebimento, estorno no cancel; fora do saldo de caixa
- **Roles:** `requireRole` nas rotas sensíveis; abas admin/gerente ocultas para caixa
- **Relatórios:** faturamento, ticket médio, por pagamento, top produtos, estoque baixo

### Fase D — Porte das funcionalidades do PDV (ConvenienciaPDV) ✅

| Item | Arquivo | Status |
|---|---|---|
| Sons de feedback (scanner, venda, erro) | `src/utils/audio.ts` | ✅ |
| Payload PIX EMVCo (TLV + CRC16) + QR Code | `src/utils/pixPayload.ts` | ✅ |
| Scanner redesenhado (lanterna, modo contínuo, seleção de câmera, entrada manual) | `CameraBarcodeScannerModal.tsx` | ✅ |
| Consulta de preço (busca + câmera + "+ Vender") | `PriceConsultModal.tsx` | ✅ |
| Cadastro rápido de cliente no PDV/checkout | `QuickCustomerModal.tsx` | ✅ |
| Cupom pós-venda 80/58mm com impressão + QR PIX | `ReceiptModal.tsx` | ✅ |
| Validação de estoque, parcelas 1x–12x, painel QR PIX copiável | `views/PDVPage.tsx` | ✅ |

### Fase E — UX do PDV + Dashboard completo ✅

| Item | Detalhe | Status |
|---|---|---|
| Dropdown de busca navegável | ↑↓ seleciona, Enter adiciona, auto-scroll | ✅ |
| Atalhos de cliente | F7 cadastro rápido, F9 focar cliente, F2 trocar cliente no checkout | ✅ |
| Ctrl+Enter | Confirma a venda (inclusive com "valor recebido" focado) | ✅ |
| Dashboard redesenhado | Período Hoje/7/30 dias, KPIs vs período anterior, gráfico por dia, formas de pagamento com %, top produtos, últimas vendas, status do caixa, alertas (estoque baixo, fiados, promoções vencendo), auto-refresh 60s, fallback "Resumo local" p/ perfil caixa | ✅ |
| Backend `reports.ts` | `cancelledCount` (contagem de canceladas) | ✅ |

### Fase F — Integridade de dados ✅

| Item | Detalhe | Status |
|---|---|---|
| Triggers anti-DELETE | `trg_guard_*` bloqueiam exclusão direta em `sales`, `sale_items`, `products`, `customers`, `stock_movements`, `cash_registers`, `cash_movements` (soft-delete/cancelamento são os únicos caminhos) | ✅ |
| Backup rotativo | `vendaspro-<timestamp>.db.bak` (últimas 5 gerações) a cada inicialização, antes das migrações | ✅ |
| Rótulos de exclusão | Botões/confirm falam "Desativar/Arquivar" (não "Excluir") | ✅ |
| Reativar produtos | `GET /products?includeInactive=1`, `PUT active`, checkbox "Mostrar inativos" + ↩️ | ✅ |
| Reativar promoções | `GET /promotions?includeInactive=1`, checkbox "Mostrar inativas" + ↩️ | ✅ |
| Arquivar clientes | Coluna `customers.active` (migração), `?includeInactive=1`, checkbox "Mostrar arquivados"; Dashboard "Fiados em aberto" inclui arquivados com dívida | ✅ |

---

## ✅ Testes Validados

- `npm test` (vitest + supertest, `server/tests/api.test.ts`): **31/31 passed**
- `npm run lint` (`tsc --noEmit`): limpo
- `npm run build` (Vite): build sem avisos
- Frontend 5173 + proxy `/api` → 3001
- Banco limpo após testes (10 produtos, 2 usuários)

---

## 📋 Próximos Passos (Extensões Futuras)

- [ ] NF-e
- [x] Impressão de cupom — cupom 80/58mm via janela de impressão (`ReceiptModal`)
- [ ] Portal do cliente (saldo de fiado)
- [ ] Multi-tenant

---

## Arquivos (estrutura modular)

```
vendaspro/
├── package.json, vite.config.ts, tsconfig.json, iniciar.bat, PLAN.md, README.md
├── server/
│   ├── index.ts
│   ├── db.ts
│   ├── middleware.ts
│   ├── routes/
│   │   ├── auth.ts, products.ts, sales.ts, stock.ts, customers.ts
│   │   ├── cash.ts, entities.ts, promotions.ts, reports.ts, settings.ts
│   └── tests/api.test.ts
└── src/
    ├── main.tsx, App.tsx, api.ts, types.ts, AuthContext.tsx, global.css
    ├── utils/audio.ts, pixPayload.ts
    └── components/
        ├── LoginScreen.tsx, Sidebar.tsx, CameraBarcodeScannerModal.tsx
        ├── PriceConsultModal.tsx, QuickCustomerModal.tsx, ReceiptModal.tsx
        └── views/
            ├── PDVPage.tsx, DashboardPage.tsx, ProdutosView.tsx
            ├── EstoqueView.tsx, VendasView.tsx, ClientesView.tsx
            ├── CaixaView.tsx, CadastrosView.tsx, PromocoesView.tsx
            ├── RelatoriosView.tsx, ConfiguracoesView.tsx
```

---

## Decisões Tomadas

- **Backend modular** em `server/routes/*`; **frontend** em `src/components/views/*`
- **Auth JWT** 8h no localStorage; `api.ts` injeta Bearer
- **Roles:** admin (tudo), gerente (cadastros/promoções/relatórios/produtos), caixa (operacional)
- **Soft delete** com `active=0` (produtos, promoções, clientes, categorias/marcas/fornecedores/usuários) + UI "mostrar inativos" e reativar
- **Triggers anti-DELETE** nas tabelas de histórico (bloqueiam até SQL manual; `RAISE(ABORT)`)
- **Promoção recalculada no servidor** no `POST /sales`
- **Fiado não entra no saldo do caixa** aberto
- **Backup rotativo** `vendaspro-<timestamp>.db.bak` (últimas 5 gerações) a cada inicialização + `vendaspro.db.bak` antes de migração de schema
