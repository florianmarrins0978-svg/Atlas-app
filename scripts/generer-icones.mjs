import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Fabrique les icônes de l'application depuis public/icone-source.svg.
//
// Elles ne sont PAS dessinées à la main : un jeu d'icônes retouché tailles par
// tailles finit toujours par diverger, et c'est l'icône la moins regardée qui
// se retrouve fausse. Une seule source, régénérée d'un trait.
//
//   npm run icones
//
// Changer le logo : remplacer public/icone-source.svg, relancer la commande.

const SOURCE = "public/icone-source.svg";
const DOSSIER = "public/icones";

/**
 * Les tailles attendues, et par qui.
 *
 * `maskable` est celle qu'Android recadre en cercle, en goutte ou en carré
 * selon le téléphone : elle a besoin d'une marge, sinon le dessin est rogné.
 * D'où le fond étendu et le motif réduit à 60 % — ce n'est pas un doublon.
 */
const CIBLES = [
  { nom: "icone-192.png", taille: 192, marge: 0 },
  { nom: "icone-512.png", taille: 512, marge: 0 },
  { nom: "icone-maskable-512.png", taille: 512, marge: 0.2 },
  // iOS ignore le manifeste et lit ce fichier-ci, à cette taille exacte.
  { nom: "apple-touch-icon.png", taille: 180, marge: 0 },
];

const FOND = "#F6F1E6";

const svg = await readFile(SOURCE);
await mkdir(DOSSIER, { recursive: true });

for (const { nom, taille, marge } of CIBLES) {
  const motif = Math.round(taille * (1 - marge * 2));
  const bord = Math.round((taille - motif) / 2);

  const rendu = await sharp(svg, { density: 384 }).resize(motif, motif).png().toBuffer();

  await sharp({
    create: {
      width: taille,
      height: taille,
      channels: 4,
      background: FOND,
    },
  })
    .composite([{ input: rendu, top: bord, left: bord }])
    .png()
    .toFile(`${DOSSIER}/${nom}`);

  console.log(`✅ ${DOSSIER}/${nom} — ${taille}×${taille}`);
}

// Le manifeste décrit l'application au téléphone : sans lui, « Ajouter à
// l'écran d'accueil » produit un raccourci de navigateur, pas une application.
const manifeste = {
  name: "Atlas",
  short_name: "Atlas",
  description: "Dictée de chantier, vérification et préparation de devis pour artisans.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  lang: "fr",
  background_color: "#F6F1E6",
  theme_color: "#F6F1E6",
  icons: [
    { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

await writeFile("public/manifest.json", JSON.stringify(manifeste, null, 2) + "\n");
console.log("✅ public/manifest.json");
