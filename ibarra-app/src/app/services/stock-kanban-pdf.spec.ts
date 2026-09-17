import { StockDeposito } from '../models/stock.model';
import {
  buildKanbanCartelDefinition,
  buildKanbanCartelFilename,
  buildKanbanHojasDefinition,
  buildKanbanHojasFilename,
  layoutKanbanHojas,
} from './stock-kanban-pdf';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

const pdfMakeWithFonts = pdfMake as any;
pdfMakeWithFonts.vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;

const item: StockDeposito = {
  id: 'stock-1',
  deposito_id: 'dep-1',
  insumo_id: 42,
  insumo_nombre: 'Neumático Nexen N6000',
  insumo_codigo: 'NEX-225/45R17-94W',
  insumo_descripcion: 'Neumático de alto rendimiento. Excelente agarre y estabilidad.',
  categoria_nombre: 'Neumáticos',
  unidad_medida: 'Unidades',
  cantidad_actual: 12,
  cantidad_minima: 2,
  cantidad_maxima: 12,
  punto_reorden: 15,
};

const deposito = {
  nombre: 'Taller Central',
  ubicacion: 'Pasillo 3 - Estante 2',
};

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') {
    const value = node as Record<string, unknown>;
    const texts: string[] = [];
    if ('text' in value) texts.push(...collectText(value['text']));
    if ('svg' in value) texts.push(...collectText(value['svg']));
    if ('stack' in value) texts.push(...collectText(value['stack']));
    if ('columns' in value) texts.push(...collectText(value['columns']));
    if ('content' in value) texts.push(...collectText(value['content']));
    if ('body' in value) texts.push(...collectText(value['body']));
    if ('table' in value) texts.push(...collectText(value['table']));
    return texts;
  }
  return [];
}

describe('buildKanbanCartelDefinition', () => {
  it('usa una página de 100 x 60 mm para imprimir el cartel', () => {
    const def = buildKanbanCartelDefinition(item, deposito);
    const pageSize = def.pageSize as { width: number; height: number };

    expect(pageSize.width).toBeCloseTo((100 * 72) / 25.4, 5);
    expect(pageSize.height).toBeCloseTo((60 * 72) / 25.4, 5);
  });

  it('deja márgenes menores a 5 mm para no comerse la tarjeta', () => {
    const def = buildKanbanCartelDefinition(item, deposito);
    const margins = def.pageMargins as number[];
    const maxMargin = Math.max(...margins);

    expect(maxMargin).toBeLessThan((5 * 72) / 25.4);
  });

  it('sigue el layout de categoría, datos del insumo y cantidades min/máx', () => {
    const def = buildKanbanCartelDefinition(item, deposito);
    const texto = collectText(def.content).join(' ');

    expect(texto).toContain('CATEGORÍA');
    expect(texto).toContain('NEUMÁTICOS');
    expect(texto).toContain('CÓDIGO');
    expect(texto).toContain('NEX-225/45R17-94W');
    expect(texto).toContain('NOMBRE');
    expect(texto).toContain('Neumático Nexen N6000');
    expect(texto).toContain('DESCRIPCIÓN');
    expect(texto).toContain('Neumático de alto rendimiento');
    expect(texto).toContain('CANT. MÍNIMA');
    expect(texto).toContain('02');
    expect(texto).toContain('CANT. MÁXIMA');
    expect(texto).toContain('12');
    expect(texto).toContain('UBICACIÓN');
    expect(texto).toContain('Pasillo 3 - Estante 2');
    expect(texto).toContain('UNIDAD DE MEDIDA');
    expect(texto).toContain('Unidades');
  });

  it('incluye el logo de Ibarra', () => {
    const def = buildKanbanCartelDefinition(item, deposito);
    expect(JSON.stringify(def)).toContain('data:image/png;base64');
  });

  it('cabe en una sola hoja de 100x60 mm', (done) => {
    const def = buildKanbanCartelDefinition(item, deposito);

    pdfMakeWithFonts.createPdf(def).getBuffer((buf: Uint8Array) => {
      const pdf = new TextDecoder('latin1').decode(buf);
      const kids = pdf.match(/\/Kids\s*\[([^\]]+)\]/);
      const pageRefs = kids?.[1].match(/\d+\s+0\s+R/g) ?? [];

      expect(pageRefs.length).toBe(1);
      done();
    });
  });
});

describe('buildKanbanCartelFilename', () => {
  it('nombra el PDF con el código del insumo y el depósito', () => {
    expect(buildKanbanCartelFilename(item, deposito.nombre)).toBe(
      'kanban_NEX-225_45R17-94W_Taller_Central.pdf',
    );
  });

  it('usa el id del insumo cuando no hay código', () => {
    const sinCodigo: StockDeposito = { ...item, insumo_codigo: undefined };

    expect(buildKanbanCartelFilename(sinCodigo, deposito.nombre)).toBe(
      'kanban_insumo-42_Taller_Central.pdf',
    );
  });
});

function itemDePrueba(id: string, nombre: string): StockDeposito {
  return {
    ...item,
    id,
    insumo_id: Number(id.replace(/\D/g, '')) || 1,
    insumo_nombre: nombre,
    insumo_codigo: `COD-${id}`,
  };
}

function countPdfPages(buf: Uint8Array): number {
  const pdf = new TextDecoder('latin1').decode(buf);
  return (pdf.match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

describe('layoutKanbanHojas', () => {
  it('entra hasta 8 kanban de 100x60 mm en una hoja A4', () => {
    const layout = layoutKanbanHojas(8);

    expect(layout.columnas).toBe(2);
    expect(layout.filas).toBe(4);
    expect(layout.porHoja).toBe(8);
    expect(layout.hojas).toBe(1);
  });

  it('agrega otra hoja cuando no entran todos en la primera', () => {
    expect(layoutKanbanHojas(9).hojas).toBe(2);
    expect(layoutKanbanHojas(16).hojas).toBe(2);
    expect(layoutKanbanHojas(17).hojas).toBe(3);
  });
});

describe('buildKanbanHojasFilename', () => {
  it('nombra el PDF con el depósito y la cantidad de kanban', () => {
    expect(buildKanbanHojasFilename(deposito.nombre, 12)).toBe(
      'kanban_hoja_Taller_Central_12.pdf',
    );
  });
});

function findCanvasRects(node: unknown): Array<{ w: number; h: number }> {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(findCanvasRects);
  if (typeof node !== 'object') return [];
  const value = node as Record<string, unknown>;
  const rects: Array<{ w: number; h: number }> = [];
  if (Array.isArray(value['canvas'])) {
    for (const shape of value['canvas'] as Array<Record<string, unknown>>) {
      if (shape['type'] === 'rect' && typeof shape['w'] === 'number' && typeof shape['h'] === 'number') {
        rects.push({ w: shape['w'], h: shape['h'] });
      }
    }
  }
  if ('stack' in value) rects.push(...findCanvasRects(value['stack']));
  if ('columns' in value) rects.push(...findCanvasRects(value['columns']));
  if ('content' in value) rects.push(...findCanvasRects(value['content']));
  return rects;
}

function collectAbsoluteNodes(node: unknown): Array<Record<string, unknown>> {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(collectAbsoluteNodes);
  if (typeof node !== 'object') return [];
  const value = node as Record<string, unknown>;
  const nodes: Array<Record<string, unknown>> = [];
  if ('absolutePosition' in value) nodes.push(value);
  if ('stack' in value) nodes.push(...collectAbsoluteNodes(value['stack']));
  if ('columns' in value) nodes.push(...collectAbsoluteNodes(value['columns']));
  if ('content' in value) nodes.push(...collectAbsoluteNodes(value['content']));
  return nodes;
}

function findFirstTableWidth(node: unknown): number | undefined {
  if (node == null) return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const width = findFirstTableWidth(child);
      if (width != null) return width;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;
  const value = node as Record<string, unknown>;
  const table = value['table'] as { widths?: unknown } | undefined;
  const width = Array.isArray(table?.widths) ? table.widths.find((w) => typeof w === 'number') : undefined;
  if (typeof width === 'number') return width;
  return findFirstTableWidth(value['stack']) ?? findFirstTableWidth(value['columns']);
}

describe('buildKanbanHojasDefinition', () => {
  it('usa hoja A4 vertical para agrupar los kanban', () => {
    const def = buildKanbanHojasDefinition([item], deposito);

    expect(def.pageSize).toBe('A4');
    expect(def.pageOrientation).toBe('portrait');
  });

  it('mantiene cada tarjeta en 100 x 60 mm para poder cortarlas', () => {
    const def = buildKanbanHojasDefinition([item], deposito);
    const rect = findCanvasRects(def.content)[0];

    expect(rect.w).toBeCloseTo((100 * 72) / 25.4 - 1.2, 4);
    expect(rect.h).toBeCloseTo((60 * 72) / 25.4 - 1.2, 4);
  });

  it('acota el contenido de cada kanban a 100 mm para que no se superpongan en A4', () => {
    const items = [
      itemDePrueba('1', 'Filtro de aceite'),
      itemDePrueba('2', 'Filtro de aire'),
    ];
    const def = buildKanbanHojasDefinition(items, deposito);
    const tarjetas = collectAbsoluteNodes(def.content);
    const anchoMaximo = (100 * 72) / 25.4;

    expect(tarjetas.length).toBe(2);
    for (const tarjeta of tarjetas) {
      const ancho = findFirstTableWidth(tarjeta);
      expect(ancho).toBeDefined();
      expect(ancho!).toBeLessThanOrEqual(anchoMaximo);
      expect(ancho!).toBeGreaterThan(anchoMaximo * 0.85);
    }
  });

  it('incluye los datos de todos los kanban agrupados', () => {
    const items = [
      itemDePrueba('1', 'Filtro de aceite'),
      itemDePrueba('2', 'Filtro de aire'),
    ];
    const def = buildKanbanHojasDefinition(items, deposito);
    const texto = collectText(def.content).join(' ');

    expect(texto).toContain('Filtro de aceite');
    expect(texto).toContain('Filtro de aire');
    expect(texto).toContain('COD-1');
    expect(texto).toContain('COD-2');
  });

  it('un kanban cabe en una sola hoja A4', (done) => {
    const def = buildKanbanHojasDefinition([item], deposito);

    pdfMakeWithFonts.createPdf(def).getBuffer((buf: Uint8Array) => {
      expect(countPdfPages(buf)).toBe(1);
      done();
    });
  });

  it('ocho kanban caben en una sola hoja A4', (done) => {
    const items = Array.from({ length: 8 }, (_, i) =>
      itemDePrueba(String(i + 1), `Insumo ${i + 1}`),
    );
    const def = buildKanbanHojasDefinition(items, deposito);

    pdfMakeWithFonts.createPdf(def).getBuffer((buf: Uint8Array) => {
      expect(countPdfPages(buf)).toBe(1);
      done();
    });
  });

  it('reparte 9 kanban en 2 hojas A4', (done) => {
    const items = Array.from({ length: 9 }, (_, i) =>
      itemDePrueba(String(i + 1), `Insumo ${i + 1}`),
    );
    const def = buildKanbanHojasDefinition(items, deposito);

    pdfMakeWithFonts.createPdf(def).getBuffer((buf: Uint8Array) => {
      expect(countPdfPages(buf)).toBe(2);
      done();
    });
  });
});
