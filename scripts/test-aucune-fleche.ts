/* =======================================================================
   Aucune flèche décorative dans les écrans.

   **Sa règle, redite le 25 août 2026 devant « Créer la facture → » :**
   *« Retire la flèche ! Il m'avait semblé t'avoir demandé de supprimer
   toutes les flèches de l'application ! »* — et il avait raison de le
   redire : la première fois, c'était le 25 août au matin (`CLAUDE.md`
   §3), et vingt-huit libellés en portaient encore une le soir.

   **Pourquoi un contrôle plutôt qu'une relecture.** Une règle de style
   qui ne vit que dans un document se perd au troisième écran écrit par
   une autre session. Celle-ci s'est déjà perdue deux fois — la seconde
   lui a coûté une capture d'écran depuis son téléphone, entre deux
   chantiers.

   **Ce qui reste autorisé, et pourquoi.** Une flèche qui porte une VRAIE
   fonction n'est pas un ornement : le feuilletage d'un calendrier, le
   « avant → après » d'une correction de devis. Elles sont nommées une
   par une plus bas, avec leur raison. Une flèche non nommée est refusée
   — c'est-à-dire que la liste ne s'allonge pas toute seule.
   ======================================================================= */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(__dirname, "..", "src");

/**
 * Tout ce qui pointe : la ponctuation, pas les mots.
 *
 * Les guillemets français « » n'y sont PAS, alors qu'ils se ressemblent :
 * ils portent la parole du patron dans la moitié des fichiers de ce dépôt,
 * et les inclure ferait rougir le contrôle des centaines de fois — donc
 * l'ignorer, donc perdre le garde-fou. Les chevrons simples ‹ ›, eux, y
 * sont : c'est la forme que prenait « Modifier mon devis › ».
 */
const FLECHES = /[→←↑↓⇒⇐➔⟶‹›▸▶◂◀]/u;

/**
 * Les seules flèches qui restent, chacune avec sa fonction.
 *
 * Le motif vise la LIGNE, pas le fichier entier : ajouter un libellé
 * fléché dans un fichier déjà cité ne passerait pas pour autant.
 */
const AUTORISEES: { fichier: string; motif: RegExp; pourquoi: string }[] = [
  {
    fichier: "src/components/atlas/Calendrier.tsx",
    motif: /^\s*[‹›]\s*$/,
    pourquoi: "feuilleter les mois — le chevron EST le geste, il ne décore rien",
  },
  {
    fichier: "src/components/atlas/MoisCharge.tsx",
    motif: /signe="[‹›]"/,
    pourquoi: "même feuilletage, autre écran",
  },
  {
    fichier: "src/app/planning/PlanningClient.tsx",
    motif: /(signe="[‹›]"|^\s*[‹›]\s*$)/,
    pourquoi: "feuilleter les semaines du planning",
  },
  {
    fichier: "src/app/termines/ListeTermines.tsx",
    motif: /sens === "passe" \? "‹" : "›"/,
    pourquoi: "feuilleter les chantiers terminés",
  },
  {
    fichier: "src/app/termines/tva/CalendrierPeriodes.tsx",
    motif: /^\s*[‹›]\s*$/,
    pourquoi: "feuilleter les années du calendrier de TVA",
  },
  {
    fichier: "src/components/atlas/MoisCharge.tsx",
    motif: /← Aujourd/,
    pourquoi: "revenir au mois courant — la flèche EST le retour, elle ne suit pas un libellé",
  },
  {
    fichier: "src/app/paysage/arrosage/DiscuterLePlan.tsx",
    motif: /^\s*↑\s*$/,
    pourquoi:
      "le rond d'envoi de la discussion : la flèche est TOUT le bouton, comme dans une messagerie — il n'y a pas de libellé à décorer",
  },
  {
    fichier: "src/lib/retouches-devis.ts",
    motif: /detail:/,
    pourquoi: "« 250 € → 350 € » : la flèche dit avant/après, elle ne décore pas",
  },
];

/** Les fichiers qui ne s'affichent jamais : consignes envoyées à l'IA, journal du serveur. */
const HORS_ECRAN = [
  "src/server/ai/services/retouches-devis-service.ts",
  "src/lib/consigne-metier.ts",
  "src/server/db/seed.ts",
];

/**
 * Retire les commentaires, y compris ceux de JSX (`{/* … *\/}`).
 *
 * Sans cela, le contrôle rougirait sur les explications de ce dépôt —
 * qui citent les libellés fléchés d'hier pour dire pourquoi ils sont
 * partis. Un contrôle qui interdit d'expliquer se fait contourner.
 */
function sansCommentaires(source: string): string[] {
  const lignes = source.split("\n");
  let dansBloc = false;
  return lignes.map((ligne) => {
    let sortie = "";
    let i = 0;
    while (i < ligne.length) {
      if (dansBloc) {
        const fin = ligne.indexOf("*/", i);
        if (fin === -1) return sortie;
        dansBloc = false;
        i = fin + 2;
        continue;
      }
      if (ligne.startsWith("//", i)) return sortie;
      if (ligne.startsWith("/*", i)) {
        dansBloc = true;
        i += 2;
        continue;
      }
      sortie += ligne[i];
      i++;
    }
    return sortie;
  });
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

console.log("=== Aucune flèche décorative dans les écrans ===\n");

const coupables: string[] = [];
let lignesLues = 0;

for (const chemin of fichiers(RACINE)) {
  const relatif = path.relative(path.join(__dirname, ".."), chemin).replace(/\\/g, "/");
  if (HORS_ECRAN.includes(relatif)) continue;

  const lignes = sansCommentaires(readFileSync(chemin, "utf8"));
  lignesLues += lignes.length;

  lignes.forEach((ligne, i) => {
    if (!FLECHES.test(ligne)) return;
    const permis = AUTORISEES.some((a) => a.fichier === relatif && a.motif.test(ligne));
    if (!permis) coupables.push(`${relatif}:${i + 1} — ${ligne.trim()}`);
  });
}

/* **Un contrôle qui ne mesure rien rend un vert qui ne prouve rien**
   (`CLAUDE.md` §5). Si la lecture des fichiers échouait, la liste des
   coupables serait vide et la suite passerait au vert sans avoir rien
   regardé. */
assert.ok(lignesLues > 10_000, `seulement ${lignesLues} lignes lues : la lecture de src/ a échoué`);

assert.equal(
  coupables.length,
  0,
  `Des flèches restent à l'écran — il les a fait retirer deux fois :\n  ` +
    coupables.join("\n  ") +
    `\n\nUne flèche qui porte une vraie fonction (feuilletage, avant/après) s'ajoute\n` +
    `à AUTORISEES, en haut de ce fichier, AVEC sa raison. Une flèche au bout d'un\n` +
    `bouton ou d'un lien se retire : le bouton n'a pas besoin d'elle pour dire\n` +
    `qu'on l'appuie.`,
);

console.log(`✅ ${lignesLues.toLocaleString("fr")} lignes lues, ${AUTORISEES.length} flèches fonctionnelles nommées, aucune décorative.`);
console.log(`   Regex de recherche : ${FLECHES.source}`);
