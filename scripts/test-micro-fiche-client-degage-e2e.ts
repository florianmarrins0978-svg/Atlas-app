import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

/**
 * LE MICRO DE LA FICHE CLIENT NE TOUCHE PAS LE BORD DU HAUT.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa remarque du 16 septembre 2026, capture à l'appui :** *« la note vocale
 * en haut à droite, il faut la descendre légèrement, elle est trop haute,
 * limite coupée »*.
 *
 * **MESURÉ AVANT DE TOUCHER**, et la mesure était nette : le rond de 44 px
 * commençait au pixel 0 de la feuille — zéro pixel d'écart —, sous un coin
 * arrondi de 26 px qui le rogne. En page, sur un iPhone SE, c'était pire : 1 px
 * sous le bord de la fenêtre, parce que le centrage automatique ne rend rien
 * quand il n'y a plus de place libre.
 *
 * **Pourquoi une suite, et pas seulement une capture regardée.** Cette ligne
 * d'en-tête a été resserrée quatre fois (30 août, 31 août, 1ᵉʳ septembre,
 * 14 septembre), à chaque fois pour faire tenir l'écran sur une page. La
 * réserve du haut est exactement ce qu'un cinquième resserrage reprendrait
 * sans y penser : ni les types ni le lint ne la voient, et l'écran
 * continuerait de fonctionner — il aurait seulement recollé le micro au bord.
 *
 * **Elle mesure la RÈGLE, pas un chiffre de style** (`CLAUDE.md` §5 bis) : de
 * l'air au-dessus du rond, quel que soit ce qui le contient. Elle survivra donc
 * à un changement de réserve, de rayon ou de taille de bouton.
 *
 * **Les DEUX visages sont mesurés**, parce que le défaut vivait dans les deux
 * et qu'ils ne se ressemblent pas : la feuille montée depuis l'accueil, et la
 * page entière — celle du retour du devis — sur le plus petit de ses
 * téléphones, où le centrage ne dégage plus rien.
 */
const BASE = ADRESSE;

/**
 * Les deux visages, écrits en clair.
 *
 * Ce n'est pas du confort : `_suites-ciblees.mjs` dérive de ces chaînes-là
 * quelles suites éprouvent quel écran, en les cherchant entre guillemets. Une
 * adresse qui ne vit que dans un gabarit `${BASE}/…` ne serait trouvée par
 * personne, et cette suite ne serait jamais jouée par le contrôle de niveau 2
 * d'un lot qui touche cet écran — c'est-à-dire exactement le lot qui la
 * ferait rougir.
 */
const ACCUEIL = "/";
const PAGE_ENTIERE = "/chantiers/nouveau";

/** L'air minimal au-dessus du rond. Sous le coin arrondi de la feuille (26 px),
 *  moins que cela se lit comme un bouton coupé — c'est ce qu'il a signalé. */
const AIR_MINIMAL = 10;

const MICRO = 'button[aria-label="Dicter les informations du client"]';

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

async function seConnecter(page: import("playwright").Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}${ACCUEIL}`, { timeout: 60_000 });
}

/**
 * La place du rond, et celle du bord au-dessus de lui.
 *
 * **On refuse de conclure sur une boîte de zéro pixel** (`CLAUDE.md` §5) :
 * mesurée avant que la mise en page soit posée, elle rendrait un écart de zéro
 * — c'est-à-dire le défaut lui-même — sur un écran parfaitement correct.
 */
async function airAuDessusDuMicro(
  page: import("playwright").Page,
  selecteurDuCadre: string | null,
): Promise<number> {
  const mesure = (await page.evaluate(
    `(() => {
      const micro = document.querySelector('${MICRO}');
      if (!micro) return { erreur: "le micro de la fiche client est introuvable" };
      const r = micro.getBoundingClientRect();
      if (r.height === 0) return { erreur: "le micro mesure zéro pixel : la mise en page n'est pas posée" };
      const cadre = ${selecteurDuCadre ? `document.querySelector('${selecteurDuCadre}')` : "null"};
      ${selecteurDuCadre ? `if (!cadre) return { erreur: "le cadre attendu est introuvable" };` : ""}
      const hautDuCadre = cadre ? cadre.getBoundingClientRect().top : 0;
      return { air: Math.round(r.top - hautDuCadre) };
    })()`,
  )) as { air?: number; erreur?: string };
  if (mesure.erreur) throw new Error(mesure.erreur);
  return mesure.air!;
}

async function main() {
  console.log("=== Le micro de la fiche client, dégagé du bord du haut ===\n");

  const navigateur = await lancerNavigateur();

  // **UNE SEULE CONNEXION pour les deux visages.** Le limiteur borne à cinq
  // tentatives par quart d'heure : une session par taille d'écran le réveille,
  // et la suite accuse alors la page alors que c'est le garde-fou qui a parlé.
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
  });
  const page = await contexte.newPage();
  await seConnecter(page);

  // ── La feuille, montée depuis l'accueil — le chemin de sa capture ────────
  await page.locator('[data-atlas="nouveau-chantier"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 60_000 });
  await page.click('[data-atlas="nouveau-chantier"]');
  await page.locator(MICRO).waitFor({ state: "visible", timeout: 30_000 });
  // La feuille monte en 560 ms : mesurée pendant, elle rendrait la place d'un
  // écran encore en mouvement.
  await page.waitForTimeout(1_200);

  await cas("dans la feuille, le rond ne touche pas le bord arrondi", async () => {
    const air = await airAuDessusDuMicro(page, 'div[role="dialog"][aria-modal="true"]');
    assert.ok(
      air >= AIR_MINIMAL,
      `Le micro commence à ${air} px du haut de la feuille : sous ${AIR_MINIMAL} px, ` +
        `le coin arrondi le rogne et il se lit comme coupé`,
    );
  });

  // ── La page entière, sur le plus petit de ses téléphones ────────────────
  // C'est là que le centrage automatique ne rend plus rien : s'il reste de
  // l'air, il vient de la réserve, jamais de la place libre.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}${PAGE_ENTIERE}`, { waitUntil: "networkidle" });
  await page.locator(MICRO).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);

  await cas("en page sur un petit iPhone, le rond ne touche pas le haut", async () => {
    const air = await airAuDessusDuMicro(page, null);
    assert.ok(
      air >= AIR_MINIMAL,
      `Le micro commence à ${air} px du haut de la fenêtre : sur cet écran le ` +
        `centrage ne dégage rien, c'est la réserve qui doit tenir`,
    );
  });
  await contexte.close();

  await navigateur.close();

  if (echecs > 0) {
    console.error(`\n❌ ${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("\n✅ Le micro garde son air au-dessus, en feuille comme en page.");
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
