// AtlasForge — invented place names by a rule: "every name starts with Ш", "sounds like
// Шандар, Шелин, Шурмак", "ends in -ар or -ин", short / medium / long. Laid out by
// geography when asked: provinces of one area share a root, mountain / coastal / forest /
// river provinces get a matching element ("Шангор", "Шанмор"). Pure functions
// (window.NameGen), no DOM — testable in Node.
(function (root) {
  const NG = (root.NameGen = {});

  // ---------- small utils ----------
  function rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  NG.hash = function (s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const pickW = (r, entries) => {
    let total = 0;
    for (const e of entries) total += e[1];
    let x = r() * total;
    for (const e of entries) { x -= e[1]; if (x <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  };
  NG.list = (text) => String(text || "").split(/[,;\n]+/).map((s) => s.trim().replace(/^-+/, "")).filter(Boolean);
  NG.langOf = (text) => (/[а-яё]/i.test(text) ? "ru" : /[a-z]/i.test(text) ? "en" : null);
  const VOWELS = "аеёиоуыэюяaeiouy";
  const isVowel = (ch) => !!ch && VOWELS.indexOf(ch) >= 0;
  const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);
  NG.LENGTHS = { short: [3, 5], medium: [5, 8], long: [8, 11] };

  // ---------- sound: a letter chain learnt from example names ----------
  function buildModel(samples) {
    const k = samples.length >= 12 ? 3 : 2;
    const counts = [];
    for (let o = 0; o <= k; o++) counts.push(new Map());
    samples.forEach((w) => {
      const s = "^".repeat(k) + w.toLowerCase().replace(/[^a-zа-яё'-]/g, "") + "$";
      for (let i = k; i < s.length; i++) {
        const ch = s[i];
        for (let o = 0; o <= k; o++) {
          const ctx = s.slice(i - o, i);
          let m = counts[o].get(ctx);
          if (!m) counts[o].set(ctx, (m = new Map()));
          m.set(ch, (m.get(ch) || 0) + 1);
        }
      }
    });
    return { k, counts };
  }
  // the next letter after text, from the longest context the examples know
  function nextChar(model, text, r, allowEnd) {
    const s = "^".repeat(model.k) + text;
    for (let o = model.k; o >= 0; o--) {
      const m = model.counts[o].get(s.slice(s.length - o));
      if (!m) continue;
      let total = 0;
      m.forEach((v, ch) => { if (allowEnd || ch !== "$") total += v; });
      if (!total) continue;
      let x = r() * total;
      for (const [ch, v] of m) {
        if (!allowEnd && ch === "$") continue;
        x -= v;
        if (x <= 0) return ch;
      }
    }
    return "$";
  }
  function chainWord(model, r, start, min, max) {
    let text = start;
    for (let guard = 0; guard < 30 && text.length < max; guard++) {
      const ch = nextChar(model, text, r, text.length >= min);
      if (ch === "$") break;
      text += ch;
    }
    return text;
  }

  // ---------- sound: the syllables of the example names, recombined ----------
  // "шандар" → шан·дар, "шеверан" → ше·ве·ран: one consonant between vowels opens the
  // next syllable, of two the first closes the previous one, of more all but the last
  // ("caldwyn" → cald·wyn)
  function syllables(word) {
    const w = word.toLowerCase().replace(/[^a-zа-яё]/g, "");
    const out = [];
    let cur = "", i = 0;
    while (i < w.length) {
      cur += w[i];
      if (isVowel(w[i]) && !isVowel(w[i + 1] || "")) {
        let j = i + 1;
        while (j < w.length && !isVowel(w[j])) j++;
        const cluster = w.slice(i + 1, j);
        if (j >= w.length) { cur += cluster; i = j; break; }
        const take = cluster.length >= 3 ? cluster.length - 1 : cluster.length === 2 ? 1 : 0;
        cur += cluster.slice(0, take);
        i += take;
        out.push(cur);
        cur = "";
      }
      i++;
    }
    if (cur) { if (out.length && !/[aeiouyаеёиоуыэюя]/.test(cur)) out[out.length - 1] += cur; else out.push(cur); }
    return out;
  }
  NG.syllables = syllables;
  function buildSyllables(samples) {
    const first = [], mid = [], last = [];
    samples.forEach((w) => {
      const sy = syllables(w);
      if (sy.length === 1) { first.push(sy[0]); return; }
      sy.forEach((x, k) => (k === 0 ? first : k === sy.length - 1 ? last : mid).push(x));
    });
    return { first, mid, last };
  }
  function syllableMix(inv, r, start, min, max) {
    const firsts = inv.first.filter((x) => x.startsWith(start) || start.startsWith(x));
    let text = firsts.length ? firsts[Math.floor(r() * firsts.length)] : start;
    if (!text.startsWith(start)) text = start;
    const tail = inv.last.length ? inv.last : inv.first;
    const middle = inv.mid.length ? inv.mid : inv.first.concat(inv.last);
    for (let guard = 0; guard < 4 && text.length < min - 2; guard++) text += middle[Math.floor(r() * middle.length)];
    if (text.length < max) text += tail[Math.floor(r() * tail.length)];
    return text;
  }

  // ---------- sound without examples: syllables ----------
  const SYL = {
    ru: {
      c: [["л", 9], ["н", 9], ["р", 9], ["с", 7], ["т", 7], ["в", 6], ["к", 6], ["м", 6], ["д", 5], ["г", 4], ["б", 4], ["з", 3], ["ш", 3], ["ж", 2], ["п", 3], ["х", 2], ["ч", 2]],
      v: [["а", 10], ["о", 9], ["е", 7], ["и", 7], ["у", 3], ["я", 1.5], ["ы", 0.5], ["ю", 0.5]],
      coda: [["н", 5], ["р", 5], ["л", 4], ["с", 3], ["к", 2], ["д", 2], ["в", 2], ["м", 2], ["ш", 1], ["т", 1], ["й", 2]]
    },
    en: {
      c: [["l", 9], ["n", 8], ["r", 9], ["s", 7], ["t", 7], ["v", 4], ["k", 3], ["m", 6], ["d", 6], ["g", 4], ["b", 4], ["th", 3], ["sh", 2], ["f", 3], ["h", 3], ["w", 2], ["c", 3]],
      v: [["a", 10], ["e", 9], ["i", 7], ["o", 8], ["u", 3], ["ae", 1], ["ia", 1]],
      coda: [["n", 6], ["r", 6], ["l", 5], ["s", 4], ["th", 2], ["nd", 2], ["m", 2], ["x", 1], ["ck", 1]]
    }
  };
  function syllableWord(lang, r, start, min, max) {
    const S = SYL[lang];
    let text = start;
    if (!text && r() < 0.8) text = pickW(r, S.c);
    for (let guard = 0; guard < 14 && text.length < max; guard++) {
      text += isVowel(text.slice(-1)) ? pickW(r, S.c) : pickW(r, S.v);
      if (text.length >= min && isVowel(text.slice(-1))) {
        const x = r();
        if (x < 0.3) break;
        if (x < 0.65) { text += pickW(r, S.coda); break; }
      }
    }
    return text;
  }

  function pronounceable(w, lang) {
    if (w.length < 2 || /(.)\1\1/.test(w)) return false;
    if (lang === "ru") {
      if (/[бвгджзйклмнпрстфхцчшщьъ]{4,}/.test(w) || /[аеёиоуыэюя]{3,}/.test(w)) return false;
      if (/^[ьъыйё]|[ьъ][ьъйы]|й[йьъ]|[аеёиоуыэюя][ьъ]|[жшчщ]ы|[жшчщ]я|[жшчщ]ю|[гкх]ы/.test(w)) return false;
    } else if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(w) || /[aeiouy]{3,}/.test(w)) return false;
    return true;
  }
  // stem + ending without a vowel clash or a pile of consonants
  function attach(stem, ending, lang) {
    const e = ending.toLowerCase();
    if (!e || stem.endsWith(e)) return stem;
    let s = stem;
    if (isVowel(e[0])) {
      while (s.length > 2 && isVowel(s.slice(-1))) s = s.slice(0, -1);
    } else if (!isVowel(s.slice(-1)) && !isVowel(s.slice(-2, -1))) {
      s += lang === "ru" ? "о" : "e";
    }
    return s + e;
  }

  // ---------- geography ----------
  // an element per kind of place (used when the rule gives no endings of its own)
  const ELEMENTS = {
    ru: { mountain: ["гор", "горье", "скал"], hills: ["холм", "горье"], coast: ["мор", "морье", "брег"], island: ["мор", "морье"],
      river: ["брод", "речье"], forest: ["бор", "лес", "лесье"], marsh: ["топь", "мшар"], desert: ["дюн", "сух"] },
    en: { mountain: ["crag", "peak", "fell"], hills: ["down", "hill"], coast: ["haven", "mouth", "wick"], island: ["holm", "ey"],
      river: ["ford", "bridge"], forest: ["wood", "holt"], marsh: ["fen", "moor"], desert: ["sand", "dune"] }
  };
  NG.ELEMENTS = ELEMENTS;
  // the root provinces of one area share: the start and the first syllable ("шан")
  function rootOf(word, start) {
    let i = start.length;
    while (i < word.length && !isVowel(word[i])) i++;
    if (i < word.length) i++;
    if (i < word.length && !isVowel(word[i]) && i + 1 < word.length) i++;
    return word.slice(0, Math.max(start.length, Math.min(i, 4)));
  }

  // rule: { samples, starts, endings, length: "short"|"medium"|"long", geography }
  // items (in naming order): [{ id, area, kind: "mountain"|"hills"|"coast"|"island"|"river"|"forest"|"marsh"|"desert"|null }]
  // taken: names already on the map (never produced again). Returns { id: name }.
  NG.nameAll = function (rule, items, taken, opts) {
    opts = opts || {};
    const samples = NG.list(rule.samples);
    const starts = NG.list(rule.starts).map((s) => s.toLowerCase());
    const endings = NG.list(rule.endings).map((s) => s.toLowerCase());
    const lang = NG.langOf(samples.join("") + starts.join("") + endings.join("")) || (opts.lang === "en" ? "en" : "ru");
    const [min, max] = NG.LENGTHS[rule.length] || NG.LENGTHS.medium;
    const model = samples.length ? buildModel(samples) : null;
    const inv = samples.length ? buildSyllables(samples) : null;
    const used = new Set();
    (taken || []).forEach((n) => used.add(String(n).trim().toLowerCase()));
    samples.forEach((n) => used.add(n.toLowerCase()));
    const r = rng((opts.seed >>> 0) || NG.hash(JSON.stringify(rule)));
    const word = (start, lo, hi) => (!model ? syllableWord(lang, r, start, lo, hi)
      : r() < 0.55 ? syllableMix(inv, r, start, lo, hi) : chainWord(model, r, start, lo, hi));
    const okStart = (w) => !starts.length || starts.some((s) => w.startsWith(s));

    // one name: start (a rule start or an area root), optionally an ending or element
    const make = (start, ending) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        const relax = attempt > 50 ? 2 : 0; // hard rules: allow a little more length before giving up
        let w;
        if (ending) {
          const lo = Math.max(start.length + 1, min - ending.length), hi = Math.max(lo + 1, max - ending.length + 1);
          const stem = word(start, lo, hi);
          if (stem.slice(-2) === ending.slice(0, 2)) continue;
          w = attach(stem, ending, lang);
        } else w = word(start, min, max + relax);
        if (w.length < min - 1 || w.length > max + 3 + relax) continue;
        if (!okStart(w) || !pronounceable(w, lang) || used.has(w)) continue;
        used.add(w);
        return cap(w);
      }
      return null;
    };
    const startFor = (id) => (starts.length ? starts[NG.hash(id + ":s" + (opts.seed || 0)) % starts.length] : "");
    const endingFor = (id) => (endings.length ? endings[NG.hash(id + ":e" + (opts.seed || 0)) % endings.length] : "");

    const out = {};
    const areas = new Map();
    items.forEach((it) => {
      const key = rule.geography ? String(it.area == null ? it.id : it.area) : it.id;
      if (!areas.has(key)) areas.set(key, []);
      areas.get(key).push(it);
    });
    areas.forEach((list) => {
      // a shared root for an area of several provinces
      let rootStart = null;
      if (rule.geography && list.length > 1) {
        const s0 = startFor(list[0].id);
        for (let k = 0; k < 20 && !rootStart; k++) {
          const w = word(s0, min, max);
          const rt = rootOf(w, s0);
          if (rt.length >= Math.max(2, s0.length + 1) && okStart(rt) && pronounceable(rt, lang)) rootStart = rt;
        }
      }
      list.forEach((it) => {
        const start = rootStart && r() < 0.7 ? rootStart : startFor(it.id);
        let ending = endingFor(it.id);
        if (!ending && rule.geography && it.kind && ELEMENTS[lang][it.kind] && r() < 0.4) {
          const els = ELEMENTS[lang][it.kind];
          ending = els[Math.floor(r() * els.length)];
        }
        out[it.id] = make(start, ending) || make(startFor(it.id), endingFor(it.id)) || make(startFor(it.id), "");
      });
    });
    return out;
  };

  // a different name for one province, keeping all the others
  NG.nameOne = function (rule, item, taken, opts) {
    const res = NG.nameAll(rule, [Object.assign({}, item, { area: item.id })], taken, opts);
    return res[item.id];
  };
})(typeof self !== "undefined" ? self : this);
