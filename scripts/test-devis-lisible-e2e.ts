import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { lancerNavigateur } from "./e2e-browser";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";

/**
 * UN DEVIS PROTÉGÉ DOIT QUAND MÊME S'OUVRIR — ET C'EST TOUT L'ENJEU.
 *
 * Depuis le 31 août 2026, le devis part chiffré pour qu'Acrobat n'y laisse plus
 * retoucher un montant (`src/server/pdf/proteger-pdf.ts`). Le danger est
 * évident et il est pire que le défaut corrigé : un fichier mal chiffré ne
 * s'ouvre **nulle part**, et le client ne voit plus son devis du tout.
 *
 * **Un contrôle qui vérifierait le chiffrement avec le code qui l'a produit ne
 * prouverait rien** : les deux se tromperaient de la même façon. On demande
 * donc à un lecteur qui ne sait rien d'Atlas — le moteur PDF de Chromium — de
 * l'ouvrir, sans mot de passe, et de le dessiner.
 *
 * **Comment on sait qu'il l'a dessiné, sans savoir lire une image.** Le même
 * devis, dont on a faussé UN chiffre de la clé, sert de plancher : ce
 * fichier-là, aucun lecteur ne l'ouvre. Deux captures identiques, ou de même
 * poids, voudraient dire que le bon devis n'a rien affiché non plus.
 */

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-000008",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-31",
  validiteJours: 30,
  entrepriseNom: "Atlas",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  clientNom: "Huguette Groupiron",
  clientCivilite: "mme",
  adresseChantier: "Rue du Tourigou 29950 Bénodet",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "550.00",
  totalTva: "110.00",
  totalTtc: "660.00",
  lignes: [
    { libelle: "Taille de haies 40 ml", quantite: "1", prixUnitaire: "200.00", montant: "200.00" },
    { libelle: "Taille des graminées", quantite: "1", prixUnitaire: "200.00", montant: "200.00" },
    { libelle: "Menus travaux", quantite: "1", prixUnitaire: "150.00", montant: "150.00" },
  ],
};

/**
 * Le même fichier, dont un seul chiffre de la clé d'ouverture est faux.
 *
 * C'est le plancher de la mesure : un lecteur qui refuse celui-ci et dessine
 * l'autre prouve qu'il a bien déchiffré l'autre.
 */
function clefFaussee(octets: Uint8Array): Uint8Array {
  const copie = Buffer.from(octets);
  const debut = copie.indexOf("/U <");
  assert.ok(debut > 0, "aucune clé /U dans le devis : la protection n'est pas posée");
  const chiffre = debut + 4;
  copie[chiffre] = copie[chiffre] === 0x30 /* « 0 » */ ? 0x31 : 0x30;
  return new Uint8Array(copie);
}

async function main() {
  console.log("=== Un devis protégé s'ouvre quand même ===\n");
  const { pdf } = await composerDevisPdf(DEVIS);

  // Même nom de fichier des deux côtés : la barre du lecteur l'affiche, et deux
  // noms différents suffiraient à rendre les captures différentes — la mesure
  // dirait alors « il a dessiné » sans que rien n'ait été dessiné.
  const racine = path.join(tmpdir(), `devis-lisible-${Date.now()}`);
  const chemins: Record<string, string> = {};
  for (const [cas, octets] of [
    ["bon", pdf],
    ["faussé", clefFaussee(pdf)],
  ] as const) {
    const dossier = path.join(racine, cas === "bon" ? "a" : "b");
    mkdirSync(dossier, { recursive: true });
    chemins[cas] = path.join(dossier, "devis.pdf");
    writeFileSync(chemins[cas], octets);
  }

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 900, height: 1200 } });
  const captures: Record<string, Buffer> = {};
  try {
    for (const cas of ["bon", "faussé"]) {
      const page = await contexte.newPage();
      await page.goto("file://" + chemins[cas]);
      // Le lecteur de Chromium décode, déchiffre puis peint : c'est la seule
      // étape de cette suite qui demande vraiment du temps.
      await page.waitForTimeout(6000);
      captures[cas] = await page.screenshot();
      await page.close();
    }
  } finally {
    await navigateur.close();
  }

  console.log(`  (captures : bon ${captures["bon"].byteLength} o, faussé ${captures["faussé"].byteLength} o)`);

  let echecs = 0;
  const verifier = (nom: string, condition: boolean, detail: string) => {
    if (condition) console.log(`  ✓ ${nom}`);
    else {
      console.error(`  ✗ ${nom}\n    ${detail}`);
      echecs++;
    }
  };

  verifier(
    "le lecteur ne dessine rien du devis dont la clé est fausse",
    captures["faussé"].byteLength < captures["bon"].byteLength,
    `capture faussée ${captures["faussé"].byteLength} o, bonne ${captures["bon"].byteLength} o`
  );
  // Une page couverte de texte pèse, comprimée, plusieurs fois une page vide.
  // Le rapport est large exprès : il ne s'agit pas de mesurer une mise en page,
  // seulement de distinguer « quelque chose » de « rien ».
  verifier(
    "le devis protégé s'ouvre sans mot de passe et s'affiche",
    captures["bon"].byteLength > 2 * captures["faussé"].byteLength,
    `la capture du devis (${captures["bon"].byteLength} o) ne porte pas plus d'encre ` +
      `que celle d'un fichier illisible (${captures["faussé"].byteLength} o)`
  );

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
