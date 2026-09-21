import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { lignesDuPapier, quantiteLisible, tauxCourt } from "../src/lib/lignes-du-papier";
import { uniteDeLaLigne } from "../src/lib/unite-de-ligne";
import {
  estAcquittee,
  libelleReglement,
  montantAcompteDuDevis,
  netAPayer,
  nomAcompte,
  phraseMontantsVerses,
  refusDuReglementRecu,
  tamponAcquittee,
  type ReglementRecu,
} from "../src/lib/acomptes-facture";
import { lignesConditionsFacture, lireConditions } from "../src/lib/conditions-documents";
import { echeancierDevis, modeDeReglement } from "../src/lib/acomptes-devis";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";

/**
 * LE PAPIER, LE MÊME POUR LE DEVIS ET LA FACTURE — sa planche du 14 septembre
 * 2026 (`appli/le-papier-devis-et-facture.html`), et son « PARFAIT ! Code
 * exactement cette planche ». Ce que cette suite fixe, c'est la RÈGLE :
 *
 *   · chaque ligne porte son net de remise et son TTC, et les colonnes
 *     tombent JUSTE sur les bases par taux — le client qui additionne retombe
 *     sur le total ;
 *   · une quantité s'écrit « 3 », jamais « 3.00 » ;
 *   · chaque montant reçu est un acompte : « Acompte 30 % », « Acompte 50 % »
 *     (le rang du devis), puis « Acompte » ; un solde posé par l'interrupteur
 *     s'écrit « Acompte » tout court ;
 *   · « Montants versés : chèque n° … du …, … € ; virement du …, … €. » ;
 *   · le tampon « Acquittée le … » dès que plus rien n'est dû ;
 *   · les deux papiers partagent la feuille : mêmes colonnes, mêmes abscisses,
 *     et la facture ajoute ce qu'elle seule porte.
 */

let echecs = 0;
async function cas(nom: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const LIGNES = [
  { libelle: "Terrassement et préparation du sol", quantite: "1.00", unite: "forfait", prixUnitaire: "380.00", montant: "380.00", tauxTva: "20.00" },
  { libelle: "Fourniture de gazon en rouleau", quantite: "120.00", unite: "m²", prixUnitaire: "6.50", montant: "780.00", tauxTva: "10.00" },
  { libelle: "Bordures acier corten", quantite: "24.00", unite: "ml", prixUnitaire: "18.00", montant: "432.00", tauxTva: "20.00" },
];

const BASE: DevisPdfData = {
  numeroCommercial: "D2026-000014",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-09-02",
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "12 chemin des Vignes, 84000 Avignon",
  entrepriseSiret: "912 345 678 00019",
  clientNom: "Grospiron",
  clientCivilite: "mme",
  clientAdresse: "8 rue des Lilas, 84000 Avignon",
  adresseChantier: "8 rue des Lilas, 84000 Avignon",
  conditionsPaiement: "Accès par le portail de gauche, cour à dégager la veille.",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "1512.40",
  totalTva: "228.38",
  totalTtc: "1740.78",
  reductionPourcent: "5.00",
  reductionMontant: "79.60",
  lignes: LIGNES,
  mainDoeuvreHt: "450.00",
  acomptes: [{ rang: 1, tauxCumule: "30" }],
  conditionsReglees: { acomptePourcent: "30", moyensPaiement: "virement, chèque", rappelerPenalites: true, conditionsGenerales: "" },
};

async function main() {
  console.log("\n=== Les lignes du papier ===\n");

  await cas("chaque ligne porte son net de remise et son TTC ; les colonnes font exactement les bases par taux", () => {
    const { lignes, parTaux } = lignesDuPapier(LIGNES, "20.00", "5");
    for (const taux of parTaux) {
      const siennes = lignes.filter((l) => l.taux === taux.taux);
      const net = siennes.reduce((acc, l) => acc.plus(l.net), new Decimal(0)).toFixed(2);
      const ttc = siennes.reduce((acc, l) => acc.plus(l.ttc), new Decimal(0)).toFixed(2);
      assert.equal(net, taux.baseHt, `la colonne Total HT du taux ${taux.taux} ne fait pas sa base`);
      assert.equal(ttc, new Decimal(taux.baseHt).plus(taux.tva).toFixed(2), `la colonne Total TTC du taux ${taux.taux} ne fait pas base + TVA`);
    }
    // Les chiffres de sa planche.
    assert.equal(lignes[0].net, "361.00");
    assert.equal(lignes[0].ttc, "433.20");
    assert.equal(lignes[1].net, "741.00");
    assert.equal(lignes[1].ttc, "815.10");
  });

  await cas("sans remise, le net est le montant, et le centime résiduel se pose sur la dernière ligne du taux", () => {
    const { lignes } = lignesDuPapier([{ montant: "10.00", tauxTva: "20.00" }, { montant: "10.01", tauxTva: "20.00" }], "20.00", null);
    assert.equal(lignes[0].net, "10.00");
    assert.equal(lignes[1].net, "10.01");
    const somme = lignes.reduce((acc, l) => acc.plus(l.ttc), new Decimal(0)).toFixed(2);
    assert.equal(somme, "24.01", "24,01 de TTC attendus (20,01 + 4,00)");
  });

  await cas("« 3 », jamais « 3.00 » ; « 1,5 » reste « 1,5 » ; le taux s'écrit court", () => {
    assert.equal(quantiteLisible("3.00"), "3");
    assert.equal(quantiteLisible("1.50"), "1,5");
    assert.equal(quantiteLisible("120.00"), "120");
    assert.equal(tauxCourt("20.00"), "20");
    assert.equal(tauxCourt("5.50"), "5,5");
  });

  console.log("\n=== Les acomptes reçus sur la facture ===\n");

  const DEVIS_ACOMPTES = [{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "50" }];
  const cheque: ReglementRecu = { date: "2026-09-02", montant: "522.23", moyen: "cheque", numero: "1806028", solde: false, libelle: null };
  const virement: ReglementRecu = { date: "2026-09-14", montant: "25.00", moyen: "virement", numero: null, solde: false, libelle: null };

  await cas("le rang dit le taux du devis : « Acompte 30 % », « Acompte 50 % », puis « Acompte »", () => {
    const trois = [cheque, virement, virement];
    assert.equal(nomAcompte(trois, 0, DEVIS_ACOMPTES), "Acompte 30 %");
    assert.equal(nomAcompte(trois, 1, DEVIS_ACOMPTES), "Acompte 50 %");
    assert.equal(nomAcompte(trois, 2, DEVIS_ACOMPTES), "Acompte");
    // Le solde posé par l'interrupteur s'écrit « Acompte », même au rang 2.
    assert.equal(nomAcompte([cheque, { ...virement, solde: true }], 1, DEVIS_ACOMPTES), "Acompte");
    // Sans acompte sur le devis : « Acompte » tout court.
    assert.equal(nomAcompte([cheque], 0, []), "Acompte");
  });

  await cas("le deuxième acompte se propose d'office : ce que le devis prévoyait à ce rang", () => {
    assert.equal(montantAcompteDuDevis(0, DEVIS_ACOMPTES, "1740.78"), "522.23");
    assert.equal(montantAcompteDuDevis(1, DEVIS_ACOMPTES, "1740.78"), "348.16");
    assert.equal(montantAcompteDuDevis(2, DEVIS_ACOMPTES, "1740.78"), null);
  });

  await cas("« Montants versés » : le moyen, le numéro du chèque, la date, le montant — sans le mot acompte", () => {
    assert.equal(libelleReglement(cheque), "chèque n° 1806028");
    assert.equal(libelleReglement(virement), "virement");
    assert.equal(libelleReglement({ moyen: "cheque", numero: null }), "chèque");
    assert.equal(
      phraseMontantsVerses([cheque, virement]),
      "Montants versés : chèque n° 1806028 du 02/09/2026, 522,23 € ; virement du 14/09/2026, 25,00 €."
    );
    assert.equal(phraseMontantsVerses([]), null);
  });

  await cas("le net à payer se déduit de la somme ; à zéro, la facture est acquittée à la date du dernier règlement", () => {
    assert.equal(netAPayer("1740.78", [cheque, virement]), "1193.55");
    assert.equal(estAcquittee("1740.78", [cheque]), false);
    assert.equal(tamponAcquittee("1740.78", [cheque]), null);
    const solde: ReglementRecu = { date: "2026-09-21", montant: "1218.55", moyen: "virement", numero: null, solde: true, libelle: null };
    assert.equal(netAPayer("1740.78", [cheque, solde]), "0.00");
    assert.equal(tamponAcquittee("1740.78", [cheque, solde]), "Acquittée le 21/09/2026");
    // Une facture sans aucun règlement n'est pas acquittée, même à zéro.
    assert.equal(estAcquittee("0.00", []), false);
  });

  await cas("un acompte reçu se refuse avec ses mots : montant nul, date absente, plus que le reste", () => {
    assert.equal(refusDuReglementRecu("1740.78", [], { date: "2026-09-02", montant: "0" }), "Le montant reçu doit être un nombre positif.");
    assert.equal(refusDuReglementRecu("1740.78", [], { date: "", montant: "10" }), "La date du règlement manque, ou n'est pas une date.");
    assert.match(refusDuReglementRecu("1740.78", [cheque], { date: "2026-09-14", montant: "2000" }) ?? "", /Il ne reste que 1 218,55/);
    // Et un acompte daté d'AVANT la facture est normal : c'est celui de la signature.
    assert.equal(refusDuReglementRecu("1740.78", [], { date: "2026-09-02", montant: "522,23" }), null);
  });

  await cas("les conditions de la facture : le mode de règlement, les montants versés, les moyens — pas les pénalités, scellées au pied", () => {
    const c = lireConditions({ acomptePourcent: "30", moyensPaiement: "virement, chèque", rappelerPenalites: true });
    const mode = modeDeReglement(echeancierDevis([{ rang: 1, tauxCumule: "30" }], "1740.78"));
    const lignes = lignesConditionsFacture(c, mode, phraseMontantsVerses([cheque]));
    assert.deepEqual(lignes, [
      "Mode de règlement : 30 % à la signature, solde à réception de la facture.",
      "Montants versés : chèque n° 1806028 du 02/09/2026, 522,23 €.",
      "Moyens de paiement acceptés : virement, chèque.",
    ]);
    // Sans devis : la phrase du réglage.
    assert.equal(lignesConditionsFacture(c, null, null)[0], "Mode de règlement : 30 % à la commande, solde à réception de la facture.");
  });

  console.log("\n=== Le papier, sur les deux pièces ===\n");

  const FACTURE: FacturePdfData = {
    ...BASE,
    numeroCommercial: "F2026-000021",
    statut: "emise",
    dateEmission: "2026-09-14",
    dateEcheance: "2026-09-14",
    numeroDevis: "D2026-000014",
    acomptesDuDevis: DEVIS_ACOMPTES,
    reglements: [cheque, virement],
    titre: "Aménagement du jardin",
  };

  await cas("le devis : les colonnes des pros, les bases par taux, le numéro à droite du titre, le titre en italique", async () => {
    const { trace } = await composerDevisPdf({ ...BASE, titre: "Aménagement du jardin" });
    const textes = trace.textes.map((t) => t.contenu);
    for (const attendu of ["DÉSIGNATION", "QTÉ", "UNITÉ", "P.U. HT", "REM. %", "TOTAL HT", "TVA %", "TOTAL TTC", "BASE HT", "TAUX", "TVA", "LIEU DES TRAVAUX", "n° D2026-000014", "Aménagement du jardin", "Reste à régler"]) {
      assert.ok(textes.includes(attendu), `« ${attendu} » manque au devis`);
    }
    // « 120 » et « m² », pas « 120.00 m² » ; « 20 » dans la colonne du taux.
    assert.ok(textes.includes("120") && textes.includes("m²"), "la quantité et l'unité ne sont pas dans leurs colonnes");
    assert.ok(!textes.some((t) => t.includes("120.00")), "une quantité s'écrit encore avec ses décimales");
    assert.ok(!textes.some((t) => t.startsWith("Sous-total")), "le tableau est encore coupé par taux");
    assert.ok(!textes.some((t) => t.startsWith("TVA (")), "la TVA porte encore ses parenthèses");
    // Les gras de la planche : Total HT, Total HT après remise, la colonne Total TTC.
    const gras = (contenu: string) => trace.textes.find((t) => t.contenu === contenu)?.gras;
    assert.equal(gras("Total HT"), true, "Total HT n'est pas en gras");
    assert.equal(gras("Total HT après remise"), true, "Total HT après remise n'est pas en gras");
    assert.equal(gras("433,20 €"), true, "le Total TTC de la ligne n'est pas en gras");
    assert.equal(gras("TOTAL TTC"), true, "l'en-tête Total TTC n'est pas en gras");
    // Un titre vide ne s'imprime pas.
    const { trace: sansTitre } = await composerDevisPdf({ ...BASE, titre: "   " });
    assert.ok(!sansTitre.textes.some((t) => t.contenu === "Aménagement du jardin"));
  });

  await cas("une ligne sans unité s'imprime « u » — sur le devis comme sur la facture", async () => {
    // **Sa demande du 15 septembre 2026 :** *« que l'u soit mise sur le devis
    // ou facture par défaut : si on ne touche à rien, elle se pose, on la
    // voit »*. Il voyait « u » en gris clair dans le champ, croyait l'unité
    // posée, et le papier sortait sans. La base garde NULL ; c'est la lecture
    // qui dit « u » (`unite-de-ligne.ts`), la même pour l'écran et le papier.
    assert.equal(uniteDeLaLigne(null), "u");
    assert.equal(uniteDeLaLigne("  "), "u");
    assert.equal(uniteDeLaLigne(" ml "), "ml");
    const sansUnite = [{ ...LIGNES[0], unite: null }, ...LIGNES.slice(1)];
    for (const [nom, trace] of [
      ["devis", (await composerDevisPdf({ ...BASE, lignes: sansUnite })).trace],
      ["facture", (await composerFacturePdf({ ...FACTURE, lignes: sansUnite })).trace],
    ] as const) {
      const textes = trace.textes.map((t) => t.contenu);
      assert.ok(textes.includes("u"), `la ligne sans unité ne s'imprime pas « u » sur le ${nom}`);
      assert.ok(textes.includes("m²") && textes.includes("ml"), `les unités posées ne sont plus sur le ${nom}`);
    }
  });

  await cas("sans remise, la colonne « Rem. % » n'existe pas — sur le devis comme sur la facture", async () => {
    // **Sa capture du 15 septembre 2026 :** une facture sans la moindre remise
    // portait « REM. % » en tête d'une colonne vide. *« Si il n'y a pas de
    // remise, la case rem % ne doit pas apparaître : elle apparaît seulement
    // lorsque l'utilisateur choisit de faire une remise. »* Une colonne vide
    // n'est pas neutre : le client y cherche ce qu'on lui aurait retiré.
    const sansRemise = { reductionPourcent: null, reductionMontant: null };
    for (const [nom, trace] of [
      ["devis", (await composerDevisPdf({ ...BASE, ...sansRemise })).trace],
      ["facture", (await composerFacturePdf({ ...FACTURE, ...sansRemise })).trace],
    ] as const) {
      const textes = trace.textes.map((t) => t.contenu);
      assert.ok(!textes.includes("REM. %"), `« REM. % » est en tête du ${nom} sans remise`);
      assert.ok(!textes.some((t) => t.startsWith("Total HT après remise")), `le ${nom} annonce une remise qu'il n'a pas`);
      // Et les colonnes sont toujours là, chacune : la place se referme, rien ne se perd.
      for (const attendu of ["QTÉ", "UNITÉ", "P.U. HT", "TOTAL HT", "TVA %", "TOTAL TTC"]) {
        assert.ok(textes.includes(attendu), `« ${attendu} » manque au ${nom} sans remise`);
      }
    }
    // Avec une remise, elle revient — c'est ce que le cas précédent tient.
    const { trace } = await composerDevisPdf(BASE);
    assert.ok(trace.textes.some((t) => t.contenu === "REM. %"), "« REM. % » manque au devis remisé");
  });

  await cas("la facture : le même papier, plus les acomptes reçus, le net à payer, les montants versés", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    const textes = trace.textes.map((t) => t.contenu);
    for (const attendu of ["FACTURE", "n° F2026-000021", "Devis", "D2026-000014", "Acompte 30 %", "Acompte 50 %", "-522,23 €", "-25,00 €", "Net à payer", "1 193,55 €", "dont main d’œuvre HT", "Aménagement du jardin"]) {
      assert.ok(textes.includes(attendu), `« ${attendu} » manque à la facture : ${textes.slice(0, 80).join(" | ")}`);
    }
    const tout = textes.join(" ");
    assert.ok(tout.includes("Montants versés : chèque n° 1806028 du 02/09/2026, 522,23"), "« Montants versés » manque");
    assert.ok(tout.includes("Mode de règlement : 30 % à la signature, 50 % à mi-parcours, solde à réception"), "le mode de règlement manque");
    assert.ok(tout.includes("Pour information, montant de la main d’œuvre TTC"), "la main d'œuvre TTC pour information manque");
    assert.ok(!textes.some((t) => t.startsWith("Montant à régler")), "la facture répète les lignes du devis");
    assert.ok(!textes.some((t) => t.includes("Bon pour accord")), "une facture ne se signe pas");
    assert.ok(!textes.some((t) => t.startsWith("ACQUITTÉE")), "un net à payer positif ne se tamponne pas");
  });

  await cas("acquittée : le tampon, et le net à zéro", async () => {
    const solde: ReglementRecu = { date: "2026-09-21", montant: "1193.55", moyen: "virement", numero: null, solde: true, libelle: null };
    const { trace } = await composerFacturePdf({ ...FACTURE, reglements: [cheque, virement, solde] });
    const textes = trace.textes.map((t) => t.contenu);
    assert.ok(textes.includes("ACQUITTÉE LE 21/09/2026"), `le tampon manque : ${textes.filter((t) => t.includes("ACQUITT")).join("|")}`);
    assert.equal(textes.filter((t) => t === "Acompte").length, 1, "le solde ne s'écrit pas « Acompte » tout court");
    const net = trace.textes.findIndex((t) => t.contenu === "Net à payer");
    assert.equal(trace.textes[net + 1]?.contenu, "0,00 €");
  });

  await cas("les deux pièces partagent la feuille : mêmes colonnes, aux mêmes abscisses", async () => {
    const d = (await composerDevisPdf(BASE)).trace;
    const f = (await composerFacturePdf(FACTURE)).trace;
    for (const repere of ["DÉSIGNATION", "QTÉ", "UNITÉ", "P.U. HT", "REM. %", "TOTAL HT", "TVA %", "TOTAL TTC", "BASE HT", "Total TTC", "CLIENT", "LIEU DES TRAVAUX"]) {
      const td = d.textes.find((t) => t.contenu === repere);
      const tf = f.textes.find((t) => t.contenu === repere);
      assert.ok(td && tf, `« ${repere} » manque à l'une des deux pièces`);
      assert.equal(Math.round(td.x), Math.round(tf.x), `« ${repere} » n'est pas à la même abscisse`);
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le papier, devis et facture — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
