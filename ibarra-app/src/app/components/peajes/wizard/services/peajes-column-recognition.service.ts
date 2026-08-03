import { Injectable } from '@angular/core';
import { ExcelCargaPreview } from '../../models';
import {
  ColumnRecommendation,
  buildDemoPipelineSeeds,
  detectColumnRecommendations,
  tieneHeadersParaSeedDemo,
} from './column-recognition';
import { ConfiguracionPlantillaDraft } from './wizard-draft.types';

/**
 * Fachada Angular sobre el reconocimiento semántico de columnas (F02-11).
 * Las recetas viven en `column-recognition.ts`; este service es el entry DI.
 */
@Injectable({ providedIn: 'root' })
export class PeajesColumnRecognitionService {
  detect(preview: ExcelCargaPreview | null | undefined): ColumnRecommendation[] {
    return detectColumnRecommendations(preview);
  }

  canSeedDemoPipeline(columnas: string[]): boolean {
    return tieneHeadersParaSeedDemo(columnas);
  }

  buildDemoSeeds(preview: ExcelCargaPreview): ConfiguracionPlantillaDraft[] {
    return buildDemoPipelineSeeds(preview);
  }
}
