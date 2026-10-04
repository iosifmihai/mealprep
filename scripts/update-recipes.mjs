// Descarcă rețetele din TheMealDB (gratuit, cu poză, instrucțiuni și link YouTube)
// și le salvează în data/recipes-online.json în formatul site-ului.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { loadCatalog } from "./load-catalog.mjs";
import { convertMeal, MEALDB_API as API } from "./mealdb.mjs";

const { PRODUCTS } = loadCatalog();

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* reîncercăm */ }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  throw new Error("Nu am putut descărca " + url);
}

// ---- Traducere în română (Google Translate, endpoint public), cu cache ca fiecare rețetă să se traducă o singură dată
const CACHE_FILE = new URL("../data/translations-ro.json", import.meta.url);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function translate(text) {
  if (!text.trim()) return text;
  // bucăți sub ~4000 caractere, tăiate la paragrafe
  const chunks = [];
  let cur = "";
  for (const para of text.split(/(\r?\n)/)) {
    if ((cur + para).length > 4000 && cur) { chunks.push(cur); cur = ""; }
    cur += para;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks) {
    const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ro&dt=t", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "q=" + encodeURIComponent(c),
    });
    if (!r.ok) throw new Error("traducere " + r.status);
    const data = await r.json();
    out.push(data[0].map((x) => x[0]).join(""));
    await sleep(250);
  }
  return out.join("");
}

async function translateRecipe(r) {
  const lines = [r.name, ...r.full.map((f) => `${f.measure} ${f.name}`.trim())];
  let tl = (await translate(lines.join("\n"))).split("\n").map((x) => x.trim());
  if (tl.length !== lines.length) tl = await Promise.all(lines.map((l) => translate(l)));
  return { src: r.name, name: tl[0], ing: tl.slice(1), steps: await translate(r.steps) };
}

async function applyTranslations(recipes) {
  const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
  const max = +(process.env.MAX_TRANSLATE || 1000);
  let done = 0, failed = false;
  for (const r of recipes) {
    let t = cache[r.id];
    if ((!t || t.src !== r.name || t.ing.length !== r.full.length) && !failed && done < max) {
      try { t = cache[r.id] = await translateRecipe(r); done++; }
      catch (e) { console.warn("Oprit traducerea (reîncercăm mâine):", e.message); failed = true; t = null; }
      if (done % 50 === 0) writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }
    if (t && t.src === r.name && t.ing.length === r.full.length) {
      r.name_ro = t.name;
      r.steps_ro = t.steps;
      r.full.forEach((f, i) => { f.ro = t.ing[i]; });
    }
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  console.log(`Traduse acum: ${done}; total în cache: ${Object.keys(cache).length}`);
}

async function main() {
  const seen = new Map();
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const data = await getJson(`${API}/search.php?f=${letter}`);
    for (const m of data.meals || []) seen.set(m.idMeal, m);
  }
  const recipes = [...seen.values()]
    .filter((m) => !["Goat"].includes(m.strCategory))
    .map((m) => convertMeal(m, PRODUCTS))
    .filter((r) => Object.keys(r.ing).length >= 1);
  await applyTranslations(recipes);
  writeFileSync(new URL("../data/recipes-online.json", import.meta.url),
    JSON.stringify({ updated: new Date().toISOString(), source: "TheMealDB", count: recipes.length, recipes }, null, 1));
  console.log(`Salvate ${recipes.length} rețete (din ${seen.size}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
