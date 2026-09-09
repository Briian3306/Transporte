import { permissionSetHas } from './permission-set.util';

describe('permissionSetHas', () => {
  it('users:manage implica users:read (ruta /users)', () => {
    const permissions = new Set(['users:manage']);
    expect(permissionSetHas(permissions, 'users', 'read')).toBeTrue();
  });

  it('users:manage implica users:create', () => {
    const permissions = new Set(['users:manage']);
    expect(permissionSetHas(permissions, 'users', 'create')).toBeTrue();
  });

  it('no concede manage si solo hay read', () => {
    const permissions = new Set(['users:read']);
    expect(permissionSetHas(permissions, 'users', 'manage')).toBeFalse();
  });

  it('respeta el comodín global', () => {
    expect(permissionSetHas(new Set(['*:*']), 'users', 'manage')).toBeTrue();
  });

  it('no cruza módulos', () => {
    const permissions = new Set(['users:manage']);
    expect(permissionSetHas(permissions, 'incidentes', 'read')).toBeFalse();
  });
});
