# Atlas — niveau de test calculé sur le risque

**Document unique, autonome.** 14 septembre 2026. Tout ce qui suit a été
mesuré sur le dépôt, sauf ce qui est explicitement marqué « estimation ».

---

## 1. Le problème

La règle actuelle vit dans `scripts/_niveau-de-risque.mjs` :

```js
if (/^(src|drizzle)\//.test(c) || c === "package.json" || c === "next.config.ts") return 3;
```

Un mot changé dans un écran déclenche la batterie complète (~50 min). Un
garde-fou (`scripts/garde-fusion-main.mjs`) refuse la fusion vers `main` si le
contrôle du niveau calculé n'a pas été joué au vert sur cet état de l'arbre.

**Le grief est fondé :** 339 fichiers de `src/` sur 697 n'atteignent qu'un seul
point d'entrée de l'application.

## 2. Ce qui a été proposé, et ce qui est refusé

| Point du brief | Verdict |
|---|---|
| remplacer « tout `src/` = niveau 3 » par un niveau sur le risque réel | **retenu** |
| une **liste de « fichiers centraux connus »** | **refusé** |
| **niveau 1** pour du « visuel local » dans `src/` | **refusé** |
| **niveau 2** = types + lint + suites ciblées | **insuffisant** |
| Claude **annonce** Risque / Niveau / Raison | **refusé comme mécanisme** |

**La liste de fichiers centraux est refusée parce qu'elle pourrit en
silence :**

| Fichier | Points d'entrée atteints | Sur une liste ? |
|---|---|---|
| `src/lib/design-tokens.ts` | 88 | oui |
| `src/lib/acces-roles.ts` | 67 | non |
| `src/lib/civilite.ts` | **64** | **non** |

`civilite.ts` touche 64 points d'entrée sur 122 et ne figure dans aucune liste
du dépôt. Une règle fondée sur une liste classerait ce changement « local ».

**Le niveau 1 dans `src/` est refusé** parce que `typecheck`, `lint`,
`test-chartes-lisibles`, `test-pas-de-pansement`, `test-couches`,
`test-pas-de-code-mort` coûtent des **secondes**. Les sauter ne gagne rien et
rouvre des défauts déjà payés (le mode nuit illisible du 22 août 2026).

**Le niveau 2 « types + lint + suites ciblées » est insuffisant** : c'est
exactement ce qui a coûté vingt allers-retours sur « Invalid Server Actions
request. » — tous les voyants verts, et aucun contrôle ne parcourait ce que
l'utilisateur parcourt. Une action serveur neuve sans passage navigateur réel
n'est pas éprouvée.

**L'annonce par Claude est refusée** parce qu'elle rendrait le niveau
**déclaratif**, c'est-à-dire exactement ce que le brief dit vouloir éviter. La
ligne doit être **calculée et imprimée par le garde-fou** depuis le diff : une
sortie, jamais une entrée.

## 3. Ce qu'est un « point d'entrée » — sans liste

Une objection juste avait été soulevée : compter les écrans manque les routes
API, les Server Actions, la génération de documents, les traitements serveur.
C'est exact — le premier calcul manquait 24 routes API, `middleware.ts` et
trois entrées serveur.

**Mais la réponse n'est pas d'énumérer les catégories.** Un point d'entrée est
une **propriété du graphe : un fichier que personne n'importe**. Il est donc
appelé de l'extérieur du code — routeur Next, cron, script. Rien à tenir à
jour : un générateur PDF ou un cron ajouté demain devient un point d'entrée
tout seul.

| La surface d'Atlas, mesurée | |
|---|---|
| **points d'entrée** | **122** |
| écrans (page, gabarit) | 88 |
| routes API | 24 |
| `middleware.ts` | 1 |
| entrées serveur (amorçage, appariement, trimestre) | 3 |
| `lib/` que personne n'importe, `robots.ts`, types | 6 |

## 4. Le rayon ne dit rien de la gravité

| Fichier | Rayon | Ce qu'il porte |
|---|---|---|
| `src/lib/civilite.ts` | 64 | « M. » ou « Mme » |
| `src/lib/jour.ts` | 39 | une date formatée |
| `src/server/repositories/lignes-prix.ts` | **11** | **les prix** |

Un seuil sur le seul nombre classerait `jour.ts` **plus dangereux** que les
prix. C'est inversé. Portée et gravité sont indépendantes.

**Et la gravité n'est pas calculable** : aucune propriété du graphe ne dit
qu'un nombre est une TVA. Il faut donc une liste — ce qui semble contredire le
§2. La ligne exacte est celle-ci, et c'est le cœur de la proposition :

| | |
|---|---|
| une liste qui **ABAISSE** le niveau | **refusée** — sa panne est silencieuse : du danger part sans que rien ne le dise |
| une liste qui **REMONTE** le niveau | **acceptée** — sa panne coûte des minutes de batterie, jamais une régression |

## 5. Les angles morts, et ce qu'on en fait

Le graphe mesure le **couplage de code**, pas le couplage d'exécution.

| Angle mort | Le cas concret |
|---|---|
| `fetch("/api/…")` | aucun lien d'import : toucher `api/adresses/route.ts` affiche **rayon 1**, alors que chaque écran qui l'appelle peut tomber |
| `import()` dynamique à chemin variable | invisible |
| RLS, schéma, migrations | l'impact vit dans les **données**, pas dans le code |
| feuille de style globale | `globals.css` n'est importé par presque personne |

**Traitement :** ce que le calcul ne sait pas résoudre **remonte à 3**, et les
routes API se relient par leur **chemin d'URL** cherché dans le code. Une
mesure impossible n'est jamais un vert.

## 6. La règle proposée

```
niveau = MAX( plancher , rayon , gravité )
```

Jamais un minimum, jamais une moyenne.

| Composante | Règle |
|---|---|
| **Plancher** — liste, remonte seulement | `drizzle/`, authentification, RLS, `withEntreprise`, `middleware`, `layout.tsx` racine, `package.json`, `next.config` → **3** |
| **Gravité** — liste, remonte seulement | facturation, TVA, devis, règlements, rôles, isolation → **3**, quel que soit le rayon |
| **Rayon** — calculé, aucune liste | 1 point d'entrée → **2** · 2 à 9 → **2** + les suites des points atteints · **10 et plus** → **3** |
| **Inconnu** | import non résolu, `fetch` vers une route touchée, import dynamique → **3** |

### Sur le seuil de 10

Il se retient comme valeur de départ, mais il pèse moins qu'il n'y paraît une
fois la gravité dans la règle. Ce qui est proposé à sa place, à terme :

> le niveau 2 joue les suites des points d'entrée atteints ; **quand ce paquet
> dépasse la moitié de la batterie, on joue la batterie** — c'est moins cher
> que la comptabilité. Le seuil devient un repli, pas une vérité.

**C'est faisable** : les 151 suites navigateur citent toutes leur route en
clair — 7 d'entre elles citent `"/clients"`. La correspondance point d'entrée →
suite se **dérive**, elle ne s'écrit pas.
**Réserve non levée :** une suite qui navigue au clic plutôt qu'à l'URL échappe
à ce repérage. À mesurer avant d'y compter.

## 7. Le lot en cours, classé sur son vrai diff

Branche `claude/modifications-breaking-elsewhere-fp0x04`, commit `d0fc128c` —
*« Ouvrir une porte "Modifier" sur la fiche du client »*.

| Fichier | Rayon | Niveau |
|---|---|---|
| `src/app/clients/[id]/coordonnees/page.tsx` *(neuf)* | 1 | 2 |
| `src/app/clients/[id]/coordonnees/actions.ts` *(neuf)* | 1 | 2 |
| `src/app/clients/[id]/coordonnees/SesCoordonnees.tsx` *(neuf)* | 1 | 2 |
| `src/app/clients/[id]/page.tsx` *(modifié)* | **1** | 2 |
| `scripts/test-modifier-client-e2e.ts` *(neuf)* | — | 2 |
| `ARCHITECTURE.md`, `CHANGELOG.md`, `HANDOVER.md`, `PROJECT_STATE.md` | — | 1 |

Aucun plancher touché, aucune gravité. Et le lot **appelle**
`mettreAJourClient` et `exigerEcran`, il ne les **modifie pas** — c'est la
distinction qui décide : appeler une fonction déjà éprouvée ne change son
comportement pour personne.

**Verdict : NIVEAU 2** au lieu de 3.

```bash
npm run verifier:avant-fusion        # types, lint, mémoire, suites base
npm run test:e2e -- --seulement "modifier-client,fiche-client,retour-fiche-client,\
acces-salarie,roles-facturation,retour-garde-la-place,retour-page-davant,mode-sombre-lisible"
npm run voir -- /clients/<id>/coordonnees
```

Huit suites au lieu de cent cinquante et une.

**Ce qui rend ce niveau 2 acceptable :** le lot introduit une **action serveur
neuve** — la famille exacte de « Invalid Server Actions request. ». Sans
passage navigateur réel, un niveau 2 la laisserait filer. Le lot porte déjà sa
suite, et c'est elle qui l'autorise.

## 8. Deux limites à ne pas cacher

1. **Un fichier neuf est toujours à rayon 1**, puisque personne ne l'importe
   encore. Le rayon ne peut donc pas juger un ajout à lui seul : ce sont les
   fichiers **modifiés** qui portent le risque de régression.
2. **Une erreur de ce dossier, corrigée.** Le premier cas de référence donnait
   un fichier *chantier* pour un lot *client* : `src/app` avait été listé avec
   un `| head -40`, la sortie était tronquée, et l'absence de
   `src/app/clients` en avait été conclue. La mesure était réelle, elle portait
   sur le mauvais fichier. C'est la faute que ce dépôt a déjà payée — *une
   recherche vide n'est pas une absence*.

## 9. Les chiffres, et comment les rejouer

```bash
node -e "import('./scripts/_rayon-impact.mjs')"
```

| Rayon | Fichiers | Part |
|---|---|---|
| 1 | **339** | 49 % |
| 2 | 61 | 9 % |
| 3 – 4 | 44 | 6 % |
| 5 – 9 | 64 | 9 % |
| 10 – 19 | 101 | 14 % |
| 20 et plus | 88 | 13 % |

Avec un seuil à 10 : **189 fichiers en niveau 3**, 508 en niveau 2.

**Ce qui reste une estimation, et n'a jamais été chronométré ici :** la
batterie complète à ~50 min et les quinze suites à ~20 min viennent de
`CLAUDE.md` §5 ; le gain d'un niveau 2 ciblé (~10 à 15 min) en est extrapolé.

## 10. Ce qui reste à trancher, et par qui

| | Qui |
|---|---|
| l'invariant `CLAUDE.md` §0.3 — *« jamais rien de moins que la batterie quand `src/` bouge »* | **le patron** : c'est sa règle |
| le seuil de rayon entre niveau 2 et niveau 3 | à mesurer, pas à décider d'avance |
| le contenu de la liste de gravité | **le patron** : c'est lui qui sait ce qui coûte cher |

**État : validé et CODÉ le 14 septembre 2026** — `scripts/_niveau-de-risque.mjs`,
`scripts/garde-fusion-main.mjs`, `.claude/rules/testing.md`, `ARCHITECTURE.md` §365.
