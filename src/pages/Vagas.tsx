import { useCallback, useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/Card';
import { CandidaturasList } from '../components/vagas/CandidaturasList';
import { PerfilFixoForm } from '../components/vagas/PerfilFixoForm';
import { RespostasBancoList } from '../components/vagas/RespostasBancoList';
import { candidaturasRepository } from '../services/vagas/candidaturasRepository';
import { perfilFixoRepository } from '../services/vagas/perfilFixoRepository';
import { respostasBancoRepository } from '../services/vagas/respostasBancoRepository';
import type { PerfilFixo, VagaCandidatura, VagaRespostaBanco } from '../types/vagas';

const PERFIL_FIXO_VAZIO: PerfilFixo = {
  escola: '',
  curso: '',
  anoInicio: null,
  anoTermino: null,
  linkedinUrl: '',
  nivelIngles: '',
  autorizadoTrabalharBrasil: false,
  pisoSalarial: null,
};

interface AtualizarRespostaInput {
  resposta?: string;
  sempreUsar?: boolean;
}

export function VagasPage() {
  const { user, supabaseAtivo } = useAuth();
  const [candidaturas, setCandidaturas] = useState<VagaCandidatura[]>([]);
  const [respostas, setRespostas] = useState<VagaRespostaBanco[]>([]);
  const [perfilFixo, setPerfilFixo] = useState<PerfilFixo>(PERFIL_FIXO_VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!supabaseAtivo || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const [listaCandidaturas, listaRespostas, perfil] = await Promise.all([
        candidaturasRepository.listar(user.id),
        respostasBancoRepository.listar(user.id),
        perfilFixoRepository.buscar(user.id),
      ]);
      setCandidaturas(listaCandidaturas);
      setRespostas(listaRespostas);
      setPerfilFixo(perfil);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar dados de Vagas.');
    } finally {
      setLoading(false);
    }
  }, [user, supabaseAtivo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atualizarResposta = useCallback(async (id: string, campos: AtualizarRespostaInput) => {
    const atualizado = await respostasBancoRepository.atualizar(id, campos);
    setRespostas(prev => prev.map(resposta => (resposta.id === id ? atualizado : resposta)));
  }, []);

  const salvarPerfilFixo = useCallback(async (perfil: PerfilFixo) => {
    if (!user) return;
    const salvo = await perfilFixoRepository.salvar(user.id, perfil);
    setPerfilFixo(salvo);
  }, [user]);

  if (!supabaseAtivo) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-surface-500 dark:text-surface-400">
              Conecte o Supabase para usar o módulo Vagas.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-surface-950 dark:text-white">
          <Briefcase size={20} className="text-primary-600 dark:text-primary-300" />
          Vagas
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Candidaturas do agente automático e banco de respostas para perguntas customizadas de formulários.
        </p>
      </div>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-danger-600 dark:text-danger-400">{erro}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Meu Perfil de Candidatura"
          subtitle="Fatos fixos e verificados — o agente checa aqui primeiro antes de perguntar de novo"
        />
        <CardBody>
          {loading ? (
            <p className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">Carregando perfil…</p>
          ) : (
            <PerfilFixoForm perfil={perfilFixo} onSalvar={salvarPerfilFixo} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Candidaturas" subtitle={`${candidaturas.length} vaga(s) registrada(s) pelo agente`} />
        <CardBody>
          <CandidaturasList candidaturas={candidaturas} loading={loading} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Banco de Respostas"
          subtitle="Perguntas customizadas de formulários — revise e aprove para reuso automático"
        />
        <CardBody>
          <RespostasBancoList respostas={respostas} loading={loading} onAtualizar={atualizarResposta} />
        </CardBody>
      </Card>
    </div>
  );
}
