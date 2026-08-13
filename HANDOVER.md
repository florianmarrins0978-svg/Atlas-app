# Reprendre le travail

**À lire en premier, dans une nouvelle conversation.** Ce fichier suppose que
vous ne savez rien de ce qui précède — c'est exactement le cas de figure qu'il
sert.

**Point de reprise :** 2026-08-13 · `main`
(l'historique fait foi : `git log --oneline -20`)

---

## Voir la machine du patron sans y avoir accès

**Il n'y a aucun accès, et il ne faut pas en fabriquer un.** La question a été
posée le 12 août 2026 (*« trouve un moyen pour que tu aies accès à mon
espace »*) et tranchée : une boucle qui exécuterait chez lui des ordres lus dans
le dépôt serait une porte dérobée sur une machine portant ses identifiants. Ne
pas la rouvrir en croyant bien faire.

Ce qui existe à la place : **son espace publie son état**, à chaque allumage, sur
une fiche GitHub dont le titre est fixe (`TITRE_FICHE` dans
`scripts/rapporter-espace.mjs`). Elle porte le commit récupéré, le commit
réellement SERVI, l'état des services et la fin du journal de démarrage.

**Si la fiche est introuvable, ne pas conclure qu'il n'a pas redémarré.** Le
12 août 2026 elle est restée vide après deux redémarrages, parce que la
publication passait par `gh` — absent de son conteneur, et impossible à y faire
entrer : tout ce que `devcontainer.json` déclare est posé **à la naissance** de
l'espace, et le sien est plus ancien. Redémarrer récupère le code, jamais les
outils (`ARCHITECTURE.md` §69). La publication passe désormais par l'API avec le
jeton que Codespaces pose dans chaque terminal, donc sans rien à installer — et
`scripts/eprouver-publication-fiche.mjs`, joué en CI, vérifie qu'elle part pour
de bon.

**Devant un « ça ne marche pas », lire cette fiche AVANT de faire taper quoi que
ce soit au patron.** C'est exactement ce qui a coûté quatre allers-retours dans
la nuit du 11 au 12 août : des hypothèses formulées à distance, toutes fausses,
pendant que sa machine savait tout.

Cette phrase-là n'est plus à retenir : `.claude/settings.json` branche
`scripts/rappel-panne.mjs` sur chaque message reçu, et le rappel réapparaît de
lui-même dès qu'il signale une panne — dans cette session comme dans les trois
ou quatre autres qu'il fait tourner en parallèle. Il ajoute du contexte, il ne
bloque rien, et devant le moindre doute il se tait : un rappel qui parle à tort
finit ignoré, et le garde-fou se perd sans bruit.

---

## ⚠ LE PREMIER RÉFLEXE, DEMANDÉ PAR LE PATRON LE 12 AOÛT 2026

**À faire juste après avoir lu la fiche ci-dessus** : la fiche dit dans quel
état est sa machine, la question ci-dessous dit dans quel état est son onglet.
Les deux se lisent avant la moindre hypothèse, et pour la même raison — regarder
coûte une minute, supposer a coûté deux jours.

> *« Retiens ce problème, et la prochaine fois qu'on a un souci, commence par
> regarder si ce n'est pas ça. »*

**Devant tout défaut qu'il signale et qui ne se reproduit pas ici, la PREMIÈRE
question n'est pas « quel écran ? » mais : SA PAGE A-T-ELLE SURVÉCU À SON
SERVEUR ?**

Son banc redémarre plusieurs fois par soirée — mise à jour automatique, bascule
développement / version bâtie, veilleur qui relève un serveur tombé. Son onglet,
lui, reste ouvert des heures. **Tout ce qui a été fabriqué au moment de la
construction et inscrit dans sa page devient alors périmé sous ses doigts.**

Trois défauts en deux jours, trois symptômes sans rapport apparent, **une seule
racine** — et deux jours perdus à les traiter séparément :

| Ce qu'il voit | Ce qui a vieilli | Où c'est écrit |
|---|---|---|
| « Cette page n'a pas pu s'afficher », et « Réessayer » n'y peut rien | les adresses des morceaux de code | `ARCHITECTURE.md` §63 |
| « L'enregistrement n'a pas pu être transmis » | l'identifiant de l'action serveur | `ARCHITECTURE.md` §65 |
| « Atlas prépare le devis… » sans fin, il recharge et le devis est là | rien — la réponse s'est perdue en route | `CHANGELOG.md` 12 août |

**Ce qu'il faut faire, dans cet ordre :**

1. **Lui demander deux choses**, avant toute hypothèse : *depuis combien de
   temps la page était-elle ouverte ?* et *est-ce qu'un rechargement répare ?*
   Si recharger répare, la cause est ici — inutile de chercher ailleurs.
2. **Reproduire sa séquence, pas la nôtre.** Les suites ouvrent une page et
   agissent dans la seconde ; lui laisse passer du temps.
   `npx tsx scripts/eprouver-page-vieillie.mts` fait exactement cela : ouvrir,
   redémarrer le serveur, agir.
3. **Chercher ce qui est fabriqué à la construction** dans le chemin en cause —
   identifiant d'action serveur, nom de fichier de code, réponse attendue d'un
   aller-retour tenu ouvert.

**La règle qui en découle, et qui vaut d'avance :** tout ce qu'on déclenche
depuis un écran où l'on STATIONNE doit passer par une adresse stable (une URL),
et ne jamais dépendre d'une seule réponse tenue ouverte. Voir `ARCHITECTURE.md`
§65.

---

## ⚠ Plusieurs conversations travaillent sur ce dépôt EN MÊME TEMPS

**Dit par le patron le 11 août 2026 :** *« sur d'autres sessions, je demande de
faire d'autres corrections. »* Ce n'est donc pas une hypothèse : `main` bouge
pendant qu'on travaille, et il a bougé de trois commits en une après-midi.

Trois conséquences, à appliquer sans y réfléchir :

1. **Avant de fusionner, ramener `main` chez soi et REJOUER la batterie.**
   Fusionner sans cela livre un mélange que personne n'a éprouvé : chaque côté
   était vert seul, ce qui ne dit rien de leur somme.
2. **Attendre des conflits dans les six fichiers de mémoire, et les garder tous
   les deux.** `ARCHITECTURE.md`, `CHANGELOG.md` et `TODO.md` conflictent à
   chaque fois — les deux sessions écrivent à la suite. Renuméroter sa propre
   section (celle qui est déjà sur `main` garde son numéro) et **corriger les
   renvois « §NN » des autres fichiers**, sinon ils désignent le travail de
   quelqu'un d'autre.
3. **Si deux sessions touchent le même écran, regarder avant de fusionner.**
   Ici, la session voisine a bâti PAR-DESSUS le travail de la fiche chantier,
   pas à la place — mais rien ne le garantissait, et chacune était verte de son
   côté. Deux verts ne font pas un vert.

Ne jamais forcer une poussée : ce serait effacer le travail d'une autre
conversation, sans qu'elle en sache rien.

---

## En trois phrases

Atlas est un agent au service de l'artisan patron : il prépare les devis, les
envoie au client avec une proposition de date, recueille la réponse, planifie le
chantier, construit la facture à la fin et tient le relevé de TVA. Le parcours
complet est décrit dans **`docs/AGENT.md`** — c'est la référence du produit, à
lire avant toute décision de conception. Le socle technique est une application
Next.js avec PostgreSQL, isolée par entreprise via *row level security*.

## ⚠ À RESSORTIR AU PATRON quand le sujet arrive

**Sa consigne du 9 août 2026, à propos de la validation Google :** *« quand on
sera arrivé à la partie commercialisation, je veux que tu me le ressortes
automatiquement parce que je ne vais pas m'en souvenir. »*

Ce bloc est le mécanisme. Il est **en tête de ce fichier**, que `CLAUDE.md` §1
fait lire au début de **chaque** conversation. Ne pas le déplacer plus bas, ne
pas le résumer : il n'a de valeur que s'il est impossible à manquer.

**La règle : dès qu'un des déclencheurs ci-dessous apparaît dans la
conversation, le point correspondant se dit AVANT de répondre au reste.** Le
patron n'a pas à s'en souvenir — c'est le rôle de ce fichier, et sa défaillance
serait une défaillance du dépôt.

| Si le patron parle de… | Lui ressortir |
|---|---|
| **commercialiser, vendre, premiers clients payants, lancement, mise sur le marché, plusieurs artisans** | **La validation de l'application par Google** (`docs/A-FAIRE.md` §8). Sans elle, l'agenda ne fonctionne que pour **une centaine de comptes inscrits à la main** — et le mur arrive d'un coup, sans prévenir. La vérification demande un domaine, une politique de confidentialité **publiée**, une page d'accueil, une vidéo, et **plusieurs semaines**. Le délai ne se rattrape pas : la demande se lance bien avant la date de vente. Détail complet dans `docs/QUESTIONS.md` §12 |

Un point traité ici se **barre** avec sa date plutôt qu'il ne se supprime :
savoir qu'il a été dit évite de le redire, et savoir quand évite de croire qu'il
est encore valable.

---

## Le piège du 12 août : à jour, et pourtant vieux

**Le patron envoie une capture de l'écran de création. C'est celui d'AVANT** —
bouton pleine largeur, lien en capitales, phrase de pied. Tout ce qui a été
livré la veille est invisible chez lui.

**La cause n'est ni son téléphone ni un cache.** `.devcontainer/mettre-a-jour.sh`
récupère **la branche sur laquelle l'espace se trouve déjà** :

```sh
BRANCHE="$(git rev-parse --abbrev-ref HEAD)"
git fetch --quiet origin "$BRANCHE"
```

Le travail était sur `claude/new-session-a1l4v9` ; son espace est ailleurs. La
mise à jour fonctionne donc parfaitement, **et rend « à jour »** — sur une
branche qui ne recevra jamais ce travail. C'est exactement la classe de
malentendus que « Chercher les dernières corrections » existait pour éteindre
(voir l'en-tête de `BoutonMiseAJour.tsx`, trois soirées perdues), revenue par une
autre porte : ce n'est plus le code qui est vieux, c'est la BRANCHE qui n'est pas
la bonne.

**Ce qu'il faut faire avant de livrer quoi que ce soit à essayer :**

1. **Vérifier où est son espace.** Une capture de l'écran Réglages donne la
   version (`versionExecutee`) — mais **pas la branche**. C'est le trou : une
   capture ne peut pas répondre à « suis-je sur la bonne branche ? ». Poser le
   nom de la branche à côté de la version fermerait ce trou définitivement.
2. **Ne jamais dire « c'est livré » sans dire OÙ.** Une branche poussée n'est pas
   une application mise à jour. Tant que le travail n'est pas sur la branche que
   son espace suit, il n'existe pas pour lui.

## Le 12 août : deux défauts sur une seule capture

**« Je ne peux pas envoyer mon devis, ni par SMS ni par mail. »** La feuille
d'envoi affichait *« Stockage local sélectionné en production — configuration
refusée »*. `src/server/storage/index.ts` ne regardait que `NODE_ENV`, alors que
le banc **sert une version bâtie** et que `next start` impose
`NODE_ENV=production` sans rien déployer. La configuration connaissait la
distinction (`bancDEssai`) ; cette barrière-là l'ignorait.

**La leçon, plus large que le correctif :** son commentaire affirmait « le module
d'environnement refuse déjà… », ce qui était FAUX sur le banc. Une barrière qui
se croit redondante et ne l'est plus est invisible — personne ne relit une
duplication supposée fidèle. `CLAUDE.md` §3 : jamais de règle dupliquée.

**« Le bouton, ce n'est pas le même. »** La feuille d'envoi dessinait son bouton
à la main. **Une action principale dessinée sur place échappe à toute décision
d'ensemble.** Avant de dire « le bouton est partout », chercher les boutons
peints à la main :

```sh
grep -rn "backgroundColor: colors.rust" src/app src/components --include="*.tsx"
```

**Et le trou du script de capture :** `capture-bouton-partout.mjs` parcourt des
ADRESSES. Une feuille qui monte sur un geste n'en a pas — elle était donc hors
de son champ, et le compte « dix-sept écrans » ne comptait que ce qu'il savait
atteindre. Les conversions restantes sont listées dans `TODO.md` §0 octies, non
faites d'office : sa règle est *« montre-moi avant de faire »*.

## Tous les boutons sont arrondis (12 août)

Seize boutons dessinés à la main portaient encore un rayon de 4 px. **Seul le
rayon a changé** — deux d'entre eux sont des `type="submit"` (connexion,
documents légaux) et `PrimaryButton` impose `type="button"` : les y faire passer
casserait leur formulaire, en silence.

`scripts/test-boutons-arrondis.ts` garde la forme et nomme le coupable. Il porte
un témoin : un motif devenu aveugle passerait au vert sur une application
entièrement carrée.

**Et une trouvaille, non traitée :** l'écran de connexion est le seul resté dans
l'ancienne identité — terre cuite `#B5502F` écrite en dur, carte blanche, aucune
serif. C'est le premier écran qu'il voit. `TODO.md` §0 nonies.

## La porte est refaite (12 août) — et deux pièges à connaître

`src/app/login/page.tsx` porte ses trois choix : ligne d'imprimé, sceau à la
**rose des vents**, et **le tour** pendant la vérification. `ARCHITECTURE.md` §71.

**Piège A — le serveur de développement n'hydrate pas cet écran, ICI.** Sa
liaison de rechargement à chaud est refusée par le mandataire réseau, le
formulaire part en HTML pur, la page se recharge et **tout champ redevient vide
quel que soit le code**. Quatre correctifs justes ont été déclarés morts pour
cette raison. Avant d'accuser le code : mesurer sur la version BÂTIE
(`npm run banc`), pas sur `next dev`. `test-porte-e2e.ts` compte désormais les
navigations complètes et annonce « non concluant » plutôt que rouge.

**Piège B — React remet le formulaire à zéro APRÈS le rendu qui suit l'action.**
Ni un champ contrôlé, ni un effet, ni `defaultValue` ne font survivre une valeur
à cette remise. Ce qui tient : une `ref` qui met la valeur par défaut à jour
**et** une `key` qui remonte le champ à chaque envoi. Ne pas « simplifier » l'un
des deux.

## Les réglages : le PLAN posé, les rubriques EN ATTENTE (13 août)

`maquettes/atlas-reglages-plan.html` — quatre écrans : les réglages vus par le
**patron**, par le **commercial**, par le **salarié**, et **l'interrupteur**.
Contrôlé par `maquettes/verifier-atlas-reglages-plan.mjs`, branché dans
`npm run verifier:maquette`. **Rien dans `src/`** — sa règle du 11 août.

**Ce que ce lot tranche, et qui vaut pour les neuf rubriques suivantes :** les
deux ensembles « Moi » / « Mon entreprise » ; le fait qu'une rubrique interdite
soit **absente** et non masquée ; et la liste de ce qui n'aura **jamais**
d'interrupteur (mentions légales de la facture, identité de l'émetteur,
numérotation continue, conservation légale).

**Trois choses à ne pas croire acquises :**

1. **Le rôle « commercial » n'existe nulle part** — ni en base
   (`membres_entreprise.role` : `proprietaire` | `membre`), ni dans
   `docs/QUESTIONS.md` §10, qui connaît l'éditeur, le patron et le salarié.
   Il est dessiné pour être tranché.
2. **Le cloisonnement par rôle n'est pas codé.** Ne pas conclure de la maquette
   qu'un salarié ne voit pas les prix : `QUESTIONS.md` §10 exige que la donnée
   ne SORTE pas du serveur, et rien de tel n'est en place aujourd'hui.
3. **Le logo et les conditions réglables n'existent pas.**
   `document-commun.ts` ne pose aucune image ; « 30 jours » est en dur dans
   `devis-pdf.ts`, la mention légale dans `facture-pdf.ts`. Remplacer le devis
   entier par un modèle importé n'est pas possible sans perdre les totaux, la
   TVA et la numérotation — à dire avant de dessiner le lot « Documents ».

**⚠ LE PREMIER JOUR D'UN ARTISAN N'A JAMAIS ÉTÉ VU.** Sa remarque du 13 août :
*« quand l'application sera commercialisée, le devis sera vierge, et c'est avec
ces informations-là qu'il devra se remplir automatiquement ».* Ne pas la sous-
estimer : `seed.ts` pose une entreprise **complète** (« Atelier Démo », SIRET,
IBAN), donc tout ce qui est éprouvé ici et sur son banc part d'un état rempli.
Or **il n'existe aucun parcours d'inscription**, **l'identité ne se saisit que
dans le devis écrit à la main**, et **rien ne la vérifie avant l'envoi**. Le
premier devis d'un vrai artisan partirait sans SIRET ni IBAN, sans un mot. Le
détail des six faits est dans `ARCHITECTURE.md` §81, la liste de travail dans
`TODO.md` §0 quatervicies.

**Lot 2 fait le 13 août : l'identité de l'entreprise**
(`maquettes/atlas-reglages-identite.html`, `ARCHITECTURE.md` §81). Il a révélé
**trois manques qui sont du code, pas du dessin** : le régime de TVA est deviné
d'après le taux appliqué et se trompe dans les deux sens ; le numéro de TVA
intracommunautaire n'existe nulle part ; le téléphone et l'e-mail sont saisis et
ne s'impriment sur aucun document. Ils sont dans `TODO.md` §0 quatervicies.

**Lot 3 fait le 13 août : l'équipe et les rôles**
(`maquettes/atlas-reglages-equipe.html`, `ARCHITECTURE.md` §82). Deux choses à
ne pas rater : **« équipe » désigne déjà une FILE DU PLANNING**, pas un compte —
la rubrique tient donc deux listes séparées ; et **le cloisonnement en lecture
n'existe pas** : `getRole` n'est appelé dans aucun écran, un membre voit tous
les montants.

L'ordre des lots est dans `TODO.md` §0 quatervicies ; le pourquoi dans
`ARCHITECTURE.md` §80, §81 et §82.

**Deux conventions posées le 13 août, qui valent pour toutes les planches à
venir.** Les couleurs sont **recopiées de `src/lib/design-tokens.ts`** et le
contrôle lit ce fichier pour les comparer (les neuf planches antérieures gardent
l'ancien nuancier : elles passeront à la charte quand leur sujet sera rouvert).
Et le gros plan se fait à la **loupe** (`zoom` au-dessus de 1000 px), jamais en
élargissant le téléphone : sinon les libellés tiendraient sur une ligne et les
cibles paraîtraient confortables, sans que ce soit vrai sur son iPhone. La loupe
est éteinte en iPhone 13, ce qui laisse les contrôles mesurer juste — un contrôle
le vérifie, et c'est lui qu'il ne faut pas retirer.

**Et la grammaire est celle des ÉCRANS, relevée dans le code des composants :**
retrait de **26 px** (et non les 24 de `spacing.pageX`, qui est l'ancienne
échelle — seuls `error.tsx`, `loading.tsx` et `Notifications.tsx` y sont
restés), titre de 36 px, **un cheveu qui ferme l'en-tête**, titres de section
**gris précédés d'un trait**, barre basse à 9,5 px / 0,28 em. Et l'écran de la
planche doit mesurer **390 px** : sous 520 px la coque du téléphone s'efface,
sinon il n'en fait que 336 et la barre basse de l'application n'y tient pas —
c'est ce qui avait fait rapetisser sa chasse dans les planches précédentes
(`ARCHITECTURE.md` §80).

**Piège payé sur cette planche :** éprouver qu'un contrôle sait échouer écrit
ses captures dans `maquettes/vues/` comme une exécution normale. La planche a
été relue sur une image produite par la version **cassée**. Relancer le contrôle
sur le fichier sain avant de regarder.

---

## L'écran de connexion : maquette posée, choix EN ATTENTE (12 août)

`docs/maquettes/35-l-ecran-de-connexion.html` — l'avant reproduit, puis quatre
après (la carte gardée, sans carte, le sceau, la ligne d'imprimé). **Ne rien
poser dans `src/app/login/` avant qu'il ait désigné laquelle**, sa règle du
11 août.

**FAIT le 12 août au soir** — ce qui suit est conservé pour la trace du chemin.

**Il a déjà tranché la mise en page, le 12 août au soir :** la **4** (les champs
en ligne d'imprimé), **sans le titre « Connexion » ni la sous-ligne**, avec **le
sceau et ATLAS de la 3** au-dessus. Ce qui reste ouvert est **l'animation de la
marque à l'entrée** — six propositions dans
`docs/maquettes/36-le-logo-qui-sanime.html`, son numéro attendu.

**Puis il a retenu « le tour »** (maquette 36, proposition 3) et demandé
d'autres gravures : `docs/maquettes/37-le-motif-du-sceau.html`, huit motifs,
**son numéro attendu**. Le rond d'or, l'écran et l'animation n'y bougent plus.

**La leçon de la 34, qui vaut pour toute icône de ce dépôt :** un motif se juge
**à sa taille réelle**, jamais agrandi. La bande en tête de cette maquette est
là pour ça, et elle a tué trois propositions — à 29 px avec un trait d'1,5, une
tige et trois ovales se rejoignent en pâté quel que soit l'écartement. Une seule
grande forme tient toujours ; trois petites, jamais.

**Trois choses à ne pas défaire, dans la maquette comme dans l'écran :**

1. **`pointer-events:none` sur `.conn` une fois entré.** Les deux écrans
   occupent la même case de grille ; un écran à `opacity:0` continue
   d'intercepter le doigt, et « Recommencer » ne répondait pas. Invisible sur
   toute capture.
2. **La demi-seconde est un plancher, pas une attente.** Voir `TODO.md`
   §0 nonies : au moment de coder, décider ce que fait l'animation quand le
   serveur tarde. Les six bouclent dans la maquette, exprès.
3. **`scripts/verifier-maquette-logo.mjs` doit rester joué** après toute
   retouche : il éprouve les douze écrans (fichier seul et page unique)
   JavaScript coupé, et il sait échouer.

**Ce qui ne dépend PAS de son choix, et qui part avec n'importe laquelle :**

1. **Les champs passent à 16 px.** Ils sont en 15, et en dessous de 16 **iOS
   agrandit la page dès qu'un champ prend le focus** — le jeton
   `styleChampPlage` existe depuis le 10 août pour cette raison exacte, et cet
   écran ne s'en sert pas. C'est un défaut de son téléphone, pas une préférence.
2. **Le refus passe de `text-red-600` à `colors.alert`.**
3. **La place du message reste réservée** (`min-height`), sinon le bouton
   descend d'une ligne au moment où il appuie dessus.

**Pourquoi cet écran échappe à tout :** c'est le seul vu **avant** d'être
connecté, donc le seul qu'aucun parcours de l'application ne traverse. Le même
raisonnement vaut pour `src/app/documents-legaux/formulaire.tsx`.

## L'agenda iCloud : CODÉ le 12 août — et ce qui reste à éprouver chez lui

**La maquette a été montrée, puis il a tranché :** *« code pour qu'on puisse
lire et écrire dans cet agenda »*. C'est fait — `ARCHITECTURE.md` §75 porte le
détail et le pourquoi.

**⚠ CE QUI N'A JAMAIS PARLÉ À APPLE.** Aucun échange réel avec iCloud n'a eu
lieu : le mandataire réseau d'ici refuse `caldav.icloud.com`. Les trois appels
HTTP de `src/server/agenda/apple.ts` sont donc **non éprouvés**, et tout le
reste — ce qui décide — l'est entièrement (`test-ics.ts`, `test-caldav.ts`,
`test-agenda-apple-base.ts`). **Ne pas lui dire que le raccordement est vérifié
avant qu'il l'ait branché une fois.**

Si ça échoue chez lui, regarder dans cet ordre : la **découverte** (iCloud
redirige vers le serveur du compte, et un `PROPFIND` transformé en `GET` rend
une page au lieu d'un `multistatus`), la **double authentification** (sans elle,
Apple n'émet pas de mot de passe pour les apps, et refuse en 401 comme un mot de
passe faux), puis le **dépôt**. Dans les trois cas, la phrase d'Apple est
affichée telle quelle sur l'écran des réglages : la lire avant de supposer.

**Le contexte, pour ne pas le redécouvrir.** Il a envoyé une capture du
Calendrier d'Apple : *« je peux connecter ce calendrier à mon appli ? »* Le
Calendrier n'étant qu'une **vitrine** — il affiche iCloud comme Gmail —, la
question a été posée avant de répondre. Ses deux réponses : le compte est
**iCloud**, et il veut **les deux sens**. Réponse complète et chiffrée dans
`docs/QUESTIONS.md` §14, chemin de mise en œuvre dans `TODO.md` §0 unvicies.

**Ce qui change tout par rapport à Google** : Apple n'a **aucun** bouton
« accepter » pour l'agenda. Il faut CalDAV et un **mot de passe spécifique à
l'app**, généré sur son compte Apple — et ce mot de passe **ouvre tout
l'iCloud**, mail et fichiers compris, parce qu'Apple ne sait pas le restreindre
à un service. Ce n'est pas un détail à ranger en petits caractères : c'est la
raison pour laquelle l'avertissement est **au-dessus** du champ dans la
maquette, et pourquoi le contrôle le vérifie **par sa position**.

**Trois choses à ne pas défaire dans cette maquette-là :**

1. **L'interrupteur d'écriture reste éteint au départ**, et le choix du
   calendrier n'existe pas tant qu'il l'est. Écrire dans son agenda personnel
   est une décision ; un réglage allumé d'office la lui prend.
2. **Le repli est un calendrier « Atlas » séparé**, pas « Perso ». Ce qu'Atlas a
   posé se retire alors d'un geste au débranchement — semé dans « Perso », il se
   reprend un par un.
3. **Pas de raccourci `font:` avec `inherit`.** `font:400 16px/1.4 inherit` est
   **invalide** et la déclaration entière tombe : les champs repassaient à
   13,3 px (donc le zoom de Safari) et les boutons à 43 px, sous les 44 px du
   doigt. Trouvé par le contrôle, invisible à l'écran. Le même piège dort dans
   les autres maquettes du dossier.

**Un quatrième piège, propre au JSX et trouvé sur une capture :** l'écran
affichait « votre iCloud**—** pas seulement l'agenda ». Le JSX avale l'espace
qui suit une balise fermante à cet endroit — l'écran de Google portait déjà un
`{" "}` pour cette raison, sans que personne l'ait écrit. Quatre phrases du même
écran portaient le piège. **Aucun test de texte ne l'attrape** : le contrôle
vise désormais le texte RENDU (`test-agenda-reglages-e2e.ts`).

**Pour diagnostiquer une suite navigateur sans rejouer la batterie :**
`npm run test:e2e -- --seulement <motif>`. Écrit le 12 août après avoir rejoué
vingt-cinq minutes pour observer UNE suite — c'est ce coût-là qui pousse à
supposer une cause au lieu d'aller la lire. Le script dit à voix haute qu'il
n'est pas la batterie.

## Ce qui vient d'être terminé

**« MONSIEUR MARTINS », ET LE TIRET RETIRÉ (13 août).** Sa capture de l'écran
Devis. Le nom du chantier ne dit plus « Chez … », la ligne du client porte sa
civilité, et le détail passe **sous** le nom au lieu d'être collé par un tiret.

**Quatre choses à savoir avant d'y toucher :**

1. **La civilité vit dans `src/lib/civilite.ts`, et nulle part ailleurs.** Trois
   endroits l'appellent. « Monsieur » est un **défaut, pas une donnée** : il n'y
   a aucun champ de civilité dans la fiche client, donc une cliente sera mal
   nommée. Le vrai remède — un choix à la création — n'a pas été ajouté sans son
   accord. **À lui poser.**
2. **Un invariant a été levé, pas oublié.** `nom-chantier.ts` tenait que chaque
   mot du nom venait de la saisie ; « Monsieur » rompt cette règle, et le patron
   l'a demandé en connaissance de cause. Ne pas la rétablir sans lui.
3. **UNE MIGRATION DE DONNÉES SUR UNE TABLE SOUS RLS NE FAIT RIEN, EN SILENCE.**
   C'est la leçon qui ressert le plus. `chantiers` et `clients` portent la RLS
   en mode **forcé** : le propriétaire y est soumis, et sans `app.entreprise_id`
   posé, `current_setting` rend une chaîne vide, le prédicat vaut NULL et
   **aucune ligne n'est visible**. Le premier `UPDATE` écrit s'est appliqué sans
   erreur, a rapporté un succès, et n'a touché aucune ligne. La migration 0036
   boucle donc sur les entreprises en posant le contexte de chacune — jamais en
   désactivant la RLS. Les migrations d'avant ne modifiaient que
   `termes_metier`, sans RLS forcée : ce cas était neuf.
4. **Un « 1 migration appliquée » ne prouve rien.** Le contrôle rejoue la
   migration et vérifie le résultat. Il a d'abord été un **faux vert** : il
   posait lui-même le contexte pour ses insertions, la migration en héritait, et
   il passait au vert sur la version défaillante. Il efface maintenant le
   contexte avant de jouer la migration.

**Et un rappel que cette journée redonne :** trois suites navigateur recopiaient
« Chez … » au lieu d'appeler la règle. Elles sont passées au rouge le jour où le
mot a changé. Elles appellent maintenant `nomDuChantier` / `avecCivilite`.

Détail complet : `ARCHITECTURE.md` §77.

**SIX BRANCHES RÉUNIES DANS `main` (13 août).** Sa demande : *« Fusionne. »*
`main` porte désormais l'agenda iCloud, l'écran de la facture (SMS **ou**
e-mail, et le téléchargement), le lien cliquable du message au client, et toute
la mémoire qui vivait à côté. Plus aucune branche `claude/*` ne détient de
travail que `main` n'ait pas.

**Trois pièges à connaître avant la prochaine fusion**, tous payés celle-ci :

1. **Deux branches numérotent la même section d'`ARCHITECTURE.md`.** Il y avait
   deux §67 et deux §68. Renuméroter ne suffit pas — **onze renvois** les
   visaient depuis quatre fichiers de mémoire et jusque dans un commentaire de
   suite. Chercher `§NN` dans tout le dépôt après toute renumérotation, et
   trancher renvoi par renvoi : ceux de `main` ne bougent pas.
2. **Le même bloc rangé à deux endroits fait un doublon silencieux**, parce que
   `git` voit deux ajouts et non un déplacement. Avant de « garder les deux
   côtés » d'un conflit de mémoire, vérifier que ce ne sont pas deux
   exemplaires du même texte.
3. **Une mémoire fusionnée peut se contredire.** Ici, `scroll-snap-stop:
   always` était donné pour règle par une branche et **retiré depuis le 11
   août** dans `main` (le patron lisait l'arrêt comme du saccadé) ; et
   `HANDOVER.md` annonçait encore « rien n'est codé » pour une refonte livrée.
   La question n'est pas « lequel garder » mais **« lequel est encore vrai »**.

Batterie entière au vert avant de pousser : types, lint, mémoire, 124/124
suites base, 65/65 suites navigateur, 23 contrôles de maquette, et la connexion
réelle derrière une origine étrangère.

**⚠ LE NOM DU CHANTIER A ÉTÉ CORRIGÉ DEUX FOIS LE MÊME JOUR, PAR DEUX
SESSIONS.** Il l'a demandé aux deux. La version retenue est celle de `main` —
« Monsieur Martins » (`ARCHITECTURE.md` §77, `src/lib/civilite.ts`) — et non la
mienne, qui rendait le nom nu. **Ne pas la « rétablir »** : il a levé la règle
du « rien d'inventé » pour la civilité, en le sachant.

**Ce que la collision a appris, et qui vaut pour toute migration à venir :** un
`UPDATE` de données sans contexte d'entreprise ne voit AUCUNE ligne sous la RLS
forcée. Il s'applique, rapporte un succès, et ne change rien — en silence. Ma
migration faisait exactement cela. Traiter entreprise par entreprise.

**LA LIGNE SOUS LE NOM EST TRANCHÉE ET CODÉE** — le D, avec la date d'envoi
(`ARCHITECTURE.md` §77). Trois choses à ne pas défaire :

- **la date d'envoi ne se devine pas.** Sans envoi enregistré, pas de seconde
  ligne. Le repli tentant — `majAt`, la date affichée à gauche — n'est PAS la
  date d'envoi : une photo ajoutée la déplace ;
- **l'or sur un devis parti est SA décision**, contre la règle d'avant (l'or
  pour ce qui attend un geste de lui). C'était écrit sur la planche qu'il a
  choisie. Si la liste devient trop dorée, `APPELLE_UN_GESTE` se défait sur une
  ligne ;
- **le lieu ne répète jamais le nom.** Défaut né du retrait de « Chez », vu à
  l'œil sur une capture : retirer un mot d'un libellé peut faire entrer deux
  autres en collision.

**Et une règle qui vaut au-delà de ce lot : un libellé se mesure SUR L'ÉCRAN.**
Une maquette HTML rend les mots plus larges qu'Inter dans l'application — la
première planche faisait passer sur deux lignes un libellé qui tient sur une
chez lui, et aurait donc écarté les bons libellés pour une raison fausse.
`scripts/engendrer-maquette-ligne-chantier.mts` joue chaque libellé dans
l'application et le photographie à 430 px (son téléphone) **et** à 390 px. La
largeur de son téléphone fait partie de la décision : le libellé actuel est
déjà à la limite.

**LE CALENDRIER D'ENVOI NE MARQUAIT QU'UN JOUR (12 août).** Il ne pouvait
proposer qu'une date dès qu'il la prenait au calendrier, alors que son client
doit pouvoir choisir entre deux (`ARCHITECTURE.md` §74).

**Deux leçons qui resserviront, et qui ne sont pas propres à cet écran :**

1. **Un état parallèle à la vérité finit toujours par mentir.** L'écran gardait
   la date du calendrier dans une chaîne à part, à côté de la sélection réelle.
   Le symptôme visible n'était pas le pire : rappuyer sur un jour retenu le
   **remettait** au lieu de l'enlever, parce que le geste se comparait à l'état
   parallèle. Devant un écran où « ça ne se désélectionne pas », chercher
   d'abord s'il existe deux états pour une seule chose.
2. **Un parcours à moitié joué ne prouve que la moitié qu'on joue.**
   `test-date-lointaine-e2e` choisissait UNE date au calendrier, et passait.
   Quand un écran offre un maximum — deux dates, trois photos, cinq lignes —
   l'éprouver à un seul exemplaire ne dit rien du second, et c'est au second que
   les états parallèles se révèlent.

**Et la règle des deux dates était écrite en double** : `basculerJour` existait
depuis le 9 août dans `src/lib/calendrier.ts`, pure et éprouvée, sans que
personne s'en serve. L'écran avait sa copie. C'est le §3 de `CLAUDE.md` — devant
une règle métier dans un composant, vérifier d'abord si le dépôt ne la porte pas
déjà.

**⚠ Deux suites voisines ont dû être réparées au passage, et la seconde vaut un
réflexe.** `test-retour-messagerie-e2e` **empruntait** son chantier à une autre
suite (`WHERE reponse IS NULL LIMIT 1`, sans `ORDER BY` ni propriétaire) : il ne
savait pas tourner seul, et ajouter une suite ailleurs a suffi à changer l'ordre
des lignes et à le faire rougir — en accusant le retour de messagerie, qui n'y
était pour rien. **Devant une suite qui rougit sans rapport avec ce qu'on vient
de toucher, regarder d'abord si elle possède ses données ou si elle les
emprunte.** Chacune fabrique désormais les siennes.


**LA FACTURE PART PAR E-MAIL, ET SE TÉLÉCHARGE (12 août).** Deux des trois
manques qu'il avait signalés le 10 août (`TODO.md` §8, `ARCHITECTURE.md` §73).

**Cinq choses à savoir avant d'y toucher :**

1. **Les TROIS manques sont réglés.** Le bouton a pris la capsule le 12 août —
   *« code la A »*, après deux planches (`docs/maquettes/38-…` puis `31-…`, cinq
   gestes qui se pressent). Il passe par `PrimaryButton`, **jamais par un
   dessin recopié sur place** : c'est le défaut qu'on répare, et le repeindre à
   la main le ferait revenir au prochain changement de charte. Deux suites
   mesurent son rayon calculé et rougissent si cela arrive.

   **Les quatre gestes écartés restent dans la maquette 39** — la lueur, le
   cachet, l'encre, le trait. S'il rouvre le sujet, repartir de là plutôt que
   de redessiner. Et se souvenir que **le cachet était la seule proposition qui
   ne reposait pas sur un goût** : c'est le geste de « Nouveau chantier », donc
   un vocabulaire partagé entre deux écrans.

   **⚠ UNE MAQUETTE NE PORTE PAS DE SCRIPT.** La première version de la 31
   engendrait ses cinq téléphones en JavaScript : chez le patron, page vide —
   *« rien apparaît sur ta maquette »*. Elle passait ici, dans un navigateur
   complet ; script coupé, zéro écran. La règle existait déjà pour les
   maquettes 25 et 26 (`scripts/verifier-maquette-bascule.mjs` joue les huit
   bascules JavaScript COUPÉ) et n'a pas été appliquée. **Tout contrôle de
   maquette tourne désormais `javaScriptEnabled: false`** — une case à cocher
   et des règles `:checked ~` suffisent à tout, y compris à une demi-seconde
   d'attente (`transition-delay`).

   **Un piège de MESURE qui a failli faire livrer un geste mort**, et qui
   resservira à chaque maquette animée : `locator.screenshot()` attend que
   l'élément soit **stable**, c'est-à-dire que l'animation soit finie — il
   photographie donc toujours l'après, jamais le pendant. Passer par
   `page.screenshot({ clip })`. Et surtout : **le contrôle de la lueur est
   passé au vert deux fois sur un geste que l'œil ne voyait jamais** (opacité
   et transform étaient irréprochables ; la lumière traversait le bouton en
   quatre-vingts millisecondes). Ce qu'il faut mesurer, c'est **combien de
   temps** une chose est visible, pas qu'elle bouge.
2. **Ce bouton était passé au travers parce qu'il est peint à la main dans
   l'écran** — même cause que la feuille d'envoi du devis (§66). Devant un
   bouton qui « n'est pas le même », chercher d'abord s'il est dessiné sur
   place plutôt qu'issu de `PrimaryButton`.
3. **Le nom du fichier PDF vit à DEUX endroits** — l'attribut `download` du lien
   et l'en-tête du serveur — et rien ne les relie dans le code. Deux suites les
   comparent, et elles ont trouvé l'écart au premier jet : après l'arrêt de la
   facture, sans rechargement, l'écran annonçait un brouillon quand le serveur
   servait la pièce définitive. **Ne pas retirer cette comparaison.**
4. **C'est le serveur qui décide du téléchargement**, pas l'attribut `download`
   du lien : iOS l'ignore selon les versions, et le PDF s'ouvrirait alors dans
   un onglet — le défaut d'origine, déguisé en correctif.
5. **Le point §8 n'était nulle part sur `main`.** Il avait été consigné sur
   `claude/migrate-app-atlas-zz31ac`, restée deux commits derrière, et aucune
   conversation lisant `TODO.md` ne pouvait le voir. Le patron a dû le
   redemander. `CLAUDE.md` §6 vaut aussi pour la mémoire : **une ligne poussée
   sur une branche n'existe pour personne.**

**La carte de réponse mène là où est le geste (12 août).** Le patron : *« si
c'est accepté, ouvrir le devis validé, pas le devis en construction ; si le
client demande une modification, ouvrir le devis pour pouvoir le modifier. »*

**Trois choses à savoir :**

1. **La règle vit dans `src/lib/suite-de-la-reponse.ts`**, pas dans le
   composant : accepté → `devis-complet` figé, tel que le client l'a reçu ;
   **correction → `devis-complet` AUSSI, mais après reprise** (drapeau
   `reprendreAvant`) ; refus et lien périmé → l'écran d'envoi, qui laisse le
   choix. **Ne jamais mener un devis à corriger sur `devis-complet` SANS la
   reprise** : il est immuable une fois parti, et le patron se retrouverait
   devant un document qui refuse sa frappe.
2. **Corrigé le 13 août 2026, par lui :** *« lorsque je clique sur corriger le
   devis, je dois arriver directement sur la page du devis pour pouvoir le
   corriger. »* La veille, la correction passait par l'écran d'envoi, au nom de
   « ne jamais reprendre à sa place ». Le principe reste juste — **mais il ne
   s'appliquait pas ici : c'est LUI qui appuie**, sur un bouton qui annonce
   « Corriger le devis ». Le geste est le sien ; l'en priver lui coûtait un
   écran et un second appui.

   Il vaut toujours ailleurs : un devis **accepté** ne se reprend jamais
   d'office (ce serait remplacer sans le dire le document sur lequel les deux
   se sont mis d'accord), et un **refus** ou un **silence** n'appellent pas
   forcément un nouveau devis — la suite peut être d'abandonner le chantier.
3. **Une acceptation sur une date PROPOSÉE ne fait aucune carte**, et c'est
   voulu (`notificationsPatron`). Seuls un refus, une correction, une
   contre-proposition de date ou un message du client en font une. Un contrôle
   qui l'ignore cherche une carte qui n'existera jamais — vécu le jour même.

**Les pages du CLIENT ne portent plus la navigation du patron (12 août).** Sa
facture affichait « Chantiers · Planning · Terminés · Réglages » au bas de
l'écran de son client.

**Trois choses à savoir :**

1. **Il n'y a jamais eu de fuite** — un appui menait à la page de connexion, et
   le contrôle qui le prouve était vert avant même le correctif. Le dire
   d'emblée si le sujet revient : c'était une gêne d'affichage, pas un défaut de
   confidentialité.
2. **La liste des chemins publics vit dans `src/lib/chemins-publics.ts`, et
   nulle part ailleurs.** Elle était tenue en double — middleware d'un côté,
   mise en page de l'autre — et les deux ont divergé. **Ne pas en recréer une
   seconde** : un écran public ajouté plus tard n'entrerait que dans l'une.
3. **`test-pages-publiques-sans-navigation-e2e.ts` lit cette liste à sa source**
   et rougit si un chemin déclaré n'y est pas éprouvé. Il visite de vrais
   jetons : un jeton inventé rendrait « lien inconnu », et le contrôle serait
   vert sur du vide.
**L'ÉCRAN DU DEVIS PARTI EST CODÉ — « le signet d'or » (12 août).** Il a répondu
« code le 5 ». Un filet d'or pour l'état, le nom du devis et le montant seuls au
centre, « Modifier mon devis » sous le total, et en bas le geste puis les trois
actions en encre. Les lignes de prestations restent AVANT l'envoi et disparaissent
après : ce sont deux écrans, pas un avec des variantes.

**Cinq choses à ne pas défaire** sont listées dans `TODO.md` 0 septdecies — dont
`atlas-ecran` (deux tentatives de hauteur écrite à la main ont débordé de 100 puis
68 px) et l'avertissement de « Modifier mon devis », qui protège un engagement
réel : rouvrir un devis parti n'annule pas l'envoi, le client peut encore accepter
l'ancien prix.

**Ce qui reste ouvert :** le rayon du bouton (4, 8, 12 ou pilule — bande au bas de
la maquette 33). Son choix vaudra pour vingt-sept écrans. Il a demandé la maquette en toutes lettres : *« fabrique-
**⚠ SI LE PATRON MONTRE « An unexpected response was received from the server. »**
Regarder d'abord **quelle version son banc sert**. Si la pile d'appel contient
`.next/dev`, il est sur la version LENTE : chaque écran s'y compile au premier
appel, et le relais de GitHub abandonne au bout d'une minute en rendant sa
propre page d'erreur — le navigateur reçoit du HTML là où il attendait une
réponse. Ce n'est pas un défaut du code, c'est un banc qui n'a pas fini de se
construire. Depuis le 12 août, l'écran Réglages le dit lui-même, et un veilleur
(`src/components/atlas/VeilleReponseServeur.tsx`) pose une phrase française avec
un bouton « Recharger ».

**Ne pas élargir ce veilleur.** Il ne reconnaît que quatre formulations, et il
doit continuer de REFUSER tout le reste : habiller un défaut du code en
« le serveur se prépare » ferait recharger une page qui ne guérira pas, et
masquerait le défaut. `scripts/test-reponse-illisible.ts` tient ce refus.


**⚠ L'ÉCRAN DU DEVIS ATTEND UNE LETTRE — ne rien coder avant (12 août).**
Le CONTENU est arrêté (nom du devis, total, « Modifier mon devis », trois actions
en encre) ; c'est la MISE EN PAGE qui attend un numéro —
`docs/maquettes/26-le-devis-sur-sa-base.html`, cinq propositions. Le détail et les
trois points ouverts sont dans `TODO.md` 0 septdecies. Il a demandé la maquette en toutes lettres : *« fabrique-
moi la maquette et montre-la-moi avant de coder quoi que ce soit »*.

**Et NE PAS chercher une panne d'envoi de devis.** Elle a été signalée puis
démentie par lui le même jour : sa messagerie s'ouvrait bien, l'adresse du
client était fausse. `TODO.md` 0 quindecies bis dit ce qui a été vérifié — CSP,
longueur de l'adresse — pour qu'on ne le refasse pas.

---

### « Y aller » — le chevron doré du planning (12 août 2026)

Au bout de chaque chantier planifié, un chevron doré ouvre une feuille : Plans,
Google Maps, Waze, copier l'adresse, appeler le client. Sans quitter l'écran.

- `src/lib/itineraire.ts` — la règle pure (liens universels, jamais `waze://`).
- `src/components/atlas/FeuilleYAller.tsx` — la feuille, sur `BottomSheet`.
- `src/app/planning/PlanningClient.tsx` — le chevron, et `libelleQuand()` écrit
  une seule fois pour la ligne ET la feuille.
- `src/lib/nom-chantier.ts` — `intituleDuChantier` : ne recolle le client que si
  le nom du chantier ne le porte pas déjà, sans quoi la feuille affiche
  « M. Bernard — Chez M. Bernard ».
- `listerChantiersPourPlanning` remonte `adresseChantier` et `clientTelephone`.
- Contrôles : `scripts/test-itineraire.ts` (10), `scripts/test-y-aller-e2e.ts`
  (9), quatre de plus dans `scripts/test-nom-chantier.ts`, deux cas de plus dans `scripts/test-planning-repo.ts`. Les trois ont été
  confrontés au défaut qu'ils prétendent voir avant d'être retenus.

**Deux choses à savoir avant d'y toucher :**

1. **La case « Toujours celle-là » de la maquette n'est PAS implémentée**, et
   c'est délibéré : mémoriser un choix de GPS sans nulle part où le défaire
   enferme le patron dans une application touchée par erreur. Elle attend son
   interrupteur dans Réglages. Ne pas l'ajouter en croyant combler un oubli.
2. **« Créer la facture » est dans la FEUILLE, plus sur la ligne** — sa
   décision du 12 août, prise en regardant la capture. Le chemin du planning
   vers la facture, ouvert le 8 août parce que l'écran était un cul-de-sac,
   coûte donc un appui de plus. Trois suites le parcourent en entier, et l'une
   vérifie qu'il a bien quitté la ligne : **le remettre là romprait deux
   contrôles**, pas un.

**Une question lui est posée et attend sa réponse :** un chantier sans adresse
n'a plus de chemin pour aller la saisir, la feuille se contentant de dire « à
saisir sur la fiche du chantier ». Faut-il un bouton « Saisir l'adresse » à cet
endroit ? Rien ne sera ajouté sans lui.

---


**⚠ SI LE PATRON DIT « ce n'est toujours pas là » : REGARDER LA BRANCHE
D'ABORD.** C'est le défaut du 11 août au soir, et il coûterait le même
aller-retour à chaque fois. Son espace de travail suit **`main`**, et rien ne
l'en fera sortir : `.devcontainer/mettre-a-jour.sh` fait un
`git merge --ff-only origin/<branche courante>`, à l'allumage **et** derrière le
bouton « Chercher les dernières corrections » de Réglages. **Un travail livré
sur une branche ne lui parviendra jamais**, quelle que soit la date affichée,
quel que soit le nombre de fois qu'il presse le bouton.

Ce soir-là il a dit : *« la modification n'est pas effectuée. Et pourtant, j'ai
la nouvelle dernière mise à jour, celle de dix-neuf heures et quelques. »* Il
avait raison sur les deux points — `main` avait bien bougé à 19 h 37, et le
bouton était ailleurs. **Avant de chercher un défaut dans le code, jouer :**

```bash
git show origin/main:<le fichier> | grep <la marque du travail>
```

La ligne « Version » de Réglages nomme désormais la branche
(`11/08/2026 19:37 · b45cd5d · main`) : une capture suffit à trancher, sans
avoir à le lui demander. Elle ne le disait pas, et c'est ce qui a permis le
malentendu.

**Le bouton « Nouveau chantier » a été fusionné dans `main` le 11 août au soir**,
sur son accord explicite (`6059641`). Il est donc chez lui. Ce qui reste utile
ici, c'est le piège : il resservira au prochain travail livré sur une branche.

**Douze remplaçants au gros bouton, en deux tournées (11 août).** Le patron ne
veut plus de l'aplat vert « Nouveau chantier » au milieu de l'écran Chantiers ;
le reste lui convient. Maquettes 14 et 15 dans `docs/maquettes/`, sur la dalle
réelle (390 × 664). **Rien n'est codé, et rien ne doit l'être avant son choix**
— `TODO.md`, 0 terdecies. Ne pas trancher à sa place : c'est le troisième
arbitrage graphique qu'il garde pour lui.

**La troisième tournée est la sienne** : il a décrit le geste lui-même — une
pastille ronde qui tourne, jette une onde et des éclats, et ouvre la feuille une
demi-seconde plus tard. Maquette 16, la seule des seize **qui se presse** :
`node scripts/verifier-maquette-pastille.mjs` la met à l'épreuve au doigt.

**Où en est son choix, exactement.** Le sceau de papier a d'abord plu, puis a
été écarté : *« le fond blanc me dérange »*. Ce qui tient encore : un objet
rond, à la place de l'aplat, la gerbe et la demi-seconde. Ce qui est ouvert : la
**matière** (maquette 18 — laque, or brossé, cire, encre vivante, ou pas de
disque du tout) et la **façon dont la page arrive** — deux propositions font
grandir le bouton jusqu'à ce qu'il DEVIENNE la page.

**Le bouton « Nouveau chantier » est CODÉ (11 août, au soir).** L'aplat vert a
disparu de `EcranChantiers.tsx` : à sa place, le mot écrit et un anneau d'un
cheveu qui bat tant qu'on ne l'a pas touché ; à l'appui, trois tours, onze
grains d'or, et la feuille 520 ms plus tard. Toutes les mesures viennent de
`docs/maquettes/24-le-bouton-retenu.html` — **les reprendre de là si on y
retouche**, jamais de mémoire.

**Quatre choses à ne pas défaire**, chacune payée par un défaut réel :
l'enfoncement immédiat (140 ms) sans lequel la demi-seconde passe pour une
panne ; l'ignorance du second appui, sans laquelle deux chantiers naissent au
lieu d'un ; le respect de « mouvement réduit », qui ouvre alors tout de suite ;
et le `href` conservé, qui mène à l'écran entier avant l'hydratation.

*Ce qui suit est l'historique du choix, gardé pour ne pas rouvrir ce qui est
clos.*

**LE BOUTON EST ARRÊTÉ, ET CHIFFRÉ — c'est par là qu'on reprend.**
`docs/maquettes/24-le-bouton-retenu.html` : « Nouveau chantier » écrit, le rond
qui bat à sa droite, trois tours et onze grains d'or à l'appui, la feuille une
demi-seconde plus tard. Le tableau au bas de la maquette donne toutes les
mesures. **Rien n'est codé** — c'est la seule chose qui reste (`TODO.md`,
0 terdecies).

*Ce qui suit est l'historique du choix, gardé pour ne pas rouvrir ce qui est
clos.*

**LE BOUTON EST CHOISI, et c'est là qu'il faut reprendre.** C'est **l'anneau
d'un cheveu avec son « + »**, qui doit **tourner à fond puis ouvrir la page**.
Il est **au centre**, à la place de l'ancien aplat vert, avec **un petit trait
de chaque côté qui s'écarte à l'appui**. Quinze déclinaisons attendent son verdict : huit du tour seul (maquette 22 ; la
version en haut à droite est restée dans la 21) et sept qui ajoutent **le mot**
et un **battement d'attente** (maquette 23 — c'est la dernière, et celle qu'il a
décrite pièce par pièce). Deux d'entre elles reprennent **l'anneau de la
note vocale** — c'est la piste la plus solide, parce que c'est la seule qui ne
repose pas sur un goût : les deux écrans partageraient enfin le même
vocabulaire. Rien n'est codé.

**Ce qui précède n'est plus d'actualité, et ne doit pas être ressorti :**

**Où en est le choix au 11 août au soir.** Il a fini par décrire le bouton
lui-même : *« un rond avec un plus, et lorsque j'appuie, une dynamique un peu
style explosion, de débris, avec le rond qui s'agrandit »*. Ce squelette est
acquis — disque plein, « + », gerbe, agrandissement jusqu'à la page, aucun fond
clair. Six gerbes sont à l'essai (maquette 20) ; il ne reste qu'à en désigner
une.

**Quatre refus de suite disent deux choses.** D'abord, décliner un même objet ne
le sauve pas : ce qui a débloqué la conversation à chaque fois, c'est de changer
d'axe — la nature du geste (16), la gravure (17), la matière et l'ouverture
(18), la retenue (19). Ensuite, et c'est la correction la plus utile qu'il ait
faite : *« tu as primé sur l'originalité au détriment de l'élégance »*. Chercher
l'inédit **contre** la tenue est un mauvais échange ; la maquette 19 retire la
gerbe, les matières imitées et les mouvements simultanés, et n'en garde qu'un
seul à la fois.

**Et une règle en est sortie, qui prime sur l'envie d'aider** (`CLAUDE.md`
§3 bis) : une demande d'apparence ou de geste se **dessine** d'abord. La
pastille avait été portée d'un coup dans l'application ; il l'a arrêté net —
*« crée-moi une maquette avant de changer quoi que ce soit »*. Le changement a
été défait, `src/` est intact.

**Ce que la première tournée a appris, et qui resservira :** proposer six
variantes du même geste, ce n'est pas proposer six idées. Il l'a renvoyée d'un
« je ne suis pas encore hyper convaincu ». La seconde change de **nature** à
chaque proposition, et c'est ce qu'il faudra refaire si une troisième est
demandée.

**Le contact du client se saisit dans la feuille d'envoi (11 août, tard).**
`ARCHITECTURE.md` §62. Le patron : *« l'encart qui permet d'envoyer aux clients
par SMS, par e-mail, a disparu. »*

**Trois choses à savoir avant d'y toucher :**

1. **Ne jamais rétablir le renvoi « sur sa fiche ».** L'écran « Informations » a
   quitté le tiroir du chantier le même soir : cette phrase désigne une porte
   qui n'existe plus, et un chantier dicté (client « non renseigné ») ne pouvait
   alors plus jamais partir. La règle vaut pour tout arrêt du parcours : **un
   écran qui refuse d'avancer offre de lever ce qui l'arrête, ou nomme un
   endroit qui existe.** Jamais l'un sans l'autre.
2. **La coordonnée est écrite SUR LE CLIENT**, pas retenue pour cet envoi — même
   information que la fiche portait. Et la feuille **rejoue la préparation**
   après l'enregistrement : l'état vient du serveur, jamais d'un blocage effacé
   à la main.
3. **`devis_absent` reste un arrêt sec, et c'est juste** : aucune saisie ne le
   lève. Ne pas l'aligner sur les deux autres par symétrie.

**« Mon devis » n'attend plus une réponse perdue (12 août).** Le patron :
*« il s'est passé plus de six minutes et j'ai dû recharger la page. »*

**Trois choses à savoir :**

1. **La chaîne n'est PAS lente — c'est mesuré**, 96 ms et 42 ms sans modèle
   raccordé, et chaque appel à un modèle est borné à 30 s. Ce qui durait, c'était
   l'attente d'une réponse qui ne revenait pas. La chaîne journalise désormais sa
   durée et son statut : **regarder le journal avant de la soupçonner.**
2. **Quand la réponse se perd, l'écran interroge `/api/chantiers/<id>/devis-pret`**
   et va au devis dès qu'il existe (`src/lib/attente-devis.ts`). L'attente
   **renonce** au bout de cinq minutes — ne pas retirer cette limite, une attente
   sans fin est le défaut qu'on répare.
3. **Même famille que §63 et §65** : un long aller-retour tenu ouvert est fragile
   par nature. Devant un quatrième symptôme de ce genre, chercher là.

**⚠ LA NOTE VOCALE PART PAR UNE URL, PLUS JAMAIS PAR UNE ACTION SERVEUR
(12 août).** C'est la cause — reproduite, pas supposée — des trois signalements
du patron : *« L'enregistrement n'a pas pu être transmis. »*

Une action serveur porte un **identifiant fabriqué à la construction** et
inscrit dans la page. Son banc se met à jour tout seul ; une page restée ouverte
appelle alors un identifiant disparu, et l'envoi échoue **sans atteindre le
serveur** — donc sans trace, sans refus, avec une phrase qui accuse le réseau.

**La preuve :** `npx tsx scripts/eprouver-page-vieillie.mts` ouvre la fiche,
redémarre le serveur, puis dicte. Code d'avant → `500` et le message du patron
mot pour mot, base vide. Par la route → `200`, note rangée.

**Trois choses à ne pas défaire :**

1. **Ne pas ramener l'enregistrement dans une action serveur.**
   `test-note-vocale-par-url-e2e.ts` rougit si on le fait.
2. **La règle vit dans `src/server/services/note-vocale-entrante.ts`**, partagée
   par l'anneau, l'écran de dictée et l'import. Trois copies divergeraient.
3. **Le raisonnement vaut pour tout envoi de fichier depuis un écran où l'on
   stationne.** Les photos passent encore par une action : si le patron signale
   un jour la même chose sur elles, la cause est écrite ici.
4. **C'est le MÊME phénomène que le §63** — les morceaux de code disparus,
   trouvés le même soir par une session voisine, sans concertation. Deux
   symptômes, une seule cause : **son onglet survit à son serveur.** Devant un
   troisième symptôme du même genre, chercher là, et non dans le réseau ni dans
   le produit.

**Les refus de note vocale disent pourquoi (11 août, tard).** Le patron voyait
*« Impossible d'enregistrer la note pour l'instant. Réessayez. »* sans que
personne puisse savoir ce qui s'était passé.

**Cinq choses à savoir avant d'y toucher :**

1. **Un refus ATTENDU est une valeur de retour, jamais une exception.**
   `enregistrerNoteVocaleAction` rend `{ ok: false, raison }`. Ce n'est pas un
   goût de style : **Next.js remplace en production le message d'une action
   serveur par un identifiant opaque**, et le banc du patron sert une version
   bâtie. Une exception ne lui parvient donc jamais lisible. La documentation du
   cadre le prescrit (`node_modules/next/dist/docs/01-app/01-getting-started/
   10-error-handling.md`). **Ne pas revenir à `throw` pour un refus.**
2. **CORRIGÉ LE 12 AOÛT : les pannes imprévues ne lèvent plus non plus.** La
   veille, elles levaient encore — et le patron a rapporté le lendemain la
   phrase de secours, *« la connexion a été interrompue »*. Le correctif était à
   moitié fait, et la moitié manquante était celle qui se produisait. Toute
   panne rend maintenant une phrase qui **nomme le maillon**
   (`src/lib/panne-note-vocale.ts` : session · cadence · lecture · stockage ·
   base). Le détail technique reste au journal, jamais à l'écran. **Ne pas
   revenir à `throw` ici non plus.**
3. **L'écran ne conclut plus « c'est le réseau », il demande au serveur.**
   `src/lib/diagnostic-liaison.ts` : si le serveur répond, l'appel a échoué pour
   une autre raison — presque toujours une **page vieillie** (l'espace se
   reconstruit, les actions changent d'identifiant, une page déjà ouverte appelle
   une action disparue ; recharger suffit). Accuser le réseau sans avoir demandé,
   c'était envoyer chercher au mauvais endroit.
4. **Le défaut n'a PAS été reproduit ici**, et c'est écrit tel quel. La dictée a
   été rejouée avec un micro simulé en développement, puis sur la version bâtie
   derrière une origine étrangère : elle passe à chaque fois. Ce qui est corrigé,
   c'est le silence, pas la panne. **Demander la phrase exacte plutôt que de
   supposer** — le tableau des phrases est dans `TODO.md` §0.
5. **Un fichier de zéro octet est refusé à l'entrée.** Avant, il descendait
   jusqu'à la base, qui le rejetait, et l'écran affichait la requête SQL
   entière — noms de tables et identifiant d'entreprise compris.

**Le défilement du fil, et la barre grise (11 août, au soir).** Le patron :
*« c'est saccadé »*, *« je ne veux pas voir cette bande grise du tout, je veux
juste que ça slide. »*

**Quatre choses à savoir avant d'y toucher :**

1. **`scroll-snap-stop: always` a été retiré de `.atlas-ligne`, et il ne faut
   pas le remettre sans le patron.** Il avait été posé le 10 août pour qu'un
   geste vif n'avance que d'un chantier ; c'est lui qui bloquait l'élan. Reste
   `proximity` sur le cadre et `center` sur la ligne : la perle se recale à
   l'arrêt, sans arrêter le doigt. L'arbitrage — « un geste = un chantier »
   contre « ça glisse » — a été tranché en faveur du second, dans ses mots.
2. **Le masque en dégradé et l'animation d'opacité sont HORS DE CAUSE, c'est
   mesuré.** `npx tsx scripts/mesurer-fluidite-fil.mts [--sans-masque]
   [--sans-animation] [--sans-accroche]` : les quatre combinaisons donnent 60
   images par seconde, médiane 16,7 ms. Ce sont les deux suspects évidents ; les
   retirer abîmerait l'écran sans rien gagner. **Relancer la mesure avant de les
   accuser à nouveau.**
3. **CONFIRMÉ SUR SON IPHONE, le soir même :** *« la fluidité de l'iPhone, ça
   aussi, ça a été corrigé. »* Le retrait de l'accroche a suffi. La mesure faite
   ici ne portait que sur Chromium sans tête — le navigateur ne produit pas
   l'élan d'un vrai doigt — et ce point restait donc ouvert par honnêteté ; il
   est clos par l'appareil lui-même. **Le `mask-image` est hors de cause, sur le
   vrai téléphone**, et non plus seulement dans une mesure de laboratoire : ne
   pas le déplacer « au cas où ». Le repli reste décrit dans `TODO.md` §0 bis,
   pour une plainte NOUVELLE, pas pour celle-là.
4. **Aucune zone qui défile ne montre sa barre, et un balayage y veille.**
   `test-aucune-barre-de-defilement-e2e.ts` parcourt douze écrans et exige
   `scrollbar-width: none` sur toute zone qui déborde vraiment. Il lit la
   propriété calculée, pas les pixels : ici la barre est en surimpression, elle
   ne prend aucune largeur et n'apparaît jamais sur une capture.

**Le devis coupait le texte, trouvé par ce même balayage (11 août).** Les trois
zones de `devis-complet` estimaient leur hauteur ; elles la **mesurent**
désormais (`ZoneQuiGrandit`, `scrollHeight`). Deux choses à retenir :

1. **La barre grise était le symptôme, la coupure était le défaut.** La masquer
   aurait rendu le balayage vert et la perte de texte silencieuse. C'est
   pourquoi `test-aucun-texte-coupe-e2e.ts` existe : il écrit un texte long pour
   de bon et vérifie qu'il tient dans sa boîte, et rien de caché ne le contente.
2. **Il lui faut un devis NON envoyé en base.** Un devis parti est figé, ses
   zones sont en lecture seule et rien ne s'y écrit — le contrôle le dit et
   rougit plutôt que de passer vert sans avoir rien éprouvé.

**La bascule et la capsule sont EN PLACE sur l'écran de création (11 août, tard).**
Deux mots en serif, un trait d'or qui glisse, un seul bouton dont le libellé se
fond. « Je l'écris » puis le bouton mène directement au devis entier, client déjà
en en-tête. `ARCHITECTURE.md` §64.

**Quatre choses à ne pas défaire :**

1. **Un seul bouton, et c'est tout l'enjeu.** Deux boutons à égalité
   obligeraient tout le monde à trancher avant d'avoir vu le chantier, alors que
   neuf fois sur dix la réponse est « je dicterai ». La bascule existe pour
   garder les deux chemins visibles SANS ajouter ce coût.
2. **La capsule est partout, et c'est tranché** (« partout », 11 août au soir).
   `PrimaryButton` est sur **dix-sept écrans** — 8 du produit, 9 d'erreur via
   `CorpsErreur` — et il n'existe **plus qu'une seule forme** d'action
   principale : la variante « plaque » a été retirée, pas mise de côté. **Ne pas
   se fier à un chiffre écrit dans un commentaire** : celui-ci a annoncé
   « vingt-sept » pendant deux jours sans que rien ne le vérifie, et il a été
   répété au patron. La commande qui recompte est dans l'en-tête de
   `PrimaryButton.tsx`.

   **Sa règle, à respecter pour tout changement qui touche plusieurs écrans :**
   *« montre-moi avant de faire, plutôt que de faire pour revenir en arrière »*.
   `scripts/capture-bouton-partout.mjs` photographie l'action principale sur les
   écrans réels sans rien modifier ; l'« après » s'obtient dans une copie de
   travail qu'on remet ensuite. **Et la planche se cadre à largeur d'écran
   constante** : deux captures de largeurs différentes se remettent à la même
   taille, et la comparaison dit alors l'inverse de la vérité — c'est arrivé.
3. **Le chantier est créé AVANT le devis**, toujours, par la même fonction
   (`creerPuisAller`). C'est ce qui permet au devis de relire le client. Sauter
   la création produirait le devis orphelin qu'il redoutait.
4. **Le repère `data-atlas="action-creation"`** sur le bouton n'est pas
   décoratif : les DEUX libellés vivent dans le bouton, l'un à `opacity:0`, et un
   sélecteur par le texte les trouverait tous les deux.

**Le piège, payé deux fois maintenant :** `innerText` ne connaît pas l'opacité.
Un contrôle qui lit le libellé du bouton par le texte passe au vert **même sur
une bascule morte** — il ne sait pas échouer, donc il ne prouve rien. Lire le
style calculé, et attendre la fin du fondu (260 ms) avant de conclure.

**La phrase de pied de la création est retirée, et six façons de montrer les
deux portes sont proposées (11 août, tard).** Sa demande, capture à l'appui :
*« on ne voit que création de chantier, on ne voit pas devis à la main »*.

- **Retiré** : « Le nom crée la fiche du client. Le reste se corrige ensuite,
  sur le devis. » La ligne subsiste mais ne parle qu'en cas d'erreur — sa place
  reste **réservée** (`min-h-[19px]`), sinon l'apparition d'un message ferait
  sauter la mise en page sous le doigt qui vient d'appuyer.
- **Proposé** : `docs/maquettes/25-les-deux-portes.html`, six mises en page où
  les deux sorties se voient d'un coup. **Il a retenu la n° 4, la bascule**, et
  demandé plus élégant : six déclinaisons de cette seule idée sont dans
  `docs/maquettes/26-la-bascule-affinee.html`, et
  `docs/maquettes/27-banc-dessai-bascule.html` les fait **essayer** (champs où
  l'on tape, bascule, bouton qui mène vraiment à deux écrans différents).
  **Il a retenu la déclinaison 1, le trait qui glisse.** Reste le BOUTON, qu'il
  trouve « trop gros, carré » : huit formes dans
  `docs/maquettes/28-le-bouton.html`, **non tranchées** — voir `TODO.md`
  §0 septies.

  **Deux choses à ne pas oublier de lui dire s'il choisit :** ce bouton est sur
  **vingt-sept écrans** (`PrimaryButton.tsx`), donc le changer ici le change
  partout ; et la proposition 8 **revient sur la décision du 10 août** — le
  rayon droit avait été retenu pour ne pas ressembler à un bouton
  d'application.

  **Le banc n'est PAS dans la page unique, et c'est délibéré** : il navigue
  entre plusieurs écrans et prend tout le téléphone, deux choses qu'une page de
  comparaison ne sait pas accueillir. Ne pas l'ajouter à `MAQUETTES` dans
  `fusionner-maquettes.mjs` en croyant réparer un oubli.

  **Le point fragile du banc, s'il faut y toucher :** le bouton est **deux liens
  superposés**, et seul celui qu'on lit reçoit le doigt. Retirer le
  `pointer-events:none` du lien invisible ferait mener le bouton toujours au même
  écran, **en silence**, pendant que son libellé aurait changé — un contrôle qui
  lit seulement le libellé passerait au vert dessus. Le nôtre appuie pour de bon.

  **Et un défaut de mise en page à ne pas repayer :** `.champ` est un `<label>`,
  donc **inline** — sans `display:block`, ses marges latérales ne s'appliquent
  pas et les champs partent à ras bord du téléphone, pendant que le bouton reste
  en retrait. Invisible sur un écran d'ordinateur, invisible pour tout contrôle,
  visible sur une capture au format de son téléphone.

**Deux choses à ne pas défaire dans cette maquette :**

1. **Aucun script, et c'est éprouvé** — `node scripts/verifier-maquette-bascule.mjs`
   joue les **huit** bascules des maquettes 25 et 26 **JavaScript coupé**, dans
   les fichiers seuls ET dans la page unique, où la fusion réécrit les
   sélecteurs. C'est là que ça casserait sans bruit. Il est générique : il
   cherche les blocs marqués `data-bascule` et les mots marqués `data-mot` —
   une déclinaison de plus est donc éprouvée sans qu'on touche au contrôle, et
   le NOMBRE attendu par fichier y est écrit pour qu'une déclinaison oubliée ne
   passe pas en silence. Il sait échouer : casser la règle `:checked ~` rend
   douze rouges.

   **Et le piège qu'il a coûté :** lire le libellé du bouton juste après le clic
   donne l'état d'AVANT. Pendant la première moitié d'un fondu de 260 ms,
   l'ancien mot est encore au-dessus de 0,5 d'opacité — deux lectures identiques
   d'affilée y sont la norme. Six maquettes justes ont été déclarées rouges pour
   cela. On exige donc une valeur **tenue plus longtemps que la plus longue
   transition**, jamais deux lectures d'affilée.
2. **Le geste unique reste la question de fond.** Deux boutons à égalité
   obligent tout le monde à trancher, alors que neuf fois sur dix la réponse est
   « je dicterai » — c'est ce qui avait fait retenir le lien discret le 11 août
   au matin. Seule la proposition 4 montre les deux **sans** rien demander.

**L'écran d'erreur se relève tout seul d'un morceau de code disparu
(11 août, au soir).** Sa capture de 18 h 02 : `ChunkLoadError`, « Failed to load
chunk », et un bouton « Réessayer » qui ne pouvait pas marcher — `reset()` refait
le même rendu avec les mêmes adresses mortes. `ARCHITECTURE.md` §63.

**Quatre choses à savoir avant d'y toucher :**

1. **La décision est une fonction pure**, `src/lib/reprise-erreur.ts`, et le
   corps commun des dix écrans est `src/components/atlas/CorpsErreur.tsx`. Ne
   pas recopier un `<PrimaryButton onClick={reset}>` dans un `error.tsx` : c'est
   très exactement le défaut réparé, et il reviendrait par là.
2. **Une seule fois par fenêtre de cinq minutes**, et cette borne vaut le
   correctif. Sans elle, une panne qui dure donne un téléphone qui recharge sans
   fin — il n'afficherait alors *jamais* le message qui lui dit quoi faire.
   `sessionStorage` (pas `localStorage`), lecture enveloppée : **Safari en
   navigation privée lève à la simple lecture**, et il n'y a pas d'écran
   d'erreur derrière un écran d'erreur.
3. **On note AVANT de recharger.** Noter après, c'est ne jamais noter : la page
   est déjà partie.
4. **`pb-40` sous le bouton n'est pas de l'espacement.** Mesuré : la bulle de
   l'assistant recouvrait 48 px du bouton dès que le message dépassait deux
   lignes. Un contrôle rougit si la réserve disparaît.

**Et un piège de mesure, qui a d'abord fait passer un contrôle pour rien :**
Playwright émet `framenavigated` sur les navigations `pushState` du routeur,
sans qu'aucune page n'ait rechargé. **C'est la requête de DOCUMENT qui signe un
rechargement**, et elle seule.

**« Terminés » et la facturation (10 août, au soir).** L'écran est un fil par
mois ; l'encart « à facturer » vit dans le mois et se déplie d'un appui.
`ARCHITECTURE.md` §53.

**Trois choses à savoir avant d'y toucher :**

1. **« Créer la facture » a remplacé « Fin de chantier »** partout — décision du
   patron du 10 août. Le geste n'a pas changé : il bâtit la facture à partir du
   devis, et **n'envoie rien**. Créer n'est pas envoyer, et ça ne se plie pas.
2. **À zéro chantier en attente, la chaîne « à facturer » ne doit apparaître
   nulle part.** Un contrôle de capture échoue si elle revient.
3. **Un montant inconnu n'est pas zéro.** Un chantier sans devis chiffré affiche
   « — », et l'encart tait son total plutôt que d'annoncer « 0,00 € ».

**Le planning au mois et les équipes nommées (10 août, au soir).** Le planning
est un calendrier de sept colonnes ; toucher un jour ouvre sa journée dessous,
avec une ligne par équipe. Réglages laisse nommer les équipes.
`ARCHITECTURE.md` §51 et §52.

**Quatre choses à savoir avant d'y toucher :**

1. **À UNE seule équipe, le mot « équipe » ne s'écrit nulle part** — ni au
   planning, ni dans une phrase d'explication, et Réglages ne propose aucun
   champ. C'est la demande du patron, pas un détail d'affichage. Un contrôle de
   capture échoue si la chaîne « quipe » réapparaît.
2. **Le repli « Équipe A » est un AFFICHAGE.** `equipes.nom` est nullable et n'a
   aucune valeur par défaut ; `libelleEquipe` (`src/lib/equipes.ts`) est la
   seule à décider, pour l'écran comme pour le serveur.
3. **`entreprises.nombre_equipes` fait autorité sur le nombre** ; la table ne
   porte que des noms. Une ligne survit au-delà du compteur, à dessein :
   redescendre puis remonter ne doit pas perdre un nom saisi à la main.
4. **La grille se cale sur LUNDI** — `(getUTCDay() + 6) % 7`. Le 1er août 2026
   est un samedi : un calage sur dimanche fait glisser tout le mois d'un jour,
   sans qu'aucun chiffre ne manque.

**L'anneau de la dictée est au centre de la fiche, dès l'arrivée (11 août).**
Demandé par le patron. Sans note il est un micro (un appui dicte, un second
enregistre) ; avec, il redevient le lecteur. Le magnétophone est partagé
(`src/app/chantiers/[id]/magnetophone.ts`) — ne pas le recopier dans un
troisième écran.

**Avant de raisonner sur l'espace du patron, le regarder :
`npm run diagnostiquer:espace`.** Il rend la branche suivie, le code récupéré,
**le code réellement servi**, l'état du serveur et du veilleur. Deux hypothèses
ont été avancées à distance le 11 août pour expliquer un « ça ne marche pas », et
les deux étaient fausses — chacune lui a coûté un aller-retour. Cette commande
existe pour que la troisième ne le soit pas.

**La version bâtie ne se recompile JAMAIS (11 août, soir).** `next start` sert
un dossier figé : tirer du code sous ses pieds n'y change rien. Le bouton
« Chercher les dernières corrections » promettait une recompilation impossible,
et le patron a passé une soirée à recharger un écran qui ne pouvait pas changer.

La règle est dans `src/lib/issue-mise-a-jour.ts`, en fonction pure. **Ne jamais
la ramener à un message unique** : les trois cas sont distincts, et le troisième
— version bâtie *sans veilleur* — doit rester sans coupure, sous peine
d'éteindre l'application du patron sans personne pour la relever.

**Pour savoir si un espace a vraiment pris le code :** le démarrage affiche
`⚠ MISE À JOUR impossible : <raison>`. Les causes les plus fréquentes sont un
dépôt sale et une branche qui n'est pas celle qu'on pousse.

**« Mon devis » sous l'anneau enchaîne tout jusqu'au devis (11 août, soir).**
Cinq choses à savoir avant d'y toucher :

- **La chaîne lance la transcription elle-même** (`devis-depuis-dictee.ts`,
  étape 1). C'était le maillon manquant ; le retirer renverrait ce geste sur
  l'écran Transcription, à quatre écrans de la dictée.
- **`variante="anneau"` de `DevisDepuisDictee`** — l'écriture nue, en OR et non
  en vert pin. Dérogation assumée à la charte : en vert elle faisait un second
  centre à côté de l'anneau.
- **Informations, Prix et Devis ont quitté le tiroir**, mais **leurs écrans
  répondent toujours** à leur adresse. Un contrôle l'exige.
- **Le bandeau du tiroir se tait dès qu'une note existe** : l'étape suivante
  calculée vaut souvent l'une des lignes retirées, et l'annoncer enverrait
  chercher une porte condamnée.
- **Sans service de transcription raccordé, le geste s'arrête en le disant.**
  C'est l'état réel de l'application, pas un défaut — et c'est éprouvé.

**Le devis à la main s'ouvre aussi depuis l'écran de création (11 août, soir).**
`creerPuisAller("fiche" | "devis")` — **une seule fonction de création**, deux
destinations. Le chantier est créé d'abord : c'est ce qui permet à
`devis-complet` de relire le client. Deux fonctions auraient divergé au premier
champ ajouté.

Trois choses à savoir avant d'y toucher :

- **La porte du tiroir reste**, et ce n'est pas un doublon : deux *moments*, pas
  deux chemins (« je sais déjà » vs « finalement je l'écris »).
- **Sans nom de client, aucune fiche client n'est créée**, et le devis n'offre
  pas d'en rattacher un. **Ce n'est plus écrit nulle part à l'écran** depuis le
  11 août au soir : le patron a fait retirer la phrase de pied qui le disait
  (« Le nom crée la fiche du client… »), l'écran étant plus net sans elle. Le cas
  reste vrai ; s'il devait un jour se voir, c'est **sur l'écran du devis** qu'il
  faudrait le dire — pas en remettant une phrase permanente sur la création.
- **La réserve de bas d'écran (`pb-40`) ne vaut qu'en page.** En feuille, celle-ci
  est `fixed` en `z-[50]` et recouvre déjà la bulle : y ajouter la même réserve
  ne protège de rien et laisse quatre-vingts pixels de vide.

**La pellicule ajoute sur place, et l'écran Photos a été supprimé (11 août,
soir).** Le « + » du tiroir n'est plus un lien : il ouvre le menu du téléphone,
sur la fiche. `src/app/chantiers/[id]/Pellicule.tsx`, `ARCHITECTURE.md` §60.
Quatre choses à savoir avant d'y toucher :

- **Aucun champ de fichier ne doit porter `capture`.** Sur un iPhone, il impose
  l'appareil photo, retire l'accès à la photothèque, et le menu à trois entrées
  — celui que le patron a photographié — n'apparaît jamais. Une suite compte les
  champs et refuse `capture` : c'est le seul garde-fou, aucune machine de test
  ne rendra ce menu.
- **La visionneuse sort par un portail, et il le faut.** Le tiroir porte un
  `z-index` : rendue dedans, elle passe **sous** la barre de navigation, qui se
  peint en travers de la photo.
- **Le tiroir mesure sa hauteur par `ResizeObserver`.** La pellicule ne passe
  plus par ses propriétés : une liste de dépendances ne verrait plus rien, et le
  tiroir des retirés resterait derrière le bord, « Annuler » hors d'atteinte.
- **`/chantiers/[id]/photos` n'existe plus** (404, vérifié). Les liens de
  `chantier-etat.ts` pointent désormais sur la fiche elle-même.

**Le corps de la fiche ne porte QUE l'anneau (11 août, après-midi).** Sa
maquette (`maquettes/atlas-note-vocale.html`) ne montre aucun bouton, et il l'a
redemandé deux fois : *« exactement, respecte strictement ma maquette »*. Ce
qu'il faut savoir avant d'y toucher :

- **L'étape suivante vit désormais dans le bandeau du tiroir**, et la rédaction
  à la main dans sa liste. Vider le corps sans les descendre a fait tomber six
  suites d'un coup — c'étaient deux demandes à lui, des 3 et 4 août.
  `getSecondarySteps` est donc appelé **sans** `nextAction.key` : l'exclure
  ferait disparaître l'étape suivante de l'application entière.
- **`EnTeteEcran` a trois réglages facultatifs** (`precisionPlacee`, `cheveu`,
  `actionPlacee`), employés par cette seule fiche. Leurs valeurs par défaut
  gardent la grammaire commune du 10 août : ne pas les inverser.

**L'écran des suites vit à UN endroit : `ECRAN_DU_PATRON`, dans
`scripts/e2e-browser.ts`** (11 août, après-midi). Ne pas réécrire de
`viewport: { width: 393, height: 852 }` dans une suite : c'était la dalle d'un
iPhone 14, pas la place réelle d'une page (390 × **664**, barre du navigateur
déduite), et ces 190 px de trop ont laissé passer un lien recouvert chez lui.
Une suite qui a VRAIMENT besoin d'un autre cadre en passe un explicitement — il
est alors conservé, et c'est un choix visible dans son code.

**Le cadre honnête n'a révélé aucun défaut caché** : 46/47, l'unique rouge étant
un dépassement de délai du serveur de développement (la suite rejouée seule
passe). Ce n'est pas une déception, c'est un résultat.

**`scripts/test-rien-de-recouvert-e2e.ts` cherche, sur quatorze écrans, ce qui
est hors d'atteinte du doigt.** Avant d'y toucher, savoir que trois précautions
y sont *indispensables*, chacune payée par une volée de fausses accusations :
on amène la cible au centre avant de juger (sinon tout ce qui est sous la barre
du bas est accusé à tort), on écarte ce qu'un parent **rogne** (l'encart « à
facturer » replié garde ses liens dans la page), et on écarte la parenté
directe. Les retirer rendrait cette suite bruyante, donc ignorée.

**Le seed conserve les identifiants Google (11 août, matin).** `agendas_externes`
porte `entreprise_id … ON DELETE CASCADE` : le `TRUNCATE … entreprises` du seed
emportait ce que le patron avait tapé à la main. On garde les **identifiants**
(il est allé les créer chez Google), pas les **jetons** (l'accord valait pour
l'entreprise disparue) — sinon l'écran annoncerait un raccordement qui ne vaut
plus. Attention en y touchant : la RLS est en `FORCE`, il faut POSER
`app.entreprise_id` pour lire, sinon la conservation ne conserve rien **en
silence** — c'est arrivé au premier jet, contrôle au vert compris.

**Le banc attend la VIE DU SERVEUR, pas une montre (11 août, nuit).** Il
concluait « l'application n'a pas répondu après trois minutes — cause la plus
fréquente : la base n'est pas montée » … trois secondes avant qu'elle réponde,
et la base allait bien. Sur ce disque, une compaction de cache prend quinze
secondes. **Ne jamais remettre de délai fixe ni d'accusation par défaut** : un
contrôle échoue si « base de données » revient dans ce message.

**Le banc déloge un orphelin au démarrage (11 août, nuit).** Un `next-server`
d'une exécution précédente tenait le port et faisait échouer le démarrage avant
tout. Distinction à ne pas casser : *quelque chose répond à la santé* = Atlas
sert, on n'y touche pas ; *port pris et rien ne répond* = orphelin, délogé.

**Le serveur du banc est DÉTACHÉ, et c'est son groupe qu'on tue (11 août, nuit).**
La vraie cause des quatre `EADDRINUSE` : `npx next dev` est une pile
d'enveloppes, et `next-server` **survit à la mort de son père**. Tuer l'enfant
ne libère pas le port ; `pkill -f` visait un motif, pas des processus — ça
marchait ici et pas chez lui. `detached: true` + `process.kill(-pid)` emporte
tout le groupe. **Ne jamais retirer l'un sans l'autre** : détaché sans mort du
groupe, chaque Ctrl+C laisserait un orphelin sur le port — ce qui empoisonnait
justement chacune de ses tentatives suivantes.

**La bascule déloge d'abord, vérifie ensuite, réessaie — et ne meurt plus
(10 août, très tard).** `serveur.kill()` ne tue que l'enveloppe `npx` : le
processus qui écoute se renomme `next-server` et lui survit. Le `pkill` était
appelé en dernier recours ; il est maintenant le **premier geste, sans
condition**. Et si la reprise du port échoue malgré tout, le banc **relance un
serveur de développement** au lieu de mourir : un banc lent reste un banc.

**Le remède de la session fantôme a tourné en rond (10 août, très tard).** Deux
causes, dont la première invisible à `curl` :

1. **`__Secure-` / `__Host-` exigent l'attribut `Secure`** — sans lui le
   NAVIGATEUR jette le Set-Cookie, en silence. Derrière le relais (HTTPS), c'est
   ce nom-là qui porte la session : l'effacement échouait, le fantôme survivait.
   L'attribut suit le NOM, jamais une supposition d'environnement — le poser sur
   un nom sans préfixe le rendrait inopérant en clair.
2. **`/login` ne doit JAMAIS être soumis au contrôle du compte** : c'est ce qui
   transformait la panne en boucle infinie.

Et `portRendu` posait la mauvaise question : la santé, au lieu du port. Un
serveur tué cesse de répondre bien avant de rendre sa socket — d'où le retour
d'« EADDRINUSE ». Il essaie maintenant d'écouter sur le port.

**La construction mourait en rendant la main (10 août, tard).**
« setRawMode EIO » puis « Segmentation fault », APRÈS un « Compiled
successfully ». Next.js prend le contrôle du terminal quand son entrée en est
un ; dans un espace distant ce terminal peut disparaître sous lui. **Aucun
enfant du banc ne reçoit plus d'entrée** (`["ignore","inherit","inherit"]`) —
la sortie reste héritée, et Ctrl+C marche toujours, il passe par le groupe de
processus. Ne pas remettre `stdio: "inherit"` : un contrôle échoue.

**Deux bancs se tuaient l'un l'autre — « EADDRINUSE », errno -98 (10 août, tard).**
Le veilleur ne pouvait pas distinguer une BASCULE d'une MORT : pendant que
`banc.mjs` remplace son serveur, la santé se tait et aucun `next` ne tourne —
ses deux conditions de relance, mot pour mot. Il lançait un second banc, qui
prenait le port. Et rien n'empêchait le patron d'en lancer un troisième à la
main. Deux gardes désormais :

- `.devcontainer/bascule-en-cours.sh` — un drapeau, **qui expire en 3 min**.
  Ne jamais le rendre permanent : un banc tué rendrait le veilleur muet pour
  toujours, et le 404 du 9 août reviendrait sans que rien ne l'y relie.
- `scripts/verrou-banc.mjs` — un seul banc à la fois, **par identifiant de
  processus** et non par simple drapeau, pour la même raison.

Regarder le PORT ne suffit pas : pendant sa construction, un banc n'y répond pas
encore. C'est l'existence d'un autre banc qu'il faut voir.
`scripts/test-bascule-veilleur.ts`, douze contrôles.

**L'annonce n'affirme plus que l'adresse est joignable (10 août, tard).** Elle
écrivait « Ouvrable depuis un téléphone, telle quelle » alors que le port était
privé : le terminal affirmait le contraire de ce que le patron voyait. Ce module
ne peut pas le savoir — seul `diagnostiquer-banc.mjs` interroge l'adresse du
dehors. **Règle : ne rien affirmer qu'on n'a pas vérifié ; décrire la panne et
sa sortie.** Un contrôle échoue si la promesse revient.

**`npm run essai` dit maintenant qu'il est l'atelier (10 août, tard).** Le patron
l'a lancé sur son espace et a attendu plus de trois minutes sur la plus petite
route du dépôt : `next dev` compile chaque écran à l'ouverture, et le disque
d'un espace distant est lent. **Troisième fois** que cette lenteur coûte une
soirée, alors que `npm run banc` existe pour ça depuis deux fois. La règle qui
en sort : **une commande qui laisse prendre le mauvais chemin sans un mot vaut
un défaut.** Texte dans `scripts/annonce-atelier.mjs` (pas enfoui dans
`essai.mjs` : un message enfoui n'est jamais vu échouer), tenu par
`test-annonce-atelier.ts`. Il se tait en local, où l'atelier est le bon outil.

**Le port du banc, ouvert à chaque allumage (10 août, tard).** Le diagnostic du
patron a rapporté une page de connexion **GitHub** à la place d'Atlas :
`devcontainer.json` déclare le port public depuis le 6 août, mais ce fichier
n'est appliqué **qu'à la création** de l'espace, et le sien est plus ancien.
Troisième fois que ce piège coûte une soirée — le même qu'`ATLAS_BANC_ESSAI`
dans `docker-compose.yml`. **Une déclaration ne répare pas un espace déjà né :
tout correctif d'environnement doit être rejoué à chaque allumage**, dans
`.devcontainer/demarrer.sh`, qui descend avec le code. Fait par
`ouvrir-port.sh`, tenu par `scripts/test-ouvrir-port.ts` avec un faux `gh` —
`gh` n'existe pas dans l'espace de l'agent, et un contrôle qu'on ne peut pas
jouer ne prouve rien.

**Et attention au remède qu'on indique :** `gh` n'existe PAS dans ce conteneur
(image `typescript-node:22`), contrairement à l'image Codespaces par défaut. Le
premier message renvoyait vers `gh …` et le patron a reçu « command not found ».
Partout, c'est l'onglet **PORTS** de l'éditeur qui passe devant.

**La session fantôme, close et tenue par un test (10 août, tard).** Le remède
posé plus tôt dans la soirée fonctionnait sur le papier et **pas dans un
navigateur** : le contrôle écrit pour le tenir a trouvé trois défauts d'affilée.
Le détail est dans `CHANGELOG.md` du 2026-08-10 ; ce qui compte pour la suite du
travail, en trois points qui ne concernent pas que ce coin du code :

1. **Une redirection lancée depuis une PAGE ne peut pas être un 307.** Elle rend
   sous la frontière de `src/app/loading.tsx`, où l'enveloppe HTML est déjà
   partie : Next.js répond **200**, et le renvoi est joué en JavaScript. Vu à
   l'essai — 23 ko de page, `NEXT_REDIRECT` enfoui dans la charge React, pendant
   que le contrôle passait au vert. **Un contrôle d'accès qui doit valoir sans
   JavaScript vit dans le layout**, jamais dans la page.
2. **`NextResponse.redirect` renvoie vers l'adresse d'ÉCOUTE.** Elle fabrique une
   adresse absolue depuis `request.url`, soit `http://0.0.0.0:3000/…`. Derrière
   le relais du patron, elle ne mène nulle part — le remède l'aurait laissé
   devant une page blanche, comme le défaut. **Renvoyer relatif.**
3. **`no-undef` était éteint sur tout le JavaScript du dépôt.** `banc.mjs` lisait
   une variable `bati` qui n'existait pas : types verts, lint vert, et le banc
   mourait **après la construction**, une fois annoncé prêt. La règle est
   activée, avec les globales lues sur Node lui-même.

**Et un piège d'environnement, pas de code :** Redis démarré depuis un dossier
qui a ensuite disparu refuse toute écriture (`MISCONF … unable to persist`), et
sept suites échouent alors en accusant la taille des fichiers ou l'IA. Le
démarrer avec `--dir` sur un dossier stable.

**L'anneau muet et la pellicule, sur la fiche chantier (10 août, au soir).** La
ligne « Note vocale » devient un anneau qu'on touche pour écouter et qu'on
pousse vers le haut pour retirer ; les photos deviennent une pellicule dans le
tiroir du bas, case « + » en tête. `ARCHITECTURE.md` §49.

**Cinq choses à savoir avant d'y toucher :**

1. **Le compteur et l'onde sont réels**, pas décoratifs : `currentTime` pour
   l'un, un `AnalyserNode` sur l'élément audio pour l'autre. Le contexte audio
   naît **suspendu** et se rendort en arrière-plan — `resume()` à chaque appui,
   sinon l'onde mesure un silence qu'on a soi-même créé en intercalant
   l'analyseur.
2. **`display: flex` n'étire pas un `<button>`.** La maquette pose un
   `<label>` ; « Retirer » se retrouvait collé au bord gauche, **visible,
   touchable, et tous les contrôles au vert**. `width: 100%` est obligatoire ici.
3. **`--atlas-barre` est une réserve de place (68 px), pas la hauteur que la
   barre dessine (49 px).** Le tiroir mesure donc la barre réelle. Ne pas
   « corriger » la variable : cela déplacerait le cheveu du bandeau sur tous les
   écrans, dont l'accueil, que le patron a arrêté.
4. **Le jeu de démonstration contient de vrais fichiers** depuis ce lot (PNG et
   WAV fabriqués dans `seed.ts`). Avant, il déclarait des clés sans octets
   derrière : l'anneau restait inerte sans rien dire.
5. **Les cinq états se capturent en une commande** :
   `npx tsx scripts/capture-fiche-note-vocale.mts <dossier> <id-chantier>`.

**Le retrait est le même partout (10 août, au soir).** Le texte glisse vers la
gauche, « Retirer » se découvre, la ligne tombe, un tiroir la retient :
« Retiré à l'instant — Annuler ». Huit endroits, une seule mécanique là où il
y en avait trois.

**Quatre choses à savoir avant d'y toucher — les trois premières sont des
promesses, pas des détails :**

1. **Rien n'est écrit tant que le tiroir est ouvert.** La photo et la note
   vocale mettent leur fichier en file de purge dans la MÊME transaction que la
   suppression : appeler le serveur au moment du geste rendrait « Annuler »
   menteur — la ligne reviendrait, le fichier non. `useRetraits` masque la
   ligne et n'écrit qu'à la fermeture (minuteur, `pagehide`, démontage).
2. **Le fond ne glisse jamais.** Seule la colonne du texte bouge ; la date, le
   fil et la plage restent en place (`avant`, `plage`). Laisser la carte partir
   avec son fond la tire hors de l'écran, bordure tranchée — vu en capture sur
   le planning et les tarifs.
3. **« Annuler » vise le DERNIER retrait.** Un libellé unique pointant toujours
   la même ligne rendrait la première quand on retire la deuxième :
   l'annulation supprimerait.
4. **Les photos ne prennent pas le glissement**, et ce n'est pas un oubli : une
   vignette carrée n'est pas une ligne. Elles gardent le reste du geste et se
   retirent depuis la visionneuse.

**Et le piège qui a coûté une heure, sur du code juste :** une capture qui vise
`127.0.0.1` obtient une page **jamais hydratée** — Next refuse d'y servir ses
ressources de développement. Les boutons existent sans écouteur, on clique dans
le vide, et tout accuse l'écran. **Viser `localhost`.**

**Les corps d'Informations et de Prix sont refaits (10 août) — étape 2 de
`TODO.md` §7.** Reste l'étape 3 : Devis, Export, Facture.

**Avant de reprendre la refonte, quatre choses qui font gagner une heure :**

1. **Les deux voix sont des jetons**, plus des valeurs à retaper :
   `libelleCaps` et `texteSituation` dans `src/lib/design-tokens.ts`.
   `smallCaps` est l'ANCIENNE voix — un écran qui l'importe encore n'est pas
   refait, et elle ne survit que pour les maquettes `/design/*`.
2. **`innerText` rend le texte tel qu'il s'affiche.** Trois contrôles
   cherchaient « Prix Calculé » ou « Déjà au détail » et sont devenus rouges le
   jour où ces libellés sont passés en capitales — sans qu'aucun défaut
   n'existe. Deux l'étaient déjà avant ce lot. Avant de corriger le produit,
   regarder si le contrôle lit du **rendu** ou de la **donnée**.
3. **Prendre la capture, en haut ET en bas :**
   `npx tsx scripts/capture-etape.mts <dossier> <chantierId> <étape…>`.
   Les deux seuls défauts réels de ce lot n'étaient visibles que là : la croix
   qui retire une ligne de prix **sortait de l'écran** (elle existait dans la
   page, donc les contrôles la trouvaient), et la bulle de l'assistant mordait
   sur « Préparer le devis ».
4. **Le jeu de démonstration ne pose aucun brouillon**, et sa dictée ne
   s'analyse pas ici : pour regarder l'écran Informations plein, insérer soi-même
   une ligne dans `brouillons_informations`. Sinon on juge un écran vide.

**Les maquettes tiennent sur une seule page (9 août, tard).**
`docs/maquettes/toutes-les-maquettes.html` porte toutes les propositions et un
sommaire à ancres. **Ne pas la modifier à la main** : elle est engendrée par
`node scripts/fusionner-maquettes.mjs` à partir des fichiers numérotés voisins,
qui restent la source — une maquette neuve s'ajoute à la liste `MAQUETTES` du
script, et ses identifiants de gabarit à `IDS_A_PREFIXER`. Après toute
retouche, régénérer puis jouer `node scripts/verifier-maquettes-page-unique.mjs`
— il clique chaque titre dans un navigateur.

**Et surtout : ne pas repartager un sommaire de liens externes.** Une page
publiée s'exécute confinée et ne peut naviguer nulle part ; le patron a cliqué
huit fois dans le vide avant qu'on s'en aperçoive. Et lui envoyer les
**fichiers** plutôt que des adresses : un artefact lui demande de se connecter,
un fichier ne demande rien à personne.

**L'écran des chantiers est celui qu'il a retenu (10 août 2026) — c'est fait.**
Le fil, la perle, le trait d'or qui glisse, la feuille qui monte. **Avant d'y
toucher, lire l'en-tête de `src/app/EcranChantiers.tsx`** : il liste les trois
choses qu'il a explicitement refusées, et les remettre reviendrait à défaire ce
qu'il a validé.

**La perle se tient à mi-hauteur du fil, et descend sur le dernier jour quand on
arrive au bout.** Elle ne désigne PAS le chantier qui attend un geste — cette
intention est celle d'avant la maquette du 10 août, et l'avoir « restaurée » a
mis un point de couleur immuablement en bas de l'écran du patron. C'est écrit
trois fois maintenant (`ARCHITECTURE.md` §59, `docs/INTEGRER-ORIGINE.md` §3, ici)
parce que ça a été défait deux fois. La descente finale est la seule part
calculée (`src/lib/perle-descente.ts`) : `sticky` ne sait pas descendre pendant
que le contenu monte. Le contrôle qui tient l'ensemble — et qui MESURE au lieu
de constater une présence — est `npx tsx scripts/capture-accueil-perle.mts`,
serveur en écoute.

**Deux pièges de ce lot, qui coûteront une heure à qui les redécouvre :**
1. `npm run banc` **ne rebâtit que si le commit a changé**. Tant que le travail
   n'est pas commité, il ressert la version d'avant — et l'on mesure du code qui
   n'est pas sur le disque. `rm .next/atlas-version-batie.txt` force le rebâti.
2. Les suites base **abîment le jeu de démonstration** : après `npm test`, la
   connexion `demo@atlas.local` échoue jusqu'à un nouveau
   `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed`.

**Le chemin qui y a mené**, si la question se repose : `docs/maquettes/`, de la
reproduction de sa première capture (01) jusqu'au fil en couleurs (11 à 13). La
charte retenue est **Origine** — celle que l'application portait déjà.

**Ce qu'il a explicitement refusé, et qui ne doit pas revenir :** le trait entre
ATLAS et « Bonjour Florian », la boîte autour d'un chantier, et toute couleur
qui ne désigne rien.

**La grammaire est portée par TROIS pièces partagées** — les toucher change
toute l'application d'un coup, et c'est voulu : `PrimaryButton` (27 écrans),
`EnTeteEcran` (nouveau) et les jetons de `src/lib/design-tokens.ts`
(`radius`, `cardShadow` qui vaut « none »). Ne pas recopier une allure dans un
écran : l'ajouter à ces pièces.

**Où en est la refonte, au 10 août au soir.** Faits : l'accueil, Planning,
Terminés, Réglages, le relevé de TVA, la fiche chantier, et les écrans d'étape
— tous à `EnTeteEcran`, aux jetons resserrés et au bouton commun. Les CORPS de
Photos, Note vocale, Informations et Prix le sont aussi. **Ce qui reste :** les
corps de **Devis, Export et Facture**.

**Un angle mort à connaître :** « les six écrans d'étape » ne comptaient pas
Informations, dont l'en-tête était donc resté à l'ancienne grammaire jusqu'au
soir du 10. Vérifier que **Transcription** ne dort pas dans le même angle mort
avant de déclarer la refonte finie.

**La fiche chantier sert de modèle** : en-tête commun avec `retour` et
`action`, intitulés en serif 19 px, lignes du dessous en capitales espacées,
séparateurs d'un cheveu, aucune pilule. Et deux règles tirées de l'étape 2 :
une **plage** occupe la largeur entière, une **action en toutes lettres**
s'aligne à gauche (`self-start`, sans quoi elle s'étire et se centre seule) ;
et une action en capitales espacées prend **deux fois** la place de la même en
bas de casse — c'est ce qui a chassé « Voir la transcription » de l'en-tête.

**Deux familles ne doivent PAS suivre**, et ce n'est pas un oubli : les
maquettes `/design/*` (découplées du produit) et les pages que le CLIENT reçoit
(`devis/[jeton]`, `factures/[jeton]`). Un devis n'est pas un écran.

**Une règle de charte, née de la 12 et qui vaut pour tout l'écran :** une
couleur qui ne veut rien dire est une couleur en trop. L'accent d'attente ne se
pose que sur ce qui réclame un geste du patron — nulle part ailleurs.

**Comment lui montrer une maquette. Deux règles, apprises à ses dépens.**

1. **Une maquette ne doit contenir AUCUN script.** C'est la vraie cause de
   *« Je ne peux pas ouvrir ça »*, répété trois fois : les maquettes 06, 10 et
   11 engendraient leurs écrans en JavaScript, la 09 est du HTML pur — et la 09
   est la seule qu'il ait ouverte, du premier coup, sur son téléphone. Son
   lecteur n'exécute pas les scripts. La garantie « rien ne diverge d'un écran
   à l'autre » se tient donc dans le script qui ÉCRIT la page
   (`scripts/engendrer-maquette-couleurs.mjs`), pas dans la page.
   **Les maquettes 03, 04, 05, 06 et 10 ont encore des scripts** : les
   convertir avant de les lui renvoyer.
2. **Lui envoyer aussi des images.** Une planche PNG s'affiche dans la
   conversation sans rien à ouvrir. Le fichier HTML complète, l'adresse d'un
   artefact ne suffit jamais.

**L'écran Chantiers est refait d'après une maquette du patron (9 août).** Il a
demandé une reproduction, pas une interprétation.

**Avant de toucher à l'écran d'accueil ou à la charte :** la charte a désormais
DEUX accents. Le vert pin porte ce qu'on fait (action principale, onglet actif),
l'or ce qu'on lit (salut, statuts, filets, sceau) — et sur les cartes, l'or
signale les états qui attendent un geste du patron. Les mélanger rend l'écran
bavard, c'est-à-dire l'aspect « tableau de bord » qu'il refuse.

Les mesures ne sont pas approximatives : filet 1 px, accent de bord 2 px, rayon
14 px, ombre 4 %, écart entre cartes 10 px. Et le conteneur du titre garde son
`overflow-hidden` — sans lui la branche élargit le document et la page glisse
latéralement. `npx tsx scripts/capture-accueil.mts <fichier.png>` prend les
captures et imprime la boîte de la barre basse. `ARCHITECTURE.md` §46.

**Le démarrage lance le serveur AVANT la mise à jour (9 août, au soir).** Son
journal s'arrêtait sur « migrations : faites » et rien n'écoutait : le lancement
venait en dernier, et `postStartCommand` était interrompu avant. Deux heures
perdues à chercher ailleurs.

**Avant de toucher à `.devcontainer/demarrer.sh` :** `lancer_veilleur` doit
rester AVANT `mettre-a-jour.sh`, et l'`exec bash "$0"` ne doit pas revenir —
c'était l'endroit exact où le démarrage mourait. Le code neuf prend effet par le
redémarrage du veilleur, pas par une relance du script. Éprouvé en tuant le
démarrage à cinq secondes. `ARCHITECTURE.md` §45.

**Le banc sert une version BÂTIE, plus un serveur de développement (9 août).**
Après dix-sept heures de 504, 404, 502 et ports en conflit, le patron : *« On
arrête de tourner en rond, corrige-moi ça une bonne fois pour toutes. »* Tous
ces symptômes venaient de `next dev`, qui compile chaque écran à l'ouverture.
Mesuré après : **36 à 80 ms par écran** contre 38,7 s.

**Avant de toucher au démarrage du banc ou à `src/server/env.ts` :**
`npm run banc` bâtit puis sert (repli sur `next dev` si la construction échoue).
`next start` impose `NODE_ENV=production` : le profil `ATLAS_PROFIL=banc`
(`src/profil-banc.ts`, posé par `demarrer.sh`) relâche **exactement deux
choses** — IA simulée et stockage local. AUTH_SECRET, CRON_SECRET, Redis restent
exigés, l'isolation ne bouge pas. Quatre fichiers en dépendent : la
configuration, le proxy, l'environnement, Auth.js. `ARCHITECTURE.md` §45.

**Et `npm run verifier:connexion` monte maintenant `npm run banc`**, pas
`npm run essai` : c'est lui, et lui seul, qui a trouvé `UntrustedHost` — Auth.js
refusant l'hôte du mandataire en production, pendant que l'artisan lisait « Une
erreur ». Éprouver autre chose que ce qu'on livre, c'est ne rien éprouver.

**Une page d'état lisible au téléphone (9 août).** *« Va regarder toi-même, je
peux pas te l'envoyer. »* Il travaille au téléphone ; le terminal de l'éditeur
ne lui est pas offert, et je n'ai aucun accès à son espace.

**Avant de diagnostiquer un banc muet :** lui faire ouvrir
`<adresse>/api/health/banc`. Elle répond sans session, sans base, en quelques
millisecondes, et donne la version exécutée, l'avancement du préchauffage et ce
qui bloque. `ARCHITECTURE.md` §44.

**La cause première du 404, et elle était là depuis le début (9 août).**
`npx next dev` n'est qu'une pile d'enveloppes : le processus qui écoute se
**renomme** `next-server`. Le `pkill -f "next dev"` du démarrage tuait donc les
enveloppes et laissait le vrai serveur orphelin, accroché au port — le suivant
ne pouvait plus s'y attacher, et l'orphelin servait un cache périmé : toutes les
pages en 404, santé comprise.

**Avant de toucher à un `pkill` dans ce dépôt :** viser `[n]ext(-server| dev)`,
jamais `next dev` seul. Et ne jamais mettre le motif et une occurrence littérale
dans la même commande — le shell qui la porte se tue lui-même (arrivé deux fois
en une soirée). `ARCHITECTURE.md` §44.

**Le banc se relève seul, et compile ses écrans d'avance (9 août).** Le patron
a lu deux pages d'erreur coup sur coup, et **aucune n'était une lenteur** :
« HTTP ERROR 504 » parce que `next dev` compilait l'écran pendant qu'il
attendait (38,7 s pour `/termines`, 373 ms ensuite), et « HTTP ERROR 404 »
parce que **le serveur était mort** — sur cette adresse, 404 veut dire « plus
rien n'écoute ».

**Avant de toucher au démarrage du banc :** `.devcontainer/demarrer.sh` ne lance
plus le serveur, il lance `.devcontainer/veiller.sh`, qui le relance quand il
tombe. Le veilleur exige **deux** conditions (santé muette ET aucun `next dev`)
— sur la seule santé, une grosse compilation ferait lancer un second serveur qui
tuerait le premier. `scripts/prechauffer.mjs` compile ensuite seize écrans, à la
file, avec une session **fabriquée** et non ouverte par le formulaire : le
limiteur autorise cinq connexions par quart d'heure et par adresse IP, et
quelques redémarrages auraient verrouillé le patron hors de son application.
Jamais en production. `ARCHITECTURE.md` §44.

**L'application ne pouvait pas être bâtie (9 août).** Il s'inquiétait de la
lenteur ; pour lui répondre avec des chiffres il fallait une version optimisée —
et `npm run build` échouait. `next build` se déclare `NODE_ENV=production`,
`src/auth.ts` lit le secret de session dès l'import, et **tous** les refus de
`src/server/env.ts` tombaient pendant la compilation. Bâtir exigeait une clé
d'IA facturée, un compartiment S3 et un secret de tâche planifiée : personne ne
l'avait donc jamais fait.

**Avant de toucher à `src/server/env.ts` :** les refus sont suspendus pendant la
construction **et pendant elle seule** (`NEXT_PHASE`). `scripts/test-env.ts`
l'éprouve dans les deux sens, et le second cas est le plus important —
construction acceptée sans aucun secret, **exécution et démarrage du serveur
bâti toujours refusés**. Sans lui, `NEXT_PHASE` serait un interrupteur ouvrant
toutes les protections de production. `ARCHITECTURE.md` §43.

**Les chiffres, enfin mesurés** (version bâtie, 4 cœurs) : démarrage 212 ms,
écrans entre 50 et 100 ms, première ouverture au même prix que la deuxième.
Non mesurés, et dits comme tels : les PDF et la dictée.

**Les migrations du banc tournaient sous le mauvais rôle, en silence (9 août).**
`atlas_app` n'a aucun droit de DDL : elles échouaient à chaque mise à jour, et
les deux appelants avalaient l'échec. Le patron voyait « Mise à jour
récupérée », puis un écran tombait sur une table absente.

**Avant de toucher à la mise à jour du banc :** les migrations passent par
`.devcontainer/appliquer-migrations.sh`, et **par lui seul** — un contrôle
interdit de relancer `db:migrate` ailleurs, parce que c'est par là que le
mauvais rôle reviendrait. Le script choisit `DATABASE_ADMIN_URL` puis
`DATABASE_URL`, et rend « faites » ou « échec : <ce que la base a répondu> ».
`ARCHITECTURE.md` §42.


**La note vocale lit un numéro sans qu'on l'annonce (9 août).** Il signalait que
sans dire « numéro de téléphone », rien n'était reconnu. **Le défaut n'était pas
celui-là** : la transcription écrit parfois les chiffres en toutes lettres, et
aucune recherche de chiffres ne pouvait les voir. Son annonce ne faisait que
déclencher le rattrapage du modèle de langue.

**Avant de toucher à `src/lib/nombres-dictes.ts` :** deux régimes de lecture, et
c'est la transcription qui choisit. Avec traits d'union, on la suit mot à mot
(elle a déjà découpé) ; sans aucun tiret, on recolle au plus long. Inverser
l'un des deux casse l'autre — les deux ont été mesurés sur des dictées réelles.
70 et 90 n'acceptent pas d'unité derrière eux, et « cent » est délibérément
absent du vocabulaire reconnu. `ARCHITECTURE.md` §40.

**Deux défauts trouvés en cherchant le sien, tous deux du même genre** — un
champ faux mais crédible plutôt qu'un champ vide : `0033 6 12 34 56 78` rendait
`0336123456`, et « florian tiret martins arobase… » rendait `martins@gmail.com`.
C'est la forme de défaut la plus coûteuse du produit : personne ne relit un
champ qui a l'air juste.


**Les identifiants Google se saisissent DANS l'application (9 août).** Écran
« Mon agenda », trois cases. Ceux de l'entreprise priment sur les variables
d'installation, qui restent en repli. **Trois règles à ne pas défaire** :
« configuré » n'est pas « relié » (entre le collage et le retour de Google, rien
n'est autorisé) ; changer d'identifiants efface les jetons (ils appartiennent à
l'autre projet Google) ; un secret vide conserve l'ancien (Google ne le remontre
jamais). `ARCHITECTURE.md` §41.

**L'agenda lit aussi les intitulés (9 août).** La portée est passée de
`freebusy` à `events.readonly` sur sa demande. **Ce qui n'est pas négociable :**
l'intitulé est FACULTATIF dans `PeriodeOccupee` et n'entre dans aucun calcul —
c'est ce qui garantit qu'il ne peut pas se glisser vers la page du client, qui
ne reçoit que des dates. Attention aux trois pièges d'`events.list` :
`singleEvents` pour déplier les séries, la fin exclusive des événements « toute
la journée », et les événements annulés ou « disponible » à écarter.

**L'agenda extérieur, au choix de l'artisan (9 août).** Atlas peut tenir compte
d'un agenda Google, si l'artisan le relie. **Avant ce lot, un rendez-vous noté
ailleurs était invisible** : Atlas proposait ce jour-là et le client le
choisissait.

**Trois choses à savoir avant d'y toucher :**

1. **Une seule carte d'occupation.** Les rendez-vous se fondent dans la même
   `Map` que les chantiers (`fusionnerOccupationExterne`), et les quatre chemins
   qui décident ensuite la lisent sans savoir d'où vient l'occupation. **Ne
   jamais ajouter un second calcul à côté** — c'est ce dédoublement qui avait
   rangé un chantier dans deux onglets à la fois. `ARCHITECTURE.md` §39.
2. **Le client passe par là aussi**, parce que c'est lui qui retient la date.
   Ses deux chemins publics dérivent l'entreprise du **jeton**, et lisent
   l'agenda AVANT d'ouvrir leur transaction — un appel HTTP dans une transaction
   immobiliserait une connexion du pool pendant une panne de Google.
3. **Ce qui n'est pas éprouvé, et pourquoi.** L'aller-retour réel avec Google —
   autorisation, échange du code, renouvellement — n'a pas pu l'être : pas de
   compte ici, et le mandataire refuse Google. Tout ce qui décide a été sorti de
   ce chemin exprès ; il ne reste que trois appels HTTP. Cela se vérifiera chez
   le patron, avec ses identifiants (`docs/A-FAIRE.md` §7).

**Deux pièges rencontrés, à ne pas repayer.** Un module `"use server"` ne peut
exporter QUE des fonctions asynchrones : une constante y fait perdre **tous** les
exports du fichier, types et lint verts, écran mort. Et le titre de l'écran
mentait — cas de panne traité après le cas nominal ; la phrase vit maintenant
dans `titreEtatAgenda()`, une fonction pure, avec son contrôle.


**Le vocabulaire d'un vrai devis d'élagueur (9 août).** Huit règles de rédaction
et dix-neuf mots du métier, tirés de six documents d'un confrère —
`termes_metier` en compte vingt-sept.

**À savoir avant d'en ajouter, et c'est mesuré, pas supposé :** la consigne
envoyée avec chaque dictée a un budget de **9 000 caractères**, dont un quart est
RÉSERVÉ à ses corrections. Tout tient aujourd'hui — 8 512 caractères, 27 termes
sur 27, 5 corrections sur 5 — mais il n'y a plus qu'environ cinq cents
caractères de marge. **Le prochain qui ajoute du vocabulaire doit remesurer**
(`construireConsigneMetier(termes, corrections)` rend `termesRetenus` et
`ecartes`) : au-delà, des termes repartent au vestiaire en silence pour qui ne
regarde pas. L'ordre des termes décide de qui part : d'abord ce qui change un
prix ou crée une ligne détachable. `ARCHITECTURE.md` §37 et §38.

**Et une leçon qui n'est pas technique** : la définition « le gros bois se débite
en 40 ou 50 cm » a été écrite le matin à partir de deux exemples, et démentie
l'après-midi par un devis à 33 cm. Deux occurrences ne fondent pas une
énumération — un champ sans source fiable reste ouvert (`docs/AGENT.md` §3).

**Un calendrier des deux côtés (9 août).** Le client ne peut plus choisir un jour
déjà pris — il est barré et ne répond pas. Le patron a le même : ses journées
prises sont barrées sur **douze mois** (`HORIZON_OCCUPATION_PATRON_JOURS`, 365
jours), alors qu'il peut proposer une date jusqu'à **dix-huit mois**
(`HORIZON_PATRON_JOURS`, 550 jours) — deux horizons distincts, ne pas les
confondre. Un seul composant sert les deux écrans, et il ne décide de rien : tout
vient de `src/lib/calendrier.ts`. **L'ordre des raisons dans `etatDuJour` n'est
pas indifférent** — un jour hors fenêtre ne doit jamais se dire « déjà pris »
chez le client, sinon sa page laisse filtrer le planning. `ARCHITECTURE.md` §36.

**Une règle de travail, avant tout le reste :** les suites navigateur tournent
sous un rôle qui **traverse la RLS**, donc elles ne peuvent pas voir un défaut
d'isolation. Le 8 août, le lien de facture et le PDF du devis étaient morts en
production — vus par hasard, jamais par un contrôle. **Tout chemin public par
jeton s'éprouve dans une suite base, sous `atlas_app`**
(`scripts/test-facture-jeton-rls.ts`). `ARCHITECTURE.md` §34.

**Du planning à la facture, sans détour.** Le patron ne pouvait pas atteindre le
devis d'un chantier planifié : toucher sa carte n'ouvrait qu'un sélecteur de
date. Elle mène maintenant au chantier et porte un bouton « Fin de chantier ».

**À savoir avant de toucher au rangement des chantiers :** la règle vit dans
`src/lib/onglet-chantier.ts` et **nulle part ailleurs**. Elle y était déjà, mais
seul l'écran Chantiers l'appelait — le planning et le dépôt des terminés en
gardaient chacun une copie, avec un signe d'écart. Résultat : un chantier prévu
aujourd'hui dans deux onglets, et un chantier clôturé avant sa date dans aucun,
sa facture perdue de vue. Ne jamais recopier ce filtre dans un écran : trois
portes existent (`ongletDuChantier`, `ongletDepuisJalons`, `estAuPlanning`),
elles couvrent les trois formes de donnée. `ARCHITECTURE.md` §33.

**Trois grilles de prix, et son devis de référence enfin juste.** Il a répondu
le 8 août au soir : on garde les 8 × 6 tranches du fendage, la haie prend sa
ligne avec un prix au mètre, l'abattage a sa grille à la technique × le
diamètre. Son devis du 5 août — haie 350, abattage 600, fendage 300 — sort
maintenant tel qu'il l'avait écrit. **La règle à connaître avant de toucher au
chiffrage :** dès que la ligne principale a un prix de grille, le total devient
la somme des postes au lieu du tarif à la journée (`ARCHITECTURE.md` §32).

**Il peut déposer sa liste de prix Excel ou CSV**, au lieu de la retaper :
`Réglages → J'ai déjà mes prix ailleurs`. Lue sans aucune bibliothèque, et
surtout **montrée avant d'être écrite** — ce qui s'ajoute, ce qui change, ce qui
n'a pas été compris. Le PDF est refusé, à dessein : voir `TODO.md` §0 sexies
avant de le reproposer.

**Le patron peut proposer une date à dix-huit mois.** Il ne pouvait proposer que
les six prochains jours ouvrés — il l'a signalé avant que ça ne lui coûte un
client. Deux horizons désormais, et **ne pas les confondre est la décision qui
compte** : le sien va à dix-huit mois, celui du client reste à trois mois ou à
trois semaines autour de la date proposée. La page publique reçoit la liste des
jours occupés ; lui ouvrir dix-huit mois reviendrait à lui donner le carnet de
commandes. Voir `ARCHITECTURE.md` §30.

**Le devis se découpe enfin en lignes vendables.** C'est le défaut que le patron
a signalé trois fois en deux jours — *« tout ce que je dicte arrive sur la même
ligne »* —, et qui avait survécu à un diagnostic sans correction. L'abattage, le
broyage et l'évacuation vont ensemble ; la fente fait sa ligne ; le billonnage
n'en fait aucune ; il n'y a plus de point-virgule. La règle est pure et éprouvée
sur ses dictées : `src/lib/lignes-vendables.ts`.

Avec elle, **sa grille de prix pour fendre le bois** : hauteur de l'arbre ×
diamètre du tronc, 8 × 6 cases, **née vide**. Aucune case ne se devine depuis ses
voisines — une case vide est une question posée. Elle se remplit à la main
(`Réglages → Mes prix pour fendre le bois`) et toute seule, à chaque prix de
fente écrit sur un vrai devis. Voir `ARCHITECTURE.md` §29, et `TODO.md`
§0 quinquies pour les trois questions restées ouvertes — **notamment les bornes
des tranches, faciles à changer aujourd'hui, coûteuses après trente devis**.

Avant cela : le parcours **devis → réponse du client → chantier → facture →
TVA**, de bout en bout, avec ses trois points d'arrêt. Plus le suivi de ce que devient un devis une
fois parti : en attente, à relancer, caduc, retourné, accepté.

Et, en dernier lieu, **le devis PDF** : il reproduit désormais
`appli/devis-modele.html`, le modèle que le patron avait construit lui-même pour
Arborea. C'est le seul document que son client reçoit, et ce n'était pas le sien.
Voir `ARCHITECTURE.md` §16 pour les choix, dont la trace qui rend la mise en page
vérifiable.

**Et, en dernier, le patron peut emporter ses données.** `Réglages → Télécharger
mes données` produit un ZIP : les vingt-trois tables de son entreprise, ses
photos, ses enregistrements, ses PDF, et un mode d'emploi. Ce n'est pas un
confort — c'est la condition qu'il a posée lui-même avant de nourrir la mémoire
de l'agent : *« le jour où je mets ça en ligne, est-ce que je perds toute la
mémoire ? »* Voir `ARCHITECTURE.md` §26 pour les choix, dont ce qui a été
écarté (`pg_dump`, un privilège d'export, une bibliothèque d'archivage).

La sauvegarde **automatique**, elle, reste bloquée sur le choix d'un hébergeur :
elle a besoin d'une destination extérieure. Ne pas la reproposer sans lire
`TODO.md` §0(b).

**Et une correction qui change la façon de travailler ici.** Le dépôt affirmait
que la batterie base de données ne pouvait pas tourner dans l'environnement de
l'agent. C'est faux : Docker manque, pas PostgreSQL ni Redis.

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

Croire l'inverse a fait dire trois fois « c'est la CI qui vérifiera » alors que
la CI n'avait jamais tourné. **Jouer la batterie avant de livrer**, sans
attendre.

**Et, avant cela, l'IA.** La production refuse désormais de démarrer sur l'IA
simulée — c'était le dernier repli silencieux vers un comportement de
développement que `src/server/env.ts` laissait passer. Au passage, les tarifs
des fournisseurs se relèvent maintenant à leur source depuis une machine GitHub
(`relever-tarifs-ia.yml`), le réseau de l'agent les refusant : un mois d'Atlas
au volume du patron coûterait **2 à 8 $**, transcription comprise.

Détail dans `CHANGELOG.md`, état complet dans `PROJECT_STATE.md`.

**Et, en dernier lieu, l'esthétique — sur maquettes, pas dans le code.** Le
patron a arrêté **cinq** choix le 2026-08-10 : la charte **Origine** (ivoire et
bronze, qui remplace le vert pin d'Arborea), le **trait G** au bandeau, la
**perle** qui suit le défilement, l'**écran qui recule** à l'ouverture de
« Nouveau chantier », et le **tiroir des retirés** pour supprimer une ligne.

S'y ajoutent, le même jour, deux écrans : le **planning** (le mois, les
demi-journées, une ligne par équipe) et **Réglages · vos équipes**. Ce dernier
porte une règle à ne pas défaire : **à une seule équipe, le planning n'écrit
aucun nom d'équipe** — le patron l'a demandé mot pour mot. À deux et plus, le
champ vide affiche déjà « Équipe A » en gris. On n'invente jamais un nom, et on
ne laisse jamais deux lignes indiscernables (`docs/INTEGRER-ORIGINE.md` §6 ter).

**Ce paragraphe décrivait un état révolu, et le laisser tel quel aurait coûté :**
au 10 août la refonte n'était que sur maquettes, mais elle est **portée dans
l'application depuis le 11 août 2026** — `design-tokens.ts` est en Origine, le
fil, la perle, le tiroir des retirés et le bandeau y sont. Une conversation qui
lirait « rien n'est encore codé » referait le travail. Le détail est dans
`PROJECT_STATE.md` et `CHANGELOG.md` ; `docs/INTEGRER-ORIGINE.md` reste la
spécification d'origine, pas l'état du code.

Deux contraintes à ne pas redécouvrir : **les maquettes envoyées au patron ne
doivent contenir aucun JavaScript** (son lecteur n'en exécute pas — les pages
engendrées en script lui arrivaient vides), et **il faut regarder les captures**.
Sur ce lot, quatre défauts se sont vus à l'écran et aucun aux contrôles : des
cases à cocher bleues d'iOS en pleine page ivoire, une ligne d'en-tête effacée
par une classe homonyme, un nom coupé en plein mot par le glissement, et
« CHANTIERS » qui touchait « PLANNING ».

## Où reprendre

**`TODO.md` §0 bis — l'agent qui apprend. Le patron l'a demandé expressément le
6 août 2026 :** *« Ok, garde ça en mémoire et on fera ça après. N'oublie pas de
le faire. »*

Ce n'est donc pas une liste d'idées : c'est le prochain travail, et il ne doit
pas avoir à le redemander. Dans l'ordre — l'**entretien de départ**, l'**écart
devis / facture**, puis **photos ↔ prix**. Le rapport entre techniques (×1,67,
×2,33) vient après, quand `lecons_prix` aura de quoi le calculer.

Ce qui est déjà fait de cette série : le tapis roulant, l'arrêt d'avant-chiffrage
(§0 ter) et la mémoire des corrections (§0 quater).

Le reste de `TODO.md` ensuite. L'**agenda Google** est partiellement bloqué : la
connexion du compte demande des identifiants que le patron doit fournir.

**Avant de proposer autre chose,** lire `docs/A-FAIRE.md` : **cinq** points
bloquent un usage réel et **aucun ne s'avance en codant**. Ne pas les
redécouvrir ni les reposer au patron : ils sont écrits, avec leur coût et leur
propriétaire.

Le dernier arrivé est le point 6, **choisir l'outil qui émet les factures**
(8 août 2026). Deux choses y sont à ne pas confondre. La première est acquise
et ne se rouvre pas : **Atlas prépare les factures, il ne les émet pas au sens
légal** — `docs/AGENT.md` §6, acté le 31 juillet, « hors périmètre
définitivement ». Ce qui est ouvert, c'est seulement *sur quel outil se
brancher*, et le patron n'en a aucun à ce jour. Tant que le choix n'est pas
fait, écrire du code de branchement serait écrire du code à jeter.

Le cinquième — brancher un fournisseur SMS et e-mail — a été **tranché le
2026-08-04 : il n'y en aura pas.** Le devis part de la messagerie du patron.
Lire `ARCHITECTURE.md` §13 avant de proposer quoi que ce soit sur l'envoi : deux
choses y sont écartées **pour de bon**, un prestataire d'envoi et la pièce
jointe au message. Les reproposer serait rouvrir un débat déjà clos.

---

## Ce qu'il faut savoir avant de toucher au code

### La règle qui prime : éprouver avant d'acter

Rien ne se déclare valide sans avoir été parcouru en entier, dans les conditions
du patron. Trois bancs d'essai livrés « prêts » ont échoué chez lui alors que le
code était juste. Le détail est dans `AGENTS.md`, en tête — et il est lu à chaque
conversation. Ce qui ne peut pas être éprouvé ici part en CI :
`banc-essai.yml` monte l'espace de travail et s'en sert, `pages.yml` vérifie le
site publié à son adresse réelle.

### Les dix-huit pièges de ce dépôt

0. **Une action serveur refusée ne dit rien d'utile.** Next.js compare `Origin`
   à l'hôte : derrière un proxy (Codespaces), ils diffèrent et TOUTE action est
   rejetée — connexion comprise — avec pour seul message « Invalid Server
   Actions request. ». Aucune suite ne le voit : elles interrogent toutes
   `127.0.0.1`, où les deux coïncident. C'est le rôle de
   `scripts/verifier-connexion.mjs`, qui pose exprès une origine étrangère.
0 ter. **Le message d'une exception levée par une action serveur N'ARRIVE PAS
   jusqu'à l'écran du patron.** Next.js le remplace en production par un
   identifiant opaque, et le banc sert une version bâtie : un code qui affiche
   `err.message` en croyant montrer la cause ne montre qu'un digest. C'est le
   piège qui a rendu « Impossible d'enregistrer la note » indéchiffrable le 11
   août 2026. **Tout refus attendu se rend en valeur de retour** —
   `{ ok: false, raison }` — jamais en exception ; les pannes imprévues lèvent,
   mais se journalisent AVANT (`logger.error`), sans quoi elles ne laissent
   aucune trace nulle part. Le cadre le prescrit noir sur blanc :
   `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`.
0 bis. **Les fabriques d'IA retombent sur `dev` par leur `default:`.** Une faute
   de frappe dans `LLM_PROVIDER` ou `TRANSCRIPTION_PROVIDER` donnait donc l'IA
   simulée, sans un mot, et la dictée rendait « [Transcription simulée — … ] ».
   `src/server/env.ts` refuse maintenant de démarrer en production sur un nom
   inconnu, sur « dev », ou sur un fournisseur privé de sa clé. En développement
   rien ne change : le mode simulé y est le fonctionnement normal — mais l'écran
   `Réglages` dit désormais lequel des trois états s'applique (`src/lib/etat-ia.ts`),
   parce qu'un refus muet vaut moins qu'un refus qui s'explique.
1. **Une requête hors `withEntreprise()` ne renvoie rien, silencieusement.** Pas
   d'erreur : zéro ligne. Un traitement qui ne trouve rien à faire paraît
   fonctionner. C'est déjà arrivé une fois (la purge d'audio).
2. **Un devis envoyé et une facture émise sont immuables**, par trigger
   PostgreSQL. Toute correction passe par une nouvelle version ou un avoir.
3. **Le relevé de TVA n'est pas stocké**, il se recalcule. Sa stabilité dépend du
   point 2 : casser l'un casse l'autre.
4. **Ne jamais formater une date via `new Date(iso)`.** Utiliser
   `src/lib/jour.ts`. Le décalage de fuseau affiche « dimanche 22 » pour un
   chantier calé le lundi 23.
5. **Les suites de bout en bout tournent sous un rôle qui traverse la RLS** parce
   qu'elles inspectent la base. Les suites de dépôt, non — c'est ce qu'elles
   démontrent.
6. **Une suite `scripts/test-*.ts` s'exécute en CommonJS** : pas d'`await` au
   premier niveau, sinon esbuild refuse le fichier entier. Envelopper dans
   `async function main()` puis `main().catch(...)`, comme les suites voisines.
   Un script de mise au point qui a besoin de l'`await` de premier niveau prend
   l'extension `.mts` — et n'est alors plus découvert par le lanceur.
7. **Un fichier `"use server"` n'exporte que des fonctions asynchrones.** Y
   exporter une classe, une constante ou un type annule **tous** les exports du
   module : l'application entière répond 500, et **ni `tsc` ni `eslint` ne le
   voient**. Le message ne parle même pas du coupable — il dit qu'un autre
   fichier importe une action « qui n'existe pas ». Les règles métier et les
   classes d'erreur vivent dans `src/lib/`, jamais dans un fichier d'actions.
8. **Un PDF ne connaît que WinAnsi.** Les polices standard de pdf-lib refusent
   tout caractère hors de cet encodage, et l'appel échoue sur la ligne entière.
   L'espace fine insécable (U+202F) que `toLocaleString('fr-FR')` glisse dans
   « 1 400,00 € » en fait partie : utiliser l'insécable ordinaire (U+00A0), qui,
   elle, existe. Le symbole € passe, les accents aussi.
9. **L'analyse d'une dictée jette ce qu'elle ne sait pas classer, sans le dire.**
   `src/server/orchestrateur/analyse-demande.ts` ne comprend rien : il découpe.
   Un segment mal découpé ne produit pas d'erreur — il produit un écran plus
   court, que personne ne peut distinguer d'une dictée pauvre. Le patron y a
   perdu une prestation et trois machines d'un coup. D'où l'invariant que tient
   `scripts/test-analyse-dictee.ts` : **aucun mot dicté ne disparaît**, et la
   liste des mots qu'on s'autorise à absorber est écrite en toutes lettres dans
   la suite. Toucher au découpage sans relancer cette suite, c'est refaire le
   défaut. Corollaire éprouvé : dans ces expressions rationnelles, les
   frontières de mot ne sont pas décoratives — sans `\b`, `jours?` se déclenche
   à l'intérieur de « journée » et ampute le segment.
10. **Un état d'écriture qui vit dans le navigateur ment au premier retour
    arrière.** « Ajouté au détail » était un `useState` : il mourait à chaque
    navigation, l'écran reproposait une ligne déjà écrite, et un seul appui
    doublait le devis du patron (1 674 € → 3 348 € HT). La règle : **tout ce qui
    dit « c'est déjà fait » se déduit des données, jamais d'un drapeau local** —
    et le serveur applique la même fonction, parce qu'un écran ne protège rien.
    Motif à réutiliser : `src/lib/proposition-au-detail.ts`.

11. **Le planning ne se lit plus en jours pleins.** Un jour porte deux
    demi-journées, chacune tenant autant de chantiers que l'entreprise a
    d'équipes (`ARCHITECTURE.md` §22). Deux conséquences à ne pas défaire : un
    chantier planifié **avant** la migration 0019 n'a ni créneau ni durée et
    doit continuer d'occuper la journée entière — le relâcher rendrait
    proposables des après-midis déjà pris ; et le **week-end reste retenable**,
    il n'est qu'exclu des jours *suggérés*, parce qu'un client peut demander un
    samedi. Avoir confondu les deux a cassé deux suites d'un coup.

12. **Une donnée enregistrée n'est pas une donnée montrée.** `precision_client`
    existait depuis le premier jour, le client y écrivait, et **aucun écran ne
    l'affichait**. Le patron lisait « le client n'a pas donné suite » sans jamais
    savoir qu'on lui avait écrit « le devis comprend une faute ». Rien ne le
    signalait — ni erreur, ni test : le champ était simplement absent de toutes
    les requêtes. Avant d'ajouter un champ que l'utilisateur remplit, écrire le
    contrôle qui vérifie qu'il **ressort** quelque part
    (`scripts/test-correction-devis.ts`).

13. **Une règle juste que l'écran n'applique pas ne protège personne.**
    `lienTransmission()` composait `sms:0679…` correctement, et sa suite était
    verte ; l'écran, lui, passait par `navigator.share`, qui sur iPhone ne
    transmet **qu'un texte** — le patron ouvrait Messages avec un champ « À : »
    vide. Deux leçons à ne pas défaire : ce que la page **propose réellement**
    se contrôle à l'endroit où le patron appuie (`test-transmission-e2e.ts`), et
    une adresse portée par un `href` est **lisible dans la page**, donc
    vérifiable — c'est pour cela que c'est un `<a>` et non un
    `window.location.href`. Corollaire trouvé par ce contrôle neuf : l'écran
    lisait la coordonnée dans **l'instantané figé du devis**, si bien qu'une
    adresse tout juste saisie n'apparaissait jamais. Une donnée que
    l'utilisateur vient d'écrire se relit sur la **fiche vivante**.

14. **Des maillons tous verts ne font pas une chaîne.** Brouillon,
    confirmation, chiffrage, ligne de prix, devis : chacun avait sa suite, et
    chacune passait. Aucune ne les parcourait **à la file** — et le parcours, lui,
    ne menait nulle part : cinq gestes sur quatre écrans, dont aucun ne menait au
    suivant, avec un devis à 0,00 € au bout si l'un était oublié. Le patron l'a
    dit deux fois avant qu'on l'entende. Quand un lot ajoute une étape à un
    parcours, la suite qui compte est celle qui va **du premier écran au
    dernier** (`test-devis-depuis-dictee-e2e.ts`). Corollaire de conception :
    quand deux chemins font la même chose, la règle sort dans un service et les
    deux l'appellent — `confirmerBrouillon()`, `appliquerPropositionPrix()` — car
    c'est le chemin le moins relu qui garde le vieux défaut.

15. **Un service qui ne sait pas échouer proprement bloque tout le reste.**
    `JSON.parse(reponseDuModele)` sans filet : une réponse encadrée en
    ```` ```json ```` suffisait à afficher « Réponse du fournisseur non conforme
    (JSON invalide). » et à arrêter net le chantier du patron. Deux règles en
    sont sorties : **tolérer l'emballage, jamais le fond** (le schéma reste seul
    juge), et **ne jamais laisser l'utilisateur devant rien** — ici, la dictée est
    relue mot à mot, sans réseau ni clé. Un repli doit se **dire** : le brouillon
    porte `lecture = 'litterale'` et l'écran l'annonce, sans quoi le patron relit
    une recopie en la croyant analysée.

16. **Un espace de travail ne récupère jamais le code neuf tout seul.** Le
    patron a réessayé, un jour plus tard, des correctifs livrés la veille, et
    conclu qu'ils ne marchaient pas. Trois échanges perdus sur des défauts déjà
    réparés. Depuis : `.devcontainer/mettre-a-jour.sh` avance à chaque allumage
    (jamais en écrasant du travail non enregistré, jamais en forçant), et
    **l'application affiche sa version dans les Réglages**. Règle générale :
    avant de chercher un défaut qu'un correctif devait fermer, **demander la
    version** — une capture de l'écran Réglages y répond.

17. **Une configuration par défaut qui ignore ce qu'on lui donne.** Le patron
    avait posé ses clés Anthropic et OpenAI ; l'IA restait débranchée, et rien
    ne disait pourquoi. `LLM_PROVIDER` valait `dev` par défaut, le conteneur
    d'essai écrivait `dev` en dur sans transmettre les clés, et le fournisseur
    OpenAI n'était qu'une ébauche répondant « non implémenté » — trois causes
    cumulées, aucune visible. Trois règles en sont sorties, à ne pas défaire :
    **une variable vide vaut une variable absente** (`?? défaut` ne rattrape pas
    la chaîne vide, et un conteneur transmet volontiers `${X:-}`) ; **ce qui ne
    figure pas dans `.devcontainer/docker-compose.yml` n'existe pas dans le
    conteneur**, secrets compris ; et **une ébauche ne se fait jamais passer
    pour un fournisseur** — elle est refusée à la configuration, pas au premier
    appui du patron. L'état réel se lit désormais à l'écran Réglages, au
    démarrage, et par `npm run verifier:ia` (`ARCHITECTURE.md` §26).

    *Corollaire sur les données :* la protection ne tient plus à une valeur par
    défaut mais à **l'absence de clé**. C'est pourquoi la batterie retire les
    clés d'IA de toute étape qui exécute le produit — **et pose
    `LLM_PROVIDER=dev` explicitement** : retirer les variables ne suffit pas,
    Next.js charge `.env.local` de lui-même, et c'est justement là que le patron
    est invité à coller les siennes.

    *Corollaire sur l'espace d'essai :* un conteneur construit avant le
    correctif garde l'ancien réglage figé. `.devcontainer/reglage-ia.sh` le
    neutralise plutôt que d'exiger une reconstruction — introuvable sur un
    téléphone.

    *Et le piège du remède :* `.env.local` est désormais écrit d'avance, **vide**,
    pour que le patron n'ait qu'à coller ses clés. Le charger naïvement
    (`set -a ; . .env.local`) écrase alors avec du vide les clés venues des
    secrets de la plateforme — le correctif recréait le défaut. Une seule règle
    de chargement, dans `.devcontainer/charger-cles.sh` : rien de vide n'est
    exporté, et ce qui existe déjà l'emporte toujours sur le fichier.

18. **Un aperçu qui n'imprime pas ce que montre l'écran.** Le devis à la main
    modifie `lignes_prix` ; le PDF imprime `lignes_devis`, l'instantané du
    document. Cet instantané n'était rafraîchi qu'au **chargement de la page** —
    le patron écrivait ses lignes, touchait « Aperçu du PDF », et recevait un
    document vide : « rien n'a été enregistré ». Ses lignes étaient pourtant
    bien là. Règle qui en sort : **partout où l'on imprime, on rafraîchit
    d'abord** (`src/app/api/devis/[id]/pdf/route.ts`), et toute règle d'affichage
    partagée entre l'écran et le papier vit dans une fonction commune —
    `src/lib/adresses.ts` en est née.

    *Deux corollaires trouvés le même jour, tous deux invisibles aux tests :* un
    champ de saisie **vide, sans repère et haut de 24 px** se lit comme « pas
    cliquable » alors qu'un contrôle répond « éditable : oui » — la taille d'une
    cible tactile se mesure (44 px), elle ne se déduit pas. Et `innerText`
    **n'inclut pas le contenu des champs** : un contrôle qui l'interroge pour
    vérifier l'ordre d'un formulaire ne voit rien du tout.

### Le vocabulaire

Tout est en français, y compris en base : `chantiers`, `devis`, `envois_devis`,
`factures`, `lignes_facture`, `entreprise_id`. Un `withEntreprise`, pas un
`withCompany`. S'y tenir.

### Les deux documents du patron

`docs/QUESTIONS.md` et `docs/A-FAIRE.md` sont écrits **pour lui**, en langage
courant. Règles de tenue dans `AGENTS.md` : les consulter avant de répondre à une
question de fond, citer le passage plutôt que reformuler, et **proposer** un
ajout sans jamais l'imposer. Après modification, régénérer la page consultable :

```bash
node scripts/md-en-page.mjs docs/QUESTIONS.md docs/questions.html
node scripts/md-en-page.mjs docs/A-FAIRE.md
```

---

## Voir l'application tourner, sans rien monter

Le plus court chemin est [`docs/ESSAYER.md`](docs/ESSAYER.md) : un espace de
travail GitHub monte la base, applique le schéma, insère les données de
démonstration, **démarre l'application tout seul** et l'expose sur une adresse
publique ouvrable depuis un téléphone. Tout est dans `.devcontainer/`.

**Ne jamais y remettre une commande à taper.** Quatre échecs d'ouverture
d'affilée l'ont été sur le terminal, aucun sur l'application : le patron essaie
Atlas depuis un téléphone, où viser un curseur et faire un `Ctrl+C` n'existent
pas. `demarrer.sh` (joué par `postStartCommand`) est la réponse, et
`verifier.sh` contrôle en CI que l'application répond **sans commande**.

C'est aussi ce qu'il faut donner au patron quand il demande à essayer : le site
publié ne montre que des maquettes.

## Monter l'environnement à la main

PostgreSQL 16 et Redis doivent tourner. Les rôles attendus sont créés par
`scripts/bootstrap-postgres-ci.sql`.

```bash
# Migrations (rôle propriétaire)
DATABASE_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test \
  npm run db:migrate

# Données de démonstration (compte demo@atlas.local / demo1234)
DATABASE_URL=postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 \
  npx tsx src/server/db/seed.ts

# Suites base de données (rôle applicatif, soumis à RLS)
DATABASE_URL=postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test \
  DATABASE_ADMIN_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 \
  npm test

# Suites navigateur (démarre son propre serveur sur le port 3000)
DATABASE_URL=postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 \
  CRON_SECRET=ci-placeholder-cron-secret-0000000000 \
  REDIS_URL=redis://localhost:6379 \
  npm run test:e2e
```

**Deux pièges d'exécution :**

- **Ne jamais donner `REDIS_URL` à `npm test`.** La suite des propositions IA
  ouvre alors une connexion qui n'est jamais refermée : le processus ne se
  termine plus, et la série entière reste bloquée **sans le moindre message**.
  Isolé : code 124 avec la variable, code 0 sans. La CI ne la fournit qu'aux
  suites navigateur, qui en ont besoin pour remettre à zéro la limitation de
  débit. `verifier-avant-livraison.ts` la retire explicitement.
- `npm test` **efface la base** entre les suites : le compte de démonstration
  disparaît. Réamorcer avant de relancer les suites navigateur.
- Un serveur de développement déjà en écoute sur le port 3000 fait échouer
  `test:e2e` de façon détournée. Vérifier avant de lancer.

## Repères dans le code

| Question | Fichier |
|---|---|
| Comment le parcours doit se comporter | `docs/AGENT.md` |
| Isolation par entreprise | `src/server/db/with-entreprise.ts` |
| Où en est un devis parti | `src/lib/etat-envoi.ts` |
| Jours libres du patron | `src/server/disponibilites.ts` |
| Cycle d'envoi et réponse du client | `src/server/repositories/envois-devis.ts` |
| Facture, fin de chantier, relevé de TVA | `src/server/repositories/factures.ts` |
| Conservation, purge, effacement | `src/server/retention.ts`, `src/server/repositories/donnees-client.ts` |
| Schéma complet | `src/server/db/schema.ts` + `drizzle/*.sql` |

## Le compte de démonstration

`demo@atlas.local` / `demo1234`. Il accepte les documents légaux dans le seed,
avec la mention explicite « consentement fictif » — sans quoi toutes les suites
navigateur échouent sur la garde d'acceptation.
