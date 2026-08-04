import assert from "node:assert/strict";
import { lireObjetJson } from "../src/lib/json-du-modele";
import { extraire } from "../src/server/ai/services/extraction-service";
import { lireLitteralement } from "../src/server/ai/lecture-litterale";
import { erreurIA } from "../src/server/ai/errors";
import type { FournisseurLLM, ResultatLLM } from "../src/server/ai/providers/llm/interface";

// **Le défaut du 4 août 2026, et le filet qui l'empêche de revenir.**
//
// Sur sa capture, sous « Générer le brouillon » : « Réponse du fournisseur non
// conforme (JSON invalide). » Et rien d'autre — pas de brouillon, pas de
// prestations, pas de prix, pas de devis. Sa phrase : « toujours pas de devis
// créé tout seul à partir de la note vocale ! Problème qui traîne. »
//
// Le service faisait `JSON.parse(reponse)` sans filet. Un modèle qui encadre sa
// réponse en ```json, ou qui écrit « Voici : { … } », suffisait à tout arrêter.
// Et quand plus rien ne répond — pas de clé, quota dépassé, réseau coupé — le
// patron n'avait pas davantage : un écran mort, alors que sa dictée était là.
//
// Deux garanties sont éprouvées ici :
//   1. l'emballage est toléré, le fond ne l'est pas (le schéma reste juge) ;
//   2. **il n'existe plus un seul chemin où le patron se retrouve sans rien** :
//      quoi que réponde le fournisseur, la dictée est au minimum lue mot à mot.

const DICTEE_DU_PATRON =
  "Taille de haie de laurier, 20 mètres linéaire, chaîne mort à démonter, couper le bois en 50, " +
  "le laisser sur place, j'estime le temps de travaux à 2 jours, 2 hommes, un camion à broyeur et une fondeuse.";

let echecs = 0;
async function cas(nom: string, verifier: () => void | Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Un fournisseur qui répond exactement ce qu'on lui demande de répondre. */
function fournisseurQuiRepond(reponse: ResultatLLM): FournisseurLLM {
  return {
    nom: "essai",
    async genererTexte(): Promise<ResultatLLM> {
      return reponse;
    },
  };
}

const JSON_VALIDE = JSON.stringify({
  prestations: [{ libelle: "Taille de haie", description: null, quantite: "20", unite: "m", aConfirmer: false }],
  materiel: [],
  dureePrevue: "2 jours",
  tailleEquipe: "2 hommes",
  gestionDechets: null,
  contraintesAcces: null,
  remarques: null,
  ambiguites: [],
  informationsManquantes: [],
});

async function main() {
  console.log("=== Retrouver le JSON dans ce que le modèle a écrit ===");

  await cas("un JSON nu est lu", () => {
    assert.deepEqual(lireObjetJson('{"a":1}'), { a: 1 });
  });

  await cas("un JSON encadré en ```json est lu — c'est l'emballage le plus courant", () => {
    assert.deepEqual(lireObjetJson('```json\n{"a":1}\n```'), { a: 1 });
  });

  await cas("un JSON encadré sans langage annoncé est lu", () => {
    assert.deepEqual(lireObjetJson('```\n{"a":1}\n```'), { a: 1 });
  });

  await cas("un JSON noyé dans de la prose est lu", () => {
    assert.deepEqual(lireObjetJson('Voici le résultat :\n{"a":1}\nJ\'espère que cela convient.'), { a: 1 });
  });

  await cas("une accolade dans une chaîne ne fausse pas le découpage", () => {
    // Compter les accolades sans tenir compte des chaînes coupait ici trop tôt.
    assert.deepEqual(lireObjetJson('bla {"libelle":"pose d\'un {} décoratif","n":1} bla'), {
      libelle: "pose d'un {} décoratif",
      n: 1,
    });
  });

  await cas("un objet imbriqué est rendu entier", () => {
    assert.deepEqual(lireObjetJson('texte {"a":{"b":[1,2]}} fin'), { a: { b: [1, 2] } });
  });

  await cas("du texte sans objet ne rend rien — jamais une exception", () => {
    assert.equal(lireObjetJson("Je ne peux pas répondre à cette demande."), null);
    assert.equal(lireObjetJson(""), null);
    assert.equal(lireObjetJson(null), null);
    assert.equal(lireObjetJson("{ ceci n'est pas du json"), null);
  });

  console.log("=== Ce que le patron obtient, quoi que réponde le fournisseur ===");

  await cas("réponse conforme : c'est le modèle qui a lu", async () => {
    const r = await extraire(DICTEE_DU_PATRON, fournisseurQuiRepond({ succes: true, texte: JSON_VALIDE }));
    assert.ok(r.succes);
    assert.equal(r.lecture, "modele");
    assert.equal(r.proposition.prestations[0].libelle, "Taille de haie");
  });

  await cas("réponse encadrée : lue, pas rejetée", async () => {
    const r = await extraire(
      DICTEE_DU_PATRON,
      fournisseurQuiRepond({ succes: true, texte: "```json\n" + JSON_VALIDE + "\n```" })
    );
    assert.ok(r.succes);
    assert.equal(r.lecture, "modele", "Une réponse juste, seulement encadrée, a été traitée comme illisible.");
  });

  await cas("RÉPONSE ILLISIBLE — le défaut du patron : la dictée est lue mot à mot", async () => {
    const r = await extraire(
      DICTEE_DU_PATRON,
      fournisseurQuiRepond({ succes: true, texte: "Bien sûr ! Voici les informations que j'ai relevées." })
    );
    assert.ok(r.succes, "Le patron se retrouve encore devant « JSON invalide » et un écran mort.");
    assert.equal(r.lecture, "litterale");
    assert.ok(
      r.proposition.prestations.some((p) => /taille de haie/i.test(p.libelle)),
      `Sa taille de haie a disparu. Reçu : ${JSON.stringify(r.proposition.prestations.map((p) => p.libelle))}`
    );
    assert.equal(r.proposition.dureePrevue, "2 jours");
    assert.equal(r.proposition.tailleEquipe, "2 hommes");
  });

  await cas("réponse hors schéma : même filet", async () => {
    const r = await extraire(
      DICTEE_DU_PATRON,
      fournisseurQuiRepond({ succes: true, texte: '{"prestations": "trois choses"}' })
    );
    assert.ok(r.succes);
    assert.equal(r.lecture, "litterale");
    assert.ok(r.proposition.prestations.length > 0);
  });

  await cas("fournisseur absent, sans clé ou en panne : même filet", async () => {
    for (const panne of ["cle_api_absente", "quota_depasse", "timeout", "fournisseur_indisponible"] as const) {
      const r = await extraire(
        DICTEE_DU_PATRON,
        fournisseurQuiRepond({ succes: false, erreur: erreurIA(panne, `Panne simulée : ${panne}.`) })
      );
      assert.ok(r.succes, `Le patron reste bloqué quand le fournisseur répond « ${panne} ».`);
      assert.equal(r.lecture, "litterale");
    }
  });

  await cas("le repli dit pourquoi il a eu lieu", () => {
    // Sans motif, un support futur relit un brouillon « littéral » sans jamais
    // savoir ce qui a lâché.
    return extraire(DICTEE_DU_PATRON, fournisseurQuiRepond({ succes: true, texte: "pas du json" })).then((r) => {
      assert.ok(r.succes && r.motifRepli && r.motifRepli.length > 10, "Aucun motif de repli n'est renvoyé.");
    });
  });

  await cas("un texte vide reste refusé — on ne fabrique rien à partir de rien", async () => {
    const r = await extraire("", fournisseurQuiRepond({ succes: true, texte: JSON_VALIDE }));
    assert.equal(r.succes, false);
  });

  console.log("=== La lecture littérale ne met pas de bêtises sur le devis ===");

  await cas("« j'estime le temps de travaux à » n'est pas une prestation", () => {
    const p = lireLitteralement(DICTEE_DU_PATRON);
    const libelles = p.prestations.map((l) => l.libelle);
    assert.ok(
      !libelles.some((l) => /estime/i.test(l)),
      `Une phrase d'annonce est imprimée comme prestation sur le devis du client : ${JSON.stringify(libelles)}`
    );
  });

  await cas("… mais elle n'est pas perdue pour autant : elle passe en remarque", () => {
    const p = lireLitteralement(DICTEE_DU_PATRON);
    assert.ok(
      p.remarques && /estime/i.test(p.remarques),
      "La phrase a purement disparu — l'invariant « rien de dicté ne se perd » est rompu."
    );
  });

  await cas("ce qu'elle annonçait est bien retenu ailleurs", () => {
    const p = lireLitteralement(DICTEE_DU_PATRON);
    assert.equal(p.dureePrevue, "2 jours");
    assert.equal(p.tailleEquipe, "2 hommes");
  });

  if (echecs > 0) {
    console.error(`\n${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("Tous les contrôles de la lecture de dictée sont passés.");
}

main();
