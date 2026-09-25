import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Category, Brand, Supplier } from '../../types';
import { useAuth } from '../../AuthContext';

type Tab = 'categorias' | 'marcas' | 'fornecedores' | 'usuarios';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: number;
}

function metaOf(t: Tab, r: any): string {
  if (t === 'categorias') {
    return `${r.code} · ${r.description || 'Sem descrição'}${r.marginPercent ? ` · margem ${r.marginPercent}%` : ''}`;
  }
  if (t === 'marcas') return r.code;
  if (t === 'fornecedores') {
    return `${r.code} · ${r.cnpjCpf || '—'} · ${r.phone || '—'}${r.email ? ` · ${r.email}` : ''}`;
  }
  return `${r.email} · ${r.role}`;
}

export default function CadastrosView() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('categorias');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState('');
  const [userStatus, setUserStatus] = useState('');

  const load = async () => {
    try {
      const [c, b, s] = await Promise.all([
        api.entities.categories(),
        api.entities.brands(),
        api.entities.suppliers(),
      ]);
      setCategories(c);
      setBrands(b);
      setSuppliers(s);
      if (isAdmin) {
        try { setUsers(await api.entities.users()); } catch { setUsers([]); }
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [isAdmin]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'categorias', label: 'Categorias' },
    { id: 'marcas', label: 'Marcas' },
    { id: 'fornecedores', label: 'Fornecedores' },
    ...(isAdmin ? [{ id: 'usuarios' as Tab, label: 'Usuários' }] : []),
  ];

  const openCreate = () => {
    setEditingId(null);
    setError('');
    if (tab === 'categorias') setForm({ name: '', description: '', marginPercent: 0 });
    else if (tab === 'marcas') setForm({ name: '' });
    else if (tab === 'fornecedores') setForm({ name: '', cnpjCpf: '', phone: '', email: '' });
    else setForm({ name: '', email: '', password: '', role: 'caixa' });
    setShowForm(true);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setError('');
    if (tab === 'categorias') setForm({ name: row.name, description: row.description || '', marginPercent: row.marginPercent || 0 });
    else if (tab === 'marcas') setForm({ name: row.name });
    else if (tab === 'fornecedores') setForm({ name: row.name, cnpjCpf: row.cnpjCpf || '', phone: row.phone || '', email: row.email || '' });
    else setForm({ name: row.name, email: row.email, password: '', role: row.role, active: row.active });
    setShowForm(true);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (tab === 'categorias') {
        if (editingId) await api.entities.updateCategory(editingId, form);
        else await api.entities.createCategory(form);
      } else if (tab === 'marcas') {
        if (editingId) await api.entities.updateBrand(editingId, form);
        else await api.entities.createBrand(form);
      } else if (tab === 'fornecedores') {
        if (editingId) await api.entities.updateSupplier(editingId, form);
        else await api.entities.createSupplier(form);
      } else {
        const payload: any = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        if (editingId) {
          payload.active = form.active !== undefined ? form.active : 1;
          await api.entities.updateUser(editingId, payload);
        } else {
          if (!form.password) throw new Error('Senha é obrigatória');
          await api.entities.createUser({ ...payload, password: form.password });
        }
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Desativar este registro?')) return;
    try {
      if (tab === 'categorias') await api.entities.deleteCategory(id);
      else if (tab === 'marcas') await api.entities.deleteBrand(id);
      else if (tab === 'fornecedores') await api.entities.deleteSupplier(id);
      else await api.entities.deleteUser(id);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const nameLabel =
    tab === 'categorias' ? 'categoria' :
    tab === 'marcas' ? 'marca' :
    tab === 'fornecedores' ? 'fornecedor' : 'usuário';

  const activeList: any[] =
    tab === 'categorias' ? (categories as any[]) :
    tab === 'marcas' ? (brands as any[]) :
    tab === 'fornecedores' ? (suppliers as any[]) : users;

  const term = search.trim().toLowerCase();
  const hasFilter = Boolean(term || userStatus);
  const filtered = activeList.filter((r: any) => {
    if (tab === 'usuarios' && userStatus && String(r.active ? 1 : 0) !== userStatus) return false;
    if (!term) return true;
    const hay = `${r.name} ${r.code || ''} ${r.description || ''} ${r.email || ''} ${r.cnpjCpf || ''} ${r.phone || ''}`.toLowerCase();
    return hay.includes(term);
  });
  const newest = [...filtered].sort((a: any, b: any) => (b.code || '').localeCompare(a.code || ''));
  const visible = hasFilter ? newest.slice(0, 50) : newest.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">📂</span>
          <div>
            <p className="mov-stat-value">{categories.length}</p>
            <p className="mov-stat-label">Categorias</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">🏷️</span>
          <div>
            <p className="mov-stat-value">{brands.length}</p>
            <p className="mov-stat-label">Marcas</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico">🚚</span>
          <div>
            <p className="mov-stat-value">{suppliers.length}</p>
            <p className="mov-stat-label">Fornecedores</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setTab(t.id); setSearch(''); setUserStatus(''); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">{tabs.find(t => t.id === tab)?.label}</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral">{filtered.length}</span>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Novo {nameLabel}</button>
          </div>
        </div>

        <div className="mov-filters">
          <input
            className="input"
            placeholder={
              tab === 'fornecedores' ? 'Buscar por nome, CNPJ/CPF ou telefone...' :
              tab === 'usuarios' ? 'Buscar por nome ou e-mail...' :
              'Buscar por nome ou código...'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {tab === 'usuarios' && (
            <select className="select" value={userStatus} onChange={e => setUserStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="1">Ativos</option>
              <option value="0">Inativos</option>
            </select>
          )}
          {hasFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setUserStatus(''); }}
            >
              Limpar
            </button>
          )}
        </div>

        {activeList.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum registro</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum registro encontrado com esses filtros</p>
        ) : (
          <div>
            {visible.map((r: any) => {
              const inactive = tab === 'usuarios' && !r.active;
              return (
                <div key={r.id} className={`mov-row${inactive ? ' is-inactive' : ''}`}>
                  <div className="min-w-0">
                    <p className="mov-row-name">
                      {r.name}
                      {tab === 'usuarios' && (
                        <span className={`badge ${r.active ? 'badge-success' : 'badge-danger'} ml-1`}>
                          {r.active ? 'ativo' : 'inativo'}
                        </span>
                      )}
                    </p>
                    <p className="mov-row-meta">{metaOf(tab, r)}</p>
                  </div>
                  <div className="prd-row-right">
                    <div className="prd-actions">
                      <button title="Editar" onClick={() => openEdit(r)}>✏️</button>
                      <button title="Desativar" onClick={() => remove(r.id)}>🗑️</button>
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
            <h3 className="font-semibold text-slate-700 mb-3">
              {editingId ? 'Editar' : 'Novo'} {nameLabel}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              {tab === 'categorias' && (
                <>
                  <div>
                    <label className="label">Descrição</label>
                    <input className="input" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Margem padrão (%)</label>
                    <input
                      type="number"
                      className="input"
                      value={form.marginPercent || 0}
                      onChange={e => setForm({ ...form, marginPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </>
              )}

              {tab === 'fornecedores' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">CNPJ/CPF</label>
                    <input className="input" value={form.cnpjCpf || ''} onChange={e => setForm({ ...form, cnpjCpf: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">E-mail</label>
                    <input className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
              )}

              {tab === 'usuarios' && (
                <>
                  <div>
                    <label className="label">E-mail *</label>
                    <input
                      type="email"
                      className="input"
                      value={form.email || ''}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">{editingId ? 'Nova senha (deixe vazio para manter)' : 'Senha *'}</label>
                    <input
                      type="password"
                      className="input"
                      value={form.password || ''}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Perfil</label>
                    <select className="select" value={form.role || 'caixa'} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="caixa">Caixa</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {editingId && (
                    <div>
                      <label className="label">Status</label>
                      <select
                        className="select"
                        value={String(form.active ?? 1)}
                        onChange={e => setForm({ ...form, active: e.target.value === '1' ? 1 : 0 })}
                      >
                        <option value="1">Ativo</option>
                        <option value="0">Inativo</option>
                      </select>
                    </div>
                  )}
                </>
              )}

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
