// Les équipes d'un chantier, DEMI-JOURNÉE PAR DEMI-JOURNÉE.
//
// **Ses deux demandes du 21 août 2026**, éprouvées sur la planche 84 puis
// codées (migration 0058) :
//
//   · *« lorsque je choisis une équipe je dois pouvoir mettre TOUTES les
//     équipes si je le souhaite, le même jour ou même sur la même demi-journée.
//     Je dois pouvoir mettre tout le monde le matin puis tout le monde
//     l'aprem. »*
//   · *« sur Mr. Leroy, qui dure toute la journée, je ne peux pas mettre juste
//     Paul le matin et Julien et Paul l'après-midi — si je mets les deux
//     l'après-midi, ça me les met aussi le matin. Il faut que tout soit
//     INDÉPENDANT. »*
//
// CE QUE CETTE SUITE TIENT :
//
//   · L'INDÉPENDANCE des deux moitiés — c'est le défaut qu'il a nommé ;
//   · PLUSIEURS équipes sur la même demi-journée ;
//   · LE MÊME APPUI COCHE PUIS DÉCOCHE ;
//   · RIEN N'EST REFUSÉ, même quand l'équipe travaille déjà ailleurs au même
//     moment. C'est sa décision du 21 août : *« il ne doit pas y avoir de
//     limite [...] nous, on prévient juste »*. L'ancienne version levait
//     `EquipeIndisponible` ; ce contrôle-ci défend l'inverse, et il rougirait
//     si le refus revenait ;
//   · LA DATE NE BOUGE PAS — c'est toute la promesse de l'écran ;
//   · L'ISOLATION : une autre entreprise ne voit rien et ne coche rien. Le
//     chemin passe par la RLS, jamais par la discipline du code.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import {
  creerChantier,
  planifierChantier,
  basculerEquipeDuChantier,
  deplacerChantier,
  listerChantiersPourPlanning,
  mettreAJourDureeEquipe,
} from "../src/server/repositories/chantiers";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Un lundi loin devant : le planning refuse les jours passés. */
const JOUR = "2027-03-15";

/**
 * Marquer le devis envoyé, en base et sans passer par l'écran d'envoi.
 *
 * `listerChantiersPourPlanning` ne rend que les chantiers dont le devis est
 * parti — c'est la règle du produit, pas un détail de la suite. Simuler l'envoi
 * complet ferait dépendre ce contrôle-ci de la messagerie, du PDF et du
 * stockage : trois pannes possibles pour une question qui n'en parle pas.
 */
async function marquerDevisEnvoye(ctx: { entrepriseId: string }, chantierId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctx.entrepriseId]);
    await client.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [chantierId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

async function monter(nombreEquipes: number) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai équipes" },
    { email: `eq-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreAJourEntreprise(ctx, { nombreEquipes });
  return ctx;
}

async function main() {
  console.log("=== Les équipes, demi-journée par demi-journée ===\n");

  await essai("le matin et l'après-midi sont indépendants", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Mr. Leroy" });
    await planifierChantier(ctx, c.id, JOUR, { quand: "matin" });

    // Paul (rang 2) le matin ; Julien (1) ET Paul (2) l'après-midi.
    await basculerEquipeDuChantier(ctx, c.id, "matin", 2);
    await basculerEquipeDuChantier(ctx, c.id, "apres_midi", 1);
    const etat = await basculerEquipeDuChantier(ctx, c.id, "apres_midi", 2);

    assert.deepEqual(etat?.matin, [2], "le matin a bougé alors qu'on touchait l'après-midi");
    assert.deepEqual(etat?.apres_midi, [1, 2], "l'après-midi ne porte pas les deux");
  });

  await essai("toutes les équipes tiennent sur la même demi-journée", async () => {
    await nettoyerBase();
    const ctx = await monter(5);
    const c = await creerChantier(ctx, { nom: "Gros chantier" });
    await planifierChantier(ctx, c.id, JOUR, { quand: "matin" });
    for (const rang of [1, 2, 3, 4, 5]) {
      await basculerEquipeDuChantier(ctx, c.id, "matin", rang);
    }
    const etat = await basculerEquipeDuChantier(ctx, c.id, "matin", 5);
    // Le cinquième appui DÉCOCHE : c'est le même geste.
    assert.deepEqual(etat?.matin, [1, 2, 3, 4], "le second appui n'a pas décoché");
  });

  await essai("le même appui coche puis décoche", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Haie" });
    await planifierChantier(ctx, c.id, JOUR, { quand: "matin" });
    const pose = await basculerEquipeDuChantier(ctx, c.id, "matin", 1);
    assert.deepEqual(pose?.matin, [1]);
    const retire = await basculerEquipeDuChantier(ctx, c.id, "matin", 1);
    assert.deepEqual(retire?.matin, [], "l'équipe est restée");
  });

  // **Le contrôle qui défend sa décision du 21 août.** L'ancienne version
  // refusait ici (`EquipeIndisponible`) : elle serait rouge sur ce cas, et
  // c'est exactement ce qu'on veut — le refus ne doit pas revenir.
  await essai("une équipe déjà prise ailleurs n'est PAS refusée", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const a = await creerChantier(ctx, { nom: "Chantier A" });
    const b = await creerChantier(ctx, { nom: "Chantier B" });
    await planifierChantier(ctx, a.id, JOUR, { quand: "matin" });
    await planifierChantier(ctx, b.id, JOUR, { quand: "matin" });
    await basculerEquipeDuChantier(ctx, a.id, "matin", 1);
    const etat = await basculerEquipeDuChantier(ctx, b.id, "matin", 1);
    assert.deepEqual(etat?.matin, [1], "le second chantier n'a pas eu l'équipe");
  });

  // **Les trois boutons ne font pas la même chose** — « Matin » réserve une
  // demi-journée, « Journée » en réserve deux. Sans cela, poser « Matin »
  // bloquerait l'après-midi sans qu'un mot le dise.
  await essai("« Matin », « Après-midi » et « Journée » réservent ce qu'ils disent", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const lu = async (id: string) => {
      await marquerDevisEnvoye(ctx, id);
      return (await listerChantiersPourPlanning(ctx)).find((x) => x.id === id)!;
    };

    const m = await creerChantier(ctx, { nom: "Matin" });
    await planifierChantier(ctx, m.id, JOUR, { quand: "matin" });
    const lm = await lu(m.id);
    assert.equal(lm.creneauDebut, "matin");
    assert.equal(lm.dureeDemiJournees, 1, "« Matin » a réservé la journée entière");

    const a = await creerChantier(ctx, { nom: "Après-midi" });
    await planifierChantier(ctx, a.id, JOUR, { quand: "apres" });
    const la = await lu(a.id);
    assert.equal(la.creneauDebut, "apres_midi");
    assert.equal(la.dureeDemiJournees, 1);

    const j = await creerChantier(ctx, { nom: "Journée" });
    await planifierChantier(ctx, j.id, JOUR, { quand: "journee" });
    const lj = await lu(j.id);
    assert.equal(lj.creneauDebut, "matin");
    assert.equal(lj.dureeDemiJournees, 2, "« Journée » n'a réservé qu'une moitié");
  });

  await essai("un chantier de trois jours garde sa durée quel que soit le bouton", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Terrassement" });
    await mettreAJourDureeEquipe(ctx, c.id, { dureePrevue: "3 jours" });
    await planifierChantier(ctx, c.id, JOUR, { quand: "matin" });
    await marquerDevisEnvoye(ctx, c.id);
    const lu = (await listerChantiersPourPlanning(ctx)).find((x) => x.id === c.id);
    assert.ok(
      (lu?.dureeDemiJournees ?? 0) > 2,
      `« Matin » a raccourci un chantier de trois jours à ${lu?.dureeDemiJournees} demi-journée(s)`
    );
  });

  await essai("cocher une équipe ne touche ni la date ni la demi-journée", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Tonte" });
    await planifierChantier(ctx, c.id, JOUR, { quand: "apres" });
    await basculerEquipeDuChantier(ctx, c.id, "apres_midi", 1);
    await marquerDevisEnvoye(ctx, c.id);
    const [lu] = (await listerChantiersPourPlanning(ctx)).filter((x) => x.id === c.id);
    assert.equal(lu.datePlanifiee, JOUR, "la date a bougé");
    assert.equal(lu.creneauDebut, "apres_midi", "la demi-journée a bougé");
    assert.deepEqual(lu.equipes.apres_midi, [1]);
  });

  await essai("« Déplacer » garde la durée d'un chantier de plusieurs jours", async () => {
    await nettoyerBase();
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Terrassement" });
    // La durée dictée décide du nombre de demi-journées réservées : trois jours
    // font six demi-journées, donc plus qu'une journée — le cas qui compte ici.
    await mettreAJourDureeEquipe(ctx, c.id, { dureePrevue: "3 jours" });
    await planifierChantier(ctx, c.id, JOUR, { quand: "matin" });
    await marquerDevisEnvoye(ctx, c.id);
    const avant = (await listerChantiersPourPlanning(ctx)).find((x) => x.id === c.id);
    assert.ok((avant?.dureeDemiJournees ?? 0) > 2, "le chantier n'est pas assez long pour le cas");

    await deplacerChantier(ctx, c.id, "journee");
    const apres = (await listerChantiersPourPlanning(ctx)).find((x) => x.id === c.id);
    assert.equal(
      apres?.dureeDemiJournees,
      avant?.dureeDemiJournees,
      "« Journée » a raccourci un chantier de trois jours — en silence"
    );
  });

  // **L'isolation ne se suppose pas.** Une entreprise ne coche rien chez
  // l'autre, et n'y lit rien : c'est la RLS qui tranche, jamais un `if`.
  await essai("une autre entreprise ne coche rien et ne lit rien", async () => {
    await nettoyerBase();
    const a = await monter(2);
    const b = await monter(2);
    const chantier = await creerChantier(a, { nom: "Chez A" });
    await planifierChantier(a, chantier.id, JOUR, { quand: "matin" });
    await basculerEquipeDuChantier(a, chantier.id, "matin", 1);

    const refus = await basculerEquipeDuChantier(b, chantier.id, "matin", 2);
    assert.equal(refus, null, "B a pu toucher le chantier de A");

    await marquerDevisEnvoye(a, chantier.id);
    const chezB = await listerChantiersPourPlanning(b);
    assert.equal(chezB.length, 0, "B voit un chantier de A");

    const chezA = await listerChantiersPourPlanning(a);
    assert.deepEqual(chezA[0].equipes.matin, [1], "A a perdu son équipe");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Équipes par demi-journée — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
