// Citește ofertele/revistele Lidl și Kaufland și actualizează data/prices.json.
// Rulează zilnic din GitHub Actions. Produsele negăsite în oferte rămân cu prețul din data.js.
//
// Strategie (defensivă, pentru că site-urile își schimbă structura):
//  1. Descarcă paginile de catalog/oferte și caută date de produs (JSON încorporat, JSON-LD, plăci de produs).
//  2. Găsește identificatorii revistelor și încearcă API-ul de reviste (leaflets.schwarz, folosit de ambele).
//  3. Potrivește fiecare ofertă cu produsele noastre după cuvinte cheie + gramaj și verifică dacă prețul e plauzibil.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { loadCatalog } from "./load-catalog.mjs";

const { PRODUCTS } = loadCatalog();
const OUT = new URL("../data/prices.json", import.meta.url);
const DEBUG_DIR = new URL("../data/debug/", import.meta.url);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const SOURCES = {
  lidl: [
    "https://www.lidl.ro/c/cataloage-online/s10019911",
    "https://www.lidl.ro/c/oferte-saptamana-aceasta/a10023711",
    "https://www.lidl.ro/",
  ],
  kaufland: [
    "https://www.kaufland.ro/cataloage-cu-reduceri.html",
    "https://www.kaufland.ro/oferte/oferte-saptamanale/saptamana-curenta.html",
    "https://www.kaufland.ro/oferte/oferte-saptamanale/saptamana-urmatoare.html",
  ],
};

// Cuvinte cheie (fără diacritice) care TREBUIE să apară în titlul ofertei + cuvinte care o exclud.
const KEYWORDS = {
  piept_pui: [["piept", "pui"], ["afumat", "snitel", "pane", "crud-uscat"]],
  pulpe_pui: [["pulpe", "pui"], ["afumat", "pane"]],
  carne_tocata: [["carne tocata"], ["porc", "pui", "mici"]],
  curcan: [["curcan"], ["sunca", "parizer", "afumat", "crenvursti"]],
  somon: [["somon"], ["afumat", "salata", "pate"]],
  ton: [["ton"], ["salata", "pate", "tonic"]],
  oua: [["oua"], ["ciocolata", "kinder", "paste cu"]],
  iaurt_grec: [["iaurt", "grec"], ["bautura", "zmeura", "capsuni", "fructe", "piersic", "vanilie", "cirese", "mango", "afine", "caise"]],
  branza_vaci: [["branza", "vaci"], []],
  mozzarella: [["mozzarella"], ["pizza", "stick"]],
  feta: [["feta"], []],
  lapte: [["lapte"], ["ciocolata", "praf", "cocos", "condensat", "bautura", "orez", "migdale", "ovaz", "soia", "corp"]],
  parmezan: [["parmez"], ["paste", "mezzelune", "ravioli", "tortelloni", "sos"]],
  orez: [["orez"], ["lapte", "faina", "biscuiti", "rondele", "tort"]],
  paste: [["paste"], ["dinti", "tomate", "ardei", "sos", "pasta de"]],
  ovaz: [["ovaz"], ["lapte", "bautura", "biscuiti", "batoane"]],
  linte: [["linte"], []],
  naut: [["naut"], ["hummus"]],
  fasole: [["fasole"], ["verde", "pastai", "cu carnati", "iahnie"]],
  rosii_conserva: [["rosii", "conserva"], []],
  lapte_cocos: [["lapte", "cocos"], []],
  wrap: [["tortilla"], ["chips", "nachos"]],
  paine: [["paine"], ["prajita", "pesmet"]],
  cartofi: [["cartofi"], ["dulci", "chips", "pai", "prajiti", "congelati", "wedges", "piure"]],
  cartofi_dulci: [["cartofi dulci"], []],
  broccoli: [["broccoli"], []],
  ardei: [["ardei"], ["pasta", "zacusca", "umplut", "iute", "boia", "copt"]],
  ceapa: [["ceapa"], ["verde", "rondele", "praf"]],
  usturoi: [["usturoi"], ["praf", "granulat", "sos"]],
  rosii: [["rosii"], ["mere", "ardei", "ceapa", "struguri", "fasole", "conserva", "pasta", "suc", "uscate", "sos", "bulion", "pasata", "tocate", "decojite"]],
  castraveti: [["castrave"], ["muraturi", "murati", "otet"]],
  spanac: [["spanac"], ["congelat", "placinta"]],
  salata: [["salata"], ["boeuf", "vinete", "icre", "ton", "beuf", "dressing", "de pui"]],
  dovlecei: [["dovlec"], ["placinta"]],
  morcovi: [["morcov"], ["suc"]],
  banane: [["banane"], ["chips", "uscate"]],
  fructe_padure: [["fructe de padure"], ["iaurt", "gem", "ceai", "suc", "biscuiti"]],
  avocado: [["avocado"], []],
  lamaie: [["lamai"], ["suc", "limonada", "aroma"]],
  mazare: [["mazare"], []],
  legume_wok: [["wok"], []],
  unt_arahide: [["unt", "arahide"], []],
  sos_soia: [["sos", "soia"], []],
  miere: [["miere"], ["bomboane", "turta"]],
  pesto: [["pesto"], []],
};

// Greutate medie pe bucată, pentru produse vândute la kg dar numărate la bucată în catalog
const GRAMS_PER_PIECE = { ardei: 200, ceapa: 125, lamaie: 125, avocado: 200, banane: 170, castraveti: 350, usturoi: 5 };

// Excluse peste tot (dacă nu fac parte chiar din cuvintele cheie ale produsului)
const GLOBAL_NOT = ["hrana", "pisici", "pisica", "caini", "caine", "pinsa", "pizza", "sunca", "salam", "baton", "chips", "snack", "biscuiti", "napolitane", "ciocolata", "inghetata", "cremvursti", "crenvursti", "parizer", "pateu", "aroma", "sampon", "detergent", "sapun", "jucarie"];

const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.,%]+/g, " ").replace(/\s+/g, " ").trim();
// poziția (în cuvinte) unde începe expresia `kw` ca început de cuvânt; -1 dacă lipsește
function wordPos(t, kw) {
  const m = (" " + t).match(new RegExp(" " + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  return m ? (" " + t).slice(0, m.index).split(" ").length - 1 : -1;
}

async function fetchText(url, accept = "text/html") {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "ro-RO,ro;q=0.9" } });
      if (r.ok) return await r.text();
      console.warn(`  ${r.status} ${url}`);
      if (r.status === 404) return "";
    } catch (e) { console.warn(`  eroare ${url}: ${e.message}`); }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return "";
}

// Gramaj din titlu: „500 g”, „1 kg”, „1,5 l”, „10 buc”, „3x80g”
export function parsePack(title) {
  const t = norm(title).replace(/,/g, ".");
  const multi = t.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(g|ml|kg|l)\b/);
  if (multi) { const f = { g: 1, ml: 1, kg: 1000, l: 1000 }[multi[3]]; return { qty: +multi[1] * +multi[2] * f, unit: /m?l$/.test(multi[3]) ? "ml" : "g" }; }
  const m = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|l|buc|bucati)\b/);
  if (!m) {
    if (/(^| )(per )?kg( |$)/.test(t)) return { qty: 1000, unit: "g" };
    if (/(^| )(per )?(buc|bucata)( |$)/.test(t)) return { qty: 1, unit: "buc" };
    return null;
  }
  const n = +m[1], u = m[2];
  if (u === "kg") return { qty: n * 1000, unit: "g" };
  if (u === "g" || u === "gr") return { qty: n, unit: "g" };
  if (u === "l") return { qty: n * 1000, unit: "ml" };
  if (u === "ml") return { qty: n, unit: "ml" };
  return { qty: n, unit: "buc" };
}

const parsePrice = (v) => {
  if (typeof v === "number") return v;
  const m = String(v ?? "").replace(/\s/g, "").match(/(\d+)[.,](\d{1,2})|(\d+)/);
  if (!m) return NaN;
  return m[3] ? +m[3] : +`${m[1]}.${m[2]}`;
};

// Caută recursiv în orice JSON obiecte care arată a produs (titlu + preț)
function collectFromJson(node, out, depth = 0) {
  if (!node || depth > 40) return;
  if (Array.isArray(node)) { node.forEach((n) => collectFromJson(n, out, depth + 1)); return; }
  if (typeof node !== "object") return;
  const title = node.fullTitle || node.title || node.name || node.productName || node.headline;
  let price = node.price ?? node.currentPrice ?? node.salesPrice ?? node.offers?.price ?? node.priceValue;
  if (price && typeof price === "object") price = price.price ?? price.value ?? price.amount;
  const p = parsePrice(price);
  if (typeof title === "string" && title.length < 160 && isFinite(p) && p > 0 && p < 2000) {
    const extra = [node.subtitle, node.description, node.quantity, node.packaging, node.unit, node.basePrice?.text, node.price?.packaging?.text].filter((x) => typeof x === "string").join(" ");
    out.push({ title: `${title} ${extra}`.trim(), price: p });
  }
  for (const v of Object.values(node)) if (v && typeof v === "object") collectFromJson(v, out, depth + 1);
}

function decodeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function extractOffers(html) {
  const out = [];
  // JSON-LD și <script type="application/json">
  for (const m of html.matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { collectFromJson(JSON.parse(m[1]), out); } catch {}
  }
  // __NEXT_DATA__ / __NUXT__ / window.__INITIAL_STATE__
  for (const m of html.matchAll(/(?:__NEXT_DATA__|__INITIAL_STATE__|__NUXT__)[^{]*({[\s\S]*?})\s*(?:;|<\/script>)/g)) {
    try { collectFromJson(JSON.parse(m[1]), out); } catch {}
  }
  // atribute data-* cu JSON (ex. Lidl: data-grid-data)
  for (const m of html.matchAll(/data-[a-z-]+="(\{[^"]{20,}\}|\[[^"]{20,}\])"/g)) {
    try { collectFromJson(JSON.parse(decodeHtml(m[1])), out); } catch {}
  }
  // plăci de produs HTML (Kaufland: k-product-tile)
  for (const m of html.matchAll(/class="(?:[^"]*\s)?[\w-]*product-tile(?:\s[^"]*)?"[\s\S]{0,3000}?(?=class="(?:[^"]*\s)?[\w-]*product-tile(?:\s[^"]*)?"|$)/g)) {
    const block = m[0];
    const title = [...block.matchAll(/class="[^"]*(?:title|subtitle|quantity|unit)[^"]*"[^>]*>([^<]+)</g)].map((x) => x[1].trim()).join(" ");
    const price = block.match(/class="[^"]*price[^"]*"[^>]*>\s*([\d.,]+)\s*</);
    if (title && price) out.push({ title: decodeHtml(title), price: parsePrice(price[1]) });
  }
  return out;
}

function findLeafletIds(html) {
  const ids = new Set();
  for (const m of html.matchAll(/(?:flyer_identifier=|\/cataloage\/|leaflets\.kaufland\.com\/[a-z]{2}-[A-Z]{2}\/|\/view\/flyer\/)([A-Za-z0-9_-]{6,})/g)) ids.add(m[1]);
  return [...ids].filter((x) => !/^(view|page|flyer)$/.test(x)).slice(0, 6);
}

async function fromLeafletApi(id) {
  const urls = [
    `https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${encodeURIComponent(id)}&region_id=0&region_code=0`,
    `https://endpoints.leaflets.schwarz/v3/flyer?flyer_identifier=${encodeURIComponent(id)}`,
  ];
  for (const u of urls) {
    const txt = await fetchText(u, "application/json");
    if (!txt) continue;
    try { const out = []; collectFromJson(JSON.parse(txt), out); if (out.length) return out; } catch {}
  }
  return [];
}

export function matchOffers(store, offers) {
  const result = {};
  for (const [id, [must, not]] of Object.entries(KEYWORDS)) {
    const base = PRODUCTS[id][store];
    const unit = PRODUCTS[id].unit;
    const baseUnitPrice = base.price / base.pack;
    let best = null;
    for (const o of offers) {
      const t = norm(o.title);
      const pos = must.map((w) => wordPos(t, w));
      if (pos.some((x) => x < 0) || Math.min(...pos) > 4) continue; // produsul trebuie numit la începutul titlului
      if (not.some((w) => wordPos(t, w) >= 0)) continue;
      if (GLOBAL_NOT.some((w) => !must.some((m) => m.includes(w)) && wordPos(t, w) >= 0)) continue;
      const pack = parsePack(o.title);
      let unitPrice;
      if (pack && (pack.unit === unit || (unit !== "buc" && pack.unit !== "buc"))) unitPrice = o.price / pack.qty;
      else if (pack && unit === "buc" && pack.unit === "g" && GRAMS_PER_PIECE[id]) unitPrice = o.price / (pack.qty / GRAMS_PER_PIECE[id]);
      else if (pack) continue; // unități incompatibile (ex. „avocado 700 g” vs. bucăți)
      else unitPrice = o.price / base.pack; // fără gramaj: presupunem același ambalaj
      const ratio = unitPrice / baseUnitPrice;
      if (ratio < 0.35 || ratio > 2.5) continue; // potrivire suspectă
      if (!best || unitPrice < best.unitPrice) best = { unitPrice, offer: o, pack };
    }
    if (best) {
      result[id] = {
        price: Math.round(best.unitPrice * base.pack * 100) / 100, // prețul pentru ambalajul nostru
        offerTitle: best.offer.title.slice(0, 120),
        offerPrice: best.offer.price,
        promo: true,
      };
    }
  }
  return result;
}

async function scrapeStore(store) {
  const offers = [];
  const leafletIds = new Set();
  for (const url of SOURCES[store]) {
    const html = await fetchText(url);
    console.log(`  ${store}: ${url} -> ${html.length} caractere`);
    if (!html) continue;
    if (process.env.DEBUG_HTML) { mkdirSync(DEBUG_DIR, { recursive: true }); writeFileSync(new URL(`${store}-${offers.length}.html`, DEBUG_DIR), html); }
    offers.push(...extractOffers(html));
    findLeafletIds(html).forEach((id) => leafletIds.add(id));
  }
  for (const id of leafletIds) {
    const o = await fromLeafletApi(id);
    console.log(`  ${store}: revista ${id} -> ${o.length} produse`);
    offers.push(...o);
  }
  return { offers, leafletIds: [...leafletIds] };
}

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { stores: {} };
  const out = { updated: new Date().toISOString(), stores: {}, stats: {} };
  for (const store of ["lidl", "kaufland"]) {
    console.log(`== ${store}`);
    const { offers, leafletIds } = await scrapeStore(store);
    const matched = matchOffers(store, offers);
    out.stores[store] = matched;
    out.stats[store] = { offersFound: offers.length, matched: Object.keys(matched).length, leaflets: leafletIds };
    console.log(`  ${store}: ${offers.length} oferte găsite, ${Object.keys(matched).length} potrivite cu catalogul`);
    if (!offers.length && prev.stores?.[store]) {
      console.warn(`  ${store}: nu am găsit nimic azi — păstrez prețurile de ieri`);
      out.stores[store] = prev.stores[store];
      out.stats[store].keptPrevious = true;
    }
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log("Scris data/prices.json");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
