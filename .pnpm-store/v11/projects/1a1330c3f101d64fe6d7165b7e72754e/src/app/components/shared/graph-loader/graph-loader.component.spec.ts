import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GraphLoaderComponent } from './graph-loader.component';

describe('GraphLoaderComponent', () => {
  let fixture: ComponentFixture<GraphLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphLoaderComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GraphLoaderComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('renders a canvas and the first rotating message', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Analizando texto....');
    expect(fixture.nativeElement.textContent).toContain('Podés completar el documento a mano.');
  });

  it('rotates to Analizando Factura after the interval', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Analizando texto....');
    tick(2200);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Analizando Factura ....');
    expect(fixture.nativeElement.textContent).not.toContain('Analizando texto....');
  }));

  it('stops the animation loop and message interval on destroy', () => {
    fixture.detectChanges();
    const cancelSpy = spyOn(window, 'cancelAnimationFrame').and.callThrough();
    const clearSpy = spyOn(window, 'clearInterval').and.callThrough();
    fixture.destroy();
    expect(cancelSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });
});
