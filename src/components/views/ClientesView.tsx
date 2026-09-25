import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Customer } from '../../types';

function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const emptyForm = {
  name: '',
  cpf: '',
  email: '',
  phone: '',
  creditLimit: 0,
  dueDays: 30,
  creditStatus: 'liberado' as Customer['creditStatus'],
};

export default function ClientesView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiveFor, setReceiveFor] = useState<Customer | null>(null);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [credFilter, setCredFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, debtors: 0, debt: 0 });

  const loadStats = () => {
    api.customers.list({ includeInactive: true }).then(list => {
      const withDebt = list.filter(c => Number(c.currentDebt || 0) > 0);
      setStats({
        total: list.length,
        debtors: withDebt.length,
        debt: withDebt.reduce((a, c) => a + Number(c.currentDebt || 0), 0),
      });
    }).catch(() => {});
  };

  const load = async (incl?: boolean) => {
    try {
      setCustomers(await api.customers.list({ includeInactive: incl ?? showInactive }));
    } catch { /* ignore */ }
  };
  useEffect(() => { load(showInactive); loadStats(); }, [showInactive]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      cpf: c.cpf || '',
      email: c.email || '',
      phone: c.phone || '',
      creditLimit: c.creditLimit,
      dueDays: c.dueDays || 30,
      creditStatus: c.creditStatus,
    });
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing) await api.customers.update(editing.id, form);
      else await api.customers.create(form);
      setShowForm(false);
      await load();
      loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const receive = async () => {
    if (!receiveFor || receiveAmount <= 0) return;
    setBusy(true);
    setError('');
    try {
      await api.customers.receive(receiveFor.id, receiveAmount, 'Recebimento de fiado');
      setReceiveFor(null);
      setReceiveAmount(0);
      await load();
      loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string, active: boolean) => {
    if (!active && !confirm('Arquivar este cliente? Ele deixará de aparecer nas buscas do PDV, mas a dívida e o histórico serão mantidos.')) return;
    try {
      await api.customers.update(id, { active: active ? 1 : 0 });
      await load(showInactive);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const term = search.trim().toLowerCase();
  const hasFilter = Boolean(term || credFilter || showInactive);
  const filtered = customers
    .filter(c => {
      if (credFilter && c.creditStatus !== credFilter) return false;
      if (term) {
        const hay = `${c.name} ${c.cpf || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.code || '').localeCompare(a.code || ''));
  const visible = hasFilter ? filtered.slice(0, 50) : filtered.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">👥</span>
          <div>
            <p className="mov-stat-value">{stats.total}</p>
            <p className="mov-stat-label">Total de clientes</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-out">⚠️</span>
          <div>
            <p className="mov-stat-value">{stats.debtors}</p>
            <p className="mov-stat-label">Com dívida</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico">💰</span>
          <div>
            <p className="mov-stat-value">{brl(stats.debt)}</p>
            <p className="mov-stat-label">Dívida total</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">Clientes</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral">{filtered.length}</span>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Novo Cliente</button>
          </div>
        </div>

        <div className="mov-filters">
          <input
            className="input"
            placeholder="Buscar por nome, CPF, e-mail ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="select" value={credFilter} onChange={e => setCredFilter(e.target.value)}>
            <option value="">Todos os créditos</option>
            <option value="liberado">Liberado</option>
            <option value="bloqueado">Bloqueado</option>
            <option value="suspenso">Suspenso</option>
            <option value="inadimplente">Inadimplente</option>
          </select>
          <label className="mov-filter-check">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            Mostrar arquivados
          </label>
          {hasFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setCredFilter(''); setShowInactive(false); }}
            >
              Limpar
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="text-slate-400 text-sm">
            {customers.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado com esses filtros'}
          </p>
        ) : (
          <div>
            {visible.map(c => {
              const inactive = c.active === 0 || c.active === false;
              const isDefault = c.id === 'cons-final';
              const meta = [c.cpf, c.phone, c.email].filter(Boolean).join(' · ');
              return (
                <div key={c.id} className={`mov-row${inactive ? ' is-inactive' : ''}`}>
                  <div className="min-w-0">
                    <p className="mov-row-name">
                      {inactive && <span className="badge badge-neutral mr-1">Arquivado</span>}
                      {c.name}
                    </p>
                    <p className="mov-row-meta">{meta || '—'}</p>
                  </div>
                  <div className="prd-row-right">
                    <div className="prd-row-numbers">
                      <span className={`prd-price${Number(c.currentDebt || 0) > 0 ? ' is-debt' : ''}`}>
                        {brl(Number(c.currentDebt || 0))}
                      </span>
                      <span className={`badge badge-${c.creditStatus === 'liberado' ? 'success' : c.creditStatus === 'bloqueado' ? 'danger' : 'warning'}`}>
                        {c.creditStatus}
                      </span>
                    </div>
                    <div className="prd-actions">
                      {c.currentDebt > 0 && (
                        <button
                          title="Receber pagamento"
                          onClick={() => {
                            setReceiveFor(c);
                            setReceiveAmount(c.currentDebt);
                            setError('');
                          }}
                        >
                          💵
                        </button>
                      )}
                      <button title="Editar" onClick={() => openEdit(c)}>✏️</button>
                      {!isDefault && !inactive && (
                        <button title="Arquivar" onClick={() => archive(c.id, false)}>🗑️</button>
                      )}
                      {!isDefault && inactive && (
                        <button title="Reativar" onClick={() => archive(c.id, true)}>↩️</button>
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
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-700 mb-3">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <div className="space-y-3">
              <div><label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">CPF</label>
                  <input className="input" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div><label className="label">Telefone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div><label className="label">E-mail</label>
                <input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Limite de crédito (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.creditLimit}
                    onChange={e => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div><label className="label">Prazo (dias)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.dueDays}
                    onChange={e => setForm({ ...form, dueDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Status de crédito</label>
                <select
                  className="select"
                  value={form.creditStatus}
                  onChange={e => setForm({ ...form, creditStatus: e.target.value as any })}
                >
                  <option value="liberado">Liberado</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="inadimplente">Inadimplente</option>
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

      {receiveFor && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-700 mb-1">Receber pagamento</h3>
            <p className="text-sm text-slate-500 mb-3">
              {receiveFor.name} — dívida R$ {receiveFor.currentDebt.toFixed(2)}
            </p>
            <label className="label">Valor a receber (R$)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="input"
              value={receiveAmount}
              onChange={e => setReceiveAmount(parseFloat(e.target.value) || 0)}
            />
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary flex-1" onClick={receive} disabled={busy}>
                {busy ? 'Salvando...' : 'Confirmar'}
              </button>
              <button className="btn btn-secondary" onClick={() => setReceiveFor(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
