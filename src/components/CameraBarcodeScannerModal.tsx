import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  Zap,
  ZapOff,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { CameraDevice } from 'html5-qrcode';
import { playScannerBeep } from '../utils/audio';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  defaultContinuous?: boolean;
}

export default function CameraBarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Leitor de Código de Barras',
  defaultContinuous = true,
}: CameraBarcodeScannerModalProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [continuousMode, setContinuousMode] = useState<boolean>(defaultContinuous);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [manualCode, setManualCode] = useState<string>('');
  const [scanStatus, setScanStatus] = useState<string>('');

  const scannerRef = useRef<any>(null);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const continuousModeRef = useRef(continuousMode);
  const isMountedRef = useRef(true);
  const viewportId = useRef(`scanner-vp-${Math.random().toString(36).slice(2, 8)}`).current;

  onScanRef.current = onScan;
  onCloseRef.current = onClose;
  continuousModeRef.current = continuousMode;

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        try {
          scannerRef.current.clear();
        } catch {}
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopScanner().then(() => {
          if (isMountedRef.current) onCloseRef.current();
        });
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [isOpen, stopScanner]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setIsInitializing(true);
      setErrorMessage(null);
      setIsTorchOn(false);
      setHasTorch(false);
      setLastScannedCode(null);
      setScanCount(0);
      setScanStatus('');
      return;
    }

    async function startScanner() {
      setIsInitializing(true);
      setErrorMessage(null);
      setScanStatus('Verificando permissões...');

      if (!window.isSecureContext || !navigator.mediaDevices) {
        setErrorMessage('Câmera indisponível. O dispositivo precisa de HTTPS para acessar a câmera.');
        setIsInitializing(false);
        return;
      }

      try {
        await stopScanner();

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (!isMountedRef.current) return;

        const html5QrCode = new (Html5Qrcode as any)(viewportId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.ITF,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });

        if (!isMountedRef.current) {
          html5QrCode.clear();
          return;
        }
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (vfWidth: number, vfHeight: number) => {
            const minDim = Math.min(vfWidth, vfHeight);
            const w = Math.floor(minDim * 0.85);
            const h = Math.floor(w * 0.4);
            return { width: Math.max(w, 150), height: Math.max(h, 60) };
          },
          aspectRatio: 1.333333,
        };

        const cameraConfig = selectedCameraId || { facingMode: 'environment' };

        setScanStatus('Iniciando câmera...');

        await html5QrCode.start(
          cameraConfig,
          config,
          (decodedText: string) => {
            const trimmed = decodedText.trim();
            if (!trimmed) return;

            const now = Date.now();
            const last = lastScannedTimeRef.current;
            if (last.code === trimmed && now - last.time < 800) return;

            lastScannedTimeRef.current = { code: trimmed, time: now };

            playScannerBeep();
            try {
              navigator.vibrate?.(80);
            } catch {}

            setLastScannedCode(trimmed);
            setScanCount(p => p + 1);
            setScanStatus('Código detectado!');

            onScanRef.current(trimmed);

            if (!continuousModeRef.current) {
              stopScanner().then(() => {
                if (isMountedRef.current) onCloseRef.current();
              });
            }
          },
          () => {}
        );

        if (!isMountedRef.current) {
          await stopScanner();
          return;
        }

        setScanStatus('');

        try {
          const devices = (await (Html5Qrcode as any).getCameras()) as CameraDevice[] | null;
          if (devices && devices.length > 0) {
            setCameras(devices);
          }
        } catch {}

        setIsInitializing(false);

        try {
          const caps = html5QrCode.getRunningTrackCapabilities() as any;
          if (caps && 'torch' in caps) {
            setHasTorch(true);
          }
        } catch {}
      } catch (err: any) {
        if (!isMountedRef.current) return;
        const errStr = String(err?.message || err).toLowerCase();

        if (errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
          setErrorMessage(
            'Permissão para usar a câmera foi negada. Autorize o acesso nas configurações do navegador.'
          );
        } else if (errStr.includes('notfound') || errStr.includes('device') || errStr.includes('no camera')) {
          setErrorMessage('Nenhuma câmera encontrada no dispositivo.');
        } else if (
          errStr.includes('notreadable') ||
          errStr.includes('could not start') ||
          errStr.includes('start')
        ) {
          setErrorMessage('Câmera em uso por outro aplicativo ou indisponível. Feche outros apps que usam câmera.');
        } else {
          setErrorMessage(`Erro na câmera: ${err?.message || 'Erro desconhecido'}`);
        }
        setIsInitializing(false);
      }
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, selectedCameraId, stopScanner]);

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const next = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next }],
      });
      setIsTorchOn(next);
    } catch {}
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;

    const now = Date.now();
    const last = lastScannedTimeRef.current;
    if (last.code === code && now - last.time < 800) return;

    lastScannedTimeRef.current = { code, time: now };
    playScannerBeep();
    setLastScannedCode(code);
    setScanCount(p => p + 1);
    setScanStatus('Código inserido manualmente');
    onScanRef.current(code);
    setManualCode('');

    if (!continuousModeRef.current) {
      onCloseRef.current();
    }
  };

  const handleClose = () => {
    stopScanner();
    onCloseRef.current();
  };

  if (!isOpen) return null;

  return (
    <div className="scanm-overlay">
      <div className="scanm-box">
        <div className="scanm-head">
          <div className="scanm-head-info">
            <span className="scanm-head-icon">
              <Camera size={16} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>Aponte para o código de barras do produto</p>
            </div>
          </div>
          <button type="button" className="scanm-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="scanm-camera">
          <div id={viewportId} className="scanm-viewport" />

          {isInitializing && !errorMessage && (
            <div className="scanm-loading">
              <RefreshCw size={28} className="scanm-spin" />
              <p>Iniciando câmera...</p>
              {scanStatus && <span>{scanStatus}</span>}
            </div>
          )}

          {errorMessage && (
            <div className="scanm-error">
              <span className="scanm-error-icon">
                <AlertCircle size={28} />
              </span>
              <p>{errorMessage}</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMessage(null);
                  setIsInitializing(true);
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isInitializing && !errorMessage && (
            <div className="scanm-viewfinder-wrap">
              <div className="scanm-viewfinder">
                <span className="corner tl" />
                <span className="corner tr" />
                <span className="corner bl" />
                <span className="corner br" />
                <span className="scanm-laser" />
                <span className="scanm-viewfinder-label">Posicione o código no centro</span>
              </div>
            </div>
          )}

          {!isInitializing && !errorMessage && (
            <div className="scanm-top-controls">
              {cameras.length > 1 ? (
                <select
                  value={selectedCameraId}
                  onChange={e => setSelectedCameraId(e.target.value)}
                  className="scanm-camera-select"
                >
                  {cameras.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Câmera ${i + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div />
              )}
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`scanm-torch${isTorchOn ? ' on' : ''}`}
                  title="Lanterna"
                >
                  {isTorchOn ? <Zap size={16} /> : <ZapOff size={16} />}
                </button>
              )}
            </div>
          )}

          {lastScannedCode && (
            <div className="scanm-feedback">
              <CheckCircle2 size={14} />
              <span>{lastScannedCode}</span>
              {continuousMode && scanCount > 1 && <em>{scanCount}x</em>}
            </div>
          )}
        </div>

        <div className="scanm-bottom">
          <div className="scanm-continuous">
            <div className="scanm-continuous-info">
              <Layers size={14} />
              <div>
                <p>Leitura contínua</p>
                <small>Bipar múltiplos produtos em sequência</small>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={continuousMode}
              className={`scanm-switch${continuousMode ? ' on' : ''}`}
              onClick={() => setContinuousMode(v => !v)}
            >
              <span />
            </button>
          </div>

          <form className="scanm-manual" onSubmit={handleManualSubmit}>
            <input
              type="text"
              placeholder="Digite o código manualmente..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!manualCode.trim()}>
              <span>Inserir</span>
              <ArrowRight size={12} />
            </button>
          </form>

          <div className="scanm-actions">
            <span className="scanm-formats">EAN-13 · EAN-8 · Code 128 · UPC · QR</span>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Voltar ao caixa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
