import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AiCatLoaderComponent } from './ai-cat-loader.component';

describe('AiCatLoaderComponent', () => {
  let fixture: ComponentFixture<AiCatLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiCatLoaderComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AiCatLoaderComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('renders the bubble and the first rotating message', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ai-cat-loader')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.ai-cat')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Analizando factura…');
    expect(fixture.nativeElement.textContent).not.toContain('Con IA');
  });

  it('rotates to Leyendo importes after the interval', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Analizando factura…');
    tick(2200);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Leyendo importes…');
    expect(fixture.nativeElement.textContent).not.toContain('Analizando factura…');
  }));

  it('clears the message interval on destroy', () => {
    fixture.detectChanges();
    const clearSpy = spyOn(window, 'clearInterval').and.callThrough();
    fixture.destroy();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('sets the reduced-motion host class when the media query matches', () => {
    fixture.destroy();
    spyOn(window, 'matchMedia').and.returnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    } as MediaQueryList);
    fixture = TestBed.createComponent(AiCatLoaderComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.reducedMotion).toBeTrue();
    expect(fixture.nativeElement.classList.contains('reduced-motion')).toBeTrue();
  });

  it('keeps a single custom greeting without rotating', fakeAsync(() => {
    fixture.componentInstance.messages = ['Soy tu Asistente de IA'];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Soy tu Asistente de IA');
    tick(2200);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Soy tu Asistente de IA');
    expect(fixture.nativeElement.textContent).not.toContain('Leyendo importes…');
  }));
});
