import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, ListChecks, Clock,
  Wallet, Settings, Menu, X, Moon, Sun, BookOpen, LogOut,
  ChevronLeft, ChevronRight, Users,
} from 'lucide-react';

function AppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 24,8.5 24,17.5 16,22 8,17.5 8,8.5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
      <path d="M18 10L14 16H17L14 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';
import { MigrationBanner } from '../components/MigrationBanner';

const SIDEBAR_KEY = 'adapta-sidebar-collapsed';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/plano', label: 'Plano de Ação', icon: ListChecks },
  { to: '/agenda', label: 'Agenda e Tempo', icon: Clock },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
  { to: '/leitura', label: 'Leitura Diária', icon: BookOpen },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const adminNavItems = [
  { to: '/usuarios', label: 'Usuários', icon: Users },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });
  const { data, tema, toggleTema } = useApp();
  const { user, signOut, supabaseAtivo, role } = useAuth();
  const location = useLocation();

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  const currentPage = navItems.find(n =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  );

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-900 overflow-hidden">
      {/* === SIDEBAR DESKTOP === */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Logo */}
        <div className={`border-b border-surface-200 dark:border-surface-700 flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between p-5'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30 flex-shrink-0">
              <AppIcon size={18} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-bold text-sm text-surface-900 dark:text-white leading-tight">SGP</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Gestão Pessoal</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 flex-shrink-0 transition-colors"
              title="Recolher menu"
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed — fica bem visível no centro */}
        {collapsed && (
          <div className="flex justify-center py-2 border-b border-surface-200 dark:border-surface-700">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 transition-colors"
              title="Expandir menu"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-400 dark:text-surface-500">Bem-vindo,</p>
            <p className="font-semibold text-sm text-surface-900 dark:text-white">{data.configuracoes.nomeUsuario}</p>
            {supabaseAtivo && user && (
              <p className="text-[10px] text-surface-400 dark:text-surface-500 truncate">{user.email}</p>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-white'
                }
              `}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
          {role === 'admin' && (
            <>
              {!collapsed && <p className="text-[10px] uppercase tracking-widest text-surface-400 dark:text-surface-600 px-3 pt-3 pb-1">Admin</p>}
              {adminNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-white'
                    }
                  `}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-surface-200 dark:border-surface-700 space-y-0.5">
          <button
            onClick={toggleTema}
            title={collapsed ? (tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro') : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && (tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro')}
          </button>
          {supabaseAtivo && user && (
            <button
              onClick={signOut}
              title={collapsed ? 'Sair' : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-danger-500 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut size={16} />
              {!collapsed && 'Sair'}
            </button>
          )}
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
                  <AppIcon size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-surface-900 dark:text-white">SGP</p>
                  <p className="text-xs text-surface-400">Gestão Pessoal</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
                <X size={18} className="text-surface-500" />
              </button>
            </div>
            {supabaseAtivo && user && (
              <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-400">Logado como</p>
                <p className="text-sm font-medium text-surface-800 dark:text-white truncate">{user.email}</p>
              </div>
            )}
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
              {role === 'admin' && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-surface-400 dark:text-surface-600 px-3 pt-3 pb-1">Admin</p>
                  {adminNavItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
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
                </>
              )}
            </nav>
            <div className="p-4 border-t border-surface-200 dark:border-surface-700 space-y-1">
              <button onClick={toggleTema} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
                {tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
              {supabaseAtivo && user && (
                <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors">
                  <LogOut size={16} />
                  Sair
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <Menu size={20} className="text-surface-600 dark:text-surface-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <AppIcon size={14} />
            </div>
            <span className="font-bold text-sm text-surface-900 dark:text-white">SGP</span>
          </div>
          <button onClick={toggleTema} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            {tema === 'escuro' ? <Sun size={18} className="text-surface-500" /> : <Moon size={18} className="text-surface-500" />}
          </button>
        </header>

        {/* Page title bar (desktop) */}
        <div className="hidden lg:flex items-center px-6 py-4 border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 flex-shrink-0">
          <h1 className="font-semibold text-surface-900 dark:text-white">{currentPage?.label ?? 'Sistema de Gestão Pessoal'}</h1>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <MigrationBanner />
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>

        {/* Bottom nav mobile */}
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
