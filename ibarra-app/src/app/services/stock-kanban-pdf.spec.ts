import { StockDeposito } from '../models/stock.model';
import {
  buildKanbanCartelDefinition,
  buildKanbanCartelFilename,
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
