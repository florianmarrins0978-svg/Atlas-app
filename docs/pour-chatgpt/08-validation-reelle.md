# Atlas — Validation réelle « dictée → devis » : ce qui a pu être prouvé, et ce qui ne l'a pas été

**29 août 2026.** Ce dossier ne rouvre pas le chantier de correction du 27 août
(dossier 07). Il rend compte d'une seule question : **la chaîne fonctionne-t-elle
avec les prestataires d'IA réellement branchés ?**

La réponse honnête est : **pas encore prouvée, et voici exactement pourquoi.**
Rien de ce qui suit n'est simulé, et ce qui n'a pas été appelé est dit comme
tel.

---

## 1. Ce qui a été demandé, et ce qui s'est passé

La consigne était nette : jouer `npm run verifier:chaine-dictee`, appeler
vraiment le modèle, ne rien simuler, ne pas prendre le contrat des tests pour
une preuve du comportement réel.

La commande a été jouée. Voici sa sortie, verbatim :

```
=== La chaîne dictée → devis, avec sa vraie clé ===

Fournisseur : dev

❌ Aucune clé d'IA n'est configurée : rien n'a été appelé, et ce contrôle
   ne peut donc RIEN prouver. Jouez-le depuis votre espace de travail.
   (`npm run verifier:ia` dit quels fournisseurs répondent.)
```

Code de sortie : **1**.

**C'est le comportement voulu, et c'est la seule bonne nouvelle de cette
section.** L'environnement de l'agent n'a aucune clé — c'est CE poste-ci qui
est démuni, pas le produit ; les clés du patron sont posées sur son espace. Un
contrôle qui aurait rendu du vert ici aurait menti. Celui-là refuse, nomme la
cause, et donne le geste suivant.

Confirmation indépendante, par la commande qui inventorie les fournisseurs :

```
  ○ Transcription : Mode déterministe — aucun prestataire branché
  ○ Rédaction     : Mode déterministe — aucun prestataire branché
○ Mode déterministe assumé : aucune clé posée, aucune donnée ne sort.
```

**Donc : aucun appel réel n'a eu lieu. Aucune des douze informations demandées
— nature, espèce, quantité, unité, méthode, diamètre, hauteur, tailleEquipe,
dureePrevue, non-fusion tonte/démontage, absence d'invention — n'a été observée
sur une réponse réelle de modèle.** Les affirmer serait exactement la faute que
la consigne interdit.

---

## 2. Ce qui a pu être prouvé sans clé

### 2.1 La commande de vérification est elle-même saine

Elle a une suite compagnon qui l'éprouve **dans les deux sens**, sans aucune
clé (`scripts/test-chaine-dictee-attendue.ts`) :

```
=== Une réponse juste traverse la chaîne ===
  ✓ les huit points passent
  ✓ et le devis compte au moins quatre lignes

=== Une réponse abîmée est REFUSÉE, et le motif désigne le coupable ===
  ✓ une quantité perdue est vue
  ✓ une espèce perdue est vue
  ✓ « deux hommes » devenu une quantité de prestation est vu
  ✓ une nature INVENTÉE est vue
  ✓ une tonte qui repart avec l'abattage est vue

7 réussite(s), 0 échec(s).
```

Les cinq derniers cas comptent plus que les deux premiers : **un contrôle qui
n'a jamais su échouer ne prouve rien.** Celui-ci sait rougir sur chacune des
dégradations qu'il prétend attraper.

Ce que cela établit : quand le patron jouera la commande avec sa clé, elle
mesurera les bonnes choses et le motif d'un échec désignera le bon coupable.
Ce que cela n'établit **pas** : ce que le modèle répond vraiment.

### 2.2 Le comportement devant une faute de Whisper — mesuré, pas supposé

Observation rapportée par le patron : Whisper a déjà écrit **« tombe »** au lieu
de **« tonte »**. La consigne était de mesurer avant de toucher à quoi que ce
soit. Mesure faite, sans aucune modification :

```
  ✓ tonte        ← « Tonte de la pelouse (1200 m²) »
  · INCONNUE     ← « Tombe de la pelouse (1200 m²) »
  · INCONNUE     ← « Tombe de 1200 mètres carrés de pelouse »
  · INCONNUE     ← « Tonde de la pelouse »
  ✓ haie         ← « Taille de 800 mètres linéaires de haie de laurier »
  · INCONNUE     ← « Aie de laurier (800 ml) »
  ✓ dessouchage  ← « Des souches de 60 cm »
```

Puis le cas qui décide de tout — le mot fautif **à côté** d'un démontage :

```
  [abattage · principale]  Érable — démontage en rétention / Évacuation des déchets
      porte : Érable — démontage en rétention + Évacuation des déchets
  [autre]                  Tombe de la pelouse (1200 m²)
      porte : Tombe de la pelouse (1200 m²)
```

**Le mot mal transcrit ne contamine rien.** Il ne rejoint pas la ligne
d'abattage, ne prend pas son prix, n'entre pas dans sa mémoire de prix : il sort
sur sa propre ligne, « à chiffrer », donc **visible à l'écran**. Avant la
correction du 27 août, il serait tombé dans le fourre-tout `principal` — c'est
précisément le défaut du 26 août, sous un autre déclencheur.

C'est une propriété qui n'était dans aucun brief, et elle vaut d'être notée :
**la correction protège aussi contre les fautes de transcription**, pas
seulement contre les trous du vocabulaire.

Ce que cela n'établit **pas** : ce que Whisper produit réellement sur la voix du
patron. Aucune commande ne joue Whisper — il faut un vrai fichier son. C'est le
seul point du test téléphone qui se regarde à l'œil.

---

## 3. LE BLOCAGE, et il annule les deux tests

**Le lot du 27 août n'est pas sur `main`.**

Le banc d'essai du patron ne sait faire qu'une chose à chaque allumage : avancer
**`main`** en ligne droite (`--ff-only`). Une branche qu'il ne suit pas ne lui
parviendra jamais, sans le moindre message.

Conséquences, vérifiées et non supposées :

| Sur son espace, aujourd'hui | Ce qui se passerait |
|---|---|
| `npm run verifier:chaine-dictee` | **la commande n'existe pas** — le fichier est absent de `main` |
| la dictée sur téléphone | testerait **la version du 26 août**, celle qui porte le défaut |

Contrôle fait fichier par fichier :

```
✗ ABSENT de main : src/lib/natures-prestation.ts
✗ ABSENT de main : src/lib/quantite-commerciale.ts
✗ ABSENT de main : drizzle/0070_prix_a_chiffrer_et_comparabilite.sql
✗ ABSENT de main : scripts/verifier-chaine-dictee.mts
```

**Demander au patron de tester dans ces conditions aurait été le quatrième
échec de ce type dans ce dépôt** — un mode d'emploi qui plante chez lui, une
adresse ouverte avant que le serveur puisse servir, un port fermé. Chaque fois
le code était juste ; c'est le parcours qui ne l'était pas.

### La fusion, et ce qu'elle a révélé

`main` avait pris **163 commits** pendant ce temps. La fusion est faite, et trois
choses méritent d'être dites parce qu'elles viennent de la cohabitation de
plusieurs sessions sur la même application :

**a) Collision de numéros de migration.** `main` porte `0068_effacement_client_devis_envoye.sql`
et `0069_fil_assistant.sql` ; le lot porte `0068_prestation_structuree.sql` et
`0069_ligne_de_prix_et_ses_prestations.sql`. **Elles n'ont pas été renumérotées**,
et c'est un choix motivé : le lanceur (`scripts/run-migrations.ts`) trie par nom
de fichier et retient chaque migration appliquée **à son nom** dans une table
`_migrations`. Renommer un fichier déjà appliqué le ferait **rejouer** sur les
bases qui l'ont déjà passé. Les quatre s'appliquent, dans l'ordre alphabétique,
et elles touchent des tables différentes. Vérifié : `7 migration(s) appliquée(s)`,
puis `0` table mal possédée.

**b) Collision de paragraphe dans `ARCHITECTURE.md`.** Deux sessions avaient pris
le §191. La règle du dépôt tranche sans discussion : **c'est le paragraphe qui
n'est pas encore sur `main` qui se renumérote.** Le §191 du lot est devenu §203,
et ses références ont suivi. Les doublons §134-136 et §164-165 sont, eux,
antérieurs et déjà sur `main` — ils n'ont pas été touchés.

**c) Une autre session avait réparé les trois mêmes suites de calendrier — et
mieux.** Elle a un helper `unJourAutreQueLesProposees()` et des sélecteurs
`[data-jour][data-etat]` là où ma version cliquait les jours un par un. **Sa
version a été retenue, la mienne jetée.** Deux implémentations d'une même lecture
de calendrier auraient divergé.

---

## 4. Où en est la batterie après la fusion

| Étape | Résultat |
|---|---|
| Types | ❌ — cause identifiée, voir ci-dessous |
| Lint | ✅ |
| Construction | ❌ — **même cause, unique** |
| Mémoire du dépôt | ✅ (8 fichiers, 2 rappels armés) |
| Fournisseurs d'IA | ✅ |
| **Suites base de données** | **✅ 274/274** |
| Données de démonstration | ✅ |
| Suites navigateur | en cours au moment d'écrire — 7 jouées, 0 rouge |

### Les deux ❌ ont une seule cause, et elle n'est pas dans le code

Erreurs complètes, les deux seules du typecheck :

```
.next-batie/types/validator.ts(476,39): error TS2307: Cannot find module
  '../../src/app/reglages/fiche-entretien/page.js'
.next-verification/types/validator.ts(476,39): error TS2307: (idem)
```

Décompte : **0 erreur hors des dossiers de build.**

`.next-batie` et `.next-verification` sont des **sorties de build ignorées par
git**, datées du 27 août sur cette machine. Entre-temps, `main` a déplacé la page
`fiche-entretien` (commit `b034a52`, « Ranger “Composer ma fiche” dans Paysage »).
Le validateur engendré par l'ancien build référence donc un fichier qui n'existe
plus. `tsconfig.json` exclut `.next-batie/dev` mais pas `.next-batie/types` :
`tsc` et `next build` le lisent tous les deux, d'où **deux rouges pour un seul
reste**.

Ni le lot, ni la fusion n'en sont la cause. Une machine neuve — la CI, un espace
fraîchement allumé — n'a pas ces dossiers. Ils seront nettoyés et les deux
étapes rejouées ; ce n'est pas fait pendant que la batterie tourne, parce que
la batterie écrit elle-même dans `.next-verification`.

**Ce qui n'a PAS été fait, délibérément :** modifier `tsconfig.json` pour
exclure ces dossiers. C'est un problème d'environnement local, sans rapport avec
la chaîne dictée → devis, et la consigne était explicite — ne pas corriger au
passage ce qui n'a rien à voir.

---

## 5. Ce qui reste à faire, et par qui

### Décision du patron (une seule)

**Autoriser la fusion vers `main`.** Sans elle, ni la commande ni le test
téléphone ne peuvent avoir lieu. La règle du dépôt interdit de pousser sur `main`
sans son accord explicite ; ce n'est pas une précaution d'agent, c'est une règle
qu'il a écrite après qu'une poussée non annoncée a coûté du travail à une autre
session.

### Puis, deux gestes

**1. Un terminal sur son espace :**

```bash
npm run verifier:chaine-dictee
```

Elle affiche, dans l'ordre : la dictée, le JSON du modèle, ce qui entre dans les
colonnes, les lignes du devis, la clé de mémoire de prix, puis huit verdicts.
Elle **n'écrit rien en base** et ne joue pas Whisper.

**2. La dictée sur son téléphone.** Nouveau chantier → Note vocale → prononcer :

> « Taille de 800 mètres linéaires de haie de laurier, démontage d'un érable de
> 40 cm de diamètre et 12 mètres de haut avec rétention, dessouchage de deux
> souches de 60 cm, évacuation des déchets et tonte de 1 200 mètres carrés de
> pelouse, prévoir deux hommes pendant une journée. »

Puis **Lancer la transcription**.

**⚠️ Avant de créer le devis : lire le texte.** Sous le bouton apparaît
« Transcription disponible — **voir le texte** ». C'est le **seul** endroit où
l'on voit ce que Whisper a entendu, et aucune commande ne le joue.

Chercher : *tonte*, *haie*, *laurier*, *érable*, *souches*. Si un mot est faux
— « tombe » pour « tonte » —, **photographier d'abord**, puis corriger à la main
et continuer. La photo mesure Whisper ; la correction laisse le reste de la
chaîne s'éprouver quand même. Les deux informations sont distinctes et il ne faut
pas les confondre : *l'extraction marche* ne dit rien de *la transcription est
juste*.

Ensuite, sur l'écran Devis :

| Ce qui doit s'y trouver |
|---|
| **au moins 4 lignes** — la tonte n'est PAS avec l'érable |
| « 800 ml » sur la haie, jamais « Qté 1 » |
| « à chiffrer » sur la tonte, jamais « 0 € » |
| l'envoi **refusé** tant que la tonte n'a pas de prix |

---

## 6. Ce qui n'a pas été touché, et pourquoi

Trois sujets ont été laissés strictement en l'état, sur consigne :

| Sujet | État |
|---|---|
| « 2 souches × prix d'une souche » | **inchangé** — la ligne garde le prix de grille, l'écran pose la question |
| « Offert / geste commercial » | **non créé** |
| Le fonctionnement de Whisper | **non touché** — mesuré seulement |

Aucun nouveau lot n'a été ouvert, aucune architecture modifiée, aucun défaut
sans rapport corrigé.

---

## Questions

1. **Le refus de la commande vous paraît-il assez bruyant ?** Elle sort en code
   1 avec un message explicite. Mais un artisan qui la joue sans clé lira-t-il
   « il faut poser la clé » ou « l'application est cassée » ?

2. **La protection contre les fautes de Whisper est-elle au bon endroit ?** Un
   mot mal transcrit produit une ligne « à chiffrer » visible. L'alternative
   serait de refuser la transcription douteuse en amont — mais sur quel critère,
   sans inventer ? Voyez-vous mieux ?

3. **Le test téléphone sépare-t-il vraiment Whisper du reste ?** La procédure
   fait lire la transcription avant le devis. Est-ce suffisant pour ne pas
   conclure « ça marche » sur une extraction qui aurait rattrapé une mauvaise
   transcription ?

4. **Sur la non-renumérotation des migrations en double** : le raisonnement est
   qu'un fichier renommé rejouerait sur les bases qui l'ont déjà appliqué.
   Contredisez-moi si vous voyez un cas où deux `0069` distincts posent
   réellement problème.

5. **Qu'est-ce qui manque à cette procédure de validation ?** Quelle étape de la
   chaîne micro → Whisper → transcription → extraction → prestations → prix →
   devis pourrait échouer sans qu'aucun des deux gestes ci-dessus ne le révèle ?
