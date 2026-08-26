# 04 — Lot B : la prestation cesse d'être une seule chaîne de texte

Tu n'as pas accès au dépôt. Ce document est autonome.

Contexte en trois lignes : application de paysagiste-élagueur (Next.js +
PostgreSQL + Drizzle, multi-entreprises avec RLS). L'artisan dicte son chantier ;
la dictée devient des prestations, puis un devis. Le modèle lisait bien « 800 »
et « ml », mais la table `prestations` n'avait **qu'une colonne de contenu** :
`libelle`. La mesure y était recollée, et quatre modules l'en ressortaient
ensuite à coups d'expressions régulières.

Lot A a fermé la corruption de l'apprentissage. **Lot B donne à la prestation
des champs à elle.**

---

## 1. Le schéma, avant et après

### `prestations`

| Colonne | Avant | Après |
|---|---|---|
| `id`, `entreprise_id`, `chantier_id`, `ordre`, `created_at`, `updated_at` | ✓ | inchangées |
| `libelle` `text NOT NULL DEFAULT ''` | ✓ | **inchangée, et elle porte toujours « (800 ml) »** |
| `quantite` `numeric(10,2)` | — | **NULL** |
| `unite` `text` | — | **NULL** |
| `nature` `text` | — | **NULL** |
| `espece` `text` | — | **NULL** |
| `methode` `text` | — | **NULL** |
| `caracteristiques` `jsonb` | — | **NULL** |
| `a_confirmer` `boolean` | — | **NULL** |

Contraintes ajoutées :

```sql
prestations_quantite_positive      CHECK (quantite IS NULL OR quantite > 0)
prestations_quantite_avec_unite    CHECK ((quantite IS NULL) = (unite IS NULL))
prestations_caracteristiques_objet CHECK (caracteristiques IS NULL
                                          OR jsonb_typeof(caracteristiques) = 'object')
prestations_id_entreprise_uk       UNIQUE (id, entreprise_id)
```

**Toutes les colonnes sont nullables, `a_confirmer` compris.** Un
`NOT NULL DEFAULT false` aurait affirmé de chaque ancienne prestation qu'elle ne
portait aucun doute — ce que personne ne sait. NULL dit « on ne sait pas » ;
`false` dit « on a regardé, il n'y en avait pas ». Ce n'est pas la même chose.

`prestations_quantite_avec_unite` mérite un mot : **« 800 » tout seul se lirait
800 mètres, 800 m² ou 800 heures selon qui regarde.** C'est exactement
l'ambiguïté qui a produit le devis fautif. Les deux entrent ensemble ou pas du
tout, et la base le fait respecter.

### `lignes_prix_prestations` — table neuve

```sql
id             uuid PK
entreprise_id  uuid NOT NULL → entreprises(id) ON DELETE CASCADE
ligne_prix_id  uuid NOT NULL
prestation_id  uuid NOT NULL
ordre          integer NOT NULL DEFAULT 0
created_at     timestamptz NOT NULL DEFAULT now()

FK (ligne_prix_id, entreprise_id) → lignes_prix(id, entreprise_id)   ON DELETE CASCADE
FK (prestation_id, entreprise_id) → prestations(id, entreprise_id)   ON DELETE CASCADE
UNIQUE (prestation_id, entreprise_id)
INDEX (entreprise_id, ligne_prix_id, ordre)
RLS: ENABLE + FORCE, isolation par entreprise_id
GRANT SELECT, INSERT, UPDATE, DELETE TO atlas_app
```

**Rien d'autre n'a bougé.** `lignes_prix`, `lignes_devis` et `lignes_facture` sont
intactes — pas de `unite`, pas d'état « non chiffré » : c'est M4/M5, que tu as
mis hors de ce lot.

---

## 2. Les migrations créées

- `drizzle/0068_prestation_structuree.sql` — M1 + M2, colonnes et contraintes ;
- `drizzle/0069_ligne_de_prix_et_ses_prestations.sql` — M3, la table de liaison.

Toutes deux **additives** : `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT
EXISTS`, `ADD CONSTRAINT`. Aucun `UPDATE`, aucun `DELETE`, aucun `ALTER COLUMN`,
aucune migration existante touchée.

---

## 3. La cardinalité, et pourquoi ce n'est pas une colonne

Tu m'as demandé de ne pas figer `lignes_prix.prestation_id` sans vérifier.
Vérification faite dans `src/lib/lignes-vendables.ts`, qui produit les lignes.

| Constat | Preuve dans le code |
|---|---|
| **Une ligne porte 1 à N prestations** | `LigneVendable.membres: string[]` — le découpage réunit « abattage, broyage, évacuation » sur une ligne, c'est la règle du patron du 7 août |
| **Une prestation appartient à 0 ou 1 ligne** | chaque libellé est rangé dans un seul groupe (`continue` après chaque motif) ; le billonnage absorbé n'entre dans aucun |
| **La plupart des lignes n'en portent aucune** | 6 chemins créent une ligne de prix ; **1 seul** connaît les prestations. Une ligne à la main, une ligne dictée dans le devis, une ligne née d'un tarif n'en ont pas |

**Donc une colonne `prestation_id` sur `lignes_prix` aurait été fausse** : elle
n'aurait retenu qu'une prestation sur trois et perdu les deux autres. Table de
liaison.

**L'unicité `(prestation_id, entreprise_id)` est une décision que je te
signale.** Rien dans le dépôt ne dit qu'un même travail ne pourrait pas être
vendu sur deux lignes — c'est ta question R17, et l'information manque. J'ai
encodé **ce que l'application fait réellement aujourd'hui**, pas une règle
métier que j'aurais inventée. Le raisonnement qui tranche : retirer une
contrainte d'unicité est une migration d'une ligne ; laisser entrer des données
qui la violent puis vouloir la poser ne l'est pas. Le conservatisme va dans ce
sens-là.

**Les suppressions, et je n'ai pas pris CASCADE par facilité** :

| Événement | Effet | Pourquoi |
|---|---|---|
| ligne de prix supprimée | le lien disparaît, **la prestation reste** | le travail est toujours à faire, il n'est plus vendu sur cette ligne |
| prestation supprimée | le lien disparaît, **la ligne reste avec son montant** | le patron a pu vouloir cette ligne ; et un lien conservé serait un identifiant orphelin (ton R16) |

Le CASCADE porte sur **la liaison**, jamais sur ce qu'elle relie. C'est ce qui
la rend sûre. Les deux cas sont éprouvés.

---

## 4. Le chemin complet d'une quantité — et où il s'arrête aujourd'hui

```
dictée
  └─ modèle → JSON        { libelle: "Haie (tout genre)", quantite: "800", unite: "ml", aConfirmer: true }
       └─ brouillons_informations.contenu (JSONB)          ✅ intact, comme avant
            └─ confirmerBrouillon
                 ├─ libelleAvecQuantite  → libelle = "Haie (tout genre) (800 ml)"   ← INCHANGÉ, volontairement
                 └─ structureDeLaPrestation → prestations.quantite = 800.00
                                              prestations.unite    = "ml"
                                              prestations.a_confirmer = true        ✅ NOUVEAU
            └─ ses réponses à l'arrêt (precisions_chantier)
                 └─ structureDepuisPrecisions → prestations.methode = "demontage_retention"
                                                 prestations.caracteristiques = { diametreCm: 45 }   ✅ NOUVEAU
       └─ chiffrage → appliquerPropositionPrix
            ├─ lignes_prix.libelle   = "Haie (tout genre) (800 ml)"
            ├─ lignes_prix.quantite  = 1        ← ❌ TOUJOURS FAUX, c'est le lot D
            └─ lignes_prix_prestations : la ligne sait désormais QUELLES prestations elle vend   ✅ NOUVEAU
```

**Je te le dis franchement : la quantité n'arrive pas encore à `lignes_prix`.**
Ton critère 4 demandait le chemin « jusqu'à `lignes_prix` » — il s'arrête à la
prestation, et le lien permet désormais de le franchir. L'écrire aujourd'hui
imposerait de retirer la mesure du libellé le même jour (sinon la feuille de
chantier affiche « Haie (800 ml) — 800 »), et retirer la mesure du libellé
casserait les quatre moteurs qui l'y relisent. C'est le découpage B → C → D que
tu as validé, et je m'y tiens.

### Ce que le lot NE remplit pas, et pourquoi

`nature` et `espece` restent NULL **même sur une dictée neuve**. Le contrat
d'extraction ne les demande pas au modèle : les déduire du libellé serait
créer exactement le septième parseur que ton §4 interdit. Les remplir demande
d'étendre ce qu'on demande au modèle — une décision qui t'appartient, hors de
ce lot.

`methode` et `caracteristiques`, eux, sont remplis : ils viennent d'une source
**déjà certaine et déjà structurée** — les réponses du patron à l'arrêt
d'avant-chiffrage. On déplace une donnée, on n'en fabrique aucune.

---

## 5. La preuve qu'aucune donnée historique n'a été réécrite

Trois preuves, de la plus faible à la plus forte :

1. **Les migrations ne contiennent aucun `UPDATE`, `DELETE` ni `ALTER COLUMN`.**
   Uniquement `ADD COLUMN IF NOT EXISTS`, `ADD CONSTRAINT`, `CREATE TABLE`.
2. **Aucune valeur par défaut sur les nouvelles colonnes.** Une ancienne ligne
   ressort donc avec sept `NULL`, pas avec sept valeurs plausibles.
3. **Un contrôle le vérifie en base**, et il compte : une prestation créée sans
   structure (le chemin de la saisie à la main) doit avoir `quantite`, `unite`,
   `nature`, `espece`, `methode`, `caracteristiques` **et** `a_confirmer` tous
   nuls. Le compte des lignes qui violeraient cela doit être zéro.

Le libellé, lui, est vérifié à l'identique : après une dictée neuve, il vaut
toujours `"Haie (tout genre) (800 ml)"` — le contrôle l'exige explicitement.

---

## 6. Les tests nouveaux

### `scripts/test-prestation-structuree.ts` — pur, sans base, sans clé

```
=== Lire un nombre écrit par un modèle ===
  ✓ un entier · une virgule · un point · des espaces
  ✓ ce qui ne se lit pas ne se devine pas  (« environ », « à mesurer », vide)
  ✓ zéro et négatif ne sont pas des quantités
=== La quantité et l'unité entrent ENSEMBLE ou pas du tout ===
  ✓ les deux présentes : les deux passent
  ✓ une quantité sans unité ne passe pas
  ✓ une unité sans quantité ne passe pas non plus
  ✓ son unité n'est PAS normalisée à notre convenance
  ✓ le doute du modèle est recopié tel quel
=== Ce que ses réponses à l'arrêt disent de la prestation ===
  ✓ la technique devient la méthode
  ✓ le diamètre et la hauteur deviennent des mesures
  ✓ le diamètre est celui de l'ARBRE, quelle que soit la question posée
  ✓ rien de mesuré donne NULL, jamais un objet vide
  ✓ une mesure illisible est ignorée, pas convertie en zéro
=== Les travaux réunis dans une ligne se relisent d'un seul endroit ===
  ✓ le séparateur est le retour à la ligne · un seul travail · le vide

19 réussite(s), 0 échec(s).
```

### `scripts/test-prestation-structuree-db.ts` — le chemin réel

```
=== Le chemin complet : du JSON du modèle aux colonnes ===
✅ la quantité et l'unité dictées vivent dans leurs colonnes
✅ le libellé continue de la porter — les moteurs le relisent encore
✅ une prestation sans mesure garde ses colonnes vides
=== Les anciennes données : rien n'a été deviné ===
✅ une prestation créée à la main garde tout à NULL          (ton R13)
✅ aucune ligne existante n'a été réécrite par la migration
✅ la base refuse une quantité sans unité
=== Quelles prestations une ligne de devis vend ===
✅ la ligne principale connaît les prestations qu'elle porte
✅ une prestation n'appartient qu'à UNE ligne                (ton R17)
✅ supprimer une prestation ne laisse aucun identifiant orphelin  (ton R16)
✅ supprimer une ligne ne supprime pas la prestation
✅ le rapprochement se fait sur le chantier, jamais au-delà
=== L'isolation entre entreprises tient ===
✅ une autre entreprise ne voit aucune liaison

12 réussite(s), 0 échec(s).
```

---

## 7. L'état des anciens tests rouges — aucun n'a été rendu vert artificiellement

| Cas | Avant lot B | Après lot B | Pourquoi |
|---|---|---|---|
| **A** — la quantité survit jusqu'à la ligne du devis | ❌ | **❌ toujours** | `lignes_prix.quantite` vaut encore 1. C'est le lot D |
| **B** — deux travaux, deux identités | ❌ | **❌ toujours** | le découpage n'a pas changé. C'est le lot du fourre-tout |
| **C** — inconnu n'est ni 0 ni 1 | ❌ | **❌ toujours** | M4 est hors de ce lot |
| **E** — un faux comparable | ❌ | **❌ toujours** | la signature n'a pas bougé. C'est le lot V2 |
| **H** — la troncature | ❌ | **❌ toujours** | l'interface fournisseur n'a pas bougé |
| **F** — un lot à deux natures n'enseigne rien | ✅ | ✅ | acquis au lot A |
| **G** — les clés V1 restent lisibles | ✅ | ✅ | `signatureLecon` n'a pas été touchée |

**Cinq contrôles restent rouges, exprès.** Aucune assertion n'a été affaiblie,
aucun seuil déplacé.

---

## 8. Les résultats

```
npx tsc --noEmit   → 0 erreur
npx eslint         → 0 erreur   (3 avertissements préexistants, dans des fichiers non touchés)
npm test           → 250 / 252 suites réussies
```

Les **deux seules** suites en échec sont celles qui portent les contrôles A, B,
C, E et H — ceux des lots suivants, laissés rouges exprès. Deux suites neuves
sont entrées vertes (19 + 12 cas), et **la régression que l'export RGPD avait
signalée est corrigée** (voir §9).

---

## 9. Nouvelles dépendances cachées découvertes

### R22 bis — l'export RGPD a refusé le lot, et il avait raison

**Une régression réelle, attrapée par un contrôle qui existait déjà.** Le dépôt
tient un garde-fou qui interroge la BASE — jamais une liste écrite à la main —
et exige que **toute table portant un `entreprise_id` figure dans l'export de
l'entreprise**. `lignes_prix_prestations` n'y était pas : deux contrôles sont
passés au rouge, avec le message qui dit quoi faire.

Sans lui, la sauvegarde d'un artisan aurait rendu ses lignes de devis et ses
prestations **sans dire lesquelles vont ensemble** — et c'est précisément cette
ignorance qui a produit la case d'abattage fausse.

La table est donc exportée. C'est la seule modification de ce lot en dehors du
périmètre annoncé, et elle est **exigée** par la règle RGPD du dépôt, pas
choisie. Je le signale plutôt que de le noyer dans le diff.

### R23 — la structure n'atteint pas une prestation DÉJÀ enregistrée

`confirmerBrouillon` refuse d'écrire une prestation dont le libellé existe déjà
sur le chantier — c'est le garde-fou contre le devis doublé (défaut du 3 août).
Conséquence : **rejouer la dictée sur un chantier existant n'ajoute aucune
structure aux prestations déjà là.** Les colonnes ne se remplissent donc que
sur les chantiers neufs.

**Je n'ai pas corrigé cela dans ce lot**, délibérément : toucher cette boucle,
c'est toucher la protection contre le doublon, et le gain (remplir des colonnes
que personne ne lit encore) ne vaut pas le risque. C'est un point du lot C.

### R24 — `prestations` n'avait pas de clé unique `(id, entreprise_id)`

Le dépôt utilise partout des clés étrangères composites pour qu'un identifiant
volé chez un autre artisan ne référence rien. `lignes_prix` l'avait
(migration 0023) ; `prestations` non. Il a fallu l'ajouter avant de pouvoir
poser la clé étrangère de la table de liaison. Additif, sans effet sur
l'existant.

### R25 — un piège de contrôle, et il a mordu pendant l'écriture

Mes premières requêtes de vérification passaient par une connexion **sans
`app.entreprise_id`**. La RLS ne renvoyait alors aucune ligne, et un `count(*)`
rendait zéro : trois contrôles échouaient en accusant le produit, alors que
c'est le contrôle qui regardait sans dire qui il était. Corrigé, et le piège est
écrit en commentaire — c'est le genre d'erreur qui envoie chercher au mauvais
endroit pendant une heure.

---

## 10. Ce que je te demande

1. **La cardinalité et l'unicité du §3** te paraissent-elles justes ? Vois-tu un
   cas de ce métier où un même travail devrait apparaître sur deux lignes
   commerciales ?
2. **`nature` et `espece` restent vides.** Les remplir demande d'étendre ce
   qu'on demande au modèle. Est-ce le bon moment, ou vaut-il mieux les laisser
   vides jusqu'à ce qu'un consommateur en ait réellement besoin ?
3. **R23** : la structure ne touche que les chantiers neufs. D'accord pour
   traiter cela au lot C, ou est-ce plus urgent que je ne le crois ?
4. **Le CHECK `quantite ⟺ unite`** : trop strict ? Un artisan pourrait-il
   légitimement dicter un nombre sans unité que nous devrions garder ?
5. **`caracteristiques` en JSONB** avec les clés `diametreCm`, `hauteurM`,
   `longueurMl`, `tonnageT` — bonne granularité, ou faut-il un format plus
   explicite (valeur + unité par mesure) ?
6. **Que casse ce lot** auquel je n'aurais pas pensé ?
