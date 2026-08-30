# Stratégie des modèles pour la campagne de qualification

**Qui fait quoi, et pourquoi.** Ce document existe pour qu'on n'emploie pas le
même modèle du début à la fin par habitude — ni le plus puissant pour compter
des lignes, ni le plus rapide pour juger d'une fuite entre entreprises.

---

## 1. Les modèles réellement disponibles

**Relevés, pas supposés.** Cette liste vient de ce que l'environnement déclare
lui-même (`get_session`) et de ce que la documentation de l'outil de sous-agents
accepte. Aucun nom n'a été complété de mémoire.

| Identifiant | Alias sous-agent | Statut constaté |
|---|---|---|
| `claude-opus-5` | `opus` | **sert cette session** (`last_served_model`) |
| `claude-sonnet-5` | `sonnet` | modèle configuré à la création de la session |
| `claude-haiku-4-5-20251001` | `haiku` | déclaré disponible |
| `claude-fable-5` | `fable` | déclaré disponible |

**Une réserve honnête sur `claude-fable-5` :** l'environnement le nomme, mais
rien de ce qui est vérifiable ici ne dit à quelle place il se range — plus
rapide, plus capable, spécialisé. **Il n'est donc affecté à aucune mission dans
ce document.** Lui confier une tâche sur une supposition de positionnement
serait exactement la faute que ce dépôt s'interdit. À essayer sur une tâche sans
conséquence avant de lui en confier une qui compte.

**Comment le revérifier** — les modèles changent, ce document vieillira :

```
get_session  (sans session_id)
```

`session_context.model` dit ce que la session est réglée pour employer,
`external_metadata.last_served_model` ce qui a réellement servi le dernier tour.
**Ce ne sont pas les mêmes**, et ce malentendu-là coûte des heures.

---

## 2. Le principe qui commande tout le reste

**Un modèle ne décide jamais qu'un test est vert.**

| Faux | Juste |
|---|---|
| « Claude a lu le code, l'isolation a l'air bonne » | « Le scénario a été conçu ; un test A → B et B → A a été **exécuté** ; les accès ont été refusés » |
| « Le calcul de TVA semble correct » | « L'écran affiche 1 240 € ; l'API rend 1 240 ; la base porte 1 240 ; le PDF imprime 1 240 » |

Les arbitres sont **déterministes** : Playwright, les suites base, les
assertions SQL, k6, les contrôles d'intégrité. Le modèle **conçoit, analyse,
enquête, recoupe, explique** — il ne constate pas à leur place.

**Ce dépôt a déjà payé la faute inverse**, et c'est écrit dans ses règles : une
suite navigateur a rendu du vert sur un écran où trois noms étaient coupés,
parce qu'elle comparait deux largeurs valant toutes deux zéro. *Un contrôle qui
mesure zéro ne mesure rien.* Un modèle qui relit du code mesure zéro.

---

## 3. L'affectation par catégorie de tâche

### 3.1 Aucun modèle — c'est purement déterministe

**À ne jamais confier à un modèle**, parce qu'un outil le fait mieux, plus vite,
et sans se tromper poliment :

| Tâche | L'outil qui l'arbitre |
|---|---|
| exécuter les 115 suites navigateur | `npm run test:e2e` |
| exécuter les suites base | `npm test` |
| vérifier les types, le lint | `tsc`, `eslint` |
| mesurer p50 / p95 / p99, taux d'erreur | k6 |
| compter des lignes, vérifier une somme SQL | `psql` |
| confronter l'écran à l'API à la base | une suite écrite une fois |

**Corollaire, et c'est une règle de coût :** une fois qu'un test déterministe
existe, on ne demande à **aucun** modèle de refaire mentalement ce qu'il mesure.
k6 joue 1 000 utilisateurs virtuels ; le modèle n'en simule pas un seul — il lit
les chiffres qui en sortent.

### 3.2 Modèle rapide — `haiku`

Tâches nombreuses, mécaniques, à faible conséquence si elles se trompent — parce
qu'une erreur s'y voit tout de suite.

- inventaires et recensements (« quelles routes existent », « quels écrans
  portent un formulaire ») ;
- génération de **données fictives** en masse : clients, chantiers, lignes de
  devis ;
- déclinaison d'un scénario de test déjà conçu sur vingt variantes ;
- classement de journaux évidents (`200` / `404` / `500`) ;
- résumé d'une sortie déterministe déjà produite.

**La limite, et elle est nette :** dès que la tâche demande de *juger* si un
résultat est correct, on monte d'un cran. Recenser les formes juridiques est du
ressort de `haiku` ; décider si le régime de TVA appliqué à l'une d'elles est
juste ne l'est pas.

### 3.3 Modèle généraliste — `sonnet`

Le régime ordinaire de la campagne : compétent, et il y aura beaucoup à faire.

- écriture des suites Playwright standards, sur le socle existant ;
- suites d'API et de base de données ordinaires ;
- adaptation d'un scénario à un rôle ou à un écran voisin ;
- analyse d'un échec dont la cause est lisible dans le message ;
- maintenance de la suite QA, mise à jour des sélecteurs.

### 3.4 Modèle le plus capable — `opus`

**Tout ce dont une erreur ne se verrait pas.** C'est le critère, pas la
difficulté apparente.

| Domaine | Pourquoi il ne se délègue pas plus bas |
|---|---|
| **architecture de la campagne** | un trou dans le plan ne se voit dans aucun rapport |
| **devis, factures, calculs financiers** | un total faux a l'air d'un total |
| **historisation des documents** | un rapport parti ne doit plus jamais changer ; le vérifier demande de comprendre pourquoi |
| **formes juridiques, régimes de TVA** | la règle est légale, pas logique — elle ne se déduit pas du code |
| **rôles et permissions** | trois rôles, six actions de planning, des gardes serveur ; une permission trop large ne fait rien d'anormal |
| **isolation multi-entreprise (RLS)** | une requête hors contexte ne rend rien **en silence** — l'absence de résultat ressemble à un succès |
| **concurrence, situations de course** | par nature intermittent : le rejouer ne prouve rien, il faut raisonner |
| **corruption de données** | se découvre des semaines plus tard |
| **analyse de cause racine difficile** | le symptôme désigne rarement le coupable dans ce dépôt |
| **classement P0 / P1** | se tromper de gravité, c'est livrer avec la faille |
| **lecture des résultats de charge** | p99 qui décroche, saturation, requête lente : la cause est rarement où elle se voit |
| **décision GO / GO SOUS CONDITIONS / NO-GO** | elle engage la mise en production |

**Et la règle qui prime sur l'économie :** le modèle le moins cher ne se choisit
**jamais** pour économiser quand une mauvaise analyse pourrait masquer une faille
critique. Une heure de modèle puissant coûte moins qu'une fuite de données entre
deux entreprises.

---

## 4. Quand monter d'un cran, en cours de route

Quatre signaux, et l'un suffit :

1. **le symptôme change d'un essai à l'autre** — c'est de la concurrence, ou de
   l'état partagé ; ni l'un ni l'autre ne se diagnostique en relisant ;
2. **deux mesures se contredisent** — l'écran dit une chose, la base une autre ;
3. **le premier correctif ne tient pas** — le second échec sur le même sujet
   signale une cause mal comprise, pas une malchance ;
4. **la conclusion aurait un effet sur de vraies données** — effacement, RLS,
   montants, historisation.

### Et la consigne qui interdit le faux-semblant

Si un modèle plus capable est nécessaire mais indisponible, **on ne fait pas
comme si l'analyse valait la même chose.** Le rapport porte alors, en toutes
lettres :

    ANALYSE À REJOUER AVEC MODÈLE PLUS CAPABLE

Ce n'est pas une formalité : un « probablement bon » écrit sans réserve devient
un « bon » à la relecture, et personne ne saura plus qu'il fallait y revenir.

---

## 5. L'architecture des sous-agents

**État constaté :** `.claude/agents/` n'existe pas dans le dépôt — aucun
sous-agent n'est défini aujourd'hui. Les agents génériques disponibles sont
`Explore` (recherche en lecture seule), `Plan`, `general-purpose` et `claude`.

Six sous-agents sont proposés pour la campagne, chacun avec le modèle que sa
mission justifie :

| Agent | Mission | Modèle | Pourquoi ce modèle |
|---|---|---|---|
| `qa-cartography` | recenser écrans, routes, actions, réglages | `haiku` | inventaire ; une omission se voit au recoupement |
| `qa-e2e` | écrire et maintenir les suites Playwright | `sonnet` | volume important, difficulté ordinaire |
| `qa-documents` | devis, factures, PDF, historisation, TVA | **`opus`** | un montant faux a l'air d'un montant |
| `qa-security` | rôles, permissions, multi-entreprise, RLS | **`opus`** | une fuite ne produit aucun symptôme |
| `qa-database` | intégrité, concurrence, situations de course | **`opus`** | intermittent par nature |
| `qa-performance` | scénarios k6, lecture des mesures | `sonnet` puis **`opus`** | écrire le scénario est ordinaire ; expliquer un p99 qui décroche ne l'est pas |

**Le fractionnement ne sert pas qu'à choisir un modèle :** chaque agent revient
avec une conclusion, pas avec le contenu des fichiers qu'il a lus. C'est ce qui
permet de mener six axes sans que le contexte de l'un noie celui des autres.

**Ce qu'aucun sous-agent n'a le droit de faire**, quel que soit son modèle :

- conclure qu'un test est vert sans qu'un outil déterministe l'ait mesuré ;
- écrire dans une base qui n'est pas celle de l'établi ;
- lancer `verifier:avant-livraison` (elle refuse désormais, mais la règle
  précède le garde) ;
- décider seul du GO / NO-GO — c'est une synthèse, et elle revient au patron.

---

## 6. Ce que ce document ne tranche pas

- **la place de `claude-fable-5`** — non établie, donc aucune mission (§1) ;
- **le budget total de la campagne** — il dépendra du nombre d'allers-retours,
  qu'on ne saura qu'en avançant ;
- **le seuil exact où `sonnet` passe la main à `opus`** sur l'analyse des
  mesures de charge : les quatre signaux du §4 le disent qualitativement, et
  c'est volontairement un jugement plutôt qu'un chiffre.
