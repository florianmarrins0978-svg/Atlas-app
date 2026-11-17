/* =======================================================================
   L'application s'appelle Cause : aucun texte affiché ne dit plus Atlas.

   **Sa demande du 17 novembre 2026 :** *« l'application va s'appeler Cause,
   va modifier partout dans l'application où le mot Atlas apparaît et
   remplace-le par Cause »*.

   **Pourquoi un contrôle plutôt qu'une consigne.** Le dépôt écrit « Atlas »
   dans des milliers de commentaires, et une session qui ajoute un libellé
   recopie le mot qu'elle vient de lire. Sans contrôle, le vieux nom revient
   à l'écran au premier lot d'une autre session, et c'est lui qui le voit.

   **Ce qui reste permis, et pourquoi** (`ARCHITECTURE.md` §581) : les
   commentaires, qui racontent l'histoire ; les noms internes en minuscules
   (`data-atlas`, `atlas_app`, le préfixe `atlas-` des rendez-vous), que le
   mot entier en capitale ne touche pas ; et les conditions générales déjà
   publiées, qui ne changeront que par une version nouvelle acceptée par
   chacun. Une exception se nomme plus bas, avec sa raison.
   ======================================================================= */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
// La même lecture sans commentaires que les contrôles des flèches et des
// tirets : deux copies auraient divergé (`CLAUDE.md` §3).
import { sansCommentaires } from "./_sans-commentaires";

const RACINE = path.join(__dirname, "..", "src");
const VIEUX_NOM = /\bAtlas\b/;

const AUTORISES: { fichier: string; motif?: RegExp; pourquoi: string }[] = [
  {
    fichier: "src/server/documents-legaux/versions.ts",
    pourquoi:
      "les conditions générales publiées ne se modifient jamais : le nom changera par une " +
      "version nouvelle, que chaque compte acceptera de nouveau (sa décision, TODO.md)",
  },
  {
    fichier: "src/lib/fiches-mode-emploi/fonctionnement.ts",
    motif: /"dans un format exploitable sans Atlas"/,
    pourquoi:
      "la preuve cite les conditions générales mot pour mot (test-mode-emploi.ts) : " +
      "elle suivra leur version nouvelle",
  },
];

/** Les lignes d'un fichier où le vieux nom se lit hors commentaire. */
function lignesAuVieuxNom(source: string): number[] {
  return sansCommentaires(source).flatMap((ligne, i) => (VIEUX_NOM.test(ligne) ? [i + 1] : []));
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.(tsx?|js)$/.test(nom) ? [chemin] : [];
  });
}

console.log("=== L'application s'appelle Cause ===\n");

/* **Le contrôle sait échouer** (`CLAUDE.md` §5) : un libellé au vieux nom est
   vu, un commentaire et un nom interne ne le sont pas. */
assert.deepEqual(lignesAuVieuxNom(`const a = 1;\nconst t = "Ouvrir Atlas";`), [2], "un libellé au vieux nom n'est pas vu");
assert.deepEqual(lignesAuVieuxNom(`<p>\n  Atlas prépare le devis…\n</p>`), [2], "un texte d'écran au vieux nom n'est pas vu");
assert.deepEqual(lignesAuVieuxNom(`// Atlas range ici\nconst x = 2;`), [], "un commentaire est pris pour un libellé");
assert.deepEqual(lignesAuVieuxNom(`const r = "atlas-" + id; estEvenementAtlas(r);`), [], "un nom interne est pris pour un libellé");
console.log("✅ Le contrôle sait échouer : un libellé au vieux nom est vu, un commentaire et un nom interne ne le sont pas");

const coupables: string[] = [];
let lignesLues = 0;

for (const chemin of fichiers(RACINE)) {
  const relatif = path.relative(path.join(__dirname, ".."), chemin).replace(/\\/g, "/");
  const source = readFileSync(chemin, "utf8");
  const lignes = source.split("\n");
  lignesLues += lignes.length;
  for (const n of lignesAuVieuxNom(source)) {
    const permis = AUTORISES.some((a) => a.fichier === relatif && (!a.motif || a.motif.test(lignes[n - 1])));
    if (!permis) coupables.push(`${relatif}:${n}  ${lignes[n - 1].trim()}`);
  }
}

// Une lecture ratée rendrait une liste vide, donc un vert qui ne prouve rien.
assert.ok(lignesLues > 10_000, `seulement ${lignesLues} lignes lues : la lecture de src/ a échoué`);

assert.equal(
  coupables.length,
  0,
  `Le vieux nom est revenu dans un texte de l'appli :\n  ${coupables.join("\n  ")}\n\n` +
    `Écrire Cause. « d'Atlas » devient « de Cause », « qu'Atlas » devient « que Cause ».\n` +
    `Une exception se déclare dans AUTORISES, en haut de ce fichier, avec sa raison.`,
);

console.log(`✅ ${lignesLues.toLocaleString("fr")} lignes lues, aucun texte de l'appli ne dit plus Atlas (${AUTORISES.length} exceptions nommées)`);
