# Salarié absent, la C : ce qui est codé

*27 octobre 2026. Sa demande : « tu peux coder la C, pas de batterie ».*

## Le verdict

| | |
|---|---|
| **la feuille** | « Salarié absent ? » ouvre une feuille : « Absent le mardi 27 octobre ? », une ligne par salarié, ses initiales, et la piste Présent, Matin, Après-midi, Journée |
| **le geste** | un appui sur une case, ou le curseur glissé au doigt ; le choix s'écrit au lâcher |
| **Présent devient Absent** | dès que le curseur quitte la première case, elle dit « Absent », en ambre |
| **une semaine notée ailleurs** | se lit sous le nom (« Du 26 au 30 octobre ») ; rendre le salarié présent ce jour-là ne touche qu'à ce jour |
| **seul, sans salarié** | « Absent ? » pose la journée d'un appui, comme avant, sans feuille |
| **où** | branche `lot/salarie-absent-c`, **pas sur `main`** : la batterie n'a pas été jouée |

## Ce que la relecture a trouvé, et qui est corrigé

**Retirer un salarié d'un seul jour du planning effaçait toute son absence.** Une
semaine notée dans Réglages, Équipe disparaissait d'un appui sur « Julien,
annuler » ou sur la croix, et ses dates redevenaient proposables au client.
Choisir « Matin » sur un jour de la semaine faisait pareil.

Reproduit avant de corriger : la suite `test-absence-d-un-jour-repo.ts`, jouée
avec l'ancien geste, rougit 4 fois sur 5 ; avec le nouveau, 8 sur 8 au vert.
La période se coupe maintenant autour du jour, son motif gardé, dans une seule
écriture avec les chantiers qu'elle défait.

**Le moment d'un jour se lisait mal** : une absence qui commence un jeudi
après-midi s'affichait « journée » le jeudi. Il se lit désormais sur le jour.

## Trouvé en jouant le glissé, et corrigé

**La feuille sortait de l'écran et glissait avec les mois.** La fiche du jour vit
dans le carrousel des mois, qui se déplace sous le doigt : une feuille posée
dedans se mesurait sur lui, pas sur l'écran. Et glisser le curseur faisait
tourner les mois, ce qui refermait la feuille. Deux corrections, chacune à sa
source : la feuille se dessine sous la page entière (comme le calendrier des
périodes de Ma TVA), et le carrousel ne glisse plus que sous un doigt posé sur
lui. Un contrôle tient désormais que la feuille tient dans l'écran.

**Ce qui n'est pas de ce lot** : `test-planning-e2e` lit le devis d'un chantier
neuf avant que sa création l'ait écrit, en insère un second, et la base refuse.
Rouge deux fois sur quatre ici, vert sur `main` ; noté dans `TODO.md`.

## Ce qui a été fait autrement que la planche

| | la planche | le code | pourquoi |
|---|---|---|---|
| la période sous le nom | « Du lundi 26 au vendredi 30 octobre » | « Du 26 au 30 octobre » | la phrase vient de la fonction qui l'écrit déjà dans Réglages, Équipe : une seule façon de dire une période |

## Ce qui a été éprouvé ici

| | |
|---|---|
| règle pure (`test-absence-d-un-jour.ts`) | 9 sur 9 |
| dépôt sous la RLS (`test-absence-d-un-jour-repo.ts`) | 8 sur 8 |
| absences existantes (`test-absences-equipe-repo.ts`) | 12 sur 12 |
| mode d'emploi (`test-mode-emploi.ts`) | 32 sur 32 |
| types, style, tirets, flèches, pansements, code mort, couches | verts |
| suite navigateur du geste (`test-pas-la-ce-jour-e2e.ts`) | 10 sur 10, glissé au doigt compris |
| absences de Réglages, Équipe (`test-absence-equipe-e2e.ts`) | 6 sur 6 |
| écran d'ordinateur (`test-sur-ordinateur-e2e.ts`) | 16 sur 16 |
| planning (`test-planning-e2e.ts`) | 46 sur 46 deux fois de suite ; rouge les deux premières fois, par son décor (voir plus bas) |
| le carrousel des mois glisse encore au doigt | joué à la main : octobre puis novembre |
| l'écran regardé | la feuille, le glissé, la ligne « Absent » sous la date, à 390 px |

## Ce qui reste ouvert

| | qui |
|---|---|
| la batterie entière (niveau 3 : écriture en base), puis `main` | lui, quand il dit de la lancer |
| « du 1 au 5 mars » au lieu de « du 1er » dans `libelleAbsence`, déjà vu dans Réglages, Équipe | un lot à part, niveau 2 |
