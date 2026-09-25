import { ReactNode } from 'react';
import { ViewTab, User } from '../types';

interface SidebarProps {
  user: User;
  tabs: { id: ViewTab; label: string; icon: string }[];
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onLogout: () => void;
}

export default function Sidebar({ user, tabs, activeTab, onTabChange, onLogout }: SidebarProps) {
  const initials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'gerente' ? 'Gerente' : 'Operador';

  return (
    <aside className="w-16 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-1">
      {/* Logo */}
      <div className="side-logo" title="VendasPRO">🛒</div>

      {/* Navegação */}
      <nav className="flex flex-col items-center gap-1 overflow-y-auto w-full px-2 min-h-0 flex-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg text-lg transition-colors
              ${activeTab === tab.id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }
            `}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </nav>

      {/* Perfil */}
      <div className="w-full px-2 mt-auto pt-2 flex flex-col items-center gap-1">
        <div className={`side-avatar role-${user.role}`} title={`${user.name} · ${roleLabel}`}>
          {initials}
          <span className="side-avatar-status" />
        </div>
        <button
          onClick={onLogout}
          className="side-logout"
          title="Sair da conta"
          aria-label="Sair da conta"
        >
          🚪
        </button>
      </div>
    </aside>
  );
}
