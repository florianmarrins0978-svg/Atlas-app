import assert from "node:assert/strict";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { composerDevisPdf } from "../src/server/pdf/devis-pdf";
import { couleursDocument } from "../src/lib/design-tokens";
import { PIED_DOCUMENT, type TraceDocument } from "../src/server/pdf/document-commun";

// La facture est la seconde pièce que le client reçoit — et la seule qu'il
// paie. Elle partage sa feuille avec le devis (`document-commun.ts`), ce que
// cette suite vérifie aussi : deux mises en page qui divergent, c'est le patron
// qui l'apprend par son client.
//
// Ce qui distingue une facture d'un devis n'est pas cosmétique :
// une date d'échéance qui fait courir les pénalités, une mention légale
// obligatoire, et **aucun cadre de signature** — une facture se règle.

const FACTURE: FacturePdfData = {
  numeroCommercial: "F-2026-0004",
  statut: "emise",
  dateEmission: "2026-08-03",
  dateEcheance: "2026-09-02",
  numeroDevis: "2026-0006",
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: "FR76 3123 3123 4500 2348 1091 175",
  clientNom: "M. Bernard",
  clientAdresse: "10 rue des Moutons, 78200 Buchelay",
  clientTelephone: "06 12 34 56 78",
  adresseChantier: "10 rue des Moutons, 78200 Buchelay",
  conditionsPaiement: "Merci de votre confiance.",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [
    {
      libelle: "Démontage d'un chêne en bordure de rue, avec rétention des charpentières",
      quantite: "1",
      prixUnitaire: "1400.00",
      montant: "1400.00",
    },
    { libelle: "Taille de haie de laurier", quantite: "18", prixUnitaire: "35.00", montant: "630.00" },
    { libelle: "Broyage sur place", quantite: "1", prixUnitaire: "420.00", montant: "420.00" },
  ],
};

const contenus = (trace: TraceDocument) => trace.textes.map((t) => t.contenu);
/**
 * Le même texte, ses espaces insécables ramenées à des espaces ordinaires.
 *
 * `formatMontant` groupe les milliers avec U+202F : « 2 450,00 € » ne contient
 * pas l'espace qu'on tape. Comparé tel quel, un document JUSTE fait rougir le
 * contrôle — c'est arrivé, et c'est une demi-heure perdue à soupçonner le PDF.
 */
const plat = (t: string) => t.replace(/[\u00a0\u202f\u2009\u2007]/g, " ");

let echecs = 0;
function cas(nom: string, verifier: () => void | Promise<void>) {
  return Promise.resolve()
    .then(verifier)
    .then(
      () => console.log(`  ✓ ${nom}`),
      (e: Error) => {
        echecs++;
        console.error(`  ✗ ${nom}\n    ${e.message}`);
      }
    );
}

async function main() {
  console.log("=== La facture, sur le modèle du patron ===");

  await cas("elle porte ses références : numéro, émission, échéance", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    const textes = contenus(trace);
    for (const attendu of ["FACTURE", "Facture n°", "Date d'émission", "Date d'échéance"]) {
      assert.ok(textes.includes(attendu), `« ${attendu} » manque à la facture.`);
    }
    assert.ok(textes.includes("F-2026-0004"), "Le numéro de facture n'est pas imprimé.");
    // Jour/mois/année, comme sur le devis : « la date est à l'envers ! C'est
    // jour/mois/année » (le patron, sur capture, le 2026-08-04). La facture est
    // la pièce la plus lue des deux — une date à l'envers y fait douter du reste.
    assert.ok(textes.includes("02/09/2026"), `L'échéance n'est pas au format français : ${JSON.stringify(textes.slice(0, 12))}`);
    assert.ok(textes.includes("03/08/2026"), "La date d'émission n'est pas au format français.");
    assert.ok(!textes.includes("2026-09-02"), "La date brute de la base est imprimée telle quelle sur la facture.");
  });

  await cas("une échéance absente laisse sa ligne vide, sans en inventer une", async () => {
    const { trace } = await composerFacturePdf({ ...FACTURE, dateEcheance: null });
    const textes = contenus(trace);
    assert.ok(
      !textes.includes("Date d'échéance"),
      "Une échéance inconnue ne doit pas ouvrir sa ligne — c'est elle qui fait courir les pénalités."
    );
    // Le reste de la pièce tient debout sans elle.
    assert.ok(textes.includes("FACTURE"), "La facture a disparu avec son échéance.");
  });

  await cas("elle rappelle le devis dont elle naît", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    assert.ok(
      contenus(trace).some((t) => t.includes("devis n° 2026-0006")),
      "Sans ce rappel, le client doit rapprocher deux pièces lui-même."
    );
    const { trace: sansDevis } = await composerFacturePdf({ ...FACTURE, numeroDevis: null });
    assert.ok(
      !contenus(sansDevis).some((t) => t.startsWith("Établie à partir")),
      "Un numéro de devis inconnu ne doit pas produire une phrase creuse."
    );
  });

  await cas("elle porte les mentions légales de retard de paiement", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    const pied = contenus(trace).join(" ");
    // Obligatoires, et attendues d'un particulier comme d'un professionnel.
    assert.match(pied, /pénalité/, "La pénalité de retard n'est pas mentionnée.");
    assert.match(pied, /trois fois le taux d'intérêt légal/, "Le taux de pénalité n'est pas dit.");
    assert.match(pied, /indemnité forfaitaire/, "L'indemnité de recouvrement n'est pas mentionnée.");
    assert.match(pied, /40 €/, "Le montant de l'indemnité n'est pas dit.");
    assert.match(pied, /Pas d'escompte/, "L'absence d'escompte n'est pas mentionnée.");
  });

  await cas("la franchise de TVA ne s'imprime que si la TVA est nulle", async () => {
    // Une facture qui affiche « TVA (10 %) » ET « TVA non applicable » se
    // contredit sous les yeux du client, et devient fausse.
    const { trace: avecTva } = await composerFacturePdf(FACTURE);
    assert.ok(
      !contenus(avecTva).some((t) => t.includes("293 B")),
      "La franchise est annoncée alors qu'une TVA de 10 % est facturée."
    );
    const { trace: sansTva } = await composerFacturePdf({
      ...FACTURE,
      tauxTva: "0.00",
      totalTva: "0.00",
      totalTtc: "2450.00",
    });
    assert.ok(
      contenus(sansTva).some((t) => t.includes("293 B")),
      "Une facture sans TVA doit dire sur quel fondement."
    );
  });

  await cas("elle ne porte aucun cadre de signature", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    assert.deepEqual(trace.cadres, [], "Une facture ne se signe pas, elle se règle.");
    assert.ok(
      !contenus(trace).some((t) => t.includes("Bon pour accord")),
      "« Bon pour accord » invite le client à croire qu'il lui reste à accepter."
    );
  });

  await cas("un brouillon le dit sur le papier", async () => {
    const { trace } = await composerFacturePdf({ ...FACTURE, statut: "brouillon" });
    assert.ok(
      contenus(trace).includes("FACTURE (BROUILLON)"),
      "Une facture non émise qui ne se signale pas peut partir par erreur."
    );
  });

  await cas("elle porte la terre cuite des documents, comme le devis", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    // **Un seul intertitre de partie depuis le 18 août 2026** : l'émetteur
    // figurait deux fois — en-tête et bloc du bas — et le bloc a disparu.
    for (const intertitre of ["CLIENT"]) {
      const pose = trace.textes.find((t) => t.contenu === intertitre);
      assert.ok(pose, `« ${intertitre} » manque à la facture.`);
      assert.equal(
        pose.couleur.toLowerCase(),
        couleursDocument.accent.toLowerCase(),
        `« ${intertitre} » n'est pas dans la teinte des documents.`
      );
    }
  });

  await cas("elle partage sa mise en page avec le devis", async () => {
    // Le modèle du patron donne aux deux pièces la même feuille. Si l'une
    // dérive, c'est son client qui le lui apprend.
    const { trace: f } = await composerFacturePdf(FACTURE);
    const { trace: d } = await composerDevisPdf({
      ...FACTURE,
      numeroVersion: 1,
      statut: "envoye",
    });
    const reperes = ["CLIENT", "DESCRIPTION", "QTÉ", "PRIX UNITAIRE HT", "Total TTC"];
    for (const repere of reperes) {
      const pf = f.textes.find((t) => t.contenu === repere);
      const pd = d.textes.find((t) => t.contenu === repere);
      assert.ok(pf && pd, `« ${repere} » manque à l'une des deux pièces.`);
      assert.equal(
        Math.round(pf.x),
        Math.round(pd.x),
        `« ${repere} » n'est pas à la même abscisse sur la facture et sur le devis.`
      );
    }
  });

  await cas("une facture longue ne recouvre pas sa mention légale", async () => {
    const lignes = Array.from({ length: 25 }, (_, i) => ({
      libelle: `Prestation ${i + 1} — abattage par démontage avec rétention et broyage sur place`,
      quantite: "1",
      prixUnitaire: "180.00",
      montant: "180.00",
    }));
    const { trace } = await composerFacturePdf({ ...FACTURE, lignes });
    assert.ok(trace.pages > 1, "Vingt-cinq lignes devraient déborder.");
    for (const t of trace.textes) {
      const estDuPied = t.taille <= 7.8 && t.y <= PIED_DOCUMENT.plancher;
      if (estDuPied) continue;
      assert.ok(
        t.y >= PIED_DOCUMENT.plancher,
        `« ${t.contenu} » (page ${t.page}) descend sous le plancher réservé au pied.`
      );
    }
  });

  // ── Les travaux en plus, et leurs taux (migration 0073) ──────────────────

  /** Sa facture du 31 août, plus une terrasse à 20 % sur un devis à 10 %. */
  const AVEC_SUPPLEMENT: FacturePdfData = {
    ...FACTURE,
    tauxTva: "20.00",
    totalHt: "2950.00",
    totalTva: "345.00",
    totalTtc: "3295.00",
    ventilationTva: [
      { tauxTva: "20.00", ht: "500.00", tva: "100.00" },
      { tauxTva: "10.00", ht: "2450.00", tva: "245.00" },
    ],
    lignes: [
      ...FACTURE.lignes,
      {
        libelle: "Terrasse bois",
        quantite: "1",
        prixUnitaire: "500.00",
        montant: "500.00",
        intertitre: "Travaux supplémentaires",
      },
    ],
  };

  await cas("le supplément s'imprime SOUS son propre titre, pas fondu dans le devis", async () => {
    const { trace } = await composerFacturePdf(AVEC_SUPPLEMENT);
    const textes = contenus(trace);
    // Le titre est écrit lettre par lettre espacée (`ecrireEspace`) : on le
    // cherche donc sans se fier à la casse ni aux espaces d'approche.
    const compact = textes.map((t) => t.replace(/\s+/g, "").toUpperCase());
    assert.ok(
      compact.some((t) => t.includes("TRAVAUXSUPPLÉMENTAIRES")),
      `Le titre du bloc manque. Écrits : ${textes.slice(0, 40).join(" | ")}`
    );
    assert.ok(textes.some((t) => t.includes("Terrasse bois")), "La ligne ajoutée manque.");
  });

  await cas("DEUX taux : une ligne de TVA chacun, avec le socle sur lequel elle porte", async () => {
    // **Article 268 bis du CGI** : sans ventilation, toute la facture serait
    // taxée au taux le plus élevé. Ces deux lignes sont ce qui l'évite.
    const { trace } = await composerFacturePdf(AVEC_SUPPLEMENT);
    const textes = contenus(trace);
    assert.ok(
      textes.some((t) => plat(t).includes("TVA (20 %)") && plat(t).includes("500,00")),
      `La ligne « TVA (20 %) sur 500,00 € » manque : ${textes.filter((t) => t.includes("TVA")).join(" | ")}`
    );
    assert.ok(
      textes.some((t) => plat(t).includes("TVA (10 %)") && plat(t).includes("2 450,00")),
      "La ligne « TVA (10 %) sur 2 450,00 € » manque."
    );
    // Et le TTC reste celui de la facture, pas une somme refaite au dessin.
    assert.ok(textes.some((t) => plat(t).includes("3 295,00")), "Le Total TTC manque.");
  });

  await cas("UN SEUL taux : le bloc de totaux est exactement celui d'avant", async () => {
    // L'immense majorité des factures est dans ce cas. Une ligne en plus, un
    // mot en plus, et ce sont des milliers de documents qui changent d'allure.
    const { trace } = await composerFacturePdf(FACTURE);
    const lignesTva = contenus(trace).filter((t) => t.startsWith("TVA ("));
    assert.equal(lignesTva.length, 1, `Une seule ligne de TVA attendue : ${lignesTva.join(" | ")}`);
    assert.equal(lignesTva[0], "TVA (10 %)");
  });

  await cas("le titre du bloc ne reste jamais seul en bas d'une page", async () => {
    // Un intertitre orphelin — sa première ligne partie à la page suivante —
    // se lit comme un bloc vide, et fait douter du reste du document.
    for (let combien = 18; combien <= 28; combien++) {
      const lignes = Array.from({ length: combien }, (_, i) => ({
        libelle: `Prestation ${i + 1} — abattage par démontage avec rétention`,
        quantite: "1",
        prixUnitaire: "180.00",
        montant: "180.00",
      }));
      const { trace } = await composerFacturePdf({
        ...AVEC_SUPPLEMENT,
        lignes: [
          ...lignes,
          {
            libelle: "Terrasse bois",
            quantite: "1",
            prixUnitaire: "500.00",
            montant: "500.00",
            intertitre: "Travaux supplémentaires",
          },
        ],
      });
      const titre = trace.textes.find((t) => t.contenu.replace(/\s+/g, "").toUpperCase().includes("TRAVAUXSUPPL"));
      const ligne = trace.textes.find((t) => t.contenu.includes("Terrasse bois"));
      assert.ok(titre && ligne, `Titre ou ligne manquants à ${combien} lignes.`);
      assert.equal(
        titre!.page,
        ligne!.page,
        `À ${combien} lignes, le titre est page ${titre!.page} et sa ligne page ${ligne!.page}.`
      );
    }
  });

  await cas("le PDF produit est un vrai PDF, non vide", async () => {
    const { pdf } = await composerFacturePdf(FACTURE);
    assert.ok(pdf.length > 2000, `PDF suspicieusement court : ${pdf.length} octets.`);
    assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-", "L'en-tête PDF manque.");
  });

  if (echecs > 0) {
    console.error(`\n${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("Tous les contrôles de la facture PDF sont passés.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
