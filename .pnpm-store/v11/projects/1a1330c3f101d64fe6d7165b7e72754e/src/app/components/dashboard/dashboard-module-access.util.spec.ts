import { isDashboardModuleAvailable } from './dashboard-module-access.util';

const modules = [
  { name: 'checklists', route: '/checklist' },
  { name: 'users', route: '/users' },
  { name: 'incidentes', route: '/incidentes/historial' },
  { name: 'stock', route: '/stock/dashboard' },
];

describe('isDashboardModuleAvailable', () => {
  const withPerms = (keys: string[]) => {
    const set = new Set(keys);
    return (module: string, action: string) =>
      set.has(`${module}:${action}`) ||
      (action !== 'manage' && set.has(`${module}:manage`));
  };

  it('habilita Historial con checklists:read aunque no exista módulo history', () => {
    expect(
      isDashboardModuleAvailable(
        { id: 'history', route: '/checklist-history' },
        modules,
        withPerms(['checklists:read']),
      ),
    ).toBeTrue();
  });

  it('habilita Roles con users:manage aunque no exista módulo roles', () => {
    expect(
      isDashboardModuleAvailable(
        { id: 'roles', route: '/roles' },
        modules,
        withPerms(['users:manage']),
      ),
    ).toBeTrue();
  });

  it('habilita Usuarios con users:read', () => {
    expect(
      isDashboardModuleAvailable(
        { id: 'users', route: '/users' },
        modules,
        withPerms(['users:read']),
      ),
    ).toBeTrue();
  });

  it('habilita Stock por id stock, no por el id duplicado checklists', () => {
    expect(
      isDashboardModuleAvailable(
        { id: 'stock', route: '/stock/dashboard' },
        modules,
        withPerms(['stock:read']),
      ),
    ).toBeTrue();
  });

  it('bloquea Roles sin users:manage ni users:read', () => {
    expect(
      isDashboardModuleAvailable(
        { id: 'roles', route: '/roles' },
        modules,
        withPerms(['checklists:read']),
      ),
    ).toBeFalse();
  });
});
