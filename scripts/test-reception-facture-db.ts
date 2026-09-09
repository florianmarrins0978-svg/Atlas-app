import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import {
  accuserReceptionDeLaFacture,
  creerEnvoiFacture,
  factureParJeton,
  marquerReceptionVue,
  noterOuvertureDeLaFacture,
  receptionsASignaler,
  receptionsDesFactures,
} from "../src/server/repositories/envois-factures";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// « AH OUAIS MAIS J'AI PAS VU VOTRE FACTURE » — sa demande du 9 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// **POURQUOI CETTE SUITE EST UNE SUITE BASE, ET NON UNE SUITE NAVIGATEUR.**
//
// Le client ouvre et confirme SANS session : ce sont, avec la réponse au devis,
// les seules ÉCRITURES d'Atlas ouvertes par un simple jeton. Or les suites
// navigateur démarrent leur serveur sous un rôle qui traverse la RLS, parce
// qu'elles inspectent la base — elles ne peuvent donc pas, par construction,
// voir un défaut d'isolation (`CLAUDE.md` §5, et le lien de facture mort en
// production le 8 août 2026, vert au navigateur pendant ce temps).
//
// Tout ce qui suit tourne donc sous `atlas_app`, exactement comme en
// production.
//
// **CE QU'ELLE DÉFEND, ET QUI N'EST PAS UN LIBELLÉ D'ÉCRAN.** Sa question du
// même jour commandait tout : *« Atlas note l'ouverture seul, mais en cas de
// litige, où est-ce que l'utilisateur va rechercher cette info ? »*. Une preuve
// ne vaut que si elle est STABLE — d'où les deux contrôles qui comptent le
// plus : l'ouverture ne se réécrit pas, et « J'ai vu » n'efface que la carte.

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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Réception" },
    { email: `reception-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Une facture émise, prête à partir chez le client. */
async function factureEmise(ctx: Ctx, qui = "Mme Durand") {
  const client = await clientsRepo.creerClient(ctx, { nom: qui, telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: `Chez ${qui}`,
    adresseChantier: "5 rue des Lilas",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haies", "1000.00");
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  await emettreFacture(ctx, facture.id);
  return facture;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");

  await test("une facture qui vient de partir n'a AUCUNE trace — et ça se dit", async () => {
    // **Un contrôle qui mesure zéro ne mesure rien** (`CLAUDE.md` §5) : si
    // l'état de départ portait déjà une date, tous les contrôles suivants
    // seraient verts sans rien prouver.
    const facture = await factureEmise(ctx);
    await creerEnvoiFacture(ctx, facture.id, "sms");

    const par = await receptionsDesFactures(ctx, [facture.id]);
    const r = par.get(facture.id);
    assert.ok(r, "la facture envoyée n'apparaît pas du tout dans les réceptions");
    assert.equal(r.ouverteLe, null, "une facture jamais ouverte porte déjà une date d'ouverture");
    assert.equal(r.accuseLe, null, "une facture jamais confirmée porte déjà un accusé");
  });

  await test("le client ouvre son lien : la date s'écrit, sans session", async () => {
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");

    // Aucun contexte d'entreprise : c'est tout le sujet. Le jeton doit suffire.
    await noterOuvertureDeLaFacture(envoi.jeton, { adresseIp: "203.0.113.7", agentUtilisateur: "Safari" });

    const r = (await receptionsDesFactures(ctx, [facture.id])).get(facture.id);
    assert.ok(r?.ouverteLe, "l'ouverture n'est pas notée : la politique d'écriture par jeton ne s'applique pas");
  });

  await test("L'OUVERTURE NE SE RÉÉCRIT PAS — c'est la première fois qui compte", async () => {
    // Ce qu'on oppose à « je ne l'ai jamais reçue », c'est la PREMIÈRE
    // ouverture. Sans ce garde, chaque rechargement de la page repousserait la
    // date, et un client pourrait la faire glisser jusqu'à aujourd'hui.
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");
    const vide = { adresseIp: null, agentUtilisateur: null };

    const tot = new Date(Date.now() + 1000);
    const tard = new Date(Date.now() + 3_600_000);
    await noterOuvertureDeLaFacture(envoi.jeton, vide, tot);
    await noterOuvertureDeLaFacture(envoi.jeton, vide, tard);

    const r = (await receptionsDesFactures(ctx, [facture.id])).get(facture.id);
    assert.ok(r?.ouverteLe);
    assert.equal(
      r.ouverteLe.getTime(),
      tot.getTime(),
      "un second passage a repoussé la date d'ouverture — la preuve glisse"
    );
  });

  await test("le client coche : l'accusé s'écrit, et pose l'ouverture au passage", async () => {
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");

    const r = await accuserReceptionDeLaFacture(envoi.jeton, {
      adresseIp: "203.0.113.9",
      agentUtilisateur: "Chrome",
    });
    assert.ok(r.ok, `la confirmation est refusée : ${r.ok ? "" : r.raison}`);

    const trace = (await receptionsDesFactures(ctx, [facture.id])).get(facture.id);
    assert.ok(trace?.accuseLe, "l'accusé n'est pas enregistré");
    // Cocher, c'est avoir ouvert : sans cela, une facture confirmée
    // s'afficherait « pas encore ouverte », et deux lignes qui se contredisent
    // font douter des deux.
    assert.ok(trace.ouverteLe, "une facture confirmée reste marquée « pas encore ouverte »");
  });

  await test("l'accusé NE SE RÉÉCRIT PAS, et la première date est rendue", async () => {
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");
    const vide = { adresseIp: null, agentUtilisateur: null };

    const tot = new Date(Date.now() + 1000);
    const premier = await accuserReceptionDeLaFacture(envoi.jeton, vide, tot);
    const second = await accuserReceptionDeLaFacture(envoi.jeton, vide, new Date(Date.now() + 7_200_000));

    assert.ok(premier.ok && second.ok);
    assert.equal(
      second.accuseLe.getTime(),
      premier.accuseLe.getTime(),
      "un second appui a rendu une autre date que celle qui est en base"
    );
  });

  await test("le client retrouve sa confirmation en rouvrant son lien", async () => {
    // Sans cela, l'écran lui proposerait de confirmer une seconde fois ce que
    // la base tient déjà pour fait, et il croirait son premier appui perdu.
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");
    await accuserReceptionDeLaFacture(envoi.jeton, { adresseIp: null, agentUtilisateur: null });

    const vue = await factureParJeton(envoi.jeton);
    assert.ok(vue?.accuseLe, "la page ne dit pas au client qu'il a déjà confirmé");
  });

  await test("un lien expiré ne se coche pas, et ne s'ouvre pas", async () => {
    const facture = await factureEmise(ctx);
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");
    const bienPlusTard = new Date(envoi.expireAt.getTime() + 1000);

    const r = await accuserReceptionDeLaFacture(envoi.jeton, { adresseIp: null, agentUtilisateur: null }, bienPlusTard);
    assert.equal(r.ok, false, "un lien périmé accepte encore une confirmation");

    await noterOuvertureDeLaFacture(envoi.jeton, { adresseIp: null, agentUtilisateur: null }, bienPlusTard);
    const trace = (await receptionsDesFactures(ctx, [facture.id])).get(facture.id);
    assert.equal(trace?.ouverteLe, null, "un lien périmé a quand même noté une ouverture");
  });

  await test("un jeton inconnu n'écrit rien, et ne dit pas pourquoi", async () => {
    const r = await accuserReceptionDeLaFacture("jeton-qui-n-existe-pas", {
      adresseIp: null,
      agentUtilisateur: null,
    });
    assert.equal(r.ok, false);
    // Le même message que pour un lien périmé : distinguer les deux
    // apprendrait à un visiteur au hasard qu'un jeton a existé.
    assert.match(r.ok ? "" : r.raison, /n'est plus valable/);
    // Et il ne doit surtout pas lever : la page du client afficherait une
    // erreur de serveur là où il n'y a qu'un mauvais lien.
    await noterOuvertureDeLaFacture("", { adresseIp: null, agentUtilisateur: null });
  });

  await test("LE JETON D'UNE ENTREPRISE N'ÉCRIT PAS CHEZ LA VOISINE", async () => {
    // Le contrôle qui rend l'écriture par jeton défendable : elle ne touche que
    // la ligne que ce jeton désigne.
    const voisine = await contexte("voisine");
    const factureA = await factureEmise(ctx, "M. Alpha");
    const factureB = await factureEmise(voisine, "Mme Beta");
    const envoiA = await creerEnvoiFacture(ctx, factureA.id, "sms");
    await creerEnvoiFacture(voisine, factureB.id, "sms");

    await accuserReceptionDeLaFacture(envoiA.jeton, { adresseIp: null, agentUtilisateur: null });

    const chezElle = (await receptionsDesFactures(voisine, [factureB.id])).get(factureB.id);
    assert.equal(chezElle?.accuseLe, null, "la confirmation d'une entreprise a marqué la facture d'une autre");

    // Et la voisine ne voit pas non plus la réception à signaler de l'autre.
    const aSignalerChezElle = await receptionsASignaler(voisine);
    assert.equal(
      aSignalerChezElle.length,
      0,
      "une entreprise voit sur son accueil la facture confirmée d'une autre"
    );
  });

  await test("la confirmation remonte sur l'accueil, avec de quoi la nommer", async () => {
    const seul = await contexte("accueil");
    const facture = await factureEmise(seul, "Mme Durand");
    const envoi = await creerEnvoiFacture(seul, facture.id, "sms");
    await accuserReceptionDeLaFacture(envoi.jeton, { adresseIp: null, agentUtilisateur: null });

    const cartes = await receptionsASignaler(seul);
    assert.equal(cartes.length, 1, "la confirmation n'arrive pas sur l'accueil");
    assert.equal(cartes[0].clientNom, "Mme Durand");
    assert.equal(cartes[0].numeroCommercial, facture.numeroCommercial);
    assert.ok(cartes[0].chantierNom.length > 0, "la carte ne sait pas de quel chantier elle parle");
  });

  await test("« J'AI VU » EFFACE LA CARTE, ET LAISSE LA TRACE", async () => {
    // **Le cœur de sa question du 9 septembre.** Une preuve qui disparaît avec
    // l'alerte qui l'annonçait ne prouve rien : il la cherchera le jour d'un
    // litige, des semaines plus tard, bien après avoir acquitté la carte.
    const seul = await contexte("jai-vu");
    const facture = await factureEmise(seul);
    const envoi = await creerEnvoiFacture(seul, facture.id, "sms");
    await accuserReceptionDeLaFacture(envoi.jeton, { adresseIp: null, agentUtilisateur: null });

    const avant = await receptionsASignaler(seul);
    assert.equal(avant.length, 1);

    await marquerReceptionVue(seul, avant[0].envoiId);

    assert.equal((await receptionsASignaler(seul)).length, 0, "la carte reste sur l'accueil après « J'ai vu »");
    const trace = (await receptionsDesFactures(seul, [facture.id])).get(facture.id);
    assert.ok(trace?.accuseLe, "« J'ai vu » a effacé la preuve, pas seulement la carte");
    assert.ok(trace.ouverteLe, "« J'ai vu » a effacé la date d'ouverture");
  });

  await test("deux envois pour une même facture : c'est le DERNIER qui parle", async () => {
    // Le premier lien expire, le client en redemande un. Mêler les deux
    // afficherait l'ouverture d'un lien mort à côté d'un lien vivant jamais
    // ouvert — une preuve pour une facture qui n'en a pas.
    const seul = await contexte("deux-envois");
    const facture = await factureEmise(seul);

    const premier = await creerEnvoiFacture(seul, facture.id, "sms", new Date(Date.now() - 86_400_000));
    await noterOuvertureDeLaFacture(premier.jeton, { adresseIp: null, agentUtilisateur: null });

    const second = await creerEnvoiFacture(seul, facture.id, "email");
    const trace = (await receptionsDesFactures(seul, [facture.id])).get(facture.id);
    assert.ok(trace, "la facture disparaît des réceptions dès qu'elle a deux envois");
    assert.equal(
      trace.ouverteLe,
      null,
      "l'ouverture du lien PÉRIMÉ est présentée comme celle du lien en cours"
    );

    // Et le lien vivant, lui, écrit bien.
    await noterOuvertureDeLaFacture(second.jeton, { adresseIp: null, agentUtilisateur: null });
    const apres = (await receptionsDesFactures(seul, [facture.id])).get(facture.id);
    assert.ok(apres?.ouverteLe, "le lien en cours n'écrit pas son ouverture");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await fermerLimiteur();
  await pool.end();
  process.exit(1);
});
