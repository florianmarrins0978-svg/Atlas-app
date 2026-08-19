/**
 * Combien de gestes, combien de mots — l'application parcourue pour de bon.
 *
 * **Pourquoi ce script existe.** Le 19 août 2026, le patron dit pour la
 * troisième fois que l'application est trop chargée. Les deux fois précédentes,
 * un écran a été corrigé au jugé et la plainte est revenue ailleurs. Un
 * dépouillement décidé sans mesure recommence la même erreur : on retire ce
 * qu'on croit lourd, pas ce qui l'est.
 *
 * Ce que ce script rend est donc une matière première, pas un verdict — c'est
 * l'œil qui juge, et les captures sont là pour ça (`CLAUDE.md` §5).
 *
 * **Il suppose un serveur en écoute et le jeu de démonstration frais.** Un
 * chantier laissé par une exécution précédente change le compte de l'accueil,
 * et deux mesures cesseraient de se comparer :
 *
 *   source scripts/monter-base-locale.sh
 *   DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed
 *   npm run build && npx next start -p 3000     # ATLAS_BANC_ESSAI=1
 *   npx tsx scripts/mesurer-parcours-reel.mts [port]
 *
 * Écrit `docs/maquettes/82-mesures.json`, que `verifier-maquette-moins-de-mots.mjs`
 * confronte aux nombres imprimés sur la planche 82.
 */
import { existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices, type Page } from "playwright";

const base = `http://127.0.0.1:${process.argv[2] ?? "3000"}`;
const CAPTURES = "docs/maquettes/images/82";
mkdirSync(CAPTURES, { recursive: true });

/** Playwright ne trouve pas seul un navigateur installé hors de son cache. */
function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const d = readdirSync(racine).find((x) => /^chromium-\d+$/.test(x));
  if (!d) return undefined;
  const chemin = `${racine}/${d}/chrome-linux/chrome`;
  return existsSync(chemin) ? chemin : undefined;
}

type Releve = {
  nom: string;
  url: string;
  mots: number;
  touchables: number;
  ecransADefiler: number;
  gestesCumules: number;
};

let gestes = 0;
const releves: Releve[] = [];

async function relever(page: Page, nom: string): Promise<Releve> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // **La feuille MONTE.** Mesurée pendant qu'elle monte, on mesure l'écran
  // d'avant — et le chiffre a l'air juste. Une seconde pleine plutôt qu'un vert
  // qui ne prouve rien (`CLAUDE.md` §5).
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const texte = (document.body as HTMLElement).innerText ?? "";
    const mots = texte.split(/\s+/).filter((x) => /[0-9A-Za-zÀ-ÿ]/.test(x)).length;
    const cibles = Array.from(
      document.querySelectorAll(
        "button, a[href], input, select, textarea, [role=button], [role=link], [role=tab]",
      ),
    ).filter((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
    return {
      mots,
      touchables: cibles.length,
      hauteurPage: document.documentElement.scrollHeight,
      hauteurVue: window.innerHeight,
    };
  });

  // **Une mesure impossible n'est pas une mesure de zéro.** Une fenêtre de
  // hauteur nulle ou une page sans un mot ni un bouton rendrait « rien n'est
  // lourd », en vert, sur un écran qui l'est.
  if (m.hauteurVue === 0) throw new Error(`${nom} : hauteur de fenêtre nulle — mesure impossible`);
  if (m.mots === 0 && m.touchables === 0) throw new Error(`${nom} : écran vide — mesure impossible`);

  const r: Releve = {
    nom,
    url: page.url().replace(base, ""),
    mots: m.mots,
    touchables: m.touchables,
    ecransADefiler: Math.round((m.hauteurPage / m.hauteurVue) * 10) / 10,
    gestesCumules: gestes,
  };
  releves.push(r);
  await page.screenshot({
    path: `${CAPTURES}/${String(releves.length).padStart(2, "0")}-${nom.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
    fullPage: true,
  });
  console.log(
    `${String(releves.length).padStart(2)} | ${nom.padEnd(24)} | ${String(r.mots).padStart(4)} mots | ${String(r.touchables).padStart(3)} touchables | ${String(r.ecransADefiler).padStart(4)} écran(s) | ${String(gestes).padStart(2)} gestes`,
  );
  return r;
}

/**
 * Le contenu d'une FEUILLE seule, sans l'écran qu'elle recouvre.
 *
 * **Sans cela, la fiche client pèse 190 mots — et c'est faux.** La feuille
 * monte par-dessus l'accueil sans le retirer du document : `body.innerText`
 * additionne les deux. Un chiffre pris là serait faux dans le sens qui
 * arrange, ce qui est le pire des deux (`AGENTS.md`).
 */
async function feuilleSeule(page: Page, debutDuTitre: string) {
  const r = await page.evaluate((debut) => {
    let trouve: HTMLElement | null = null;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const t = (el as HTMLElement).innerText;
      // Le PLUS GRAND bloc qui commence par ce titre : le plus petit est le
      // titre lui-même, et il rendrait « 2 mots ».
      if (t && t.trim().startsWith(debut)) {
        if (!trouve || t.length > (trouve as HTMLElement).innerText.length) trouve = el as HTMLElement;
      }
    }
    if (!trouve) return { mots: -1, texte: "" };
    const brut = (trouve as HTMLElement).innerText;
    return {
      mots: brut.split(/\s+/).filter((x) => /[0-9A-Za-zÀ-ÿ]/.test(x)).length,
      texte: brut.replace(/\n+/g, " | "),
    };
  }, debutDuTitre);
  if (r.mots <= 0) throw new Error(`feuille « ${debutDuTitre} » introuvable — mesure impossible`);
  return r;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
const page = await contexte.newPage();

console.log("Le parcours du patron : ouvrir, créer le chantier, arriver au devis.\n");

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await relever(page, "Connexion");
await page.fill('input[name="email"]', "demo@atlas.local"); gestes++;
await page.fill('input[name="password"]', "demo1234"); gestes++;
await page.click('button[type="submit"]'); gestes++;
await page.waitForURL(`${base}/`, { timeout: 60_000 });
const accueil = await relever(page, "Accueil");

// **Le jeu de démonstration doit être NEUF, et ce contrôle le prouve.** Ce
// script crée un chantier à chaque passage, et `db:seed` ne le retire pas :
// trois exécutions de suite ont fait passer l'accueil de 135 à 167 mots, sans
// qu'une ligne de produit ait bougé. Deux mesures cessaient de se comparer, et
// c'est précisément ce qu'on veut éviter en mesurant.
const enCours = await page.evaluate(
  () => (document.body as HTMLElement).innerText.match(/^(\S+) EN COURS$/m)?.[1] ?? "",
);
if (enCours !== "QUATRE") {
  throw new Error(
    `l'accueil annonce « ${enCours || "?"} en cours » au lieu de « quatre » : le jeu de ` +
      `démonstration n'est pas neuf. Rejouer db:seed après avoir retiré les chantiers ` +
      `laissés par une exécution précédente, sans quoi les comptes ne se comparent pas.`,
  );
}

await page.getByText(/Créer un devis/i).first().click(); gestes++;
await relever(page, "Fiche client");
const ficheSeule = await feuilleSeule(page, "Fiche client");
console.log(`     ↳ la feuille SEULE : ${ficheSeule.mots} mots`);
console.log(`       ${ficheSeule.texte}`);

await page.getByPlaceholder("Bernard", { exact: true }).fill("Dupont"); gestes++;
await page.getByPlaceholder("06 12 34 56 78").fill("0612345678"); gestes++;
await page.getByPlaceholder(/12 rue des Lilas/).fill("8 rue du Port, Nantes"); gestes++;

const ficheRemplie = await feuilleSeule(page, "Fiche client");
console.log(`     ↳ la feuille UNE FOIS REMPLIE : ${ficheRemplie.mots} mots`);
console.log(`       ${ficheRemplie.texte}`);

const ecrire = page.getByText(/J.écris mon devis/i).first();
await ecrire.scrollIntoViewIfNeeded();
await ecrire.click(); gestes++;
await page.waitForURL(/\/devis-complet/, { timeout: 60_000 });
const devis = await relever(page, "Le devis");

// Les quatre autres onglets, tels qu'il les trouve en tâtonnant.
const onglets: Record<string, Releve> = {};
for (const [chemin, nom] of [
  ["/planning", "Onglet Planning"],
  ["/termines", "Onglet Terminés"],
  ["/paysage", "Onglet Paysage"],
  ["/reglages", "Onglet Réglages"],
] as const) {
  await page.goto(`${base}${chemin}`, { waitUntil: "networkidle" });
  onglets[nom] = await relever(page, nom);
}

const total = { gestes, motsDuParcours: releves.slice(0, 5).reduce((s, r) => s + r.mots, 0) };
console.log(
  `\nDe l'ouverture au devis : ${total.gestes} gestes, ${total.motsDuParcours} mots traversés.`,
);

writeFileSync(
  "docs/maquettes/82-mesures.json",
  JSON.stringify(
    {
      quand: "mesuré sur le jeu de démonstration ; regénérer avec scripts/mesurer-parcours-reel.mts",
      ecran: "iPhone 13 (390 × 664, la place qui reste sous la barre d'adresse)",
      total,
      ficheClientSeule: ficheSeule,
      ficheClientRemplie: ficheRemplie,
      accueil,
      devis,
      reglages: onglets["Onglet Réglages"],
      releves,
    },
    null,
    2,
  ) + "\n",
);
console.log("relevé écrit : docs/maquettes/82-mesures.json");
console.log(`captures     : ${CAPTURES}/`);

await navigateur.close();
