import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  terminerChantier,
  emettreFacture,
  genererPdfFacturePourApercu,
  getFacturePourChantier,
  majMainDoeuvreDeFacture,
  majTitreDeFacture,
  creerFactureSansDevis,
  ajouterLigneDeFacture,
  majLigneDeFacture,
  majReductionDeFacture,
} from "../src/server/repositories/factures";
import {
  basculerAcquittee,
  majReglementRecu,
  poserReglementRecu,
  reglementsRecus,
  retirerReglementRecu,
} from "../src/server/repositories/paiements-facture";
import { nomAcompte } from "../src/lib/acomptes-facture";
import type { Ctx } from "../src/server/repositories/context";

/**
 * LE PAPIER DE LA FACTURE, PAR LE DÉPÔT — sa planche du 14 septembre 2026,
 * sous `atlas_app`, donc sous la RLS (`CLAUDE.md` §5 : un chemin éprouvé au
 * seul navigateur ne l'est pas de ce point de vue).
 *
 *   · une facture née d'un devis recopie le titre, la main d'œuvre, l'unité ;
 *   · un acompte reçu se pose sur le brouillon, MÊME daté d'avant la facture —
 *     c'est celui de la signature ; il se corrige, il se retire ;
 *   · « Facture acquittée » pose le solde et le reprend ;
 *   · le papier dit tout cela ; une facture émise ne bouge plus.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const MAINTENANT = new Date("2026-09-14T10:00:00Z");

/**
 * Les titres et en-têtes du papier sont posés lettre à lettre (l'approche) :
 * le lecteur de texte les rend séparés. On les cherche donc en tolérant les
 * blancs entre les lettres.
 */
function espace(mot: string): RegExp {
  return new RegExp([...mot].map((c) => (/[.*+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c)).join("\\s*"));
}

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Eden Nature" },
    { email: `papier-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx: Ctx = { utilisateurId, entrepriseId: entreprise.id };
  await entreprisesRepo.mettreAJourEntreprise(ctx, {
    conditions: { acomptePourcent: "30", moyensPaiement: "virement, chèque", rappelerPenalites: true },
  });

  const client = await clientsRepo.creerClient(ctx, { nom: "Grospiron", civilite: "mme", telephone: "0698765432" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Aménagement",
    adresseChantier: "8 rue des Lilas, 84000 Avignon",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Terrassement et préparation du sol", "380.00", { quantite: "1", prixUnitaire: "380.00", unite: "forfait" });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Fourniture de gazon en rouleau", "780.00", { quantite: "120", prixUnitaire: "6.50", unite: "m²", tauxTva: "10.00" });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Bordures acier corten", "432.00", { quantite: "24", prixUnitaire: "18.00", unite: "ml" });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.mettreAJourEnTeteDevis(ctx, devis.id, { mainDoeuvreHt: "450", titre: "Aménagement du jardin", reductionPourcent: "5" });
  await devisRepo.poserAcompteSuivant(ctx, devis.id); // le 2ᵉ, à 50 % d'office
  await devisRepo.envoyerDevis(ctx, devis.id);

  console.log("\n=== La facture, née du devis ===\n");

  let factureId!: string;
  await essai("elle recopie le titre, la main d'œuvre, l'unité des lignes", async () => {
    await terminerChantier(ctx, chantier.id, MAINTENANT);
    const f = await getFacturePourChantier(ctx, chantier.id);
    assert.ok(f);
    factureId = f.facture.id;
    assert.equal(f.facture.titre, "Aménagement du jardin");
    assert.equal(f.facture.mainDoeuvreHt, "450.00");
    assert.deepEqual(
      f.lignes.map((l) => l.unite),
      ["forfait", "m²", "ml"],
      "l'unité s'est perdue entre le devis et la facture"
    );
  });

  await essai("le titre et la main d'œuvre se retouchent en brouillon, bornés comme sur le devis", async () => {
    const t = await majTitreDeFacture(ctx, factureId, "  Jardin de Mme Grospiron ");
    assert.ok(t.ok && t.titre === "Jardin de Mme Grospiron");
    const vide = await majTitreDeFacture(ctx, factureId, "   ");
    assert.ok(vide.ok && vide.titre === null, "un titre vide n'est pas « aucun »");
    const mo = await majMainDoeuvreDeFacture(ctx, factureId, "4500");
    assert.ok(mo.ok && mo.mainDoeuvreHt === "1592.00", `« dont » a dépassé le tout : ${JSON.stringify(mo)}`);
    await majMainDoeuvreDeFacture(ctx, factureId, "450");
    await majTitreDeFacture(ctx, factureId, "Aménagement du jardin");
  });

  console.log("\n=== Les acomptes reçus ===\n");

  await essai("l'acompte de la signature se pose, DATÉ D'AVANT la facture — c'est normal", async () => {
    const r = await poserReglementRecu(ctx, factureId, { date: "2026-09-02", montant: "522,23", moyen: "cheque", numero: "1806028" });
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(r.reglements.length, 1);
    assert.equal(r.reglements[0].montant, "522.23");
    assert.equal(r.reglements[0].numero, "1806028");
    assert.equal(r.reglements[0].solde, false);
  });

  await essai("il se corrige — un virement n'a pas de numéro — et il se refuse au-delà du reste", async () => {
    const [g] = await reglementsRecus(ctx, factureId);
    const r = await majReglementRecu(ctx, g.id, { date: "2026-09-03", montant: "522.23", moyen: "virement", numero: "1806028" });
    assert.ok(r.ok);
    assert.equal(r.reglements[0].moyen, "virement");
    assert.equal(r.reglements[0].numero, null, "un virement a gardé un numéro de chèque");
    await majReglementRecu(ctx, g.id, { date: "2026-09-02", montant: "522.23", moyen: "cheque", numero: "1806028" });
    const trop = await poserReglementRecu(ctx, factureId, { date: "2026-09-14", montant: "5000", moyen: "virement", numero: null });
    assert.ok(!trop.ok && /Il ne reste que/.test(trop.raison), JSON.stringify(trop));
  });

  await essai("« Facture acquittée » pose le solde, et l'éteindre le reprend sans toucher aux acomptes", async () => {
    const on = await basculerAcquittee(ctx, factureId, true, "2026-09-21");
    assert.ok(on.ok);
    assert.equal(on.reglements.length, 2);
    const solde = on.reglements.find((g) => g.solde)!;
    assert.equal(solde.date, "2026-09-21");
    assert.equal(solde.montant, "1218.55", `le solde n'est pas ce qui restait : ${solde.montant}`);
    const off = await basculerAcquittee(ctx, factureId, false, "2026-09-21");
    assert.ok(off.ok);
    assert.deepEqual(off.reglements.map((g) => g.montant), ["522.23"], "éteindre a emporté l'acompte de la signature");
  });

  console.log("\n=== Le papier ===\n");

  await essai("le PDF dit l'acompte 30 %, le 50 % d'office, le net à payer, les montants versés, le titre", async () => {
    await poserReglementRecu(ctx, factureId, { date: "2026-09-14", montant: "348.16", moyen: "cheque", numero: "5236985" });
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, factureId));
    for (const attendu of ["n° ", "Aménagement du jardin", "Acompte 30 %", "Acompte 50 %", "Net à payer", "870,39", "dont main d", "forfait", "ml"]) {
      assert.ok(texte.includes(attendu), `« ${attendu} » manque au PDF : ${texte.slice(0, 600)}`);
    }
    for (const attendu of ["FACTURE (BROUILLON)", "BASE HT", "DÉSIGNATION", "UNITÉ", "TOTAL TTC", "LIEU DES TRAVAUX"]) {
      assert.ok(espace(attendu).test(texte), `« ${attendu} » manque au PDF`);
    }
    assert.ok(/Montants versés : chèque n° 1806028 du 02\/09\/2026, 522,23/.test(texte), "« Montants versés » manque");
    assert.ok(texte.includes("Mode de règlement : 30 % à la signature, 50 % à mi-parcours"), "le mode de règlement manque");
    assert.ok(!texte.includes("Sous-total"), "le tableau est encore coupé par taux");
  });

  await essai("le mot qu'il ÉCRIT remplace la proposition, à l'écran comme sur le papier", async () => {
    // Sa correction du 21 septembre 2026 : « acompte 30 % d'office c'est bien,
    // mais si c'est pas ça faut que je puisse écrire ce que c'est ». Avant la
    // migration 0098, ce libellé n'allait nulle part : la colonne n'existait
    // pas, et le nom restait déduit du rang.
    const [premier] = await reglementsRecus(ctx, factureId);
    const ecrit = await majReglementRecu(ctx, premier.id, {
      date: premier.date,
      montant: premier.montant,
      moyen: premier.moyen,
      numero: premier.numero,
      libelle: "Arrhes à la signature",
    });
    assert.ok(ecrit.ok);
    assert.equal(ecrit.reglements[0].libelle, "Arrhes à la signature");
    assert.equal(
      nomAcompte(ecrit.reglements, 0, [{ rang: 1, tauxCumule: "30" }]),
      "Arrhes à la signature",
      "la proposition a écrasé ce qu'il a écrit"
    );
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, factureId));
    assert.ok(texte.includes("Arrhes à la signature"), `le papier ne porte pas son mot : ${texte.slice(0, 600)}`);

    // Vidé, le nom déduit revient — jamais un blanc sur la pièce comptable.
    const efface = await majReglementRecu(ctx, premier.id, {
      date: premier.date,
      montant: premier.montant,
      moyen: premier.moyen,
      numero: premier.numero,
      libelle: "   ",
    });
    assert.ok(efface.ok);
    assert.equal(efface.reglements[0].libelle, null, "une case vidée a été enregistrée telle quelle");
    assert.equal(nomAcompte(efface.reglements, 0, [{ rang: 1, tauxCumule: "30" }]), "Acompte 30 %");
  });

  await essai("acquittée, le papier porte le tampon ; émise, plus rien ne se pose", async () => {
    await basculerAcquittee(ctx, factureId, true, "2026-09-21");
    const texte = texteDuPdf(await genererPdfFacturePourApercu(ctx, factureId));
    assert.ok(espace("ACQUITTÉE LE 21/09/2026").test(texte), "le tampon manque");
    await emettreFacture(ctx, factureId, MAINTENANT);
    const refus = await poserReglementRecu(ctx, factureId, { date: "2026-09-22", montant: "1", moyen: "virement", numero: null });
    assert.ok(!refus.ok, "un acompte s'est posé sur une facture émise");
    const [g] = await reglementsRecus(ctx, factureId);
    const retrait = await retirerReglementRecu(ctx, g.id);
    assert.ok(!retrait.ok, "un acompte s'est retiré d'une facture émise");
    // L'interrupteur revenu sur la page de la facture le 22 septembre 2026 ne
    // s'offre que sur un BROUILLON ; le dépôt le tient, quel que soit l'écran.
    const bascule = await basculerAcquittee(ctx, factureId, false, "2026-09-22");
    assert.ok(!bascule.ok, "une facture émise s'est désacquittée");
  });

  // ═══ LA FACTURE DIRECTE — sa panne du 22 septembre 2026 ══════════════════
  //
  // *« Je peux pas mettre de règlement reçu non plus »*, capture à l'appui :
  // « Il ne reste que 0,00 € à recevoir sur cette facture » sous un Total TTC
  // de 552,52 €. La facture née sans devis pose ses trois colonnes de totaux à
  // « 0.00 » — délibérément : elles ne font pas foi, tout se recalcule depuis
  // les lignes à chaque affichage comme à l'émission. Le garde des règlements,
  // lui, lisait la COLONNE : il voyait donc une facture à zéro euro, refusait
  // le moindre acompte, et l'interrupteur « Facture acquittée » ne posait
  // aucun solde — le doigt sur l'écran ne faisait rien.
  console.log("\n=== La facture née SANS devis ===\n");

  const chantierDirect = await chantiersRepo.creerChantier(ctx, {
    nom: "Haie du fond",
    adresseChantier: "4 le Moutier, 78200 Fontenay-Mauvoisin",
    clientId: client.id,
  });
  const directe = await creerFactureSansDevis(ctx, chantierDirect.id, MAINTENANT);

  await essai("ses lignes font le total, et un règlement s'y pose — la colonne à zéro ne commande pas", async () => {
    const l1 = await ajouterLigneDeFacture(ctx, directe.id);
    assert.ok(l1.ok);
    await majLigneDeFacture(ctx, directe.id, l1.ligne.id, { libelle: "Taille de la haie", quantite: "1", prixUnitaire: "250" });
    const l2 = await ajouterLigneDeFacture(ctx, directe.id, "10.00");
    assert.ok(l2.ok);
    await majLigneDeFacture(ctx, directe.id, l2.ligne.id, { libelle: "Évacuation", quantite: "1", prixUnitaire: "256" });

    const pose = await poserReglementRecu(ctx, directe.id, {
      date: "2026-09-22", montant: "100", moyen: "cheque", numero: "1806029",
    });
    assert.ok(pose.ok, `un règlement a été refusé sur une facture directe : ${pose.ok ? "" : pose.raison}`);
    assert.equal(pose.reglements.length, 1);
  });

  await essai("« Facture acquittée » pose le solde d'une facture directe, remise comprise", async () => {
    await majReductionDeFacture(ctx, directe.id, "5");
    const allume = await basculerAcquittee(ctx, directe.id, true, "2026-09-22");
    assert.ok(allume.ok, `l'interrupteur a été refusé : ${allume.ok ? "" : allume.raison}`);
    const solde = allume.reglements.find((g) => g.solde);
    // 506,00 HT − 5 % = 480,70 ; TVA 20 % sur 237,50 et 10 % sur 243,20 →
    // 552,52 TTC, moins les 100 € déjà reçus.
    assert.ok(solde, "aucun solde n'a été posé : le doigt sur l'interrupteur n'a rien fait");
    assert.equal(solde.montant, "452.52");
  });

  await essai("ses chiffres du 22 septembre : 1 125 HT, main d'œuvre 745, remise 8 % — le règlement passe", async () => {
    // Sa seconde capture, au chiffre près : une ligne de 250 × 4,50 = 1 125 HT,
    // « dont main d'œuvre HT 745 », remise de 8 % → 1 035, TVA 20 % → 207,
    // Total TTC 1 242,00. L'écran l'écrivait ; le garde lisait zéro.
    const chantierSien = await chantiersRepo.creerChantier(ctx, { nom: "Haie de charmille", clientId: client.id });
    const sienne = await creerFactureSansDevis(ctx, chantierSien.id, MAINTENANT);
    const l = await ajouterLigneDeFacture(ctx, sienne.id);
    assert.ok(l.ok);
    await majLigneDeFacture(ctx, sienne.id, l.ligne.id, { libelle: "Plantation", quantite: "250", prixUnitaire: "4.50" });
    // La main d'œuvre est une INFORMATION prise dans le total, pas une ligne de
    // plus : elle ne doit rien changer à ce qui reste à recevoir.
    const mo = await majMainDoeuvreDeFacture(ctx, sienne.id, "745");
    assert.ok(mo.ok && mo.mainDoeuvreHt === "745.00", JSON.stringify(mo));
    await majReductionDeFacture(ctx, sienne.id, "8");

    const pose = await poserReglementRecu(ctx, sienne.id, { date: "2026-09-22", montant: "1242", moyen: "virement", numero: null });
    assert.ok(pose.ok, `son règlement a été refusé : ${pose.ok ? "" : pose.raison}`);
    assert.equal(pose.reglements[0].montant, "1242.00");
    const trop = await poserReglementRecu(ctx, sienne.id, { date: "2026-09-22", montant: "1", moyen: "virement", numero: null });
    assert.ok(!trop.ok, "un règlement est passé au-delà du total : le garde ne compte plus rien");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le papier de la facture, en base — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
