/* =======================================================================
   LA FACTUR-X D'ATLAS, JUGÉE PAR LES CONTRÔLEURS OFFICIELS.

   **Sa décision du 5 novembre 2026** (`ARCHITECTURE.md` §555) : Atlas
   fabrique la facture électronique. Une facture que la plateforme refuse ne
   part pas (son choix 3 B) : il faut donc la savoir juste AVANT, ici, et pas
   l'apprendre d'un refus chez son client.

   **Ce qu'elle joue, et qui juge :**

   | | juge |
   |---|---|
   | le XML de cinq factures types | le schéma CII D16B, puis les règles EN 16931 de la Commission européenne |
   | les refus de `xmlFactureX` | la phrase rendue, pour chaque donnée qui manque |
   | le PDF/A-3 (`fabriquerFactureX`) | veraPDF, profil 3b, et le XML relu dans le PDF |

   **Elle sait échouer** : une facture aux totaux faussés exprès doit être
   refusée par les règles officielles (BR-CO-15), et un PDF ordinaire refusé
   par veraPDF. Sans ces deux rouges, un contrôle muet passerait pour vert.

   **Sans Java ni Maven, elle ne mesure rien et le dit** (`_outil-requis.ts`).
   ======================================================================= */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { exigerLesOutils } from "./_outil-requis";
import { outilsFactureX } from "./_outils-facture-x.mjs";
import {
  xmlFactureX,
  adresseEnParties,
  codeUnite,
  sirenDe,
  type FacturePourFactureX,
} from "../src/lib/facture-x";
import { totauxAvecReduction } from "../src/lib/reduction-devis";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts, type PDFRef } from "pdf-lib";
import { fabriquerFactureX } from "../src/server/pdf/facture-x-pdf";
import { genererPdfFacture, type FacturePdfData } from "../src/server/pdf/facture-pdf";

/** Le flux d'un fichier joint, désigné par sa référence. */
function fluxBrut(doc: PDFDocument, ref: unknown): PDFRawStream {
  const flux = doc.context.lookup(ref as PDFRef);
  assert.ok(flux instanceof PDFRawStream, "le fichier joint n'est pas un flux");
  return flux;
}

exigerLesOutils("java", "mvn", "git");

let reussis = 0;
async function ok(nom: string, fn: () => void | Promise<void>) {
  await fn();
  reussis++;
  console.log(`  ✓ ${nom}`);
}

const MENTION =
  "En cas de retard de paiement, une pénalité au taux de trois fois le taux d'intérêt légal est exigible, " +
  "ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €. Pas d'escompte pour paiement anticipé.";

/** Une facture dont les totaux sortent de la règle commune, comme `donneesFacture`. */
function facture(partiel: Partial<FacturePourFactureX> & Pick<FacturePourFactureX, "lignes">): FacturePourFactureX {
  const base: Omit<FacturePourFactureX, "totalHt" | "totalTva" | "totalTtc"> = {
    numeroCommercial: "F2026-000032",
    dateEmission: "2026-11-04",
    dateEcheance: "2026-12-04",
    dateTravaux: "2026-10-28",
    numeroDevis: "D2026-000118",
    devise: "EUR",
    tauxTva: "20.00",
    regimeTva: "assujettie",
    entrepriseNom: "Jardins Démo",
    entrepriseAdresse: "4 chemin des Vignes 33500 Libourne",
    entrepriseSiret: "12345678900021",
    entrepriseNumeroTva: "FR 32 123456789",
    entrepriseEmail: "contact@jardins-demo.fr",
    entrepriseIban: "FR76 3000 6000 0112 3456 7890 189",
    clientNom: "Syndic Les Tilleuls",
    clientAdresse: "18 avenue de la Gare, 33000 Bordeaux",
    clientSiret: "98765432100014",
    adresseChantier: "Résidence Les Tilleuls 2 rue Lafaurie 33000 Bordeaux",
    ...partiel,
  };
  const t = totauxAvecReduction(base.lignes, base.tauxTva, base.reductionPourcent ?? null);
  return { ...base, totalHt: t.totalHt, totalTva: t.totalTva, totalTtc: t.totalTtc, ...pick(partiel) };
}
function pick(p: Partial<FacturePourFactureX>) {
  const r: Partial<FacturePourFactureX> = {};
  for (const k of ["totalHt", "totalTva", "totalTtc"] as const) if (p[k] !== undefined) r[k] = p[k];
  return r;
}

const CAS: Record<string, FacturePourFactureX> = {
  "un-taux": facture({
    lignes: [
      { libelle: "Taille de haie de thuyas", quantite: "42", prixUnitaire: "8.50", montant: "357.00", unite: "ml" },
      { libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "120", montant: "120.00", unite: "forfait" },
    ],
  }),
  "deux-taux-remise-acompte": facture({
    tauxTva: "10.00",
    reductionPourcent: "10",
    lignes: [
      { libelle: "Engazonnement", quantite: "180", prixUnitaire: "6.20", montant: "1116.00", unite: "m²", tauxTva: "10.00" },
      { libelle: "Fourniture de massifs", quantite: "3", prixUnitaire: "149.99", montant: "449.97", unite: "u", tauxTva: "20.00" },
      { libelle: "Main d'œuvre", quantite: "2", prixUnitaire: "320", montant: "640.00", unite: "jour/homme", tauxTva: "10.00" },
      { libelle: "Arrosage ajouté", quantite: "1", prixUnitaire: "95", montant: "95.00", unite: "u", tauxTva: "20.00", supplement: true },
    ],
    reglements: [{ montant: "600.00" }],
  }),
  "sous-traitance": facture({
    tauxTva: "0.00",
    autoliquidation: true,
    clientNumeroTva: "FR 61 987654321",
    lignes: [{ libelle: "Plantation de haie, lot espaces verts", quantite: "1", prixUnitaire: "2880", montant: "2880.00", unite: "forfait" }],
  }),
  franchise: facture({
    tauxTva: "0.00",
    regimeTva: "franchise",
    lignes: [{ libelle: "Tonte et ébarbage", quantite: "3", prixUnitaire: "45", montant: "135.00", unite: "h" }],
  }),
  "sans-echeance-avec-conditions": facture({
    dateEcheance: null,
    conditionsPaiement: "Paiement à réception.",
    entrepriseIban: null,
    adresseChantier: null,
    dateTravaux: null,
    numeroDevis: null,
    lignes: [{ libelle: "Débroussaillage", quantite: "1", prixUnitaire: "-50", montant: "-50.00" }, { libelle: "Élagage", quantite: "1", prixUnitaire: "400", montant: "400.00" }],
  }),
};

async function principal(): Promise<void> {
console.log("Les règles pures");

await ok("une adresse se coupe au code postal, avec ou sans virgule", () => {
  assert.deepEqual(adresseEnParties("18 avenue de la Gare, 33000 Bordeaux"), { ligne: "18 avenue de la Gare", codePostal: "33000", ville: "Bordeaux" });
  assert.deepEqual(adresseEnParties("4 chemin des Vignes\n33500 Libourne, France"), { ligne: "4 chemin des Vignes", codePostal: "33500", ville: "Libourne" });
  assert.equal(adresseEnParties("Lieu-dit Le Bourg"), null);
  assert.equal(adresseEnParties(null), null);
});

await ok("les unités d'une ligne ont toutes un code, et l'inconnue part « une unité »", () => {
  assert.equal(codeUnite("m²"), "MTK");
  assert.equal(codeUnite("ml"), "MTR");
  assert.equal(codeUnite("forfait"), "LS");
  assert.equal(codeUnite("jour/homme"), "DAY");
  assert.equal(codeUnite("arbre"), "C62");
  assert.equal(codeUnite(null), "C62");
});

await ok("le SIREN est le début du SIRET", () => {
  assert.equal(sirenDe("123 456 789 00021"), "123456789");
  assert.equal(sirenDe("1234"), null);
});

await ok("chaque donnée qui manque donne sa phrase, et aucun XML", () => {
  const refus = (f: FacturePourFactureX) => {
    const r = xmlFactureX(f, MENTION);
    assert.equal(r.ok, false);
    return (r as { raison: string }).raison;
  };
  const l = CAS["un-taux"].lignes;
  assert.match(refus(facture({ lignes: l, entrepriseNumeroTva: null })), /numéro de TVA/);
  assert.match(refus(facture({ lignes: l, clientAdresse: "Le Bourg" })), /adresse du client/);
  assert.match(refus(facture({ lignes: l, entrepriseAdresse: null })), /Votre adresse/);
  assert.match(refus(facture({ lignes: l, totalTtc: "999.99" })), /totaux/);
  assert.match(refus(facture({ lignes: l, clientNom: "  " })), /nom du client/);
  assert.match(refus(facture({ lignes: l, dateEcheance: null })), /échéance/);
  assert.match(refus(facture({ tauxTva: "0.00", lignes: [{ ...l[0], tauxTva: "0.00" }] })), /sans motif/);
  assert.match(refus(facture({ lignes: l, reglements: [{ montant: "5000.00" }] })), /dépassent/);
  assert.match(
    refus(facture({ autoliquidation: true, tauxTva: "0.00", clientSiret: null, clientNumeroTva: null, lignes: l })),
    /sous-traitance/
  );
});

console.log("\nLes contrôleurs officiels");
const outils = outilsFactureX();
const dossier = mkdtempSync(path.join(os.tmpdir(), "facture-x-"));

function controler(fichiers: Record<string, string>): Map<string, string[]> {
  for (const [nom, xml] of Object.entries(fichiers)) writeFileSync(path.join(dossier, nom), xml);
  const r = spawnSync(
    "java",
    ["-cp", outils.classpath, path.join(__dirname, "facture-x", "Controle.java"), outils.xsd, outils.xslt, ...Object.keys(fichiers).map((n) => path.join(dossier, n))],
    { encoding: "utf8", timeout: 5 * 60 * 1000 }
  );
  assert.equal(r.status, 0, `le contrôleur Java est tombé :\n${r.stderr}`);
  const fautes = new Map<string, string[]>();
  const lus = new Set<string>();
  for (const ligne of r.stdout.split("\n").filter(Boolean)) {
    const [nom, regle, texte] = ligne.split("\t");
    if (regle === "LU") lus.add(nom);
    else fautes.set(nom, [...(fautes.get(nom) ?? []), `${regle} ${texte}`]);
  }
  // Un fichier que le contrôleur n'a pas lu jusqu'au bout n'est pas jugé.
  for (const nom of Object.keys(fichiers)) assert.ok(lus.has(nom), `${nom} n'a pas été lu par le contrôleur`);
  return fautes;
}

const fichiers: Record<string, string> = {};
for (const [nom, f] of Object.entries(CAS)) {
  const r = xmlFactureX(f, MENTION);
  assert.ok(r.ok, `${nom} : ${(r as { raison?: string }).raison}`);
  fichiers[`${nom}.xml`] = (r as { xml: string }).xml;
}
// Le témoin qui doit rougir : des totaux faussés à la main dans un XML juste.
fichiers["temoin-faux.xml"] = fichiers["un-taux.xml"].replace(
  /<ram:GrandTotalAmount>[^<]+<\/ram:GrandTotalAmount>/,
  "<ram:GrandTotalAmount>1.00</ram:GrandTotalAmount>"
);
const fautes = controler(fichiers);

for (const nom of Object.keys(CAS)) {
  await ok(`${nom} : conforme au schéma et aux règles EN 16931`, () => {
    assert.deepEqual(fautes.get(`${nom}.xml`) ?? [], []);
  });
}
await ok("le témoin aux totaux faussés est refusé par les règles officielles", () => {
  const siennes = fautes.get("temoin-faux.xml") ?? [];
  assert.ok(siennes.some((f) => f.startsWith("BR-CO-15")), `attendu BR-CO-15, reçu : ${siennes.join(" | ") || "rien"}`);
});

console.log("\nLe PDF/A-3");

/** Les fichiers joints d'un PDF, décompressés, par leur nom. */
async function joints(octets: Uint8Array): Promise<Map<string, { texte: string; relation: string }>> {
  const doc = await PDFDocument.load(octets, { updateMetadata: false });
  assert.equal(doc.context.trailerInfo.Encrypt, undefined, "le PDF est chiffré : ce n'est plus un PDF/A");
  const noms = doc.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray);
  const af = doc.catalog.lookup(PDFName.of("AF"), PDFArray);
  const rendu = new Map<string, { texte: string; relation: string }>();
  for (let i = 0; i < noms.size(); i += 2) {
    const fiche = noms.lookup(i + 1, PDFDict);
    const flux = fiche.lookup(PDFName.of("EF"), PDFDict).get(PDFName.of("F"));
    const nom = String(noms.lookup(i)).replace(/^\(|\)$/g, "");
    rendu.set(nom, {
      texte: inflateSync(fluxBrut(doc, flux).getContents()).toString("utf8"),
      relation: String(fiche.lookup(PDFName.of("AFRelationship"))),
    });
  }
  assert.equal(af.size(), rendu.size, "chaque fichier joint doit être relié au catalogue (/AF)");
  return rendu;
}

const MOMENT = new Date("2026-11-05T10:00:00Z");
// Le papier veut chaque règlement entier (sa date, son moyen) ; le XML n'en lit que le montant.
const entreprise = {
  ...CAS["deux-taux-remise-acompte"],
  statut: "emise",
  clientCivilite: "entreprise",
  reglements: [{ date: "2026-10-20", montant: "600.00", moyen: "virement", numero: null, solde: false }],
} as unknown as FacturePdfData;

// Une attestation d'assureur comme il en arrive : un PDF aux polices non
// embarquées. Recopiée en pages, elle ferait échouer la pièce entière.
const attestation = await (async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText("Attestation d'assurance décennale", { x: 60, y: 760, size: 14, font: await doc.embedFont(StandardFonts.Helvetica) });
  return { octets: await doc.save(), mime: "application/pdf" };
})();

const pieces: Record<string, Uint8Array> = {};
const xmlJoint: Record<string, string> = {};
for (const [nom, options] of Object.entries({
  "typographie-d-origine": {},
  "typographie-choisie": { allure: { typographie: "lato", fond: "#ffffff", accent: "#2f3b2f" } },
  "avec-attestation": { attestation },
})) {
  const r = await fabriquerFactureX(entreprise, options, MOMENT);
  assert.ok(r.ok, `${nom} : ${(r as { raison?: string }).raison}`);
  pieces[`${nom}.pdf`] = (r as { pdf: Uint8Array }).pdf;
  xmlJoint[`${nom}.pdf`] = (r as { xml: string }).xml;
}
pieces["temoin-ordinaire.pdf"] = await genererPdfFacture(entreprise);
for (const [nom, octets] of Object.entries(pieces)) writeFileSync(path.join(dossier, nom), octets);

const vera = spawnSync(
  "java",
  ["-cp", outils.classpath, "org.verapdf.apps.GreenfieldCliWrapper", "--flavour", "3b", "--format", "text", ...Object.keys(pieces).map((n) => path.join(dossier, n))],
  { encoding: "utf8", timeout: 5 * 60 * 1000 }
);
const verdicts = new Map<string, string>();
for (const ligne of vera.stdout.split("\n")) {
  const m = ligne.match(/^(PASS|FAIL) (.+) 3b$/);
  if (m) verdicts.set(path.basename(m[2]), m[1]);
}

for (const nom of ["typographie-d-origine", "typographie-choisie", "avec-attestation"]) {
  await ok(`${nom} : PDF/A-3b selon veraPDF`, () => {
    assert.equal(verdicts.get(`${nom}.pdf`), "PASS", `veraPDF : ${verdicts.get(`${nom}.pdf`) ?? "pas de verdict"}\n${vera.stderr.slice(-800)}`);
  });
}
await ok("le témoin, la facture verrouillée d'aujourd'hui, est refusé par veraPDF", () => {
  assert.equal(verdicts.get("temoin-ordinaire.pdf"), "FAIL");
});

await ok("le XML relu dans le PDF est celui que la règle a écrit, et il passe les règles officielles", async () => {
  const lus = await joints(pieces["typographie-d-origine.pdf"]);
  assert.deepEqual([...lus.keys()], ["factur-x.xml"]);
  assert.equal(lus.get("factur-x.xml")!.texte, xmlJoint["typographie-d-origine.pdf"]);
  assert.equal(lus.get("factur-x.xml")!.relation, "/Alternative");
  const fautesDuJoint = controler({ "joint.xml": lus.get("factur-x.xml")!.texte });
  assert.deepEqual(fautesDuJoint.get("joint.xml") ?? [], []);
});

await ok("l'attestation part en fichier joint, pas en pages", async () => {
  const lus = await joints(pieces["avec-attestation.pdf"]);
  assert.deepEqual([...lus.keys()].sort(), ["attestation-decennale.pdf", "factur-x.xml"]);
  assert.equal(lus.get("attestation-decennale.pdf")!.relation, "/Supplement");
  const avec = await PDFDocument.load(pieces["avec-attestation.pdf"]);
  const sans = await PDFDocument.load(pieces["typographie-d-origine.pdf"]);
  assert.equal(avec.getPageCount(), sans.getPageCount());
});

await ok("une facture que la règle refuse ne donne aucun PDF", async () => {
  const r = await fabriquerFactureX({ ...entreprise, entrepriseNumeroTva: null }, {}, MOMENT);
  assert.equal(r.ok, false);
});

rmSync(dossier, { recursive: true, force: true });
console.log(`\n${reussis} test(s) réussi(s).`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
