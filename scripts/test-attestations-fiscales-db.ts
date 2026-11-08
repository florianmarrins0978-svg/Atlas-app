import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, equipesDuChantier, heuresDIntervention } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { equipeParRang, nommerEquipe } from "../src/server/repositories/equipes";
import { emettreFacture, terminerChantier } from "../src/server/repositories/factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { poserLeRetour } from "../src/server/repositories/retours-intervention";
import { reglerServicesALaPersonne } from "../src/server/repositories/services-a-la-personne";
import { heuresDuRetour, intervenantsPermis } from "../src/server/repositories/heures-d-intervention";
import { attestationsDeLAnnee, noterLEnvoi, papierDeLAttestation } from "../src/server/repositories/attestations-fiscales";
import { saisieServicesALaPersonneLue } from "../src/lib/services-a-la-personne";
import { heuresRecues } from "../src/lib/heures-d-intervention";
import { jourIso } from "../src/lib/jour";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * LES HEURES ET LES ATTESTATIONS FISCALES EN BASE, sous `atlas_app`
 * (migration 0179, le crédit d'impôt de ses clients, lot 2).
 *
 * Les deux suites pures tiennent les règles et le papier ; celle-ci tient le
 * CHEMIN du patron (`CLAUDE.md` §5 quater) : un chantier posé aujourd'hui,
 * deux salariés cochés, « Combien d'heures ? », le retour qui part avec ses
 * heures, la facture réglée, puis en janvier l'attestation qui compte ce qui a
 * été payé et fait, et qui part une seule fois. Et ce qui ne doit jamais
 * arriver : une entreprise qui lit, compte ou note les heures et les
 * attestations d'une autre.
 *
 * **Écrite le 8 novembre 2026, PAS jouée** : sa consigne, *« ne lance pas de
 * batterie »*. Elle se joue avec la batterie, sur son accord.
 */

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom, adresse: "4 rue des Tilleuls, 49000 Angers" },
    { email: `att-${nom.replace(/\W/g, "").toLowerCase()}-${Date.now()}@t.test`, nom: "Thomas Leroy" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function declarer(ctx: Ctx) {
  const lue = saisieServicesALaPersonneLue({ declaree: true, numero: "SAP123456789", declareeLe: "2024-03-12" }, jourIso(new Date()));
  assert.ok(lue.ok, "la saisie de référence est refusée");
  if (lue.ok) await reglerServicesALaPersonne(ctx, lue.valeurs);
}

const AUJOURDHUI = jourIso(new Date());
const ANNEE = Number(AUJOURDHUI.slice(0, 4));

async function main() {
  await nettoyerBase();
  const a = await contexte("Jardins Atlas");
  const b = await contexte("Paysages Voisins");
  await declarer(a);
  await entreprisesRepo.mettreAJourEntreprise(a, { nombreSalaries: 2 });
  await nommerEquipe(a, 1, "Martin Julien");
  await nommerEquipe(a, 2, "Roux Léa");

  const client = await clientsRepo.creerClient(a, {
    nom: "Vasseur",
    civilite: "mme",
    telephone: "0612345678",
    adresse: "8 allée des Chênes, 49100 Angers",
  });
  const chantier = await chantiersRepo.creerChantier(a, { nom: "Entretien du jardin", adresseChantier: "8 allée des Chênes, 49100 Angers", clientId: client.id });
  await prixRepo.ajouterLignePrix(a, chantier.id, "Tonte et ramassage", "420.00");
  await devisRepo.getOuCreerDevisBrouillon(a, chantier.id);

  // Posé aujourd'hui, la journée ; les deux salariés cochés, chacun sa demi-journée.
  await withEntreprise(a.utilisateurId, a.entrepriseId, async (tx) => {
    await tx
      .update(chantiers)
      .set({ datePlanifiee: AUJOURDHUI, creneauDebut: "matin", dureeDemiJournees: 2 })
      .where(eq(chantiers.id, chantier.id));
  });
  const julien = await equipeParRang(a, 1);
  const lea = await equipeParRang(a, 2);
  assert.ok(julien && lea, "les deux lignes d'équipe manquent");
  await withEntreprise(a.utilisateurId, a.entrepriseId, async (tx) => {
    await tx.insert(equipesDuChantier).values([
      { entrepriseId: a.entrepriseId, chantierId: chantier.id, demi: "matin", jour: AUJOURDHUI, equipeId: julien!.id },
      { entrepriseId: a.entrepriseId, chantierId: chantier.id, demi: "apres_midi", jour: null, equipeId: lea!.id },
    ]);
  });

  // ─── 1. « Combien d'heures ? » ────────────────────────────────────────────

  await test("la fiche du jour propose les deux salariés cochés, avec leur numéro", async () => {
    const h = await heuresDuRetour(a, chantier.id);
    assert.ok(h, "la section n'existe pas");
    assert.equal(h!.pour, "Pour l'attestation de Mme Vasseur.");
    assert.deepEqual(
      h!.intervenants.map((i) => [i.numero, i.libelle, i.minutes]),
      [
        [1, "Martin Julien", 0],
        [2, "Roux Léa", 0],
      ]
    );
  });

  await test("une entreprise non déclarée n'a pas la section", async () => {
    const c = await clientsRepo.creerClient(b, { nom: "Faucher", civilite: "mr", telephone: "0612345679" });
    const ch = await chantiersRepo.creerChantier(b, { nom: "Taille", clientId: c.id });
    assert.equal(await heuresDuRetour(b, ch.id), null);
  });

  await test("ISOLATION : la voisine ne voit pas la section de mon chantier, ni ne la remplit", async () => {
    assert.equal(await heuresDuRetour(b, chantier.id), null);
    assert.equal(await intervenantsPermis(b, chantier.id), null);
  });

  await test("le retour du jour part AVEC ses heures, dans la même écriture", async () => {
    const permis = await intervenantsPermis(a, chantier.id);
    assert.ok(permis);
    const lues = heuresRecues(
      [
        { numero: 1, minutes: 210 },
        { numero: 2, minutes: 120 },
      ],
      permis!.intervenants
    );
    assert.ok(lues.ok, "les heures sont refusées");
    if (!lues.ok) return;
    await poserLeRetour(a, chantier.id, { taches: [], photoIds: [], aSignaler: null, heures: { jour: permis!.jour, lignes: lues.lignes } });
    const h = await heuresDuRetour(a, chantier.id);
    assert.deepEqual(
      h!.intervenants.map((i) => i.minutes),
      [210, 120],
      "les roulettes ne repartent pas des heures tapées"
    );
  });

  await test("un second retour réécrit les heures du jour : zéro efface", async () => {
    const permis = await intervenantsPermis(a, chantier.id);
    const lues = heuresRecues([{ numero: 1, minutes: 240 }], permis!.intervenants);
    assert.ok(lues.ok);
    if (!lues.ok) return;
    await poserLeRetour(a, chantier.id, { taches: [], photoIds: [], aSignaler: null, heures: { jour: permis!.jour, lignes: lues.lignes } });
    const h = await heuresDuRetour(a, chantier.id);
    assert.deepEqual(
      h!.intervenants.map((i) => i.minutes),
      [240, 0]
    );
    // Remettre Léa pour la suite.
    const remise = heuresRecues(
      [
        { numero: 1, minutes: 240 },
        { numero: 2, minutes: 120 },
      ],
      permis!.intervenants
    );
    if (remise.ok) {
      await poserLeRetour(a, chantier.id, { taches: [], photoIds: [], aSignaler: null, heures: { jour: permis!.jour, lignes: remise.lignes } });
    }
  });

  await test("le nom écrit ce jour-là est gardé avec les heures", async () => {
    const lignes = await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx
        .select({ numero: heuresDIntervention.intervenantNumero, nom: heuresDIntervention.intervenantNom })
        .from(heuresDIntervention)
        .where(eq(heuresDIntervention.chantierId, chantier.id))
    );
    assert.deepEqual(
      lignes.sort((x, y) => x.numero - y.numero),
      [
        { numero: 1, nom: "Martin Julien" },
        { numero: 2, nom: "Roux Léa" },
      ]
    );
  });

  await test("la base refuse une durée nulle ou au-delà de 24 h 59", async () => {
    for (const minutes of [0, 1500]) {
      await assert.rejects(
        withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
          tx.insert(heuresDIntervention).values({
            entrepriseId: a.entrepriseId,
            chantierId: chantier.id,
            jour: "2020-01-01",
            intervenantNumero: 1,
            minutes,
          })
        ),
        `heures_d_intervention_minutes_ck a laissé passer ${minutes}`
      );
    }
  });

  await test("ISOLATION : la voisine ne lit aucune de mes heures, et n'en écrit pas chez moi", async () => {
    const vues = await withEntreprise(b.utilisateurId, b.entrepriseId, (tx) => tx.select().from(heuresDIntervention));
    assert.equal(vues.length, 0);
    await assert.rejects(
      withEntreprise(b.utilisateurId, b.entrepriseId, (tx) =>
        tx.insert(heuresDIntervention).values({
          entrepriseId: a.entrepriseId,
          chantierId: chantier.id,
          jour: AUJOURDHUI,
          intervenantNumero: 1,
          minutes: 60,
        })
      ),
      "la RLS a laissé écrire une heure chez une autre entreprise"
    );
  });

  // ─── 2. L'attestation de l'année ──────────────────────────────────────────

  let factureId = "";
  await test("la facture réglée cette année fait l'attestation du client", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(a, chantier.id);
    await devisRepo.envoyerDevis(a, d.id);
    const f = await terminerChantier(a, chantier.id);
    factureId = f.id;
    await emettreFacture(a, f.id);
    const r = await noterPaiement(a, f.id, { date: AUJOURDHUI, montant: "504.00", moyen: "virement" });
    assert.ok(r.ok, "le règlement est refusé");
    const lu = await attestationsDeLAnnee(a, ANNEE);
    assert.ok(lu, "une entreprise déclarée n'a pas d'attestations");
    assert.equal(lu!.attestations.length, 1);
    const att = lu!.attestations[0]!;
    assert.equal(att.clientId, client.id);
    assert.equal(att.calcul.montant, "504.00");
    assert.deepEqual(
      att.calcul.interventions.map((i) => [i.jour, i.minutes, i.numero, i.nom]),
      [
        [AUJOURDHUI, 240, 1, "Martin Julien"],
        [AUJOURDHUI, 120, 2, "Roux Léa"],
      ]
    );
    assert.deepEqual(att.manques, []);
    assert.equal(att.etat, "a_envoyer");
  });

  await test("le papier porte la phrase, le tableau et le montant", async () => {
    const p = await papierDeLAttestation(a, ANNEE, client.id);
    assert.ok(p);
    assert.ok(p!.contenu.phrase.startsWith("Je soussigné Thomas Leroy, pour Jardins Atlas, certifie que Mme Vasseur, 8 allée des Chênes"));
    assert.equal(p!.contenu.lignes.length, 2);
    assert.equal(p!.contenu.lieuEtDate.startsWith("Angers, le "), true);
  });

  await test("ISOLATION : la voisine n'a aucune attestation de mes clients, même déclarée", async () => {
    assert.equal(await attestationsDeLAnnee(b, ANNEE), null, "une entreprise non déclarée en a");
    await declarer(b);
    const lu = await attestationsDeLAnnee(b, ANNEE);
    assert.deepEqual(lu?.attestations, []);
    assert.equal(await papierDeLAttestation(b, ANNEE, client.id), null);
  });

  await test("ISOLATION : la voisine ne note pas l'envoi de mon attestation", async () => {
    const r = await noterLEnvoi(b, ANNEE, client.id);
    assert.equal(r.ok, false);
  });

  await test("UNE PAR UNE : l'envoi se note, et l'attestation est « Envoyée »", async () => {
    const r = await noterLEnvoi(a, ANNEE, client.id);
    assert.ok(r.ok, r.ok ? "" : r.raison);
    const att = (await attestationsDeLAnnee(a, ANNEE))!.attestations[0]!;
    assert.equal(att.etat, "envoyee");
    assert.ok(att.envoyeeLe);
  });

  await test("une adresse corrigée après l'envoi la rend « À renvoyer »", async () => {
    // Le papier parti porte l'ancienne : le client tient une attestation qui
    // ne dit plus vrai, et l'écran le dit.
    await clientsRepo.mettreAJourClient(a, client.id, { adresse: "1 rue Neuve, 49000 Angers" });
    const att = (await attestationsDeLAnnee(a, ANNEE))!.attestations[0]!;
    assert.equal(att.etat, "a_renvoyer");
  });

  await test("sans heures sur un chantier payé, l'attestation est à compléter et ne se note pas", async () => {
    await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.delete(heuresDIntervention).where(eq(heuresDIntervention.chantierId, chantier.id))
    );
    const att = (await attestationsDeLAnnee(a, ANNEE))!.attestations[0]!;
    assert.equal(att.etat, "a_completer");
    assert.ok(att.manques.some((m) => m.startsWith("Aucune heure enregistrée pour la facture")));
    const r = await noterLEnvoi(a, ANNEE, client.id);
    assert.equal(r.ok, false, "une attestation à compléter s'est notée envoyée");
  });

  await test("ISOLATION : la facture de A reste invisible à B jusque dans le compte", async () => {
    assert.ok(factureId);
    const lu = await attestationsDeLAnnee(b, ANNEE);
    assert.equal(lu?.attestations.length, 0);
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

void main();
