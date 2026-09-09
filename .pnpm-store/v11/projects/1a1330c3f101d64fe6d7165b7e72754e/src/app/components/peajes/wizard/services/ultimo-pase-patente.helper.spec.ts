import { Pase } from '../../models';
import { ultimoPaseIdPorPatente } from './ultimo-pase-patente.helper';

describe('ultimoPaseIdPorPatente', () => {
  const patente = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111';
  const oldId = 'aaaaaaaa-bbbb-4ccc-8ddd-222222222222';
  const newId = 'aaaaaaaa-bbbb-4ccc-8ddd-333333333333';
  const otherPatente = 'aaaaaaaa-bbbb-4ccc-8ddd-444444444444';
  const otherPase = 'aaaaaaaa-bbbb-4ccc-8ddd-555555555555';

  it('picks the pase with the latest created_at for each patente', () => {
    const pases: Pase[] = [
      { id: oldId, pase: 'TAG-OLD', patente_id: patente, created_at: '2026-01-01T00:00:00Z' },
      { id: newId, pase: 'TAG-NEW', patente_id: patente, created_at: '2026-08-01T00:00:00Z' },
    ];
    expect(ultimoPaseIdPorPatente(pases).get(patente)).toBe(newId);
  });

  it('keeps the latest pase independently per patente', () => {
    const pases: Pase[] = [
      { id: oldId, pase: 'A', patente_id: patente, created_at: '2026-01-01T00:00:00Z' },
      { id: otherPase, pase: 'B', patente_id: otherPatente, created_at: '2026-03-01T00:00:00Z' },
      { id: newId, pase: 'C', patente_id: patente, created_at: '2026-08-01T00:00:00Z' },
    ];
    const map = ultimoPaseIdPorPatente(pases);
    expect(map.get(patente)).toBe(newId);
    expect(map.get(otherPatente)).toBe(otherPase);
  });

  it('omits patentes that have no pases', () => {
    expect(ultimoPaseIdPorPatente([]).has(patente)).toBeFalse();
  });
});
