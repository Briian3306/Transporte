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

interface OpenRouterAttempt {
  model: string;
  key: string;
}

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
    const model1 = environment.openRouterModel;
    const model2 = environment.openRouterModel2;
    const key1 = environment.openRouterApiKey;
    const key2 = environment.openRouterApiKey2;
    if (!model1 || !key1) {
      return throwError(() => new InvoiceAiError(ERRORS.config, 'provider'));
    }

    const attempts = this.buildAttempts(model1, model2, key1, key2);
    const run = (index: number): Observable<OpenRouterInvoiceResponse> => {
      const attempt = attempts[index];
      const body = this.buildPayload(text, expectedNetAmount, attempt.model);
      return this.postOnce(apiUrl, attempt.key, body).pipe(
        catchError((error) => {
          const next = attempts[index + 1];
          if (next && this.isRecoverable(error)) {
            return run(index + 1);
          }
          return throwError(() => this.toInvoiceAiError(error));
        })
      );
    };

    return run(0);
  }

  private buildAttempts(
    model1: string,
    model2: string,
    key1: string,
    key2: string
  ): OpenRouterAttempt[] {
    const attempts: OpenRouterAttempt[] = [{ model: model1, key: key1 }];
    if (key2 && key2 !== key1) {
      attempts.push({ model: model1, key: key2 });
    }
    if (model2 && model2 !== model1) {
      attempts.push({ model: model2, key: key1 });
    }
    return attempts;
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
              status: this.providerStatus(data, providerMessage),
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

  private providerStatus(data: unknown, message: string): number {
    const record = asRecord(data);
    const topCode = asRecord(record?.['error'])?.['code'];
    if (topCode === 429 || topCode === '429') {
      return 429;
    }
    const choices = record?.['choices'];
    if (Array.isArray(choices)) {
      const choice = choices.find(
        (item) =>
          asRecord(item)?.['error'] || asRecord(item)?.['finish_reason'] === 'error'
      );
      const choiceCode = asRecord(asRecord(choice)?.['error'])?.['code'];
      if (choiceCode === 429 || choiceCode === '429') {
        return 429;
      }
    }
    return this.statusFromProviderMessage(message);
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
    const shape = errorShape(error);
    const status = shape.status;
    const bodyCode = shape.bodyCode;
    if (status === 400) {
      return false;
    }
    if (status === 0 || status === 429 || status === 408 || status === 404 || bodyCode === 429 || bodyCode === '429') {
      return true;
    }
    if (typeof status === 'number' && Number.isFinite(status) && status >= 500 && status <= 599) {
      return true;
    }
    const message = String(
      (error as { providerMessage?: string })?.providerMessage || shape.bodyMessage || ''
    ).toLowerCase();
    return (
      message.includes('provider returned error') ||
      message.includes('no endpoints found') ||
      message.includes('rate') ||
      message.includes('429')
    );
  }

  private toInvoiceAiError(error: unknown): InvoiceAiError {
    if (error instanceof InvoiceAiError) {
      return error;
    }
    if (error instanceof TimeoutError) {
      return new InvoiceAiError(ERRORS.provider, 'provider');
    }
    const shape = errorShape(error);
    const status = shape.status;
    const bodyCode = shape.bodyCode;
    if (status === 429 || bodyCode === 429 || bodyCode === '429') {
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

function errorShape(error: unknown): {
  status: number | null;
  bodyCode: unknown;
  bodyMessage: string;
} {
  const httpError = error as HttpErrorResponse;
  const body = httpError?.error as Record<string, unknown> | string | undefined;
  const nested =
    body && typeof body === 'object' && !Array.isArray(body)
      ? ((body['error'] as Record<string, unknown> | undefined) ?? body)
      : null;
  const bodyMessage =
    typeof nested?.['message'] === 'string'
      ? nested['message']
      : typeof body === 'string'
        ? body
        : String((error as { message?: string })?.message || '');
  return {
    status: httpError?.status ?? null,
    bodyCode: nested?.['code'] ?? nested?.['status'] ?? null,
    bodyMessage,
  };
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
