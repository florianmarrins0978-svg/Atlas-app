import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { composerResultat } from "../src/server/diagnostic/moteur";
import { lireBasePourMoteur } from "../src/server/repositories/fiches-phyto";
import { conclureDiagnostic, ouvrirDiagnostic } from "../src/server/repositories/diagnostics";
import { CONSIGNE_IDENTIFIER_ESSENCE } from "../src/lib/diagnostic-vegetal";
import type { Ctx } from "../src/server/repositories/context";
import { ADRESSE } from "./_adresse";

/**
 * Les QUATRE issues du diagnostic végétal — chacune regardée, à 390 × 664, sur
 * Origine ET sur Nuit.
 *
 * **Pourquoi une suite de plus à côté de `test-diagnostic-ecrans-e2e`.** Celle-là
 * passe par la porte du patron — une photo envoyée — et n'atteint donc, sans clé
 * de vision, que « personne n'a regardé » ; elle pose ensuite UN résultat rendu.
 * Les deux issues qu'il verra le plus souvent avec trois fiches en base — « je
 * ne peux pas confirmer » et « une photo de plus » — n'étaient photographiées
 * nulle part. Or c'est en regardant une capture, jamais par un test vert, que
 * les défauts d'écran de ce dépôt ont été trouvés (`CLAUDE.md` §5).
 *
 * **Les issues sont ÉCRITES par le dépôt, pas par le modèle** — `conclureDiagnostic`
 * est exactement ce que fait `actions.ts` une fois l'analyse revenue. C'est le
 * chemin du produit à partir de là ; ce qui précède (l'appel de vision) ne se
 * joue pas ici, et ne se prétend pas joué.
 *
 * **Ce que la suite fixe, et qui survivra au prochain remaniement :**
 *
 *  1. chaque issue est un écran FINI — une boîte mesurable, aucune trace
 *     technique (`Error`, `undefined`, `[object`) ;
 *  2. « la base ne sait pas » et « personne n'a regardé » ne portent PAS le
 *     même titre (`ARCHITECTURE.md` §135.5) — comparés entre eux, jamais à un
 *     libellé : le jour où il fait changer un mot, ce contrôle tient encore ;
 *  3. « une photo de plus » offre bien de quoi la prendre — une entrée de
 *     fichier —, et le résultat porte sa conduite à tenir ;
 *  4. sur Nuit, le fond est SOMBRE et le titre CLAIR, mesurés — c'est la
 *     capture du 22 août (*« le mode nuit est illisible »*) qu'on refuse de
 *     revoir. Une boîte de zéro pixel ne prouve rien, et la suite le dit.
 */

const BASE = ADRESSE;
const CAPTURES = "captures";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

// ── La base ─────────────────────────────────────────────────────────────────

// **Le rôle qui TRAVERSE la RLS, celui que le lanceur des suites navigateur
// pose dans `DATABASE_URL`.** `membres_entreprise` est sous RLS forcée
// (migration 0001) : lue sous le propriétaire sans contexte, elle rend ZÉRO
// ligne sans un mot — et la suite accusait « base non amorcée » sur une base
// pleine. C'est le piège 2 de `HANDOVER.md`, payé ici le 12 septembre 2026.
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test",
    });
  }
  return pool;
}

async function contexteDemo(): Promise<Ctx> {
  const { rows } = await getPool().query(
    `SELECT u.id AS utilisateur, m.entreprise_id AS entreprise
       FROM users u JOIN membres_entreprise m ON m.utilisateur_id = u.id
      WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  if (rows.length === 0) throw new Error("le compte de démonstration est absent : la base n'est pas amorcée");
  return { utilisateurId: rows[0].utilisateur, entrepriseId: rows[0].entreprise };
}

/** Une charte posée sur le compte, comme le fait l'écran Apparence. */
async function poserCharte(nom: string | null) {
  await getPool().query("UPDATE users SET charte = $1 WHERE email = 'demo@atlas.local'", [nom]);
}

const TRACES = { moteur: "suite", modele: "suite", versionBase: "suite" };
const SANS_ESSENCE = { taxonId: null, certitude: null };
const OBSERVATION_VIDE = { partie: null, signes: [], essence: null, qualitePhoto: "moyenne", reserves: [] };
// Une observation qui a VU quelque chose — c'est elle qui remplit « Vu sur la
// photo », et c'est cet affichage-là qu'on regarde. Le `nom_commun` est
// volontairement un mot étranger à la base : s'il apparaissait à l'écran, la
// barrière 3 serait tombée.
const OBSERVATION_VUE = {
  partie: "feuille",
  signes: [{ partie: "feuille", motif: "necrose", couleurs: ["brun", "noir"], localisation: "nervure" }],
  essence: { nomScientifique: null, nomCommun: "MOT-DU-MODELE", port: "feuillu", certitude: "probable" },
  qualitePhoto: "bonne",
  reserves: [],
};

/** Les quatre issues, écrites par le chemin du produit — jamais en SQL à la main. */
async function preparerLesQuatre(ctx: Ctx): Promise<Record<string, string>> {
  execSync("npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fixtures --fixtures", {
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "test",
      STORAGE_PROVIDER: "local",
      DATABASE_URL:
        process.env.DATABASE_ADMIN_URL ??
        "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
    },
  });
  // La double garde des fixtures vaut ici aussi : sans ce drapeau, la lecture
  // les filtre, exactement comme en production.
  process.env.ATLAS_FIXTURES_PHYTO = "1";
  const base = await lireBasePourMoteur();
  const fiche = base.fiches.find((x) => x.code === "zz-test-probleme-gamma");
  if (!fiche) throw new Error("la fixture gamma n'est pas lisible : import échoué, ou drapeau absent");
  const resultat = await composerResultat({ fiche, score: 0.9, motifs: [] }, "probable");
  if (!resultat) throw new Error("la fiche n'a pas pu être composée");
  // L'essence reconnue par la base : celle qu'un hôte des fixtures désigne.
  const taxonId = base.fiches.flatMap((x) => x.hotes)[0]?.taxonId ?? null;
  if (!taxonId) throw new Error("aucun taxon dans les fixtures : rien à afficher comme essence");
  const ESSENCE = { taxonId, certitude: "probable" };

  const ids: Record<string, string> = {};

  ids.rendu = await ouvrirDiagnostic(ctx);
  await conclureDiagnostic(
    ctx,
    ids.rendu,
    { type: "rendu", ficheId: fiche.id, confiance: "probable", resultat },
    OBSERVATION_VUE,
    TRACES,
    ESSENCE
  );

  ids.complement = await ouvrirDiagnostic(ctx);
  await conclureDiagnostic(
    ctx,
    ids.complement,
    { type: "complement", consigne: CONSIGNE_IDENTIFIER_ESSENCE, partie: "feuille" },
    OBSERVATION_VUE,
    TRACES,
    SANS_ESSENCE
  );

  ids.inconclusif = await ouvrirDiagnostic(ctx);
  await conclureDiagnostic(
    ctx,
    ids.inconclusif,
    { type: "inconclusif", motif: "trop_proches" },
    OBSERVATION_VUE,
    TRACES,
    ESSENCE
  );

  ids.echoue = await ouvrirDiagnostic(ctx);
  await conclureDiagnostic(
    ctx,
    ids.echoue,
    { type: "echoue", panne: "ANTHROPIC_API_KEY est refusée (HTTP 401)." },
    OBSERVATION_VIDE,
    TRACES,
    SANS_ESSENCE
  );

  return ids;
}

// ── La mesure ───────────────────────────────────────────────────────────────

function luminance(rgb: string): number {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return NaN;
  const [r, g, b] = m.slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function main() {
  mkdirSync(CAPTURES, { recursive: true });
  const ctx = await contexteDemo();
  const ids = await preparerLesQuatre(ctx);

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  const titres: Record<string, string> = {};

  async function regarder(issue: string, charte: "origine" | "nuit") {
    await page.goto(`${BASE}/paysage/diagnostic/${ids[issue]}`, { waitUntil: "networkidle" });
    const ecran = page.locator('[data-atlas="ecran-diagnostic-resultat"]');
    await ecran.waitFor({ state: "visible", timeout: 10000 });
    const texte = (await ecran.innerText()).replace(/\s+/g, " ");
    assert.doesNotMatch(texte, /Error|undefined|\[object/i, "une trace technique atteint l'écran");
    const boite = await ecran.boundingBox();
    assert.ok(boite && boite.height > 50, `l'écran mesure ${boite?.height ?? 0} px : rien à regarder`);
    titres[issue] = (await page.locator("h1").first().innerText()).trim();
    await page.screenshot({ path: `${CAPTURES}/diagnostic-${issue}-${charte}.png`, fullPage: true });
    return texte;
  }

  try {
    console.log("\n=== Origine : les quatre issues sont des écrans finis ===");

    await cas("le résultat porte sa conduite à tenir", async () => {
      await regarder("rendu", "origine");
      const conduite = page.locator('[data-atlas="diagnostic-conduite"]');
      await conduite.waitFor({ state: "visible", timeout: 5000 });
      assert.ok((await conduite.innerText()).trim().length > 0, "la conduite est vide");
    });

    await cas("« une photo de plus » offre de quoi la prendre", async () => {
      await regarder("complement", "origine");
      assert.equal(await page.locator('[data-atlas="prendre-photo"] input[type="file"]').count(), 1);
    });

    await cas("« je ne peux pas confirmer » dit ce qui a été vu — avec les mots du dépôt, jamais ceux du modèle", async () => {
      const texte = await regarder("inconclusif", "origine");
      assert.equal(await page.locator('[data-atlas="diagnostic-vu"]').count(), 1, "« Vu sur la photo » est absent");
      // L'essence affichée est celle de la BASE (le taxon des fixtures) ; le mot
      // libre du modèle ne doit apparaître nulle part.
      assert.doesNotMatch(texte, /MOT-DU-MODELE/, "le nom d'essence écrit par le modèle a atteint l'écran");
      assert.equal(await page.locator('[data-atlas="diagnostic-geste"]').count(), 1, "le geste propre à ce refus est absent");
    });

    await cas("« personne n'a regardé » est un écran, pas une trace", async () => {
      await regarder("echoue", "origine");
    });

    await cas("les deux refus ne portent PAS le même titre — §135.5", async () => {
      assert.ok(titres.inconclusif && titres.echoue, "un des deux titres n'a pas été lu");
      assert.notEqual(
        titres.inconclusif,
        titres.echoue,
        `« ${titres.inconclusif} » pour les deux : il chercherait une meilleure photo au lieu de sa configuration`
      );
    });

    console.log("\n=== Nuit : sombre au fond, clair au titre — mesuré ===");
    await poserCharte("nuit");

    for (const issue of ["rendu", "complement", "inconclusif", "echoue"]) {
      await cas(`${issue} reste lisible sur Nuit`, async () => {
        await regarder(issue, "nuit");
        const mesure = await page.evaluate(() => {
          const h1 = document.querySelector("h1");
          if (!h1) return null;
          const r = h1.getBoundingClientRect();
          // Le fond peint derrière le titre, pas celui du body : c'est lui qu'on lit.
          let fond = "";
          for (let el: Element | null = h1; el && !fond; el = el.parentElement) {
            const bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") fond = bg;
          }
          return { titre: getComputedStyle(h1).color, fond, largeur: r.width, hauteur: r.height };
        });
        assert.ok(mesure && mesure.largeur > 0 && mesure.hauteur > 0, "titre de zéro pixel : mesure impossible");
        const lt = luminance(mesure.titre);
        const lf = luminance(mesure.fond);
        assert.ok(!Number.isNaN(lt) && !Number.isNaN(lf), `couleurs illisibles : ${mesure.titre} sur ${mesure.fond}`);
        assert.ok(lf < 0.2, `le fond n'est pas sombre sur Nuit (${mesure.fond})`);
        assert.ok(lt > 0.5, `le titre n'est pas clair sur Nuit (${mesure.titre})`);
      });
    }
  } finally {
    // Les suites suivantes lisent le compte de démonstration : on le rend tel
    // qu'on l'a trouvé, sinon la prochaine capture serait en Nuit sans le savoir.
    await poserCharte(null);
    await browser.close();
    await pool?.end();
  }

  console.log(
    echecs === 0
      ? `\n✅ Quatre issues du diagnostic — 0 échec(s). Captures dans ${CAPTURES}/.`
      : `\n❌ ${echecs} échec(s).`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
