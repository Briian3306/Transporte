import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PwaInstallService } from '../../services/pwa-install.service';

@Component({
  selector: 'app-pwa-install-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pwa-install-popup.component.html',
  styleUrls: ['./pwa-install-popup.component.scss']
})
export class PwaInstallPopupComponent {
  private pwaService = inject(PwaInstallService);

  @Output() closed = new EventEmitter<void>();
  @Output() installed = new EventEmitter<boolean>();

  isVisible = true;
  dontShowAgain = false;
  isInstalling = false;

  async onInstall(): Promise<void> {
    this.isInstalling = true;
    
    try {
      const accepted = await this.pwaService.promptInstall();
      
      if (accepted) {
        // Usuario aceptó la instalación
        this.installed.emit(true);
        this.close();
      } else {
        // Usuario rechazó
        this.isInstalling = false;
        if (this.dontShowAgain) {
          this.pwaService.dismissForever();
        }
        this.close();
      }
    } catch (error) {
      console.error('Error durante la instalación:', error);
      this.isInstalling = false;
    }
  }

  onLater(): void {
    if (this.dontShowAgain) {
      this.pwaService.dismissForever();
    }
    this.close();
  }

  close(): void {
    this.isVisible = false;
    // Esperar a que termine la animación antes de emitir el evento
    setTimeout(() => {
      this.closed.emit();
    }, 300);
  }
}

