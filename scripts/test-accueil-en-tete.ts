import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
const PARTAGE = "src/components/atlas/EnTeteEcran.tsx";
/** Tous les écrans, pour une règle qui vaut partout et non sur trois fichiers. */
function fichiersTsx(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersTsx(chemin));
    else if (entree.endsWith(".tsx")) sortie.push(chemin);
  }
  return sortie;
}

const source = readFileSync(ECRAN, "utf8");
const page = readFileSync(PAGE, "utf8");
const partage = readFileSync(PARTAGE, "utf8");

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

console.log("=== Les en-têtes : ni salut, ni trait — nulle part ===\n");

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

// ── ET LE MÊME TRAIT SUR TOUS LES AUTRES ÉCRANS ────────────────────────────
//
// **Sa demande du 25 août 2026**, capture de « Sécurité & données » à l'appui :
// *« souvent sous les titres il y avait un trait comme celui-là, supprime tous
// les traits sous les titres »*.
//
// Il n'avait pas eu à le demander deux fois pour l'accueil : la veille, il
// faisait retirer celui-là seul. Le trait vivait en réalité dans l'en-tête
// PARTAGÉ, allumé par défaut — donc sur chaque écran qui l'emploie. Retiré une
// fois, il disparaît partout ; c'est exactement ce que cette pièce existe pour
// permettre, et ce que vingt retraits écran par écran auraient manqué.

essai("l'en-tête PARTAGÉ ne dessine plus aucun filet", () => {
  const vifPartage = sansCommentaires(partage);
  const trouve = vifPartage.match(/h-px[^\n]*/);
  assert.equal(
    trouve,
    null,
    `un filet est revenu dans l'en-tête partagé : « ${trouve?.[0].trim()} ». Il paraîtrait ` +
      `alors sur TOUS les écrans d'un coup — c'est ce qu'il a fait retirer le 25 août.`
  );
});

essai("plus aucun écran ne règle ce filet — le réglage n'existe plus", () => {
  // **Un réglage qui survit à ce qu'il réglait invite à le rallumer.** Tant que
  // `cheveu` existait, il suffisait d'écrire `cheveu` pour faire revenir le
  // trait sur un écran, sans que rien ne le signale.
  assert.ok(
    !sansCommentaires(partage).includes("cheveu"),
    "`cheveu` traîne encore dans l'en-tête partagé : le trait peut être rallumé écran par écran"
  );
});

// ── ET LE FILET À CÔTÉ DES INTERTITRES ─────────────────────────────────────
//
// **Sa demande du 25 août 2026**, capture de l'écran Équipe à l'appui : *« ça
// aussi tu peux retirer »*. Il parlait du filet qui partait du mot et filait
// jusqu'au bord — « QUI A ACCÈS ————— ».
//
// **Et de ce qu'il a laissé, dans le même souffle : *« ceux qui séparent les
// blocs, laisse-les »*.** Les deux se ressemblent et ne disent pas la même
// chose : un séparateur porte une information — deux choses sont distinctes —,
// le filet d'intertitre n'ornait qu'un mot. Ce contrôle ne traque donc QUE la
// seconde forme, et laisser tomber les séparateurs le ferait mentir sur ce
// qu'il défend.

essai("aucun filet ne prolonge un intertitre", () => {
  const coupables: string[] = [];
  for (const f of fichiersTsx("src")) {
    const t = sansCommentaires(readFileSync(f, "utf8"));
    // La forme exacte : un filet d'un pixel qui PREND LA PLACE RESTANTE à côté
    // d'un mot. Un séparateur, lui, ne porte jamais `flex-1`.
    if (/h-px[^"']*flex-1|flex-1[^"']*h-px/.test(t)) coupables.push(f);
  }
  assert.deepEqual(
    coupables,
    [],
    `un filet d'intertitre est revenu : ${coupables.join(", ")}. Il les a fait retirer ` +
      `le 25 août — seuls les séparateurs de blocs restent.`
  );
});

console.log(
  echecs === 0
    ? "\n✅ L'en-tête de l'accueil — 0 échec(s)."
    : `\n❌ L'en-tête de l'accueil — ${echecs} échec(s).`
);
if (echecs > 0) process.exit(1);
