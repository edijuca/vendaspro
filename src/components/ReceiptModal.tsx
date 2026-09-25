import { useEffect, useState } from 'react';
import { X, Printer, QrCode, Store } from 'lucide-react';
import { Sale, CompanySettings, PaymentMethod } from '../types';
import { generateQrCodeDataUrl } from '../utils/pixPayload';

const brl = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  fiado: 'Fiado / Crediário',
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
};

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  settings?: CompanySettings | null;
  payments?: { method: PaymentMethod; amount: number }[];
  pixPayload?: string;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  sale,
  settings,
  payments = [],
  pixPayload,
}: ReceiptModalProps) {
  const [format, setFormat] = useState<'58mm' | '80mm'>('80mm');
  const [pixQrUrl, setPixQrUrl] = useState('');

  useEffect(() => {
    if (!isOpen || !sale || sale.paymentMethod !== 'pix' || !pixPayload) return;
    let cancelled = false;
    generateQrCodeDataUrl(pixPayload)
      .then(url => {
        if (!cancelled && url) setPixQrUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, pixPayload, sale]);

  if (!isOpen || !sale) return null;

  const is58mm = format === '58mm';
  const companyName = settings?.tradeName || settings?.name || 'VendasPRO';
  const companyCnpj = settings?.cnpj || '';
  const companyAddress = settings?.address || '';

  const paidSum = payments.reduce((s, p) => s + p.amount, 0);
  const change = Math.max(0, paidSum - sale.total);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay rcp-overlay">
      <div className="modal-content rcp-box">
        <div className="rcp-head">
          <div className="rcp-head-title">
            <h2>Venda concluída · Cupom</h2>
            <span className="rcp-format-chip">{format}</span>
          </div>
          <div className="rcp-head-actions">
            <div className="rcp-format-toggle">
              <button
                type="button"
                className={format === '80mm' ? 'on' : ''}
                onClick={() => setFormat('80mm')}
              >
                80mm
              </button>
              <button
                type="button"
                className={format === '58mm' ? 'on' : ''}
                onClick={() => setFormat('58mm')}
              >
                58mm
              </button>
            </div>
            <button type="button" className="icon-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="rcp-scroll">
          <div className={`rcp-paper${is58mm ? ' narrow' : ''}`}>
            <div className="rcp-store">
              <span className="rcp-store-name">
                <Store size={14} /> {companyName}
              </span>
              {companyCnpj && <p>CNPJ: {companyCnpj}</p>}
              {companyAddress && <p>{companyAddress}</p>}
              <p className="rcp-doc-title">DOCUMENTO AUXILIAR DE VENDA</p>
              <p className="rcp-doc-sub">Cupom não fiscal eletrônico · {format}</p>
            </div>

            <div className="rcp-section">
              <div>
                <span>DATA/HORA:</span>
                <span>{formatDateTime(sale.timestamp)}</span>
              </div>
              <div>
                <span>VENDA:</span>
                <span>{sale.code}</span>
              </div>
              <div>
                <span>OPERADOR:</span>
                <span>{sale.operator}</span>
              </div>
              <div>
                <span>CLIENTE:</span>
                <span>{sale.customerName || 'Consumidor Final'}</span>
              </div>
              {sale.customerCpf && (
                <div>
                  <span>CPF:</span>
                  <span>{sale.customerCpf}</span>
                </div>
              )}
            </div>

            <div className="rcp-items">
              <div className="rcp-items-head">
                <span>ITEM</span>
                <span>TOTAL</span>
              </div>
              {(sale.items || []).map((item, idx) => (
                <div key={item.id ?? idx} className="rcp-item">
                  <div>
                    <span className="rcp-item-name">
                      {idx + 1}. {item.productName}
                    </span>
                    <span className="rcp-item-total">R$ {brl(item.total)}</span>
                  </div>
                  <p className="rcp-item-qty">
                    {item.quantity} UN x R$ {brl(item.unitPrice)}
                  </p>
                </div>
              ))}
              {!sale.items?.length && <p className="rcp-item-qty">Itens não disponíveis</p>}
            </div>

            <div className="rcp-section">
              <div>
                <span>Subtotal:</span>
                <span>R$ {brl(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="rcp-discount">
                  <span>Desconto:</span>
                  <span>-R$ {brl(sale.discount)}</span>
                </div>
              )}
              <div className="rcp-total">
                <span>TOTAL:</span>
                <span>R$ {brl(sale.total)}</span>
              </div>
            </div>

            <div className="rcp-section">
              <div>
                <span>FORMA PGTO:</span>
                <span className="rcp-strong">{METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}</span>
              </div>
              {payments.length > 0 && (
                <div>
                  <span>VALOR RECEBIDO:</span>
                  <span>R$ {brl(paidSum)}</span>
                </div>
              )}
              {payments.length > 0 && change > 0 && (
                <div className="rcp-change">
                  <span>TROCO:</span>
                  <span>R$ {brl(change)}</span>
                </div>
              )}
              {sale.paymentMethod === 'pix' && (
                <div>
                  <span>PIX:</span>
                  <span>APROVADO</span>
                </div>
              )}
            </div>

            <div className="rcp-qr">
              <div className="rcp-qr-box">
                {pixQrUrl ? <img src={pixQrUrl} alt="QR Code PIX" /> : <QrCode size={is58mm ? 40 : 48} />}
              </div>
              <p>{sale.paymentMethod === 'pix' ? 'QR Code PIX da venda' : 'Obrigado pela preferência!'}</p>
            </div>
          </div>
        </div>

        <div className="rcp-actions">
          <span className="rcp-actions-hint">Largura: <strong>{format}</strong></span>
          <div className="rcp-actions-btns">
            <button type="button" className="btn btn-secondary" onClick={handlePrint}>
              <Printer size={14} /> Imprimir
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Nova venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
