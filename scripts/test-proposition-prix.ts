import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { brouillonVide } from "../src/server/ai/schemas/extraction";
import { evaluerFraicheurBrouillon } from "../src/lib/brouillon-etat";
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

// Paramètres de chiffrage par défaut (schema.ts) : ouvrier 200 €/j, chef
// 280 €/j, déplacement 35 €, marge 20 %.
// 2 jours × 2 ouvriers = 800 ; chef 2 × 280 = 560 ; main-d'œuvre 1360 ;
// + déplacement 35 = 1395 ; + 20 % = 1674,00 €.
//
// **Puis arrondi à 1 670 €, depuis le 7 août 2026.** Ce contrôle exigeait
// « le montant du moteur, au centime » — il encodait donc l'absence d'arrondi,
// et c'est ce qui a laissé passer les 858,00 € que le patron a lus sur son
// devis : « on a dit d'arrondir à la dizaine, toujours pourquoi 858 ??? ».
// La règle existait depuis le 5 août (`src/lib/arrondi-prix.ts`, avec sa phrase
// « en HT on fait des prix ronds ») et n'était appelée nulle part dans le
// chiffrage. Un contrôle qui verrouille un défaut est pire qu'un contrôle
// absent : il empêche de le corriger.
const PRIX_MOTEUR_BRUT = "1674.00";
const PRIX_CHIFFRAGE_ATTENDU = "1670";

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Prix A" },
    { email: "prix-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Prix B" },
    { email: "prix-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // === 1. Aucune donnée suffisante ========================================

  await test("Aucune donnée : origine « aucun », aucun prix proposé (jamais 0 €)", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier vide" });
    const p = await preparerPropositionPrix(A, chantier.id);
    assert.ok(p);
    assert.equal(p!.origine, "aucun");
    assert.equal(p!.prixPropose, null, "Aucun prix ne doit être proposé, et surtout pas 0 €");
    assert.ok(p!.explication.donneesManquantes.length > 0, "Ce qui manque doit être énoncé");
  });

  await test("Durée et équipe absentes : jamais inventées, explicitement listées comme manquantes", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier sans durée" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Travaux divers");
    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.origine, "aucun");
    assert.equal(p!.prixPropose, null);
    const manquantes = p!.explication.donneesManquantes.join(" | ");
    assert.match(manquantes, /Durée prévue non renseignée/);
    assert.match(manquantes, /Taille d'équipe non renseignée/);
  });

  // === 2. Calcul depuis les paramètres de chiffrage ========================

  await test("Aucun tarif mais durée et équipe connues : calcul depuis les paramètres, valeur exacte", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier calcul" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Démolition cloison");
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, {
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });

    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.origine, "chiffrage");
    assert.equal(
      p!.prixPropose,
      PRIX_CHIFFRAGE_ATTENDU,
      `Le montant doit être celui du moteur ARRONDI à la dizaine (${PRIX_MOTEUR_BRUT} € → ${PRIX_CHIFFRAGE_ATTENDU} €). Un prix au centime signale une machine, pas un artisan.`
    );
    assert.ok(
      p!.explication.calcul.some((c) => /Arrondi/.test(c.libelle)),
      "L'arrondi doit être dit dans le détail : un montant qui change sans explication se lit comme une erreur."
    );
    assert.match(p!.explication.origine, /calculé à partir de vos paramètres/i);
    assert.ok(
      p!.explication.calcul.some((c) => /Main-d'œuvre/.test(c.libelle)),
      "Le détail doit exposer le poste main-d'œuvre"
    );
    assert.ok(
      p!.explication.calcul.some((c) => /Marge/.test(c.libelle)),
      "Le détail doit exposer la marge appliquée"
    );
  });

  // === 3. Tarif exact ======================================================

  const chantierTarif = await chantiersRepo.creerChantier(A, { nom: "Chantier tarif" });

  await test("Un seul tarif correspondant : le prix vient du tarif, pas d'un calcul", async () => {
    await prestationsRepo.ajouterPrestation(A, chantierTarif.id, "Élagage du sapin");
    await chantiersRepo.mettreAJourDureeEquipe(A, chantierTarif.id, {
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });
    await tarifsRepo.creerTarif(A, { intitule: "Élagage", prix: "450.00" });

    const p = await preparerPropositionPrix(A, chantierTarif.id);
    assert.equal(p!.origine, "tarif");
    assert.equal(p!.prixPropose, "450.00");
    assert.equal(p!.libelle, "Élagage");
    assert.match(p!.explication.origine, /tarif que vous avez déjà enregistré/i);
    assert.notEqual(
      p!.prixPropose,
      PRIX_CHIFFRAGE_ATTENDU,
      "Un tarif existant doit primer sur le calcul, même si le calcul est possible"
    );
  });

  await test("Quantité absente : le tarif est repris tel quel, jamais multiplié par une quantité supposée", async () => {
    const p = await preparerPropositionPrix(A, chantierTarif.id);
    assert.equal(p!.prixPropose, "450.00", "Sans quantité confirmée, aucune multiplication");
  });

  await test("Quantité confirmée : multipliée seulement si le tarif porte une unité", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier quantité" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Pose carrelage");
    await tarifsRepo.creerTarif(A, { intitule: "Pose carrelage", prix: "50.00", unite: "m²" });

    const contenu = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Pose carrelage", description: null, quantite: "12", unite: "m²", aConfirmer: false },
      ],
    };
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, contenu, "dictée");
    await brouillonsRepo.marquerConfirme(A, chantier.id);

    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.origine, "tarif");
    assert.equal(p!.prixPropose, "600.00", "12 × 50 € = 600 €");
    assert.ok(
      p!.explication.calcul.some((c) => /Quantité/.test(c.libelle)),
      "La multiplication doit être expliquée"
    );
  });

  await test("Brouillon non confirmé : ses quantités ne sont jamais utilisées", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier brouillon non confirmé" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Pose carrelage");
    const contenu = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Pose carrelage", description: null, quantite: "99", unite: "m²", aConfirmer: false },
      ],
    };
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, contenu, "dictée");
    // volontairement PAS confirmé

    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.prixPropose, "50.00", "Une proposition non confirmée ne doit rien influencer");
  });

  // === 4. Tarifs ambigus ===================================================

  await test("Plusieurs tarifs correspondants : aucun choix automatique, tous exposés", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier ambigu" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Élagage");
    await tarifsRepo.creerTarif(A, { intitule: "Élagage haute tige", prix: "700.00" });

    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.origine, "tarifs_ambigus");
    assert.equal(p!.prixPropose, null, "Aucun prix ne doit être retenu quand plusieurs tarifs sont possibles");
    assert.equal(p!.tarifId, null);
    assert.ok(p!.tarifsCandidats.length >= 2, "Tous les tarifs en concurrence doivent être proposés au choix");
    assert.match(p!.explication.origine, /choix vous revient/i);
  });

  // === 5. Validation humaine ==============================================

  await test("Préparer une proposition n'écrit jamais rien (aucune validation implicite)", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier lecture seule" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Démolition cloison");
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, {
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });

    await preparerPropositionPrix(A, chantier.id);
    await preparerPropositionPrix(A, chantier.id);

    const lignes = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(lignes.length, 0, "Consulter une proposition ne doit créer aucune ligne de prix");
    const c = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(c?.prixValideAt ?? null, null, "Le prix ne doit jamais être validé sans action humaine");
  });

  await test("Persistance : une ligne appliquée est relue après rechargement, et le total suit", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier persistance" });
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Élagage", "450.00");
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Évacuation", "120.00");

    const lignes = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(lignes.length, 2);
    assert.equal(await lignesPrixRepo.totalLignesPrix(A, chantier.id), "570.00");
  });

  await test("Prix corrigé : la valeur retenue est celle du patron, pas celle proposée", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier correction" });
    const ligne = await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Élagage", "450.00");
    await lignesPrixRepo.modifierLignePrix(A, ligne.id, { montant: "500.00" });
    assert.equal(await lignesPrixRepo.totalLignesPrix(A, chantier.id), "500.00");
  });

  // === 6. Isolation multi-entreprises =====================================

  await test("Isolation : B n'obtient aucune proposition sur un chantier de A", async () => {
    const p = await preparerPropositionPrix(B, chantierTarif.id);
    assert.equal(p, null, "Un chantier d'une autre entreprise doit rester invisible");
  });

  await test("Isolation : le tarif de A n'est jamais utilisé pour un chantier de B", async () => {
    const chantierB = await chantiersRepo.creerChantier(B, { nom: "Chantier B" });
    await prestationsRepo.ajouterPrestation(B, chantierB.id, "Élagage du sapin");
    await chantiersRepo.mettreAJourDureeEquipe(B, chantierB.id, {
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });

    const p = await preparerPropositionPrix(B, chantierB.id);
    assert.equal(p!.origine, "chiffrage", "B n'a aucun tarif : le calcul doit prendre le relais");
    assert.notEqual(p!.prixPropose, "450.00", "Le tarif de A ne doit jamais fuiter vers B");
    assert.equal(p!.prixPropose, PRIX_CHIFFRAGE_ATTENDU);
  });

  await test("Isolation : B ne voit pas les lignes de prix de A", async () => {
    const lignes = await lignesPrixRepo.listerLignesPrix(B, chantierTarif.id);
    assert.equal(lignes.length, 0);
  });

  // === 7. Cohérence brouillon / transcription (Partie 1) ==================

  await test("Brouillon à jour : aucun avertissement", async () => {
    assert.equal(
      evaluerFraicheurBrouillon({ sourceTranscription: "texte", transcriptionActuelle: "texte" }).obsolete,
      false
    );
  });

  await test("Note remplacée : brouillon signalé obsolète, jamais supprimé", async () => {
    const etat = evaluerFraicheurBrouillon({
      sourceTranscription: "ancienne dictée",
      transcriptionActuelle: "nouvelle dictée",
    });
    assert.equal(etat.obsolete, true);
    if (etat.obsolete) assert.equal(etat.raison, "transcription_modifiee");
  });

  await test("Note supprimée : brouillon signalé obsolète", async () => {
    const etat = evaluerFraicheurBrouillon({ sourceTranscription: "dictée", transcriptionActuelle: null });
    assert.equal(etat.obsolete, true);
    if (etat.obsolete) assert.equal(etat.raison, "note_supprimee");
  });

  await test("Source inconnue : aucune obsolescence affirmée sans preuve", async () => {
    assert.equal(
      evaluerFraicheurBrouillon({ sourceTranscription: null, transcriptionActuelle: "quelque chose" }).obsolete,
      false
    );
  });

  await test("Remplacement réel de la note : le brouillon et ses corrections survivent", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier obsolescence" });
    await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: "test/v1.webm",
      mimeType: "audio/webm",
      tailleOctets: 10,
      checksum: "c1",
    });
    await notesRepo.enregistrerSuccesTranscription(A, chantier.id, "première dictée");

    const contenu = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Corrigé à la main", description: null, quantite: null, unite: null, aConfirmer: false },
      ],
    };
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, contenu, "première dictée");
    await brouillonsRepo.enregistrerCorrectionHumaine(A, chantier.id, contenu);

    // Remplacement de la note : la transcription repart à zéro.
    await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: "test/v2.webm",
      mimeType: "audio/webm",
      tailleOctets: 20,
      checksum: "c2",
    });
    await notesRepo.enregistrerSuccesTranscription(A, chantier.id, "seconde dictée");

    const brouillon = await brouillonsRepo.getBrouillon(A, chantier.id);
    assert.ok(brouillon, "Le brouillon ne doit jamais être supprimé automatiquement");
    assert.equal(brouillon!.contenu.prestations[0].libelle, "Corrigé à la main");
    assert.equal(brouillon!.modifieParHumain, true, "La correction humaine doit rester marquée");

    const note = await notesRepo.getNoteVocale(A, chantier.id);
    const etat = evaluerFraicheurBrouillon({
      sourceTranscription: brouillon!.sourceTranscription,
      transcriptionActuelle: note?.transcription ?? null,
    });
    assert.equal(etat.obsolete, true, "L'écart avec la nouvelle transcription doit être détecté");
  });

  // === 8. Action principale (Partie 1) ====================================

  await test("Action principale : ne régresse jamais vers la note vocale après confirmation", async () => {
    const base = {
      photosCount: 0,
      prixValideAt: null,
      devisGenereAt: null,
      devisEnvoyeAt: null,
      datePlanifiee: null,
    };
    // Note supprimée APRÈS que les informations aient été vérifiées.
    assert.equal(
      getNextAction({ ...base, aUneNoteVocale: false, informationsVerifieesAt: new Date() })?.key,
      "prix",
      "La progression métier prime : jamais un retour à « Enregistrer une note vocale »"
    );
    // Tant que rien n'est vérifié, le parcours d'entrée reste inchangé.
    assert.equal(
      getNextAction({ ...base, aUneNoteVocale: false, informationsVerifieesAt: null })?.key,
      "photos"
    );
    assert.equal(
      getNextAction({ ...base, photosCount: 2, aUneNoteVocale: false, informationsVerifieesAt: null })?.key,
      "note-vocale"
    );
    assert.equal(
      getNextAction({ ...base, aUneNoteVocale: true, informationsVerifieesAt: null })?.key,
      "informations"
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
