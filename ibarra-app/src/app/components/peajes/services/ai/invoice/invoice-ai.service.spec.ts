import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../../../environments/environment';
import { InvoiceAiService } from './invoice-ai.service';
import { InvoiceAiError } from './invoice-ai.models';
import { OpenRouterEngineService } from '../openrouter/openrouter-engine.service';
import { OPENROUTER_CHAT_COMPLETIONS_URL } from '../openrouter/openrouter-engine.service';

function envelope(perceptions: { value: number; confidence: number }[] = []) {
  return {
    choices: [
      {
        message: {
          content: {
            invoice_number_candidates: [],
            invoice_date_candidates: [],
            vat_candidates: [],
            perception_candidates: perceptions,
            subtotal_candidates: [],
            total_candidates: [],
          },
        },
      },
    ],
  };
}

describe('InvoiceAiService', () => {
  let service: InvoiceAiService;
  let http: HttpTestingController;
  let previousModel: string;
  let previousKey: string;
  let previousKey2: string;
  let previousUrl: string;

  beforeEach(() => {
    previousUrl = environment.openRouterApiUrl;
    previousModel = environment.openRouterModel;
    previousKey = environment.openRouterApiKey;
    previousKey2 = environment.openRouterApiKey2;
    environment.openRouterApiUrl = OPENROUTER_CHAT_COMPLETIONS_URL;
    environment.openRouterModel = 'test/model';
    environment.openRouterApiKey = 'key-one';
    environment.openRouterApiKey2 = '';

    TestBed.configureTestingModule({
      providers: [
        InvoiceAiService,
        OpenRouterEngineService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InvoiceAiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.openRouterApiUrl = previousUrl;
    environment.openRouterModel = previousModel;
    environment.openRouterApiKey = previousKey;
    environment.openRouterApiKey2 = previousKey2;
  });

  it('posts chat completions to OpenRouter with text and expected net in the prompt', () => {
    service.analyze('Factura A', 100).subscribe();
    const request = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.url).not.toMatch(/netlify/i);
    expect(request.request.body.messages[1].content).toContain('Factura A');
    expect(request.request.body.messages[1].content).toContain('100');
    expect(JSON.stringify(request.request.body)).not.toMatch(/key-one|Authorization/i);
    request.flush(envelope());
  });

  it('ranks the model response without calling Netlify', () => {
    let rankedValues: number[] | undefined;
    service.analyze('Factura A', 1_000_000).subscribe((result) => {
      rankedValues = result.perceptions.map((candidate) => candidate.value);
    });
    const request = http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(request.request.url).toBe(OPENROUTER_CHAT_COMPLETIONS_URL);
    request.flush(
      envelope([
        { value: 95000, confidence: 0.9 },
        { value: 39800, confidence: 0.8 },
      ])
    );
    expect(rankedValues).toEqual([39800, 95000]);
  });

  it('maps transport errors to a user-safe InvoiceAiError', () => {
    let caught: InvoiceAiError | undefined;
    service.analyze('Factura A', 100).subscribe({
      error: (err) => {
        caught = err;
      },
    });
    http.expectOne(OPENROUTER_CHAT_COMPLETIONS_URL).flush(
      { error: 'Provider exploded with key-one' },
      { status: 502, statusText: 'Bad Gateway' }
    );
    expect(caught).toBeInstanceOf(InvoiceAiError);
    expect(caught?.code).toBe('provider');
    expect(caught?.message).toMatch(/factura/i);
    expect(caught?.message).not.toMatch(/key-one|Provider exploded/i);
  });
});
