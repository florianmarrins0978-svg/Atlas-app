/**
 * L'APPLICATION SUR ORDINATEUR : les mêmes écrans, un cadre plus large.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 30 septembre 2026 :** *« il faut que ça prenne l'entièreté
 * de l'ordinateur »*. Puis le 3 octobre : *« les pages doivent être EXACTEMENT
 * les mêmes »*, et *« quand je fais une modif sur l'appli tel, qu'elle
 * s'applique automatiquement sur l'appli PC »*.
 *
 * D'où la solution (`globals.css`, « L'ORDINATEUR ») : aucun écran propre à
 * l'ordinateur, seul le cadre change avec la largeur. Ce contrôle tient les
 * deux moitiés de la promesse, chacune mesurée et jamais supposée :
 *
 *   sur ordinateur, la barre passe à gauche, ne réserve plus rien en bas, et
 *   le contenu s'ouvre à côté d'elle au lieu de rester dans 448 px ;
 *   sur téléphone, rien ne bouge : la barre reste en bas, de bord à bord.
 *
 * **Il a été vu rouge avant la correction** : sur l'ancien cadre, la barre
 * d'un écran de 1440 px restait en bas, large de 448 px, et le contenu aussi.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import type { Browser, BrowserContextOptions } from "playwright";

const BASE = ADRESSE;
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

type Boite = { gauche: number; droite: number; haut: number; bas: number; largeur: number; hauteur: number };
type Mesure = {
  fenetre: { largeur: number; hauteur: number };
  barre: Boite | null;
  contenu: Boite | null;
  reserveEnBas: string;
  defileEnLargeur: boolean;
};

const SONDE = `(() => {
  const boite = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom, largeur: r.width, hauteur: r.height };
  };
  return {
    fenetre: { largeur: window.innerWidth, hauteur: window.innerHeight },
    barre: boite(document.querySelector('nav[aria-label="Navigation principale"]')),
    contenu: boite(document.querySelector("main.atlas-contenu")),
    reserveEnBas: getComputedStyle(document.documentElement).getPropertyValue("--atlas-barre").trim(),
    defileEnLargeur: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;

async function mesurer(navigateur: Browser, ecran: BrowserContextOptions, chemin: string): Promise<Mesure> {
  const contexte = await navigateur.newContext(ecran);
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  // La barre publie sa place par un `ResizeObserver` : on lui laisse une image.
  await page.waitForTimeout(400);
  const m = (await page.evaluate(SONDE)) as Mesure;
  await contexte.close();
  return m;
}

function exiger(m: Mesure): { barre: Boite; contenu: Boite } {
  // Une boîte absente ou plate ne se mesure pas : on refuse de conclure plutôt
  // que de rendre un vert sur zéro pixel (`CLAUDE.md` §5).
  if (!m.barre || m.barre.largeur < 20 || m.barre.hauteur < 20) {
    throw new Error("aucune barre de navigation mesurable : ce contrôle n'a rien regardé");
  }
  if (!m.contenu || m.contenu.largeur < 20) {
    throw new Error("aucun contenu mesurable : ce contrôle n'a rien regardé");
  }
  return { barre: m.barre, contenu: m.contenu };
}

async function main() {
  console.log("\n=== L'application sur ordinateur, et le téléphone qui ne bouge pas ===\n");

  const navigateur = await lancerNavigateur();
  const ordinateur: BrowserContextOptions = { viewport: { width: 1440, height: 900 } };
  const telephone: BrowserContextOptions = { ...ECRAN_DU_PATRON, isMobile: true, hasTouch: true };

  for (const chemin of ["/", "/planning", "/reglages"]) {
    const m = await mesurer(navigateur, ordinateur, chemin);

    await cas(`ordinateur, ${chemin} : la barre est une colonne à gauche, sur toute la hauteur`, async () => {
      const { barre } = exiger(m);
      if (Math.abs(barre.gauche) > TOLERANCE_PX || Math.abs(barre.haut) > TOLERANCE_PX) {
        throw new Error(`barre posée à (${barre.gauche}, ${barre.haut}) : elle n'est pas en haut à gauche`);
      }
      if (barre.largeur > 320) {
        throw new Error(`barre de ${barre.largeur} px de large : elle est restée une rangée`);
      }
      if (Math.abs(barre.bas - m.fenetre.hauteur) > TOLERANCE_PX) {
        throw new Error(`barre arrêtée à ${barre.bas} px sur ${m.fenetre.hauteur} : elle ne descend pas jusqu'en bas`);
      }
    });

    await cas(`ordinateur, ${chemin} : rien n'est plus réservé en bas de l'écran`, async () => {
      if (parseFloat(m.reserveEnBas) !== 0) {
        throw new Error(
          `--atlas-barre vaut « ${m.reserveEnBas} » : chaque page garderait un vide de cette hauteur ` +
            "sous son contenu, pour une barre qui n'est plus en bas",
        );
      }
    });

    await cas(`ordinateur, ${chemin} : le contenu s'ouvre à côté de la barre, et en grand`, async () => {
      const { barre, contenu } = exiger(m);
      if (contenu.gauche < barre.droite - TOLERANCE_PX) {
        throw new Error(`le contenu commence à ${contenu.gauche} px, sous la barre qui finit à ${barre.droite} px`);
      }
      if (contenu.largeur < 900) {
        throw new Error(`contenu de ${contenu.largeur} px : il est resté dans la colonne du téléphone`);
      }
      if (m.defileEnLargeur) throw new Error("la page défile en largeur : quelque chose déborde");
    });

    const t = await mesurer(navigateur, telephone, chemin);

    await cas(`téléphone, ${chemin} : la barre reste en bas, de bord à bord`, async () => {
      const { barre, contenu } = exiger(t);
      if (Math.abs(barre.bas - t.fenetre.hauteur) > TOLERANCE_PX) {
        throw new Error(`barre finie à ${barre.bas} px sur ${t.fenetre.hauteur} : elle a quitté le bas`);
      }
      if (Math.abs(barre.largeur - t.fenetre.largeur) > TOLERANCE_PX) {
        throw new Error(`barre de ${barre.largeur} px sur un écran de ${t.fenetre.largeur}`);
      }
      if (Math.abs(contenu.largeur - t.fenetre.largeur) > TOLERANCE_PX) {
        throw new Error(`contenu de ${contenu.largeur} px sur un écran de ${t.fenetre.largeur}`);
      }
      const reserve = parseFloat(t.reserveEnBas);
      if (Math.abs(reserve - barre.hauteur) > TOLERANCE_PX) {
        throw new Error(`--atlas-barre annonce ${reserve} px pour une barre de ${barre.hauteur} px`);
      }
      if (t.defileEnLargeur) throw new Error("la page défile en largeur : quelque chose déborde");
    });
  }

  // **La molette fait défiler l'écran où qu'elle soit** (sa capture du
  // 3 octobre 2026 : « je peux pas slider pour descendre »). L'écran des
  // chantiers fait défiler une zone intérieure ; posée dans la marge, à côté de
  // la colonne, la souris ne trouvait rien à faire défiler.
  await cas("ordinateur, / : la molette posée dans la marge fait défiler la liste", async () => {
    const contexte = await navigateur.newContext({ viewport: { width: 1366, height: 620 } });
    const page = await contexte.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    await page.waitForSelector(".atlas-fil-defile", { timeout: 45_000 });
    await page.waitForTimeout(400);
    const avant = await page.evaluate(() => {
      const fil = document.querySelector<HTMLElement>(".atlas-fil-defile")!;
      const colonne = document.querySelector("main.atlas-contenu")!.getBoundingClientRect();
      return { haut: fil.scrollTop, aDefiler: fil.scrollHeight - fil.clientHeight, gaucheColonne: colonne.left };
    });
    // Une liste qui tient dans l'écran ne prouve rien : on refuse de conclure.
    if (avant.aDefiler < 50) throw new Error(`la liste ne dépasse que de ${avant.aDefiler} px : rien à faire défiler`);
    if (avant.gaucheColonne < 280) throw new Error("aucune marge à gauche de la colonne : le cas ne se pose pas");
    await page.mouse.move(avant.gaucheColonne - 20, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    const apres = await page.evaluate(() => document.querySelector<HTMLElement>(".atlas-fil-defile")!.scrollTop);
    await contexte.close();
    if (apres <= avant.haut) throw new Error(`la liste n'a pas bougé (${avant.haut} px puis ${apres} px)`);
  });

  // **Les écrans d'avant le compte gardent la largeur d'un téléphone** (sa
  // capture du 3 octobre 2026 : « le bouton est trop grand », « Créer un
  // compte » étiré sur toute la largeur de l'accueil). Le fond couvre
  // l'écran, le bouton non.
  for (const [chemin, libelle] of [
    ["/bienvenue", "Créer un compte"],
    ["/creer-un-compte", "Continuer"],
    ["/mot-de-passe-oublie", "Recevoir un code"],
  ] as const) {
    await cas(`ordinateur, ${chemin} : « ${libelle} » garde la largeur d'un téléphone`, async () => {
      const contexte = await navigateur.newContext(ordinateur);
      const page = await contexte.newPage();
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
      const bouton = page.getByText(libelle, { exact: true }).first();
      await bouton.waitFor({ timeout: 30_000 });
      const boite = await bouton.boundingBox();
      await contexte.close();
      if (!boite || boite.width < 20) throw new Error(`« ${libelle} » introuvable ou plat : rien n'est mesuré`);
      if (boite.width > 448 + TOLERANCE_PX) {
        throw new Error(`« ${libelle} » fait ${Math.round(boite.width)} px de large sur un écran de 1440`);
      }
    });
  }

  await navigateur.close();
  console.log(echecs ? `\n❌ ${echecs} échec(s).` : "\n✅ Les mêmes écrans, sur ordinateur comme sur téléphone.");
  process.exit(echecs ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
