import { useEffect, useState } from 'react';
import { api } from '../../api';
import { CashRegister, Customer, Promotion, Sale, ViewTab } from '../../types';

interface PayRow { paymentMethod: string; count: number; total: number }
interface DayRow { day: string; count: number; total: number }
interface TopRow { productName: string; quantity: number; total: number }

interface SalesReport {
  count: number;
  revenue: number;
  cancelled: number;
  cancelledCount: number;
  discounts: number;
  avgTicket: number;
  byPayment: PayRow[];
  byDay: DayRow[];
  topProducts: TopRow[];
}

type RangeKey = 'hoje' | '7' | '30';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'hoje', label: 'Hoje', days: 1 },
  { key: '7', label: '7 dias', days: 7 },
  { key: '30', label: '30 dias', days: 30 },
];

const PAY_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão crédito',
  cartao_debito: 'Cartão débito',
  fiado: 'Fiado',
};

function payBadge(method: string) {
  if (method === 'fiado') return 'badge badge-warning';
  if (method === 'cartao_credito' || method === 'cartao_debito') return 'badge badge-info';
  return 'badge badge-success';
}

function dayStr(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function deltaOf(now: number, before: number): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (!before) return null;
  return { pct: ((now - before) / before) * 100, dir: now > before ? 'up' : now < before ? 'down' : 'flat' };
}

function localReport(sales: Sale[], from: string, to: string): SalesReport {
  const inRange = sales.filter(s => {
    const d = s.timestamp.slice(0, 10);
    return d >= from && d <= to;
  });
  const done = inRange.filter(s => s.status === 'concluida');
  const cancelledRows = inRange.filter(s => s.status === 'cancelada');
  const revenue = done.reduce((a, s) => a + Number(s.total || 0), 0);

  const byPay = new Map<string, PayRow>();
  const byDay = new Map<string, DayRow>();
  for (const s of done) {
    const pay = byPay.get(s.paymentMethod) || { paymentMethod: s.paymentMethod, count: 0, total: 0 };
    pay.count += 1;
    pay.total += Number(s.total || 0);
    byPay.set(s.paymentMethod, pay);

    const day = s.timestamp.slice(0, 10);
    const row = byDay.get(day) || { day, count: 0, total: 0 };
    row.count += 1;
    row.total += Number(s.total || 0);
    byDay.set(day, row);
  }

  const count = done.length;
  return {
    count,
    revenue,
    cancelled: cancelledRows.reduce((a, s) => a + Number(s.total || 0), 0),
    cancelledCount: cancelledRows.length,
    discounts: done.reduce((a, s) => a + Number(s.discount || 0), 0),
    avgTicket: count ? Math.round((revenue / count) * 100) / 100 : 0,
    byPayment: [...byPay.values()].sort((a, b) => b.total - a.total),
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    topProducts: [],
  };
}

function filledDays(from: string, to: string, rows: DayRow[]): DayRow[] {
  const map = new Map(rows.map(r => [r.day, r]));
  const out: DayRow[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = start; t <= end; t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push(map.get(day) || { day, count: 0, total: 0 });
  }
  return out;
}

function Delta({ d }: { d: ReturnType<typeof deltaOf> }) {
  if (!d) return <span className="dash-delta flat">— sem base</span>;
  if (d.dir === 'flat') return <span className="dash-delta flat">= estável</span>;
  const arrow = d.dir === 'up' ? '▲' : '▼';
  const pct = Math.abs(d.pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return <span className={`dash-delta ${d.dir}`}>{arrow} {pct}%</span>;
}

interface Props {
  register: CashRegister | null;
  canManage: boolean;
  onNavigate: (tab: ViewTab) => void;
}

export default function DashboardPage({ register, canManage, onNavigate }: Props) {
  const [range, setRange] = useState<RangeKey>('hoje');
  const [reloadTick, setReloadTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState('');
  const [degraded, setDegraded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  const [chartWindow, setChartWindow] = useState<{ from: string; to: string }>({ from: dayStr(0), to: dayStr(0) });
  const [cur, setCur] = useState<SalesReport | null>(null);
  const [prev, setPrev] = useState<SalesReport | null>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<Customer[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const days = (RANGES.find(r => r.key === range) || RANGES[0]).days;
        const curFrom = dayStr(-(days - 1));
        const curTo = dayStr(0);
        const prevFrom = dayStr(-(days * 2 - 1));
        const prevTo = dayStr(-days);

        const [curR, prevR, low, customers, activePromos, salesList] = await Promise.all([
          api.reports.sales(curFrom, curTo).catch(() => null),
          api.reports.sales(prevFrom, prevTo).catch(() => null),
          api.reports.stockLow().catch(() => null),
          api.customers.list({ includeInactive: true }).catch(() => null),
          canManage ? api.promotions.active().catch(() => null) : Promise.resolve(null),
          api.sales.list().catch(() => null),
        ]);

        if (!alive) return;

        if (!curR && !salesList) {
          setError('Não foi possível carregar os dados do dashboard.');
          setLoadedOnce(true);
          return;
        }

        const list: Sale[] = salesList || [];
        setDegraded(!curR);
        setCur(curR || localReport(list, curFrom, curTo));
        setPrev(prevR || localReport(list, prevFrom, prevTo));
        setChartWindow({ from: prevFrom, to: curTo });
        setLowStock(low || []);
        setDebtors(
          (customers || [])
            .filter(c => Number(c.currentDebt) > 0)
            .sort((a, b) => Number(b.currentDebt) - Number(a.currentDebt)),
        );
        setPromos(activePromos || []);
        setTodaySales(list.filter(s => s.timestamp.slice(0, 10) === curTo && s.status === 'concluida'));
        setAllSales(list);
        setUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setLoadedOnce(true);
      } catch (e: any) {
        if (alive) setError(e.message || 'Erro ao carregar dados.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [range, canManage, reloadTick]);

  const rangeCfg = RANGES.find(r => r.key === range) || RANGES[0];

  if (!loadedOnce && loading && !error) {
    return (
      <div className="card">
        <div className="flex items-center justify-center gap-3" style={{ padding: '36px 0' }}>
          <div className="spinner spinner-lg" />
          <span className="text-sm text-slate-500">Carregando dashboard…</span>
        </div>
      </div>
    );
  }

  if (!loadedOnce && error) {
    return (
      <div className="card text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button className="btn btn-primary" onClick={() => setReloadTick(t => t + 1)}>Tentar novamente</button>
      </div>
    );
  }

  const revDelta = deltaOf(cur?.revenue || 0, prev?.revenue || 0);
  const cntDelta = deltaOf(cur?.count || 0, prev?.count || 0);
  const ticketDelta = deltaOf(cur?.avgTicket || 0, prev?.avgTicket || 0);

  const chartDays = filledDays(chartWindow.from, chartWindow.to, [...(prev?.byDay || []), ...(cur?.byDay || [])]);
  const maxDay = Math.max(1, ...chartDays.map(d => Number(d.total)));
  const labelStep = Math.max(1, Math.ceil(chartDays.length / 10));
  const today = dayStr(0);

  const compact = rangeCfg.days > 1;
  const barMax = compact ? 45 : 55;
  const payLimit = compact ? 3 : 4;
  const periodFrom = dayStr(-(rangeCfg.days - 1));
  const latestSales = compact
    ? allSales
        .filter(s => s.status === 'concluida' && s.timestamp.slice(0, 10) >= periodFrom)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 3)
    : todaySales.slice(0, 5);

  const payRows = cur?.byPayment || [];
  const payTotal = payRows.reduce((a, r) => a + Number(r.total || 0), 0) || 1;

  const totalDebt = debtors.reduce((a, c) => a + Number(c.currentDebt || 0), 0);
  const expiringSoon = promos.filter(p => p.endDate <= dayStr(7));

  return (
    <div className="dash space-y-2">
      {/* Barra única: período, caixa e atualização */}
      <div className="card dash-toolbar">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="dash-range" role="group" aria-label="Período do dashboard">
            {RANGES.map(r => (
              <button
                key={r.key}
                className={`dash-range-btn${range === r.key ? ' active' : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {register?.status === 'aberto' ? (
            <span className="badge badge-success">
              <span className="mr-1">●</span> Caixa aberto
              {register.code ? ` #${register.code.replace(/^REG-/, '')}` : ''}
            </span>
          ) : (
            <span className="badge badge-danger">
              <span className="mr-1">●</span> Caixa fechado
            </span>
          )}
          <div className="dash-caixa-stats">
            <div>
              <span className="dash-stat-label">Saldo atual</span>
              <span className="dash-stat-value">{register ? brl(Number(register.balance || 0)) : '—'}</span>
            </div>
            <div>
              <span className="dash-stat-label">Abertura</span>
              <span className="dash-stat-value">{register ? brl(Number(register.openingBalance || 0)) : '—'}</span>
            </div>
            <div>
              <span className="dash-stat-label">Vendas da sessão</span>
              <span className="dash-stat-value">{register ? brl(Number(register.salesTotal || 0)) : '—'}</span>
            </div>
          </div>
          <div className="flex-1" />
          {degraded && (
            <span
              className="badge badge-warning"
              title="Seu perfil não acessa os relatórios agregados. Resumo calculado localmente a partir das últimas 200 vendas."
            >
              Resumo local
            </span>
          )}
          {updatedAt && <span className="text-xs text-slate-400">Atualizado às {updatedAt}</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setReloadTick(t => t + 1)} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('caixa')}>
            {register?.status === 'aberto' ? 'Ver caixa' : 'Abrir caixa'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Visão geral do período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center dash-kpi">
          <p className="text-xs text-slate-500">Faturamento · {rangeCfg.label}</p>
          <p className="text-xl font-bold text-slate-800">{brl(cur?.revenue || 0)}</p>
          <p className="text-xs text-slate-400 mt-1">
            <Delta d={revDelta} /> vs anterior · Descontos: {brl(cur?.discounts || 0)}
          </p>
        </div>
        <div className="card text-center dash-kpi">
          <p className="text-xs text-slate-500">Vendas · {rangeCfg.label}</p>
          <p className="text-xl font-bold text-slate-800">{cur?.count || 0}</p>
          <p className="text-xs text-slate-400 mt-1">
            <Delta d={cntDelta} /> vs anterior · concluídas no período
          </p>
        </div>
        <div className="card text-center dash-kpi">
          <p className="text-xs text-slate-500">Ticket médio</p>
          <p className="text-xl font-bold text-slate-800">{brl(cur?.avgTicket || 0)}</p>
          <p className="text-xs text-slate-400 mt-1">
            <Delta d={ticketDelta} /> vs anterior · faturamento ÷ vendas
          </p>
        </div>
        <div className="card text-center dash-kpi">
          <p className="text-xs text-slate-500">Canceladas · {rangeCfg.label}</p>
          <p className="text-xl font-bold" style={{ color: (cur?.cancelledCount || 0) > 0 ? 'var(--danger)' : undefined }}>
            {cur?.cancelledCount || 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {brl(cur?.cancelled || 0)} em valor
          </p>
        </div>
      </div>

      {/* Desempenho */}
      <div className="dash-two">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-1">Vendas por dia · {chartDays.length} dias</h3>
          {chartDays.every(d => d.total === 0) ? (
            <p className="text-slate-400 text-sm">Sem vendas no período</p>
          ) : (
            <div className={`dash-chart${compact ? ' is-compact' : ''}`}>
              {chartDays.map((d, i) => {
                const h = d.total > 0 ? Math.max(5, Math.round((Number(d.total) / maxDay) * barMax)) : 3;
                const showLabel = i % labelStep === 0 || d.day === today;
                return (
                  <div className="dash-chart-col" key={d.day}>
                    {d.total > 0 && chartDays.length <= 7 && (
                      <span className="dash-chart-val">{Math.round(d.total)}</span>
                    )}
                    <div
                      className={`dash-chart-bar${d.total === 0 ? ' is-zero' : ''}${d.day === today ? ' is-today' : ''}`}
                      style={{ height: `${h}px` }}
                      title={`${d.day.split('-').reverse().join('/')} — ${brl(d.total)} · ${d.count} venda(s)`}
                    />
                    <span className="dash-chart-label">
                      {showLabel ? `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-1">Formas de pagamento · {rangeCfg.label}</h3>
          {payRows.length === 0 ? (
            <p className="text-slate-400 text-sm">Sem vendas no período</p>
          ) : (
            <div>
              {payRows.slice(0, payLimit).map(row => {
                const share = (Number(row.total || 0) / payTotal) * 100;
                return (
                  <div className="dash-pay" key={row.paymentMethod}>
                    <div className="dash-pay-head">
                      <span className="text-slate-600">{PAY_LABEL[row.paymentMethod] || row.paymentMethod}</span>
                      <span className="font-medium text-slate-700">
                        {brl(row.total)}{' '}
                        <span className="text-slate-400">· {row.count}x · {Math.round(share)}%</span>
                      </span>
                    </div>
                    <div className="dash-pay-track">
                      <div className="dash-pay-fill" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
              {payRows.length > payLimit && (
                <p className="text-xs text-slate-400 mt-2">+{payRows.length - payLimit} outra(s) forma(s)</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Produtos + últimas vendas */}
      <div className="dash-two">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-1">Produtos mais vendidos · {rangeCfg.label}</h3>
          {(cur?.topProducts || []).length === 0 ? (
            <p className="text-slate-400 text-sm">
              {degraded ? 'Indisponível para o seu perfil' : 'Sem vendas no período'}
            </p>
          ) : (
            <div className="space-y-2">
              {cur!.topProducts.slice(0, compact ? 3 : 4).map(row => (
                <div className="dash-list-row" key={row.productName}>
                  <span className="text-slate-600 truncate">{row.productName}</span>
                  <span className="font-medium text-slate-700">{row.quantity} un — {brl(row.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-1">
            {compact ? `Últimas vendas · ${rangeCfg.label}` : 'Últimas vendas · hoje'}
          </h3>
          {latestSales.length === 0 ? (
            <p className="text-slate-400 text-sm">
              {compact ? 'Sem vendas no período' : 'Nenhuma venda registrada hoje'}
            </p>
          ) : (
            <div className="space-y-2">
              {latestSales.map(s => (
                <div className="dash-list-row" key={s.id}>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.code}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(s.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {s.operator}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">{brl(s.total)}</p>
                    <span className={`${payBadge(s.paymentMethod)} text-xs`}>
                      {PAY_LABEL[s.paymentMethod] || s.paymentMethod}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Risco e ações */}
      <div className={canManage ? 'dash-three' : 'dash-two'}>
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-700">Estoque baixo</h3>
            <span className={`badge ${lowStock.length > 0 ? 'badge-danger' : 'badge-neutral'}`}>{lowStock.length}</span>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhum produto abaixo do mínimo</p>
          ) : (
            <>
              <div className="space-y-2">
                {lowStock.slice(0, compact ? 3 : 5).map(p => (
                  <div className="dash-list-row" key={p.id}>
                    <span className="text-slate-600 truncate">{p.name}</span>
                    <span className={`badge ${Number(p.stock) <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                      {p.stock}/{p.minStock}
                    </span>
                  </div>
                ))}
              </div>
              {lowStock.length > (compact ? 3 : 5) && (
                <p className="text-xs text-slate-400 mt-1">+{lowStock.length - (compact ? 3 : 5)} outros produtos</p>
              )}
              <button className="btn btn-ghost btn-sm w-full mt-2" onClick={() => onNavigate('estoque')}>
                Ver estoque
              </button>
            </>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-700">Fiados em aberto</h3>
            <span className={`badge ${debtors.length > 0 ? 'badge-warning' : 'badge-neutral'}`}>{debtors.length}</span>
          </div>
          {debtors.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhum cliente com dívida</p>
          ) : (
            <>
              <p className="text-lg font-bold text-slate-800 mb-1">{brl(totalDebt)}</p>
              <div className="space-y-2">
                {debtors.slice(0, compact ? 2 : 3).map(c => (
                  <div className="dash-list-row" key={c.id}>
                    <span className="text-slate-600 truncate">{c.name}</span>
                    <span className="font-medium text-slate-700">{brl(Number(c.currentDebt || 0))}</span>
                  </div>
                ))}
              </div>
              {debtors.length > (compact ? 2 : 3) && (
                <p className="text-xs text-slate-400 mt-1">+{debtors.length - (compact ? 2 : 3)} outros clientes</p>
              )}
              <button className="btn btn-ghost btn-sm w-full mt-2" onClick={() => onNavigate('clientes')}>
                Ver clientes
              </button>
            </>
          )}
        </div>

        {canManage && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-700">Promoções ativas</h3>
              <span className={`badge ${expiringSoon.length > 0 ? 'badge-warning' : 'badge-neutral'}`}>{promos.length}</span>
            </div>
            {promos.length === 0 ? (
              <p className="text-slate-400 text-sm">Nenhuma promoção vigente</p>
            ) : (
              <>
                {expiringSoon.length > 0 && (
                  <p className="text-xs mb-1" style={{ color: 'var(--warning)' }}>
                    ⚠ {expiringSoon.length} vencem em até 7 dias
                  </p>
                )}
                <div className="space-y-2">
                  {promos.slice(0, compact ? 2 : 3).map(p => (
                    <div className="dash-list-row" key={p.id}>
                      <span className="text-slate-600 truncate">{p.productName || p.name}</span>
                      <span className="text-xs text-slate-400">até {p.endDate.split('-').reverse().join('/')}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm w-full mt-2" onClick={() => onNavigate('promocoes')}>
                  Ver promoções
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        {rangeCfg.days === 1
          ? 'Comparação com ontem'
          : `Comparação com os ${rangeCfg.days} dias anteriores`}{' '}
        · atualização automática a cada 60s
      </p>
    </div>
  );
}
