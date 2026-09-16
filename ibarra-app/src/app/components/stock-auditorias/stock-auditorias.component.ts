import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { StockAuditoriasService } from '../../services/stock-auditorias.service';
import {
  AuditoriaStock,
  AuditoriaVencida,
  Deposito,
  DepositoAuditoriaConfig,
  EstadoAuditoria,
  TipoAuditoria,
} from '../../models/stock.model';

interface TarjetaDeposito {
  deposito: Deposito;
  config: DepositoAuditoriaConfig | null;
  auditoriaEnCurso: AuditoriaStock | null;
  estado: 'al_dia' | 'proxima' | 'vencida' | 'en_curso';
  proximaFecha?: string | null;
}

@Component({
  selector: 'app-stock-auditorias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-auditorias.component.html',
  styleUrl: './stock-auditorias.component.css'
})
export class StockAuditoriasComponent implements OnInit {
  private stockService = inject(StockService);
  private auditoriasService = inject(StockAuditoriasService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  depositoContexto: string | null = null;

  tarjetas: TarjetaDeposito[] = [];
  historial: AuditoriaStock[] = [];
  historialFiltrado: AuditoriaStock[] = [];
  vencidas: AuditoriaVencida[] = [];
  loading = true;
  error: string | null = null;

  filtroDeposito = '';
  filtroTipo: '' | TipoAuditoria = '';
  filtroEstado: '' | EstadoAuditoria = '';

  ngOnInit(): void {
    this.depositoContexto = this.route.snapshot.queryParamMap.get('deposito');
    if (this.depositoContexto) {
      this.filtroDeposito = this.depositoContexto;
    }
    this.cargar();
  }

  get tarjetasVisibles(): TarjetaDeposito[] {
    if (!this.filtroDeposito) return this.tarjetas;
    return this.tarjetas.filter((t) => t.deposito.id === this.filtroDeposito);
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      depositos: this.stockService.getDepositos(),
      auditorias: this.auditoriasService.getAuditorias(),
      vencidas: this.auditoriasService.getAuditoriasVencidas()
    }).subscribe({
      next: ({ depositos, auditorias, vencidas }) => {
        this.historial = auditorias;
        this.vencidas = vencidas;
        this.aplicarFiltros();
        this.armarTarjetas(depositos, auditorias);
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Error al cargar auditorías';
        this.loading = false;
      }
    });
  }

  aplicarFiltros(): void {
    this.historialFiltrado = this.historial.filter((a) => {
      if (this.filtroDeposito && a.deposito_id !== this.filtroDeposito) return false;
      if (this.filtroTipo && a.tipo !== this.filtroTipo) return false;
      if (this.filtroEstado && a.estado !== this.filtroEstado) return false;
      return true;
    });
  }

  iniciar(depositoId: string, tipo: TipoAuditoria): void {
    const queryParams: Record<string, string> = { tipo };
    if (this.depositoContexto) {
      queryParams['deposito'] = this.depositoContexto;
    }
    this.router.navigate(['/stock/auditoria/nueva', depositoId], { queryParams });
  }

  abrir(auditoria: AuditoriaStock): void {
    const queryParams = this.depositoContexto ? { deposito: this.depositoContexto } : undefined;
    this.router.navigate(['/stock/auditoria', auditoria.id], queryParams ? { queryParams } : undefined);
  }

  cobertura(a: AuditoriaStock): string {
    return `${a.items_controlados}/${a.total_items}`;
  }

  porcentajeDesvio(a: AuditoriaStock): string {
    if (!a.total_items) return '0%';
    return `${Math.round((a.items_con_desvio / a.total_items) * 100)}%`;
  }

  etiquetaEstadoTarjeta(estado: TarjetaDeposito['estado']): string {
    const map = {
      al_dia: 'Al día',
      proxima: 'Próxima',
      vencida: 'Vencida',
      en_curso: 'En curso'
    };
    return map[estado];
  }

  exportarCSV(): void {
    const headers = ['Fecha', 'Depósito', 'Tipo', 'Estado', 'Controlados', 'Total', 'Desvíos', 'No encontrados'];
    const rows = this.historialFiltrado.map((a) => [
      a.fecha_inicio.toISOString(),
      a.deposito_nombre || '',
      a.tipo,
      a.estado,
      String(a.items_controlados),
      String(a.total_items),
      String(a.items_con_desvio),
      String(a.items_no_encontrados)
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditorias-stock-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  volver(): void {
    if (this.depositoContexto) {
      this.router.navigate(['/stock/deposito', this.depositoContexto]);
      return;
    }
    this.router.navigate(['/stock/dashboard']);
  }

  private armarTarjetas(depositos: Deposito[], auditorias: AuditoriaStock[]): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const avisoMs = 3 * 86400000;

    this.tarjetas = depositos.map((deposito) => {
      const enCurso = auditorias.find((a) => a.deposito_id === deposito.id && a.estado === 'en_curso') || null;
      const vencida = this.vencidas.find((v) => v.deposito_id === deposito.id);
      return {
        deposito,
        config: null,
        auditoriaEnCurso: enCurso,
        estado: enCurso ? 'en_curso' : vencida ? 'vencida' : 'al_dia',
        proximaFecha: vencida?.proxima_fecha || null
      };
    });

    depositos.forEach((deposito, index) => {
      this.auditoriasService.getConfig(deposito.id).subscribe({
        next: (config) => {
          this.tarjetas[index].config = config;
          this.tarjetas[index].proximaFecha = config?.proxima_fecha || this.tarjetas[index].proximaFecha;
          if (this.tarjetas[index].estado === 'en_curso') return;
          if (config?.proxima_fecha) {
            const proxima = new Date(config.proxima_fecha);
            if (proxima < hoy) {
              this.tarjetas[index].estado = 'vencida';
            } else if (proxima.getTime() - hoy.getTime() <= (config.dias_aviso_previo || 3) * 86400000 || proxima.getTime() - hoy.getTime() <= avisoMs) {
              this.tarjetas[index].estado = 'proxima';
            }
          }
        }
      });
    });
  }
}
