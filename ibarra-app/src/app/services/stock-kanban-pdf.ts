import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { StockDeposito } from '../models/stock.model';
import { IBARRA_LOGO_DATA_URL } from './ibarra-logo-data';

const KANBAN_WIDTH_MM = 100;
const KANBAN_HEIGHT_MM = 60;
const KANBAN_MARGIN_MM = 2.2;

const COLOR = {
  red: '#C41E2A',
  ink: '#1B2430',
  label: '#8A93A3',
  line: '#E4E8EE',
  border: '#C9D1DC',
  footer: '#F3F5F7',
  minBg: '#E8F6EE',
  min: '#2FA36A',
  maxBg: '#FDECEE',
  max: '#D32F3A',
};

function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildKanbanCartelFilename(
  item: StockDeposito,
  depositoNombre: string,
): string {
  const codigo = item.insumo_codigo?.trim()
    ? sanitizeFilenamePart(item.insumo_codigo.trim())
    : `insumo-${item.insumo_id}`;
  const deposito = sanitizeFilenamePart(depositoNombre);
  return `kanban_${codigo}_${deposito}.pdf`;
}

function formatCantidad(valor: number): string {
  if (Number.isInteger(valor)) return String(valor).padStart(2, '0');
  return String(valor);
}

function headerSvg(categoria: string): string {
  const titulo = escapeXml(categoria.toUpperCase());
  const fontSize = categoria.length > 14 ? 28 : 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 130">
    <path d="M0 0 H690 L545 130 H0 Z" fill="${COLOR.red}"/>
    <g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M34 40 L56 26 L78 40 L78 68 L56 82 L34 68 Z"/>
      <path d="M34 40 L56 54 L78 40"/>
      <path d="M56 54 L56 82"/>
    </g>
    <text x="96" y="50" fill="#FFFFFF" font-size="16" font-family="Helvetica" letter-spacing="2.2">CATEGORÍA</text>
    <text x="96" y="98" fill="#FFFFFF" font-size="${fontSize}" font-family="Helvetica" font-weight="bold">${titulo}</text>
  </svg>`;
}

function iconSvg(kind: 'barcode' | 'box' | 'doc' | 'pin', color = '#6B7380'): string {
  const stroke = `fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"`;
  if (kind === 'barcode') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g ${stroke}>
      <path d="M4 6 V18 M7 6 V18 M9 6 V18 M12 6 V18 M14 6 V18 M17 6 V18 M20 6 V18"/>
    </g></svg>`;
  }
  if (kind === 'box') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g ${stroke}>
      <path d="M12 4 L20 8.5 L20 15.5 L12 20 L4 15.5 L4 8.5 Z"/>
      <path d="M4 8.5 L12 13 L20 8.5 M12 13 L12 20"/>
    </g></svg>`;
  }
  if (kind === 'doc') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g ${stroke}>
      <path d="M7 4 H14 L19 9 V20 H7 Z"/>
      <path d="M14 4 V9 H19 M9 12 H16 M9 15 H16"/>
    </g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g ${stroke}>
    <path d="M12 21 C12 21 6 13.5 6 10 A6 6 0 0 1 18 10 C18 13.5 12 21 12 21 Z"/>
    <circle cx="12" cy="10" r="2.2"/>
  </g></svg>`;
}

function arrowBadge(direction: 'up' | 'down', color: string): string {
  const points = direction === 'up' ? '12,7 17,15 7,15' : '12,17 17,9 7,9';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="${color}"/>
    <polygon points="${points}" fill="#FFFFFF"/>
  </svg>`;
}

function fieldRow(kind: 'barcode' | 'box' | 'doc', label: string, value: string): Content {
  return {
    table: {
      widths: [14, '*'],
      body: [
        [
          {
            svg: iconSvg(kind),
            width: 11,
            height: 11,
            margin: [0, 4, 0, 0],
          },
          {
            stack: [
              {
                text: label,
                fontSize: 5.5,
                color: COLOR.label,
                characterSpacing: 0.5,
                bold: true,
              },
              {
                text: value,
                fontSize: kind === 'doc' ? 7 : 8.5,
                bold: kind !== 'doc',
                color: COLOR.ink,
                margin: [0, 1, 0, 0],
              },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === node.table.body.length ? 0.45 : 0,
      vLineWidth: () => 0,
      hLineColor: () => COLOR.line,
      paddingLeft: () => 0,
      paddingRight: () => 2,
      paddingTop: () => 2,
      paddingBottom: () => 3,
    },
  };
}

function metricCard(
  direction: 'up' | 'down',
  label: string,
  value: string,
  accent: string,
  background: string,
): Content {
  return {
    table: {
      widths: [3.5, '*'],
      body: [
        [
          { text: '', fillColor: accent },
          {
            fillColor: background,
            columns: [
              {
                svg: arrowBadge(direction, accent),
                width: 14,
                height: 14,
                margin: [4, 6, 0, 0],
              },
              {
                stack: [
                  {
                    text: label,
                    fontSize: 5.5,
                    color: COLOR.label,
                    bold: true,
                    characterSpacing: 0.3,
                  },
                  {
                    text: value,
                    fontSize: 14,
                    bold: true,
                    color: COLOR.ink,
                    margin: [0, 1, 0, 0],
                  },
                ],
                margin: [4, 4, 4, 3],
              },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 3],
  };
}

function footerCell(kind: 'pin' | 'box', label: string, value: string): Content {
  return {
    fillColor: COLOR.footer,
    columns: [
      {
        svg: iconSvg(kind === 'pin' ? 'pin' : 'box'),
        width: 11,
        height: 11,
        margin: [0, 3, 4, 0],
      },
      {
        stack: [
          {
            text: label,
            fontSize: 5,
            color: COLOR.label,
            bold: true,
            characterSpacing: 0.4,
          },
          {
            text: value,
            fontSize: 7.5,
            bold: true,
            color: COLOR.ink,
            margin: [0, 1, 0, 0],
          },
        ],
        width: '*',
      },
    ],
    margin: [4, 3, 4, 3],
  };
}

export function buildKanbanCartelDefinition(
  item: StockDeposito,
  deposito: { nombre: string; ubicacion?: string },
): TDocumentDefinitions {
  const margin = mmToPt(KANBAN_MARGIN_MM);
  const pageWidth = mmToPt(KANBAN_WIDTH_MM);
  const pageHeight = mmToPt(KANBAN_HEIGHT_MM);
  const codigo = item.insumo_codigo?.trim() || `INS-${item.insumo_id}`;
  const nombre = item.insumo_nombre?.trim() || 'Insumo sin nombre';
  const categoria = item.categoria_nombre?.trim() || 'Sin categoría';
  const descripcion = item.insumo_descripcion?.trim() || 'Sin descripción';
  const unidad = item.unidad_medida?.trim() || 'u';
  const ubicacion = deposito.ubicacion?.trim() || deposito.nombre?.trim() || 'Sin ubicación';

  return {
    pageSize: { width: pageWidth, height: pageHeight },
    pageMargins: [margin, margin, margin, margin],
    background: {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600">
        <rect x="8" y="8" width="984" height="584" rx="36" fill="#FFFFFF" stroke="${COLOR.border}" stroke-width="5"/>
      </svg>`,
      width: pageWidth,
      height: pageHeight,
    },
    content: [
      {
        unbreakable: true,
        stack: [
          {
            columns: [
              {
                svg: headerSvg(categoria),
                width: mmToPt(78),
                height: mmToPt(10.5),
              },
              {
                image: IBARRA_LOGO_DATA_URL,
                fit: [mmToPt(13), mmToPt(13)],
                alignment: 'right',
                margin: [0, 3, 2, 0],
              },
            ],
            columnGap: 2,
            margin: [0, 0, 0, 2],
          },
          {
            columns: [
              {
                width: '63%',
                stack: [
                  fieldRow('barcode', 'CÓDIGO', codigo),
                  fieldRow('box', 'NOMBRE', nombre),
                  fieldRow('doc', 'DESCRIPCIÓN', descripcion),
                ],
              },
              {
                width: 1,
                table: {
                  widths: [1],
                  heights: [mmToPt(22)],
                  body: [[{ text: '', fillColor: COLOR.line }]],
                },
                layout: 'noBorders',
                margin: [3, 4, 3, 0],
              },
              {
                width: '*',
                stack: [
                  metricCard('up', 'CANT. MÍNIMA', formatCantidad(item.cantidad_minima), COLOR.min, COLOR.minBg),
                  metricCard('down', 'CANT. MÁXIMA', formatCantidad(item.cantidad_maxima), COLOR.max, COLOR.maxBg),
                ],
                margin: [0, 2, 0, 0],
              },
            ],
          },
          {
            table: {
              widths: ['*', 10, '*'],
              body: [
                [
                  footerCell('pin', 'UBICACIÓN', ubicacion),
                  {
                    fillColor: COLOR.footer,
                    canvas: [
                      {
                        type: 'line',
                        x1: 5,
                        y1: 3,
                        x2: 5,
                        y2: 18,
                        lineWidth: 0.6,
                        lineColor: '#D5DBE4',
                      },
                    ],
                  },
                  footerCell('box', 'UNIDAD DE MEDIDA', unidad),
                ],
              ],
            },
            layout: 'noBorders',
            margin: [0, 1, 0, 0],
          },
        ],
      },
    ],
  };
}
