import { useMemo, useState } from 'react';
import { X, Search, Tag, Camera } from 'lucide-react';
import { Product } from '../types';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

const fold = (v: string) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PriceConsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export default function PriceConsultModal({
  isOpen,
  onClose,
  products,
  onAddToCart,
}: PriceConsultModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = fold(searchTerm.trim());
    if (!q) return products.slice(0, 30);
    return products
      .filter(p => fold(p.name).includes(q) || fold(p.barcode || '').includes(q) || fold(p.code || '').includes(q))
      .slice(0, 30);
  }, [products, searchTerm]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay pc-overlay">
        <div className="modal-content pc-box">
          <div className="pc-head">
            <div className="pc-head-title">
              <span className="pc-head-icon">
                <Tag size={18} />
              </span>
              <h2>Consultar preço & estoque</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="pc-body">
            <div className="pc-search">
              <Search size={16} className="pc-search-icon" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Digite o nome ou bipe o código..."
              />
              <button
                type="button"
                className="pc-search-cam"
                onClick={() => setIsCameraScannerOpen(true)}
                title="Escanear código de barras com a câmera"
              >
                <Camera size={16} />
              </button>
            </div>

            <div className="pc-list">
              {filtered.length === 0 && <p className="pc-empty">Nenhum produto encontrado</p>}
              {filtered.map(prod => (
                <div key={prod.id} className="pc-item">
                  <div className="pc-item-info">
                    <p className="pc-item-name">{prod.name}</p>
                    <p className="pc-item-meta">
                      Cód: {prod.barcode || prod.code} · Estoque: {prod.stock} un
                    </p>
                  </div>
                  <div className="pc-item-side">
                    <span className="pc-item-price">R$ {brl(prod.price)}</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onAddToCart(prod);
                        onClose();
                      }}
                    >
                      + Vender
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="pc-hint">
              <kbd>F6</kbd> Consultar preço · <kbd>F8</kbd> Buscar · <kbd>Esc</kbd> Fechar
            </p>
          </div>
        </div>
      </div>

      <CameraBarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={code => setSearchTerm(code)}
        title="Consultar preço com câmera"
        defaultContinuous={false}
      />
    </>
  );
}
