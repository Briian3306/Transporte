export type EstadoTarifarioEmpresa = 'vacio' | 'pendiente' | 'revisar' | 'completo';

export interface EmpresaTarifarioPaso {
  id: string;
  nombre: string;
  numero: number;
  estado: EstadoTarifarioEmpresa;
}

const BLOQUEANTES = new Set([
  'NEW_TARIFF',
  'AMBIGUOUS_TARIFF_MATCH',
  'STATUS_REQUIRED',
  'STATUS_AMBIGUOUS',
  'DIRECTION_REQUIRED',
  'DIRECTION_CONFLICT',
  'CONTEXT_INCOMPLETE',
]);

export function pasosTarifarioPorEmpresa(input: {
  empresaIds: readonly string[];
  empresas: readonly { id: string; nombre: string }[];
  peajes: readonly { id: string; empresa_id?: string | null }[];
  candidatos: readonly { peajeId: string | null }[];
  resultados: readonly { codigo: string; peajeId?: string | null }[];
}): EmpresaTarifarioPaso[] {
  const peajeEmpresa = new Map(input.peajes.map((peaje) => [peaje.id, peaje.empresa_id]));
  const deEmpresa = (peajeId: string | null | undefined, empresaId: string) =>
    !!peajeId && peajeEmpresa.has(peajeId) &&
    (peajeEmpresa.get(peajeId) == null || peajeEmpresa.get(peajeId) === empresaId);

  return input.empresaIds.map((id, index) => {
    const candidatos = input.candidatos.filter((row) => deEmpresa(row.peajeId, id));
    const resultados = input.resultados.filter((row) => deEmpresa(row.peajeId, id));
    let estado: EstadoTarifarioEmpresa = 'vacio';
    if (candidatos.length || resultados.length) {
      if (resultados.some((row) => BLOQUEANTES.has(row.codigo))) estado = 'pendiente';
      else if (resultados.some((row) => row.codigo === 'REVIEW_RECORDED')) estado = 'revisar';
      else estado = 'completo';
    }
    return {
      id,
      nombre: input.empresas.find((empresa) => empresa.id === id)?.nombre ?? `Empresa ${index + 1}`,
      numero: index + 1,
      estado,
    };
  });
}
