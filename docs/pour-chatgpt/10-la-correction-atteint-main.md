# Atlas — La correction « dictée → devis » atteint enfin `main`

**30 août 2026.** Ce dossier clôt une séquence de trois : il dit ce qui est
maintenant en ligne, **corrige noir sur blanc une faute des deux précédents**,
et rend compte de trois suites rouges dont aucune n'était ce qu'elle paraissait.

Il n'ouvre aucun lot et ne rouvre aucun chantier.

---

## 1. LA FAUTE À CORRIGER, et elle a coûté un aller-retour au patron

Le dossier 09 s'intitulait **« Mise sur `main` de la correction »**. Elle
n'était pas faite. Son corps décrivait la fusion `origin/main` **vers la branche
de travail** — l'inverse du sens que son titre annonçait.

Ce qui s'est passé ensuite était prévisible : le patron a lu le titre, est allé
dans son Codespace sur `main`, a lancé la commande, et a reçu :

```
npm error Missing script: "verifier:chaine-dictee"
```

**npm disait vrai.** Les commits vivaient sur
`origin/claude/audit-dictee-devis-ryqfy6` et nulle part ailleurs. Il a dû faire
lui-même le diagnostic — brancher active, HEAD, `origin/main`, présence du
fichier — que ce titre devait lui épargner.

**Ce qui aggrave la faute :** le dossier 08 avait DÉJÀ été repris pour avoir
appelé « fusion » deux opérations de sens opposé sans le dire. La correction a
été écrite dans le corps du 09 — **et son titre a reproduit exactement la même
confusion.** Corriger un paragraphe et laisser le titre mentir, c'est corriger
la partie qu'on relit et laisser celle qu'on lit.

**La règle qui en sort**, inscrite dans `docs/pour-chatgpt/README.md` : *un
titre de dossier ne décrit jamais un état du dépôt* — « mis sur `main` »,
« livré », « déployé ». Il nomme le SUJET. Ce qui est fait ou non se lit dans le
corps, où il peut être mesuré. Un titre est lu par quelqu'un qui n'ouvrira
peut-être pas le document ; il engage donc autant que le contenu.

Le dossier 09 n'est pas réécrit — un instantané ne se corrige pas
(`CLAUDE.md` §2 bis). C'est ce dossier-ci qui porte le démenti.

---

## 2. Ce qui est en ligne, vérifié sur le distant

```
origin/main : 0ad7326a — Merge branch 'claude/audit-dictee-devis-ryqfy6'
```

Contrôle fait **après** la poussée, en interrogeant le distant :

```
✓ scripts/verifier-chaine-dictee.mts       PRÉSENT sur origin/main
✓ "verifier:chaine-dictee": "tsx scripts/verifier-chaine-dictee.mts"
✓ src/lib/natures-prestation.ts
✓ src/lib/quantite-commerciale.ts
✓ src/lib/comparabilite-prix.ts
✓ drizzle/0070_prix_a_chiffrer_et_comparabilite.sql
```

**Rien n'a été perdu.** Aucune poussée en force, aucune réécriture d'historique,
aucun travail d'une autre session supprimé. `main` avait pris **172 commits**
pendant la vérification, intégrés en trois fusions successives, et la branche de
travail est aujourd'hui entièrement contenue dans `main`.

### Les collisions que la cohabitation a produites

Plusieurs sessions écrivent sur cette application en parallèle. Trois faits, et
la règle appliquée à chacun :

| Collision | Ce qui a été fait |
|---|---|
| §191 pris par deux sessions dans `ARCHITECTURE.md` | le paragraphe **pas encore sur `main`** se renumérote → §203 |
| puis §203 pris à son tour par `main` | même règle, une seconde fois → **§205** |
| trois suites de calendrier réparées des deux côtés | **la version de `main` retenue, la mienne jetée** — elle avait un helper là où la mienne cliquait les jours un par un |

La deuxième ligne n'est pas une redite : entre les deux fusions, une autre
session avait publié un §203. Renuméroter une fois ne suffit pas quand la course
continue.

---

## 3. Migrations aux numéros en double : coexistence sûre — **OUI**

La consigne était de chercher, **avant** de toucher à l'historique des
migrations, une hypothèse « un numéro = une migration unique ». Elle n'existe
nulle part. Deux preuves.

### Par le code

`scripts/run-migrations.ts` est le seul applicateur :

```ts
CREATE TABLE IF NOT EXISTS _migrations (
  nom text PRIMARY KEY,          // le nom ENTIER, jamais le préfixe
  appliquee_a timestamptz NOT NULL DEFAULT now()
)

const fichiers = readdirSync(dossierMigrations)
  .filter((f) => f.endsWith(".sql"))
  .sort();                        // tri sur le nom entier

for (const fichier of fichiers) {
  if (dejaAppliquees.has(fichier)) continue;   // comparaison sur le nom entier
```

Cherché sans résultat : `slice(0,4)`, `substring(0,4)`, `parseInt(nom)`,
`match(/\d{4}/)` sur un nom de migration — dans `scripts/`, `.github/workflows/`
et `.devcontainer/`. **Aucune extraction de numéro n'existe.**
`drizzle/meta/_journal.json` n'est lu par personne ; `drizzle-kit` n'est appelé
par aucun script ni workflow ; la CI applique `npm run db:migrate`, donc le même
applicateur.

### Par la base

```
numéro 0035 → 2   0062 → 2   0064 → 2   0066 → 2   0068 → 2
numéro 0036 → 2   0063 → 2   0065 → 2   0067 → 3   0069 → 2
```

**Dix numéros portent déjà plusieurs migrations**, certains depuis 0035, en
service sans incident. Le régime normal d'un dépôt à plusieurs sessions.

**Décision : fichiers conservés.** Et le raisonnement s'inverse — renommer
serait le geste dangereux : `_migrations` retenant le nom complet, un fichier
renommé serait vu comme neuf et **rejoué** sur toutes les bases qui l'ont déjà
appliqué, production comprise.

---

## 4. Trois suites rouges, et aucune n'était ce qu'elle paraissait

Deux batteries complètes le même soir. Les chiffres :

| Étape | Avant nettoyage | Après |
|---|---|---|
| Types | ❌ 2 erreurs | **✅ 0** |
| Lint | ✅ | ✅ 0 erreur, 12 avertissements préexistants |
| Construction | ❌ | **✅** |
| Mémoire du dépôt | ✅ | ✅ |
| Suites base | ✅ 274/274 | ❌ 273/275 |
| Suites navigateur | ✅ 116/116 | ❌ 115/116 |
| Connexion derrière un proxy | ✅ | ✅ |

### 4.1 Les deux ❌ de types et de construction : un seul reste de build

Les deux erreurs, en entier :

```
.next-batie/types/validator.ts(476,39): error TS2307: Cannot find module
  '../../src/app/reglages/fiche-entretien/page.js'
.next-verification/types/validator.ts(476,39): error TS2307: (idem)
```

**Zéro erreur hors des dossiers de build.** Ce sont des sorties ignorées par
git, datées de la veille ; entre-temps `main` avait déplacé la page
`fiche-entretien`. `tsconfig.json` exclut `.next-batie/dev` mais pas
`.next-batie/types` : `tsc` et `next build` lisaient tous deux le validateur
périmé — **deux étapes rouges pour un seul reste**.

`tsconfig.json` n'a **pas** été modifié pour masquer le problème. C'était
l'option tentante et c'eût été une faute : on ne rend pas un contrôle plus
tolérant pour obtenir du vert.

### 4.2 Le renversement, et il est contre-intuitif

Réparer la construction a rendu deux suites rouges.

`test-relance-construction.ts` et `test-fiche-pendant-relance.ts` disaient
*« le veilleur n'a rien retenté — il a appelé : rien du tout »*. La cause est
dans `veiller.sh` :

```bash
if ! pgrep -f '[n]ext build' >/dev/null 2>&1; then
```

**`pgrep` balaie toute la machine**, pas les processus de la suite. Tant que
l'étape Construction échouait, aucun `next build` ne tournait et les suites
étaient vertes. Une fois la construction réparée, un vrai `next build` a tourné
— et le veilleur a refusé de retenter.

**Établi par mesure, pas par déduction :**

1. le veilleur chronométré seul : **première relance en 39 ms**, trois fois sur
   trois, là où la suite lui laisse 3 500 ms → le temps n'y est pour rien ;
2. un processus nommé `next build` posé délibérément à côté : **les trois mêmes
   cas rougissent** ;
3. retiré : **3/3 vert**.

La signature confirme tout : ce sont exactement les trois cas qui **attendent**
une relance qui tombent, pendant que les deux qui attendent son **absence**
passent.

**Un incident de méthode mérite d'être écrit**, parce qu'il a failli fausser le
diagnostic : mon propre « témoin sans parasite » a rougi — un `sleep` nommé
`next build`, mal tué à l'expérience précédente, traînait encore. Le contrôle
censé prouver l'innocence était lui-même contaminé. C'est le même piège que
celui qu'on mesurait, une couche plus haut.

### 4.3 Une attribution erronée, corrigée

Une autre session avait rangé `test-fiche-pendant-relance` parmi les suites que
la charge machine fait rougir, en notant qu'elle repassait « sur une machine
reposée ». **C'était faux** : sa cause est le `pgrep` ci-dessus, et elle n'a rien
d'aléatoire. Corrigé dans `TODO.md`, avec l'avertissement qui va avec : une
suite classée « aléatoire » cesse d'être crue, et son rouge n'apprend plus rien.

### 4.4 La troisième : un motif déjà documenté

`test-devis-doublon-e2e` — *« Aucune proposition de prix après trente
secondes »*, **verte 1/1 rejouée seule** dans la minute. Trente secondes
d'attente fixe sous une batterie de 116 suites navigateur. Motif relevé le
26 août, cinquième occurrence. Le remède connu n'est pas d'allonger le délai
mais d'attendre un témoin — quatre suites différentes en trois jours l'ont
montré, et à chaque fois le produit était sain.

**Aucune des trois ne touche la chaîne dictée → devis. Aucune n'a été
corrigée** : consigne explicite de ne rien traiter au passage.

### 4.5 Ce qui a été rejoué sur l'état final

Les 7 derniers commits de `main` ne touchaient aucun fichier de code du lot,
aucune migration, aucune pièce partagée — la règle du dépôt demande alors les
contrôles rapides et les suites du domaine, pas la batterie entière :

```
Types                        ✅ 0 erreur
Lint                         ✅ 0 erreur
Mémoire du dépôt             ✅
test-natures-prestation      19 réussite(s), 0 échec(s)
test-quantite-commerciale    10 réussite(s), 0 échec(s)
test-lignes-vendables        ✅ Toutes les vérifications passent
test-prix-attribuable        19 réussite(s), 0 échec(s)
test-chaine-dictee-attendue   7 réussite(s), 0 échec(s)
test-troncature-modele        8 réussite(s), 0 échec(s)
test-mesures-prestation      22 réussite(s), 0 échec(s)
```

---

## 5. La vraie IA : toujours NON

`npm run verifier:chaine-dictee` refuse de conclure sans clé, et c'est sa raison
d'être :

```
Fournisseur : dev
❌ Aucune clé d'IA n'est configurée : rien n'a été appelé, et ce contrôle
   ne peut donc RIEN prouver.
```

Code de sortie 1. **Aucune des douze informations attendues — nature, espèce,
quantité, unité, méthode, diamètre, hauteur, tailleEquipe, dureePrevue,
non-fusion tonte/démontage, absence d'invention — n'a été observée sur une
réponse réelle de modèle.**

Ce qui est établi sans clé : la commande sait échouer (7/7, dont cinq
dégradations refusées), et une faute de transcription ne contamine rien.

```
[abattage · principale]  Érable — démontage en rétention / Évacuation des déchets
[autre]                  Tombe de la pelouse (1200 m²)
```

« Tombe » ne rejoint pas l'abattage, ne prend pas son prix, n'entre pas dans sa
mémoire de prix : ligne séparée, « à chiffrer », **visible**. Et **aucun
correcteur probabiliste de Whisper n'a été créé** — deviner que « tombe » veut
dire « tonte » serait inventer une donnée de chantier.

---

## 6. Les deux gestes qui restent

```bash
git pull --ff-only origin main     # --ff-only refuse plutôt que d'écraser
npm run verifier:chaine-dictee
```

Puis, sur le téléphone : chantier → Note vocale → dicter → **Lancer la
transcription**.

**Avant le devis, lire le texte.** Sous le bouton : « Transcription disponible —
voir le texte ». C'est le **seul** endroit où l'on voit ce que Whisper a
entendu, et aucune commande ne le joue. Si un mot est faux, photographier
d'abord, corriger à la main, continuer — la photo mesure Whisper, la correction
laisse le reste s'éprouver.

Sur l'écran Devis : au moins 4 lignes, la tonte séparée de l'érable, « 800 ml »
sur la haie, « à chiffrer » sur la tonte, envoi refusé.

---

## 7. Ce qui n'a pas été touché

| Sujet | État |
|---|---|
| « 2 souches × prix unitaire » | **inchangé** |
| « Offert / geste commercial » | **non créé** |
| Whisper | **non touché** — mesuré seulement |
| `tsconfig.json` | **non modifié** — problème réglé, pas masqué |
| Numérotation des migrations | **non modifiée** — coexistence prouvée |
| Les trois suites rouges | **non corrigées** — documentées |

---

## Questions

1. **Sur le titre qui mentait.** La règle adoptée est qu'un titre nomme le sujet
   et jamais un état. Est-ce le bon remède, ou faut-il aller plus loin — un
   dossier qui commence par une ligne d'état vérifiable, du type
   `origin/main: <sha>` ?

2. **Sur `pgrep` qui balaie la machine.** Deux pistes : rendre le motif
   détournable pour les épreuves, ou restreindre aux processus du même groupe.
   La première est plus simple mais crée un chemin qui n'existe que pour les
   tests — ce que ce dépôt évite ailleurs. Laquelle choisiriez-vous ?

3. **Sur les suites « aléatoires ».** Cinq occurrences en trois jours, dont une
   qui avait en réalité une cause nette. À partir de quand un tiroir « à
   requalifier » devient-il l'endroit où l'on range ce qu'on ne veut pas
   regarder ?

4. **Sur la non-renumérotation des migrations.** L'argument est qu'un fichier
   renommé serait rejoué. Voyez-vous un outil — restauration, comparaison de
   schémas, audit — où deux `0069` distincts poseraient réellement problème ?

5. **Qu'est-ce qui manque ?** Entre le micro et le devis, quelle étape peut
   encore échouer sans qu'aucun des contrôles décrits ici ne le révèle ?
