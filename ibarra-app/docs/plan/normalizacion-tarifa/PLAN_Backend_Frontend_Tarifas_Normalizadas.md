# Plan de Implementación — Motor de Normalización Tarifaria (v2)

Continúa la numeración del PRD (§20–27). v2 corrige dos decisiones de diseño de
la v1:

1. **`categorias` no es un catálogo curado.** El valor de categoría es lo que
   el proveedor puso en su columna (`CATEGORIA`, `CLASE`, etc.), capturado tal
   cual al momento de subir el archivo (paso 8 del wizard, mapeo de columnas).
   No hay nada que administrar de antemano — es texto libre en `pasadas`, no
   una tabla con FK.
2. **`status` no es un enum fijo.** Cada concesión tiene su propio vocabulario
   (`HORA_PICO`/`HORA_NO_PICO` para una, `NIGHT_PICO`/`LIBRE` para otra). Se
   resuelve con un catálogo configurable por concesión, no con un `CHECK`
   hardcodeado.

Dividido en **§28 Backend Agent** y **§29 Frontend Agent**, con contrato
compartido en §30.

> **Nota de alcance:** SQL de skeleton, no probado contra una base real (sin
> conexión activa al proyecto Supabase en este entorno). Validar nombres
> (`peajes`, `estaciones`) contra el esquema real antes de aplicar, y correr
> `supabase db advisors` después de crear tablas/políticas.

---

# 28. Backend Agent — Plan

## 28.1 Resumen de lo que hay que construir

1. Tabla `concesion_parametros` (umbrales del §25).
2. Tabla `concesion_status_catalogo` — el vocabulario de status por concesión.
3. Tabla `tarifas_normalizadas` (`categoria` como texto, no FK).
4. **Extender `pasadas`** con `categoria` (texto), `tarifa_normalizada_id`,
   `tarifa_status`.
5. `fn_normalizar_tarifas()` — matching rápido post-importación.
6. `fn_recalcular_stats_tarifas()` — recálculo completo, periódico.
7. `rpc_confirmar_diagnostico()` — el Analista asigna un status del catálogo
   de esa concesión a cada nivel de tarifa de una familia (soporta 2, 3 o más
   niveles — no asume binario pico/no-pico).
8. `rpc_grupos_similares()` — detecta ratios repetidos en otras
   estaciones/categorías (el caso AUSOL).

## 28.2 Dos capas de status: universal vs. por concesión

La clave del fix: separar **qué tan seguro está el algoritmo** (siempre las
mismas 6 palabras, sirve para toda concesión) de **cómo se llama esa tarifa
para esta concesión en particular** (variable, configurable).

```text
Capa 1 — diagnóstico algorítmico (fijo, igual para todas las concesiones)
  MUESTRA_INSUFICIENTE → TARIFA_UNICA → CATEGORIA → POSIBLE_HORARIO → CONFIRMADO
                                                                          │
Capa 2 — vocabulario de la concesión (configurable, tabla)                │
                                                                          ▼
  concesion_status_catalogo: para ESTA concesión, ¿qué nombre le          
  ponemos a cada nivel de tarifa dentro de una familia confirmada?         
  AUSOL:        { HORA_NO_PICO, HORA_PICO }             (2 niveles)
  Otra concesión:{ LIBRE, HORA_PICO, NIGHT_PICO }        (3 niveles)
```

`tarifas_normalizadas.status` (lo que se propaga a `pasadas.tarifa_status`)
puede valer:

- `'PENDIENTE'` — universal, fijo. Sin señal de horario o muestra insuficiente.
- `'POSIBLE_HORARIO'` — universal, fijo. Candidato detectado, sin confirmar.
- **Cualquier `codigo` de `concesion_status_catalogo` de esa concesión** —
  una vez que el Analista confirma. Ej: `'HORA_PICO'`, `'NIGHT_PICO'`,
  `'LIBRE'`, lo que esa concesión tenga cargado.

No es un `CHECK` de Postgres (no puede validar contra otra tabla). Se valida
con un trigger (§28.4) que emula una FK condicional: o es uno de los dos
valores universales, o existe en el catálogo de esa concesión.

## 28.3 DDL — tablas nuevas

```sql
create table public.concesion_parametros (
  concesion_id uuid not null primary key references public.peajes(id) on delete cascade,
  umbral_muestra_minima integer not null default 15,
  umbral_dispersion numeric(6,3) not null default 4.100,
  auto_confirmar_horario boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint concesion_parametros_umbral_muestra_chk check (umbral_muestra_minima > 0),
  constraint concesion_parametros_umbral_dispersion_chk check (umbral_dispersion >= 0)
);

-- El vocabulario de status de cada concesión. Se carga una vez por concesión
-- (pantalla de configuración, fuera del wizard de importación) y después se
-- usa como opciones del dropdown al confirmar una familia de tarifas.
create table public.concesion_status_catalogo (
  id uuid not null default gen_random_uuid(),
  concesion_id uuid not null references public.peajes(id) on delete cascade,
  codigo text not null,              -- 'HORA_PICO', 'NIGHT_PICO', 'LIBRE'...
  etiqueta text not null,            -- nombre para mostrar: "Hora Pico (mañana)"
  color text not null default '#94A3B8',  -- token o hex para el badge
  tipo_meta text not null check (tipo_meta in ('PICO','NO_PICO','NEUTRO')),
    -- tipo_meta permite reportes cross-concesión ("% de pasadas en tarifa
    -- pico") aunque cada concesión use nombres distintos.
  orden integer not null default 0,  -- sugiere el orden de precio ascendente
  created_at timestamptz not null default now(),
  constraint concesion_status_catalogo_pkey primary key (id),
  constraint concesion_status_catalogo_uk unique (concesion_id, codigo)
);

create table public.tarifas_normalizadas (
  id uuid not null default gen_random_uuid(),
  concesion_id uuid not null references public.peajes(id) on delete restrict,
  estacion_id uuid not null references public.estaciones(id) on delete restrict,
  categoria text null,               -- tal cual vino del proveedor; null = Patrón A
  importe numeric(14,2) not null,
  importe_base numeric(14,2) not null,
  cases integer not null default 0,
  multiplicador numeric(10,4) not null default 1,
  desvio numeric(10,4) null,
  hora_min numeric(5,2) null,
  hora_max numeric(5,2) null,
  hora_media numeric(5,2) null,
  patron text not null check (patron in ('A','B')),
  diagnostico text not null default 'MUESTRA_INSUFICIENTE'
    check (diagnostico in (
      'MUESTRA_INSUFICIENTE','CATEGORIA','TARIFA_UNICA','REVISAR',
      'POSIBLE_HORARIO','CONFIRMADO'
    )),
  status text not null default 'PENDIENTE',  -- ver §28.2 y trigger de validación
  muestra_confiable boolean not null default false,
  confirmado_manual boolean not null default false,
  confirmado_por uuid null references auth.users(id) on delete set null,
  confirmado_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tarifas_normalizadas_pkey primary key (id),
  -- NULLS NOT DISTINCT: dos filas Patrón A (categoria = null) para la misma
  -- estacion+importe deben seguir chocando contra el unique.
  constraint tarifas_normalizadas_uk
    unique nulls not distinct (concesion_id, estacion_id, categoria, importe)
);

create index idx_tarifas_normalizadas_estacion on public.tarifas_normalizadas using btree (estacion_id);
create index idx_tarifas_normalizadas_concesion on public.tarifas_normalizadas using btree (concesion_id);
create index idx_tarifas_normalizadas_status on public.tarifas_normalizadas using btree (status);
create index idx_tarifas_normalizadas_categoria on public.tarifas_normalizadas using btree (categoria);
create index idx_tarifas_normalizadas_review_queue
  on public.tarifas_normalizadas using btree (status, muestra_confiable desc)
  where status in ('POSIBLE_HORARIO','PENDIENTE') and confirmado_manual = false;

-- Validación de status en capas (emula una FK condicional, ver §28.2)
create or replace function public.fn_validar_status_tarifa()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('PENDIENTE','POSIBLE_HORARIO') then
    return new;
  end if;
  if exists (
    select 1 from public.concesion_status_catalogo c
    where c.concesion_id = new.concesion_id and c.codigo = new.status
  ) then
    return new;
  end if;
  raise exception
    'status "%" no es universal ni existe en concesion_status_catalogo para la concesión %',
    new.status, new.concesion_id;
end;
$$;

create trigger trg_validar_status_tarifa
  before insert or update of status on public.tarifas_normalizadas
  for each row execute function public.fn_validar_status_tarifa();
```

## 28.4 ALTER — extender `pasadas`

```sql
alter table public.pasadas
  add column categoria text null,   -- tal cual vino del proveedor, sin catálogo
  add column tarifa_normalizada_id uuid null references public.tarifas_normalizadas(id) on delete set null,
  add column tarifa_status text not null default 'PENDIENTE';
  -- sin CHECK: siempre se copia de tarifas_normalizadas.status, que ya está
  -- validado por el trigger de esa tabla. Duplicar la validación acá sería
  -- redundante y complica el ALTER cuando se agreguen códigos nuevos.

create index idx_pasadas_categoria on public.pasadas using btree (categoria);
create index idx_pasadas_tarifa_normalizada_id on public.pasadas using btree (tarifa_normalizada_id);
create index idx_pasadas_tarifa_status on public.pasadas using btree (tarifa_status);

-- Query más frecuente del job rápido (§28.5): pasadas todavía sin clasificar.
create index idx_pasadas_pendiente_match
  on public.pasadas using btree (estacion_id, precio)
  where tarifa_normalizada_id is null;
```

`categoria` se completa en el wizard, paso 8 (Mapeo de columnas): si el archivo
tiene una columna tipo `CATEGORIA`/`CLASE`, se mapea ahí (y ese mapeo es la señal
de "Patrón B" del §21, igual que antes). Si no existe, queda `null` (Patrón A).
No hace falta que el usuario "elija de una lista" — es lo que venga en el archivo,
tal cual, igual que `PATENTE` o `DISPOSITIVO`.

## 28.5 `fn_normalizar_tarifas` — job rápido (post-importación)

Igual que v1, con `categoria` como texto en vez de `categoria_id`:

```sql
create or replace function public.fn_normalizar_tarifas(p_documento_id uuid)
returns table(pasadas_matcheadas integer, grupos_nuevos integer)
language plpgsql
security invoker
as $$
declare
  v_matcheadas integer := 0;
  v_nuevos integer := 0;
begin
  -- PASO 1 (fast path): combinación estación+categoría+precio ya conocida
  update public.pasadas p
  set tarifa_normalizada_id = tn.id,
      tarifa_status = tn.status
  from public.tarifas_normalizadas tn
  where p.documento_id = p_documento_id
    and p.tarifa_normalizada_id is null
    and tn.estacion_id = p.estacion_id
    and tn.categoria is not distinct from p.categoria
    and tn.importe = p.precio;
  get diagnostics v_matcheadas = row_count;

  -- PASO 2 (slow path, acotado a este documento): importe nunca visto
  with nuevos_grupos as (
    select
      e.peaje_id as concesion_id,
      p.estacion_id,
      p.categoria,
      p.precio as importe,
      count(*) as cases,
      stddev_pop(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as desvio,
      min(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as hora_min,
      max(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as hora_max,
      avg(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as hora_media,
      case when p.categoria is null then 'A' else 'B' end as patron
    from public.pasadas p
    join public.estaciones e on e.id = p.estacion_id
    where p.documento_id = p_documento_id
      and p.tarifa_normalizada_id is null
    group by e.peaje_id, p.estacion_id, p.categoria, p.precio
  ),
  insertados as (
    insert into public.tarifas_normalizadas as tn (
      concesion_id, estacion_id, categoria, importe, importe_base,
      cases, multiplicador, desvio, hora_min, hora_max, hora_media,
      patron, diagnostico, status, muestra_confiable
    )
    select
      ng.concesion_id, ng.estacion_id, ng.categoria, ng.importe,
      ng.importe,  -- importe_base provisorio; §28.6 lo corrige con la foto completa
      ng.cases, 1.0000, ng.desvio, ng.hora_min, ng.hora_max, ng.hora_media,
      ng.patron,
      case when ng.cases < coalesce(
             (select umbral_muestra_minima from public.concesion_parametros cp where cp.concesion_id = ng.concesion_id),
             15)
           then 'MUESTRA_INSUFICIENTE' else 'REVISAR' end,
      'PENDIENTE',
      false
    from nuevos_grupos ng
    on conflict (concesion_id, estacion_id, categoria, importe)
    do update set
      cases = tn.cases + excluded.cases,
      updated_at = now()
    where tn.confirmado_manual = false
    returning tn.id
  )
  select count(*) into v_nuevos from insertados;

  update public.pasadas p
  set tarifa_normalizada_id = tn.id,
      tarifa_status = tn.status
  from public.tarifas_normalizadas tn
  where p.documento_id = p_documento_id
    and p.tarifa_normalizada_id is null
    and tn.estacion_id = p.estacion_id
    and tn.categoria is not distinct from p.categoria
    and tn.importe = p.precio;

  return query select v_matcheadas, v_nuevos;
end;
$$;
```

## 28.6 `fn_recalcular_stats_tarifas` — recálculo completo (pg_cron o botón manual)

```sql
create or replace function public.fn_recalcular_stats_tarifas(p_concesion_id uuid)
returns integer
language plpgsql
security invoker
as $$
declare
  v_umbral_muestra integer;
  v_umbral_dispersion numeric;
  v_actualizados integer;
begin
  select umbral_muestra_minima, umbral_dispersion
    into v_umbral_muestra, v_umbral_dispersion
  from public.concesion_parametros
  where concesion_id = p_concesion_id;

  v_umbral_muestra := coalesce(v_umbral_muestra, 15);
  v_umbral_dispersion := coalesce(v_umbral_dispersion, 4.100);

  with agregado as (
    select
      e.peaje_id as concesion_id,
      p.estacion_id,
      p.categoria,
      p.precio as importe,
      count(*) as cases,
      stddev_pop(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as desvio,
      min(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as hora_min,
      max(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as hora_max,
      avg(extract(hour from p.fecha_hora) + extract(minute from p.fecha_hora) / 60.0) as hora_media
    from public.pasadas p
    join public.estaciones e on e.id = p.estacion_id
    where e.peaje_id = p_concesion_id
    group by e.peaje_id, p.estacion_id, p.categoria, p.precio
  ),
  con_familia as (
    select a.*,
      case when a.categoria is null
        then min(a.importe) over (partition by a.concesion_id, a.estacion_id)
        else min(a.importe) over (partition by a.concesion_id, a.estacion_id, a.categoria)
      end as importe_base,
      count(distinct a.importe) over (partition by a.concesion_id, a.estacion_id, a.categoria) as n_tarifas_familia
    from agregado a
  ),
  clasificado as (
    select cf.*,
      round(cf.importe / nullif(cf.importe_base, 0), 4) as multiplicador,
      case when cf.categoria is null then 'A' else 'B' end as patron,
      case
        when cf.cases < v_umbral_muestra then 'MUESTRA_INSUFICIENTE'
        when cf.n_tarifas_familia = 1 then 'TARIFA_UNICA'
        when cf.categoria is null and (cf.desvio is null or cf.desvio >= v_umbral_dispersion) then 'CATEGORIA'
        when cf.desvio is not null and cf.desvio < v_umbral_dispersion then 'POSIBLE_HORARIO'
        else 'REVISAR'
      end as diagnostico_calculado
    from con_familia cf
  ),
  upsert as (
    insert into public.tarifas_normalizadas as tn (
      concesion_id, estacion_id, categoria, importe, importe_base,
      cases, multiplicador, desvio, hora_min, hora_max, hora_media,
      patron, diagnostico, status, muestra_confiable
    )
    select
      c.concesion_id, c.estacion_id, c.categoria, c.importe, c.importe_base,
      c.cases, c.multiplicador, c.desvio, c.hora_min, c.hora_max, c.hora_media,
      c.patron, c.diagnostico_calculado,
      case when c.diagnostico_calculado = 'POSIBLE_HORARIO' then 'POSIBLE_HORARIO' else 'PENDIENTE' end,
      c.cases >= v_umbral_muestra
    from clasificado c
    on conflict (concesion_id, estacion_id, categoria, importe)
    do update set
      cases = excluded.cases,
      importe_base = excluded.importe_base,
      multiplicador = excluded.multiplicador,
      desvio = excluded.desvio,
      hora_min = excluded.hora_min,
      hora_max = excluded.hora_max,
      hora_media = excluded.hora_media,
      muestra_confiable = excluded.muestra_confiable,
      -- solo pisa diagnostico/status si el analista no confirmó nada a mano
      diagnostico = case when tn.confirmado_manual then tn.diagnostico else excluded.diagnostico end,
      status = case when tn.confirmado_manual then tn.status else excluded.status end,
      updated_at = now()
    where tn.confirmado_manual = false or tn.cases is distinct from excluded.cases
    returning tn.id, tn.status
  )
  update public.pasadas p
  set tarifa_status = u.status,
      tarifa_normalizada_id = u.id
  from upsert u, public.tarifas_normalizadas tn2
  where tn2.id = u.id
    and p.estacion_id = tn2.estacion_id
    and p.categoria is not distinct from tn2.categoria
    and p.precio = tn2.importe
    and (p.tarifa_status is distinct from u.status or p.tarifa_normalizada_id is distinct from u.id);
  get diagnostics v_actualizados = row_count;

  return v_actualizados;
end;
$$;
```

## 28.7 `rpc_confirmar_diagnostico` — el Analista asigna status del catálogo

Cambia respecto a v1: en vez de asumir "alta=PICO, baja=NO_PICO" (binario,
hardcodeado), recibe una asignación explícita por cada nivel de tarifa de la
familia. Así soporta 2 niveles (AUSOL) o N niveles (LIBRE/PICO/NIGHT_PICO).

```sql
create or replace function public.rpc_confirmar_diagnostico(
  p_asignaciones jsonb
  -- [{"tarifa_normalizada_id": "uuid", "status_codigo": "HORA_PICO"}, ...]
)
returns void
language plpgsql
security invoker
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_codigo text;
  v_concesion_id uuid;
  v_estacion_id uuid;
  v_categoria text;
begin
  for v_item in select * from jsonb_array_elements(p_asignaciones)
  loop
    v_id := (v_item ->> 'tarifa_normalizada_id')::uuid;
    v_codigo := v_item ->> 'status_codigo';

    update public.tarifas_normalizadas
    set diagnostico = 'CONFIRMADO',
        status = v_codigo,           -- el trigger valida contra el catálogo de la concesión
        confirmado_manual = true,
        confirmado_por = (select auth.uid()),
        confirmado_at = now(),
        updated_at = now()
    where id = v_id
    returning concesion_id, estacion_id, categoria
      into v_concesion_id, v_estacion_id, v_categoria;

    update public.pasadas p
    set tarifa_status = v_codigo,
        tarifa_normalizada_id = v_id
    where p.estacion_id = v_estacion_id
      and p.categoria is not distinct from v_categoria
      and p.precio = (select importe from public.tarifas_normalizadas where id = v_id);
  end loop;
end;
$$;
```

Para "Es variación por categoría, no horario" o "Marcar para revisar" (acciones
de un solo nivel, no de toda la familia), función chica aparte:

```sql
create or replace function public.rpc_marcar_diagnostico_simple(
  p_tarifa_normalizada_id uuid,
  p_diagnostico text  -- 'CATEGORIA' | 'REVISAR'
)
returns void
language plpgsql
security invoker
as $$
begin
  if p_diagnostico not in ('CATEGORIA','REVISAR') then
    raise exception 'diagnóstico % no permitido en esta función', p_diagnostico;
  end if;

  update public.tarifas_normalizadas
  set diagnostico = p_diagnostico,
      status = 'PENDIENTE',
      confirmado_manual = true,
      confirmado_por = (select auth.uid()),
      confirmado_at = now(),
      updated_at = now()
  where id = p_tarifa_normalizada_id;

  update public.pasadas p
  set tarifa_status = 'PENDIENTE'
  from public.tarifas_normalizadas tn
  where tn.id = p_tarifa_normalizada_id
    and p.estacion_id = tn.estacion_id
    and p.categoria is not distinct from tn.categoria
    and p.precio = tn.importe;
end;
$$;
```

## 28.8 `rpc_grupos_similares` — sin cambios de fondo

Misma lógica que v1 (compara `max(importe)/min(importe)` entre familias de la
misma concesión), solo cambia `categoria_id` por `categoria` (texto):

```sql
create or replace function public.rpc_grupos_similares(
  p_tarifa_normalizada_id uuid,
  p_tolerancia numeric default 0.01
)
returns table (
  grupo_estacion_id uuid,
  grupo_categoria text,
  ratio numeric,
  cases_total integer
)
language sql
security invoker
stable
as $$
  with objetivo as (
    select concesion_id, estacion_id, categoria,
      max(importe) / nullif(min(importe), 0) as ratio
    from public.tarifas_normalizadas
    where estacion_id = (select estacion_id from public.tarifas_normalizadas where id = p_tarifa_normalizada_id)
      and categoria is not distinct from (select categoria from public.tarifas_normalizadas where id = p_tarifa_normalizada_id)
      and concesion_id = (select concesion_id from public.tarifas_normalizadas where id = p_tarifa_normalizada_id)
    group by concesion_id, estacion_id, categoria
  ),
  candidatos as (
    select tn.concesion_id, tn.estacion_id, tn.categoria,
      max(tn.importe) / nullif(min(tn.importe), 0) as ratio,
      sum(tn.cases) as cases_total
    from public.tarifas_normalizadas tn, objetivo o
    where tn.concesion_id = o.concesion_id
      and tn.diagnostico = 'POSIBLE_HORARIO'
      and tn.confirmado_manual = false
      and not (tn.estacion_id = o.estacion_id and tn.categoria is not distinct from o.categoria)
    group by tn.concesion_id, tn.estacion_id, tn.categoria
    having count(distinct tn.importe) >= 2
  )
  select c.estacion_id, c.categoria, c.ratio, c.cases_total::integer
  from candidatos c, objetivo o
  where abs(c.ratio - o.ratio) <= p_tolerancia * o.ratio
  order by c.cases_total desc;
$$;
```

**Límite a nota:** este ratio compara solo `max/min` (2 niveles). Si una
concesión tiene 3+ niveles (LIBRE/PICO/NIGHT_PICO), la comparación de "mismo
patrón" debería comparar el vector completo de ratios entre niveles, no un solo
número. Queda fuera del MVP — para 3+ niveles, el Analista confirma cada
familia manualmente sin la ayuda del bulk-apply.

## 28.9 RLS

```sql
alter table public.concesion_parametros enable row level security;
alter table public.concesion_status_catalogo enable row level security;
alter table public.tarifas_normalizadas enable row level security;

create policy "select tarifas de mi empresa"
on public.tarifas_normalizadas
for select
to authenticated
using (
  exists (
    select 1 from public.estaciones e
    join public.peajes pj on pj.id = e.peaje_id
    where e.id = tarifas_normalizadas.estacion_id
      and pj.empresa_id = ((select auth.jwt()) -> 'app_metadata' ->> 'empresa_id')::uuid
  )
);

create policy "analista confirma diagnostico"
on public.tarifas_normalizadas
for update
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'analista'
  and exists (
    select 1 from public.estaciones e join public.peajes pj on pj.id = e.peaje_id
    where e.id = tarifas_normalizadas.estacion_id
      and pj.empresa_id = ((select auth.jwt()) -> 'app_metadata' ->> 'empresa_id')::uuid
  )
)
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'analista'
);

-- concesion_status_catalogo: lectura para todos los de la empresa,
-- escritura solo para un rol admin (quien configura el vocabulario)
create policy "select catalogo de mi empresa"
on public.concesion_status_catalogo
for select to authenticated
using (
  exists (
    select 1 from public.peajes pj
    where pj.id = concesion_status_catalogo.concesion_id
      and pj.empresa_id = ((select auth.jwt()) -> 'app_metadata' ->> 'empresa_id')::uuid
  )
);

create policy "admin edita catalogo"
on public.concesion_status_catalogo
for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
```

Correr `supabase db advisors` al terminar, como en v1.

## 28.10 Checklist de implementación (orden sugerido)

1. Crear `concesion_parametros`, `concesion_status_catalogo`,
   `tarifas_normalizadas` (incluyendo trigger de validación de status).
2. `ALTER TABLE pasadas` (§28.4).
3. **Cargar el catálogo inicial por concesión** — esto es nuevo respecto a v1:
   antes de poder confirmar nada, cada concesión necesita al menos sus 2 (o N)
   códigos en `concesion_status_catalogo`. Para AUSOL, por ejemplo:
   ```sql
   insert into public.concesion_status_catalogo (concesion_id, codigo, etiqueta, color, tipo_meta, orden)
   values
     ('<ausol-id>', 'HORA_NO_PICO', 'Hora No Pico', '#22C55E', 'NO_PICO', 1),
     ('<ausol-id>', 'HORA_PICO',    'Hora Pico',    '#EF4444', 'PICO',    2);
   ```
   Esto probablemente merece una pantalla chica de configuración en el
   frontend (fuera del wizard) — ver §29.10.
4. Backfill de `categoria` en `pasadas` históricas de AUSOL (la columna existe
   en su CSV, hay que volcarla a las filas ya importadas).
5. Crear las funciones §28.5–28.8.
6. Habilitar RLS + políticas (§28.9).
7. `supabase db advisors`.
8. Correr `fn_recalcular_stats_tarifas` una vez por concesión existente.
9. Verificar: `select count(*) from pasadas where tarifa_normalizada_id is null` → 0 o explicable.
10. `supabase db pull <nombre> --local --yes` → migración.
11. Programar `fn_recalcular_stats_tarifas` en `pg_cron`.
12. Enganchar `fn_normalizar_tarifas(documento_id)` al paso 9 del wizard.

---

# 29. Frontend Agent — Plan

## 29.1 Objetivo de la pantalla

`/peajes/tarifas-normalizadas`. Igual que v1: clasificar y auditar. La
diferencia es que ahora **los badges de status no son un set fijo de 4
colores** — hay que leer `concesion_status_catalogo` para saber qué códigos,
etiquetas y colores existen para la concesión que se está mirando.

## 29.2 Filtros (sin cambios de fondo respecto a v1)

| Filtro | Tipo | Notas |
| --- | --- | --- |
| Concesión | Select | Determina qué `concesion_status_catalogo` se usa para pintar badges |
| Estación | Select (multi) | Depende de Concesión |
| Categoría | Select (multi), texto libre con autocomplete | Ya no viene de una tabla — se arma con `select distinct categoria from tarifas_normalizadas where concesion_id = ...` |
| Status | Badges seleccionables (multi) | `PENDIENTE`, `POSIBLE_HORARIO` + los códigos del catálogo de esa concesión |
| Patrón | Toggle A / B / Todos | |
| Muestra confiable | Switch | |

## 29.3 Badges — ahora dinámicos

```text
GET concesion_status_catalogo WHERE concesion_id = seleccionado
  → { codigo: 'HORA_PICO', etiqueta: 'Hora Pico', color: '#EF4444', tipo_meta: 'PICO' }
  → { codigo: 'HORA_NO_PICO', etiqueta: 'Hora No Pico', color: '#22C55E', tipo_meta: 'NO_PICO' }
```

El componente `StatusBadge` deja de tener una tabla de colores hardcodeada;
recibe `status_codigo` + el catálogo cargado y resuelve color/etiqueta en
runtime. Para los 2 universales que no están en el catálogo:

| Status | Color sugerido | Significado |
| --- | --- | --- |
| `PENDIENTE` | Gris | Sin señal, o esperando confirmación |
| `POSIBLE_HORARIO` | Ámbar | Candidato detectado, necesita revisión |

Si el status no es ninguno de los dos universales y tampoco está en el
catálogo cargado (no debería pasar gracias al trigger de backend, pero el
frontend debe manejarlo por si el catálogo todavía no cargó) → badge gris con
el código crudo como texto, sin romper la UI.

`Patrón` (A/B) se mantiene igual que v1 (badge outline fijo, no depende de
catálogo — es un concepto del algoritmo, no de la concesión).

## 29.4 Tabla principal — sin cambios de columnas

`Estación | Categoría | Importe | Cases ✓ | Multiplicador | Desvío | Status
(badge dinámico) | Patrón (badge) | Acciones`. `Categoría` ahora es texto
libre mostrado tal cual (sin lookup a otra tabla).

## 29.5 Panel de comparación — ahora soporta N niveles, no solo 2

Antes (v1) el panel mostraba una familia de exactamente 2 tarifas con un solo
botón "confirmar". Ahora la familia puede tener 2, 3 o más niveles distintos
de `importe`, y cada uno se asigna individualmente a un código del catálogo:

```text
CAMPANA · Categoría 2                              [POSIBLE_HORARIO]

  Nivel 1              Nivel 2
  $ 994.15              $ 1,192.99
  31 casos              14 casos
  hora media 10.5hs     hora media 17.5hs

  Asignar status:
  Nivel 1 → [ Hora No Pico ▾ ]   (dropdown: opciones del catálogo de esta concesión)
  Nivel 2 → [ Hora Pico    ▾ ]

  Sugerencia automática: por orden de precio ascendente, usando el campo
  "orden" del catálogo (editable antes de confirmar).

  [ Confirmar asignación ]
  [ Es variación por categoría, no horario ]
  [ Marcar para revisar ]
```

Para una concesión con 3 niveles (LIBRE/PICO/NIGHT_PICO) el mismo panel
simplemente renderiza 3 dropdowns en vez de 2 — no hace falta un componente
distinto.

El botón "Confirmar asignación" arma el array y llama
`rpc_confirmar_diagnostico([{tarifa_normalizada_id, status_codigo}, ...])`.

## 29.6 Grupos similares — igual que v1

`rpc_grupos_similares` sigue funcionando sobre el ratio `max/min`, así que el
bulk-apply solo tiene sentido pleno para familias de 2 niveles (documentado
como límite en §28.8). Para 3+ niveles, mostrar el bloque de "similares" pero
aclarar que la aplicación en lote solo copia la asignación si la cantidad de
niveles coincide exactamente.

## 29.7 Indicador de progreso por concesión — sin cambios

Igual que v1.

## 29.8 Comportamiento al subir un archivo nuevo — sin cambios

Igual que v1 (resumen post-importación con `pasadas_matcheadas` / `grupos_nuevos`).

## 29.9 Componentes sugeridos

- `TarifasFiltersBar`
- `StatusBadge` (ahora recibe `catalogo` como prop, no hardcodea colores)
- `PatronBadge`
- `TarifasNormalizadasTable`
- `ComparacionPanel` (ahora renderiza N dropdowns, no 2 botones fijos)
- `AsignacionStatusDropdown` (nuevo — un select poblado desde `concesion_status_catalogo`)
- `GruposSimilaresBulkConfirm`
- `ProgresoConcesionCard`
- `CatalogoStatusConfigPage` (nueva, ver §29.10)

## 29.10 Nueva pantalla chica: configuración del catálogo por concesión

No estaba en v1 porque no hacía falta — con status fijo no había nada que
configurar. Ahora sí: alguien tiene que cargar, para cada concesión, qué
códigos existen antes de que el Analista pueda confirmar nada.

`/peajes/configuracion/status?concesion=<id>` — tabla simple con alta/edición:
`codigo | etiqueta | color (color picker) | tipo_meta (PICO/NO_PICO/NEUTRO) |
orden`. Rol admin únicamente (coincide con la política RLS de §28.9).

## 29.11 Alcance MVP frontend

Incluye: filtros, tabla, panel de comparación con N asignaciones, confirmación
individual y en lote (2 niveles), indicador de progreso, pantalla de
configuración de catálogo.

Fuera de alcance inicial: bulk-apply para familias de 3+ niveles, histograma
de distribución horaria dentro del panel.

---

# 30. Contrato compartido Backend ↔ Frontend

| Función | Tipo | Usado por |
| --- | --- | --- |
| `fn_normalizar_tarifas(documento_id)` | RPC | Wizard paso 9 |
| `fn_recalcular_stats_tarifas(concesion_id)` | RPC | Botón "Recalcular" + cron |
| `rpc_confirmar_diagnostico(asignaciones jsonb)` | RPC | Panel de comparación (confirmar N niveles) |
| `rpc_marcar_diagnostico_simple(tarifa_normalizada_id, diagnostico)` | RPC | Panel de comparación ("es categoría" / "revisar") |
| `rpc_grupos_similares(tarifa_normalizada_id, tolerancia)` | RPC (read-only) | Panel de comparación (bulk-apply) |
| `select * from concesion_status_catalogo where concesion_id = ...` | Query directa (RLS) | Badges, dropdowns de asignación, pantalla de config |
| `select * from tarifas_normalizadas where ...` | Query directa (RLS) | Tabla principal + filtros |

El frontend agent puede maquetar `StatusBadge` y `AsignacionStatusDropdown`
contra un catálogo mockeado (`[{codigo,etiqueta,color,tipo_meta}]`) sin esperar
a que el backend esté terminado.
