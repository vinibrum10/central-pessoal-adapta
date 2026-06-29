import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, ListChecks, Clock,
  Wallet, Settings, Menu, X, Moon, Sun, BookOpen, LogOut,
  ChevronLeft, ChevronRight, Users, Layers, ChevronDown, Languages,
  type LucideIcon,
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

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  aliases?: string[];
};

const gestaoNavItems: NavItem[] = [
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/plano-acao', label: 'Tarefas', icon: ListChecks, aliases: ['/plano'] },
  { to: '/agenda', label: 'Agenda', icon: Clock },
];

const estudoNavItems: NavItem[] = [
  { to: '/estudo/leitura', label: 'Leitura Diária', icon: BookOpen, aliases: ['/leitura'] },
  { to: '/estudo/ingles', label: 'Inglês Diário', icon: Languages },
];

const topNavItems = [
  { to: '/', label: 'Hoje', icon: LayoutDashboard },
];

const mainNavItems = [
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
];

const bottomNavItems = [
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const navItems = [
  ...topNavItems,
  ...gestaoNavItems,
  ...mainNavItems,
  ...estudoNavItems,
  ...bottomNavItems,
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

  const pathMatches = (target: string) =>
    location.pathname === target || location.pathname.startsWith(`${target}/`);

  const isNavItemActive = (item: NavItem) =>
    [item.to, ...(item.aliases ?? [])].some(pathMatches);

  const isGestaoActive = gestaoNavItems.some(isNavItemActive);
  const isEstudoActive = estudoNavItems.some(isNavItemActive);

  const [gestaoOpen, setGestaoOpen] = useState(() =>
    gestaoNavItems.some(isNavItemActive)
  );
  const [estudoOpen, setEstudoOpen] = useState(() =>
    estudoNavItems.some(isNavItemActive)
  );

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  useEffect(() => {
    if (gestaoNavItems.some(isNavItemActive)) {
      setGestaoOpen(true);
    }
    if (estudoNavItems.some(isNavItemActive)) {
      setEstudoOpen(true);
    }
  }, [location.pathname]);

  const currentPage = navItems.find(n =>
    n.to === '/' ? location.pathname === '/' : isNavItemActive(n)
  );

  return (
    <div className="flex h-screen overflow-hidden overflow-x-hidden text-surface-900 dark:text-white">
      {/* === SIDEBAR DESKTOP === */}
      <aside
        className={`hidden lg:flex flex-col border-r border-surface-200/70 bg-white/80 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-950/70 flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-72'}`}
      >
        <div className={`border-b border-surface-200/70 dark:border-white/10 flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between p-5'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg shadow-primary-600/20 flex-shrink-0">
              <AppIcon size={18} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-semibold text-sm text-surface-950 dark:text-white leading-tight tracking-tight">SGP</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Sistema de Gestão Pessoal</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-white/10 dark:text-surface-400 flex-shrink-0 transition-colors"
              title="Recolher menu"
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-surface-200/70 dark:border-white/10">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-white/10 dark:text-surface-400 transition-colors"
              title="Expandir menu"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="px-5 py-4 border-b border-surface-200/70 dark:border-white/10">
            <p className="text-xs text-surface-400 dark:text-surface-500">Bem-vindo,</p>
            <p className="font-semibold text-sm text-surface-950 dark:text-white">{data.configuracoes.nomeUsuario}</p>
            {supabaseAtivo && user && (
              <p className="text-[10px] text-surface-400 dark:text-surface-500 truncate">{user.email}</p>
            )}
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {topNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              title={collapsed ? label : undefined}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 dark:bg-primary-500 dark:text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
                }
              `}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}

          {collapsed ? (
            <button
              onClick={() => { setCollapsed(false); setGestaoOpen(true); }}
              title="Gestão"
              className={`w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isGestaoActive
                  ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
              }`}
            >
              <Layers size={18} className="flex-shrink-0" />
            </button>
          ) : (
            <div>
              <button
                onClick={() => setGestaoOpen(o => !o)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isGestaoActive
                    ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
                }`}
              >
                <Layers size={18} className="flex-shrink-0" />
                <span className="flex-1 text-left">Gestão</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-150 ${gestaoOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {gestaoOpen && (
                <div className="ml-3 mt-1 pl-3 border-l border-surface-200 dark:border-white/10 space-y-1">
                  {gestaoNavItems.map((item) => {
                    const { to, label, icon: Icon } = item;
                    const active = isNavItemActive(item);
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                          transition-all duration-150
                          ${active
                            ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 dark:bg-primary-500 dark:text-white'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
                          }
                        `}
                      >
                        <Icon size={16} className="flex-shrink-0" />
                        {label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mainNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 dark:bg-primary-500 dark:text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
                }
              `}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}

          {collapsed ? (
            <button
              onClick={() => { setCollapsed(false); setEstudoOpen(true); }}
              title="Estudo"
              className={`w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isEstudoActive
                  ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
              }`}
            >
              <BookOpen size={18} className="flex-shrink-0" />
            </button>
          ) : (
            <div>
              <button
                onClick={() => setEstudoOpen(o => !o)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isEstudoActive
                    ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
                }`}
              >
                <BookOpen size={18} className="flex-shrink-0" />
                <span className="flex-1 text-left">Estudo</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-150 ${estudoOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {estudoOpen && (
                <div className="ml-3 mt-1 pl-3 border-l border-surface-200 dark:border-white/10 space-y-1">
                  {estudoNavItems.map((item) => {
                    const { to, label, icon: Icon } = item;
                    const active = isNavItemActive(item);
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                          transition-all duration-150
                          ${active
                            ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 dark:bg-primary-500 dark:text-white'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
                          }
                        `}
                      >
                        <Icon size={16} className="flex-shrink-0" />
                        {label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {bottomNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 dark:bg-primary-500 dark:text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
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
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 dark:bg-primary-500 dark:text-white'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 hover:text-surface-950 dark:hover:text-white'
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

        <div className="p-3 border-t border-surface-200/70 dark:border-white/10 space-y-1">
          <button
            onClick={toggleTema}
            title={collapsed ? (tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro') : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100/80 dark:hover:bg-white/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && (tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro')}
          </button>
          {supabaseAtivo && user && (
            <button
              onClick={signOut}
              title={collapsed ? 'Sair' : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-danger-500 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
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
          <div className="absolute inset-0 bg-surface-950/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex h-full w-80 max-w-[86vw] animate-slide-up flex-col border-r border-surface-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-950">
            <div className="p-5 border-b border-surface-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                  <AppIcon size={18} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-surface-950 dark:text-white tracking-tight">SGP</p>
                  <p className="text-xs text-surface-400">Sistema de Gestão Pessoal</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10">
                <X size={18} className="text-surface-500" />
              </button>
            </div>
            {supabaseAtivo && user && (
              <div className="px-5 py-4 border-b border-surface-200 dark:border-white/10">
                <p className="text-xs text-surface-400">Logado como</p>
                <p className="text-sm font-medium text-surface-800 dark:text-white truncate">{user.email}</p>
              </div>
            )}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {topNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'}
                  `}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}

              <div>
                <button
                  onClick={() => setGestaoOpen(o => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isGestaoActive
                      ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'
                  }`}
                >
                  <Layers size={18} />
                  <span className="flex-1 text-left">Gestão</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-150 ${gestaoOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {gestaoOpen && (
                  <div className="ml-3 mt-1 pl-3 border-l border-surface-200 dark:border-white/10 space-y-1">
                    {gestaoNavItems.map((item) => {
                      const { to, label, icon: Icon } = item;
                      const active = isNavItemActive(item);
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={() => setSidebarOpen(false)}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                            ${active ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'}
                          `}
                        >
                          <Icon size={16} />
                          {label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>

              {mainNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'}
                  `}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}

              <div>
                <button
                  onClick={() => setEstudoOpen(o => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isEstudoActive
                      ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'
                  }`}
                >
                  <BookOpen size={18} />
                  <span className="flex-1 text-left">Estudo</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-150 ${estudoOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {estudoOpen && (
                  <div className="ml-3 mt-1 pl-3 border-l border-surface-200 dark:border-white/10 space-y-1">
                    {estudoNavItems.map((item) => {
                      const { to, label, icon: Icon } = item;
                      const active = isNavItemActive(item);
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={() => setSidebarOpen(false)}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                            ${active ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'}
                          `}
                        >
                          <Icon size={16} />
                          {label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>

              {bottomNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'}
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
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${isActive ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10'}
                      `}
                    >
                      <Icon size={18} />
                      {label}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>
            <div className="p-4 border-t border-surface-200 dark:border-white/10 space-y-1">
              <button onClick={toggleTema} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/10 transition-colors">
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
                {tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
              {supabaseAtivo && user && (
                <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors">
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
        <header className="lg:hidden relative z-40 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-white/95 backdrop-blur-xl dark:bg-surface-950/95 border-b border-surface-200/70 dark:border-white/10 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-white/10" aria-label="Abrir menu">
            <Menu size={20} className="text-surface-600 dark:text-surface-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <AppIcon size={14} />
            </div>
            <span className="font-semibold text-sm text-surface-950 dark:text-white tracking-tight">SGP</span>
          </div>
          <button onClick={toggleTema} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-white/10" aria-label={tema === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro'}>
            {tema === 'escuro' ? <Sun size={18} className="text-surface-500" /> : <Moon size={18} className="text-surface-500" />}
          </button>
        </header>

        <div className="hidden lg:flex items-center justify-between gap-4 px-8 py-4 border-b border-surface-200/70 dark:border-white/10 bg-white/55 dark:bg-surface-950/35 backdrop-blur-xl flex-shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Área atual</p>
            <h1 className="text-sm font-semibold text-surface-950 dark:text-white">{currentPage?.label ?? 'SGP'}</h1>
          </div>
          <div className="hidden xl:flex items-center rounded-lg border border-surface-200 bg-white/70 px-3 py-2 text-xs text-surface-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-surface-400">
            SGP · Sistema de Gestão Pessoal
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <MigrationBanner />
          <div className="app-container">
            {children}
          </div>
        </main>

        <nav className="lg:hidden relative z-30 flex bg-white/95 dark:bg-surface-950/95 backdrop-blur-xl border-t border-surface-200/70 dark:border-white/10 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => {
              setGestaoOpen(true);
              setSidebarOpen(true);
            }}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${isGestaoActive ? 'text-primary-600' : 'text-surface-400'}`}
          >
            <Layers size={18} />
            <span className="text-[9px] font-medium leading-tight text-center">Gestão</span>
          </button>
          {mainNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center py-2 gap-0.5
                ${isActive ? 'text-primary-600' : 'text-surface-400'}
              `}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium leading-tight text-center">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => {
              setEstudoOpen(true);
              setSidebarOpen(true);
            }}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${isEstudoActive ? 'text-primary-600' : 'text-surface-400'}`}
          >
            <BookOpen size={18} />
            <span className="text-[9px] font-medium leading-tight text-center">Estudo</span>
          </button>
          {bottomNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
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
