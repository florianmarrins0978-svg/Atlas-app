// Aucune image d'utilisateur n'est rangée ni envoyée sans être nettoyée.
//
// ─────────────────────────────────────────────────────────────────────────────
// **LA PROPRIÉTÉ QUE CETTE SUITE TIENT, et c'est la seule qui compte :**
//
//   Une image d'utilisateur n'est JAMAIS rangée ni envoyée à un fournisseur
//   d'IA tant qu'Atlas n'en détient pas une version dont il peut garantir le
//   nettoyage.
//
// **Elle la tient de DEUX façons, et il faut les deux.**
//
//   1. sur la porte elle-même (`preparerPhotoEntrante`) : on lui donne de vraies
//      images avec un témoin de métadonnée, et des fichiers maquillés ;
//   2. sur TOUS LES CHEMINS, par une lecture du code : aucun d'eux ne doit
//      pouvoir ranger ou envoyer autre chose que ce que la porte a rendu.
//
// La seconde moitié est celle qui manquait au lot 2. Une porte irréprochable ne
// prouve rien si un écran continue de faire sa cuisine à côté — et c'est
// exactement ce qui s'était produit : le diagnostic végétal faisait bien, les
// trois autres non.
//
// Ni base, ni réseau, ni navigateur.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GPS_TEMOIN, contient, jpegAvecExif, pngAvecExif, webpAvecExif } from "./_images-temoins";
import { preparerPhotoEntrante } from "../src/server/photo-entrante";
import { MESSAGE_HEIC_REFUSE, TYPES_PHOTO_ACCEPTES } from "../src/lib/exif";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

function fichierDe(octets: Uint8Array, type: string, nom = "photo"): File {
  return new File([new Uint8Array(octets)], nom, { type });
}

const RACINE = path.join(__dirname, "..");
/**
 * Le code d'un fichier, ses commentaires retirés.
 *
 * **L'ordre est tout, et le premier jet s'est trompé deux fois de suite.**
 *
 *   1. les lignes `//` D'ABORD — une chaîne qu'on cherche peut contenir `/*`
 *      (c'est le cas de `image/*`), et retirer les blocs en premier ouvrirait
 *      un faux commentaire sur la ligne qui la cite ;
 *   2. **surtout PAS les lignes qui commencent par `*`** : ce sont les lignes
 *      INTÉRIEURES d'un bloc `/** … *\/`, et les retirer emporte le `*\/` de
 *      fermeture. Le bloc n'a alors plus de fin, la regex court jusqu'au
 *      suivant, et avale le vrai code entre les deux. C'est ce qui faisait
 *      rougir ce contrôle sur un fichier parfaitement juste.
 *
 * Les lignes intérieures partent de toute façon avec leur bloc, à l'étape 3.
 */
function codeSeul(chemin: string): string {
  return readFileSync(path.join(RACINE, chemin), "utf-8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Les cinq chemins d'image d'utilisateur, recensés le 24 août 2026. */
const CHEMINS_IMAGE = [
  { quoi: "photos de chantier", fichier: "src/app/chantiers/[id]/photos-actions.ts" },
  { quoi: "tickets de TVA", fichier: "src/app/termines/tva/actions.ts" },
  { quoi: "diagnostic végétal", fichier: "src/app/paysage/diagnostic/actions.ts" },
  { quoi: "croquis d'arrosage", fichier: "src/app/paysage/arrosage/actions.ts" },
  { quoi: "logo d'entreprise", fichier: "src/app/reglages/documents/actions.ts" },
];

async function main() {
  console.log("=== La porte des images : ce qui entre, et ce qui est refusé ===\n");

  // ─── LES TROIS FORMATS NETTOYABLES PASSENT ────────────────────────────────

  await essai("un JPEG valide est accepté, et sa métadonnée a DISPARU", async () => {
    const r = await preparerPhotoEntrante(fichierDe(jpegAvecExif(), "image/jpeg"), "essai");
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);
    if (!r.ok) return;
    assert.ok(
      !contient(r.photo.octets, GPS_TEMOIN),
      "les coordonnées GPS sont encore dans les octets rendus"
    );
    assert.equal(r.photo.extension, ".jpg");
    assert.equal(r.photo.mimeType, "image/jpeg");
  });

  await essai("un PNG valide est accepté, et sa métadonnée a DISPARU", async () => {
    const r = await preparerPhotoEntrante(fichierDe(pngAvecExif(), "image/png"), "essai");
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(!contient(r.photo.octets, GPS_TEMOIN), "le témoin GPS survit dans le PNG");
    assert.equal(r.photo.extension, ".png");
  });

  await essai("un WebP valide est accepté, et sa métadonnée a DISPARU", async () => {
    const r = await preparerPhotoEntrante(fichierDe(webpAvecExif(), "image/webp"), "essai");
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(!contient(r.photo.octets, GPS_TEMOIN), "le témoin GPS survit dans le WebP");
    assert.equal(r.photo.extension, ".webp");
  });

  await essai("le paramètre du type et la casse ne gênent pas", async () => {
    const r = await preparerPhotoEntrante(fichierDe(jpegAvecExif(), "IMAGE/JPEG;charset=binary"), "essai");
    assert.ok(r.ok, "un type parfaitement valable a été refusé sur sa forme");
  });

  // ─── LE NETTOYAGE EN ÉCHEC : RIEN NE SORT ─────────────────────────────────

  await essai("NETTOYAGE IMPOSSIBLE → REFUS, et aucun octet rendu", async () => {
    /**
     * **Le cœur du resserrement du 24 août.** La version d'avant rendait
     * `{ nettoye: false }` et l'appelant rangeait l'original — donc les
     * métadonnées. Ici, rien ne sort : il n'y a pas d'octets à ranger.
     */
    const maquille = new Uint8Array([...new TextEncoder().encode(`<svg>${GPS_TEMOIN}</svg>`)]);
    const r = await preparerPhotoEntrante(fichierDe(maquille, "image/jpeg"), "essai");
    assert.equal(r.ok, false, "un fichier maquillé en JPEG a été accepté");
    if (r.ok) return;
    assert.ok(r.raison.length > 20, "le refus ne dit pas quoi faire");
  });

  await essai("un fichier TRONQUÉ ne fait fuir aucune métadonnée", async () => {
    /**
     * **Ce cas a d'abord été écrit trop strict, et l'assertion était fausse.**
     * Elle exigeait un refus. Or un JPEG coupé se nettoie très bien : le
     * lecteur parcourt ce qu'il a, retire ce qu'il trouve, et s'arrête. Il rend
     * `nettoye: true`, ce qui est exact.
     *
     * **La propriété à tenir n'est pas « refuser les fichiers abîmés »** — ce
     * serait refuser des photos d'artisans dont l'envoi a été coupé — mais
     * « aucune métadonnée ne sort ». On éprouve donc celle-là, à toutes les
     * troncatures, y compris au milieu d'un bloc EXIF.
     */
    const entier = jpegAvecExif();
    for (const n of [6, 10, 14, 20, entier.length - 3]) {
      const r = await preparerPhotoEntrante(fichierDe(entier.subarray(0, n), "image/jpeg"), "essai");
      if (!r.ok) continue; // refuser reste acceptable ; laisser fuir, non
      assert.ok(
        !contient(r.photo.octets, GPS_TEMOIN),
        `tronqué à ${n} octets, le témoin GPS ressort`
      );
    }
  });

  await essai("un PNG annoncé qui n'en est pas est refusé", async () => {
    const r = await preparerPhotoEntrante(fichierDe(jpegAvecExif(), "image/png"), "essai");
    assert.equal(r.ok, false, "un JPEG annoncé PNG est passé — le contenu n'est pas vérifié");
  });

  // ─── LE HEIC : refusé, et le refus donne le geste ─────────────────────────

  await essai("HEIC ET HEIF BRUTS SONT REFUSÉS — solution B, assumée", async () => {
    // Un vrai en-tête HEIC : `ftypheic` au douzième octet.
    const heic = new Uint8Array([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
      ...new TextEncoder().encode(GPS_TEMOIN),
    ]);
    for (const type of ["image/heic", "image/heif", "image/HEIC", "image/heic-sequence"]) {
      const r = await preparerPhotoEntrante(fichierDe(heic, type), "essai");
      assert.equal(r.ok, false, `« ${type} » est passé`);
    }
  });

  await essai("le refus d'un HEIC DIT LE GESTE, pas seulement le verdict", async () => {
    // « format non pris en charge » laisse un artisan sans rien à faire : c'est
    // son téléphone qui choisit le format, et il ne sait pas que ça se règle.
    const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const r = await preparerPhotoEntrante(fichierDe(heic, "image/heic"), "essai");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.raison, MESSAGE_HEIC_REFUSE);
    assert.match(r.raison, /Réglages/i, "le refus ne dit pas OÙ régler le problème");
    assert.match(r.raison, /compatible/i, "le refus ne nomme pas le réglage");
  });

  await essai("la liste serveur ne contient QUE ce qu'on sait nettoyer", () => {
    // C'est la définition tenable de cette liste, et la seule. Y remettre le
    // HEIC rouvrirait le trou que ce lot referme.
    assert.deepEqual([...TYPES_PHOTO_ACCEPTES], ["image/jpeg", "image/png", "image/webp"]);
  });

  // ─── LE SVG, toujours fermé ───────────────────────────────────────────────

  await essai("le SVG reste refusé, par son type comme par son contenu", async () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>");
    assert.equal((await preparerPhotoEntrante(fichierDe(svg, "image/svg+xml"), "essai")).ok, false);
    assert.equal((await preparerPhotoEntrante(fichierDe(svg, "image/webp"), "essai")).ok, false);
  });

  // ─── LA MOITIÉ QUI MANQUAIT : tous les chemins, sans exception ────────────

  await essai("LES CINQ CHEMINS passent par la porte commune", async () => {
    for (const { quoi, fichier } of CHEMINS_IMAGE) {
      assert.match(
        codeSeul(fichier),
        /preparerPhotoEntrante\(/,
        `${quoi} (${fichier}) n'emploie pas preparerPhotoEntrante`
      );
    }
  });

  await essai("AUCUN CHEMIN NE FAIT SA PROPRE CUISINE — plus de seconde rédaction", async () => {
    /**
     * **C'est ce contrôle qui empêche la divergence de revenir.** Avant ce lot,
     * quatre écrans appelaient `retirerMetadonnees` chacun de son côté, et trois
     * concluaient par « on range quand même ». Une porte irréprochable ne prouve
     * rien tant qu'un écran peut la contourner.
     */
    for (const { quoi, fichier } of CHEMINS_IMAGE) {
      const code = codeSeul(fichier);
      assert.ok(
        !/retirerMetadonnees\(/.test(code),
        `${quoi} nettoie encore lui-même — deux rédactions finiront par diverger`
      );
      assert.ok(
        !/photoAcceptee\(/.test(code),
        `${quoi} refait la liste blanche lui-même`
      );
    }
  });

  await essai("AUCUN CHEMIN NE RANGE NI N'ENVOIE AUTRE CHOSE QUE LE RÉSULTAT DE LA PORTE", async () => {
    /**
     * La preuve structurelle demandée : ce qui part au stockage ou au
     * fournisseur d'IA doit venir de `prete.photo`, jamais d'un `arrayBuffer()`
     * lu à côté.
     *
     * **On cherche `arrayBuffer` dans les chemins d'image** : la porte est la
     * seule qui ait le droit de lire les octets bruts d'une image.
     */
    for (const { quoi, fichier } of CHEMINS_IMAGE) {
      const code = codeSeul(fichier);
      assert.ok(
        !/\.arrayBuffer\(\)/.test(code),
        `${quoi} lit encore les octets bruts lui-même — l'original peut repartir de là`
      );
    }
  });

  await essai("le croquis GARDE sa borne plus serrée — 8 Mo, pas 15", async () => {
    // Elle ne protège pas la mémoire : elle borne une facture de vision.
    // Passer par la porte commune ne doit pas la perdre en silence.
    const code = codeSeul("src/app/paysage/arrosage/actions.ts");
    assert.match(code, /8 \* 1024 \* 1024/, "la borne à 8 Mo du croquis a disparu");
  });

  console.log("");
  console.log(`Porte des images — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main();
