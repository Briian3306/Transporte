import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso2PreviewComponent } from './paso2-preview.component';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso2PreviewComponent', () => {
  let fixture: ComponentFixture<Paso2PreviewComponent>;
  let component: Paso2PreviewComponent;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paso2PreviewComponent],
      providers: [PeajesWizardStateService],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    const filas = Array.from({ length: 15 }, (_, i) => ({
      FECHA: `0${i + 1}/06/2026`,
      VIA: String(i),
    }));
    state.setPreview({
      nombreArchivo: 'demo.xlsx',
      tamanioBytes: 100,
      totalFilas: 15,
      columnas: ['FECHA', 'VIA'],
      filasPreview: filas.slice(0, 10),
      filasOrigen: filas,
      tiposInferidos: { FECHA: 'fecha', VIA: 'número' },
    });

    fixture = TestBed.createComponent(Paso2PreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('limita la vista previa a 10 filas', () => {
    expect(component.filasPreview.length).toBe(10);
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(10);
  });

  it('columnas excluidas no llegan al mapeo', () => {
    component.toggleColumna('VIA', false);
    const s = state.snapshot();
    expect(s.columnasExcluidas).toContain('VIA');
    expect(state.columnasParaMapeo()).not.toContain('VIA');
    expect(state.mapeosActivos().map((m) => m.columnaOrigen)).not.toContain('VIA');
  });

  it('F02-11: muestra recomendaciones y Aplicar escribe draft', () => {
    state.reiniciar();
    state.setPreview({
      nombreArchivo: 'ausol.csv',
      tamanioBytes: 10,
      totalFilas: 1,
      columnas: ['FECHA', 'HORA', 'PATENTE', 'ESTACION'],
      filasPreview: [
        { FECHA: '2026-01-01', HORA: '08:30:15', PATENTE: 'AB-1', ESTACION: 'E1' },
      ],
      filasOrigen: [],
      tiposInferidos: {},
    });
    fixture = TestBed.createComponent(Paso2PreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const rail = fixture.nativeElement.querySelector('.paso2__recos');
    expect(rail).toBeTruthy();
    expect(component.pendientesCount).toBeGreaterThan(0);

    component.aplicarRecomendacion('rec-patente');
    fixture.detectChanges();
    expect(state.getConfiguracionesDraft().length).toBe(3);
    expect(
      fixture.nativeElement.textContent.includes('Aplicada') ||
        state.snapshot().recomendaciones.find((r) => r.id === 'rec-patente')?.status === 'accepted'
    ).toBeTrue();
  });
});
