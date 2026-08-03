import { chromium } from "playwright";

// Relève les couleurs et les polices **calculées** sur le devis d'origine.
//
// Lancé par `.github/workflows/relever-palette.yml`, sur une machine qui a
// accès au site publié — ce que l'environnement de développement n'a pas.
//
// Deux partis pris qui comptent :
//
// - **On lit ce que le navigateur calcule, pas ce que le CSS déclare.** Une
//   variable surchargée, une règle plus spécifique, une feuille distante :
//   toutes changeraient la couleur sans toucher au `:root`. C'est la couleur à
//   l'écran qui fait foi, puisque c'est elle que le patron regarde.
// - **On cherche la page plutôt que de la supposer.** L'adresse exacte du devis
//   n'est pas connue : on essaie les chemins plausibles, puis on suit les liens
//   de l'accueil. Un relevé fait sur la mauvaise page serait pire que pas de
//   relevé — il donnerait une réponse fausse avec l'autorité d'une mesure.

const BASE = (process.env.BASE || "https://florianmarrins0978-svg.github.io").replace(/\/+$/, "");

/** Les éléments dont la teinte a compté, et ceux qui pourraient compter ensuite. */
const CIBLES = [
  { nom: "intertitre de partie (ÉMETTEUR / CLIENT)", selecteur: ".party h3" },
  { nom: "nom de l'entreprise", selecteur: ".brand-name" },
  { nom: "sous-titre de l'entreprise", selecteur: ".brand-tagline" },
  { nom: "titre du document (DEVIS)", selecteur: ".doc-title h1" },
  { nom: "étiquette des références (Devis n°)", selecteur: ".doc-meta label" },
  { nom: "en-tête de colonne (DESCRIPTION)", selecteur: "thead th" },
  { nom: "intertitre de bloc (NOTES / CONDITIONS)", selecteur: ".notes label" },
  { nom: "total final (Total TTC)", selecteur: ".total-final" },
  { nom: "mention légale", selecteur: ".doc-footer .legal" },
  { nom: "légende de signature", selecteur: ".signature p" },
  { nom: "papier", selecteur: ".page" },
  { nom: "texte saisi", selecteur: ".party.editable input" },
  { nom: "fond d'un champ", selecteur: ".party.editable input" },
];

/** `rgb(178, 90, 46)` → `#b25a2e`, pour que la comparaison soit lisible. */
function enHexa(couleur) {
  const m = String(couleur).match(/rgba?\(([^)]+)\)/);
  if (!m) return couleur;
  const [r, v, b] = m[1].split(",").map((n) => Math.round(parseFloat(n)));
  return `#${[r, v, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const navigateur = await chromium.launch();
const page = await navigateur.newPage();

// ─── Trouver le devis ───────────────────────────────────────────────────────
const candidats = [
  `${BASE}/devis-modele.html`,
  `${BASE}/devis.html`,
  `${BASE}/Atlas-app/devis-modele.html`,
  `${BASE}/`,
];

let trouvee = null;
const journal = [];

for (const url of candidats) {
  try {
    const reponse = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const code = reponse ? reponse.status() : 0;
    // La bonne page est celle qui porte les deux colonnes du devis. Un simple
    // 200 ne suffit pas : un site sans page 404 renvoie 200 sur n'importe quoi.
    const estDevis = (await page.locator(".party h3").count()) > 0;
    journal.push(`${code}  ${estDevis ? "devis" : "autre"}  ${url}`);
    if (code === 200 && estDevis) {
      trouvee = url;
      break;
    }
  } catch (e) {
    journal.push(`err       ${url} — ${e.message.split("\n")[0]}`);
  }
}

// Rien parmi les chemins essayés : suivre les liens de l'accueil.
if (!trouvee) {
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const liens = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /devis/i.test(h))
    );
    journal.push(`liens « devis » trouvés sur l'accueil : ${liens.length ? liens.join(", ") : "aucun"}`);
    for (const lien of liens) {
      await page.goto(lien, { waitUntil: "domcontentloaded", timeout: 30000 });
      if ((await page.locator(".party h3").count()) > 0) {
        trouvee = lien;
        break;
      }
    }
  } catch (e) {
    journal.push(`accueil injoignable — ${e.message.split("\n")[0]}`);
  }
}

console.log("=== Ce qui a été essayé ===");
for (const l of journal) console.log(`  ${l}`);

if (!trouvee) {
  console.error("\n❌ Aucune page de devis trouvée sous " + BASE);
  console.error("   Rien n'est relevé : mieux vaut pas de mesure qu'une mesure prise ailleurs.");
  await navigateur.close();
  process.exit(1);
}

console.log(`\n=== Page relevée ===\n  ${trouvee}\n`);

// Les polices s'affichent le temps de se charger : sans cette attente, on
// relèverait la police de repli et non celle du modèle.
await page.waitForLoadState("networkidle").catch(() => {});
try {
  await page.evaluate(() => document.fonts.ready);
} catch {
  /* navigateur sans l'API : on relève quand même le reste */
}

// ─── Ce que le navigateur calcule ───────────────────────────────────────────
const releve = await page.evaluate((cibles) => {
  return cibles.map(({ nom, selecteur }) => {
    const el = document.querySelector(selecteur);
    if (!el) return { nom, selecteur, absent: true };
    const s = getComputedStyle(el);
    return {
      nom,
      selecteur,
      couleur: s.color,
      fond: s.backgroundColor,
      police: s.fontFamily,
      graisse: s.fontWeight,
      corps: s.fontSize,
      approche: s.letterSpacing,
      casse: s.textTransform,
    };
  });
}, CIBLES);

console.log("=== Couleurs et polices calculées ===");
for (const r of releve) {
  if (r.absent) {
    console.log(`  ${r.nom}\n      absent de la page (${r.selecteur})`);
    continue;
  }
  console.log(`  ${r.nom}  [${r.selecteur}]`);
  console.log(`      texte   ${enHexa(r.couleur)}   fond ${enHexa(r.fond)}`);
  console.log(
    `      police  ${r.police}  ${r.graisse}  ${r.corps}  approche ${r.approche}  casse ${r.casse}`
  );
}

// ─── Les variables déclarées, pour comparer avec la copie du dépôt ──────────
const variables = await page.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  const noms = [
    "--cream", "--paper", "--paper-warm", "--forest-deep", "--forest", "--forest-mid",
    "--sage", "--sage-light", "--clay", "--clay-light", "--ink", "--rust",
  ];
  const trouvees = {};
  for (const n of noms) {
    const v = s.getPropertyValue(n).trim();
    if (v) trouvees[n] = v;
  }
  return trouvees;
});

console.log("\n=== Variables déclarées sur :root ===");
const entrees = Object.entries(variables);
if (entrees.length === 0) console.log("  aucune");
for (const [n, v] of entrees) console.log(`  ${n.padEnd(16)} ${v}`);

// Le titre et l'ordre des blocs : de quoi voir si la structure elle-même
// diffère de la copie, et pas seulement ses couleurs.
const structure = await page.evaluate(() =>
  [...document.querySelectorAll(".page > *")].map((el) => el.className || el.tagName.toLowerCase())
);
console.log("\n=== Blocs de la page, dans l'ordre ===");
for (const b of structure) console.log(`  ${b}`);

await navigateur.close();
console.log("\n✅ Relevé terminé.");
