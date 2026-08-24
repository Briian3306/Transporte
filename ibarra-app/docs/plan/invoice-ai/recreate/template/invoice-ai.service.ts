// invoice-ai.service.ts

import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  OpenRouterEngineService
} from './openrouter-engine.service';

import {
  systemInvoiceReadingPrompt
} from './invoice-prompts';

import {
  INVOICE_ASSISTED_READING_SCHEMA
} from './invoice-schema';


export interface InvoiceCandidate<T> {
  value: T;
  confidence: number;
}


export interface InvoiceAiResponse {

  invoice_number_candidates:
    InvoiceCandidate<string>[];

  invoice_date_candidates:
    InvoiceCandidate<string>[];

  vat_candidates:
    InvoiceCandidate<number>[];

  perception_candidates:
    InvoiceCandidate<number>[];

  total_candidates:
    InvoiceCandidate<number>[];

}


@Injectable({
  providedIn: 'root'
})
export class InvoiceAiService {

  private readonly aiEngine =
    inject(OpenRouterEngineService);


  analyzeInvoice(
    invoiceText: string,
    expectedNetAmount: number
  ): Observable<InvoiceAiResponse> {


    const userPrompt = `
EXPECTED NET AMOUNT:
${expectedNetAmount}

INVOICE TEXT:
${invoiceText}
`;


    return this.aiEngine
      .executeStructured<InvoiceAiResponse>({

        // Qué debe hacer la IA
        systemPrompt:
          systemInvoiceReadingPrompt,

        // Datos concretos de esta factura
        userPrompt,

        // Forma obligatoria de respuesta
        responseFormat:
          INVOICE_ASSISTED_READING_SCHEMA,

        // Solo para logs
        context:
          'INVOICE_READING',

        temperature:
          0.2

      });

  }

}