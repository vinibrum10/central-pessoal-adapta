import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, ListChecks, Clock,
  Wallet, Settings, Menu, X, Moon, Sun, Zap
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../hooks/useApp';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/plano', label: 'Plano de Ação', icon: ListChecks },
  { to: '/agenda', label: 'Agenda e Tempo', icon: Clock },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data, tema, toggleTema } = useApp();
  const location = useLocation();

  const currentPage = navItems.find(n =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  );

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-900 overflow-hidden">
      {/* === SIDEBAR DESKTOP === */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-surface-900 dark:text-white leading-tight">ADAPTA</p>
              <p className="text-xs text-surface-400 dark:text-surface-500">Central Pessoal</p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
          <p className="text-xs text-surface-400 dark:text-surface-500">Bem-vindo,</p>
          <p className="font-semibold text-sm text-surface-900 dark:text-white">{data.configuracoes.nomeUsuario}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-white'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="p-4 border-t border-surface-200 dark:border-surface-700">
          <button
            onClick={toggleTema}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
            {tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro'}
          </button>
        </div>
      </aside>

      {/* === SIDEBAR MOBILE (overlay) === */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-white dark:bg-surface-800 h-full flex flex-col shadow-2xl animate-slide-up">
            <div className="p-5 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
                  <Zap size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-surface-900 dark:text-white">ADAPTA</p>
                  <p className="text-xs text-surface-400">Central Pessoal</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
                <X size={18} className="text-surface-500" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive ? 'bg-primary-600 text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}
                  `}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-surface-200 dark:border-surface-700">
              <button onClick={toggleTema} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
                {tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <Menu size={20} className="text-surface-600 dark:text-surface-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm text-surface-900 dark:text-white">ADAPTA</span>
          </div>
          <button onClick={toggleTema} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            {tema === 'escuro' ? <Sun size={18} className="text-surface-500" /> : <Moon size={18} className="text-surface-500" />}
          </button>
        </header>

        {/* Page title bar (desktop) */}
        <div className="hidden lg:flex items-center px-6 py-4 border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 flex-shrink-0">
          <h1 className="font-semibold text-surface-900 dark:text-white">{currentPage?.label ?? 'Central Pessoal ADAPTA'}</h1>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Bottom nav mobile — todos os 6 itens */}
        <nav className="lg:hidden flex bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 flex-shrink-0">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center py-2 gap-0.5
                ${isActive ? 'text-primary-600' : 'text-surface-400'}
              `}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium leading-tight text-center">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
