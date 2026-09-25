import { useEffect, useState } from 'react';
import { CompanySettings } from '../../types';

export default function ConfiguracoesView({ settings, onSave }: { settings: CompanySettings | null; onSave: (s: any) => Promise<void> }) {
  const [form, setForm] = useState<any>(settings || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(form);
      alert('Configurações salvas!');
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div className="card">
        <h3 className="font-semibold text-slate-700 mb-2">Dados da Empresa</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Razão Social</label><input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Nome Fantasia</label><input className="input" value={form.tradeName || ''} onChange={e => setForm({ ...form, tradeName: e.target.value })} /></div>
          <div><label className="label">CNPJ</label><input className="input" value={form.cnpj || ''} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></div>
          <div><label className="label">Inscrição Estadual</label><input className="input" value={form.ie || ''} onChange={e => setForm({ ...form, ie: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Endereço</label><input className="input" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="label">Telefone</label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">E-mail</label><input className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-700 mb-2">Dados do PIX</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Chave PIX</label><input className="input" value={form.pixKey || ''} onChange={e => setForm({ ...form, pixKey: e.target.value })} /></div>
          <div>
            <label className="label">Tipo PIX</label>
            <select className="select" value={form.pixKeyType || ''} onChange={e => setForm({ ...form, pixKeyType: e.target.value })}>
              <option value="">Selecione</option>
              <option value="cnpj">CNPJ</option>
              <option value="cpf">CPF</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div><label className="label">Nome Beneficiário PIX</label><input className="input" value={form.pixBeneficiaryName || ''} onChange={e => setForm({ ...form, pixBeneficiaryName: e.target.value })} /></div>
          <div><label className="label">Cidade PIX</label><input className="input" value={form.pixCity || ''} onChange={e => setForm({ ...form, pixCity: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-700 mb-2">Configurações de Venda</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Margem Percentual Padrão (%)</label><input type="number" className="input" value={form.defaultMarginPercent || 40} onChange={e => setForm({ ...form, defaultMarginPercent: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Taxa de Cartão (%)</label><input type="number" className="input" value={form.cardFeePercent || 3} onChange={e => setForm({ ...form, cardFeePercent: parseFloat(e.target.value) || 0 })} /></div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary ml-auto" onClick={handleSave} disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
