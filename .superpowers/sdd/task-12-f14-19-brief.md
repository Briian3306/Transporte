### Task 12: Run Database, Unit, Integration, and Visual Acceptance Gates

**Files:**
- Verify: `supabase/tests/peajes_tarifa_vigencia_test.sql`
- Verify: `supabase/tests/peajes_refresh_tarifas_test.sql`
- Verify: all changed Angular specs
- Verify: local authenticated Paso 9 and Tarifario UI

- [ ] Run `npx supabase db reset --local --no-seed` and `npx supabase test db`. Record files/tests/pass counts and confirm all earlier Peajes suites remain green.
- [ ] Per the local backend workflow, run `pnpm seed:local` after the no-seed reset so the CLI environment is not left empty.
- [ ] Run focused Angular tests for refresh contracts/service/dialog/helpers, Paso 9, Tarifario, date picker, checkbox multi-select, search select, and dialog.
- [ ] Run `npx tsc --noEmit -p tsconfig.app.json`, `npx tsc --noEmit -p tsconfig.spec.json`, and `npm run build`.
- [ ] In the local authenticated browser, verify three grouped stations produce one editor; two grouped plus one independent produce two; none grouped produce three; and deselection never hides a station.
- [ ] Verify AMBAS produces one board and a directional station produces IDA and VUELTA boards simultaneously.
- [ ] Verify station colors remain stable while regrouping and are always accompanied by station text in chips, detected candidates, current values, and autocomplete suggestions.
- [ ] Verify the provider Category 3 / price 5300 example resolves uniquely to calculated Category 2 PICO, persists the pasada’s original category, and shows the correction in final Paso 9.
- [ ] Verify duplicate compatible 5300 tariffs stay ambiguous and require an explicit category decision or `REVISAR`.
- [ ] Verify a dated historical match does not create a tariff, an unknown-date legacy history match is labelled as such, and a non-covering known period does not match.
- [ ] Verify a new tariff closes the previous period exactly at the new start, keeps the previous amount unchanged, and appears in the final validity summary.
- [ ] Verify multiple unmatched prices stay individually visible; assigning one does not hide the others, and remaining candidates can be marked `REVISAR`.
- [ ] Verify grouped stations save the same amount/start date but receive independent parent/history ids and per-station case counts.
- [ ] Verify a user can explicitly continue with a `REVISAR` candidate and that cancelling/closing the dialog cannot silently confirm or acknowledge it.
- [ ] Verify keyboard focus, 200% zoom, mobile layout, screen-reader labels, reduced motion, and the persistent dialog footer.

If browser auth or `seed:local` `null_current_pointers=27` blocks a scenario, record it. Do not mark F14-19 `passing`. Do not write DESARROLLO.
