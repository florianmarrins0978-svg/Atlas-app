import assert from "node:assert/strict";
import {
  cheminsDuDossier,
  nomDuDossierClient,
  piecesOuvertes,
  type PieceDuDossier,
} from "../src/lib/dossier-du-client";
import { composerRapportEntretienPdf } from "../src/server/pdf/rapport-entretien-pdf";
import type { RapportPublic } from "../src/server/repositories/passages-entretien";

// « Tout télécharger » d'un client — sa demande du 22 octobre 2026.
//
// Ce que cette suite tient, sans base ni navigateur :
//   1. le fichier ne donne à un rôle que ce qu'il ouvre déjà une pièce à la
//      fois. Un commercial ne lit pas les factures : le zip ne doit pas les lui
//      remettre par la bande ;
//   2. les chemins ne s'écrasent pas, et portent le nom du téléchargement seul ;
//   3. le compte rendu d'entretien en PDF dit ce que la page du client dit, et
//      aucun montant.

const echecs: string[] = [];
async function cas(nom: string, f: () => void | Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    console.log(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
    echecs.push(nom);
  }
}

const piece = (registre: PieceDuDossier["registre"], id: string, titre: string, jour: string, href: string) => ({
  registre,
  piece: { id, titre, jour, precision: null, href },
});

const DOSSIER: PieceDuDossier[] = [
  piece("fiches", "p1", "4 juillet", "2026-07-04", "/entretien/jetonUn"),
  piece("avoirs", "a1", "n° 2026-0002", "2026-08-01", "/api/avoirs/a1/pdf"),
  piece("factures", "f1", "n° 2026-0009", "2026-07-10", "/api/factures/f1/pdf"),
  piece("devis", "d1", "n° 2026-0031", "2026-06-12", "/api/devis/d1/pdf"),
  piece("fiches", "p2", "4 juillet", "2026-07-04", "/entretien/jetonDeux"),
];
const registres = (role: Parameters<typeof piecesOuvertes>[0]) =>
  piecesOuvertes(role, DOSSIER).map((p) => p.registre);

async function main() {
  console.log("Ce qui entre dans le fichier, selon le rôle");

  await cas("le patron emporte tout, dans l'ordre des onglets", () => {
    assert.deepEqual(registres("proprietaire"), ["devis", "factures", "fiches", "fiches", "avoirs"]);
  });

  await cas("un commercial n'emporte ni facture ni avoir (il ne les ouvre pas une à une)", () => {
    assert.deepEqual(registres("commercial"), ["devis", "fiches", "fiches"]);
  });

  await cas("la facturation n'emporte que ce que ses portes ouvrent", () => {
    // Elle ouvre devis, factures et rapports ; `/api/avoirs` ne lui est pas
    // ouvert aujourd'hui (`acces-roles.ts`). Le fichier suit la porte.
    assert.deepEqual(registres("facturation"), ["devis", "factures", "fiches", "fiches"]);
  });

  await cas("un salarié n'emporte rien", () => {
    assert.deepEqual(registres("salarie"), []);
  });

  console.log("\nLes chemins dans le fichier");

  await cas("chaque pièce va dans le dossier de son onglet, sous son nom de téléchargement", () => {
    const chemins = cheminsDuDossier(piecesOuvertes("proprietaire", DOSSIER));
    assert.deepEqual(chemins, [
      "Devis/devis-2026-0031.pdf",
      "Factures/facture-2026-0009.pdf",
      "Fiches/fiche-chantier-2026-07-04.pdf",
      "Fiches/fiche-chantier-2026-07-04 (2).pdf",
      "Avoirs/avoir-2026-0002.pdf",
    ]);
  });

  await cas("le nom du fichier : le client et le jour, sans caractère que Windows refuse", () => {
    assert.equal(nomDuDossierClient("Dupont / Martin", "2026-10-22"), "Dupont Martin, 22 octobre 2026.zip");
    assert.equal(nomDuDossierClient("  ", "2026-10-01"), "Client, 1er octobre 2026.zip");
  });

  console.log("\nLe compte rendu d'entretien en PDF");

  const rapport: RapportPublic = {
    jour: "2026-07-04",
    minutes: 95,
    observations: "Haie basse à reprendre au printemps.",
    clientNom: "M. Bernard",
    entrepriseNom: "Eden Nature",
    faites: [
      { famille: "Tonte", libelle: "Tonte de la pelouse" },
      { famille: "Taille", libelle: "Taille de la haie" },
      { famille: "Tonte", libelle: "Ramassage de l'herbe" },
    ],
  };

  await cas("il porte ce qui a été fait, le temps, les observations, et aucun montant", async () => {
    const { trace } = await composerRapportEntretienPdf({ rapport, entrepriseIban: "FR76 0000 0000 0000" });
    const texte = trace.textes.map((t) => t.contenu).join(" ");
    for (const attendu of [
      "RETOUR D'INTERVENTION",
      "Tonte de la pelouse",
      "Ramassage de l'herbe",
      "Taille de la haie",
      "Haie basse à reprendre au printemps.",
      "04/07/2026",
      "Eden Nature",
      "M. Bernard",
    ]) {
      assert.ok(texte.includes(attendu), `absent du PDF : « ${attendu} »`);
    }
    assert.ok(/1\s*h\s*35/.test(texte), `le temps passé manque : ${texte.slice(0, 200)}`);
    assert.ok(!texte.includes("€"), "un montant est imprimé sur un compte rendu");
    assert.ok(!texte.includes("FR76"), "un IBAN est imprimé sur un compte rendu");
  });

  await cas("un temps masqué ne s'imprime pas", async () => {
    const { trace } = await composerRapportEntretienPdf({ rapport: { ...rapport, minutes: null } });
    const texte = trace.textes.map((t) => t.contenu).join(" ");
    assert.ok(!texte.includes("TEMPS PASSÉ"), "le bloc du temps paraît alors que le temps est masqué");
  });

  if (echecs.length > 0) {
    console.log(`\n✗ ${echecs.length} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ Le dossier d'un client ne donne que ce que chacun ouvre déjà.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
