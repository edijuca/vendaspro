import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Customer } from '../types';
import { api } from '../api';

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export default function QuickCustomerModal({ isOpen, onClose, onCreated }: QuickCustomerModalProps) {
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setName('');
    setCpf('');
    setPhone('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do cliente');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { id } = await api.customers.create({
        name: name.trim(),
        cpf: cpf.trim(),
        phone: phone.trim(),
        creditLimit: 0,
        creditStatus: 'liberado',
      });
      const customer: Customer = {
        id,
        name: name.trim(),
        cpf: cpf.trim(),
        phone: phone.trim(),
        creditLimit: 0,
        currentDebt: 0,
        creditStatus: 'liberado',
      };
      reset();
      onCreated(customer);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao cadastrar cliente');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content qcm-box">
        <div className="qcm-head">
          <div className="qcm-head-title">
            <span className="qcm-head-icon">
              <UserPlus size={18} />
            </span>
            <h2>Cadastro rápido de cliente</h2>
          </div>
          <button type="button" className="icon-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form className="qcm-body" onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="label" htmlFor="qcm-name">
              Nome completo *
            </label>
            <input
              id="qcm-name"
              className="input"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-row">
              <label className="label" htmlFor="qcm-cpf">
                CPF
              </label>
              <input
                id="qcm-cpf"
                className="input"
                value={cpf}
                onChange={e => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="form-row">
              <label className="label" htmlFor="qcm-phone">
                Telefone / WhatsApp
              </label>
              <input
                id="qcm-phone"
                className="input"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                inputMode="tel"
              />
            </div>
          </div>

          {error && <p className="qcm-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Salvando...' : 'Salvar e selecionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
