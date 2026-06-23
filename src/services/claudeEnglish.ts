export type ClaudeEnglishMode = 'speaking_feedback' | 'phrase_suggestion' | 'listening_review';

export interface ClaudeEnglishRequest {
  mode: ClaudeEnglishMode;
  input: string;
  context?: {
    level?: string;
    goal?: string;
  };
}

export interface ClaudeEnglishResult {
  correction?: string;
  naturalVersion?: string;
  explanationPt?: string;
  alternatives?: string[];
  vocabulary?: string[];
  phrases?: string[];
}

export interface ClaudeEnglishResponse {
  success: boolean;
  result?: ClaudeEnglishResult;
  error?: string;
}

export function getClaudeEnglishConfigMessage(): string {
  return 'Claude não configurado. Configure ANTHROPIC_API_KEY no ambiente server-side.';
}

export async function pedirAjudaClaude(payload: ClaudeEnglishRequest): Promise<ClaudeEnglishResult> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as ClaudeEnglishResponse;
  if (!response.ok || !data.success || !data.result) {
    throw new Error(data.error ?? getClaudeEnglishConfigMessage());
  }
  return data.result;
}
