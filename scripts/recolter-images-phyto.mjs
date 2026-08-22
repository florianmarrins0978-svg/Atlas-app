/**
 * Aller chercher les photos de référence déclarées par les fiches.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Pourquoi un script, et pourquoi il tourne AILLEURS.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'environnement de développement d'Atlas n'atteint aucun site extérieur (403
 * du mandataire). Une photo transmise dans une conversation ne peut pas non plus
 * être écrite sur le disque. La seule voie qui reste — et c'est celle que le
 * dépôt emploie déjà pour tout ce qu'il ne peut pas joindre (`CLAUDE.md` §5) —
 * est de faire télécharger le fichier par une machine qui, elle, a le réseau.
 *
 * **La fiche reste la source unique.** Chaque image y déclare son adresse
 * d'origine (`url`), l'endroit où elle doit atterrir (`fichier`), sa `licence`
 * et son `credit`. Ce script ne fait que combler l'écart entre les deux. Aucune
 * liste séparée à tenir à jour — donc rien qui puisse diverger de la fiche.
 *
 * ── Ce qu'il REFUSE ────────────────────────────────────────────────────────
 *
 *  - **une image sans licence exploitable** : les mêmes contrôles qu'à l'import
 *    (`src/lib/import-fiches-phyto.ts`), appliqués AVANT le téléchargement.
 *    Rien ne sert de rapatrier ce qu'on ne pourra pas afficher, et surtout : on
 *    ne veut pas d'un fichier de tiers qui traîne dans le dépôt « en
 *    attendant » ;
 *  - **une image trop lourde** : elle est versionnée dans Git, où rien ne
 *    s'efface, et affichée sur un téléphone au bord d'une route.
 *
 * Usage : node scripts/recolter-images-phyto.mjs [--dry]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DOSSIER_FICHES = "donnees/phyto/fiches";
const MAX_OCTETS = 500 * 1024;
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const aBlanc = process.argv.includes("--dry");

/**
 * Les mêmes refus qu'à l'import, appliqués AVANT de télécharger.
 *
 * Recopiés ici plutôt qu'importés parce que ce script est en JavaScript nu, sans
 * étape de compilation — c'est ce qui lui permet de tourner sur un runner sans
 * rien installer. **Le contrôle qui fait foi reste celui de l'import**, en
 * TypeScript et éprouvé ; celui-ci est une première barrière, et
 * `scripts/test-import-fiches-phyto.ts` garde la version stricte.
 */
function licenceRefusee(licence) {
  if (/vérifier|verifier|inconnu|\?|à définir|a definir/i.test(licence)) {
    return "ce n’est pas une licence, c’est un aveu";
  }
  if (/©|\(c\)|tous droits réservés|droits réservés|all rights reserved/i.test(licence)) {
    return "c’est une mention de copyright, pas une licence";
  }
  return null;
}

const aRecolter = [];
if (existsSync(DOSSIER_FICHES)) {
  for (const nom of readdirSync(DOSSIER_FICHES).filter((f) => f.endsWith(".json")).sort()) {
    const lot = JSON.parse(readFileSync(path.join(DOSSIER_FICHES, nom), "utf-8"));
    for (const fiche of lot.fiches ?? []) {
      for (const image of fiche.images ?? []) {
        if (!image.url || !image.fichier) continue;
        aRecolter.push({ ...image, fiche: fiche.code, lot: nom });
      }
    }
  }
}

if (aRecolter.length === 0) {
  console.log("Aucune image à récolter : aucune fiche ne déclare à la fois une adresse et un fichier.");
  process.exit(0);
}

let ecrites = 0;
let dejaLa = 0;
let echecs = 0;

for (const image of aRecolter) {
  const etiquette = `${image.fiche} → ${image.fichier}`;

  const refus = licenceRefusee(image.licence ?? "");
  if (refus) {
    console.error(`❌ ${etiquette} — licence « ${image.licence} » : ${refus}. Non téléchargée.`);
    echecs++;
    continue;
  }

  if (existsSync(image.fichier)) {
    console.log(`  · ${etiquette} — déjà présente, laissée telle quelle`);
    dejaLa++;
    continue;
  }

  const extension = path.extname(image.fichier).toLowerCase();
  if (!TYPES[extension]) {
    console.error(`❌ ${etiquette} — extension « ${extension} » non acceptée (.jpg, .png, .webp).`);
    echecs++;
    continue;
  }

  if (aBlanc) {
    console.log(`  · ${etiquette} — serait téléchargée depuis ${image.url}`);
    continue;
  }

  try {
    const reponse = await fetch(image.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { "User-Agent": "Atlas-app/recolte-images-phyto (contact via le dépôt GitHub)" },
    });
    if (!reponse.ok) {
      console.error(`❌ ${etiquette} — HTTP ${reponse.status} sur ${image.url}`);
      echecs++;
      continue;
    }

    const octets = Buffer.from(await reponse.arrayBuffer());

    // **Un fichier minuscule n'est pas une photo** : c'est une page d'erreur, ou
    // une redirection qu'on a prise pour l'image. Le dire plutôt que de déposer
    // un fichier illisible qu'on découvrirait à l'écran.
    if (octets.length < 2048) {
      console.error(`❌ ${etiquette} — ${octets.length} octets reçus : ce n’est pas une photo.`);
      echecs++;
      continue;
    }
    if (octets.length > MAX_OCTETS) {
      console.error(
        `❌ ${etiquette} — ${Math.round(octets.length / 1024)} Ko, au-delà des ${MAX_OCTETS / 1024} Ko admis. ` +
          `Demandez une version réduite à la source (sur Wikimedia : ajoutez « ?width=1200 » à l’adresse).`
      );
      echecs++;
      continue;
    }

    mkdirSync(path.dirname(image.fichier), { recursive: true });
    writeFileSync(image.fichier, octets);
    console.log(`  ✓ ${etiquette} — ${Math.round(octets.length / 1024)} Ko`);
    ecrites++;
  } catch (err) {
    console.error(`❌ ${etiquette} — ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

console.log(`\n${ecrites} image(s) récoltée(s), ${dejaLa} déjà présente(s), ${echecs} en échec.`);
// Un échec ne fait pas tomber la récolte entière : une adresse morte parmi vingt
// ne doit pas priver des dix-neuf autres. Mais si RIEN n'a été obtenu alors
// qu'il y avait du travail, c'est un échec — sans quoi le workflow serait vert
// sur une récolte qui n'a rien rapporté.
process.exit(echecs > 0 && ecrites === 0 && dejaLa === 0 ? 1 : 0);
