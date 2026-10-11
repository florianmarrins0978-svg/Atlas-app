/* =======================================================================
   PAS DE SPAGHETTIS — les couches vont dans UN seul sens.

   **Sa règle du 8 septembre 2026 :** *« je ne veux pas de spaghettis, le
   code doit être structuré proprement ! Il ne doit pas y avoir de liens
   dans tous les sens. Si demain j'ai un problème et que je dois faire
   appel à un développeur, il faut qu'il comprenne facilement comment
   fonctionne le code. »*

   **Ce qui rend un code illisible n'est pas sa taille, c'est le SENS de
   ses liens.** Trois couches qui s'appellent en boucle demandent de tout
   lire pour comprendre une ligne ; trois couches qui ne s'appellent que
   vers le bas se lisent par étages, et l'on peut n'en ouvrir qu'un.

   Les étages d'Atlas, du bas vers le haut :

     src/lib/        les règles pures — aucune base, aucun écran
     src/server/     les dépôts, l'IA, les PDF — parlent à la base
     src/components/ ce qui se dessine, réutilisable
     src/app/        les écrans, qui assemblent

   **Une flèche ne remonte jamais.** `lib` ignore tout de `server` ; ni
   `lib` ni `server` ne connaissent d'écran. C'est ce qui permet
   d'éprouver une règle métier sans base (`CLAUDE.md` §3), et à un
   développeur étranger de lire `lib/` sans rien ouvrir d'autre.

   **Les `import type` ne comptent pas** : ils disparaissent à la
   compilation, ne créent aucun lien à l'exécution, et interdire à une
   règle de nommer la forme d'une donnée reviendrait à la recopier —
   c'est-à-dire à créer la divergence que `CLAUDE.md` §3 refuse.

   **La dette d'aujourd'hui est NOMMÉE, avec sa cause unique**, et cette
   liste ne peut que rétrécir : une entrée de plus, et le contrôle
   demande qu'on la justifie sous les yeux de tous.
   ======================================================================= */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(__dirname, "..");

type Regle = {
  couche: string;
  interdits: string[];
  pourquoi: string;
};

const REGLES: Regle[] = [
  {
    couche: "src/lib",
    interdits: ["@/server", "@/app", "@/components"],
    pourquoi:
      "les règles pures s'éprouvent sans base ni écran ; une seule remontée et il faut monter une base pour tester une addition",
  },
  {
    couche: "src/server",
    interdits: ["@/app", "@/components"],
    pourquoi: "un dépôt qui connaît un écran fait dépendre les données de la façon de les montrer",
  },
  {
    couche: "src/components",
    interdits: ["@/server"],
    pourquoi:
      "un composant qui interroge la base ne se réutilise plus ailleurs — sauf composant SERVEUR, reconnu plus bas",
  },
];

/**
 * **La dette relevée le 8 septembre 2026 a été réglée le jour même.**
 *
 * `disponibilites.ts` était rangé sous `src/server/` alors qu'il ne fait aucune
 * requête : quatre fichiers d'étages inférieurs remontaient donc y chercher des
 * durées et des libellés. Le fichier a été DÉPLACÉ dans `src/lib/` — descendre
 * la règle plutôt que remonter le lien (`CLAUDE.md` §4 sexies).
 *
 * **La liste est vide, et doit le rester.** Une entrée qui s'ajoute est une
 * dette qui commence, et le contrôle en réclame la raison sous les yeux de tous.
 */
const DETTE: { fichier: string; pourquoi: string }[] = [];

function fichiersDe(dossier: string): string[] {
  const sortie: string[] = [];
  const marcher = (d: string) => {
    for (const entree of readdirSync(d)) {
      const complet = path.join(d, entree);
      if (statSync(complet).isDirectory()) marcher(complet);
      else if (/\.(ts|tsx)$/.test(complet)) sortie.push(path.relative(RACINE, complet).split(path.sep).join("/"));
    }
  };
  marcher(path.join(RACINE, dossier));
  return sortie;
}

/**
 * Un composant SERVEUR a le droit de parler à la base : c'est sa raison
 * d'être dans ce cadre. On le reconnaît à ce qu'il fait, pas à son nom —
 * un nom se change, `next/headers` non.
 */
function estComposantServeur(contenu: string): boolean {
  return /from\s+["']next\/headers["']|["']use server["']/.test(contenu);
}

/** Isolé pour être éprouvé sans dépôt (`CLAUDE.md` §5). */
export function traversees(
  fichiers: { fichier: string; contenu: string }[],
  regles: Regle[] = REGLES
): { fichier: string; vers: string; ligne: string }[] {
  const fautes = [];
  for (const { fichier, contenu } of fichiers) {
    const regle = regles.find((r) => fichier.startsWith(r.couche + "/"));
    if (!regle) continue;
    if (regle.couche === "src/components" && estComposantServeur(contenu)) continue;

    for (const ligne of contenu.split("\n")) {
      // `import type { X } from "@/server/…"` s'efface à la compilation.
      if (/^\s*import\s+type\s/.test(ligne)) continue;
      // **Les deux écritures, et la seconde manquait.** `src/lib/absences-equipe.ts`
      // remontait vers `server` par « ../server/… » : le contrôle ne visait que
      // « @/server/… » et l'a laissée passer. Une règle qui ne tient qu'une
      // écriture sur deux ne tient rien.
      const cible = regle.interdits.find((i) => {
        const dossier = i.replace("@/", "");
        return (
          new RegExp(`from\\s+["']${i}/`).test(ligne) ||
          new RegExp(`from\\s+["'](?:\\.\\./)+${dossier}/`).test(ligne)
        );
      });
      if (!cible) continue;
      // Un import mêlé — `import { a, type B }` — reste un vrai lien : la
      // valeur `a` sera bien chargée à l'exécution.
      fautes.push({ fichier, vers: cible, ligne: ligne.trim() });
    }
  }
  return fautes;
}

console.log("=== Les couches vont dans un seul sens ===\n");

// ── 1. Le détecteur, éprouvé sur des cas écrits à la main ────────────────
const CAS = [
  { fichier: "src/lib/regle.ts", contenu: 'import { lire } from "@/server/depot";' },
  { fichier: "src/lib/propre.ts", contenu: 'import { autre } from "@/lib/autre";' },
  { fichier: "src/lib/type-seul.ts", contenu: 'import type { Forme } from "@/server/depot";' },
  { fichier: "src/components/X.tsx", contenu: 'import { lire } from "@/server/depot";' },
  { fichier: "src/lib/relatif.ts", contenu: 'import { lire } from "../server/depot";' },
  {
    fichier: "src/components/Garde.tsx",
    contenu: 'import { headers } from "next/headers";\nimport { lire } from "@/server/depot";',
  },
];
const vues = traversees(CAS);
assert.deepEqual(
  vues.map((v) => v.fichier),
  ["src/lib/regle.ts", "src/components/X.tsx", "src/lib/relatif.ts"],
  `détecteur faux : ${vues.map((v) => v.fichier).join(", ")}`
);
console.log("  ok    une remontée est vue (« @/server » comme « ../server ») ; un type et un composant serveur, non");

// ── 2. Le dépôt lui-même ────────────────────────────────────────────────
const fichiers = fichiersDe("src").map((fichier) => ({
  fichier,
  contenu: readFileSync(path.join(RACINE, fichier), "utf8"),
}));
assert.ok(fichiers.length > 100, "trop peu de fichiers lus : la mesure n'a pas eu lieu");

const fautes = traversees(fichiers);
const nouvelles = fautes.filter((f) => !DETTE.some((d) => d.fichier === f.fichier));
const attendues = fautes.filter((f) => DETTE.some((d) => d.fichier === f.fichier));

console.log(`\n  ${fichiers.length} fichiers lus. Dette connue : ${DETTE.length} fichier(s).`);
for (const d of DETTE) {
  const encore = fautes.some((f) => f.fichier === d.fichier);
  console.log(`  ${encore ? "·" : "✓ RÉGLÉE —"} ${d.fichier} (${d.pourquoi})`);
}

if (nouvelles.length > 0) {
  console.error("\n❌ Nouvelle(s) remontée(s) de couche :\n");
  for (const f of nouvelles) {
    console.error(`   ${f.fichier}  →  ${f.vers}`);
    console.error(`     ${f.ligne}`);
    const regle = REGLES.find((r) => f.fichier.startsWith(r.couche + "/"))!;
    console.error(`     ${regle.pourquoi}\n`);
  }
  console.error("   Descendre la règle plutôt que remonter le lien (CLAUDE.md §4 sexies).");
  process.exit(1);
}

// Une dette réglée doit disparaître de la liste, sinon la liste ment.
const reglees = DETTE.filter((d) => !fautes.some((f) => f.fichier === d.fichier));
assert.equal(
  reglees.length,
  0,
  `dette réglée mais toujours inscrite : ${reglees.map((r) => r.fichier).join(", ")} — retirer ces lignes de DETTE`
);

console.log(`\n✅ Aucune remontée nouvelle (${attendues.length} ligne(s) de dette connue).`);
