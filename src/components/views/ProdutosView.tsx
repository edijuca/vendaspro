import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Product, Category, Brand, Supplier } from '../../types';
import { useAuth } from '../../AuthContext';

function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const isActive = (p: Product) => !(p.active === 0 || p.active === false);

export default function ProdutosView() {
  const { isAdmin, user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'gerente';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, low: 0, value: 0 });

  const loadStats = () => {
    api.products.list(undefined, undefined, { includeInactive: true })
      .then(list => {
        const actives = list.filter(isActive);
        setStats({
          total: list.length,
          low: actives.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 0)).length,
          value: actives.reduce((a, p) => a + (Number(p.price) || 0) * (Number(p.stock) || 0), 0),
        });
      })
      .catch(() => {});
  };

  const load = async (signal?: AbortSignal, term?: string, incl?: boolean) => {
    try {
      const list = await api.products.list(term ?? search ?? undefined, signal, { includeInactive: incl ?? showInactive });
      if (!signal?.aborted) setProducts(list);
    } catch (err: any) {
      if (!signal?.aborted && err?.name !== 'AbortError') {
        console.error('Erro ao buscar produtos:', err);
      }
    }
  };
  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal, search || undefined, showInactive);
    return () => ac.abort();
  }, [search, showInactive]);

  useEffect(() => {
    api.entities.categories().then(setCategories).catch(() => {});
    api.entities.brands().then(setBrands).catch(() => {});
    api.entities.suppliers().then(setSuppliers).catch(() => {});
    loadStats();
  }, []);

  const catOptions = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
  const brandOptions = [...new Set(products.map(p => p.brand).filter(Boolean))] as string[];
  const hasFilter = Boolean(search || catFilter || brandFilter || showInactive);
  const filtered = products.filter(p => {
    if (catFilter && (p.category || '') !== catFilter) return false;
    if (brandFilter && (p.brand || '') !== brandFilter) return false;
    return true;
  });
  const newest = [...filtered].sort((a, b) => (b.code || '').localeCompare(a.code || ''));
  const visible = hasFilter ? newest.slice(0, 50) : newest.slice(0, 5);

  const openCreate = () => {
    setEditing(null);
    setError('');
    setForm({
      name: '', barcode: '', sku: '', categoryId: '', category: '', brandId: '', brand: '',
      supplierId: '', unit: 'UN', price: 0, costPrice: 0, stock: 0, minStock: 0, iconType: 'general',
    });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setError('');
    setForm({ ...p });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        supplierId: form.supplierId || null,
      };
      if (editing) await api.products.update(editing.id, payload);
      else await api.products.create(payload);
      setShowForm(false);
      load();
      loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Desativar este produto? Ele deixará de aparecer nas buscas, mas o histórico de vendas será mantido.')) return;
    try {
      await api.products.delete(id);
      load(undefined, search || undefined, showInactive);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const reactivate = async (id: string) => {
    try {
      await api.products.update(id, { active: 1 });
      load(undefined, search || undefined, showInactive);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">📦</span>
          <div>
            <p className="mov-stat-value">{stats.total}</p>
            <p className="mov-stat-label">Total de produtos</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-out">⚠️</span>
          <div>
            <p className="mov-stat-value">{stats.low}</p>
            <p className="mov-stat-label">Com estoque baixo</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">💰</span>
          <div>
            <p className="mov-stat-value">{brl(stats.value)}</p>
            <p className="mov-stat-label">Valor em estoque</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">Produtos</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral">{filtered.length}</span>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                + Novo Produto
              </button>
            )}
          </div>
        </div>

        <div className="mov-filters">
          <input
            className="input"
            placeholder="Buscar por nome, código ou código de barras..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas as categorias</option>
            {catOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="select" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
            <option value="">Todas as marcas</option>
            {brandOptions.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <label className="mov-filter-check">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            Mostrar inativos
          </label>
          {hasFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setCatFilter(''); setBrandFilter(''); setShowInactive(false); }}
            >
              Limpar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm">
            {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado com esses filtros'}
          </p>
        ) : (
          <div>
            {visible.map(p => {
              const inactive = !isActive(p);
              return (
                <div key={p.id} className={`mov-row${inactive ? ' is-inactive' : ''}`}>
                  <div className="min-w-0">
                    <p className="mov-row-name">
                      {inactive && <span className="badge badge-neutral mr-1">Inativo</span>}
                      {p.name}
                    </p>
                    <p className="mov-row-meta">
                      {p.code} · {p.category || '—'} · {p.brand || '—'}{p.barcode ? ` · ${p.barcode}` : ''}
                    </p>
                  </div>
                  <div className="prd-row-right">
                    <div className="prd-row-numbers">
                      <span className="prd-price">{brl(Number(p.price) || 0)}</span>
                      <span className={`badge ${p.stock === 0 ? 'badge-danger' : p.stock <= p.minStock ? 'badge-warning' : 'badge-success'}`}>
                        {p.stock}
                      </span>
                    </div>
                    {canManage && (
                      <div className="prd-actions">
                        {!inactive && (
                          <button title="Editar" onClick={() => openEdit(p)}>✏️</button>
                        )}
                        {inactive && (
                          <button title="Reativar" onClick={() => reactivate(p.id)}>↩️</button>
                        )}
                        {isAdmin && !inactive && (
                          <button title="Desativar" onClick={() => remove(p.id)}>🗑️</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-700 mb-3">{editing ? 'Editar Produto' : 'Novo Produto'}</h3>
            <div className="space-y-3">
              <div><label className="label">Nome *</label>
                <input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Código de Barras</label>
                  <input className="input" value={form.barcode || ''} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                </div>
                <div><label className="label">SKU</label>
                  <input className="input" value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Categoria</label>
                  <select
                    className="select"
                    value={form.categoryId || ''}
                    onChange={e => setForm({ ...form, categoryId: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Marca</label>
                  <select
                    className="select"
                    value={form.brandId || ''}
                    onChange={e => setForm({ ...form, brandId: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Fornecedor</label>
                <select
                  className="select"
                  value={form.supplierId || ''}
                  onChange={e => setForm({ ...form, supplierId: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Preço (R$)</label>
                  <input type="number" step="0.01" className="input" value={form.price || 0} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div><label className="label">Custo (R$)</label>
                  <input type="number" step="0.01" className="input" value={form.costPrice || 0} onChange={e => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div><label className="label">Estoque</label>
                  <input type="number" className="input" value={form.stock || 0} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div><label className="label">Estoque Mínimo</label>
                <input type="number" className="input" value={form.minStock || 0} onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="select" value={form.iconType || 'general'} onChange={e => setForm({ ...form, iconType: e.target.value as any })}>
                  <option value="general">Geral</option>
                  <option value="drink">Bebida</option>
                  <option value="snack">Snack</option>
                  <option value="candy">Doce</option>
                  <option value="coffee">Café</option>
                  <option value="dairy">Laticínio</option>
                  <option value="bakery">Padaria</option>
                </select>
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
