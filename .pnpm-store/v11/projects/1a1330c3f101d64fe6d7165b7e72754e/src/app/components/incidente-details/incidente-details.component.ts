import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IncidenteService } from '../../services/incidente.service';
import { IncidenteConfigService } from '../../services/incidente-config.service';
import { Incidente, NivelRiesgo, TipoIncidente, SubtipoIncidente, EstadoSeguimiento, ComentarioSeguimiento } from '../../models/incidente.model';

@Component({
  selector: 'app-incidente-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incidente-details.component.html',
  styleUrl: './incidente-details.component.scss'
})
export class IncidenteDetailsComponent implements OnInit {
  private incidenteService = inject(IncidenteService);
  private incidenteConfigService = inject(IncidenteConfigService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Estados
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Datos
  incidente: Incidente | null = null;
  nivelRiesgo: NivelRiesgo | null = null;
  tipoIncidente: TipoIncidente | null = null;
  subtipoIncidente: SubtipoIncidente | null = null;

  // Formulario de comentarios
  nuevoComentario = '';
  agregandoComentario = false;

  // Estados de seguimiento
  estadosSeguimiento: { value: EstadoSeguimiento; label: string; color: string; icon: string }[] = [
    { value: 'pendiente', label: 'Pendiente', color: 'yellow', icon: 'fas fa-clock' },
    { value: 'en_proceso', label: 'En Proceso', color: 'blue', icon: 'fas fa-play' },
    { value: 'resuelto', label: 'Resuelto', color: 'green', icon: 'fas fa-check' },
    { value: 'cerrado', label: 'Cerrado', color: 'gray', icon: 'fas fa-lock' }
  ];

  categoriasReportante: { value: string; label: string; icon: string }[] = [
    { value: 'chofer', label: 'Chofer', icon: 'fas fa-truck' },
    { value: 'cliente', label: 'Cliente', icon: 'fas fa-user' },
    { value: 'policia', label: 'Policía', icon: 'fas fa-shield-alt' },
    { value: 'bomberos', label: 'Bomberos', icon: 'fas fa-fire-extinguisher' },
    { value: 'tercero', label: 'Tercero', icon: 'fas fa-users' },
    { value: 'otro', label: 'Otro', icon: 'fas fa-question' }
  ];

  constructor() {}

  ngOnInit() {
    this.loadIncidente();
  }

  private loadIncidente() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'ID de incidente no válido';
      return;
    }

    this.loading = true;
    this.error = null;

    this.incidenteService.getIncidenteById(id).subscribe({
      next: (incidente) => {
        this.incidente = incidente;
        if (incidente) {
          this.loadRelatedData(incidente);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar incidente:', err);
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  private loadRelatedData(incidente: Incidente) {
    // Cargar nivel de riesgo
    this.incidenteConfigService.getNivelesRiesgo().subscribe({
      next: (niveles) => {
        this.nivelRiesgo = niveles.find(n => n.codigo === incidente.nivel_riesgo) || null;
      }
    });

    // Cargar tipo de incidente
    this.incidenteConfigService.getTiposIncidente().subscribe({
      next: (tipos) => {
        this.tipoIncidente = tipos.find(t => t.codigo === incidente.tipo_incidente) || null;
        if (this.tipoIncidente) {
          this.subtipoIncidente = this.tipoIncidente.subtipos.find(s => s.codigo === incidente.subtipo_incidente) || null;
        }
      }
    });
  }

  // Agregar comentario
  agregarComentario() {
    if (!this.nuevoComentario.trim() || !this.incidente) {
      return;
    }

    this.agregandoComentario = true;
    this.error = null;

    this.incidenteService.addComentarioSeguimiento(this.incidente.id, this.nuevoComentario.trim()).subscribe({
      next: (incidenteActualizado) => {
        this.incidente = incidenteActualizado;
        this.nuevoComentario = '';
        this.agregandoComentario = false;
        this.success = 'Comentario agregado correctamente';
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        console.error('Error al agregar comentario:', err);
        this.error = err.message;
        this.agregandoComentario = false;
      }
    });
  }

  // Cambiar estado de seguimiento
  cambiarEstado(nuevoEstado: EstadoSeguimiento) {
    if (!this.incidente) return;

    this.loading = true;
    this.error = null;

    this.incidenteService.updateEstadoSeguimiento(this.incidente.id, nuevoEstado).subscribe({
      next: (incidenteActualizado) => {
        this.incidente = incidenteActualizado;
        this.loading = false;
        this.success = 'Estado actualizado correctamente';
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        console.error('Error al actualizar estado:', err);
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  // Navegación
  volverAHistorial() {
    this.router.navigate(['/incidentes/historial']);
  }

  irARegistro() {
    this.router.navigate(['/incidentes/registro']);
  }

  irAConfiguracion() {
    this.router.navigate(['/incidentes/configuracion']);
  }

  // Métodos auxiliares para el template
  getNivelRiesgoClass(): string {
    if (!this.nivelRiesgo) return 'bg-gray-100 text-gray-800';
    
    const colorMap: { [key: string]: string } = {
      'CRITICO': 'bg-red-100 text-red-800 border-red-200',
      'ALTO': 'bg-orange-100 text-orange-800 border-orange-200',
      'MEDIO': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'BAJO': 'bg-green-100 text-green-800 border-green-200'
    };
    
    return colorMap[this.nivelRiesgo.codigo] || 'bg-gray-100 text-gray-800 border-gray-200';
  }

  getEstadoClass(estado: string): string {
    const estadoInfo = this.estadosSeguimiento.find(e => e.value === estado);
    if (!estadoInfo) return 'bg-gray-100 text-gray-800';
    
    const colorMap: { [key: string]: string } = {
      'yellow': 'bg-yellow-100 text-yellow-800',
      'blue': 'bg-blue-100 text-blue-800',
      'green': 'bg-green-100 text-green-800',
      'gray': 'bg-gray-100 text-gray-800'
    };
    
    return colorMap[estadoInfo.color] || 'bg-gray-100 text-gray-800';
  }

  getCategoriaIcon(categoria: string): string {
    const categoriaInfo = this.categoriasReportante.find(c => c.value === categoria);
    return categoriaInfo?.icon || 'fas fa-question';
  }

  getCategoriaLabel(categoria: string): string {
    const categoriaInfo = this.categoriasReportante.find(c => c.value === categoria);
    return categoriaInfo?.label || categoria;
  }

  getEstadoIcon(estado: string): string {
    const estadoInfo = this.estadosSeguimiento.find(e => e.value === estado);
    return estadoInfo?.icon || 'fas fa-circle';
  }

  getEstadoColor(estado: string): string {
    const estadoInfo = this.estadosSeguimiento.find(e => e.value === estado);
    return estadoInfo?.color || 'gray';
  }

  // Formatear fecha y hora
  formatearFechaHora(fecha: string, hora: string): string {
    const fechaCompleta = new Date(`${fecha}T${hora}`);
    return fechaCompleta.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES');
  }

  formatearHora(hora: string): string {
    return hora;
  }

  // Verificar si se puede cambiar el estado
  puedeCambiarEstado(): boolean {
    return this.incidente?.estado_seguimiento !== 'cerrado';
  }

  // Obtener estados disponibles para cambio
  getEstadosDisponibles(): { value: EstadoSeguimiento; label: string; color: string; icon: string }[] {
    if (!this.incidente) return [];
    
    const estadoActual = this.incidente.estado_seguimiento;
    
    switch (estadoActual) {
      case 'pendiente':
        return this.estadosSeguimiento.filter(e => ['en_proceso', 'cerrado'].includes(e.value));
      case 'en_proceso':
        return this.estadosSeguimiento.filter(e => ['resuelto', 'cerrado'].includes(e.value));
      case 'resuelto':
        return this.estadosSeguimiento.filter(e => ['cerrado'].includes(e.value));
      case 'cerrado':
        return [];
      default:
        return this.estadosSeguimiento;
    }
  }

  // Limpiar mensajes
  clearMessages() {
    this.error = null;
    this.success = null;
  }

  // Verificar si hay comentarios
  tieneComentarios(): boolean {
    return !!(this.incidente?.comentarios_seguimiento && this.incidente.comentarios_seguimiento.length > 0);
  }

  // Obtener comentarios ordenados por fecha
  getComentariosOrdenados(): ComentarioSeguimiento[] {
    if (!this.incidente?.comentarios_seguimiento) return [];
    
    return [...this.incidente.comentarios_seguimiento].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}
