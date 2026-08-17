// La fiche client, lue en base — et surtout, lue par la BONNE entreprise.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE NAVIGATEUR NE VERRAIT.** Les
// suites navigateur démarrent leur serveur sous un rôle qui TRAVERSE la RLS
// (`CLAUDE.md` §5) : elles ne verraient jamais un défaut d'isolation. Or cet
// écran porte le chiffre d'affaires d'un client — c'est exactement la donnée
// qu'une entreprise ne doit jamais voir chez une autre.
//
// Le reste du parcours, dans l'ordre :
//
//   1. les trois chiffres viennent des factures ÉMISES, jamais des brouillons —
//      un brouillon n'a pas été envoyé, et le compter annoncerait de l'argent
//      que le client ne sait pas encore devoir ;
//   2. ce qui reste dû suit les règlements notés, par la même règle que le
//      relevé de TVA (`resteDu`) ;
//   3. un client sans facture rend `null` et non « 0 € » — la nuance décide de
//      la façon dont le patron lit sa fiche ;
//   4. un chantier supprimé ne pèse plus dans ce qu'un client a rapporté ;
//   5. **l'isolation, dans les deux sens** : la fiche d'un client d'une autre
//      entreprise n'existe pas, et les chantiers d'à côté ne s'ajoutent pas aux
//      siens.

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
import { chargerFicheClient } from "../src/server/repositories/fiche-client";

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

async function monterEntreprise(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `fc-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier chiffré, facturé et émis — le parcours complet. */
async function chantierFacture(
  ctx: { utilisateurId: string; entrepriseId: string },
  clientId: string,
  nom: string,
  lignes: [string, string][]
) {
  const c = await creerChantier(ctx, { nom, clientId });
  for (const [libelle, montant] of lignes) await ajouterLignePrix(ctx, c.id, libelle, montant);
  const devis = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, devis.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id);
  return { chantierId: c.id, factureId: f!.facture.id };
}

async function main() {
  console.log("=== La fiche client, en base ===\n");

  await essai("les trois chiffres viennent des factures ÉMISES", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai fiche");
    const client = await creerClient(ctx, { nom: "Mme Bracquemont" });

    await chantierFacture(ctx, client.id, "Élagage", [["Élagage — 3 chênes", "450.00"]]);
    await chantierFacture(ctx, client.id, "Taille", [["Taille de haie", "300.00"]]);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.ok(fiche, "la fiche est introuvable");
    assert.equal(fiche.chantiers, 2);
    // 450 + 300 = 750 HT, TVA 20 % → 900 TTC.
    assert.equal(fiche.facture, "900.00", "le total ne correspond pas aux factures émises");
    assert.equal(fiche.du, "900.00", "rien n'est réglé : tout est encore dû");
  });

  await essai("un devis non envoyé ne compte pas comme facturé", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai brouillon");
    const client = await creerClient(ctx, { nom: "M. Ledoux" });
    const c = await creerChantier(ctx, { nom: "Devis en cours", clientId: client.id });
    await ajouterLignePrix(ctx, c.id, "Abattage", "1000.00");
    await getOuCreerDevisBrouillon(ctx, c.id);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.chantiers, 1, "le chantier compte, lui");
    assert.equal(fiche!.facture, null, "« 0 € » se lirait comme un mauvais client");
    assert.equal(fiche!.du, null);
  });

  await essai("ce qui reste dû suit les règlements notés", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai paiement");
    const client = await creerClient(ctx, { nom: "Mme Félicie" });
    const { factureId } = await chantierFacture(ctx, client.id, "Élagage", [["Élagage", "500.00"]]);

    // 500 HT → 600 TTC. Un acompte de 200 laisse 400.
    const r = await noterPaiement(ctx, factureId, { date: "2099-01-01", montant: "200.00" });
    assert.equal(r.ok, true, `le règlement a été refusé : ${JSON.stringify(r)}`);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.facture, "600.00", "ce qui a été facturé ne bouge pas quand on encaisse");
    assert.equal(fiche!.du, "400.00", "ce qui reste dû doit suivre l'acompte");
  });

  await essai("les prestations qui reviennent sont comptées en chantiers", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai prestations");
    const client = await creerClient(ctx, { nom: "M. Verrier" });
    await chantierFacture(ctx, client.id, "Passage 1", [
      ["Élagage — chêne", "450.00"],
      ["Évacuation des déchets verts", "240.00"],
    ]);
    await chantierFacture(ctx, client.id, "Passage 2", [
      ["Élagage — tilleul", "550.00"],
      ["Évacuation des déchets verts", "240.00"],
    ]);

    const fiche = await chargerFicheClient(ctx, client.id);
    const elagage = fiche!.prestations.find((p) => p.libelle === "Élagage");
    assert.ok(elagage, `« Élagage » manque : ${JSON.stringify(fiche!.prestations)}`);
    assert.equal(elagage.fois, 2, "deux chantiers, donc deux fois");
    assert.equal(elagage.prixMoyen, "500.00", "(450 + 550) ÷ 2");
  });

  await essai("un chantier supprimé ne pèse plus dans ce qu'il a rapporté", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai retrait");
    const client = await creerClient(ctx, { nom: "M. Retiré" });
    await chantierFacture(ctx, client.id, "Gardé", [["Élagage", "500.00"]]);
    const jete = await creerChantier(ctx, { nom: "Jeté", clientId: client.id });
    await supprimerChantier(ctx, jete.id);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.chantiers, 1, "le chantier supprimé compte encore");
    assert.ok(!fiche!.liste.some((c) => c.nom === "Jeté"), "le chantier supprimé s'affiche encore");
  });

  // ── L'isolation, dans les deux sens ───────────────────────────────────────

  await essai("la fiche d'un client d'une AUTRE entreprise n'existe pas", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const clientDeA = await creerClient(a, { nom: "Client de A" });
    await chantierFacture(a, clientDeA.id, "Chantier de A", [["Élagage", "500.00"]]);

    const vuParA = await chargerFicheClient(a, clientDeA.id);
    assert.ok(vuParA, "A ne voit plus son propre client");

    const vuParB = await chargerFicheClient(b, clientDeA.id);
    assert.equal(vuParB, null, "B lit le chiffre d'affaires d'un client de A");
  });

  await essai("les chantiers d'à côté ne s'ajoutent pas aux siens", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const clientDeA = await creerClient(a, { nom: "Mme Bracquemont" });
    const clientDeB = await creerClient(b, { nom: "Mme Bracquemont" }); // le même nom, exprès

    await chantierFacture(a, clientDeA.id, "Chez A", [["Élagage", "500.00"]]);
    await chantierFacture(b, clientDeB.id, "Chez B", [["Élagage", "900.00"]]);

    const fiche = await chargerFicheClient(a, clientDeA.id);
    assert.equal(fiche!.chantiers, 1, "un chantier d'une autre entreprise s'est glissé dans la fiche");
    assert.equal(fiche!.facture, "600.00", "500 HT → 600 TTC : le chantier de B ne doit rien y ajouter");
  });

  await essai("un client sans aucun chantier a quand même sa fiche", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai vide");
    const client = await creerClient(ctx, { nom: "M. Tout Neuf" });

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.ok(fiche, "une fiche vide vaut mieux qu'une page introuvable");
    assert.equal(fiche.chantiers, 0);
    assert.equal(fiche.facture, null);
    assert.deepEqual(fiche.prestations, []);
    assert.equal(fiche.client.nom, "M. Tout Neuf");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
