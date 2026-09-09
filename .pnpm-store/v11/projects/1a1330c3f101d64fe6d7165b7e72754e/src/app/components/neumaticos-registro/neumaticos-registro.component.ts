import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NeumaticosService } from '../../services/neumaticos.service';
import { RegistroCambioNeumaticos } from '../../models/neumaticos.model';

@Component({
  selector: 'app-neumaticos-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './neumaticos-registro.component.html'
})
export class NeumaticosRegistroComponent implements OnInit {
  private fb = inject(FormBuilder);
  private neumaticosService = inject(NeumaticosService);

  registroForm!: FormGroup;
  isSubmitting = false;

  ngOnInit() {
    this.initForm();
    this.addNeumatico(); // Start with one tire
    this.setupValueChanges();
  }

  private initForm() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().split(' ')[0].substring(0, 5);

    this.registroForm = this.fb.group({
      fecha: [dateStr, Validators.required],
      hora: [timeStr, Validators.required],
      tipoVehiculo: ['', Validators.required],
      patenteCamion: [''],
      patenteSemi: [''],
      odometro: ['', [Validators.required, Validators.min(0)]],
      neumaticos: this.fb.array([]),
      neumaticosRetirados: this.fb.array([])
    });
  }

  get neumaticos(): FormArray {
    return this.registroForm.get('neumaticos') as FormArray;
  }

  get neumaticosRetirados(): FormArray {
    return this.registroForm.get('neumaticosRetirados') as FormArray;
  }

  private setupValueChanges() {
    // Conditional validation for patentes based on tipoVehiculo
    this.registroForm.get('tipoVehiculo')?.valueChanges.subscribe(tipo => {
      const patenteCamion = this.registroForm.get('patenteCamion');
      const patenteSemi = this.registroForm.get('patenteSemi');

      if (tipo === 'CAMION') {
        patenteCamion?.setValidators([Validators.required]);
        patenteSemi?.clearValidators();
      } else if (tipo === 'SEMIRREMOLQUE') {
        patenteCamion?.setValidators([Validators.required]);
        patenteSemi?.setValidators([Validators.required]);
      } else {
        patenteCamion?.clearValidators();
        patenteSemi?.clearValidators();
      }
      patenteCamion?.updateValueAndValidity();
      patenteSemi?.updateValueAndValidity();
    });
  }

  // --- Neumáticos a Instalar ---

  newNeumaticoGroup(): FormGroup {
    const group = this.fb.group({
      ejeCamion: ['', Validators.required],
      ladoEje: ['', Validators.required],
      estadoBanda: ['NUEVO', Validators.required],
      tipoNeumatico: ['', Validators.required],
      // Fields for IDENTIFICADO
      idNeumatico: [''],
      // Fields for NO_IDENTIFICADO
      numeroSerie: [''],
      dot: [''],
      marca: [''],
      modelo: ['']
    });

    this.setupNeumaticoValidation(group);
    return group;
  }

  addNeumatico() {
    this.neumaticos.push(this.newNeumaticoGroup());
  }

  removeNeumatico(index: number) {
    if (this.neumaticos.length > 1) {
      this.neumaticos.removeAt(index);
    } else {
      alert('Debe haber al menos un neumático.');
    }
  }

  copyNeumatico(index: number) {
    const original = this.neumaticos.at(index).value;
    const group = this.newNeumaticoGroup();
    
    // Copy values except unique IDs
    group.patchValue({
      ejeCamion: original.ejeCamion,
      ladoEje: original.ladoEje,
      estadoBanda: original.estadoBanda,
      tipoNeumatico: original.tipoNeumatico,
      // Don't copy idNeumatico usually, but maybe copy details if NO_IDENTIFICADO?
      // Following original logic: 
      numeroSerie: original.numeroSerie,
      dot: original.dot,
      marca: original.marca,
      modelo: original.modelo
    });
    
    this.neumaticos.insert(index + 1, group);
  }

  private setupNeumaticoValidation(group: FormGroup) {
    group.get('tipoNeumatico')?.valueChanges.subscribe(tipo => {
      const idNeumatico = group.get('idNeumatico');
      const numeroSerie = group.get('numeroSerie');
      const dot = group.get('dot');
      const marca = group.get('marca');
      const modelo = group.get('modelo');

      if (tipo === 'IDENTIFICADO') {
        idNeumatico?.setValidators([Validators.required]);
        numeroSerie?.clearValidators();
        dot?.clearValidators();
        marca?.clearValidators();
        modelo?.clearValidators();
      } else if (tipo === 'NO_IDENTIFICADO') {
        idNeumatico?.clearValidators();
        numeroSerie?.setValidators([Validators.required]);
        dot?.setValidators([Validators.required]);
        marca?.setValidators([Validators.required]);
        modelo?.setValidators([Validators.required]);
      } else {
        idNeumatico?.clearValidators();
        numeroSerie?.clearValidators();
        dot?.clearValidators();
        marca?.clearValidators();
        modelo?.clearValidators();
      }

      idNeumatico?.updateValueAndValidity();
      numeroSerie?.updateValueAndValidity();
      dot?.updateValueAndValidity();
      marca?.updateValueAndValidity();
      modelo?.updateValueAndValidity();
    });
  }

  // --- Neumáticos Retirados ---

  newNeumaticoRetiradoGroup(): FormGroup {
    const group = this.fb.group({
      tipoNeumatico: ['', Validators.required],
      destino: ['', Validators.required],
      motivo: ['', Validators.required],
      observaciones: [''],
      // Fields for IDENTIFICADO
      id: [''],
      // Fields for NO_IDENTIFICADO
      serie: [''],
      dot: [''],
      marca: [''],
      modelo: ['']
    });

    this.setupNeumaticoRetiradoValidation(group);
    return group;
  }

  addNeumaticoRetirado() {
    this.neumaticosRetirados.push(this.newNeumaticoRetiradoGroup());
  }

  removeNeumaticoRetirado(index: number) {
    this.neumaticosRetirados.removeAt(index);
  }

  copyNeumaticoRetirado(index: number) {
    const original = this.neumaticosRetirados.at(index).value;
    const group = this.newNeumaticoRetiradoGroup();
    
    group.patchValue({
      tipoNeumatico: original.tipoNeumatico,
      destino: original.destino,
      motivo: original.motivo,
      // Don't copy observations usually
      serie: original.serie,
      dot: original.dot,
      marca: original.marca,
      modelo: original.modelo
    });
    
    this.neumaticosRetirados.insert(index + 1, group);
  }

  private setupNeumaticoRetiradoValidation(group: FormGroup) {
    group.get('tipoNeumatico')?.valueChanges.subscribe(tipo => {
      const id = group.get('id');
      const serie = group.get('serie');
      const dot = group.get('dot');
      const marca = group.get('marca');
      const modelo = group.get('modelo');

      if (tipo === 'IDENTIFICADO') {
        id?.setValidators([Validators.required]);
        serie?.clearValidators();
        dot?.clearValidators();
        marca?.clearValidators();
        modelo?.clearValidators();
      } else if (tipo === 'NO_IDENTIFICADO') {
        id?.clearValidators();
        serie?.setValidators([Validators.required]);
        dot?.setValidators([Validators.required]);
        marca?.setValidators([Validators.required]);
        modelo?.setValidators([Validators.required]);
      } else {
        id?.clearValidators();
        serie?.clearValidators();
        dot?.clearValidators();
        marca?.clearValidators();
        modelo?.clearValidators();
      }

      id?.updateValueAndValidity();
      serie?.updateValueAndValidity();
      dot?.updateValueAndValidity();
      marca?.updateValueAndValidity();
      modelo?.updateValueAndValidity();
    });
  }

  // --- Utilities ---

  toUpperCase(event: any) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.toUpperCase();
    // Also update form control value if needed, though standard HTML input usually propagates.
    // Reactive forms need explicit update sometimes if we manipulate DOM value directly.
    const controlName = input.getAttribute('formControlName');
    // Better approach: use CSS text-transform: uppercase for display, and handle data transformation on submit.
    // Or simple input handler:
    this.registroForm.get(controlName!)?.setValue(input.value, { emitEvent: false });
  }

  onSubmit() {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      alert('Por favor, complete todos los campos requeridos.');
      return;
    }

    this.isSubmitting = true;
    
    const formValue = this.registroForm.value;
    
    // Process data (e.g. uppercase)
    const datos: RegistroCambioNeumaticos = {
      ...formValue,
      patenteCamion: formValue.patenteCamion?.toUpperCase(),
      patenteSemi: formValue.patenteSemi?.toUpperCase(),
      neumaticos: formValue.neumaticos.map((n: any) => ({
        ...n,
        idNeumatico: n.idNeumatico?.toUpperCase(),
        numeroSerie: n.numeroSerie?.toUpperCase(),
        dot: n.dot?.toUpperCase(),
        marca: n.marca?.toUpperCase(),
        modelo: n.modelo?.toUpperCase()
      })),
      neumaticosRetirados: formValue.neumaticosRetirados.map((n: any) => ({
        ...n,
        id: n.id?.toUpperCase(),
        serie: n.serie?.toUpperCase(),
        dot: n.dot?.toUpperCase(),
        marca: n.marca?.toUpperCase(),
        modelo: n.modelo?.toUpperCase()
      })),
      type: 'cambio-neumatico'
    };

    console.log('Datos a enviar:', datos);

    this.neumaticosService.registrarCambio(datos).subscribe({
      next: (response) => {
        alert('Formulario enviado correctamente');
        this.resetForm();
      },
      error: (error) => {
        console.error('Error:', error);
        alert('Error al enviar el formulario. Por favor, inténtelo de nuevo.');
        this.isSubmitting = false;
      }
    });
  }

  resetForm() {
    this.isSubmitting = false;
    // Reset form but keep defaults
    this.registroForm.reset();
    this.neumaticos.clear();
    this.neumaticosRetirados.clear();
    this.initForm();
    this.addNeumatico();
    this.setupValueChanges();
  }
}

