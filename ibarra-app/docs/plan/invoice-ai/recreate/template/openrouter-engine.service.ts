
import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders
} from '@angular/common/http';

import {
  Observable,
  firstValueFrom,
  throwError,
  timeout
} from 'rxjs';

import { environment } from 'src/app/environments/environments';


/**
 * Respuesta mínima que necesitamos de OpenRouter.
 */
interface OpenRouterResponse {
  choices?: Array<{
    finish_reason?: string | null;

    error?: OpenRouterError;

    message?: {
      content?: string | Array<{
        type?: string;
        text?: string;
      }>;
    };
  }>;

  error?: OpenRouterError;
}


interface OpenRouterError {
  code?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}


/**
 * Representa una combinación:
 *
 * modelo + apiKey + cantidad de intentos
 */
interface ModelAttempt {
  model: string;
  apiKey: string;
  maxAttempts: number;
  label: string;
}


/**
 * Query genérica.
 *
 * El motor NO sabe si estamos leyendo:
 * - facturas
 * - productos
 * - tickets
 * - documentos
 *
 * Solo ejecuta la IA.
 */
export interface AiQuery {
  systemPrompt: string;
  userPrompt: string;

  responseFormat: unknown;

  /**
   * Solo sirve para logs.
   *
   * Ejemplo:
   * INVOICE_READING
   */
  context?: string;

  temperature?: number;
}


export const AI_RATE_LIMITED_ERROR_NAME = 'AI_RATE_LIMITED';


@Injectable({
  providedIn: 'root'
})
export class OpenRouterEngineService {

  private readonly http = inject(HttpClient);


  // ==========================================================
  // CONFIG
  // ==========================================================

  private readonly apiUrl =
    environment.openRouterApiUrl ??
    'https://openrouter.ai/api/v1/chat/completions';


  private readonly apiKey1 =
    environment.openRouterApiKey;

  private readonly apiKey2 =
    environment.openRouterApiKey_2;


  /**
   * Orden de fallback.
   *
   * Si MODEL_1 falla:
   * MODEL_2
   * MODEL_3
   */
  private readonly models = [
    {
      model: 'openrouter/owl-alpha',
      maxAttempts: 1,
      label: 'model_1'
    },
    {
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      maxAttempts: 2,
      label: 'model_2'
    },
    {
      model: 'nex-agi/nex-n2-pro:free',
      maxAttempts: 2,
      label: 'model_3'
    }
  ];


  private readonly DEFAULT_RETRY_DELAY_MS = 15_000;

  private readonly MAX_RETRY_DELAY_MS = 60_000;

  private readonly REQUEST_TIMEOUT_MS = 3 * 60 * 1000;


  // ==========================================================
  // PUBLIC API
  // ==========================================================

  /**
   * Método principal.
   *
   * Recibe una query y devuelve directamente el JSON
   * generado por Structured Output.
   */
  executeStructured<T>(
    query: AiQuery
  ): Observable<T> {

    const messages = [
      {
        role: 'system' as const,
        content: query.systemPrompt
      },
      {
        role: 'user' as const,
        content: query.userPrompt
      }
    ];


    return new Observable<T>((observer) => {

      this.executeWithFallback(
        messages,
        query.responseFormat,
        query.context ?? 'AI_QUERY',
        query.temperature ?? 0.2
      )
        .subscribe({

          next: response => {

            try {

              const result =
                this.parseStructuredResponse<T>(response);

              observer.next(result);
              observer.complete();

            } catch (error) {

              observer.error(error);

            }

          },

          error: error => {
            observer.error(error);
          }

        });

    });
  }


  // ==========================================================
  // MODEL PLAN
  // ==========================================================

  /**
   * Genera:
   *
   * MODEL_1 + KEY_1
   * MODEL_1 + KEY_2
   * MODEL_2 + KEY_1
   * MODEL_2 + KEY_2
   * MODEL_3 + KEY_1
   * MODEL_3 + KEY_2
   */
  private buildAttemptPlan(): ModelAttempt[] {

    const keys = [
      {
        apiKey: this.apiKey1,
        label: 'key_1'
      },
      {
        apiKey: this.apiKey2,
        label: 'key_2'
      }
    ].filter(item => !!item.apiKey);


    const plan: ModelAttempt[] = [];


    for (const model of this.models) {

      for (const key of keys) {

        plan.push({

          model: model.model,

          apiKey: key.apiKey,

          maxAttempts: model.maxAttempts,

          label: `${model.label}+${key.label}`

        });

      }

    }


    return plan;
  }


  // ==========================================================
  // EXECUTE + FALLBACK
  // ==========================================================

  /**
   * Este es el MOTOR.
   *
   * El mismo:
   *
   * prompt
   * user query
   * schema
   *
   * se ejecuta nuevamente cada vez que cambia
   * modelo o API key.
   */
  private executeWithFallback(
    messages: Array<{
      role: 'system' | 'user';
      content: string;
    }>,

    responseFormat: unknown,

    context: string,

    temperature: number

  ): Observable<OpenRouterResponse> {


    const plan = this.buildAttemptPlan();


    if (!plan.length) {

      return throwError(
        () => new Error('Falta configurar API Key')
      );

    }


    return new Observable(observer => {

      (async () => {

        let sawRateLimit = false;


        /**
         * Función recursiva.
         *
         * Cada llamada representa un intento.
         */
        const tryAttempt = async (
          planIndex: number,
          attemptNumber: number
        ): Promise<void> => {


          // ================================================
          // NO QUEDAN MODELOS
          // ================================================

          if (planIndex >= plan.length) {

            if (sawRateLimit) {

              observer.error(
                this.createRateLimitError()
              );

              return;
            }


            observer.error(
              new Error(
                `No se pudo completar ${context}. ` +
                `Se agotaron todos los modelos/API keys.`
              )
            );

            return;
          }


          const current = plan[planIndex];


          // ================================================
          // HEADERS
          // ================================================

          const headers = new HttpHeaders({

            Authorization:
              `Bearer ${current.apiKey}`,

            'Content-Type':
              'application/json'

          });


          // ================================================
          // REQUEST
          // ================================================

          const body = {

            /**
             * Esta es la única parte que cambia
             * durante el fallback.
             */
            model: current.model,


            /**
             * El prompt permanece exactamente igual.
             */
            messages,


            temperature,


            /**
             * El schema también permanece igual.
             */
            response_format: responseFormat,


            provider: {
              require_parameters: true
            }

          };


          console.log(
            `🤖 ${context}`,
            `Intento ${attemptNumber}/${current.maxAttempts}`,
            current.label
          );


          try {

            // ==============================================
            // CALL OPENROUTER
            // ==============================================

            const response = await firstValueFrom(

              this.http
                .post<OpenRouterResponse>(
                  this.apiUrl,
                  body,
                  { headers }
                )
                .pipe(
                  timeout(
                    this.REQUEST_TIMEOUT_MS
                  )
                )

            );


            // ==============================================
            // OPENROUTER PUEDE DEVOLVER 200 + ERROR
            // ==============================================

            const responseError =
              this.getOpenRouterResponseError(
                response
              );


            if (responseError) {

              // ----------------------------
              // RATE LIMIT
              // ----------------------------

              if (
                responseError.code === 429
              ) {

                sawRateLimit = true;

                await this.retryAfterRateLimit(

                  responseError,

                  current,

                  planIndex,

                  attemptNumber,

                  tryAttempt,

                  context

                );

                return;
              }


              // ----------------------------
              // OTRO ERROR DEL PROVIDER
              //
              // Cambiar modelo.
              // ----------------------------

              console.warn(
                `⚠️ ${context}`,
                `${current.label} falló.`,
                'Probando fallback...'
              );


              await tryAttempt(
                planIndex + 1,
                1
              );

              return;
            }


            // ==============================================
            // SUCCESS
            // ==============================================

            observer.next(response);

            observer.complete();


          } catch (error) {

            const httpError =
              error as HttpErrorResponse;


            // ==============================================
            // 429
            // ==============================================

            if (
              httpError?.status === 429
            ) {

              sawRateLimit = true;

              await this.retryAfterRateLimit(

                httpError,

                current,

                planIndex,

                attemptNumber,

                tryAttempt,

                context

              );

              return;
            }


            // ==============================================
            // PROVIDER ERROR
            // ==============================================

            const provider400 =

              httpError?.status === 400 &&

              String(
                httpError?.error
                  ?.error
                  ?.message || ''
              )
                .toLowerCase()
                .includes(
                  'provider returned error'
                );


            // ==============================================
            // MODEL NO DISPONIBLE
            // ==============================================

            const missingEndpoint =

              httpError?.status === 404 ||

              String(
                httpError?.error
                  ?.error
                  ?.message || ''
              )
                .toLowerCase()
                .includes(
                  'no endpoints found'
                );


            // ==============================================
            // SERVER TEMPORARY ERROR
            // ==============================================

            const serverError = [
              500,
              502,
              503,
              504
            ].includes(
              httpError?.status
            );


            /**
             * Cambiar automáticamente
             * al siguiente modelo.
             */
            if (
              provider400 ||
              missingEndpoint ||
              serverError
            ) {

              console.warn(
                `⚠️ ${context}:`,
                `${current.label} no disponible.`,
                'Probando siguiente modelo...'
              );


              await tryAttempt(
                planIndex + 1,
                1
              );

              return;
            }


            /**
             * Error desconocido.
             *
             * No tiene sentido probar 10 modelos
             * si por ejemplo el request está mal.
             */
            observer.error(error);

          }

        };


        /**
         * Comenzamos:
         *
         * primer modelo
         * primer intento
         */
        await tryAttempt(0, 1);

      })();

    });

  }


  // ==========================================================
  // RETRY
  // ==========================================================

  private async retryAfterRateLimit(

    source: unknown,

    current: ModelAttempt,

    planIndex: number,

    attemptNumber: number,

    tryAttempt: (
      planIndex: number,
      attemptNumber: number
    ) => Promise<void>,

    context: string

  ): Promise<void> {


    const delayMs =
      this.getRetryDelayMs(source);


    console.warn(
      `⏳ ${context}:`,
      `${current.label} rate-limited.`,
      `Retry en ${Math.ceil(delayMs / 1000)}s`
    );


    await this.delay(delayMs);


    const nextAttempt =
      attemptNumber + 1;


    /**
     * Todavía quedan retries
     * para este mismo modelo/key.
     */
    if (
      nextAttempt <=
      current.maxAttempts
    ) {

      await tryAttempt(
        planIndex,
        nextAttempt
      );

      return;
    }


    /**
     * Se agotaron los retries.
     *
     * Siguiente modelo/key.
     */
    await tryAttempt(
      planIndex + 1,
      1
    );

  }


  // ==========================================================
  // RETRY DELAY
  // ==========================================================

  private getRetryDelayMs(
    source: unknown
  ): number {

    let seconds:
      number |
      undefined;


    if (
      source instanceof
      HttpErrorResponse
    ) {

      const retryAfter =
        source.headers.get(
          'Retry-After'
        );


      if (retryAfter) {

        const parsed =
          Number.parseInt(
            retryAfter,
            10
          );


        if (
          !Number.isNaN(parsed)
        ) {

          seconds = parsed;

        }

      }

    }


    const delayMs =
      (
        seconds ??
        this.DEFAULT_RETRY_DELAY_MS / 1000
      ) * 1000;


    return Math.min(

      Math.max(
        delayMs,
        1000
      ),

      this.MAX_RETRY_DELAY_MS

    );

  }


  // ==========================================================
  // PARSE STRUCTURED OUTPUT
  // ==========================================================

  private parseStructuredResponse<T>(
    response: OpenRouterResponse
  ): T {


    const content =
      response
        .choices?.[0]
        ?.message
        ?.content;


    if (!content) {

      throw new Error(
        'La respuesta del modelo está vacía'
      );

    }


    let jsonString: string;


    if (
      typeof content === 'string'
    ) {

      jsonString = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

    }

    else if (
      Array.isArray(content)
    ) {

      jsonString = content
        .map(item => item.text ?? '')
        .join('');

    }

    else {

      jsonString =
        JSON.stringify(content);

    }


    return JSON.parse(
      jsonString
    ) as T;

  }


  // ==========================================================
  // OPENROUTER ERRORS
  // ==========================================================

  private getOpenRouterResponseError(
    response: OpenRouterResponse
  ): OpenRouterError | null {


    if (response.error) {

      return response.error;

    }


    const choiceWithError =
      response.choices?.find(
        choice =>
          choice.error ||
          choice.finish_reason === 'error'
      );


    return (
      choiceWithError?.error ??
      null
    );

  }


  // ==========================================================
  // UTILITIES
  // ==========================================================

  private delay(
    ms: number
  ): Promise<void> {

    return new Promise(
      resolve =>
        setTimeout(resolve, ms)
    );

  }


  private createRateLimitError(): Error {

    const error = new Error(
      'El servicio de IA está temporalmente saturado.'
    );


    error.name =
      AI_RATE_LIMITED_ERROR_NAME;


    return error;

  }

}