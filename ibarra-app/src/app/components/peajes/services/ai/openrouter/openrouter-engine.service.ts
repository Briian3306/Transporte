import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, map, throwError, timeout } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import {
  InvoiceAiError,
  OpenRouterInvoiceResponse,
} from '../invoice/invoice-ai.models';
import {
  buildInvoiceUserPrompt,
  systemInvoiceReadingPrompt,
} from '../invoice/invoice-ai.prompt';
import { INVOICE_ASSISTED_READING_SCHEMA } from '../invoice/invoice-ai.schema';

export const OPENROUTER_CHAT_COMPLETIONS_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const MAX_INVOICE_TEXT_CHARS = 200_000;
const REQUEST_TIMEOUT_MS = 120_000;

const ERRORS = {
  invalid: 'Pedido inválido.',
  config: 'El servicio de IA no está configurado.',
  rateLimited: 'El servicio de IA está temporalmente saturado.',
  provider: 'No se pudo analizar la factura. Completá el documento a mano o reintentá.',
};

@Injectable({ providedIn: 'root' })
export class OpenRouterEngineService {
  private readonly http = inject(HttpClient);

  analyze(
    invoiceText: string,
    expectedNetAmount: number
  ): Observable<OpenRouterInvoiceResponse> {
    const text = typeof invoiceText === 'string' ? invoiceText.trim() : '';
    if (!text || text.length > MAX_INVOICE_TEXT_CHARS) {
      return throwError(() => new InvoiceAiError(ERRORS.invalid, 'invalid'));
    }
    if (!Number.isFinite(expectedNetAmount) || expectedNetAmount <= 0) {
      return throwError(() => new InvoiceAiError(ERRORS.invalid, 'invalid'));
    }

    const apiUrl = environment.openRouterApiUrl || OPENROUTER_CHAT_COMPLETIONS_URL;
    const model = environment.openRouterModel;
    const key1 = environment.openRouterApiKey;
    const key2 = environment.openRouterApiKey2;
    if (!model || !key1) {
      return throwError(() => new InvoiceAiError(ERRORS.config, 'provider'));
    }

    const body = this.buildPayload(text, expectedNetAmount, model);
    const keys: string[] = [key1];
    if (key2 && key2 !== key1) {
      keys.push(key2);
    }

    return this.postOnce(apiUrl, keys[0], body).pipe(
      catchError((error) => {
        if (keys.length > 1 && this.isRecoverable(error)) {
          return this.postOnce(apiUrl, keys[1], body);
        }
        return throwError(() => this.toInvoiceAiError(error));
      })
    );
  }

  private postOnce(
    apiUrl: string,
    apiKey: string,
    body: Record<string, unknown>
  ): Observable<OpenRouterInvoiceResponse> {
    return this.http
      .post<unknown>(apiUrl, body, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.appOrigin(),
          'X-Title': 'Ibarra Peajes',
        },
      })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((data) => {
          const providerMessage = this.extractProviderMessage(data);
          if (providerMessage) {
            throw Object.assign(new Error(providerMessage), {
              status: this.statusFromProviderMessage(providerMessage),
              providerMessage,
            });
          }
          try {
            return this.parseStructured(data);
          } catch {
            throw new InvoiceAiError(ERRORS.provider, 'provider');
          }
        })
      );
  }

  private buildPayload(
    invoiceText: string,
    expectedNetAmount: number,
    model: string
  ): Record<string, unknown> {
    return {
      model,
      messages: [
        { role: 'system', content: systemInvoiceReadingPrompt },
        {
          role: 'user',
          content: buildInvoiceUserPrompt(invoiceText, expectedNetAmount),
        },
      ],
      temperature: 0.2,
      response_format: INVOICE_ASSISTED_READING_SCHEMA,
      provider: { require_parameters: true },
    };
  }

  private parseStructured(data: unknown): OpenRouterInvoiceResponse {
    const record = asRecord(data);
    const content = nested(record, ['choices', '0', 'message', 'content']);
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      return this.asInvoiceResponse(content);
    }
    let jsonString = '';
    if (typeof content === 'string') {
      jsonString = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    } else if (Array.isArray(content)) {
      jsonString = content.map((item) => asRecord(item)?.['text'] ?? '').join('');
    } else if (record && Array.isArray(record['invoice_number_candidates'])) {
      return this.asInvoiceResponse(record);
    }
    if (!jsonString) {
      throw new Error('empty');
    }
    return this.asInvoiceResponse(JSON.parse(jsonString) as object);
  }

  private asInvoiceResponse(value: object): OpenRouterInvoiceResponse {
    const record = value as OpenRouterInvoiceResponse;
    if (!Array.isArray(record.invoice_number_candidates)) {
      throw new Error('empty');
    }
    return record;
  }

  private extractProviderMessage(data: unknown): string {
    const record = asRecord(data);
    if (!record) {
      return '';
    }
    const error = record['error'];
    if (error && typeof error === 'object') {
      return String(asRecord(error)?.['message'] || '');
    }
    if (typeof error === 'string') {
      return error;
    }
    const choices = record['choices'];
    if (!Array.isArray(choices)) {
      return '';
    }
    const choice = choices.find(
      (item) =>
        asRecord(item)?.['error'] || asRecord(item)?.['finish_reason'] === 'error'
    );
    const choiceError = asRecord(asRecord(choice)?.['error']);
    return choiceError?.['message'] ? String(choiceError['message']) : '';
  }

  private statusFromProviderMessage(message: string): number {
    const lower = message.toLowerCase();
    if (lower.includes('rate') || lower.includes('429')) {
      return 429;
    }
    return 502;
  }

  private isRecoverable(error: unknown): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof InvoiceAiError) {
      return error.code === 'network' || error.code === 'rate_limited';
    }
    const httpError = error as HttpErrorResponse;
    const status = httpError?.status;
    if (status === 0 || status === 429 || status === 408 || status === 404) {
      return true;
    }
    if (Number.isFinite(status) && status >= 500 && status <= 599) {
      return true;
    }
    const message = String(
      (error as { providerMessage?: string; message?: string })?.providerMessage ||
        httpError?.message ||
        ''
    ).toLowerCase();
    return (
      message.includes('provider returned error') ||
      message.includes('no endpoints found')
    );
  }

  private toInvoiceAiError(error: unknown): InvoiceAiError {
    if (error instanceof InvoiceAiError) {
      return error;
    }
    if (error instanceof TimeoutError) {
      return new InvoiceAiError(ERRORS.provider, 'provider');
    }
    const httpError = error as HttpErrorResponse;
    const status = httpError?.status;
    if (status === 429) {
      return new InvoiceAiError(ERRORS.rateLimited, 'rate_limited');
    }
    if (status === 400) {
      return new InvoiceAiError(ERRORS.invalid, 'invalid');
    }
    if (status === 0) {
      return new InvoiceAiError(ERRORS.provider, 'network');
    }
    return new InvoiceAiError(ERRORS.provider, 'provider');
  }

  private appOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'https://ibarra-app.local';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function nested(record: Record<string, unknown> | null, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (Array.isArray(current)) {
      current = current[Number(key)];
      continue;
    }
    const next = asRecord(current);
    if (!next) {
      return undefined;
    }
    current = next[key];
  }
  return current;
}
