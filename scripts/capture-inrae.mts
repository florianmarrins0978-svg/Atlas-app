/**
 * Les deux captures de la pièce jointe à l'INRAE — **reproductibles**.
 *
 *   npx tsx scripts/capture-inrae.mts
 *   node docs/piece-jointe-inrae/composer-pdf.mjs
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce script existe.** Les deux images ont d'abord été prises par un
 * script jetable, décrit en prose dans `docs/piece-jointe-inrae/LISEZ-MOI.md`.
 * Le 23 août 2026, une correction de crédit photo a rendu ces captures fausses
 * — l'écran affichait encore l'ancienne mention — et il a fallu tout remonter
 * de mémoire. Une image qui part chez un institut de recherche doit pouvoir se
 * refaire en une commande, sinon elle vieillit sans qu'on s'en aperçoive.
 *
 * **Deux pièges, tenus ici plutôt que rappelés dans un mode d'emploi :**
 *
 *  - la barre de navigation du bas est fixée à la fenêtre : sur un écran de
 *    844 px elle recouvre le crédit de la photo — précisément ce que le
 *    document doit montrer. D'où une fenêtre de 1500 px de haut ;
 *  - une capture d'ÉLÉMENT colle au pixel près à sa boîte, et le texte touche
 *    le bord. Le bloc des sources se prend donc en RÉGION, avec de la marge.
 *
 * Il faut un serveur en marche (`npm run dev`) et la base montée avec les
 * fiches importées — le script le vérifie et refuse plutôt que de rendre des
 * images vides.
 */
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { composerResultat } from "../src/server/diagnostic/moteur";
import { lireBasePourMoteur } from "../src/server/repositories/fiches-phyto";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const CAPTURES = "captures";
const CODE_FICHE = "anthracnose-platane";

/** Poser un diagnostic RENDU sur la fiche du platane, et rendre son adresse. */
async function poserLeDiagnostic(): Promise<string> {
  // **`DATABASE_URL`, et non le rôle propriétaire.** `membres_entreprise` est
  // sous RLS FORCE : même `atlas_owner` en lit ZÉRO ligne sans contexte, et la
  // jointure ci-dessous rendait donc « aucune entreprise en base » sur une base
  // fraîchement amorcée. Les suites navigateur emploient pour cette raison un
  // rôle qui traverse la RLS ; ce script est dans le même cas — il inspecte la
  // base pour poser un diagnostic, il ne joue pas le parcours d'un utilisateur.
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test",
  });
  const c = await pool.connect();
  try {
    const base = await lireBasePourMoteur();
    const fiche = base.fiches.find((x) => x.code === CODE_FICHE);
    if (!fiche) {
      throw new Error(
        `La fiche « ${CODE_FICHE} » n'est pas lisible. Soit la base n'est pas montée, soit ` +
          `l'import n'a pas tourné : DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx ` +
          `scripts/importer-fiches-phyto.ts donnees/phyto/fiches`
      );
    }

    // **Le résultat est COMPOSÉ, jamais recopié** (`CLAUDE.md` §3). Une image
    // qui montrerait un écran écrit à la main ici, et non celui du produit,
    // mentirait à l'INRAE sur ce qu'Atlas affiche réellement.
    const resultat = await composerResultat({ fiche, score: 0.9, motifs: [] }, "probable");
    if (!resultat) throw new Error("La fiche n'a pas pu être composée.");

    const { rows: e } = await c.query(
      "SELECT e.id AS entreprise FROM entreprises e JOIN membres_entreprise m ON m.entreprise_id = e.id LIMIT 1"
    );
    if (e.length === 0) throw new Error(
        "Aucune entreprise en base. Soit `npm run db:seed` n'a pas tourné, soit DATABASE_URL " +
          "désigne un rôle soumis à la RLS — `membres_entreprise` est sous RLS FORCE et rend alors zéro ligne."
      );

    await c.query("BEGIN");
    await c.query("SELECT set_config('app.entreprise_id', $1, true)", [e[0].entreprise]);
    const { rows } = await c.query(
      `INSERT INTO diagnostics (entreprise_id, statut, fiche_id, confiance, resultat, moteur, modele, version_base, rendu_at)
       VALUES ($1,'rendu',$2,'probable',$3,'capture','capture','capture', now()) RETURNING id`,
      [e[0].entreprise, fiche.id, resultat]
    );
    await c.query("COMMIT");
    return rows[0].id as string;
  } finally {
    c.release();
    await pool.end();
  }
}

async function main() {
  mkdirSync(CAPTURES, { recursive: true });
  const id = await poserLeDiagnostic();

  const navigateur = await lancerNavigateur();
  // 1500 px de haut : la barre du bas est fixée à la fenêtre, et sur 844 px
  // elle mange le crédit de la photo.
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 1500 },
    deviceScaleFactor: 3,
  });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  await page.goto(`${BASE}/paysage/diagnostic/${id}`, { waitUntil: "networkidle" });
  const ecran = page.locator('[data-atlas="ecran-diagnostic-resultat"]');
  await ecran.waitFor({ state: "visible", timeout: 15000 });
  // La photo doit être CHARGÉE : une capture prise avant met un cadre vide, et
  // rien n'échouerait (`CLAUDE.md` §5 — une mesure de zéro ne mesure rien).
  await page.waitForFunction(
    () => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
    undefined,
    { timeout: 15000 }
  );

  const boite = await ecran.boundingBox();
  if (!boite || boite.height < 400) {
    throw new Error(`l'écran de résultat mesure ${boite?.height ?? 0} px — la mise en page n'est pas appliquée.`);
  }
  await page.screenshot({
    path: `${CAPTURES}/inrae-ecran.png`,
    clip: { x: 0, y: 0, width: 390, height: Math.min(boite.y + boite.height + 16, 1500) },
  });

  // Le bloc des sources vit sous « Voir les détails », replié par défaut.
  const details = page.locator("details").first();
  await details.evaluate((d: HTMLDetailsElement) => (d.open = true));
  const sources = page.locator('[data-atlas="diagnostic-sources"]').first();
  const cible = (await sources.count()) > 0 ? sources : details;
  await cible.waitFor({ state: "visible", timeout: 10000 });
  // **Les coordonnées se prennent dans la PAGE, pas dans la fenêtre.**
  // `boundingBox()` les rend relatives à la fenêtre : le bloc des sources vit
  // sous « Voir les détails », donc plus bas que 1500 px, et Playwright refuse
  // alors le découpage — « Clipped area is either empty or outside the
  // resulting image ». Avec `fullPage`, le découpage se lit dans la page
  // entière ; il faut donc y ajouter le défilement.
  const b = await cible.evaluate((el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  });
  if (b.height < 40) throw new Error(`le bloc des sources mesure ${b.height} px — il n'est pas déplié.`);
  // En RÉGION avec 15 px de marge : une capture d'élément colle au texte.
  await page.screenshot({
    path: `${CAPTURES}/inrae-sources.png`,
    fullPage: true,
    clip: {
      x: Math.max(0, b.x - 15),
      y: Math.max(0, b.y - 15),
      width: Math.min(390, b.width + 30),
      height: b.height + 30,
    },
  });

  await navigateur.close();
  console.log(`✅ ${CAPTURES}/inrae-ecran.png et ${CAPTURES}/inrae-sources.png`);
  console.log("   Composer le PDF : node docs/piece-jointe-inrae/composer-pdf.mjs");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
