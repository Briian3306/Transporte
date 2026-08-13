import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifaCasosDialogComponent } from './tarifa-casos-dialog.component';

describe('TarifaCasosDialogComponent', () => {
  let fixture: ComponentFixture<TarifaCasosDialogComponent>;
  let component: TarifaCasosDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifaCasosDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifaCasosDialogComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.title = 'Pasadas · ZARATE · 1500.00';
    fixture.detectChanges();
  });

  it('muestra las columnas de Pasadas sin filtros ni acciones', () => {
    expect(component.columns.map((c) => c.key)).toEqual([
      'fecha_hora',
      'estacion_nombre',
      'patente_codigo',
      'empresa_nombre',
      'precio',
      'importe_neto',
      'file_upload_name',
      'created_at',
    ]);
    expect(component.columns.some((c) => c.key === 'acciones')).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-pasadas-filters')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[title="Editar"]')).toBeFalsy();
  });
});
