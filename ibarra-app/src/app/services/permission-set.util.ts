export function permissionSetHas(
  permissions: ReadonlySet<string>,
  module: string,
  action: string,
): boolean {
  if (permissions.has('*:*') || permissions.has(`${module}:${action}`)) {
    return true;
  }

  return action !== 'manage' && permissions.has(`${module}:manage`);
}
