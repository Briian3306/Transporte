import { Injectable, inject } from '@angular/core';
import { ConfiguracionPlantilla } from '../models/peajes.models';
import { PeajesMotorTransformacionService } from '../plantillas/motor/peajes-motor-transformacion.service';

export interface TarifaComparisonInput {
  precioDirecto: number;
  precioNormalizado: number | null;
  requiereNormalizacionIva: boolean;
}

export function precioComparable(input: TarifaComparisonInput): number {
  if (!input.requiereNormalizacionIva) return input.precioDirecto;
  if (input.precioNormalizado == null) throw new Error('Precio normalizado requerido');
  return input.precioNormalizado;
}

@Injectable({ providedIn: 'root' })
export class TarifaComparisonAdapterService {
  private readonly motor = inject(PeajesMotorTransformacionService);

  obtenerPrecioComparable(params: {
    precioDirecto: number;
    requiereNormalizacionIva: boolean;
    fila: Record<string, unknown>;
    configuraciones: ConfiguracionPlantilla[];
  }): number {
    if (!params.requiereNormalizacionIva) {
      return precioComparable({
        precioDirecto: params.precioDirecto,
        precioNormalizado: null,
        requiereNormalizacionIva: false,
      });
    }

    const [row] = this.motor.aplicarPipeline([params.fila], params.configuraciones);
    const importe = row?.IMPORTE_NETO;
    const precioNormalizado = typeof importe === 'number' ? importe : null;

    return precioComparable({
      precioDirecto: params.precioDirecto,
      precioNormalizado,
      requiereNormalizacionIva: true,
    });
  }
}
