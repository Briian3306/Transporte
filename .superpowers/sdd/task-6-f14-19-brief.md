### Task 6: Replace Selection Filtering with a Pure Station Grouping Reducer

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.helpers.spec.ts`

**Interfaces:**
- Consumes: all detected imported stations plus compatible tariff-family metadata.
- Produces: deterministic `EditorGroup[]`, station session colors, and safe autocomplete assignments.

- [ ] Write the required failing test: three detected stations selected for sharing derive exactly one editor containing all three.
- [ ] Write the required failing test: two selected and one deselected derive two editorsâ€”one shared pair and one singleton.
- [ ] Write the required failing test: no stations selected derive three singleton editors.
- [ ] Write the required failing test: deselecting any station preserves it exactly once across the resulting groups.
- [ ] Add invariant tests that every detected station appears once, no catalog-only station appears, order follows first import occurrence, incompatible direction families cannot share, and changing grouping does not discard drafts belonging to unaffected station identities.
- [ ] Implement `deriveEditorGroups()` from `detectedStations` plus `sharedStationIds`; delete the current early return that rejects an empty selection.
- [ ] Implement deterministic session-only station colors from the six-color palette. Return both color and station label for all chip/candidate view models.
- [ ] Implement safe autocomplete: prefill only when exactly one candidate maps to one identity cell; for a shared group, require every member to propose the same normalized amount for that cell. Multiple distinct prices remain visible and unassigned.
- [ ] Add tests that three distinct unmatched prices remain three candidates, never infer PICO/NO_PICO or direction, and cannot overwrite one another in one `Nuevo` cell.

