# 06 — Lot C (suite) : R23, les unités de comptage, et l'inventaire des natures

Tu n'as pas accès au dépôt. Ce document est autonome.

Contexte : application de paysagiste-élagueur (Next.js + PostgreSQL). Lot A a
fermé une corruption de l'apprentissage ; lot B a donné à la prestation des
colonnes structurées ; lot C a fait passer les moteurs de prix à ces colonnes,
avec refus sur contradiction. Ce document répond à tes décisions §1 à §7.

---

## 1. R23 — et un doublon RÉEL trouvé au passage

### Ce que j'ai mesuré avant de coder

En préparant R23, j'ai vérifié une chose que personne n'avait regardée :
**rejouer la dictée après avoir répondu aux questions créait un doublon.**

```
après 1re confirmation : [ "Abattage d'un érable" ]
   (il répond aux questions → le libellé est enrichi)
après rejeu            : [ "Abattage d'un érable — démontage avec rétention, ⌀ 45 cm",
                           "Abattage d'un érable" ]
❌ DOUBLON
```

Le dédoublonnage reconnaissait une prestation par **l'égalité exacte de son
libellé**. Or ses réponses ALLONGENT ce libellé. Au rejeu — et l'artisan rejoue
souvent : un second appui, un retour arrière — le libellé recalculé ne
correspondait plus, et une seconde prestation naissait pour le même arbre.

C'est le défaut du 3 août (« le devis affichait deux fois la même taille de
haie ») sous un troisième visage, dans la fonction qui existe précisément pour
l'empêcher.

### La règle posée

Une fonction pure, `src/lib/correspondance-prestation.ts`. **Deux formes de
correspondance, et rien d'autre :**

| | |
|---|---|
| libellé identique | même prestation |
| libellé identique **suivi du tiret d'enrichissement** | même prestation |
| tout le reste | **une autre prestation** |

Aucune distance d'édition, aucun « ça se ressemble ». Une fusion sur une
ressemblance ferait disparaître un travail qu'il facturerait.

Détail qui compte : le tiret reconnu est **demandé à la fonction qui l'écrit**,
jamais recopié. Deux écritures du même séparateur finiraient par diverger, et le
rapprochement cesserait de marcher sans qu'aucune erreur ne le dise.

### Ton contrat d'enrichissement, appliqué à la lettre

| Champ existant | Nouvelle valeur | Résultat |
|---|---|---|
| **vide** | connue | **posée** |
| identique | identique | rien |
| **rempli** | différente | **contradiction — rien n'est écrit**, et c'est journalisé |
| quelconque | inconnue | rien |

**Sur ton invariant « une valeur humaine n'est jamais écrasée » :** le dépôt n'a
**aucune colonne de provenance** — rien ne distingue une valeur saisie par
l'artisan d'une valeur extraite. Mais la règle « on ne remplit que ce qui est
vide » le garantit **sans avoir besoin de le savoir** : puisqu'on ne remplace
jamais rien, une valeur humaine est protégée par construction. C'est plus solide
qu'une colonne de provenance qu'il faudrait tenir à jour partout.

**Aucun backfill.** Les anciennes prestations ne sont touchées que si une dictée
les mentionne explicitement, et seulement sur leurs champs vides.

### Les tests, écrits AVANT la modification

**14 cas purs** (`test-correspondance-prestation.ts`) et **4 cas base** ajoutés
à la suite du lot B. Tes sept invariants, un par un :

| Ton invariant | Le contrôle |
|---|---|
| 1. aucune duplication | « le rejeu après ses réponses ne crée pas un second arbre » |
| 2. enrichissement d'un NULL certain | « un champ resté vide se remplit au rejeu » |
| 3. aucune réinterprétation en masse | « aucune ancienne prestation n'est réinterprétée » — une prestation que la dictée ne mentionne pas ne bouge pas |
| 4. aucune valeur humaine écrasée | « une valeur déjà posée n'est jamais remplacée » |
| 5. contradiction conservée et signalée | « une valeur différente est signalée, pas appliquée » |
| 6. aucune fusion sur ressemblance | 4 cas de refus, dont « Taille de haie » vs « Taille de haie de laurier » |
| 7. isolation RLS inchangée | « une autre entreprise ne voit aucune liaison » |

---

## 2. Les unités de comptage : les deux invites disent enfin la même chose

Tu validais le principe. **Fait**, et voici exactement ce qui a changé.

L'invite d'extraction ne donnait **aucun exemple d'unité** ; celle de la
dictée-dans-le-devis en donnait (« stère », « arbre »). Le même mot dicté
devenait donc une quantité par un micro et rien du tout par l'autre.

Les deux portent désormais la même règle :

```
- "quantite" et "unite" vont TOUJOURS ensemble : jamais l'une sans l'autre.
- "unite" est l'unité de ce nombre, dans SON mot à lui — ou l'OBJET qu'il compte :
    « deux souches »  ->  "2" / "souche"
    « trois arbres »  ->  "3" / "arbre"
  L'unité de comptage doit être l'objet explicitement prononcé. N'invente pas une
  unité pour un nombre dont on ne sait pas ce qu'il compte : les deux restent null.
- La DURÉE du chantier et la TAILLE de l'équipe ne sont pas des prestations.
  « quatre journées » et « deux hommes » vont dans "dureePrevue" et "tailleEquipe" —
  jamais dans la quantité d'une prestation.
```

Ta mise en garde sur `tailleEquipe` et `dureePrevue` est donc **écrite dans
l'invite**, pas seulement espérée.

**Le CHECK `quantite ⇔ unite` n'a pas bougé.**

### Ce que les tests peuvent, et ce qu'ils ne peuvent pas

`scripts/test-invites-unites.ts` — 6 cas déterministes qui tiennent **le
contrat** : les deux invites acceptent une unité de comptage, les deux exigent
que l'objet soit prononcé, les deux refusent une quantité orpheline, l'invite
rappelle où vont la durée et l'équipe, et le code garde « souche » sans le
normaliser.

**Ils ne prouvent rien de ce que le modèle répond.** Cet environnement n'a
aucune clé d'IA. La suite l'affiche en clair à la fin de son exécution :

```
⚠ Le comportement réel du modèle sur ces six dictées reste à éprouver sur
  un espace avec les clés d'IA branchées — aucun contrôle d'ici ne le prouve.
```

Les six dictées à jouer chez lui, telles que tu les as listées : deux souches,
trois arbres, quatre journées, deux hommes, 800 ml de haie, 1 200 m² de pelouse.

---

## 3. `nature` — l'inventaire, et je m'arrête là

Tu demandais d'établir la taxonomie **depuis le dépôt**, pas depuis ta liste.
Inspection faite. **J'ai trouvé un référentiel métier déclaré que ta liste
ignorait à moitié** : le modèle de fiche d'entretien
(`src/lib/prestations-entretien.ts`), **20 prestations rangées en 4 familles**,
posé par l'artisan lui-même.

### Ta liste, confrontée au dépôt

| Ta nature | Corroborée ? | Où |
|---|---|---|
| abattage | ✅ | grille de prix |
| elagage | ✅ | mémoire des prix + catalogue (« Élagage ») |
| haie | ✅ | grille + fiche d'entretien (4 tailles de haie) |
| dessouchage | ✅ | grille de prix |
| fendage | ✅ | grille de prix |
| broyage | ✅ | mémoire des prix |
| grumes | ✅ | grille de prix |
| tonte | ✅ | fiche d'entretien — « Tonte et ébarbage » |
| desherbage | ✅ | fiche d'entretien — « Désherbage massifs », « Désherbant allée » |
| massif | ✅ | fiche d'entretien — famille « Massifs » |
| arrosage | ✅ | un module entier (`src/lib/arrosage/`) |
| **plantation** | ❌ | **introuvable dans le dépôt** |
| **cloture** | ❌ | **introuvable dans le dépôt** |

### Ce que le dépôt porte et que ta liste OUBLIE

- **évacuation** — fiche d'entretien, et déjà traitée comme accessoire au lot A ;
- **propreté** — une famille entière : ramassage de feuilles, démoussage de
  voirie, nettoyage de pied de haies ;
- **traitement de pelouse** — scarification, engrais ;
- **taille d'arbuste** et **taille de rosiers** — distinctes de la haie dans SON
  référentiel ;
- **diagnostic végétal** — une fonctionnalité entière du produit.

### Pourquoi je m'arrête ici

Tu as écrit : *« si le dépôt ne permet pas d'établir honnêtement la taxonomie
complète, arrête-toi avec la liste trouvée et les catégories manquantes. Ne
complète pas au jugé. »*

C'est le cas. Trois raisons :

1. **deux de tes natures n'existent nulle part** dans le dépôt — les ajouter
   serait exactement l'invention que tu interdis ;
2. **le dépôt en porte plusieurs que tu n'as pas listées**, et je ne sais pas
   lesquelles sont des natures et lesquelles sont des variantes. « Taille de
   haie » et « Taille d'arbuste » sont-elles une nature ou deux ? Son
   référentiel les sépare ; sa grille de prix n'en connaît qu'une ;
3. **son référentiel d'entretien est éditable par lui** — ce ne sont pas des
   catégories figées, ce sont ses lignes à lui. Figer une taxonomie par-dessus,
   c'est risquer qu'elle contredise ce qu'il ajoutera demain.

**Le contrat du modèle n'a donc pas été touché pour `nature`.** Ce qu'il faut
pour trancher tient en une question posée à l'artisan : *quels travaux vends-tu,
et lesquels se chiffrent différemment ?*

### Ton §3 étape 2, en revanche, je le retiens et je le note

*« `nature` ne doit PAS vouloir dire "possède une grille de prix" »* — c'est
juste, et c'est précisément ce qui a produit le fourre-tout. Une tonte doit
pouvoir porter `nature = "tonte"` sans qu'Atlas prétende savoir la chiffrer. La
séparation est écrite dans le dépôt pour le lot qui la mettra en œuvre.

---

## 4. `espece` — le contrat est écrit, le branchement attend les clés

Conforme à ta décision. La colonne existe depuis le lot B ; la règle est fixée
et documentée :

- **texte libre**, jamais un vocabulaire fermé ;
- rempli **seulement** quand l'essence est explicitement prononcée
  (« démontage d'un **érable** ») ;
- `NULL` sinon ;
- **jamais déduite** d'une nature ni d'un contexte — un « abattage » ne devient
  pas un chêne parce que les chênes sont courants.

Branchement effectif au moment de la comparabilité V2, sur un espace avec les
clés.

---

## 5. Les écrans à adapter au lot D (ta demande du §1)

Pour que l'artisan modifie une mesure **dans son champ** plutôt qu'en réécrivant
le libellé :

| Écran / action | Ce qu'il fait aujourd'hui | Ce qu'il faudra |
|---|---|---|
| **Informations** — la liste des prestations | un seul champ de texte, qui envoie `modifierPrestation(id, libelle)` | des champs quantité + unité à côté du libellé, et une action qui les écrit |
| **Devis** — la colonne « Qté » | modifie `lignes_prix.quantite`, **pas la prestation** | décider laquelle des deux est la source, ou lier les deux (c'est le lot D) |
| **Prix** — même colonne | idem | idem |
| **la dictée dans le devis** | pose une quantité sur la ligne de devis | doit viser la prestation liée quand elle existe |

**Le point à trancher au lot D**, et il n'est pas décidé : la quantité vit
aujourd'hui à **deux endroits** — sur la prestation (le travail) et sur la ligne
de devis (ce qui est vendu). Tant que les deux existent, il faudra dire laquelle
commande. Le lien posé au lot B (`lignes_prix_prestations`) rend la question
répondable ; il ne la répond pas.

---

## 6. Les résultats

```
npx tsc --noEmit   → 0 erreur
npx eslint         → 0 erreur (2 avertissements préexistants, fichiers non touchés)
npm test           → 253 / 255 suites réussies
```

### Les contrôles A / B / C / E / H

| Cas | État | Pourquoi |
|---|---|---|
| **A** — la quantité survit jusqu'à la ligne du devis | ❌ | lot D |
| **B** — deux travaux, deux identités | ❌ | dépend de `nature` — bloqué, §3 |
| **C** — inconnu n'est ni 0 ni 1 | ❌ | M4, hors périmètre |
| **E** — un faux comparable | ❌ | M6, hors périmètre |
| **H** — la troncature | ❌ | hors périmètre |
| **F**, **G** | ✅ | acquis aux lots A et B |

**Aucune assertion affaiblie ni déplacée.**

---

## 7. Ce que je te demande

1. **Le doublon du §1** existait depuis longtemps et personne ne l'avait vu.
   Vois-tu d'autres endroits où l'égalité exacte d'un libellé sert de clé
   d'identité, et qui souffriraient du même défaut ?
2. **La taxonomie du §3** : d'accord pour poser la question à l'artisan plutôt
   que de figer une liste ? Et si oui, quelle question exactement — je veux
   éviter de lui demander un travail de classification qu'il n'a pas à faire.
3. **Le §5** : la quantité à deux endroits. Prestation source de vérité et ligne
   de devis dérivée, ou l'inverse ? C'est la décision qui structure le lot D.
4. **Que casse ce lot** auquel je n'aurais pas pensé ?
