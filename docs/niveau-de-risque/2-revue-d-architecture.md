# 2 — Revue d'architecture : les trois réserves

**14 septembre 2026.** Trois réserves ont été opposées à la proposition du
graphe d'impact. Les trois sont fondées, et deux d'entre elles changent la
règle.

---

## Réserve 1 — « compter les écrans ne suffit pas »

**Exacte.** Le premier calcul ne comptait que les écrans. Il manquait
**24 routes API**, `middleware.ts`, et trois entrées serveur (`seed`,
`appariement`, `trimestre`).

**Mais la réponse n'est pas d'énumérer les catégories** — traitements serveur,
génération de documents, Server Actions, « autres entrypoints pertinents ». Ce
serait une liste de plus, et elle pourrirait comme la première.

**Un point d'entrée est une propriété du graphe : un fichier que personne
n'importe.** Il est donc appelé de l'extérieur du code — par le routeur Next,
un cron, un script. Rien à tenir à jour : le jour où un générateur PDF ou un
cron est ajouté, il devient un point d'entrée tout seul.

| La surface d'Atlas, mesurée | |
|---|---|
| **points d'entrée** | **122** |
| écrans (page, gabarit) | 88 |
| routes API | 24 |
| `middleware.ts` | 1 |
| entrées serveur (amorçage, appariement, trimestre) | 3 |
| `lib/` que personne n'importe | 3 |
| `robots.ts`, déclarations de types | 3 |

*Les trois `lib/` non importées sont soit du code mort, soit appelées depuis
`scripts/` — le calcul ne parcourt que `src/`. À vérifier, pas à affirmer.*

## Réserve 2 — « le cas de référence portait sur un fichier chantier »

**Exacte, et c'était une erreur de mesure, pas de rédaction.** Elle est
racontée en entier au §4 de `1-lecture-du-brief.md`.

Le lot réel : les huit fichiers de `src/app/clients/` sont tous à un rayon
de **1**.

## Réserve 3 — « la nature compte, pas seulement le nombre »

**C'est la réserve la plus forte, et elle casse le seuil employé seul.**

| Fichier | Rayon | Ce qu'il porte |
|---|---|---|
| `src/lib/civilite.ts` | 64 | « M. » ou « Mme » |
| `src/lib/jour.ts` | 39 | une date formatée |
| `src/server/repositories/lignes-prix.ts` | **11** | **les prix** |

Un seuil sur le seul nombre classerait `jour.ts` **plus dangereux** que les
prix. C'est inversé. **Le rayon mesure la portée ; il ne dit rien de la
gravité.** Les deux sont indépendantes.

**Et la gravité n'est pas calculable** : aucune propriété du graphe ne dit
qu'un nombre est une TVA. Il faut une liste — ce qui semble contredire le
refus de la réserve 1. La ligne exacte est celle-ci :

| | |
|---|---|
| une liste qui **ABAISSE** le niveau (« fichiers centraux connus ») | **refusée** — sa panne est silencieuse : du danger part sans que rien ne le dise |
| une liste qui **REMONTE** le niveau (facturation, auth, isolation) | **acceptée** — sa panne coûte des minutes de batterie, jamais une régression |

C'est l'asymétrie qui tient partout ailleurs dans ce dépôt : le doute tranche
vers le haut.

---

## 3. Les angles morts, et ce qu'on en fait

Le graphe mesure le **couplage de code**. Il ne voit pas le couplage
d'exécution.

| Angle mort | Le cas concret |
|---|---|
| `fetch("/api/…")` | aucun lien d'import. Toucher `api/adresses/route.ts` affiche **rayon 1**, alors que chaque écran qui l'appelle peut tomber |
| `import()` dynamique dont le chemin est une variable | invisible |
| RLS, schéma, migrations | l'impact vit dans les **données**, pas dans le code |
| feuille de style globale | `globals.css` n'est importé par presque personne |

**Ce qui les couvre :** ce que le calcul ne sait pas résoudre remonte à 3, et
les routes API se relient par leur **chemin d'URL** cherché dans le code, pas
par leurs imports. *Une mesure impossible n'est jamais un vert* (`CLAUDE.md`
§5).

---

## 4. La règle proposée

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

Il se retient comme valeur de départ, **mais il pèse moins qu'il n'y paraît
une fois la gravité dans la règle.** Ce qui est proposé à sa place, à terme :

> le niveau 2 joue les suites des points d'entrée atteints ; **quand ce paquet
> dépasse la moitié de la batterie, on joue la batterie** — c'est moins cher
> que la comptabilité.

Le seuil devient alors un repli, pas une vérité.

**C'est faisable** : les 151 suites navigateur citent toutes leur route en
clair — **7** d'entre elles citent `"/clients"`. La correspondance point
d'entrée → suite se **dérive**, elle ne s'écrit pas à la main.

**Réserve, et elle n'est pas levée :** une suite qui navigue au clic plutôt
qu'à l'URL échappe à ce repérage. À mesurer avant d'y compter.

---

## 5. Le lot client, classé POUR DE BON

**Branche trouvée :** `claude/modifications-breaking-elsewhere-fp0x04`, commit
`d0fc128c` — *« Ouvrir une porte "Modifier" sur la fiche du client »*.

Son diff entier, mesuré :

| Fichier | Rayon | Ce qu'il exige |
|---|---|---|
| `src/app/clients/[id]/coordonnees/page.tsx` *(neuf)* | 1 | 2 |
| `src/app/clients/[id]/coordonnees/actions.ts` *(neuf)* | 1 | 2 |
| `src/app/clients/[id]/coordonnees/SesCoordonnees.tsx` *(neuf)* | 1 | 2 |
| `src/app/clients/[id]/page.tsx` *(modifié)* | **1** | 2 |
| `scripts/test-modifier-client-e2e.ts` *(neuf)* | — | 2 |
| `ARCHITECTURE.md`, `CHANGELOG.md`, `HANDOVER.md`, `PROJECT_STATE.md` | — | 1 |

**Aucun plancher touché** : ni `drizzle/`, ni authentification, ni RLS, ni
`middleware`, ni `layout.tsx` racine. **Aucune gravité** : ni facturation, ni
TVA, ni règlements.

Et surtout : le lot **appelle** `mettreAJourClient` et `exigerEcran`, il ne les
**modifie pas**. C'est la distinction qui décide — appeler une fonction déjà
éprouvée ne change son comportement pour personne.

### Verdict : NIVEAU 2

| | |
|---|---|
| **règle actuelle** | niveau 3, batterie complète, ~50 min |
| **règle proposée** | niveau 2 ciblé |

```bash
npm run verifier:avant-fusion        # types, lint, mémoire, suites base
npm run test:e2e -- --seulement "modifier-client,fiche-client,retour-fiche-client,\
acces-salarie,roles-facturation,retour-garde-la-place,retour-page-davant,mode-sombre-lisible"
npm run voir -- /clients/<id>/coordonnees
```

Huit suites au lieu de cent cinquante et une.

**Ce qui rend ce niveau 2 acceptable, et qui manquait au brief :** le lot
introduit une **action serveur neuve** — exactement la famille de « Invalid
Server Actions request. ». Sans passage navigateur réel, un niveau 2 le
laisserait filer. Le lot porte déjà sa suite (`test-modifier-client-e2e.ts`),
et c'est elle qui l'autorise.

### Une limite du calcul, qu'il faut nommer

**Un fichier neuf a toujours un rayon de 1**, puisque personne ne l'importe
encore. Le rayon ne peut donc pas, à lui seul, juger un ajout : ce sont les
fichiers **modifiés** qui portent le risque de régression, et ici le seul —
`clients/[id]/page.tsx` — est à 1.
