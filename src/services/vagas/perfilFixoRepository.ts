import { supabase } from '../../lib/supabase';
import type { PerfilFixo } from '../../types/vagas';

interface PerfilFixoRow {
  escola: string;
  curso: string;
  ano_inicio: number | null;
  ano_termino: number | null;
  linkedin_url: string;
  nivel_ingles: string;
  autorizado_trabalhar_brasil: boolean;
  piso_salarial: number | null;
}

function rowToPerfil(row: PerfilFixoRow): PerfilFixo {
  return {
    escola: row.escola,
    curso: row.curso,
    anoInicio: row.ano_inicio,
    anoTermino: row.ano_termino,
    linkedinUrl: row.linkedin_url,
    nivelIngles: row.nivel_ingles,
    autorizadoTrabalharBrasil: row.autorizado_trabalhar_brasil,
    pisoSalarial: row.piso_salarial,
  };
}

function perfilVazio(): PerfilFixo {
  return {
    escola: '',
    curso: '',
    anoInicio: null,
    anoTermino: null,
    linkedinUrl: '',
    nivelIngles: '',
    autorizadoTrabalharBrasil: false,
    pisoSalarial: null,
  };
}

export const perfilFixoRepository = {
  async buscar(userId: string): Promise<PerfilFixo> {
    const { data, error } = await supabase
      .from('vagas_perfil_fixo')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPerfil(data as PerfilFixoRow) : perfilVazio();
  },

  async salvar(userId: string, perfil: PerfilFixo): Promise<PerfilFixo> {
    const { data, error } = await supabase
      .from('vagas_perfil_fixo')
      .upsert(
        {
          user_id: userId,
          escola: perfil.escola,
          curso: perfil.curso,
          ano_inicio: perfil.anoInicio,
          ano_termino: perfil.anoTermino,
          linkedin_url: perfil.linkedinUrl,
          nivel_ingles: perfil.nivelIngles,
          autorizado_trabalhar_brasil: perfil.autorizadoTrabalharBrasil,
          piso_salarial: perfil.pisoSalarial,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return rowToPerfil(data as PerfilFixoRow);
  },
};
