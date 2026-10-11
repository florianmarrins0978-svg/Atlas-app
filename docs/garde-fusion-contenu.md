# Le garde-fou qui relançait des batteries pour rien

**17 septembre 2026.** Ce qui suit est le retour sur le garde-fou de fusion —
celui qui a été mis en place avec ChatGPT, et qui s'est mis à bloquer plus qu'il
ne protégeait.

## Ce qui n'allait pas

Le garde-fou vérifie qu'un lot a bien été éprouvé avant de partir sur `main`.
Pour savoir si l'arbre a bougé depuis la vérification, il comparait **la date de
la dernière écriture** des fichiers.

Or une fusion **réécrit** les fichiers qu'elle apporte, et parfois à l'identique.
Donc :

| Ce qui se passait | Ce que le garde-fou en concluait |
|---|---|
| une session voisine fusionne sur `main` | (rien qui concerne mon lot) |
| je refusionne `main` sous mon lot | toutes les dates sont neuves |
| mon lot était vert depuis dix minutes | **« l'arbre a changé », verdict perdu** |
| le refus n'annonçait qu'un remède | la batterie entière — cinquante minutes |

À trois ou quatre sessions, chacune faisait perdre son verdict aux autres en
fusionnant. C'est la boucle.

## Ce qui a été corrigé, à la racine

**La date est supprimée.** Rien ne la recouvre : elle est retirée du code, pas
contournée.

Ce qui décide est désormais le **contenu** du fichier. La batterie le faisait
déjà depuis le 9 septembre — un fichier réécrit à l'identique n'a pas bougé —
mais le garde-fou ne pouvait pas s'en servir : c'est un déclencheur, il tourne
sans l'outillage TypeScript. Il gardait donc sa propre façon de dire « ce
fichier a changé », et les deux ont fini par se contredire. Il n'y en a plus
qu'une, et les deux la prennent au même endroit.

**Et ce qui a bougé ne se vaut plus.** Le garde-fou sait déjà ce que le lot
ajoute à `main` : ce qui n'y figure pas n'a pas été écrit ici, c'est arrivé par
la fusion.

| Ce qui a bougé depuis la vérification | Ce qu'il demande maintenant |
|---|---|
| rien (contenu identique) | **rien** : la poussée passe |
| un fichier **du lot** | le contrôle de son niveau |
| **seulement** ce que `main` a apporté | `npx tsx scripts/verifier-ce-qui-a-bouge.ts` — une minute, souvent rien à jouer |
| une empreinte illisible | le contrôle du niveau — ne pas savoir n'est jamais « rien n'a bougé » |

Le complément existait déjà depuis ce matin. **Le garde-fou ne le nommait
jamais** : il fallait y penser soi-même au bout de trois heures. Il le nomme
désormais dans son refus.

## Ce qui a été refusé

**Laisser passer une fusion sans rien mesurer** quand `main` a avancé. Ce que
`main` apporte est passé par son propre contrôle ; ce qui n'a jamais été mesuré,
c'est **la rencontre des deux**. Elle coûte une minute — et le plus souvent zéro,
quand les deux lots ne se croisent nulle part. La supprimer aurait échangé une
boucle de batteries contre un trou.

## Ce qui prouve que ça tient

`scripts/test-garde-fusion-main.ts` rejoue la soirée dans un dépôt d'essai à
part : un lot vert, `main` qui avance dessous, la fusion. Il **refuse** que le
message de refus contienne « verifier:avant-livraison ».

Confronté au code d'avant, six de ses cas rougissent. C'est ce qui prouve qu'il
mesure quelque chose.

## Chiffres de ce lot

| | |
|---|---|
| niveau calculé | **2** (outillage) — `npm run verifier:avant-fusion` |
| types (`tsc --noEmit`) | 0 erreur |
| style (`lint`) | 0 erreur (41 avertissements, tous antérieurs) |
| suites jouées | garde-fusion, batterie-solitaire, portée-batterie, après-fusion, dernier-verdict, code-mort, couches, pansement, scripts-d'entrée — **toutes vertes** |
| batterie complète | **non jouée** — demandé de n'en lancer aucune |

## Ce qui reste ouvert

Le lot est sur sa branche, pas sur `main`. Pour qu'il arrive sur ton espace, il
faut jouer `npm run verifier:avant-fusion` (quelques minutes, pas cinquante) et
pousser.
