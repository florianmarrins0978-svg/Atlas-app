import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { enregistrerPrecisions } from "../src/server/repositories/precisions-chantier";
import { poserPrixGrille } from "../src/server/repositories/grille-prix";
import { CELLULE_HAIE } from "../src/lib/grille-prix";
import { confirmerBrouillon } from "../src/server/ai/services/brouillon-service";
import { brouillonVide } from "../src/server/ai/schemas/extraction";
import { ecrireChoix, repartirMainOeuvre, SUJET_MAIN_OEUVRE } from "../src/lib/main-oeuvre-dictee";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { poserLaMainDoeuvreDeLaFeuille } from "../src/server/chiffrage/main-oeuvre-choisie";
import { equipeDeSaLigne, estLaLigneDeSonEquipe } from "../src/lib/feuille-main-oeuvre";
import { listerLignesPrix, modifierLignePrix, poserLesPartsDeMainDoeuvre } from "../src/server/repositories/lignes-prix";
import { ajouterPrixAchat, creerSociete, reglerMarge } from "../src/server/repositories/fournisseurs-partenaires";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **LA FEUILLE « MAIN D'ŒUVRE » CHANGE LA LIGNE DE SON ÉQUIPE** — sa capture du
// 18 novembre 2026, et sa planche (`appli/soignee/devis-main-d-oeuvre-change-sa-ligne.html`).
//
// Son devis préparé « sur une ligne » portait sa main d'œuvre : 2 hommes ×
// 2 jours, 4 jour/homme, 1 600 €. Il a ouvert « Main d'œuvre » pour ajouter un
// homme, et la feuille a posé une SECONDE ligne (6 jour/homme, 2 400 €) à côté
// de la première. Ses mots : *« ça devrait juste s'ajouter »* ; sa réponse :
// *« changer ma ligne »*, une seule ligne à 3 hommes × 2 jours. Et la main
// d'œuvre d'un partenaire : *« il faudrait qu'elle se mette sur une autre
// ligne »*.
//
// Sous `atlas_app`, de sa dictée jusqu'aux lignes en base, par la fonction que
// « Changer la main d'œuvre » appelle.

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

const base = { description: null, quantite: null, unite: null, nature: null, espece: null, aConfirmer: false };

async function main() {
  await nettoyerBase();
  const { entreprise: e, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Sa ligne" },
    { email: `sa-ligne-${Date.now()}@t.test` }
  );
  const A = { entrepriseId: e.id, utilisateurId };
  await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre", prix: "400", unite: "jour/homme" });
  await poserPrixGrille(A, "haie", CELLULE_HAIE, "15");

  // Sa dictée : la taille de photinias, 2 hommes, 2 jours, sur une ligne.
  const c = await chantiersRepo.creerChantier(A, { nom: "Abattage et taille" });
  await brouillonsRepo.enregistrerGeneration(
    A,
    c.id,
    {
      ...brouillonVide(),
      prestations: [{ ...base, libelle: "Taille de photinias", nature: "haie", quantite: "50", unite: "ml" }],
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    },
    "dictée"
  );
  assert.ok((await confirmerBrouillon(A, c.id)).succes);
  await enregistrerPrecisions(A, c.id, [
    {
      sujet: SUJET_MAIN_OEUVRE,
      libellePrestation: "Main d'œuvre",
      valeur: ecrireChoix({ mode: "ligne", parts: {}, retires: [] }),
      lisible: "main d'œuvre",
    },
  ]);
  const applique = await appliquerPropositionPrix(A, c.id);
  assert.ok(applique.succes, `la préparation du devis refuse : ${JSON.stringify(applique)}`);

  const lignes = () => listerLignesPrix(A, c.id);
  const deSonEquipe = async () => (await lignes()).filter(estLaLigneDeSonEquipe);
  const sienne = (await deSonEquipe())[0];

  await test("sa dictée : une ligne Main d'œuvre, 4 jour/homme, 1 600 €, qui garde ses 2 hommes", async () => {
    assert.equal((await deSonEquipe()).length, 1);
    assert.deepEqual(
      { q: Number(sienne.quantite), montant: Number(sienne.montant), hommes: sienne.hommesMainDoeuvre },
      { q: 4, montant: 1600, hommes: 2 }
    );
  });

  await test("« Changer » à 3 hommes × 2 jours CHANGE sa ligne : 6 jour/homme, 2 400 €, et une seule", async () => {
    const r = await poserLaMainDoeuvreDeLaFeuille(A, c.id, null, { qui: "equipe", hommes: 3, jours: 2, tarif: "400" }, sienne.id);
    assert.ok(r.ok && r.changee, `la feuille n'a pas changé sa ligne : ${JSON.stringify(r)}`);
    const siennes = await deSonEquipe();
    assert.equal(siennes.length, 1, `deux lignes Main d'œuvre : ${siennes.map((l) => l.montant).join(" et ")}`);
    assert.deepEqual(
      { id: siennes[0].id, libelle: siennes[0].libelle, q: Number(siennes[0].quantite), montant: Number(siennes[0].montant), hommes: siennes[0].hommesMainDoeuvre },
      { id: sienne.id, libelle: sienne.libelle, q: 6, montant: 2400, hommes: 3 }
    );
    const taille = (await lignes()).find((l) => l.libelle.startsWith("Taille"));
    assert.equal(Number(taille?.montant), 750, "le prix de la taille a bougé");
  });

  await test("la feuille se rouvre sur 3 hommes × 2 jours, à son prix", async () => {
    const [l] = await deSonEquipe();
    assert.deepEqual(equipeDeSaLigne(l, { hommes: 2 }), { hommes: 3, jours: 2, tarif: "400.00" });
  });

  await reglerMarge(A, "mainOeuvre", "1.20");
  const durand = await creerSociete(A, "partenaire", "Élagage Durand");
  const journee = await ajouterPrixAchat(A, durand.id, { nom: "Démontage sur corde", unite: "journée", prixHt: "450", source: "essai" });

  // Le nom du partenaire ne s'écrit plus sur la ligne (sa réponse du
  // 19 novembre 2026 : « le retirer », `ARCHITECTURE.md` §592) : sa ligne se
  // distingue de celle de l'équipe par son unité, jamais par son libellé.
  await test("un partenaire pose SA ligne, sans son nom, et celle de son équipe ne bouge pas", async () => {
    const r = await poserLaMainDoeuvreDeLaFeuille(A, c.id, null, { qui: "partenaire", prixId: journee.id, quantite: 2 }, sienne.id);
    assert.ok(r.ok && !r.changee, `le partenaire a pris la ligne de son équipe : ${JSON.stringify(r)}`);
    const mo = (await lignes()).filter((l) => l.mainDoeuvre);
    assert.deepEqual(
      mo.map((l) => [l.libelle, Number(l.montant), l.unite]),
      [
        [sienne.libelle, 2400, sienne.unite],
        // L'unité s'écrit comme sur toute ligne du devis (`unite-de-ligne.ts`) : « jour ».
        ["Main d’œuvre", 1080, "jour"],
      ]
    );
  });

  await test("une ligne qui n'est pas celle de son équipe ne se réécrit pas, et le refus se dit", async () => {
    const avant = (await lignes()).map((l) => [l.id, l.montant]);
    const partenaire = (await lignes()).find((l) => l.mainDoeuvre && l.unite === "jour")!;
    const taille = (await lignes()).find((l) => l.libelle.startsWith("Taille"))!;
    for (const autre of [partenaire.id, taille.id, "00000000-0000-0000-0000-000000000000"]) {
      const r = await poserLaMainDoeuvreDeLaFeuille(A, c.id, null, { qui: "equipe", hommes: 1, jours: 1, tarif: "400" }, autre);
      assert.ok(!r.ok && /plus sur le devis/.test(r.raison), `accepté sur ${autre} : ${JSON.stringify(r)}`);
    }
    assert.deepEqual((await lignes()).map((l) => [l.id, l.montant]), avant, "un refus a écrit");
  });

  await test("« Répartis » : sa ligne part, ses 2 400 € entrent dans la taille, rien ne compte deux fois", async () => {
    const taille = (await lignes()).find((l) => l.libelle.startsWith("Taille"))!;
    const r = await poserLesPartsDeMainDoeuvre(A, c.id, repartirMainOeuvre("2400.00", [taille.id], {}), "400.00", sienne.id);
    assert.ok(r.ok && r.retiree === sienne.id, `la répartition refuse : ${JSON.stringify(r)}`);
    assert.equal((await deSonEquipe()).length, 0, "la ligne de son équipe reste à côté de sa part");
    const apres = await lignes();
    assert.equal(Number(apres.find((l) => l.id === taille.id)?.montant), 3150);
    assert.ok(apres.some((l) => l.mainDoeuvre && l.unite === "jour"), "la ligne du partenaire est partie avec");
  });

  await test("répartir sur une ligne qui n'est pas la sienne ne pose rien", async () => {
    const avant = (await lignes()).map((l) => [l.id, l.montant]);
    const taille = (await lignes()).find((l) => l.libelle.startsWith("Taille"))!;
    const partenaire = (await lignes()).find((l) => l.mainDoeuvre && l.unite === "jour")!;
    const r = await poserLesPartsDeMainDoeuvre(A, c.id, repartirMainOeuvre("400.00", [taille.id], {}), "400.00", partenaire.id);
    assert.ok(!r.ok, "la ligne d'un partenaire a été prise pour celle de son équipe");
    assert.deepEqual((await lignes()).map((l) => [l.id, l.montant]), avant, "un refus a écrit");
  });

  // **Répartie, sa main d'œuvre n'a plus de ligne** : elle vit dans le prix des
  // travaux. Le défaut relevé en codant §591 : la répartir une seconde fois
  // l'AJOUTAIT à la première, et la reposer sur une ligne la laissait aussi
  // dans les travaux. Deux fois la même main d'œuvre, sur un devis qui part.
  const taille = async () => (await lignes()).find((l) => l.libelle.startsWith("Taille"))!;

  await test("répartir une seconde fois REMPLACE ses parts : 2 400 € restent 2 400 €", async () => {
    const t = await taille();
    const r = await poserLesPartsDeMainDoeuvre(A, c.id, repartirMainOeuvre("2400.00", [t.id], {}), "400.00", null, [t.id]);
    assert.ok(r.ok, `la répartition refuse : ${JSON.stringify(r)}`);
    const apres = await taille();
    assert.deepEqual(
      { montant: Number(apres.montant), part: Number(apres.partMainDoeuvre), jours: Number(apres.joursMainDoeuvre) },
      { montant: 3150, part: 2400, jours: 6 },
      "la même main d'œuvre compte deux fois"
    );
  });

  await test("reposée sur sa ligne, sa main d'œuvre SORT des travaux : la taille revient à 750 €", async () => {
    const t = await taille();
    const r = await poserLaMainDoeuvreDeLaFeuille(A, c.id, null, { qui: "equipe", hommes: 3, jours: 2, tarif: "400" }, null, [t.id]);
    assert.ok(r.ok, `la feuille refuse : ${JSON.stringify(r)}`);
    const apres = await taille();
    assert.deepEqual(
      { montant: Number(apres.montant), part: apres.partMainDoeuvre === null ? 0 : Number(apres.partMainDoeuvre) },
      { montant: 750, part: 0 },
      "sa main d'œuvre est restée dans la taille, à côté de sa ligne"
    );
    const siennes = await deSonEquipe();
    assert.deepEqual(siennes.map((l) => Number(l.montant)), [2400]);
  });

  await test("la part d'un partenaire, elle, reste dans le travail quand son équipe change", async () => {
    const t = await taille();
    const sesPrix = await poserLesPartsDeMainDoeuvre(A, c.id, repartirMainOeuvre("1080.00", [t.id], {}), null);
    assert.ok(sesPrix.ok, `la part du partenaire refuse : ${JSON.stringify(sesPrix)}`);
    const [sienne] = await deSonEquipe();
    const r = await poserLaMainDoeuvreDeLaFeuille(A, c.id, null, { qui: "equipe", hommes: 2, jours: 2, tarif: "400" }, sienne.id, [t.id]);
    assert.ok(r.ok, `la feuille refuse : ${JSON.stringify(r)}`);
    const apres = await taille();
    assert.deepEqual(
      { montant: Number(apres.montant), part: Number(apres.partMainDoeuvre) },
      { montant: 1830, part: 1080 },
      "changer son équipe a retiré la main d'œuvre du partenaire"
    );
  });

  // **Préparer le devis à nouveau** (rejouer la dictée) : il ne réécrit jamais
  // une ligne déjà là, il la refuse comme doublon. Sa ligne changée à 3 hommes
  // reste donc la sienne, et une ligne renommée au doigt reste la ligne de son
  // équipe : elle se reconnaît à `estLaLigneDeSonEquipe`, pas à son nom.
  const c2 = await chantiersRepo.creerChantier(A, { nom: "Rejouer la dictée" });
  await brouillonsRepo.enregistrerGeneration(
    A,
    c2.id,
    {
      ...brouillonVide(),
      prestations: [{ ...base, libelle: "Taille de photinias", nature: "haie", quantite: "50", unite: "ml" }],
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    },
    "dictée"
  );
  assert.ok((await confirmerBrouillon(A, c2.id)).succes);
  await enregistrerPrecisions(A, c2.id, [
    {
      sujet: SUJET_MAIN_OEUVRE,
      libellePrestation: "Main d'œuvre",
      valeur: ecrireChoix({ mode: "ligne", parts: {}, retires: [] }),
      lisible: "main d'œuvre",
    },
  ]);
  assert.ok((await appliquerPropositionPrix(A, c2.id)).succes);
  const deSonEquipe2 = async () => (await listerLignesPrix(A, c2.id)).filter(estLaLigneDeSonEquipe);

  await test("préparer le devis à nouveau garde sa ligne changée à 3 hommes", async () => {
    const [l] = await deSonEquipe2();
    assert.ok((await poserLaMainDoeuvreDeLaFeuille(A, c2.id, null, { qui: "equipe", hommes: 3, jours: 2, tarif: "400" }, l.id, [])).ok);
    await appliquerPropositionPrix(A, c2.id);
    assert.deepEqual(
      (await deSonEquipe2()).map((x) => ({ q: Number(x.quantite), hommes: x.hommesMainDoeuvre })),
      [{ q: 6, hommes: 3 }],
      "la dictée a repris le dessus sur sa ligne"
    );
  });

  await test("renommée au doigt, sa ligne reste la sienne : préparer à nouveau n'en pose pas une seconde", async () => {
    const [l] = await deSonEquipe2();
    await modifierLignePrix(A, l.id, { libelle: "Main d’œuvre de l’équipe" });
    await appliquerPropositionPrix(A, c2.id);
    const siennes = await deSonEquipe2();
    assert.deepEqual(
      siennes.map((x) => [x.libelle, Number(x.quantite)]),
      [["Main d’œuvre de l’équipe", 6]],
      "deux lignes de son équipe : la dictée a posé la sienne à côté"
    );
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
