-- El neto facturado puede incluir descuentos del proveedor que no están
-- representados en BONIFICACION. Se conserva el importe declarado, siempre
-- no negativo; la validación vinculante queda en el subtotal del lote.
ALTER TABLE public.pasadas
  DROP CONSTRAINT IF EXISTS pasadas_importe_neto_chk,
  ADD CONSTRAINT pasadas_importe_neto_chk CHECK (importe_neto >= 0);

COMMENT ON COLUMN public.pasadas.importe_neto IS
  'Neto declarado por el proveedor; la carga contrasta su suma con el subtotal de factura dentro de la tolerancia.';
