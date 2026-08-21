import { resolvePatenteReferences } from './patente-reference.helper';

describe('resolvePatenteReferences', () => {
  it('replaces a provider code with the catalog UUID', () => {
    const result = resolvePatenteReferences(
      [{ PATENTE_ID: '97267763' }],
      [{ id: 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111', patente: '97267763' }]
    );

    expect(result.unresolved).toEqual([]);
    expect(result.rows[0].PATENTE_ID).toBe('aaaaaaaa-bbbb-4ccc-8ddd-111111111111');
  });

  it('does not return an unresolved provider code as an id', () => {
    const result = resolvePatenteReferences(
      [{ PATENTE_ID: 'NO-EXISTE' }],
      []
    );

    expect(result.unresolved).toEqual(['NOEXISTE']);
    expect(result.rows[0].PATENTE_ID).toBeNull();
  });

  it('recognizes a catalog UUID even when the source contains hyphens', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111';
    const result = resolvePatenteReferences(
      [{ PATENTE_ID: id }],
      [{ id, patente: 'AD625QB' }]
    );

    expect(result.unresolved).toEqual([]);
    expect(result.rows[0].PATENTE_ID).toBe(id);
  });

  it('preserves an already resolved UUID even when the follow-up catalog response omits it', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111';
    const result = resolvePatenteReferences(
      [{ PATENTE_ID: id }],
      []
    );

    expect(result.unresolved).toEqual([]);
    expect(result.rows[0].PATENTE_ID).toBe(id);
  });
});
