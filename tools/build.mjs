#!/usr/bin/env node
// AtlasForge — production build (run after editing anything under js/ or css/):
//   npm install   (once)
//   npm run build
//
// 1. vendor/  — local copies of the UMD libraries, so the installed app works offline
// 2. build/   — js/*.jsx precompiled with the SAME Babel (7.29.0) and the same
//               presets/plugins the in-browser transformer used ("react" + "env").
//               The output stays a classic script: top-level declarations remain
//               globals shared across files, exactly as before.
// 3. index.html + "Map Editor.html" — every local asset stamped with a content hash
//               (?v=…). GitHub Pages sends max-age=600; without a changed URL a
//               returning visitor keeps the old files.
// 4. sw.js    — service worker with the precache list and a version derived from it.
// 5. dev.html — same page, but loads js/*.jsx through in-browser Babel (no build
//               needed while iterating; do not ship links to it).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);
const rel = (...p) => path.join(ROOT, ...p);
const hash = (buf) => crypto.createHash("md5").update(buf).digest("hex").slice(0, 10);

// ---------- 1. vendor ----------
const VENDOR = {
  "react.production.min.js": "react/umd/react.production.min.js",
  "react-dom.production.min.js": "react-dom/umd/react-dom.production.min.js",
  "d3.min.js": "d3/dist/d3.min.js",
  "topojson-client.min.js": "topojson-client/dist/topojson-client.min.js",
  "topojson-simplify.min.js": "topojson-simplify/dist/topojson-simplify.min.js",
  "topojson-server.min.js": "topojson-server/dist/topojson-server.min.js",
  "polygon-clipping.umd.min.js": "polygon-clipping/dist/polygon-clipping.umd.min.js",
  "babel.min.js": "@babel/standalone/babel.min.js" // dev.html only
};
fs.mkdirSync(rel("vendor"), { recursive: true });
for (const [out, src] of Object.entries(VENDOR)) {
  fs.copyFileSync(rel("node_modules", src), rel("vendor", out)); // direct path: package "exports" hide umd/
}

// ---------- 2. precompile JSX ----------
const Babel = require("@babel/standalone");
fs.mkdirSync(rel("build"), { recursive: true });
const jsxFiles = fs.readdirSync(rel("js")).filter((f) => f.endsWith(".jsx"));
for (const f of fs.readdirSync(rel("build"))) {
  if (!jsxFiles.includes(f.replace(/\.js(\.map)?$/, ".jsx"))) fs.rmSync(rel("build", f)); // drop stale outputs
}
for (const f of jsxFiles) {
  const code = fs.readFileSync(rel("js", f), "utf8");
  const out = Babel.transform(code, {
    filename: "js/" + f,
    presets: ["react", "env"],
    plugins: ["transform-class-properties", "transform-object-rest-spread", "transform-flow-strip-types"],
    sourceMaps: true,
    sourceFileName: "../js/" + f
  });
  const name = f.replace(/\.jsx$/, ".js");
  fs.writeFileSync(rel("build", name), out.code + "\n//# sourceMappingURL=" + name + ".map\n");
  fs.writeFileSync(rel("build", name + ".map"), JSON.stringify(out.map));
}

// ---------- 3. stamp the HTML entries ----------
const PAGES = ["index.html", "Map Editor.html"]; // kept byte-identical
const RE_ASSET = /(src|href)="((?:js|css|build|vendor|icons)\/[^"?]+|manifest\.webmanifest)(\?v=[^"]*)?"/g;
let html = fs.readFileSync(rel(PAGES[0]), "utf8");
const shell = new Set();
html = html.replace(RE_ASSET, (m, attr, p) => {
  const file = rel(p);
  if (!fs.existsSync(file)) { console.warn("  missing:", p); return m; }
  const url = p + "?v=" + hash(fs.readFileSync(file));
  shell.add(url);
  return `${attr}="${url}"`;
});
for (const page of PAGES) fs.writeFileSync(rel(page), html);

// ---------- 4. service worker ----------
// also precache what the page loads indirectly (icons referenced by the manifest)
for (const f of fs.readdirSync(rel("icons"))) {
  if (/\.(png|svg)$/.test(f)) shell.add("icons/" + f); // the manifest references them without ?v=
}
const precache = ["./", ...[...shell].sort()];
const version = hash(precache.join("\n") + fs.readFileSync(rel("tools", "sw.template.js")));
const sw = fs.readFileSync(rel("tools", "sw.template.js"), "utf8")
  .replace("__VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(precache, null, 2));
fs.writeFileSync(rel("sw.js"), sw);

// ---------- 5. dev page ----------
const dev = html
  .replace(/<script src="build\/([\w-]+)\.js\?v=[^"]*"><\/script>/g, '<script type="text/babel" src="js/$1.jsx"></script>')
  .replace('<script src="js/i18n.js', '<script src="vendor/babel.min.js"></script>\n<script src="js/i18n.js')
  .replace(/<script src="js\/pwa\.js[^"]*"><\/script>\n?/, ""); // no service worker on the dev page
fs.writeFileSync(rel("dev.html"), dev);

console.log(`built ${jsxFiles.length} jsx → build/, ${Object.keys(VENDOR).length} vendor libs, ${precache.length} precached assets, sw ${version}`);
