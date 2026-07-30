import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Paso1CargaComponent } from './paso1-carga.component';
import { PeajesExcelService } from '../services/peajes-excel.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

describe('Paso1CargaComponent', () => {
  let fixture: ComponentFixture<Paso1CargaComponent>;
  let component: Paso1CargaComponent;
  let excel: jasmine.SpyObj<PeajesExcelService>;
  let state: PeajesWizardStateService;

  beforeEach(async () => {
    excel = jasmine.createSpyObj('PeajesExcelService', ['esXlsxValido', 'parsearArchivo']);
    await TestBed.configureTestingModule({
      imports: [Paso1CargaComponent],
      providers: [
        PeajesWizardStateService,
        { provide: PeajesExcelService, useValue: excel },
      ],
    }).compileComponents();

    state = TestBed.inject(PeajesWizardStateService);
    state.reiniciar();
    fixture = TestBed.createComponent(Paso1CargaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra error si el archivo no es .xlsx', async () => {
    excel.esXlsxValido.and.returnValue(false);
    const file = new File(['x'], 'pasadas.csv', { type: 'text/csv' });
    await component.procesar(file);
    fixture.detectChanges();
    expect(component.error).toContain('.xlsx');
    expect(fixture.nativeElement.textContent).toContain('.xlsx');
  });

  it('muestra nombre, tamaño y filas con .xlsx válido', async () => {
    excel.esXlsxValido.and.returnValue(true);
    excel.parsearArchivo.and.resolveTo({
      nombreArchivo: 'pasadas_junio_2026.xlsx',
      tamanioBytes: 4096,
      totalFilas: 10,
      columnas: ['FECHA', 'HORA'],
      filasPreview: [{ FECHA: '25/06/2026', HORA: '205005' }],
      tiposInferidos: { FECHA: 'fecha', HORA: 'texto' },
    });

    const file = new File(['dummy'], 'pasadas_junio_2026.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await component.procesar(file);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('pasadas_junio_2026.xlsx');
    expect(text).toMatch(/4[,.]?096/);
    expect(text).toContain('10');
    expect(component.error).toBeNull();
  });
});
