import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { 
  TDocumentDefinitions, 
  Content, 
  StyleDictionary, 
  TableCell,
  ContentTable,
  ContentText
} from 'pdfmake/interfaces';

// Configurar las fuentes de pdfMake de forma segura
const pdfMakeWithFonts = pdfMake as any;
pdfMakeWithFonts.vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;

/**
 * Configuración para crear encabezados de documentos
 */
export interface HeaderConfig {
  leftText: string;
  centerText: string;
  rightText: string;
  leftStyle?: string;
  centerStyle?: string;
  rightStyle?: string;
}

/**
 * Configuración para crear tablas
 */
export interface TableConfig {
  widths: (string | number | '*')[];
  headerRows?: number;
  headers: (string | TableCell)[];
  body: (string | TableCell)[][];
  layout?: string | object;
}

/**
 * Configuración para secciones de información clave-valor
 */
export interface InfoSectionConfig {
  title?: string;
  items: { label: string; value: string }[];
  columns?: number;
}

/**
 * Configuración para tarjetas de estadísticas
 */
export interface StatConfig {
  label: string;
  value: number | string;
  style?: string;
}

/**
 * Servicio base para generación de PDFs
 * Proporciona helpers reutilizables para crear documentos PDF consistentes
 */
@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  /**
   * Crea un encabezado de documento con tres columnas
   */
  createHeader(config: HeaderConfig): Content {
    return {
      table: {
        widths: ['25%', '50%', '25%'],
        body: [
          [
            { 
              text: config.leftText, 
              style: config.leftStyle || 'header', 
              alignment: 'center', 
              margin: [0, 10, 0, 10] 
            },
            { 
              text: config.centerText, 
              style: config.centerStyle || 'subheader', 
              alignment: 'center', 
              margin: [0, 10, 0, 10] 
            },
            { 
              text: config.rightText, 
              style: config.rightStyle || 'formNumber', 
              alignment: 'center', 
              margin: [0, 10, 0, 10] 
            }
          ]
        ]
      },
      layout: 'headerLines',
      margin: [0, 0, 0, 10]
    } as ContentTable;
  }

  /**
   * Crea una tabla con formato consistente
   */
  createTable(config: TableConfig): Content {
    const body = [config.headers, ...config.body];
    
    return {
      table: {
        widths: config.widths,
        headerRows: config.headerRows || 1,
        body: body
      },
      layout: config.layout || {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#d1d5db',
        vLineColor: () => '#d1d5db'
      }
    } as ContentTable;
  }

  /**
   * Crea una sección de información con pares clave-valor
   */
  createInfoSection(config: InfoSectionConfig): Content[] {
    const content: Content[] = [];
    
    if (config.title) {
      content.push({
        text: config.title,
        style: 'sectionTitle',
        margin: [0, 10, 0, 5]
      } as ContentText);
    }

    const columns = config.columns || 2;
    const tableBody: TableCell[][] = [];
    
    for (let i = 0; i < config.items.length; i += columns) {
      const row: TableCell[] = [];
      for (let j = 0; j < columns; j++) {
        const item = config.items[i + j];
        if (item) {
          row.push(
            { text: item.label, style: 'tableHeader' },
            { text: item.value, style: 'tableCell' }
          );
        } else {
          row.push({ text: '', colSpan: 2 }, {});
        }
      }
      tableBody.push(row);
    }

    content.push({
      table: {
        widths: columns === 2 ? ['auto', '*', 'auto', '*'] : ['auto', '*'],
        body: tableBody
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10]
    } as ContentTable);

    return content;
  }

  /**
   * Crea tarjetas de estadísticas
   */
  createStatsBadges(stats: StatConfig[]): Content {
    const columns: Content[] = stats.map(stat => ({
      stack: [
        {
          text: stat.value.toString(),
          style: stat.style || 'statNumber',
          alignment: 'center'
        },
        {
          text: stat.label,
          style: 'statLabel',
          alignment: 'center'
        }
      ],
      margin: [5, 5, 5, 5]
    }));

    return {
      columns: columns,
      columnGap: 10,
      margin: [0, 10, 0, 10]
    };
  }

  /**
   * Genera y descarga un PDF con la definición proporcionada
   */
  generateAndDownload(docDefinition: TDocumentDefinitions, filename: string): void {
    // Agregar estilos globales si no están definidos
    if (!docDefinition.styles) {
      docDefinition.styles = this.getGlobalStyles();
    } else {
      // Combinar con estilos globales
      docDefinition.styles = { ...this.getGlobalStyles(), ...docDefinition.styles };
    }

    // Configuración de página por defecto si no está definida
    if (!docDefinition.pageSize) {
      docDefinition.pageSize = 'A4';
    }
    if (!docDefinition.pageMargins) {
      docDefinition.pageMargins = [30, 30, 30, 30];
    }

    // Crear y descargar el PDF usando pdfMakeWithFonts
    const pdf = pdfMakeWithFonts.createPdf(docDefinition);
    pdf.download(filename);
  }

  /**
   * Genera y abre el PDF en una nueva ventana
   */
  generateAndOpen(docDefinition: TDocumentDefinitions): void {
    // Agregar estilos globales
    if (!docDefinition.styles) {
      docDefinition.styles = this.getGlobalStyles();
    } else {
      docDefinition.styles = { ...this.getGlobalStyles(), ...docDefinition.styles };
    }

    const pdf = pdfMakeWithFonts.createPdf(docDefinition);
    pdf.open();
  }

  /**
   * Retorna los estilos globales para PDFs
   */
  getGlobalStyles(): StyleDictionary {
    return {
      header: {
        fontSize: 16,
        bold: true,
        color: '#1f2937'
      },
      subheader: {
        fontSize: 14,
        bold: true,
        color: '#1f2937'
      },
      formNumber: {
        fontSize: 14,
        bold: true,
        color: '#1f2937'
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: '#1f2937',
        margin: [0, 10, 0, 5]
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        color: '#1f2937',
        margin: [0, 20, 0, 10]
      },
      subsectionHeader: {
        fontSize: 10,
        bold: true,
        color: '#374151',
        fillColor: '#f3f4f6',
        margin: [0, 5, 0, 5]
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        fillColor: '#f3f4f6',
        color: '#1f2937'
      },
      tableCell: {
        fontSize: 8,
        color: '#1f2937'
      },
      statNumber: {
        fontSize: 20,
        bold: true,
        color: '#1f2937'
      },
      statLabel: {
        fontSize: 10,
        color: '#6b7280'
      },
      modeIndicator: {
        fontSize: 12,
        bold: true,
        color: '#d97706',
        fillColor: '#fef3c7',
        alignment: 'center',
        margin: [0, 5, 0, 15]
      },
      statusCorrect: {
        color: '#10b981',
        bold: true
      },
      statusWarning: {
        color: '#f59e0b',
        bold: true
      },
      statusError: {
        color: '#ef4444',
        bold: true
      }
    };
  }

  /**
   * Formatea una fecha para mostrar en el PDF
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Genera un nombre de archivo con timestamp
   */
  generateFilename(prefix: string, suffix?: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}_${hours}${minutes}`;
    const suffixPart = suffix ? `_${suffix}` : '';
    
    return `${prefix}_${timestamp}${suffixPart}.pdf`;
  }
}

