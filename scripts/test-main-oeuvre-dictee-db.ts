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
import { fermerLimiteur } from "../src/server/rate-limit";
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
