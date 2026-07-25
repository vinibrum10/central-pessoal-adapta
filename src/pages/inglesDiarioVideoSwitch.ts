// Lógica pura (sem JSX/estado React) de quando pedir confirmação antes de
// trocar o vídeo selecionado no Inglês Diário — extraída para ser testável
// sem renderizar o componente (o projeto não tem @testing-library/react).
export function shouldConfirmVideoSwitch(
  currentVideoId: string | null,
  nextVideoId: string,
  hasStudyProgress: boolean,
): boolean {
  if (!currentVideoId) return false; // primeira seleção — nada a confirmar
  if (nextVideoId === currentVideoId) return false; // reselecionar o mesmo vídeo nunca precisa de confirmação
  return hasStudyProgress;
}
