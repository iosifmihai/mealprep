# 🥗 Meal Prep pentru 2

Site static (HTML/CSS/JS, fără server) care vă ghidează pas cu pas:

1. Alegeți magazinul: **Lidl**, **Kaufland** sau „cel mai ieftin” (alege pe fiecare produs).
2. Dietă + obiectiv, apoi datele fiecărei persoane → calcul TDEE și macronutrienți (Mifflin-St Jeor).
3. Alergii, ce (nu) vă place, timp de gătit, zile, mese, buget.
4. Alegeți rețetele din lista filtrată.
5. Primiți planul pe zile, porțiile ajustate pe persoană, lista de cumpărături pe raioane cu produse și cost estimat, rețetele și sfaturi.

Deschideți `index.html` în browser. Progresul și prețurile corectate se salvează local.

## Rețete
- Câteva sute de rețete internaționale cu **poză, instrucțiuni complete și video YouTube** din [TheMealDB](https://www.themealdb.com) traduse automat în română (cache în `data/translations-ro.json`), salvate în `data/recipes-online.json`. Dacă fișierul lipsește, site-ul le citește direct din TheMealDB.

## Cost
Fiecare rețetă aleasă se gătește o dată (~4 porții = 2 mese pentru 2 persoane); cu ＋ o gătiți de mai multe ori. Totalul e ce plătiți la casă pe pachete întregi.

## Actualizare zilnică (GitHub Actions → Vercel)
`.github/workflows/daily-update.yml` rulează zilnic (~07:17 ora României) și manual din **Actions → Run workflow**:
1. `scripts/update-prices.mjs` citește ofertele/revistele Lidl și Kaufland și scrie `data/prices.json` (în listă apar cu 🔥).
2. `scripts/update-recipes.mjs` reîmprospătează rețetele TheMealDB.
3. Dacă ceva s-a schimbat, face commit → Vercel republică automat site-ul.

GitHub rulează programările doar din **branch-ul principal** (default) al repo-ului.
Revistele conțin doar produsele din ofertă; restul rămân cu prețurile estimate din `data.js`, corectabile din tabel.
Depanare: `DEBUG_HTML=1 node scripts/update-prices.mjs` salvează paginile în `data/debug/`.

## Vercel
Import repo pe vercel.com → Framework Preset **Other** → Deploy. Nu e nevoie de build.

## Fișiere
- `data.js` — catalog produse (Lidl/Kaufland) și rețete
- `app.js` — wizard, calcule, plan, listă
- `online.js` — încarcă prețurile din oferte și rețetele online
- `scripts/` — actualizarea zilnică (prețuri, rețete)
- `style.css` — stil (light/dark, mobil)
