import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GranularPermissionService } from '../services/granular-permission.service';

@Directive({
  selector: '[appRoleBased]',
  standalone: true
})
export class RoleBasedDirective implements OnInit, OnDestroy {
  @Input() appRoleBased: string | string[] = ''; // 'admin' o ['admin', 'administrador']
  @Input() appRoleAction: 'show' | 'hide' | 'disable' = 'hide';
  @Input() appRoleExclude: boolean = false; // Si true, oculta para los roles especificados
  
  private el: ElementRef = inject(ElementRef);
  private granularPermissionService = inject(GranularPermissionService);
  private subscription?: Subscription;

  ngOnInit() {
    this.subscription = this.granularPermissionService.currentUserProfile.subscribe(() => {
      this.updateElementVisibility();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private updateElementVisibility() {
    if (!this.appRoleBased) {
      this.showElement();
      return;
    }

    const allowedRoles = Array.isArray(this.appRoleBased) ? this.appRoleBased : [this.appRoleBased];
    const currentRole = this.granularPermissionService.getCurrentRole();
    const hasRole = currentRole && allowedRoles.includes(currentRole);
    
    const shouldShow = this.appRoleExclude ? !hasRole : hasRole;
    
    switch (this.appRoleAction) {
      case 'show':
        if (shouldShow) {
          this.showElement();
        } else {
          this.hideElement();
        }
        break;
        
      case 'hide':
        if (shouldShow) {
          this.hideElement();
        } else {
          this.showElement();
        }
        break;
        
      case 'disable':
        if (shouldShow) {
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
