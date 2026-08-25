import { BasePage } from './base.page.mjs';

export class PasoPatentesPage extends BasePage {
  get host() {
    return this.byCss('app-patentes-express');
  }

  get plates() {
    return this.byCss('app-patentes-express .pwe-patentes__row .pw__mono');
  }

  async pendingPlates() {
    const nodes = await this.finds(this.plates);
    const values = [];
    for (const node of nodes) {
      const text = (await node.getText()).trim();
      if (text) values.push(text);
    }
    return values;
  }

  async helpMessage() {
    const plates = await this.pendingPlates();
    const list = plates.length ? plates.join(', ') : '(sin listado visible)';
    return `Paso Patentes: hay patentes fuera del catálogo (${list}). No las agrego automáticamente. Revisá Agregar / Quitar del import y pulsá Continuar.`;
  }
}
