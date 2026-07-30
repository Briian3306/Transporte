import { Injectable } from '@angular/core';
import {
  ConfirmacionCargaResultado,
  ExcelCargaPreview,
  Factura,
  MapeoColumna,
  PasadaColumnKey,
  PasadaEstandarizada,
  RelacionEstacionProveedor,
  ResultadoValidacionCarga,
} from '../../models';

export type WizardPasoId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface WizardFacturaForm {
  factura: string;
  cuenta: string;
  empresa_id: string;
  fecha_factura: string;
  importe_sin_iva: number | null;
  importe_total: number | null;
}

export interface PeajesWizardState {
  pasoActual: WizardPasoId;
  preview: ExcelCargaPreview | null;
  columnasIncluidas: string[];
  columnasExcluidas: string[];
  mapeos: MapeoColumna[];
  relacionesEstacion: RelacionEstacionProveedor[];
  factura: WizardFacturaForm;
  pasadasEstandarizadas: PasadaEstandarizada[];
  validacion: ResultadoValidacionCarga | null;
  confirmacion: ConfirmacionCargaResultado | null;
  plantillaId: string | null;
}

const FACTURA_VACIA: WizardFacturaForm = {
  factura: '',
  cuenta: '',
  empresa_id: '',
  fecha_factura: '',
  importe_sin_iva: null,
  importe_total: null,
};

function estadoInicial(): PeajesWizardState {
  return {
    pasoActual: 1,
    preview: null,
    columnasIncluidas: [],
    columnasExcluidas: [],
    mapeos: [],
    relacionesEstacion: [],
    factura: { ...FACTURA_VACIA },
    pasadasEstandarizadas: [],
    validacion: null,
    confirmacion: null,
    plantillaId: null,
  };
}

/**
 * Estado compartido del wizard (RF-25 / F02-9).
 * Conserva configuración al volver a pasos anteriores.
 */
@Injectable({ providedIn: 'root' })
export class PeajesWizardStateService {
  private state: PeajesWizardState = estadoInicial();

  snapshot(): PeajesWizardState {
    return structuredClone(this.state);
  }

  get pasoActual(): WizardPasoId {
    return this.state.pasoActual;
  }

  setPaso(paso: WizardPasoId): void {
    this.state.pasoActual = paso;
  }

  setPreview(preview: ExcelCargaPreview): void {
    this.state.preview = preview;
    this.state.columnasIncluidas = [...preview.columnas];
    this.state.columnasExcluidas = [];
    this.state.mapeos = preview.columnas.map((columnaOrigen) => ({
      columnaOrigen,
      columnaDestino: null,
      excluida: false,
    }));
    this.state.relacionesEstacion = [];
    this.state.pasadasEstandarizadas = [];
    this.state.validacion = null;
    this.state.confirmacion = null;
  }

  setSeleccionColumnas(incluidas: string[], excluidas: string[]): void {
    this.state.columnasIncluidas = [...incluidas];
    this.state.columnasExcluidas = [...excluidas];
    this.state.mapeos = this.state.mapeos
      .filter((m) => incluidas.includes(m.columnaOrigen) || excluidas.includes(m.columnaOrigen))
      .map((m) => ({
        ...m,
        excluida: excluidas.includes(m.columnaOrigen),
        columnaDestino: excluidas.includes(m.columnaOrigen) ? null : m.columnaDestino,
      }));

    for (const col of incluidas) {
      if (!this.state.mapeos.some((m) => m.columnaOrigen === col)) {
        this.state.mapeos.push({ columnaOrigen: col, columnaDestino: null, excluida: false });
      }
    }
  }

  setMapeos(mapeos: MapeoColumna[]): void {
    this.state.mapeos = mapeos.map((m) => ({ ...m }));
  }

  setRelacionesEstacion(relaciones: RelacionEstacionProveedor[]): void {
    this.state.relacionesEstacion = relaciones.map((r) => ({ ...r }));
  }

  setFactura(factura: WizardFacturaForm): void {
    this.state.factura = { ...factura };
  }

  setPasadasEstandarizadas(pasadas: PasadaEstandarizada[]): void {
    this.state.pasadasEstandarizadas = pasadas.map((p) => ({ ...p }));
  }

  setValidacion(validacion: ResultadoValidacionCarga | null): void {
    this.state.validacion = validacion ? structuredClone(validacion) : null;
  }

  setConfirmacion(confirmacion: ConfirmacionCargaResultado | null): void {
    this.state.confirmacion = confirmacion ? structuredClone(confirmacion) : null;
  }

  setPlantillaId(id: string | null): void {
    this.state.plantillaId = id;
  }

  /** Columnas activas que llegan al mapeo (excluidas no se incluyen). */
  columnasParaMapeo(): string[] {
    return this.state.columnasIncluidas.filter((c) => !this.state.columnasExcluidas.includes(c));
  }

  mapeosActivos(): MapeoColumna[] {
    return this.state.mapeos.filter((m) => !m.excluida);
  }

  facturaComoPersistible(): Omit<Factura, 'id' | 'created_at'> {
    const f = this.state.factura;
    return {
      factura: f.factura,
      cuenta: f.cuenta,
      empresa_id: f.empresa_id,
      fecha_factura: f.fecha_factura,
      importe_sin_iva: Number(f.importe_sin_iva ?? 0),
      importe_total: Number(f.importe_total ?? 0),
    };
  }

  /** Construye filas estandarizadas desde preview + mapeos + relaciones estación. */
  construirPasadasDesdeMapeo(): PasadaEstandarizada[] {
    const preview = this.state.preview;
    if (!preview) {
      return [];
    }

    const mapeoActivo = this.mapeosActivos().filter((m) => m.columnaDestino);
    const relMap = new Map(
      this.state.relacionesEstacion.map((r) => [String(r.valorProveedor), r.estacionId])
    );

    return preview.filasPreview.map((fila) => {
      const out: Partial<Record<PasadaColumnKey, string | number | null>> = {
        PASADA_ID: null,
        FECHA_HORA: null,
        PASE_ID: null,
        PATENTE_ID: null,
        ESTACION_ID: null,
        PRECIO: null,
        BONIFICACION: null,
        QUANTITY: 1,
        IMPORTE_NETO: null,
      };

      for (const m of mapeoActivo) {
        const dest = m.columnaDestino!;
        let valor: string | number | null =
          fila[m.columnaOrigen] === undefined || fila[m.columnaOrigen] === null
            ? null
            : (fila[m.columnaOrigen] as string | number);

        if (dest === 'ESTACION_ID' && valor !== null) {
          const mapped = relMap.get(String(valor));
          valor = mapped ?? String(valor);
        }

        out[dest] = valor;
      }

      if (out.IMPORTE_NETO === null && out.PRECIO !== null) {
        const precio = Number(out.PRECIO);
        const bonif = Number(out.BONIFICACION ?? 0);
        const qty = Number(out.QUANTITY ?? 1);
        if (Number.isFinite(precio)) {
          out.IMPORTE_NETO = (precio - (Number.isFinite(bonif) ? bonif : 0)) * (Number.isFinite(qty) ? qty : 1);
        }
      }

      return out as PasadaEstandarizada;
    });
  }

  reiniciar(): void {
    this.state = estadoInicial();
  }
}
