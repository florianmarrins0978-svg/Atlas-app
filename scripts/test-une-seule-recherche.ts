/* =======================================================================
   Une seule barre de recherche : celle de l'appli.

   **Sa règle du 22 septembre 2026** (`src/components/atlas/ChampRecherche.tsx`,
   planche `appli/la-recherche-soulignee.html`) : *« change-le moi partout où
   il y a la possibilité de rechercher »*. Aucune boîte, la loupe au trait dans
   l'or, un filet dessous qui passe à l'or quand on écrit.

   **Redite le 1er novembre 2026**, devant une planche qui l'avait remise en
   boîte : *« je veux vraiment garder la même que celle dans l'application.
   Et ça doit être une règle. »* Elle vivait dans le commentaire d'un
   composant, donc nulle part où une session la lit avant de dessiner.

   **Deux moitiés, parce qu'elle a été cassée des deux côtés :**

   | | ce qui est refusé |
   |---|---|
   | l'appli (`src/`) | un champ `type="search"` ou `inputMode="search"` hors de `ChampRecherche.tsx` |
   | les planches (`appli/soignee/`) | un champ de recherche hors de `.champ-recherche`, la barre du kit, ou mis dans une case en boîte |

   **Deux écrans y échappaient le 1er novembre** (la feuille des pièces
   d'arrosage, la liste des fiches de sécurité) : passés sur `ChampRecherche`
   le même jour, sur son « oui ». La liste est vide, et une exception qui
   s'y ajouterait ferait reculer sa règle.
   ======================================================================= */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { sansCommentaires } from "./_sans-commentaires";

const RACINE = path.join(__dirname, "..");
const LE_CHAMP = "src/components/atlas/ChampRecherche.tsx";

/** Ce qui y échappe encore, chacun avec sa raison. Elle ne doit que raccourcir. */
const ECHAPPENT_ENCORE: Record<string, string> = {};

const CHAMP_DE_RECHERCHE_TSX = /\b(?:type="search"|inputMode="search")/;

function fichiers(dossier: string, extension: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin, extension));
    else if (nom.endsWith(extension)) sortie.push(chemin);
  }
  return sortie;
}

/** Les écrans qui dessinent leur propre champ de recherche, hors du composant. */
function rechercheshorsDuComposant(): string[] {
  return fichiers(path.join(RACINE, "src"), ".tsx")
    .map((f) => path.relative(RACINE, f).split(path.sep).join("/"))
    .filter((relatif) => relatif !== LE_CHAMP)
    .filter((relatif) => sansCommentaires(readFileSync(path.join(RACINE, relatif), "utf8")).some((l) => CHAMP_DE_RECHERCHE_TSX.test(l)));
}

/**
 * Dans une planche, chaque champ de recherche doit être DANS la barre du kit.
 * Un champ de recherche se reconnaît à ce qu'il annonce : `type="search"`,
 * `inputmode="search"`, ou un nom qui commence par « Chercher ».
 */
export function recherchesHorsDeLaBarre(html: string): string[] {
  const fautes: string[] = [];
  const entrees = html.matchAll(/<input\b[^>]*>/g);
  for (const m of entrees) {
    const balise = m[0];
    const recherche =
      /\btype="search"/.test(balise) ||
      /\binputmode="search"/i.test(balise) ||
      /\b(?:aria-label|placeholder)="Chercher/.test(balise);
    if (!recherche) continue;
    const avant = html.slice(0, m.index ?? 0);
    const ouverture = avant.lastIndexOf('class="champ-recherche');
    const fermeture = Math.max(avant.lastIndexOf("</div>"), avant.lastIndexOf("</label>"));
    // `atlas-recherche` n'est peint que par `ChampRecherche` : un champ qui la
    // porte EST la barre de l'appli, figée sur une planche posée sur le vrai écran.
    const barreDeLAppli = /\bclass="atlas-recherche\b/.test(balise);
    const dansLaBarre = barreDeLAppli || (ouverture >= 0 && ouverture > fermeture);
    const enBoite = /\bclass="[^"]*\b(?:champ-saisie|case-saisie)\b/.test(balise);
    if (!dansLaBarre || enBoite) fautes.push(balise.slice(0, 120));
  }
  return fautes;
}

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Une seule barre de recherche : celle de l'appli ===\n");

cas("le contrôle des planches sait rougir : la boîte du 31 octobre est refusée", () => {
  const boite =
    '<label class="cherche"><svg class="ico"><use href="#i-recherche"/></svg><input class="champ-saisie" placeholder="Un nom de client" aria-label="Chercher un client"></label>';
  assert.equal(recherchesHorsDeLaBarre(boite).length, 1, "la planche en boîte du 31 octobre passait : le contrôle ne voit rien");
  const juste =
    '<div class="champ-recherche"><svg class="ico"><use href="#i-loupe"/></svg><input type="text" inputmode="search" placeholder="Un nom de client" aria-label="Chercher un client"></div>';
  assert.equal(recherchesHorsDeLaBarre(juste).length, 0, "la barre du kit est refusée : le contrôle accuse à tort");
  // **Une planche posée sur le VRAI écran figé** (sa demande du 8 novembre
  // 2026 : *« c'est pas la vraie page, donc c'est de la merde »*) porte la
  // barre que `ChampRecherche` a peinte, et elle seule fait `atlas-recherche`.
  const figee =
    '<div class="relative flex items-center gap-[12px] border-b-[1.5px]"><svg></svg><input type="text" inputmode="search" placeholder="Chercher un nom, un titre, un montant" aria-label="Chercher un nom, un titre, un montant" class="atlas-recherche min-w-0 flex-1 border-0 bg-transparent py-[11px] outline-none" value=""></div>';
  assert.equal(recherchesHorsDeLaBarre(figee).length, 0, "la vraie barre de l'appli, figée, est refusée : le contrôle accuse à tort");
  const enBoite = figee.replace('class="atlas-recherche', 'class="atlas-recherche champ-saisie');
  assert.equal(recherchesHorsDeLaBarre(enBoite).length, 1, "la barre de l'appli mise en boîte passait");
});

cas("la barre de l'appli existe, et le kit des planches la porte", () => {
  const composant = readFileSync(path.join(RACINE, LE_CHAMP), "utf8");
  assert.match(composant, /export function ChampRecherche/, "ChampRecherche a disparu : sur quoi s'aligner ?");
  const kit = readFileSync(path.join(RACINE, "appli/soignee/kit.css"), "utf8");
  assert.match(kit, /\.champ-recherche\s*\{[^}]*border-bottom:\s*1\.5px solid/, "le kit n'a plus la barre de l'appli (.champ-recherche, filet de 1,5 point)");
});

cas("dans l'appli, aucun écran ne dessine sa propre barre", () => {
  const horsDuComposant = rechercheshorsDuComposant();
  const nouveaux = horsDuComposant.filter((f) => !(f in ECHAPPENT_ENCORE));
  assert.deepEqual(
    nouveaux,
    [],
    `ces écrans dessinent leur propre champ de recherche : ${nouveaux.join(", ")}. ` +
      "Ils doivent passer par ChampRecherche (src/components/atlas/ChampRecherche.tsx), sa règle du 22 septembre 2026."
  );
  const gueris = Object.keys(ECHAPPENT_ENCORE).filter((f) => !horsDuComposant.includes(f));
  assert.deepEqual(gueris, [], `ces écrans passent désormais par ChampRecherche : retirez-les de ECHAPPENT_ENCORE (${gueris.join(", ")}).`);
});

cas("dans les planches, chaque recherche est la barre du kit", () => {
  const fautes: string[] = [];
  for (const fichier of fichiers(path.join(RACINE, "appli/soignee"), ".html")) {
    for (const balise of recherchesHorsDeLaBarre(readFileSync(fichier, "utf8"))) {
      fautes.push(`${path.relative(RACINE, fichier)} : ${balise}`);
    }
  }
  assert.deepEqual(fautes, [], "une planche dessine sa propre barre de recherche :\n    " + fautes.join("\n    "));
});

if (Object.keys(ECHAPPENT_ENCORE).length) {
  console.log(`\n  ${Object.keys(ECHAPPENT_ENCORE).length} écran(s) y échappent encore, nommés avec leur raison :`);
  for (const [f, raison] of Object.entries(ECHAPPENT_ENCORE)) console.log(`      ${f} : ${raison}`);
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Une seule barre de recherche : ${echecs} échec(s).`);
process.exitCode = echecs === 0 ? 0 : 1;
