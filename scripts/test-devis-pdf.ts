import assert from "node:assert/strict";
import {
  composerDevisPdf,
  PALETTE_DEVIS,
  PIED_DEVIS,
  type DevisPdfData,
  type TraceDevis,
} from "../src/server/pdf/devis-pdf";
import { colors } from "../src/lib/design-tokens";

// Le devis d'Atlas doit être celui d'Arborea (`appli/devis-modele.html`).
//
// Le patron a ouvert le PDF d'Atlas à côté du sien : « le devis n'a rien à voir
// avec celui qu'on a fait pour arborea ». C'est le seul document que son client
// voit. Cette suite tient l'écart fermé — la structure du modèle, ses mentions,
// son écriture des montants — et surtout elle vérifie ce qu'un coup d'œil ne
// voit pas : qu'un devis long n'écrit pas par-dessus le cadre de signature.
//
// Ces contrôles savent échouer : chacun a été confronté à la version d'avant,
// et chacun l'a refusée (voir le journal de la conversation dans CHANGELOG.md).

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0006",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-03",
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
  conditionsPaiement:
    "Acompte de 30 % à la signature, solde à réception des travaux. Devis gratuit et sans engagement.",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [
    {
      libelle:
        "Démontage d'un chêne en bordure de rue, avec rétention des charpentières au-dessus du portail",
      quantite: "1",
      prixUnitaire: "1400.00",
      montant: "1400.00",
    },
    { libelle: "Taille de haie de laurier, façade et retour", quantite: "18", prixUnitaire: "35.00", montant: "630.00" },
    {
      libelle: "Broyage sur place et bois coupé en 50 cm laissé au client",
      quantite: "1",
      prixUnitaire: "420.00",
      montant: "420.00",
    },
  ],
};

const contenus = (trace: TraceDevis) => trace.textes.map((t) => t.contenu);

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
  console.log("=== Le devis reprend le modèle d'Arborea ===");

  await cas("la structure du modèle est là, dans son ordre", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    const textes = contenus(trace);
    // Les intertitres du modèle, un par un. Un seul qui manque et le patron ne
    // reconnaît plus son document.
    for (const attendu of [
      "Devis n°",
      "Date",
      "Validité",
      "DEVIS",
      "ÉMETTEUR",
      "CLIENT",
      "DESCRIPTION",
      "QTÉ",
      "PRIX UNITAIRE HT",
      "TOTAL HT",
      "Total HT",
      "Total TTC",
      "NOTES / CONDITIONS",
      "MODALITÉS DE PAIEMENT",
      "Bon pour accord — signature du client",
    ]) {
      assert.ok(textes.includes(attendu), `« ${attendu} » manque au devis.`);
    }

    const rang = (t: string) => textes.indexOf(t);
    assert.ok(rang("DEVIS") < rang("ÉMETTEUR"), "Le titre doit précéder les parties.");
    assert.ok(rang("ÉMETTEUR") < rang("DESCRIPTION"), "Les parties précèdent le tableau.");
    assert.ok(rang("DESCRIPTION") < rang("Total TTC"), "Le tableau précède les totaux.");
    assert.ok(rang("Total TTC") < rang("NOTES / CONDITIONS"), "Les totaux précèdent les notes.");
  });

  await cas("les accents sont écrits, pas rabotés", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    const textes = contenus(trace);
    // La première version écrivait « EMETTEUR », « QTE », « MODALITES » et une
    // mention légale entièrement désaccentuée. Sur le seul document que le client
    // reçoit, cela se voit.
    for (const sans of ["EMETTEUR", "QTE", "MODALITES DE PAIEMENT"]) {
      assert.ok(!textes.includes(sans), `« ${sans} » est écrit sans son accent.`);
    }
    const mention = textes.find((t) => t.startsWith("Devis établi par"));
    assert.ok(mention, "La mention légale ne commence pas comme celle du modèle.");
    const pied = textes.filter((t) => t.startsWith("Devis établi") || t.includes("précédé")).join(" ");
    assert.match(pied, /précédé/, "« précédé » a perdu ses accents.");
    assert.match(pied, /daté et signé/, "« daté et signé » a perdu ses accents.");
  });

  await cas("les montants s'écrivent comme dans le modèle : « 1 400,00 € »", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    const textes = contenus(trace);
    // `toLocaleString('fr-FR', {style:'currency'})` côté modèle : virgule
    // décimale, espace insécable aux milliers, symbole € — et non « 1400.00 EUR ».
    assert.ok(textes.includes("1 400,00 €"), "Le montant de ligne n'est pas au format français.");
    assert.ok(textes.includes("2 450,00 €"), "Le total HT n'est pas au format français.");
    assert.ok(textes.includes("2 695,00 €"), "Le total TTC n'est pas au format français.");
    // Le code monétaire en suffixe d'un nombre, et lui seul : chercher « EUR »
    // n'importe où accuserait « ÉMETTEUR », qui se termine par ces trois
    // lettres. Un contrôle qui désigne le mauvais coupable coûte plus cher que
    // pas de contrôle du tout.
    const codeEnSuffixe = textes.filter((t) => /\d\s?EUR$/.test(t));
    assert.deepEqual(
      codeEnSuffixe,
      [],
      "Le code « EUR » subsiste là où le modèle met le symbole."
    );
  });

  await cas("les intertitres portent le rust du patron, pas un vert", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    // Le patron a envoyé une capture de son devis en ligne : « ÉMETTEUR » et
    // « CLIENT » y sont terre cuite. Mesure sur ses pixels : #a95c35, soit le
    // `rust` d'Atlas à l'antialiasing près. Le fichier `appli/devis-modele.html`
    // de ce dépôt, lui, donne un vert #2f3b2f — la copie avait divergé de son
    // original, et la reproduire fidèlement reproduisait l'écart.
    for (const intertitre of ["ÉMETTEUR", "CLIENT"]) {
      const pose = trace.textes.find((t) => t.contenu === intertitre);
      assert.ok(pose, `« ${intertitre} » manque au devis.`);
      assert.equal(
        pose.couleur.toLowerCase(),
        colors.rust.toLowerCase(),
        `« ${intertitre} » n'est pas dans le rust du patron (${colors.rust}).`
      );
    }
    // La même teinte que celle qu'il voit partout ailleurs dans Atlas : deux
    // valeurs pour un seul accent finissent toujours par se contredire.
    assert.equal(
      PALETTE_DEVIS.titrePartie.toLowerCase(),
      colors.rust.toLowerCase(),
      "L'accent du devis a divergé de l'accent de l'application."
    );
  });

  await cas("le devis est sur le papier crème du modèle, sur toutes ses pages", async () => {
    assert.equal(PALETTE_DEVIS.papier.toLowerCase(), "#faf9f5", "Le papier n'est plus celui du modèle.");

    // Un devis qui déborde : c'est la page supplémentaire qui risque de rester
    // blanche, puisqu'elle naît ailleurs dans le code que la première.
    const { trace } = await composerDevisPdf({
      ...DEVIS,
      lignes: Array.from({ length: 25 }, (_, i) => ({
        libelle: `Prestation ${i + 1}`,
        quantite: "1",
        prixUnitaire: "180.00",
        montant: "180.00",
      })),
    });
    assert.ok(trace.pages > 1, "Ce devis devrait déborder, sinon le contrôle ne prouve rien.");

    const pagesAvecFond = new Set(trace.fonds.map((f) => f.page));
    for (let page = 1; page <= trace.pages; page++) {
      assert.ok(pagesAvecFond.has(page), `La page ${page} est restée sur du blanc.`);
    }
    for (const fond of trace.fonds) {
      assert.equal(
        fond.couleur.toLowerCase(),
        PALETTE_DEVIS.papier.toLowerCase(),
        `La page ${fond.page} n'a pas le papier du modèle.`
      );
    }
  });

  await cas("le nom affiché est celui de l'entreprise, jamais Arborea", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    const textes = contenus(trace);
    assert.ok(textes.includes("Eden Nature"), "Le nom de l'entreprise manque en en-tête.");
    assert.ok(
      !textes.some((t) => t.includes("Arborea")),
      "Le devis porte le nom d'une autre entreprise — Atlas sert n'importe quel artisan."
    );
  });

  await cas("un brouillon le dit sur le papier", async () => {
    const { trace } = await composerDevisPdf({ ...DEVIS, statut: "brouillon" });
    assert.ok(
      contenus(trace).includes("DEVIS (BROUILLON)"),
      "Un devis non envoyé peut être transmis par erreur s'il ne se signale pas."
    );
  });

  await cas("un champ absent laisse sa place vide, sans rien inventer", async () => {
    const { trace } = await composerDevisPdf({
      ...DEVIS,
      entrepriseIban: null,
      entrepriseSiret: null,
      conditionsPaiement: null,
      clientTelephone: null,
      adresseChantier: null,
    });
    const textes = contenus(trace);
    assert.ok(!textes.includes("MODALITÉS DE PAIEMENT"), "Un IBAN absent ne doit pas ouvrir son bloc.");
    assert.ok(!textes.includes("NOTES / CONDITIONS"), "Des conditions absentes ne doivent pas ouvrir leur bloc.");
    assert.ok(!textes.some((t) => t.startsWith("IBAN")), "Un IBAN a été inventé.");
    assert.ok(!textes.some((t) => t.startsWith("SIRET")), "Un SIRET a été inventé.");
    // Le pied, lui, reste : c'est ce que le client signe.
    assert.ok(textes.includes("Bon pour accord — signature du client"), "Le cadre de signature a disparu.");
  });

  await cas("un devis sans ligne le dit plutôt que de paraître tronqué", async () => {
    const { trace } = await composerDevisPdf({ ...DEVIS, lignes: [], totalHt: "0.00", totalTva: "0.00", totalTtc: "0.00" });
    assert.ok(contenus(trace).includes("Aucune ligne pour l'instant."), "Le tableau vide ne dit rien.");
  });

  await cas("un devis long ne recouvre jamais le cadre de signature", async () => {
    // Vingt-cinq prestations : rien d'extravagant pour un chantier d'élagage sur
    // plusieurs arbres. La version d'avant écrivait par-dessus la mention légale.
    const lignes = Array.from({ length: 25 }, (_, i) => ({
      libelle: `Prestation ${i + 1} — abattage par démontage avec rétention des charpentières et broyage sur place`,
      quantite: "1",
      prixUnitaire: "180.00",
      montant: "180.00",
    }));
    const { trace } = await composerDevisPdf({ ...DEVIS, lignes });

    assert.ok(trace.pages > 1, "Vingt-cinq lignes devraient déborder sur une deuxième page.");

    const cadre = trace.cadres.at(-1);
    assert.ok(cadre, "Le cadre de signature manque.");
    const hautCadre = cadre.y + cadre.hauteur;

    for (const t of trace.textes) {
      // Sur la dernière page, seuls le pied lui-même et le numéro de page vivent
      // sous le plancher.
      const estDuPied = t.taille <= 7.8 && t.y <= hautCadre + 24;
      if (estDuPied) continue;
      assert.ok(
        t.y >= PIED_DEVIS.plancher,
        `« ${t.contenu} » (page ${t.page}, y=${t.y.toFixed(1)}) descend sous le plancher ${PIED_DEVIS.plancher.toFixed(1)} réservé au pied.`
      );
    }

    // Et l'en-tête des colonnes est redessiné : sinon la deuxième page est un
    // tableau de chiffres sans en-tête. On le vérifie page par page, et
    // seulement là où il y a des lignes — la dernière page ne porte parfois que
    // les totaux et le pied.
    const pagesAvecLignes = new Set(
      trace.textes.filter((t) => t.contenu.startsWith("Prestation ")).map((t) => t.page)
    );
    assert.ok(pagesAvecLignes.size > 1, "Les lignes devraient s'étaler sur plusieurs pages.");
    const pagesAvecEnTete = new Set(
      trace.textes.filter((t) => t.contenu === "DESCRIPTION").map((t) => t.page)
    );
    for (const page of pagesAvecLignes) {
      assert.ok(
        pagesAvecEnTete.has(page),
        `La page ${page} porte des lignes mais aucun en-tête de colonnes.`
      );
    }

    // Un devis de plusieurs feuilles peut en perdre une : chacune se numérote.
    const numeros = contenus(trace).filter((t) => t.startsWith("Page "));
    assert.equal(numeros.length, trace.pages, "Chaque page devrait porter son numéro.");
    assert.ok(numeros.includes(`Page 1 / ${trace.pages}`), "La numérotation ne dit pas le total.");
  });

  await cas("un devis d'une page ne porte pas de numéro de page", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    assert.equal(trace.pages, 1, "Ce devis devrait tenir sur une page.");
    assert.ok(
      !contenus(trace).some((t) => t.startsWith("Page ")),
      "Le modèle ne numérote pas : « Page 1 / 1 » est un ornement en trop."
    );
  });

  await cas("le PDF produit est un vrai PDF, non vide", async () => {
    const { pdf } = await composerDevisPdf(DEVIS);
    assert.ok(pdf.length > 2000, `PDF suspicieusement court : ${pdf.length} octets.`);
    assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-", "L'en-tête PDF manque.");
  });

  if (echecs > 0) {
    console.error(`\n${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("Tous les contrôles du devis PDF sont passés.");

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
