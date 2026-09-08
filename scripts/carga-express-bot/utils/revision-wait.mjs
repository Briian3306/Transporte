/**
 * Paso 9: upload is done only when the success dialog section is open
 * (app-dialog/div/section) or the status text is «Carga confirmada».
 * The green .pw__status--valid badge and the app-dialog host exist before confirm.
 */

export const REVISION_SUCCESS_DIALOG_XPATH =
  '/html/body/app-root/div/main/app-peajes-carga-express/div/section/app-paso9-revision/div/app-dialog/div/section';

export const REVISION_SUCCESS_DIALOG_SELECTOR = 'app-paso9-revision app-dialog section.app-dialog';

export const REVISION_UPLOAD_TIMEOUT_MS = 90000;
export const REVISION_DIALOG_VIEW_MS = 5000;

export function revisionUploadSettled({
  dialogOpen = false,
  statusText = '',
  errorText = '',
} = {}) {
  const error = String(errorText ?? '').trim();
  const status = String(statusText ?? '').replace(/\s+/g, ' ').trim();
  if (dialogOpen) return { done: true, ok: true };
  if (/Carga confirmada/i.test(status)) return { done: true, ok: true };
  if (error) return { done: true, ok: false, error };
  return { done: false, ok: false };
}
