import { hasAdminRole } from './admin-role.util';

describe('hasAdminRole', () => {
  it('reconoce admin aunque no sea el primer rol (caso Francis)', () => {
    expect(
      hasAdminRole([
        'check list - full',
        'admin',
        'administrador',
        'incidentes - full',
      ]),
    ).toBeTrue();
  });

  it('reconoce administrador como rol de administración', () => {
    expect(hasAdminRole(['administrador'])).toBeTrue();
  });

  it('es insensible a mayúsculas', () => {
    expect(hasAdminRole(['Admin'])).toBeTrue();
  });

  it('rechaza roles operativos sin admin', () => {
    expect(hasAdminRole(['check list - full', 'stock - visor'])).toBeFalse();
  });

  it('rechaza lista vacía o ausente', () => {
    expect(hasAdminRole([])).toBeFalse();
    expect(hasAdminRole(null)).toBeFalse();
    expect(hasAdminRole(undefined)).toBeFalse();
  });
});
