import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepperComponent } from './stepper.component';
import { StepperItemComponent } from './stepper-item.component';
import { StepperPanelComponent } from './stepper-panel.component';

@Component({
  standalone: true,
  imports: [StepperComponent, StepperItemComponent, StepperPanelComponent],
  template: `
    <app-stepper [value]="step" (valueChange)="step = $event" ariaLabel="Tarifarios">
      <app-stepper-item [step]="1" title="Ausol" state="completed"></app-stepper-item>
      <app-stepper-item [step]="2" title="Aubasa" state="pending"></app-stepper-item>
      <app-stepper-item [step]="3" title="Carga" state="loading" [disabled]="true"></app-stepper-item>
      <app-stepper-panel [value]="1">Panel Ausol</app-stepper-panel>
      <app-stepper-panel [value]="2">Panel Aubasa</app-stepper-panel>
    </app-stepper>
  `,
})
class StepperHostComponent {
  step = 1;
}

describe('StepperComponent', () => {
  let fixture: ComponentFixture<StepperHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepperHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(StepperHostComponent);
    fixture.detectChanges();
  });

  it('muestra el panel activo, marca completado y no salta a un paso deshabilitado', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Tarifarios');
    expect(root.textContent).toContain('Panel Ausol');
    expect(root.textContent).not.toContain('Panel Aubasa');
    expect(root.querySelector('.is-completed .app-stepper__indicator')?.textContent).toContain('✓');
    expect(root.querySelector('.is-loading .app-stepper__indicator')?.textContent).toContain('…');

    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    tabs[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.step).toBe(2);
    expect(root.textContent).toContain('Panel Aubasa');

    tabs[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.step).toBe(2);
  });
});
