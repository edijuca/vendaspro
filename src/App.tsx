import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';
import { ViewTab, CashRegister, CompanySettings } from './types';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import PDVPage from './components/views/PDVPage';
import DashboardPage from './components/views/DashboardPage';
import ProdutosView from './components/views/ProdutosView';
import EstoqueView from './components/views/EstoqueView';
import VendasView from './components/views/VendasView';
import ClientesView from './components/views/ClientesView';
import CaixaView from './components/views/CaixaView';
import CadastrosView from './components/views/CadastrosView';
import PromocoesView from './components/views/PromocoesView';
import RelatoriosView from './components/views/RelatoriosView';
import ConfiguracoesView from './components/views/ConfiguracoesView';

export default function App() {
  const { user, token, loading, logout, isAdmin } = useAuth();
  const [page, setPage] = useState<ViewTab>('pdv');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [register, setRegister] = useState<CashRegister | null>(null);

  const refreshRegister = () => {
    api.cash.current().then(setRegister).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    api.settings.get().then(setSettings).catch(() => {});
    refreshRegister();
  }, [token, page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner spinner-lg" />
          <span className="text-sm text-slate-500">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <LoginScreen onLogin={() => {}} />;
  }

  const handleLogout = () => {
    logout();
    setPage('pdv');
  };

  const canManage = user.role === 'admin' || user.role === 'gerente';

  const userInitials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'gerente' ? 'Gerente' : 'Operador';
  const rawDate = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const headerDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  const tabs: { id: ViewTab; label: string; icon: string }[] = [
    { id: 'pdv', label: 'PDV', icon: '🛒' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'produtos', label: 'Produtos', icon: '📦' },
    { id: 'estoque', label: 'Estoque', icon: '📋' },
    { id: 'vendas', label: 'Vendas', icon: '💰' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'caixa', label: 'Caixa', icon: '💵' },
    ...(canManage ? [
      { id: 'cadastros' as ViewTab, label: 'Cadastros', icon: '🗂️' },
      { id: 'promocoes' as ViewTab, label: 'Promoções', icon: '🏷️' },
      { id: 'relatorios' as ViewTab, label: 'Relatórios', icon: '📈' },
    ] : []),
    { id: 'configuracoes', label: 'Config.', icon: '⚙️' },
  ];

  const pageTitles: Partial<Record<ViewTab, string>> = {
    pdv: 'Ponto de Venda',
    dashboard: 'Dashboard',
    produtos: 'Produtos',
    estoque: 'Estoque',
    vendas: 'Vendas',
    clientes: 'Clientes',
    caixa: 'Caixa',
    cadastros: 'Cadastros',
    promocoes: 'Promoções',
    relatorios: 'Relatórios',
    configuracoes: 'Configurações',
  };

  const pdv = (
    <PDVPage
      settings={settings}
      register={register}
      onRegisterChange={refreshRegister}
    />
  );

  const pageIcon = tabs.find(t => t.id === page)?.icon || '📄';

  const renderPage = () => {
    switch (page) {
      case 'pdv':
        return pdv;
      case 'dashboard':
        return (
          <DashboardPage
            register={register}
            canManage={canManage}
            onNavigate={setPage}
          />
        );
      case 'produtos':
        return <ProdutosView />;
      case 'estoque':
        return <EstoqueView />;
      case 'vendas':
        return <VendasView />;
      case 'clientes':
        return <ClientesView />;
      case 'caixa':
        return <CaixaView onRegisterChange={refreshRegister} />;
      case 'cadastros':
        return canManage ? <CadastrosView /> : pdv;
      case 'promocoes':
        return canManage ? <PromocoesView /> : pdv;
      case 'relatorios':
        return canManage ? <RelatoriosView /> : pdv;
      case 'configuracoes':
        return (
          <ConfiguracoesView
            settings={settings}
            onSave={async (s) => {
              await api.settings.update(s);
              setSettings(s);
            }}
          />
        );
      default:
        return pdv;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        user={user}
        tabs={tabs}
        activeTab={page}
        onTabChange={setPage}
        onLogout={handleLogout}
      />
      <main className="flex-1 min-w-0 p-4 overflow-auto">
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-header-icon">{pageIcon}</span>
            <div className="min-w-0">
              <h2 className="app-header-title">{pageTitles[page] || page}</h2>
              <p className="app-header-date">{headerDate}</p>
            </div>
          </div>
          <div className="user-chip" title={`${user.name} · ${roleLabel}`}>
            <span className={`user-chip-avatar role-${user.role}`}>{userInitials}</span>
            <span className="user-chip-info">
              <span className="user-chip-name">{user.name}</span>
              <span className="user-chip-role">{roleLabel}{isAdmin ? ' 👑' : ''}</span>
            </span>
          </div>
        </header>
        {renderPage()}
      </main>
    </div>
  );
}
