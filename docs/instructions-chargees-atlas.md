# Les instructions permanentes chargées dans cette session Atlas

Relevé du 14 septembre 2026. Tout ce qui suit est lu dans le dépôt, pas de mémoire.

---

## 1. Le fichier de règles

**Oui, chargé** : `/home/user/Atlas-app/CLAUDE.md`

Il est lu au début de **chaque** conversation, et il en importe cinq autres :

| Fichier | Ce qu'il porte |
|---|---|
| `AGENTS.md` | rien n'est valide sans avoir été éprouvé ; la mémoire du dépôt |
| `.claude/rules/testing.md` | les trois niveaux d'épreuve |
| `.claude/rules/migrations.md` | base habitée, FORCE RLS |
| `.claude/rules/deployment-safety.md` | code et base au même niveau, expand/contract |
| `.claude/rules/regarder-l-ecran.md` | on ouvre l'écran avant d'affirmer quoi que ce soit dessus |

---

## 2. Les trois niveaux d'épreuve

C'est **ce que le lot touche** qui décide, jamais l'habitude.

| Ce que le lot touche | Niveau | Ce qu'on joue |
|---|---|---|
| `docs/`, `appli/`, un `.md` | **1** | rien — relire le rendu suffit |
| `scripts/`, `.claude/`, `.devcontainer/` | **2** | `npm run verifier:avant-fusion` |
| `src/`, `drizzle/`, une pièce partagée | **3** | `npm run verifier:avant-livraison` |

**Le doute tranche vers le haut.**

Une **pièce partagée** — `design-tokens.ts`, `EnTeteEcran`, `globals.css`,
`layout.tsx`, `middleware.ts` — touche tous les écrans : niveau 3, toujours.

**Niveau 1, pendant qu'on écrit** : les suites du domaine touché, à la main —
`npx tsx scripts/test-<la-suite>.ts`. Un contrôle joué en boucle sur ce qu'on
vient d'écrire vaut mieux qu'une batterie jouée une fois à la fin.

---

## 3. Quand la batterie complète (~50 min) doit tourner

**Elle est obligatoire :**

- dès que le lot touche `src/` ou `drizzle/` ;
- **avant la première poussée d'un lot**, sur son propre code ;
- c'est elle, et elle seule, qui autorise une livraison sur `main`.

**Elle ne se lance PAS :**

- pour vérifier des rouges connus — on rejoue les suites concernées
  (`npm run test:e2e -- --seulement "…"`), votre consigne du 13 septembre ;
- après une fusion, si le code arrivé ne touche pas ce qu'on vient de faire ;
- quand rien n'a bougé depuis son dernier vert, ou quand seules des suites ont
  changé : elle refuse alors d'elle-même et donne les `npx tsx` à jouer.

**Ce qui ne dépend pas de la bonne volonté :** `scripts/garde-fusion-main.mjs`
calcule le niveau sur le diff et refuse une poussée vers `main` dont le contrôle
n'a pas été joué au vert **sur cet état de l'arbre**.

**Et pendant qu'elle mesure, le dossier se ferme** (`verrou-batterie.mjs` +
`garde-batterie.mjs`) : plus rien ne s'écrit tant qu'elle tourne. Lire reste
possible.

---

## 4. Pourquoi le niveau 3 sur la fiche client

La modification en cours — la porte « Modifier ses coordonnées » — touche
**`src/`** :

| Fichier | |
|---|---|
| `src/app/clients/[id]/coordonnees/page.tsx` | neuf |
| `src/app/clients/[id]/coordonnees/SesCoordonnees.tsx` | neuf |
| `src/app/clients/[id]/coordonnees/actions.ts` | neuf |
| `src/app/clients/[id]/page.tsx` | modifié — la porte |
| `scripts/test-modifier-client-e2e.ts` | neuf |

Deux raisons, et chacune suffirait :

1. **`src/` bouge** — « jamais rien de moins que la batterie complète quand
   `src/` ou `drizzle/` bouge » ;
2. c'est la **première poussée de ce lot**, et la règle vaut sur son propre code.

Le garde-fou la refuserait de toute façon : il lit le diff, pas ce qu'on déclare.

---

## Ce qui a déjà été joué avant elle

- `npx tsc --noEmit` — vert
- `npm run lint` — 0 erreur
- `npm run verifier:memoire` — vert
- `npm run test:e2e -- --seulement "modifier-client"` — **5 cas, 0 échec**
- `npx tsx scripts/test-chartes-lisibles.ts` — vert
- les deux écrans **regardés** (`npm run voir`), et la porte corrigée après :
  écrite en vert pin elle se lisait comme un titre, elle porte l'or.
