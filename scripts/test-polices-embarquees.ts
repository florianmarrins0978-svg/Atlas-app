import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TYPOGRAPHIES } from "../src/lib/allure-documents";
import { genererPdfFacture, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { annoncerLaLongueurDesPolices } from "../src/server/pdf/polices-embarquees";

/**
 * UN DOCUMENT DOIT DIRE LA LONGUEUR DES POLICES QU'IL EMBARQUE.
 *
 * **Sa capture du 11 septembre 2026, la troisième d'affilée :** *« lorsque je
 * télécharge la facture je ne peux toujours pas la lire »* — page blanche,
 * aucun message.
 *
 * Le fichier n'avait rien de cassé pour un lecteur tolérant : `pypdf`, `qpdf`
 * et PDFium le peignaient entier. Il lui manquait `/Length1` sur le programme
 * TrueType — une entrée que la norme exige (ISO 32000-1, tableau 127) et que
 * `pdf-lib` n'écrit jamais. Un lecteur strict refuse alors la police, et comme
 * tout le texte l'emploie, il ne reste que la page.
 *
 * **Ce que cette suite prouve**, et c'est mesurable ici : l'entrée est posée
 * sur chacune des neuf typographies, et sa valeur est EXACTEMENT la taille du
 * fichier de police — pas un ordre de grandeur.
 *
 * **Ce qu'elle ne prouve pas :** qu'un iPhone la réclame. Ce poste n'a aucun
 * moteur Apple ; la déduction est écrite dans `polices-embarquees.ts`, et c'est
 * au patron de la trancher, deux documents sous les yeux.
 */

const DOSSIER_POLICES = path.join(__dirname, "..", "src", "server", "pdf", "polices");

const FACTURE: FacturePdfData = {
  numeroCommercial: "F2026-000007",
  statut: "emise",
  dateEmission: "2026-09-11",
  entrepriseNom: "Atlas",
  clientNom: "Huguette Groupiron",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "550.00",
  totalTva: "110.00",
  totalTtc: "660.00",
  lignes: [{ libelle: "Taille de haies 40 ml", quantite: "1", prixUnitaire: "550.00", montant: "550.00" }],
};

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

/**
 * Les programmes de police d'un document, avec ce qu'ils annoncent.
 *
 * Relu **sans rien importer de la composition** : le document sort chiffré, et
 * seuls ses textes et ses flux le sont — un nombre du dictionnaire, lui, reste
 * en clair, et c'est exactement ce qu'un moteur lit avant de charger la police.
 */
async function programmesDe(octets: Uint8Array): Promise<{ nom: string; longueur: number | null }[]> {
  const doc = await PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
  const trouves: { nom: string; longueur: number | null }[] = [];
  for (const [, objet] of doc.context.enumerateIndirectObjects()) {
    if (!(objet instanceof PDFDict)) continue;
    if (objet.get(PDFName.of("Type"))?.toString() !== "/FontDescriptor") continue;
    const ref = objet.get(PDFName.of("FontFile2"));
    if (!(ref instanceof PDFRef)) continue;
    const flux = doc.context.lookup(ref);
    if (!(flux instanceof PDFRawStream)) continue;
    const longueur = flux.dict.get(PDFName.of("Length1"));
    trouves.push({
      nom: objet.get(PDFName.of("FontName"))?.toString() ?? "(sans nom)",
      longueur: longueur instanceof PDFNumber ? longueur.asNumber() : null,
    });
  }
  return trouves;
}

async function main() {
  console.log("=== Les polices embarquées annoncent la longueur de leur programme ===\n");

  const avecFichiers = TYPOGRAPHIES.filter((t) => t.fichiers);
  assert.ok(avecFichiers.length > 0, "aucune typographie embarquée : la suite ne mesurerait rien");

  for (const typo of avecFichiers) {
    await essai(`${typo.nom} : /Length1 vaut la taille du fichier de police`, async () => {
      const pdf = await genererPdfFacture(FACTURE, {
        allure: { typographie: typo.clef, fond: "#faf9f5", accent: "#b08d57" },
      });
      const programmes = await programmesDe(pdf);
      assert.equal(
        programmes.length,
        2,
        `${programmes.length} programme(s) embarqué(s) au lieu de deux (normal et gras) : ` +
          "la typographie n'est pas partie dans le document"
      );
      const attendues = [typo.fichiers!.normal, typo.fichiers!.gras].map(
        (f) => readFileSync(path.join(DOSSIER_POLICES, f)).length
      );
      for (const programme of programmes) {
        assert.notEqual(
          programme.longueur,
          null,
          `${programme.nom} n'annonce aucune longueur : un lecteur strict refusera la police, ` +
            "et le document sortira blanc"
        );
        assert.ok(
          attendues.includes(programme.longueur!),
          `${programme.nom} annonce ${programme.longueur} octets, ` +
            `alors que les fichiers en font ${attendues.join(" ou ")}`
        );
      }
    });
  }

  await essai("sans typographie réglée, il n'y a aucun programme à annoncer", async () => {
    // Le réglage par défaut du patron reste Times et Helvetica : le format les
    // porte lui-même, rien n'est embarqué, et rien ne doit être inventé.
    const programmes = await programmesDe(await genererPdfFacture(FACTURE));
    assert.equal(programmes.length, 0, "des polices sont embarquées alors qu'aucune n'est réglée");
  });

  // ─── Le contrôle sait échouer : voilà ce que `pdf-lib` rend SEUL ───────────

  await essai("sans la pose, pdf-lib n'écrit aucune longueur — c'est le défaut", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fichier = readFileSync(path.join(DOSSIER_POLICES, "inter-400.ttf"));
    const police = await doc.embedFont(fichier, { subset: false });
    doc.addPage().drawText("Facture", { font: police, size: 12 });
    await doc.flush();

    const sansPose = await programmesDe(await doc.save());
    assert.equal(sansPose.length, 1, "la police n'a pas été embarquée : l'essai ne mesure rien");
    assert.equal(
      sansPose[0].longueur,
      null,
      "pdf-lib pose désormais /Length1 lui-même : cette pièce n'a plus lieu d'être"
    );

    annoncerLaLongueurDesPolices(doc.context);
    const apresPose = await programmesDe(await doc.save());
    assert.equal(
      apresPose[0].longueur,
      fichier.length,
      "la pose n'a pas rendu la longueur du programme"
    );
  });

  await essai("un filtre qu'on ne sait pas défaire ne reçoit AUCUNE longueur", async () => {
    // Une longueur fausse est pire qu'absente : elle ferait refuser la police
    // par les lecteurs qui la lisent vraiment. On ne devine pas.
    const doc = await PDFDocument.create();
    const ctx = doc.context;
    const flux = PDFRawStream.of(
      ctx.obj({ Filter: "JPXDecode", Length: 4 }) as PDFDict,
      Uint8Array.from([1, 2, 3, 4])
    );
    const descripteur = ctx.obj({ Type: "FontDescriptor", FontName: "Essai" }) as PDFDict;
    descripteur.set(PDFName.of("FontFile2"), ctx.register(flux));
    ctx.register(descripteur);

    assert.equal(annoncerLaLongueurDesPolices(ctx), 0, "une longueur a été inventée");
    assert.equal(flux.dict.get(PDFName.of("Length1")), undefined);
  });

  console.log(`\n${reussis} réussi(s), ${echecs} échec(s)`);
  if (echecs > 0) process.exit(1);
}

main();
