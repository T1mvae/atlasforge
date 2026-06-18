# AtlasForge

A browser-based editor for political / historical / cultural / alternate-history world maps.

**Live:** https://t1mvae.github.io/atlasforge/

No build step — it's a static site (React + Babel-standalone + D3, loaded from CDN). Open `index.html` over HTTP.

## Maps
- **World — provinces** (~4,600 real admin-1 units) — the default, fully editable map.
- **Old World Blues** — post-nuclear real Earth; paint and carve it into factions.
- Plus several region grids (Best Regions, atlas grid, HOI4-style states/provinces) in the gallery.
- **Custom GeoJSON** and a **blank canvas** with an image-tracing backdrop for building new worlds.

## Editing
Paint owners, merge / split / draw / reshape regions (vertex editing with snapping to coastline, rivers, lakes, borders), separate region- and country-border layers, atlas-style labels, physical reference layers (rivers, lakes, relief), timeline snapshots. All edits save in the project JSON and export as GeoJSON / SVG / PNG. The base datasets are never modified.

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## Data sources
Region geometry is derived from [Natural Earth](https://www.naturalearthdata.com/) (public domain) via the scripts in `tools/`.
