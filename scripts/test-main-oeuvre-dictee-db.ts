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
import { preparerPropositionPrix, questionMainOeuvre } from "../src/server/chiffrage/proposition-prix";
import { brouillonVide, type PropositionExtraction } from "../src/server/ai/schemas/extraction";
import { ecrireChoix, SUJET_MAIN_OEUVRE, type ChoixMainOeuvre } from "../src/lib/main-oeuvre-dictee";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import { listerLignesPrix } from "../src/server/repositories/lignes-prix";
import { questionsRestantes } from "../src/server/services/devis-depuis-dictee";
import { fermerLimiteur } from "../src/server/rate-limit";
import { ajouterPrixAchat, creerSociete, reglerMarge, reglerMargeSociete } from "../src/server/repositories/fournisseurs-partenaires";
import { nettoyerBase } from "./_test-db";

// **La main d'œuvre qu'il dicte, au prix de SES tarifs** : ses messages du
// 21 octobre 2026, avec ses chiffres à lui (capture de « Mes tarifs ») :
//
// - *« deux hommes et une mini pelle, sur les deux il y en a un qui sera
//   affilié à la mini pelle : ça fait 400 plus 500 par jour »* ;
// - *« à partir du moment où il dicte deux jours à trois, il compte de la main
//   d'œuvre : il faut lui demander comment la répartir ; s'il ne parle pas de
//   jours et d'hommes, ce sont les prix des grilles qui l'emportent »* ;
// - son devis 067 : un tarif « Évacuation » reconnu construisait le devis
//   ENTIER avec lui, et l'abattage, le démontage et la main d'œuvre
//   disparaissaient.
//
// Sous `atlas_app`, du brouillon jusqu'aux lignes proposées.

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

async function sonEntreprise(n: string) {
  const { entreprise: e, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `MO ${n}` },
    { email: `mo-${n}-${Date.now()}@t.test` }
  );
  const A = { entrepriseId: e.id, utilisateurId };
  for (const [intitule, prix, unite] of [
    ["Broyeur", "250", "forfait"],
    ["Mini pelle", "400", "forfait"],
    ["Fendeuse", "150", "forfait"],
    ["Mains d'œuvre plus mini pelle", "500", "forfait"],
    ["Évacuation", "150", "forfait"],
    ["Main d'œuvre", "400", "jour/homme"],
  ] as const) {
    await tarifsRepo.creerTarif(A, { intitule, prix, unite });
  }
  await poserPrixGrille(A, "haie", CELLULE_HAIE, "15");
  return A;
}

async function chantierDicte(
  A: { entrepriseId: string; utilisateurId: string },
  dictee: Partial<PropositionExtraction>
) {
  const c = await chantiersRepo.creerChantier(A, { nom: "Dicté" });
  await brouillonsRepo.enregistrerGeneration(A, c.id, { ...brouillonVide(), ...dictee }, "dictée");
  assert.ok((await confirmerBrouillon(A, c.id)).succes);
  return c;
}

const lignes = async (A: { entrepriseId: string; utilisateurId: string }, id: string) =>
  (await preparerPropositionPrix(A, id))!.lignes.map((l) => [l.libelle, l.montant === null ? null : Number(l.montant)]);

async function repondre(A: { entrepriseId: string; utilisateurId: string }, id: string, choix: ChoixMainOeuvre) {
  await enregistrerPrecisions(A, id, [
    { sujet: SUJET_MAIN_OEUVRE, libellePrestation: "Main d'œuvre", valeur: ecrireChoix(choix), lisible: "main d'œuvre" },
  ]);
}

async function main() {
  await nettoyerBase();

  await test("« deux hommes et une mini pelle, une journée » : 400 € de main d'œuvre plus 500 € de mini pelle avec son homme", async () => {
    const A = await sonEntreprise("deux");
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Terrassement d'une allée" }],
      materiel: [{ ...base, libelle: "Mini pelle" }],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    assert.deepEqual(await lignes(A, c.id), [
      ["Terrassement d'une allée", 400],
      ["Mini pelle", 500],
    ]);
  });

  await test("son devis 067, deux jours à trois avec mini pelle : rien ne disparaît, 1 600 € de main d'œuvre et 2 × 500 € de mini pelle", async () => {
    const A = await sonEntreprise("067");
    const c = await chantierDicte(A, {
      prestations: [
        { ...base, libelle: "Abattage d'un chêne mort", nature: "abattage", espece: "chêne", quantite: "1", unite: "arbre" },
        { ...base, libelle: "Démontage d'un arbre en rétention", nature: "abattage" },
        { ...base, libelle: "Évacuation du bois", quantite: "10", unite: "tonne" },
      ],
      materiel: [{ ...base, libelle: "Broyeur" }, { ...base, libelle: "Mini-pelle" }],
      dureePrevue: "2 jours",
      tailleEquipe: "3 hommes",
    });
    const l = await lignes(A, c.id);
    const total = l.reduce((s, [, m]) => s + Number(m ?? 0), 0);
    assert.ok(l.some(([n]) => /Abattage d'un chêne mort/.test(String(n))), "l'abattage est sur le devis");
    assert.ok(l.some(([n, m]) => n === "Mini-pelle" && m === 1000), `la mini pelle, deux jours avec son homme : ${JSON.stringify(l)}`);
    assert.ok(l.some(([n, m]) => n === "Broyeur" && m === 250));
    assert.equal(total, 1600 + 1000 + 250, JSON.stringify(l));
  });

  await test("sans jours ni hommes, sa grille l'emporte : 20 ml × 15 €, et la mini pelle seule à 400 €", async () => {
    const A = await sonEntreprise("grille");
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" }],
      materiel: [{ ...base, libelle: "Mini pelle" }],
    });
    assert.deepEqual(await lignes(A, c.id), [
      ["Taille de haie de laurier", 300],
      ["Mini pelle", 400],
    ]);
    assert.equal((await questionMainOeuvre(A, c.id)).dictee, false, "aucune question de main d'œuvre");
  });

  await test("la question se pose quand il dicte des jours et des hommes, avec la part de sa grille déjà posée", async () => {
    const A = await sonEntreprise("question");
    const c = await chantierDicte(A, {
      prestations: [
        { ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" },
        { ...base, libelle: "Taille de cohabitation avec la maison" },
      ],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    const { dictee, question } = await questionMainOeuvre(A, c.id);
    assert.equal(dictee, true);
    assert.ok(question?.mainOeuvre, "la carte de la main d'œuvre est posée");
    assert.equal(Number(question!.mainOeuvre!.total), 800);
    const haie = question!.mainOeuvre!.travaux.find((t) => /haie/.test(t.libelle));
    assert.equal(Number(haie?.grille), 300, "le prix de sa grille accompagne le travail");
    // Sans réponse : réparti, la haie à sa case, le reste à l'autre travail.
    assert.deepEqual(await lignes(A, c.id), [
      ["Taille de haie de laurier", 300],
      ["Taille de cohabitation avec la maison", 500],
    ]);
  });

  await test("un montant écrit à l'euro près arrive au devis tel quel : 297 € et 503 €, pas 300 € et 500 €", async () => {
    // Sa réponse du 27 octobre 2026 : « si la main d'œuvre c'est 397, ça pourra
    // pas être arrondi à 10 ». La barre montrait 297 €, le devis écrivait 300 €.
    const A = await sonEntreprise("ecrit");
    const c = await chantierDicte(A, {
      prestations: [
        { ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" },
        { ...base, libelle: "Taille de cohabitation avec la maison" },
      ],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    const { question } = await questionMainOeuvre(A, c.id);
    const cle = (motif: RegExp) => question!.mainOeuvre!.travaux.find((t) => motif.test(t.libelle))!.cle;
    await repondre(A, c.id, { mode: "reparti", parts: { [cle(/haie/)]: 297, [cle(/cohabitation/)]: 503 }, retires: [] });
    assert.deepEqual(await lignes(A, c.id), [
      ["Taille de haie de laurier", 297],
      ["Taille de cohabitation avec la maison", 503],
    ]);
  });

  await test("« sur une ligne Main d'œuvre » : une seule ligne qui nomme les travaux, 2 jour/homme × 400 €", async () => {
    const A = await sonEntreprise("ligne");
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" }],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    await repondre(A, c.id, { mode: "ligne", parts: {}, retires: [] });
    const p = (await preparerPropositionPrix(A, c.id))!;
    assert.deepEqual(
      p.lignes.map((l) => [l.libelle, Number(l.montant), l.quantite, l.unite]),
      [["Main d'œuvre : taille de haie de laurier", 800, "2", "jour/homme"]]
    );
  });

  // **Le partenaire pris sur la question** : son « B » du 4 novembre 2026
  // (`appli/soignee/main-oeuvre-dictee-partenaires.html`). Le prix se relit en
  // base, jamais sur la parole de l'écran : une quantité mentie à la journée ne
  // passe pas, et le prix d'une autre entreprise non plus.
  const sesPartenaires = async (A: { entrepriseId: string; utilisateurId: string }) => {
    await reglerMarge(A, "mainOeuvre", "1.20");
    const durand = await creerSociete(A, "partenaire", "Élagage Durand");
    await reglerMargeSociete(A, durand.id, "1.35");
    const morel = await creerSociete(A, "partenaire", "Terrassement Morel");
    const journee = await ajouterPrixAchat(A, durand.id, { nom: "Démontage sur corde", unite: "journée", prixHt: "450", source: "essai" });
    const heure = await ajouterPrixAchat(A, morel.id, { nom: "Mini-pelle avec chauffeur", unite: "heure", prixHt: "60", source: "essai" });
    return { journee, heure };
  };

  await test("la question porte ses partenaires et les jours dictés", async () => {
    const A = await sonEntreprise("partenaires-question");
    const { journee } = await sesPartenaires(A);
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" }],
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });
    const mo = (await questionMainOeuvre(A, c.id)).question!.mainOeuvre!;
    assert.equal(mo.jours, 2);
    const p = mo.partenaires.find((x) => x.id === journee.id);
    assert.ok(p, `le prix de son partenaire est dans la question : ${JSON.stringify(mo.partenaires)}`);
    assert.equal(p!.venteHt, "607.50", "450 € × 1,35, sa marge à lui");
  });

  await test("un partenaire pris à la journée : 2 jours × 450 € × 1,35, sur une ligne qui dit son nom, quoi que l'écran envoie", async () => {
    const A = await sonEntreprise("partenaire-ligne");
    const { journee } = await sesPartenaires(A);
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" }],
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });
    await repondre(A, c.id, { mode: "ligne", parts: {}, retires: [], partenaire: { prixId: journee.id, quantite: 99 } });
    const p = (await preparerPropositionPrix(A, c.id))!;
    assert.deepEqual(
      p.lignes.map((l) => [l.libelle, Number(l.montant), l.quantite, l.unite, l.mainDoeuvre]),
      [["Main d’œuvre : Élagage Durand", 1215, "2", "journée", true]]
    );
    assert.ok(
      p.explication.calcul.some((x) => /Élagage Durand/.test(x.detail) && /2 jours × 450\s€ × 1,35/.test(x.detail)),
      JSON.stringify(p.explication.calcul)
    );
  });

  await test("un partenaire à l'heure, réparti : les travaux se partagent 10 h × 60 € × 1,20", async () => {
    const A = await sonEntreprise("partenaire-reparti");
    const { heure } = await sesPartenaires(A);
    const c = await chantierDicte(A, {
      prestations: [
        { ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" },
        { ...base, libelle: "Taille de cohabitation avec la maison" },
      ],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    await repondre(A, c.id, { mode: "reparti", parts: {}, retires: [], partenaire: { prixId: heure.id, quantite: 10 } });
    const p = (await preparerPropositionPrix(A, c.id))!;
    const total = p.lignes.reduce((s, l) => s + Number(l.montant ?? 0), 0);
    assert.equal(total, 720, JSON.stringify(p.lignes));
    assert.equal(
      p.lignes.reduce((s, l) => s + Number(l.partMainDoeuvre ?? 0), 0),
      720,
      "« dont main d'œuvre » compte le prix du partenaire"
    );
  });

  await test("le prix d'une autre entreprise ne passe pas : la main d'œuvre arrive à chiffrer, et la phrase le dit", async () => {
    const A = await sonEntreprise("partenaire-etranger");
    const B = await sonEntreprise("partenaire-autre");
    const { journee: chezB } = await sesPartenaires(B);
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" }],
      dureePrevue: "2 jours",
      tailleEquipe: "2 hommes",
    });
    await repondre(A, c.id, { mode: "ligne", parts: {}, retires: [], partenaire: { prixId: chezB.id, quantite: 2 } });
    const p = (await preparerPropositionPrix(A, c.id))!;
    assert.deepEqual(p.lignes.map((l) => l.montant), [null], JSON.stringify(p.lignes));
    assert.ok(p.explication.donneesManquantes.some((m) => /partenaire/.test(m)), JSON.stringify(p.explication.donneesManquantes));
  });

  // **« dont main d'œuvre HT » voit la main d'œuvre DICTÉE** (2 novembre 2026).
  // La préparation du devis écrivait la ligne « Main d'œuvre : … » sans son
  // drapeau, et les parts réparties fondues dans le prix de chaque travail :
  // le devis portait 800 € de main d'œuvre et n'en annonçait aucune sous le
  // total, ce que le client lit pour son crédit d'impôt.
  await test("« sur une ligne Main d'œuvre » : la ligne est de la main d'œuvre, et « dont » la compte", async () => {
    const A = await sonEntreprise("ligne-dont");
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" }],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    await repondre(A, c.id, { mode: "ligne", parts: {}, retires: [] });
    const p = (await preparerPropositionPrix(A, c.id))!;
    assert.deepEqual(
      p.lignes.map((l) => [l.libelle, l.mainDoeuvre === true, l.partMainDoeuvre ?? null]),
      [["Main d'œuvre : taille de haie de laurier", true, null]]
    );
    assert.ok((await appliquerPropositionPrix(A, c.id)).succes);
    const [ligne] = await listerLignesPrix(A, c.id);
    assert.equal(ligne.mainDoeuvre, true, "la ligne écrite n'est pas une ligne de main d'œuvre");
    const d = await getOuCreerDevisBrouillon(A, c.id);
    assert.equal(d.mainDoeuvreHt, "800.00", "« dont main d'œuvre HT » ne voit pas la ligne");
  });

  await test("réparti : chaque travail garde SA part, « dont » compte toute la main d'œuvre et pas la grille d'un travail sorti", async () => {
    const A = await sonEntreprise("reparti-dont");
    const c = await chantierDicte(A, {
      prestations: [
        { ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" },
        { ...base, libelle: "Taille de cohabitation avec la maison" },
        { ...base, libelle: "Démontage d'un érable", nature: "abattage" },
      ],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    const { question } = await questionMainOeuvre(A, c.id);
    const cle = (motif: RegExp) => question!.mainOeuvre!.travaux.find((t) => motif.test(t.libelle))!.cle;
    // La haie sort par la croix : elle prend sa grille (300 €), qui n'est pas de la main d'œuvre dictée.
    await repondre(A, c.id, {
      mode: "reparti",
      parts: { [cle(/cohabitation/)]: 297, [cle(/érable/)]: 503 },
      retires: [cle(/haie/)],
    });
    const p = (await preparerPropositionPrix(A, c.id))!;
    assert.deepEqual(
      p.lignes.map((l) => [l.libelle, Number(l.montant), l.mainDoeuvre === true, l.partMainDoeuvre ?? null]),
      [
        ["Démontage d'un érable", 503, false, "503.00"],
        ["Taille de haie de laurier", 300, false, null],
        ["Taille de cohabitation avec la maison", 297, false, "297.00"],
      ]
    );
    assert.ok((await appliquerPropositionPrix(A, c.id)).succes);
    const ecrites = await listerLignesPrix(A, c.id);
    assert.deepEqual(
      ecrites.map((l) => [l.libelle, l.mainDoeuvre, l.partMainDoeuvre]),
      [
        ["Démontage d'un érable", false, "503.00"],
        ["Taille de haie de laurier", false, null],
        ["Taille de cohabitation avec la maison", false, "297.00"],
      ]
    );
    const d = await getOuCreerDevisBrouillon(A, c.id);
    assert.equal(d.totalHt, "1100.00");
    assert.equal(d.mainDoeuvreHt, "800.00", "« dont main d'œuvre HT » ne compte pas les parts réparties");
  });

  await test("la croix rend un travail à sa grille, ou le laisse à chiffrer et le dit", async () => {
    const A = await sonEntreprise("croix");
    const c = await chantierDicte(A, {
      prestations: [
        { ...base, libelle: "Taille de haie de laurier", nature: "haie", quantite: "20", unite: "ml" },
        { ...base, libelle: "Plantation d'une glycine" },
        { ...base, libelle: "Démontage d'un érable", nature: "abattage" },
      ],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    const { question } = await questionMainOeuvre(A, c.id);
    const cle = (motif: RegExp) => question!.mainOeuvre!.travaux.find((t) => motif.test(t.libelle))!.cle;
    await repondre(A, c.id, { mode: "reparti", parts: {}, retires: [cle(/haie/), cle(/glycine/)] });
    const p = (await preparerPropositionPrix(A, c.id))!;
    const l = new Map(p.lignes.map((x) => [x.libelle, x.montant === null ? null : Number(x.montant)]));
    assert.equal(l.get("Taille de haie de laurier"), 300, "la haie à sa case de grille");
    assert.equal(l.get("Plantation d'une glycine"), null, "la glycine à chiffrer, jamais à zéro");
    assert.equal(l.get("Démontage d'un érable"), 800, "la main d'œuvre entière sur ce qui reste dedans");
    assert.ok(
      p.explication.donneesManquantes.some((d) => /glycine.*pas de prix dans votre grille/i.test(d)),
      "la phrase dit que la glycine sera à chiffrer"
    );
  });

  await test("après trois fois le même choix, la question ne se pose plus et son choix s'applique", async () => {
    const A = await sonEntreprise("retenu");
    for (let i = 0; i < 3; i++) {
      const c = await chantierDicte(A, {
        prestations: [{ ...base, libelle: `Tonte ${i}` }],
        dureePrevue: "1 jour",
        tailleEquipe: "1 homme",
      });
      await repondre(A, c.id, { mode: "ligne", parts: {}, retires: [] });
    }
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Tonte du fond" }],
      dureePrevue: "1 jour",
      tailleEquipe: "1 homme",
    });
    const { dictee, question } = await questionMainOeuvre(A, c.id);
    assert.equal(dictee, true);
    assert.equal(question, null, "la question ne revient pas");
    assert.deepEqual(await lignes(A, c.id), [["Main d'œuvre : tonte du fond", 400]]);
  });

  await test("la carte main d'œuvre S'AJOUTE aux questions de grille, elle ne les fait pas taire", async () => {
    // Rouge de la batterie commune du 22 octobre 2026 (test-questions-chiffrage-e2e) :
    // le premier jet taisait la technique dès que des jours étaient dictés,
    // contre sa décision du 6 août (« il demande si ça change le prix »).
    const A = await sonEntreprise("questions");
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Abattage d'un chêne mort", nature: "abattage" }],
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    const ids = (await questionsRestantes(A, c.id, [])).map((q) => q.id.split("#")[0]);
    assert.ok(ids.includes("abattage.technique"), `la technique n'est plus demandée : ${ids.join(", ")}`);
    assert.ok(ids.includes(SUJET_MAIN_OEUVRE), `la carte main d'œuvre manque : ${ids.join(", ")}`);
  });

  await test("rejouer la dictée sur un devis déjà écrit n'est pas un prix impossible", async () => {
    // Le second appui de test-devis-depuis-dictee-e2e : « figure déjà au détail »
    // arrêtait l'écran sur un prix « impossible » au lieu de mener au devis.
    const A = await sonEntreprise("rejeu");
    const c = await chantierDicte(A, {
      prestations: [{ ...base, libelle: "Terrassement d'une allée" }],
      dureePrevue: "1 jour",
      tailleEquipe: "1 homme",
    });
    assert.ok((await appliquerPropositionPrix(A, c.id)).succes);
    const second = await appliquerPropositionPrix(A, c.id);
    assert.equal(second.succes, false, "rien n'est écrit deux fois");
    assert.ok(!second.succes && second.dejaAuDetail, "le second appui se sait déjà au devis");
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
