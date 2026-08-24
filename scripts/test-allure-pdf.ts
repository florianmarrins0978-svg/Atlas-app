import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { ALLURE_PAR_DEFAUT, encreSurFond, type Allure } from "../src/lib/allure-documents";

/**
 * L'ALLURE, SUR LE DOCUMENT LUI-MÊME.
 *
 * *Sa demande du 23 août 2026, et ses deux bornes : « juste pour devis
 * facture », et « les réglages actuels doivent être par défaut ».*
 *
 * **Ce que cette suite empêche, et qu'aucun typage ne voit :**
 *
 *   1. **un document d'avant qui changerait tout seul.** Le réglage est neuf ;
 *      l'artisan qui n'y a jamais touché doit recevoir exactement le devis
 *      d'hier, au pixel près ;
 *   2. **la feuille de chantier habillée.** Elle sort de la même fabrique que
 *      le devis, par `sansChiffrage` : sans filtre, elle prendrait la marque et
 *      les couleurs qu'il a réglées pour ce que le client garde ;
 *   3. **un logo qui mange les références.** Le numéro du devis et sa date
 *      occupent la même bande : un logo un peu large les rendrait illisibles ;
 *   4. **un document illisible.** Un fond sombre avec l'encre d'avant, ça ne
 *      se voit qu'à l'impression, chez le client.
 */

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0012",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-24",
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: null,
  clientNom: "Mme Éléonore Chäteauneuf",
  clientAdresse: "3 allée des Œillets, 78711 Mantes-la-Ville",
  clientTelephone: null,
  adresseChantier: "3 allée des Œillets, 78711 Mantes-la-Ville",
  conditionsPaiement: null,
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "792.00",
  totalTva: "79.20",
  totalTtc: "871.20",
  lignes: [
    { libelle: "Taille de haie — 42 ml", quantite: "42", prixUnitaire: "9.50", montant: "399.00" },
    { libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "393.00", montant: "393.00" },
  ],
};

const FACTURE: FacturePdfData = {
  ...DEVIS,
  numeroCommercial: "F2026-0008",
  dateEcheance: "2026-09-23",
} as unknown as FacturePdfData;

const SOMBRE: Allure = { typographie: "eb-garamond", fond: "#1c2b1c", accent: "#d8c48a" };

/** Un PNG rouge de 40 × 20, écrit à la main : aucun fichier à embarquer. */
function pngRouge(largeur = 40, hauteur = 20): Uint8Array {
  const morceau = (nom: string, corps: Buffer) => {
    const entete = Buffer.alloc(8);
    entete.writeUInt32BE(corps.length, 0);
    entete.write(nom, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(nom, "ascii"), corps])), 0);
    return Buffer.concat([entete, corps, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par composante
  ihdr[9] = 2; // couleur vraie, sans canal alpha
  const brut = Buffer.concat(
    Array.from({ length: hauteur }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: largeur * 3 }, (_, i) => (i % 3 === 0 ? 200 : 30)))])
    )
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", ihdr),
    morceau("IDAT", deflateSync(brut)),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(donnees: Buffer): number {
  let c = 0xffffffff;
  for (const octet of donnees) {
    c ^= octet;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== L'allure sur le devis et la facture ===\n");

  await essai("sans réglage, le devis est EXACTEMENT celui d'avant", async () => {
    // **Le contrôle le plus important de cette suite.** Le réglage est neuf :
    // aucun artisan ne doit voir son devis changer parce qu'un écran est
    // apparu quelque part. On compare octet pour octet, pas à l'œil.
    const avant = await composerDevisPdf(DEVIS);
    const rien = await composerDevisPdf(DEVIS, { allure: null, logo: null });
    const empreinte = (o: Uint8Array) => createHash("sha256").update(o).digest("hex");
    assert.equal(empreinte(avant.pdf), empreinte(rien.pdf), "le devis sans réglage a changé");
    assert.equal(avant.trace.fonds[0].couleur, ALLURE_PAR_DEFAUT.fond);
    assert.equal(avant.trace.logos.length, 0);
  });

  await essai("le fond réglé est celui qui se peint, sur toutes les pages", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { allure: SOMBRE });
    assert.ok(trace.fonds.length >= 1);
    for (const f of trace.fonds) {
      // **La trace a déjà menti ici.** Elle recopiait la palette d'origine
      // pendant que la page se peignait en vert : un contrôle d'apparence y
      // aurait lu le crème sur un document sombre.
      assert.equal(f.couleur, SOMBRE.fond, `page ${f.page} peinte en ${f.couleur}`);
    }
  });

  await essai("sur un fond sombre, l'encre s'éclaircit — sinon le devis est illisible", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { allure: SOMBRE });
    const { encre } = encreSurFond(SOMBRE.fond);
    const nom = trace.textes.find((t) => t.contenu === DEVIS.entrepriseNom);
    assert.ok(nom, "le nom de l'entreprise n'est pas sur le document");
    assert.equal(nom.couleur, encre, `le nom est écrit en ${nom.couleur} sur ${SOMBRE.fond}`);
    // Et aucun texte ne doit rester sur l'encre d'avant : un seul intitulé noir
    // sur un fond nuit, et c'est une ligne du devis qu'on ne lit pas.
    const restes = trace.textes.filter((t) => t.couleur === "#141414" || t.couleur === "#1c1c1a");
    assert.deepEqual(restes.map((t) => t.contenu), [], "des textes gardent l'encre du fond clair");
  });

  await essai("l'accent tient les intitulés de parties", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { allure: SOMBRE });
    const emetteur = trace.textes.find((t) => t.contenu.startsWith("É") && t.contenu.includes("M"));
    assert.ok(emetteur, "« ÉMETTEUR » n'est pas sur le devis");
    assert.equal(emetteur.couleur, SOMBRE.accent);
  });

  await essai("LA FEUILLE DE CHANTIER N'EST PAS HABILLÉE — sa décision du 23 août", async () => {
    // *« Juste pour devis facture. »* Elle sort de la même fabrique, par
    // `sansChiffrage` : sans le filtre, elle porterait la marque et les
    // couleurs réservées à ce que le client garde.
    const { trace } = await composerDevisPdf(DEVIS, {
      sansChiffrage: true,
      allure: SOMBRE,
      logo: { octets: pngRouge(), mime: "image/png" },
    });
    assert.equal(trace.fonds[0].couleur, ALLURE_PAR_DEFAUT.fond, "la feuille a pris le fond réglé");
    assert.equal(trace.logos.length, 0, "la feuille de chantier porte le logo");
  });

  await essai("la facture, elle, est habillée : le client la garde", async () => {
    const { trace } = await composerFacturePdf(FACTURE, {
      allure: SOMBRE,
      logo: { octets: pngRouge(), mime: "image/png" },
    });
    assert.equal(trace.fonds[0].couleur, SOMBRE.fond);
    assert.equal(trace.logos.length, 1, "la facture n'a pas de logo");
  });

  await essai("le logo se pose en haut à gauche, sans toucher les références", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { logo: { octets: pngRouge(1200, 100), mime: "image/png" } });
    assert.equal(trace.logos.length, 1);
    const l = trace.logos[0];
    // Les références — numéro, date, validité — commencent à `DROITE - 175`,
    // soit 389 points. Un logo qui les atteint rend le numéro du devis illisible.
    assert.ok(l.x + l.largeur <= 389, `le logo va jusqu'à ${Math.round(l.x + l.largeur)}, sur les références`);
    assert.ok(l.y + l.hauteur <= 841.89 - 31.2 + 0.01, "le logo dépasse en haut de page");

    // Et le nom de l'entreprise DESCEND sous lui : posé sans descendre, il
    // s'imprimerait par-dessus l'image.
    const nom = trace.textes.find((t) => t.contenu === DEVIS.entrepriseNom);
    assert.ok(nom, "le nom n'est pas sur le devis");
    assert.ok(nom.y + 22 <= l.y + 0.01, `le nom (y=${Math.round(nom.y)}) chevauche le logo (y=${Math.round(l.y)})`);

    // Les références, elles, ne bougent PAS : elles ont leur propre colonne.
    const sansLogo = await composerDevisPdf(DEVIS);
    const yRef = (textes: { contenu: string; y: number }[]) =>
      textes.find((x) => x.contenu === "Devis n°")?.y;
    assert.equal(
      yRef(trace.textes),
      yRef(sansLogo.trace.textes),
      "les références ont suivi le logo alors qu'elles ont leur propre colonne"
    );
  });

  await essai("une image illisible ne prive pas le client de son devis", async () => {
    // Un fichier renommé en `.png`, un JPEG que `pdf-lib` ne sait pas lire : le
    // document doit sortir sans logo. Lever ici priverait son client du devis
    // pour une question d'apparence.
    const { pdf, trace } = await composerDevisPdf(DEVIS, {
      logo: { octets: Buffer.from("ceci n'est pas une image"), mime: "image/png" },
    });
    assert.ok(pdf.length > 1000, "le devis ne s'est pas composé");
    assert.equal(trace.logos.length, 0);
  });

  await essai("une couleur de fond aberrante ne casse pas le devis", async () => {
    const { trace } = await composerDevisPdf(DEVIS, {
      allure: { typographie: "playfair", fond: "bleu roi", accent: "" } as Allure,
    });
    // Elle retombe sur le défaut plutôt que d'empêcher le document de sortir.
    assert.equal(trace.fonds[0].couleur, ALLURE_PAR_DEFAUT.fond);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
