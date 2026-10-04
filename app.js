// Meal Prep pentru 2 — wizard pas cu pas, totul în browser (fără server).
const $ = (s, el = document) => el.querySelector(s);
const STORE_KEY = "mealprep2-state";
const PRICE_KEY = "mealprep2-prices";

const defaultPerson = (name, sex) => ({ name, age: 30, sex, height: sex === "M" ? 178 : 165, weight: sex === "M" ? 80 : 62, activity: 1.375, workouts: "nu", workoutDays: 0 });

let S = load(STORE_KEY) || {
  step: 0,
  store: null,
  diet: "echilibrat",
  goal: "mentinere",
  people: [defaultPerson("Persoana 1", "F"), defaultPerson("Persoana 2", "M")],
  allergens: [],
  dislikes: "",
  loves: "",
  hasStaples: true,
  days: 5,
  prepSessions: 2,
  maxTime: 45,
  breakfast: true,
  snack: true,
  mainsPerDay: 2,
  budget: 400,
  chosen: [],
};
const priceOverrides = load(PRICE_KEY) || {};

// Date încărcate la pornire (vezi online.js): rețete TheMealDB și prețuri din oferte
let ONLINE = [];
let LIVE = null; // data/prices.json
const ui = { q: "", cat: "toate", showN: 24, detail: null, loading: true };
// Doar rețetele cu poză (TheMealDB). Cele locale, fără poză, rămân doar ca rezervă dacă nu se pot încărca.
const allRecipes = () => (ONLINE.length ? ONLINE.filter((r) => r.image) : RECIPES);
const T = (r, f) => r[f + "_ro"] || r[f]; // text tradus, dacă există
const findRecipe = (id) => allRecipes().find((r) => r.id === id);
window.mealprep = {
  setOnline(list) { ONLINE = list; },
  setLive(p) { LIVE = p; },
  done() { ui.loading = false; render(); },
};

function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); localStorage.setItem(PRICE_KEY, JSON.stringify(priceOverrides)); } catch {} }

const ACTIVITY = [
  [1.2, "Sedentar (birou, fără sport)"],
  [1.375, "Ușor activ (1–3 antrenamente/săpt.)"],
  [1.55, "Moderat activ (3–5/săpt.)"],
  [1.725, "Foarte activ (6–7/săpt.)"],
  [1.9, "Extra activ (muncă fizică + sport)"],
];
const DIETS = { echilibrat: "Echilibrat", "high-protein": "Bogat în proteine", mediteranean: "Mediteranean", vegetarian: "Vegetarian", vegan: "Vegan", "low-carb": "Low-carb", keto: "Keto" };
const GOALS = { slabire: "Slăbire 📉", mentinere: "Menținere ⚖️", masa: "Masă musculară 💪" };
const ALLERGENS = { gluten: "Gluten", lactoza: "Lactoză", oua: "Ouă", peste: "Pește", nuci: "Nuci/arahide" };

// ---------- Calcule ----------
function tdee(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "M" ? 5 : -161);
  return Math.round(bmr * p.activity);
}
function target(p) {
  const t = tdee(p);
  const adj = { slabire: -0.2, mentinere: 0, masa: 0.1 }[S.goal];
  const kcal = Math.round(t * (1 + adj) / 10) * 10;
  const protPerKg = S.goal === "masa" || S.diet === "high-protein" ? 2.0 : S.goal === "slabire" ? 1.8 : 1.6;
  const protein = Math.round(p.weight * protPerKg);
  const fatPct = S.diet === "keto" ? 0.7 : S.diet === "low-carb" ? 0.4 : 0.28;
  const fat = Math.round(kcal * fatPct / 9);
  const carbs = Math.max(20, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { tdee: t, kcal, protein, fat, carbs };
}

function storeFor(id) {
  const pr = PRODUCTS[id];
  const get = (st) => {
    const live = LIVE?.stores?.[st]?.[id];
    return { ...pr[st], price: priceOverrides[`${st}:${id}`] ?? live?.price ?? pr[st].price, promo: !!live && priceOverrides[`${st}:${id}`] == null, store: st };
  };
  if (S.store === "ambele") {
    const a = get("lidl"), b = get("kaufland");
    return a.price / a.pack <= b.price / b.pack ? a : b;
  }
  return get(S.store);
}

function eligibleRecipes() {
  const dislikes = S.dislikes.toLowerCase().split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return allRecipes().filter((r) => {
    if (S.diet !== "echilibrat" && !r.diet.includes(S.diet)) return false;
    if (r.allergens.some((a) => S.allergens.includes(a))) return false;
    if (!r.online && r.time > S.maxTime) return false;
    const names = (Object.keys(r.ing).map((i) => PRODUCTS[i].name).join(" ") + " " + r.name + " " + (r.name_ro || "")).toLowerCase();
    return !dislikes.some((d) => names.includes(d));
  });
}
function isLoved(r) {
  const loves = S.loves.toLowerCase().split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const names = (Object.keys(r.ing).map((i) => PRODUCTS[i].name).join(" ") + " " + r.name + " " + (r.name_ro || "")).toLowerCase();
  return loves.some((l) => names.includes(l));
}

// O „gătire” = rețeta făcută o dată = 4 porții = 2 mese pentru voi doi
const BATCH = 4;
const batchesOf = (id) => S.batches?.[id] || 1;

// Cost estimat pe o porție (proporțional cu cât folosiți din fiecare produs)
function recipeCost(r) {
  return Object.entries(r.ing).reduce((sum, [id, q]) => { const s = storeFor(id); return sum + q * s.price / s.pack; }, 0);
}

// Alege automat rețetele cele mai ieftine care acoperă zilele planificate și încap în buget
function autoPickForBudget() {
  // rețetele online au ingrediente fără preț în catalog; le folosim doar dacă le știm costul aproape complet
  const list = eligibleRecipes().filter((r) => (r.other || []).length <= 1 && Object.keys(r.ing).length >= 3);
  const cheapest = (t) => list.filter((r) => r.type === t).sort((a, b) => isLoved(b) - isLoved(a) || recipeCost(a) - recipeCost(b));
  const mains = cheapest("main"), bf = cheapest("breakfast"), sn = cheapest("snack");
  const mealsPerBatch = BATCH / 2;
  const nMains = Math.min(mains.length, Math.max(1, Math.ceil((S.days * S.mainsPerDay) / mealsPerBatch)));
  const cover = Math.max(1, Math.ceil(S.days / mealsPerBatch));
  for (const extras of [[1, 1], [1, 0], [0, 1], [0, 0]]) {
    S.chosen = mains.slice(0, nMains).map((r) => r.id);
    S.batches = {};
    if (S.breakfast && extras[0] && bf[0]) { S.chosen.push(bf[0].id); S.batches[bf[0].id] = cover; }
    if (S.snack && extras[1] && sn[0]) { S.chosen.push(sn[0].id); S.batches[sn[0].id] = cover; }
    if (buildPlan().total <= S.budget) return true;
  }
  // tot peste buget: mai puține rețete principale
  for (let n = nMains - 1; n >= 1; n--) {
    S.chosen = mains.slice(0, n).map((r) => r.id);
    if (buildPlan().total <= S.budget) return true;
  }
  return false;
}

// Planul: fiecare rețetă aleasă se gătește o dată (sau de câte ori ați ales), apoi mesele se împart pe zile
function buildPlan() {
  const chosen = allRecipes().filter((r) => S.chosen.includes(r.id));
  const byType = (t) => chosen.filter((r) => r.type === t);
  const mains = byType("main"), bf = S.breakfast ? byType("breakfast") : [], sn = S.snack ? byType("snack") : [];
  // mese disponibile, amestecate ca să nu mâncați același lucru zile la rând
  const pool = (rs) => {
    const left = rs.map((r) => [r, batchesOf(r.id) * BATCH / 2]);
    const out = [];
    while (left.some(([, n]) => n > 0)) left.forEach((x) => { if (x[1] > 0) { out.push(x[0]); x[1]--; } });
    return out;
  };
  const mPool = pool(mains), bPool = pool(bf), sPool = pool(sn);
  const nDays = Math.max(Math.ceil(mPool.length / S.mainsPerDay), bPool.length, sPool.length);
  const days = [];
  for (let d = 0; d < nDays; d++) {
    const meals = [];
    if (bPool[d]) meals.push(["Mic dejun", bPool[d]]);
    for (let m = 0; m < S.mainsPerDay; m++) {
      const r = mPool[d * S.mainsPerDay + m];
      if (r) meals.push([m === 0 ? "Prânz" : "Cină", r]);
    }
    if (sPool[d]) meals.push(["Gustare", sPool[d]]);
    days.push(meals);
  }
  const mainDays = mPool.length / S.mainsPerDay;
  const need = {};
  for (const r of chosen) {
    if ((r.type === "breakfast" && !S.breakfast) || (r.type === "snack" && !S.snack)) continue;
    for (const [ing, q] of Object.entries(r.ing)) need[ing] = (need[ing] || 0) + q * BATCH * batchesOf(r.id);
  }
  const lines = Object.entries(need).filter(([, q]) => q > 0).map(([id, q]) => {
    const s = storeFor(id);
    const packs = Math.max(1, Math.ceil(q / s.pack - 0.05));
    return { id, name: PRODUCTS[id].name, section: PRODUCTS[id].section, unit: PRODUCTS[id].unit, qty: q, packs, ...s, cost: packs * s.price, used: q * s.price / s.pack };
  });
  const total = lines.reduce((s, l) => s + l.cost, 0); // ce plătiți la casă (pachete întregi)
  const used = lines.reduce((s, l) => s + l.used, 0); // cât consumați efectiv din ele
  // ingrediente din rețetele online pe care nu le avem în catalog (fără preț)
  const others = [...new Set(chosen.flatMap((r) => r.other || []))];
  // împărțirea fiecărei oale între voi, după caloriile fiecăruia
  const kc = S.people.map((p) => target(p).kcal);
  const split = kc.map((k) => Math.round((k / (kc[0] + kc[1])) * 100));
  return { days, mainDays, lines, total, used, chosen, others, split };
}

// ---------- UI helpers ----------
const STEPS = ["Start", "Magazin", "Obiective", "Persoana 1", "Persoana 2", "Macro", "Preferințe", "Bucătărie", "Logistică", "Buget", "Rețete", "Plan"];
const fmt = (n) => n.toFixed(2).replace(".", ",") + " lei";
const fmtQty = (q, u) => (u === "buc" ? `${Math.ceil(q * 10) / 10} buc` : q >= 1000 ? `${(q / 1000).toFixed(1)} ${u === "g" ? "kg" : "L"}` : `${Math.round(q)} ${u}`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function go(n) { S.step = Math.max(0, Math.min(STEPS.length - 1, n)); save(); render(); window.scrollTo(0, 0); }
function nav(nextLabel = "Mai departe →", nextOk = true) {
  return `<div class="nav">${S.step > 0 ? `<button class="ghost" data-go="${S.step - 1}">← Înapoi</button>` : "<span></span>"}
    <button class="primary" data-go="${S.step + 1}" ${nextOk ? "" : "disabled"}>${nextLabel}</button></div>`;
}
function bubble(text) { return `<div class="bubble"><span class="avatar">🧑‍🍳</span><div>${text}</div></div>`; }
function choice(name, value, label, current, sub = "") {
  return `<label class="choice ${current === value ? "on" : ""}"><input type="radio" name="${name}" value="${value}" ${current === value ? "checked" : ""}><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</label>`;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- Pași ----------
const views = {
  0: () => `
    ${bubble(`<h1>${pick(["Salut, echipă de doi! 👋", "Bună, duo culinar! 🍳", "Hei, voi doi! 🥗"])}</h1>
      <p>Sunt sidekick-ul vostru de meal prep. Împreună facem:</p>
      <ul><li>📋 un <b>plan de mese</b> pe stilul, gusturile și obiectivele voastre — calculat separat pentru fiecare;</li>
      <li>🛒 o <b>listă de cumpărături</b> direct cu produse de la <b>Lidl</b> sau <b>Kaufland</b>, pe raioane, cu cost estimat;</li>
      <li>⏱️ rețete potrivite timpului și bucătăriei voastre.</li></ul>
      <p>Vă pun câteva întrebări pe rând (promit că nu doare), apoi alegeți voi preparatele din lista mea. La final puteți modifica orice.</p>`)}
    ${nav("Hai să începem! 🚀")}`,

  1: () => `
    ${bubble(`<h2>Primul lucru: unde mergem la cumpărături?</h2><p>Iau produsele și prețurile din catalogul magazinului ales.</p>`)}
    <div class="grid3">
      ${choice("store", "lidl", "🟡🔵 Lidl", S.store, "Produse Pilos, Freshona, Combino…")}
      ${choice("store", "kaufland", "🔴 Kaufland", S.store, "Produse K-Classic…")}
      ${choice("store", "ambele", "⚖️ Cel mai ieftin", S.store, "Aleg pe fiecare produs magazinul mai avantajos")}
    </div>
    ${nav("Mai departe →", !!S.store)}`,

  2: () => `
    ${bubble(`<h2>Ce fel de dietă vă tentează?</h2><p>Și care e obiectivul principal?</p>`)}
    <h3>Dietă</h3><div class="grid3">${Object.entries(DIETS).map(([k, v]) => choice("diet", k, v, S.diet)).join("")}</div>
    <h3>Obiectiv</h3><div class="grid3">${Object.entries(GOALS).map(([k, v]) => choice("goal", k, v, S.goal)).join("")}</div>
    ${nav()}`,

  3: () => personView(0),
  4: () => personView(1),

  5: () => {
    const rows = S.people.map((p) => { const t = target(p); return `
      <div class="card macro"><h3>${esc(p.name)}</h3>
        <div class="big">${t.kcal} <small>kcal/zi</small></div>
        <small>TDEE (întreținere): ${t.tdee} kcal</small>
        <div class="bars"><span>🥩 Proteine <b>${t.protein} g</b></span><span>🍚 Carbohidrați <b>${t.carbs} g</b></span><span>🥑 Grăsimi <b>${t.fat} g</b></span></div>
      </div>`; }).join("");
    return `${bubble(`<h2>Aici intră știința 🔬</h2><p>Am folosit formula Mifflin-St Jeor + nivelul de activitate, apoi am ajustat pentru obiectivul „${GOALS[S.goal]}”. Dacă vreți alte cifre, întoarceți-vă și modificați datele.</p>`)}
      <div class="grid2">${rows}</div>${nav("Arată bine →")}`;
  },

  6: () => `
    ${bubble(`<h2>Preferințe & restricții</h2><p>Momentul vostru să interziceți broccoli pe viață. 🥦🚫</p>`)}
    <h3>Alergii / restricții</h3>
    <div class="chips">${Object.entries(ALLERGENS).map(([k, v]) => `<label class="chip ${S.allergens.includes(k) ? "on" : ""}"><input type="checkbox" name="allergen" value="${k}" ${S.allergens.includes(k) ? "checked" : ""}>Fără ${v}</label>`).join("")}</div>
    <label class="field">Ce NU vreți să mâncați? <small>(separat prin virgulă, ex: broccoli, somon)</small><input name="dislikes" value="${esc(S.dislikes)}"></label>
    <label class="field">Ce iubiți și vreți mai des? <small>(ex: pui, avocado, năut)</small><input name="loves" value="${esc(S.loves)}"></label>
    ${nav()}`,

  7: () => `
    ${bubble(`<h2>Ce e prin bucătărie?</h2>`)}
    <label class="chip ${S.hasStaples ? "on" : ""}"><input type="checkbox" name="hasStaples" ${S.hasStaples ? "checked" : ""}>Avem deja condimentele de bază: ${STAPLES.join(", ")}</label>
    <label class="field">Timp maxim pentru o rețetă<select name="maxTime">${[[15, "Super rapid (≤15 min)"], [30, "Rapid (≤30 min)"], [45, "Normal (≤45 min)"], [90, "Avem timp, ne place să gătim"]].map(([v, l]) => `<option value="${v}" ${S.maxTime == v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field">De câte ori pe săptămână gătiți (sesiuni de prep)?<input type="number" min="1" max="7" name="prepSessions" value="${S.prepSessions}"></label>
    ${nav()}`,

  8: () => `
    ${bubble(`<h2>Logistica meselor</h2>`)}
    <label class="field">Pentru câte zile planificăm?<input type="number" min="1" max="7" name="days" value="${S.days}"></label>
    <label class="field">Mese principale pe zi<select name="mainsPerDay"><option value="1" ${S.mainsPerDay == 1 ? "selected" : ""}>1 (doar prânz)</option><option value="2" ${S.mainsPerDay == 2 ? "selected" : ""}>2 (prânz + cină)</option></select></label>
    <div class="chips">
      <label class="chip ${S.breakfast ? "on" : ""}"><input type="checkbox" name="breakfast" ${S.breakfast ? "checked" : ""}>Includem micul dejun</label>
      <label class="chip ${S.snack ? "on" : ""}"><input type="checkbox" name="snack" ${S.snack ? "checked" : ""}>Includem o gustare</label>
    </div>
    ${nav()}`,

  9: () => `
    ${bubble(`<h2>Bugetul săptămânal pentru mâncare?</h2><p>Nu trebuie exact, doar o idee — vă spun dacă ne încadrăm.</p>`)}
    <label class="field">Buget (lei)<input type="number" min="50" step="10" name="budget" value="${S.budget}"></label>
    ${nav("Arată-mi rețetele! 🍽️")}`,

  10: () => {
    if (ui.loading) return bubble("<p>Încarc rețetele… 🍳</p>");
    const q = ui.q.toLowerCase();
    const all = eligibleRecipes().filter((r) => (r.type !== "breakfast" || S.breakfast) && (r.type !== "snack" || S.snack));
    const cats = ["toate", ...new Set(all.map((r) => r.category).filter(Boolean))];
    const list = all
      .filter((r) => ui.cat === "toate" || r.cat === ui.cat || r.category === ui.cat)
      .filter((r) => !q || (r.name + " " + (r.name_ro || "") + " " + Object.keys(r.ing).map((i) => PRODUCTS[i].name).join(" ") + " " + (r.full || []).map((f) => f.name).join(" ")).toLowerCase().includes(q))
      .sort((a, b) => S.chosen.includes(b.id) - S.chosen.includes(a.id) || isLoved(b) - isLoved(a) || !!a.online - !!b.online);
    const pl = S.chosen.length ? buildPlan() : null;
    const est = pl ? pl.total : 0;
    const hasMain = S.chosen.some((id) => findRecipe(id)?.type === "main");
    const TYPE = { main: "🍲 Fel principal", breakfast: "🍳 Mic dejun", snack: "🍌 Gustare/desert" };
    return `${bubble(`<h2>Meniul casei 📜</h2><p>Avem <b>${all.length} rețete</b> cu poză potrivite filtrelor voastre. Fiecare rețetă aleasă o <b>gătiți o dată</b> și iese ~${BATCH} porții = 2 mese pentru amândoi. Bifați ce vă face poftă; apăsați pe poză pentru rețeta completă și video.</p>`)}
      <div class="total sticky ${est > S.budget ? "over" : ""}"><span>${S.chosen.length} alese · gătite o dată: <b>${fmt(est)}</b> la casă · buget ${fmt(+S.budget)}${pl ? `<br><small>Felurile principale ajung ~${Math.floor(pl.mainDays * 10) / 10} zile (planificați ${S.days})</small>` : ""}</span>
        <button class="ghost" id="autobudget">💰 Alege automat în buget</button></div>
      <div class="filters"><input id="q" placeholder="🔍 Caută: pui, paste, linte…" value="${esc(ui.q)}">
        <select id="cat">${cats.map((c) => `<option value="${esc(c)}" ${ui.cat === c ? "selected" : ""}>${c === "toate" ? "Toate categoriile" : esc(RO_CAT[c] || c)}</option>`).join("")}</select></div>
      <div class="recipes">${list.slice(0, ui.showN).map((r) => recipeCard(r, TYPE)).join("") || `<p class="muted">Nimic găsit — încercați altă căutare sau relaxați filtrele.</p>`}</div>
      ${list.length > ui.showN ? `<div class="row"><button class="ghost" id="more">Arată mai multe (${list.length - ui.showN} rămase)</button></div>` : ""}
      ${nav("Generează planul ✨", hasMain)}`;
  },

  11: () => resultView(),
};

const RO_CAT = { Chicken: "Pui", Beef: "Vită", Pork: "Porc", Lamb: "Miel", Seafood: "Pește & fructe de mare", Vegetarian: "Vegetarian", Vegan: "Vegan", Pasta: "Paste", Breakfast: "Mic dejun", Dessert: "Desert", Side: "Garnituri", Starter: "Aperitive", Miscellaneous: "Diverse" };
const ytSearch = (r) => `https://www.youtube.com/results?search_query=${encodeURIComponent((r.online ? r.name + " recipe" : "rețetă " + r.name))}`;
const ytId = (url) => (String(url || "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1] || "";

const RO_AREA = { American: "American", British: "Britanic", Canadian: "Canadian", Chinese: "Chinezesc", Croatian: "Croat", Dutch: "Olandez", Egyptian: "Egiptean", Filipino: "Filipinez", French: "Franțuzesc", Greek: "Grecesc", Indian: "Indian", Irish: "Irlandez", Italian: "Italian", Jamaican: "Jamaican", Japanese: "Japonez", Kenyan: "Kenyan", Malaysian: "Malaezian", Mexican: "Mexican", Moroccan: "Marocan", Polish: "Polonez", Portuguese: "Portughez", Russian: "Rusesc", Spanish: "Spaniol", Thai: "Thailandez", Tunisian: "Tunisian", Turkish: "Turcesc", Ukrainian: "Ucrainean", Vietnamese: "Vietnamez", Romanian: "Românesc", Norwegian: "Norvegian", Saudi: "Saudit", Syrian: "Sirian", Venezulan: "Venezuelan", "United States": "American", Argentinian: "Argentinian", Algerian: "Algerian", Australian: "Australian", Slovakian: "Slovac", Uruguayan: "Uruguayan", Unknown: "Internațional" };

function recipeCard(r, TYPE) {
  const on = S.chosen.includes(r.id);
  return `<div class="recipe ${on ? "on" : ""}">
    <button class="thumb" data-detail="${r.id}" aria-label="Detalii ${esc(r.name)}">${r.image ? `<img src="${r.image}/preview" onerror="this.src='${r.image}'" alt="" loading="lazy">` : `<span>${r.type === "breakfast" ? "🍳" : r.type === "snack" ? "🍌" : "🍲"}</span>`}${r.video ? `<i class="play">▶</i>` : ""}</button>
    <label><input type="checkbox" name="chosen" value="${r.id}" ${on ? "checked" : ""}>
      <b>${isLoved(r) ? "❤️ " : ""}${esc(T(r, "name"))}</b></label>
    <small>${TYPE[r.type]} · ${r.online ? `🌍 ${esc(RO_AREA[r.area] || r.area || "Internațional")}` : `⏱ ${r.time} min`}</small>
    <small><b>~${fmt(recipeCost(r) * BATCH)}</b> gătită o dată (${BATCH} porții)${r.other?.length ? ` + ${r.other.length} ingrediente fără preț` : ""}</small>
    ${on ? `<div class="batches">Gătesc de <button data-batch="${r.id}" data-d="-1" aria-label="mai puțin">−</button><b>${batchesOf(r.id)}×</b><button data-batch="${r.id}" data-d="1" aria-label="mai mult">＋</button></div>` : ""}
    <button class="link" data-detail="${r.id}">Vezi rețeta${r.video ? " + video" : ""} →</button>
  </div>`;
}

function detailView(r) {
  const vid = ytId(r.video);
  const ingList = r.full
    ? r.full.map((f) => `<li>${esc(f.ro || `${f.measure} ${f.name}`)}</li>`).join("")
    : Object.entries(r.ing).map(([i, q]) => `<li>${fmtQty(q * BATCH, PRODUCTS[i].unit)} ${PRODUCTS[i].name}</li>`).join("");
  return `<div class="modal" id="modal"><div class="sheet">
    <button class="close" id="closeModal" aria-label="Închide">✕</button>
    ${r.image ? `<img class="hero" src="${r.image}" alt="">` : ""}
    <h2>${esc(T(r, "name"))}</h2>
    <p class="muted">${r.online ? `🌍 ${esc(RO_AREA[r.area] || r.area || "Internațional")} · ${esc(RO_CAT[r.category] || r.category)} · ${r.steps_ro ? "tradusă automat din engleză" : "în engleză — traducerea vine la următoarea actualizare"} (sursa TheMealDB), ~${BATCH} porții` : `⏱ ${r.time} min · ${r.kcal} kcal/porție · P ${r.p} g / C ${r.c} g / G ${r.f} g`}</p>
    <h3>Ingrediente ${r.online ? "" : `(${BATCH} porții)`}</h3><ul>${ingList}</ul>
    <h3>Mod de preparare</h3><div class="steps">${esc(T(r, "steps")).replace(/\r?\n+/g, "<br><br>")}</div>
    <h3>🎬 Video</h3>
    ${vid ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="Video ${esc(r.name)}" allowfullscreen loading="lazy"></iframe></div>` : ""}
    <p><a href="${vid ? r.video : ytSearch(r)}" target="_blank" rel="noopener">${vid ? "Deschide pe YouTube" : "Caută video pe YouTube"} ↗</a>${r.source ? ` · <a href="${r.source}" target="_blank" rel="noopener">Sursa rețetei ↗</a>` : ""}</p>
    <div class="row"><button class="primary" data-toggle="${r.id}">${S.chosen.includes(r.id) ? "✓ Aleasă — scoate din plan" : "＋ Adaugă în plan"}</button></div>
  </div></div>`;
}

function personView(i) {
  const p = S.people[i];
  return `
    ${bubble(`<h2>${i === 0 ? "Hai să vă cunosc! Începem cu prima persoană." : "Și acum, partenerul de prep! 🤝"}</h2><p>Am nevoie de date ca să calculez caloriile (TDEE).</p>`)}
    <div class="form2">
      <label class="field">Nume<input name="p.name" value="${esc(p.name)}"></label>
      <label class="field">Sex<select name="p.sex"><option value="F" ${p.sex === "F" ? "selected" : ""}>Feminin</option><option value="M" ${p.sex === "M" ? "selected" : ""}>Masculin</option></select></label>
      <label class="field">Vârstă<input type="number" name="p.age" value="${p.age}"></label>
      <label class="field">Înălțime (cm)<input type="number" name="p.height" value="${p.height}"></label>
      <label class="field">Greutate (kg)<input type="number" name="p.weight" value="${p.weight}"></label>
      <label class="field">Activitate zilnică<select name="p.activity">${ACTIVITY.map(([v, l]) => `<option value="${v}" ${p.activity == v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field">Tip antrenament<select name="p.workouts">${["nu", "cardio", "forță", "yoga/pilates", "mix"].map((w) => `<option ${p.workouts === w ? "selected" : ""}>${w}</option>`).join("")}</select></label>
      <label class="field">Zile de sport/săpt.<input type="number" min="0" max="7" name="p.workoutDays" value="${p.workoutDays}"></label>
    </div>
    ${nav()}`;
}

function resultView() {
  const plan = buildPlan();
  const storeName = { lidl: "Lidl", kaufland: "Kaufland", ambele: "Lidl + Kaufland (cel mai ieftin)" }[S.store];
  const daysHtml = plan.days.map((ms, d) => `
    <div class="card day"><h3>Ziua ${d + 1}</h3>${ms.map(([label, r]) => `<div class="meal"><span>${label}</span><b>${r.name}</b></div>`).join("")}
    <small class="muted">~${ms.reduce((a, [, r]) => a + r.kcal, 0)} kcal/porție standard</small></div>`).join("");

  const portionsInfo = S.people.map((p, i) => `<li><b>${esc(p.name)}</b>: ~${plan.split[i]}% din fiecare oală (țintă ${target(p).kcal} kcal/zi)</li>`).join("");

  const sections = Object.entries(SECTIONS).map(([sec, title]) => {
    const ls = plan.lines.filter((l) => l.section === sec);
    if (!ls.length) return "";
    return `<h3>${title}</h3><table class="list"><tbody>${ls.map((l) => `
      <tr><td><label><input type="checkbox" class="tick"> ${l.product}${l.promo ? ` <span class="tag promo" title="${esc(LIVE.stores[l.store][l.id].offerTitle)}">🔥 ofertă</span>` : ""}</label><small>${l.name} · necesar ${fmtQty(l.qty, l.unit)}${S.store === "ambele" ? ` · <span class="tag ${l.store}">${l.store === "lidl" ? "Lidl" : "Kaufland"}</span>` : ""}</small></td>
      <td class="num">× ${l.packs}</td>
      <td class="num"><input class="price" type="number" step="0.01" data-pid="${l.store}:${l.id}" value="${l.price}"></td>
      <td class="num">${fmt(l.cost)}</td></tr>`).join("")}</tbody></table>`;
  }).join("");

  const over = plan.total > S.budget;
  const recipesHtml = `<div class="recipes">${plan.chosen.map((r) => recipeCard(r, { main: "🍲 Fel principal", breakfast: "🍳 Mic dejun", snack: "🍌 Gustare" })).join("")}</div>`;
  const othersHtml = plan.others.length ? `<h3>🧺 Alte ingrediente (din rețetele internaționale, fără preț în catalog)</h3><ul class="others">${plan.others.map((o) => `<li><label><input type="checkbox" class="tick"> ${esc(o)}</label></li>`).join("")}</ul>` : "";

  const tips = [
    "📱 Urmăriți ce mâncați cu <b>MyFitnessPal</b> sau <b>Yazio</b> câteva săptămâni — calibrați porțiile mult mai bine.",
    S.goal === "masa" ? "🏋️ Pentru masă musculară: 3–4 antrenamente de forță/săpt. cu progresie (greutate sau repetări)." :
      S.goal === "slabire" ? "🚶 Pentru slăbire: țintiți 8–10k pași/zi + 2–3 antrenamente de forță ca să păstrați mușchii." :
      "🤸 Pentru menținere: 150 min mișcare moderată/săpt. — plimbări, bicicletă, ce vă place.",
    `💸 Pentru buget: <b>YNAB</b>, <b>Wallet</b> sau un simplu tabel comun. Verificați și cataloagele/aplicațiile Lidl Plus & Kaufland Card pentru reduceri.`,
    `🗓️ Cu ${S.prepSessions} ${S.prepSessions == 1 ? "sesiune" : "sesiuni"} de prep: gătiți duminica pentru zilele 1–3${S.prepSessions > 1 ? " și miercuri pentru restul" : "; peștele și salatele faceți-le proaspete"}. Mâncarea gătită ține 3–4 zile în frigider.`,
    "😴 Somnul și stresul contează cât dieta — 7–8 ore și 10 minute de respirație/mers pe zi fac minuni.",
  ];

  return `
    ${bubble(`<h2>Gata! Iată planul vostru 🎉</h2><p>Magazin: <b>${storeName}</b> · gătiți o dată, mâncați ~${Math.floor(plan.mainDays * 10) / 10} zile${plan.mainDays < S.days ? ` (din ${S.days} planificate — mai adăugați o rețetă sau apăsați ＋ la una)` : ""} · 2 persoane · dietă ${DIETS[S.diet]}.</p>`)}
    <div class="card"><h3>Cum împărțiți porțiile</h3><ul>${portionsInfo}</ul><small class="muted">Fiecare rețetă se gătește o dată și dă ${BATCH} porții standard (2 mese pentru amândoi). Împărțiți-o în caserole după procentele de mai sus.</small></div>
    <h2>📅 Planul de mese</h2><div class="days">${daysHtml}</div>
    <h2>🛒 Lista de cumpărături</h2>
    <div class="total ${over ? "over" : ""}">La casă (pachete întregi): <b>${fmt(plan.total)}</b> · consumat efectiv în rețete: ${fmt(plan.used)} — restul rămâne în cămară · buget ${fmt(+S.budget)} ${over ? "— 😬 peste buget: alegeți rețete cu linte/năut/ouă sau mai puține zile" : "— ✅ în buget"}</div>
    ${S.hasStaples ? "" : `<p><b>Nu uitați condimentele:</b> ${STAPLES.join(", ")}</p>`}
    <p class="muted small">${LIVE?.updated ? `🔥 = preț din oferta/revista curentă (actualizat ${new Date(LIVE.updated).toLocaleDateString("ro-RO")}). Restul sunt estimări.` : "Prețurile sunt estimative (încă nu există o actualizare din reviste)."} Le puteți corecta direct în tabel cu prețul de la raft — se salvează pentru data viitoare.</p>
    ${sections}${othersHtml}
    <div class="row"><button class="primary" id="copy">📋 Copiază lista</button><button class="ghost" onclick="window.print()">🖨️ Printează</button></div>
    <h2>👩‍🍳 Rețete</h2>${recipesHtml}
    <h2>🚀 Dincolo de farfurie</h2><ul class="tips">${tips.map((t) => `<li>${t}</li>`).join("")}</ul>
    <div class="card"><p><b>Vreți schimbări?</b> Adăugați/scoateți rețete, schimbați magazinul sau numărul de zile:</p>
      <div class="row"><button class="ghost" data-go="10">🍽️ Alte rețete</button><button class="ghost" data-go="1">🏪 Alt magazin</button><button class="ghost" data-go="8">🗓️ Alte zile</button><button class="ghost" id="reset">↺ De la zero</button></div></div>
    <p class="muted small">Asta a fost tot! 🎉 Planul e personalizat, dar e bine să vă consultați cu medicul înainte de o schimbare majoră de dietă — sănătatea întâi.</p>`;
}

function listAsText() {
  const plan = buildPlan();
  return Object.entries(SECTIONS).map(([sec, title]) => {
    const ls = plan.lines.filter((l) => l.section === sec);
    if (!ls.length) return "";
    return `${title}\n` + ls.map((l) => `- ${l.product} × ${l.packs}${S.store === "ambele" ? ` [${l.store}]` : ""}`).join("\n");
  }).filter(Boolean).join("\n\n") + (plan.others.length ? `\n\n🧺 Alte ingrediente\n${plan.others.map((o) => "- " + o).join("\n")}` : "") + `\n\nTotal estimat: ${fmt(plan.total)}`;
}

// ---------- Render & evenimente ----------
function render() {
  $("#progress").innerHTML = STEPS.map((s, i) => `<span class="${i === S.step ? "cur" : i < S.step ? "done" : ""}" title="${s}"></span>`).join("");
  $("#stepname").textContent = `Pas ${S.step + 1}/${STEPS.length} · ${STEPS[S.step]}`;
  $("#app").innerHTML = views[S.step]() + (ui.detail && findRecipe(ui.detail) ? detailView(findRecipe(ui.detail)) : "");
  document.body.classList.toggle("noscroll", !!ui.detail);
}

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g && !g.disabled) go(+g.dataset.go);
  const d = e.target.closest("[data-detail]");
  if (d) { e.preventDefault(); ui.detail = d.dataset.detail; render(); return; }
  if (e.target.id === "closeModal" || e.target.id === "modal") { ui.detail = null; render(); return; }
  const tg = e.target.closest("[data-toggle]");
  if (tg) { const id = tg.dataset.toggle; S.chosen = S.chosen.includes(id) ? S.chosen.filter((x) => x !== id) : [...S.chosen, id]; save(); render(); return; }
  const bt = e.target.closest("[data-batch]");
  if (bt) { const id = bt.dataset.batch; S.batches = S.batches || {}; S.batches[id] = Math.max(1, Math.min(6, batchesOf(id) + +bt.dataset.d)); save(); render(); return; }
  if (e.target.id === "more") { ui.showN += 24; render(); return; }
  if (e.target.id === "copy") {
    navigator.clipboard.writeText(listAsText()).then(() => { e.target.textContent = "✅ Copiat!"; });
  }
  if (e.target.id === "autobudget") {
    if (!autoPickForBudget()) alert("Nici cea mai ieftină combinație nu încape în buget — măriți bugetul sau scădeți numărul de zile.");
    save(); render();
  }
  if (e.target.id === "reset" && confirm("Ștergem tot și o luăm de la capăt?")) {
    localStorage.removeItem(STORE_KEY); location.reload();
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.detail) { ui.detail = null; render(); } });

let qTimer;
document.addEventListener("input", (e) => {
  if (e.target.id !== "q") return;
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    ui.q = e.target.value; ui.showN = 24; render();
    const q = $("#q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
  }, 250);
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "q") return;
  if (t.id === "cat") { ui.cat = t.value; ui.showN = 24; render(); return; }
  if (t.classList.contains("tick")) { t.closest("tr").classList.toggle("done", t.checked); return; }
  if (t.classList.contains("price")) { priceOverrides[t.dataset.pid] = +t.value; save(); render(); return; }
  const n = t.name;
  if (!n) return;
  if (n.startsWith("p.")) {
    const k = n.slice(2), p = S.people[S.step - 3];
    p[k] = t.type === "number" || k === "activity" ? +t.value : t.value;
  } else if (n === "allergen" || n === "chosen") {
    const key = n === "allergen" ? "allergens" : "chosen";
    S[key] = t.checked ? [...new Set([...S[key], t.value])] : S[key].filter((x) => x !== t.value);
  } else if (t.type === "checkbox") S[n] = t.checked;
  else if (t.type === "number" || n === "maxTime" || n === "mainsPerDay") S[n] = +t.value;
  else S[n] = t.value;
  // după filtre noi, scoatem rețetele care nu mai sunt eligibile
  if (["diet", "allergen", "dislikes", "maxTime"].includes(n)) {
    const ok = eligibleRecipes().map((r) => r.id);
    S.chosen = S.chosen.filter((id) => ok.includes(id));
  }
  save();
  if (t.type === "radio" || t.type === "checkbox" || t.tagName === "SELECT") render();
});

render();
