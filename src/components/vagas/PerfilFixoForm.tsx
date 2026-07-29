import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '../Button';
import { Checkbox, Input, Select } from '../FormFields';
import type { PerfilFixo } from '../../types/vagas';

interface PerfilFixoFormProps {
  perfil: PerfilFixo;
  onSalvar: (perfil: PerfilFixo) => Promise<void>;
}

const OPCOES_NIVEL_INGLES = ['', 'Básico', 'Intermediário', 'Avançado', 'Fluente'];

function perfilIgual(a: PerfilFixo, b: PerfilFixo): boolean {
  return (
    a.escola === b.escola &&
    a.curso === b.curso &&
    a.anoInicio === b.anoInicio &&
    a.anoTermino === b.anoTermino &&
    a.linkedinUrl === b.linkedinUrl &&
    a.nivelIngles === b.nivelIngles &&
    a.autorizadoTrabalharBrasil === b.autorizadoTrabalharBrasil &&
    a.pisoSalarial === b.pisoSalarial
  );
}

export function PerfilFixoForm({ perfil, onSalvar }: PerfilFixoFormProps) {
  const [rascunho, setRascunho] = useState<PerfilFixo>(perfil);
  const [rascunhoBase, setRascunhoBase] = useState<PerfilFixo>(perfil);
  const [salvando, setSalvando] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (perfil !== rascunhoBase) {
    // Perfil recarregado de fora (ex.: primeira carga ou apos salvar) — resincroniza o rascunho.
    setRascunho(perfil);
    setRascunhoBase(perfil);
  }

  const mudou = !perfilIgual(rascunho, rascunhoBase);

  const mostrarToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(rascunho);
      setRascunhoBase(rascunho);
      mostrarToast('Perfil salvo com sucesso');
    } finally {
      setSalvando(false);
    }
  };

  const numeroOuNulo = (valor: string): number | null => (valor.trim() === '' ? null : Number(valor));

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-surface-900 px-5 py-3 text-sm text-white shadow-xl animate-fade-in dark:bg-surface-700">
          <CheckCircle size={14} className="flex-shrink-0 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="perfil-escola"
          label="Escola / instituição"
          value={rascunho.escola}
          onChange={e => setRascunho(prev => ({ ...prev, escola: e.target.value }))}
        />
        <Input
          id="perfil-curso"
          label="Curso / área de formação"
          value={rascunho.curso}
          onChange={e => setRascunho(prev => ({ ...prev, curso: e.target.value }))}
        />
        <Input
          id="perfil-ano-inicio"
          label="Ano de início"
          type="number"
          value={rascunho.anoInicio ?? ''}
          onChange={e => setRascunho(prev => ({ ...prev, anoInicio: numeroOuNulo(e.target.value) }))}
        />
        <Input
          id="perfil-ano-termino"
          label="Ano de término"
          type="number"
          value={rascunho.anoTermino ?? ''}
          onChange={e => setRascunho(prev => ({ ...prev, anoTermino: numeroOuNulo(e.target.value) }))}
        />
        <Input
          id="perfil-linkedin"
          label="URL do LinkedIn"
          value={rascunho.linkedinUrl}
          onChange={e => setRascunho(prev => ({ ...prev, linkedinUrl: e.target.value }))}
        />
        <Select
          id="perfil-ingles"
          label="Nível de inglês"
          value={rascunho.nivelIngles}
          onChange={e => setRascunho(prev => ({ ...prev, nivelIngles: e.target.value }))}
        >
          {OPCOES_NIVEL_INGLES.map(opcao => (
            <option key={opcao} value={opcao}>{opcao || 'Selecione…'}</option>
          ))}
        </Select>
        <Input
          id="perfil-piso-salarial"
          label="Piso salarial (R$/mês)"
          type="number"
          value={rascunho.pisoSalarial ?? ''}
          onChange={e => setRascunho(prev => ({ ...prev, pisoSalarial: numeroOuNulo(e.target.value) }))}
        />
        <Checkbox
          id="perfil-autorizado"
          label="Autorizado a trabalhar no Brasil"
          checked={rascunho.autorizadoTrabalharBrasil}
          onChange={e => setRascunho(prev => ({ ...prev, autorizadoTrabalharBrasil: e.target.checked }))}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" loading={salvando} disabled={!mudou || salvando} onClick={() => void salvar()}>
          Salvar perfil
        </Button>
      </div>
    </div>
  );
}
