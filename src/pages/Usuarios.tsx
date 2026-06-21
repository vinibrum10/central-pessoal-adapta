import { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Shield, Clock, RefreshCw, UserPlus, Key, CalendarCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import type { RoleUsuario, StatusUsuario } from '../types';
import type { UserPermission, Modulo, Acao } from '../utils/permissions';
import {
  MODULOS_ROTULOS,
  ACOES_POR_MODULO,
  ACOES_ROTULOS,
  MODELO_LANCAR_DESPESAS,
  MODELO_SOMENTE_VISUALIZACAO,
  MODELO_EDITOR_COMPLETO,
} from '../utils/permissions';

interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  status: StatusUsuario;
  created_at: string;
  ultimo_acesso?: string | null;
}

const STATUS_COLOR: Record<StatusUsuario, string> = {
  aprovado: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  pendente: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  bloqueado: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
};

const STATUS_LABEL: Record<StatusUsuario, string> = {
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  bloqueado: 'Bloqueado',
};

function formatarUltimoAcesso(ts: string | null | undefined): string {
  if (!ts) return 'Nunca acessou';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return 'Agora há pouco';
  if (min < 60) return `Há ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Há ${h} hora${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ontem';
  if (d < 7) return `Há ${d} dias`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

function isHoje(ts: string | null | undefined): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const hoje = new Date();
  return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
}

export function UsuariosPage() {
  const { role, user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  // Modal de permissões
  const [modalPermissoes, setModalPermissoes] = useState<UsuarioLista | null>(null);
  const [permsEdit, setPermsEdit] = useState<UserPermission[]>([]);
  const [salvandoPerms, setSalvandoPerms] = useState(false);

  const carregar = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCarregando(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, role, status, created_at, ultimo_acesso')
      .order('created_at', { ascending: true });
    setUsuarios((data ?? []) as UsuarioLista[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const atualizar = async (id: string, campos: Partial<Pick<UsuarioLista, 'role' | 'status'>>) => {
    setSalvando(id);
    setMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setMsg('Erro ao salvar: ' + error.message);
    } else {
      setMsg('Salvo!');
      await carregar();
      setTimeout(() => setMsg(''), 2000);
    }
    setSalvando(null);
  };

  const abrirPermissoes = async (usuario: UsuarioLista) => {
    const { data } = await supabase
      .from('user_permissions')
      .select('modulo, acao, permitido')
      .eq('user_id', usuario.id);
    setPermsEdit((data ?? []) as UserPermission[]);
    setModalPermissoes(usuario);
  };

  const togglePerm = (modulo: Modulo, acao: Acao) => {
    setPermsEdit(prev => {
      const idx = prev.findIndex(p => p.modulo === modulo && p.acao === acao);
      if (idx >= 0) {
        return prev.map((p, i) => i === idx ? { ...p, permitido: !p.permitido } : p);
      }
      return [...prev, { modulo, acao, permitido: true }];
    });
  };

  const aplicarModelo = (modelo: UserPermission[]) => {
    setPermsEdit(modelo);
  };

  const isPermitido = (modulo: Modulo, acao: Acao): boolean => {
    const p = permsEdit.find(x => x.modulo === modulo && x.acao === acao);
    return p?.permitido ?? false;
  };

  const salvarPermissoes = async () => {
    if (!modalPermissoes) return;
    setSalvandoPerms(true);
    const rows = permsEdit.map(p => ({
      user_id: modalPermissoes.id,
      modulo: p.modulo,
      acao: p.acao,
      permitido: p.permitido,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('user_permissions')
      .upsert(rows, { onConflict: 'user_id,modulo,acao' });
    setSalvandoPerms(false);
    if (error) {
      setMsg('Erro ao salvar permissões: ' + error.message);
    } else {
      setMsg('Permissões salvas!');
      setTimeout(() => setMsg(''), 2000);
    }
    setModalPermissoes(null);
  };

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-surface-500 dark:text-surface-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const pendentes = usuarios.filter(u => u.status === 'pendente');
  const aprovados = usuarios.filter(u => u.status === 'aprovado');
  const bloqueados = usuarios.filter(u => u.status === 'bloqueado');
  const comAcessoHoje = usuarios.filter(u => isHoje(u.ultimo_acesso));

  const modulosOrdem = Object.keys(ACOES_POR_MODULO) as Modulo[];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Users size={20} /> Usuários
          </h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Gerencie quem tem acesso ao sistema.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={carregar} loading={carregando}>
          Atualizar
        </Button>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.startsWith('Erro') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
          {msg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', value: pendentes.length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', icon: <Clock size={16} /> },
          { label: 'Aprovados', value: aprovados.length, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', icon: <CheckCircle size={16} /> },
          { label: 'Bloqueados', value: bloqueados.length, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', icon: <XCircle size={16} /> },
          { label: 'Acesso hoje', value: comAcessoHoje.length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', icon: <CalendarCheck size={16} /> },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <div className={`flex items-center justify-center gap-1 ${color} mb-1`}>{icon}</div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Pendentes em destaque */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <UserPlus size={15} /> {pendentes.length} usuário(s) aguardando aprovação
          </p>
          {pendentes.map(u => (
            <div key={u.id} className="bg-white dark:bg-surface-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between border border-amber-100 dark:border-amber-800/30">
              <div className="min-w-0">
                <p className="font-medium text-surface-900 dark:text-white text-sm truncate">{u.nome || '(sem nome)'}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{u.email}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  icon={<CheckCircle size={13} />}
                  loading={salvando === u.id}
                  onClick={() => atualizar(u.id, { status: 'aprovado', role: 'editor' })}
                >
                  Aprovar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle size={13} />}
                  loading={salvando === u.id}
                  onClick={() => atualizar(u.id, { status: 'bloqueado' })}
                >
                  Bloquear
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabela completa */}
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
          <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">Todos os usuários ({usuarios.length})</p>
        </div>

        {carregando ? (
          <div className="p-8 text-center text-surface-400 text-sm">Carregando...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-surface-400 text-sm">Nenhum usuário cadastrado.</div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {usuarios.map(u => (
              <div key={u.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-surface-900 dark:text-white">{u.nome || '(sem nome)'}</p>
                    {u.id === user?.id && (
                      <span className="text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded-full">você</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{u.email}</p>
                  <p className="text-[11px] text-surface-400 dark:text-surface-500 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> {formatarUltimoAcesso(u.ultimo_acesso)}
                  </p>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[u.status]}`}>
                  {STATUS_LABEL[u.status]}
                </span>

                {/* Controles (só para outros usuários) */}
                {u.id !== user?.id && (
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {/* Role */}
                    <select
                      value={u.role}
                      onChange={e => atualizar(u.id, { role: e.target.value as RoleUsuario })}
                      disabled={salvando === u.id}
                      className="text-xs border border-surface-200 dark:border-surface-600 rounded-lg px-2 py-1.5 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="visualizador">Visualizador</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>

                    {/* Gerenciar permissões */}
                    <button
                      onClick={() => abrirPermissoes(u)}
                      title="Gerenciar permissões"
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Key size={15} />
                    </button>

                    {/* Status rápido */}
                    {u.status !== 'aprovado' && (
                      <button
                        onClick={() => atualizar(u.id, { status: 'aprovado' })}
                        disabled={salvando === u.id}
                        title="Aprovar"
                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {u.status !== 'bloqueado' && (
                      <button
                        onClick={() => atualizar(u.id, { status: 'bloqueado' })}
                        disabled={salvando === u.id}
                        title="Bloquear"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                    {u.status === 'bloqueado' && (
                      <span className="text-xs text-red-500 flex items-center gap-1"><Shield size={12} /> Bloqueado</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isSupabaseConfigured && (
        <p className="text-xs text-surface-400 text-center">Disponível apenas com Supabase configurado.</p>
      )}

      {/* Modal de permissões */}
      {modalPermissoes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header modal */}
            <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                  <Key size={16} /> Permissões — {modalPermissoes.nome || modalPermissoes.email}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  Permissões específicas sobrescrevem as do perfil ({modalPermissoes.role})
                </p>
              </div>
              <button
                onClick={() => setModalPermissoes(null)}
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Modelos rápidos */}
            <div className="px-6 py-3 border-b border-surface-100 dark:border-surface-700 flex gap-2 flex-wrap">
              <span className="text-xs text-surface-500 dark:text-surface-400 self-center">Modelos:</span>
              <button
                onClick={() => aplicarModelo(MODELO_SOMENTE_VISUALIZACAO)}
                className="text-xs px-3 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
              >
                Somente visualização
              </button>
              <button
                onClick={() => aplicarModelo(MODELO_LANCAR_DESPESAS)}
                className="text-xs px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                Lançar despesas
              </button>
              <button
                onClick={() => aplicarModelo(MODELO_EDITOR_COMPLETO)}
                className="text-xs px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                Editor completo
              </button>
              <button
                onClick={() => setPermsEdit([])}
                className="text-xs px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                Limpar tudo
              </button>
            </div>

            {/* Checkboxes por módulo */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {modulosOrdem.map(modulo => {
                const acoes = ACOES_POR_MODULO[modulo];
                return (
                  <div key={modulo} className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3">
                    <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-2">
                      {MODULOS_ROTULOS[modulo]}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {acoes.map(acao => (
                        <label key={acao} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isPermitido(modulo, acao)}
                            onChange={() => togglePerm(modulo, acao)}
                            className="rounded text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-xs text-surface-700 dark:text-surface-300">
                            {ACOES_ROTULOS[acao]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-surface-100 dark:border-surface-700 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setModalPermissoes(null)}>
                Cancelar
              </Button>
              <Button size="sm" loading={salvandoPerms} onClick={salvarPermissoes}>
                Salvar permissões
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
