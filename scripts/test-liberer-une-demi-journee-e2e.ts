import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import type { Page } from "playwright";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { fermerLeTiroirDuPlanning, ouvrirLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { jourDuPatron } from "./_jour-e2e";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// LIBÉRER UNE DEMI-JOURNÉE, ET LA REPOSER AILLEURS — 10 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// **Sa demande, planche `appli/liberer-une-demi-journee.html`, essayée puis
// retenue :** *« quand je clique sur déplacer, le bouton matin/aprem apparaît
// mais les deux sont vides, blancs. Je clique sur le matin, il devient vert et
// le matin du vendredi devient libre, et une demi-journée de Mr Julien sort ;
// à la place on ajoute un chantier comme d'habitude, et la demi-journée
// retirée peut être replacée. »*
//
// ─── POURQUOI CETTE SUITE ENTRE PAR L'ÉCRAN ────────────────────────────────
//
// `scripts/test-creneaux-chantier.ts` éprouve déjà les règles pures, et les
// deux actions serveur ont leur contrôle. **Aucun des deux ne dit si le geste
// est ATTEIGNABLE** — c'est exactement la faute du 28 août 2026 (`CLAUDE.md`
// §5 quater) : six gestes livrés, tous verts, aucun joignable, parce que les
// contrôles construisaient la demande à la main au lieu de la faire naître de
// l'écran.
//
// On parcourt donc son chemin en entier : poser un chantier d'une journée,
// rendre son matin, retrouver le morceau dans le tiroir du bas, et le reposer
// sur un autre jour. **Et l'on regarde la base après chaque geste** — l'écran
// est optimiste, il repeint avant que le serveur ait répondu.
//
// Usage : npm run test:e2e -- --seulement liberer-une-demi-journee

const BASE = ADRESSE;
const ECRAN_DU_PATRON = devices["iPhone 13"];

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

/** Ce que la base porte VRAIMENT : où le chantier est posé, demi par demi. */
async function creneauxEnBase(chantierId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT jour, demi FROM creneaux_chantier WHERE chantier_id = $1 ORDER BY jour, demi`,
    [chantierId]
  );
  return rows.map((r) => {
    const jour = r.jour instanceof Date ? r.jour.toISOString().slice(0, 10) : String(r.jour);
    return `${jour} ${r.demi}`;
  });
}

/**
 * CE QUE LA POIGNÉE DU TIROIR ANNONCE — le nombre, rien d'autre.
 *
 * **Elle ne dit « N sans date » que si aucun jour n'est touché** : un jour
 * touché change la question, et le mot suit le geste. On lit donc sur un
 * planning fraîchement ouvert.
 */
async function combienAnnonce(page: Page): Promise<number> {
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const poignee = page.locator('[data-atlas="poignee-tiroir"]');
  if ((await poignee.count()) === 0) return 0;
  const dit = await poignee.innerText();
  const n = dit.match(/(\d+)\s+sans date/);
  return n ? Number(n[1]) : 0;
}

/** Ce qu'on ATTEND, rangé comme la base le rend — sinon on compare deux ordres. */
function attendus(creneaux: string[]): string {
  return [...creneaux].sort().join(" | ");
}

/**
 * Deux jours ouvrables à venir, entièrement libres — et l'on feuillette.
 *
 * **Le mois courant peut n'en offrir aucun** : les suites d'avant occupent les
 * jours à venir, et fin août il n'en reste qu'un. Un contrôle dont le verdict
 * dépend du jour du mois où la batterie tourne n'est pas un contrôle
 * (`test-poser-une-date-e2e.ts` a payé exactement ça le 31 août 2026).
 */
async function deuxJoursLibres(page: Page): Promise<[string, string]> {
  const aujourdHui = jourDuPatron();
  const ouvrable = (iso: string) => ![0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
  const lire = () =>
    page.$$eval('[data-atlas="grille-mois"] [data-jour]', (l) =>
      l.map((e) => ({
        jour: e.getAttribute("data-jour"),
        matin: e.querySelector('[data-demi="matin"]')?.getAttribute("data-etat"),
        apres: e.querySelector('[data-demi="apres_midi"]')?.getAttribute("data-etat"),
      }))
    );

  const trouves: string[] = [];
  for (let mois = 0; mois < 4 && trouves.length < 2; mois++) {
    if (mois > 0) {
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(150);
    }
    for (const j of await lire()) {
      if (!j.jour || j.jour <= aujourdHui) continue;
      if (!ouvrable(j.jour)) continue;
      if (j.matin !== "libre" || j.apres !== "libre") continue;
      if (!trouves.includes(j.jour)) trouves.push(j.jour);
      if (trouves.length === 2) break;
    }
  }
  if (trouves.length < 2) {
    throw new Error("moins de deux jours ouvrables à venir entièrement libres, sur quatre mois");
  }
  return [trouves[0], trouves[1]];
}

async function main() {
  console.log("=== Libérer une demi-journée, et la reposer ailleurs ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Un chantier d'UNE JOURNÉE, par le vrai chemin, devis parti : c'est ce qui
  // le fait entrer dans « Sans date », d'où il se pose.
  const NOM = `Libérer ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', NOM);
  const chantierId = await creerPuisFiche(page);
  const marque = await pool.query(
    `UPDATE chantiers SET devis_envoye_at = now(), duree_demi_journees = 2 WHERE id = $1`,
    [chantierId]
  );
  if (marque.rowCount !== 1) {
    throw new Error(
      "le montage n'a pas pu préparer le chantier : sans devis parti il n'entre pas dans " +
        "« Sans date », et la suite accuserait l'écran d'un défaut qui serait le sien"
    );
  }

  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const [jourA, jourB] = await deuxJoursLibres(page);
  console.log(`  · jour posé : ${jourA} — jour d'accueil : ${jourB}`);

  const ouvrirLeJour = async (jour: string) => {
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`, { timeout: 15_000 });
    await page.waitForTimeout(400);
    return page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
  };

  /** Ramener le calendrier sur un jour donné, quel que soit le mois affiché. */
  const allerAuJour = async (jour: string) => {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    for (let i = 0; i < 4; i++) {
      if ((await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) > 0) {
        return ouvrirLeJour(jour);
      }
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(150);
    }
    throw new Error(`le jour ${jour} n'est atteignable sur aucun des quatre mois`);
  };

  await cas("le chantier se pose sur la journée entière", async () => {
    await fermerLeTiroirDuPlanning(page);
    const carte = await ouvrirLeJour(jourA);
    await carte.locator('[data-atlas="ajouter"]').click();
    // **Un temps de plus depuis le 10 septembre 2026** : « Ajouter » propose
    // d'abord la voie — un chantier en attente, un client, ou autre chose
    // (`appli/bloquer-sans-devis.html`). On prend celle qui existait déjà.
    await carte.locator('[data-atlas="voie-chantier"]').click();
    await page.waitForSelector(`[data-qui="${chantierId}"]`, { timeout: 10_000 });
    await page.locator(`[data-qui="${chantierId}"]`).click();
    await page.waitForTimeout(1500);
    const poses = await creneauxEnBase(chantierId);
    if (poses.join(" | ") !== attendus([`${jourA} matin`, `${jourA} apres_midi`])) {
      throw new Error(`posé sur « ${poses.join(" | ") || "rien"} » au lieu des deux moitiés du ${jourA}`);
    }
  });

  // **CE QUE LE TIROIR ANNONCE AVANT** : le chantier est posé en entier, il ne
  // réclame donc aucune place. Ce qui suit se lit comme un écart.
  const avant = await combienAnnonce(page);

  await cas("« Déplacer » ouvre l'interrupteur, les DEUX positions vides", async () => {
    // **Rien n'est allumé, et ce n'est pas un oubli** : les deux positions
    // posent une question — quelle demi-journée je rends — au lieu de décrire
    // où le chantier est. Un interrupteur allumé se lirait comme un état, et
    // c'est ce qu'il a signalé le 9 septembre : *« j'ai l'impression que c'est
    // inversé »*.
    const carte = await allerAuJour(jourA);
    const bloc = carte.locator('[data-atlas="bloc-chantier"]').first();
    await bloc.locator('[data-atlas="deplacer"]').click();
    await page.waitForTimeout(300);
    const bascule = bloc.locator('[data-atlas="bascule-demi"] button');
    if ((await bascule.count()) !== 2) {
      throw new Error(`l'interrupteur offre ${await bascule.count()} position(s) au lieu de deux`);
    }
    for (const p of await bascule.all()) {
      if ((await p.getAttribute("aria-pressed")) === "true") {
        throw new Error("une position est déjà allumée : l'interrupteur décrit un état au lieu de poser une question");
      }
    }
  });

  await cas("un appui rend le matin, et le serveur l'écrit", async () => {
    const bloc = page.locator(`[data-atlas="carte-jour"][data-jour="${jourA}"] [data-atlas="bloc-chantier"]`).first();
    await bloc.locator('[data-atlas="bascule-demi"] button[data-vers="matin"]').click();
    await page.waitForTimeout(1600);
    const poses = await creneauxEnBase(chantierId);
    if (poses.join(" | ") !== `${jourA} apres_midi`) {
      throw new Error(`la base porte « ${poses.join(" | ") || "rien"} » : le matin n'a pas été rendu`);
    }
  });

  await cas("rechargé, le matin de ce jour est LIBRE à l'écran", async () => {
    // **On recharge, sinon on mesure l'espoir de l'écran** : il repeint avant
    // que le serveur réponde, et un matin qu'il croit libre mais qui reste pris
    // se découvre le jour du chantier.
    const carte = await allerAuJour(jourA);
    const matin = carte.locator('[data-atlas="demi"][data-bloc="matin"]').first();
    if ((await matin.count()) === 0) throw new Error("la carte n'annonce plus de matin du tout");
    if ((await matin.getAttribute("data-sans-chantier")) !== "1") {
      throw new Error("le matin porte toujours un chantier après avoir été rendu");
    }
  });

  await cas("la demi-journée rendue attend dans le tiroir du bas", async () => {
    // Elle vit sous le même titre que « Sans date », et c'est voulu : pour lui,
    // ce sont deux formes de la même chose — du travail qui attend un jour.
    await ouvrirLeTiroirDuPlanning(page);
    const morceau = page.locator(`[data-atlas="morceau-a-poser"][data-chantier="${chantierId}"]`);
    if ((await morceau.count()) !== 1) {
      throw new Error("la demi-journée rendue n'apparaît nulle part : elle est perdue pour lui");
    }
    const dit = (await morceau.innerText()).replace(/\s+/g, " ");
    if (!/journée à poser/.test(dit)) {
      throw new Error(`la ligne ne dit pas ce qui attend — lue : « ${dit} »`);
    }
  });

  await cas("le tiroir la COMPTE, comme un chantier qui attend un jour", async () => {
    /*
     * **Trouvé à l'écran, le 10 septembre 2026 :** la porte du tiroir ne
     * comptait que « Sans date ». Un chantier dont on rend une moitié alors que
     * rien d'autre n'attend faisait un tiroir vide — donc ABSENT —, et le
     * morceau n'existait plus nulle part. Le geste marchait ; il n'était
     * joignable qu'au hasard d'une autre liste (`CLAUDE.md` §5 quater).
     *
     * On mesure l'ÉCART plutôt qu'un nombre : ce que la base de démonstration
     * porte par ailleurs ne regarde pas ce contrôle, et l'exiger le ferait
     * rougir à la première suite qui pose un chantier avant lui.
     */
    const apres = await combienAnnonce(page);
    if (apres !== avant + 1) {
      throw new Error(
        `le tiroir annonce ${apres} en attente au lieu de ${avant + 1} : la demi-journée rendue n'y compte pas`
      );
    }
  });

  await cas("elle se repose sur un autre jour, et le serveur suit", async () => {
    // **Deux gestes, comme poser un chantier** : on touche le morceau, puis la
    // demi-journée qui l'accueille. On ne recharge PAS entre les deux — c'est
    // sa séquence à lui, et recharger reposerait la question au doigt.
    await ouvrirLeTiroirDuPlanning(page);
    const morceau = page.locator(`[data-atlas="morceau-a-poser"][data-chantier="${chantierId}"]`);
    await morceau.click();
    await page.waitForTimeout(300);
    // **On vérifie que le doigt tient bien quelque chose AVANT de chercher où
    // le poser** : sans cela, un « Poser ici » absent accuse la journée alors
    // que c'est la prise qui n'a pas eu lieu — une erreur qui envoie chercher
    // au mauvais endroit coûte plus cher que pas d'erreur du tout (`AGENTS.md`).
    if ((await morceau.getAttribute("aria-pressed")) !== "true") {
      throw new Error("le morceau touché ne s'annonce pas tenu : la prise n'a pas eu lieu");
    }
    await fermerLeTiroirDuPlanning(page);

    const carte = await ouvrirLeJour(jourB);
    // **On prend la demi-journée que l'ÉCRAN offre, on ne la choisit pas
    // d'avance.** Exiger « le matin » ferait rougir ce contrôle le jour où une
    // suite d'avant occupe ce matin-là — sur du code juste. Ce qu'il défend,
    // c'est *« la demi-journée retirée peut être replacée »*, pas laquelle.
    const ligne = carte.locator('[data-atlas="demi"]:has([data-atlas="poser-le-morceau"])').first();
    const poser = ligne.locator('[data-atlas="poser-le-morceau"]');
    if ((await poser.count()) === 0) {
      const lu = (await carte.innerText()).replace(/\s+/g, " ").slice(0, 200);
      throw new Error(
        "aucun « Poser ici » sur une demi-journée libre alors qu'un morceau est tenu au doigt : " +
          `le morceau se prend et ne se pose nulle part — carte lue : « ${lu} »`
      );
    }
    // **IL SE VISE, une fois sous les yeux.** Le geste du 6 septembre 2026
    // tombait derrière le tiroir du bas — `fixed`, z-19 — et `count()` valait
    // déjà 1 quand il était inutilisable. On mesure donc le RECOUVREMENT.
    // **On l'amène au MILIEU de l'écran, comme un pouce le ferait.**
    // `scrollIntoViewIfNeeded` fait le strict minimum : il le pose sur le bord
    // bas, c'est-à-dire précisément sous le tiroir. Ce qu'on veut savoir, ce
    // n'est pas si le navigateur défile chichement, c'est si ce geste PEUT se
    // trouver à découvert.
    await poser.first().evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    const vise = await page.evaluate(() => {
      const cible = document.querySelector<HTMLElement>('[data-atlas="poser-le-morceau"]');
      if (!cible) return null;
      const b = cible.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return null;
      const bandes = [...document.querySelectorAll<HTMLElement>("*")]
        .filter((e) => getComputedStyle(e).position === "fixed")
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 8);
      return {
        hauteur: b.height,
        recouvert: bandes.some(
          (r) => b.top < r.bottom && b.bottom > r.top && b.left < r.right && b.right > r.left
        ),
      };
    });
    if (!vise) throw new Error("« Poser ici » n'a pas de boîte mesurable : rien n'est mesuré");
    if (vise.recouvert) throw new Error("« Poser ici » passe sous une bande fixe : il ne se vise pas");
    if (vise.hauteur < 44) {
      throw new Error(`« Poser ici » ne fait que ${Math.round(vise.hauteur)} px de haut`);
    }

    const accueil = await ligne.getAttribute("data-bloc");
    await poser.first().click();
    await page.waitForTimeout(1600);
    const poses = await creneauxEnBase(chantierId);
    if (poses.join(" | ") !== attendus([`${jourA} apres_midi`, `${jourB} ${accueil}`])) {
      throw new Error(
        `la base porte « ${poses.join(" | ") || "rien"} » au lieu de l'après-midi du ${jourA} ` +
          `et du ${accueil} du ${jourB}`
      );
    }
  });

  await cas("le morceau reposé ne réclame plus de place", async () => {
    // Le chantier demande deux demi-journées et en occupe deux : plus rien
    // n'attend. Une ligne qui resterait ferait poser une troisième moitié.
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await ouvrirLeTiroirDuPlanning(page);
    if ((await page.locator(`[data-atlas="morceau-a-poser"][data-chantier="${chantierId}"]`).count()) !== 0) {
      throw new Error("la demi-journée reposée réclame encore une place : elle serait posée deux fois");
    }
  });

  // **On rend la base comme on l'a trouvée** : les jours retenus ici sont ceux
  // que les autres suites cherchent libres, et une suite qui salit la base
  // accuse la suivante (`CLAUDE.md` §5).
  // **On ne l'EFFACE pas** : son devis le retient (`devis_chantier_entreprise_fk`),
  // et forcer la suppression demanderait de connaître par cœur tout ce qui pend
  // au chantier — une liste qui divergera au premier ajout. On le rend à
  // « Sans date », ce que fait déjà « Retirer » : les deux jours redeviennent
  // libres pour les suites suivantes.
  await pool.query("DELETE FROM creneaux_chantier WHERE chantier_id = $1", [chantierId]);
  await pool.query(
    "UPDATE chantiers SET date_planifiee = NULL, creneau_debut = NULL WHERE id = $1",
    [chantierId]
  );

  await navigateur.close();
  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ Libérer une demi-journée — ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ Une demi-journée se rend, attend en bas, et se repose ailleurs.");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
