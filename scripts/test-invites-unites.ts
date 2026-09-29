import assert from "node:assert/strict";
import { SYSTEME } from "../src/server/ai/services/extraction-service";
import { systeme as systemeRetouches } from "../src/server/ai/services/retouches-devis-service";
import { structureDeLaPrestation } from "../src/lib/prestation-structuree";
import { NATURES } from "../src/lib/natures-prestation";
import { extraire } from "../src/server/ai/services/extraction-service";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";

// **Les deux micros doivent demander la MÊME chose des unités.**
//
// Le produit a deux invites qui produisent des quantités : celle qui lit une
// dictée de chantier, et celle qui écoute quand il parle DANS son devis. Elles
// ne disaient pas la même chose — la seconde donnait des exemples d'unités
// métier (« stère », « arbre »), la première n'en donnait aucun.
//
// Ce n'est pas un détail de rédaction : l'unité décide de la multiplication par
// une quantité au moment du chiffrage. Deux consignes divergentes, c'est le même
// mot dicté qui devient une quantité par un micro et rien du tout par l'autre.
//
// ─── Ce que ces contrôles peuvent, et ce qu'ils NE peuvent pas ──────────────
//
// Ils tiennent le CONTRAT — ce que le produit demande au modèle, et ce que le
// code fait de sa réponse. **Ils ne prouvent rien de ce que le modèle répond
// vraiment** : cet environnement n'a aucune clé d'IA (`CLAUDE.md` §1 ter). Le
// contrôle réel est listé en fin de fichier et reste à jouer sur l'espace du
// patron, où les clés sont branchées.

let reussites = 0;
let echecs = 0;
// Les cas s'enchaînent : deux d'entre eux passent par l'extraction, qui répond
// plus tard, et le bilan ne doit se faire qu'une fois tous rendus.
let file: Promise<void> = Promise.resolve();
function cas(nom: string, verifier: () => void | Promise<void>): void {
  file = file.then(async () => {
    try {
      await verifier();
      console.log(`  ✓ ${nom}`);
      reussites++;
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    }
  });
}

function titre(t: string): void {
  file = file.then(() => console.log(t));
}

const RETOUCHES = systemeRetouches([], null);

titre("\n=== Les deux invites disent la même chose des unités ===\n");

cas("les deux comptent les objets en « u », jamais en « souche » ni en « arbre »", () => {
  // Sa règle du 29 septembre 2026 : seules ses unités par défaut. Les
  // invites apprenaient au modèle « deux souches » -> "souche".
  for (const [nom, invite] of [
    ["l'extraction d'une dictée", SYSTEME],
    ["la dictée dans le devis", RETOUCHES],
  ] as const) {
    assert.match(invite, /« deux souches »\s*->\s*"(quantite": )?"?2"?[^\n]*"u"/, `${nom} ne compte pas les souches en u`);
    assert.doesNotMatch(invite, /("unite":\s*"|\/\s*")(souche|arbre|stère)"/i, `${nom} propose encore une unité hors de sa liste`);
  }
});

cas("les deux exigent que l'objet compté soit PRONONCÉ", () => {
  // La borne qui empêche de transformer n'importe quel substantif en unité.
  for (const [nom, invite] of [
    ["l'extraction d'une dictée", SYSTEME],
    ["la dictée dans le devis", RETOUCHES],
  ] as const) {
    assert.match(invite, /explicitement prononcé/i, `${nom} n'exige pas que l'objet compté soit prononcé`);
  }
});

cas("les deux refusent une quantité sans son unité", () => {
  for (const [nom, invite] of [
    ["l'extraction d'une dictée", SYSTEME],
    ["la dictée dans le devis", RETOUCHES],
  ] as const) {
    assert.match(invite, /jamais l'une sans l'autre/i, `${nom} n'interdit pas la quantité orpheline`);
  }
});

titre("\n=== La durée et l'équipe ne deviennent pas des quantités ===\n");

cas("l'extraction dit où vont « quatre journées » et « deux hommes »", () => {
  // Sans cette borne, « deux hommes » deviendrait une prestation de quantité 2,
  // et la taille d'équipe qui fait le prix au temps resterait vide.
  assert.match(SYSTEME, /dureePrevue/, "l'invite ne rappelle pas où va la durée");
  assert.match(SYSTEME, /tailleEquipe/, "l'invite ne rappelle pas où va l'équipe");
  assert.match(
    SYSTEME,
    /jamais dans la quantité d'une prestation/i,
    "rien n'interdit de faire de « deux hommes » une quantité de prestation"
  );
});

titre("\n=== La liste des natures vient du référentiel, jamais d'une copie ===\n");

cas("chaque nature du référentiel est proposée au modèle", () => {
  // **Une nature ajoutée au référentiel et oubliée dans l'invite ne serait
  // jamais proposée** : la case existerait, rien ne pourrait la désigner. C'est
  // la règle dupliquée que `CLAUDE.md` §3 interdit, et elle a déjà coûté une
  // rangée de grille vide pour toujours (14 août 2026).
  for (const n of NATURES) {
    assert.ok(
      SYSTEME.includes(n.cle),
      `« ${n.cle} » existe dans le référentiel et n'est pas proposée au modèle`
    );
  }
});

cas("l'invite exige que l'espèce soit PRONONCÉE", () => {
  assert.match(SYSTEME, /PRONONCÉE/);
  assert.match(SYSTEME, /Jamais déduite/i);
});

cas("et elle interdit d'inventer une nature", () => {
  assert.match(SYSTEME, /N'invente\s+JAMAIS un nom de nature/i);
});

titre("\n=== Ce que le code fait d'une unité de comptage ===\n");

cas("un modèle qui répond « souche » est ramené à « u », la quantité gardée", async () => {
  // Le modèle peut désobéir à l'invite : c'est le code qui ferme la porte.
  const reponse = JSON.stringify({
    prestations: [
      { libelle: "Dessouchage", description: "souches de 60", quantite: "2", unite: "souche", nature: "dessouchage", espece: null, aConfirmer: false },
      { libelle: "Démontage d'un chêne", description: null, quantite: "1", unite: "arbre", nature: "abattage", espece: "chêne", aConfirmer: false },
      { libelle: "Fente du bois", description: null, quantite: "3", unite: "stères", nature: "fendage", espece: null, aConfirmer: false },
    ],
    materiel: [{ libelle: "Sacs de terreau", description: null, quantite: "4", unite: "sacs", aConfirmer: false }],
  });
  const fournisseur = { nom: "essai", genererTexte: async () => ({ succes: true as const, texte: reponse }) } as unknown as FournisseurLLM;
  const r = await extraire("Dessouchage de deux souches de 60, démontage d'un chêne, trois stères de fente.", fournisseur);
  assert.ok(r.succes && r.lecture === "modele", "la réponse du modèle n'a pas été lue");
  const [souches, chene, fente] = r.proposition.prestations;
  assert.deepEqual([souches.quantite, souches.unite], ["2", "u"]);
  assert.deepEqual([chene.quantite, chene.unite], ["1", "u"]);
  // Une mesure qu'aucune de ses unités ne dit tombe AVEC sa quantité : « 3 »
  // tout seul se lirait trois de n'importe quoi.
  assert.deepEqual([fente.quantite, fente.unite], [null, null]);
  assert.deepEqual([r.proposition.materiel[0].quantite, r.proposition.materiel[0].unite], ["4", "u"]);
});

cas("la lecture mot à mot ne sort pas non plus d'unité hors de sa liste", async () => {
  const sansReseau = { nom: "essai", genererTexte: async () => ({ succes: false as const, erreur: { code: "indisponible", message: "hors ligne" } }) } as unknown as FournisseurLLM;
  const r = await extraire("pose de 3 sacs de terreau, 12 m3 de terre, 20 ml de bordure", sansReseau);
  assert.ok(r.succes && r.lecture === "litterale");
  const unites = [...r.proposition.prestations, ...r.proposition.materiel].map((l) => l.unite).filter(Boolean);
  for (const u of unites) assert.ok(["u", "ml", "m²", "heure", "forfait", "tonne", "jour/homme"].includes(u!), `« ${u} » est sorti`);
  assert.ok(unites.includes("ml"), `le mètre linéaire s'est perdu : ${JSON.stringify(unites)}`);
});

cas("un nombre dont on ne sait pas ce qu'il compte n'entre pas", () => {
  const s = structureDeLaPrestation({
    libelle: "Divers",
    description: null,
    quantite: "2",
    unite: null,
    aConfirmer: false,
  });
  assert.equal(s.quantite, null);
  assert.equal(s.unite, null);
});

void file.then(() => {
console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);

// ─── RESTE À ÉPROUVER AVEC UNE VRAIE CLÉ ───────────────────────────────────
//
// Ces six dictées doivent être jouées sur l'espace du patron, où les
// fournisseurs répondent — rien ici ne peut le faire :
//
//   « deux souches »                    -> quantite 2,    unite « u »
//   « trois arbres »                    -> quantite 3,    unite « u »
//   « quatre journées »                 -> dureePrevue, PAS une quantité
//   « deux hommes »                     -> tailleEquipe, PAS une quantité
//   « huit cents mètres linéaires »     -> quantite 800,  unite « ml »
//   « mille deux cents mètres carrés »  -> quantite 1200, unite « m² »
console.log(
  "\n⚠ Le comportement réel du modèle sur ces six dictées reste à éprouver sur\n" +
    "  un espace avec les clés d'IA branchées — aucun contrôle d'ici ne le prouve."
);

if (echecs > 0) process.exitCode = 1;
});
