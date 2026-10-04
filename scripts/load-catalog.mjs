// Încarcă data.js (scris pentru browser) în Node, fără să-l duplicăm.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadCatalog() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../data.js", import.meta.url), "utf8") + ";this.PRODUCTS=PRODUCTS;this.RECIPES=RECIPES;this.SECTIONS=SECTIONS;", ctx);
  return { PRODUCTS: ctx.PRODUCTS, RECIPES: ctx.RECIPES, SECTIONS: ctx.SECTIONS };
}
