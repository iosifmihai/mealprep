// Potrivește ingrediente în engleză (TheMealDB) cu produsele din catalog și traduce numele.
// Ordinea contează: primele potriviri mai specifice.
export const ING_MAP = [
  [/stock|broth|bouillon/i, "supa"],
  [/peanut butter/i, "unt_arahide"],
  [/coconut milk|coconut cream/i, "lapte_cocos"],
  [/cream cheese|mascarpone|philadelphia/i, "crema_branza"],
  [/ice cream/i, null],
  [/sour cream|double cream|heavy cream|single cream|whipping cream|creme fraiche|crème fraîche|^cream$/i, "smantana"],
  [/butter/i, "unt"],
  [/black.?eyed|borlotti|pinto/i, "fasole"],
  [/green beans|french beans|runner beans/i, "fasole_verde"],
  [/fish sauce|oyster sauce/i, "sos_peste"],
  [/prawn|shrimp/i, "creveti"],
  [/lamb/i, "miel"],
  [/bacon|pancetta|lardons/i, "bacon"],
  [/chorizo|sausage/i, "carnati"],
  [/pork/i, "porc"],
  [/chicken thigh|chicken leg|chicken drum/i, "pulpe_pui"],
  [/chicken/i, "piept_pui"],
  [/turkey/i, "curcan"],
  [/minced beef|ground beef|beef mince|minced meat|ground meat/i, "carne_tocata"],
  [/beef|steak|brisket/i, "carne_vita"],
  [/salmon/i, "somon"],
  [/tuna/i, "ton"],
  [/^eggs?$|egg yolk|egg white|free-range egg/i, "oua"],
  [/greek yogh?urt|yogh?urt/i, "iaurt_grec"],
  [/cottage cheese|ricotta|quark/i, "branza_vaci"],
  [/mozzarella/i, "mozzarella"],
  [/feta/i, "feta"],
  [/parmesan|parmigiano|grana padano/i, "parmezan"],
  [/cheddar|gruy[eè]re|emmental|gouda|monterey|grated cheese|^cheese$|cheese slices/i, "cascaval"],
  [/^milk$|whole milk|semi-skimmed milk|skimmed milk/i, "lapte"],
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
  [/spring onion|scallion|green onion|chives/i, "ceapa_verde"],
  [/chilli|chili|jalapeno|scotch bonnet|bird.?s eye/i, "ardei_iute"],
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
  [/^limes?$|lime juice|lime zest/i, "lime"],
  [/^oranges?$|orange juice|orange zest/i, "portocale"],
  [/ginger/i, "ghimbir"],
  [/parsley|coriander|cilantro|dill|mint|basil|rosemary|fresh thyme|tarragon/i, "verdeata"],
  [/mushroom/i, "ciuperci"],
  [/celery/i, "telina"],
  [/leek/i, "praz"],
  [/cabbage/i, "varza"],
  [/aubergine|eggplant|egg plant/i, "vinete"],
  [/sweetcorn|sweet corn|^corn$|corn kernels/i, "porumb"],
  [/mustard/i, "mustar"],
  [/mayonnaise/i, "maioneza"],
  [/almond|walnut|peanut|cashew|pecan|hazelnut|pistachio/i, "nuci"],
  [/peas/i, "mazare"],
  [/stir.?fry veg|mixed veg|frozen veg/i, "legume_wok"],
  [/soy sauce/i, "sos_soia"],
  [/honey/i, "miere"],
  [/pesto/i, "pesto"],
];

// Ingrediente pe care le considerăm „de bază, avem acasă”
export const STAPLE_RE = new RegExp("^(" + [
  "(kosher |sea |table )?salt", "(ground |black |white )*pepper(corns)?", "(extra virgin |light )?olive oil", "vegetable oil", "sunflower oil", "canola oil", "oil", "water", "ice", "boiling water",
  "(caster |brown |granulated |icing |powdered |muscovado |white |demerara |light brown |dark brown )?sugar", "honey syrup",
  "(plain |all purpose |all-purpose |self-raising |self raising |strong white bread |bread |corn |rice |wholemeal )?flour", "cornstarch", "cornflour", "corn starch",
  "baking powder", "bicarbonate of soda", "baking soda", "(dried |fast action |active dry )?yeast", "vanilla( extract| essence| pod)?", "almond extract",
  "(smoked |sweet )?paprika", "(ground )?cumin( seeds)?", "(dried )?oregano", "curry powder", "garlic powder", "onion powder", "cayenne( pepper)?", "chil+i powder", "chil+i flakes", "red pepper flakes",
  "(dried )?thyme", "dried basil", "bay leaf", "bay leaves", "(ground )?cinnamon", "cinnamon stick", "(ground )?turmeric", "(ground )?nutmeg", "(ground )?allspice", "(ground )?cloves",
  "(ground )?cardamom", "cardamom pods", "saffron", "garam masala", "ground coriander", "coriander seeds", "ground ginger", "mustard seeds", "fennel seeds", "star anise", "mixed spice", "(dried )?mixed herbs", "italian seasoning", "harissa spice",
  "(white |red |white wine |red wine |cider |apple cider |rice |balsamic )?vinegar", "tomato ketchup", "ketchup", "hotsauce", "hot sauce", "worcestershire sauce", "sesame seed oil", "sesame oil", "sesame seeds?",
].join("|") + ")$", "i");

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
