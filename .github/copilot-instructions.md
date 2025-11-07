<!-- Copilot instructions for the U2 Ship Editor repo -->
# Quick orientation

This is a tiny, static single-page app (no build system). Open `index.html` in a browser or serve the folder with a static server (e.g. `python -m http.server 8080`).

Key responsibilities for an AI editing this repo:
- Preserve the module-style ES imports (files under `js/` are ES modules).
- Keep JSON config shape and units intact (fields like `length_m`, `mass.dry_t`, `main_thrust_MN`).
- When adding UI fields, update the model, binding, and export consistently (see `js/app.js`).

## Big-picture architecture (what matters)
- `index.html` — minimal UI shell and mounts `js/app.js` as a module.
- `js/app.js` — UI glue: builds/updates the in-memory `ship` object, binds DOM inputs, runs validation, imports `migrate.js` dynamically on import, renders JSON to the `out` element and handles import/export.
- `js/schema.js` — canonical constants, `buildEmptyConfig()` factory and exported lists (SIZE, TYPE, PRESET). Add new classification values here first.
- `js/presets.js` and `js/nominals.js` — domain data: assist presets, archetype mappings and nominal hull data + `applyNominals()` helper.
- `js/validator.js` — envelope checks (size vs length/mass), assist clamping helpers; used by UI to show warnings.
- `js/migrate.js` — converts older/legacy JSON to v0.6 schema; `app.js` dynamically imports and calls `migrateToV06()` on legacy files.
- `config/shipconfig.schema.json` — the JSON Schema for the canonical output (minimal/top-level required props).

## Data flow and common edit patterns
- Single source-of-truth: the `ship` plain object (created by `buildEmptyConfig()`). Modules read/modify this object; UI reads/writes form fields to it.
- To add a new property:
  1. Add default to `buildEmptyConfig()` in `js/schema.js`.
  2. Add UI element in `index.html` (id must match the code that reads it).
  3. Wire DOM -> model and model -> DOM in `js/app.js`: update `bindFromModel()`, `writeMisc()` (or `writeGeom()`), and `setAssistFields()` as appropriate.
  4. Update `config/shipconfig.schema.json` if it’s a top-level required/validated property.

## Project-specific conventions & gotchas
- Units are explicit in property names (e.g. `_m`, `_t`, `_MN`, `_mps`) — do not change the naming convention.
- Preset names are strings (see `js/presets.js`) and are used as keys; changing a preset name requires changing both the constant and any references (UI preset select, ARCH_PRESET mapping).
- `applyNominals(ship, mode)` merge semantics: default mode `'fill-empty'` only fills undefined/null/empty keys. If you need to overwrite, pass `'overwrite'`.
- Stealth handling: `presets.applyStealthMode()` changes assist values for non-recon types; nominals/special cases exist for stealth entries (`"medium stealth bomber"` pattern).
- Migration: `app.js` relies on dynamic import of `migrate.js` when imported JSON lacks `meta` or `classification`. Keep migrate functions backward compatible where possible.

## Integration points
- Import: file input in `index.html` triggers `importBtn` in `js/app.js`. Imported JSON may be migrated by `migrateToV06()`.
- Export: `exportBtn` serializes `ship` and downloads as `shipconfig-v0.6.json`.
- No external APIs or packages — the repo is dependency-free.

## Example prompts and tasks (concrete)
- "Add a new numeric field `shield_MW` to propulsion: update `buildEmptyConfig()`, `index.html`, `bindFromModel()`, `writeMisc()`, and `config/shipconfig.schema.json` so it's exported and validated." — follow the 4-step pattern in Data flow.
- "When renaming a preset key, update `js/presets.js` and all references in `js/app.js` and `js/nominals.js` (ARCH_PRESET uses literal preset strings)." — return a diff that touches all files.
- "Implement a new validation that ensures `main_thrust_MN >= mass.dry_t * accel_fwd_mps2 / 1000` and surface an error in the UI" — add logic to `js/validator.js` and wire `validateEnvelope()` in `js/app.js` to include the new check and UI class toggles.

If anything here is unclear or you'd like more examples (e.g., a step-by-step for adding a UI field), tell me which area and I will expand or adjust the instruction set.
