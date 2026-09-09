# Edge Functions — Peajes

## Summary

El MVP de Peajes **no** usa Supabase Edge Functions (Deno). Toda la lógica transaccional de carga, validación y gestión de pasadas está en RPCs Postgres bajo `public.peajes_*`.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Notes](#notes)

## Purpose

Reservar este índice para futuras Edge Functions (p. ej. procesamiento asíncrono o webhooks). Hasta entonces, usar el [catálogo RPC](../index.md).

## Notes

- Carpeta runtime esperada si se agregan: `supabase/functions/`.
- No inventar endpoints HTTP no implementados.

---

> Última actualización: agosto 2026
