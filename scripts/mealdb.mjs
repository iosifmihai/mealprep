// Conversie TheMealDB -> formatul site-ului. Fără dependențe de Node: folosit și în browser.
import { mapIngredient, parseMeasure, STAPLE_RE } from "./ingredient-map.mjs";

export const MEALDB_API = "https://www.themealdb.com/api/json/v1/1";
const SERVINGS = 4; // TheMealDB nu dă numărul de porții; majoritatea sunt pentru ~4

export function convertMeal(m, PRODUCTS) {
  const ing = {}, other = [], full = [], allergens = new Set();
  for (let i = 1; i <= 20; i++) {
    const name = (m["strIngredient" + i] || "").trim();
    const measure = (m["strMeasure" + i] || "").trim();
    if (!name) continue;
    full.push({ name, measure });
    const n = name.toLowerCase();
    if (/flour|pasta|spaghetti|bread|noodle|tortilla|couscous|breadcrumb|pastry|soy sauce/.test(n)) allergens.add("gluten");
    if (/milk|cheese|butter|cream|yogh?urt|parmesan|mozzarella|feta|ricotta/.test(n) && !/coconut/.test(n)) allergens.add("lactoza");
    if (/egg/.test(n)) allergens.add("oua");
    if (/fish|salmon|tuna|cod|prawn|shrimp|anchov|haddock|mackerel|sardine|mussel|squid/.test(n)) allergens.add("peste");
    if (/nut|peanut|almond|cashew|pecan|walnut|pistachio/.test(n) && !/nutmeg|coconut/.test(n)) allergens.add("nuci");
    if (STAPLE_RE.test(name)) continue;
    const id = mapIngredient(name);
    if (id && PRODUCTS[id]) {
      const q = parseMeasure(measure, id, PRODUCTS[id].unit) / SERVINGS;
      ing[id] = Math.round(((ing[id] || 0) + q) * 100) / 100;
    } else {
      other.push(`${name}${measure ? " (" + measure + ")" : ""}`);
    }
  }
  const cat = m.strCategory || "";
  const all = full.map((f) => f.name.toLowerCase()).join(" ");
  const meat = /chicken|beef|pork|lamb|turkey|bacon|sausage|ham|mince|goat|duck|veal|chorizo|prosciutto/.test(all);
  const fish = allergens.has("peste");
  const diet = ["echilibrat"];
  if (!meat && !fish) diet.push("vegetarian");
  if (cat === "Vegan" || (!meat && !fish && !/egg|milk|cheese|butter|cream|yogh?urt|honey/.test(all))) diet.push("vegan");
  if (/Mediterranean|Greek|Italian|Spanish|Turkish|Moroccan|Tunisian|Croatian/.test(m.strArea || "")) diet.push("mediteranean");
  if (meat || fish) diet.push("high-protein");
  const type = cat === "Breakfast" ? "breakfast" : cat === "Dessert" ? "snack" : "main";
  return {
    id: "mdb_" + m.idMeal,
    name: m.strMeal,
    type,
    category: cat,
    area: m.strArea || "",
    time: 45, // necunoscut în sursă
    kcal: type === "main" ? 600 : type === "breakfast" ? 400 : 300, // estimare
    diet,
    allergens: [...allergens],
    ing,
    other,
    full,
    steps: (m.strInstructions || "").trim(),
    image: m.strMealThumb || "",
    video: m.strYoutube || "",
    source: m.strSource || "",
    online: true,
  };
}

export function youtubeId(url) {
  const m = String(url || "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : "";
}
