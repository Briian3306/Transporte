/** Módulos ocultos de la navegación hasta que se den de baja en system_modules. */
export const RETIRED_MODULE_NAMES = ['checklists', 'templates', 'neumaticos', 'stock'] as const;

/**
 * Prefijos que el guard niega aunque el rol conserve el permiso.
 * El match es exacto o con un segmento siguiente, para que `/checklist`
 * no tape `/checklist-history`.
 */
export const RETIRED_ROUTE_PREFIXES = [
  '/checklist',
  '/checklist-history',
  '/checklist-details',
  '/templates',
  '/template-config',
  '/neumaticos',
  '/stock',
] as const;

export function isRetiredModule(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (RETIRED_MODULE_NAMES as readonly string[]).includes(normalized);
}

export function isRetiredRoute(url: string): boolean {
  const path = url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return RETIRED_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
