import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import {
  getOuCreerDevisBrouillon,
  getAcomptesDevis,
  poserAcompteSuivant,
  retirerAcompte,
  envoyerDevis,
} from "../src/server/repositories/devis";
import { terminerChantier } from "../src/server/repositories/factures";
import { creerEntreprise, marquerEnvoye, regler, papierDeLaFacture } from "./_devis-et-facture";

/**
 * ─── UNE NOUVELLE VERSION GARDE L'ÉCHÉANCIER QU'IL A POSÉ ───────────────────
 *
 * **Sa panne du 17 septembre 2026, capture à l'appui :** *« ça prend qu'un
 * seul acompte, ça m'a supprimé mes 2 autres et je n'arrive pas à les
 * remettre »*. Son devis portait 30 / 50 / 75 ; rouvert pour correction, il
 * n'en portait plus qu'un — celui des Réglages.
 *
 * **La racine, mesurée avant de corriger :** rouvrir un devis parti crée une
 * NOUVELLE VERSION, et celle-ci reposait l'acompte des Réglages, seul. Les deux
 * autres n'étaient pas « supprimés » par un geste : ils n'étaient jamais
 * recopiés. Le commentaire du dépôt en faisait une décision (*« elle repart des
 * Réglages, comme le taux de TVA et la remise »*) — il l'a corrigée : ce qu'il
 * a posé à la main sur un devis suit sa correction.
 *
 * **Ce qui NE change pas** : un devis tout neuf prend le réglage, d'office ; et
 * un devis dont il a retiré tous les acomptes n'en reprend aucun — recopier
 * « rien » est aussi fidèle que recopier trois lignes.
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

const taux = (acomptes: { tauxCumule: string }[]) => acomptes.map((a) => a.tauxCumule);

async function main() {
  await nettoyerBase();
  console.log("\n=== Une nouvelle version garde l'échéancier posé ===\n");

  await test("les trois acomptes de son devis SUIVENT la correction", async () => {
    const { ctx, chantierId } = await creerEntreprise("Vidal", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await poserAcompteSuivant(ctx, v1.id);
    await poserAcompteSuivant(ctx, v1.id);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), ["30.00", "50.00", "75.00"]);

    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.notEqual(v2.id, v1.id, "aucune nouvelle version n'a été créée : le cas n'est pas éprouvé");
    assert.equal(v2.numeroVersion, 2);
    assert.deepEqual(
      taux(await getAcomptesDevis(ctx, v2.id)),
      ["30.00", "50.00", "75.00"],
      "la version corrigée a perdu les acomptes qu'il avait posés"
    );
  });

  await test("un devis dont il a tout retiré n'en reprend AUCUN", async () => {
    const { ctx, chantierId } = await creerEntreprise("Linotte", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), ["30.00"]);
    await retirerAcompte(ctx, v1.id, 1);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), []);

    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(
      taux(await getAcomptesDevis(ctx, v2.id)),
      [],
      "l'acompte des Réglages revient sur une version où il l'avait retiré"
    );
  });

  // *« Si on fait une modification sur un devis il faut que ça suive sur les
  // factures »* (7 octobre 2026). Il avait retiré l'acompte : le devis envoyé,
  // puis sa facture, réclamaient encore « 30 % à la commande », parce que la
  // condition recopiée des Réglages survivait au retrait. Le VRAI chemin :
  // retirer, envoyer, terminer le chantier, lire le papier de la facture.
  await test("acompte retiré : ni le devis parti ni sa facture ne le réclament", async () => {
    const { ctx, chantierId } = await creerEntreprise("Lafonte", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await retirerAcompte(ctx, v1.id, 1);
    const parti = await envoyerDevis(ctx, v1.id);
    assert.equal(parti.acomptePourcent, null, "le devis part avec la condition d'acompte qu'il a retirée");

    const facture = await terminerChantier(ctx, chantierId);
    const texte = await papierDeLaFacture(ctx, facture);
    assert.ok(texte.includes("Terrasse bois"), "le papier de la facture n'a pas été lu");
    assert.ok(!texte.includes("Mode de règlement"), "la facture réclame l'acompte retiré du devis");
    assert.ok(!texte.includes("à la commande"), "la facture réclame l'acompte retiré du devis");
  });

  await test("acompte gardé : le devis parti et sa facture le disent", async () => {
    const { ctx, chantierId } = await creerEntreprise("Morvan", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    const parti = await envoyerDevis(ctx, v1.id);
    assert.equal(parti.acomptePourcent, "30.00");
    const facture = await terminerChantier(ctx, chantierId);
    const texte = await papierDeLaFacture(ctx, facture);
    assert.ok(texte.includes("Mode de règlement : 30 % à la signature"), "la facture a perdu l'acompte du devis");
  });

  // Le check-up du 7 octobre 2026, point 4 : « Corriger le devis » ouvre une
  // version qui repartait à 20 %, sans remise, sans titre, sans main d'œuvre
  // ni notes. La facture reprise perdait tout cela avec elle : une remise de
  // 10 % disparaissait, et le client recevait le plein tarif.
  await test("la version corrigée garde la remise, le taux, le titre, la main d'œuvre et les notes", async () => {
    const { ctx, chantierId } = await creerEntreprise("Ferrand", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await regler(ctx.entrepriseId, v1.id, {
      taux_tva: "10.00",
      reduction_pourcent: "10.00",
      reduction_montant: "237.00",
      titre: "Aménagement du jardin",
      main_doeuvre_ht: "800.00",
      conditions_paiement: "Accès par le portail de gauche.",
    });
    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.notEqual(v2.id, v1.id, "aucune nouvelle version : le cas n'est pas éprouvé");
    assert.equal(v2.tauxTva, "10.00", "la version corrigée repart à 20 %");
    assert.equal(v2.reductionPourcent, "10.00", "la remise accordée a disparu de la version corrigée");
    assert.equal(v2.titre, "Aménagement du jardin");
    assert.equal(v2.mainDoeuvreHt, "800.00");
    assert.equal(v2.conditionsPaiement, "Accès par le portail de gauche.");
    // 2 370 € HT moins 10 %, au taux de 10 % : le total suit la remise reprise.
    assert.equal(v2.totalHt, "2133.00", "le total de la version corrigée ignore la remise reprise");
  });

  await test("un refus DIT pourquoi — il ne rend plus un silence", async () => {
    const { ctx, chantierId } = await creerEntreprise("Benali", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await poserAcompteSuivant(ctx, v1.id);
    await poserAcompteSuivant(ctx, v1.id);
    const quatrieme = await poserAcompteSuivant(ctx, v1.id);
    assert.equal(quatrieme.ok, false, "un quatrième acompte a été posé : il n'y a pas de mot pour lui");
    assert.match(quatrieme.ok ? "" : quatrieme.raison, /Trois acomptes au maximum/);

    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const surUnDevisParti = await poserAcompteSuivant(ctx, v1.id);
    assert.equal(surUnDevisParti.ok, false);
    assert.match(surUnDevisParti.ok ? "" : surUnDevisParti.raison, /parti chez votre client/);
  });

  await test("un devis TOUT NEUF prend le réglage, d'office — inchangé", async () => {
    const { ctx, chantierId } = await creerEntreprise("Chausson", "40");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), ["40.00"]);
  });

  await test("sans réglage d'acompte, un devis neuf n'en porte aucun — inchangé", async () => {
    const { ctx, chantierId } = await creerEntreprise("Grospiron", null);
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), []);
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
