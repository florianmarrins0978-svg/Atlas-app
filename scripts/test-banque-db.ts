import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { facturesAvecPaiements, facturesEnAttente } from "../src/server/repositories/paiements-facture";
import {
  ajouterVirements,
  confirmerVirement,
  defaireReponse,
  ecarterVirement,
  enregistrerLiaison,
  liaisonDeLEntreprise,
  supprimerLiaison,
  virementsDepuis,
} from "../src/server/repositories/banque";
import { questionsEnAttente } from "../src/server/banque/questions";
import { jourIso } from "../src/lib/jour";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// MA BANQUE, LA SUITE — ses choix du 23 octobre 2026 (migration 0140)
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`**, comme en production : un défaut
// d'isolation ne se voit pas au navigateur, dont le serveur traverse la RLS
// (`CLAUDE.md` §5).
//
// **Ce qu'elle défend, et aucun libellé d'écran n'y figure** :
//   · un « oui » note le paiement ET la réponse, ensemble ou pas du tout ;
//   · deux « oui » ne notent jamais deux paiements ;
//   · « Annuler » retire le paiement, et la facture revient en attente ;
//   · lire deux fois la banque ne double aucun virement ;
//   · une autre entreprise ne voit ni la banque, ni les virements, et ne peut
//     répondre à aucun.

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
    { nom: `Atelier Banque ${suffixe}` },
    { email: `banque-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function factureEmise(ctx: Ctx, qui: string, montant: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: qui, telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: `Chez ${qui}`, adresseChantier: "5 rue des Lilas", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haies", montant);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  await emettreFacture(ctx, facture.id);
  const enAttente = (await facturesEnAttente(ctx)).find((f) => f.id === facture.id);
  assert.ok(enAttente, "la facture émise n'est pas en attente : le montage ne mesure rien");
  return enAttente;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");
  const aujourdhui = jourIso(new Date());
  const facture = await factureEmise(ctx, "Mme Lala", "1000.00");

  await test("la liaison s'enregistre, et relier à nouveau remplace", async () => {
    const fin = new Date(Date.now() + 90 * 24 * 3600 * 1000);
    await enregistrerLiaison(ctx, { session: "s1", comptes: ["c1"], banque: "Crédit Mutuel", accordJusquAu: fin });
    await enregistrerLiaison(ctx, { session: "s2", comptes: ["c1", "c2"], banque: "Crédit Mutuel", accordJusquAu: fin });
    const l = await liaisonDeLEntreprise(ctx);
    assert.equal(l?.session, "s2");
    assert.deepEqual(l?.comptes, ["c1", "c2"]);
  });

  await test("une autre entreprise ne voit pas la banque reliée", async () => {
    assert.equal(await liaisonDeLEntreprise(autre), null);
  });

  await test("lire deux fois la banque ne double aucun virement", async () => {
    const lu = { cle: "c1:REF-1", date: aujourdhui, montant: facture.reste, payeur: null, libelle: `VIR ${facture.numeroCommercial}` };
    assert.equal(await ajouterVirements(ctx, [lu]), 1);
    assert.equal(await ajouterVirements(ctx, [lu]), 0);
    assert.equal((await virementsDepuis(ctx, aujourdhui)).length, 1);
  });

  await test("le virement devient une question, avec la facture désignée par son numéro", async () => {
    const [q] = await questionsEnAttente(ctx, new Date());
    assert.ok(q, "aucune question : le numéro du libellé n'a pas été lu");
    assert.equal(q.choix[0]?.factureId, facture.id);
    assert.equal(q.raison, "Le numéro de la facture est écrit sur le virement.");
  });

  await test("une autre entreprise ne voit pas les virements, et ne peut pas y répondre", async () => {
    assert.equal((await virementsDepuis(autre, aujourdhui)).length, 0);
    const [v] = await virementsDepuis(ctx, aujourdhui);
    const r = await confirmerVirement(autre, v.id, facture.id, facture.reste);
    assert.equal(r.ok, false, "une autre entreprise a confirmé un virement qui n'est pas le sien");
    assert.ok((await facturesEnAttente(ctx)).some((f) => f.id === facture.id), "la facture a été soldée par une autre entreprise");
  });

  await test("« Oui » : le paiement est noté ET la réponse, ensemble", async () => {
    const [v] = await virementsDepuis(ctx, aujourdhui);
    const r = await confirmerVirement(ctx, v.id, facture.id, facture.reste);
    assert.equal(r.ok, true, r.ok ? "" : r.raison);
    assert.ok(!(await facturesEnAttente(ctx)).some((f) => f.id === facture.id), "la facture est encore en attente après le oui");
    const [apres] = await virementsDepuis(ctx, aujourdhui);
    assert.equal(apres.etat, "confirme");
    assert.equal(apres.factureId, facture.id);
    assert.equal((await questionsEnAttente(ctx, new Date())).length, 0, "la question est restée après le oui");
  });

  await test("un second « oui » est refusé, et ne note pas un second paiement", async () => {
    const [v] = await virementsDepuis(ctx, aujourdhui);
    const r = await confirmerVirement(ctx, v.id, facture.id, facture.reste);
    assert.equal(r.ok, false);
    // Lu sous `atlas_app`, dans le contexte de l'entreprise : une requête nue
    // verrait zéro ligne sous la RLS, et le contrôle serait vert sans rien
    // mesurer (`CLAUDE.md` §5).
    const soldee = (await facturesAvecPaiements(ctx)).find((f) => f.id === facture.id);
    assert.equal(soldee?.paiements.length, 1, "deux paiements notés pour un seul virement");
  });

  await test("« Annuler » retire le paiement, et la question revient", async () => {
    const [v] = await virementsDepuis(ctx, aujourdhui);
    assert.equal((await defaireReponse(ctx, v.id)).ok, true);
    assert.ok((await facturesEnAttente(ctx)).some((f) => f.id === facture.id), "la facture n'est pas revenue en attente");
    const [apres] = await virementsDepuis(ctx, aujourdhui);
    assert.equal(apres.etat, "nouveau");
    assert.equal((await questionsEnAttente(ctx, new Date())).length, 1);
  });

  await test("« Non » : rien n'est noté, la question part, et « Annuler » la rend", async () => {
    const [v] = await virementsDepuis(ctx, aujourdhui);
    assert.equal((await ecarterVirement(ctx, v.id)).ok, true);
    assert.ok((await facturesEnAttente(ctx)).some((f) => f.id === facture.id), "un « non » a soldé la facture");
    assert.equal((await questionsEnAttente(ctx, new Date())).length, 0);
    assert.equal((await defaireReponse(ctx, v.id)).ok, true);
    assert.equal((await questionsEnAttente(ctx, new Date())).length, 1);
  });

  // **Le cas où seul le verrou protège.** Sur une facture soldée, un second oui
  // serait refusé de toute façon (plus rien n'est dû) : ce contrôle-là restait
  // vert sans le verrou, constaté en le retirant. Un ACOMPTE laisse de la
  // place : sans le verrou, deux appuis noteraient deux fois 400 €.
  await test("un acompte confirmé deux fois ne note qu'UN règlement", async () => {
    const grande = await factureEmise(ctx, "M Durand", "2000.00");
    await ajouterVirements(ctx, [
      { cle: "c1:REF-2", date: aujourdhui, montant: "400.00", payeur: null, libelle: `ACOMPTE ${grande.numeroCommercial}` },
    ]);
    const v = (await virementsDepuis(ctx, aujourdhui)).find((x) => x.libelle.startsWith("ACOMPTE"));
    assert.ok(v, "le virement d'acompte n'a pas été rangé");
    assert.equal((await confirmerVirement(ctx, v.id, grande.id, "400.00")).ok, true);
    assert.equal((await confirmerVirement(ctx, v.id, grande.id, "400.00")).ok, false, "le second oui a été accepté");
    const apres = (await facturesAvecPaiements(ctx)).find((f) => f.id === grande.id);
    assert.equal(apres?.paiements.length, 1, "deux règlements notés pour un seul virement d'acompte");
  });

  await test("une facture d'une autre entreprise ne peut pas être payée par ce virement", async () => {
    const etrangere = await factureEmise(autre, "M Martin", "1000.00");
    const v = (await virementsDepuis(ctx, aujourdhui)).find((x) => x.libelle.startsWith("VIR "));
    assert.ok(v, "le premier virement a disparu");
    const r = await confirmerVirement(ctx, v.id, etrangere.id, etrangere.reste);
    assert.equal(r.ok, false, "le virement a payé la facture d'une autre entreprise");
    const apres = (await virementsDepuis(ctx, aujourdhui)).find((x) => x.id === v.id);
    assert.equal(apres?.etat, "nouveau", "le refus a quand même marqué le virement");
  });

  await test("délier garde les virements et leurs réponses", async () => {
    await supprimerLiaison(ctx);
    assert.equal(await liaisonDeLEntreprise(ctx), null);
    assert.equal((await virementsDepuis(ctx, aujourdhui)).length, 2);
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
