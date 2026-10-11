// LES ÉQUIPES JOUR PAR JOUR — en base, par la porte que l'écran emprunte.
//
// **Sa plainte du 15 septembre 2026 :** *« sur le chantier de 8 jours, si je
// mets Antoine et Julien le premier jour, ça les met automatiquement sur les
// 8 jours, ça c'est bien. Mais si le 4e jour je décide de ne pas mettre Julien,
// ça l'enlève partout et ça faut pas ! Ça ne sera pas forcément les mêmes
// équipes tous les jours ! »*
//
// Sa règle, confirmée le même jour : **ajouter → ce jour et les suivants ;
// retirer → ce jour seulement.** La règle pure est éprouvée dans
// `test-equipes-par-jour.ts` ; ici on vérifie que la base la SUIT — les lignes
// d'avant (sans jour), la bascule, le planning qui relit, le chantier qui bouge.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import {
  creerChantier,
  planifierChantier,
  deplanifierChantier,
  basculerEquipeDuChantier,
  listerChantiersPourPlanning,
  mettreAJourDureeEquipe,
} from "../src/server/repositories/chantiers";
import { noterAbsenceEquipe } from "../src/server/repositories/absences-equipe";
import { equipesDuJour } from "../src/lib/equipes-par-jour";
import { creneauxDuChantier } from "../src/lib/disponibilites";

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
const LUNDI = "2027-03-15";
const JOURS = [...new Set(creneauxDuChantier({ jour: LUNDI, moment: "matin" }, 16).map((c) => c.jour))];
const J1 = JOURS[0];
const J4 = JOURS[3];
const ANTOINE = 1;
const JULIEN = 2;

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

/**
 * Une ligne « d'avant » : sans jour, telle que la migration 0093 les laisse.
 * On la fait écrire par la porte ordinaire (sans jour), puis on vérifie en base
 * que c'est bien une ligne sans jour — le contrôle ne suppose rien.
 */
async function poserUneLigneDAvant(
  ctx: { utilisateurId: string; entrepriseId: string },
  chantierId: string,
  demi: "matin" | "apres_midi",
  rang: number
) {
  await basculerEquipeDuChantier(ctx, chantierId, demi, rang);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctx.entrepriseId]);
    const r = await client.query(
      `SELECT jour FROM equipes_du_chantier WHERE chantier_id = $1 AND demi = $2`,
      [chantierId, demi]
    );
    await client.query("COMMIT");
    assert.equal(r.rowCount, 1, "le décor n'est pas une seule ligne");
    assert.equal(r.rows[0].jour, null, "la ligne d'avant porte un jour");
  } finally {
    client.release();
  }
}

async function monter() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai jours" },
    { email: `ej-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreAJourEntreprise(ctx, { nombreEquipes: 2 });
  const c = await creerChantier(ctx, { nom: "Huit jours" });
  await mettreAJourDureeEquipe(ctx, c.id, { dureePrevue: "8 jours" });
  await planifierChantier(ctx, c.id, LUNDI, { demi: "matin" });
  await marquerDevisEnvoye(ctx, c.id);
  const lu = (await listerChantiersPourPlanning(ctx)).find((x) => x.id === c.id);
  assert.equal(lu?.dureeDemiJournees, 16, "le décor n'est pas un chantier de huit jours");
  return { ctx, chantier: c };
}

async function relire(ctx: { utilisateurId: string; entrepriseId: string }, id: string) {
  const lu = (await listerChantiersPourPlanning(ctx)).find((x) => x.id === id);
  assert.ok(lu, "le chantier a disparu du planning");
  return lu;
}

async function main() {
  console.log("=== Les équipes, jour par jour ===\n");

  await essai("SA PLAINTE : retirer Julien le 4e jour ne le retire que ce jour-là", async () => {
    const { ctx, chantier } = await monter();
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", ANTOINE, J1);
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J1);
    const avant = await relire(ctx, chantier.id);
    for (const j of JOURS) {
      assert.deepEqual(equipesDuJour(avant.equipes, j).matin, [ANTOINE, JULIEN], `avant, jour ${j}`);
    }

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    assert.ok(etat, "la bascule a rendu null");
    assert.deepEqual(equipesDuJour(etat, J4).matin, [ANTOINE], "Julien est encore là le 4e jour");
    for (const j of JOURS.filter((x) => x !== J4)) {
      assert.deepEqual(equipesDuJour(etat, j).matin, [ANTOINE, JULIEN], `Julien a été retiré le ${j} — « ça l'enlève partout »`);
    }

    // Et le planning relit la même chose que la bascule a rendu.
    const apres = await relire(ctx, chantier.id);
    assert.deepEqual(equipesDuJour(apres.equipes, J4).matin, [ANTOINE]);
    assert.deepEqual(equipesDuJour(apres.equipes, JOURS[7]).matin, [ANTOINE, JULIEN]);
  });

  await essai("les lignes d'avant la migration valent chaque jour, et se déplient au premier geste", async () => {
    const { ctx, chantier } = await monter();
    await poserUneLigneDAvant(ctx, chantier.id, "matin", JULIEN);
    const avant = await relire(ctx, chantier.id);
    assert.deepEqual(equipesDuJour(avant.equipes, JOURS[6]).matin, [JULIEN], "une ligne sans jour ne vaut plus chaque jour");

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    assert.ok(etat);
    assert.deepEqual(equipesDuJour(etat, J4).matin, []);
    for (const j of JOURS.filter((x) => x !== J4)) {
      assert.deepEqual(equipesDuJour(etat, j).matin, [JULIEN], `perdu le ${j}`);
    }
  });

  await essai("ajouter Julien le 4e jour le met du 4e au 8e, pas avant", async () => {
    const { ctx, chantier } = await monter();
    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    assert.ok(etat);
    for (const [i, j] of JOURS.entries()) {
      assert.deepEqual(equipesDuJour(etat, j).matin, i >= 3 ? [JULIEN] : [], `jour ${i + 1}`);
    }
    // Le même appui le retire, ce jour-là seulement.
    const retire = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    assert.ok(retire);
    assert.deepEqual(equipesDuJour(retire, J4).matin, []);
    assert.deepEqual(equipesDuJour(retire, JOURS[4]).matin, [JULIEN], "le 5e jour a suivi le 4e");
  });

  await essai("sans jour, la bascule fait ce qu'elle a toujours fait : tout le chantier", async () => {
    const { ctx, chantier } = await monter();
    const pose = await basculerEquipeDuChantier(ctx, chantier.id, "matin", ANTOINE);
    assert.deepEqual(pose?.matin, [ANTOINE]);
    for (const j of JOURS) assert.deepEqual(equipesDuJour(pose!, j).matin, [ANTOINE], j);
    const retire = await basculerEquipeDuChantier(ctx, chantier.id, "matin", ANTOINE);
    assert.deepEqual(retire?.matin, []);
  });

  await essai("un absent ce jour-là et tous les suivants n'est pas coché ; là le lendemain, il l'est", async () => {
    const { ctx, chantier } = await monter();
    // Julien en congé du 4e au 8e jour : le cocher le 4e n'annoncerait personne.
    await noterAbsenceEquipe(ctx, { rang: JULIEN, premierJour: J4, dernierJour: JOURS[7], motif: "congé" });
    const refuse = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    assert.deepEqual(equipesDuJour(refuse!, J4).matin, [], "coché alors qu'il n'est là aucun des jours");
    // Coché le 1er jour, il vient les trois premiers : la pastille dit lesquels.
    const accepte = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J1);
    assert.deepEqual(equipesDuJour(accepte!, J1).matin, [JULIEN], "refusé alors qu'il est là au début");
  });

  await essai("rendu à « Sans date » puis reposé : personne n'est perdu", async () => {
    const { ctx, chantier } = await monter();
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    await deplanifierChantier(ctx, chantier.id);
    await planifierChantier(ctx, chantier.id, "2027-04-12", { demi: "matin" });
    const lu = await relire(ctx, chantier.id);
    assert.deepEqual(lu.equipes.matin, [JULIEN], "Julien a été perdu en route");
    assert.deepEqual(equipesDuJour(lu.equipes, "2027-04-12").matin, [JULIEN]);
  });

  await essai("reposé une autre semaine : le 4e jour reste le 4e jour", async () => {
    const { ctx, chantier } = await monter();
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J4);
    const AUTRE_LUNDI = "2027-04-12";
    await planifierChantier(ctx, chantier.id, AUTRE_LUNDI, { demi: "matin" });
    const nouveaux = [...new Set(creneauxDuChantier({ jour: AUTRE_LUNDI, moment: "matin" }, 16).map((c) => c.jour))];
    const lu = await relire(ctx, chantier.id);
    assert.deepEqual(equipesDuJour(lu.equipes, nouveaux[2]).matin, [], "Julien est arrivé un jour trop tôt");
    assert.deepEqual(equipesDuJour(lu.equipes, nouveaux[3]).matin, [JULIEN], "Julien n'a pas suivi le chantier");
    assert.deepEqual(equipesDuJour(lu.equipes, nouveaux[7]).matin, [JULIEN]);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Équipes par jour — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
