import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

describe('DialogComponent', () => {
  let fixture: ComponentFixture<DialogComponent>;
  let component: DialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.title = 'Crear estación';
    fixture.detectChanges();
  });

  it('emits closed on close()', () => {
    const spy = jasmine.createSpy('closed');
    component.closed.subscribe(spy);
    component.close();
    expect(spy).toHaveBeenCalled();
  });

  it('emits closed on Escape', () => {
    const spy = jasmine.createSpy('closed');
    component.closed.subscribe(spy);
    component.onEsc();
    expect(spy).toHaveBeenCalled();
  });

  it('defaults to md size and center placement', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.app-dialog--xl')).toBeNull();
    expect(root.querySelector('.app-dialog--lg')).toBeNull();
    expect(root.querySelector('.app-dialog-backdrop--top')).toBeNull();
  });

  it('applies xl size and top placement classes', () => {
    component.size = 'xl';
    component.placement = 'top';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.app-dialog--xl')).toBeTruthy();
    expect(root.querySelector('.app-dialog-backdrop--top')).toBeTruthy();
    expect(root.querySelector('.app-dialog--top')).toBeTruthy();
  });

  it('does not close on backdrop when closeOnBackdrop is false', () => {
    const spy = jasmine.createSpy('closed');
    component.closed.subscribe(spy);
    component.closeOnBackdrop = false;
    component.onBackdropClick();
    expect(spy).not.toHaveBeenCalled();
  });
});
