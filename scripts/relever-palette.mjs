import { chromium } from "playwright";

// Relève les couleurs et les polices **calculées** sur une ou plusieurs pages
// publiées, et les met en regard.
//
// Lancé par `.github/workflows/relever-palette.yml`, sur une machine qui a
// accès aux sites publiés — ce que l'environnement de développement n'a pas
// (`403 à CONNECT — policy denial` sur `github.io`).
//
// Trois partis pris qui comptent :
//
// - **On lit ce que le navigateur calcule, pas ce que le CSS déclare.** Une
//   variable surchargée, une règle plus spécifique, une feuille distante :
//   toutes changeraient la couleur sans toucher au `:root`. C'est la couleur à
//   l'écran qui fait foi, puisque c'est elle que le patron regarde.
// - **On récolte TOUTES les variables déclarées, sans en connaître les noms.**
//   Une première version interrogeait une liste écrite à la main : elle aurait
//   manqué en silence toute variable absente de cette liste — c'est-à-dire
//   précisément celle qui explique un écart qu'on ne comprend pas.
// - **On compare plusieurs pages dans une même exécution.** Deux sites publiés
//   côte à côte se répondent : c'est le seul moyen de dire *ce qui* diffère,
//   au lieu de constater que quelque chose diffère.

// Les deux sites à mettre en regard. Ils vivent ici, et non dans le workflow :
// une longue valeur par défaut dans un `workflow_dispatch` a fait refuser le
// fichier au démarrage, sans qu'aucun job ne soit créé ni aucun journal écrit.
// La liste appartient de toute façon à la logique de comparaison.
const PAR_DEFAUT = [
  "https://florianmarrins0978-svg.github.io/Arborea-/devis-modele.html",
  "https://florianmarrins0978-svg.github.io/Atlas-app/devis-modele.html",
  "https://florianmarrins0978-svg.github.io/Arborea-/app.html",
  "https://florianmarrins0978-svg.github.io/Atlas-app/app.html",
];

const demandees = (process.env.PAGES || "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const PAGES = demandees.length > 0 ? demandees : PAR_DEFAUT;

/** `rgb(178, 90, 46)` → `#b25a2e`, pour que la comparaison soit lisible. */
function enHexa(couleur) {
  const m = String(couleur).match(/rgba?\(([^)]+)\)/);
  if (!m) return String(couleur);
  const [r, v, b] = m[1].split(",").map((n) => Math.round(parseFloat(n)));
  return `#${[r, v, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const navigateur = await chromium.launch();
const releves = [];

for (const url of PAGES) {
  const page = await navigateur.newPage();
  const releve = { url };
  try {
    const reponse = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    releve.code = reponse ? reponse.status() : 0;
    if (releve.code !== 200) {
      releves.push(releve);
      await page.close();
      continue;
    }

    // Les polices web s'affichent le temps de se charger : sans cette attente,
    // on relèverait la police de repli et non celle de la page.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    // Toutes les variables déclarées, quels que soient leurs noms. On lit les
    // feuilles de style plutôt que d'interroger des noms devinés.
    releve.variables = await page.evaluate(() => {
      const trouvees = {};
      for (const feuille of document.styleSheets) {
        let regles;
        try {
          regles = feuille.cssRules;
        } catch {
          continue; // feuille distante non lisible : on passe, sans mentir dessus
        }
        for (const regle of regles) {
          if (!regle.style || !regle.selectorText) continue;
          for (const propriete of regle.style) {
            if (propriete.startsWith("--")) {
              trouvees[propriete] = regle.style.getPropertyValue(propriete).trim();
            }
          }
        }
      }
      return trouvees;
    });

    releve.titre = await page.title();

    // Ce que la page montre réellement, sur ce qu'elle contient.
    releve.elements = await page.evaluate(() => {
      const CIBLES = [
        ["fond de page", "body"],
        ["carte / feuille", ".page, .card, main"],
        ["premier titre", "h1"],
        ["intertitre de partie", ".party h3"],
        ["en-tête de colonne", "thead th"],
        ["bouton principal", "button, .btn-print, .btn"],
        ["lien", "a"],
      ];
      return CIBLES.map(([nom, selecteur]) => {
        const el = document.querySelector(selecteur);
        if (!el) return { nom, absent: true };
        const s = getComputedStyle(el);
        return {
          nom,
          couleur: s.color,
          fond: s.backgroundColor,
          police: s.fontFamily,
          corps: s.fontSize,
        };
      });
    });
  } catch (e) {
    releve.erreur = e.message.split("\n")[0];
  }
  releves.push(releve);
  await page.close();
}

await navigateur.close();

// ─── Rapport ────────────────────────────────────────────────────────────────
for (const r of releves) {
  console.log(`\n${"═".repeat(76)}`);
  console.log(`  ${r.url}`);
  if (r.erreur) {
    console.log(`  ❌ injoignable — ${r.erreur}`);
    continue;
  }
  if (r.code !== 200) {
    console.log(`  ❌ code HTTP ${r.code} — rien relevé`);
    continue;
  }
  console.log(`  « ${r.titre} »`);
  console.log(`${"═".repeat(76)}`);

  console.log("\n  Variables déclarées");
  const noms = Object.keys(r.variables).sort();
  if (noms.length === 0) console.log("    aucune");
  for (const n of noms) console.log(`    ${n.padEnd(20)} ${r.variables[n]}`);

  console.log("\n  Ce que la page affiche");
  for (const e of r.elements) {
    if (e.absent) continue;
    console.log(`    ${e.nom.padEnd(24)} texte ${enHexa(e.couleur)}  fond ${enHexa(e.fond)}  ${e.police}`);
  }
}

// ─── Ce qui diffère, nommément ──────────────────────────────────────────────
const lisibles = releves.filter((r) => r.variables);
if (lisibles.length >= 2) {
  console.log(`\n${"═".repeat(76)}`);
  console.log("  CE QUI DIFFÈRE ENTRE LES DEUX PAGES");
  console.log(`${"═".repeat(76)}\n`);
  const tous = [...new Set(lisibles.flatMap((r) => Object.keys(r.variables)))].sort();
  let ecarts = 0;
  for (const n of tous) {
    const valeurs = lisibles.map((r) => r.variables[n] ?? "(absente)");
    if (new Set(valeurs).size > 1) {
      ecarts++;
      console.log(`  ${n}`);
      lisibles.forEach((r, i) => console.log(`      ${valeurs[i].padEnd(14)} ${r.url}`));
    }
  }
  console.log(ecarts === 0 ? "  Aucun écart de variable." : `\n  ${ecarts} variable(s) divergente(s).`);
}

console.log("\n✅ Relevé terminé.");
