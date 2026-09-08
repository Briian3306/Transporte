import { resolvePasadaSentido } from './direction-resolution';

describe('resolvePasadaSentido', () => {
  const map = [
    { codigoEstacion: '0004', via: '01M', sentido: 'IDA' as const },
    { codigoEstacion: '0004', via: '51M', sentido: 'VUELTA' as const },
  ];

  it('prefers an explicit imported direction over the saved lane map', () => {
    expect(resolvePasadaSentido({ explicit: 'VUELTA', codigoEstacion: '0004', via: '01M', map }))
      .toEqual({ sentido: 'VUELTA', confidence: 'EXPLICIT' });
  });

  it('resolves an empty explicit direction from the provider lane map', () => {
    expect(resolvePasadaSentido({ explicit: null, codigoEstacion: '0004', via: '51M', map }))
      .toEqual({ sentido: 'VUELTA', confidence: 'LANE_MAP' });
  });

  it('fails closed for an unmapped lane and conflicting mappings', () => {
    expect(resolvePasadaSentido({ explicit: null, codigoEstacion: '0004', via: '99M', map }))
      .toEqual({ sentido: null, confidence: 'UNRESOLVED', reason: 'MISSING_MAPPING' });
    expect(resolvePasadaSentido({
      explicit: null,
      codigoEstacion: '0004',
      via: '01M',
      map: [...map, { codigoEstacion: '0004', via: '01M', sentido: 'VUELTA' as const }],
    })).toEqual({ sentido: null, confidence: 'UNRESOLVED', reason: 'CONFLICT' });
  });

  it('does not infer AMBAS when direction is missing', () => {
    expect(resolvePasadaSentido({ explicit: null, codigoEstacion: null, via: null, map }))
      .toEqual({ sentido: null, confidence: 'UNRESOLVED', reason: 'MISSING_MAPPING' });
  });
});
