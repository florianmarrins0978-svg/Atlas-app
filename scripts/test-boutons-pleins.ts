import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * L'APLAT DES BOUTONS QU'ON APPUIE — un seul jeton, aucun reste.
 *
 * *Sa décision du 3 septembre 2026, sur `appli/boutons-verts.html` :* **« verdict
 * la D à plat sans brillant, donc tout ce qui est bouton cliquable tu remplaces
 * par la D »**, puis **« ne fais pas de bricolage, remplace correctement les
 * lignes de code, ne fais pas de pansement »**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE GARDE, ET QU'AUCUN AUTRE CONTRÔLE NE VOIT.**
 *
 * Le changement a consisté à remplacer `colors.rust` par `colors.plein` sur
 * quarante-six aplats de boutons, à la main de haut en bas. Un seul oublié ne
 * casse rien : il compile, il passe le lint, la page s'affiche — et il reste
 * **vert pin au milieu des verts sauge**, sur un écran que personne ne rouvrira
 * avant des semaines. C'est exactement le genre de reste qu'un « pansement »
 * laisse derrière lui, et c'est ce qu'il a demandé d'éviter.
 *
 * La règle gardée ici est donc mécanique et sans exception : **un élément qui
 * porte `atlas-plein` ne peint jamais son fond avec `colors.rust`.**
 *
 * ─── CE QUI N'EST PAS VISÉ, ET POURQUOI ──────────────────────────────────────
 *
 *   · **`rust` lui-même n'a pas bougé.** Il teinte des TEXTES, des icônes, des
 *     liserés et les fonds pâles `rustTint` : le confondre avec l'aplat des
 *     boutons aurait reverdi la moitié des écrans. C'est l'arbitrage du 31 août,
 *     et `scripts/test-chartes.ts` le garde de son côté.
 *   · **Les boutons CREUX** — sa consigne du 31 août : *« surtout pas ceux qui
 *     sont creux »*. Ils n'ont pas d'aplat ; ils ne sont donc jamais concernés.
 *   · **`src/app/design/*`**, hors produit et découplé depuis le 1ᵉʳ août.
 *   · **La note vocale** (`AnneauNoteVocale.tsx`) : *« ne touche pas à la note
 *     vocale »*, le 3 septembre. Sa tasse a sa propre matière dans `globals.css`
 *     et ne passe par aucun de ces jetons.
 *
 * **Elle sait échouer.** Vérifiée en remettant `colors.rust` sur le fond de
 * `PrimaryButton` : la suite le nomme, avec son fichier et sa ligne.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let passes = 0;
let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    passes++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

console.log("=== L'aplat des boutons pleins ===\n");

/** Ce que l'écran écrit pour peindre un fond. */
const FOND = /(?:backgroundColor|background):\s*colors\.rust\b/;

const HORS_SUJET = [/[\\/]design[\\/]/, /AnneauNoteVocale\.tsx$/];

const ECRANS = execSync('git ls-files "src/**/*.tsx"', { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !HORS_SUJET.some((r) => r.test(f)));

essai("aucun bouton plein n'est resté au vert pin", () => {
  // **On remonte de HUIT lignes, pas d'une.** Le style et la classe sont
  // rarement voisins : entre les deux vivent un `onClick`, un `disabled`, un
  // `data-atlas` et deux lignes de `className`. Une fenêtre d'une ligne ne
  // verrait presque rien et rendrait un vert qui ne prouve rien.
  const restes: string[] = [];
  for (const fichier of ECRANS) {
    const lignes = readFileSync(fichier, "utf8").split("\n");
    for (let i = 0; i < lignes.length; i++) {
      if (!FOND.test(lignes[i])) continue;
      const contexte = lignes.slice(Math.max(0, i - 8), i + 1).join("\n");
      if (!/atlas-plein/.test(contexte)) continue;
      restes.push(`${fichier}:${i + 1} — ${lignes[i].trim()}`);
    }
  }
  assert.deepEqual(
    restes,
    [],
    "Ces boutons pleins peignent encore leur fond avec `colors.rust`. Ils " +
      "resteront vert pin au milieu des verts sauge, sans que rien ne le " +
      "dise :\n      " + restes.join("\n      ")
  );
});

/**
 * ═══ L'INVENTAIRE DES APLATS DE `rust` QUI RESTENT ═══════════════════════════
 *
 * **Posé le 4 septembre 2026, parce que la règle du dessus ne l'a pas vu.**
 * Il a rouvert « Terminés » et écrit : *« j'avais demandé à changer tous les
 * boutons en vert clair, or si tu regardes la page terminé ils n'ont pas
 * changé — et vérifie s'il n'y a pas le problème ailleurs »*. Il y en avait
 * douze ailleurs.
 *
 * **LE TROU ÉTAIT DANS LE CONTRÔLE, pas dans le balayage.** La règle du dessus
 * ne regarde QUE les éléments portant déjà `atlas-plein` — c'est-à-dire ceux
 * que le balayage du 3 septembre avait trouvés. Un bouton oublié était oublié
 * des deux côtés à la fois : pas de classe, donc pas de contrôle, donc pas de
 * rouge. Le garde-fou ne pouvait rougir que là où il n'y avait plus rien à
 * attraper.
 *
 * **D'où le sens inverse.** On ne demande plus « ce bouton est-il au bon
 * vert ? » — on demande **« cet aplat de `rust` a-t-il le droit d'exister ? »**,
 * et la réponse doit être écrite ici, avec sa raison. La liste ne s'allonge pas
 * toute seule : un aplat neuf et non déclaré fait rougir la suite.
 *
 * **Ce qui a le droit d'y figurer, et rien d'autre :** ce qui n'est pas un
 * bouton. Un interrupteur dit un ÉTAT, une coche dit un fait, une barre de
 * progression dit une avancée — aucun des trois ne se « presse » pour agir, et
 * `rust` reste leur couleur (`ARCHITECTURE.md` §239). Dès qu'on presse pour
 * faire quelque chose, c'est `colors.plein`.
 */
const APLATS_DECLARES: { fichier: string; motif: RegExp; pourquoi: string }[] = [
  {
    fichier: "src/app/chantiers/[id]/export/EnvoiAuClient.tsx",
    motif: /autreDateAutorisee \? colors\.rust/,
    pourquoi: "un interrupteur : il dit un état, on ne le presse pas pour agir",
  },
  {
    fichier: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx",
    motif: /animate-pulse/,
    pourquoi: "la pastille qui bat pendant l'enregistrement — un témoin, pas un bouton",
  },
  {
    fichier: "src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx",
    motif: /width: `\$\{progression\}%`/,
    pourquoi: "la barre d'avancement de l'envoi",
  },
  {
    fichier: "src/app/clients/[id]/SupprimerCeClient.tsx",
    motif: /sauvegarde \? colors\.rust/,
    pourquoi: "la coche de « j'ai sauvegardé ailleurs » — une marque, pas un aplat de bouton",
  },
  {
    fichier: "src/app/paysage/arrosage/ArrosageClient.tsx",
    motif: /plan\.couleurs\[i\] \?\? colors\.rust/,
    pourquoi: "la couleur de repli d'un réseau d'arrosage sur le plan",
  },
  {
    fichier: "src/app/paysage/fiche/[id]/FicheChantierClient.tsx",
    motif: /l\.faite \? colors\.rust/,
    pourquoi: "la coche d'une prestation faite",
  },
  {
    fichier: "src/app/paysage/fiche/[id]/FicheChantierClient.tsx",
    motif: /\? \{ backgroundColor: colors\.rust \}/,
    pourquoi: "l'interrupteur « temps visible », nommément écarté le 3 septembre",
  },
  {
    fichier: "src/app/reglages/agenda/AgendaAppleClient.tsx",
    motif: /etat\.ecritureActive \? colors\.rust/,
    pourquoi: "un interrupteur",
  },
  {
    fichier: "src/app/reglages/documents/DocumentsClient.tsx",
    motif: /allume \? colors\.rust/,
    pourquoi: "un interrupteur",
  },
  {
    fichier: "src/app/reglages/notifications/NotificationsClient.tsx",
    motif: /allume \? colors\.rust/,
    pourquoi: "un interrupteur",
  },
  {
    fichier: "src/app/reglages/prix/GrillesPrixClient.tsx",
    motif: /forme === f\.valeur \? colors\.rust/,
    pourquoi: "la pastille d'un choix en liste — une marque de 18 px, pas une capsule",
  },
  {
    fichier: "src/app/termines/tva/RegimeTva.tsx",
    motif: /choisie === o\.valeur \? colors\.rust/,
    pourquoi: "la même pastille de choix en liste",
  },
];

/** Un aplat écrit dans un écran, quelle que soit la propriété employée. */
const APLAT = /(?:backgroundColor|background):\s*[^,;}]*\bcolors\.rust\b/;

essai("aucun aplat de `rust` non déclaré ne subsiste dans un écran", () => {
  const inconnus: string[] = [];
  for (const fichier of ECRANS) {
    // **Découpé sur \r?\n, et ce n'est pas une coquetterie.** La moitié de ce
    // dépôt est écrite sous Windows : découper sur \n seul laisse un \r
    // invisible en fin de ligne, contre lequel toute ancre échoue — et le
    // contrôle accuse alors une ligne parfaitement déclarée.
    const lignes = readFileSync(fichier, "utf8").split(/\r?\n/);
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      // Les commentaires de ce dépôt CITENT le code qu'ils remplacent : sans
      // cela, expliquer pourquoi un aplat est parti ferait rougir le contrôle,
      // et l'on cesserait d'expliquer.
      const nu = ligne.trim();
      if (nu.startsWith("//") || nu.startsWith("*")) continue;
      if (!APLAT.test(ligne)) continue;
      const chemin = fichier.split("\\").join("/");
      const declare = APLATS_DECLARES.some(
        (d) => d.fichier === chemin && d.motif.test(ligne)
      );
      if (!declare) inconnus.push(`${chemin}:${i + 1} — ${nu}`);
    }
  }
  assert.deepEqual(
    inconnus,
    [],
    "Ces aplats peignent encore le vert pin. Si c'est un BOUTON, il doit " +
      "passer à `colors.plein` ; si c'est un état — interrupteur, coche, " +
      "barre —, il se déclare dans `APLATS_DECLARES` avec sa raison :\n      " +
      inconnus.join("\n      ")
  );
});

essai("l'inventaire ne garde aucune ligne morte", () => {
  // **Une déclaration périmée est pire qu'absente.** Elle donne l'illusion
  // qu'un cas est couvert, et le jour où l'aplat revient ailleurs, personne ne
  // le cherche. Une entrée qui ne vise plus rien se supprime.
  const orphelines = APLATS_DECLARES.filter((d) => {
    const source = ECRANS.includes(d.fichier)
      ? readFileSync(d.fichier, "utf8")
      : "";
    return !source.split(/\r?\n/).some((l) => APLAT.test(l) && d.motif.test(l));
  }).map((d) => `${d.fichier} — ${d.pourquoi}`);
  assert.deepEqual(
    orphelines,
    [],
    "Ces déclarations ne visent plus aucun aplat :\n      " + orphelines.join("\n      ")
  );
});

essai("l'action principale de l'application porte le jeton, pas une couleur", () => {
  // **`PrimaryButton` mérite son contrôle à lui.** Il n'existe qu'UNE forme
  // d'action principale dans Atlas — c'est le sujet de son propre fichier —, et
  // dix-sept écrans en dépendent. Si lui seul repassait au vert pin, ce sont
  // dix-sept écrans qui changeraient d'un coup, et la règle générale au-dessus
  // ne le verrait que si sa classe restait à portée de vue.
  const source = readFileSync("src/components/atlas/PrimaryButton.tsx", "utf8");
  assert.ok(
    /backgroundColor:\s*colors\.plein\b/.test(source),
    "`PrimaryButton` ne peint plus son aplat avec `colors.plein`"
  );
  assert.ok(
    !FOND.test(source),
    "`PrimaryButton` peint encore un fond avec `colors.rust`"
  );
});

essai("le jeton existe, et son repli est le vert qu'il a retenu", () => {
  // **Le repli n'est pas une formalité.** Une page rendue hors du gabarit — un
  // courriel, un document, un écran d'erreur servi sans les variables — ne
  // reçoit aucune charte. Sans repli, `var(--atlas-plein)` ne peint RIEN : le
  // bouton devient transparent, avec de la crème écrite dessus. Invisible en
  // développement, où le gabarit est toujours là.
  const jetons = readFileSync("src/lib/design-tokens.ts", "utf8");
  const ligne = jetons.match(/plein:\s*"([^"]+)"/);
  assert.ok(ligne, "`colors.plein` a disparu de `design-tokens.ts`");
  assert.equal(
    ligne![1],
    "var(--atlas-plein, #7d9a6d)",
    `le repli de \`plein\` n'est plus le vert du 3 septembre : ${ligne![1]}`
  );
});

console.log(`\nL'aplat des boutons pleins — ${echecs} échec(s), ${passes} réussi(s).`);
process.exit(echecs === 0 ? 0 : 1);
