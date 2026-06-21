import { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Shield, Eye, Clock, RefreshCw, UserPlus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import type { RoleUsuario, StatusUsuario } from '../types';

interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  status: StatusUsuario;
  created_at: string;
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

export function UsuariosPage() {
  const { role, user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCarregando(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, role, status, created_at')
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes', value: pendentes.length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', icon: <Clock size={16} /> },
          { label: 'Aprovados', value: aprovados.length, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', icon: <CheckCircle size={16} /> },
          { label: 'Bloqueados', value: bloqueados.length, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', icon: <XCircle size={16} /> },
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
                  <p className="text-[11px] text-surface-400 dark:text-surface-500 mt-0.5">
                    Cadastrado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[u.status]}`}>
                  {STATUS_LABEL[u.status]}
                </span>

                {/* Controles (só para outros usuários) */}
                {u.id !== user?.id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                    {u.status === 'aprovado' && (
                      <span className="text-xs text-surface-400 flex items-center gap-1"><Eye size={12} /></span>
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
    </div>
  );
}
