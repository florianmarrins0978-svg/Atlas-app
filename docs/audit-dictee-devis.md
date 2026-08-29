# Audit — de la dictée au devis

**Phase de lecture, 26 août 2026. Aucune ligne de code n'a été écrite, aucune
donnée n'a été touchée.**

Ce document répond au brief du patron : *« je veux savoir EXACTEMENT à quelle
étape chaque information devient fausse »*. Il est écrit pour lui être
retransmis, et il se corrige noir sur blanc si l'un de ses verdicts se révèle
faux (`CLAUDE.md` §2 bis).

---

## 0. À SIGNALER AVANT TOUTE AUTRE CHOSE

Son brief demande d'arrêter et de prévenir si l'on trouve un mécanisme
susceptible de corrompre des prix historiques. Il y en a un, et il est actif.

**Une ligne de devis qui porte DEUX prestations enseigne quand même la grille et
la mémoire des prix.**

`src/app/chantiers/[id]/devis-complet/actions.ts:67` et suivantes : dès qu'il
pose un prix sur une ligne, trois apprentissages partent —
`retenirLecon`, `noterRetenu`, `apprendrePrixGrille`.

Or la ligne principale de son devis porte **« Tonte de la pelouse (1200 m²) »
ET « Érable — démontage en rétention »**, réunies (voir §4). Le classement se
fait au premier mot reconnu (`apprendre-grille.ts:51`) : le motif `ABATTAGE`
répond, la nature devient `abattage`.

Conséquence, s'il tape 1 500 € sur cette ligne :

| Ce qu'il croit dire | Ce qui est écrit |
|---|---|
| « ce lot de travaux vaut 1 500 € » | `grille_prix`, case abattage × rétention × ⌀ = **1 500 €** |
| | `lecons_prix`, signature `abattage\|retention` = **1 500 €** |

La tonte de 1 200 m² est alors **cuite dans son prix d'abattage**, et ce prix
revient ensuite tout seul sur chaque démontage en rétention, avec l'autorité de
sa grille. Rien ne le dit à l'écran, et cela ne se défait pas d'un geste.

Le même mécanisme vaut pour la haie : `apprendre-grille.ts:95` divise le montant
de la ligne par la longueur lue **dans le libellé** — si la transcription a
entendu 800 au lieu de 80, son prix au mètre linéaire est faux d'un facteur dix,
pour tous les devis suivants.

**Ce que ça demande, et ce n'est pas dans ce lot :** regarder sur son espace, dans
*Réglages → Mes prix*, si des cases portent déjà des montants qui ne
correspondent à aucun abattage seul. Le correctif est en P0 du plan (§14) — il
est petit, pur, et sans migration.

---

## 1. L'architecture réelle

Lue dans le code exécuté, pas déduite des noms de fichiers.

| # | Étape | Fichier · fonction | Entrée | Sortie | IA |
|---|---|---|---|---|---|
| 1 | Enregistrement | `chantiers/[id]/note-vocale/actions.ts` | audio | `notes_vocales.storage_key` | non |
| 2 | **Transcription** | `ai/services/transcription-service.ts` · `lancerTranscription` → `providers/transcription/fabrique.ts` | octets audio | `notes_vocales.transcription` (texte brut) | **oui** |
| 3 | Consigne métier | `lib/consigne-metier.ts` · `construireConsigneMetier` | `termes_metier` + `corrections_dictee` | texte ≤ 9 000 car. | non |
| 4 | **Extraction** | `ai/services/extraction-service.ts` · `extraire` | transcription | `PropositionExtraction` (JSON validé zod) | **oui** |
| 4bis | Filet | `ai/lecture-litterale.ts` · `lireLitteralement` | transcription | même forme, `lecture: "litterale"` | non |
| 5 | Rangement | `repositories/brouillons-informations.ts` | proposition | `brouillons_informations.contenu` (JSONB) | non |
| 6 | **Confirmation** | `ai/services/brouillon-service.ts` · `confirmerBrouillon` → `libelleAvecQuantite` | contenu JSONB | `prestations.libelle` (**texte seul**) | non |
| 7 | Arrêt | `lib/questions-chiffrage.ts` · `questionsAvantChiffrage` | libellés | questions technique / ⌀ / longueur | non |
| 8 | Report des réponses | `services/devis-depuis-dictee.ts` · `ecrirePrecisionsSurLesPrestations` → `libelleEnrichi` | `precisions_chantier` | libellé + « — technique, ⌀ X cm » | non |
| 9 | **Prix** | `chiffrage/proposition-prix.ts` · `preparerPropositionPrix` | prestations, tarifs, grilles | `PropositionPrix` | non |
| 10 | **Découpage** | `lib/lignes-vendables.ts` · `lignesVendables`, `repartir` | libellés | 1 à 5 lignes | non |
| 11 | Écriture | `chiffrage/appliquer-proposition.ts` → `repositories/lignes-prix.ts` · `ajouterLignePrix` | lignes proposées | `lignes_prix` | non |
| 12 | **Rappel historique** | `repositories/lecons-prix.ts` · `leconsComparables` + `lib/lecons-prix.ts` · `rappelDePrix` | libellé de la ligne | phrase + prix | non |
| 13 | Affichage | `chantiers/[id]/devis-complet/page.tsx` + `DevisCompletClient.tsx` | `lignes_prix` | l'écran | non |

**Le déclencheur, chez lui :** il dicte, ferme, revient sur le chantier. La
liste le mène au devis, `devisAPreparer` détecte « une note, aucune ligne », le
bandeau `PreparationDictee` monte et `DevisDepuisDictee` en mode `auto` appelle
`preparerDevisDepuisDictee`. Toute la chaîne ci-dessus tourne alors sans qu'il
touche à rien.

### Les deux appels de modèle, en détail

**Transcription** (`providers/transcription/openai.ts`) — modèle **`whisper-1`**,
`language=fr`, aucun autre paramètre. **Aucun vocabulaire métier n'est envoyé au
transcripteur** : ni « rétention », ni « lacinié », ni « billonnage ». Les
fichiers Deepgram et Google font 14 lignes chacun — ce sont des souches, pas des
fournisseurs.

**Extraction** (`providers/llm/anthropic.ts`) — modèle **`claude-sonnet-4-6`**,
`temperature: 0`, **`max_tokens: 1024`**.

- *Envoyé* : consigne système (`SYSTEME`, ≈ 7 300 caractères) + consigne métier
  (≤ 9 000 caractères), et la transcription comme **message utilisateur** — jamais
  mêlée à la consigne, ce qui est correct (une dictée ne doit pas pouvoir
  commander).
- *Demandé* : un objet JSON à 9 clés — `prestations[]`, `materiel[]`,
  `dureePrevue`, `tailleEquipe`, `gestionDechets`, `contraintesAcces`,
  `remarques`, `ambiguites[]`, `informationsManquantes[]`.
- *Reçu* : lu par `lireObjetJson` (tolère ```json), validé par
  `PropositionExtractionSchema`. **Tout échec bascule en silence sur la lecture
  littérale** — le patron voit alors une mention, mais le devis se fabrique
  quand même.
- *Transformé ensuite* : rien n'est retouché côté serveur. Le JSON est écrit tel
  quel dans le brouillon.

**Ce que `max_tokens: 1024` implique et qui n'est écrit nulle part :** une dictée
riche — cinq prestations, des descriptions, cinq ambiguïtés, cinq manques —
dépasse 1 024 jetons de réponse. La réponse est alors **coupée en plein JSON**,
`lireObjetJson` rend `null`, et l'on retombe sur la lecture littérale sans que
rien ne distingue ce cas d'une panne de clé. C'est un candidat sérieux pour
« d'autres prestations dans la même dictée » mal rendues.

---

## 2. Ce qu'Atlas sépare, et ce qu'il ne sépare pas

Sa question centrale. Réponse : **six informations sur neuf n'ont aucun champ à
elles — elles vivent collées dans une chaîne de texte.**

| Information | Existe-t-elle comme donnée ? | Où |
|---|---|---|
| **PRESTATION** | à moitié | jamais stockée ; recalculée par 6 expressions régulières (`lecons-prix.ts:33`) et 5 autres (`lignes-vendables.ts`) |
| **ESPÈCE** (laurier, érable) | **NON, jamais** | aucun champ, aucun motif, nulle part dans la chaîne |
| **QUANTITÉ** | **extraite, puis perdue** | `brouillons_informations.contenu.prestations[].quantite` → collée au libellé → `lignes_prix.quantite` vaut **1** |
| **UNITÉ** | **extraite, puis perdue** | idem ; `lignes_prix.unite` reste `null` sur ce chemin |
| **CARACTÉRISTIQUES** | 4 seulement, par regex | ⌀ et hauteur (`mesures-arbre.ts`), longueur de haie, tonnage. Accès et déchets sont extraits mais **n'atteignent ni le prix ni la ligne** |
| **MÉTHODE** | oui, à part | `precisions_chantier.valeur` (`abattage.technique`), puis recollée au libellé |
| **MATÉRIEL** | table à part, libellé seul | `materiel.libelle` — **jamais chiffré** (`proposition-prix.ts:328`) |
| **DURÉE** | oui, texte libre | `chantiers.duree_prevue`, relu par `parseNombreFrancais` |
| **NOMBRE D'HOMMES** | oui, texte libre | `chantiers.taille_equipe` |
| **PRIX** | oui | `lignes_prix.montant` / `prix_unitaire` |

### Sa question précise : « 800 ml » est-il une quantité, ou du texte ?

**Les deux, successivement — et c'est le nœud.**

1. Le modèle le rend correctement : `{ libelle: "Haie (tout genre)", quantite:
   "800", unite: "ml" }`. La donnée est juste, structurée, à cet instant.
2. `brouillon-service.ts:169` la **recolle** :
   `` `${base} (${quantite} ${unite})` `` → `Haie (tout genre) (800 ml)`.
3. La table `prestations` (`schema.ts:627`) n'a que `libelle`, `ordre`,
   `chantier_id`. **Il n'existe aucune colonne où reposer la quantité.**
4. `ajouterLignePrix` (`lignes-prix.ts:35`) écrit `quantite: "1"`,
   `prixUnitaire: montant`.

Donc `QTÉ = 1` **n'est pas une décision de forfait** : c'est la valeur par défaut
d'une colonne que ce chemin n'a jamais renseignée. Et `(800 ml)` à l'écran n'est
pas un affichage de la quantité : c'est du texte qui fait partie du nom.

---

## 3. Le cas réel

**Il n'est pas identifiable depuis ici, et je le dis plutôt que de le supposer.**
Son devis vit dans le PostgreSQL de SON espace ; cet environnement n'a ni copie
de ses données ni accès à sa base. Aucune donnée n'a été modifiée, ni lue.

Ce qui a été fait à la place : **rejouer les fonctions pures sur ses chaînes
exactes**, hors du dépôt, sans rien y écrire. Le résultat reproduit ses deux
écrans au caractère près — y compris la phrase du rappel.

| Information dictée | → transcription | → extraction IA | → valeur structurée | → base | → ligne de devis | → rappel |
|---|---|---|---|---|---|---|
| « 800 mètres linéaires de haie » | texte (non vérifiable ici) | `libelle:"Haie (tout genre)"`, `quantite:"800"`, `unite:"ml"` — **CORRECT** | correct dans le brouillon JSONB | **DEVIENT FAUX ICI** — `Haie (tout genre) (800 ml)`, quantité dissoute | Qté **1**, 0 € | clé `haie` — **FAUX** : 50 ml et 800 ml confondus |
| « 1 200 m² de pelouse à tondre » | texte | `libelle:"Tonte de la pelouse"`, `quantite:"1200"`, `unite:"m²"` — **CORRECT** | correct | **DEVIENT FAUX ICI** — collé au libellé | **DEVIENT FAUX ICI** — fondue dans la ligne de l'érable | néant (la clé de la ligne est `abattage`) |
| « un érable à démonter en rétention » | texte | `libelle:"Abattage d'un érable"` — **CORRECT** | correct | correct, puis enrichi « — démontage en rétention » | **DEVIENT FAUX ICI** — partage sa ligne avec la tonte | clé `abattage\|retention` — rapproche un érable lacinié quelconque |
| le prix | — | le modèle n'en propose jamais (interdit par la consigne) — **CORRECT** | — | — | **840 €** : tarif au temps du chantier ENTIER | 550 € : souvenir sans lien avec les 840 € |

Vérification, sortie brute du rejeu :

```
[principal] detachable=false libelle="Tonte de la pelouse (1200 m²)\nÉrable — démontage en rétention"
[haie]      detachable=true  libelle="Haie (tout genre) (800 ml)"

[principal] -> { cle: 'abattage|retention' }
[haie]      -> { cle: 'haie' }

« Haie (tout genre) (800 ml) » vs « Haie de laurier (50 ml) »  =>  COMPARABLES
repartir("840", [null, "2400"], 0) = null   -> la haie tombe à 0 €

"La dernière fois — « Haie de laurier (50 ml) », le 15 août — vous aviez
 retenu 300 € HT (15 chantiers comparables)."
```

---

## 4. Le rapprochement historique — ce que « comparable » veut dire aujourd'hui

`src/lib/lecons-prix.ts` · `signatureLecon`. Une clé de **1 à 3 morceaux**,
comparée par **égalité de chaîne exacte** en SQL
(`lecons-prix.ts:97`, `eq(leconsPrix.signature, signature.cle)`).

```
nature | technique | tranche de diamètre
```

| Ce qui est comparé | Comment |
|---|---|
| **nature** | 6 expressions régulières sur le libellé — abattage, haie, élagage, dessouchage, fendage, broyage. **La première qui répond gagne** |
| **technique** | 3 motifs — rétention, démontage, au pied. Facultatif |
| **diamètre** | uniquement si `⌀ 70`, `Ø70` ou `diamètre 70` figure **littéralement** dans le libellé. Arrondi à 10 cm. Facultatif |

| Ce qui n'est **jamais** comparé |
|---|
| l'**espèce** — laurier, érable, thuya, buis |
| la **quantité** et l'**unité** — 50 ml et 800 ml, même clé |
| les **dimensions**, la **surface**, le **volume** |
| l'**évacuation**, l'**accès**, le **matériel** |
| le **nombre d'hommes**, la **durée** |
| la **hauteur** de haie, sa **largeur**, son **état** |

**Il n'existe ni score de similarité, ni seuil, ni distance.** C'est un `=` SQL.
Deux prestations sont donc comparables **exactement parce que leur texte contient
le même mot de métier** — c'est la réponse à sa question, et elle est oui.

Deux conséquences qu'il a vues à l'écran :

- **« 15 chantiers comparables »** = 15 lignes de `lecons_prix` portant la
  signature `haie`. Toutes les haies qu'il a chiffrées depuis le début, quelles
  que soient leur longueur, leur essence et leur hauteur.
- **L'érable rapproché** : sa ligne porte deux prestations, et
  `signatureLecon` lit le libellé fusionné. L'ordre de `NATURES` met l'abattage
  en premier : la tonte est invisible, la clé devient `abattage|retention`, et
  n'importe quel démontage en rétention passé fait le rappel. Le diamètre
  n'entre pas dans la clé parce qu'il n'a pas répondu à cette question-là —
  l'arrêt est franchissable, et il l'a franchi.

**Ce qui fonctionne dans ce module, et qu'il faut garder :** la tranche de
diamètre au plus proche, et la règle écrite noir sur blanc — *« une frontière
fait manquer un rappel, elle n'en fabrique jamais un faux »*. L'intention est
juste. Ce qui manque, c'est de l'appliquer aussi à la quantité et à l'espèce.

---

## 5. Le calcul du prix — cinq valeurs, cinq origines

| Valeur | D'où elle vient, exactement | Formule |
|---|---|---|
| **PRIX HISTORIQUE** (le rappel) | `lecons_prix.prix` de la ligne la plus récente à signature identique, arrondie à la dizaine | aucune : c'est un souvenir. Jamais appliqué sans qu'il appuie sur « Reprendre ce prix » |
| **PRIX DE GRILLE** | `grille_prix`, case désignée par les mesures lues | abattage : technique × ⌀ · fendage : hauteur × ⌀ · dessouchage : ⌀ · haie : **€/ml × longueur** · grumes : **€/t × tonnage** |
| **PRIX AU TEMPS** ← *c'est celui qu'il a vu* | `lib/tarif-main-oeuvre.ts` · `chiffrerMainOeuvre` | `tarif jour/homme × jours × hommes`, puis `arrondirALaDizaine`, puis réparti entre les lignes |
| **PRIX CALCULÉ** (dernier recours) | `chiffrage/moteur.ts` | `((jours × hommes × coûtJournalierOuvrier) + coûtChef + forfaitDéplacement) × (1 + marge %)`, puis arrondi à la dizaine |
| **PRIX SAISI** | ce qu'il tape | — et c'est le seul qui enseigne (§0) |

### Comment on passe de 550 € à 840 €

**On n'y passe pas. Aucune formule ne relie les deux — c'est ça, le défaut.**

- **550 €** est un souvenir : le dernier prix qu'il a lui-même retenu sur une
  ligne dont la clé était `abattage|retention`.
- **840 €** est le prix du **chantier entier** : son tarif au jour/homme
  multiplié par la durée et l'équipe qu'il a dictées, arrondi à la dizaine.
  Ce montant couvre la tonte de 1 200 m² **et** l'érable — mais il s'affiche
  sur une ligne dont le rappel ne parle que de l'érable.

Les deux mécanismes ne se parlent jamais. Rien ne compare le prix proposé au
seul chantier comparable en mémoire, et rien ne signale un écart de +53 %.
**Il n'y a donc aucune justification fiable de l'écart, et je l'écris
explicitement comme son brief le demande.**

### Pourquoi la haie est à 0 €

Deux routes, toutes deux au même endroit :

- **(a)** aucun prix au mètre linéaire dans sa grille → `prixDeLaHaie` rend
  `null` → la ligne reste à `"0"` ;
- **(b)** un prix au ml existe → `800 × €/ml` dépasse forcément 840 € →
  `repartir` (`lignes-vendables.ts:257`) refuse la répartition et rend `null` →
  `proposition-prix.ts:546` **force toutes les détachables à `"0"`** et laisse
  les 840 € sur la principale.

La route (b) est la plus probable. Dans les deux cas, **l'explication n'apparaît
que sur l'écran Prix** (`donneesManquantes`) — jamais sur le devis qu'il regarde.
Une ligne à 0 € sans un mot est exactement ce que `CLAUDE.md` §4 ter interdit
pour l'arrosage, et le même raisonnement vaut ici.

---

## 6. Quantités et unités

**Ce qui est réellement lu par du code, et rien d'autre :**

| Unité | Lue par | Sert à |
|---|---|---|
| `ml`, `m linéaires`, `de long`, `longueur` | `longueurHaieLue` | le prix de la haie |
| `cm` de diamètre, `⌀`, `Ø` | `diametreLu` | la case abattage / fendage |
| `m de haut`, `hauteur` | `hauteurLue` | la case fendage |
| `t`, `tonnes` | `tonnageLu` | le prix des grumes |
| **`m²`** | **personne** | rien |
| **`m³`** | **personne** | rien |
| **`heure`, `jour`, `forfait`, `unité`** | **personne** (sauf `jour/homme` côté tarif) | rien |

Sa question — distinguer « 800 ml de haie » de « une haie qui coûte 800 € » :

- **Le modèle s'en charge, et la consigne est bonne** : *« ne déduis jamais une
  quantité d'un pluriel ou d'un contexte ; sans nombre écrit, quantite et unite
  restent null »*, et *« ne propose jamais de prix »*.
- **Le code le confirme, vérifié** : `longueurHaieLue("une haie dont la
  prestation coûte 800 €")` → `null`. `longueurHaieLue("haie de 800 euros")` →
  `null`. Les motifs exigent une unité de longueur. **C'est correct.**
- **Mais** `longueurHaieLue` prend la **première** correspondance de toutes les
  sources réunies (`proposition-prix.ts:688`). Une dictée avec deux haies de
  longueurs différentes donne la longueur de la première **aux deux**.
- Et `longueur 800` sans unité suffit à déclencher une longueur — un « longueur
  de façade 800 » suffirait.

**Réponse à sa dernière question du §6 :** la quantité 800 ml **n'arrive pas** au
champ quantité. Et `QTÉ = 1` **n'est pas** une transformation en forfait : c'est
le défaut d'une colonne jamais renseignée sur ce chemin
(`lignes-prix.ts:35`).

---

## 7. Ce qu'Atlas produit aujourd'hui, sur ses cas

Mesuré en rejouant les fonctions pures, **sans modifier une ligne de code**.

| Cas | Ce que ça produit aujourd'hui | Verdict |
|---|---|---|
| une prestation simple (« tonte de la pelouse ») | 1 ligne `principal`, Qté 1, prix au temps | acceptable |
| plusieurs prestations dans une dictée | **toutes celles qui ne sont ni haie, ni fendage, ni dessouchage, ni grumes tombent dans UNE ligne `principal`** | faux |
| haie avec des ml | ligne à part (bien), longueur lue (bien), quantité perdue, Qté 1 | à moitié faux |
| pelouse en m² | m² non lus, collés au libellé, aucun effet sur le prix | faux |
| arbre avec espèce | l'espèce survit dans le texte, n'est jamais une donnée | faux |
| « démontage en rétention » | correctement capté comme technique, entre dans la clé et dans la grille | **correct** |
| prestation avec évacuation | extraite dans `gestionDechets`, puis **n'atteint ni le prix ni la ligne** | inexploité |
| plusieurs nombres dans la phrase | seul le modèle arbitre ; `longueurHaieLue` prend le premier | risqué |
| deux prestations similaires, quantités très différentes | **déclarées comparables** (50 ml vs 800 ml) | faux |
| deux textes proches, techniquement différents | « Taille de haie » → `haie`, « Taille du cerisier » → `elagage` : **bien séparés**. « Taille des inflorescences d'hortensias » → `null`, aucun rappel : **le bon refus** | **correct** |

---

## 8-9. Anomalies, et la PREMIÈRE étape où la donnée devient fausse

| # | Ce qu'il voit | Première étape fausse | Classe |
|---|---|---|---|
| 1 | `Haie (tout genre) (800 ml)`, Qté 1 | `brouillon-service.ts:169` — la quantité est collée au libellé, puis `lignes-prix.ts:35` — Qté forcée à 1 | **C** |
| 2 | tonte et érable sur la même ligne | `lignes-vendables.ts:170` — `principal` est un fourre-tout : tout ce qui n'a pas de grille y tombe | **C** + **G** |
| 3 | 840 € pour ce lot | `proposition-prix.ts:297` — le tarif au temps chiffre le chantier ENTIER sans regarder ce qu'il contient | **E** |
| 4 | rappel érable 550 € sans rapport avec les 840 € | `lecons-prix.ts:84` sur une ligne fusionnée, **et** aucun pont entre rappel et prix proposé | **D** + **E** |
| 5 | « 15 chantiers comparables » pour 50 ml vs 800 ml | `lecons-prix.ts:91` — la clé ignore quantité, unité et espèce | **D** |
| 6 | haie à 0 € sans explication sur le devis | `proposition-prix.ts:546` — les détachables sont forcées à 0 ; le motif reste sur l'écran Prix | **E** + **F** |
| 7 | « érable », « laurier » sans effet | `schemas/extraction.ts:8` — aucun champ espèce dans le modèle de données | **C** |
| 8 | *(non vu par lui, mais probable sur les dictées longues)* prestations manquantes ou rendues en brut | `providers/llm/anthropic.ts:178` — `max_tokens: 1024` coupe la réponse, repli silencieux sur la lecture littérale | **B** + **G** |
| 9 | *(à surveiller)* mots de métier mal entendus | `providers/transcription/openai.ts:22` — `whisper-1` sans aucun vocabulaire métier | **A** |

**Cumuls.** Les anomalies 1, 2 et 7 ont **une seule racine** : le libellé sert de
modèle de données. Les anomalies 4 et 5 ont la même : une clé de rapprochement
qui ignore la grandeur. L'anomalie 3 est indépendante et structurelle.

---

## 10. Ce qui fonctionne déjà, et qu'il ne faut pas casser

- **La transcription** — son mot, et rien dans le code ne le contredit.
- **L'extraction est réellement structurée** : `quantite`, `unite`, `aConfirmer`,
  `ambiguites`, `informationsManquantes` existent et sont remplis correctement.
  Le défaut n'est pas là.
- **La consigne d'extraction est bonne** : elle interdit d'inventer, elle
  interdit de proposer un prix, elle exige une prestation par verbe d'action,
  elle emporte son vocabulaire et ses corrections passées.
- **Aucun prix n'est inventé.** Sans tarif et sans durée, la chaîne refuse, écrit
  les prestations à 0 € et dit pourquoi. C'est exactement sa règle.
- **Le filet ne le laisse jamais devant un écran mort** (`lireLitteralement`), et
  il est annoncé comme une recopie, pas comme une analyse.
- **L'arrêt d'avant-chiffrage pose les deux questions qui portent de l'argent**,
  et se laisse franchir.
- **Un seul vocabulaire de mesures** (`mesures-arbre.ts`) partagé par la
  question, la grille et le rapprochement — pas de règle dupliquée.
- **Les doublons sont refusés**, le rejeu est idempotent, le libellé enrichi ne
  s'allonge pas à chaque essai.
- **L'isolation entre entreprises tient** : tout passe par `withEntreprise`.
- **Le rappel reste un rappel** — jamais appliqué tout seul.
- **`signatureLecon` refuse de rapprocher ce qu'il ne reconnaît pas** (rend
  `null`) plutôt que de fabriquer un faux rapprochement.

---

## 11. Défauts de conception

1. **Le libellé EST le modèle de données.** Six informations sur neuf y sont
   collées, puis relues par expression régulière à **quatre endroits
   indépendants** — `lignes-vendables.ts`, `lecons-prix.ts`, `apprendre-grille.ts`,
   `questions-chiffrage.ts`. Quatre listes de motifs qui doivent rester
   d'accord ; trois d'entre elles portent déjà un commentaire disant qu'elles
   doivent se corriger ensemble. C'est le point unique de rupture.
2. **La structure existe aux deux bouts et est détruite au milieu.** Le brouillon
   JSONB porte `quantite`/`unite` ; `lignes_prix` porte `quantite`/`prix_unitaire`/`unite`.
   Seule la table `prestations`, entre les deux, n'a qu'un texte.
3. **« Comparable » est une égalité de chaîne sur trois jetons.** Pas de score,
   pas de seuil, aucune notion de grandeur.
4. **L'apprentissage écrit un total de ligne dans une case unitaire** dès que la
   ligne porte plus d'une prestation (§0).
5. **La branche `principal` est un fourre-tout.** Plantation, désherbage,
   clôture, tonte, débroussaillage : tout atterrit sur la ligne de l'abattage.
   Le découpage a été conçu pour *détacher* ce qui se refuse, pas pour
   *distinguer* des travaux sans rapport.
6. **Le catalogue de vocabulaire ne sert pas sur ce chemin.**
   `chiffrerChantier(ctx, chantierId)` est appelé **sans** `motCleCatalogue`
   (`proposition-prix.ts:336`) : `rechercherCartes` et `historique_prix` ne sont
   donc jamais consultés depuis la dictée. Les mots qu'il ajoute dans *Réglages
   → Catalogue* n'ont aucun effet sur ses devis dictés.
7. **`max_tokens: 1024`** pour une tâche dont la sortie grandit avec la dictée,
   et un repli silencieux quand elle est coupée.
8. **Aucun vocabulaire métier n'est donné au transcripteur**, alors que le dépôt
   en tient un (`termes_metier`) et le donne déjà au modèle d'extraction.

---

## 12. Risques de régression — ce qu'une correction peut casser

| Ce qu'on touche | Ce qui casse si l'on n'y prend garde |
|---|---|
| `signatureLecon` | **les clés sont STOCKÉES** dans `lecons_prix.signature`. Changer leur format **orpheline toute sa mémoire de prix** — il faut une migration qui recalcule, pas un simple changement de code |
| `precisionLisible` | ses formats `⌀ 45 cm` et `12 m de haut` sont **relus par la machine** (`mesures-arbre.ts`). Les reformuler casse la recherche de case **en silence** |
| le format du libellé | `ecrirePrecisionsSurLesPrestations` retrouve une prestation par `startsWith(clé + " —")` |
| l'ordre des natures | `apprendre-grille.ts` et `lignes-vendables.ts` doivent rester dans le même ordre, sinon un prix se range dans une case où le chiffrage n'ira pas le chercher |
| `lignesVendables` | `test-lignes-vendables.ts` encode ses décisions du 7 et 8 août (850 + 250, billonnage absorbé) |
| les lignes à 0 € | le repli du 7 août — « le devis ne comporte aucune ligne, gros bug » |
| les doublons | `ligneDejaAuDetail` protège du devis doublé (défaut du 3 août) |
| `questionsAvantChiffrage` | les identifiants `<sujet>#<rang>` sont **persistés** dans `precisions_chantier` |

**À ne pas toucher, par son brief :** lot Audio, M9/M10/M11, authentification,
sessions, RLS, sécurité des fichiers, CSP, RGPD, sauvegardes, rôles, facturation,
numérotation, migrations existantes. Rien du plan ci-dessous n'y touche.

---

## 13. Les contrôles à écrire AVANT toute correction

Tous **rouges aujourd'hui**, et tous écrits sur une **règle**, jamais sur un
libellé d'écran (`CLAUDE.md` §5 bis).

1. Une dictée « 800 ml de haie » produit une ligne de devis dont **`quantite`
   vaut 800** et `unite` vaut `ml` en base — pas seulement à l'écran.
2. Le **montant** de cette ligne vaut `quantite × prix_unitaire`.
3. Deux haies de 50 ml et 800 ml **ne sont pas** déclarées comparables.
4. Un rappel n'est **jamais** produit à partir d'une ligne qui porte plus d'une
   prestation.
5. `apprendrePrixGrille` **n'écrit rien** quand la ligne porte plus d'une nature
   — le contrôle doit savoir rougir contre la version d'aujourd'hui (§0).
6. Une tonte et un abattage dictés ensemble donnent **deux lignes**.
7. Une ligne à 0 € porte, **sur le devis**, la raison de son zéro.
8. Une dictée de dix prestations n'est pas tronquée : les dix ressortent, et
   `lecture` vaut `"modele"`.
9. Le nombre de prestations extraites égale le nombre de travaux dictés (jeu de
   dictées réelles).
10. L'espèce dictée se retrouve dans une donnée, pas seulement dans le texte.
11. La clé de rapprochement d'une prestation reste **stable** après une
    relecture de la dictée et après un enrichissement de libellé.

---

## 14. Plan de correction minimal, par priorité

Rien n'est fait sans son feu vert. Aucun de ces points ne touche à ce qu'il a
interdit, et **aucun ne modifie de données historiques**.

| P | Ce qu'on corrige | Coût | Migration |
|---|---|---|---|
| **P0** | **Arrêter la pollution** : ne rien enseigner (grille ni leçon) depuis une ligne qui porte plus d'une prestation ou plus d'une nature. Fonction pure, quelques lignes | très faible | non |
| **P1** | **Porter la quantité jusqu'au bout** : colonnes `quantite`/`unite` sur `prestations`, arrêter de coller au libellé, les écrire sur `lignes_prix`. Qté 800 × PU → total | moyen | **oui** (additive) |
| **P2** | **Donner un sens à « comparable »** : espèce + ordre de grandeur dans la clé ; refuser le rappel au-delà d'un facteur d'écart — sa règle, « mieux vaut aucun rappel qu'un rappel faux » | moyen | **oui** (recalcul de `lecons_prix.signature`) |
| **P3** | **Casser le fourre-tout `principal`** : une nature par prestation, une ligne par nature | moyen | non |
| **P4** | **Dire sur le devis** pourquoi une ligne est à 0 €, et signaler un prix proposé très éloigné du seul comparable connu | faible | non |
| **P5** | **`max_tokens`** relevé, et une **trace** quand la réponse est coupée — pour ne plus confondre « pas de clé » et « réponse tronquée » | très faible | non |
| **P6** | **Le vocabulaire au transcripteur**, et **brancher ou supprimer** la branche catalogue morte (`motCleCatalogue`) — un chemin mort qui a l'air vivant coûte plus cher qu'un chemin absent | faible | non |

**Ce qui n'est PAS proposé, et pourquoi :** cacher `(800 ml)` à l'affichage,
plafonner un prix « incohérent », ou corriger ses deux exemples au cas par cas.
Son §9 l'interdit, et il a raison : la donnée doit devenir juste à sa source.

---

*Écrit le 26 août 2026, phase de lecture du lot « dictée → devis ». Aucune ligne
de `src/` n'a été modifiée. Aucune donnée n'a été lue ni écrite.*
