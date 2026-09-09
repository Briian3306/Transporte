import { Injectable } from '@angular/core';
import { PdfService } from './pdf.service';
import { Deposito, StockDeposito } from '../models/stock.model';
import { Content, TableCell, ContentTable } from 'pdfmake/interfaces';

/**
 * Servicio específico para generar PDFs de Stock
 * Utiliza el servicio base PdfService para crear documentos con formato consistente
 */
@Injectable({
  providedIn: 'root'
})
export class StockPdfService {

  constructor(private pdfService: PdfService) { }

  /**
   * Genera y descarga un PDF del stock del depósito
   */
  generateStockDepositoPdf(deposito: Deposito, stock: StockDeposito[]): void {
    const content: Content[] = [];

    // 1. Encabezado del documento
    content.push(
      this.pdfService.createHeader({
        leftText: 'TRANSPORTE IBARRA S.A.',
        centerText: `STOCK DE DEPÓSITO - ${deposito.nombre.toUpperCase()}`,
        rightText: 'REPORTE'
      })
    );

    // 2. Información del depósito
    const depositoInfo = [
      { label: 'Depósito', value: deposito.nombre },
      { label: 'Ubicación', value: deposito.ubicacion || 'N/A' },
      { label: 'Fecha', value: this.pdfService.formatDate(new Date().toISOString()) },
      { label: 'Total Insumos', value: stock.length.toString() }
    ];

    const infoSection = this.pdfService.createInfoSection({
      items: depositoInfo,
      columns: 2
    });
    content.push(...infoSection);

    // 3. Estadísticas de estados
    const stats = this.buildEstadisticas(stock);
    if (stats.length > 0) {
      content.push({
        text: 'RESUMEN POR ESTADO',
        style: 'sectionTitle',
        margin: [0, 5, 0, 5]
      });
      content.push(this.buildStatsTable(stats));
    }

    // 4. Listado de stock
    if (stock.length > 0) {
      content.push({
        text: 'LISTADO DE STOCK',
        style: 'sectionTitle',
        margin: [0, 5, 0, 5]
      });
      content.push(this.buildStockTable(stock));
    } else {
      content.push({
        text: 'No hay insumos en este depósito',
        style: 'tableCell',
        alignment: 'center',
        margin: [0, 20, 0, 20]
      });
    }

    // Generar nombre del archivo
    const filename = this.generateFilename(deposito);

    // Generar y descargar el PDF
    this.pdfService.generateAndDownload(
      { content },
      filename
    );
  }

  /**
   * Construye las estadísticas por estado
   */
  private buildEstadisticas(stock: StockDeposito[]): Array<{ label: string; value: number | string; style?: string }> {
    const normal = stock.filter(s => s.estado === 'normal').length;
    const bajo = stock.filter(s => s.estado === 'bajo').length;
    const critico = stock.filter(s => s.estado === 'critico').length;
    const excedido = stock.filter(s => s.estado === 'excedido').length;

    return [
      { 
        label: 'Total Insumos', 
        value: stock.length 
      },
      { 
        label: 'Normal', 
        value: normal,
        style: 'statusCorrect'
      },
      { 
        label: 'Bajo Mínimo', 
        value: bajo,
        style: 'statusWarning'
      },
      { 
        label: 'Crítico', 
        value: critico,
        style: 'statusError'
      },
      { 
        label: 'Sobre Máximo', 
        value: excedido
      }
    ];
  }

  /**
   * Construye una tabla compacta de estadísticas
   */
  private buildStatsTable(stats: Array<{ label: string; value: number | string; style?: string }>): Content {
    const rows: TableCell[][] = [];
    
    // Dividir en filas de 5 columnas (todas las estadísticas en una fila)
    const row: TableCell[] = [];
    stats.forEach(stat => {
      row.push({
        stack: [
          { 
            text: stat.value.toString(), 
            style: stat.style || 'statNumber',
            alignment: 'center',
            fontSize: 12,
            bold: true,
            margin: [0, 2, 0, 1]
          },
          { 
            text: stat.label, 
            style: 'statLabel',
            alignment: 'center',
            fontSize: 8,
            color: '#6b7280'
          }
        ],
        fillColor: '#f9fafb',
        margin: [3, 3, 3, 3]
      });
    });
    rows.push(row);

    return {
      table: {
        widths: Array(stats.length).fill('*'),
        body: rows
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#e5e7eb',
        vLineColor: () => '#e5e7eb',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 5,
        paddingBottom: () => 5
      },
      margin: [0, 0, 0, 8]
    } as ContentTable;
  }

  /**
   * Construye la tabla de stock
   */
  private buildStockTable(stock: StockDeposito[]): Content {
    const headers: TableCell[] = [
      { text: 'INSUMO', style: 'tableHeader', fontSize: 8 },
      { text: 'CATEGORÍA', style: 'tableHeader', fontSize: 8 },
      { text: 'ACTUAL', style: 'tableHeader', alignment: 'center', fontSize: 8 },
      { text: 'MÍN', style: 'tableHeader', alignment: 'center', fontSize: 8 },
      { text: 'MÁX', style: 'tableHeader', alignment: 'center', fontSize: 8 },
      { text: 'EST.', style: 'tableHeader', alignment: 'center', fontSize: 8 }
    ];

    const body: TableCell[][] = stock.map(item => {
      const estadoTexto = this.getEstadoTexto(item.estado);
      const estadoColor = this.getEstadoColor(item.estado);
      const estadoBgColor = this.getEstadoBgColor(item.estado);
      
      return [
        { 
          text: item.insumo_nombre || '-',
          style: 'tableCell',
          fontSize: 8
        },
        { 
          text: item.categoria_nombre || '-',
          style: 'tableCell',
          fontSize: 7
        },
        { 
          text: item.cantidad_actual.toString(),
          style: 'tableCell',
          alignment: 'center',
          fontSize: 7.5,
          bold: true
        },
        { 
          text: item.cantidad_minima.toString(),
          style: 'tableCell',
          alignment: 'center',
          fontSize: 7.5
        },
        { 
          text: item.cantidad_maxima.toString(),
          style: 'tableCell',
          alignment: 'center',
          fontSize: 7.5
        },
        { 
          text: estadoTexto,
          alignment: 'center',
          fontSize: 6.5,
          bold: true,
          color: estadoColor,
          fillColor: estadoBgColor
        }
      ];
    });

    return this.pdfService.createTable({
      widths: ['35%', '20%', '12%', '12%', '12%', '9%'],
      headers,
      body
    });
  }

  /**
   * Obtiene el texto abreviado del estado
   */
  private getEstadoTexto(estado?: string): string {
    switch (estado) {
      case 'normal':
        return 'OK';
      case 'bajo':
        return 'BAJO';
      case 'critico':
        return 'CRIT';
      case 'excedido':
        return 'EXCESO';
      default:
        return '-';
    }
  }

  /**
   * Obtiene el color del texto según el estado
   */
  private getEstadoColor(estado?: string): string {
    switch (estado) {
      case 'normal':
        return '#166534';
      case 'bajo':
        return '#d97706';
      case 'critico':
        return '#dc2626';
      case 'excedido':
        return '#0891b2';
      default:
        return '#6b7280';
    }
  }

  /**
   * Obtiene el color de fondo según el estado
   */
  private getEstadoBgColor(estado?: string): string {
    switch (estado) {
      case 'normal':
        return '#f0fdf4';
      case 'bajo':
        return '#fffbeb';
      case 'critico':
        return '#fef2f2';
      case 'excedido':
        return '#ecfeff';
      default:
        return '#f9fafb';
    }
  }

  /**
   * Genera el nombre del archivo
   */
  private generateFilename(deposito: Deposito): string {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const fechaFormateada = `${year}${month}${day}`;
    
    const nombreDeposito = deposito.nombre.replace(/\s+/g, '_');
    
    return `${fechaFormateada}_Stock_${nombreDeposito}.pdf`;
  }
}

