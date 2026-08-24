/**
 * DEPRECATED for invoice AI: Angular calls OpenRouter from the browser.
 * Kept so existing Node fixture tests still compile. Do not wire new UI here.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const ERRORS = {
  invalid: 'Pedido inválido.',
  method: 'Método no permitido.',
  config: 'El servicio de IA no está configurado.',
  rateLimited: 'El servicio de IA está temporalmente saturado.',
  provider: 'No se pudo analizar la factura. Completá el documento a mano o reintentá.',
};

const SYSTEM_PROMPT = `You are an invoice data extraction assistant.

Your task is to analyze invoice text and return possible candidates for the invoice form fields.

INPUT:

- invoiceText: Extracted invoice text
- expectedNetAmount: Expected net amount already known by the system

FIELDS TO DETECT:

1. invoice_number_candidates
2. invoice_date_candidates
3. vat_candidates
4. perception_candidates
5. total_candidates

RULES:

1. Return multiple candidates when there is ambiguity.
2. Every candidate must contain ONLY value and confidence.
3. confidence must be between 0 and 1.
4. DO NOT return explanations, context or additional fields.
5. invoice_number_candidates: detect invoice numbers like 0001-00001234. Prioritize FACTURA, invoice number or comprobante.
6. invoice_date_candidates: invoice issue date in YYYY-MM-DD. Do not prioritize payment due dates.
7. vat_candidates: detect IVA amounts. Use expected net amount as a reference. If mathematically consistent, increase confidence.
8. perception_candidates: TOTAL SUM of perceptions. Commonly around 3% or 4% of expected net. Use only as a confidence signal, never as a strict rule.
9. total_candidates: original invoice total. Do not confuse with surcharge, account balance, second payment due or debt balance.
10. A strong validation signal is expectedNetAmount + IVA + perceptions ≈ invoice total.
11. The expected net amount may differ approximately ±1%.
12. DO NOT invent values that do not appear in the invoice.
13. If there is uncertainty, return multiple candidates ordered from highest to lowest confidence.

Respond using only the structured output. Do not add explanations, markdown or fields outside the defined schema.`;

const INVOICE_ASSISTED_READING_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'invoice_assisted_reading_response',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        invoice_number_candidates: candidateArray('string'),
        invoice_date_candidates: candidateArray('string', 'Invoice date in YYYY-MM-DD format'),
        vat_candidates: candidateArray('number'),
        perception_candidates: candidateArray('number', 'Total sum of perceptions'),
        total_candidates: candidateArray('number'),
      },
      required: [
        'invoice_number_candidates',
        'invoice_date_candidates',
        'vat_candidates',
        'perception_candidates',
        'total_candidates',
      ],
      additionalProperties: false,
    },
  },
};

function candidateArray(valueType, description) {
  const value = description
    ? { type: valueType, description }
    : { type: valueType };
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        value,
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['value', 'confidence'],
      additionalProperties: false,
    },
  };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

function errorResponse(statusCode, message) {
  return jsonResponse(statusCode, { error: message });
}

function parseBody(event) {
  if (!event || event.body == null || event.body === '') {
    return null;
  }
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return null;
  }
}

function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return 'invalid';
  }
  const invoiceText = typeof body.invoiceText === 'string' ? body.invoiceText.trim() : '';
  if (!invoiceText || invoiceText.length > MAX_INVOICE_TEXT_CHARS) {
    return 'invalid';
  }
  const expectedNetAmount = Number(body.expectedNetAmount);
  if (!Number.isFinite(expectedNetAmount) || expectedNetAmount <= 0) {
    return 'invalid';
  }
  return { invoiceText, expectedNetAmount };
}

function buildPayload(invoiceText, expectedNetAmount, model) {
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `EXPECTED NET AMOUNT:\n${expectedNetAmount}\n\nINVOICE TEXT:\n${invoiceText}\n`,
      },
    ],
    temperature: 0.2,
    response_format: INVOICE_ASSISTED_READING_SCHEMA,
    provider: { require_parameters: true },
  };
}

function extractProviderMessage(data) {
  if (!data || typeof data !== 'object') return '';
  if (data.error && typeof data.error === 'object') {
    return String(data.error.message || '');
  }
  if (typeof data.error === 'string') return data.error;
  const choice = Array.isArray(data.choices)
    ? data.choices.find((item) => item && (item.error || item.finish_reason === 'error'))
    : null;
  if (choice?.error?.message) return String(choice.error.message);
  return '';
}

function isRecoverable(status, providerMessage, thrown) {
  if (thrown) return true;
  if (status === 429 || status === 408) return true;
  if (status === 404) return true;
  if (Number.isFinite(status) && status >= 500 && status <= 599) return true;
  const message = String(providerMessage || '').toLowerCase();
  return (
    message.includes('provider returned error') || message.includes('no endpoints found')
  );
}

function parseStructured(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content;
  }
  let jsonString = '';
  if (typeof content === 'string') {
    jsonString = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  } else if (Array.isArray(content)) {
    jsonString = content.map((item) => item?.text ?? '').join('');
  } else if (data && Array.isArray(data.invoice_number_candidates)) {
    return data;
  }
  if (!jsonString) {
    throw new Error('empty');
  }
  return JSON.parse(jsonString);
}

async function callOpenRouter(fetchImpl, url, apiKey, payload) {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      data,
      message: extractProviderMessage(data),
      thrown: false,
    };
  } catch {
    return { status: 0, data: null, message: '', thrown: true };
  }
}

function createHandler({ fetchImpl = fetch, env = process.env } = {}) {
  return async function handler(event) {
    const method = event?.httpMethod || event?.requestContext?.http?.method || '';

    if (method === 'OPTIONS') {
      return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }
    if (method !== 'POST') {
      return errorResponse(405, ERRORS.method);
    }

    const parsed = parseBody(event);
    const valid = validateRequest(parsed);
    if (valid === 'invalid') {
      return errorResponse(400, ERRORS.invalid);
    }

    const apiUrl = env.OPENROUTER_API_URL;
    const model = env.OPENROUTER_MODEL;
    const key1 = env.OPENROUTER_API_KEY;
    const key2 = env.OPENROUTER_API_KEY_2;
    if (!apiUrl || !model || !key1) {
      return errorResponse(500, ERRORS.config);
    }

    const payload = buildPayload(valid.invoiceText, valid.expectedNetAmount, model);
    const keys = [key1];
    if (key2 && key2 !== key1) {
      keys.push(key2);
    }

    let failedAttempts = 0;
    let rateLimitedAttempts = 0;

    for (let i = 0; i < keys.length; i += 1) {
      const attempt = await callOpenRouter(fetchImpl, apiUrl, keys[i], payload);
      const providerMessage =
        attempt.message || extractProviderMessage(attempt.data);
      const recoverable = isRecoverable(
        attempt.status,
        providerMessage,
        attempt.thrown
      );

      if (!attempt.thrown && attempt.status >= 200 && attempt.status < 300 && !providerMessage) {
        try {
          const structured = parseStructured(attempt.data);
          return jsonResponse(200, structured);
        } catch {
          failedAttempts += 1;
          if (i === keys.length - 1 || !recoverable) {
            return errorResponse(502, ERRORS.provider);
          }
          continue;
        }
      }

      if (!recoverable) {
        return errorResponse(502, ERRORS.provider);
      }

      failedAttempts += 1;
      if (attempt.status === 429) {
        rateLimitedAttempts += 1;
      }
    }

    if (failedAttempts > 0 && rateLimitedAttempts === failedAttempts) {
      return errorResponse(429, ERRORS.rateLimited);
    }
    return errorResponse(502, ERRORS.provider);
  };
}

const handler = createHandler();

module.exports = { handler, createHandler };
