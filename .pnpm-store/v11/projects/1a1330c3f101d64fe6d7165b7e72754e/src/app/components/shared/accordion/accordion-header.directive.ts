import { Directive } from '@angular/core';

/** Marca el contenido proyectado como encabezado del panel. */
@Directive({
  selector: '[appAccordionHeader]',
  standalone: true,
})
export class AccordionHeaderDirective {}
