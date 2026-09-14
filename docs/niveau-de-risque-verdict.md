# Niveau de test par le risque — lecture de la proposition

**Date :** 14 septembre 2026 · **Objet :** remplacer « tout changement dans
`src/` = batterie complète » par un niveau calculé sur le risque réel.

---

## 1. Le constat est exact

La règle actuelle vit dans `scripts/_niveau-de-risque.mjs` :

```js
if (/^(src|drizzle)\//.test(c) || c === "package.json" || c === "next.config.ts") return 3;
```

Un mot changé dans un écran déclenche donc la batterie complète (~50 min).

**Mesure faite sur le dépôt (graphe d'imports, 14 septembre 2026) :**

| | |
|---|---|
| fichiers dans `src/` | **697** |
| écrans (`page` / `layout` / `route`) | **94** |
| fichiers qui n'atteignent **0 ou 1** écran | **342 — soit 49 %** |
| fichiers qui atteignent **10 écrans ou plus** | **189** |

La moitié de `src/` est effectivement locale. Le grief est fondé.

---

## 2. Ce qui est refusé dans la proposition, et pourquoi

### 2.1 La « liste de fichiers centraux connus » — refusée

Une liste tenue à la main pourrit, et son erreur est **silencieuse**.

| Fichier | Écrans réellement atteints | Sur une liste ? |
|---|---|---|
| `src/lib/design-tokens.ts` | 69 | oui |
| `src/lib/civilite.ts` | **64** | **non** |
| `src/lib/acces-roles.ts` | 65 | non |
| `src/app/chantiers/nouveau/FormulaireNouveauChantier.tsx` | 3 | non |

`civilite.ts` touche 64 écrans sur 94 et ne figure dans aucune liste du dépôt.
Une règle qui repose sur une liste classerait ce changement « local ».

### 2.2 Niveau 1 pour du « visuel local » dans `src/` — refusé

`typecheck`, `lint`, `test-aucune-fleche`, `test-chartes-lisibles`,
`test-pas-de-pansement`, `test-couches`, `test-pas-de-code-mort` coûtent des
**secondes**, pas des minutes. Les sauter ne fait gagner aucun temps mesurable
et rouvre des défauts déjà payés (le mode nuit illisible du 22 août 2026).

Le niveau 1 reste donc ce qu'il est : `docs/`, `appli/`, un `.md`. Rien de
`src/` n'y descend.

### 2.3 Niveau 2 = types + lint + suites ciblées — insuffisant

C'est exactement ce qui a coûté vingt allers-retours sur
« Invalid Server Actions request. » : tous les voyants étaient verts, parce
qu'aucun contrôle ne parcourait ce que l'utilisateur parcourt.

Une action serveur neuve sans **aucun passage navigateur réel** n'est pas
éprouvée. Le niveau 2 appliqué au produit doit donc porter, en plus :

- les suites e2e des écrans réellement atteints ;
- un regard sur ces écrans (`npm run voir -- /<écran>`).

### 2.4 « Claude annonce Risque / Niveau / Raison » — refusé comme mécanisme

Si c'est la session qui écrit la ligne, le niveau redevient **déclaratif** —
c'est précisément ce que la proposition dit vouloir éviter. La ligne doit être
**calculée et imprimée par le garde-fou**, à partir du diff. Elle est une
sortie, jamais une entrée.

---

## 3. Ce qui est proposé à la place

**Le rayon d'impact se calcule sur le graphe d'imports inverse.** Pour chaque
fichier modifié : quels écrans finissent par en dépendre. C'est objectif, non
déclarable, et il n'y a aucune liste à tenir.

| Ce que le lot touche | Niveau exigé |
|---|---|
| `drizzle/`, authentification, RLS, `withEntreprise`, `middleware`, `layout.tsx` racine, `package.json`, `next.config.ts` | **3** — leur impact ne vit pas dans le graphe d'imports, mais dans les données et les sessions |
| un fichier qui atteint **10 écrans ou plus** | **3** — attrape `design-tokens`, `civilite`, `acces-roles` sans qu'on les nomme |
| un fichier qui atteint **1 à 9 écrans** | **2** — types, lint, mémoire, suites base, **suites e2e des écrans atteints**, et ces écrans regardés |
| un import que le graphe ne sait pas résoudre | **3** — on refuse de conclure ; l'absence de mesure n'est jamais un vert |
| `docs/`, `appli/`, `.md` | **1** |

Le seuil de 10 écrans est un réglage, pas une loi : il se discute sur les
chiffres du §1.

---

## 4. Le cas de référence, mesuré

Modification d'une action locale de coordonnées client :

```
src/app/chantiers/[id]/coordonnees/actions.ts  →  3 écrans atteints
    src/app/chantiers/[id]/coordonnees/page.tsx
    src/app/chantiers/nouveau/page.tsx
    src/app/page.tsx
```

Trois écrans, par `FormulaireNouveauChantier` qui est partagé — ce qu'aucune
lecture du chemin ne laissait voir, et ce qu'aucune liste écrite à la main ne
contenait.

**Verdict : niveau 2**, avec les suites de ces trois écrans nommées par le
garde-fou. Pas « niveau 2 parce que ça a l'air local ».

Gain estimé : ~50 min → ~10 à 15 min. **C'est une estimation**, extrapolée du
« ~20 min pour quinze suites » de `CLAUDE.md` §5 ; elle n'a pas été mesurée.

---

## 5. Ce qui reste à trancher, et par qui

1. **L'invariant `CLAUDE.md` §0.3** — *« jamais rien de moins qu'elle quand
   `src/` ou `drizzle/` bouge »* — a été posé par le patron. Le modifier est
   sa décision.
2. **Le seuil de 10 écrans** entre niveau 2 et niveau 3.
3. **Le choix de méthode** : graphe d'imports (proposé ici) contre liste de
   fichiers centraux (proposé dans le brief). Les deux ne se cumulent pas :
   une liste à côté d'un calcul finirait par le contredire.
