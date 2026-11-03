import {
  addTariffGroup,
  createSingletonTariffGroups,
  removeStationFromTariffGroup,
  nextCategoryAction,
  categoryStateForIdentities,
  type TarifarioGroupStation,
} from './tarifario-groups.helpers';

const stations: TarifarioGroupStation[] = [
  { id: 's1', name: 'Station 1', peajeId: 'p1', family: 'AMBAS' },
  { id: 's2', name: 'Station 2', peajeId: 'p1', family: 'AMBAS' },
  { id: 's3', name: 'Station 3', peajeId: 'p1', family: 'AMBAS' },
  { id: 's5', name: 'Station 5', peajeId: 'p1', family: 'AMBAS' },
  { id: 's4', name: 'Station 4', peajeId: 'p2', family: 'AMBAS' },
];

describe('tarifario groups', () => {
  it('starts with one singleton editor per station', () => {
    expect(createSingletonTariffGroups(stations).map((group) => group.stationIds)).toEqual([
      ['s1'],
      ['s2'],
      ['s3'],
      ['s5'],
      ['s4'],
    ]);
  });

  it('allows multiple compatible groups and keeps membership exclusive', () => {
    const initial = createSingletonTariffGroups(stations);
    const first = addTariffGroup(initial, ['s1', 's2'], stations);
    const second = addTariffGroup(first.groups, ['s3', 's4'], stations);
    expect(second.error).toBe('Las estaciones deben pertenecer al mismo peaje y familia de sentido.');

    const valid = addTariffGroup(first.groups, ['s3', 's5'], stations);
    expect(valid.error).toBeNull();
    expect(valid.groups.filter((group) => group.stationIds.length > 1).length).toBe(2);
    expect(valid.groups.flatMap((group) => group.stationIds).sort()).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });

  it('returns a removed station to exactly one singleton group', () => {
    const initial = createSingletonTariffGroups(stations);
    const grouped = addTariffGroup(initial, ['s1', 's2'], stations).groups;
    const groupId = grouped.find((group) => group.stationIds.length > 1)?.id ?? '';
    const result = removeStationFromTariffGroup(grouped, groupId, 's1');
    expect(result.groups.filter((group) => group.stationIds.includes('s1')).length).toBe(1);
    expect(result.groups.find((group) => group.stationIds.includes('s1'))?.stationIds).toEqual(['s1']);
  });
});

describe('sequential category addition', () => {
  it('aggregates PICO and NO_PICO into one category state', () => {
    expect(categoryStateForIdentities([
      { categoria: 8, enabled: true, tarifaId: 'np-8' },
      { categoria: 8, enabled: true, tarifaId: 'p-8' },
    ])).toEqual({ categoria: 8, enabled: true, hasExisting: true, tarifaIds: ['np-8', 'p-8'] });
  });

  it('treats a category as disabled when either existing lane is disabled', () => {
    expect(categoryStateForIdentities([
      { categoria: 8, enabled: true, tarifaId: 'np-8' },
      { categoria: 8, enabled: false, tarifaId: 'p-8' },
    ])).toEqual({ categoria: 8, enabled: false, hasExisting: true, tarifaIds: ['np-8', 'p-8'] });
  });

  it('re-enables a disabled next category before creating a draft', () => {
    expect(nextCategoryAction([
      { categoria: 7, enabled: true, tarifaId: 't7' },
      { categoria: 8, enabled: false, tarifaId: 't8' },
    ])).toEqual({ categoria: 8, action: 'ENABLE' });
  });

  it('prepares a draft only when the next category is missing', () => {
    expect(nextCategoryAction([{ categoria: 7, enabled: true, tarifaId: 't7' }])).toEqual({
      categoria: 8,
      action: 'DRAFT',
    });
  });

  it('allows a category-level enable action even when ten rows are materialized', () => {
    const identities = Array.from({ length: 10 }, (_, index) => ({
      categoria: index + 1,
      enabled: index < 7,
      tarifaId: `t-${index + 1}`,
    }));
    expect(nextCategoryAction(identities)).toEqual({ categoria: 8, action: 'ENABLE' });
  });
});
