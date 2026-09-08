import {
  PEAJES_ROUTE_PERMISSIONS,
  PermissionRequirement,
  PermissionGuard,
  matchesPermissionRequirement,
} from './permission.guard';

describe('PermissionGuard: permisos de Peajes', () => {
  const operatorPermissions = new Set(['peajes:read', 'peajes:create']);
  const readOnlyPermissions = new Set(['peajes:read']);
  const adminPermissions = new Set(['peajes:manage']);

  const hasPermission = (permissions: ReadonlySet<string>) =>
    (module: string, action: string) =>
      permissions.has(`${module}:${action}`) || permissions.has('*:*');

  it('permite al operador carga y revisión, pero no administración', () => {
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/wizard'],
        hasPermission(operatorPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/pasadas'],
        hasPermission(operatorPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/pasadas-pendientes'],
        hasPermission(operatorPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/auditoria-estaciones'],
        hasPermission(operatorPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/catalogos'],
        hasPermission(operatorPermissions),
      ),
    ).toBeFalse();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/catalogos/estaciones'],
        hasPermission(operatorPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/catalogos/estaciones'],
        hasPermission(readOnlyPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/tarifario'],
        hasPermission(operatorPermissions),
      ),
    ).toBeFalse();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/tarifario'],
        hasPermission(adminPermissions),
      ),
    ).toBeTrue();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/catalogos/empresas'],
        hasPermission(operatorPermissions),
      ),
    ).toBeFalse();
  });

  it('exige peajes:manage para el catálogo de empresas', () => {
    expect(PEAJES_ROUTE_PERMISSIONS['/peajes/catalogos/empresas']).toBeDefined();
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/catalogos/empresas'],
        hasPermission(adminPermissions),
      ),
    ).toBeTrue();
  });

  it('requiere también create para las vistas operativas', () => {
    expect(
      matchesPermissionRequirement(
        PEAJES_ROUTE_PERMISSIONS['/peajes/wizard'],
        hasPermission(readOnlyPermissions),
      ),
    ).toBeFalse();
  });

  it('permite al administrador todas las secciones', () => {
    const peajesRoutes = Object.keys(PEAJES_ROUTE_PERMISSIONS);
    const deniedRoutes = peajesRoutes.filter(
      (path) =>
        !matchesPermissionRequirement(
          PEAJES_ROUTE_PERMISSIONS[path],
          hasPermission(adminPermissions),
        ),
    );
    expect(deniedRoutes).toEqual([]);
  });

  it('mantiene el comodín global para cualquier requisito', () => {
    const requirement: PermissionRequirement = {
      all: [{ module: 'peajes', action: 'manage' }],
    };
    expect(
      matchesPermissionRequirement(requirement, () => false),
    ).toBeFalse();
    expect(
      matchesPermissionRequirement(requirement, () => false, true),
    ).toBeTrue();
  });

  it('users:manage implica acceso a /users (users:read)', () => {
    expect(
      matchesPermissionRequirement(
        { module: 'users', action: 'read' },
        hasPermission(new Set(['users:manage'])),
      ),
    ).toBeTrue();
  });

  it('expone los permisos compuestos mediante getRequiredPermission', () => {
    expect(PermissionGuard.getRequiredPermission('/peajes/wizard')).toEqual(
      PEAJES_ROUTE_PERMISSIONS['/peajes/wizard'],
    );
  });
});
