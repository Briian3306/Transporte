import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { take } from 'rxjs/operators';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installableSubject = new BehaviorSubject<boolean>(false);
  private installedSubject = new BehaviorSubject<boolean>(false);

  public installable$: Observable<boolean> = this.installableSubject.asObservable();
  public installed$: Observable<boolean> = this.installedSubject.asObservable();

  private readonly STORAGE_KEY = 'pwa-install-dismissed';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Escuchar el evento beforeinstallprompt
    fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt')
      .pipe(take(1))
      .subscribe((event: BeforeInstallPromptEvent) => {
        // Prevenir el mini-infobar por defecto
        event.preventDefault();
        // Guardar el evento para usarlo después
        this.deferredPrompt = event;
        this.installableSubject.next(true);
      });

    // Detectar cuando la app se instala
    fromEvent(window, 'appinstalled')
      .pipe(take(1))
      .subscribe(() => {
        this.deferredPrompt = null;
        this.installableSubject.next(false);
        this.installedSubject.next(true);
        this.clearDismissedState();
      });

    // Verificar si la app ya está instalada
    this.checkIfInstalled();
  }

  /**
   * Verifica si la app ya está instalada
   */
  private checkIfInstalled(): void {
    // Detectar si está corriendo en modo standalone (instalada)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as any).standalone === true;
    
    if (isStandalone || isIosStandalone) {
      this.installedSubject.next(true);
      this.installableSubject.next(false);
    }
  }

  /**
   * Muestra el prompt de instalación nativo
   * @returns Promise que resuelve con true si el usuario acepta, false si rechaza
   */
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('No hay prompt de instalación disponible');
      return false;
    }

    try {
      // Mostrar el prompt de instalación
      await this.deferredPrompt.prompt();
      
      // Esperar la respuesta del usuario
      const { outcome } = await this.deferredPrompt.userChoice;
      
      // Limpiar el prompt usado
      this.deferredPrompt = null;
      this.installableSubject.next(false);

      return outcome === 'accepted';
    } catch (error) {
      console.error('Error al mostrar el prompt de instalación:', error);
      return false;
    }
  }

  /**
   * Verifica si la app es instalable
   */
  isInstallable(): boolean {
    return this.installableSubject.value;
  }

  /**
   * Verifica si la app ya está instalada
   */
  isInstalled(): boolean {
    return this.installedSubject.value;
  }

  /**
   * Marca que el usuario ha elegido no ver más el popup
   */
  dismissForever(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  /**
   * Verifica si el usuario ha marcado "No volver a mostrar"
   */
  isDismissedForever(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  /**
   * Limpia el estado de "No volver a mostrar"
   */
  clearDismissedState(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Verifica si se debe mostrar el popup de instalación
   */
  shouldShowInstallPrompt(): boolean {
    return this.isInstallable() && 
           !this.isInstalled() && 
           !this.isDismissedForever();
  }
}

