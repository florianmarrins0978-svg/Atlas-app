import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { getOuCreerDevisBrouillon, envoyerDevis, listerVersionsDevis } from "../src/server/repositories/devis";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOutil } from "../src/server/ai/tools/registre";
import { nettoyerBase } from "./_test-db";

// **Retrouver le premier devis de M. Bernard, sans avoir ouvert son chantier.**
//
// Sa capture du 25 août 2026 : l'assistant répond *« je n'ai actuellement aucun
// chantier ouvert »*, lui demande d'aller ouvrir la fiche lui-même, et ajoute
// que *« Atlas conserve uniquement le dernier devis par chantier »*. Sa
// réaction : *« c'est justement ça que je veux qu'il soit capable de faire »*.
//
// Deux défauts, et le second est le plus grave :
//
//   1. **aucun outil ne partait d'un NOM** — tous exigeaient le chantier
//      courant, nul quand on ouvre l'assistant depuis la liste ;
//   2. **la phrase sur les devis était FAUSSE.** Un brouillon se réécrit, mais
//      un devis envoyé est conservé et le suivant devient une version 2. Ses
//      anciens devis étaient là ; l'outil ne savait pas les demander, et le
//      modèle en a tiré une explication qu'il a servie au patron.
//
// Ce qui est éprouvé ici est donc la CHAÎNE ENTIÈRE : du nom au bon devis.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  console.log("=== Retrouver un chantier par son nom, et un ancien devis ===");
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Paysage Bernard" },
    { email: `chercher-${Date.now()}@atlas.test`, nom: "Patron" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };

  // Une AUTRE entreprise, avec un client au même nom : c'est le seul cas où un
  // défaut d'isolation se verrait, et il montrerait les devis d'un confrère.
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Paysage Voisin" },
    { email: `voisin-${Date.now()}@atlas.test`, nom: "Voisin" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const bernard = await clientsRepo.creerClient(A, { nom: "Mr. Bernard" });
  const chantier = await chantiersRepo.creerChantier(A, { nom: "Haie et massifs" });
  await chantiersRepo.reprendreChantier(A, chantier.id, { nom: "Haie et massifs", clientId: bernard.id });

  const bernardVoisin = await clientsRepo.creerClient(B, { nom: "Mr. Bernard" });
  const chantierVoisin = await chantiersRepo.creerChantier(B, { nom: "Chez le voisin" });
  await chantiersRepo.reprendreChantier(B, chantierVoisin.id, { nom: "Chez le voisin", clientId: bernardVoisin.id });

  // ─── Deux devis pour Bernard : le premier PARTI, puis un second ───────────
  //
  // Il faut vraiment ENVOYER le premier : c'est l'envoi qui le fige et fait du
  // suivant une version 2. Sans cela, le brouillon se réécrirait en place et ce
  // contrôle n'aurait qu'une version à regarder — vert sans rien prouver.
  await ajouterLignePrix(A, chantier.id, "Taille de haie", "400.00");
  const premier = await getOuCreerDevisBrouillon(A, chantier.id);
  await envoyerDevis(A, premier.id);
  await ajouterLignePrix(A, chantier.id, "Bêchage des massifs", "250.00");
  const second = await getOuCreerDevisBrouillon(A, chantier.id);

  await cas("LE DÉCOR : deux versions existent bel et bien", async () => {
    const versions = await listerVersionsDevis(A, chantier.id);
    assert.equal(versions.length, 2, `le décor n'a pas deux devis : ${JSON.stringify(versions)}`);
    assert.equal(versions[0].numeroVersion, 1, "la première n'est pas en tête : « le premier » serait faux");
    assert.equal(premier.numeroVersion, 1);
    assert.equal(second.numeroVersion, 2);
  });

  const chercher = getOutil("RechercherChantier")!;
  const lire = getOutil("LireDevis")!;

  await cas("SA QUESTION, SANS CHANTIER OUVERT : « Bernard » mène à son chantier", async () => {
    // `chantierId: null` — c'est exactement l'assistant ouvert depuis la liste.
    const r = (await chercher.executer({ ctx: A, chantierId: null }, { nom: "Bernard" })) as {
      trouves: { chantierId: string; clientNom: string | null }[];
    };
    assert.equal(r.trouves.length, 1, `un seul chantier attendu : ${JSON.stringify(r.trouves)}`);
    assert.equal(r.trouves[0].chantierId, chantier.id);
    assert.equal(r.trouves[0].clientNom, "Mr. Bernard");
  });

  await cas("la casse et les accents ne décident rien — c'est la règle de l'écran", async () => {
    for (const saisie of ["bernard", "BERNARD", "mr bernard", "bernard mr"]) {
      const r = (await chercher.executer({ ctx: A, chantierId: null }, { nom: saisie })) as {
        trouves: { chantierId: string }[];
      };
      assert.equal(r.trouves.length, 1, `« ${saisie} » ne trouve rien`);
      assert.equal(r.trouves[0].chantierId, chantier.id, `« ${saisie} » trouve le mauvais chantier`);
    }
  });

  await cas("le nom du CHANTIER marche aussi — il dit « la haie » aussi souvent qu'un nom", async () => {
    const r = (await chercher.executer({ ctx: A, chantierId: null }, { nom: "haie" })) as {
      trouves: { chantierId: string }[];
    };
    assert.equal(r.trouves.length, 1);
    assert.equal(r.trouves[0].chantierId, chantier.id);
  });

  await cas("ISOLATION : le Bernard du voisin ne sort jamais", async () => {
    const r = (await chercher.executer({ ctx: A, chantierId: null }, { nom: "Bernard" })) as {
      trouves: { chantierId: string }[];
    };
    assert.ok(
      !r.trouves.some((t) => t.chantierId === chantierVoisin.id),
      "le chantier d'une AUTRE entreprise est rendu : ses devis suivraient"
    );
    // Et l'inverse, sans quoi ce cas serait vert avec une recherche qui ne rend
    // jamais rien.
    const cotéVoisin = (await chercher.executer({ ctx: B, chantierId: null }, { nom: "Bernard" })) as {
      trouves: { chantierId: string }[];
    };
    assert.equal(cotéVoisin.trouves.length, 1);
    assert.equal(cotéVoisin.trouves[0].chantierId, chantierVoisin.id);
  });

  await cas("un nom inconnu se DIT, il ne lève pas", async () => {
    const r = (await chercher.executer({ ctx: A, chantierId: null }, { nom: "Duchemin" })) as {
      trouves: unknown[];
      phrase: string;
    };
    assert.equal(r.trouves.length, 0);
    assert.match(r.phrase, /Duchemin/, "la phrase ne cite pas ce qui a été cherché");
  });

  await cas("« LE PREMIER DEVIS » : la version 1, et pas la dernière", async () => {
    const r = (await lire.executer({ ctx: A, chantierId: null }, {
      chantierId: chantier.id,
      version: 1,
    })) as { existe: boolean; numeroVersion: number; lignes: { libelle: string }[] };
    assert.equal(r.existe, true);
    assert.equal(r.numeroVersion, 1, "c'est la dernière version qui est rendue, pas la première");
    assert.deepEqual(
      r.lignes.map((l) => l.libelle),
      ["Taille de haie"],
      "le premier devis porte les lignes du second : les versions se mélangent"
    );
  });

  await cas("CE QUI A FAIT MENTIR L'ASSISTANT : les versions sont TOUJOURS annoncées", async () => {
    // Sans cette liste, le modèle ne peut pas savoir qu'il en existe d'autres —
    // et il conclut, comme le 25 août, qu'Atlas ne garde que la dernière.
    const r = (await lire.executer({ ctx: A, chantierId: chantier.id }, {})) as {
      numeroVersion: number;
      versionsDisponibles: { numeroVersion: number }[];
    };
    assert.equal(r.numeroVersion, 2, "sans version demandée, la plus récente doit venir");
    assert.deepEqual(
      r.versionsDisponibles.map((v) => v.numeroVersion),
      [1, 2],
      "les versions ne sont pas annoncées : l'assistant croira qu'il n'y en a qu'une"
    );
  });

  await cas("sans chantier, LireDevis dit LA SUITE À DONNER, pas seulement le manque", async () => {
    const r = (await lire.executer({ ctx: A, chantierId: null }, {})) as { erreur: string };
    assert.match(r.erreur, /RechercherChantier/, "il n'oriente pas vers l'outil qui débloque");
    assert.doesNotMatch(
      r.erreur,
      /ouvrez le chantier|ouvrir le chantier/i,
      "il renvoie encore le patron ouvrir une fiche à la main — le reproche du 25 août"
    );
  });

  await cas("une version qui n'existe pas se refuse, en disant lesquelles existent", async () => {
    const r = (await lire.executer({ ctx: A, chantierId: chantier.id }, { version: 7 })) as {
      existe: boolean;
      versionsDisponibles: { numeroVersion: number }[];
      erreur: string;
    };
    assert.equal(r.existe, false);
    assert.match(r.erreur, /version 7/);
    assert.deepEqual(r.versionsDisponibles.map((v) => v.numeroVersion), [1, 2]);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Chercher par nom, et lire un ancien devis — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
