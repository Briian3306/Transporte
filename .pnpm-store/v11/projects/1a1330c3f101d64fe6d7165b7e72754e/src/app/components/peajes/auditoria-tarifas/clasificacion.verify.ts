import { suggestStatusByPrice } from './auditoria-tarifas.helpers';
import { buildZarate, MOCK_STATUS_CATALOG, PEAJE_CV } from './mocks/auditoria-tarifas.mock';

const catalog = MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === PEAJE_CV);

const zarate = buildZarate();
const suggestion = suggestStatusByPrice(zarate, catalog);
const ordered = [...zarate].sort((a, b) => a.importe - b.importe);

const expected = ['NO_PICO', 'PICO', 'PICO', 'PICO', 'PICO'];
const actual = ordered.map((n) => suggestion.get(n.id) ?? 'PENDIENTE');

let matches = 0;
for (let i = 0; i < expected.length; i++) {
  if (actual[i] === expected[i]) matches++;
}

console.log('ZARATE suggestion:', actual.join(', '));
console.log('Expected:         ', expected.join(', '));
console.log(`Match: ${matches}/${expected.length}`);

if (actual.join(',') !== expected.join(',')) {
  console.error('S-02 FAILED: ZARATE suggestion mismatch');
  process.exit(1);
}

console.log('clasificacion.verify.ts OK');
