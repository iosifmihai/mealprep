// Potrivește ingrediente în engleză (TheMealDB) cu produsele din catalog și traduce numele.
// Ordinea contează: primele potriviri mai specifice.
export const ING_MAP = [
  [/chicken thigh|chicken leg|chicken drum/i, "pulpe_pui"],
  [/chicken/i, "piept_pui"],
  [/turkey/i, "curcan"],
  [/minced beef|ground beef|beef mince|minced meat|ground meat/i, "carne_tocata"],
  [/salmon/i, "somon"],
  [/tuna/i, "ton"],
  [/^eggs?$|egg yolk|egg white|free-range egg/i, "oua"],
  [/greek yogh?urt|yogh?urt/i, "iaurt_grec"],
  [/cottage cheese|ricotta|quark/i, "branza_vaci"],
  [/mozzarella/i, "mozzarella"],
  [/feta/i, "feta"],
  [/parmesan|parmigiano|grana padano/i, "parmezan"],
  [/^milk$|whole milk|semi-skimmed milk|skimmed milk/i, "lapte"],
  [/coconut milk|coconut cream/i, "lapte_cocos"],
  [/rice/i, "orez"],
  [/pasta|penne|spaghetti|fusilli|linguine|tagliatelle|macaroni|rigatoni|farfalle/i, "paste"],
  [/oats|oatmeal|porridge/i, "ovaz"],
  [/lentil/i, "linte"],
  [/chickpea|garbanzo/i, "naut"],
  [/kidney bean|red bean|black bean|cannellini|haricot/i, "fasole"],
  [/chopped tomatoes|canned tomatoes|tinned tomatoes|plum tomatoes|passata|tomato puree/i, "rosii_conserva"],
  [/cherry tomato|tomato/i, "rosii"],
  [/tortilla|wrap/i, "wrap"],
  [/bread|baguette|ciabatta/i, "paine"],
  [/sweet potato/i, "cartofi_dulci"],
  [/potato/i, "cartofi"],
  [/broccoli/i, "broccoli"],
  [/pepper(?!corn)|capsicum/i, "ardei", (n) => !/black pepper|white pepper|cayenne|chilli pepper|pepper flakes|peppercorn/i.test(n) && !/^pepper$/i.test(n)],
  [/spring onion|scallion/i, null],
  [/onion|shallot/i, "ceapa"],
  [/garlic(?! powder)/i, "usturoi"],
  [/cucumber/i, "castraveti"],
  [/spinach/i, "spanac"],
  [/lettuce|salad leaves|rocket|arugula/i, "salata"],
  [/courgette|zucchini/i, "dovlecei"],
  [/carrot/i, "morcovi"],
  [/banana/i, "banane"],
  [/blueberr|raspberr|strawberr|berries/i, "fructe_padure"],
  [/avocado/i, "avocado"],
  [/lemon/i, "lamaie"],
  [/peas/i, "mazare"],
  [/stir.?fry veg|mixed veg|frozen veg/i, "legume_wok"],
  [/peanut butter/i, "unt_arahide"],
  [/soy sauce/i, "sos_soia"],
  [/honey/i, "miere"],
  [/pesto/i, "pesto"],
];

// Ingrediente pe care le considerăm „de bază, avem acasă”
export const STAPLE_RE = /^(salt|pepper|black pepper|olive oil|vegetable oil|sunflower oil|oil|water|sugar|paprika|cumin|oregano|curry powder|garlic powder|ground black pepper|sea salt|cayenne pepper|chilli powder|chili powder|thyme|basil|bay leaf|bay leaves|cinnamon|turmeric|dried oregano|flour|plain flour)$/i;

export function mapIngredient(name) {
  for (const [re, id, guard] of ING_MAP) {
    if (re.test(name) && (!guard || guard(name))) return id;
  }
  return undefined;
}

// Transformă „2 tbsp”, „500g”, „1 lb”, „3” într-o cantitate în unitatea produsului.
const UNIT = { g: 1, gram: 1, grams: 1, kg: 1000, ml: 1, l: 1000, litre: 1000, liter: 1000, tbsp: 15, tblsp: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, cup: 240, cups: 240, lb: 454, lbs: 454, pound: 454, oz: 28, ounce: 28, ounces: 28, pint: 470, can: 400, tin: 400, cans: 400, tins: 400 };
const PIECE_GRAMS = { piept_pui: 180, pulpe_pui: 120, cartofi: 180, cartofi_dulci: 250, rosii: 120, broccoli: 400, dovlecei: 250, morcovi: 80, spanac: 30, salata: 100, somon: 130, carne_tocata: 500, curcan: 200, paine: 40, fructe_padure: 150, mozzarella: 125, feta: 200 };

export function parseMeasure(measure, productId, unit) {
  const m = String(measure || "").toLowerCase().replace(/½/g, ".5").replace(/¼/g, ".25").replace(/¾/g, ".75").trim();
  const frac = m.match(/(\d+)\s*\/\s*(\d+)/);
  let num = frac ? +frac[1] / +frac[2] : parseFloat((m.match(/\d+(\.\d+)?/) || [])[0]);
  if (!isFinite(num)) num = 1;
  const u = (m.match(/[a-z]+/) || [""])[0];
  if (unit === "buc") {
    if (UNIT[u] && u !== "can") return Math.max(0.5, num * UNIT[u] / 100); // grosier
    return num;
  }
  if (UNIT[u]) return num * UNIT[u];
  return num * (PIECE_GRAMS[productId] || 100); // „2” bucăți, „handful” etc.
}

export const RO_NAMES = {
  Chicken: "Pui", Beef: "Vită", Pork: "Porc", Lamb: "Miel", Seafood: "Pește & fructe de mare", Vegetarian: "Vegetarian", Vegan: "Vegan",
  Pasta: "Paste", Breakfast: "Mic dejun", Dessert: "Desert", Side: "Garnitură", Starter: "Aperitiv", Goat: "Capră", Miscellaneous: "Diverse",
};
