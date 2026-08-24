// Ce qu'Atlas accepte de SERVIR comme type — et ce qu'il ne servira jamais.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROTÈGE.** Audit du 23 août 2026, constat M1. La route
// des fichiers renvoyait le type MIME tel que le NAVIGATEUR l'avait déclaré au
// dépôt. Annoncer `image/svg+xml` faisait servir un document SVG depuis notre
// propre domaine — et un SVG peut porter du script, qui s'exécute avec la
// session de l'artisan.
//
// **`nosniff` ne fermait pas ce trou**, et c'est le piège de ce constat :
// l'en-tête interdit de DEVINER un type, pas d'en annoncer un. La politique de
// sécurité du contenu autorise l'inline, donc elle ne rattrapait rien non plus.
//
// Ni base, ni réseau, ni navigateur.

import assert from "node:assert/strict";
import { typeDepuisCle } from "../src/lib/type-de-fichier";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le type servi vient de la clé, jamais du navigateur ===\n");

// ─── LA RÈGLE QUI PRIME : rien d'exécutable ne sort d'ici ───────────────────

essai("AUCUNE clé ne fait servir un type EXÉCUTABLE", () => {
  // Toutes les façons d'essayer d'obtenir un SVG ou du HTML, y compris celles
  // qui passeraient une comparaison naïve sur `endsWith`.
  const tentatives = [
    "chantiers/x/photos/piege.svg",
    "chantiers/x/photos/piege.html",
    "chantiers/x/photos/piege.xhtml",
    "chantiers/x/photos/piege.js",
    "chantiers/x/photos/piege.jpg.svg",
    "chantiers/x/photos/piege.svg.jpg.svg",
    "chantiers/x/photos/piege.SVG",
    "chantiers/x/photos/piege.svg?.jpg",
    "chantiers/x/photos/piege.jpg/../piege.svg",
  ];
  for (const cle of tentatives) {
    const rendu = typeDepuisCle(cle);
    assert.ok(
      !/svg|html|xml|javascript|script/i.test(rendu),
      `« ${cle} » ferait servir « ${rendu} »`
    );
  }
});

essai("une extension inconnue se télécharge, elle ne s'affiche pas", () => {
  // `application/octet-stream` : le navigateur propose d'enregistrer plutôt que
  // d'ouvrir. C'est le défaut sûr.
  for (const cle of ["x/y.exotique", "x/y", "x/y.", "", "sans-point"]) {
    assert.equal(typeDepuisCle(cle), "application/octet-stream", `« ${cle} »`);
  }
});

// ─── Et il faut que les VRAIS fichiers s'affichent encore ───────────────────
//
// Un contrôle qui refuserait tout passerait au vert en cassant les photos de
// chantier. Les deux moitiés comptent.

essai("les photos que les écrans déposent s'affichent", () => {
  // Les extensions posées par `extensionPour` dans `photos-actions.ts`,
  // `diagnostic/actions.ts` et l'action du logo.
  assert.equal(typeDepuisCle("chantiers/a/photos/b.jpg"), "image/jpeg");
  assert.equal(typeDepuisCle("chantiers/a/photos/b.png"), "image/png");
  assert.equal(typeDepuisCle("chantiers/a/photos/b.webp"), "image/webp");
  assert.equal(typeDepuisCle("entreprises/a/logo/b.png"), "image/png");
});

essai("une photo d'iPhone non transcodée s'affiche aussi", () => {
  // Une image, sans script : la refuser ne protégerait de rien et priverait
  // l'artisan de sa photo.
  assert.equal(typeDepuisCle("chantiers/a/photos/b.heic"), "image/heic");
  assert.equal(typeDepuisCle("chantiers/a/photos/b.heif"), "image/heif");
});

essai("les dictées se rejouent — les sept formats que le serveur range", () => {
  // `extensionPour` dans `src/server/services/note-vocale-entrante.ts`.
  const attendu: Record<string, string> = {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
  };
  for (const [ext, type] of Object.entries(attendu)) {
    assert.equal(typeDepuisCle(`chantiers/a/notes/b${ext}`), type, ext);
  }
});

essai("l'extension de secours des dictées ne s'affiche pas non plus", () => {
  // `extensionPour` rend `.audio` quand le format est inconnu : servi en
  // téléchargement plutôt qu'en type inventé.
  assert.equal(typeDepuisCle("chantiers/a/notes/b.audio"), "application/octet-stream");
});

// ─── Les détails qui piègent ────────────────────────────────────────────────

essai("la CASSE ne change rien", () => {
  assert.equal(typeDepuisCle("x/y.JPG"), "image/jpeg");
  assert.equal(typeDepuisCle("x/y.PnG"), "image/png");
});

essai("seul le DERNIER point compte", () => {
  assert.equal(typeDepuisCle("x/mon.fichier.a.moi.png"), "image/png");
  // Et un dossier qui porte un point ne trompe pas la lecture.
  assert.equal(typeDepuisCle("x.png/y.jpg"), "image/jpeg");
});

console.log("");
console.log(`Type de fichier — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
