import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../../../environments/environment';
import { InvoiceAiError } from '../invoice/invoice-ai.models';
import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  OpenRouterEngineService,
} from './openrouter-engine.service';

describe('OpenRouterEngineService', () => {
  let service: OpenRouterEngineService;
  let http: HttpTestingController;
  let previousUrl: string;
  let previousModel: string;
  let previousModel2: string;
  let previousKey: string;
  let previousKey2: string;

  beforeEach(() => {
    previousUrl = environment.openRouterApiUrl;
    previousModel = environment.openRouterModel;
    previousModel2 = environment.openRouterModel2;
    previousKey = environment.openRouterApiKey;
    previousKey2 = environment.openRouterApiKey2;
    environment.openRouterApiUrl = OPENROUTER_CHAT_COMPLETIONS_URL;
    environment.openRouterModel = 'test/model';
    environment.openRouterModel2 = 'test/model-2';
    environment.openRouterApiKey = 'key-one';
    environment.openRouterApiKey2 = 'key-two';

    TestBed.configureTestingModule({
      providers: [OpenRouterEngineService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OpenRouterEngineService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.openRouterApiUrl = previousUrl;
    environment.openRouterModel = previousModel;
    environment.openRouterModel2 = previousModel2;
    environment.openRouterApiKey = previousKey;
    environment.openRouterApiKey2 = previousKey2;
  });

  it('posts structured chat payload to OpenRouter, not Netlify', () => {
    service.analyze('Factura A', 100).subscribe();
    const request = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.url).not.toMatch(/netlify/i);
    expect(request.request.body.model).toBe('test/model');
    expect(request.request.body.messages?.length).toBe(2);
    expect(request.request.body.response_format).toBeTruthy();
    expect(request.request.headers.get('Authorization')).toBe('Bearer key-one');
    expect(JSON.stringify(request.request.body)).not.toMatch(/key-one|key-two|Authorization/i);
    request.flush(successBody());
  });

  it('uses key 2 only after a recoverable key 1 failure', () => {
    service.analyze('Factura A', 100).subscribe();
    const first = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(first.request.headers.get('Authorization')).toBe('Bearer key-one');
    expect(first.request.body.model).toBe('test/model');
    first.flush({ error: 'upstream' }, { status: 503, statusText: 'Unavailable' });
    const second = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(second.request.headers.get('Authorization')).toBe('Bearer key-two');
    expect(second.request.body.model).toBe('test/model');
    second.flush(successBody('0001-00001234'));
  });

  it('on 429 retries model 1 + key 2, then model 2 + key 1', () => {
    let result: unknown;
    service.analyze('Factura A', 100).subscribe({
      next: (value) => {
        result = value;
      },
    });

    const first = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expectAttempt(first, 'test/model', 'key-one');
    flushRateLimit(first);

    const second = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expectAttempt(second, 'test/model', 'key-two');
    flushRateLimit(second);

    const third = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expectAttempt(third, 'test/model-2', 'key-one');
    third.flush(successBody('0001-00001234'));

    expect(result).toEqual(
      jasmine.objectContaining({
        invoice_number_candidates: [{ value: '0001-00001234', confidence: 0.9 }],
      })
    );
  });

  it('does not call model 2 when key 2 succeeds after 429', () => {
    service.analyze('Factura A', 100).subscribe();
    const first = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expectAttempt(first, 'test/model', 'key-one');
    flushRateLimit(first);
    const second = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expectAttempt(second, 'test/model', 'key-two');
    second.flush(successBody('0001-00001234'));
    http.expectNone(OPENROUTER_CHAT_COMPLETIONS_URL);
  });

  it('does not retry key 2 after a 400', () => {
    let caught: InvoiceAiError | undefined;
    service.analyze('Factura A', 100).subscribe({
      error: (err) => {
        caught = err;
      },
    });
    http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL).flush(
      { error: 'bad request' },
      { status: 400, statusText: 'Bad Request' }
    );
    http.expectNone(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(caught).toBeInstanceOf(InvoiceAiError);
    expect(caught?.code).toBe('invalid');
  });
});

function successBody(invoiceNumber?: string) {
  return {
    choices: [
      {
        message: {
          content: {
            invoice_number_candidates: invoiceNumber
              ? [{ value: invoiceNumber, confidence: 0.9 }]
              : [],
            invoice_date_candidates: [],
            vat_candidates: [],
            perception_candidates: [],
            subtotal_candidates: [],
            total_candidates: [],
          },
        },
      },
    ],
  };
}

function flushRateLimit(request: TestRequest): void {
  request.flush(
    { error: { message: 'Rate limit exceeded', code: 429 } },
    { status: 429, statusText: 'Too Many Requests' }
  );
}

function expectAttempt(request: TestRequest, model: string, key: string): void {
  expect(request.request.body.model).toBe(model);
  expect(request.request.headers.get('Authorization')).toBe(`Bearer ${key}`);
}
