import {
  getVisiblePeajesHomeSectionIds,
  PEAJES_HOME_SECTION_IDS,
} from './peajes-home.component';

describe('PeajesHomeComponent: secciones visibles', () => {
  it('muestra todas las secciones al administrador', () => {
    expect(
      getVisiblePeajesHomeSectionIds(new Set(['peajes:manage'])),
    ).toEqual(PEAJES_HOME_SECTION_IDS);
  });

  it('incluye catálogos para peajes:manage', () => {
    expect(PEAJES_HOME_SECTION_IDS).toContain('catalogos');
    expect(
      getVisiblePeajesHomeSectionIds(new Set(['peajes:manage'])),
    ).toContain('catalogos');
  });

  it('incluye tarifario solo para peajes:manage', () => {
    expect(PEAJES_HOME_SECTION_IDS).toContain('tarifario');
    expect(
      getVisiblePeajesHomeSectionIds(new Set(['peajes:manage'])),
    ).toContain('tarifario');
    expect(
      getVisiblePeajesHomeSectionIds(new Set(['peajes:read', 'peajes:create'])),
    ).not.toContain('tarifario');
  });

  it('muestra las secciones operativas al usuario de carga y revisión', () => {
    expect(
      getVisiblePeajesHomeSectionIds(
        new Set(['peajes:read', 'peajes:create']),
      ),
    ).toEqual([
      'wizard',
      'catalogos',
      'pasadas',
      'pasadas-pendientes',
      'auditoria-tarifas',
      'auditoria-estaciones',
    ]);
  });

  it('no muestra secciones operativas con solo read', () => {
    expect(
      getVisiblePeajesHomeSectionIds(new Set(['peajes:read'])),
    ).toEqual([]);
  });
});
