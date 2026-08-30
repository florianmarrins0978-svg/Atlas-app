import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import { planifierChantier, basculerEquipeDuChantier } from "../src/server/repositories/chantiers";
import { nommerEquipe } from "../src/server/repositories/equipes";
import { jourIso } from "../src/lib/jour";
import type { Ctx } from "../src/server/repositories/context";

// UN SALARIÉ, DANS UN VRAI NAVIGATEUR, DEVANT SON PLANNING.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LA DÉCISION DU PATRON, 30 AOÛT 2026 :** *« Un salarié peut uniquement
// CONSULTER son planning. Il ne doit pouvoir effectuer AUCUNE modification
// depuis le planning. »*
//
// **Et sa consigne sur la manière**, mot pour mot : *« Ne te contente surtout
// pas de retirer ou masquer les boutons dans l'interface. La sécurité doit être
// imposée CÔTÉ SERVEUR. »*
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE FAIT, ET QU'AUCUNE AUTRE NE PEUT FAIRE.**
//
// `test-salarie-planning-lecture-seule-db.ts` prouve que la garde refuse. Il
// serait vert même si personne ne l'appelait — c'est le raccord qui casse,
// jamais la formule. Ici on **fabrique la requête** :
//
//   1. le patron écrit une note depuis SON planning. On INTERCEPTE l'appel :
//      son adresse, son en-tête `Next-Action` — l'identifiant de l'action
//      serveur — et son corps ;
//   2. on rejoue **exactement** cette requête avec le cookie du SALARIÉ, sur un
//      chantier dont il connaît l'identifiant ;
//   3. on relit la base.
//
// C'est le scénario que le patron décrit : quelqu'un qui connaît l'identifiant
// de l'action et celui du chantier, et qui poste sans passer par un bouton. La
// note doit être intacte.
//
// **Et l'inverse est éprouvé aussi** : la même requête, rejouée par le patron,
// écrit pour de bon. Sans cette moitié, on serait vert en ayant cassé l'action
// pour tout le monde.
//
// ═══════════════════════════════════════════════════════════════════════════
// **UNE SEULE ACTION EST FORGÉE, ET C'EST ASSUMÉ.** Capturer les six
// demanderait six gestes du patron dont deux détruisent (supprimer,
// déplanifier). Ce qui se prouve ici est le MÉCANISME — une action du planning
// postée à la main est refusée. Que les six le portent est prouvé fichier par
// fichier par la suite base, qui rougit si l'une l'oublie.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";
/**
 * **LES CAPTURES SONT UNE PIÈCE DU CONTRÔLE, PAS UNE FINITION.**
 *
 * Quatre défauts réels de ce dépôt sont sortis d'une image regardée, et
 * d'aucun test vert (`CLAUDE.md` §5). Ici l'image dit ce qu'aucune assertion ne
 * sait dire : est-ce que l'écran du salarié, une fois vidé de ses commandes,
 * reste un écran — ou une page trouée.
 */
const CAPTURES = "artifacts/screenshots/salarie-planning-lecture-seule";
const MOT_DE_PASSE = "trois-mots-courts";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Le planning du salarié, dans un navigateur ===\n");

  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
       JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire'
      LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration n'est pas patron : la base n'est pas amorcée");
  const ctxPatron: Ctx = { utilisateurId: rows[0].u, entrepriseId: rows[0].e };

  /**
   * **Le chantier est POSÉ ICI, il ne se cherche pas dans le jeu de démo.**
   *
   * Le jeu de démonstration n'en planifie aucun — la première version de cette
   * suite s'est arrêtée là-dessus. Le chercher aurait fait dépendre le contrôle
   * d'un jeu de données qui n'a pas été écrit pour lui, et l'aurait rendu vert
   * ou rouge au gré du seed. On le pose, sur aujourd'hui, et la fiche du jour
   * s'ouvre à coup sûr.
   */
  const { rows: cibles } = await pool.query(
    `SELECT id, nom FROM chantiers
      WHERE entreprise_id = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    [ctxPatron.entrepriseId]
  );
  assert.ok(cibles[0], "aucun chantier dans le jeu de démonstration : la base n'est pas amorcée");
  const chantier = cibles[0];
  await planifierChantier(ctxPatron, chantier.id, jourIso(new Date()));

  /**
   * **L'ENTREPRISE DOIT AVOIR DES SALARIÉS, SINON LA MOITIÉ DU CONTRÔLE DORT.**
   *
   * Payé le 30 août 2026, et c'est la batterie qui l'a montré : cette suite
   * passait au vert seule et rougissait en batterie. La pastille d'équipe ne se
   * dessine qu'à partir d'UN salarié (`src/lib/equipes.ts` — on n'invente pas
   * une organisation à un artisan seul). Le jeu de démonstration en compte
   * zéro : la branche n'était donc jamais rendue, et « aucune pastille » passait
   * pour un succès sans que rien n'ait été mesuré.
   *
   * C'est exactement le défaut que `CLAUDE.md` §5 nomme : **un contrôle qui
   * mesure zéro ne mesure rien.** On pose donc le décor, et on vérifie qu'il a
   * pris.
   */
  await pool.query(`UPDATE entreprises SET nombre_salaries = 2 WHERE id = $1`, [
    ctxPatron.entrepriseId,
  ]);
  const { rows: effectif } = await pool.query(
    `SELECT nombre_salaries AS n FROM entreprises WHERE id = $1`,
    [ctxPatron.entrepriseId]
  );
  assert.equal(Number(effectif[0].n), 2, "l'effectif n'a pas été posé : la pastille d'équipe ne sera pas rendue");

  /**
   * **ET QUELQU'UN DOIT ÊTRE COCHÉ SUR CE CHANTIER.**
   *
   * Seconde moitié du même piège, trouvée à la batterie suivante : la pastille
   * de lecture ne s'affiche que s'il y a un nom à lire — sans personne, elle
   * rend `null`, ce qui est juste (une pastille vide est une invitation à
   * cocher, et lui ne peut pas). Le contrôle « qui part lui est dit quand
   * même » mesurait donc l'absence de décor, pas un défaut du produit.
   */
  await nommerEquipe(ctxPatron, 1, "Malik");
  const coche = await basculerEquipeDuChantier(ctxPatron, chantier.id, "matin", 1);
  assert.ok(coche && coche.matin.includes(1), "personne n'a été coché : le nom d'équipe ne sera pas rendu");

  const email = `salarie-lecture-${Date.now()}@essai.local`;
  const donne = await donnerUnAcces(ctxPatron, {
    nom: "Malik Benali",
    email,
    motDePasse: MOT_DE_PASSE,
    confirmation: MOT_DE_PASSE,
    role: "salarie",
  });
  assert.deepEqual(donne, { ok: true }, "le compte du salarié n'a pas pu être créé");

  // Les documents légaux, acceptés d'avance : un compte neuf est renvoyé à
  // `/documents-legaux`, et cette garde-là s'exécute avant celle des rôles.
  // Sans cela la suite éprouverait le passage obligé par les conditions, qui a
  // sa propre suite, au lieu du droit d'écriture.
  const lui = (await listerAcces(ctxPatron)).find((l) => l.email === email)!;
  const aAccepter = await documentsAAccepter(lui.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(
      lui.utilisateurId,
      aAccepter.map((d) => d.id),
      { adresseIp: "127.0.0.1", agentUtilisateur: "suite d'essai" }
    );
  }

  mkdirSync(CAPTURES, { recursive: true });
  const navigateur = await lancerNavigateur();

  // ─── LE PATRON : on capture SA requête d'écriture ────────────────────────
  const ctxP = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const pageP = await ctxP.newPage();
  await pageP.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await pageP.fill('input[name="email"]', "demo@atlas.local");
  await pageP.fill('input[name="password"]', "demo1234");
  await pageP.click('button[type="submit"]');
  await pageP.waitForURL(`${BASE}/`, { timeout: 30_000 });

  /**
   * **On lit la requête au vol, on ne la devine pas.**
   *
   * L'identifiant d'une action serveur est fabriqué à la compilation : l'écrire
   * en dur ici ferait rougir la suite au prochain build, sur une fausse alerte.
   * On écoute donc ce que le navigateur envoie réellement — c'est aussi ce que
   * ferait quelqu'un qui regarde son propre trafic.
   */
  type Capturee = { url: string; enTetes: Record<string, string>; corps: string };
  let capturee: Capturee | null = null;
  pageP.on("request", (r) => {
    if (r.method() !== "POST") return;
    const enTetes = r.headers();
    if (!enTetes["next-action"]) return;
    const corps = r.postData() ?? "";
    // Celle du pense-bête, reconnue à son argument : l'identifiant du chantier
    // suivi du texte. Les autres actions de l'écran ne portent pas ce couple.
    if (!corps.includes(chantier.id)) return;
    capturee = { url: r.url(), enTetes, corps };
  });

  const MARQUE = `essai-forge-${Date.now()}`;
  await cas("le patron écrit une note depuis son planning — on capture l'appel", async () => {
    await pageP.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    // **On vise l'identifiant, jamais le libellé** : si le patron fait renommer
    // un chantier demain, ce contrôle défend encore quelque chose
    // (`CLAUDE.md` §5 bis). La fiche s'ouvre en touchant le nom de la ligne.
    const ligne = pageP.locator(`[data-chantier="${chantier.id}"] [data-atlas="nom-planifie"]`);
    await ligne.waitFor({ state: "visible", timeout: 30_000 });
    await ligne.click();
    const zone = pageP.locator('[data-atlas="note-chantier"]').first();
    await zone.waitFor({ state: "visible", timeout: 30_000 });
    await zone.fill(MARQUE);
    // Elle s'enregistre en SORTANT du cadre — jamais par un bouton.
    await zone.blur();
    await pageP.waitForFunction(
      () => document.querySelector('[data-atlas="note-etat"]')?.textContent?.includes("Enregistré"),
      undefined,
      { timeout: 30_000 }
    );
    const { rows: apres } = await pool.query(`SELECT note FROM chantiers WHERE id = $1`, [chantier.id]);
    assert.equal(apres[0].note, MARQUE, "la note du patron n'a pas été écrite : rien n'a été capturé");
    assert.ok(capturee, "aucune requête d'action serveur n'a été interceptée : la suite ne mesurerait rien");
  });

  // ─── LE SALARIÉ : il rejoue la MÊME requête ──────────────────────────────
  const ctxS = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const pageS = await ctxS.newPage();

  await cas("le salarié ouvre bien son planning — sinon la suite n'éprouve rien", async () => {
    await pageS.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await pageS.fill('input[name="email"]', email);
    await pageS.fill('input[name="password"]', MOT_DE_PASSE);
    await pageS.click('button[type="submit"]');
    await pageS.waitForURL(`${BASE}/planning`, { timeout: 30_000 });
  });

  await cas("LA REQUÊTE FORGÉE EST REFUSÉE — la note reste celle du patron", async () => {
    const c = capturee!;
    const forgee = c.corps.replace(MARQUE, "écrit par le salarié");
    assert.notEqual(forgee, c.corps, "le corps n'a pas été modifié : on rejouerait la même écriture");

    const reponse = await pageS.request.post(c.url, {
      headers: {
        // **Les mêmes en-têtes**, cookie mis à part : c'est le contexte du
        // salarié qui porte le sien. Reproduire l'appel à l'identique est tout
        // l'objet — un refus obtenu en changeant la requête ne prouverait rien.
        "next-action": c.enTetes["next-action"],
        "content-type": c.enTetes["content-type"] ?? "text/plain;charset=UTF-8",
      },
      data: forgee,
    });

    const { rows: apres } = await pool.query(`SELECT note FROM chantiers WHERE id = $1`, [chantier.id]);
    assert.equal(
      apres[0].note,
      MARQUE,
      `LA NOTE A ÉTÉ RÉÉCRITE PAR LE SALARIÉ (réponse ${reponse.status()}) : ` +
        "la garde serveur ne tient pas, et cacher les boutons ne servait à rien"
    );
  });

  await cas("LA MÊME REQUÊTE, REJOUÉE PAR LE PATRON, ÉCRIT — on n'a pas cassé l'action", async () => {
    // Sans cette moitié, on serait vert en ayant rendu le pense-bête
    // inutilisable pour tout le monde : le refus serait alors une panne, pas
    // une garde.
    const c = capturee!;
    const AUTRE = `${MARQUE}-suite`;
    await pageP.request.post(c.url, {
      headers: {
        "next-action": c.enTetes["next-action"],
        "content-type": c.enTetes["content-type"] ?? "text/plain;charset=UTF-8",
      },
      data: c.corps.replace(MARQUE, AUTRE),
    });
    const { rows: apres } = await pool.query(`SELECT note FROM chantiers WHERE id = $1`, [chantier.id]);
    assert.equal(apres[0].note, AUTRE, "le patron non plus n'écrit plus : la garde refuse tout le monde");
  });

  // ─── L'ÉCRAN NE PROPOSE AUCUN GESTE D'ÉCRITURE ───────────────────────────
  await cas("son écran ne montre AUCUNE commande de modification", async () => {
    /**
     * **Le complément, jamais le fond.** Le serveur refuse déjà ; ceci vérifie
     * qu'on ne lui propose pas des boutons qui répondraient « action
     * indisponible » — un refus sans explication se lit comme une panne, et il
     * appellerait le patron un lundi matin.
     *
     * On lit des MARQUEURS de structure, jamais des libellés : si le patron
     * fait renommer « Déplacer » demain, ce contrôle défend encore quelque
     * chose (`CLAUDE.md` §5 bis).
     */
    await pageS.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await pageS.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30_000 });
    // On DÉPLIE la journée : les gestes d'écriture vivent dans la fiche du
    // jour, pas sur le calendrier. Sans ce geste, l'absence ne prouverait rien
    // — c'est un contrôle qui mesurerait zéro (`CLAUDE.md` §5).
    const ligne = pageS.locator(`[data-chantier="${chantier.id}"] [data-atlas="nom-planifie"]`);
    await ligne.waitFor({ state: "visible", timeout: 30_000 });
    await ligne.click();
    await pageS.waitForSelector('[data-atlas="feuille"], [data-atlas="bloc-chantier"]', { timeout: 30_000 });

    // **On vérifie d'abord que la journée est bien DÉPLIÉE**, sinon les six
    // absences ci-dessous ne prouveraient qu'une chose : que rien n'est affiché.
    assert.ok(
      (await pageS.locator('[data-atlas="demi"]').count()) > 0,
      "la fiche du jour ne s'est pas ouverte : les absences ci-dessous ne mesureraient rien"
    );

    for (const marqueur of [
      '[data-atlas="deplacer"]',
      '[data-atlas="retirer"]',
      '[data-atlas="equipe"]',
      '[data-atlas="note-chantier"]',
      '[data-atlas="titre-sans-date"]',
      '[aria-label="Ajouter un chantier"]',
    ]) {
      assert.equal(
        await pageS.locator(marqueur).count(),
        0,
        `${marqueur} est proposé au salarié : un geste que le serveur refusera`
      );
    }
  });

  await cas("QUI PART lui est dit quand même — en texte, pas en bouton", async () => {
    // La contrepartie du contrôle précédent. Sans elle, on aurait pu tout
    // effacer et croire l'écran sûr : il a besoin de savoir avec qui il part.
    assert.ok(
      (await pageS.locator('[data-atlas="equipe-lecture"]').count()) > 0,
      "l'équipe n'est plus lisible : on a retiré l'information avec le geste"
    );
  });

  await cas("mais il VOIT toujours son planning — on n'a pas fermé en fermant tout", async () => {
    // Le contrôle qui empêche de « sécuriser » par le vide. Sans lui, un écran
    // blanc passerait pour une réussite.
    const lignes = await pageS.locator('[data-atlas="ligne-planifiee"]').count();
    assert.ok(
      lignes > 0,
      "le salarié ne voit plus aucun chantier planifié : la lecture a été fermée avec l'écriture"
    );
    assert.equal(
      await pageS.locator(`[data-chantier="${chantier.id}"]`).count(),
      1,
      "le chantier posé pour cet essai n'apparaît pas chez le salarié"
    );
  });

  await pageS.screenshot({ path: `${CAPTURES}/salarie.png`, fullPage: true });
  await pageP.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await pageP
    .locator(`[data-chantier="${chantier.id}"] [data-atlas="nom-planifie"]`)
    .click()
    .catch(() => undefined);
  await pageP.screenshot({ path: `${CAPTURES}/patron.png`, fullPage: true });

  await navigateur.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Planning du salarié — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("❌ Suite interrompue :", e instanceof Error ? e.message : e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
