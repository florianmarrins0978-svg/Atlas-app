// Reprendre les coordonnées d'un chantier, contre la base.
//
// **Sa demande du 17 août 2026, et sa correction le même jour.** D'abord :
// *« j'ai oublié de rentrer les infos du client […] que je puisse cliquer sur le
// client du dix-sept août et que ça me mette directement sur la page client »*.
// Puis, devant une planche qui inventait une fiche : ***« que ça m'amène sur la
// page que je t'ai envoyée sur la deuxième photo. RIEN DE PLUS, RIEN DE
// MOINS. »*** — l'écran de création, rouvert.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE RÈGLE PURE NE PEUT DIRE :**
//
//   · **le chantier SANS client en gagne un.** C'est le cas exact de sa
//     capture — « Chantier du lundi 17 août » est le nom fabriqué faute de
//     client ET d'adresse. Sans ce chemin, l'écran s'ouvrirait sur du vide et
//     n'enregistrerait rien ;
//   · **le chantier AVEC client garde le sien.** Recréer laisserait un client
//     orphelin derrière, et les devis déjà partis pointent sur le premier ;
//   · **le nom du chantier SUIT.** C'est tout l'intérêt du geste : sans
//     recalcul, la ligne afficherait « Chantier du lundi 17 août » pour
//     toujours — le défaut corrigé partout sauf là où il l'a vu ;
//   · **et il ne se renomme pas avec la date d'AUJOURD'HUI.** Un chantier
//     ouvert le 17 et repris le 20 doit rester celui du 17 ;
//   · **rien ne déborde d'une entreprise sur l'autre.** Tout passe par
//     `withEntreprise` : reprendre le chantier du voisin ne doit rien toucher.
//
// Jouée sous `atlas_app`, comme la production — c'est ce qui rend le contrôle
// d'isolation crédible.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import {
  creerChantier,
  getChantierPourCoordonnees,
  reprendreChantier,
} from "../src/server/repositories/chantiers";
import { creerClient, getClient } from "../src/server/repositories/clients";
import { nomDuChantier, lieuDuChantier, lieuEstManquant } from "../src/lib/nom-chantier";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function monter() {
  await nettoyerBase();
  const a = await creerEntreprise({ nom: "Chez A" }, { email: "a@essai.local", nom: "Anne" });
  const b = await creerEntreprise({ nom: "Chez B" }, { email: "b@essai.local", nom: "Bruno" });
  return {
    ctxA: { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id },
    ctxB: { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id },
  };
}

/**
 * Le chantier de sa capture : ni client, ni adresse.
 *
 * Son nom est fabriqué par la MÊME règle que l'application (`nomDuChantier`) —
 * l'écrire à la main ici éprouverait une forme de donnée que le produit ne
 * fabrique pas.
 */
async function chantierNu(ctx: Ctx, jour: string) {
  return creerChantier(ctx, { nom: nomDuChantier({ jour }) });
}

async function main() {
  console.log("=== Reprendre les coordonnées d'un chantier ===\n");
  const { ctxA, ctxB } = await monter();

  await essai("le chantier de sa capture n'a ni client ni adresse, et le dit", async () => {
    const c = await chantierNu(ctxA, "2026-08-17");
    assert.equal(c.nom, "Chantier du lundi 17 août");
    const lu = await getChantierPourCoordonnees(ctxA, c.id);
    assert.ok(lu);
    assert.equal(lu.clientId, null);
    assert.equal(lu.adresseChantier, null);
    // C'est cette phrase-là qui devient la cible sur l'accueil.
    assert.equal(lieuEstManquant(lieuDuChantier(lu.nom, lu.adresseChantier, lu.clientNom)), true);
  });

  await essai("il gagne un client, et son NOM suit", async () => {
    const c = await chantierNu(ctxA, "2026-08-17");
    const client = await creerClient(ctxA, { nom: "Martins", civilite: "mr", telephone: "0679984514" });
    const repris = await reprendreChantier(ctxA, c.id, {
      nom: nomDuChantier({ nomClient: "Martins", civilite: "mr", jour: "2026-08-17" }),
      adresseChantier: "10 rue des Lilas, Nantes",
      clientId: client.id,
    });
    assert.ok(repris);
    // **Sans ce recalcul, la ligne resterait « Chantier du lundi 17 août ».**
    assert.equal(repris.nom, "Mr. Martins");
    assert.equal(repris.adresseChantier, "10 rue des Lilas, Nantes");
    assert.equal(repris.clientId, client.id);

    // Et la mention cesse d'être une cible : il n'y a plus rien à compléter.
    const lu = await getChantierPourCoordonnees(ctxA, c.id);
    assert.equal(lieuEstManquant(lieuDuChantier(lu!.nom, lu!.adresseChantier, lu!.clientNom)), false);
  });

  await essai("repris SANS toucher au client, celui-ci ne se détache pas", async () => {
    // `clientId` absent veut dire « n'y touche pas », jamais « efface ». Les
    // confondre ferait perdre un client au premier enregistrement où le nom
    // n'aurait pas changé.
    const client = await creerClient(ctxA, { nom: "Roux", civilite: "mme" });
    const c = await creerChantier(ctxA, { nom: "Mme. Roux", clientId: client.id });
    const repris = await reprendreChantier(ctxA, c.id, {
      nom: "Mme. Roux",
      adresseChantier: "3 chemin du Bois",
    });
    assert.equal(repris!.clientId, client.id);
  });

  await essai("une adresse effacée redevient vide, elle ne garde pas l'ancienne", async () => {
    const c = await creerChantier(ctxA, { nom: "Terrasse", adresseChantier: "12 rue des Lilas" });
    const repris = await reprendreChantier(ctxA, c.id, { nom: "Terrasse", adresseChantier: "   " });
    assert.equal(repris!.adresseChantier, null);
  });

  await essai("la reprise lit le client avec TOUTES ses coordonnées", async () => {
    // L'écran les repose dans ses champs : s'il en manque une, elle paraîtrait
    // vide au patron, et il la retaperait — ou l'effacerait sans le vouloir.
    const client = await creerClient(ctxA, {
      nom: "Ehouzan",
      civilite: "mr",
      telephone: "0612345678",
      email: "ehouzan@exemple.fr",
      adresse: "40 rue Aristide Briand",
      canalCommunication: "sms",
    });
    const c = await creerChantier(ctxA, { nom: "Mr. Ehouzan", clientId: client.id });
    const lu = await getChantierPourCoordonnees(ctxA, c.id);
    assert.equal(lu!.clientNom, "Ehouzan");
    assert.equal(lu!.clientCivilite, "mr");
    assert.equal(lu!.clientTelephone, "0612345678");
    assert.equal(lu!.clientEmail, "ehouzan@exemple.fr");
    assert.equal(lu!.clientAdresse, "40 rue Aristide Briand");
    assert.equal(lu!.clientCanal, "sms");
  });

  await essai("le chantier du voisin ne se lit pas", async () => {
    const c = await chantierNu(ctxB, "2026-08-17");
    assert.equal(await getChantierPourCoordonnees(ctxA, c.id), null);
  });

  await essai("et il ne se reprend pas — la reprise ne touche rien", async () => {
    const c = await creerChantier(ctxB, { nom: "Chez Bruno", adresseChantier: "1 rue de B" });
    const tentative = await reprendreChantier(ctxA, c.id, {
      nom: "Détourné",
      adresseChantier: "ailleurs",
    });
    assert.equal(tentative, null);
    // **Et la ligne du voisin est INTACTE**, pas seulement le retour à null :
    // une écriture qui passerait en rendant `null` serait le pire des deux.
    const chezLui = await getChantierPourCoordonnees(ctxB, c.id);
    assert.equal(chezLui!.nom, "Chez Bruno");
    assert.equal(chezLui!.adresseChantier, "1 rue de B");
  });

  await essai("un identifiant qui n'est pas un UUID ne fait aucune requête", async () => {
    assert.equal(await getChantierPourCoordonnees(ctxA, "pas-un-uuid"), null);
    assert.equal(await reprendreChantier(ctxA, "pas-un-uuid", { nom: "X" }), null);
  });

  await essai("le client repris garde son identité — il n'en naît pas un second", async () => {
    const client = await creerClient(ctxA, { nom: "Félicie", civilite: "mme" });
    const c = await creerChantier(ctxA, { nom: "Mme. Félicie", clientId: client.id });
    await reprendreChantier(ctxA, c.id, { nom: "Mme. Félicie", adresseChantier: "2 route de Vertou" });
    const lu = await getChantierPourCoordonnees(ctxA, c.id);
    assert.equal(lu!.clientId, client.id);
    assert.ok(await getClient(ctxA, client.id));
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Reprendre un chantier — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
