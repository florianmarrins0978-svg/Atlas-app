# Dictée → devis — cartographie et tests avant correction

**Phase de cartographie, 26 août 2026. Aucun code de production n'a été modifié.**
Ce document répond point par point au brief du patron (« Correction de la chaîne
dictée → prestations → prix → devis »). Il complète `docs/audit-dictee-devis.md`,
qui portait le diagnostic ; celui-ci porte **ce qui casse si l'on corrige**.

---

## 1. Les fichiers et fonctions réellement concernés

### La chaîne, dans l'ordre d'exécution

| # | Fichier · fonction | Ce qui s'y décide |
|---|---|---|
| 1 | `ai/services/transcription-service.ts` · `lancerTranscription` | l'audio devient du texte — **hors périmètre** (§12 du brief) |
| 2 | `ai/services/extraction-service.ts` · `extraire` | le texte devient un JSON structuré ; **la quantité et l'unité y sont justes** |
| 3 | `ai/schemas/extraction.ts` · `LigneExtraiteSchema` | le contrat : `libelle`, `description`, `quantite`, `unite`, `aConfirmer` |
| 4 | `repositories/brouillons-informations.ts` · `enregistrerGeneration` | le JSON est rangé tel quel (JSONB) — **rien n'est perdu ici** |
| 5 | `ai/services/brouillon-service.ts` · `libelleAvecQuantite` (l. 166-171) | **la quantité est collée au libellé** |
| 6 | `repositories/prestations.ts` + `db/schema.ts` l. 627 | la table n'a qu'une colonne de contenu : `libelle` |
| 7 | `lib/questions-chiffrage.ts` · `questionsAvantChiffrage` | l'arrêt ; lit le libellé par regex |
| 8 | `services/devis-depuis-dictee.ts` · `ecrirePrecisionsSurLesPrestations` | recolle la technique et le ⌀ au libellé |
| 9 | `lib/lignes-vendables.ts` · `lignesVendables` (l. 129-199) | 5 groupes ; `principal` est un fourre-tout |
| 10 | `chiffrage/proposition-prix.ts` · `preparerPropositionPrix` | l'arbre de décision du prix |
| 11 | `lib/tarif-main-oeuvre.ts` · `chiffrerMainOeuvre` | le prix au temps du **chantier entier** |
| 12 | `lib/lignes-vendables.ts` · `repartir` (l. 230-285) | la répartition ; **rend `null` quand elle ne tient pas** |
| 13 | `chiffrage/proposition-prix.ts` l. 546-549 | le repli : détachables forcées à `"0"` |
| 14 | `chiffrage/appliquer-proposition.ts` · `appliquerPropositionPrix` | écrit au détail |
| 15 | `repositories/lignes-prix.ts` · `ajouterLignePrix` (l. 24-38) | **`quantite: "1"` par défaut** |
| 16 | `app/chantiers/[id]/devis-complet/actions.ts` · `majLigneAction` | déclenche les **trois apprentissages** |
| 17 | `services/apprendre-grille.ts` · `apprendrePrixGrille` | range un montant dans une case de grille |
| 18 | `repositories/lecons-prix.ts` · `retenirLecon` / `leconsComparables` | la mémoire des prix |
| 19 | `lib/lecons-prix.ts` · `signatureLecon` | la clé de rapprochement |

### Les quatre relectures indépendantes d'un même libellé

Le brief demandait de les trouver toutes. Les voici, avec leurs motifs :

| Fichier | Ce qu'il relit | Motifs |
|---|---|---|
| `lib/lignes-vendables.ts` | nature, pour découper | `FENDAGE` `HAIE` `DESSOUCHAGE` `GRUMES` `ABATTAGE` `BILLONNAGE` |
| `lib/lecons-prix.ts` | nature + technique + ⌀, pour rapprocher | `NATURES` (6) `TECHNIQUES` (3) `DIAMETRE_LU` |
| `services/apprendre-grille.ts` | nature, pour enseigner | les 5 mêmes que `lignes-vendables`, **recopiés** |
| `lib/questions-chiffrage.ts` | nature + longueur, pour questionner | `ABATTAGE` `HAIE` `LONGUEUR` `FENDAGE` |
| `lib/mesures-arbre.ts` | ⌀, hauteur, longueur, tonnage | `DIAMETRE` `HAUTEUR` `LONGUEUR` `TONNAGE` |
| `ai/lecture-litterale.ts` | quantité + unité, en repli | `REGEX_QUANTITE` (m² m³ ml cm kg t…) |

**Trois d'entre elles portent déjà, en commentaire, la consigne de « se corriger
ensemble ».** C'est l'aveu que le modèle de données manque : on ne synchronise à
la main que ce qui n'a pas de source unique.

---

## 2. Les dépendances cachées trouvées

Ce sont elles qui justifiaient de ne pas coder tout de suite. Aucune n'était
dans le brief.

### 2.1 — La feuille de chantier écrit DÉJÀ la quantité, et P1 la fera doubler

`repositories/devis.ts` · `tachesDuChantier` (l. 584-608) alimente l'écran
**Planning** — la feuille que l'équipe emporte sur le chantier :

```ts
const q = Number(l.quantite);
return Number.isFinite(q) && q !== 1 ? `${l.libelle} — ${q.toLocaleString("fr-FR")}` : l.libelle;
```

Aujourd'hui la quantité vaut toujours 1 sur ce chemin, donc la branche ne
s'active jamais. **Le jour où P1 pose 800, l'équipe lira :**

> Haie (tout genre) (800 ml) — 800

Le libellé porte déjà la mesure (§5 du diagnostic) et la colonne la portera
aussi. Corriger la quantité **sans** nettoyer le libellé produit un doublon
visible sur un document de chantier. C'est le premier cas où P1 et « ne casse
pas les libellés existants » (§5 du brief) se contredisent — voir §5 ci-dessous.

### 2.2 — `unite` n'existe PAS sur `lignes_devis` ni sur `lignes_facture`

| Table | `quantite` | `prix_unitaire` | `unite` |
|---|---|---|---|
| `lignes_prix` (le brouillon de travail) | oui | oui | **oui** |
| `lignes_devis` (ce que le client reçoit) | oui | oui | **NON** |
| `lignes_facture` | oui | oui | **NON** |

L'unité s'arrête donc avant le document. Porter « 800 **ml** » jusqu'au devis
imprimé demande une migration sur `lignes_devis` — et la même sur
`lignes_facture` si l'on veut que la facture dise la même chose que le devis.
**Or la facturation est hors périmètre par son propre §12.** Deux options, et
c'est à lui de trancher (§6).

### 2.3 — « Inconnu » n'a de place dans aucune des trois tables

`quantite` est `NOT NULL DEFAULT '1'` et `prix_unitaire` / `montant` sont
`NOT NULL` sur `lignes_prix`, `lignes_devis` **et** `lignes_facture`. Il n'existe
aujourd'hui **aucune façon d'écrire « je ne sais pas »** — d'où le `"0"` que le
brief veut supprimer. Le supprimer sans lui donner un remplaçant rendrait la
chaîne incapable d'écrire quoi que ce soit.

Et ce `"0"` n'est pas une négligence : il vient de **sa propre décision du
7 août 2026** — *« le devis ne comporte aucune ligne, gros bug »*. Les lignes
sont écrites à 0 € précisément pour que son travail dicté ne disparaisse pas.
`devis-depuis-dictee.ts` l. 376-391 le dit en toutes lettres.

### 2.4 — Deux vocabulaires pour la même technique

| Où | La clé de « démontage avec rétention » |
|---|---|
| `lib/grille-prix.ts` · `TECHNIQUES_PAR_DEFAUT` | `demontage_retention` |
| `lib/lecons-prix.ts` · `TECHNIQUES` | `retention` |

Les deux fonctionnent, parce qu'ils ne lisent pas la même chose : la grille lit
`precisions_chantier.valeur`, la mémoire lit le **texte** du libellé. Mais une
correction qui unifierait les deux doit savoir qu'ils divergent — **ce piège a
fait rougir un de mes propres tests pendant l'écriture de cette suite**, et il
fera rougir P2.

### 2.5 — `peutPreparerDevis` protège déjà contre le devis à 0 €

`lib/preparation-devis.ts` refuse de préparer un devis dont le total est ≤ 0.
Ce garde-fou existe et fonctionne : il ne faut pas le défaire en introduisant un
état « non chiffré ». Une ligne non chiffrée doit compter comme « pas encore
prête », pas comme « zéro euro ».

### 2.6 — La branche catalogue n'est morte QUE sur le chemin de la dictée

`chiffrage/service.ts` · `chiffrerChantier(ctx, chantierId, motCleCatalogue?)` :

- `ai/tools/calculer-chiffrage.ts` **passe** le mot-clé — la branche vit ;
- `chiffrage/proposition-prix.ts` l. 336 **ne le passe pas** — le catalogue et
  `historique_prix` ne sont jamais consultés depuis une dictée.

Correction de ce que j'avais écrit hier : la branche n'est pas morte, elle est
morte **de ce côté-ci**. La supprimer casserait l'assistant.

### 2.7 — La troncature est perdue à la frontière du fournisseur

`providers/llm/anthropic.ts` l. 200 lit `donnees.content` et **jette
`stop_reason`**. `ResultatLLM` (`providers/llm/interface.ts`) ne porte que
`{ succes, texte }`. Aucun correctif en aval ne peut donc distinguer une réponse
coupée d'une réponse illisible : l'information n'arrive pas jusque-là. Le
correctif H commence par une extension **additive** de l'interface, qui touche
les quatre fournisseurs.

### 2.8 — 22 suites navigateur touchent au devis

`test-devis-*-e2e.ts` (13), `test-dicter-dans-le-devis-e2e.ts`,
`test-calcul-prix-e2e.ts`, `test-grille-prix-e2e.ts`,
`test-lecons-prix-e2e.ts`, `test-prix-e2e.ts`, `test-reduction-devis-e2e.ts`,
`test-anneau-*`, `test-allure-de-mes-devis-e2e.ts`. Et **23 suites base**
écrivent `quantite: "1"` en dur dans leurs jeux d'essai : elles ne rougiront pas
(elles posent la valeur elles-mêmes), mais elles cesseront de décrire le produit.

---

## 3. Les tests ajoutés, et la batterie avant correction

Deux suites neuves, **rouges par construction** — c'est ce qu'il a demandé.
Aucune ne réclame de clé d'API : le seul appel de modèle passe par un
fournisseur injecté, fabriqué dans la suite.

### `scripts/test-dictee-devis-identite.ts` — sans base

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
❌ une réponse coupée ne devient pas une lecture mot à mot indiscernable d'une panne
❌ le fournisseur Anthropic lit `stop_reason`

3 réussite(s), 7 échec(s).
```

### `scripts/test-dictee-devis-identite-db.ts` — avec base

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
   demontage_retention|d40 = 1500.00 €  (au lieu de 800.00 €)
✅ un prix posé sur une SEULE prestation continue, lui, d'enseigner

1 réussite(s), 5 échec(s).
```

**La ligne qui compte, et elle chiffre la corruption :** un prix posé sur la
ligne qui porte la tonte ET le démontage a **écrasé** la case
`demontage_retention|d40` de sa grille, de 800 € à 1 500 €. La tonte de 1 200 m²
est désormais dans son prix d'abattage. Le contrôle le prouve avec un nombre,
plus seulement par lecture du code.

### Deux contrôles qui coupent dans l'autre sens, et pourquoi

Une correction qui se contenterait de tout refuser passerait la moitié de ces
tests en détruisant la mémoire du patron. Deux cas montent donc la garde
inverse : *deux haies de 50 et 55 ml restent comparables*, et *un prix posé sur
une seule prestation continue d'enseigner*. Ils sont **verts aujourd'hui et
doivent le rester**.

### Un piège rencontré en écrivant ces tests, et qu'il faut connaître

La première version du contrôle D comparait le **nombre** de cases de la grille.
Elle passait au vert alors que la case était écrasée de 800 € à 1 500 € : la
taille ne bougeait pas. C'est exactement le défaut du 15 août 2026 —
*un contrôle qui mesure zéro ne mesure rien* (`CLAUDE.md` §5). Le contrôle
compare désormais les **valeurs**, et un témoin prouve d'abord que la case est
réellement calculable.

### La batterie complète, avant correction

```
npx tsc --noEmit          → 0 erreur
npx eslint                → 0 erreur
npm test                  → 247 / 249 suites réussies
```

**Les deux seules suites en échec sont les deux suites neuves.** Rien d'autre
n'est cassé : la chaîne d'aujourd'hui est cohérente avec elle-même, et c'est
précisément le problème — elle est cohérente autour d'un modèle de données faux.

```
❌ test-dictee-devis-identite-db.ts a échoué (code: 1)
❌ test-dictee-devis-identite.ts a échoué (code: 1)
```

**La suite navigateur n'a pas été jouée dans cette phase** — voir §8.

---

## 4. Les migrations additives exactement nécessaires

Aucune ne modifie ni ne supprime de donnée existante. Aucune ne touche aux
migrations déjà appliquées.

| # | Migration | Pour | Colonnes |
|---|---|---|---|
| M1 | `prestations` | P1 | `quantite numeric NULL`, `unite text NULL`, `nature text NULL`, `espece text NULL`, `methode text NULL`, `a_confirmer boolean NOT NULL DEFAULT false` |
| M2 | `prestations` | P1 | `caracteristiques jsonb NOT NULL DEFAULT '{}'` — ⌀, hauteur, largeur, longueur, tonnage. **Structure souple plutôt qu'une colonne par mesure**, comme le brief le demande : les métiers n'ont pas les mêmes |
| M3 | `lignes_prix` | P1 + C | `prestation_id uuid NULL` — le lien qui manque entre une ligne commerciale et les prestations qu'elle porte. Sans lui, « une nature par ligne » reste une propriété du texte |
| M4 | `lignes_prix` | C | `chiffre boolean NOT NULL DEFAULT true`, ou `prix_unitaire` rendu nullable. **Un état « non chiffré » qui ne détourne pas le 0** |
| M5 | `lignes_devis` | P1 | `unite text NULL` — sans quoi l'unité s'arrête avant le document du client |
| M6 | `lecons_prix` | P2 | `signature_v2 text NULL`, `version_signature int NOT NULL DEFAULT 1`. **La colonne `signature` n'est pas touchée** : V1 reste lisible, et une leçon dont on ne peut pas déduire V2 garde `signature_v2 = NULL` — jamais une valeur devinée |

**Rien n'est rempli au passage.** Une prestation ancienne dont on ne peut pas
établir la quantité avec certitude garde `NULL`. C'est sa règle, et elle
s'applique aussi à la migration.

**M4 mérite sa question**, parce que je ne veux pas trancher seul : rendre
`prix_unitaire` nullable touche `lignes_devis` et `lignes_facture` par
ricochet — donc la facturation, hors périmètre. Un drapeau `chiffre` sur
`lignes_prix` seule reste dans le périmètre. Voir §6.

---

## 5. Les risques de régression découverts

| # | Risque | Déclenché par | Ce qui l'attrape |
|---|---|---|---|
| R1 | **La feuille de chantier double la mesure** : « Haie (800 ml) — 800 » sur le document de l'équipe | P1 | aucun test aujourd'hui — **à écrire** |
| R2 | **Le devis du client double la mesure** de la même façon (le PDF imprime `quantite`) | P1 | `test-devis-pdf.ts`, `test-allure-pdf.ts` — mais ils posent leurs quantités à la main, donc ils ne le verront pas |
| R3 | **La mémoire de prix devient muette** si la clé change de format | P2 | cas G, vert aujourd'hui, **doit le rester** |
| R4 | **Le chiffrage cesse de trouver ses cases** si l'on nettoie « ⌀ 45 cm » ou « 12 m de haut » des libellés | P1 + nettoyage | `test-devis-grilles.ts`, `test-questions-chiffrage.ts` |
| R5 | **Le report des précisions ne retrouve plus la prestation** : il la cherche par `startsWith(clé + " —")` | tout changement du format de libellé | `test-devis-depuis-dictee-e2e.ts` |
| R6 | **Les identifiants de questions** `<sujet>#<rang>` sont persistés : les changer repose des questions déjà répondues | P3 (réordonner les prestations) | `test-questions-chiffrage.ts` |
| R7 | **Les doublons reviennent** si le découpage change sans que `ligneDejaAuDetail` suive | P3 | `test-devis-doublon-e2e.ts`, `test-prix-doublon-serveur.ts` |
| R8 | **Le devis vide revient** (défaut du 7 août) si l'on supprime le repli à 0 € sans remplaçant | C | `test-devis-depuis-dictee-e2e.ts` |
| R9 | **La répartition 850 + 250 se perd** — c'est SA décision du 7 août, pas une heuristique à jeter | P4 (« ne répartis plus arbitrairement ») | `test-lignes-vendables.ts` |
| R10 | **L'assistant perd son chiffrage** si l'on supprime la branche catalogue | P6 | `test-ia-08-orchestrateur.ts` |
| R11 | **La facture cesse de dire la même chose que le devis** si l'unité s'arrête à `lignes_devis` | M5 sans M5-bis | `test-factures.ts`, `test-facture-pdf.ts` |
| R12 | **Deux vocabulaires de technique divergent davantage** (`retention` / `demontage_retention`) | P2 | à écrire |

---

## 6. Trois points du brief qui se heurtent à SES décisions

Le brief vient de ChatGPT et il est bon. Trois points, cependant, contredisent
des choix que le patron a faits lui-même. Je ne tranche pas seul.

### 6.1 — « Supprime toute logique assimilant prix inconnu → 0 € »

**Ce 0 € est sa décision du 7 août 2026.** Il avait dicté quatre travaux, lu un
devis vide, et écrit : *« le devis ne comporte aucune ligne, gros bug »*. Les
lignes à 0 € existent pour que son travail ne disparaisse pas quand le prix est
inconnu — l'écran les montre comme des prix à saisir, jamais comme des montants
décidés.

**Le brief a raison sur le fond** : un 0 € reste un montant, et sur un devis
imprimé il se lit « gratuit ». Mais la correction n'est pas de supprimer la
ligne — c'est de lui donner un **état** distinct (M4). Ce que je propose, sauf
avis contraire : la ligne s'écrit, elle porte « à chiffrer » au lieu de
« 0,00 € », et `peutPreparerDevis` la compte comme non prête.

### 6.2 — « Ne répartis plus arbitrairement le prix total »

Il faut distinguer deux choses que le brief confond :

| | |
|---|---|
| **la répartition 850 + 250** | c'est SA règle du 7 août, expliquée par lui (*« si le client ne veut pas la fente, il va trouver le reste cher »*). Elle n'est pas arbitraire, et je ne la touche pas |
| **le repli quand la répartition échoue** | ça, c'est arbitraire : tout le total sur la principale, zéro sur les autres, sans un mot sur le devis. C'est ce qui met sa haie à 0 € |

Je corrige le second, je garde le premier.

### 6.3 — « Une action métier = une prestation distincte »

D'accord — mais `lignes-vendables.ts` n'a jamais prétendu découper par action :
il découpe par **ce que le client peut refuser seul**, et c'est aussi sa règle
(*« l'abattage, le broyage et l'évacuation, c'est sur une ligne »*). Le brief le
dit d'ailleurs lui-même au §6. Ce que P3 corrige, c'est le **fourre-tout** :
qu'une tonte et un abattage tombent ensemble faute de troisième case. Pas le
regroupement lui-même.

**Et une précision qui manque au brief :** aujourd'hui rien ne relie une ligne de
devis aux prestations qu'elle porte. « Séparer prestation métier et groupe
commercial » n'est donc pas une règle de découpage — c'est la migration M3.

---

## 7. Le plan d'exécution ajusté au dépôt

Inchangé dans l'esprit, ajusté sur trois points : le P6 « vocabulaire au
transcripteur » est retiré (son §12), la troncature devient une extension
d'interface avant d'être un plafond, et P1 se dédouble parce que le nettoyage des
libellés ne peut pas partir avec la migration.

| Étape | Ce qu'on fait | Migration | Ce qui doit rester vert |
|---|---|---|---|
| **0** | *(fait)* cartographie + suites A→H rouges | — | — |
| **1 — P0** | `apprendrePrixGrille` et `retenirLecon` refusent une ligne portant plus d'une nature | non | D, F, et « une seule prestation enseigne encore » |
| **2** | batterie complète | — | tout |
| **3 — M1/M2/M3** | modèle métier structuré, colonnes nullables, `prestation_id` sur les lignes | oui | tout : rien ne les lit encore |
| **4** | consommateur par consommateur : donnée structurée si elle existe, ancien mécanisme sinon, refus si ni l'un ni l'autre | non | R4, R5, R6 |
| **5 — P3** | une nature par prestation ; le groupe commercial cesse de détruire l'identité | non | B, R7, R9 |
| **6 — P1 (2ᵉ moitié)** | quantité et unité écrites jusqu'à `lignes_prix` puis `lignes_devis` (M5) | oui | A, **et R1/R2 : le libellé cesse de porter la mesure le même jour** |
| **7 — C/P4** | l'état « non chiffré » (M4), et la raison dite **sur le devis** | oui | C, R8 |
| **8 — P2** | signature V2 versionnée (M6), critères éliminatoires puis classement | oui | E, **G surtout** |
| **9 — H** | `stop_reason` porté par l'interface, troncature = réponse invalide, plafond relevé ensuite | non | H |
| **10** | batterie complète + capture des écrans touchés | — | tout |
| **11** | essai réel dictée → devis **sur son espace** — pas ici, faute de clé | — | — |

**Sur le seuil de comparabilité (P2), je ne l'invente pas.** Le brief l'interdit
et il a raison : rien dans le dépôt ne justifie un ×2 ou un ×5. Ce que les
données permettent aujourd'hui, ce sont des **critères éliminatoires** — nature,
unité, méthode, espèce quand elle est connue — et la tranche de ⌀ qui existe
déjà. Le facteur d'écart sur la quantité, lui, demande de regarder ses vrais
devis. **Je le signalerai plutôt que de le fixer au jugé.**

---

## 8. Ce que je n'ai pas fait, et pourquoi

- **Aucun code de production modifié.** Seuls deux fichiers de test sont neufs.
- **Aucune donnée touchée.** Les suites tournent sur la base locale, vidée avant
  de commencer.
- **La transcription n'a pas été regardée** — hors périmètre par son §12.
- **La suite navigateur n'a pas été jouée dans cette phase** : elle bâtit
  l'application et n'apprendrait rien tant qu'aucun code de production n'a
  changé. Elle passe à l'étape 2 du plan, avant la première correction poussée.
- **Ces deux suites rouges ne doivent pas atteindre `main`** avant l'étape 5 :
  une batterie rouge sur `main` cesse d'être lue par les autres sessions, et
  c'est le garde-fou entier qu'on perd.

---

*Écrit le 26 août 2026. En attente de son feu vert pour l'étape 1 (P0).*
