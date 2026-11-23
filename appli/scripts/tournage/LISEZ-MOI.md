# Tourner dans l'appli

Les films du site de vente (`appli/vente/cause-2-visite.html`) montrent les écrans de
l'appli. Ce dossier dit comment on les prend **dans l'appli elle-même**, sur
une base d'essai de ce poste, et les range pour le montage.

Il est né le 19 novembre 2026. Les films du 7 novembre avaient été tournés de
la même façon, mais leurs outils n'étaient pas dans le dépôt : il a fallu tout
retrouver. Sa permission, ce jour-là : lancer l'appli ici sur une base d'essai
et filmer, « rien ne touche votre espace ni vos données ».

## Ce qui ne se fait jamais

**Tout se joue sur la base d'essai LOCALE** (`scripts/monter-base-locale.sh`).
Le jeu d'essai la vide avant de la remplir, et `etat.sh reprendre` la
remplace : aucun de ces gestes ne se joue sur une base habitée, et aucun ne se
propose au patron (`CLAUDE.md` §4 septies). Les scripts ne connaissent que
`localhost`.

## Le principe

1. **Le récit se saisit par les écrans.** Le chantier de Mr. Lemaire (celui
   que toutes les scènes du site suivent) est tapé dans l'appli, champ par
   champ : `recit.cjs`.
2. **Le serveur croit qu'on est le jour du récit** (le vendredi 6 novembre
   2026) : `horloge.cjs` décale l'heure du serveur, pas celle du poste.
3. **Chaque étape d'un geste se FIGE** : le DOM de l'écran tel que l'appli le
   peint, ses feuilles de style, sans un script
   (`scripts/planche-figee/figer.mjs`), et sa photo. Les écrans figés vont
   dans `appli/scripts/rushes/<film>/etats.html`.
4. **Le montage anime ces écrans figés** (`appli/scripts/film-*.js`), et
   l'outil qui filme (`film-*.cjs`) **refuse** de tourner si un écran du film
   ne se superpose pas à sa photo. C'est ce qui permet de dire : ces pixels
   sont ceux de l'appli.

Un écran figé garde les transitions de l'appli : changer un style y joue le
vrai mouvement (le pli des travaux, la coche qui se trace). Le montage les
rejoue à l'instant voulu (`rejouer`, dans `film-fiche.js`).

## La marche, du jeu d'essai aux films

Depuis la racine du dépôt. `$T` est ce dossier, `appli/scripts/tournage`.

```bash
# 1. La base, les dépendances, la version bâtie
source scripts/monter-base-locale.sh
npm ci                                    # si la construction se plaint d'un paquet
NODE_ENV=production npx next build

# 2. Le jeu d'essai, sur la base LOCALE (il la vide)
DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed

# 3. Le serveur, au matin du récit, puis le récit
bash $T/serveur.sh demarrer 2026-11-06T08:00:00+01:00
node $T/recit.cjs
bash $T/serveur.sh arreter && sleep 2 && bash $T/etat.sh garder envoye

# 4. La signature du devis (elle consomme l'état « envoye »)
bash $T/serveur.sh demarrer
node $T/tourner-signature.mjs
bash $T/serveur.sh arreter && sleep 2 && bash $T/etat.sh garder accepte

# 5. La fiche d'intervention et le retour du jour (elle consomme « accepte »)
bash $T/serveur.sh demarrer
node $T/tourner-fiche.mjs
bash $T/serveur.sh arreter

# 6. Les films
node appli/scripts/film-envoi-signe.cjs appli/vente/images
node appli/scripts/film-fiche.cjs appli/vente/images
```

Pour rejouer une prise : `etat.sh reprendre <nom>` (serveur arrêté), puis le
script. Donner un dossier de sortie à un script de tournage le fait écrire
ailleurs que dans `rushes/`, pour comparer sans rien écraser.

`PLAYWRIGHT_EXECUTABLE_PATH` désigne le navigateur, comme pour
`appli/tests/e2e.js`. Il faut aussi `ffmpeg`, `pdftoppm` et `psql`.

## Ce qui a coûté du temps, et qu'on sait maintenant

| Le piège | Ce qu'il faut savoir |
|---|---|
| L'heure du récit | Elle avance comme la vraie depuis le premier démarrage (`$TOURNAGE/ecart-ms`). Un récit tient dans sa journée : le retour du jour ne s'envoie que le jour du chantier. Passé minuit, effacer ce fichier et repartir d'un état gardé |
| L'horloge du serveur | Une classe qui étend `Date` ne suffit pas : Next.js ne recopie que les propriétés propres, `Date.parse` disparaissait et deux écrans tombaient (`horloge.cjs`) |
| L'heure de la base | Elle reste celle du poste. Ce que la base horodate seule (`now()`, un retour posé) est ramené du même écart par le script qui tourne |
| La date proposée au client | L'appli retient d'elle-même le premier jour ouvré : `recit.cjs` le rend avant de choisir le vendredi du récit, sinon le client voit deux dates |
| L'arrêt du serveur | `next start` lance un enfant qui tient le port, dans son propre groupe : `serveur.sh` arrête l'enfant puis le parent, par leurs numéros, jamais par leur nom |
| Les photos de calage | La photo d'un élément commence au pixel entier d'avant lui, et ce qui flotte sur l'écran (la barre du bas, le tiroir) peut s'y poser : `film-fiche.cjs` dit ce qu'il compare |
| La largeur de l'écran | Elle décide de ce que l'appli peint (des règles changent sous 370 et 380 px, et selon que l'écran est tactile). Le montage garde donc l'écran du tournage et n'en photographie que son cadre |
| Les polices | L'appli emploie celles du système. Ce poste lui donne Inter et un sérif de substitution, un iPhone San Francisco et New York : les films n'ont pas les polices d'un iPhone. C'était déjà vrai de ceux du 7 novembre |

## Ce que les films ne montrent pas comme l'appli

Chaque montage le dit dans son en-tête, sous « ce qui est du montage ». Deux
écarts tiennent à l'appli elle-même et sont notés dans `TODO.md` : le bouton
« Envoyer le retour du jour » qui se rallume pendant le repli, et le filet du
PDF qui traverse l'encadré « Bon pour accord ».

## Les films des outils de paysage : sans serveur, sans base

Les douze films de `appli/vente/outils.html` (le plan d'arrosage, le diagnostic,
la fiche de chantier, 20 novembre 2026) ne passent pas par ce dossier. Ils se
tournent dans les démonstrations du site (`appli/vente/demo/`, les vrais écrans
compilés depuis `src/` par `appli/scripts/demo-outils/construire.ts`), qui
n'ont besoin ni du serveur ni d'une base : aucune permission à demander.

```bash
npx tsx appli/scripts/demo-outils/construire.ts       # si un écran a changé
node appli/scripts/film-outils.cjs appli/vente/images  # une heure, l'encodage
node appli/scripts/film-outils.cjs <dossier> --apercu  # une photo par quart de seconde, en une minute
```

Le temps de la page y est figé et n'avance que d'une image à la fois ; les
animations de l'appli et son défilement doux sont recalés sur lui, et chaque
geste est un vrai appui de la souris. Le récit de chaque film est écrit dans
`film-outils.cjs`, sous « Les récits ».
