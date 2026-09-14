# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AtlasForge is a browser-based editor for political / historical / alternate-history world maps. **Live:** https://t1mvae.github.io/atlasforge/

## Commands

- **Build** (required after editing anything under `js/`, `css/`, `icons/` or `tools/sw.template.js`): `npm install` once, then `npm run build` (`tools/build.mjs`). It:
  - copies the UMD libraries into `vendor/` (the app has **no CDN dependencies** — it must work offline as an installed PWA);
  - precompiles `js/*.jsx` → `build/*.js` with the **same Babel 7.29.0 presets (`react` + `env`) the in-browser transformer used**, so the output stays classic scripts whose top-level declarations are shared globals, exactly like before;
  - stamps every local asset URL in `index.html` / `Map Editor.html` with a content hash `?v=` (GitHub Pages sends `max-age=600`; without the stamp a returning visitor keeps old files);
  - writes `sw.js` from `tools/sw.template.js` (precache list + version);
  - writes `dev.html` — the same page loading `js/*.jsx` through in-browser Babel, for iterating without rebuilding (no service worker there).
  `build/`, `vendor/`, `sw.js`, `dev.html` and the stamped HTML are **committed**: Pages serves the repo root of `main`, there is no CI build.
- **Run locally** (required — the app `fetch`es `data/*.geojson`, so `file://` fails): serve over HTTP, then open `index.html` (built) or `dev.html` (live JSX).
  ```bash
  python3 -m http.server 8123    # .claude/launch.json defines this as the "map-editor" config
  ```
- **No test suite, no linter.**
- **Deploy:** `npm run build`, commit, push to `main` → GitHub Pages serves the repo root. The sandboxed preview browser cannot load the github.io URL — verify deploys with `curl`/`gh` (HTTP 200 + grep the deployed `js/`).
- **PWA / service worker** (`js/pwa.js`, `sw.js`): shell assets are precached and served cache-first (hashed URLs); `data/*.geojson` is cached on first use (cache `af-data-v1`); navigations are network-first with an offline fallback. A new version waits until the user taps "Reload" in the banner. The in-app preview browser cannot register service workers — test offline behaviour with headless Chrome (e.g. puppeteer-core against a local server, `page.setOfflineMode(true)`).
- **Regenerate map data** (rarely): `python3 tools/build_*.py` then `npx mapshaper` to simplify. Source mods live in git-ignored folders (`OWB_helping_files/`, `World_helping_files/`); the app only ever loads from `data/`. Base datasets are never modified by the editor.
  - AGOT (CK3): `python3 tools/build_agot_from_mod.py` + `tools/build_agot_terrain.py`, both reading `map_data_agot/` through **`tools/agot_source.py`, which composites the official base mod with the submod folders nested inside it** (`LAYERS`, in priority order). The official map is always authoritative; every submod may only fill what the official map leaves blank (a huge impassable block = world the mod has not made yet). An earlier submod keeps its additions over a later one. Every layer's ids carry its own offset because the submods re-use the raw numbers for different places.
    - Title hierarchy: base + LoV carry it in the banner comments of `provinces/*.txt` (two different formats — `parse_base` / `parse_overlay`). The Summer Isles and Essos Expanded ship **no titles at all**, so the builder derives them: Summer Isles = one county per named barony, duchies = the landmasses; Essos Expanded = kingdom per culture (its only real per-province data), duchy per contiguous stretch of that culture, counties k-means-clustered to `FAR_EAST_COUNTY` baronies so the far east stays as paintable as the rest. Derived titles carry `generated: true`.
  - `map_data_essos_expanded` and `map_data_further_east` are the same mod one revision apart (identical rasters, one province differs); `further_east` supplies the geometry and `essos_expanded` the `k_generated.txt` cultures.
    - After rebuilding the four political GeoJSON files, run Mapshaper with `-simplify dp 25% keep-shapes -o format=geojson precision=0.01`. This preserves shared topology and IDs while keeping the web payload manageable; committing the unsimplified builder output makes AGOT several times slower to load.

## Architecture

Static site, classic scripts (JSX precompiled by `npm run build`). Everything hangs off `window` globals; there are no modules/imports.

**Load order** (from `index.html` / `Map Editor.html`): `vendor/` libs → `js/i18n.js` → `core.js` → `pwa.js` → `geo.js` → `regions.js` → `export.js` → `edit.js` → `world.js` → `build/map.js` → `build/world.js` → `build/panels.js` → `build/chrome.js` → `build/app.js` (the last five are `js/*.jsx` precompiled). Edit the sources in `js/`, never `build/`.

**Global singletons:** `App` (state, `App.version`, `emit`/`subscribe`), `Actions` (every mutation + undo/redo), `Geo`, `RegionModel`, `GeomEdit`, `Exports`, `ColorUtil`, `BASEMAPS`, `MAP_STYLES`, `t()`. React components read `App.version` via `useSyncExternalStore`; **all state changes go through `Actions.mut(fn, opts)`** (the single write + undo entry point) — never mutate `App.project` directly.

**Module responsibilities:**
- `core.js` — the heart: `App`, project schema (`newProjectData`), all `Actions.*`, undo/redo, `MAP_STYLES`, `ColorUtil`, localStorage autosave.
- `geo.js` — basemap loading/processing: the `BASEMAPS` registry, `Geo.load`, projection auto-pick, client-side topology build, `buildEditableResult`, `processGeo`/`processPixelGeo`/`processRegions`.
- `regions.js` — `RegionModel`, the **mid-level region-layer** system (custom regions with real geometry, layers, per-region edit diffs).
- `edit.js` — `GeomEdit`: geometry editing (merge/split/draw/vertex-edit) + `politicalClone` (carries owner/status/etc. across geometry edits).
- `export.js` — `Exports`: SVG/PNG/JSON export and import (`buildSVGString` serializes the live `#map-svg`).
- `map.jsx` — the SVG map canvas: rendering, zoom/pan, tools, fill resolution (`regionFill`), status stripe `<pattern>`s, `ownerUnionPath` borders, labels/markers.
- `panels.jsx` — the left toolbar (`Icons`, `TOOLS`, `GEOM_TOOLS`), right-side property panels (Map / State / Region tabs) + reusable form primitives (`Field`, `TextField`, `SelectField`, `ComboField`, `Check`).
- `world.js` — `World`: the **custom world** basemap (`kind: "world"`). Terrain brushes write two categorical rasters (`elev`, `cover`, 1000 × 510 grid = the basemap's data units), rendered to an HTML `<canvas>` placed *under* the SVG by `World.place` (called from `applyView`). `World.generate` cuts the land into Voronoi provinces clipped to the coastline → `project.customGeo`, carrying owners over by pixel-overlap vote. `World.buildAtlas` writes the Markdown "text atlas for AI". `world.jsx` holds the brush palette and the atlas modal.
- `chrome.jsx` — top bar, menus, legend, timeline, template/new-project modal. `i18n.js` — EN + RU dictionaries (UI defaults to RU). `css/editor.css` — the only stylesheet.

## Data model — "region" is overloaded (read carefully)

- `project.states` = **countries**.
- `project.regions[featureId]` = per-base-feature **political/ownership records** (`{owner, status, color, name, group, autonomyId, ...}`). Despite the name these ARE the base-map cells (provinces / state-cells). **Always resolve through `window.effRegion(p, id)`**, which substitutes the merge-group's record when a cell belongs to a group.
- `project.groups` = legacy merged-cell groups (one shared political record for many cells).
- `project.catalogs` = reusable dictionaries for cultures, religions, languages and forms of government. Records keep `{name, color, parent, description}`; actual state/region fields deliberately store the display name, so `Actions.saveCatalogEntry` can rename every current and timeline use safely.
- `window.RegionModel` (`regions.js`) = a **separate** mid-level region layer — do not confuse it with `project.regions`.
- Imported geometry is re-derived from `data/*.geojson` on every load and is never stored in the project JSON; only diffs/edits/political data persist. Exceptions: `customGeo` (GeoJSON import / generated world provinces) and `project.world` (`{elev, cover}` as RLE+base64 strings, `rivers` polylines in grid units, `scaleKm`, `cellSize`, `rev`/`genRev`). `world` is in the undo slice; after undo/redo `World.sync()` re-decodes the rasters when the strings changed. Regenerating provinces resets `regionGeomEdits`, groups and the undo stacks because every province id changes.

## Invariants & gotchas (each spans multiple files)

- **Undo allow-list:** `politicalSlice(p)` in `core.js` is an explicit list of project fields captured for undo/redo. Any **new top-level project field must be added there** or it is silently lost on undo (whole-project autosave/export already cover new fields).
- **Map colors are inline SVG attributes**, not CSS — driven by `project.settings` (`sea`/`land`/`borders`/`labelColor`/`labelFont`, spread from `MAP_STYLES`). `Actions.applyStyle(name)` overwrites those keys. Themed text uses an inline `style` to beat the `.country-label` CSS rule. `css/editor.css` only themes the app shell (via `data-theme` light/dark CSS vars).
- **Ring winding:** `d3.geoPath` needs exterior rings **clockwise** in planar lon/lat (reverse of RFC 7946); wrong winding renders a polygon as the entire sphere. Load-time `rewindForD3`/`orient` fix this — preserve it when touching geometry.
- **`bm.raw`:** region-grid / localgeo / pixelgeo basemaps ship raw GeoJSON, enabling topology-independent country borders (`ownerUnionPath`, polygon-union per owner) and autonomy overlays. TopoJSON basemaps fall back to arc meshes (`Geo.stateMesh`); union-based features are skipped there.

## Verifying changes in the browser

- **Rebuild first:** `index.html` runs `build/*.js`; after editing a `.jsx` run `npm run build` (or test on `dev.html`).
- **Stale-JS cache:** a same-port reload serves cached `js/*` (both plain scripts *and* the Babel `.jsx`). To pick up edits reliably, load on a **fresh port** (new origin = fresh cache) — start another `python3 -m http.server <newport>` and navigate there.
- **Screenshots lag React:** confirm state by reading `App.*` / the DOM via `javascript_tool` / `read_page`, not from a screenshot taken right after an action.
