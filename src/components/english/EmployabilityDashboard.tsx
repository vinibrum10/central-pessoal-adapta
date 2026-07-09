import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Award, BookOpen, Edit3, Loader2, MessageSquareText, Mic, Sparkles, Timer } from 'lucide-react';
import { formatDuration } from '../../services/english/interviewAudio';
import { loadEvolutionDashboard, type EvolutionDashboardData } from '../../services/english/employabilityDashboardRepository';
import { EvolutionMetricCard } from './EvolutionMetricCard';
import { NextActionCard } from './NextActionCard';

interface EmployabilityDashboardProps {
  userId: string;
}

function formatScore(value: number | null): string {
  return value === null ? '—' : `${value}/10`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—';
}

const MOCK_STATUS_LABELS = { draft: 'Rascunho', in_progress: 'Em andamento' } as const;

export function EmployabilityDashboard({ userId }: EmployabilityDashboardProps) {
  const [data, setData] = useState<EvolutionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadEvolutionDashboard(userId));
    } catch (err) {
      console.error('[EnglishEvolution] Failed to load dashboard', err);
      setError('Não foi possível carregar o dashboard de evolução.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
        <Loader2 size={16} className="animate-spin" />
        Carregando evolução...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>{error || 'Não foi possível carregar o dashboard de evolução.'}</span>
      </div>
    );
  }

  const { answers, speakingTime, aiScores, vocabulary, star, mock } = data;

  return (
    <div className="space-y-4">
      <NextActionCard nextAction={data.nextAction} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <EvolutionMetricCard
          title="Respostas"
          subtitle="Gravações de perguntas de entrevista"
          icon={<Mic size={18} />}
          highlight={String(answers.totalAnswers)}
          highlightLabel="respostas gravadas no total"
          lines={[
            { label: 'Perguntas diferentes', value: String(answers.distinctQuestions) },
            { label: 'Últimos 7 dias', value: String(answers.answersLast7Days) },
            { label: 'Últimos 30 dias', value: String(answers.answersLast30Days) },
          ]}
        />

        <EvolutionMetricCard
          title="Tempo falando"
          subtitle="Duração somada das respostas gravadas"
          icon={<Timer size={18} />}
          highlight={formatDuration(speakingTime.totalSec)}
          highlightLabel="tempo total falando inglês"
          lines={[
            { label: 'Últimos 7 dias', value: formatDuration(speakingTime.last7DaysSec) },
            { label: 'Últimos 30 dias', value: formatDuration(speakingTime.last30DaysSec) },
          ]}
        />

        <EvolutionMetricCard
          title="Nota média IA"
          subtitle={`${aiScores.evaluatedCount} respostas avaliadas com Gemini`}
          icon={<Sparkles size={18} />}
          highlight={formatScore(aiScores.averageOverall)}
          highlightLabel="média geral das avaliações"
          lines={[
            { label: 'Últimos 7 dias', value: formatScore(aiScores.averageLast7Days) },
            { label: 'Últimos 30 dias', value: formatScore(aiScores.averageLast30Days) },
            { label: 'Melhor nota', value: formatScore(aiScores.bestScore) },
            { label: 'Última nota', value: formatScore(aiScores.latestScore) },
          ]}
        />

        <EvolutionMetricCard
          title="Vocabulário EUA"
          subtitle="Termos de vagas americanas (job_posting)"
          icon={<BookOpen size={18} />}
          highlight={`${vocabulary.masteredPercent}%`}
          highlightLabel={`dominado de ${vocabulary.totalJobPostingTerms} termos`}
          lines={[
            { label: 'Domino', value: String(vocabulary.mastered) },
            { label: 'Revisar', value: String(vocabulary.review) },
            { label: 'Ainda não domino', value: String(vocabulary.notMastered) },
          ]}
        />

        <EvolutionMetricCard
          title="Respostas STAR"
          subtitle="Histórias estruturadas para entrevistas"
          icon={<Edit3 size={18} />}
          highlight={String(star.totalStarAnswers)}
          highlightLabel="respostas STAR criadas"
          lines={[
            { label: 'Perguntas com STAR', value: String(star.distinctQuestionsWithStar) },
            { label: 'Última atualização', value: formatDate(star.lastUpdatedAt) },
          ]}
        />

        <EvolutionMetricCard
          title="Mock mensal"
          subtitle="Simulações completas de entrevista"
          icon={<Award size={18} />}
          highlight={String(mock.completedCount)}
          highlightLabel="mocks concluídos"
          lines={[
            { label: 'Último mock', value: mock.lastCompleted ? formatDate(mock.lastCompleted.completedAt) : '—' },
            { label: 'Nota do último', value: formatScore(mock.lastCompleted?.overallScore ?? null) },
            { label: 'Melhor mock', value: formatScore(mock.bestOverallScore) },
          ]}
        >
          {mock.currentMock && (
            <p className="rounded-lg bg-primary-500/10 px-2 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-200">
              <MessageSquareText size={12} className="mr-1 inline" />
              Mock atual: {mock.currentMock.title?.trim() || `criado em ${formatDate(mock.currentMock.createdAt)}`} · {MOCK_STATUS_LABELS[mock.currentMock.status]}
            </p>
          )}
        </EvolutionMetricCard>
      </div>
    </div>
  );
}
