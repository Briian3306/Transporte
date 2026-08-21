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

  it('muestra solo las cuatro secciones operativas al usuario de carga y revisión', () => {
    expect(
      getVisiblePeajesHomeSectionIds(
        new Set(['peajes:read', 'peajes:create']),
      ),
    ).toEqual([
      'wizard',
      'pasadas',
      'pasadas-pendientes',
      'auditoria-tarifas',
    ]);
  });

  it('no muestra secciones operativas con solo read', () => {
    expect(
      getVisiblePeajesHomeSectionIds(new Set(['peajes:read'])),
    ).toEqual([]);
  });
});
