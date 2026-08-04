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
});
