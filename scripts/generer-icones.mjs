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
 * **Plus d'icône à marge pour Android** (18 novembre 2026). Android découpe
 * l'icône en rond, en goutte ou en carré selon le téléphone ; l'ancienne
 * version lui fabriquait une copie au motif réduit à 60 %, posé sur un crème
 * écrit ici en dur. C'est désormais la SOURCE qui garde son dessin dans le
 * cercle central de 80 % (son en-tête le dit) : réduire encore rapetissait le
 * C de moitié, et le crème en dur aurait cerné de crème tout fond d'une autre
 * couleur. La même image de 512 sert donc aux deux usages du manifeste.
 */
const CIBLES = [
  { nom: "icone-192.png", taille: 192 },
  { nom: "icone-512.png", taille: 512 },
  // iOS ignore le manifeste et lit ce fichier-ci, à cette taille exacte.
  { nom: "apple-touch-icon.png", taille: 180 },
];

const svg = await readFile(SOURCE);
await mkdir(DOSSIER, { recursive: true });

const rendre = (taille) => sharp(svg, { density: 384 }).resize(taille, taille).png();

for (const { nom, taille } of CIBLES) {
  await rendre(taille).toFile(`${DOSSIER}/${nom}`);
  console.log(`✅ ${DOSSIER}/${nom} — ${taille}×${taille}`);
}

/**
 * L'icône de l'onglet du navigateur. Next.js sert `src/app/favicon.ico` à
 * toute page : tant qu'il n'était pas fabriqué ici, c'était le triangle par
 * défaut de Next.js qui s'affichait dans l'onglet, et aucune icône ne le
 * remplaçait. Un .ico n'est qu'un sommaire suivi d'images PNG : sharp ne sait
 * pas l'écrire, ces quelques lignes si.
 *
 * **Cadrée plus serré que les autres** : à 16 pixels, la marge qu'Android
 * réclame laissait au C huit pixels de haut, un trait gris illisible. L'onglet
 * ne découpe rien ; il prend le carré central (320 sur 512), où tient tout le
 * dessin, point d'or compris.
 */
const TAILLES_ONGLET = [16, 32, 48];
const CENTRE = { left: 96, top: 96, width: 320, height: 320 };
const images = await Promise.all(
  TAILLES_ONGLET.map(async (t) => sharp(await rendre(512).extract(CENTRE).toBuffer()).resize(t, t).png().toBuffer()),
);
const entete = Buffer.alloc(6);
entete.writeUInt16LE(0, 0); // réservé
entete.writeUInt16LE(1, 2); // 1 = icône
entete.writeUInt16LE(images.length, 4);
let decalage = 6 + 16 * images.length;
const sommaire = images.map((png, i) => {
  const ligne = Buffer.alloc(16);
  ligne.writeUInt8(TAILLES_ONGLET[i], 0); // largeur
  ligne.writeUInt8(TAILLES_ONGLET[i], 1); // hauteur
  ligne.writeUInt16LE(1, 4); // plans de couleur
  ligne.writeUInt16LE(32, 6); // bits par pixel
  ligne.writeUInt32LE(png.length, 8);
  ligne.writeUInt32LE(decalage, 12);
  decalage += png.length;
  return ligne;
});
await writeFile("src/app/favicon.ico", Buffer.concat([entete, ...sommaire, ...images]));
console.log(`✅ src/app/favicon.ico — ${TAILLES_ONGLET.join(", ")}`);

// Le manifeste décrit l'application au téléphone : sans lui, « Ajouter à
// l'écran d'accueil » produit un raccourci de navigateur, pas une application.
const manifeste = {
  name: "Cause",
  short_name: "Cause",
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
    { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

await writeFile("public/manifest.json", JSON.stringify(manifeste, null, 2) + "\n");
console.log("✅ public/manifest.json");
