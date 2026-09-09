import {
  CATALOGOS_CARDS,
  getVisiblePeajesHomeSectionIds,
} from './peajes-catalogos-home.component';

describe('PeajesCatalogosHomeComponent: visibilidad de cards', () => {
  it('el administrador ve cada catálogo por su ruta, no por la clave catalogos', () => {
    const visible = getVisiblePeajesHomeSectionIds(new Set(['peajes:manage']));
    expect(visible).toEqual(['empresas', 'peajes', 'estaciones', 'patentes', 'pases']);
    expect(visible).not.toContain('catalogos');
    expect(CATALOGOS_CARDS.every((c) => visible.includes(c.route))).toBeTrue();
  });

  it('muestra el grid si hay al menos una card visible', () => {
    const visible = getVisiblePeajesHomeSectionIds(
      new Set(['peajes:read', 'peajes:create']),
    );
    expect(visible).toContain('patentes');
    expect(CATALOGOS_CARDS.some((c) => visible.includes(c.route))).toBeTrue();
  });
});
