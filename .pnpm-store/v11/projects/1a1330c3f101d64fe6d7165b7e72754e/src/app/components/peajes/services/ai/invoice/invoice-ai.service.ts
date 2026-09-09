import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { InvoiceAiResult } from './invoice-ai.models';
import { rankInvoiceCandidates } from './invoice-confidence.engine';
import { OpenRouterEngineService } from '../openrouter/openrouter-engine.service';

@Injectable({ providedIn: 'root' })
export class InvoiceAiService {
  private readonly engine = inject(OpenRouterEngineService);

  analyze(invoiceText: string, expectedNetAmount: number): Observable<InvoiceAiResult> {
    return this.engine
      .analyze(invoiceText, expectedNetAmount)
      .pipe(map((raw) => rankInvoiceCandidates(raw, expectedNetAmount)));
  }
}
