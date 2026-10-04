// Descarcă rețetele din TheMealDB (gratuit, cu poză, instrucțiuni și link YouTube)
// și le salvează în data/recipes-online.json în formatul site-ului.
import { writeFileSync } from "node:fs";
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
  writeFileSync(new URL("../data/recipes-online.json", import.meta.url),
    JSON.stringify({ updated: new Date().toISOString(), source: "TheMealDB", count: recipes.length, recipes }, null, 1));
  console.log(`Salvate ${recipes.length} rețete (din ${seen.size}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
