const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const testingDir = join(
  __dirname,
  '..',
  '..',
  'ibarra-app',
  'docs',
  'plan',
  'invoice-ai',
  'testing'
);
const manifestPath = join(testingDir, 'invoice-ai-fixtures.json');

test('invoice AI fixture manifest exists and every PDF path exists', () => {
  assert.equal(existsSync(manifestPath), true, `missing manifest: ${manifestPath}`);

  const fixtures = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.ok(Array.isArray(fixtures), 'manifest must be an array');
  assert.equal(fixtures.length, 2);

  for (const fixture of fixtures) {
    assert.equal(typeof fixture.fileName, 'string');
    assert.equal(typeof fixture.expectedNetAmount, 'number');
    const pdfPath = join(testingDir, fixture.fileName);
    assert.equal(existsSync(pdfPath), true, `missing PDF: ${fixture.fileName}`);
  }
});
