// CHAQUE RUBRIQUE DE RÉGLAGES QUI N'EST PAS PERSONNELLE SE GARDE ELLE-MÊME.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE F8 A TROUVÉ, ET POURQUOI UN CONTRÔLE STRUCTUREL PLUTÔT QU'UN DE
// PLUS.**
//
// « Intégrations » (`/reglages/agenda`) était la seule rubrique du patron sans
// garde côté serveur. Le sommaire ne montrait pas son lien à un salarié — ce
// qui ne protège rien : **une adresse se tape**. Les ÉCRITURES, elles, étaient
// bien gardées ; c'était la LECTURE qui ne l'était pas, et elle disait l'état
// du calendrier relié du patron.
//
// Le défaut n'était donc pas « une garde oubliée » mais « rien ne dit qu'il en
// faut une ». Une quatorzième rubrique écrite dans six mois referait
// exactement la même chose. D'où ce contrôle, qui ne regarde aucune rubrique en
// particulier : il regarde la RÈGLE.
//
// ─────────────────────────────────────────────────────────────────────────────
// **ET IL DISTINGUE CE QUI EST PERSONNEL À DESSEIN.** Trois rubriques
// appartiennent à celui qui les ouvre, salarié compris — son compte, sa
// connexion, ses couleurs. Y exiger une garde de propriétaire fermerait au
// salarié le seul coin des réglages qui soit à lui, et le contrôle aurait
// dégradé l'application au lieu de la protéger.
//
// **`Notifications` n'en fait PAS partie**, malgré sa place dans l'ensemble
// « Moi » : ses rappels portent sur les devis et les factures de l'entreprise,
// et l'écran le dit lui-même à un salarié. C'est pourquoi la liste ci-dessous
// est écrite en dur plutôt que déduite de `MOI` — la déduire aurait ouvert
// `Notifications` sans que personne l'ait décidé.
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

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

const RACINE = join(__dirname, "..", "src", "app", "reglages");

/**
 * Les rubriques qui appartiennent à celui qui les ouvre — salarié compris.
 *
 * Chacune porte ce qui la justifie : une exception sans raison écrite finit par
 * s'étendre à ce qu'elle ne couvrait pas.
 */
const PERSONNELLES: Record<string, string> = {
  "compte/page.tsx": "son nom et son adresse électronique à lui",
  "connexion/page.tsx": "son mot de passe, ses clés d'appareil, sa déconnexion",
  "apparence/page.tsx": "les couleurs de SON application",
};

/** La racine des réglages : elle compose la liste selon le rôle, sans rien lire. */
const SOMMAIRE = "page.tsx";

/** Ce qui compte comme une garde posée par la page elle-même. */
const GARDES = ["estProprietaire", "exigerProprietaire", "estEditeur"];

/**
 * Les attentes qui ne lisent AUCUNE donnée : elles ont le droit de précéder la
 * garde. Tout le reste, non — c'est exactement le défaut d'« Intégrations »,
 * qui allait chercher l'état du calendrier du patron avant de savoir à qui.
 */
const AVANT_LA_GARDE = ["getCurrentCtx", "params", "searchParams", "cookies", "headers", ...GARDES];

/**
 * Ce qui est ATTENDU sur une ligne — le nom derrière `await`, jamais la ligne
 * entière.
 *
 * **Payé sur ce contrôle même.** Il comparait la ligne complète à la liste
 * ci-dessus, et la lecture d'« Intégrations » s'écrit :
 *
 *     const [etat, etatApple, params] = await Promise.all([
 *
 * Le mot `params` y figure — dans la destructuration, pas dans l'attente. La
 * ligne passait donc pour anodine, et le contrôle restait vert avec la garde
 * déplacée APRÈS la lecture, c'est-à-dire sur le défaut exact qu'il porte dans
 * son nom. On ne regarde donc plus que ce qui suit `await`.
 */
function ceQuiEstAttendu(ligne: string): string[] {
  const noms: string[] = [];
  for (const m of ligne.matchAll(/\bawait\s+([A-Za-z_$][\w$.]*)/g)) noms.push(m[1]);
  return noms;
}

/**
 * Le code seul, les commentaires blanchis — en gardant le compte des lignes.
 *
 * **Ce contrôle a été VERT sur la page d'« Intégrations » privée de sa garde**,
 * et deux fois de suite. La première parce qu'il cherchait le nom de la garde
 * n'importe où dans le fichier : la ligne d'import suffisait. La seconde parce
 * que le commentaire d'en-tête, qui EXPLIQUE la garde, contient le mot
 * `exigerProprietaire` — la prose du correctif faisait passer son absence.
 *
 * C'est exactement le piège que `CLAUDE.md` §5 décrit : un contrôle qu'on n'a
 * jamais vu rouge ne prouve rien. Celui-ci n'a été cru qu'après avoir rougi
 * pour de bon, la garde retirée du corps de la fonction.
 */
function lignesUtiles(source: string): string[] {
  const lignes = source.split("\n");
  let dansBloc = false;
  return lignes.map((ligne) => {
    let sortie = "";
    let i = 0;
    while (i < ligne.length) {
      if (dansBloc) {
        const fin = ligne.indexOf("*/", i);
        if (fin < 0) return sortie;
        dansBloc = false;
        i = fin + 2;
        continue;
      }
      const bloc = ligne.indexOf("/*", i);
      const trait = ligne.indexOf("//", i);
      if (trait >= 0 && (bloc < 0 || trait < bloc)) return sortie + ligne.slice(i, trait);
      if (bloc >= 0) {
        sortie += ligne.slice(i, bloc);
        dansBloc = true;
        i = bloc + 2;
        continue;
      }
      return sortie + ligne.slice(i);
    }
    return sortie;
  });
}

function pagesDeReglages(): string[] {
  const trouvees: string[] = [];
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      // **Toujours des barres obliques, quelle que soit la machine.** Sur
      // Windows, `relative` rend « apparence\page.tsx » quand les exceptions
      // sont écrites « apparence/page.tsx » : aucune ne correspondait, et ce
      // contrôle accusait trois rubriques gardées de ne pas l'être — sur la
      // machine du patron seulement, jamais sur la CI. Une erreur qui désigne
      // le mauvais coupable coûte plus cher que pas d'erreur (`CLAUDE.md` §5).
      else if (entree.name === "page.tsx") trouvees.push(relative(RACINE, chemin).split(sep).join("/"));
    }
  };
  parcourir(RACINE);
  return trouvees.sort();
}

function main() {
  console.log("Réglages : ce qui appartient à l'entreprise se garde côté serveur");

  const pages = pagesDeReglages();

  essai("des rubriques ont été trouvées — sinon ce contrôle ne mesure rien", () => {
    assert.ok(pages.length >= 12, `seulement ${pages.length} rubriques trouvées sous src/app/reglages`);
  });

  essai("chaque exception personnelle existe encore, et porte sa raison", () => {
    for (const [page, pourquoi] of Object.entries(PERSONNELLES)) {
      assert.ok(pages.includes(page), `${page} n'existe plus : son exception est périmée`);
      assert.ok(pourquoi.length > 15, `${page} : l'exception n'explique pas ce qu'elle couvre`);
    }
  });

  essai("TOUTE rubrique non personnelle pose une garde de rôle", () => {
    const nues = pages.filter((page) => {
      if (page === SOMMAIRE || page in PERSONNELLES) return false;
      // **Dans le CORPS de la page, jamais dans ses imports.** Première version
      // de ce contrôle : elle cherchait « estProprietaire » n'importe où dans
      // le fichier. Confrontée à la page d'« Intégrations » privée de sa garde,
      // elle est restée VERTE — la ligne `import { estProprietaire }` suffisait
      // à la satisfaire. Un contrôle trop tolérant ne prouve rien, et celui-ci
      // a été trouvé exactement comme le veut la règle : en le mettant face au
      // défaut qu'il prétend attraper.
      const lignes = lignesUtiles(readFileSync(join(RACINE, page), "utf8"));
      const debut = lignes.findIndex((l) => /export default async function/.test(l));
      if (debut < 0) return true;
      return !lignes.some((l, i) => i > debut && GARDES.some((g) => l.includes(g)));
    });
    assert.deepEqual(
      nues,
      [],
      "ces rubriques se laissent ouvrir par un salarié qui tape leur adresse — " +
        "cacher leur lien dans le sommaire ne protège rien"
    );
  });

  essai("LA GARDE PRÉCÈDE LA LECTURE — c'est le défaut exact de F8", () => {
    const tardives: string[] = [];
    for (const page of pages) {
      if (page === SOMMAIRE || page in PERSONNELLES) continue;
      const lignes = lignesUtiles(readFileSync(join(RACINE, page), "utf8"));

      // On ne regarde que le corps de la fonction de page : un `await` dans un
      // import n'est pas une lecture — et les commentaires sont déjà blanchis.
      const debut = lignes.findIndex((l) => /export default async function/.test(l));
      if (debut < 0) continue;

      const ligneGarde = lignes.findIndex((l, i) => i > debut && GARDES.some((g) => l.includes(g)));
      const ligneLecture = lignes.findIndex((l, i) => {
        if (i <= debut) return false;
        const attendus = ceQuiEstAttendu(l);
        return attendus.length > 0 && attendus.some((n) => !AVANT_LA_GARDE.includes(n.split(".")[0]));
      });
      if (ligneGarde < 0) continue; // déjà dénoncé par le contrôle précédent
      if (ligneLecture >= 0 && ligneLecture < ligneGarde) {
        tardives.push(`${page} (lecture ligne ${ligneLecture + 1}, garde ligne ${ligneGarde + 1})`);
      }
    }
    assert.deepEqual(
      tardives,
      [],
      "ces rubriques lisent des données AVANT de savoir à qui elles parlent : " +
        "la garde arrive trop tard pour empêcher la requête"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Gardes des réglages — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
