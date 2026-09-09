import { Directive } from '@angular/core';

/** Marca el contenido proyectado como cuerpo expandible del panel. */
@Directive({
  selector: '[appAccordionContent]',
  standalone: true,
})
export class AccordionContentDirective {}
