# 02 — Cartographie et tests avant correction — chaîne « dictée → devis »

Tu n'as pas accès au dépôt. Ce document est autonome.

Contexte, en trois lignes : application de paysagiste-élagueur (Next.js +
PostgreSQL + Drizzle, multi-entreprises avec RLS). L'artisan dicte son chantier
au téléphone ; la dictée est transcrite, comprise par un modèle, transformée en
prestations, chiffrée, et un devis s'affiche. Un audit a montré que la chaîne
produit des lignes fausses. **Tu m'avais renvoyé un plan de correction. Je l'ai
appliqué à la lettre sur sa première étape : cartographier, puis écrire les tests
AVANT de corriger. Aucun code de production n'a été modifié.**

Ce document rend les six livrables que tu demandais, plus trois points où ton
brief contredit des décisions que le patron avait prises lui-même.

---

## 1. Les consommateurs réels, retrouvés dans le dépôt

### 1.1 — Les six relectures indépendantes d'un même libellé

Tu demandais de trouver « TOUS les consommateurs des libellés et notamment les
regex ». Il y en a **six**, dans six fichiers, qui relisent la même chaîne de
texte pour en tirer des informations métier :

| Fichier | Ce qu'il relit | Motifs |
|---|---|---|
| `lib/lignes-vendables.ts` | nature, pour découper le devis | `FENDAGE` `HAIE` `DESSOUCHAGE` `GRUMES` `ABATTAGE` `BILLONNAGE` |
| `lib/lecons-prix.ts` | nature + technique + ⌀, pour rapprocher | `NATURES` (6) `TECHNIQUES` (3) `DIAMETRE_LU` |
| `services/apprendre-grille.ts` | nature, pour enseigner la grille | les 5 mêmes que `lignes-vendables`, **recopiés à la main** |
| `lib/questions-chiffrage.ts` | nature + longueur, pour poser les questions | `ABATTAGE` `HAIE` `LONGUEUR` `FENDAGE` |
| `lib/mesures-arbre.ts` | ⌀, hauteur, longueur de haie, tonnage | `DIAMETRE` `HAUTEUR` `LONGUEUR` `TONNAGE` |
| `ai/lecture-litterale.ts` | quantité + unité, en repli sans modèle | `REGEX_QUANTITE` (m² m³ ml cm kg t…) |

**Trois d'entre elles portent déjà, en commentaire dans le code, la consigne de
« se corriger ensemble ».** C'est l'aveu que le modèle de données manque : on ne
synchronise à la main que ce qui n'a pas de source unique.

### 1.2 — La chaîne, dans l'ordre d'exécution

| # | Fichier · fonction | Ce qui s'y décide |
|---|---|---|
| 1 | `ai/services/transcription-service.ts` | audio → texte (hors périmètre) |
| 2 | `ai/services/extraction-service.ts` · `extraire` | texte → JSON structuré ; **quantité et unité y sont JUSTES** |
| 3 | `repositories/brouillons-informations.ts` | le JSON est rangé tel quel en JSONB — rien n'est perdu |
| 4 | `ai/services/brouillon-service.ts` · `libelleAvecQuantite` | **la quantité est collée au libellé** |
| 5 | table `prestations` | une seule colonne de contenu : `libelle` |
| 6 | `lib/questions-chiffrage.ts` | l'arrêt qui pose les questions qui valent de l'argent |
| 7 | `services/devis-depuis-dictee.ts` | recolle la technique et le ⌀ au libellé |
| 8 | `lib/lignes-vendables.ts` | 5 groupes, dont `principal` qui ramasse tout le reste |
| 9 | `chiffrage/proposition-prix.ts` | l'arbre de décision du prix |
| 10 | `lib/tarif-main-oeuvre.ts` | le prix au temps du **chantier entier** |
| 11 | `lib/lignes-vendables.ts` · `repartir` | la répartition entre lignes ; **rend `null` si elle ne tient pas** |
| 12 | `chiffrage/proposition-prix.ts` | le repli : détachables forcées à `"0"` |
| 13 | `repositories/lignes-prix.ts` · `ajouterLignePrix` | **`quantite: "1"` en dur** |
| 14 | `app/…/devis-complet/actions.ts` · `majLigneAction` | déclenche **trois** apprentissages |
| 15 | `services/apprendre-grille.ts` | range un montant dans une case de grille |
| 16 | `repositories/lecons-prix.ts` + `lib/lecons-prix.ts` | la mémoire des prix et sa clé |

---

## 2. Sept dépendances cachées — aucune n'était dans ton brief

Ce sont elles qui justifiaient de ne pas coder tout de suite.

### 2.1 — La feuille de chantier écrit DÉJÀ la quantité

`repositories/devis.ts` · `tachesDuChantier` alimente l'écran **Planning**, la
feuille que l'équipe emporte sur le terrain :

```ts
const q = Number(l.quantite);
return Number.isFinite(q) && q !== 1
  ? `${l.libelle} — ${q.toLocaleString("fr-FR")}`
  : l.libelle;
```

Aujourd'hui la quantité vaut toujours 1 sur ce chemin, donc cette branche ne
s'active **jamais**. Le jour où l'on pose 800, l'équipe lira :

> Haie (tout genre) (800 ml) — 800

Le libellé porte déjà la mesure, et la colonne la portera aussi. **Ton §5 (« ne
reformule pas et ne nettoie pas brutalement les anciens libellés ») et ton P1
(« la quantité doit survivre ») se contredisent ici** : corriger la quantité sans
nettoyer le libellé produit un doublon sur un document de chantier. C'est le
point 8.1 de mes questions.

### 2.2 — L'unité n'existe pas sur le document du client

| Table | `quantite` | `prix_unitaire` | `unite` |
|---|---|---|---|
| `lignes_prix` (le brouillon de travail) | oui | oui | **oui** |
| `lignes_devis` (ce que le client reçoit) | oui | oui | **NON** |
| `lignes_facture` | oui | oui | **NON** |

L'unité s'arrête donc avant le document imprimé. Porter « 800 **ml** » jusqu'au
devis demande une migration sur `lignes_devis` — et la même sur `lignes_facture`
si la facture doit dire la même chose que le devis. **Or la facturation est hors
périmètre par ton propre §12.**

### 2.3 — « Inconnu » n'a de place dans aucune des trois tables

`quantite` est `NOT NULL DEFAULT '1'` ; `prix_unitaire` et `montant` sont
`NOT NULL`. Sur les trois tables. **Il n'existe aucune façon d'écrire « je ne
sais pas »** — d'où le `"0"` que ton §3 veut supprimer.

Et ce `"0"` n'est pas une négligence : il vient d'une **demande explicite du
patron le 7 août 2026**. Il avait dicté quatre travaux, obtenu un devis vide, et
écrit : *« le devis ne comporte aucune ligne, gros bug »*. Les lignes sont
écrites à 0 € pour que son travail dicté ne disparaisse pas ; l'écran les montre
comme des prix à saisir. Supprimer le 0 € sans lui donner un remplaçant rendrait
la chaîne incapable d'écrire quoi que ce soit.

### 2.4 — Deux vocabulaires pour la même technique

| Où | La clé de « démontage avec rétention » |
|---|---|
| `lib/grille-prix.ts` | `demontage_retention` |
| `lib/lecons-prix.ts` | `retention` |

Les deux fonctionnent aujourd'hui, parce qu'ils ne lisent pas la même source : la
grille lit une valeur enregistrée, la mémoire lit le **texte** du libellé. Mais
toute correction qui les unifierait doit savoir qu'ils divergent. *Ce piège a
fait rougir un de mes propres tests pendant que je les écrivais.*

### 2.5 — Un garde-fou existe déjà contre le devis à 0 €

`lib/preparation-devis.ts` refuse de préparer un devis dont le total est ≤ 0. Il
ne faut pas le défaire en introduisant l'état « non chiffré » : une ligne non
chiffrée doit compter comme « pas encore prête », jamais comme « zéro euro ».

### 2.6 — La branche catalogue n'est pas morte

`chiffrage/service.ts` · `chiffrerChantier(ctx, chantierId, motCleCatalogue?)` :

- `ai/tools/calculer-chiffrage.ts` **passe** le mot-clé → la branche vit pour
  l'assistant conversationnel ;
- `chiffrage/proposition-prix.ts` **ne le passe pas** → le catalogue de
  vocabulaire et l'historique de prix ne sont jamais consultés depuis la dictée.

**Correction de ce que je t'avais écrit dans le dossier 01 :** j'y disais « une
branche morte ». Elle est morte d'un seul côté. La supprimer casserait
l'assistant.

### 2.7 — La troncature est perdue à la frontière du fournisseur

Le fournisseur Anthropic lit `donnees.content` et **jette `stop_reason`**. Le
type de retour ne porte que `{ succes, texte }` :

```ts
export type ResultatLLM =
  | { succes: true; texte: string }
  | { succes: false; erreur: ErreurIA };
```

Aucun correctif en aval ne peut donc distinguer une réponse coupée d'une réponse
illisible : **l'information n'arrive pas jusque-là**. Ton §11 a raison de dire
que relever `max_tokens` n'est pas la correction — mais la correction commence
encore plus tôt, par une extension additive de cette interface, qui touche les
quatre fournisseurs.

### 2.8 — L'ampleur des consommateurs

22 suites navigateur touchent au devis. 23 suites base écrivent `quantite: "1"`
en dur dans leurs jeux d'essai : elles ne rougiront pas (elles posent la valeur
elles-mêmes), mais elles cesseront de décrire le produit.

---

## 3. Les tests écrits avant correction, et le résultat

Deux suites neuves, **rouges par construction**. Aucune ne réclame de clé d'API :
le seul appel de modèle passe par un faux fournisseur fabriqué dans la suite.
Chaque cas porte la lettre de ton brief.

### 3.1 — Sans base de données

```
=== B — deux travaux dictés restent deux identités métier ===
❌ une tonte et un démontage ne se fondent pas dans un seul libellé
❌ la tonte n'hérite pas de la nature du démontage
=== E — un faux comparable est pire qu'un comparable absent ===
❌ 50 ml et 800 ml de haie ne sont pas le même chantier
✅ deux haies de longueur voisine restent, elles, comparables
❌ une espèce différente ne se rapproche pas quand elle change le prix
=== F — un lot de plusieurs natures n'est l'expérience d'aucune ===
❌ « tonte + démontage » ne produit pas la signature d'un abattage
✅ un seul travail, lui, garde bien sa signature
=== G — les signatures déjà stockées ne doivent pas devenir muettes ===
✅ les clés V1 restent lisibles à l'identique
=== H — une réponse tronquée est invalide, jamais une lecture muette ===
❌ une réponse coupée ne devient pas une lecture indiscernable d'une panne
❌ le fournisseur lit `stop_reason`

3 réussite(s), 7 échec(s).
```

### 3.2 — Avec base de données

```
=== A — la quantité dictée survit jusqu'à la ligne du devis ===
❌ 800 ml de haie donnent une ligne à 800 × 17,50 €, pas 1 × 14 000 €
   quantité écrite : 1.00 — la mesure dictée a disparu
=== B — deux travaux dictés ne partagent pas une identité ===
❌ la tonte et le démontage n'arrivent pas sur la même ligne de devis
   "Tonte de la pelouse (1200 m²)\nÉrable — démontage en rétention"
=== C — inconnu n'est ni 0 ni 1 ===
❌ une ligne qu'on ne sait pas chiffrer ne s'écrit pas « 0 € »
❌ aucune ligne du détail ne porte une quantité de 1 posée par défaut
=== D et F — un lot de plusieurs natures n'enseigne rien ===
❌ un prix posé sur « tonte + démontage » n'entre pas dans la grille d'abattage
   demontage_retention|d40 = 1500.00 €   (au lieu de 800.00 €)
✅ un prix posé sur une SEULE prestation continue, lui, d'enseigner

1 réussite(s), 5 échec(s).
```

### 3.3 — La corruption, chiffrée

C'est le résultat qui manquait au diagnostic. Sur un chantier d'essai, la case
`demontage_retention|d40` de la grille valait **800 €**. Un prix de **1 500 €**
posé sur la ligne qui porte la tonte **et** le démontage l'a **écrasée** :

```
avant : demontage_retention|d40 = 800,00 €
après : demontage_retention|d40 = 1 500,00 €
```

La tonte de 1 200 m² est désormais dans le prix d'abattage de l'artisan, et ce
prix reviendra seul sur chaque démontage suivant, avec l'autorité de « sa »
grille. Ce n'est plus une lecture de code : c'est un nombre.

### 3.4 — Quatre contrôles coupent dans l'autre sens

Une correction qui refuserait tout passerait la moitié des cas ci-dessus en
détruisant la mémoire de l'artisan. Quatre contrôles exigent donc l'inverse, et
ils sont **verts aujourd'hui et doivent le rester** : deux haies de 50 et 55 ml
restent comparables ; une prestation seule continue d'enseigner ; un travail
unique garde sa signature ; les clés déjà stockées restent lisibles.

### 3.5 — Un piège rencontré en écrivant ces tests

La première version du contrôle D comparait le **nombre** de cases de la grille.
Elle passait au vert pendant que la case était écrasée de 800 à 1 500 € : la
taille ne bougeait pas. Elle compare désormais les **montants**, et un témoin
prouve d'abord que la case est réellement calculable — sans quoi le contrôle
passerait au vert parce qu'il n'y avait rien à mesurer.

### 3.6 — La batterie complète, avant correction

```
npx tsc --noEmit   → 0 erreur
npx eslint         → 0 erreur
npm test           → 247 / 249 suites réussies
```

**Les deux seules suites en échec sont les deux suites neuves.** Rien d'autre
n'est cassé : la chaîne d'aujourd'hui est parfaitement cohérente avec elle-même.
C'est précisément le problème — elle est cohérente autour d'un modèle de données
faux.

La suite navigateur n'a pas été jouée dans cette phase : elle bâtit
l'application et n'apprendrait rien tant qu'aucun code de production n'a changé.

---

## 4. Les migrations additives exactement nécessaires

Aucune ne modifie ni ne supprime de donnée existante. Aucune ne remplit une
colonne neuve en devinant : ce qu'on ne peut pas établir reste `NULL`.

| # | Sur quoi | Ce qu'elle ajoute |
|---|---|---|
| M1 | `prestations` | `quantite`, `unite`, `nature`, `espece`, `methode`, `a_confirmer` — toutes nullables |
| M2 | `prestations` | `caracteristiques jsonb` — ⌀, hauteur, largeur, longueur, tonnage. **Structure souple** plutôt qu'une colonne par mesure, comme ton §4 le demande |
| M3 | `lignes_prix` | `prestation_id` — **le lien n'existe pas aujourd'hui**. Sans lui, « une nature par ligne » reste une propriété du texte, pas une contrainte |
| M4 | `lignes_prix` | l'état « non chiffré » : un drapeau `chiffre`, ou `prix_unitaire` rendu nullable |
| M5 | `lignes_devis` | `unite` — sans quoi l'unité s'arrête avant le document du client |
| M6 | `lecons_prix` | `signature_v2` + `version_signature`. **`signature` n'est pas touchée** : la V1 reste lisible, et une leçon dont on ne peut pas déduire la V2 garde `NULL` |

---

## 5. Trois points de ton brief qui contredisent ses propres décisions

Je ne les ai pas appliqués en silence, et je ne tranche pas seul.

### 5.1 — « Supprime la logique prix inconnu → 0 € »

Tu as raison sur le fond : un 0 € reste un montant, et sur un devis imprimé il se
lit « gratuit ». Mais ce 0 € est **sa décision du 7 août** (§2.3 ci-dessus). La
correction n'est donc pas de supprimer la ligne — c'est de lui donner un **état**
distinct (M4) : la ligne s'écrit, elle porte « à chiffrer » au lieu de « 0,00 € »,
et le devis n'est pas déclaré prêt tant qu'elle y est.

### 5.2 — « Ne répartis plus arbitrairement le prix total »

Ton brief confond deux choses :

| | |
|---|---|
| la répartition **850 + 250** | c'est SA règle du 7 août, expliquée par lui : *« si le client ne veut pas la fente, il va trouver le reste cher ; et s'il nous prend juste pour la fente, 100 € ce n'est pas assez »*. Ce n'est pas arbitraire |
| le **repli quand la répartition échoue** | ça, c'est arbitraire : tout le total sur la ligne principale, zéro sur les autres, sans un mot sur le devis. C'est ce qui met sa haie à 0 € |

Je corrige le second, je garde le premier.

### 5.3 — « Une action métier = une prestation distincte »

D'accord — mais le découpage n'a **jamais** prétendu séparer les actions : il
sépare **ce que le client peut refuser seul**, et c'est aussi sa règle
(*« l'abattage, le broyage et l'évacuation, c'est sur une ligne, et la fente, ça
doit être séparé »*). Ton §6 le dit d'ailleurs toi-même.

Ce qu'il faut corriger, c'est le **fourre-tout** : qu'une tonte et un abattage
tombent ensemble faute de troisième case. Pas le regroupement lui-même.

**Et une précision qui manque à ton brief :** aujourd'hui *rien* ne relie une
ligne de devis aux prestations qu'elle porte. « Séparer prestation métier et
groupe commercial » n'est donc pas une règle de découpage à réécrire — c'est la
migration M3.

---

## 6. Les risques de régression trouvés

| # | Risque | Déclenché par |
|---|---|---|
| R1 | la feuille de chantier double la mesure | la quantité réelle |
| R2 | le devis du client double la mesure (le PDF imprime la quantité) | idem |
| R3 | la mémoire de prix devient muette si la clé change de format | la nouvelle signature |
| R4 | le chiffrage ne trouve plus ses cases si l'on nettoie « ⌀ 45 cm » des libellés | le nettoyage |
| R5 | le report des précisions ne retrouve plus la prestation (il la cherche par le début de son libellé) | tout changement de format |
| R6 | des questions déjà répondues se reposent (leurs identifiants portent un rang, et ils sont persistés) | réordonner les prestations |
| R7 | les doublons de lignes reviennent | changer le découpage |
| R8 | le devis vide revient (le défaut du 7 août) | supprimer le repli à 0 € sans remplaçant |
| R9 | la répartition 850 + 250 se perd | « ne répartis plus » pris au pied de la lettre |
| R10 | l'assistant perd son chiffrage | supprimer la branche catalogue |
| R11 | la facture cesse de dire la même chose que le devis | l'unité s'arrêtant à `lignes_devis` |
| R12 | les deux vocabulaires de technique divergent davantage | la nouvelle signature |

---

## 7. Le plan d'exécution, ajusté au dépôt

| Étape | Ce qu'on fait | Migration |
|---|---|---|
| 0 | *(fait)* cartographie + suites A→H rouges | — |
| 1 | **P0** : l'apprentissage refuse une ligne portant plus d'une nature | non |
| 2 | batterie complète | — |
| 3 | le modèle métier structuré (M1, M2, M3) | oui |
| 4 | consommateur par consommateur : donnée structurée si elle existe, ancien mécanisme sinon, refus si ni l'un ni l'autre | non |
| 5 | une nature par prestation ; le groupe commercial cesse de détruire l'identité | non |
| 6 | quantité et unité jusqu'au devis (M5) — **et le libellé cesse de porter la mesure le même jour** | oui |
| 7 | l'état « non chiffré » (M4), et la raison dite **sur le devis** | oui |
| 8 | la signature V2 versionnée (M6) | oui |
| 9 | la troncature : marque de coupure portée par l'interface, puis plafond relevé | non |
| 10 | batterie complète + captures des écrans touchés | — |
| 11 | essai réel dictée → devis **sur son espace** (pas de clé d'IA ici) | — |

**Deux modifications par rapport à ton plan :** le P6 « envoyer le vocabulaire
métier au transcripteur » est retiré (ton §12 met la transcription hors
périmètre), et l'étape 6 est indivisible — la quantité et le nettoyage du libellé
doivent partir ensemble, à cause de R1 et R2.

**Sur le seuil de comparabilité, je ne l'invente pas**, comme ton §8 l'exige :
rien dans le dépôt ne justifie un ×2 ou un ×5. Ce que les données permettent
aujourd'hui, ce sont des critères **éliminatoires** — nature, unité, méthode,
espèce quand elle est connue — plus la tranche de diamètre qui existe déjà. Le
facteur d'écart sur la quantité demande de regarder ses vrais devis.

---

## 8. Ce que je te demande

Réponds point par point. Dis clairement quand tu n'as pas assez d'information
pour trancher, plutôt que de combler.

1. **Le conflit de l'étape 6.** Ton §5 dit de ne pas nettoyer les anciens
   libellés ; ton P1 dit que la quantité doit vivre. Les deux ensemble
   produisent « Haie (tout genre) (800 ml) — 800 » sur la feuille de chantier.
   Quelle est la bonne sortie : nettoyer les libellés au moment de la migration
   (donc toucher des données existantes, ce que tu interdis), n'afficher la
   quantité que lorsqu'elle vient de la colonne structurée, ou autre chose ?
2. **M4 et le hors-périmètre.** Rendre le prix nullable propage la nullabilité
   jusqu'à `lignes_facture`, donc à la facturation, que tu as mise hors
   périmètre. Un drapeau `chiffre` sur `lignes_prix` seule y reste, mais ajoute
   un second axe de vérité à côté du montant. Lequel recommandes-tu, et quel est
   le piège de celui que tu écartes ?
3. **L'unité sur le document du client.** Vaut-il mieux ajouter `unite` à
   `lignes_devis` seule (le devis dit « ml », la facture ne le dit pas), aux
   deux (mais on touche la facturation), ou à aucune pour l'instant ?
4. **Mes trois objections du §5** sont-elles fondées ? Y en a-t-il une où je me
   trompe et où ton brief avait raison contre la décision du patron ?
5. **La comparabilité.** Avec ces critères éliminatoires et sans seuil inventé,
   que produirais-tu comme définition de « comparable » ? Comment traiterais-tu
   l'écart de quantité **sans** fixer un facteur au jugé — et quelles données
   faudrait-il regarder pour le fixer honnêtement plus tard ?
6. **La troncature.** L'interface fournisseur doit-elle porter un booléen
   « tronqué », un `stop_reason` brut, ou un type d'erreur dédié ? Ce que je veux
   éviter : que le repli en lecture mot à mot disparaisse — il protège
   l'utilisateur d'un écran mort — tout en cessant d'être silencieux.
7. **L'ordre.** P0 avant la refonte se défend-il, sachant qu'il arrête une
   corruption en cours mais ne corrige rien de visible pour l'utilisateur ?
8. **Ce que je casserais sans m'en apercevoir**, au-delà des douze risques listés
   au §6.
