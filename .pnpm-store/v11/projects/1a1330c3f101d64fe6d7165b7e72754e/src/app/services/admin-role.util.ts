const ADMIN_ROLE_NAMES = new Set(['admin', 'administrador']);

export function hasAdminRole(
  roleNames: readonly string[] | null | undefined,
): boolean {
  if (!roleNames?.length) {
    return false;
  }

  return roleNames.some((name) => ADMIN_ROLE_NAMES.has(name.trim().toLowerCase()));
}
