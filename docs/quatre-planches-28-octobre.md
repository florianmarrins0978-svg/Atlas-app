# Quatre planches à faire arriver dans l'appli, 28 octobre 2026

Le brief disait que quatre planches attendaient leur code. **Les quatre sont
déjà sur `main`.** La troisième y est dans la variante que le patron a choisie le
23 octobre (A), pas dans celle que le brief annonce (B). Vérifié dans le code et
à l'écran, pas dans les titres.

Branche : `claude/quatre-planches-atlas-6hi21h`. Aucune ligne de `src/` n'y
change : seulement la documentation. Rien n'est poussé sur `main`.

## Le verdict, point par point

| Point | Planche | État trouvé | Fait ici | Vérifié par |
|---|---|---|---|---|
| 1. Vos chantiers | `appli/soignee/accueil.html` | **codé et sur `main`** (`c20c6da7`, `076bbfb5`, lot `lot/accueil-soigne`). Le brief disait « rien dans `src/` » : faux | rien, voir « Ce qui a été essayé » | capture de l'accueil ; mesure au navigateur, planche et écran côte à côte ; `test-dashboard-e2e` et `test-devis-qui-tarde-e2e` verts |
| 2. Accueil soigné | la même : `accueil.html` | **c'est la même planche que le point 1.** `appli/soignee/index.html` n'a qu'une entrée qui y mène, intitulée « Vos chantiers » | rien | `index.html`, ligne 46 |
| 3. Le numéro dans le virement | `appli/banque-numero-et-termines.html` (aussi sur `main`) | **codé et sur `main` en variante A** (Oui ou Non dans Ma TVA), migration 0140 déjà passée. Le choix A est écrit dans `TODO.md` (« SES CHOIX DU 23 OCTOBRE 2026 ») et dans `EnAttenteDePaiement.tsx` | rien, voir « À trancher » | 17 cas verts dans `scripts/test-rapprochement-bancaire.ts` ; un virement d'essai « VIR SEPA F2026-000002 » posé dans la base locale : la question sort sur l'accueil (« C'est la facture F2026-000002 ? ») et dans Ma TVA (« Ce virement paie-t-il cette facture ? »), comme sur la planche A |
| 4. Ma TVA, bouton et « Payé par » | `appli/soignee/termines-tva.html` | **codé et sur `main`** (`151fd58f`, `cb11d343`, lot `lot/ma-tva-soignee`). La branche `claude/paye-par-bouts-ronds` du brief n'existe pas sur le dépôt | rien | capture de Ma TVA avec deux factures en attente : « J'ai reçu le paiement » en bouts ronds sur toute la largeur, « Payé par » à gauche de son choix |

## Ce qui a été essayé, puis défait

Mesurées au navigateur à la largeur d'un iPhone 13, deux marges de l'écran ne
sont pas celles de la planche :

| | planche | écran |
|---|---|---|
| de « Créer un devis » à la réponse du client | 25 px | 33 px |
| du nom du chantier aux mots du client | 0 px | 8 px |

**Les deux ont été retirées, puis remises.** La planche ne dessine pas ce que le
fil de l'appli porte : un fondu de 18 px en haut, et une accroche qui ramène la
carte sous ce fondu quand on fait défiler.

- Sans les 8 px du haut, la carte commence dans le fondu : son bord s'estompe au
  repos.
- Sans les 8 px de la citation, la carte raccourcie ne se raccroche plus après
  un petit défilement : elle s'arrête coupée, seuls ses gestes visibles. C'est
  le défaut de sa capture du 16 août, et `test-devis-qui-tarde-e2e` l'a attrapé
  deux fois sur deux (vert sans le changement).

**Ce qui a été dit dans ce lot et qui était faux** : j'ai d'abord écrit que ces
8 px venaient d'une planche mal lue. Ils sont voulus. C'est écrit dans
`ARCHITECTURE.md` §504 pour qu'aucune session ne refasse l'essai.

## Ce qui reste, et pourquoi ce n'est pas fait

| | Pourquoi | Qui tranche |
|---|---|---|
| **La barre du bas en mots** (« Chantiers », « Planning »… au lieu des capitales) | la planche la montre, mais elle relève de « Ce qui change partout » (`appli/soignee/fondations.html`) : la toucher change tous les écrans. Déjà écrit dans `ARCHITECTURE.md` §504 | le patron, sur `fondations.html` |
| **4 px par carte** : interligne du titre (1,3 contre 1,45) et du nom (1,2 contre 1,3) | `TitreDeCarte` est commun à toutes les cartes de l'accueil ; les changer déplacerait des cartes qu'aucune planche ne touche, et la carte plus haute changerait l'accroche du fil | le patron, s'il le voit |
| **A ou B pour le virement dans Ma TVA** | voir ci-dessous | le patron |

## À trancher : A ou B

Le brief dit « le patron a choisi B ». Le dépôt dit A, et le code fait A :

> `appli/banque-numero-et-termines.html` : [...] Dans Terminés, Ma TVA :
> **variante A**, « Oui / Non » à la place des deux boutons de la ligne.
> (`TODO.md`, « SES CHOIX DU 23 OCTOBRE 2026 »)

Rien n'a été recodé. Si le patron veut vraiment B (garder « J'ai reçu le
paiement » et « J'ai reçu une partie », remplis avec la date et le montant de la
banque) :

- **aucune migration n'est nécessaire** : `virements_recus` porte déjà le jour,
  le montant et la facture. La migration de cette planche est la 0140, déjà
  passée ;
- ce serait revenir sur sa réponse du 23 octobre, et l'accueil garderait son Oui
  ou Non : les deux endroits ne poseraient plus la même question.

## Ce qui a été joué

- Types, lint, tirets et pansements : verts.
- Deux suites navigateur seules (`--seulement`), pas la batterie :
  `test-dashboard-e2e` et `test-devis-qui-tarde-e2e`, vertes sur l'état de
  `main`.
- **Aucune batterie**, à la demande du brief. Le lot ne touche que de la
  documentation (niveau 1).
