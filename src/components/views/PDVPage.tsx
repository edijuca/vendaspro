import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { CompanySettings, CashRegister, Product, CartItem, PaymentMethod, Customer, Promotion, Sale } from '../../types';
import { useAuth } from '../../AuthContext';
import CameraBarcodeScannerModal from '../CameraBarcodeScannerModal';
import PriceConsultModal from '../PriceConsultModal';
import QuickCustomerModal from '../QuickCustomerModal';
import ReceiptModal from '../ReceiptModal';
import { playBarcodeBeep, playErrorBeep, playSuccessChime } from '../../utils/audio';
import { generatePixPayload, generateQrCodeDataUrl } from '../../utils/pixPayload';
import { fold } from '../../utils/fold';

const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  fiado: 'Fiado',
};

const PAY_METHODS: { key: PaymentMethod; icon: string; hotkey: string }[] = [
  { key: 'dinheiro', icon: '💵', hotkey: 'D' },
  { key: 'pix', icon: '⚡', hotkey: 'P' },
  { key: 'cartao_credito', icon: '💳', hotkey: 'X' },
  { key: 'cartao_debito', icon: '💳', hotkey: 'A' },
  { key: 'fiado', icon: '📋', hotkey: 'F' },
];

type AddedPayment = { method: PaymentMethod; amount: number; installments?: number };

export default function PDVPage({
  settings,
  register,
  onRegisterChange,
}: {
  settings: CompanySettings | null;
  register: CashRegister | null;
  onRegisterChange?: () => void;
}) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchHi, setSearchHi] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [cashReceived, setCashReceived] = useState(0);
  const [payments, setPayments] = useState<AddedPayment[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [customerId, setCustomerId] = useState('cons-final');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'valor' | 'percent'>('valor');
  const [discountInput, setDiscountInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [priceConsultOpen, setPriceConsultOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [pixPayloadStr, setPixPayloadStr] = useState('');
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastPayments, setLastPayments] = useState<AddedPayment[]>([]);
  const [lastPixPayload, setLastPixPayload] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const receivedRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLSelectElement>(null);

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountAmount =
    discountType === 'percent'
      ? Math.min(subtotal, Math.round(subtotal * (discount / 100) * 100) / 100)
      : Math.min(subtotal, discount);
  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const selectedCustomer = customers.find(c => c.id === customerId) || null;
  const selectedItem = selectedIdx !== null ? cart[selectedIdx] ?? null : cart[cart.length - 1] ?? null;
  const lastProduct = cart[cart.length - 1]?.product ?? null;

  const paidSum = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const falta = Math.max(0, Math.round((total - paidSum) * 100) / 100);
  const troco = Math.max(0, Math.round((paidSum - total) * 100) / 100);
  const isPaid = cart.length > 0 && falta <= 0.001;

  const loadProducts = async () => {
    setLoading(true);
    try {
      setProducts(await api.products.list());
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => {
    api.customers.list().then(setCustomers).catch(() => {});
    api.promotions.active().then(setPromos).catch(() => {});
  }, []);

  useEffect(() => {
    if (!paymentMode || paymentMethod !== 'pix' || total <= 0) return;
    const txid = `VP${Date.now().toString().slice(-8)}`;
    const pixKey = settings?.pixKey?.trim() || settings?.cnpj?.trim() || '';
    const payload = generatePixPayload({
      key: pixKey,
      name: settings?.pixBeneficiaryName || settings?.tradeName || settings?.name || 'VENDASPRO',
      city: settings?.pixCity || 'SAO PAULO',
      amount: total,
      txid,
    });
    setPixPayloadStr(payload);
    setPixQrUrl('');
    setPixCopied(false);
    generateQrCodeDataUrl(payload).then(url => url && setPixQrUrl(url)).catch(() => {});
  }, [paymentMode, paymentMethod, total, settings]);

  const visibleProducts = useMemo(() => {
    const q = fold(search.trim());
    if (!q) return [];
    return products.filter(p =>
      fold(p.name).startsWith(q) ||
      fold(p.sku || '').startsWith(q) ||
      fold(p.barcode || '').startsWith(q) ||
      fold(p.code || '').startsWith(q)
    ).slice(0, 8);
  }, [products, search]);

  const hiIdx = visibleProducts.length ? Math.min(searchHi, visibleProducts.length - 1) : 0;

  useEffect(() => {
    setSearchHi(0);
  }, [search]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.pdv-search-drop li button.hi');
    el?.scrollIntoView({ block: 'nearest' });
  }, [searchHi, visibleProducts]);

  const promoFor = (productId: string, qty: number) => {
    const today = new Date().toISOString().slice(0, 10);
    return promos.find(p =>
      p.productId === productId &&
      p.startDate <= today &&
      p.endDate >= today &&
      p.minQuantity <= qty
    );
  };

  const promoPrice = (product: Product, qty = 1) => {
    const p = promoFor(product.id, qty);
    if (!p) return null;
    if (p.discountType === 'percent') {
      return Math.round(product.price * (1 - p.discountValue / 100) * 100) / 100;
    }
    return Math.max(0, Math.round((product.price - p.discountValue) * 100) / 100);
  };

  const addToCart = (product: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        const quantity = existing.quantity + qty;
        const pp = promoPrice(product, quantity);
        const unitPrice = pp ?? product.price;
        const next = prev.map(c =>
          c.product.id === product.id
            ? { ...c, quantity, unitPrice, total: unitPrice * quantity }
            : c
        );
        setSelectedIdx(next.findIndex(c => c.product.id === product.id));
        return next;
      }
      const pp = promoPrice(product, qty);
      const unitPrice = pp ?? product.price;
      const next = [...prev, {
        product,
        quantity: qty,
        unitPrice,
        originalPrice: product.price,
        discount: 0,
        total: unitPrice * qty,
      }];
      setSelectedIdx(next.length - 1);
      return next;
    });
    setSearch('');
    setError('');
  };

  const addValidated = (p: Product): boolean => {
    if (p.active === 0 || p.active === false) {
      playErrorBeep();
      setError(`Produto inativo: ${p.name}`);
      return false;
    }
    const inCart = cart.find(c => c.product.id === p.id)?.quantity ?? 0;
    const available = (Number(p.stock) || 0) - inCart;
    if (available <= 0 && !p.allowNegative) {
      playErrorBeep();
      setError(`Estoque esgotado: ${p.name} (disponível: ${Number(p.stock) || 0})`);
      return false;
    }
    playBarcodeBeep();
    addToCart(p);
    return true;
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => {
        const next = prev.filter(c => c.product.id !== productId);
        setSelectedIdx(next.length ? Math.min(selectedIdx ?? 0, next.length - 1) : null);
        return next;
      });
      return;
    }
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const pp = promoPrice(c.product, qty);
      const unitPrice = pp ?? c.product.price;
      return { ...c, quantity: qty, unitPrice, total: unitPrice * qty };
    }));
  };

  const removeSelected = () => {
    if (selectedIdx === null || !cart[selectedIdx]) {
      if (cart.length) removeItemAt(cart.length - 1);
      return;
    }
    removeItemAt(selectedIdx);
  };

  const removeItemAt = (idx: number) => {
    setCart(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setSelectedIdx(next.length ? Math.min(idx, next.length - 1) : null);
      return next;
    });
  };

  const resetPayment = () => {
    setPaymentMethod('dinheiro');
    setCashReceived(0);
    setPayments([]);
    setDiscount(0);
    setDiscountType('valor');
    setDiscountInput('');
    setInstallments(1);
  };

  const clearCart = () => {
    setCart([]);
    setCustomerId('cons-final');
    setError('');
    setSelectedIdx(null);
    setPaymentMode(false);
    resetPayment();
    setInternalCode('');
    setBarcode('');
    setSearch('');
  };

  const handleBarcode = async (bc: string) => {
    const code = bc.trim();
    if (!code) return;
    try {
      const p = await api.products.findByBarcode(code);
      if (p) {
        addValidated(p);
        setBarcode('');
        return;
      }
      const byCode = products.find(pr => fold(pr.code) === fold(code) || fold(pr.sku) === fold(code));
      if (byCode) {
        addValidated(byCode);
        setBarcode('');
        setInternalCode('');
        return;
      }
      const matches = await api.products.list(code);
      if (matches.length === 1) {
        addValidated(matches[0]);
        setBarcode('');
        return;
      }
      if (matches.length > 1) {
        setSearch(code);
        setBarcode('');
        setError(`Vários produtos para "${code}" — escolha na lista`);
        return;
      }
      playErrorBeep();
      setError(`Produto não encontrado: ${code}`);
    } catch (err: any) {
      playErrorBeep();
      setError(err.message);
    }
  };

  const defaultReceivedFor = (m: PaymentMethod) => {
    if (m === 'dinheiro') return Math.max(total, 0);
    return Math.max(falta, 0);
  };

  const selectMethod = (m: PaymentMethod) => {
    setPaymentMethod(m);
    setCashReceived(defaultReceivedFor(m));
  };

  const onDiscountChange = (raw: string) => {
    setDiscountInput(raw);
    const v = Math.max(0, parseFloat(raw) || 0);
    if (discountType === 'percent') setDiscount(Math.min(100, v));
    else setDiscount(v);
  };

  const setDiscountMode = (mode: 'valor' | 'percent') => {
    if (mode === discountType) return;
    const current = discount;
    setDiscountType(mode);
    if (mode === 'percent' && subtotal > 0) {
      const pct = Math.round((current / subtotal) * 100 * 100) / 100;
      setDiscount(Math.min(100, pct));
      setDiscountInput(String(Math.min(100, pct)));
    } else if (mode === 'valor' && subtotal > 0) {
      const val = Math.round(subtotal * (current / 100) * 100) / 100;
      setDiscount(val);
      setDiscountInput(String(val));
    }
  };

  const addPayment = () => {
    const amount = paymentMethod === 'dinheiro' ? cashReceived : Math.min(total, Math.max(falta, cashReceived || total));
    if (amount <= 0) {
      setError('Informe o valor recebido');
      return;
    }
    if (paymentMethod !== 'dinheiro' && amount > falta + 0.001 && payments.length === 0) {
      setError('Valor maior que o saldo da venda');
      return;
    }
    setPayments(prev => [
      ...prev,
      {
        method: paymentMethod,
        amount: Math.round(amount * 100) / 100,
        installments: paymentMethod === 'cartao_credito' ? installments : undefined,
      },
    ]);
    setError('');
    setCashReceived(0);
    setPaymentMethod('dinheiro');
    setCashReceived(Math.max(0, Math.round((falta - amount) * 100) / 100) || total);
  };

  const removePayment = (idx: number) => {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const openPayment = () => {
    if (!cart.length) return;
    if (register?.status !== 'aberto') {
      setError('Abra o caixa para iniciar vendas');
      return;
    }
    setError('');
    setPayments([]);
    setPaymentMethod('dinheiro');
    setInstallments(1);
    setCashReceived(total);
    setPaymentMode(true);
  };

  const closePayment = () => {
    setPaymentMode(false);
    setError('');
    setPayments([]);
  };

  const handleSale = async () => {
    if (!cart.length || busy) return;
    if (register?.status !== 'aberto') {
      setError('Abra o caixa para iniciar vendas');
      return;
    }
    if (paymentMethod === 'fiado' && (!customerId || customerId === 'cons-final')) {
      setError('Selecione um cliente para venda fiado');
      return;
    }
    const payMethod =
      payments.length === 1
        ? payments[0].method
        : payments.length > 1
          ? (payments.reduce((a, b) => (b.amount > a.amount ? b : a)).method)
          : paymentMethod;

    if (payMethod === 'fiado' && (!customerId || customerId === 'cons-final')) {
      setError('Selecione um cliente para venda fiado');
      return;
    }
    if (payments.length === 0 && payMethod === 'dinheiro' && cashReceived + 0.001 < total) {
      setError('Valor recebido menor que o total');
      return;
    }
    if (payments.length > 0 && falta > 0.001) {
      setError(`Falta receber R$ ${brl(falta)}`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const customer = customers.find(c => c.id === customerId);
      const created = await api.sales.create({
        items: cart.map(c => ({
          productId: c.product.id,
          quantity: c.quantity,
        })),
        discount: discountAmount,
        paymentMethod: payMethod,
        customerId: customerId === 'cons-final' ? null : customerId,
        customerName: customer?.name || 'Consumidor Final',
        customerCpf: customer?.cpf || null,
      });
      let sale: Sale | null = null;
      try {
        sale = await api.sales.get(created.id);
      } catch {
        sale = {
          id: created.id,
          code: created.code,
          timestamp: new Date().toISOString(),
          terminal: 'PDV-01',
          operator: user?.name || '',
          subtotal,
          discount: discountAmount,
          total: created.total,
          paymentMethod: payMethod,
          customerId: customerId === 'cons-final' ? undefined : customerId,
          customerName: customer?.name || 'Consumidor Final',
          customerCpf: customer?.cpf || undefined,
          status: 'concluida',
        };
      }
      setLastSale(sale);
      setLastPayments(payments);
      setLastPixPayload(payMethod === 'pix' ? pixPayloadStr : '');
      setReceiptOpen(true);
      playSuccessChime();
      clearCart();
      loadProducts();
      onRegisterChange?.();
    } catch (err: any) {
      playErrorBeep();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onKeyGlobal = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if (e.key === 'Escape') {
      if (scannerOpen) return;
      if (receiptOpen) {
        e.preventDefault();
        setReceiptOpen(false);
        setLastSale(null);
        return;
      }
      if (quickCustomerOpen) {
        e.preventDefault();
        setQuickCustomerOpen(false);
        return;
      }
      if (priceConsultOpen) {
        e.preventDefault();
        setPriceConsultOpen(false);
        return;
      }
      if (paymentMode) {
        e.preventDefault();
        closePayment();
      }
      return;
    }

    if (receiptOpen || quickCustomerOpen) return;

    if (priceConsultOpen) {
      if (e.key === 'F6') {
        e.preventDefault();
        setPriceConsultOpen(false);
      }
      return;
    }

    if (paymentMode) {
      if (inField) return;
      const k = e.key.toLowerCase();
      if (k === 'f2') {
        e.preventDefault();
        closePayment();
        return;
      }
      if (k === 'f7') {
        e.preventDefault();
        setQuickCustomerOpen(true);
        return;
      }
      const hit = PAY_METHODS.find(m => m.hotkey.toLowerCase() === k);
      if (hit && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        selectMethod(hit.key);
        return;
      }
      if (k === 'enter' && e.ctrlKey) {
        e.preventDefault();
        if (!busy && cart.length && register?.status === 'aberto' && isPaid) handleSale();
        return;
      }
      if (k === 'enter' && !e.ctrlKey) {
        e.preventDefault();
        addPayment();
        return;
      }
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      codeRef.current?.focus();
      codeRef.current?.select();
    } else if (e.key === 'F3') {
      e.preventDefault();
      removeSelected();
    } else if (e.key === 'F5') {
      e.preventDefault();
      clearCart();
    } else if (e.key === 'F6') {
      e.preventDefault();
      setPriceConsultOpen(true);
    } else if (e.key === 'F7') {
      e.preventDefault();
      setQuickCustomerOpen(true);
    } else if (e.key === 'F9') {
      e.preventDefault();
      customerRef.current?.focus();
    } else if (e.key === 'F8') {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    } else if (e.key === 'F10') {
      e.preventDefault();
      openPayment();
    } else if (e.key === 'F12') {
      e.preventDefault();
      if (cart.length) openPayment();
    } else if (e.key === 'F4') {
      e.preventDefault();
      if (selectedItem) {
        const el = document.querySelector<HTMLInputElement>('[data-qty-active="1"]');
        el?.focus();
        el?.select();
      }
    } else if (!inField && (e.key === 'F2' || e.key === 'F8')) {
      barcodeRef.current?.focus();
    }
  }, [cart, paymentMode, selectedIdx, scannerOpen, total, register, paymentMethod, cashReceived, falta, payments, busy, isPaid, priceConsultOpen, quickCustomerOpen, receiptOpen]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyGlobal);
    return () => window.removeEventListener('keydown', onKeyGlobal);
  }, [onKeyGlobal]);

  const customerLabel =
    selectedCustomer && selectedCustomer.id !== 'cons-final'
      ? selectedCustomer.name
      : customerId === 'cons-final'
        ? 'Consumidor final'
        : 'Selecione o cliente';

  const productsPanel = (
    <section className="pdv-card pdv-products">
      <header className="pdv-card-head">
        <h3>Produtos ({cart.length} {cart.length === 1 ? 'item' : 'itens'})</h3>
        <div className="pdv-card-head-actions">
          <button type="button" className="pdv-chip" onClick={() => setScannerOpen(true)} title="Scanner">
            📷 Scanner
          </button>
          <button
            type="button"
            className="pdv-chip danger"
            onClick={removeSelected}
            disabled={!cart.length}
            title="Excluir item (F3)"
          >
            Excluir
          </button>
          <button
            type="button"
            className="pdv-chip"
            onClick={clearCart}
            disabled={!cart.length}
            title="Nova venda (F5)"
          >
            Nova venda
          </button>
        </div>
      </header>

      <div className="pdv-table-wrap">
        {cart.length === 0 ? (
          <div className="pdv-empty">
            <p>Nenhum item na venda</p>
            <p className="pdv-empty-hint">Escaneie o código de barras ou busque um produto (F8)</p>
          </div>
        ) : (
          <table className="pdv-table modern">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Qtd</th>
                <th className="num">Unitário</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, idx) => (
                <tr
                  key={item.product.id}
                  className={selectedIdx === idx ? 'selected' : ''}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <td className="product-cell">
                    <span className="product-name">{item.product.name}</span>
                    <span className="product-meta">{item.product.barcode || item.product.sku || item.product.code}</span>
                  </td>
                  <td className="num">
                    <input
                      data-qty-active={selectedIdx === idx ? '1' : '0'}
                      className="pdv-qty-input"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateQty(item.product.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </td>
                  <td className="num">R$ {brl(item.unitPrice)}</td>
                  <td className="num strong">R$ {brl(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="pdv-totals modern">
        <div className="pdv-total-row">
          <span className="pdv-total-label">Subtotal</span>
          <span className="pdv-total-value">R$ {brl(subtotal)}</span>
        </div>
        <div className="pdv-total-row">
          <span className="pdv-total-label">Desconto</span>
          <span className="pdv-total-value">R$ {brl(discountAmount)}</span>
        </div>
        <div className="pdv-total-row grand">
          <span className="pdv-total-label">Total a pagar</span>
          <span className="pdv-total-value">R$ {brl(total)}</span>
        </div>
      </footer>
    </section>
  );

  if (paymentMode) {
    const hotkeyHint = (m: string) => PAY_METHODS.find(x => x.key === m)?.hotkey;

    return (
      <div className="pdv pdv-checkout">
        <div className="pdv-checkout-bar">
          <h2 className="pdv-checkout-title">Finalizar venda</h2>
          <div className="pdv-checkout-actions">
            <button
              type="button"
              className="pdv-chip customer"
              onClick={() => setPaymentMode(false)}
              title="Trocar cliente (F2)"
            >
              👤 {customerLabel} <kbd>F2</kbd>
            </button>
            <button
              type="button"
              className="pdv-chip cancel"
              onClick={closePayment}
              disabled={busy}
            >
              Cancelar venda <kbd>Esc</kbd>
            </button>
          </div>
        </div>

        {error && <div className="pdv-error">{error}</div>}

        <div className="pdv-checkout-grid">
          {productsPanel}

          <section className="pdv-card pdv-pay-card">
            <div className="pdv-total-hero">
              <span className="pdv-total-hero-label">Total a pagar</span>
              <span className="pdv-total-hero-value">R$ {brl(total)}</span>
            </div>

            <div className="pdv-field">
              <div className="pdv-field-label-row">
                <span className="pdv-field-label">Desconto</span>
                <div className="pdv-toggle" role="group" aria-label="Tipo de desconto">
                  <button
                    type="button"
                    className={discountType === 'valor' ? 'on' : ''}
                    onClick={() => setDiscountMode('valor')}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    className={discountType === 'percent' ? 'on' : ''}
                    onClick={() => setDiscountMode('percent')}
                  >
                    %
                  </button>
                </div>
              </div>
              <div className="pdv-field-inline">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountInput}
                  placeholder="0,00"
                  onChange={e => onDiscountChange(e.target.value)}
                />
                <span className="pdv-field-suffix">{discountType === 'percent' ? '%' : 'R$'}</span>
              </div>
            </div>

            <div className="pdv-field">
              <span className="pdv-field-label">Como o cliente vai pagar?</span>
              <div className="pdv-method-grid">
                {PAY_METHODS.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    className={`pdv-method${paymentMethod === m.key ? ' on' : ''}`}
                    onClick={() => selectMethod(m.key)}
                  >
                    <span className="pdv-method-icon">{m.icon}</span>
                    <span className="pdv-method-name">{PAYMENT_LABELS[m.key]}</span>
                    <kbd>{m.hotkey}</kbd>
                  </button>
                ))}
              </div>
              {paymentMethod === 'fiado' && (
                <p className="pdv-hint danger">
                  Será lançado no crédito do cliente
                  {selectedCustomer && selectedCustomer.id !== 'cons-final' && (
                    <> · disponível R$ {brl(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.currentDebt))}</>
                  )}
                </p>
              )}
            </div>

            {paymentMethod === 'pix' && (
              <div className="pdv-field pdv-pix-panel">
                <span className="pdv-field-label">PIX copia e cola · valor vinculado</span>
                <div className="pdv-pix-qr">
                  {pixQrUrl ? (
                    <img src={pixQrUrl} alt="QR Code PIX" />
                  ) : (
                    <span className="pdv-pix-loading">Gerando QR Code...</span>
                  )}
                </div>
                <div className="pdv-pix-info">
                  <div>
                    <span>Beneficiário</span>
                    <strong>
                      {settings?.pixBeneficiaryName || settings?.tradeName || settings?.name || '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Chave PIX</span>
                    <strong className="mono">{settings?.pixKey || settings?.cnpj || '—'}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  disabled={!pixPayloadStr}
                  onClick={() => {
                    navigator.clipboard?.writeText(pixPayloadStr);
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 2500);
                  }}
                >
                  {pixCopied ? 'Código copiado!' : 'Copiar código copia e cola'}
                </button>
                <p className="pdv-hint center">Aponte a câmera do app do banco para o QR Code</p>
              </div>
            )}

            {paymentMethod === 'cartao_credito' && (
              <div className="pdv-field">
                <span className="pdv-field-label">Número de parcelas</span>
                <select
                  className="select"
                  value={installments}
                  onChange={e => setInstallments(parseInt(e.target.value, 10) || 1)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>
                      {n}x de R$ {brl(total / n)} {n === 1 ? '(à vista)' : '(sem juros)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pdv-field">
              <span className="pdv-field-label">
                Valor recebido em <strong>{PAYMENT_LABELS[paymentMethod]}</strong>
              </span>
              <div className="pdv-receive-row">
                <input
                  ref={receivedRef}
                  className="input pdv-receive-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashReceived || ''}
                  placeholder="0,00"
                  onChange={e => setCashReceived(Math.max(0, parseFloat(e.target.value) || 0))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.ctrlKey) {
                        if (!busy && cart.length && register?.status === 'aberto' && isPaid) handleSale();
                      } else {
                        addPayment();
                      }
                    }
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={addPayment}>
                  Adicionar
                </button>
              </div>
            </div>

            <div className="pdv-pay-status">
              {payments.length === 0 ? (
                <p className="pdv-hint">Nenhum pagamento adicionado ainda.</p>
              ) : (
                <ul className="pdv-pay-list">
                  {payments.map((p, i) => (
                    <li key={`${p.method}-${i}`}>
                      <span>
                        {PAYMENT_LABELS[p.method]}
                        {p.installments && p.installments > 1 ? ` ${p.installments}x` : ''}
                      </span>
                      <span className="amount">R$ {brl(p.amount)}</span>
                      <button type="button" onClick={() => removePayment(i)} title="Remover">×</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pdv-status-row falta">
                <span>Falta receber</span>
                <strong>R$ {brl(falta)}</strong>
              </div>
              <div className="pdv-status-row troco">
                <span>Troco</span>
                <strong>R$ {brl(troco)}</strong>
              </div>
            </div>

            <div className="pdv-pay-actions">
              <button
                className="btn btn-primary btn-lg w-full"
                disabled={busy || cart.length === 0 || register?.status !== 'aberto' || !isPaid}
                onClick={handleSale}
                title="Confirmar venda (Ctrl+Enter)"
              >
                {busy
                  ? 'Processando...'
                  : isPaid
                    ? `Confirmar — R$ ${brl(total)}`
                    : `Falta R$ ${brl(falta)} para confirmar`}
              </button>
              <button className="btn btn-secondary w-full" onClick={closePayment} disabled={busy}>
                Voltar (Esc)
              </button>
            </div>
          </section>
        </div>

        <div className="pdv-shortcuts compact">
          <div><kbd>D</kbd> Dinheiro</div>
          <div><kbd>P</kbd> PIX</div>
          <div><kbd>X</kbd> Crédito</div>
          <div><kbd>A</kbd> Débito</div>
          <div><kbd>F</kbd> Fiado</div>
          <div><kbd>Enter</kbd> Adicionar</div>
          <div><kbd>Ctrl+Enter</kbd> Confirmar</div>
          <div><kbd>Esc</kbd> Sair</div>
        </div>

        <CameraBarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(bc) => { handleBarcode(bc); }}
        />

        <QuickCustomerModal
          isOpen={quickCustomerOpen}
          onClose={() => setQuickCustomerOpen(false)}
          onCreated={cust => {
            setCustomers(prev => [...prev, cust]);
            setCustomerId(cust.id);
          }}
        />
      </div>
    );
  }

  return (
    <div className="pdv pdv-sale">
      <div className="pdv-sale-bar">
        <div className="pdv-search-wrap">
          <span className="pdv-search-icon">🔍</span>
          <input
            ref={searchRef}
            className="pdv-search"
            value={search}
            placeholder="Buscar produto… ↑↓ escolher · Enter adicionar · (F8)"
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchHi(i => Math.min(i + 1, Math.max(0, visibleProducts.length - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchHi(i => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const chosen = visibleProducts[hiIdx];
                if (chosen) addValidated(chosen);
                else if (search.trim()) handleBarcode(search);
              }
            }}
          />
          {visibleProducts.length > 0 && (
            <ul className="pdv-search-drop">
              {visibleProducts.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={i === hiIdx ? 'hi' : ''}
                    onMouseEnter={() => setSearchHi(i)}
                    onClick={() => addValidated(p)}
                  >
                    <span className="name">{p.name}</span>
                    <span className="meta">{p.barcode || p.sku} · R$ {brl(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pdv-scan-inputs">
          <label className="pdv-mini-field">
            <span>Código</span>
            <input
              ref={codeRef}
              className="input"
              value={internalCode}
              placeholder="F2"
              onChange={e => setInternalCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (internalCode.trim()) handleBarcode(internalCode.trim());
                }
              }}
            />
          </label>
          <label className="pdv-mini-field">
            <span>Código de barras</span>
            <input
              ref={barcodeRef}
              className="input"
              value={barcode}
              placeholder="Enter p/ adicionar"
              onChange={e => setBarcode(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcode(barcode);
                }
              }}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => setScannerOpen(true)}>
            📷
          </button>
        </div>
      </div>

      {error && <div className="pdv-error">{error}</div>}
      {loading && <div className="pdv-loading">Carregando produtos...</div>}

      <div className="pdv-sale-grid">
        {productsPanel}

        <aside className="pdv-card pdv-summary">
          <div className="pdv-total-hero">
            <span className="pdv-total-hero-label">Total a pagar</span>
            <span className="pdv-total-hero-value">R$ {brl(total)}</span>
          </div>

          <dl className="pdv-summary-list">
            <div>
              <dt>Itens</dt>
              <dd>{cart.length}</dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>R$ {brl(subtotal)}</dd>
            </div>
            <div>
              <dt>Desconto</dt>
              <dd>R$ {brl(discountAmount)}</dd>
            </div>
            {selectedItem && (
              <div className="muted">
                <dt>Último item</dt>
                <dd className="truncate">{selectedItem.product.name}</dd>
              </div>
            )}
          </dl>

          <div className="pdv-customer-inline">
            <span className="pdv-field-label">Cliente <kbd>F9</kbd></span>
            <div className="pdv-customer-row">
              <select
                ref={customerRef}
                className="select"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
              >
                <option value="cons-final">Consumidor Final</option>
                {customers.filter(c => c.id !== 'cons-final').map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.currentDebt > 0 ? ` (dívida R$ ${c.currentDebt.toFixed(2)})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="pdv-chip"
                onClick={() => setQuickCustomerOpen(true)}
                title="Cadastro rápido de cliente (F7)"
              >
                + Novo <kbd>F7</kbd>
              </button>
            </div>
          </div>

          <div className="pdv-summary-actions">
            <button
              className="btn btn-primary btn-lg w-full"
              onClick={openPayment}
              disabled={!cart.length || register?.status !== 'aberto'}
              title="Finalizar (F10)"
            >
              Finalizar venda
            </button>
            <p className="pdv-hint center">
              <kbd>F10</kbd> Finalizar · <kbd>F9</kbd> Cliente · <kbd>F7</kbd> Novo · <kbd>F6</kbd> Preço · <kbd>F5</kbd> Nova
            </p>
          </div>

          {register?.status !== 'aberto' && (
            <p className="pdv-closed-note">Abra o caixa para iniciar vendas</p>
          )}
        </aside>
      </div>

      <CameraBarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(bc) => { handleBarcode(bc); }}
      />

      <PriceConsultModal
        isOpen={priceConsultOpen}
        onClose={() => setPriceConsultOpen(false)}
        products={products}
        onAddToCart={p => addValidated(p)}
      />

      <QuickCustomerModal
        isOpen={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        onCreated={cust => {
          setCustomers(prev => [...prev, cust]);
          setCustomerId(cust.id);
        }}
      />

      <ReceiptModal
        isOpen={receiptOpen && !!lastSale}
        onClose={() => {
          setReceiptOpen(false);
          setLastSale(null);
        }}
        sale={lastSale}
        settings={settings}
        payments={lastPayments}
        pixPayload={lastPixPayload}
      />
    </div>
  );
}
