/* =======================================================================
   Aucun point au milieu d'une phrase, dans ce que le produit affiche.

   **Sa règle du 22 septembre 2026, devant « Probable · Peuplier » :**
   *« Plus jamais tu mets de point entre le nom et probable ! Retiens
   pour les autres fiches, et plus jamais de tiret, fais des phrases
   normales. »* Puis, le lendemain : *« mets cette règle en garde-fou,
   que les sessions futures ne recommencent pas à mettre des points
   inutiles là où elles peuvent faire des phrases »*.

   **Pourquoi un contrôle plutôt qu'une ligne dans `CLAUDE.md`.** La
   règle Y EST DÉJÀ (§3), et elle n'a pas empêché les 72 endroits qu'il a
   fallu corriger le 22 septembre — un par un, sur ses écrans, mais aussi
   sur les PDF qui partent chez ses clients. Une règle de style qui ne
   vit que dans un document se perd au troisième écran écrit par une
   autre session. C'est exactement ce qu'a montré la flèche décorative,
   qu'il a dû redemander le soir même de sa règle du matin
   (`test-aucune-fleche.ts`).

   **Ce qu'il faut écrire à la place, et c'est tout le sujet.** Le point
   collait deux informations pour ne pas avoir à choisir entre elles :

       « 12 août · 1 250 € prévus »  →  « 12 août, 1 250 € prévus »
       « F-2026-019 · émise le 12 août »  →  « F-2026-019 émise le 12 août »
       « DERNIÈRE PRESTATION · 12 août »  →  « DERNIÈRE PRESTATION le 12 août »

   Une espace quand la phrase se lit d'elle-même ; une virgule quand
   l'espace collerait deux nombres ou changerait le sens ; un mot de
   liaison quand il en faut un. Jamais un caractère qui tient lieu de
   phrase.

   **ET IL PORTE LES MAQUETTES — sa question du 23 septembre :** *« si dans
   la maquette il met des points n'importe où, quand il va pousser sur main
   il va pousser avec les points ? Donc c'est pas bon »*. Il a raison deux
   fois : la planche qu'il ouvre depuis son téléphone porterait le point
   qu'il refuse, et une maquette validée se recopie en code — c'est le
   chemin normal de ce dépôt (`CLAUDE.md` §3 bis).

   **Mais seulement ce que le lot AJOUTE, pour les maquettes.** Il en dort
   2 320 dans 231 planches, dont des dizaines d'essais archivés que
   personne ne rouvrira. Les faire rougir toutes, c'est un contrôle éteint
   dans la journée — et la protection perdue pour de bon. C'est la
   mécanique de `test-pas-de-pansement.ts`, et elle est partagée avec lui.

   **CE CONTRÔLE NE PORTE QUE LES POINTS.** Sa règle vise aussi les
   tirets `—`, et leur relevé n'est pas fait : les ajouter ici ferait
   rougir le dépôt entier au premier jour, donc désarmer le contrôle.
   C'est inscrit dans `TODO.md`.
   ======================================================================= */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { sansCommentaires } from "./_sans-commentaires";
// La même lecture du diff que le contrôle des pansements : ne regarder que ce
// que le lot ajoute est ce qui permet à un garde-fou de vivre plus d'un jour.
import { lignesAjoutees } from "./_lignes-ajoutees";

const RACINE = path.join(__dirname, "..", "src");

/**
 * Le point médian, et lui seul.
 *
 * Le point ordinaire n'y est évidemment pas — il finit les phrases. La
 * puce ronde `•` non plus : elle ne s'est jamais glissée dans un libellé
 * de ce dépôt, et un contrôle qui interdit ce qui n'existe pas apprend
 * seulement à être ignoré.
 */
const POINT_MEDIAN = /·/u;

/**
 * Les seuls fichiers qui gardent un point médian, chacun avec sa raison.
 *
 * Le motif vise la LIGNE, pas le fichier : poser un libellé pointé dans
 * un fichier déjà cité ne passerait pas pour autant. Une liste qui
 * s'allonge toute seule ne protège plus de rien.
 */
const AUTORISES: { fichier: string; motif: RegExp; pourquoi: string }[] = [
  {
    fichier: "src/server/documents-legaux/versions.ts",
    motif: /./,
    pourquoi:
      "les conditions générales et la politique de confidentialité : le « · » y est " +
      "une PUCE de liste et un séparateur de tableau, pas un séparateur de phrase. " +
      "Et surtout, ces textes sont PUBLIÉS et ACCEPTÉS par des comptes : les " +
      "réécrire demande une nouvelle version et une nouvelle acceptation de chacun. " +
      "C'est sa décision, pas une correction de forme",
  },
  {
    fichier: "src/app/design/a/page.tsx",
    motif: /./,
    pourquoi: "page de démonstration du design, hors produit — il ne l'ouvre jamais",
  },
  {
    fichier: "src/app/design/b/page.tsx",
    motif: /./,
    pourquoi: "même démonstration, autre variante",
  },
  {
    fichier: "src/server/ai/providers/llm/dev.ts",
    motif: /join\(" · "\)/,
    pourquoi:
      "le fournisseur d'IA de DÉVELOPPEMENT, qui fabrique des réponses d'essai sans " +
      "clé : rien de ce qu'il écrit n'atteint un écran du patron",
  },
  {
    fichier: "src/server/ai/services/discuter-plan.ts",
    motif: /`\$\{x\.ref\}/,
    pourquoi:
      "le catalogue d'arroseurs mis en forme pour le MODÈLE, pas pour l'écran : " +
      "c'est une consigne envoyée au fournisseur, et la lisibilité qui compte là " +
      "est la sienne",
  },
];

/**
 * Ce qui RETIRE des points d'une saisie, et qui doit donc en nommer un.
 *
 * Ces trois-là sont du bon côté de la règle : ils nettoient ce que le
 * patron ou un fournisseur a tapé. Les faire rougir reviendrait à
 * demander de retirer le nettoyage.
 */
const NETTOYEURS = [
  "src/lib/commune-adresse.ts",
  "src/lib/libelle-client.ts",
  "src/lib/correspondance-prestation.ts",
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    /* **Les `.js` en sont, et ce n'est pas théorique.** Le catalogue
       d'arrosage est un `.js` repris tel quel de la page publiée
       (`verifier-arrosage-une-seule-source.mjs`) : 43 noms d'arroseurs y
       portaient un point médian — « PGP-ADJ · buse 1 » —, et ils partent sur
       le plan, dans la liste des pièces, et chez le fournisseur. La première
       version de ce contrôle ne lisait que le TypeScript : elle les a tous
       manqués. */
    return /\.(tsx?|m?js|css)$/.test(nom) ? [chemin] : [];
  });
}

console.log("=== Aucun point au milieu d'une phrase ===\n");

const coupables: string[] = [];
let lignesLues = 0;

for (const chemin of fichiers(RACINE)) {
  const relatif = path.relative(path.join(__dirname, ".."), chemin).replace(/\\/g, "/");
  if (NETTOYEURS.includes(relatif)) continue;

  const lignes = sansCommentaires(readFileSync(chemin, "utf8"));
  lignesLues += lignes.length;

  lignes.forEach((ligne, i) => {
    if (!POINT_MEDIAN.test(ligne)) return;
    const permis = AUTORISES.some((a) => a.fichier === relatif && a.motif.test(ligne));
    if (!permis) coupables.push(`${relatif}:${i + 1} — ${ligne.trim()}`);
  });
}

/* **Un contrôle qui ne mesure rien rend un vert qui ne prouve rien**
   (`CLAUDE.md` §5). Si la lecture de `src/` échouait, la liste des
   coupables serait vide et cette suite passerait au vert sans avoir rien
   regardé — exactement la panne du 15 août 2026, où deux largeurs de
   zéro pixel disaient « rien n'est coupé » sur un écran qui l'était. */
assert.ok(lignesLues > 10_000, `seulement ${lignesLues} lignes lues : la lecture de src/ a échoué`);

assert.equal(
  coupables.length,
  0,
  `Un point du milieu de phrase est revenu à l'écran — il a fallu en retirer 72 le 22 septembre :\n  ` +
    coupables.join("\n  ") +
    `\n\nÀ la place : une espace quand la phrase se lit seule (« F-2026-019 émise le\n` +
    `12 août »), une virgule quand l'espace collerait deux nombres (« 12 août,\n` +
    `1 250 € prévus ») ou changerait le sens (« Devis envoyé, à relancer »), un mot\n` +
    `de liaison quand il en faut un (« DERNIÈRE PRESTATION le 12 août »).\n\n` +
    `Un point qui ne s'affiche PAS — un document légal déjà accepté, une consigne\n` +
    `envoyée au modèle — s'ajoute à AUTORISES, en haut de ce fichier, AVEC sa\n` +
    `raison. Un commentaire, lui, n'a rien à déclarer : ils sont déjà ignorés.`,
);

console.log(
  `  ${lignesLues.toLocaleString("fr")} lignes de src/ lues, ${AUTORISES.length} endroits nommés, aucun point au milieu d'une phrase.`
);

// ── Les maquettes : ce que CE lot ajoute ─────────────────────────────────
//
// On relit le FICHIER, pas la ligne du diff : une ligne isolée ne dit pas
// si elle est au milieu d'un commentaire, et un contrôle qui accuse un
// commentaire s'apprend à être ignoré.
const MAQUETTES = ["appli", "maquettes"];
const AFFICHE = /\.(html|m?js)$/;

const ajoutees = lignesAjoutees(path.join(__dirname, ".."), MAQUETTES).filter((l) =>
  AFFICHE.test(l.fichier)
);
const parFichier = new Map<string, Set<number>>();
for (const a of ajoutees) {
  if (!parFichier.has(a.fichier)) parFichier.set(a.fichier, new Set());
  parFichier.get(a.fichier)!.add(a.numero);
}

const fautifs: string[] = [];
for (const [relatif, numeros] of parFichier) {
  const chemin = path.join(__dirname, "..", relatif);
  if (!existsSync(chemin)) continue; // supprimé par le lot
  const lignes = sansCommentaires(readFileSync(chemin, "utf8"));
  for (const n of numeros) {
    const ligne = lignes[n - 1];
    if (ligne && POINT_MEDIAN.test(ligne)) fautifs.push(`${relatif}:${n} — ${ligne.trim()}`);
  }
}

console.log(`  ${ajoutees.length} ligne(s) ajoutée(s) par ce lot dans les maquettes, mesurées.`);

assert.equal(
  fautifs.length,
  0,
  `Ce lot pose un point du milieu de phrase dans une maquette :\n  ` +
    fautifs.join("\n  ") +
    `\n\nUne maquette n'échappe pas à la règle, et pour deux raisons : c'est CE
qu'il ouvre depuis son téléphone, et une planche validée se recopie en code.
Les planches anciennes ne sont pas visées — seulement ce que ce lot ajoute.`
);

console.log(`\n✅ Aucun point au milieu d'une phrase, ni dans l'application, ni dans ce que ce lot ajoute aux maquettes.`);
