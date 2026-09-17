import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import type { Page } from "playwright";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { fermerLeTiroirDuPlanning, ouvrirLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { jourDuPatron } from "./_jour-e2e";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// DÉPLACER PAR LE CALENDRIER — le jour, puis le moment (17 septembre 2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// **Sa demande :** *« lorsque je clique sur déplacer ça me fait apparaître le
// planning et je sélectionne un jour et le matin ou l'aprem ou journée pour
// réellement déplacer mon client, parce que là c'est trop de clics à faire »*.
// Puis, devant `appli/deplacer-sur-le-calendrier.html` : *« je choisis la deux,
// le planning au-dessus, et la A : on déplace que la demi-journée du jour
// sélectionné »*.
//
// **CE QUE CETTE SUITE REMPLACE.** Elle éprouvait le geste d'avant — rendre une
// demi-journée au tiroir du bas, aller l'y reprendre, la reposer ailleurs : sept
// appuis. Le patron l'a fait retirer ; un contrôle qui réclamerait ce qu'il a
// fait enlever rendrait son écran impossible à changer (`CLAUDE.md` §5 bis).
//
// ─── POURQUOI ELLE ENTRE PAR L'ÉCRAN ───────────────────────────────────────
//
// `scripts/test-creneaux-chantier.ts` éprouve déjà les règles pures, et
// l'action serveur a sa garde. **Aucun des deux ne dit si le geste est
// ATTEIGNABLE** — c'est la faute du 28 août 2026 (`CLAUDE.md` §5 quater) : six
// gestes livrés, tous verts, aucun joignable, parce que les contrôles
// construisaient la demande à la main au lieu de la faire naître de l'écran.
//
// On compte donc ses appuis, on parcourt son chemin, **et l'on regarde la base
// après** — l'écran est optimiste, il repeint avant que le serveur ait répondu.
//
// Usage : npm run test:e2e -- --seulement deplacer-sur-le-calendrier

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
    return `${r.jour} ${r.demi}`;
  });
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
  console.log("=== Déplacer par le calendrier : le jour, puis le moment ===\n");

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
  const NOM = `Déplacer ${Date.now()}`;
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

  await cas("« Déplacer » allume le calendrier et fait taire la rangée", async () => {
    /*
     * **Sa demande :** *« ça me fait apparaître le planning »*. Les deux gestes
     * de la carte se taisent alors — sans quoi « Déplacer » et « Retirer »
     * restent offerts pendant qu'un troisième attend sa réponse. Ce défaut-là a
     * été vu À L'ÉCRAN, jamais par un test (`CLAUDE.md` §5).
     */
    const carte = await allerAuJour(jourA);
    await carte
      .locator(`[data-atlas="bloc-chantier"][data-chantier="${chantierId}"] [data-atlas="deplacer"]`)
      .click();
    await page.waitForTimeout(300);
    const bandeau = page.locator('[data-atlas="deplacement-en-cours"]');
    if ((await bandeau.count()) !== 1) {
      throw new Error("aucun bandeau de déplacement : le geste ne s'ouvre pas");
    }
    // **DANS LA FICHE, sa planche du 17 septembre 2026.** Posé ailleurs, il se
    // cherche : le doigt vient de toucher « Déplacer » ici même.
    if ((await carte.locator('[data-atlas="deplacement-en-cours"]').count()) !== 1) {
      throw new Error("le geste ne se dessine pas dans la fiche du jour");
    }
    if (!/touchez le jour/i.test(await bandeau.innerText())) {
      throw new Error(`le bandeau ne demande pas le jour — lu : « ${await bandeau.innerText()} »`);
    }
    if ((await page.locator('[data-atlas="deplacer"]').count()) !== 0) {
      throw new Error("« Déplacer » est resté offert pendant son propre geste");
    }
    if ((await page.locator('[data-atlas="retirer"]').count()) !== 0) {
      throw new Error("« Retirer » est resté offert pendant le déplacement");
    }
  });

  await cas("le nom du chantier n'est écrit QU'UNE FOIS dans la carte", async () => {
    /*
     * ─── SA CAPTURE DU 17 SEPTEMBRE 2026, ET SA RÉPONSE « la 1 » ──────────
     * Sur son écran, « Mr. Linotte » était écrit deux fois dans la même
     * carte, à quatre lignes d'écart : en titre du chantier, puis devant la
     * consigne de déplacement. Planche `appli/deplacer-la-consigne.html`,
     * question 2 — il a retenu « sans le nom ».
     *
     * **La racine.** `BandeauDeplacement` est écrit une fois et monté à deux
     * places. Sous le calendrier — quand le mois tourné a emporté la fiche —
     * le nom est la seule chose qui dise ce qu'on déplace : il y reste. Dans
     * la fiche il est déjà au-dessus, et c'est une redite (`CLAUDE.md` §3,
     * « le moins de mots possible »).
     *
     * **On compte sur le TEXTE RENDU, pas sur un repère** : c'est ce que son
     * œil lit, et cela survit à tout remaniement de la carte.
     */
    const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${jourA}"]`);
    const lu = await carte.innerText();
    const fois = lu.split(NOM).length - 1;
    if (fois !== 1) {
      throw new Error(
        `« ${NOM} » est écrit ${fois} fois dans la carte du ${jourA} : ` +
          "le nom se redit là où il est déjà en titre"
      );
    }

    // ET IL RESTE SOUS LE CALENDRIER, où la fiche n'est plus là pour le dire.
    // Sans cette moitié, le contrôle laisserait passer un retrait des DEUX
    // montages — et il ne saurait plus ce qu'il déplace après avoir tourné le
    // mois (`CLAUDE.md` §5 bis : viser la règle, pas le libellé).
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(400);
    const repli = page.locator('[data-atlas="deplacement-en-cours"]');
    if ((await repli.count()) !== 1) {
      throw new Error("le geste s'est perdu en tournant le mois");
    }
    if (!(await repli.innerText()).includes(NOM)) {
      throw new Error(
        "sous le calendrier, le bandeau ne dit plus QUEL chantier il déplace — " +
          `lu : « ${await repli.innerText()} »`
      );
    }
    await page.click('button[aria-label="Mois précédent"]');
    await page.waitForTimeout(400);
  });

  await cas("le jour se touche DANS LE CALENDRIER, et les moments s'offrent", async () => {
    // **Le calendrier ne fait plus ce qu'il fait d'habitude** : toucher un jour
    // ouvrait sa fiche, ce qui aurait emporté le geste au premier appui.
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jourB}"]`);
    await page.waitForTimeout(400);
    const bandeau = page.locator('[data-atlas="deplacement-en-cours"]');
    if ((await bandeau.getAttribute("data-vers")) !== jourB) {
      throw new Error(
        `le bandeau vise « ${await bandeau.getAttribute("data-vers")} » au lieu du ${jourB} : ` +
          "le jour touché n'est pas devenu la destination"
      );
    }
    // **LES TROIS MOTS, sur une journée entière — sa correction du 17 septembre
    // 2026 :** *« un chantier d'une journée, si je veux je dois pouvoir déplacer
    // soit le matin, soit l'aprem quand même ! »*. Le mot désigne la moitié qui
    // part ; l'autre reste sur place.
    const mots = await page.locator('[data-atlas^="vers-"]').allInnerTexts();
    if (mots.join("|") !== "Matin|Après-midi|Journée") {
      throw new Error(
        `les mots offerts sont « ${mots.join(", ")} » : il ne peut plus déplacer une seule moitié`
      );
    }
  });

  await cas("« Annuler » referme le geste sans rien écrire", async () => {
    // Sa règle du 16 septembre 2026 : un geste ouvert a toujours une sortie qui
    // n'écrit pas. On mesure les deux moitiés — l'écran ET la base.
    const avantAnnulation = await creneauxEnBase(chantierId);
    await page.locator('[data-atlas="annuler-deplacer"]').click();
    await page.waitForTimeout(1200);
    if ((await page.locator('[data-atlas="deplacement-en-cours"]').count()) !== 0) {
      throw new Error("le bandeau est resté ouvert après « Annuler »");
    }
    const apres = await creneauxEnBase(chantierId);
    if (apres.join(" | ") !== avantAnnulation.join(" | ")) {
      throw new Error(
        `« Annuler » a touché la base : « ${apres.join(" | ") || "rien"} » au lieu de ` +
          `« ${avantAnnulation.join(" | ")} »`
      );
    }
  });

  await cas("TROIS APPUIS déplacent la journée, et le serveur l'écrit", async () => {
    /*
     * **Le compte est le sujet du lot :** *« c'est trop de clics à faire »*. Le
     * geste d'avant en demandait sept — Déplacer, la moitié à rendre, ouvrir le
     * tiroir, toucher le morceau, refermer, ouvrir le jour d'accueil, Poser ici.
     */
    const carte = await allerAuJour(jourA);
    let appuis = 0;
    await carte
      .locator(`[data-atlas="bloc-chantier"][data-chantier="${chantierId}"] [data-atlas="deplacer"]`)
      .click();
    appuis++;
    await page.waitForTimeout(300);
    await page.click(`[data-atlas="grille-mois"] [data-jour="${jourB}"]`);
    appuis++;
    await page.waitForTimeout(300);
    await page.locator('[data-atlas="vers-journee"]').click();
    appuis++;
    await page.waitForTimeout(2000);
    if (appuis !== 3) throw new Error(`${appuis} appuis au lieu de trois`);

    const poses = await creneauxEnBase(chantierId);
    if (poses.join(" | ") !== attendus([`${jourB} matin`, `${jourB} apres_midi`])) {
      throw new Error(
        `la base porte « ${poses.join(" | ") || "rien"} » au lieu de la journée du ${jourB}`
      );
    }
  });

  await cas("rechargé, le jour de départ est LIBRE et le jour d'accueil est pris", async () => {
    // **On recharge, sinon on mesure l'espoir de l'écran** : il repeint avant
    // que le serveur réponde, et un jour qu'il croit libre mais qui reste pris
    // se découvre le matin du chantier.
    const depart = await allerAuJour(jourA);
    const restants = await depart.locator('[data-atlas="bloc-chantier"]').count();
    if (restants !== 0) {
      throw new Error(`le jour de départ porte encore ${restants} chantier(s)`);
    }
    const accueil = await allerAuJour(jourB);
    if ((await accueil.locator(`[data-chantier="${chantierId}"]`).count()) !== 1) {
      throw new Error("le chantier n'apparaît pas sur son jour d'accueil");
    }
  });

  await cas("il ne réclame aucune place : rien n'a été perdu en route", async () => {
    // **Le cas qui rétrécit en silence** : deux demi-journées partent, une
    // seule arrive, et personne ne le voit avant le jour du chantier.
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await ouvrirLeTiroirDuPlanning(page);
    if ((await page.locator(`[data-atlas="morceau-a-poser"][data-chantier="${chantierId}"]`).count()) !== 0) {
      throw new Error("une demi-journée s'est perdue pendant le déplacement");
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SES DEUX PANNES DU 16 SEPTEMBRE 2026 — reprises ici, par un autre chemin
  // ═════════════════════════════════════════════════════════════════════════
  //
  // **Elles ont été trouvées et corrigées par la session voisine**, avec leurs
  // contrôles, dans la suite qui portait l'ancien geste. Celui-ci a disparu le
  // 17 septembre — « Déplacer » ne libère plus, il déplace — et ses deux cas
  // entraient par l'interrupteur matin / après-midi, qui n'existe plus.
  //
  // **Ce qu'ils défendent, lui, existe toujours** : un chantier qui DEMANDE
  // plus qu'il n'occupe laisse une demi-journée dans le tiroir du bas, et elle
  // se repose. Les deux pannes vivent là, pas dans le geste qui les produisait.
  // On monte donc l'état en base — la seule chose qu'on ne peut plus faire à
  // l'écran — et l'on rejoue SA séquence à partir de là.
  //
  // Les jeter aurait été le vrai coût du lot : un correctif dont le contrôle
  // part avec le geste qui l'a révélé revient au premier remaniement.

  /** Poser ce chantier sur une seule moitié, alors qu'il en demande deux. */
  const posePartielle = async (jour: string, demi: string) => {
    await pool.query("DELETE FROM creneaux_chantier WHERE chantier_id = $1", [chantierId]);
    await pool.query(
      `INSERT INTO creneaux_chantier (chantier_id, entreprise_id, jour, demi)
       SELECT $1, entreprise_id, $2::date, $3::text FROM chantiers WHERE id = $1`,
      [chantierId, jour, demi]
    );
    await pool.query(
      `UPDATE chantiers SET date_planifiee = $2, creneau_debut = $3, duree_demi_journees = 2
        WHERE id = $1`,
      [chantierId, jour, demi]
    );
  };

  await cas("RETIRÉ puis reposé ailleurs, sans recharger : aucun morceau fantôme", async () => {
    /*
     * *« J'ai essayé de poser la demi-journée retirée de Mr Julien mais
     * impossible ? »* — et l'écran répondait « Cette demi-journée n'a pas pu
     * être reposée. » sur un jour qui s'annonçait libre matin ET après-midi.
     *
     * **Aucun geste n'est en cause pris seul — c'est leur SUITE**, sans
     * rechargement : `poser` ne rendait que trois colonnes, l'écran gardait ses
     * demi-journées d'avant, peignait le chantier sur son ancien jour, et
     * comptait une moitié en attente d'une place qui n'existait qu'à l'écran.
     * Le serveur refusait, à juste titre.
     *
     * **Ce cas ne recharge pas une seule fois**, et c'est tout son objet : les
     * autres rechargent, ce qui efface justement l'état faux qu'on cherche
     * (`CLAUDE.md` §5 quater — on éprouve SA séquence, pas notre geste).
     */
    await posePartielle(jourA, "matin");
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await fermerLeTiroirDuPlanning(page);

    const carte = await allerAuJour(jourA);
    const bloc = carte.locator(`[data-atlas="bloc-chantier"][data-chantier="${chantierId}"]`);
    if ((await bloc.count()) === 0) {
      throw new Error(`le chantier n'est pas sur le ${jourA} : le montage de ce cas est faux`);
    }
    await bloc.locator('[data-atlas="retirer"]').click();
    await page.waitForTimeout(1600);

    // On le repose depuis le tiroir, SANS recharger.
    await ouvrirLeTiroirDuPlanning(page);
    const ligne = page.locator('[data-atlas="sans-date"]').filter({ hasText: NOM });
    if ((await ligne.count()) === 0) {
      throw new Error("le chantier retiré n'apparaît pas dans « Sans date » : il est perdu pour lui");
    }
    await ligne.locator('[data-poser="1"]').first().click();
    await page.waitForTimeout(1800);

    // **Ce que l'écran en dit, sans rechargement.** Un morceau qui reste ici
    // n'existe qu'à l'écran : le reposer sera REFUSÉ, et c'est exactement le
    // message qu'il a photographié.
    const morceau = page.locator(`[data-atlas="morceau-a-poser"][data-chantier="${chantierId}"]`);
    if ((await morceau.count()) !== 0) {
      throw new Error(
        "le tiroir réclame encore une demi-journée alors que la base a tout posé : " +
          "c'est le morceau fantôme du 16 septembre, et le serveur refusera de le poser"
      );
    }
  });

  await cas("la moitié rendue se remet AU MÊME ENDROIT, sous le nom du chantier", async () => {
    /*
     * *« Je l'ai enlevée puis j'ai essayé de la remettre au même endroit, ça a
     * bugué. »* Le matin libre, l'après-midi gardé par le chantier : il reprend
     * le morceau, touche le matin — et il n'y a rien à toucher.
     *
     * **Une moitié libre QUI PRÉCÈDE un chantier se dessine sous son nom**
     * (`libresAvant`, sa précision du 10 septembre : *« le nom doit rester en
     * premier, ensuite matin et ensuite aprèm »*). `LigneLibre` est écrite une
     * fois et montée à deux endroits ; seul le montage de queue recevait
     * « Poser ici ». La moitié attendue tombait donc dans le montage muet dès
     * que le chantier garde son après-midi — le cas le plus courant.
     */
    await posePartielle(jourB, "apres_midi");
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    await ouvrirLeTiroirDuPlanning(page);
    const morceau = page.locator(`[data-atlas="morceau-a-poser"][data-chantier="${chantierId}"]`);
    if ((await morceau.count()) !== 1) {
      throw new Error("la demi-journée qui manque n'attend nulle part : elle est perdue pour lui");
    }
    await morceau.click();
    await page.waitForTimeout(300);
    if ((await morceau.getAttribute("aria-pressed")) !== "true") {
      throw new Error("le morceau touché ne s'annonce pas tenu : la prise n'a pas eu lieu");
    }
    await fermerLeTiroirDuPlanning(page);

    await page.click(`[data-atlas="grille-mois"] [data-jour="${jourB}"]`);
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jourB}"]`, { timeout: 15_000 });
    await page.waitForTimeout(400);

    // **LA LIGNE QU'IL VEUT REMPLIR, ET AUCUNE AUTRE** : elle est dessinée sous
    // le nom du chantier, pas en queue de journée.
    const ligneMatin = page.locator(
      `[data-atlas="carte-jour"][data-jour="${jourB}"] [data-atlas="demi"][data-bloc="matin"][data-sans-chantier="1"]`
    );
    if ((await ligneMatin.count()) === 0) {
      throw new Error(`le matin du ${jourB} n'est pas annoncé libre : la carte ne montre pas ce qui manque`);
    }
    const poser = ligneMatin.locator('[data-atlas="poser-le-morceau"]');
    if ((await poser.count()) === 0) {
      throw new Error(
        "aucun « Poser ici » sur la demi-journée libre sous le nom du chantier, alors qu'il tient " +
          "le morceau : elle ne peut pas se remettre au même endroit"
      );
    }
    await poser.first().click();
    await page.waitForTimeout(1600);

    const poses = await creneauxEnBase(chantierId);
    if (poses.join(" | ") !== attendus([`${jourB} matin`, `${jourB} apres_midi`])) {
      throw new Error(
        `la base porte « ${poses.join(" | ") || "rien"} » au lieu des deux moitiés du ${jourB}`
      );
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
    console.error(`\n❌ Déplacer par le calendrier — ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ Trois appuis déplacent ce que le jour porte, et la base suit.");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
