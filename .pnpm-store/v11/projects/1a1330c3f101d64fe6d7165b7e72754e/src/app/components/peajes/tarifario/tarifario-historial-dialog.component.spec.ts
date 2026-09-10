import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifarioHistorialItem } from '../models/tarifario.contracts';
import { MISSING_IMPORTE_LABEL } from './tarifario.helpers';
import { TarifarioHistorialDialogComponent } from './tarifario-historial-dialog.component';

describe('TarifarioHistorialDialogComponent', () => {
  let fixture: ComponentFixture<TarifarioHistorialDialogComponent>;
  let component: TarifarioHistorialDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifarioHistorialDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifarioHistorialDialogComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.title = 'Cat. 1 · NO_PICO';
  });

  function rows(extra: Partial<TarifarioHistorialItem>[] = []): TarifarioHistorialItem[] {
    return extra.map((row, index) => ({
      id: row.id ?? `ti-${index}`,
      importe: row.importe ?? 1000,
      fecha_aparicion: row.fecha_aparicion ?? '2024-01-15T00:00:00.000Z',
      es_actual: row.es_actual ?? false,
      fechaVigenciaInicio: row.fechaVigenciaInicio ?? null,
      fechaVigenciaFin: row.fechaVigenciaFin ?? null,
      diagnostico: row.diagnostico ?? null,
      categoriaCalculada: row.categoriaCalculada ?? null,
    }));
  }

  it('muestra Desde, Hasta, Diagnóstico, Categoría calculada y Vigente', () => {
    component.rows = rows([
      {
        importe: 5800,
        fecha_aparicion: '2025-08-21T00:00:00.000Z',
        es_actual: true,
        fechaVigenciaInicio: '2026-09-01',
        fechaVigenciaFin: null,
        diagnostico: 'CONFIRMADO',
        categoriaCalculada: 2,
      },
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Desde',
      'Hasta',
      'Importe',
      'Diagnóstico',
      'Categoría calculada',
      'Vigente',
    ]);
    expect(root.textContent).toContain('01/09/2026');
    expect(root.textContent).toContain('CONFIRMADO');
    expect(root.textContent).toContain('2');
    expect(root.textContent).toContain('Vigente');
    expect(root.textContent).not.toContain('21/08/2025');
  });

  it('usa Sin fecha conocida y em dash para nulos legado sin inventar vigencia', () => {
    component.rows = rows([
      {
        importe: 5000,
        fecha_aparicion: '2024-01-15T00:00:00.000Z',
        es_actual: false,
        fechaVigenciaInicio: null,
        fechaVigenciaFin: null,
        diagnostico: null,
        categoriaCalculada: null,
      },
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const cells = Array.from(root.querySelectorAll('tbody tr td')).map((td) => td.textContent?.trim());
    expect(cells[0]).toBe('Sin fecha conocida');
    expect(cells[1]).toBe('Sin fecha conocida');
    expect(cells[3]).toBe(MISSING_IMPORTE_LABEL);
    expect(cells[4]).toBe(MISSING_IMPORTE_LABEL);
    expect(root.textContent).not.toContain('15/01/2024');
  });
});
