-- AUSOL: estaciones maestras, aliases normalizados y datos geográficos.
-- Fuente embebida: docs/plan/seed/ESTACIONES.xlsx (148 filas).
-- La migración no depende de archivos externos al ejecutarse.

ALTER TABLE public.estaciones
  ADD COLUMN IF NOT EXISTS latitud numeric(9, 6),
  ADD COLUMN IF NOT EXISTS longitud numeric(9, 6),
  ADD COLUMN IF NOT EXISTS camino text,
  ADD COLUMN IF NOT EXISTS estado_geocodificacion text;

UPDATE public.estaciones
SET estado_geocodificacion = CASE
  WHEN latitud IS NOT NULL AND longitud IS NOT NULL THEN 'OK'
  ELSE 'REVIEW'
END
WHERE estado_geocodificacion IS NULL
   OR estado_geocodificacion NOT IN ('OK', 'REVIEW');

ALTER TABLE public.estaciones
  ALTER COLUMN estado_geocodificacion SET DEFAULT 'REVIEW';

ALTER TABLE public.estaciones
  DROP CONSTRAINT IF EXISTS estaciones_estado_geocodificacion_chk;

ALTER TABLE public.estaciones
  ADD CONSTRAINT estaciones_estado_geocodificacion_chk
  CHECK (estado_geocodificacion IN ('OK', 'REVIEW'));

CREATE OR REPLACE FUNCTION public.peajes_normalizar_estacion(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    translate(upper(btrim(coalesce(p_valor, ''))),
      'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ',
      'AEIOUUNAEIOUAEIOUAEIOU'
    ),
    '\\s+', ' ', 'g'
  );
$$;

CREATE TABLE IF NOT EXISTS public.estaciones_alias_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  estacion_id uuid NOT NULL REFERENCES public.estaciones(id) ON DELETE CASCADE,
  valor_proveedor text NOT NULL,
  valor_normalizado text NOT NULL,
  origen text NOT NULL DEFAULT 'usuario',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estaciones_alias_proveedor_origen_chk
    CHECK (origen IN ('seed', 'usuario', 'plantilla')),
  CONSTRAINT estaciones_alias_proveedor_uk
    UNIQUE (empresa_id, estacion_id, valor_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_estaciones_alias_empresa_valor
  ON public.estaciones_alias_proveedor (empresa_id, valor_normalizado);
CREATE INDEX IF NOT EXISTS idx_estaciones_alias_estacion
  ON public.estaciones_alias_proveedor (estacion_id);

COMMENT ON TABLE public.estaciones_alias_proveedor IS
  'Aliases confirmados de proveedor por estación y empresa. Las coincidencias ambiguas se resuelven en el wizard.';
COMMENT ON COLUMN public.estaciones.estado_geocodificacion IS
  'OK si latitud y longitud están informadas; REVIEW si falta una o ambas.';
COMMENT ON FUNCTION public.peajes_normalizar_estacion(text) IS
  'Normaliza mayúsculas, acentos y espacios para reconocimiento de estaciones.';

CREATE OR REPLACE FUNCTION public.peajes_validar_alias_estacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_empresa_estacion text;
BEGIN
  NEW.valor_proveedor := btrim(NEW.valor_proveedor);
  NEW.valor_normalizado := public.peajes_normalizar_estacion(NEW.valor_proveedor);

  IF NEW.valor_normalizado = '' THEN
    RAISE EXCEPTION 'El alias de estación no puede estar vacío';
  END IF;

  SELECT p.empresa_id INTO v_empresa_estacion
  FROM public.estaciones e
  JOIN public.peajes p ON p.id = e.peaje_id
  WHERE e.id = NEW.estacion_id;

  IF v_empresa_estacion IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'La estación % no pertenece a la empresa %', NEW.estacion_id, NEW.empresa_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.peajes_sincronizar_alias_estacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.estaciones
  SET codigos_proveedor = (
    SELECT array_agg(DISTINCT a.valor_proveedor ORDER BY a.valor_proveedor)
    FROM public.estaciones_alias_proveedor a
    WHERE a.estacion_id = COALESCE(NEW.estacion_id, OLD.estacion_id)
  )
  WHERE id = COALESCE(NEW.estacion_id, OLD.estacion_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_peajes_validar_alias_estacion ON public.estaciones_alias_proveedor;
CREATE TRIGGER trg_peajes_validar_alias_estacion
  BEFORE INSERT OR UPDATE OF empresa_id, estacion_id, valor_proveedor
  ON public.estaciones_alias_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.peajes_validar_alias_estacion();

DROP TRIGGER IF EXISTS trg_peajes_sincronizar_alias_estacion ON public.estaciones_alias_proveedor;
CREATE TRIGGER trg_peajes_sincronizar_alias_estacion
  AFTER INSERT OR UPDATE OR DELETE ON public.estaciones_alias_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.peajes_sincronizar_alias_estacion();

ALTER TABLE public.estaciones_alias_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estaciones_alias_proveedor_authenticated_all ON public.estaciones_alias_proveedor;
CREATE POLICY estaciones_alias_proveedor_authenticated_all
  ON public.estaciones_alias_proveedor
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estaciones_alias_proveedor TO authenticated;
GRANT ALL ON public.estaciones_alias_proveedor TO service_role;

WITH fuente AS (
  SELECT *
  FROM jsonb_to_recordset($estaciones$[{"zona":"9 DE JULIO - RUTA 5 KM 244","autopista":"CORREDORES VIALES SA","auxiliar":"9 DE JULIO - RUTA 5 KM 244 - CORREDORES VIALES SA","codigo":"CCAG2","direccion":"telepeajeplus","latitud":"-35.360452","longitud":"-60.702857","camino":"RUTA 5 KM 244"},{"zona":"Autopista Pilar-Cordoba","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Autopista Pilar-Cordoba - CAMINOS DE LAS SIERRAS","codigo":"SIER1","direccion":"","latitud":"-31.539977","longitud":"-63.971942","camino":"AUTOPISTA PILAR - CORDOBA"},{"zona":"BARCALA","autopista":"AUTOPISTA DEL OESTE","auxiliar":"BARCALA - AUTOPISTA DEL OESTE","codigo":"OEST7","direccion":"","latitud":"-34.632848","longitud":"-58.664518","camino":"COLECTORAS"},{"zona":"ALBERTI","autopista":"AUSA","auxiliar":"ALBERTI - AUSA","codigo":"AUSA7","direccion":"","latitud":"-34.625268","longitud":"-58.400129","camino":"COLECTORA 25 DE MAYO"},{"zona":"BELGRANO","autopista":"AUSOL","auxiliar":"BELGRANO - AUSOL","codigo":"AUSO10","direccion":"","latitud":"-34.483687","longitud":"-58.626305","camino":"COLECTORAS"},{"zona":"BERAZATEGUI","autopista":"AUBASA","auxiliar":"BERAZATEGUI - AUBASA","codigo":"AUBA5","direccion":"","latitud":"-34.753634","longitud":"-58.190556","camino":"COLECTORAS"},{"zona":"BERNAL","autopista":"AUBASA","auxiliar":"BERNAL - AUBASA","codigo":"AUBA3","direccion":"","latitud":"-34.701119","longitud":"-58.274667","camino":"COLECTORAS"},{"zona":"BOULOGNE SUR ME","autopista":"CORREDORES VIALES SA","auxiliar":"BOULOGNE SUR ME - CORREDORES VIALES SA","codigo":"AUSU3","direccion":"","latitud":"-34.704537","longitud":"-58.499516","camino":"COLECTORA AUTOPISTA RICCHIERI"},{"zona":"BRANDSEN","autopista":"AUTOPISTA DEL OESTE","auxiliar":"BRANDSEN - AUTOPISTA DEL OESTE","codigo":"OEST6","direccion":"","latitud":"-34.628215","longitud":"-58.705688","camino":"COLECTORAS"},{"zona":"BUEN AYRE","autopista":"AUSOL","auxiliar":"BUEN AYRE - AUSOL","codigo":"AUSO8","direccion":"","latitud":"-34.487725","longitud":"-58.589662","camino":"COLECTORAS"},{"zona":"BUEN AYRE","autopista":"AUTOPISTA DEL OESTE","auxiliar":"BUEN AYRE - AUTOPISTA DEL OESTE","codigo":"OEST5","direccion":"","latitud":"-34.628110","longitud":"-58.728036","camino":"COLECTORAS"},{"zona":"CABECERA NORTE","autopista":"CEAMCE","auxiliar":"CABECERA NORTE - CEAMCE","codigo":"CEAM2","direccion":"","latitud":"-34.503398","longitud":"-58.589564","camino":"CAMINO DEL BUEN AYRE"},{"zona":"CABECERA OESTE","autopista":"CEAMCE","auxiliar":"CABECERA OESTE - CEAMCE","codigo":"CEAM1","direccion":"","latitud":"-34.615135","longitud":"-58.719271","camino":"CAMINO DEL BUEN AYRE"},{"zona":"CAMINO REAL","autopista":"AUSOL","auxiliar":"CAMINO REAL - AUSOL","codigo":"AUSO7","direccion":"","latitud":"-34.487768","longitud":"-58.589139","camino":"COLECTORAS"},{"zona":"CAMPANA","autopista":"AUSOL","auxiliar":"CAMPANA - AUSOL","codigo":"AUSO1","direccion":"Ruta 9 Ramal Escobar km 34, B1610 Ricardo Rojas, Buenos Aires","latitud":"-34.458939","longitud":"-58.690663","camino":"RUTA 9"},{"zona":"CAÑUELAS - RUTA 3 KM. 76","autopista":"CORREDORES VIALES SA","auxiliar":"CAÑUELAS - RUTA 3 KM. 76 - CORREDORES VIALES SA","codigo":"AUSUT7","direccion":"telepeajeplus","latitud":"-35.142942","longitud":"-58.740276","camino":"RUTA 3"},{"zona":"CARCARAÑA - AUTOVIA ROSARIO - CORDOBA KM. 356","autopista":"CORREDORES VIALES SA","auxiliar":"CARCARAÑA - AUTOVIA ROSARIO - CORDOBA KM. 356 - CORREDORES VIALES SA","codigo":"CARC1","direccion":"telepeajeplus","latitud":"-32.876366","longitud":"-61.169888","camino":"AUTOPISTA ROSARIO-CORDOBA KM 340"},{"zona":"CERES - RUTA 34 KM 378","autopista":"CORREDORES VIALES SA","auxiliar":"CERES - RUTA 34 KM 378 - CORREDORES VIALES SA","codigo":"CCEN4","direccion":"telepeajeplus","latitud":"-29.946025","longitud":"-61.886494","camino":"RUTA 34 KM 160"},{"zona":"COLONIA ELIA - RUTA 14 KM 100","autopista":"CAMINOS DEL RIO URUGUAY SA","auxiliar":"COLONIA ELIA - RUTA 14 KM 100 - CAMINOS DEL RIO URUGUAY SA","codigo":"CDRU1","direccion":"telepeajeplus","latitud":"-32.666996","longitud":"-58.441772","camino":"RUTA 14 KM 100"},{"zona":"DEBENEDETTI","autopista":"AUSOL","auxiliar":"DEBENEDETTI - AUSOL","codigo":"AUSO3","direccion":"","latitud":"-34.512876","longitud":"-58.521948","camino":"COLECTORAS"},{"zona":"DELLEPIANE I","autopista":"AUSA","auxiliar":"DELLEPIANE I - AUSA","codigo":"AUSA1","direccion":"","latitud":"-34.647962","longitud":"-58.464184","camino":"AUTOPISTA 25 DE MAYO SENTIDO MERCADO CENTRAL"},{"zona":"DELLEPIANE II","autopista":"AUSA","auxiliar":"DELLEPIANE II - AUSA","codigo":"AUSA1","direccion":"","latitud":"-34.647962","longitud":"-58.464184","camino":"AUTOPISTA 25 DE MAYO SENTIDO DOCK SUD"},{"zona":"DEL RODEO","autopista":"AUTOPISTA DEL OESTE","auxiliar":"DEL RODEO - AUTOPISTA DEL OESTE","codigo":"OEST18","direccion":"","latitud":"-34.582699","longitud":"-58.995731","camino":"COLECTORAS"},{"zona":"DERQUI","autopista":"AUTOPISTA DEL OESTE","auxiliar":"DERQUI - AUTOPISTA DEL OESTE","codigo":"OEST9","direccion":"","latitud":"-34.632475","longitud":"-58.611021","camino":"COLECTORAS"},{"zona":"DEVOTO - RUTA 19 KM 142","autopista":"CORREDORES VIALES SA","auxiliar":"DEVOTO - RUTA 19 KM 142 - CORREDORES VIALES SA","codigo":"CCEN3","direccion":"telepeajeplus","latitud":"-31.410877","longitud":"-62.205417","camino":"RUTA 19 KM 142"},{"zona":"DOCK SUD","autopista":"AUBASA","auxiliar":"DOCK SUD - AUBASA","codigo":"AUBA1","direccion":"","latitud":"-34.651174","longitud":"-58.353189","camino":"AUTOPISTA DR. RICARDO BALVIN"},{"zona":"DOLORES PRATS","autopista":"AUTOPISTA DEL OESTE","auxiliar":"DOLORES PRATS - AUTOPISTA DEL OESTE","codigo":"OEST14","direccion":"","latitud":"-34.632256","longitud":"-58.598139","camino":"COLECTORAS"},{"zona":"MERCADO CENTRAL","autopista":"CORREDORES VIALES SA","auxiliar":"MERCADO CENTRAL - CORREDORES VIALES SA","codigo":"AUSU7","direccion":"","latitud":"-34.709679","longitud":"-58.503788","camino":"COLECTORA AUTOPISTA RICCHIERI"},{"zona":"DONOVAN","autopista":"CORREDORES VIALES SA","auxiliar":"DONOVAN - CORREDORES VIALES SA","codigo":"AUSU2","direccion":"","latitud":"-34.708457","longitud":"-58.503603","camino":"COLECTORA AUTOPISTA RICCHIERI"},{"zona":"EL DORADO - RUTA 226 KM. 31","autopista":"CORREDORES VIALES SA","auxiliar":"EL DORADO - RUTA 226 KM. 31 - CORREDORES VIALES SA","codigo":"ELDO1","direccion":"telepeajeplus","latitud":"-37.884806","longitud":"-57.902077","camino":"RUTA 226 KM 31"},{"zona":"EZEIZA","autopista":"CORREDORES VIALES SA","auxiliar":"EZEIZA - CORREDORES VIALES SA","codigo":"AUSU5","direccion":"","latitud":"-34.829602","longitud":"-58.509833","camino":"AUTOPISTA EZEIZA-CAÑUELAS"},{"zona":"FRANCK - RUTA 19 KM 20","autopista":"CORREDORES VIALES SA","auxiliar":"FRANCK - RUTA 19 KM 20 - CORREDORES VIALES SA","codigo":"CCEN2","direccion":"telepeajeplus","latitud":"-31.636226","longitud":"-60.974166","camino":"RUTA 19 KM 20"},{"zona":"GUTIERREZ","autopista":"AUBASA","auxiliar":"GUTIERREZ - AUBASA","codigo":"AUBA12","direccion":"","latitud":"-34.785167","longitud":"-58.152825","camino":""},{"zona":"GENERAL MADARIAGA","autopista":"AUBASA","auxiliar":"GENERAL MADARIAGA - AUBASA","codigo":"AUBA10","direccion":"","latitud":"-37.035948","longitud":"-57.142962","camino":"RUTA 74"},{"zona":"COMBATE DE PAVON","autopista":"CEAMCE","auxiliar":"COMBATE DE PAVON - CEAMCE","codigo":"CEAM10","direccion":"","latitud":"-34.568041","longitud":"-58.639474","camino":"ACCESO A CAMINO DEL BUEN AYRE SUR"},{"zona":"DEBENEDETTI","autopista":"CEAMCE","auxiliar":"DEBENEDETTI - CEAMCE","codigo":"CEAM11","direccion":"","latitud":"-34.533383","longitud":"-58.597154","camino":"ACCESO A CAMINO DEL BUEN AYRE NORTE"},{"zona":"GORRITI ASCENDENTE","autopista":"CEAMCE","auxiliar":"GORRITI ASCENDENTE - CEAMCE","codigo":"CEAM9","direccion":"","latitud":"-34.583853","longitud":"-58.678158","camino":"ACCESO A CAMINO DEL BUEN AYRE SUR"},{"zona":"GORRITI DESCENDENTE","autopista":"CEAMCE","auxiliar":"GORRITI DESCENDENTE - CEAMCE","codigo":"CEAM8","direccion":"","latitud":"-34.583700","longitud":"-58.675930","camino":"ACCESO A CAMINO DEL BUEN AYRE NORTE"},{"zona":"GRAL.RODRIGUEZ","autopista":"AUTOPISTA DEL OESTE","auxiliar":"GRAL.RODRIGUEZ - AUTOPISTA DEL OESTE","codigo":"OEST12","direccion":"","latitud":"-34.593568","longitud":"-58.946167","camino":"COLECTORAS"},{"zona":"HINOJO - RUTA 226 KM. 276","autopista":"CORREDORES VIALES SA","auxiliar":"HINOJO - RUTA 226 KM. 276 - CORREDORES VIALES SA","codigo":"HINO","direccion":"telepeajeplus","latitud":"-36.861793","longitud":"-60.122772","camino":"RUTA 226 KM 276"},{"zona":"MADARIAGA","autopista":"AUBASA","auxiliar":"MADARIAGA - AUBASA","codigo":"AUBA11","direccion":"","latitud":"-37.035948","longitud":"-57.142962","camino":"RUTA 74"},{"zona":"HUDSON","autopista":"AUBASA","auxiliar":"HUDSON - AUBASA","codigo":"AUBA2","direccion":"","latitud":"-34.774081","longitud":"-58.163474","camino":"AUTOPISTA DR. RICARDO BALVIN"},{"zona":"ISLA LA DESEADA - RUTA 174 KM 5,2 (Pte. Rosario-Victoria)","autopista":"CAMINOS DEL RIO URUGUAY SA","auxiliar":"ISLA LA DESEADA - RUTA 174 KM 5,2 (Pte. Rosario-Victoria) - CAMINOS DEL RIO URUGUAY SA","codigo":"CDRU5","direccion":"telepeajeplus","latitud":"-32.865372","longitud":"-60.651109","camino":"RUTA 174 KM 5"},{"zona":"ITUZAINGÓ","autopista":"AUTOPISTA DEL OESTE","auxiliar":"ITUZAINGÓ - AUTOPISTA DEL OESTE","codigo":"OEST2","direccion":"","latitud":"-34.631136","longitud":"-58.676026","camino":"AUTOPISTA ACCESO OESTE"},{"zona":"JAMES CRAIK - AUTOVIA ROSARIO - CORDOBA KM. 595","autopista":"CORREDORES VIALES SA","auxiliar":"JAMES CRAIK - AUTOVIA ROSARIO - CORDOBA KM. 595 - CORREDORES VIALES SA","codigo":"JAME1","direccion":"telepeajeplus","latitud":"-32.188658","longitud":"-63.389340","camino":"AUTOPISTA ROSARIO-CORDOBA KM 588"},{"zona":"JUNIN (R7) - RUTA 7 KM. 272","autopista":"CORREDORES VIALES SA","auxiliar":"JUNIN (R7) - RUTA 7 KM. 272 - CORREDORES VIALES SA","codigo":"JUNI1","direccion":"telepeajeplus","latitud":"-34.579294","longitud":"-61.094056","camino":"RUTA 7 KM 272"},{"zona":"LA HUELLA","autopista":"AUBASA","auxiliar":"LA HUELLA - AUBASA","codigo":"AUBA8","direccion":"","latitud":"-36.428082","longitud":"-57.351004","camino":"RUTA 11"},{"zona":"LA PAZ - RUTA 7 KM 899","autopista":"CORREDORES VIALES SA","auxiliar":"LA PAZ - RUTA 7 KM 899 - CORREDORES VIALES SA","codigo":"LAPA1","direccion":"telepeajeplus","latitud":"-33.929730","longitud":"-64.452027","camino":"RUTA 7 KM 899"},{"zona":"LAGOS - RUTA 9 KM. 272","autopista":"CORREDORES VIALES SA","auxiliar":"LAGOS - RUTA 9 KM. 272 - CORREDORES VIALES SA","codigo":"LAGO1","direccion":"telepeajeplus","latitud":"-33.128840","longitud":"-60.578008","camino":"RUTA 9 KM. 272"},{"zona":"LARENA - RUTA 8 KM 65","autopista":"CORREDORES VIALES SA","auxiliar":"LARENA - RUTA 8 KM 65 - CORREDORES VIALES SA","codigo":"LARE1","direccion":"telepeajeplus","latitud":"-34.403064","longitud":"-59.013834","camino":"RUTA 8 KM 65"},{"zona":"J.J.CASTRO","autopista":"AUTOPISTA DEL OESTE","auxiliar":"J.J.CASTRO - AUTOPISTA DEL OESTE","codigo":"OEST16","direccion":"","latitud":"-34.588429","longitud":"-58.969269","camino":"COLECTORAS"},{"zona":"LUJAN","autopista":"AUTOPISTA DEL OESTE","auxiliar":"LUJAN - AUTOPISTA DEL OESTE","codigo":"OEST1","direccion":"","latitud":"-34.579930","longitud":"-59.007648","camino":"AUTOPISTA ACCESO OESTE"},{"zona":"MAIPU","autopista":"AUBASA","auxiliar":"MAIPU - AUBASA","codigo":"AUBA7","direccion":"","latitud":"-36.846627","longitud":"-57.866678","camino":"RUTA 2"},{"zona":"MALVINAS","autopista":"AUTOPISTA DEL OESTE","auxiliar":"MALVINAS - AUTOPISTA DEL OESTE","codigo":"OEST13","direccion":"","latitud":"-34.602338","longitud":"-58.900927","camino":"COLECTORAS"},{"zona":"MAR CHIQUITA","autopista":"AUBASA","auxiliar":"MAR CHIQUITA - AUBASA","codigo":"AUBA9","direccion":"","latitud":"-37.733697","longitud":"-57.445834","camino":"RUTA 11"},{"zona":"MARQUEZ","autopista":"AUSOL","auxiliar":"MARQUEZ - AUSOL","codigo":"AUSO4","direccion":"","latitud":"-34.498383","longitud":"-58.550959","camino":"COLECTORAS"},{"zona":"MARTIN FIERRO","autopista":"CEAMCE","auxiliar":"MARTIN FIERRO - CEAMCE","codigo":"CEAM5","direccion":"","latitud":"-34.609318","longitud":"-58.714545","camino":"ACCESO A CAMINO DEL BUEN AYRE SUR"},{"zona":"MARTIN FIERRO","autopista":"AUTOPISTA DEL OESTE","auxiliar":"MARTIN FIERRO - AUTOPISTA DEL OESTE","codigo":"OEST3","direccion":"","latitud":"-34.628853","longitud":"-58.692604","camino":"COLECTORAS"},{"zona":"MONTE GRANDE","autopista":"CORREDORES VIALES SA","auxiliar":"MONTE GRANDE - CORREDORES VIALES SA","codigo":"AUSU4","direccion":"","latitud":"-34.832063","longitud":"-58.508589","camino":"AUTOPISTA EZEIZA-CAÑUELAS"},{"zona":"OLIVERA - RUTA 5 KM. 86","autopista":"CORREDORES VIALES SA","auxiliar":"OLIVERA - RUTA 5 KM. 86 - CORREDORES VIALES SA","codigo":"CCAG1","direccion":"telepeajeplus","latitud":"-34.644989","longitud":"-59.294312","camino":"RUTA 5 KM. 86"},{"zona":"ILLIA II","autopista":"AUSA","auxiliar":"ILLIA II - AUSA","codigo":"AUSA7","direccion":"","latitud":"-34.619417","longitud":"-58.365939","camino":"PASEO DEL BAJO"},{"zona":"PASEO DEL BAJO","autopista":"AUSA","auxiliar":"PASEO DEL BAJO - AUSA","codigo":"AUSA7","direccion":"","latitud":"-34.619417","longitud":"-58.365939","camino":"PASEO DEL BAJO"},{"zona":"PIEDRITAS - RUTA 14 KM 363","autopista":"CAMINOS DEL RIO URUGUAY SA","auxiliar":"PIEDRITAS - RUTA 14 KM 363 - CAMINOS DEL RIO URUGUAY SA","codigo":"CDRU4","direccion":"telepeajeplus","latitud":"-30.455707","longitud":"-57.985022","camino":"RUTA 14 KM 363"},{"zona":"PILAR","autopista":"AUSOL","auxiliar":"PILAR - AUSOL","codigo":"AUSO2","direccion":"Tortuguitas, Buenos Aires","latitud":"-34.4617216","longitud":"-58.7069456","camino":"RUTA 8"},{"zona":"POSADAS","autopista":"AUTOPISTA DEL OESTE","auxiliar":"POSADAS - AUTOPISTA DEL OESTE","codigo":"OEST10","direccion":"","latitud":"-34.631181","longitud":"-58.571714","camino":"COLECTORAS"},{"zona":"AVELLANEDA","autopista":"AUSA","auxiliar":"AVELLANEDA - AUSA","codigo":"AUSA2","direccion":"","latitud":"-34.647925","longitud":"-58.477868","camino":"AUTOPISTA PERITO MORENO"},{"zona":"QUILMES","autopista":"AUBASA","auxiliar":"QUILMES - AUBASA","codigo":"AUBA4","direccion":"","latitud":"-34.716444","longitud":"-58.236800","camino":"COLECTORAS"},{"zona":"QUINTANA","autopista":"AUTOPISTA DEL OESTE","auxiliar":"QUINTANA - AUTOPISTA DEL OESTE","codigo":"OEST17","direccion":"","latitud":"-34.629135","longitud":"-58.713329","camino":"COLECTORAS"},{"zona":"REPUBLICA","autopista":"AUTOPISTA DEL OESTE","auxiliar":"REPUBLICA - AUTOPISTA DEL OESTE","codigo":"OEST11","direccion":"","latitud":"-34.629607","longitud":"-58.556744","camino":"COLECTORAS"},{"zona":"ILLIA","autopista":"AUSA","auxiliar":"ILLIA - AUSA","codigo":"AUSA4","direccion":"","latitud":"-34.575207","longitud":"-58.392979","camino":"AUTOPISTA ILLIA"},{"zona":"RETIRO II","autopista":"AUSA","auxiliar":"RETIRO II - AUSA","codigo":"AUSA3","direccion":"","latitud":"-34.573330","longitud":"-58.395960","camino":"COLECTORA AUTOPISTA ILLIA"},{"zona":"RICCHIERI","autopista":"CORREDORES VIALES SA","auxiliar":"RICCHIERI - CORREDORES VIALES SA","codigo":"AUSU1","direccion":"","latitud":"-34.699047","longitud":"-58.495904","camino":"AUTOPISTA RICCHIERI"},{"zona":"Ruta 19","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 19 - CAMINOS DE LAS SIERRAS","codigo":"SIER3","direccion":"","latitud":"-31.327860","longitud":"-63.874952","camino":"RUTA 19 KM 51,7"},{"zona":"RUTA 197","autopista":"AUSOL","auxiliar":"RUTA 197 - AUSOL","codigo":"AUSO11","direccion":"","latitud":"-34.477241","longitud":"-58.656727","camino":"COLECTORAS"},{"zona":"Ruta 20","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 20 - CAMINOS DE LAS SIERRAS","codigo":"SIER7","direccion":"","latitud":"-31.436599","longitud":"-64.312363","camino":"Ruta 20 Km 14.6"},{"zona":"RUTA 201 ASCENDENTE","autopista":"CEAMCE","auxiliar":"RUTA 201 ASCENDENTE - CEAMCE","codigo":"CEAM4","direccion":"","latitud":"-34.569027","longitud":"-58.655770","camino":"ACCESO A CAMINO DEL BUEN AYRE SUR"},{"zona":"RUTA 201 DESCENDENTE","autopista":"CEAMCE","auxiliar":"RUTA 201 DESCENDENTE - CEAMCE","codigo":"CEAM3","direccion":"","latitud":"-34.568508","longitud":"-58.649288","camino":"ACCESO A CAMINO DEL BUEN AYRE NORTE"},{"zona":"RUTA 202","autopista":"AUSOL","auxiliar":"RUTA 202 - AUSOL","codigo":"AUSO9","direccion":"","latitud":"-34.486052","longitud":"-58.609632","camino":"COLECTORAS"},{"zona":"Ruta 36","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 36 - CAMINOS DE LAS SIERRAS","codigo":"SIER10","direccion":"","latitud":"-31.519742","longitud":"-64.228931","camino":"Ruta 36 Km 800"},{"zona":"Ruta 36 Arroyo Tegua","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 36 Arroyo Tegua - CAMINOS DE LAS SIERRAS","codigo":"SIER8","direccion":"","latitud":"-32.699011","longitud":"-64.350693","camino":"Ruta 36 Km. 650"},{"zona":"Ruta 36 Piedras Moras","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 36 Piedras Moras - CAMINOS DE LAS SIERRAS","codigo":"SIER9","direccion":"","latitud":"-32.132007","longitud":"-64.293573","camino":"Ruta 36 Km. 724.5"},{"zona":"Ruta 5","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 5 - CAMINOS DE LAS SIERRAS","codigo":"SIER11","direccion":"","latitud":"-31.540495","longitud":"-64.304901","camino":"Ruta 5 Km 11.5"},{"zona":"RUTA 8 ASCENDENTE","autopista":"CEAMCE","auxiliar":"RUTA 8 ASCENDENTE - CEAMCE","codigo":"CEAM7","direccion":"","latitud":"-34.564408","longitud":"-58.631444","camino":"ACCESO A CAMINO DEL BUEN AYRE SUR"},{"zona":"RUTA 8 DESCENDIENTE","autopista":"CEAMCE","auxiliar":"RUTA 8 DESCENDIENTE - CEAMCE","codigo":"CEAM6","direccion":"","latitud":"-34.560189","longitud":"-58.627886","camino":"ACCESO A CAMINO DEL BUEN AYRE NORTE"},{"zona":"Ruta 9 Nort","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 9 Nort - CAMINOS DE LAS SIERRAS","codigo":"SIER4","direccion":"","latitud":"-31.190828","longitud":"-64.153010","camino":"Ruta 9 Km. 729"},{"zona":"Ruta 9 Sur","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta 9 Sur - CAMINOS DE LAS SIERRAS","codigo":"SIER2","direccion":"","latitud":"-31.569359","longitud":"-63.995326","camino":"RUTA 9 KM 677"},{"zona":"Ruta E53","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta E53 - CAMINOS DE LAS SIERRAS","codigo":"SIER5","direccion":"","latitud":"-31.312756","longitud":"-64.218684","camino":"Ruta E53 Km. 5"},{"zona":"Ruta E55","autopista":"CAMINOS DE LAS SIERRAS","auxiliar":"Ruta E55 - CAMINOS DE LAS SIERRAS","codigo":"SIER6","direccion":"","latitud":"-31.370082","longitud":"-64.299618","camino":"Ruta E55 Km. 4"},{"zona":"SALGUERO","autopista":"AUSA","auxiliar":"SALGUERO - AUSA","codigo":"AUSA5","direccion":"","latitud":"-34.571068","longitud":"-58.401136","camino":"COLECTORA AUTOPISTA ILLIA"},{"zona":"SAMBOROMBON","autopista":"AUBASA","auxiliar":"SAMBOROMBON - AUBASA","codigo":"AUBA6","direccion":"","latitud":"-35.307614","longitud":"-58.053579","camino":"RUTA 2"},{"zona":"SAMPACHO - RUTA 8 KM 655","autopista":"CORREDORES VIALES SA","auxiliar":"SAMPACHO - RUTA 8 KM 655 - CORREDORES VIALES SA","codigo":"SAMP1","direccion":"telepeajeplus","latitud":"-33.424251","longitud":"-64.775577","camino":"RUTA 8 KM 655"},{"zona":"SAN FERNANDO","autopista":"AUTOPISTA DEL OESTE","auxiliar":"SAN FERNANDO - AUTOPISTA DEL OESTE","codigo":"OEST15","direccion":"","latitud":"-34.596287","longitud":"-58.935417","camino":"COLECTORAS"},{"zona":"SAN MARTIN","autopista":"AUSOL","auxiliar":"SAN MARTIN - AUSOL","codigo":"AUSO6","direccion":"","latitud":"-34.491124","longitud":"-58.566103","camino":"COLECTORAS"},{"zona":"SAN VICENTE - RUTA 34 KM 160","autopista":"CORREDORES VIALES SA","auxiliar":"SAN VICENTE - RUTA 34 KM 160 - CORREDORES VIALES SA","codigo":"CCEN1","direccion":"telepeajeplus","latitud":"-31.792116","longitud":"-61.567139","camino":"RUTA 34 KM 160"},{"zona":"SANTA ROSA","autopista":"AUTOPISTA DEL OESTE","auxiliar":"SANTA ROSA - AUTOPISTA DEL OESTE","codigo":"OEST8","direccion":"","latitud":"-34.631462","longitud":"-58.652266","camino":"COLECTORAS"},{"zona":"SARMIENTO","autopista":"AUSA","auxiliar":"SARMIENTO - AUSA","codigo":"AUSA6","direccion":"","latitud":"-34.567121","longitud":"-58.406271","camino":"COLECTORA AUTOPISTA ILLIA"},{"zona":"SOLIS - RUTA 8 KM 102","autopista":"CORREDORES VIALES SA","auxiliar":"SOLIS - RUTA 8 KM 102 - CORREDORES VIALES SA","codigo":"SOLI1","direccion":"telepeajeplus","latitud":"-34.284547","longitud":"-59.363566","camino":"RUTA 8 KM 102"},{"zona":"TIGRE","autopista":"AUSOL","auxiliar":"TIGRE - AUSOL","codigo":"AUSO5","direccion":"","latitud":"-34.4862899","longitud":"-58.5601146","camino":"RAMAL TIGRE"},{"zona":"TRENQUE LAUQUEN - RUTA 5 KM 429","autopista":"CORREDORES VIALES SA","auxiliar":"TRENQUE LAUQUEN - RUTA 5 KM 429 - CORREDORES VIALES SA","codigo":"CCAG3","direccion":"telepeajeplus","latitud":"-35.918150","longitud":"-62.556148","camino":"RUTA 5 KM 429"},{"zona":"TRISTAN SUAREZ","autopista":"CORREDORES VIALES SA","auxiliar":"TRISTAN SUAREZ - CORREDORES VIALES SA","codigo":"AUSU6","direccion":"","latitud":"-34.853980","longitud":"-58.551552","camino":"AUTOPISTA EZEIZA-CAÑUELAS"},{"zona":"TUNEL SUBFLUVIAL - ENTRE RIOS","autopista":"TUNEL SUBFLUVIAL","auxiliar":"TUNEL SUBFLUVIAL - ENTRE RIOS - TUNEL SUBFLUVIAL","codigo":"TUNE1","direccion":"telepeajeplus","latitud":"-31.716609","longitud":"-60.502295","camino":"RUTA 168"},{"zona":"TUNEL SUBFLUVIAL - SANTA FE","autopista":"TUNEL SUBFLUVIAL","auxiliar":"TUNEL SUBFLUVIAL - SANTA FE - TUNEL SUBFLUVIAL","codigo":"TUNE2","direccion":"telepeajeplus","latitud":"-31.687450","longitud":"-60.512139","camino":"RUTA 168"},{"zona":"URIBELARREA - RUTA 205 KM. 83","autopista":"CORREDORES VIALES SA","auxiliar":"URIBELARREA - RUTA 205 KM. 83 - CORREDORES VIALES SA","codigo":"AUSUT8","direccion":"telepeajeplus","latitud":"-35.097140","longitud":"-58.931513","camino":"RUTA 205"},{"zona":"V. TUERTO (RN8) - RUTA 8 KM 381","autopista":"CORREDORES VIALES SA","auxiliar":"V. TUERTO (RN8) - RUTA 8 KM 381 - CORREDORES VIALES SA","codigo":"VETU1","direccion":"telepeajeplus","latitud":"-33.691188","longitud":"-62.097299","camino":"RUTA 8 KM 381"},{"zona":"TANDIL (VASCONIA) - RUTA 226 KM. 153","autopista":"CORREDORES VIALES SA","auxiliar":"TANDIL (VASCONIA) - RUTA 226 KM. 153 - CORREDORES VIALES SA","codigo":"VASC1","direccion":"telepeajeplus","latitud":"-37.373016","longitud":"-59.008037","camino":"RUTA 226 KM 153"},{"zona":"VERGARA","autopista":"AUTOPISTA DEL OESTE","auxiliar":"VERGARA - AUTOPISTA DEL OESTE","codigo":"OEST4","direccion":"","latitud":"-34.632751","longitud":"-58.624854","camino":"COLECTORAS"},{"zona":"VICUÑA MACKENNA - RUTA 7 KM 592","autopista":"CORREDORES VIALES SA","auxiliar":"VICUÑA MACKENNA - RUTA 7 KM 592 - CORREDORES VIALES SA","codigo":"VICU1","direccion":"telepeajeplus","latitud":"-33.929732","longitud":"-64.452031","camino":"RUTA 7 KM 592"},{"zona":"VILLA ESPIL - RUTA 7 KM. 88","autopista":"CORREDORES VIALES SA","auxiliar":"VILLA ESPIL - RUTA 7 KM. 88 - CORREDORES VIALES SA","codigo":"VILL1","direccion":"telepeajeplus","latitud":"-34.519862","longitud":"-59.308842","camino":"RUTA 7 KM. 88"},{"zona":"YERUA - RUTA 14 KM 242","autopista":"CAMINOS DEL RIO URUGUAY SA","auxiliar":"YERUA - RUTA 14 KM 242 - CAMINOS DEL RIO URUGUAY SA","codigo":"CDRU3","direccion":"telepeajeplus","latitud":"-31.507620","longitud":"-58.183975","camino":"RUTA 14 KM 242"},{"zona":"ZARATE - RUTA 12 KM 85","autopista":"CAMINOS DEL RIO URUGUAY SA","auxiliar":"ZARATE - RUTA 12 KM 85 - CAMINOS DEL RIO URUGUAY SA","codigo":"CDRU2","direccion":"telepeajeplus","latitud":"-34.118089","longitud":"-59.011256","camino":"RUTA 12 KM 85"},{"zona":"ZARATE - RUTA 9 KM. 95","autopista":"CORREDORES VIALES SA","auxiliar":"ZARATE - RUTA 9 KM. 95 - CORREDORES VIALES SA","codigo":"ZARA2","direccion":"telepeajeplus","latitud":"-34.101223","longitud":"-59.150349","camino":"RUTA 9 KM. 95"},{"zona":"DESAGUADERO","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"DESAGUADERO - ENTE DE CONTROL DE RUTAS","codigo":"ECDR1","direccion":"","latitud":"-33.411719","longitud":"-67.123489","camino":"RUTA 7"},{"zona":"ANCHORENA","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"ANCHORENA - ENTE DE CONTROL DE RUTAS","codigo":"ECDR2","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"BUENA ESPERANZA","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"BUENA ESPERANZA - ENTE DE CONTROL DE RUTAS","codigo":"ECDR3","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"CRUZ DE PIEDRA","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"CRUZ DE PIEDRA - ENTE DE CONTROL DE RUTAS","codigo":"ECDR4","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"CUATRO ESQUINAS","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"CUATRO ESQUINAS - ENTE DE CONTROL DE RUTAS","codigo":"ECDR5","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"EL PORTEZUELO","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"EL PORTEZUELO - ENTE DE CONTROL DE RUTAS","codigo":"ECDR6","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"JUSTO DARACK","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"JUSTO DARACK - ENTE DE CONTROL DE RUTAS","codigo":"ECDR7","direccion":"","latitud":"-33.852119","longitud":"-65.150784","camino":"RUTA 7"},{"zona":"LA CUMBRE","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"LA CUMBRE - ENTE DE CONTROL DE RUTAS","codigo":"ECDR8","direccion":"","latitud":"-33.359087","longitud":"-66.067072","camino":"RUTA 7"},{"zona":"LA PUNILLA","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"LA PUNILLA - ENTE DE CONTROL DE RUTAS","codigo":"ECDR9","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"LA TOMA","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"LA TOMA - ENTE DE CONTROL DE RUTAS","codigo":"ECDR10","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"LOS PUQUIOS","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"LOS PUQUIOS - ENTE DE CONTROL DE RUTAS","codigo":"ECDR11","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"RIO QUINTO","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"RIO QUINTO - ENTE DE CONTROL DE RUTAS","codigo":"ECDR12","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"SANTA ROSA","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"SANTA ROSA - ENTE DE CONTROL DE RUTAS","codigo":"ECDR13","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"VILLA MERCEDES","autopista":"ENTE DE CONTROL DE RUTAS","auxiliar":"VILLA MERCEDES - ENTE DE CONTROL DE RUTAS","codigo":"ECDR14","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"LA RIBERA","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"LA RIBERA - UNIDAD EJECUTORA (SANTA FE)","codigo":"VSF1","direccion":"","latitud":"-32.636353","longitud":"-60.824491","camino":"AU ROSARIO - SANTA FE"},{"zona":"ALDAO","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"ALDAO - UNIDAD EJECUTORA (SANTA FE)","codigo":"VSF2","direccion":"","latitud":"-32.699376","longitud":"-60.785528","camino":"AU ROSARIO - SANTA FE"},{"zona":"SANTO TOME","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"SANTO TOME - UNIDAD EJECUTORA (SANTA FE)","codigo":"VSF4","direccion":"","latitud":"-31.6676119","longitud":"-60.7957883","camino":"AU ROSARIO - SANTA FE"},{"zona":"SAN LORENZO SUR","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"SAN LORENZO SUR - UNIDAD EJECUTORA (SANTA FE)","codigo":"VF8","direccion":"","latitud":"-32.767121","longitud":"-60.747441","camino":"Acceso San lorenzo SUR"},{"zona":"SAN LORENZO NORTE","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"SAN LORENZO NORTE - UNIDAD EJECUTORA (SANTA FE)","codigo":"VF7","direccion":"","latitud":"-32.7250131","longitud":"-60.7630992","camino":"Acceso San lorenzo NORTE"},{"zona":"SAN LORENZO CENTRO","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"SAN LORENZO CENTRO - UNIDAD EJECUTORA (SANTA FE)","codigo":"VSF5","direccion":"","latitud":"-32.7491021","longitud":"-60.7590877","camino":"Acceso San lorenzo CENTRO"},{"zona":"ACCESO SAUCE VIEJO","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"ACCESO SAUCE VIEJO - UNIDAD EJECUTORA (SANTA FE)","codigo":"VSF6","direccion":"","latitud":"-31.691148","longitud":"-60.8106226","camino":"ACCESO A SAUCE VIEJO"},{"zona":"TRONCAL SAUCE VIEJO","autopista":"UNIDAD EJECUTORA (SANTA FE)","auxiliar":"TRONCAL SAUCE VIEJO - UNIDAD EJECUTORA (SANTA FE)","codigo":"VSF3","direccion":"","latitud":"-31.708643","longitud":"-60.825832","camino":"AU ROSARIO - SANTA FE"},{"zona":"JUNIN -  RUTA 188 KM 152","autopista":"CORREDOR DE INTEGRACION PAMPEANA","auxiliar":"JUNIN -  RUTA 188 KM 152 - CORREDOR DE INTEGRACION PAMPEANA","codigo":"CIP1","direccion":"","latitud":"-34.532227","longitud":"-60.901963","camino":"RN 188 KM 152"},{"zona":"FERNANDEZ","autopista":"AUTOVIA BS. AS. A LOS ANDES","auxiliar":"FERNANDEZ - AUTOVIA BS. AS. A LOS ANDES","codigo":"ABA1","direccion":"","latitud":"-27.948172","longitud":"-63.846301","camino":"RUTA 34"},{"zona":"LA FLORIDA","autopista":"AUTOVIA BS. AS. A LOS ANDES","auxiliar":"LA FLORIDA - AUTOVIA BS. AS. A LOS ANDES","codigo":"ABA2","direccion":"","latitud":"-27.363540","longitud":"-64.957227","camino":"RUTA 9"},{"zona":"MOLLE YACO","autopista":"AUTOVIA BS. AS. A LOS ANDES","auxiliar":"MOLLE YACO - AUTOVIA BS. AS. A LOS ANDES","codigo":"ABA3","direccion":"","latitud":"-26.294743","longitud":"-65.280757","camino":"RUTA 9"},{"zona":"CABEZA DE BUEY","autopista":"AUTOVIA BS. AS. A LOS ANDES","auxiliar":"CABEZA DE BUEY - AUTOVIA BS. AS. A LOS ANDES","codigo":"ABA4","direccion":"","latitud":"-24.814319","longitud":"-65.015881","camino":"RUTA 9"},{"zona":"Pte. BELGRANO","autopista":"CAMINOS DEL PARANA","auxiliar":"Pte. BELGRANO - CAMINOS DEL PARANA","codigo":"CDP1","direccion":"","latitud":"-27.446236","longitud":"-58.887273","camino":"RUTA 16 KM 5"},{"zona":"MAKALLÉ","autopista":"CAMINOS DEL PARANA","auxiliar":"MAKALLÉ - CAMINOS DEL PARANA","codigo":"CDP2","direccion":"","latitud":"-27.186774","longitud":"-59.326305","camino":"R16 KM 59,8"},{"zona":"RIACHUELO","autopista":"CAMINOS DEL PARANA","auxiliar":"RIACHUELO - CAMINOS DEL PARANA","codigo":"CDP3","direccion":"","latitud":"-27.621296","longitud":"-58.738332","camino":"RUTA 12 KM 1014"},{"zona":"ITUZAINGÓ","autopista":"CAMINOS DEL PARANA","auxiliar":"ITUZAINGÓ - CAMINOS DEL PARANA","codigo":"CDP4","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"SANTA ANA","autopista":"CAMINOS DEL PARANA","auxiliar":"SANTA ANA - CAMINOS DEL PARANA","codigo":"CDP5","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"Cnia. VICTORIA","autopista":"CAMINOS DEL PARANA","auxiliar":"Cnia. VICTORIA - CAMINOS DEL PARANA","codigo":"CDP6","direccion":"","latitud":"","longitud":"","camino":""},{"zona":"RUTA 18","autopista":"CORREDOR VIAL 4","auxiliar":"RUTA 18 - CORREDOR VIAL 4","codigo":"CV41","direccion":"","latitud":"-33.156382","longitud":"-60.720413","camino":"RUTA 18"},{"zona":"FACHINAL","autopista":"COVINT CONCESIONARIO VIAL","auxiliar":"FACHINAL - COVINT CONCESIONARIO VIAL","codigo":"COVI1","direccion":"","latitud":"-27.644117","longitud":"-55.815936","camino":"RUTA 105"},{"zona":"TANCACHA","autopista":"ENTE INTERMUNICIPAL Y COMUNAL","auxiliar":"TANCACHA - ENTE INTERMUNICIPAL Y COMUNAL","codigo":"EIC1","direccion":"","latitud":"-32.219127","longitud":"-64.009692","camino":"RUTA 6"},{"zona":"DAMALCIO VELEZ","autopista":"ENTE INTERMUNICIPAL Y COMUNAL","auxiliar":"DAMALCIO VELEZ - ENTE INTERMUNICIPAL Y COMUNAL","codigo":"EIC2","direccion":"","latitud":"-32.582309","longitud":"-63.570484","camino":"RUTA 6"}]$estaciones$::jsonb)
    AS x(zona text, autopista text, auxiliar text, codigo text, direccion text, latitud text, longitud text, camino text)
),
empresas_seed AS (
  SELECT DISTINCT autopista AS nombre
  FROM fuente
  WHERE autopista <> ''
),
empresas AS (
  INSERT INTO public.empresas (nombre, descripcion)
  SELECT nombre, 'Empresa creada desde ESTACIONES.xlsx.'
  FROM empresas_seed
  ON CONFLICT (nombre) DO UPDATE
    SET descripcion = EXCLUDED.descripcion
  RETURNING id, nombre
),
empresas_todas AS (
  SELECT id, nombre FROM empresas
  UNION
  SELECT e.id, e.nombre
  FROM public.empresas e
  JOIN empresas_seed s ON s.nombre = e.nombre
),
peajes_insertados AS (
  INSERT INTO public.peajes (nombre, ubicacion, descripcion, empresa_id)
  SELECT e.nombre, NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', e.id::text
  FROM empresas_todas e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.peajes p
    WHERE p.nombre = e.nombre AND p.empresa_id = e.id::text
  )
  RETURNING id, nombre, empresa_id
),
peajes_todos AS (
  SELECT id, nombre, empresa_id FROM peajes_insertados
  UNION
  SELECT p.id, p.nombre, p.empresa_id
  FROM public.peajes p
  JOIN empresas_todas e ON p.nombre = e.nombre AND p.empresa_id = e.id::text
),
estaciones_insertadas AS (
  INSERT INTO public.estaciones (
    peaje_id, nombre, ubicacion, descripcion, latitud, longitud, camino, estado_geocodificacion
  )
  SELECT
    p.id,
    f.zona,
    NULLIF(f.direccion, ''),
    NULLIF(f.direccion, ''),
    NULLIF(f.latitud, '')::numeric,
    NULLIF(f.longitud, '')::numeric,
    NULLIF(f.camino, ''),
    CASE WHEN NULLIF(f.latitud, '') IS NOT NULL AND NULLIF(f.longitud, '') IS NOT NULL THEN 'OK' ELSE 'REVIEW' END
  FROM fuente f
  JOIN peajes_todos p ON p.nombre = f.autopista
  WHERE NOT EXISTS (
    SELECT 1 FROM public.estaciones e
    WHERE e.peaje_id = p.id AND e.nombre = f.zona
  )
  RETURNING id, peaje_id, nombre
),
estaciones_todas AS (
  SELECT id, peaje_id, nombre FROM estaciones_insertadas
  UNION
  SELECT e.id, e.peaje_id, e.nombre
  FROM public.estaciones e
  JOIN peajes_todos p ON p.id = e.peaje_id
),
datos_actualizados AS (
  UPDATE public.estaciones e
  SET
    ubicacion = NULLIF(f.direccion, ''),
    descripcion = NULLIF(f.direccion, ''),
    latitud = NULLIF(f.latitud, '')::numeric,
    longitud = NULLIF(f.longitud, '')::numeric,
    camino = NULLIF(f.camino, ''),
    estado_geocodificacion = CASE
      WHEN NULLIF(f.latitud, '') IS NOT NULL AND NULLIF(f.longitud, '') IS NOT NULL THEN 'OK'
      ELSE 'REVIEW'
    END
  FROM fuente f
  JOIN peajes_todos p ON p.nombre = f.autopista
  WHERE e.peaje_id = p.id AND e.nombre = f.zona
  RETURNING e.id
)
INSERT INTO public.estaciones_alias_proveedor (
  empresa_id, estacion_id, valor_proveedor, valor_normalizado, origen
)
SELECT
  p.empresa_id,
  e.id,
  alias.valor,
  public.peajes_normalizar_estacion(alias.valor),
  'seed'
FROM fuente f
JOIN peajes_todos p ON p.nombre = f.autopista
JOIN estaciones_todas e ON e.peaje_id = p.id AND e.nombre = f.zona
CROSS JOIN LATERAL unnest(ARRAY[NULLIF(f.codigo, ''), NULLIF(f.auxiliar, '')]) AS alias(valor)
ON CONFLICT (empresa_id, estacion_id, valor_normalizado)
DO UPDATE SET valor_proveedor = EXCLUDED.valor_proveedor, origen = 'seed';

-- Alinea también los aliases ya presentes antes de esta migración.
INSERT INTO public.estaciones_alias_proveedor (
  empresa_id, estacion_id, valor_proveedor, valor_normalizado, origen
)
SELECT
  p.empresa_id,
  e.id,
  codigo,
  public.peajes_normalizar_estacion(codigo),
  'seed'
FROM public.estaciones e
JOIN public.peajes p ON p.id = e.peaje_id
CROSS JOIN LATERAL unnest(COALESCE(e.codigos_proveedor, ARRAY[]::text[])) AS codigo
WHERE p.empresa_id IS NOT NULL AND btrim(codigo) <> ''
ON CONFLICT (empresa_id, estacion_id, valor_normalizado)
DO NOTHING;
