import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccordionComponent } from './accordion.component';
import { AccordionPanelComponent } from './accordion-panel.component';
import { AccordionHeaderDirective } from './accordion-header.directive';
import { AccordionContentDirective } from './accordion-content.directive';

@Component({
  standalone: true,
  imports: [
    AccordionComponent,
    AccordionPanelComponent,
    AccordionHeaderDirective,
    AccordionContentDirective,
  ],
  template: `
    <app-accordion [multiple]="multiple" [(expandedValues)]="expanded">
      <app-accordion-panel value="a" status="ok">
        <span appAccordionHeader>Documento A</span>
        <div appAccordionContent>Cuerpo A</div>
      </app-accordion-panel>
      <app-accordion-panel value="b" status="warn">
        <span appAccordionHeader>Documento B</span>
        <div appAccordionContent>Cuerpo B</div>
      </app-accordion-panel>
    </app-accordion>
  `,
})
class AccordionHostComponent {
  multiple = true;
  expanded: string[] = ['a'];
}

describe('AccordionComponent', () => {
  let fixture: ComponentFixture<AccordionHostComponent>;
  let host: AccordionHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccordionHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AccordionHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('proyecta encabezados y muestra el cuerpo del panel expandido', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Documento A');
    expect(text).toContain('Documento B');
    expect(text).toContain('Cuerpo A');
  });

  it('en multiple permite abrir varios paneles', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      '.app-acc-panel__trigger'
    ) as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    fixture.detectChanges();
    expect(host.expanded).toEqual(['a', 'b']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cuerpo B');
  });

  it('en modo exclusivo cierra el anterior al abrir otro', () => {
    host.multiple = false;
    host.expanded = ['a'];
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      '.app-acc-panel__trigger'
    ) as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    fixture.detectChanges();
    expect(host.expanded).toEqual(['b']);
  });

  it('expone aria-expanded en el trigger', () => {
    const first = fixture.nativeElement.querySelector(
      '.app-acc-panel__trigger'
    ) as HTMLButtonElement;
    expect(first.getAttribute('aria-expanded')).toBe('true');
  });

  it('mueve el foco entre encabezados con flechas, Home y End', () => {
    const buttons = [...fixture.nativeElement.querySelectorAll(
      '.app-acc-panel__trigger',
    )] as HTMLButtonElement[];
    buttons[0].focus();
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Enter en el encabezado alterna solo ese panel', () => {
    const buttons = [...fixture.nativeElement.querySelectorAll(
      '.app-acc-panel__trigger',
    )] as HTMLButtonElement[];
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('false');
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
  });
});
