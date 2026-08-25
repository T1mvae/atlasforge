#!/usr/bin/env python3
# AtlasForge — cache-bust the local assets in the two HTML entry points.
#
# The site is served straight from the repo root by GitHub Pages, which sends
# `cache-control: max-age=600` on every file. Without a version marker a visitor
# who already has the page keeps running the OLD js/*.js and js/*.jsx (the Babel
# ones stick around longest), so a deploy looks like it did nothing. Stamping each
# local <script>/<link> with a short content hash makes the URL change whenever the
# file does, and stay identical when it doesn't.
#
# Run after editing anything under js/ or css/, before committing:
#   python3 tools/stamp_assets.py
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["index.html", "Map Editor.html"]   # kept byte-identical
RE_ASSET = re.compile(r'(src|href)="((?:js|css)/[^"?]+)(\?v=[^"]*)?"')

def digest(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:10]

src = os.path.join(ROOT, PAGES[0])
html = open(src, encoding="utf-8").read()
seen = []
def stamp(m):
    attr, rel = m.group(1), m.group(2)
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        print("  missing: %s" % rel); return m.group(0)
    h = digest(p)
    seen.append((rel, h))
    return '%s="%s?v=%s"' % (attr, rel, h)

out = RE_ASSET.sub(stamp, html)
changed = []
for page in PAGES:
    p = os.path.join(ROOT, page)
    old = open(p, encoding="utf-8").read() if os.path.isfile(p) else None
    if old != out:
        open(p, "w", encoding="utf-8").write(out)
        changed.append(page)
for rel, h in seen:
    print("  %-20s %s" % (rel, h))
print("stamped %d assets; rewrote: %s" % (len(seen), ", ".join(changed) or "nothing (already current)"))
