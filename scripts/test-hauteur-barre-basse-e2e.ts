import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// **LA BARRE DU BAS DIT SA VRAIE HAUTEUR, ET CE QUI S'Y APPUIE LA TOUCHE.**
//
// ─── Sa capture du 7 septembre 2026 ─────────────────────────────────────────
//
// *« Problème, il y a un trou entre "1 en attente du client" et le menu du
// bas. »* Sur le planning, le tiroir flottait au-dessus de la barre, et la
// bande de crème entre les deux se lisait comme un défaut d'affichage.
//
// **Mesuré : 20,3 px.** `--atlas-barre` valait `4.25rem` — 68 px écrits à la
// main — pour une barre qui en mesure 47,75. Le tiroir se pose à
// `bottom: var(--atlas-barre)` : il obéissait à la variable, pas à la barre.
//
// ─── POURQUOI CE CONTRÔLE, ET PAS UN CHIFFRE CORRIGÉ ────────────────────────
//
// Corriger `4.25rem` en `3rem` aurait refermé le trou du jour et préparé le
// suivant : la barre a déjà maigri une fois sans que personne le voie. Le
// fichier qui portait la variable disait pourtant la règle, deux lignes plus
// bas, à propos du bandeau du banc — *« un élément qui change de taille ne se
// mesure pas dans un fichier »*. La barre publie donc la sienne, comme lui.
//
// Ce contrôle éprouve la CONSÉQUENCE, pas le mécanisme : que ce qui s'appuie
// sur la barre la touche. Il survivrait à un changement de dessin de la barre,
// et il rougirait le jour où quelqu'un remettrait un chiffre en dur.
//
// ─── ET IL SAIT ÉCHOUER ─────────────────────────────────────────────────────
//
// Le dernier cas repose la valeur d'avant (68 px) et exige de voir le trou
// revenir. Sans lui, un contrôle qui ne mesurerait rien — barre absente,
// tiroir fermé — rendrait du vert sans avoir rien regardé, et c'est le piège
// que `CLAUDE.md` §5 décrit : il ne dit pas « rouge », il rassure.

const BASE = ADRESSE;

/** Au-delà, le vide se voit sur son écran. En deçà, c'est l'arrondi du navigateur. */
const TOLERANCE_PX = 1.5;

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

type Mesure = {
  barreTrouvee: boolean;
  tiroirTrouve: boolean;
  variable: string;
  hauteurBarre: number;
  hautDeLaBarre: number;
  basDuTiroir: number;
  contenuOuvert: number;
};

const SONDE = `(() => {
  const barre = document.querySelector('nav[aria-label="Navigation principale"]');
  const tiroir = document.querySelector("[data-atlas='tiroir-planning']");
  const contenu = document.getElementById("tiroir-du-bas");
  const b = barre ? barre.getBoundingClientRect() : null;
  const t = tiroir ? tiroir.getBoundingClientRect() : null;
  return {
    barreTrouvee: !!barre,
    tiroirTrouve: !!tiroir,
    variable: getComputedStyle(document.documentElement).getPropertyValue("--atlas-barre").trim(),
    hauteurBarre: b ? b.height : 0,
    hautDeLaBarre: b ? b.top : 0,
    basDuTiroir: t ? t.bottom : 0,
    contenuOuvert: contenu ? contenu.getBoundingClientRect().height : 0,
  };
})()`;

async function main() {
  console.log("\n=== La barre du bas et ce qui s'y appuie ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-atlas='grille-mois']", { timeout: 45_000 });
  // Les polices d'abord : mesurer une police de repli, c'est rendre un vert qui
  // ne dit rien de ce que lui voit (`CLAUDE.md` §5).
  await page.evaluate(() => document.fonts.ready);

  // Le tiroir OUVERT, comme sur sa capture : fermé, il n'y a rien à voir.
  await page.click("[data-atlas='poignee-tiroir']");
  await page.waitForTimeout(700);

  const m = (await page.evaluate(SONDE)) as Mesure;

  await cas("il y a bien une barre ET un tiroir — sinon rien n'est mesuré", async () => {
    if (!m.barreTrouvee) throw new Error("aucune barre de navigation : ce contrôle n'a rien regardé");
    if (!m.tiroirTrouve) throw new Error("aucun tiroir sur le planning : ce contrôle n'a rien regardé");
    if (m.hauteurBarre < 20) {
      throw new Error(`barre de ${m.hauteurBarre} px : une barre plate ne se mesure pas`);
    }
    if (m.contenuOuvert < 20) {
      throw new Error(`tiroir de ${m.contenuOuvert} px : il ne s'est pas ouvert, rien n'est mesuré`);
    }
  });

  await cas("la variable annonce la hauteur RÉELLE de la barre", async () => {
    const annoncee = parseFloat(m.variable);
    if (!Number.isFinite(annoncee)) {
      throw new Error(`--atlas-barre vaut « ${m.variable} » : elle n'a pas été mesurée`);
    }
    const ecart = Math.abs(annoncee - m.hauteurBarre);
    if (ecart > TOLERANCE_PX) {
      throw new Error(
        `--atlas-barre annonce ${annoncee} px pour une barre de ${m.hauteurBarre} px ` +
          `(${ecart.toFixed(1)} px d'écart). Tout ce qui s'appuie dessus flottera d'autant.`
      );
    }
  });

  await cas("le tiroir du planning TOUCHE la barre — son trou du 7 septembre", async () => {
    const trou = m.hautDeLaBarre - m.basDuTiroir;
    if (trou > TOLERANCE_PX) {
      throw new Error(
        `trou de ${trou.toFixed(1)} px entre le bas du tiroir et le haut de la barre — ` +
          `c'est la bande de crème qu'il a photographiée`
      );
    }
    if (trou < -TOLERANCE_PX) {
      throw new Error(`le tiroir passe SOUS la barre de ${(-trou).toFixed(1)} px : elle le recouvre`);
    }
  });

  await cas("LE CONTRÔLE SAIT ÉCHOUER — la valeur d'avant rouvre le trou", async () => {
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--atlas-barre", "68px");
    });
    await page.waitForTimeout(200);
    const apres = (await page.evaluate(SONDE)) as Mesure;
    const trou = apres.hautDeLaBarre - apres.basDuTiroir;
    if (trou <= TOLERANCE_PX) {
      throw new Error(
        "remettre les 68 px d'avant ne rouvre pas le trou : ce contrôle ne prouve donc rien"
      );
    }
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("--atlas-barre");
    });
  });

  await navigateur.close();

  console.log(
    echecs === 0
      ? "\n✅ La barre dit sa hauteur, et le tiroir la touche."
      : `\n❌ La barre du bas — ${echecs} échec(s).`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
