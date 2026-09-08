import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REVISION_SUCCESS_DIALOG_SELECTOR,
  REVISION_SUCCESS_DIALOG_XPATH,
  REVISION_UPLOAD_TIMEOUT_MS,
  revisionUploadSettled,
} from './revision-wait.mjs';

test('does not treat Listo para confirmar as upload done', () => {
  assert.deepEqual(
    revisionUploadSettled({
      dialogOpen: false,
      statusText: 'Listo para confirmar',
    }),
    { done: false, ok: false },
  );
});

test('settles when the success dialog section is open', () => {
  assert.deepEqual(
    revisionUploadSettled({ dialogOpen: true, statusText: 'Listo para confirmar' }),
    { done: true, ok: true },
  );
});

test('settles when status text is Carga confirmada', () => {
  assert.deepEqual(
    revisionUploadSettled({ dialogOpen: false, statusText: 'Carga confirmada' }),
    { done: true, ok: true },
  );
});

test('surfaces confirmation errors when the dialog never opened', () => {
  const result = revisionUploadSettled({
    dialogOpen: false,
    statusText: 'Listo para confirmar',
    errorText: 'No se pudo confirmar la carga',
  });
  assert.equal(result.done, true);
  assert.equal(result.ok, false);
  assert.match(result.error, /No se pudo confirmar/);
});

test('dialog locators target the open section, not the app-dialog host', () => {
  assert.match(REVISION_SUCCESS_DIALOG_XPATH, /app-paso9-revision\/div\/app-dialog\/div\/section$/);
  assert.equal(REVISION_SUCCESS_DIALOG_SELECTOR, 'app-paso9-revision app-dialog section.app-dialog');
  assert.equal(REVISION_UPLOAD_TIMEOUT_MS, 90000);
});
