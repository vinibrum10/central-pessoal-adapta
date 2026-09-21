/**
 * Abertura de Pull Request via API REST do GitHub.
 *
 * Não depende do `gh` CLI (que pode não estar instalado): usa `fetch` puro com
 * um Personal Access Token. É grátis. O token só precisa de permissão de
 * escrita no repositório (escopo `repo` num token clássico, ou Contents+Pull
 * requests: Read/Write num fine-grained token).
 */

export interface OpenPrParams {
  token: string;
  owner: string;
  repo: string;
  head: string; // branch com as mudanças
  base: string; // branch alvo (ex: master/main)
  title: string;
  body: string;
}

export async function openPullRequest(params: OpenPrParams): Promise<{ url: string; number: number }> {
  const res = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub recusou abrir o PR (HTTP ${res.status}): ${text}`);
  }
  const data = (await res.json()) as { html_url: string; number: number };
  return { url: data.html_url, number: data.number };
}

/** Descobre a branch padrão do repositório (base do PR). */
export async function defaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return 'main';
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch || 'main';
}
