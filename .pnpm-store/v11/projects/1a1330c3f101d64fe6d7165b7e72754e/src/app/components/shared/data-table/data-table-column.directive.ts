import { Directive, Input, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: 'ng-template[appDataTableColumn]',
  standalone: true,
})
export class DataTableColumnDirective {
  readonly template = inject(TemplateRef<unknown>);

  @Input({ alias: 'appDataTableColumn', required: true })
  columnKey!: string;
}
