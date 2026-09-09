import { Injectable } from '@angular/core';
import { PdfService } from './pdf.service';
import { 
  Checklist, 
  VehicleInformation, 
  DriverInformation, 
  UnitInformation, 
  MachineInformation, 
  SectorInformation 
} from '../models/checklist.model';
import { Content, TableCell, ContentTable } from 'pdfmake/interfaces';

/**
 * Servicio específico para generar PDFs de Checklists
 * Utiliza el servicio base PdfService para crear documentos con formato consistente
 */
@Injectable({
  providedIn: 'root'
})
export class ChecklistPdfService {

  constructor(private pdfService: PdfService) { }

  /**
   * Genera y descarga un PDF del checklist completo
   */
  generateChecklistPdf(checklist: Checklist): void {
    const content: Content[] = [];

    // Obtener el tipo de recurso para el título
    const tipoRecurso = this.getTipoRecursoTexto(checklist.informacion?.tipoRecurso);

    // 1. Encabezado del documento
    content.push(
      this.pdfService.createHeader({
        leftText: 'TRANSPORTE IBARRA S.A.',
        centerText: `CHECK DE VERIFICACIÓN - ${tipoRecurso}`,
        rightText: 'FORMULARIO'
      })
    );

    // 2. Información del recurso
    const resourceInfo = this.buildResourceInfo(checklist);
    if (resourceInfo.length > 0) {
      const infoSection = this.pdfService.createInfoSection({
        items: resourceInfo,
        columns: 2
      });
      content.push(...infoSection);
    }

    // 3. Estadísticas en formato compacto
    const stats = this.buildStats(checklist);
    if (stats.length > 0) {
      content.push({
        text: 'ESTADÍSTICAS',
        style: 'sectionTitle',
        margin: [0, 5, 0, 5]
      });
      content.push(this.buildStatsTable(stats));
    }

    // 4. Respuestas por sección (sin salto de página)
    const sections = this.buildSectionsWithResponses(checklist);
    if (sections.length > 0) {
      content.push({
        text: 'PREGUNTAS Y RESPUESTAS',
        style: 'sectionTitle',
        margin: [0, 5, 0, 5]
      });
      
      sections.forEach((section, index) => {
        // Título de la sección
        content.push({
          text: section.titulo,
          style: 'subsectionHeader',
          margin: [0, 10, 0, 5]
        });

        // Tabla de respuestas
        content.push(this.buildResponsesTable(section.responses));
      });
    }

    // 5. Observaciones (si existen) - sin salto de página
    const observations = this.buildObservations(checklist);
    if (observations.length > 0) {
      content.push({
        text: 'OBSERVACIONES ADICIONALES',
        style: 'sectionTitle',
        margin: [0, 15, 0, 10]
      });
      
      observations.forEach(obs => {
        content.push({
          text: [
            { text: `${obs.itemId}: `, bold: true },
            { text: obs.text }
          ],
          margin: [0, 3, 0, 3],
          fontSize: 9
        });
      });
    }

    // 6. Información adicional
    content.push({
      text: 'INFORMACIÓN ADICIONAL',
      style: 'sectionTitle',
      margin: [0, 15, 0, 10]
    });
    
    const additionalInfo = [
      { 
        label: 'Requiere Revisión', 
        value: checklist.requiere_revision ? 'SÍ' : 'NO' 
      },
      { 
        label: 'Estado', 
        value: this.getStatusText(checklist.estado) 
      },
      { 
        label: 'Fecha de Realización', 
        value: this.pdfService.formatDate(checklist.fecha_realizacion) 
      },
      { 
        label: 'Fecha de Creación', 
        value: this.pdfService.formatDate(checklist.fecha_creacion) 
      }
    ];

    const additionalInfoSection = this.pdfService.createInfoSection({
      items: additionalInfo,
      columns: 2
    });
    content.push(...additionalInfoSection);

    // Generar nombre del archivo
    const filename = this.generateFilename(checklist);

    // Generar y descargar el PDF
    this.pdfService.generateAndDownload(
      { content },
      filename
    );
  }

  /**
   * Construye la información del recurso para el PDF
   */
  private buildResourceInfo(checklist: Checklist): { label: string; value: string }[] {
    const tipo = checklist.informacion?.tipoRecurso || 'desconocido';
    const info = checklist.informacion?.informacionRecurso;
    
    if (!info) return [];

    switch (tipo) {
      case 'vehiculo':
        const vehicle = info as VehicleInformation;
        return [
          { label: 'Tipo de Recurso', value: 'Vehículo' },
          { label: 'Patente', value: vehicle.placa },
          { label: 'Marca', value: vehicle.marca },
          { label: 'Modelo', value: vehicle.modelo },
          { label: 'Kilometraje', value: vehicle.kilometraje.toString() },
          { label: 'Ubicación', value: vehicle.ubicacion }
        ];
      
      case 'chofer':
        const driver = info as DriverInformation;
        return [
          { label: 'Tipo de Recurso', value: 'Chofer' },
          { label: 'Nombre', value: driver.nombre },
          { label: 'DNI', value: driver.dni }
        ];
      
      case 'unidad':
        const unit = info as UnitInformation;
        return [
          { label: 'Tipo de Recurso', value: 'Unidad' },
          { label: 'Chofer', value: unit.chofer_nombre },
          { label: 'DNI', value: unit.chofer_dni },
          { label: 'Camión', value: unit.camion_patente },
          { label: 'Semi', value: unit.semi1_patente || 'N/A' },
          { label: 'Tipo', value: unit.tipo_unidad },
          { label: 'Estado', value: unit.estado }
        ];
      
      case 'maquina':
        const machine = info as MachineInformation;
        return [
          { label: 'Tipo de Recurso', value: 'Maquina' },
          { label: 'Nombre', value: machine.nombre },
          { label: 'Modelo', value: machine.modelo },
          { label: 'N° Serie', value: machine.numero_serie },
          { label: 'Estado', value: machine.estado }
        ];
      
      case 'sector':
        const sector = info as SectorInformation;
        return [
          { label: 'Tipo de Recurso', value: 'Sector' },
          { label: 'Nombre', value: sector.nombre },
          { label: 'Tipo', value: sector.tipo_area }
        ];
      
      default:
        return [
          { label: 'Tipo de Recurso', value: 'Desconocido' }
        ];
    }
  }

  /**
   * Construye las estadísticas para el PDF
   */
  private buildStats(checklist: Checklist): Array<{ label: string; value: number | string; style?: string }> {
    return [
      { 
        label: 'Total Items', 
        value: checklist.total_items 
      },
      { 
        label: 'Completados', 
        value: checklist.items_completados 
      },
      { 
        label: 'Correctos', 
        value: checklist.items_correctos,
        style: 'statusCorrect'
      },
      { 
        label: 'Advertencias', 
        value: checklist.items_con_advertencia,
        style: 'statusWarning'
      },
      { 
        label: 'Errores', 
        value: checklist.items_con_error,
        style: 'statusError'
      },
      { 
        label: 'Progreso', 
        value: `${checklist.porcentaje_completado}%` 
      }
    ];
  }

  /**
   * Construye una tabla compacta de estadísticas
   */
  private buildStatsTable(stats: Array<{ label: string; value: number | string; style?: string }>): Content {
    const rows: TableCell[][] = [];
    
    // Dividir en filas de 3 columnas
    for (let i = 0; i < stats.length; i += 3) {
      const row: TableCell[] = [];
      for (let j = 0; j < 3; j++) {
        const stat = stats[i + j];
        if (stat) {
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
        } else {
          row.push({ text: '', fillColor: '#ffffff' });
        }
      }
      rows.push(row);
    }

    return {
      table: {
        widths: ['*', '*', '*'],
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
   * Construye las secciones con sus respuestas
   */
  private buildSectionsWithResponses(checklist: Checklist): any[] {
    if (!checklist.respuestas) return [];
    
    const grouped: { [sectionId: string]: any[] } = {};

    Object.entries(checklist.respuestas).forEach(([itemId, response]) => {
      const sectionInfo = response.itemConfig?.seccionId && response.itemConfig?.seccionTitulo
        ? { id: response.itemConfig.seccionId, titulo: response.itemConfig.seccionTitulo }
        : null;
      
      if (sectionInfo) {
        if (!grouped[sectionInfo.id]) {
          grouped[sectionInfo.id] = [];
        }
        grouped[sectionInfo.id].push({
          itemId,
          ...response,
          sectionInfo
        });
      }
    });

    return Object.entries(grouped).map(([sectionId, responses]) => ({
      id: sectionId,
      titulo: responses[0]?.sectionInfo?.titulo || 'Sección Desconocida',
      responses: responses.sort((a, b) => (a.itemConfig?.orden || 0) - (b.itemConfig?.orden || 0))
    }));
  }

  /**
   * Construye una tabla de respuestas
   */
  private buildResponsesTable(responses: any[]): Content {
    const headers: TableCell[] = [
      { text: 'PREGUNTA', style: 'tableHeader', fontSize: 8 },
      { text: 'VALOR', style: 'tableHeader', alignment: 'center', fontSize: 8 },
      { text: 'OBSERVACIÓN', style: 'tableHeader', fontSize: 8 },
      { text: 'EST.', style: 'tableHeader', alignment: 'center', fontSize: 8 }
    ];

    const body: TableCell[][] = responses.map(response => {
      const statusStyle = this.getStatusStyle(response.validacion?.tipo);
      const statusIcon = this.getStatusIcon(response.validacion?.tipo);
      const statusColor = this.getStatusColor(response.validacion?.tipo);
      
      return [
        { 
          text: response.itemConfig?.descripcion || 'Sin descripción',
          style: 'tableCell',
          fontSize: 7.5
        },
        { 
          text: response.valor || '-',
          style: 'tableCell',
          alignment: 'center',
          fontSize: 7.5,
          bold: true
        },
        { 
          text: response.observacion || '-',
          style: 'tableCell',
          fontSize: 7
        },
        { 
          text: statusIcon,
          alignment: 'center',
          fontSize: 7,
          bold: true,
          color: statusColor,
          fillColor: this.getStatusBgColor(response.validacion?.tipo)
        }
      ];
    });

    return this.pdfService.createTable({
      widths: ['48%', '15%', '28%', '9%'],
      headers,
      body
    });
  }

  /**
   * Construye las observaciones
   */
  private buildObservations(checklist: Checklist): any[] {
    if (!checklist.observaciones) return [];
    
    return Object.entries(checklist.observaciones)
      .filter(([_, text]) => text && text.trim() !== '')
      .map(([itemId, text]) => ({
        itemId,
        text
      }));
  }

  /**
   * Genera el nombre del archivo basado en los datos del checklist
   */
  private generateFilename(checklist: Checklist): string {
    const fecha = new Date(checklist.fecha_realizacion);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const fechaFormateada = `${year}${month}${day}`;
    
    const tipo = checklist.informacion?.tipoRecurso || 'checklist';
    const info = checklist.informacion?.informacionRecurso;
    
    let identificador = '';
    
    if (tipo === 'vehiculo' && info) {
      const vehicle = info as VehicleInformation;
      identificador = vehicle.placa;
    } else if (tipo === 'chofer' && info) {
      const driver = info as DriverInformation;
      identificador = driver.nombre.replace(/\s+/g, '_');
    } else if (tipo === 'unidad' && info) {
      const unit = info as UnitInformation;
      identificador = `${unit.camion_patente}_${unit.chofer_nombre}`.replace(/\s+/g, '_');
    } else {
      identificador = checklist.id.substring(0, 8);
    }
    
    return `${fechaFormateada}_Checklist_${identificador}.pdf`;
  }

  /**
   * Obtiene el estilo según el tipo de validación
   */
  private getStatusStyle(tipo?: string): string {
    switch (tipo) {
      case 'correcto':
        return 'statusCorrect';
      case 'advertencia':
        return 'statusWarning';
      case 'error':
        return 'statusError';
      default:
        return 'tableCell';
    }
  }

  /**
   * Obtiene el color según el tipo de validación
   */
  private getStatusColor(tipo?: string): string {
    switch (tipo) {
      case 'correcto':
        return '#166534';
      case 'advertencia':
        return '#d97706';
      case 'error':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  }

  /**
   * Obtiene el color de fondo según el tipo de validación
   */
  private getStatusBgColor(tipo?: string): string {
    switch (tipo) {
      case 'correcto':
        return '#f0fdf4';
      case 'advertencia':
        return '#fffbeb';
      case 'error':
        return '#fef2f2';
      default:
        return '#f9fafb';
    }
  }

  /**
   * Obtiene el icono según el tipo de validación
   */
  private getStatusIcon(tipo?: string): string {
    switch (tipo) {
      case 'correcto':
        return 'OK';
      case 'advertencia':
        return 'ADV';
      case 'error':
        return 'ERR';
      default:
        return '-';
    }
  }

  /**
   * Obtiene el texto del estado del checklist
   */
  private getStatusText(estado: string): string {
    switch (estado) {
      case 'completado':
        return 'Completado';
      case 'con_errores':
        return 'Con Errores';
      case 'parcial':
        return 'Parcial';
      case 'en_progreso':
        return 'En Progreso';
      default:
        return 'Desconocido';
    }
  }

  /**
   * Obtiene el texto del tipo de recurso para el título
   */
  private getTipoRecursoTexto(tipo?: string): string {
    switch (tipo) {
      case 'vehiculo':
        return 'VEHÍCULO';
      case 'chofer':
        return 'CHOFER';
      case 'unidad':
        return 'UNIDAD';
      case 'maquina':
        return 'MÁQUINA';
      case 'sector':
        return 'SECTOR';
      default:
        return 'GENERAL';
    }
  }
}

