import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GranularPermissionService } from '../services/granular-permission.service';

@Directive({
  selector: '[appGranularPermission]',
  standalone: true
})
export class GranularPermissionDirective implements OnInit, OnDestroy {
  @Input() appGranularPermission: string = ''; // 'checklists:create'
  @Input() appPermissionAction: 'show' | 'hide' | 'disable' = 'hide';
  @Input() appPermissionFallback: 'show' | 'hide' = 'hide';
  
  private el: ElementRef = inject(ElementRef);
  private granularPermissionService = inject(GranularPermissionService);
  private subscription?: Subscription;

  ngOnInit() {
    // Verificar permisos inmediatamente
    this.updateElementVisibility();
    
    // Suscribirse solo a cambios de permisos
    this.subscription = this.granularPermissionService.userPermissions.subscribe(() => {
      this.updateElementVisibility();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private updateElementVisibility() {
    if (!this.appGranularPermission) {
      this.showElement();
      return;
    }

    const [module, action] = this.appGranularPermission.split(':');
    const hasPermission = this.granularPermissionService.hasPermission(module, action);
    switch (this.appPermissionAction) {
      case 'show':
        if (hasPermission) {
          this.showElement();
        } else {
          this.hideElement();
        }
        break;
        
      case 'hide':
        if (hasPermission) {
          this.hideElement();
        } else {
          this.showElement();
        }
        break;
        
      case 'disable':
        if (hasPermission) {
          this.enableElement();
        } else {
          this.disableElement();
        }
        break;
    }
  }

  private showElement() {
    this.el.nativeElement.style.display = '';
    this.el.nativeElement.style.visibility = 'visible';
    this.el.nativeElement.hidden = false;
  }

  private hideElement() {
    this.el.nativeElement.style.display = 'none';
    this.el.nativeElement.style.visibility = 'hidden';
    this.el.nativeElement.hidden = true;
  }

  private enableElement() {
    this.el.nativeElement.disabled = false;
    this.el.nativeElement.style.opacity = '1';
    this.el.nativeElement.style.pointerEvents = 'auto';
  }

  private disableElement() {
    this.el.nativeElement.disabled = true;
    this.el.nativeElement.style.opacity = '0.5';
    this.el.nativeElement.style.pointerEvents = 'none';
  }
}
