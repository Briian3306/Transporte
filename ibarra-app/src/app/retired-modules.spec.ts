import { isRetiredModule, isRetiredRoute } from './retired-modules';

describe('módulos retirados', () => {
  it('reconoce checklists, plantillas, neumáticos y stock', () => {
    expect(isRetiredModule('checklists')).toBeTrue();
    expect(isRetiredModule('Templates')).toBeTrue();
    expect(isRetiredModule('neumaticos')).toBeTrue();
    expect(isRetiredModule('stock')).toBeTrue();
    expect(isRetiredModule('peajes')).toBeFalse();
    expect(isRetiredModule('flota')).toBeFalse();
  });

  it('niega las rutas retiradas sin tapar otras que comparten texto', () => {
    expect(isRetiredRoute('/checklist')).toBeTrue();
    expect(isRetiredRoute('/checklist/new/abc')).toBeTrue();
    expect(isRetiredRoute('/checklist/tpl/id')).toBeTrue();
    expect(isRetiredRoute('/checklist-history')).toBeTrue();
    expect(isRetiredRoute('/checklist-details/1')).toBeTrue();
    expect(isRetiredRoute('/templates')).toBeTrue();
    expect(isRetiredRoute('/template-config/9')).toBeTrue();
    expect(isRetiredRoute('/neumaticos/registro')).toBeTrue();
    expect(isRetiredRoute('/stock/dashboard?deposito=1')).toBeTrue();
    expect(isRetiredRoute('/stock/deposito/nuevo')).toBeTrue();
    expect(isRetiredRoute('/peajes')).toBeFalse();
    expect(isRetiredRoute('/flota')).toBeFalse();
    expect(isRetiredRoute('/incidentes/historial')).toBeFalse();
  });
});
