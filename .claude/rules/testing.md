# Éprouver — les trois niveaux

Chargé dans **toutes** les sessions Atlas (importé par `CLAUDE.md`).

---

## Compiler n'est pas fonctionner

`tsc` vert ne dit rien du produit. Ce dépôt a livré trois fois du code qui
compilait et que le patron ne pouvait pas utiliser. **Rien n'est terminé tant
que le parcours qu'il fait, lui, n'a pas été joué.**

## Le niveau se choisit sur le RISQUE, pas par habitude

Rejouer soixante suites pour une virgule coûte dix minutes et n'apprend rien ;
n'en jouer aucune sur une migration coûte une soirée. Ce qui décide, c'est **ce
que le lot touche**.

| Ce que le lot touche | Niveau | Ce qu'on joue |
|---|---|---|
| `docs/`, `appli/`, un `.md` | **1** | rien — relire le rendu suffit |
| `scripts/`, `.claude/`, `.devcontainer/` | **2** | `npm run verifier:avant-fusion` |
| `src/`, `drizzle/`, une pièce partagée | **3** | `npm run verifier:avant-livraison` |

Le doute tranche **vers le haut**. Une pièce partagée — `design-tokens.ts`,
`EnTeteEcran`, `globals.css`, `layout.tsx`, `middleware.ts` — touche tous les
écrans : niveau 3, toujours.

**Le niveau n'est pas déclaratif** : `scripts/garde-fusion-main.mjs` le calcule
sur le diff et refuse la fusion si le contrôle correspondant n'a pas été joué au
vert sur CET état de l'arbre.

## Niveau 1 — pendant qu'on écrit

Les suites du domaine touché, à la main. `npx tsx scripts/test-<la-suite>.ts`.
Un contrôle joué en boucle sur ce qu'on vient d'écrire vaut mieux qu'une
batterie jouée une fois à la fin.

## Niveau 2 — avant de fusionner

```bash
npm run verifier:avant-fusion
```

Types, lint, mémoire du dépôt, et les suites que le lot met en cause. C'est le
minimum avant que quoi que ce soit parte vers `main`.

## Niveau 3 — quand le risque le justifie

```bash
npm run verifier:avant-livraison
```

Obligatoire dès que le lot touche `src/` ou `drizzle/`. **Le prévenir avant de
la lancer** — ses sessions partagent son dossier (`CLAUDE.md` §5).

## Une régression découverte donne TOUJOURS un test

Dans cet ordre, sans raccourci :

1. **reproduire** — dans les conditions du patron, pas dans les nôtres ;
2. **un test ROUGE** qui reproduit exactement le cas ;
3. **la correction**, minimale et à la racine ;
4. **le test VERT** ;
5. **le test RESTE**, pour toujours, dans la suite.

Un correctif sans test rouge d'abord n'est pas un correctif : c'est une
supposition qui a l'air de marcher.

**Et un contrôle doit savoir échouer.** Le confronter à l'état dégradé qu'il
prétend détecter, et le voir rougir. Un contrôle jamais vu rouge ne prouve rien
— celui de la migration 0087 est passé au vert sur une correction qui ne
réparait rien, faute de porter la RLS (`ARCHITECTURE.md` §358).

## Avant une fusion : les parcours concernés

Pas « les tests passent » — **les écrans touchés, regardés**. Quatre défauts
réels de ce dépôt sont sortis d'une capture, aucun d'un test vert.

## Hors périmètre : on ne touche pas

Aucun refactoring, aucun nettoyage, aucune amélioration annexe dans un lot qui
n'en demandait pas. Un lot qui fait deux choses ne peut plus être défait pour
une seule.
