# 1 — Lecture du brief reçu

**14 septembre 2026.** Proposition reçue : remplacer « tout changement dans
`src/` = Niveau 3 » par un niveau choisi sur le risque réel.

---

## 1. Le constat est exact

La règle actuelle vit dans `scripts/_niveau-de-risque.mjs` :

```js
if (/^(src|drizzle)\//.test(c) || c === "package.json" || c === "next.config.ts") return 3;
```

Un mot changé dans un écran déclenche donc la batterie complète (~50 min).

**Et la moitié de `src/` est réellement locale** : 339 fichiers sur 697
n'atteignent qu'un seul point d'entrée de l'application (`3-mesures.md`). Le
grief est fondé.

## 2. Ce qui est refusé dans le brief, et pourquoi

### 2.1 La « liste de fichiers centraux connus » — refusée

Une liste tenue à la main pourrit, et sa panne est **silencieuse** : elle
laisse partir du danger sans rien dire.

| Fichier | Points d'entrée atteints | Sur une liste ? |
|---|---|---|
| `src/lib/design-tokens.ts` | 88 | oui |
| `src/lib/acces-roles.ts` | 67 | non |
| `src/lib/civilite.ts` | 64 | **non** |

`civilite.ts` touche 64 points d'entrée sur 122 et ne figure dans aucune liste
du dépôt. Une règle fondée sur une liste classerait ce changement « local ».

### 2.2 Niveau 1 pour du « visuel local » dans `src/` — refusé

`typecheck`, `lint`, `test-aucune-fleche`, `test-chartes-lisibles`,
`test-pas-de-pansement`, `test-couches`, `test-pas-de-code-mort` coûtent des
**secondes**. Les sauter ne fait gagner aucun temps mesurable, et rouvre des
défauts déjà payés — le mode nuit illisible du 22 août 2026.

Le niveau 1 reste ce qu'il est : `docs/`, `appli/`, un `.md`.

### 2.3 Niveau 2 = types + lint + suites ciblées — insuffisant

C'est exactement ce qui a coûté vingt allers-retours sur « Invalid Server
Actions request. » : tous les voyants verts, et aucun contrôle ne parcourait
ce que l'utilisateur parcourt.

Une action serveur neuve sans **aucun passage navigateur réel** n'est pas
éprouvée. Le niveau 2 appliqué au produit doit donc porter en plus les suites
des points d'entrée atteints, et ces écrans regardés.

### 2.4 « Claude annonce Risque / Niveau / Raison » — refusé comme mécanisme

Si c'est la session qui écrit la ligne, le niveau redevient **déclaratif** —
précisément ce que le brief dit vouloir éviter. La ligne doit être **calculée
et imprimée par le garde-fou** à partir du diff : une sortie, jamais une
entrée.

## 3. Ce qui est proposé à la place

Le rayon d'impact se **calcule** sur le graphe d'imports inverse. La règle
complète — avec les deux corrections apportées par la revue — est au §4 de
`2-revue-d-architecture.md`.

## 4. Une erreur de ce document, corrigée

**La première version citait comme cas de référence mesuré :**

```
src/app/chantiers/[id]/coordonnees/actions.ts  →  3 points d'entrée
```

**C'était le mauvais fichier.** Le lot en cours porte sur les coordonnées
**client**, pas chantier. La mesure était réelle, mais elle ne portait pas sur
le lot dont il était question.

La cause : `src/app` avait été listé avec un `| head -40`, la sortie était
**tronquée**, et l'absence de `src/app/clients` en avait été conclue. C'est la
faute que ce dépôt a déjà payée le 14 septembre — *une recherche vide n'est
pas une absence* (`.claude/rules/regarder-l-ecran.md`).

**Le lot réel, mesuré :** les huit fichiers de `src/app/clients/` sont tous à
un rayon de **1**. La conclusion ne change pas ; sa fondation, si.
