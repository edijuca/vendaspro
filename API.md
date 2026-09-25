# API Reference — VendasPRO

REST API rodando em `http://localhost:3001` (ou porta definida via `PORT`).

**Autenticação:** Todas as rotas (exceto `/api/health` e `/api/auth/login`) exigem header `Authorization: Bearer <token>`. Token obtido via `POST /api/auth/login`, expiry de 8 horas.

**Convenção de resposta:**
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "mensagem de erro" }
```

---

## Autenticação

### POST `/api/auth/login`
Login com email + senha. Retorna JWT com 8h de validade.
```
Body: { "email": "admin@vendaspro.com", "password": "..." }
Resposta: { "success": true, "data": { "token": "...", "user": { "id", "name", "email", "role" } } }
```
Rate limit: 10 req / 15 min.

### GET `/api/auth/me`
Retorna o usuário logado (decodifica o token).
```
Resposta: { "success": true, "data": { "id", "name", "email", "role" } }
```

---

## Produtos

### GET `/api/products`
Lista produtos. Suporta busca por texto (nome, barcode, sku, code) com normalização Unicode (acentos ignorados, case-insensitive).
```
Query: ?search=Coca&includeInactive=1
Resposta: { "success": true, "data": [ { id, code, name, barcode, sku, category, brand, unit, price, costPrice, stock, minStock, iconType, ... }, ... ] }
```

### GET `/api/products/barcode/:bc`
Busca produto por código de barras/SKU/code. Primeiro tenta match exato, depois prefix.
```
Resposta: { "success": true, "data": { ... } } ou { "success": true, "data": null }
```

### GET `/api/products/:id`
Produto por ID.
```
Resposta: { "success": true, "data": { ... } } ou 404
```

### POST `/api/products`
Cria produto (admin/gerente).
```
Body: { "name": "...", "barcode": "...", "sku": "...", "categoryId": "...", "brandId": "...", "price": 5.50, "stock": 50, ... }
Schema: name obrigatório (1-100 chars), price >= 0, stock/minStock inteiros >= 0, iconType enum
Resposta: { "success": true, "data": { "id": "prd-...", "code": "PRD-000001" } }
```

### PUT `/api/products/:id`
Atualiza produto (admin/gerente).
```
Body: { "price": 6.00, "stock": 45, ... } — apenas campos informados
Resposta: { "success": true, "data": null }
```

### DELETE `/api/products/:id`
Desativa produto (soft delete, admin).
```
Resposta: { "success": true, "data": null }
```
Bloqueia DELETE direto via trigger `trg_guard_products`.

---

## Vendas

### GET `/api/sales`
Lista vendas com paginação.
```
Query: ?status=concluida&page=1&limit=50
Default: page=1, limit=50, max limit=200
Resposta: { "success": true, "data": [ { id, code, timestamp, terminal, operator, subtotal, discount, total, paymentMethod, customerName, status, items_summary, ... }, ... ] }
```

### GET `/api/sales/:id`
Venda detalhada com itens.
```
Resposta: { "success": true, "data": { id, code, ..., items: [{ id, productId, productName, quantity, unitPrice, originalPrice, discount, total }, ...] } }
```

### POST `/api/sales`
Cria venda. Transação atômica: venda + itens + estoque + movimentações + caixa.
```
Body: { "items": [{ "productId": "prd-...", "quantity": 2 }], "paymentMethod": "dinheiro"|"pix"|"cartao_credito"|"cartao_debito"|"fiado", "customerId": "...", "customerName": "...", "discount": 0 }
Header: x-terminal-id (opcional, default: PDV-01 ou TERMINAL_ID env)
```
Regra de negócio:
- Carrinho não pode ser vazio
- Pagamento é obrigatório
- Fiado exige customerId e crédito liberado
- Estoque insuficiente bloqueia (a menos que allowNegative)
- Limite de crédito: se excedido, erro
```
Resposta: { "success": true, "data": { "id": "vnd-...", "code": "VND-000001", "total": 12.50 } }
```

### PUT `/api/sales/:id/cancel`
Cancela venda concluída (reverte estoque + caixa + crédito).
```
Body: { "reason": "..." }
Resposta: { "success": true, "data": null }
```

---

## Estoque

### GET `/api/stock`
Movimentações com filtros.
```
Query: ?productId=&type=&operation=&startDate=&endDate=&page=1&limit=100
Default: limit=500, recent first
```

### GET `/api/stock/summary`
Resumo: total saidas, entradas, produtos movimentados.

### POST `/api/stock`
Movimentação manual de estoque (admin/gerente/caixa).
```
Body: { "productId": "...", "quantity": 10, "operation": "entrada"|"saida", "unitCost": 0, "reason": "...", "type": "ENTRADA_MANUAL" }
Resposta: { "success": true, "data": { "id": "mov-..." } }
```

---

## Clientes

### GET `/api/customers`
Lista clientes.
```
Query: ?includeInactive=1
```

### GET `/api/customers/:id`
Cliente por ID.

### POST `/api/customers`
Cria cliente.
```
Body: { "name": "...", "cpf": "...", "email": "...", "creditLimit": 100, "creditStatus": "liberado", "dueDays": 30 }
Validação: name obrigatório (1-100), email formato válido, creditLimit >= 0
Resposta: { "success": true, "data": { "id": "cli-..." } }
```

### PUT `/api/customers/:id`
Atualiza cliente.
```
Body: { "name": "...", "active": 0|1, ... }
```

### POST `/api/customers/:id/payments`
Recebimento de fiado.
```
Body: { "amount": 50.00, "description": "..." }
Resposta: { "success": true, "data": { "currentDebt": 50.00 } }
```

---

## Caixa

### GET `/api/cash/registers`
Todos os registros de caixa.

### GET `/api/cash/registers/current`
Caixa aberto atual.

### GET `/api/cash/registers/:id`
Registro com resumo (entradas, saidas, byPayment, movements).

### GET `/api/cash/registers/:id/summary`
Resumo do fechamento.

### GET `/api/cash/registers/:id/report`
Relatório de fechamento: expected vs counted, verdict (ok/quebra/sobra).

### POST `/api/cash/registers/open`
Abre caixa (admin/gerente/caixa).
```
Body: { "openingBalance": 100.00 }
Resposta: { "success": true, "data": { "id": "reg-...", "code": "REG-000001" } }
Só um caixa aberto por vez.
```

### POST `/api/cash/registers/:id/close`
Fecha caixa.
```
Body: { "countedBalance": 150.00, "closedBy": "..." }
Resposta: { "success": true, "data": { "expected": 150.00, "counted": 150.00, "difference": 0 } }
```

### POST `/api/cash/registers/:id/reopen`
Reabre caixa fechado (admin apenas).

### GET `/api/cash/movements`
Movimentações de caixa.
```
Query: ?cashRegisterId=
```

### POST `/api/cash/movements`
Movimentação manual (suprimento, sangria, entrada, saida, recebimento, ajuste).
```
Body: { "type": "suprimento"|"sangria"|"entrada"|"saida"|"recebimento"|"sale"|"cancel"|"ajuste", "amount": 100, "description": "...", "cashRegisterId": "...", "referenceId": "..." }
Regra: sangria acima do withdrawalLimit exige admin; ajuste só admin
```

---

## Cadastros (admin/gerente)

### Categories

**GET** `/api/entities/categories` — lista ativos  
**POST** `/api/entities/categories` — cria `{ name, description?, marginPercent? }`  
**PUT** `/api/entities/categories/:id` — atualiza  
**DELETE** `/api/entities/categories/:id` — desativa (soft delete)

### Brands

**GET** `/api/entities/brands`  
**POST** `/api/entities/brands` — `{ name }`  
**PUT** `/api/entities/brands/:id` — `{ name }`  
**DELETE** `/api/entities/brands/:id` — desativa

### Suppliers

**GET** `/api/entities/suppliers`  
**POST** `/api/entities/suppliers` — `{ name, cnpjCpf, phone, email }`  
**PUT** `/api/entities/suppliers/:id`  
**DELETE** `/api/entities/suppliers/:id`

### Users

**GET** `/api/entities/users` (admin/gerente)  
**POST** `/api/entities/users` (admin) — `{ name, email, password, role: "admin"|"gerente"|"caixa" }`  
**PUT** `/api/entities/users/:id` (admin) — `{ name?, email?, password?, role?, active? }`  
**DELETE** `/api/entities/users/:id` (admin) — desativa (não permite desativar a si mesmo)

---

## Promoções

### GET `/api/promotions`
Lista promoções ativas. `?includeInactive=1` para ver todas.

### GET `/api/promotions/active`
Promoções ativas hoje (startDate <= hoje <= endDate).

### POST `/api/promotions`
Cria promoção (admin/gerente).
```
Body: { "name": "...", "productId": "...", "discountType": "percent"|"fixed", "discountValue": 10, "minQuantity": 1, "startDate": "2026-01-01", "endDate": "2026-12-31" }
Regras: percent <= 100, value > 0
```

### PUT `/api/promotions/:id`  
Atualiza (admin/gerente).

### DELETE `/api/promotions/:id`  
Desativa (soft delete, admin/gerente).

---

## Relatórios (admin/gerente)

### GET `/api/reports/sales`
Relatório de vendas por período.
```
Query: ?from=2026-01-01&to=2026-12-31
Resposta: { count, revenue, cancelled, cancelledCount, discounts, avgTicket, byPayment: [{ method, count, total }], byDay: [{ day, count, total }], topProducts: [{ productName, quantity, total }] }
```

### GET `/api/reports/stock-low`
Produtos com estoque <= minStock (até 200).

---

## Configurações

### GET `/api/settings`
Retorna `company_settings` (nome, tradeName, CNPJ, PIX keys, margens, etc).

### PUT `/api/settings`
Atualiza configurações (admin/gerente).
```
Body: { "tradeName": "...", "cnpj": "...", "pixKey": "...", "defaultMarginPercent": 40, "cardFeePercent": 3, ... }
```

---

## Health

### GET `/api/health`
Sem autenticação. Verifica se DB tá acessível.
```
Resposta: { "success": true, "data": { "status": "ok", "timestamp": "..." } }
```

---

## Erros

Erros genéricos (500) retornam mensagem genérica ao cliente, com log detalhado no servidor:

| Status | Causa |
|--------|-------|
| 400 | Dados inválidos, carrinho vazio, estoque insuficiente, limite excedido, não há caixa aberto |
| 401 | Não autenticado / token inválido |
| 403 | Sem permissão de role |
| 404 | Recurso não encontrado |
| 429 | Rate limit excedido (login: 10/15min; global: 200/15min) |
| 500 | Erro interno (mensagem genérica ao cliente) |
