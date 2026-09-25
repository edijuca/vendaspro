import { useEffect, useState } from 'react';
import { api } from '../../api';

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function RelatoriosView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, low] = await Promise.all([
        api.reports.sales(from, to),
        api.reports.stockLow(),
      ]);
      setReport(r);
      setLowStock(low);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const payLabel: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao_credito: 'Cartão crédito',
    cartao_debito: 'Cartão débito',
    fiado: 'Fiado',
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="card mov-stat">
          <span className="mov-stat-ico is-in">💰</span>
          <div>
            <p className="mov-stat-value">R$ {Number(report?.revenue || 0).toFixed(2)}</p>
            <p className="mov-stat-label">Faturamento</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-prod">🛒</span>
          <div>
            <p className="mov-stat-value">{report?.count || 0}</p>
            <p className="mov-stat-label">Vendas</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico">🎫</span>
          <div>
            <p className="mov-stat-value">R$ {Number(report?.avgTicket || 0).toFixed(2)}</p>
            <p className="mov-stat-label">Ticket médio</p>
          </div>
        </div>
        <div className="card mov-stat">
          <span className="mov-stat-ico is-out">❌</span>
          <div>
            <p className="mov-stat-value">{report?.cancelledCount || report?.cancelled || 0}</p>
            <p className="mov-stat-label">Canceladas</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="label">De</label>
            <input type="date" className="input w-44" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Até</label>
            <input type="date" className="input w-44" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Gerando...' : 'Gerar relatório'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700">Por forma de pagamento</h3>
                <span className="badge badge-neutral">{(report.byPayment || []).length}</span>
              </div>
              {(report.byPayment || []).length === 0 ? (
                <p className="text-slate-400 text-sm">Sem dados no período</p>
              ) : (
                <div>
                  {report.byPayment.map((row: any) => (
                    <div key={row.paymentMethod} className="mov-row">
                      <div className="min-w-0">
                        <p className="mov-row-name">{payLabel[row.paymentMethod] || row.paymentMethod}</p>
                      </div>
                      <div className="prd-row-numbers">
                        <span className="mov-row-reason">{row.count}x</span>
                        <span className="prd-price">R$ {Number(row.total).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700">Produtos mais vendidos</h3>
                <span className="badge badge-neutral">{(report.topProducts || []).length}</span>
              </div>
              {(report.topProducts || []).length === 0 ? (
                <p className="text-slate-400 text-sm">Sem dados no período</p>
              ) : (
                <div>
                  {report.topProducts.slice(0, 5).map((row: any) => (
                    <div key={row.productName} className="mov-row">
                      <div className="min-w-0">
                        <p className="mov-row-name">{row.productName}</p>
                      </div>
                      <div className="prd-row-numbers">
                        <span className="mov-row-reason">{row.quantity} un.</span>
                        <span className="prd-price">R$ {Number(row.total).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-700">Estoque baixo</h3>
              <span className="badge badge-neutral">{lowStock.length}</span>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-slate-400 text-sm">Nenhum produto abaixo do mínimo</p>
            ) : (
              <div>
                {lowStock.map(p => (
                  <div key={p.id} className="mov-row">
                    <div className="min-w-0">
                      <p className="mov-row-name">{p.name}</p>
                    </div>
                    <div className="prd-row-numbers">
                      <span className="mov-row-reason">mín. {p.minStock}</span>
                      <span className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>{p.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
