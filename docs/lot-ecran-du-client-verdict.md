# L'écran de votre client — ce qui a été codé le 20 septembre 2026

Quatre demandes, une soirée, **un seul lot** comme vous l'avez demandé :
*« avant de coder j'ai encore des modif à faire sur cette page, tu coderas tout
d'un coup »*.

Les deux planches restent en ligne :
`https://florianmarrins0978-svg.github.io/Atlas-app/le-refus-par-erreur.html`
et
`https://florianmarrins0978-svg.github.io/Atlas-app/proposer-ses-jours.html`

---

## 1. « Je ne donne pas suite » ne ferme plus un devis d'un doigt

**Ce que vous avez dit :** *« j'ai sans faire exprès cliqué sur je ne donne pas
suite, aucun moyen d'annuler, il faut mettre une sécurité avant l'envoi »*.

**Fait — la A, la feuille.** Le bouton n'envoie plus rien par lui-même : il
ouvre la feuille qui demande « Vous ne donnez pas suite ? », avec « Revenir au
devis » en dessous.

| | |
|---|---|
| le fichier | `src/app/devis/[jeton]/formulaire.tsx` |
| ce que ça coûte à l'écran | **0 pixel** — la feuille monte par-dessus, la page ne bouge pas |
| le contrôle | `test-devis-client-e2e.ts` : un seul appui ne ferme plus le devis, et « Revenir » le rouvre |

**Pourquoi ce bouton-là et pas les deux autres.** « Une correction » ne part
déjà pas sans un mot écrit. « J'accepte » ne perd rien : il reste le téléphone.
« Je ne donne pas suite » était le seul geste à la fois irrattrapable et
coûteux.

**Et votre devis d'hier n'est pas perdu :** le chantier est passé en « Devis
retourné », vous le renvoyez depuis la fiche et un lien neuf part.

---

## 2. La phrase : « Cette date ne me convient pas ? Je propose »

**Ce que vous avez dit :** *« quand il y a une date c'est : cette date ne me
convient pas ? Je propose »*, et *« quand il y a plusieurs dates de proposées,
mets la phrase au pluriel »*.

**Fait**, et avec une précision que vous n'aviez pas eu à dire : **le pluriel se
décide sur les JOURS, pas sur le nombre de lignes**. Votre capture le montrait —
une seule ligne listait *« le jeudi 8 octobre, le vendredi 9, le lundi 12 et le
mardi 13 octobre »*, quatre dates, et juste en dessous « cette date », au
singulier. Compter les lignes aurait redonné ce singulier-là.

| | |
|---|---|
| le fichier | `src/lib/libelle-dates.ts` |
| le contrôle | `test-libelle-dates.ts` |

---

## 3. Elle pose ses jours comme vous posez les vôtres

**Ce que vous avez dit :** *« lorsqu'elle clique sur proposer des jours, s'il y
a plusieurs jours il faut mettre le même système que nous : les 4 dates
s'affichent, elle clique sur un jour sélectionné pour le désélectionner et
reclique ailleurs pour le déplacer »*.

**Fait, avec VOTRE règle — pas une copie.** C'est la fonction de votre écran
d'envoi, appelée avec une seule proposition au lieu de deux. Deux façons de
poser un bloc finiraient par ne plus dire la même chose.

**Et vous avez trouvé le trou vous-même**, sur la planche : *« on peut pas
désélectionner un jour sur les 4 et le mettre ailleurs en recliquant
ailleurs »*. Votre règle du 17 septembre compte **trois** gestes, la planche
n'en connaissait que deux :

| ce jour | ce que l'appui fait |
|---|---|
| déjà posé | il s'efface, et **rien ne se décale** |
| il en manque | il **comble** — ce jour-là seul |
| rien ne manque | il repose le **bloc entier** ailleurs |

| | |
|---|---|
| les fichiers | `src/lib/propositions-de-jours.ts`, `formulaire.tsx` |
| les contrôles | `test-jours-du-client.ts` (le geste), `test-jours-du-client-db.ts` (la base) |

---

## 4. « Les travaux sont prévus sur 4 jours »

**Ce que vous avez dit :** *« en dessous de "quels jours vous arrangent ?" et
au-dessus de la touche pour valider, écris le nombre de jours »*.

**Fait — et vous avez eu à le redire.** Je l'avais d'abord posée **dans la
feuille** du calendrier, que votre cliente n'ouvre que si les dates ne lui vont
pas : elle lisait quatre dates sans jamais savoir que le chantier en prend
quatre, au moment précis où elle choisit. Elle est maintenant sur la page, sous
la question — et reprise dans la feuille, où elle explique les quatre jours
allumés. Les deux ne se voient jamais en même temps.

**Et ça ne dit rien de votre planning.** Le compte vient des jours que VOUS avez
proposés, déjà écrits sur sa page. Ni la durée en demi-journées, ni le matin ou
l'après-midi ne descendent jusqu'à elle — le contrôle qui le garde
(`test-creneaux-planning.ts`) est resté vert.

---

## Ce que vous n'aviez pas demandé, et qu'il a fallu faire

**Le serveur ne savait recevoir qu'UNE date.** Il étalait ensuite un bloc de
quatre jours derrière elle : votre cliente engageait des jours qu'elle n'avait
jamais vus. Il reçoit maintenant sa liste, la revérifie contre votre planning
jour par jour, et la garde (migration `0097`).

**Trois jours retenus pour un chantier de quatre partaient sans un mot.** Vous
n'auriez pas eu de quoi faire le travail, et personne ne l'aurait su avant le
chantier. L'écran répond « Il manque 1 jour », et le serveur refuse de son côté.

**Un défaut sérieux, trouvé en écrivant le contrôle :** si elle gardait votre
premier jour et poussait seulement le quatrième, sa liste aurait été **jetée au
profit de la vôtre, en silence** — parce que la réponse se jugeait sur le
premier jour. Elle se juge désormais sur les jours.

---

## Ce qui a rougi avant de passer au vert

Deux choses, et les deux apprennent quelque chose :

1. **Un envoi d'avant le 18 septembre** (sans liste de jours) posait un chantier
   de deux jours sur **une seule journée**. Attrapé par
   `test-envoi-jours-pas-colles-db` et `test-creneaux-planning`, pas par l'œil.
2. **Le contrôle « tout tient dans un écran » mesurait ZÉRO.** Il visait le
   bouton du refus par son `value`, parti dans la feuille — et « 0 ≤ 664 »
   serait passé au vert si le dépôt n'avait pas, depuis le 15 août, un garde-fou
   contre les mesures nulles. Un repère stable a remplacé ce `value`.

---

## Ce qui reste ouvert, et que vous seul pouvez trancher

**Quand elle cherche où remettre son quatrième jour, les jours barrés le restent
trop largement.** Sa page ne reçoit qu'une liste : les jours où votre chantier
**ne peut pas commencer**. Un jour parfaitement libre pour une journée seule y
figure donc, alors qu'il ferait très bien l'affaire pour combler.

C'est le côté sûr : elle ne vous propose jamais un jour que l'acceptation
refuserait. Mais c'est plus restrictif que nécessaire, et sur un mois chargé
cela lui laisse peu de place. **Lui en envoyer une seconde liste apprendrait
quelque chose de plus de votre planning** — c'est votre règle depuis toujours
qu'il n'apprenne rien : à vous de dire si elle bouge ici.

---

## La batterie

Jouée en entier (niveau 3 : migration + écran du client + devis).

| étape | verdict |
|---|---|
| Types | ✅ |
| Lint | ✅ |
| Construction | ✅ |
| Mémoire du dépôt | ✅ |
| Suites base de données | ✅ **399/400** — 1 non mesurable ici (pas de clé IA sur ce poste) |
| Suites navigateur | ✅ **163/163** |
| Connexion derrière un proxy | ✅ connexion réelle, origine étrangère |

**Rien n'est livré tant que ce n'est pas sur `main`** : votre espace ne suit que
`main`, et la fusion se demande.
