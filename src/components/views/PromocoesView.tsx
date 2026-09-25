import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Promotion, Product } from '../../types';

function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const emptyForm = {
  name: '',
  productId: '',
  discountType: 'percent' as 'percent' | 'fixed',
  discountValue: 10,
  minQuantity: 1,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
};

export default function PromocoesView() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0 });

  const loadStats = () => {
    api.promotions.list({ includeInactive: true })
      .then(list => {
        const t = new Date().toISOString().slice(0, 10);
        const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const on = (p: Promotion) => !(p.active === 0 || p.active === false);
        setStats({
          total: list.length,
          active: list.filter(p => on(p) && p.startDate <= t && p.endDate >= t).length,
          expiring: list.filter(p => on(p) && p.endDate >= t && p.endDate <= in7).length,
        });
      })
      .catch(() => {});
  };

  const load = async (incl?: boolean) => {
    try {
      setPromos(await api.promotions.list({ includeInactive: incl ?? showInactive }));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load(showInactive);
    api.products.list().then(setProducts).catch(() => {});
    loadStats();
  }, [showInactive]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      productId: p.productId,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minQuantity: p.minQuantity,
      startDate: p.startDate,
      endDate: p.endDate,
    });
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.productId) {
      setError('Nome e produto são obrigatórios');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editingId) await api.promotions.update(editingId, form);
      else await api.promotions.create(form);
      setShowForm(false);
      await load();
      loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Desativar esta promoção? Ela deixará de ser aplicada no PDV, mas poderá ser reativada depois.')) return;
    try {
      await api.promotions.delete(id);
      await load();
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const reactivate = async (id: string) => {
    try {
      await api.promotions.update(id, { active: 1 });
      await load();
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const term = search.trim().toLowerCase();
  const hasFilter = Boolean(term || statusFilter || showInactive);
  const filtered = promos.filter(p => {
    const deactivated = p.active === 0 || p.active === false;
    const vigente = p.startDate <= today && p.endDate >= today;
    const st = deactivated ? 'desativada' : vigente ? 'ativa' : 'inativa';
    if (statusFilter && statusFilter !== st) return false;
    if (term && !`${p.name} ${p.productName || p.productId}`.toLowerCase().includes(term)) return false;
    return true;
  });
  const visible = hasFilter ? filtered.slice(0, 50) : filtered.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">🏷️</span>
          <div>
            <p className="mov-stat-value">{stats.total}</p>
            <p className="mov-stat-label">Total de promoções</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">✅</span>
          <div>
            <p className="mov-stat-value">{stats.active}</p>
            <p className="mov-stat-label">Ativas agora</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-out">⏳</span>
          <div>
            <p className="mov-stat-value">{stats.expiring}</p>
            <p className="mov-stat-label">Vencem em 7 dias</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">Promoções</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral">{filtered.length}</span>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nova Promoção</button>
          </div>
        </div>

        <div className="mov-filters">
          <input
            className="input"
            placeholder="Buscar por promoção ou produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todas</option>
            <option value="ativa">Ativas</option>
            <option value="inativa">Fora de vigência</option>
            <option value="desativada">Desativadas</option>
          </select>
          <label className="mov-filter-check">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            Mostrar inativas
          </label>
          {hasFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setStatusFilter(''); setShowInactive(false); }}
            >
              Limpar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm">
            {promos.length === 0 ? 'Nenhuma promoção cadastrada' : 'Nenhuma promoção encontrada com esses filtros'}
          </p>
        ) : (
          <div>
            {visible.map(p => {
              const deactivated = p.active === 0 || p.active === false;
              const vigente = p.startDate <= today && p.endDate >= today;
              return (
                <div key={p.id} className={`mov-row${deactivated ? ' is-inactive' : ''}`}>
                  <div className="min-w-0">
                    <p className="mov-row-name">
                      {p.name}
                      <span className={`badge ${deactivated ? 'badge-neutral' : vigente ? 'badge-success' : 'badge-warning'} ml-1`}>
                        {deactivated ? 'desativada' : vigente ? 'ativa' : 'inativa'}
                      </span>
                    </p>
                    <p className="mov-row-meta">
                      {p.productName || p.productId} · mín. {p.minQuantity} un. · {p.startDate} a {p.endDate}
                    </p>
                  </div>
                  <div className="prd-row-right">
                    <div className="prd-row-numbers">
                      <span className="prd-price is-discount">
                        {p.discountType === 'percent' ? `${p.discountValue}%` : brl(p.discountValue)}
                      </span>
                    </div>
                    <div className="prd-actions">
                      {!deactivated && (
                        <button title="Editar" onClick={() => openEdit(p)}>✏️</button>
                      )}
                      {!deactivated && (
                        <button title="Desativar" onClick={() => remove(p.id)}>🗑️</button>
                      )}
                      {deactivated && (
                        <button title="Reativar" onClick={() => reactivate(p.id)}>↩️</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-700 mb-3">{editingId ? 'Editar' : 'Nova'} Promoção</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Produto *</label>
                <select
                  className="select"
                  value={form.productId}
                  onChange={e => setForm({ ...form, productId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select
                    className="select"
                    value={form.discountType}
                    onChange={e => setForm({ ...form, discountType: e.target.value as any })}
                  >
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Desconto *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={form.discountValue}
                    onChange={e => setForm({ ...form, discountValue: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Quantidade mínima</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={form.minQuantity}
                  onChange={e => setForm({ ...form, minQuantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Início</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Fim</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary flex-1" onClick={save} disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
