import { useState, useEffect, useCallback } from 'react';
import {
  Users, CheckCircle, XCircle, Shield, Clock, RefreshCw,
  Eye, DollarSign, Unlock,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import type { RoleUsuario, StatusUsuario, TipoAcesso } from '../types';
import { canManageUsers } from '../utils/permissions';
import { addUserToPrimaryWorkspace } from '../services/appDataRepository';

interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  status: StatusUsuario;
  tipo_acesso: TipoAcesso;
  created_at: string;
  ultimo_acesso?: string | null;
  ultimo_login_provider?: string | null;
}

const STATUS_COLOR: Record<StatusUsuario, string> = {
  ativo: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  bloqueado: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
};

const STATUS_LABEL: Record<StatusUsuario, string> = {
  ativo: 'Ativo',
  bloqueado: 'Bloqueado',
};

const TIPO_ACESSO_COLOR: Record<TipoAcesso, string> = {
  visualizacao: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  financas: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  total: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
};

const TIPO_ACESSO_LABEL: Record<TipoAcesso, string> = {
  visualizacao: 'Visualização',
  financas: 'Finanças',
  total: 'Total',
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

export function UsuariosPage() {
  const { perfil, user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCarregando(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, role, status, tipo_acesso, created_at, ultimo_acesso, ultimo_login_provider')
      .order('created_at', { ascending: true });
    setUsuarios((data ?? []) as UsuarioLista[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const atualizar = async (id: string, campos: Partial<Pick<UsuarioLista, 'role' | 'status' | 'tipo_acesso'>>) => {
    setSalvando(id);
    setMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setMsg('Erro ao salvar: ' + error.message);
    } else {
      try {
        const acessoFinanceiro = campos.tipo_acesso === 'financas' || campos.tipo_acesso === 'total';
        const desbloqueado = campos.status === 'ativo';
        if (user?.id && id !== user.id && (acessoFinanceiro || desbloqueado)) {
          await addUserToPrimaryWorkspace(
            user.id,
            id,
            campos.tipo_acesso === 'total' ? 'admin' : campos.tipo_acesso === 'financas' ? 'editor' : 'viewer',
          );
        }
        setMsg('Salvo! Usuário vinculado ao workspace compartilhado quando aplicável.');
        await carregar();
        setTimeout(() => setMsg(''), 2500);
      } catch (workspaceError) {
        setMsg(`Permissão salva, mas não consegui vincular ao workspace: ${(workspaceError as Error).message}`);
      }
    }
    setSalvando(null);
  };

  if (!canManageUsers(perfil)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-surface-500 dark:text-surface-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const ativos = usuarios.filter(u => u.status === 'ativo');
  const bloqueados = usuarios.filter(u => u.status === 'bloqueado');
  const visualizacao = usuarios.filter(u => u.tipo_acesso === 'visualizacao');
  const financas = usuarios.filter(u => u.tipo_acesso === 'financas');
  const total = usuarios.filter(u => u.tipo_acesso === 'total');

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: usuarios.length, color: 'text-surface-700 dark:text-surface-200', bg: 'bg-surface-100 dark:bg-surface-700/50', icon: <Users size={15} /> },
          { label: 'Ativos', value: ativos.length, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', icon: <CheckCircle size={15} /> },
          { label: 'Bloqueados', value: bloqueados.length, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', icon: <XCircle size={15} /> },
          { label: 'Visualização', value: visualizacao.length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', icon: <Eye size={15} /> },
          { label: 'Finanças', value: financas.length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', icon: <DollarSign size={15} /> },
          { label: 'Total', value: total.length, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', icon: <Shield size={15} /> },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label + value} className={`${bg} rounded-xl p-3 text-center`}>
            <div className={`flex items-center justify-center gap-1 ${color} mb-1`}>{icon}</div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
          </div>
        ))}
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 dark:bg-surface-900/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium">Nome / E-mail</th>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium hidden sm:table-cell">Role</th>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium">Status</th>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium">Tipo Acesso</th>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium hidden md:table-cell">Último acesso</th>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium hidden lg:table-cell">Cadastro</th>
                  <th className="text-left px-4 py-2 text-xs text-surface-500 dark:text-surface-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-surface-900 dark:text-white">
                            {u.nome || '(sem nome)'}
                            {u.id === user?.id && (
                              <span className="ml-1.5 text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded-full">você</span>
                            )}
                          </p>
                          <p className="text-xs text-surface-400 dark:text-surface-500 truncate max-w-[180px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[u.status]}`}>
                        {STATUS_LABEL[u.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_ACESSO_COLOR[u.tipo_acesso ?? 'visualizacao']}`}>
                        {TIPO_ACESSO_LABEL[u.tipo_acesso ?? 'visualizacao']}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-surface-400 dark:text-surface-500 flex items-center gap-1">
                        <Clock size={10} /> {formatarUltimoAcesso(u.ultimo_acesso)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-surface-400 dark:text-surface-500">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== user?.id && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Bloquear/Desbloquear */}
                          {u.status === 'ativo' ? (
                            <button
                              onClick={() => atualizar(u.id, { status: 'bloqueado' })}
                              disabled={salvando === u.id}
                              title="Bloquear"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => atualizar(u.id, { status: 'ativo' })}
                              disabled={salvando === u.id}
                              title="Desbloquear"
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                            >
                              <Unlock size={15} />
                            </button>
                          )}

                          {/* Tipo de acesso */}
                          <button
                            onClick={() => atualizar(u.id, { tipo_acesso: 'visualizacao' })}
                            disabled={salvando === u.id || u.tipo_acesso === 'visualizacao'}
                            title="Definir Visualização"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-30"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => atualizar(u.id, { tipo_acesso: 'financas' })}
                            disabled={salvando === u.id || u.tipo_acesso === 'financas'}
                            title="Definir Finanças"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-30"
                          >
                            <DollarSign size={15} />
                          </button>
                          <button
                            onClick={() => atualizar(u.id, { tipo_acesso: 'total' })}
                            disabled={salvando === u.id || u.tipo_acesso === 'total'}
                            title="Definir Total"
                            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-30"
                          >
                            <Shield size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isSupabaseConfigured && (
        <p className="text-xs text-surface-400 text-center">Disponível apenas com Supabase configurado.</p>
      )}
    </div>
  );
}
