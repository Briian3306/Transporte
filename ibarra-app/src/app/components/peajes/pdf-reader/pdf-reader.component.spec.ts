import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PdfReaderComponent } from './pdf-reader.component';
import { PdfReaderAnalysisService } from './pdf-reader-analysis.service';

describe('PdfReaderComponent', () => {
  let fixture: ComponentFixture<PdfReaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfReaderComponent],
      providers: [
        {
          provide: PdfReaderAnalysisService,
          useValue: {
            analizar: async () => ({
              fileName: 'factura.pdf',
              totalPages: 2,
              lastPageText: 'Subtotal $ 1.000,00',
              tables: [[['Subtotal', '$ 1.000,00']]],
              amounts: { subtotal: [{ rawValue: '1.000,00', value: 1000 }], iva: [], total: [] },
              logs: ['2 páginas detectadas', 'Tabla extraída'],
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfReaderComponent);
  });

  it('muestra el análisis y la tabla de la última página', async () => {
    fixture.componentInstance.archivoSeleccionado = new File(['pdf'], 'factura.pdf', {
      type: 'application/pdf',
    });

    await fixture.componentInstance.analizar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 páginas detectadas');
    expect(fixture.nativeElement.textContent).toContain('Subtotal');
    expect(fixture.nativeElement.textContent).toContain('$ 1.000,00');
  });

  it('muestra un error cuando el análisis falla', async () => {
    const service = TestBed.inject(PdfReaderAnalysisService) as any;
    service.analizar = async () => Promise.reject(new Error('PDF inválido'));
    fixture.componentInstance.archivoSeleccionado = new File(['pdf'], 'invalido.pdf', {
      type: 'application/pdf',
    });

    await fixture.componentInstance.analizar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('PDF inválido');
  });
});
