import assert from "node:assert";
import { readFileSync } from "node:fs";

/**
 * L'EN-TÊTE DE L'ACCUEIL : NI SALUT, NI TRAIT.
 *
 * *Ses deux demandes du 24 août 2026*, sur la planche 95
 * (`appli/premiere-page.html`), puis : ***« code la mienne »***.
 *
 *   1. ***« supprime le bonjour compte »*** — ce qu'il lisait n'était pas son
 *      prénom mais le mot « Compte », le nom du compte faute de prénom
 *      renseigné. Un salut qui se trompe de nom vaut moins que pas de salut,
 *      et il occupait la première ligne de l'écran qu'il ouvre vingt fois par
 *      jour.
 *   2. ***« une sans le trait gris »*** — le filet qui fermait l'en-tête, sous
 *      « Vos clients ».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE TRAIT, IL L'AVAIT DEMANDÉ LE 11 AOÛT — ET C'EST TOUT L'ENJEU ICI.**
 *
 * `EcranChantiers.tsx` portait la consigne inverse en toutes lettres : *« seul
 * reste celui qui FERME l'en-tête ; il l'a demandé deux échanges plus tôt, et
 * les confondre reviendrait à défaire ce qu'il venait de valider »*.
 *
 * Cette consigne a été récrite le 24 août, révoquée par son auteur, planche à
 * l'appui. **Sans ce contrôle, la prochaine session le remettrait en citant
 * l'ancienne**, de parfaite bonne foi — c'est déjà arrivé deux fois dans ce
 * dépôt (`CLAUDE.md` §5 bis).
 *
 * **POURQUOI LIRE LA SOURCE PLUTÔT QUE L'ÉCRAN.** Un retrait ne se prouve que
 * par une ABSENCE, et une absence ne se mesure bien qu'à l'endroit où la chose
 * s'écrirait. Le salut, en particulier, ne paraît que si le compte porte un
 * nom : une suite navigateur sur un compte sans prénom serait verte sans avoir
 * rien mesuré (`CLAUDE.md` §5). Même méthode que
 * `test-accueil-liste-vide.ts`, pour la même raison.
 *
 * **Sait échouer** : remettre l'un ou l'autre fait tomber sa mesure en le
 * citant — éprouvé dans les deux sens avant d'être gardé.
 */

const ECRAN = "src/app/EcranChantiers.tsx";
const PAGE = "src/app/page.tsx";
const source = readFileSync(ECRAN, "utf8");
const page = readFileSync(PAGE, "utf8");

/** Le fichier sans ses commentaires : une consigne CITÉE ne doit rien déclencher. */
function sansCommentaires(t: string): string {
  return t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const vif = sansCommentaires(source);

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

console.log("=== L'en-tête de l'accueil : ni salut, ni trait ===\n");

essai("« Bonjour … » ne s'affiche plus", () => {
  const trouve = vif.match(/Bonjour[^\n]*/);
  assert.equal(
    trouve,
    null,
    `le salut est revenu : « ${trouve?.[0].trim()} ». Il a demandé son retrait le 24 août.`
  );
});

essai("le prénom n'est plus lu du tout", () => {
  // Le garder sans l'employer laisserait croire, à la prochaine lecture, qu'il
  // sert encore quelque part — et invite à le réafficher.
  assert.ok(!vif.includes("prenom"), "`prenom` traîne encore dans l'écran, sans rien afficher");
  assert.ok(
    !sansCommentaires(page).includes("prenom"),
    "`prenom` est encore calculé dans la page : une lecture pour rien à chaque ouverture"
  );
});

essai("l'en-tête ne porte plus AUCUN filet", () => {
  // Le filet s'écrivait `h-px` avec un fond : c'est cette forme qu'on traque,
  // et non le mot « trait », qui ne figure nulle part dans le code.
  const enTete = vif.slice(0, vif.indexOf("Nouveau chantier") + 1 || vif.length);
  const trouve = enTete.match(/h-px[^\n]*/);
  assert.equal(
    trouve,
    null,
    `un filet est revenu dans l'en-tête : « ${trouve?.[0].trim()} ». Il l'avait demandé le ` +
      `11 août, puis fait RETIRER le 24 sur planche 95 — la consigne d'avant est révoquée.`
  );
});

essai("la consigne du fichier dit le RETRAIT, et non l'inverse", () => {
  // **Sans cela, le code et son mode d'emploi se contrediraient**, et c'est la
  // consigne qu'on lit avant de coder. Une documentation qui décrit une version
  // disparue est pire qu'absente : on s'y fie encore (`CLAUDE.md` §1).
  const tete = source.slice(0, source.indexOf("export "));
  assert.ok(
    /révoqu/i.test(tete),
    "l'en-tête du fichier ne dit pas que la consigne du 11 août est révoquée : " +
      "la prochaine session remettra le trait de bonne foi"
  );
});

console.log(
  echecs === 0
    ? "\n✅ L'en-tête de l'accueil — 0 échec(s)."
    : `\n❌ L'en-tête de l'accueil — ${echecs} échec(s).`
);
if (echecs > 0) process.exit(1);
