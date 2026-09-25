import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { CashRegister, CashMovement } from '../../types';

type CaixaTab = 'atual' | 'movimentacoes' | 'historico';
type ModalKind = null | 'open' | 'close' | 'suprimento' | 'sangria' | 'report';

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
  fiado: 'Fiado',
};

const MOV_LABELS: Record<string, string> = {
  sale: 'Venda',
  cancel: 'Cancelamento',
  suprimento: 'Suprimento',
  sangria: 'Sangria',
  entrada: 'Entrada',
  saida: 'Saída',
  recebimento: 'Recebimento',
};

function fmt(n: number | null | undefined) {
  return `R$ ${(Number(n) || 0).toFixed(2)}`;
}

function formatRegCode(r: CashRegister) {
  if (r.code) return `#${r.code.replace(/^REG-/, '')}`;
  return r.id;
}

export default function CaixaView({ onRegisterChange }: { onRegisterChange?: () => void }) {
  const { user, isAdmin } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [current, setCurrent] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [tab, setTab] = useState<CaixaTab>('atual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalKind>(null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeSummary, setCloseSummary] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [withdrawalLimit, setWithdrawalLimit] = useState(0);
  const [movSearch, setMovSearch] = useState('');
  const [movType, setMovType] = useState('');
  const [histSearch, setHistSearch] = useState('');
  const [histStatus, setHistStatus] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, c, st] = await Promise.all([
        api.cash.registers(),
        api.cash.current(),
        api.settings.get().catch(() => null),
      ]);
      setRegisters(r);
      setCurrent(c);
      setWithdrawalLimit(Number(st?.withdrawalLimit) || 0);
      const m = await api.cash.movements(c?.id);
      setMovements(m);
      if (c?.id) {
        const s = await api.cash.summary(c.id).catch(() => null);
        setSummary(s);
      } else {
        setSummary(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = async (kind: Exclude<ModalKind, null>) => {
    setError('');
    setAmount(0);
    setDescription('');
    setCloseSummary(null);
    setReport(null);
    if (kind === 'close' && current) {
      try {
        const s = await api.cash.summary(current.id);
        setCloseSummary(s);
        setAmount(s.expected);
      } catch (e: any) { setError(e.message); }
    }
    if (kind === 'report') return;
    setModal(kind);
  };

  const submitModal = async () => {
    setBusy(true);
    setError('');
    try {
      if (modal === 'open') {
        await api.cash.open({ openingBalance: amount });
      } else if (modal === 'close' && current) {
        await api.cash.close(current.id, { countedBalance: amount });
      } else if (modal === 'suprimento' || modal === 'sangria') {
        if (amount <= 0) throw new Error('Informe o valor');
        if (modal === 'suprimento' && !description.trim()) throw new Error('Motivo é obrigatório');
        if (modal === 'sangria' && withdrawalLimit > 0 && amount > withdrawalLimit && !isAdmin) {
          throw new Error('Sangria acima do limite — requer autorização do admin');
        }
        await api.cash.movement({
          type: modal,
          amount,
          description: description || (modal === 'suprimento' ? 'Suprimento' : 'Sangria'),
          reason: description,
          cashRegisterId: current?.id,
        });
      } else if (modal === 'report' && report) {
        window.print();
      }
      setModal(null);
      setAmount(0);
      setDescription('');
      await load();
      if (modal === 'open' || modal === 'close') onRegisterChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openReport = async (regId: string) => {
    setError('');
    try {
      const rep = await api.cash.report(regId);
      setReport(rep);
      setModal('report');
    } catch (e: any) { setError(e.message); }
  };

  const reopen = async (regId: string) => {
    setError('');
    try {
      await api.cash.reopen(regId);
      await load();
      onRegisterChange?.();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const modalTitle =
    modal === 'open' ? 'Abertura de Caixa' :
    modal === 'close' ? 'Fechamento de Caixa' :
    modal === 'suprimento' ? 'Suprimento' :
    modal === 'sangria' ? 'Sangria' :
    modal === 'report' ? 'Relatório de Fechamento' : '';

  const expected = closeSummary?.expected ?? current?.balance ?? 0;
  const diffLive = Math.round((expected - amount) * 100) / 100;
  const verdictLive = Math.abs(diffLive) < 0.005 ? 'Caixa certo' : diffLive > 0 ? `Quebra: ${fmt(diffLive)}` : `Sobra: ${fmt(-diffLive)}`;

  const tabs: { id: CaixaTab; label: string }[] = [
    { id: 'atual', label: 'Caixa Atual' },
    { id: 'movimentacoes', label: 'Movimentações' },
    { id: 'historico', label: 'Histórico' },
  ];

  const movTypes = [...new Set(movements.map(m => m.type))].sort();
  const movTerm = movSearch.trim().toLowerCase();
  const movHasFilter = Boolean(movTerm || movType);
  const movFiltered = movements.filter(m => {
    if (movType && m.type !== movType) return false;
    if (!movTerm) return true;
    return `${m.description || ''} ${m.reason || ''} ${m.operator || ''} ${m.type}`.toLowerCase().includes(movTerm);
  });
  const movVisible = movHasFilter ? movFiltered.slice(0, 50) : movFiltered.slice(0, 5);

  const histTerm = histSearch.trim().toLowerCase();
  const histHasFilter = Boolean(histTerm || histStatus);
  const histFiltered = registers.filter(r => {
    if (histStatus && r.status !== histStatus) return false;
    if (!histTerm) return true;
    return `${formatRegCode(r)} ${r.operator} ${r.status}`.toLowerCase().includes(histTerm);
  });
  const histVisible = histHasFilter ? histFiltered.slice(0, 50) : histFiltered.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">💰</span>
          <div>
            <p className="mov-stat-value">{current ? fmt(summary?.expected ?? current.balance) : '—'}</p>
            <p className="mov-stat-label">Dinheiro esperado</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">🛒</span>
          <div>
            <p className="mov-stat-value">{current ? fmt(summary?.totalSales ?? current.salesTotal) : '—'}</p>
            <p className="mov-stat-label">Faturamento do caixa</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico">{current ? '🔓' : '🔒'}</span>
          <div>
            <p className="mov-stat-value">{current ? 'Aberto' : 'Fechado'}</p>
            <p className="mov-stat-label">Status do caixa</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === 'atual' && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">Caixa Atual</h3>
            <div className="flex items-center gap-2">
              <span className={`badge ${current ? 'badge-success' : 'badge-neutral'}`}>
                {current ? 'Aberto' : 'Fechado'}
              </span>
              {!current && (
                <button className="btn btn-primary btn-sm" onClick={() => openModal('open')}>
                  Abrir Caixa
                </button>
              )}
              {current && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => openModal('suprimento')}>
                    Suprimento
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openModal('sangria')}>
                    Sangria
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => openModal('close')}>
                    Fechar Caixa
                  </button>
                </>
              )}
            </div>
          </div>
          {current ? (
            <>
              <p className="text-sm text-slate-500">
                Caixa {formatRegCode(current)} — Operador: {current.operator}
              </p>
              <p className="text-xs text-slate-400">
                Abertura: {new Date(current.openedAt).toLocaleString('pt-BR')} · Fundo: {fmt(current.openingBalance)}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-emerald-600">Suprimentos</p>
                  <p className="text-lg font-semibold text-slate-800">{fmt(summary?.movements?.supplies)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600">Sangrias</p>
                  <p className="text-lg font-semibold text-slate-800">{fmt(summary?.movements?.withdrawals)}</p>
                </div>
              </div>
              {summary?.byPayment?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.byPayment.map((p: any) => (
                    <span key={p.method} className="badge badge-neutral text-xs">
                      {PAYMENT_LABELS[p.method] || p.method}: {fmt(p.total)}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-400 text-sm">Nenhum caixa aberto</p>
          )}
        </div>
      )}

      {tab === 'movimentacoes' && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">Movimentações do Caixa</h3>
            <span className="badge badge-neutral">{current ? movFiltered.length : 0}</span>
          </div>
          {!current ? (
            <p className="text-slate-400 text-sm">Nenhum caixa aberto</p>
          ) : movements.length === 0 ? (
            <p className="text-slate-400 text-sm">Sem movimentos neste caixa</p>
          ) : (
            <>
              <div className="mov-filters">
                <input
                  className="input"
                  placeholder="Buscar por descrição, motivo ou operador..."
                  value={movSearch}
                  onChange={e => setMovSearch(e.target.value)}
                />
                <select className="select" value={movType} onChange={e => setMovType(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {movTypes.map(t => (
                    <option key={t} value={t}>{MOV_LABELS[t] || t}</option>
                  ))}
                </select>
                {movHasFilter && (
                  <button className="btn btn-secondary btn-sm" onClick={() => { setMovSearch(''); setMovType(''); }}>
                    Limpar
                  </button>
                )}
              </div>
              {movFiltered.length === 0 ? (
                <p className="text-slate-400 text-sm">Nenhuma movimentação encontrada com esses filtros</p>
              ) : (
                <div>
                  {movVisible.map(m => (
                    <div key={m.id} className="mov-row">
                      <div className="min-w-0">
                        <p className="mov-row-name">
                          <span className={`badge ${m.amount < 0 ? 'badge-danger' : 'badge-success'} mr-1`}>
                            {MOV_LABELS[m.type] || m.type}
                          </span>
                          {m.description || m.type}
                        </p>
                        <p className="mov-row-meta">
                          {new Date(m.timestamp).toLocaleString('pt-BR')} · {m.operator}
                          {m.reason && m.reason !== m.description ? ` · ${m.reason}` : ''}
                        </p>
                      </div>
                      <div className="prd-row-right">
                        <span className={`prd-price ${m.amount < 0 ? 'is-debt' : 'is-pos'}`}>{fmt(m.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">Histórico de Caixas</h3>
            <span className="badge badge-neutral">{histFiltered.length}</span>
          </div>
          <div className="mov-filters">
            <input
              className="input"
              placeholder="Buscar por caixa ou operador..."
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
            />
            <select className="select" value={histStatus} onChange={e => setHistStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="aberto">Abertos</option>
              <option value="fechado">Fechados</option>
            </select>
            {histHasFilter && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setHistSearch(''); setHistStatus(''); }}>
                Limpar
              </button>
            )}
          </div>
          {registers.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhum registro de caixa</p>
          ) : histFiltered.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhum registro encontrado com esses filtros</p>
          ) : (
            <div>
              {histVisible.map(r => (
                <div key={r.id} className="mov-row">
                  <div className="min-w-0">
                    <p className="mov-row-name">Caixa {formatRegCode(r)}</p>
                    <p className="mov-row-meta">
                      {new Date(r.openedAt).toLocaleString('pt-BR')} · {r.operator} · Fundo: {fmt(r.openingBalance)}
                      {r.closedAt && ` · Fechado: ${new Date(r.closedAt).toLocaleString('pt-BR')} · Dif.: ${fmt(r.difference)}${(r.difference ?? 0) > 0 ? ' (Quebra)' : (r.difference ?? 0) < 0 ? ' (Sobra)' : ''}`}
                    </p>
                  </div>
                  <div className="prd-row-right">
                    <div className="prd-row-numbers">
                      <span className="prd-price">{fmt(r.balance)}</span>
                      <span className={`badge ${r.status === 'aberto' ? 'badge-success' : 'badge-neutral'}`}>
                        {r.status === 'aberto' ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>
                    <span className="mov-row-reason">Vendas: {fmt(r.salesTotal)}</span>
                    {r.status === 'fechado' && (
                      <div className="flex gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => openReport(r.id)}>
                          Relatório
                        </button>
                        {isAdmin && (
                          <button className="btn btn-secondary btn-sm" onClick={() => reopen(r.id)}>
                            Reabrir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && modal !== 'report' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-700 mb-3">{modalTitle}</h3>
            <div className="space-y-3">
              {modal === 'open' && (
                <>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>Operador: {user?.name}</p>
                    <p>Data: {new Date().toLocaleDateString('pt-BR')}</p>
                    <p>Hora: {new Date().toLocaleTimeString('pt-BR')}</p>
                  </div>
                  <div>
                    <label className="label">Valor inicial em dinheiro (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      value={amount}
                      onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Somente o dinheiro físico colocado no caixa.</p>
                  </div>
                </>
              )}

              {modal === 'close' && closeSummary && (
                <>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dinheiro esperado</span>
                      <span className="font-semibold text-slate-800">{fmt(closeSummary.expected)}</span>
                    </div>
                    {closeSummary.byPayment?.map((p: any) => (
                      <div key={p.method} className="flex justify-between text-xs text-slate-500">
                        <span>{PAYMENT_LABELS[p.method] || p.method}</span>
                        <span>{fmt(p.total)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs text-slate-500 border-t border-slate-200 pt-1">
                      <span>Faturamento total</span>
                      <span className="font-semibold">{fmt(closeSummary.totalSales)}</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Valor contado no caixa (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      value={amount}
                      onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                  </div>
                  <div className={`rounded-lg p-3 text-sm font-medium ${
                    Math.abs(diffLive) < 0.005 ? 'bg-emerald-50 text-emerald-700'
                    : diffLive > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    <div className="flex justify-between">
                      <span>Esperado:</span><span>{fmt(expected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contado:</span><span>{fmt(amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diferença:</span>
                      <span>{diffLive > 0 ? '-' : diffLive < 0 ? '+' : ''}{fmt(Math.abs(diffLive))}</span>
                    </div>
                    <p className="mt-1 text-center uppercase text-xs tracking-wide">{verdictLive}</p>
                  </div>
                </>
              )}

              {modal === 'suprimento' && (
                <>
                  <div>
                    <label className="label">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      value={amount}
                      onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">Motivo *</label>
                    <input
                      className="input"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Ex: Reforço de caixa"
                    />
                  </div>
                </>
              )}

              {modal === 'sangria' && (
                <>
                  <div>
                    <label className="label">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      value={amount}
                      onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                    {withdrawalLimit > 0 && (
                      <p className="text-xs text-slate-400 mt-1">Limite por operador: {fmt(withdrawalLimit)}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Motivo</label>
                    <input
                      className="input"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Ex: Retirada para cofre"
                    />
                    <p className="text-xs text-slate-400 mt-1">Movimentação de caixa — não é despesa de venda.</p>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary flex-1" onClick={submitModal} disabled={busy}>
                {busy ? 'Salvando...' : modal === 'open' ? 'Abrir Caixa' : modal === 'close' ? 'Fechar Caixa' : 'Confirmar'}
              </button>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'report' && report && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
            <h3 className="font-semibold text-slate-700 mb-3">RELATÓRIO DE FECHAMENTO</h3>
            <div className="text-sm space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <p><strong>Caixa:</strong> {report.register.code ? `#${report.register.code.replace(/^REG-/, '')}` : report.register.id}</p>
                <p><strong>Operador:</strong> {report.register.operator}</p>
                <p><strong>Abertura:</strong> {new Date(report.register.openedAt).toLocaleString('pt-BR')}</p>
                {report.register.closedAt && (
                  <p><strong>Fechamento:</strong> {new Date(report.register.closedAt).toLocaleString('pt-BR')}</p>
                )}
              </div>

              <div>
                <p className="font-semibold text-slate-700">FUNDO INICIAL</p>
                <p>{fmt(report.openingBalance)}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">VENDAS</p>
                {['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado'].map(m => {
                  const row = report.byPayment?.find((p: any) => p.method === m);
                  return (
                    <div key={m} className="flex justify-between">
                      <span className="text-slate-500">{PAYMENT_LABELS[m]}</span>
                      <span>{fmt(row?.total || 0)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-semibold border-t border-slate-100 mt-1 pt-1">
                  <span>TOTAL VENDAS</span>
                  <span>{fmt(report.totalSales)}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-700">MOVIMENTAÇÕES</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">Suprimentos</span>
                  <span>{fmt(report.movements?.supplies)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sangrias</span>
                  <span>{fmt(report.movements?.withdrawals)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recebimentos de fiado</span>
                  <span>{fmt(report.movements?.creditPayments)}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-700">CAIXA FÍSICO</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">Esperado</span>
                  <span>{fmt(report.physical.expected)}</span>
                </div>
                {report.physical.counted !== null && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contado</span>
                      <span>{fmt(report.physical.counted)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Diferença</span>
                      <span className={
                        report.physical.verdict === 'quebra' ? 'text-red-600'
                        : report.physical.verdict === 'sobra' ? 'text-blue-600'
                        : 'text-emerald-600'
                      }>
                        {fmt(report.physical.difference)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div>
                <p className="font-semibold text-slate-700">STATUS</p>
                <p className="uppercase">
                  {report.register.status === 'aberto' ? 'Aberto' : `Fechado${
                    report.physical.verdict === 'quebra' ? ' com quebra'
                    : report.physical.verdict === 'sobra' ? ' com sobra'
                    : ' caixa certo'
                  }`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary flex-1" onClick={() => window.print()}>Imprimir</button>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
