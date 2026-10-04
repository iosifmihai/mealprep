// Încarcă la pornire prețurile din oferte (data/prices.json) și rețetele cu poze/video.
// Dacă data/recipes-online.json nu există încă (înainte de prima rulare a actualizării zilnice),
// le citim direct din TheMealDB.
import { convertMeal, MEALDB_API } from "./scripts/mealdb.mjs";

async function getJson(url) {
  try { const r = await fetch(url, { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch { return null; }
}

async function liveRecipes() {
  const letters = "abcdefghijklmnoprstvwy".split("");
  const results = await Promise.all(letters.map((l) => getJson(`${MEALDB_API}/search.php?f=${l}`)));
  const meals = results.flatMap((r) => r?.meals || []).filter((m) => m.strCategory !== "Goat");
  return meals.map((m) => convertMeal(m, PRODUCTS)).filter((r) => Object.keys(r.ing).length >= 1);
}

const [prices, saved] = await Promise.all([getJson("data/prices.json"), getJson("data/recipes-online.json")]);
if (prices) window.mealprep.setLive(prices);
window.mealprep.setOnline(saved?.recipes?.length ? saved.recipes : await liveRecipes());
window.mealprep.done();
