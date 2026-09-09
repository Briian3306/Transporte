export const INVOICE_ASSISTED_READING_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'invoice_assisted_reading_response',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        invoice_number_candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
            additionalProperties: false,
          },
        },
        invoice_date_candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'Invoice date in YYYY-MM-DD format',
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
            additionalProperties: false,
          },
        },
        vat_candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
            additionalProperties: false,
          },
        },
        perception_candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'number',
                description: 'Total sum of perceptions',
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
            additionalProperties: false,
          },
        },
        subtotal_candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
            additionalProperties: false,
          },
        },
        total_candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['value', 'confidence'],
            additionalProperties: false,
          },
        },
      },
      required: [
        'invoice_number_candidates',
        'invoice_date_candidates',
        'vat_candidates',
        'perception_candidates',
        'subtotal_candidates',
        'total_candidates',
      ],
      additionalProperties: false,
    },
  },
} as const;
