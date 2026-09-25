import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Sale } from '../../types';

function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function VendasView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');

  useEffect(() => {
    api.sales.list().then(setSales).finally(() => setLoading(false)).catch(() => {});
  }, []);

  const cancelSale = async (id: string) => {
    const reason = prompt('Motivo do cancelamento (opcional):') || '';
    if (!confirm('Cancelar esta venda? O estoque será devolvido.')) return;
    try {
      await api.sales.cancel(id, reason);
      setSales(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelada' as const } : s));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const done = sales.filter(s => s.status === 'concluida');
  const stats = {
    count: done.length,
    revenue: done.reduce((a, s) => a + Number(s.total || 0), 0),
    cancelled: sales.filter(s => s.status === 'cancelada').length,
  };

  const payOptions = [...new Set(sales.map(s => s.paymentMethod).filter(Boolean))].sort();
  const term = q.trim().toLowerCase();
  const hasFilter = Boolean(term || statusFilter || payFilter);
  const filtered = sales.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (payFilter && s.paymentMethod !== payFilter) return false;
    if (term) {
      const items = (s.items || []).map(i => i.productName).join(' ');
      const hay = `${s.code} ${s.operator || ''} ${s.customerName || ''} ${s.customerCpf || ''} ${items} ${(s as any).items_summary || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
  const visible = hasFilter ? filtered.slice(0, 50) : filtered.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">🛒</span>
          <div>
            <p className="mov-stat-value">{stats.count}</p>
            <p className="mov-stat-label">Vendas concluídas</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">💰</span>
          <div>
            <p className="mov-stat-value">{brl(stats.revenue)}</p>
            <p className="mov-stat-label">Faturamento</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-out">❌</span>
          <div>
            <p className="mov-stat-value">{stats.cancelled}</p>
            <p className="mov-stat-label">Canceladas</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">Histórico de Vendas</h3>
          <span className="badge badge-neutral">{loading ? '…' : filtered.length}</span>
        </div>

        <div className="mov-filters">
          <input
            className="input"
            placeholder="Buscar por código, cliente, operador ou produto..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          <select className="select" value={payFilter} onChange={e => setPayFilter(e.target.value)}>
            <option value="">Todas as formas de pagamento</option>
            {payOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setQ(''); setStatusFilter(''); setPayFilter(''); }}
            >
              Limpar
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">Carregando...</p>
        ) : visible.length === 0 ? (
          <p className="text-slate-400 text-sm">
            {sales.length === 0 ? 'Nenhuma venda registrada' : 'Nenhuma venda encontrada com esses filtros'}
          </p>
        ) : (
          <div>
            {visible.map(s => {
              const itemsText = s.items && s.items.length > 0
                ? s.items.map(i => `${i.productName} x${i.quantity}`).join(', ')
                : ((s as any).items_summary || '');
              return (
                <div key={s.id} className={`mov-row${s.status === 'cancelada' ? ' is-inactive' : ''}`}>
                  <div className="min-w-0">
                    <p className="mov-row-name">
                      {s.code}
                      <span className={`badge ${s.status === 'concluida' ? 'badge-success' : 'badge-danger'} ml-1`}>
                        {s.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                      </span>
                      {s.paymentMethod === 'fiado' && <span className="badge badge-warning ml-1">Fiado</span>}
                    </p>
                    <p className="mov-row-meta">
                      {new Date(s.timestamp).toLocaleString('pt-BR')} · {s.operator}
                      {s.customerName ? ` · ${s.customerName}` : ''}
                      {itemsText ? ` · ${itemsText}` : ''}
                    </p>
                  </div>
                  <div className="prd-row-right">
                    <div className="prd-row-numbers">
                      <span className="prd-price">{brl(s.total)}</span>
                      <span className="badge badge-neutral">{s.paymentMethod}</span>
                    </div>
                    {s.status === 'concluida' && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancelSale(s.id)}>Cancelar</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
