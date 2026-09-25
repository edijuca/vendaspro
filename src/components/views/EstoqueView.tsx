import { useEffect, useState } from 'react';
import { api } from '../../api';
import { StockMovement, Product } from '../../types';

const TYPE_LABELS: Record<string, string> = {
  SAIDA_VENDA: 'Venda',
  CANCELAMENTO_VENDA: 'Cancelamento de venda',
  ENTRADA_MANUAL: 'Entrada manual',
  SAIDA_MANUAL: 'Saída manual',
};
const typeLabel = (t: string) => TYPE_LABELS[t] || t.replace(/_/g, ' ').toLowerCase();

export default function EstoqueView() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [opFilter, setOpFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({
    productId: '',
    operation: 'entrada' as 'entrada' | 'saida',
    quantity: 1,
    unitCost: 0,
    reason: '',
  });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.stock.list(), api.stock.summary()])
      .then(([m, s]) => { setMovements(m); setSummary(s); })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const typeOptions = [...new Set(movements.map(m => m.type))].sort();
  const term = q.trim().toLowerCase();
  const hasFilter = Boolean(term || opFilter || typeFilter);
  const filtered = movements.filter(m => {
    if (opFilter && m.operation !== opFilter) return false;
    if (typeFilter && m.type !== typeFilter) return false;
    if (term) {
      const hay = `${m.productName} ${m.code} ${m.reason || ''} ${m.referenceDocument || ''} ${m.operator || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
  const visible = hasFilter ? filtered.slice(0, 50) : filtered.slice(0, 5);

  const openForm = async () => {
    setError('');
    setForm({ productId: '', operation: 'entrada', quantity: 1, unitCost: 0, reason: '' });
    try {
      setProducts(await api.products.list());
    } catch {
      setProducts([]);
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.productId || form.quantity <= 0) {
      setError('Selecione o produto e informe a quantidade.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.stock.create(form);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-out">📤</span>
          <div>
            <p className="mov-stat-value">{summary?.saidas || 0}</p>
            <p className="mov-stat-label">Saídas totais</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">📥</span>
          <div>
            <p className="mov-stat-value">{summary?.entradas || 0}</p>
            <p className="mov-stat-label">Entradas totais</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">🏷️</span>
          <div>
            <p className="mov-stat-value">{summary?.produtos || 0}</p>
            <p className="mov-stat-label">Produtos afetados</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">Pesquisar movimentações</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral">{filtered.length}</span>
            <button className="btn btn-primary btn-sm" onClick={openForm}>+ Nova Movimentação</button>
          </div>
        </div>

        <div className="mov-filters">
          <input
            className="input"
            placeholder="Buscar por produto, código, motivo ou operador..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select className="select" value={opFilter} onChange={e => setOpFilter(e.target.value)}>
            <option value="">Todas as operações</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
          <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Todas as formas</option>
            {typeOptions.map(t => (
              <option key={t} value={t}>{typeLabel(t)}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setQ(''); setOpFilter(''); setTypeFilter(''); }}
            >
              Limpar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm">
            {movements.length === 0
              ? 'Sem movimentações registradas'
              : 'Nenhuma movimentação encontrada com esses filtros'}
          </p>
        ) : (
          <div>
            {visible.map(m => (
              <div key={m.id} className="mov-row">
                <div className="min-w-0">
                  <p className="mov-row-name">{m.productName}</p>
                  <p className="mov-row-meta">
                    {m.code} · {new Date(m.timestamp).toLocaleString('pt-BR')} · {typeLabel(m.type)}
                  </p>
                </div>
                <div className="mov-row-right">
                  <span className={`badge ${m.operation === 'saida' ? 'badge-danger' : 'badge-success'} text-xs`}>
                    {m.operation === 'saida' ? '-' : '+'}{m.quantity}
                  </span>
                  <span className="mov-row-reason">{m.reason || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-700 mb-3">Nova Movimentação de Estoque</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Produto</label>
                <select
                  className="select"
                  value={form.productId}
                  onChange={e => setForm({ ...form, productId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Operação</label>
                <select
                  className="select"
                  value={form.operation}
                  onChange={e => setForm({ ...form, operation: e.target.value as any })}
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantidade</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Custo unit. (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={form.unitCost}
                    onChange={e => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Motivo</label>
                <input
                  className="input"
                  placeholder="Compra, perda, ajuste..."
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary flex-1" onClick={save} disabled={busy}>
                {busy ? 'Salvando...' : 'Registrar'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
