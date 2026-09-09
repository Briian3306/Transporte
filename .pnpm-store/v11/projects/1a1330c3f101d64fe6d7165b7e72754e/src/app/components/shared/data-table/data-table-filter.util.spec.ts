import { applyDataTableFilters } from './data-table-filter.util';
import { DataTableColumn, emptyDataTableFilterState } from './data-table.types';

describe('applyDataTableFilters', () => {
  const columns: DataTableColumn[] = [
    { key: 'patente', label: 'Patente', filter: { type: 'text' }, searchable: true },
    { key: 'categoria', label: 'Categoría', filter: { type: 'multiselect' } },
  ];

  const rows = [
    { id: '1', patente: 'AG676SP', categoria: 'TRANSPORTE' },
    { id: '2', patente: 'AD239PP', categoria: 'REMIS' },
    { id: '3', patente: 'XYZ111', categoria: 'TRANSPORTE' },
  ];

  it('filters by global search keys', () => {
    const filters = { ...emptyDataTableFilterState(), global: 'AG6' };
    const result = applyDataTableFilters(rows, columns, filters, ['patente']);
    expect(result.length).toBe(1);
    expect(result[0]['patente']).toBe('AG676SP');
  });

  it('filters by column text and multiselect', () => {
    const filters = {
      global: '',
      columns: {
        patente: 'PP',
        categoria: ['REMIS'],
      },
    };
    const result = applyDataTableFilters(rows, columns, filters, ['patente']);
    expect(result.length).toBe(1);
    expect(result[0]['id']).toBe('2');
  });
});
