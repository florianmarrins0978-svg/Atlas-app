// La liste de ses clients — sa remarque du 17 août 2026 au soir.
//
// *« La catégorie client n'a pas été créée. »* La FICHE d'un client existait
// depuis la veille (arrangement B de la planche 66), mais elle ne s'atteignait
// que depuis un chantier : rien ne menait à SES clients.
//
// **Ce que cette suite tient, et qu'aucune suite navigateur ne verrait** : les
// suites navigateur servent sous un rôle qui TRAVERSE la RLS (`CLAUDE.md` §5).
// Or cette liste porte, ligne à ligne, le chiffre d'affaires de chaque client —
// c'est exactement la donnée qui ne doit jamais traverser d'une entreprise à
// l'autre.
//
// Le reste, dans l'ordre :
//
//   1. un client sans facture rend `null`, jamais « 0 € » — un zéro se lirait
//      comme un mauvais payeur (`CLAUDE.md` §4) ;
//   2. ce qui reste dû suit les règlements notés, par la même règle que le
//      relevé de TVA — deux calculs du même reste finiraient par se contredire ;
//   3. le plus récent d'abord : c'est celui qu'il cherche ;
//   4. un chantier supprimé ne pèse plus.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier, supprimerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { jourIso } from "../src/lib/jour";
import { listerFichesClients } from "../src/server/repositories/fiche-client";

let echecs = 0;
async function essai(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function monterEntreprise(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `lc-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier chiffré, facturé et émis — le parcours complet, comme le produit. */
async function chantierFacture(
  ctx: { utilisateurId: string; entrepriseId: string },
  clientId: string,
  nom: string,
  montant: string
) {
  const c = await creerChantier(ctx, { nom, clientId });
  await ajouterLignePrix(ctx, c.id, nom, montant);
  const devis = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, devis.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id);
  return { chantierId: c.id, factureId: f!.facture.id };
}

async function main() {
  console.log("=== La liste des clients ===\n");

  await essai("un client sans facture ne montre AUCUN montant, pas « 0 € »", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai liste");
    const client = await creerClient(ctx, { nom: "Mme Bracquemont" });
    await creerChantier(ctx, { nom: "Élagage à venir", clientId: client.id });

    const [vu] = await listerFichesClients(ctx);
    assert.ok(vu, "le client n'apparaît pas dans la liste");
    assert.equal(vu.chantiers, 1);
    assert.equal(vu.facture, null, "« 0 € » se lirait comme un client qui n'a rien rapporté");
    assert.equal(vu.du, null);
  });

  await essai("une facture émise et un règlement partiel donnent le reste dû", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai reste");
    const client = await creerClient(ctx, { nom: "M. Verrier" });
    const { factureId } = await chantierFacture(ctx, client.id, "Élagage", "1000.00");
    // **Le règlement est VÉRIFIÉ, pas supposé.** Première écriture, il était
    // daté de la veille de l'émission : `noterPaiement` le refusait poliment,
    // le test l'ignorait, et le cas rougissait en accusant le calcul du reste
    // dû — un contrôle qui accuse à tort coûte plus cher que pas de contrôle.
    // **Le jour se lit comme l'application le compte** (`jourIso`, à l'heure de
    // l'atelier), et non en UTC : la facture est émise avec l'un, le règlement
    // daté avec l'autre, et entre minuit et 2 h du matin les deux diffèrent
    // d'un jour. Le refus était alors juste — « daté d'avant la facture » — et
    // le rouge accusait le calcul du reste dû. Une nuit sur douze.
    const aujourdHui = jourIso(new Date());
    const regle = await noterPaiement(ctx, factureId, { date: aujourdHui, montant: "500.00" });
    assert.ok(regle.ok, `le règlement d'essai a été refusé : ${regle.ok ? "" : regle.raison}`);

    const [vu] = await listerFichesClients(ctx);
    assert.ok(vu);
    assert.equal(vu.chantiers, 1);
    assert.ok(vu.facture && Number(vu.facture) > 0, `rien n'est facturé (vu : ${vu.facture})`);
    assert.ok(
      vu.du && Number(vu.du) > 0 && Number(vu.du) < Number(vu.facture),
      `le reste dû doit être une part de ce qui est facturé (facturé ${vu.facture}, dû ${vu.du})`
    );
  });

  await essai("une entreprise ne voit JAMAIS les clients d'une autre", async () => {
    await nettoyerBase();
    const ctxA = await monterEntreprise("Maison A");
    const ctxB = await monterEntreprise("Maison B");
    const client = await creerClient(ctxA, { nom: "Mme Bracquemont" });
    await chantierFacture(ctxA, client.id, "Élagage", "1000.00");

    const chezB = await listerFichesClients(ctxB);
    assert.deepEqual(chezB, [], "B voit un client de A : c'est son chiffre d'affaires qui fuit");

    const chezA = await listerFichesClients(ctxA);
    assert.equal(chezA.length, 1, "A ne voit plus son propre client");
  });

  await essai("le plus récent d'abord — c'est celui qu'il cherche", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai ordre");
    const ancien = await creerClient(ctx, { nom: "M. Ledoux" });
    const recent = await creerClient(ctx, { nom: "Mme Félicie" });
    await chantierFacture(ctx, ancien.id, "Haie", "300.00");
    await chantierFacture(ctx, recent.id, "Élagage", "800.00");

    const liste = await listerFichesClients(ctx);
    assert.equal(liste.length, 2);
    // Les deux factures portent le même jour : l'ordre doit rester STABLE et
    // décroissant, jamais l'ordre d'insertion de la base.
    assert.ok(
      liste.every((c, i) => i === 0 || (liste[i - 1].dernierJour ?? "") >= (c.dernierJour ?? "")),
      `la liste n'est pas rangée du plus récent au plus ancien : ${liste
        .map((c) => `${c.nom} (${c.dernierJour})`)
        .join(", ")}`
    );
  });

  // ── Le lieu, sa remarque du 3 septembre 2026 ──────────────────────────────
  //
  // *« J'ai vingt et un clients, dont QUATRE qui s'appellent Martins.
  // Aujourd'hui la ligne ne montre que le nom et des comptes : rien ne me dit
  // lequel c'est. »*
  //
  // La colonne existait, la fiche l'affichait, et cette requête-ci ne la
  // chargeait pas : le seul écran où quatre noms identiques se côtoient était
  // aussi le seul à ne pas savoir les distinguer.
  await essai("l'adresse voyage jusqu'à la liste — c'est elle qui sépare quatre Martins", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai lieu");
    await creerClient(ctx, { nom: "M. Martins", adresse: "10 rue d'Enfer, Nantes" });
    await creerClient(ctx, { nom: "M. Martins", adresse: "4 allée des Chênes, Vertou" });
    // **Un client sans adresse est un état NORMAL**, pas une donnée manquante :
    // saisi à la volée, il n'a pas eu droit à un appui de plus. La liste doit le
    // rendre tel quel plutôt que d'inventer un lieu (`CLAUDE.md` §4).
    await creerClient(ctx, { nom: "Mme Sans-Lieu" });

    const liste = await listerFichesClients(ctx);
    const lieux = liste.map((c) => c.adresse).sort();
    assert.deepEqual(
      lieux,
      ["10 rue d'Enfer, Nantes", "4 allée des Chênes, Vertou", null].sort(),
      `la liste ne porte pas les adresses attendues : ${JSON.stringify(lieux)}`
    );

    const martins = liste.filter((c) => c.nom === "M. Martins");
    assert.equal(martins.length, 2);
    assert.notEqual(
      martins[0].adresse,
      martins[1].adresse,
      "deux clients du même nom rendent le même lieu : rien ne les distingue à l'écran"
    );
  });

  await essai("un chantier supprimé ne compte plus", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai retrait");
    const client = await creerClient(ctx, { nom: "M. Bernard" });
    const c = await creerChantier(ctx, { nom: "Abattage", clientId: client.id });
    await supprimerChantier(ctx, c.id);

    const [vu] = await listerFichesClients(ctx);
    assert.ok(vu, "le client disparaît alors qu'il existe toujours");
    assert.equal(vu.chantiers, 0, "un chantier retiré pèse encore dans la liste");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La liste des clients — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
