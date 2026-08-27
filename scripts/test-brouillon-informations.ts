import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as materielRepo from "../src/server/repositories/materiel";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { genererBrouillon } from "../src/server/ai/services/brouillon-service";
import { PropositionExtractionSchema, brouillonVide } from "../src/server/ai/schemas/extraction";
import { extraire } from "../src/server/ai/services/extraction-service";
import { decrireAudioEntrant } from "../src/lib/signature-audio";
import { temoinWebm, temoinM4aIphone, temoinHtml } from "./_temoins-audio";
import { getNextAction } from "../src/lib/chantier-etat";
import { nettoyerBase } from "./_test-db";

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

// Dictée de référence : mentionne explicitement des travaux, du matériel avec
// quantité, une durée, une équipe et l'évacuation des déchets — mais JAMAIS de
// prix ni de contrainte d'accès. Ce qui est absent doit le rester.
const DICTEE =
  "Élagage du sapin devant la maison, deux jours, deux hommes, 10 sacs de gravats à évacuer, évacuation des branchages";

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Brouillon A" },
    { email: "brouillon-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Brouillon B" },
    { email: "brouillon-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // --- Modèle structuré : rien d'inventé ---------------------------------

  await test("Brouillon vide : tous les champs sont nuls ou vides, jamais une valeur plausible", async () => {
    const vide = brouillonVide();
    assert.deepEqual(vide.prestations, []);
    assert.deepEqual(vide.materiel, []);
    assert.equal(vide.dureePrevue, null);
    assert.equal(vide.tailleEquipe, null);
    assert.equal(vide.gestionDechets, null);
    assert.equal(vide.contraintesAcces, null);
    assert.equal(vide.remarques, null);
  });

  await test("Extraction : ne renseigne que ce que la dictée mentionne réellement", async () => {
    const resultat = await extraire(DICTEE);
    assert.equal(resultat.succes, true);
    if (!resultat.succes) return;
    const p = resultat.proposition;

    assert.match(p.dureePrevue ?? "", /jour/, "La durée est dictée, elle doit être extraite");
    assert.match(p.tailleEquipe ?? "", /homme/, "L'équipe est dictée, elle doit être extraite");
    assert.ok(p.gestionDechets, "L'évacuation des déchets est dictée, elle doit être extraite");
    assert.equal(
      p.contraintesAcces,
      null,
      "Aucune contrainte d'accès n'est dictée : le champ doit rester nul, jamais déduit"
    );
    assert.ok(p.prestations.length > 0, "Au moins une prestation dictée doit être retenue");
  });

  await test("Extraction : quantité et unité seulement lorsqu'elles sont écrites", async () => {
    const resultat = await extraire(DICTEE);
    assert.equal(resultat.succes, true);
    if (!resultat.succes) return;

    const avecQuantite = resultat.proposition.materiel.find((m) => m.quantite !== null);
    assert.ok(avecQuantite, "« 10 sacs » est une quantité explicite : elle doit être extraite");
    assert.equal(avecQuantite!.quantite, "10");
    assert.match(avecQuantite!.unite ?? "", /sac/i);

    // Toute ligne sans nombre écrit ne doit porter ni quantité ni unité.
    for (const ligne of [...resultat.proposition.prestations, ...resultat.proposition.materiel]) {
      if (!/\d/.test(ligne.libelle)) {
        assert.equal(ligne.quantite, null, `Quantité inventée sur « ${ligne.libelle} »`);
        assert.equal(ligne.unite, null, `Unité inventée sur « ${ligne.libelle} »`);
      }
    }
  });

  await test("Extraction : ce qui n'est pas dicté est signalé comme manquant, jamais comblé", async () => {
    const resultat = await extraire("Élagage du sapin");
    assert.equal(resultat.succes, true);
    if (!resultat.succes) return;
    assert.equal(resultat.proposition.dureePrevue, null);
    assert.equal(resultat.proposition.tailleEquipe, null);
    assert.ok(
      resultat.proposition.informationsManquantes.length > 0,
      "Les informations absentes doivent être listées explicitement"
    );
  });

  await test("Schéma : une réponse hors format est rejetée, jamais appliquée partiellement", async () => {
    assert.equal(PropositionExtractionSchema.safeParse({ prestations: "pas un tableau" }).success, false);
    assert.equal(PropositionExtractionSchema.safeParse({ prestations: [{ libelle: "" }] }).success, false);
  });

  // --- Génération depuis la transcription ---------------------------------

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier brouillon" });

  await test("Sans transcription : aucun brouillon généré, aucune invention", async () => {
    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(resultat.statut, "transcription_absente");
    assert.equal(await brouillonsRepo.getBrouillon(A, chantier.id), null);
  });

  await notesRepo.enregistrerNoteVocale(A, chantier.id, {
    storageKey: "test/brouillon.webm",
    mimeType: "audio/webm",
    tailleOctets: 120,
    checksum: "chk",
  });

  await test("Note sans transcription réussie : toujours aucun brouillon", async () => {
    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(resultat.statut, "transcription_absente");
  });

  await notesRepo.enregistrerSuccesTranscription(A, chantier.id, DICTEE);

  await test("Génération : produit un brouillon rattaché au bon chantier", async () => {
    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(resultat.statut, "genere");
    if (resultat.statut !== "genere") return;
    assert.equal(resultat.brouillon.chantierId, chantier.id);
    assert.equal(resultat.brouillon.statut, "brouillon");
    assert.equal(resultat.brouillon.modifieParHumain, false);
    assert.equal(resultat.brouillon.sourceTranscription, DICTEE);
  });

  await test("Génération : rien n'est écrit dans les données métier avant confirmation", async () => {
    const prestations = await prestationsRepo.listerPrestations(A, chantier.id);
    const materiel = await materielRepo.listerMateriel(A, chantier.id);
    assert.equal(prestations.length, 0, "Aucune prestation ne doit exister avant confirmation");
    assert.equal(materiel.length, 0, "Aucun matériel ne doit exister avant confirmation");
    const c = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(c?.informationsVerifieesAt ?? null, null);
  });

  await test("Persistance : le brouillon est relu à l'identique (survit au rechargement)", async () => {
    const relu = await brouillonsRepo.getBrouillon(A, chantier.id);
    assert.ok(relu);
    assert.match(relu!.contenu.dureePrevue ?? "", /jour/);
    assert.ok(relu!.contenu.prestations.length > 0);
  });

  await test("La transcription d'origine reste consultable, séparée du brouillon", async () => {
    const note = await notesRepo.getNoteVocale(A, chantier.id);
    assert.equal(note?.transcription, DICTEE, "La transcription ne doit jamais être remplacée par le brouillon");
  });

  // --- Correction humaine et non-écrasement --------------------------------

  await test("Correction humaine : enregistrée et marquée comme telle", async () => {
    const actuel = await brouillonsRepo.getBrouillon(A, chantier.id);
    const corrige = {
      ...actuel!.contenu,
      prestations: [
        { libelle: "Élagage corrigé à la main", description: null, quantite: null, unite: null, aConfirmer: false },
      ],
      contraintesAcces: "Portail étroit",
    };
    const maj = await brouillonsRepo.enregistrerCorrectionHumaine(A, chantier.id, corrige);
    assert.ok(maj);
    assert.equal(maj!.modifieParHumain, true);
    assert.equal(maj!.contenu.prestations[0].libelle, "Élagage corrigé à la main");
    assert.equal(maj!.contenu.contraintesAcces, "Portail étroit");
  });

  await test("Régénération : n'écrase JAMAIS silencieusement une correction humaine", async () => {
    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(resultat.statut, "conflit", "Une régénération doit signaler le conflit, jamais écraser");

    const apres = await brouillonsRepo.getBrouillon(A, chantier.id);
    assert.equal(
      apres!.contenu.prestations[0].libelle,
      "Élagage corrigé à la main",
      "La correction humaine doit être intacte après une régénération refusée"
    );
    assert.equal(apres!.contenu.contraintesAcces, "Portail étroit");
    assert.equal(apres!.modifieParHumain, true);
  });

  await test("Régénération : la nouvelle proposition est fournie pour que le patron tranche", async () => {
    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(resultat.statut, "conflit");
    if (resultat.statut !== "conflit") return;
    assert.ok(resultat.propositionNouvelle.prestations.length > 0);
    assert.notEqual(resultat.propositionNouvelle.prestations[0].libelle, "Élagage corrigé à la main");
  });

  await test("Remplacement explicite : écrase uniquement sur demande, et repart d'un brouillon non modifié", async () => {
    const resultat = await genererBrouillon(A, chantier.id, { remplacer: true });
    assert.equal(resultat.statut, "genere");
    const apres = await brouillonsRepo.getBrouillon(A, chantier.id);
    assert.notEqual(apres!.contenu.prestations[0].libelle, "Élagage corrigé à la main");
    assert.equal(apres!.modifieParHumain, false);
    assert.equal(apres!.contenu.contraintesAcces, null, "La correction humaine a bien été remplacée");
  });

  // --- Confirmation explicite ----------------------------------------------

  await test("Confirmation : le brouillon devient confirmé et daté", async () => {
    const confirme = await brouillonsRepo.marquerConfirme(A, chantier.id);
    assert.ok(confirme);
    assert.equal(confirme!.statut, "confirme");
    assert.ok(confirme!.confirmeAt, "La confirmation doit être horodatée");
  });

  // **Le libellé a changé de sens le 21 août 2026, et le contrôle avec lui.**
  // Une dictée mène désormais AU DEVIS, avant comme après la vérification des
  // informations : la chaîne va de l'une à l'autre d'un seul tenant, et l'écran
  // « Prix » n'est plus une étape de ce chemin (`ARCHITECTURE.md` §142).
  await test("Action principale : une dictée mène au devis, vérifiée ou non", async () => {
    const avant = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(
      getNextAction({
        photosCount: 0,
        aUneNoteVocale: true,
        informationsVerifieesAt: avant?.informationsVerifieesAt ?? null,
        prixValideAt: null,
        devisGenereAt: null,
        devisEnvoyeAt: null,
        datePlanifiee: null,
      })?.key,
      "devis-preparer"
    );

    await chantiersRepo.marquerInformationsVerifiees(A, chantier.id);
    const apres = await chantiersRepo.getChantier(A, chantier.id);
    assert.ok(apres?.informationsVerifieesAt);
    assert.equal(
      getNextAction({
        photosCount: 0,
        aUneNoteVocale: true,
        informationsVerifieesAt: apres!.informationsVerifieesAt,
        prixValideAt: null,
        devisGenereAt: null,
        devisEnvoyeAt: null,
        datePlanifiee: null,
      })?.key,
      "devis-preparer",
      "vérifier les informations ramène sur l'écran « Prix » : c'est l'écran intermédiaire qu'il refuse"
    );

    // **Sans dictée, l'écran « Prix » reste le bon**, et c'est ce qui montre
    // que la règle n'a pas été élargie plus qu'il ne fallait : celui qui écrit
    // son devis à la main y passe encore.
    assert.equal(
      getNextAction({
        photosCount: 0,
        aUneNoteVocale: false,
        informationsVerifieesAt: apres!.informationsVerifieesAt,
        prixValideAt: null,
        devisGenereAt: null,
        devisEnvoyeAt: null,
        datePlanifiee: null,
      })?.key,
      "prix"
    );
  });

  // --- Isolation multi-entreprises -----------------------------------------

  await test("Isolation : l'entreprise B ne voit jamais le brouillon de A", async () => {
    const vuParB = await brouillonsRepo.getBrouillon(B, chantier.id);
    assert.equal(vuParB, null, "Un brouillon d'une autre entreprise ne doit jamais être lisible");
  });

  await test("Isolation : B ne peut pas corriger le brouillon de A", async () => {
    const tentative = await brouillonsRepo.enregistrerCorrectionHumaine(B, chantier.id, brouillonVide());
    assert.equal(tentative, null, "Aucune ligne ne doit être modifiable hors de son entreprise");

    const intact = await brouillonsRepo.getBrouillon(A, chantier.id);
    assert.ok(intact!.contenu.prestations.length > 0, "Le brouillon de A doit être intact");
  });

  await test("Isolation : B ne peut pas confirmer ni supprimer le brouillon de A", async () => {
    assert.equal(await brouillonsRepo.marquerConfirme(B, chantier.id), null);
    await brouillonsRepo.supprimerBrouillon(B, chantier.id);
    assert.ok(await brouillonsRepo.getBrouillon(A, chantier.id), "Le brouillon de A doit toujours exister");
  });

  await test("Isolation : B ne génère aucun brouillon depuis la note de A", async () => {
    const chantierB = await chantiersRepo.creerChantier(B, { nom: "Chantier B" });
    const resultat = await genererBrouillon(B, chantierB.id);
    assert.equal(resultat.statut, "transcription_absente", "B n'a aucune note : rien ne doit être généré");
  });

  // --- Ce qui est accepté comme audio --------------------------------------
  //
  // **Ce contrôle interrogeait `verifierTypeAudio`, qui n'existe plus.** Elle
  // lisait la chaîne envoyée par le navigateur, et le lot Audio du 26 août 2026
  // l'a retirée : le format se lit désormais dans les octets. Le contrôle a
  // suivi le déplacement de la règle plutôt que de réclamer une fonction
  // supprimée — la règle éprouvée reste la même, seule sa source de vérité a
  // changé.

  await test("Audio : ce sont les OCTETS qui décident, plus le type déclaré", async () => {
    // Un vrai WebM passe, même annoncé n'importe comment.
    const webm = decrireAudioEntrant(temoinWebm(), "application/pdf");
    assert.equal(webm.ok, true, "un vrai WebM est refusé sur la foi d'un type menteur");

    // Un vrai MP4 d'iPhone passe sans qu'aucun type ne soit annoncé.
    const iphone = decrireAudioEntrant(temoinM4aIphone(), "");
    assert.equal(iphone.ok, true, "un type absent suffit à refuser une dictée d'iPhone");

    // Et du HTML annoncé `audio/webm` est refusé — c'est le défaut fermé.
    const faux = decrireAudioEntrant(temoinHtml(), "audio/webm");
    assert.equal(faux.ok, false, "du HTML annoncé audio/webm est accepté");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
