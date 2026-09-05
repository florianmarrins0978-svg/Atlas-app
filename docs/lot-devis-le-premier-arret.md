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

### 4. Le bouton au bout de 2,6 hauteurs d'écran — DESSINÉ, PUIS CODÉ SUR SA LETTRE

**Mesuré :** 2,59 hauteurs d'écran à 390 × 664 avant d'atteindre « Choisir la
date », qui était le tout dernier élément de la page — après le cadre de
signature. La mesure de `TODO.md` se confirme.

**Trois façons ont été dessinées avant d'écrire une ligne**
(`appli/devis-le-premier-arret.html`), et il a répondu : **« La B »**.

B est codée : le document ne bouge pas d'un pixel, et « Choisir la date » reste
posé en bas de l'écran à toute hauteur de lecture. Mesuré sur l'écran réel, à
390 × 664, sur un devis de trois lignes qui fait **3,32 hauteurs** :

| Où il en est de sa lecture | Le bas du bouton |
|---|---|
| en haut de page | 648 px (fenêtre : 664) |
| à mi-parcours | 648 px |
| en bas | 604 px — il s'est posé à sa place |

**Ce qui a été fait autrement que la maquette :** le bouton est passé en pleine
largeur (`pleineLargeur`). Une barre qu'on garde sous le pouce et un bouton qui
n'occupe que le milieu se contredisent — vu à la capture, pas au test.

**A a été écartée par lui**, et sa raison tient : replier le document derrière
« Voir le document » aurait caché ce qu'il signe sur le seul écran dont c'est
le sujet.

### 5. Deux défauts qu'il a vus sur son téléphone, le 5 septembre — CORRIGÉS

**a) La barre collée était cachée par la barre d'onglets.** *« Le sous le pouce
est caché par le menu du bas. »* Le bouton était bien collé au bas de la
**fenêtre** — et la barre du bas de l'application s'y trouvait déjà, lui
mangeant la moitié. Le geste le plus important de l'écran était à moitié
intouchable : la barre livrée la veille ne servait donc à rien là où il s'en
sert.

Elle réserve désormais la hauteur de la barre, **lue là où elle est écrite**
(`--atlas-barre`, qui porte la barre et la marge de sécurité de l'iPhone). Un
nombre écrit à la main ici vieillirait au premier changement sans que personne
le voie — c'est la faute du 31 août, où « Me déconnecter partout » finissait
dessous pour huit pixels. Rembourrage plutôt que `bottom` décalé : sur `bottom`,
le dégradé remonterait avec le bouton et laisserait une bande de document
défiler entre les deux.

**Ce que ça dit de ma vérification de la veille :** mes captures étaient prises
sur un écran **sans** cette barre. Une mesure juste sur une page qui n'est pas
la sienne ne prouve rien de la sienne.

**b) Le refus « pas de client » l'envoyait où il était déjà.** La feuille disait
*« Ouvrez le devis pour lui donner un nom, puis revenez ici »* — or elle s'ouvre
**depuis** le devis depuis le 20 août. Il devait fermer, reculer deux fois, et
retrouver seul un écran qu'aucun lien n'indiquait. Sa demande : *« un bouton
raccourci vers la fiche client, pour qu'il n'y ait pas besoin de faire retour
deux fois »*.

La phrase porte désormais le lien, et **son adresse vient de la règle qui porte
déjà la flèche du devis** (`src/lib/retour-du-devis.ts`) — deux chemins écrits
séparément vers la fiche client divergeraient. Le chemin se referme tout seul :
la fiche enregistrée ramène au devis.

**C'est le même travers que le refus « à chiffrer » du point 1** : une raison
juste, et pas de geste. Deux fois le même défaut sur le même parcours, à un jour
d'intervalle.

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

**Et une seconde, plus grave, parce qu'elle t'a fait perdre une journée —
corrigée le 5 septembre 2026.**

Le 4 septembre j'ai annoncé : *la barre d'onglets est revenue sur la page du
devis et sur les pages publiques du client*. Je l'avais déduit d'une seule
assertion rouge, **sans regarder l'écran** — alors que mes propres captures du
soir même ne portaient aucune barre. Tu as mesuré page par page sur le serveur,
tu n'as rien trouvé, et c'est allé au journal en « non reproduit ».

**Les deux mesures étaient justes.** Ce qui les séparait, c'est la façon
d'arriver sur la page :

| Le devis ouvert… | La barre |
|---|---|
| à son adresse, ou en rechargeant | **absente** — ta mesure |
| en appuyant sur « Je rédige à la main » | **présente** — la suite, et ta capture iPhone |

La décision vivait dans la mise en page RACINE, que Next.js ne rejoue pas sur
une navigation de lien : la page gardait la barre de l'écran précédent. C'est
elle qui couvrait ton bouton d'envoi.

**Réparé :** la règle est descendue dans `src/lib/ecrans-sans-navigation.ts`,
appelée des deux côtés — au serveur pour ne pas peindre la barre, et par la
barre elle-même, qui suit le chemin courant. La réserve de hauteur du contenu se
retire avec elle. `ARCHITECTURE.md` §258.

**Mesuré, à 390 × 664 :** par le lien, 0 barre, « Choisir la date » à 652 px
d'une fenêtre de 664 — exactement l'écran qu'on obtient à son adresse. Les deux
captures sont superposables.

**Ce que ça apprend, et qui vaut pour la suite :** une suite rouge dit qu'une
mesure a échoué, jamais laquelle des deux — le produit ou la mesure. Ici
c'était le produit ; je n'avais aucun moyen de l'affirmer en l'écrivant, et
« aussi sur les pages publiques du client » était faux. **Et deux mesures qui se
contredisent ne sont pas une erreur à arbitrer : c'est une différence qu'on n'a
pas encore vue.**

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

| Étape | Résultat |
|---|---|
| Types (`tsc --noEmit`) | **vert** |
| Lint | **vert** — 0 erreur, 17 avertissements tous antérieurs |
| Construction (`next build`) | **vert** |
| Mémoire du dépôt | **vert** — 8 fichiers |
| Fournisseurs d'IA | **vert** |
| Suites base de données | **300/310** |
| Données de démonstration | rouge d'abord, **verte après correction de l'adresse** (voir ci-dessous) |
| Suites navigateur | **70/127** |
| Connexion derrière un proxy | **verte** |

### Les 10 rouges des suites base ne sont à personne

`test-boutons-arrondis`, `test-fiche-pendant-relance`, `test-mise-a-jour-role-db`,
`test-mode-emploi`, `test-ouvrir-port`, `test-relance-construction`,
`test-roles-capacites-db`, `test-salarie-planning-lecture-seule-db`,
`test-seed-conserve-identifiants`, `test-verrou-construction`.

Ce sont **exactement** ceux que le dépôt connaît déjà : neuf de machine ou
d'infrastructure, deux venus d'un lot voisin déjà sur `main`. Aucun n'est de ce
lot.

### La batterie ne peut pas être verte sur son poste, et ce n'est aucun lot

Trois étapes tombaient d'un coup : « Données de démonstration » sur
`auth_failed`, puis les suites navigateur et la connexion **faute de jeu de
démonstration**. L'écran de connexion accusait alors le produit — *« un service
d'Atlas ne répond pas »* — pour un mot de passe.

`verifier-avant-livraison.ts` code en dur celui de la CI
(`postgres_ci_pw`) ; le rôle `postgres` de son Docker répond à
`postgres_dev_pw`. **Rejouées avec la bonne adresse, la connexion derrière un
proxy est verte et le seed passe.**

**Le piège de diagnostic, à ne pas retomber dedans :** `docker exec … psql`
accepte les deux mots de passe — l'authentification locale du conteneur est en
confiance. Il faut essayer **depuis l'hôte** pour voir l'échec. Consigné dans
`TODO.md`, avec le remède (rendre l'adresse surchargeable, défaut CI inchangé).

### Les 57 rouges des suites navigateur ne sont pas de ce lot — MESURÉ, pas supposé

70/127 est anormal, et il aurait été malhonnête de l'annoncer sans le vérifier.
Cinq suites tombées ont donc été rejouées **avec** puis **sans** le lot, en
remettant `DevisCompletClient.tsx` dans son état d'avant :

| | `tva-multiple`, `brouillon`, `calcul-prix`, `choisir-la-date`, `adresse-suggestions` |
|---|---|
| avec le lot | **0/5** |
| sans le lot | **0/5** |

Elles tombent à l'identique. Et `test-devis-complet-e2e` échoue sur la **même
assertion, à la même ligne**, avant comme après.

Les suites qui ouvrent l'écran du devis et qui passent le disent aussi :
`test-devis-refus-a-chiffrer-e2e` (neuve), `test-devis-sans-client-e2e`,
`test-devis-a-la-main-e2e`.

**LA CAUSE EST CONNUE DEPUIS, ET ELLE EST CORRIGÉE — 5 septembre 2026.** Elle
vient de la session qui a retiré la fiche du chantier, et elle referme ce point.

L'écran `/chantiers/[id]` a été retiré (`ARCHITECTURE.md` §254). Or **soixante-dix
suites relisaient l'identifiant du chantier DANS L'ADRESSE** —
`page.url().split("/").pop()` et ses variantes. Le navigateur étant désormais
déposé sur `/chantiers/<id>/devis-complet`, elles récupéraient la chaîne
« devis-complet » et la passaient pour un identifiant.

**C'est très exactement le message que j'avais relevé sans savoir l'expliquer** :
`invalid input syntax for type uuid: "devis-complet"`. Aucun typecheck ne peut le
voir — l'expression reste valide, seule sa valeur change.

Redressées par le commit `917616ff`. Mesure de cette session après correction :
**suites base 301/311, suites navigateur 104/128** — contre 70/127 quand j'ai
mesuré.

**Ce que ça confirme de la méthode, et c'est le seul mérite à en tirer :**
rejouer cinq suites tombées **avec** et **sans** le lot (0/5 des deux côtés)
disait déjà que ces rouges n'étaient pas les miens. La cause réelle était
ailleurs, et il aurait été faux de la deviner.

### CE QUE J'AI ANNONCÉ ET QUI EST FAUX : la barre d'onglets

**J'ai écrit que la barre d'onglets était revenue sur la page du devis et sur
les pages publiques du client. C'est faux.**

Je m'appuyais sur `test-devis-complet-e2e`, qui échoue sur cette assertion
(1 au lieu de 0), à l'identique avant et après le lot. Le patron l'a mesuré
**page par page, sur le serveur** : aucune barre sur la page que reçoit son
client, aucune sur le devis seul, et `src/app/layout.tsx` n'a pas bougé depuis
le 31 août. **Non reproduit.**

**La faute n'est pas d'avoir vu la suite rouge — c'est d'en avoir déduit un
défaut du produit sans regarder le produit.** J'avais pourtant l'image sous les
yeux : mes propres captures de l'écran du devis, prises le soir même à
390 × 664, ne portent aucune barre d'onglets. Une suite rouge dit qu'une mesure
a échoué ; elle ne dit jamais laquelle des deux a tort, le produit ou la mesure.

`AGENTS.md` connaît ce piège dans un sens — *« ne pas annoncer une panne
corrigée quand seul le silence l'a été »*. Celui-ci en est le miroir, et il
mérite d'être écrit : **ne pas annoncer une panne trouvée quand seul un contrôle
a parlé.**

### CE QUE J'AI ANNONCÉ ET QUI N'EST DÉJÀ PLUS VRAI : la batterie

J'ai écrit que `verifier:avant-livraison` ne pouvait pas être verte sur son
poste. C'était exact au moment de la mesure ; **ça ne l'est plus.** Une session
voisine a rendu les trois adresses surchargeables — `ATLAS_BASE_APP`,
`ATLAS_BASE_OWNER`, `ATLAS_BASE_SUPER` — sans toucher au défaut de la CI. Chez
lui, la batterie va au bout ainsi :

```bash
export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
npm run verifier:avant-livraison
```

Ce qui reste vrai, et qui a coûté le diagnostic : `docker exec … psql` accepte
les deux mots de passe — l'authentification locale du conteneur est en
confiance. **Il faut essayer depuis l'hôte pour voir l'échec.** Porté dans `TODO.md`.

---

## Ce qui reste ouvert

| Quoi | Qui peut trancher |
|---|---|
| ~~Les 57 suites navigateur rouges~~ | **RÉGLÉ** — l'identifiant du chantier relu dans l'adresse, corrigé par `917616ff` (104/128 après) |
| **Une dernière batterie** — six suites corrigées après la dernière mesure ne sont pas confirmées | à jouer quand le patron dit que le dossier est libre |
| « Atlas prépare toujours votre devis… (96 s) » — jamais reproduit sur un poste de développement | à rendre bavard avant de corriger ; **pas touché ici** |
| Un artisan qui arrive les mains vides n'a jamais été essayé (`docs/A-FAIRE.md`) | ouvert |
| Le tableau et les totaux, encore dans l'écran | un lot suivant, si le besoin se présente |
