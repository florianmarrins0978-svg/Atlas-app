// LA MISE EN PAGE DU DEVIS ET DE LA FACTURE — sa planche du 3 novembre 2026,
// codée le 4 (`appli/soignee/devis-mise-en-page.html`).
//
// Sa capture : son devis de 4 lignes, les modalités seules en page 2 sous un
// grand vide, puis la signature. Puis, devant la planche : *« ça marche sur un
// devis qui comporte pas beaucoup de lignes, mais 20 lignes, 30 lignes ? »*.
// Ce contrôle répond aux deux : son devis tel qu'il l'a montré, puis toutes
// les longueurs de 1 à 40 lignes, pour le devis comme pour la facture.
//
// Il ne lit que la trace du PDF : la règle de mise en page vit dans
// `document-commun.ts`, et rien ici ne la refait.

import assert from "node:assert/strict";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { PIED_DOCUMENT, type TraceDocument } from "../src/server/pdf/document-commun";

const SES_LIGNES: [string, string, string, string][] = [
  ["Taille de haie de laurier", "25", "ml", "24.00"],
  ["Élagage d'un frêne", "1", "u", "1000.00"],
  ["Camion d'évacuation", "1", "forfait", "150.00"],
  ["Broyeur", "1", "forfait", "250.00"],
  ["Abattage d'un thuya dépérissant en bordure de clôture, démontage par tronçons", "1", "u", "680.00"],
  ["Dessouchage à la rogneuse", "1", "u", "220.00"],
  ["Tonte de la pelouse arrière", "1", "forfait", "90.00"],
  ["Scarification et regarnissage du gazon", "120", "m²", "2.50"],
  ["Apport de terre végétale criblée", "4", "m³", "65.00"],
  ["Fourniture et pose de paillage en écorces de pin", "30", "m²", "9.00"],
];

/** N lignes, chacune avec son identifiant : c'est lui qu'un saut désigne. */
function lignes(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const [libelle, quantite, unite, prixUnitaire] = SES_LIGNES[i % SES_LIGNES.length];
    return { id: `l${i}`, libelle, quantite, unite, prixUnitaire, montant: (Number(quantite) * Number(prixUnitaire)).toFixed(2) };
  });
}

/** Son devis du 3 novembre, identité de démonstration (le dépôt est public). */
function devis(n: number, sauts?: string[], espaces?: Record<string, number>): Parameters<typeof composerDevisPdf> {
  const ls = lignes(n);
  const ht = ls.reduce((t, l) => t + Number(l.montant), 0);
  const data: DevisPdfData = {
    numeroCommercial: "2026-000072", numeroVersion: 1, statut: "brouillon", dateEmission: "2026-11-03", validiteJours: 30,
    entrepriseNom: "Atelier Démo", entrepriseFormeJuridique: "sas", entrepriseCapitalSocial: "1500.00", entrepriseVilleRcs: "Poissy",
    entrepriseAdresse: "12 rue des Lilas 78200 Mantes la Jolie", entrepriseSiret: "123 456 789 00012", entrepriseNumeroTva: "FR00000000",
    entrepriseTelephone: "06 00 00 00 00", entrepriseEmail: "contact@atelier-demo.fr",
    entrepriseIban: "FR76 3000 1000 0000 0000 0000 000",
    entrepriseAssureurDecennale: "Axa", entrepriseAdresseAssureurDecennale: "Nanterre, France", entrepriseMediateurNom: "Médiateur Démo",
    clientCivilite: "mr", clientNom: "Bernard", clientAdresse: "34 Rue Lecourbe 75015 Paris", clientTelephone: "06 12 34 56 78",
    adresseChantier: "34 Rue Lecourbe 75015 Paris", conditionsPaiement: null, devise: "EUR", tauxTva: "20.00",
    titre: "Élagage frêne", dureeEstimee: "2 jours", mainDoeuvreHt: (ht * 0.8).toFixed(2),
    conditionsReglees: { acomptePourcent: "30", delaiPaiementJours: 30, moyensPaiement: "virement, chèque", rappelerPenalites: true },
    totalHt: ht.toFixed(2), totalTva: (ht * 0.2).toFixed(2), totalTtc: (ht * 1.2).toFixed(2), acomptes: [{ rang: 1, tauxCumule: "30" }],
    lignes: ls,
    sautsDePage: sauts,
    espacesDePage: espaces,
  };
  return [data];
}

function facture(n: number): FacturePdfData {
  const ls = lignes(n);
  const ht = ls.reduce((t, l) => t + Number(l.montant), 0);
  return {
    numeroCommercial: "F2026-000004", statut: "emise", dateEmission: "2026-11-03", dateEcheance: "2026-12-03", numeroDevis: "2026-000072",
    entrepriseNom: "Atelier Démo", entrepriseAdresse: "12 rue des Lilas 78200 Mantes la Jolie", entrepriseSiret: "123 456 789 00012",
    entrepriseTelephone: "06 00 00 00 00", entrepriseEmail: "contact@atelier-demo.fr", entrepriseIban: "FR76 3000 1000 0000 0000 0000 000",
    clientNom: "M. Bernard", clientAdresse: "34 Rue Lecourbe 75015 Paris", clientTelephone: "06 12 34 56 78",
    adresseChantier: "34 Rue Lecourbe 75015 Paris", conditionsPaiement: "Merci de votre confiance.", devise: "EUR", tauxTva: "20.00",
    totalHt: ht.toFixed(2), totalTva: (ht * 0.2).toFixed(2), totalTtc: (ht * 1.2).toFixed(2),
    lignes: ls,
  };
}

const element = (t: TraceDocument, cle: string) => t.elements.find((e) => e.cle === cle);
const texte = (t: TraceDocument, debut: string) => t.textes.find((x) => x.contenu.replace(/\s/g, "").startsWith(debut.replace(/\s/g, "")));
const lignesDeLaPage = (t: TraceDocument, page: number) => t.elements.filter((e) => e.page === page && e.cle.startsWith("ligne")).length;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Les règles qui valent pour toute longueur. Rendent la première faute, ou rien. */
function fauteDeMiseEnPage(t: TraceDocument): string | null {
  const pied = t.pied;
  if (!pied) return "aucun pied posé";
  if (pied.bas < PIED_DOCUMENT.marge + 9) return `le pied descend sur le numéro de page (bas ${pied.bas.toFixed(1)})`;
  const notes = element(t, "notes");
  const modalites = element(t, "modalites");
  if (modalites && modalites.page !== pied.page) return `les modalités (page ${modalites.page}) ne sont pas avec la signature (page ${pied.page})`;
  if (notes && modalites && notes.page !== modalites.page) return `les modalités sont parties sans leurs notes (pages ${notes.page} et ${modalites.page})`;
  for (const x of t.textes) {
    if (/^Page \d+ \/ \d+$/.test(x.contenu)) continue;
    const duPied = x.page === pied.page && x.y <= pied.haut && x.taille <= 7.8;
    if (duPied) continue;
    if (x.page === pied.page && x.y <= pied.haut) return `« ${x.contenu.slice(0, 40)} » (page ${x.page}) descend sur le pied`;
    if (x.y < PIED_DOCUMENT.plancher) return `« ${x.contenu.slice(0, 40)} » (page ${x.page}, y=${x.y.toFixed(1)}) descend sur le numéro de page`;
  }
  return null;
}

async function main() {
  console.log("=== La mise en page du devis et de la facture ===\n");

  await cas("son devis de 4 lignes tient sur une page, modalités et signature comprises", async () => {
    const { trace } = await composerDevisPdf(...devis(4));
    assert.equal(element(trace, "modalites")?.page, 1, "les modalités sont parties en page 2, seules sous un grand vide (sa capture du 3 novembre)");
    assert.equal(trace.pied?.page, 1, "la signature est partie en page 2");
    assert.equal(trace.cadres.at(-1)?.page, 1, "le cadre de signature n'est pas en page 1");
  });

  await cas("la signature est collée sous l'IBAN, à 20 lignes comme à 4", async () => {
    for (const n of [4, 20, 30]) {
      const { trace } = await composerDevisPdf(...devis(n));
      const iban = texte(trace, "IBAN :");
      assert.ok(iban && trace.pied, `${n} lignes : pas d'IBAN ou pas de pied`);
      assert.equal(iban.page, trace.pied.page, `${n} lignes : l'IBAN et la signature ne sont pas sur la même page`);
      const traitDuPied = trace.pied.haut - 4;
      const ecart = iban.y - traitDuPied;
      assert.ok(Math.abs(ecart - 22.4) < 0.05, `${n} lignes : ${ecart.toFixed(1)} points entre l'IBAN et le trait du pied, 22,4 attendus`);
    }
  });

  await cas("les pages du milieu se remplissent jusqu'au numéro de page", async () => {
    const { trace } = await composerDevisPdf(...devis(30));
    const bas = Math.min(...trace.elements.filter((e) => e.page === 1).map((e) => e.bas));
    assert.ok(bas < PIED_DOCUMENT.marge + 114, `la page 1 s'arrête à ${bas.toFixed(1)} : elle garde encore la place de la signature, qui n'y est pas`);
    assert.ok(lignesDeLaPage(trace, 1) > 11, `${lignesDeLaPage(trace, 1)} lignes en page 1, 11 seulement avant la règle`);
  });

  await cas("de 1 à 40 lignes, le devis tombe bien : rien sur le pied, rien sur le numéro, les modalités jamais seules", async () => {
    for (let n = 1; n <= 40; n++) {
      const { trace } = await composerDevisPdf(...devis(n));
      const faute = fauteDeMiseEnPage(trace);
      assert.equal(faute, null, `devis de ${n} lignes : ${faute}`);
    }
  });

  await cas("de 1 à 40 lignes, la facture aussi", async () => {
    for (let n = 1; n <= 40; n++) {
      const { trace } = await composerFacturePdf(facture(n));
      const faute = fauteDeMiseEnPage(trace);
      assert.equal(faute, null, `facture de ${n} lignes : ${faute}`);
    }
  });

  await cas("un saut devant une ligne la met en haut d'une page neuve, en-tête du tableau redessiné", async () => {
    const sans = (await composerDevisPdf(...devis(20))).trace;
    const avec = (await composerDevisPdf(...devis(20, ["ligne:l5"]))).trace;
    const l4 = element(avec, "ligne:l4");
    const l5 = element(avec, "ligne:l5");
    assert.ok(l4 && l5 && l5.page === l4.page + 1, "la ligne 6 n'est pas passée à la page suivante");
    assert.equal(element(sans, "ligne:l5")?.page, 1, "le décor ne prouve rien : la ligne 6 était déjà en page 2");
    const enTete = avec.textes.filter((x) => x.contenu.replace(/\s/g, "") === "DÉSIGNATION").map((x) => x.page);
    assert.ok(enTete.includes(l5.page), "l'en-tête du tableau n'est pas redessiné sur la page neuve");
    assert.equal(fauteDeMiseEnPage(avec), null);
  });

  await cas("un saut devant les totaux, les notes ou les modalités les envoie à la page suivante", async () => {
    for (const cle of ["totaux", "notes", "modalites"]) {
      const avant = element((await composerDevisPdf(...devis(4))).trace, cle);
      const apres = element((await composerDevisPdf(...devis(4, [cle]))).trace, cle);
      assert.ok(avant && apres && apres.page === avant.page + 1, `un saut devant « ${cle} » ne l'a pas envoyé à la page suivante`);
    }
    // Son saut devant les modalités est SON choix : la règle des notes ne le
    // défait pas en les déplaçant avec elles.
    const { trace } = await composerDevisPdf(...devis(4, ["modalites"]));
    assert.equal(element(trace, "notes")?.page, 1, "les notes ont suivi les modalités alors qu'il les avait laissées");
  });

  await cas("un saut devant ce qui ouvre déjà une page ne fait pas de page blanche", async () => {
    const sans = (await composerDevisPdf(...devis(30))).trace;
    const premiere = sans.elements.find((e) => e.page === 2 && e.cle.startsWith("ligne:"));
    assert.ok(premiere, "aucune ligne en page 2 : le décor ne prouve rien");
    const avec = (await composerDevisPdf(...devis(30, [premiere.cle]))).trace;
    assert.equal(avec.pages, sans.pages, "un saut devant la première ligne d'une page a ouvert une page blanche");
  });

  await cas("un saut qui ne désigne plus rien ne fait rien", async () => {
    const sans = (await composerDevisPdf(...devis(4))).trace;
    const avec = (await composerDevisPdf(...devis(4, ["ligne:supprimee"]))).trace;
    assert.deepEqual(avec.elements, sans.elements);
  });

  // ─── LES ESPACES : sa réponse du 4 novembre, « dans la 1 oui la B », et
  // « d'affilée » (`appli/soignee/devis-mise-en-page-questions.html`).

  await cas("un espace devant une ligne la descend d'une ligne vide, sur la même page", async () => {
    const sans = (await composerDevisPdf(...devis(20))).trace;
    const avec = (await composerDevisPdf(...devis(20, [], { "ligne:l5": 1 }))).trace;
    const avant = element(sans, "ligne:l5");
    const apres = element(avec, "ligne:l5");
    assert.ok(avant && apres, "la ligne 6 manque à la trace");
    assert.equal(apres.page, avant.page, "un espace a fait changer la ligne de page");
    assert.equal(Math.round(avant.haut - apres.haut), 30, "la ligne n'est pas descendue d'une ligne vide");
    assert.deepEqual(avec.espaces.map((e) => [e.cle, e.n]), [["ligne:l5", 1]], "l'aperçu ne saura pas où est l'espace");
    assert.equal(element(avec, "ligne:l4")?.haut, element(sans, "ligne:l4")?.haut, "la ligne d'avant a bougé");
    assert.equal(fauteDeMiseEnPage(avec), null);
  });

  await cas("plusieurs espaces d'affilée : trois espaces, trois lignes vides", async () => {
    const sans = element((await composerDevisPdf(...devis(20))).trace, "ligne:l5");
    const avec = (await composerDevisPdf(...devis(20, [], { "ligne:l5": 3 }))).trace;
    assert.ok(sans);
    assert.equal(Math.round(sans.haut - (element(avec, "ligne:l5")?.haut ?? 0)), 90);
    assert.equal(avec.espaces[0]?.n, 3);
    assert.equal(fauteDeMiseEnPage(avec), null);
  });

  await cas("la page n'en tient que ce qu'elle peut : un espace ne fait jamais changer la ligne de page", async () => {
    const avec = (await composerDevisPdf(...devis(20, [], { "ligne:l5": 40 }))).trace;
    const l5 = element(avec, "ligne:l5");
    assert.equal(l5?.page, 1, "trop d'espaces ont envoyé la ligne à la page suivante");
    const poses = avec.espaces[0]?.n ?? 0;
    assert.ok(poses > 0 && poses < 40, `la page a pris ${poses} espaces sur 40`);
    assert.ok(l5.bas - 30 < PIED_DOCUMENT.plancher + 30, "il restait la place d'un espace de plus");
    assert.equal(fauteDeMiseEnPage(avec), null);
  });

  await cas("un espace en haut d'une page ne laisse rien", async () => {
    const sans = (await composerDevisPdf(...devis(30))).trace;
    const premiere = sans.elements.find((e) => e.page === 2 && e.cle.startsWith("ligne:"));
    assert.ok(premiere, "aucune ligne en page 2 : le décor ne prouve rien");
    const avec = (await composerDevisPdf(...devis(30, [], { [premiere.cle]: 2 }))).trace;
    assert.deepEqual(avec.espaces, []);
    assert.equal(element(avec, premiere.cle)?.haut, premiere.haut);
  });

  await cas("un espace devant les totaux, les notes ou les modalités les descend sur leur page", async () => {
    for (const cle of ["totaux", "notes", "modalites"]) {
      // Un devis d'une ligne : la page 1 a la place d'un espace sous chacun des
      // trois, pied compris. Celui de 4 lignes est trop juste (cas suivant).
      const avant = element((await composerDevisPdf(...devis(1))).trace, cle);
      const trace = (await composerDevisPdf(...devis(1, [], { [cle]: 1 }))).trace;
      const apres = element(trace, cle);
      assert.ok(avant && apres && apres.page === avant.page, `un espace devant « ${cle} » l'a fait changer de page`);
      assert.equal(Math.round(avant.haut - apres.haut), 30, `« ${cle} » n'est pas descendu d'une ligne vide`);
      assert.equal(fauteDeMiseEnPage(trace), null, `espace devant « ${cle} »`);
    }
  });

  await cas("un espace qui pousserait la signature hors de la page fait passer la fin à la suivante, sans espace", async () => {
    // Son devis de 4 lignes tient sur une page à quelques points près : un
    // espace devant les notes ne laisse plus la place du pied. La règle du pied
    // envoie alors notes, modalités et signature ensemble en page 2, et
    // l'espace, en haut de page, ne laisse rien : c'est ce que l'action voit
    // pour lui dire « Plus de place sur cette page. ».
    const trace = (await composerDevisPdf(...devis(4, [], { notes: 1 }))).trace;
    assert.equal(element(trace, "notes")?.page, 2);
    assert.deepEqual(trace.espaces, []);
    assert.equal(fauteDeMiseEnPage(trace), null);
  });

  await cas("un saut posé devant un élément l'emporte sur ses espaces", async () => {
    const trace = (await composerDevisPdf(...devis(20, ["ligne:l5"], { "ligne:l5": 2 }))).trace;
    assert.deepEqual(trace.espaces, []);
    assert.equal(element(trace, "ligne:l5")?.page, 2);
  });

  await cas("chaque ligne se retrouve dans la trace par son identifiant", async () => {
    const { trace } = await composerDevisPdf(...devis(30));
    for (let i = 0; i < 30; i++) {
      const e = element(trace, `ligne:l${i}`);
      assert.ok(e && e.haut > e.bas, `la ligne l${i} n'a pas de place dans la trace`);
    }
  });

  console.log(`\nLa mise en page : ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
