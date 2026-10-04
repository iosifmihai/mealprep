# 🥗 Meal Prep pentru 2

Site static (HTML/CSS/JS, fără server) care vă ghidează pas cu pas:

1. Alegeți magazinul: **Lidl**, **Kaufland** sau „cel mai ieftin” (alege pe fiecare produs).
2. Dietă + obiectiv, apoi datele fiecărei persoane → calcul TDEE și macronutrienți (Mifflin-St Jeor).
3. Alergii, ce (nu) vă place, timp de gătit, zile, mese, buget.
4. Alegeți rețetele din lista filtrată.
5. Primiți planul pe zile, porțiile ajustate pe persoană, lista de cumpărături pe raioane cu produse și cost estimat, rețetele și sfaturi.

Deschideți `index.html` în browser. Progresul și prețurile corectate se salvează local.

## Despre prețuri
Lidl și Kaufland nu au API public, iar un site static nu poate citi direct paginile lor. Produsele și prețurile sunt într-un catalog în `data.js` (estimative) și pot fi corectate direct din tabelul listei. Pentru prețuri live ar trebui un mic backend care să le actualizeze periodic.

## Fișiere
- `data.js` — catalog produse (Lidl/Kaufland) și rețete
- `app.js` — wizard, calcule, plan, listă
- `style.css` — stil (light/dark, mobil)
