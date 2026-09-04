# La page du devis — le premier arrêt

**4 septembre 2026.** Lot demandé sur l'écran `/chantiers/[id]/devis-complet`,
là où le patron relit, corrige et valide son devis avant qu'il parte.

Ce document répond au brief `docs/prompt-impeccable-devis-cote-patron.md`,
point par point. Ce qui a été refusé y est écrit, avec ce que ça aurait coûté.

---

## Ce qui a été trouvé, et ce qui a été fait

### 1. Le refus le plus probable arrivait en dernier — CORRIGÉ

**Le défaut.** Une ligne « à chiffrer » — l'issue normale d'une dictée dont un
prix manque — n'empêchait rien sur cet écran :

| | |
|---|---|
| le bouton « Choisir la date » | ouvert sans condition |
| la feuille des dates | ne connaît pas ce blocage : elle n'en porte que quatre (`preparation-envoi.ts`), et celui-là n'y est pas |
| le refus | tombait au serveur, après le choix de la date (`repositories/devis.ts`) |

**Et la phrase du refus l'envoyait où il se tenait déjà :** *« Posez leur
montant sur l'écran du devis, puis revenez ici. »* Elle a été écrite quand la
feuille d'envoi vivait sur `/export` ; depuis le 20 août 2026, elle s'ouvre
depuis le devis lui-même.

Or **l'écran savait déjà** : il écrit « à chiffrer » en or en face de la ligne,
quelques centimètres plus haut. Il refusait de conclure ce qu'il affichait.

**Ce qui a été fait.** Le refus remonte avant la feuille. À la place du bouton,
l'écran dit ce qui manque — avec le nom de la ligne — et porte un geste,
« Poser le prix », qui amène le doigt sur le champ concerné et l'ouvre. Le prix
posé, le bouton revient de lui-même.

**Aucune seconde règle n'a été écrite.** C'est la fonction pure du dépôt qui
répond (`lignesEnAttenteDePrix`, dans `src/lib/preparation-devis.ts`), celle-là
même que le serveur oppose au refus : donc mot pour mot la même phrase. Le
contrôle du serveur reste en place — cacher un bouton ne ferme rien, et
l'action reste appelable.

**Fichiers :** `src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx`.

### 2. Neuf couleurs écrites en clair — CORRIGÉ

Cette feuille n'a volontairement aucun cadre autour de ses champs : c'est un
document, pas un formulaire. **Le seul signe qu'on écrit dedans** était un voile
`rgba(0,0,0,0.03)`, répété huit fois, plus une ombre `rgba(28,28,26,0.10)`.

Sur **Nuit** (`#1a1d19`) et sur **Sylve**, du noir à 3 % posé sur un fond noir
ne se voit pas : le champ en cours de saisie devenait identique au champ au
repos. C'est mot pour mot la deuxième famille de fautes du 22 août 2026 — *« le
mode nuit est illisible »* —, et `voile()` existe depuis pour ça.

Les neuf valeurs passent par `voile(colors.ink, …)`, posé une seule fois sur la
feuille et hérité par les champs (`--voile-champ`, `--voile-champ-teinte`).

**Pourquoi `test-chartes-lisibles.ts` ne le voyait pas :** il mesure les huit
chartes, pas les classes écrites dans un écran. Il ne pouvait pas l'attraper, et
c'est déjà ce que son commentaire annonce.

### 3. Les 1 657 lignes — DÉCOUPÉES

299 lignes sorties dans `ChampsDuDevis.tsx` : les champs et la mise en forme,
qui ne connaissent ni le devis, ni le chantier, ni le serveur. **Rien n'a changé
en passant** — même code, mêmes classes, et le pourquoi de chacun est resté avec
lui.

| | Avant | Après |
|---|---|---|
| `DevisCompletClient.tsx` | 1 657 | **1 479** |
| `ChampsDuDevis.tsx` | — | 336 |

**Le chiffre mérite d'être dit franchement :** 299 lignes sont parties, et le
correctif du point 1 en a ramené 121 — dont l'essentiel est le paragraphe qui
explique pourquoi ce refus vit là et pas ailleurs. L'écran perd donc 178 lignes
nettes, pas 299. Un dépôt qui compte ses lignes en cachant ce qu'il rajoute
ailleurs se ment à lui-même.

**Ce qui n'a PAS été sorti, et pourquoi.** Le tableau des lignes et le bloc des
totaux forment des unités cohérentes, mais chacun demanderait quinze à vingt
paramètres pour franchir la frontière — c'est-à-dire autant d'occasions de
changer un comportement en croyant déplacer du code. Le brief dit « aucun
comportement ne change en passant » ; l'extraction s'arrête donc là où le risque
commence.

### 4. Le bouton au bout de 2,6 hauteurs d'écran — DESSINÉ, PAS CODÉ

**Mesuré :** 2,59 hauteurs d'écran à 390 × 664 avant d'atteindre « Choisir la
date », qui est le tout dernier élément de la page — il vient après le cadre de
signature. La mesure de `TODO.md` se confirme.

**Rien n'a été codé, et c'est délibéré : voir le refus ci-dessous.** Une
maquette essayable est livrée : `appli/devis-le-premier-arret.html`, trois
onglets qui se défilent au doigt.

---

## Ce qui a été REFUSÉ

### « Le document entier passe derrière *Voir le document* » n'est pas tranché

Le brief le range dans **« DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir »**.
C'est inexact, et c'est vérifiable :

| | |
|---|---|
| où ça existe | uniquement dans la maquette `appli/moins-de-mots.html` |
| ce qu'en dit `docs/QUESTIONS.md` §23 | le paragraphe se termine sur **une question sans réponse** : *« La seule chose à me dire : ces trois écrans vous vont-ils ? »* |
| ce qu'en dit `TODO.md` | *« Rien n'est codé »* |

**Ce que le coder aurait coûté.** Replier le document, c'est refondre l'écran du
**premier arrêt** — celui où il relit ce qu'il engage — sur un accord qu'il n'a
jamais donné. Et cela contredit la raison d'être de l'arrêt : *voir ce qu'il
signe*. Le défaut est réel ; le remède lui appartient.

**Trois façons sont donc dessinées plutôt que codées**, à la taille de son
téléphone :

| | Ce que ça fait | Profondeur mesurée |
|---|---|---|
| **Aujourd'hui** | le document entier, puis le bouton | 2,96 hauteurs |
| **A — Replié** | client, total, bouton ; le document derrière « Voir le document » | 1,00 |
| **B — Sous le pouce** | le document ne bouge pas d'un pixel, le bouton reste posé en bas de l'écran | 2,92, et le bouton est là à toute hauteur |

**Ma préférence : B.** Elle règle l'accès sans rien replier de ce qu'il relit —
c'est le seul écran du parcours où voir tout le document est le sujet.

### Ce qui n'a pas été touché, trois sessions travaillant à côté

La facture, la fiche du chantier, l'écran du client `/devis/[jeton]`, et la
feuille d'envoi. Le correctif du point 1 tient **entièrement dans l'écran du
devis** : ni `preparation-envoi.ts`, ni `repositories/devis.ts`, ni
`export/actions.ts` n'ont été modifiés.

---

## Ce qui a été dit et qui se révèle FAUX

**Une erreur de mon analyse, corrigée ici noir sur blanc.** J'ai d'abord retenu
que le refus « à chiffrer » n'arrivait pas jusqu'à lui, parce que
`envoyerDevis` **lance** une erreur au lieu d'en rendre une — et qu'une
exception d'action serveur est remplacée en production par un identifiant
opaque (`AGENTS.md`).

**C'est faux.** `envoyerAuClientAction` l'attrape et la rend en valeur
(`raisonLisible`, dans `export/actions.ts`) : la phrase lui parvient bien. Le
défaut n'était pas le silence — c'était **le moment** où le refus tombe, et
**l'endroit** où sa phrase l'envoie.

---

## Le contrôle qui tient tout ça

`scripts/test-devis-refus-a-chiffrer-e2e.ts` — et il **entre par sa porte**,
pas par la fonction qu'on vient d'écrire (`CLAUDE.md` §5 quater) : il ouvre
l'écran du devis avec une ligne qui attend son prix, et regarde ce que l'écran
propose.

| Il vérifie | |
|---|---|
| 1 | « Choisir la date » n'est pas proposé |
| 2 | le refus nomme sa raison **et la ligne** |
| 3 | « Poser le prix » met le doigt sur le bon champ |
| 4 | le prix posé, le bouton revient et le refus s'efface |

**Il sait échouer :** confronté à l'écran d'avant ce lot, il rougit sur la
première assertion — « Choisir la date » y est présent.

**Une limite, dite plutôt que cachée :** le drapeau `a_chiffrer` ne se lève que
par la dictée, qui demande une clé d'IA absente des postes de développement. La
suite reproduit donc l'**état** que la dictée laisse, pas le chemin qui l'y
amène.

---

## Les chiffres de la batterie

**À REMPLIR** — la batterie n'a pas encore été jouée : trois sessions
travaillent dans le même dossier, et une batterie jouée pendant qu'une autre
écrit ne mesure rien (`CLAUDE.md` §5).

Ce qui est vert à cette heure, et qui ne touche pas la base :

| | |
|---|---|
| `npx tsc --noEmit` | vert |
| `npm run lint` | 0 erreur (17 avertissements, tous antérieurs) |
| `test-aucune-fleche` | vert — 115 717 lignes lues, 8 flèches fonctionnelles, aucune décorative |
| `test-chartes-lisibles` | vert — 14 réussis, 0 échec |
| `test-devis-envoyable` | vert — 5 réussis |
| `test-preparation-devis` | vert |
| la maquette, regardée | 390 × 664, aucun débordement horizontal |

---

## Ce qui reste ouvert

| Quoi | Qui peut trancher |
|---|---|
| Le bouton au bout de 2,6 hauteurs : **Aujourd'hui, A ou B** | **le patron**, sur la maquette |
| « Atlas prépare toujours votre devis… (96 s) » — jamais reproduit sur un poste de développement | à rendre bavard avant de corriger ; **pas touché ici** |
| Un artisan qui arrive les mains vides n'a jamais été essayé (`docs/A-FAIRE.md`) | ouvert |
| Le tableau et les totaux, encore dans l'écran | un lot suivant, si le besoin se présente |
