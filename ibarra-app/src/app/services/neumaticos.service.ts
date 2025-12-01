import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegistroCambioNeumaticos } from '../models/neumaticos.model';

@Injectable({
  providedIn: 'root'
})
export class NeumaticosService {
  private http = inject(HttpClient);
  private webhookUrl = 'https://hook.us2.make.com/pvu4mxyfte7vfdngyk6ad664tjwcjz84';

  constructor() { }

  registrarCambio(datos: RegistroCambioNeumaticos): Observable<any> {
    return this.http.post(this.webhookUrl, datos);
  }
}

