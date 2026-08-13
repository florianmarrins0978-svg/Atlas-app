# Prochaines tâches

Par ordre de priorité. Une tâche terminée se **barre** avec sa date plutôt que
de disparaître : savoir qu'elle a été traitée évite de la rouvrir.

Ce fichier porte le travail de **développement**. Ce qui bloque et n'avancera
pas en codant est dans `docs/A-FAIRE.md` — tenu pour le patron, dans son
langage, et rien n'y entre sans son accord.

---

## Bloqué par une décision du patron

Rien à coder tant que ces points ne sont pas tranchés. Ne pas les redécouvrir :
ils sont écrits, avec leur coût et leur propriétaire, dans `docs/A-FAIRE.md`.

| | Ce qui débloque | Ce que je fais alors |
|---|---|---|
| 1 | Deux fournisseurs d'IA retenus | **Le code n'attend plus rien pour Anthropic et OpenAI** depuis le 2026-08-06 : poser `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` suffit à brancher l'IA (`ARCHITECTURE.md` §26), et `npm run verifier:ia` dit l'état réel. Les quatre autres noms restent des coquilles vides : leur raccordement serait à écrire. Ce qui bloque n'est donc plus la technique mais le **contrat** — sans lui, seules des données inventées peuvent être dictées. Sans clé, la dictée est recopiée mot à mot (`src/server/ai/lecture-litterale.ts`) : elle va jusqu'au devis chiffré, mais elle ignore qu'un chêne mort s'abat et qu'une haie se taille |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | ~~Fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y en aura pas** | Rien de bloqué. Le devis part de la messagerie du patron (`ARCHITECTURE.md` §13). Ne restent suspendus qu'aux conforts : relance automatique, accusé de réception, code SMS |
| 6 | Outil comptable choisi — le patron n'en a **aucun** au 2026-08-08 | Brancher son API : envoyer client, lignes, montants, taux et période, récupérer le numéro et le document émis. Quelques jours. **Rien à écrire avant le choix** — chaque outil a son API, ce serait du code à jeter. Ce qui n'est PAS en jeu : qu'Atlas n'émette pas légalement est définitif (`docs/AGENT.md` §6) |

---

## Ce que je peux faire seul

### 0 sexvicies. Faire confirmer par le patron que le numéro n'est plus un lien d'appel

**Livré le 13 août 2026, non éprouvé ici, et ça ne peut pas l'être.** Le numéro
du devis et celui de la facture s'écrivent désormais de façon qu'un détecteur
d'Apple n'y voie plus un téléphone (`ARCHITECTURE.md` §81). Cet environnement
n'a que Chromium, qui n'a jamais fait cette détection : les suites vérifient que
le texte aplati ne contient plus de suite de chiffres appelable, pas ce
qu'iOS en fera.

**Ce qu'il faut lui demander**, une fois le lot sur `main` : rouvrir le lien de
son devis **depuis ses SMS** — pas depuis Safari, le chemin compte — et dire si
« Hydration failed » revient, et si le numéro reste un texte ordinaire sous le
doigt. Sans cette réponse, ce défaut n'est pas clos : c'est la deuxième
tentative sur le même, et la première paraissait juste elle aussi.

### 0 unvicies. Le chevron de retour, dernier bouton hors charte

### 0 quatervicies. ~~Les trois points de la dictée~~ — **CODÉ le 13 août 2026 (proposition C)**

**Sa demande du 13 août 2026**, capture de l'écran « Un chantier » à l'appui :
*« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce qui se passe.
Les trois petits points sont fixes […] on ne sait pas si ça bug ou non. Si les
trois petits points se mettent en mouvement et font des vagues pour dire que
c'est en train de rédiger, là, on sait qu'il se passe quelque chose. »*

**Ce n'est pas une animation qui s'est arrêtée.** C'est le caractère « … », un
seul glyphe posé tel quel — `DicterCoordonnees.tsx:114`. Il n'y a rien qui
puisse bouger : trois points séparés sont à écrire pour qu'une vague existe.

**Deux choses aggravent l'attente**, qu'il n'a pas nommées mais qui tiennent au
même instant, et qui comptent peut-être plus que la vague :

1. le bouton passe à `opacity: 0.5` — le vocabulaire d'un bouton **éteint**,
   pas d'un bouton qui travaille ;
2. **aucune phrase ne s'affiche.** L'écran parle quand il écoute (« J'écoute —
   touchez pour arrêter. ») et quand il a fini (« 1 information reprise… »), et
   il se tait exactement pendant le seul moment où l'on se demande s'il est en
   panne. Les mots disent ce qu'aucune animation ne dira.

**Deux planches, et c'est la seconde qui tranche :**

| | Fichier | Ce qu'elle sert |
|---|---|---|
| 42 | `docs/maquettes/42-les-trois-points-qui-attendent.html` | Les cinq gestes côte à côte, et l'exposé du défaut. Doublée d'images animées (`docs/maquettes/images/`), pour la conversation |
| **43** | `docs/maquettes/43-l-attente-a-lessai.html` | **Celle qu'il manipule** — il appuie sur le micro, arrête, les points bougent. Sa demande du 13 août : *« juste des points que je puisse cliquer dessus […] pour voir comment ça rend »*. Engendrée par `scripts/engendrer-maquette-sequence.mjs` |

Les cinq attentes : A la vague (4 px), B la vague ample (7 px), **C le souffle**,
D le point qui court, E l'anneau qui tourne. **Il a répondu « code la C »** le
13 août — les quatre autres restent dans les planches, à reprendre de là si le
sujet se rouvre plutôt qu'à redessiner.

**Ce qui a été porté dans l'application :**

| | Fait | Où |
|---|---|---|
| 1 | Le geste, partagé | `src/components/atlas/PointsQuiSoufflent.tsx` |
| 2 | Les mesures (0,72 → 1,5 ; 1,25 s ; décalages 0,16 et 0,32) | `globals.css`, `.atlas-souffle` |
| 3 | L'écran | `src/app/chantiers/nouveau/DicterCoordonnees.tsx` |
| 4 | La suite qui le tient | `scripts/test-attente-dictee-e2e.ts` |

**Quatre choses à ne pas défaire**, chacune payée par un vrai défaut :

1. **Le geste vit dans un composant, pas dans l'écran.** Une attente recopiée
   divergerait comme les boutons peints à la main l'ont fait deux fois
   (`ARCHITECTURE.md` §66 et §73).
2. **Le bouton ne redevient PAS à demi effacé.** C'était la moitié du défaut :
   le vocabulaire d'un bouton éteint. Il reste hors d'atteinte (`disabled`) —
   ne pas le rendre pressable, un second appui lancerait une seconde dictée.
3. **La phrase reste.** C'est la seule des trois moitiés qui parvienne à qui n'a
   pas les yeux sur l'écran (`role="status"`), et probablement la plus utile.
4. **Sous « mouvement réduit », les points respirent encore.** Tout couper
   rendrait le défaut d'origine à qui a activé ce réglage.

**La suite RALENTIT le serveur de trois secondes**, sinon elle courrait plus vite
que l'attente et passerait au vert sans avoir rien regardé. Elle a été confrontée
au défaut d'origine : les quatre points rougissent, chacun **en nommant son
coupable** — et c'est le second jet, le premier sortait un « Timeout » sur un
sélecteur, ce qui envoie lire le contrôle au lieu de l'écran.

### 0 quatervicies ter. ~~La même attente immobile sur le bouton d'ajout de photo~~ — **fait le 13 août 2026**

Signalé en passant, puis tranché par lui le jour même : *« oui souffle aussi pour
la photo »*. `Pellicule.tsx` portait le même caractère « … » immobile que la
dictée, à la lettre près — donc le même défaut. Il prend le même composant, et
les points y sont **or** et non vert : ils héritent de `currentColor`, donc de la
couleur du bouton qui les porte. Le libellé annonce l'envoi pendant l'envoi, au
lieu de continuer à proposer d'ajouter.

**Un piège d'outillage payé ici, et qui resservira à toute suite qui RALENTIT le
serveur :** router une adresse dans Playwright **désactive le cache HTTP de toute
la page**, pas seulement des requêtes visées. La visionneuse repartait donc du
réseau pour une image déjà affichée, son `<img>` n'avait pas fini de charger, sa
boîte faisait zéro pixel — et l'échec accusait la visionneuse, qui n'y était pour
rien. Deux règles en sortent :

1. **relâcher la route dès la mesure faite** (`page.unroute`) ;
2. **la relâcher APRÈS que l'envoi soit terminé** — la couper en vol laisse un
   appel à moitié traité, et Playwright répond « Route is already handled! », une
   erreur qui n'apprend rien sur ce qu'on éprouve.

Trouvé en **affichant les images présentes** plutôt qu'en supposant : elles
étaient là, toutes les deux, au bon endroit.

**Trois choses à savoir avant d'y toucher :**

1. **Une image fixe ne peut pas montrer un mouvement.**
   `scripts/animer-maquette-points.mjs` fabrique un GIF par proposition, sans
   ffmpeg (absent d'ici) — et il relit ce qu'il vient d'écrire, parce qu'au
   premier jet il annonçait « ✓ » sur une image FIXE : `pageHeight` passé à côté
   de `raw` au lieu de dedans est ignoré **en silence**. Un script qui ne relit
   pas sa sortie certifie exactement le défaut qu'il répare.
2. **Le contrôle mesure une VAGUE, pas un mouvement.**
   `scripts/verifier-maquette-points.mjs` exige un déphasage entre le premier et
   le troisième point : trois points qui montent **ensemble** bougent de 4 px,
   passeraient tout contrôle d'amplitude, et ne feraient aucune vague. Éprouvé
   en cassant les délais — il rougit en nommant A.
3. **L'avant sert de témoin, dans les trois outils.** Il doit rester immobile
   **et à demi effacé** — le montrer à pleine encre le ferait paraître moins
   mauvais qu'il n'est, et fausserait la comparaison en sa faveur. S'il bouge,
   c'est la mesure qui ment. Le GIF le prouve tout seul : l'encodeur fusionne
   les images identiques, et l'avant se réduit à **une seule**.
4. **La 41 se PARCOURT, elle ne se constate pas.**
   `scripts/verifier-maquette-sequence.mjs` joue les deux appuis puis
   « Recommencer », sur les six. Un parcours à moitié joué ne prouve que la
   moitié qu'on joue. Deux pièges y sont écrits : le bouton d'arrêt **bat**,
   donc Playwright refuse d'appuyer dessus (`{ force: true }`, même famille que
   `locator.screenshot()`) ; et le retour du résultat est **décoché par
   défaut**, sans quoi on jugerait cinq gestes sur quatre secondes chacun.

**Ce qui reste ouvert et n'est pas dans la planche :** ce que l'écran fait quand
le traitement s'éternise. Une vague qui tourne depuis trente secondes redevient
une vague qui ne dit rien.

### 0 quatervicies bis. Les contrôles de maquette ne sont joués par personne

`scripts/verifier-maquette-*.mjs` (pastille, logo, bascule, bouton de la facture,
et désormais les points) ne sont appelés **ni par la batterie, ni par la CI** :
ils se lancent à la main. Un contrôle que personne ne joue est un contrôle qui
n'existe pas — il rougira le jour où plus personne ne saura pourquoi.

Non fait d'office : les brancher allonge `verifier:avant-livraison` de plusieurs
minutes pour éprouver des pages qui ne partent pas en production. Le bon endroit
est vraisemblablement la CI, sur les seuls fichiers touchés.

### 0 quinvicies. Le chevron de retour, dernier bouton hors charte

<!-- Renuméroté le 13 août 2026 : « 0 unvicies » désignait DÉJÀ le raccordement
     de l'agenda iCloud, plus bas, et `HANDOVER.md` le vise sous ce numéro. Deux
     sessions avaient posé le même. C'est l'aîné qui garde le sien — la règle du
     HANDOVER, « celle qui est déjà là garde son numéro ». Aucun renvoi ne
     visait celui-ci. -->

**Trouvé le 13 août 2026**, en réparant le contrôle des boutons arrondis : son
motif ne regardait ni les `<Link>`, ni les rayons NOMMÉS de Tailwind. Réparé, il
dénonce **six** boutons. Un seul était celui que le patron signalait (« Créer la
facture »), corrigé le jour même. Les cinq autres n'ont jamais été arbitrés :

- ~~`src/app/devis/[jeton]/formulaire.tsx` — accepter, demander une correction,
  refuser~~ et ~~`src/app/factures/[jeton]/page.tsx` — le téléchargement du
  PDF~~ : **tranché par le patron le 13 août 2026**, capture des deux écrans à
  l'appui. « Oui » : ses clients voient la capsule eux aussi. Les couleurs
  propres à ces écrans restent — c'est l'identité qui devait rester distincte,
  pas la forme du geste ;
- `src/components/ScreenHeader.tsx` — le chevron de retour, 32 × 32 en
  `rounded-md`. **Seul point restant.** Une icône encadrée, pas un bouton
  d'action : l'arrondir entièrement en ferait une pastille ronde, ce qui n'a
  été demandé nulle part. Question posée le 13 août, sans réponse à ce jour.

Ils sont **déclarés comme exceptions nommées** dans
`scripts/test-boutons-arrondis.ts`, chacune avec sa raison : un bouton NEUF écrit
carré ailleurs fait toujours rougir le contrôle.

**Répondu le 13 août 2026 :** la capsule descend jusqu'à son client. Reste le
chevron, sur lequel il ne s'est pas prononcé — et qui n'est pas un bouton
d'action, d'où l'hésitation.


### 0 tervicies. `test-planning-vers-facture-e2e` échoue par intermittence, et son message est trop affirmatif

**Constaté le 13 août 2026, en éprouvant autre chose.** Le dernier cas de cette
suite — *« clôturé AVANT sa date : il quitte le planning pour les terminés »* —
échoue **par intermittence** sur `page.goto` au bout de 45 s, tantôt sur
`/termines`, tantôt sur `/planning`. Sur **six exécutions** ce jour-là : quatre
rouges, deux vertes.

**Et « le serveur est chargé » n'explique plus.** `ouvrir()` fait déjà DEUX
tentatives de 45 s : la page reste donc muette **plus de quatre-vingt-dix
secondes**, alors qu'elle répond en 333 ms mesurées hors batterie. Ce n'est pas
de la lenteur, c'est un blocage. Piste non écartée, faute de l'avoir creusée :
l'épuisement du bassin de connexions (`poolMax`) en fin de batterie — cette
suite bâtit sept chantiers avec devis et PDF, et c'est la plus lourde du lot.

**Ce n'est PAS la civilité** : vérifié en remisant toutes les modifications du
jour et en rejouant la suite sur `main` intact — même échec, au même endroit.
Le défaut lui est antérieur.

**Et son message n'explique pas tout.** Il affirme : *« C'est le serveur de
développement qui n'a pas suivi, pas l'écran : il répond en quelques centaines
de millisecondes hors batterie »*. Or **la suite a aussi échoué jouée seule**,
sans aucune autre en parallèle — la charge de la batterie ne suffit donc pas à
l'expliquer. Un message qui donne une cause certaine là où elle ne l'est pas
envoie chercher au mauvais endroit (`AGENTS.md`).

**Ce qui reste à faire :** trouver ce que ce cas-là fait de particulier — c'est
le seul des trois de son groupe à clôturer un chantier **avant** sa date — puis
rendre le message honnête sur ce qu'il sait et ce qu'il suppose. Les six autres
cas de la suite passent toujours.

### ~~0 duovicies. La civilité du client~~ — **tranchée et codée le 13 août 2026**

**Sa décision, le soir même :** *« Tu as raison, il faut intégrer une case
monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable, on
choisit au-dessus du nom. »* C'est fait — deux pastilles à la création et sur
l'écran du devis, `ARCHITECTURE.md` §81.

**Ce qui reste ouvert, et qu'il faudra lui poser un jour :** une civilité choisie
de travers **ne se corrige plus** après la création. Les pastilles avaient été
posées sur l'écran du devis pour cela ; il les y a fait retirer le jour même —
*« il ne faut pas qu'il y ait les pastilles cliquables sur le devis »* — et il a
raison sur le fond : cet écran est le document, pas la fiche. Il manque donc un
**écran de fiche client**, qui n'existe nulle part aujourd'hui. Tant qu'il ne le
demande pas, on ne l'invente pas. Qui peut le faire : lui.

**Et un second point ouvert :** il n'y a que deux pastilles. Une société se dit donc en n'en touchant aucune — l'application
reconnaît alors « SARL », « SCI », « Mairie »… et se tait. Cela suffit
aujourd'hui : ses clients sont des particuliers. **À rouvrir le jour où il
facture des entreprises**, où une troisième pastille dirait la chose au lieu de
la laisser deviner. Qui peut le faire : lui.

*Ce qui suit est gardé parce que le raisonnement resservira le jour de cette
question-là.*

### ~~0 duovicies bis. La civilité du client — l'arbitrage d'origine~~

Le 13 août 2026, il a demandé que le devis dise « Mr. Martins » et non « Chez
Martins ». C'est **fait**, écran et message tout prêt compris
(`ARCHITECTURE.md` §77). Mais la fiche client ne porte **aucun champ de
civilité** : « Mr. » est un défaut posé sur tout nom qui n'en annonce pas
d'autre.

**Ce que ça veut dire concrètement, et pourquoi ça ne peut pas rester ainsi
indéfiniment :** une cliente saisie « Roux » verra « Mr. Roux » sur son devis,
**et le message qui part chez elle dira « Bonjour Mr. Roux »**. L'application sait déjà se taire devant « Mme Roux » ou « SARL Untel » —
ces deux cas sont couverts — mais elle ne devine pas un patronyme nu.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | **Un choix à la création du client** : trois pastilles — Mr., Mme, ni l'un ni l'autre (société). Un appui. | La seule qui dise la vérité. Coûte une colonne, une migration, et trois pastilles sur un écran déjà chargé. |
| b | Laisser le patron écrire « Mme Roux » lui-même dans le nom | Gratuit, marche déjà — mais il faut qu'il y pense à chaque fois, et un oubli part chez la cliente. |
| c | Ne rien mettre du tout et revenir au nom nu | Annule sa demande du 13 août. |

**Qui peut le faire : lui seul.** C'est un arbitrage de produit, pas un choix
technique — et rien ne sera ajouté sans son accord (`CLAUDE.md` §4).

*(La seconde question — le message qui part chez le client — a été tranchée le
soir même : il dit désormais « Bonjour Mr. Martins ». C'est ce que ses clients
lisent, et c'est donc là que l'erreur de civilité se verra en premier.)*

### ~~0 octodecies. Le message du devis figé désignait une porte invisible~~ — **codé le 2026-08-13 (proposition A)**

**Rien n'est codé** (`CLAUDE.md` §3 bis). Le patron, le 13 août, capture à
l'appui : *« le message dit de consulter la case devis mais aucune case devis
existe »*, et il demande un avis — créer la case, ou retirer le message ?

**Ce qui est vrai, vérifié dans le code :** l'écran Devis existe bien
(`/chantiers/[id]/export`, `chantier-etat.ts` le pose comme étape « Devis »),
mais il vit dans le **tiroir** de la fiche, et **aucune porte n'y mène depuis
`devis-complet`** — où le message s'affiche. De plus, **deux écrans s'appellent
« Devis »** de son point de vue : celui qu'il regarde, et celui où l'on corrige.

`docs/maquettes/40-le-message-du-devis-fige.html` — témoin + trois façons :

| | Ce que c'est | Ce que ça coûte |
|---|---|---|
| A | le message devient la porte (lien sous la phrase) | rien — la retouche la plus courte |
| B | un vrai bouton en capsule | il attire l'œil avant le devis qu'on vient lire |
| C | plus de message du tout | le jour où il touche un prix, rien ne se passe et rien ne le dit |

**Mon avis, donné et assumé : A.** Ne PAS créer de nouvelle case — l'écran
existe, et lui donner un second accès permanent ferait deux portes vers la même
pièce, ce qu'on vient d'éviter sur l'écran du devis.

**Les mots ne sont pas tranchés** : « Le corriger et le renvoyer », « Corriger
ce devis », « Reprendre le devis ». Ils lui appartiennent.


### 0 unvicies. ~~Relier l'agenda iCloud~~ — **codé le 12 août 2026**, reste à éprouver chez lui

**Sa question du 12 août 2026**, capture du Calendrier d'Apple à l'appui : *« je
peux connecter ce calendrier à mon appli ? »* Réponses obtenues : le compte
derrière la vitrine est **iCloud**, et il veut **les deux sens** — Atlas lit ses
rendez-vous, Atlas y écrit ses chantiers.

**Codé, éprouvé pour tout ce qui décide, et pas au-delà** — le détail et le
pourquoi sont dans `ARCHITECTURE.md` §75, la réponse en langage courant dans
`docs/QUESTIONS.md` §14.

| | Fait | Où |
|---|---|---|
| 1 | Migration : `fournisseur IN ('google','apple')`, mot de passe chiffré, agendas lus, calendrier d'écriture | `drizzle/0035_agenda_apple.sql` |
| 2 | CalDAV : découverte, `calendar-query`, `PUT`, `DELETE` | `src/server/agenda/apple.ts` |
| 3 | Lecture et écriture de l'iCalendar | `src/lib/ics.ts`, `src/lib/caldav.ts` |
| 4 | L'écran, d'après la maquette | `src/app/reglages/agenda/AgendaAppleClient.tsx` |
| 5 | Les chantiers montent et redescendent avec le planning | `src/server/repositories/agenda-apple.ts` |

**CE QUI RESTE, et qui ne peut pas être fait ici :** aucun échange réel avec
iCloud n'a eu lieu — le réseau refuse `caldav.icloud.com` (essayé le 12 août,
connexion refusée). Restent à éprouver **sur son banc**, avec un vrai mot de
passe pour les apps : la découverte des agendas, la lecture, le dépôt, le
retrait. **Ne pas annoncer le raccordement comme éprouvé avant.**

**Ce qui se cassera en premier, si quelque chose casse**, et par où commencer :

1. **la découverte** — iCloud redirige de `caldav.icloud.com` vers le serveur du
   compte ; les redirections sont suivies à la main pour que `PROPFIND` ne
   devienne pas `GET` ;
2. **la double authentification** — sans elle, Apple n'émet pas de mot de passe
   pour les apps, et le refus arrive en 401 comme un mot de passe faux ;
3. **le dépôt** — un agenda partagé en lecture seule est déjà écarté de la
   liste, mais un serveur qui n'annonce pas ses privilèges est supposé
   inscriptible : le refus n'arriverait alors qu'au `PUT`.

Ce que le patron verra dans les trois cas : la phrase d'Apple, telle quelle, sur
l'écran des réglages. C'est voulu — une erreur reformulée envoie chercher au
mauvais endroit.

### 0 vicies. Le badge de Next recouvre son onglet « Chantiers »

**Mesuré le 12 août 2026**, en cherchant pourquoi la CI virait au rouge six
fois de suite sur `test-rien-de-recouvert-e2e.ts`.

Le badge de développement de Next — celui qui affiche « 1 Issue », et par lequel
le patron a trouvé l'erreur d'hydratation de Safari — se pose **en bas à
gauche**, exactement sur l'onglet « CHANTIERS » (mesuré : l'onglet occupe
x 14→105, y 632→654 ; le badge, 56 px dans le coin, le recouvre). Il
n'apparaît que lorsqu'il a quelque chose à signaler — d'où une CI rouge par
intermittence, et une suite verte ici où rien n'était signalé.

**La suite l'écarte désormais nommément** : ce badge n'existe pas dans la
version bâtie, et un contrôle qui échoue au hasard apprend à ignorer le rouge.
Le témoin vérifie qu'un vrai recouvrement est toujours attrapé.

**Mais chez lui, le problème est réel** : son banc sert le mode développement,
donc le badge est sur son écran, sur sa navigation.

Trois pistes, aucune tranchée — et aucune bonne telle quelle :

- le **déplacer** (`devIndicators: { position }`) : les deux coins du bas sont
  pris par la barre d'onglets, et sur l'accueil les deux coins du haut portent
  déjà un bouton. Mesuré, pas supposé ;
- l'**éteindre** (`devIndicators: false`) : on perdrait le « 1 Issue » — or
  c'est par lui qu'il a signalé la panne de Safari. Mauvais échange ;
- faire **servir une version bâtie** à son banc, où le badge n'existe pas. C'est
  probablement la bonne réponse, et elle dépasse ce point.

### 0 quindecies. ~~La ligne « Planifiés » porte un geste de trop~~ — **réglé le 12 août 2026**

Vu en capture en posant le chevron : la ligne portait trois gestes et un nom sur
390 px, et c'est le nom qui cédait — « Chez M. Bernard » s'affichait
« Chez M. Be… ».

**Il a tranché le jour même**, en regardant la capture : *« il faut que le créer
la facture, tu le mettes dans le chevron. Il faut cliquer sur le chevron, la
page s'ouvre avec le GPS et tout machin, et là tu mets créer la facture. »*
« Créer la facture » est donc passé dans la feuille ; la ligne ne garde que le
nom, la date, « Déplacer » et le chevron. Le nom passe d'environ 110 px à plus
de 250. `ARCHITECTURE.md` §70.

### 0 quaterdecies bis. ~~Un chantier sans adresse n'a plus de chemin pour la saisir~~ — **réglé le 13 août 2026**

Il a tranché sur maquette (`docs/maquettes/34`, variante B) : *« ça, c'est au cas
où la fiche entière n'a pas été rentrée. Dans ce cas-là, tu peux faire ça, mais
avec le bouton, tu le mets arrondi. »*

Un bouton **« Saisir l'adresse »** en pastille creuse, qui n'apparaît que sans
adresse et mène au devis complet — seul écran où elle s'édite.
`ARCHITECTURE.md` §70.

### 0 nonies. ~~L'écran de connexion est resté dans l'ancienne identité~~ **fait le 12 août 2026**

**Vu en capture le 12 août 2026**, en vérifiant que les boutons arrondis
n'avaient rien cassé. `src/app/login/page.tsx` n'a jamais été repris par la
refonte du 10 août :

- son bouton est en **terre cuite `#B5502F`**, couleur abandonnée le 3 août
  quand l'application est passée à Arborea — écrite en dur, hors
  `design-tokens.ts` ;
- carte blanche, bordures grises, aucune serif de titre, aucun jeton de la
  charte.

**C'est le PREMIER écran qu'il voit**, et le seul qui ne ressemble pas à Atlas.
Même remarque pour `src/app/documents-legaux/formulaire.tsx`, qui porte la même
couleur en dur.

**Fait le 12 août 2026** : maquettes 32, 33 et 34, puis `src/app/login/page.tsx`.
Reste `src/app/documents-legaux/formulaire.tsx`, qui porte la même terre cuite en
dur et n'a pas été repris — il échappe au parcours pour la même raison que la
porte (`ARCHITECTURE.md` §71).

**Il a choisi, et demandé une suite le 12 août 2026 au soir :** la proposition 4
**sans son titre ni sa sous-ligne**, avec **le sceau et ATLAS du modèle 3**, plus
**une animation de la marque d'une demi-seconde à l'entrée**. Six animations lui
sont proposées dans `docs/maquettes/36-le-logo-qui-sanime.html` — **en attente de
son numéro**. Rien n'est encore posé.

**Il a retenu « le tour » le 12 août au soir**, et demandé d'autres gravures
dans le rond d'or : huit motifs dans
`docs/maquettes/37-le-motif-du-sceau.html` — **son numéro est attendu**.
L'écran, le rond et l'animation n'y bougent plus ; seul le tracé change.

**Ce qu'il faudra trancher avec lui au moment de coder** (écrit sur la maquette) :
la demi-seconde est un **plancher**, pas la durée de l'attente. Le serveur répond
quand il répond ; l'animation ne doit ni être coupée en son milieu, ni se figer
si la réponse tarde. Les propositions 3, 4 et 6 bouclent d'elles-mêmes ; les 1, 2
et 5 se dessinent d'un bout à l'autre et demandent une décision explicite.

**Maquette livrée le 12 août 2026 — `docs/maquettes/35-l-ecran-de-connexion.html`**
(« oui, fais-moi une maquette avant/après »). L'avant reproduit, puis quatre
après : la carte gardée, sans carte, le sceau, la ligne d'imprimé. **En attente
de son choix — `src/` n'a pas été touché.**

**Et un défaut de plus, trouvé en dessinant :** les champs sont écrits en
**15 px**, alors que `styleChampPlage` impose 16 px depuis le 10 août précisément
parce qu'**en dessous, iOS agrandit la page dès qu'un champ prend le focus**. Il
tape son adresse et l'écran lui saute au visage. Ce défaut-là ne dépend d'aucune
proposition : il se corrige avec celle qu'il retiendra. Même remarque pour le
refus de connexion, peint en `text-red-600` (rouge de Tailwind) au lieu du
`colors.alert` de la charte.

### 0 octies. Les actions principales encore dessinées à la main

**Trouvé le 12 août 2026, parce que le patron l'a vu avant nous.** La feuille
d'envoi du devis dessinait son bouton sur place ; la capsule ne l'avait donc
jamais atteinte. Corrigé pour le parcours d'envoi (`EnvoiAuClient`,
`TransmettreAuClient`).

**Restent, repérées mais NON converties :** `DevisDepuisDictee`,
`BrouillonSection` (informations), `PropositionPrixSection` (prix), et les
écrans de réglages (agenda, vocabulaire, import de tarifs). Chacune est un
`<button>` peint en `colors.rust` au lieu d'un `PrimaryButton`.

**Pourquoi ce n'est pas fait d'office :** sa règle du 11 août — *« montre-moi
avant de faire, plutôt que de faire pour revenir en arrière »*. Il faut donc lui
montrer ces écrans avant/après, puis convertir. `scripts/capture-bouton-partout.mjs`
sait le faire pour les écrans qui ont une ADRESSE ; les feuilles qui montent sur
un geste demandent d'ouvrir le tiroir — c'est ce qui manque au script, et c'est
exactement le trou par lequel ce défaut est passé.

### ~~0 quindecies. Un serveur fantôme sur le port 3000, et la batterie accusait le prix~~ — **corrigé le 11 août 2026**

**Vu sur une batterie qui venait de passer entièrement au vert.** La même
commande, rejouée sur le même code, a donné deux rouges :

| Ce qu'on lisait | Ce que c'était |
|---|---|
| `test-prix-e2e` : `'0.00' == '34.50'` | un enregistrement qui n'a pas eu le temps de partir — l'occupant du port compilait |
| `❌ Le port 3000 est déjà pris.` | la vraie cause, mais annoncée **en dernier**, deux étapes trop tard |

**La cause, établie et non supposée.** Une sentinelle a noté ce qui tournait au
moment où le serveur apparaissait : parent déjà mort (`ppid = 1`), aucune suite
en cours, `/tmp/atlas-banc.pid` à la même minute. Ce n'était donc **pas** une
suite oublieuse — l'hypothèse écrite d'abord, et fausse — mais
`verifier-connexion-avec-serveur.mts`, qui lance `npm run banc` puis tue son
groupe dès la connexion éprouvée.

Pourquoi le serveur survivait : `banc.mjs` **sert d'abord et bâtit ensuite**, et
ses gestionnaires de `SIGTERM` vivaient en **fin de fichier**, c'est-à-dire après
la construction. Entre le lancement du serveur et leur installation, il
s'écoulait plusieurs minutes ; un signal reçu dans cette fenêtre tuait le script
net, et le serveur — **détaché**, pour d'excellentes raisons — survivait,
accroché au port. Un gardien juste, arrivé en retard.

**Corrigé en deux endroits :**

1. `scripts/banc.mjs` — les gardiens sont posés **ligne suivante après le
   lancement**, avant toute attente.
2. `scripts/run-e2e-tests.ts` — la batterie **refuse** désormais un port déjà
   pris, au lieu de se rabattre en silence sur l'occupant. C'était le plus grave
   : cinquante suites avaient travaillé, une fois, sur un serveur qu'elle
   n'avait pas lancé, **sans un mot**.

**Éprouvé, dans les deux sens** (`test-prechauffage.ts`, section « deux serveurs
ne se battent plus pour le port ») :

- gardiens remis en fin de fichier → rouge, en nommant la fenêtre ;
- garde neutralisée d'un `if (false && …)` → rouge. La première version du
  contrôle cherchait le nom de la fonction et restait verte : **un contrôle qui
  se contente de trouver un mot ne protège que du mot** ;
- et en vrai : le script de connexion rejoué rend le port (`000`), là où il
  laissait un serveur ; la batterie navigateur, lancée sur un port occupé,
  s'arrête en une seconde avec le remède à taper.

### ~~0 sexdecies. Des suites dépassent leur délai en batterie et font rejouer 25 minutes~~ — **CAUSE TROUVÉE le 2026-08-12**

**Quatre faux rouges dans la journée, sur trois suites sans rapport** —
« clôturé AVANT sa date » (deux fois), « Créer la facture », puis « un appui
dicte, un second enregistre ». Chacune diagnostiquait la même chose et avait
raison — le serveur de développement n'avait pas suivi — et chacune passait au
vert jouée seule. Coût : une batterie complète rejouée à chaque fois.

**Ce n'était pas la machine** : 13 Go libres, charge à 1,2. C'était le
préchauffage de `run-e2e-tests.ts`, et il avait deux défauts qui n'en font
qu'un :

1. **il tournait sans session.** Un appel anonyme sur `/termines` est renvoyé
   vers `/login` par le middleware : la route visée n'est jamais rendue, donc
   jamais compilée. Il ne préchauffait que `/login` — et faisait croire au
   contraire ;
2. **sa liste était incomplète.** `/termines`, justement, n'y figurait pas.

**Les deux venaient d'une deuxième implémentation.** `scripts/prechauffer.mjs`
sait ouvrir une session et parcourir la liste complète, écrans de chantier
compris — c'est ce que le banc d'essai fait depuis toujours. La batterie avait
sa propre version naïve. Deux copies de la même idée finissent toujours par
diverger, et c'est la plus faible qui servait ici.

La batterie emprunte désormais le même préchauffage que le banc.

**Ce qui reste à surveiller :** si un faux rouge de ce genre revient malgré le
préchauffage, ne pas allonger les délais — cela cacherait un écran devenu lent
au lieu de le dire. Mesurer d'abord quel écran, et pourquoi.

### 0 quaterdecies. Deux maquettes `/design` décrivent un écran supprimé

**Né le 11 août 2026**, en supprimant `/chantiers/[id]/photos` (`ARCHITECTURE.md`
§60). Restent derrière lui :

- `src/app/design/photos/page.tsx` — la maquette d'un écran qui n'existe plus ;
- `src/app/design/hub/page.tsx` — un lien `/chantiers/1/photos` désormais mort
  (tous les liens de cette maquette le sont déjà : elle vise un chantier « 1 »
  imaginaire) ;
- le tableau du §4 bis de `docs/INTEGRER-ORIGINE.md`, qui cite le fichier
  supprimé — mais ce document raconte un **état daté**, et le réécrire
  falsifierait ce qu'on savait ce jour-là.

**Volontairement pas touché dans le même lot** : ces maquettes ne sont ni des
écrans du produit ni de la mémoire, et le patron avait demandé qu'on ne corrige
pas ce qui n'était pas demandé. À trancher : les supprimer, ou les marquer
« maquette historique ».

### ~~0. « Impossible d'enregistrer la note »~~ — **CAUSE TROUVÉE ET REPRODUITE le 2026-08-12**
### ~~0 septdecies. L'écran du devis parti~~ — **codé et éprouvé le 2026-08-12**

*« Code le 5 »* — le signet d'or. `ExportClient.tsx`, `TransmettreAuClient.tsx`,
`src/lib/numero-lisible.ts`, `scripts/test-devis-parti-signet-e2e.ts`. Les mesures
viennent de `docs/maquettes/34-le-devis-sur-sa-base.html` : **les reprendre de là**
si on y retouche, jamais de mémoire.

**Cinq choses à ne pas défaire, chacune payée par un défaut réel :**

1. **`atlas-ecran` sur la page, pas de hauteur écrite à la main.** Deux
   tentatives ont débordé avant — un en-tête « mesuré » à 232 px, puis
   `min-h-screen` + `pb-16` qui comptait deux fois la barre du bas
   (`main.atlas-contenu` la réserve déjà). 100 px, puis 68.
2. **L'avertissement de « Modifier mon devis ».** Rouvrir un devis parti crée une
   version mais **n'annule pas l'envoi** : le client voit toujours celle qu'il a
   reçue et peut l'accepter au prix d'avant. Refuser ne doit créer AUCUNE version.
3. **Le voile de la feuille est `aria-hidden`** — sinon deux boutons s'appellent
   « Annuler », et qui ne voit pas l'écran en entend deux.
4. **La bascule de canal reste.** Elle manquait à mes cinq maquettes ; la livrer
   ainsi aurait défait sa demande du 4 août.
5. **`numeroLisible` refuse de grouper ce qu'elle ne reconnaît pas.** Un numéro
   étranger découpé par paires aurait l'air juste sans l'être — pire que rien sur
   une ligne dont le seul rôle est la vérification.

**Ce qui reste ouvert, et n'a pas été tranché :** le rayon du bouton. Tout est au
rayon d'aujourd'hui (4 px). La bande de comparaison — 4, 8, 12, pilule — est au
bas de `docs/maquettes/33-le-devis-parti-allege.html`. Son choix vaudra pour
**vingt-sept écrans** (`PrimaryButton`) : ne pas le poser sur ce seul écran.

*Ce qui suit est l'énoncé d'origine, gardé parce qu'il porte la mesure.*

### ~~0 septdecies bis. L'énoncé~~ — le CONTENU arrêté par lui le 12 août

**Arrêté par lui le 12 août** — c'est acquis, ne pas le rediscuter :

- ne garder que **le nom du devis et le total** ;
- **retirer les lignes de prestations** ;
- un lien **« Modifier mon devis »** sous le total, qui ramène au devis ;
- « Télécharger le PDF », « Copier le lien », « Partager » **en encre foncée**,
  visiblement cliquables.

`docs/maquettes/34-le-devis-sur-sa-base.html` : sa base au mot près, plus quatre
mises en page du même contenu (sans carte · dans le titre · actions empilées ·
signet d'or). **Rien n'est codé** tant qu'il n'a pas donné un numéro.

**Trois points ouverts, à ne pas trancher seul :**

1. **Reprendre un devis déjà parti crée une nouvelle version** et rend l'ancien
   lien caduc. Faut-il le prévenir au clic sur « Modifier mon devis » ? Une
   phrase courte, une seule fois, est proposée — pas décidée.
2. **« Partager autrement (WhatsApp… ) » ne tient pas** à trois sur une ligne. Il
   devient « Partager », ou les trois s'empilent (idée 4). Son choix.
3. **Le rayon du bouton reste sans réponse** (bande de la maquette 33 : 4, 8, 12,
   pilule). Tout est dessiné à 4 px pour ne rien présumer.

### ~~0 sexdecies. L'écran du devis parti : quatre maquettes~~ — **dépassée le 2026-08-12 par la 26**

*Gardée parce qu'elle porte la mesure d'origine : onze blocs, 382 px de trop.*

**Rien n'est codé, et rien ne doit l'être avant qu'il ait désigné une lettre**
(`CLAUDE.md` §3 bis). Il a demandé la maquette explicitement : *« fabrique-moi la
maquette et montre-la-moi avant de coder quoi que ce soit »*.

`docs/maquettes/33-le-devis-parti-allege.html`. Mesuré : l'écran porte **onze
blocs** et déborde de **382 px** sur sa dalle.

| | Blocs | Ce qu'elle retranche | Ce qu'elle coûte |
|---|---|---|---|
| A | 6 | l'adresse illisible, la phrase en double, la carte Chantier/Client | il ne relit plus l'adresse à l'œil |
| B | 4 | la carte d'état, montée dans le titre | un appui pour les autres canaux |
| C | 5 | le devis replié derrière une ligne | un appui pour le détail |
| D | 3 | tout sauf le montant et le geste | rien du devis sans un appui |

**Trois choses que la maquette propose et qui ne sont PAS acquises :** « il y a
2 jours » (la date d'envoi est en base, jamais affichée) ; le libellé qui passe
d'« Ouvrir le SMS tout prêt » à « Relancer par SMS » une fois le devis parti ; et
le numéro écrit espacé plutôt que collé.

**Et le rayon du bouton, qui se choisit en même temps.** Il a dit *« le bouton
est toujours carré »*. Vérifié : il est **déjà au rayon des cartes** (4 px,
`radius.card`, posé le 10 août à sa demande). Ce n'est pas un oubli — c'est que
sur un aplat vert foncé, 4 px ne se voient pas. La bande du bas de la maquette
montre 4 / 8 / 12 / pilule. **Son choix vaudra pour vingt-sept écrans**
(`PrimaryButton`) : ne pas le poser sur ce seul écran, deux formes de bouton
dans la même application est précisément ce qui vient d'être démêlé.

### ~~0 quindecies bis. « Le mail n'est pas parti »~~ — **ce n'était pas un défaut, 2026-08-12**

**Ne pas rouvrir, et surtout ne rien « réparer ».** Signalé comme une panne —
*« lorsque le mail est parti je n'ai pas de message qui prouve qu'il est bien
parti, la page reste figée »* — puis démenti par lui-même dans la foulée :
*« en fait le mail n'était pas parti […] il y avait une faute sur l'adresse
mail »*.

Sa messagerie s'est bien ouverte ; l'adresse du destinataire était fausse.
Vérifié avant de conclure : la CSP ne régit pas la navigation `mailto:`
(`next.config.ts`), et l'adresse construite pour son cas exact fait
574 caractères — très en deçà de toute limite. `useRetourDeMessagerie` n'a donc
pas renvoyé à l'accueil pour la seule bonne raison : **il n'est jamais parti de
la page**.

### 0. Si « Impossible d'enregistrer la note » revient : lire la phrase, ne pas la deviner
**Ouvert le 11 août 2026, et volontairement laissé ouvert.** Le patron a signalé
ce message ; il n'a **pas pu être reproduit ici** — la dictée passe avec un micro
simulé, en développement comme sur la version bâtie derrière une origine
étrangère. Ce qui a été corrigé, c'est le silence : l'écran nommait le refus
« Impossible… Réessayez » quelle qu'en fût la cause, et rien n'était journalisé.

**Le 12 août, le patron a rapporté la phrase — et elle accusait le mauvais
coupable.** Il a lu *« L'enregistrement n'a pas pu être transmis — la connexion
a été interrompue »*. C'était la branche `catch` de l'écran, c'est-à-dire la
seule catégorie que le correctif de la veille avait laissée muette : les refus
ATTENDUS étaient devenus bavards, les pannes IMPRÉVUES continuaient de lever.
**Le correctif était à moitié fait, et la moitié manquante était exactement
celle qui se produisait.**

Pire que muet : cette phrase désignait le réseau alors que l'aller-retour avait
peut-être très bien eu lieu. Elle envoyait chercher au mauvais endroit.

Deux choses ont changé le 12 août :

1. **L'action ne lève plus rien.** Toute panne rend une phrase qui **nomme le
   maillon** — session, cadence, lecture, stockage, base (`src/lib/panne-note-vocale.ts`).
   Le disque plein, le droit d'écriture refusé et le service absent ont leur
   propre phrase, parce qu'ils appellent chacun un geste différent.
2. **L'écran ne conclut plus, il demande.** Quand l'appel lui-même échoue, il
   interroge le serveur avant de parler (`src/lib/diagnostic-liaison.ts`) :
   s'il répond, ce n'était pas la connexion mais une **page vieillie** — le cas
   le plus probable sur ce banc, où l'espace se reconstruit et où les actions
   changent d'identifiant sous une page déjà ouverte.

**Puis la cause a été trouvée, le 12 août, en reproduisant son parcours plutôt
qu'en raisonnant dessus.** Une action serveur porte un identifiant fabriqué à la
construction ; son banc se met à jour tout seul ; une page restée ouverte appelle
un identifiant disparu, et l'envoi échoue sans atteindre le serveur.
`scripts/eprouver-page-vieillie.mts` le rejoue : code d'avant, `500` et le
message du patron mot pour mot. L'enregistrement passe désormais par une URL
(`ARCHITECTURE.md`, `HANDOVER.md`).

**Ce qui reste utile si une panne d'un autre ordre survient :** les phrases
ci-dessous désignent chacune un endroit différent, et aucune ne demande de
deviner.

| Ce qu'il lit | Ce que ça désigne |
|---|---|
| « (étape : session) » | sa session a expiré — recharger et se reconnecter |
| « (étape : stockage) », disque plein | l'espace de travail n'a plus de place |
| « (étape : cadence) » ou un service qui ne répond pas | Redis absent — l'espace est à relancer |
| « (étape : base) » | la fiche n'a pas pu être mise à jour — le journal porte le détail |
| « cette page a été ouverte avant la dernière mise à jour » | il suffit de recharger |
| « le serveur est injoignable depuis ce téléphone » | c'est bien le réseau, cette fois |

**Ne rien supposer avant d'avoir la phrase** : trois diagnostics à distance ont
déjà coûté un aller-retour chacun.

**Ce qui n'est toujours pas fait, et qui coûte à chaque échec :** la note captée
est **perdue** quand l'envoi échoue — il faut tout redicter. La garder en local
(IndexedDB) et la reproposer au retour serait le vrai confort ; ce n'est pas
fait, et ce n'est pas un détail pour quelqu'un qui dicte debout sur un chantier.


### ~~0 bis. Si le fil accroche ENCORE chez le patron : le masque, sur iOS~~ — **close le 2026-08-11 par le patron lui-même**

**Ouvert puis refermé le même soir, et c'est le refermer qui compte.** Le
saccadé avait pour cause `scroll-snap-stop: always`, retiré ; la mesure
(`scripts/mesurer-fluidite-fil.mts`) mettait le masque en dégradé et l'animation
d'opacité hors de cause — mais elle avait mesuré **Chromium sans tête sur cette
machine**, pas Safari sur son iPhone, et elle ne pouvait pas produire l'élan d'un
vrai doigt. Ce point restait donc ouvert par honnêteté, pas par doute.

**Le patron a tranché, sur son téléphone :** *« la fluidité de l'iPhone, ça
aussi, ça a été corrigé. »* Le retrait de l'accroche suffisait ; le masque
n'était pour rien dans la plainte.

**Ce qu'il faut en retenir, et pourquoi ce point reste écrit plutôt que
supprimé :** le `mask-image` de `.atlas-fil-defile` est **hors de cause, vérifié
sur le vrai appareil**. Quelqu'un finira par le soupçonner — c'est le suspect
qui vient à l'esprit dès qu'on parle de défilement qui accroche sur iOS. Le
déplacer coûterait du travail et du risque pour rien. Le correctif de repli
reste décrit ci-dessous **au cas où une plainte NOUVELLE apparaîtrait**, pas
pour celle-ci, qui est réglée.

Repli, si et seulement si le sujet revient : **déplacer le fondu sur
`.atlas-ecran`**, en deux dégradés posés PAR-DESSUS (couleur `--card`,
`pointer-events: none`), plutôt qu'en masque SUR le cadre qui défile. Deux
précautions alors : les dégradés se placent aux bords de la zone qui défile, pas
du cadre (l'en-tête n'est pas dedans), et une capture avant/après doit être
identique — sinon on aura échangé un défaut contre un autre.

### ~~0 septies. Les deux portes de la création~~ — **close le 2026-08-11**

Il a choisi, maquettes en main : la **bascule « le trait qui glisse »**
(`docs/maquettes/26-la-bascule-affinee.html`, déclinaison 1) et le bouton **« la
capsule »** (`docs/maquettes/28-le-bouton.html`, proposition 5). Les deux sont en
place sur l'écran de création, et « Je l'écris » mène à la page du devis entier
avec le client déjà en en-tête. Le raisonnement complet est dans
`ARCHITECTURE.md` §64.

**Tranché le 11 août au soir : « partout ».** La capsule est la seule forme
d'action principale de l'application, sur les dix-sept écrans, et la variante
rectangulaire a été retirée. Elle lui a été montrée **sur ses vrais écrans avant
d'être posée** — sa règle : « montre-moi avant de faire, plutôt que de faire pour
revenir en arrière ». `scripts/capture-bouton-partout.mjs` refait la planche.

### ~~0 ter. Les suites navigateur mesuraient un écran que personne ne possède~~ — **close le 2026-08-11**

**Trouvé le 11 août 2026, et le patron l'a payé.** Les suites posaient un cadre
de 393 × 852. La hauteur **utile** d'un vrai iPhone 13, barre du navigateur
déduite, est de 390 × **664** (`devices["iPhone 13"]` de Playwright). Sur ce
cadre trop haut, un contrôle de chevauchement passait au vert alors que, sur son
téléphone, la bulle de l'assistant recouvrait « ou rédiger le devis à la main ».

**Fait.** L'écran vit désormais dans `ECRAN_DU_PATRON` (`scripts/e2e-browser.ts`)
et toutes les suites en héritent ; deux tolérances écrites à la main sont tombées
avec (« 400 px » de débordement toléré sur un écran de 393 ; une grille cadrée à
393 au lieu de 390).

**Ce que ça a trouvé : rien.** 46/47, l'unique rouge étant un dépassement de
délai du serveur de développement. Il fallait quand même le faire — un contrôle
qui mesure un écran inventé ne prouve rien, vert ou rouge — mais le dire tel
quel : le cadre honnête n'a révélé aucun défaut caché.

**Ce qui manquait vraiment**, et qui existe maintenant :
`scripts/test-rien-de-recouvert-e2e.ts`, qui cherche sur quatorze écrans ce que
le doigt n'atteint pas. Un seul écran vérifiait cela auparavant, pour un seul
bouton.

### ~~0 quater. Le bandeau d'alerte est coupé en haut, à l'arrivée sur l'accueil~~ — **tranché le 2026-08-11 : on laisse tel quel**

**Le patron, après avoir vu le raisonnement :** *« Dans ce cas-là, laisse tel
quel. »* Ne pas rouvrir ce point sans lui : ce n'est pas un défaut oublié, c'est
un arbitrage rendu. Le raisonnement qui l'a emporté est conservé ci-dessous —
c'est lui qui évitera de le refaire.

**Vu en regardant les captures de la perle, le 11 août 2026 — aucune suite ne le
disait.** À l'ouverture de « Vos chantiers », le fil est déjà défilé de 61 px :
le navigateur pose la liste sur son premier point d'accroche, qui centre le
premier chantier. Le bandeau « CORRECTION DEMANDÉE », qui vit **dans** la liste,
perd donc sa première ligne — et il n'existe aucune position de repos où on la
revoie : forcer le défilement à zéro y ramène.

Ce n'est **pas** une conséquence du travail sur la perle : mesuré avant, c'était
déjà 61 px.

L'arbitrage, et pourquoi il ne se tranche pas en codant : les deux moitiés ne
peuvent pas être vraies ensemble.

| Choix | Ce qu'on gagne | Ce qu'on perd |
|---|---|---|
| **Laisser tel quel** (retenu) | la perle désigne un chantier dès l'ouverture | le bandeau perd sa ligne de capitales — son nom, sa phrase et ses deux boutons restent entiers |
| Ajouter un point d'accroche en haut | le bandeau entier | on arrive sur une liste où la perle ne désigne rien, à **chaque** ouverture |

Un repère abîmé à chaque ouverture coûte plus cher qu'une ligne de capitales
coupée : c'est ce qui a emporté la décision.

### ~~0 bis. Une session périmée~~ — **close le 2026-08-10, test compris**

`GET /api/session-perimee` efface les cookies et renvoie à la connexion ;
`GardeDocumentsLegaux` (layout racine) et `getCurrentCtx` y mènent.
`scripts/test-session-perimee-e2e.ts` le tient en cinq contrôles, dont un
parcours dans un vrai navigateur, JavaScript coupé.

**Trois défauts que ce test a trouvés, et qu'il faut connaître avant de toucher
à ce coin du code** (le détail est dans `CHANGELOG.md` du 2026-08-10) :

1. Une redirection lancée depuis une **page** ne peut pas être un 307 : elle
   rend sous la frontière de `src/app/loading.tsx`, où l'enveloppe est déjà
   partie. Next.js répond alors 200, et le renvoi est joué en JavaScript. Tout
   contrôle d'accès qui doit valoir sans JavaScript vit dans le **layout**.
2. `NextResponse.redirect` fabrique une adresse absolue depuis `request.url`,
   c'est-à-dire l'adresse d'**écoute** (`0.0.0.0`). Derrière le relais du
   patron, elle ne mène nulle part. Renvoyer relatif.
3. « Compte disparu » et « compte sans entreprise » ne se traitent pas pareil :
   effacer la session du second l'enfermerait dans une boucle
   connexion → effacement → connexion.

#### La forme d'origine du défaut, pour mémoire

**Constaté chez le patron le 10 août 2026, sur son banc.** Son navigateur
portait la session d'un compte de démonstration supprimé par un nouveau seed.
Le cookie restait valide, `auth()` rendait donc un `utilisateurId` — et
`resoudreEntrepriseId` levait `AucuneEntrepriseError`, qui n'est **attrapée
nulle part** (`src/server/session-ctx.ts`). Résultat : toutes les pages en 500,
et un écran qui ne dit rien de ce qu'il faut faire.

**Ce qu'il faut, et pourquoi ce n'est pas une ligne de code :** une session
valide sans adhésion doit ramener à l'écran de connexion, **et la session doit
être révoquée** — sinon la page de connexion renvoie vers l'accueil, qui
renvoie vers la connexion, en boucle. `getCurrentCtx` sert aussi les actions
serveur et les routes d'API : le remède doit valoir pour les trois, sans
affaiblir l'isolation. À écrire avec un test qui reproduit la panne : session
signée d'un utilisateur sans adhésion.

**En attendant**, le contournement est écrit dans `docs/ESSAYER.md` : ouvrir en
navigation privée, ou rejouer le seed.


### 0. Le banc d'essai tient debout — ~~à faire~~ **fait le 9 août 2026**

Veilleur qui relance le serveur mort, préchauffage de seize écrans, garde contre
un second serveur, et construction possible sans les secrets de production.
`ARCHITECTURE.md` §43 et §44.

**Ce qui reste sur ce sujet, et que je dois encore faire :**

- **Le chemin de MISE À JOUR n'est toujours pas éprouvé par la CI.** Elle bâtit
  un banc neuf à chaque fois ; le défaut des migrations du 9 août est passé par
  ce trou, et un autre y passera. Il faut un banc qui existe déjà, qui reçoit du
  code neuf, migrations comprises.
- ~~**Le navigateur d'essai manque au conteneur.**~~ — **réglé le 2026-08-12.**
  Il s'installe dans la commande du workflow (`npx playwright install --with-deps
  chromium`), et non dans l'image : l'espace du patron ne porte pas trois cents
  mégaoctets dont il ne se sert jamais, la machine de GitHub les paie une fois
  par exécution. Ce qui l'a débloqué : `.devcontainer/verifier.sh` **se connecte
  désormais pour de vrai** sur le banc, derrière une origine étrangère — le
  contrôle qui manquait quand le patron a écrit « je n'arrive pas à me
  connecter ».
- **Les PDF et la dictée ne sont pas mesurés** — le premier exige un vrai
  stockage, la seconde un appel facturé. Dit plutôt que supposé.


### 0. La sauvegarde des données — À FAIRE, dans cet ordre

**Décidé avec le patron le 5 août 2026.** Il a demandé explicitement que ce
point soit écrit : *« oublie pas de le faire, note-le, enregistre-le ! »*

| | Quoi | Quand | État |
|---|---|---|---|
| **a** | ~~**Bouton « Télécharger mes données »** dans Réglages. Un fichier arrive sur son téléphone. Aucun terminal, aucun compte, aucune dépendance.~~ | | **fait le 2026-08-05** |
| **b** | **Sauvegarde automatique**, sans qu'il ait à y penser. | **Dès que l'hébergement est choisi** (point 3 de `docs/A-FAIRE.md`) | bloqué |

**(a) est livré.** Un ZIP contenant les vingt-trois tables de l'entreprise, ses
photos, ses enregistrements et ses PDF, plus un mode d'emploi qui dit ce que le
fichier contient de sensible. Les choix et ce qu'ils écartent sont dans
`ARCHITECTURE.md` §26 ; le code dans `src/server/repositories/export-entreprise.ts`,
`src/app/api/mes-donnees/route.ts` et `src/lib/archive-zip.ts`.

**Ce qui le garde honnête, et qu'il ne faut pas défaire :**
`test-export-entreprise.ts` interroge `information_schema` et **échoue si une
table portant un `entreprise_id` n'est pas exportée**. Une table ajoutée demain
et oubliée disparaîtrait sinon des sauvegardes sans un bruit. En ajouter une
sans l'exporter fera rougir la batterie — c'est voulu.

**Pourquoi (b) ne peut pas se faire maintenant, et il faut le redire à chaque
fois que la question revient :** une sauvegarde automatique doit déposer son
fichier quelque part.

- **Pas dans le dépôt** : il est public. Y écrire une base contenant les noms et
  adresses des clients serait une fuite, pas une sauvegarde.
- **Pas sur le disque de l'espace de travail** : c'est précisément ce dont on
  cherche à se protéger, puisqu'il disparaît avec l'espace.
- **Il faut donc une destination extérieure** — celle de l'hébergeur, ou un
  stockage objet que le patron n'a pas encore.

**Ce que (a) débloque :** il pourra nourrir la mémoire de l'agent sans craindre
de tout perdre au passage en ligne. C'est la condition qu'il a posée lui-même
pour commencer — voir `docs/A-FAIRE.md` §1 bis.

**Ne pas confondre avec l'export RGPD existant.**
`src/server/repositories/donnees-client.ts` exporte les données **d'un client**,
pour répondre à une demande d'accès. Ce qu'il faut ici est l'inverse : **toutes
les données de l'entreprise**, pour les emporter ailleurs.

### 0 ter. L'agent demande ce qui coûte de l'argent — ~~à faire~~ **fait le 6 août 2026**

**Choisi par le patron en QCM le 6 août 2026**, devant la mémoire des
corrections et l'entretien de départ : *« Les questions qui coûtent de
l'argent. »* Et la règle, confirmée le même jour : *« il demande si ça change le
prix, il signale sinon »* (`docs/EXEMPLE-DICTEE.md` §7).

L'agent s'arrête désormais **avant de chiffrer** quand il manque ce qui fait le
prix. Sur la dictée du chêne mort : la technique et le diamètre, absents de la
note, et qui font passer l'abattage de 600 à 1 400 €.

| Où | Quoi |
|---|---|
| `src/lib/questions-chiffrage.ts` | Les règles du métier, pures — ce qu'on demande **et ce qu'on tait** |
| `drizzle/0022_precisions_chantier.sql` | Ses réponses, qui survivent à une relecture de la dictée |
| `src/server/services/devis-depuis-dictee.ts` | L'arrêt, et la reprise **sans rappeler le modèle** |

**Ce que ça ne fait PAS — à ne pas croire acquis.** La réponse est enregistrée
et s'écrit sur la prestation ; **elle ne change pas encore le montant**. C'est la
règle du patron lui-même (`EXEMPLE-DICTEE.md` §9c) : tant qu'aucun rapport n'a
été observé entre les techniques et les prix, l'agent demande le prix plutôt que
d'en fabriquer un. Il manque la mémoire, pas la question.

**Ce qui le débloquerait**, dans l'ordre : (a) puis (c) ci-dessous. Dès qu'il
existe deux devis d'abattage avec leur technique, le rapport se calcule et le
montant peut se proposer — arrondi à la dizaine d'euros HT (`§9b`), et présenté
comme un **rappel** de la dernière fois, jamais comme un calcul non sourcé.

### 0 quater. La mémoire des corrections — ~~à faire~~ **faite le 6 août 2026**

**Choisi par le patron le 6 août 2026**, devant l'entretien de départ et les
photos. Ce qu'il chiffre sur un devis est désormais retenu, et lui revient sur
le chantier comparable suivant.

**Ce que ça a révélé :** `historique_prix` existait, était lue par le chiffrage
— et **n'était jamais écrite par l'application**. Seuls les tests l'alimentaient.
Une mémoire que personne ne remplit n'est pas une mémoire.

| Où | Quoi |
|---|---|
| `src/lib/lecons-prix.ts` | Ce qui se rapproche, ce qui ne se rapproche **pas**, et le rappel |
| `src/lib/arrondi-prix.ts` | « En HT on fait des prix ronds » (§9b), enfin appliqué |
| `drizzle/0023_lecons_prix.sql` | Une leçon par ligne de devis, jamais une de plus |
| `devis-complet` | Le rappel sous la ligne, et « Reprendre ce prix » |

**Pourquoi une table de plus plutôt qu'`historique_prix`.** Celle-ci s'appuie
sur `catalogue_prestations`, catalogue **partagé** repéré par nom canonique :
elle ne sait pas distinguer un abattage au pied d'un démontage avec rétention —
les deux seules choses qui font passer le même chêne de 600 à 1 400 €. Une
mémoire aveugle à cette distinction rappellerait un prix faux de 800 € avec
l'autorité de l'expérience.

**Trois garde-fous à ne pas défaire :**

- **Un rappel, jamais un calcul** (`EXEMPLE-DICTEE.md` §9c). La phrase dit d'où
  vient le chiffre et de quel chantier. Rien ne s'applique tout seul.
- **Le rapprochement se trompe dans le bon sens.** Les diamètres sont groupés
  par tranche de dix centimètres, au plus proche ; une frontière subsiste, et
  elle fait **manquer** un rappel, jamais en fabriquer un faux. Élargir le
  rapprochement échangerait un manque contre une erreur.
- **L'apprentissage ne gêne jamais le travail.** Une ligne dont on ne sait rien
  tirer s'enregistre quand même.

**Ce qui reste ouvert :** le rapport entre techniques (×1,67, ×2,33 — §9a),
qui demande plusieurs devis comparables. La mémoire l'accumule désormais ; la
règle se calculera quand il y aura de quoi.

### 0 quinquies. Lignes vendables et grille de fendage — ~~à faire~~ **fait le 8 août 2026**

Ce qui est en place, et qu'il ne faut pas refaire :

- le découpage en lignes vendables (`src/lib/lignes-vendables.ts`), avec le
  billonnage compris dans l'abattage ;
- la grille de fendage hauteur × diamètre, 8 × 6 cases, née vide, remplie à la
  main **et** par ses devis (`src/lib/grille-prix.ts`).

Détail des choix : `ARCHITECTURE.md` §29.

**Ce qui reste ouvert, et qu'il faut lui demander plutôt que de trancher seul :**

| | Question | Pourquoi ça presse un peu |
|---|---|---|
| a | **Les tranches lui conviennent-elles ?** 8 diamètres × 6 hauteurs, bornes hautes incluses. | Changer les bornes plus tard rend introuvables les prix déjà rangés. C'est facile aujourd'hui, coûteux après trente devis. |
| b | **L'abattage mérite-t-il la même grille ?** Il se chiffre déjà à la technique et au diamètre, mais sans liste que le patron puisse voir et compléter. | Question posée le 8 août, restée sans réponse. |
| c | **La taille de haie devrait-elle avoir sa propre ligne ?** Son devis de référence du 5 août en compte trois — haie 350 €, abattage 600 €, fendage 300 € — quand l'application en produit deux. | Séparer la haie du chêne demanderait de répartir un tarif global entre eux, c'est-à-dire d'inventer deux prix. La fente a le droit à sa ligne parce qu'elle a une grille ; la haie n'en a pas encore. |
| d | **Autre chose que la fente se détache-t-il ?** Le dessouchage, l'évacuation seule, l'enlèvement des grumes. | Aujourd'hui la fente est le seul cas connu — parce que c'est le seul qu'il ait décrit. |

**Et une limite à connaître avant de promettre quoi que ce soit :** seuls les
devis **nés d'une dictée** nourrissent `corrections_dictee`. Un devis écrit
entièrement à la main n'apprend rien sur la façon de LIRE une dictée — c'est
délibéré (il n'y a pas d'écart à mesurer), mais cela veut dire que sa phrase
*« je fais plein de devis et dans un mois tu sauras les remplir tout seul »* ne
vaut que pour les devis dictés. La grille de fendage, elle, se remplit dans les
deux cas.

### 0 sexies. Le PDF d'une liste de prix — à trancher avec le patron

L'import d'une liste de prix accepte **Excel et CSV** (`ARCHITECTURE.md` §31).
Le **PDF est refusé**, avec un message qui donne la sortie : « Ouvrez la liste
dans Excel puis Enregistrer sous → CSV ».

**Pourquoi refusé plutôt que deviné.** Un PDF est une image de tableau : plus de
colonnes, seulement des morceaux de texte à des coordonnées, souvent dans un
encodage propre au document. Un prix lu de travers arrive sur le devis d'un
client — c'est précisément ce que `docs/AGENT.md` §3 interdit.

**Question posée le 8 août, et tranchée : « le tableur suffit ».** Le sujet est
donc clos, et ce point ne se rouvre que s'il change d'avis. Les deux pistes sont
gardées ci-dessous pour qu'on n'ait pas à les réinventer ce jour-là.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | Faire lire le PDF par le modèle déjà branché, et lui faire valider l'aperçu comme aujourd'hui | Marche sur les PDF scannés comme sur les autres. Coûte des jetons, et demande d'envoyer le fichier chez un sous-traitant — donc l'accord du patron (`docs/A-FAIRE.md` point 2) |
| b | Extraire la couche texte à la main (flux `Tj`/`TJ`, positions `Td`/`Tm`) | Sans dépendance ni réseau, mais muet sur un PDF scanné, et fragile sur les encodages de sous-ensembles de polices |

### 0 nonies. Le calendrier, des deux côtés — ~~à faire~~ **fait le 9 août 2026**

Le client ne peut plus choisir un jour déjà pris : il est barré et ne répond
pas. Le patron a le même calendrier, jusqu'à dix-huit mois. `ARCHITECTURE.md`
§36.

**À savoir avant d'y toucher** : le composant ne décide de rien, tout vient de
`src/lib/calendrier.ts`. Et l'ordre des raisons dans `etatDuJour` n'est pas
indifférent — un jour hors fenêtre ne doit JAMAIS se dire « déjà pris » chez le
client, sinon la page laisse filtrer le planning du patron.

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « tu peux aller jusqu'à
douze mois d'occupation ».** Son calendrier barre donc ses journées complètes sur
365 jours. Au-delà, c'est toujours le serveur qui refuse après coup, et un
contrôle tient cette borne pour qu'on ne l'élargisse pas sans le décider.

**Ce que voit le client n'a pas bougé** — deux nombres, deux personnes. Ne jamais
les réunir « pour simplifier » : `HORIZON_OCCUPATION_PATRON_JOURS` est à lui,
`FENETRE_PROPOSITION_JOURS` est à son client.

### 0 octies. Ce qui se détache d'un chantier — ~~à trancher~~ **tranché le 8 août 2026**

Question posée : « autre chose se détache-t-il — dessouchage, évacuation seule,
enlèvement des grumes ? » Sa réponse : **« le dessouchage oui, et les grumes
aussi »**. L'évacuation seule reste donc avec l'abattage et le broyage.

Fait : cinq natures de grille, trois formes, 82 cases (`ARCHITECTURE.md` §35).

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « à la tonne ».** La case
porte un prix unitaire, multiplié par le tonnage lu dans la dictée. L'ancien
forfait a été **effacé** et non converti (migration 0029) : on ne sait pas
combien pesait le chantier qui l'avait produit.

La réserve, écrite à l'écran plutôt que dans un commentaire, aura tenu moins de
vingt-quatre heures. À imiter : une question posée là où le patron la lit se
répond ; enfouie dans le code, elle attend qu'un devis sorte faux.

### 0 septies. Du planning à la facture — ~~à faire~~ **fait le 8 août 2026**

Le patron ne pouvait pas atteindre le devis d'un chantier planifié : toucher sa
carte n'ouvrait qu'un sélecteur de date. La chaîne facture → TVA existait
pourtant en entier — elle était seulement injoignable depuis son écran.

Fait : la carte mène au chantier, porte « Fin de chantier », et garde le
changement de date sur un lien à part. Plus deux défauts de rangement corrigés à
la racine, et un libellé de facture qui n'était plus coupé.

**Ce qu'il faut savoir avant d'y toucher** — `ARCHITECTURE.md` §33 :

- La règle de rangement vit dans `src/lib/onglet-chantier.ts` et **nulle part
  ailleurs**. Trois portes selon la donnée disponible ; **ne jamais la recopier
  dans un écran**, c'est exactement ce qui a produit les deux défauts.
- Aucune barrière de date sur « Fin de chantier », et c'est délibéré depuis le
  3 août : c'est le patron qui sait quand un chantier est fait.

**Ce qui reste ouvert, et qu'il faudra lui demander** : un chantier passé au
planning n'affiche rien tant qu'il n'est pas clôturé. Faut-il un rappel — « ce
chantier était prévu hier » — sur l'écran d'accueil ? Aujourd'hui il bascule
silencieusement dans « Terminés », ce qui est correct mais discret.

### 0 decies. La nouvelle direction graphique — en attente de son choix

Le 9 août au soir, le patron a trouvé l'écran refait « trop application créée
en 2013 » et demandé quelque chose de **minimaliste et luxueux**, en s'appuyant
sur `aman.com`. Huit maquettes ont suivi ; il a retenu la mise en page **« la
colonne »** — la date à gauche, le chantier à droite — et gardé **trois** de ses
déclinaisons : le repère, en plages, l'action au pouce.

**Rien n'est codé.** L'application porte toujours la reproduction de sa première
capture (`ARCHITECTURE.md` §46). Il n'a pas encore désigné laquelle des trois.

Tout est dans `docs/maquettes/`, et d'un coup dans
`docs/maquettes/toutes-les-maquettes.html` — engendrée, jamais éditée à la
main : `node scripts/fusionner-maquettes.mjs`, puis
`node scripts/verifier-maquettes-page-unique.mjs`.

Ce que la bascule coûtera, quand il aura choisi : la charte de
`src/lib/design-tokens.ts` change de fond en comble (ivoire au lieu du gris-vert,
encre au lieu du vert pin pour l'action, bronze au lieu de l'or), et **tous** les
écrans suivent — pas seulement Chantiers. À ne pas entamer écran par écran.

### ~~0 quindecies. Le bouton était codé mais PAS chez lui~~ — **fusionné dans `main` le 2026-08-11, sur son accord**

**C'était le seul point qui le séparait de son bouton, et il n'était pas
technique.** Il a répondu *« fusionne dans main »* : c'est fait (`6059641`), et
son espace le prendra au prochain allumage — ou tout de suite par « Chercher les
dernières corrections ».

*Ce qui suit est gardé parce que le piège, lui, resservira.*

Le 11 août au soir : *« la modification du bouton nouveau chantier n'est pas
effectuée. Corrige ça. Et pourtant, j'ai la nouvelle dernière mise à jour, celle
de dix-neuf heures et quelques. »* Les deux moitiés de la phrase étaient vraies.

- Le bouton vit sur `claude/nouveau-chantier-button-design-2vuu9h`.
- Son espace de travail suit **`main`** — `.devcontainer/mettre-a-jour.sh` fait
  un `git merge --ff-only origin/<branche courante>`, à chaque allumage et
  derrière le bouton « Chercher les dernières corrections ». **Les deux suivent
  la branche courante.** Aucun des deux n'ira jamais chercher ailleurs.
- `main` n'a jamais reçu ce travail, et avançait en parallèle ce soir-là
  (19:02, 19:11, 19:13, 19:37). D'où sa « mise à jour de dix-neuf heures ».

**Ce qu'il a fallu faire, et qui n'appartenait pas à l'agent :** fusionner la
branche dans `main` — **fait le 2026-08-11, sur son accord explicite**
(`6059641`, en avance rapide, `main` fusionné dans la branche juste avant).

**Ne pas contourner en lui demandant de changer de branche** : ce serait des
commandes git tapées au doigt sur six pouces, ce que tout ce dépôt s'emploie à
lui épargner (`.devcontainer/demarrer.sh`).

**Ce qui, lui, a été corrigé sans attendre :** la ligne « Version » de Réglages
nomme désormais la **branche** suivie, et le bandeau du terminal ne l'annonce
plus périmée. Un espace en retard d'une branche se voit maintenant sur une
capture, sans avoir à poser la question — c'est précisément ce à quoi cette
ligne servait, et ce qu'elle n'a pas su faire ce soir-là.

### ~~0 terdecies. L'action « Nouveau chantier »~~ — **close le 2026-08-11, codée et éprouvée**

Le 11 août 2026, capture à l'appui : *« j'aime pas le gros bouton nouveau
chantier […] ce gros bouton en plein milieu, ça ne fait pas très luxe »*. Le
reste de l'écran lui convient — c'est **l'aplat vert seul** qui est en cause.

**Treize** remplaçants sont dessinés, en trois tournées — et l'un d'eux est
maintenant à moitié choisi : **le sceau clair** (maquette 16, deuxième
habillage), *« j'aime beaucoup la deuxième »*. Puis il a écarté le sceau
lui-même — *« le fond blanc me dérange »* — et demandé de l'innovation, pas une
variante. `docs/maquettes/18-six-matieres.html` répond sur deux axes : **des
matières** (laque, or brossé, cire, encre vivante, ou pas de disque du tout) et
**deux ouvertures où le bouton devient la page** au lieu de faire monter une
feuille.

**FAIT.** Le bouton est dans l'application depuis le 11 août au soir :
`src/app/EcranChantiers.tsx` et `src/app/globals.css`. Éprouvé par
`scripts/test-bouton-nouveau-chantier-e2e.ts` (la demi-seconde, le double appui,
le mouvement réduit), regardé par
`scripts/capture-bouton-nouveau-chantier.mts` (attente, geste, feuille). 108
suites base et 49 suites navigateur au vert, connexion réelle comprise.

**Ce qui a été retenu, pour mémoire :** C'est
`docs/maquettes/24-le-bouton-retenu.html` : **« Nouveau chantier » écrit, le
rond d'un cheveu qui bat à sa droite**, et à l'appui **trois tours avec onze
grains d'or**, puis la feuille une demi-seconde plus tard. Toutes les mesures
sont dans le tableau au bas de cette maquette — les reprendre telles quelles.

Il reste à **le coder** : le bloc `<Link>` de `EcranChantiers.tsx`, une
trentaine de lignes de `globals.css`, le délai avant l'ouverture de la feuille,
une suite qui mesure la demi-seconde et une capture. Une demi-journée. Deux
choses à ne pas oublier : l'appui doit s'enfoncer tout de suite (140 ms), et un
second appui pendant le tour doit être ignoré, sans quoi deux chantiers naissent
au lieu d'un.

**L'historique du choix (pour ne pas rouvrir ce qui est clos) :** C'est **l'anneau d'un cheveu avec
son « + »**, qui doit **tourner à fond puis ouvrir la page**. Sa place a été
tranchée juste après : **au centre**, à l'endroit qu'occupait l'aplat vert — et
non en haut à droite comme il l'avait d'abord montré — avec **un petit trait de
chaque côté, qui s'écarte à l'appui**. La dernière tournée ajoute **le mot** au geste
(`docs/maquettes/23-le-mot-et-le-rond-qui-bat.html`) : « Nouveau chantier »
écrit, le rond qui bat en attendant le doigt, et au clic le tour et la
poussière — sept dispositions du libellé. **Huit** autres déclinaisons du tour
seul restent dans `docs/maquettes/22-le-rond-entre-deux-traits.html` — dont deux qui reprennent
l'anneau de la note vocale (un cercle dehors, un cercle dedans), et une qui met
les crans de la dictée à la place des traits ; il ne reste qu'à en
désigner une, et le tour franc suffirait. (La version en haut à droite reste
dans la maquette 21, si jamais il y revenait.)

**Ce que coûtera la bascule, une fois la déclinaison choisie** : le bloc
`<Link>` de `EcranChantiers.tsx` devient un anneau posé dans l'en-tête (grille à
deux colonnes, aligné sur la ligne de base du titre), plus une trentaine de
lignes de `globals.css` pour le tour, plus le délai avant l'ouverture de la
feuille. Une demi-journée. Deux choses à ne pas oublier : l'appui doit s'enfoncer
tout de suite (140 ms), et un second appui pendant le tour doit être ignoré,
sans quoi deux chantiers naissent au lieu d'un.

**L'ancien squelette (rond plein au milieu, explosion, agrandissement) n'est plus
d'actualité** : il est resté une soirée. Ne pas le ressortir — maquette 20.

**Le squelette était arrêté par lui le 11 août en fin d'après-midi** : un rond plein avec un
« + », une explosion de débris à l'appui, et le rond qui s'agrandit jusqu'à
devenir la page. Six gerbes sont à l'essai dans
`docs/maquettes/20-le-rond-qui-eclate.html` ; il ne reste qu'à en désigner une.

La maquette 18 a été jugée trop démonstrative — *« tu as primé sur l'originalité
au détriment de l'élégance »*. `docs/maquettes/19-six-gestes-tenus.html` revient
donc à la retenue : plus de gerbe, plus de matière imitée, une seule chose qui
bouge à la fois.

**Ce qu'il faudra prévoir si une matière est retenue :** la teinte de laque
(#10150f → #263025) n'existe pas dans `src/lib/design-tokens.ts`, et l'ouverture
par agrandissement du disque n'est pas la transition actuelle — c'est un
changement de `FormulaireNouveauChantier` en feuille, pas seulement du bouton.
Compter une journée plutôt qu'une demi. La première
(`docs/maquettes/14-le-geste-nouveau-chantier.html`) amincit le bouton : le
filet qui se trace, le sceau, le premier brin, le cartouche gravé, la pastille
au pouce, la légende sur le trait. Elle n'a pas convaincu — *« je ne suis pas
encore hyper convaincu »* — et le pourquoi vaut d'être retenu : **six façons
d'amincir un bouton ne font qu'une idée**. La seconde
(`docs/maquettes/15-encore-six-gestes.html`) change donc de nature à chaque
fois : la ligne du registre, le titre qui porte l'action, la marque
d'imprimeur, le cinquième onglet, tirer pour ouvrir, le signet sur la tranche.
La troisième vient de lui : il a décrit le geste lui-même — *« une sorte de
pastille un peu ronde »*, qui *« se mette à tourner super vite »*, *« dégage
comme une sorte d'onde ou de petits fragments »*, et ouvre la feuille *« au bout
d'une demi-seconde »*. Elle est dessinée, et **pressable**, dans
`docs/maquettes/16-la-pastille-qui-tourne.html` — trois habillages, plus une
version sous le pouce.

**Rien n'est codé** tant qu'il n'a pas désigné le sien. Le 11 août, la pastille
avait été portée d'un coup dans l'application ; il l'a arrêté net — *« crée-moi
une maquette avant de changer quoi que ce soit »* — et le changement a été
défait. La règle est désormais dans `CLAUDE.md` §3 bis.

**Ce que coûtera la pastille, le jour où il la choisit** (mesuré, puis défait) :
le bloc `<Link>` de `EcranChantiers.tsx`, une trentaine de lignes de
`globals.css` pour le tour, l'onde et les éclats, une variable `--or` dans la
palette, une suite qui mesure la demi-seconde, et un script de capture. Une
demi-journée, sans surprise connue. Deux points à ne pas oublier : l'appui doit
s'enfoncer **tout de suite** (140 ms) sinon la demi-seconde passe pour une
panne, et un second appui pendant le geste doit être ignoré, sans quoi deux
chantiers naissent au lieu d'un.

Ce que coûtera la bascule, une fois le choix fait : **un seul endroit**, le
bloc `<Link>` de `src/app/EcranChantiers.tsx` (lignes 151-167). Vérifié plutôt
que supposé : les suites navigateur atteignent `/chantiers/nouveau` **par son
adresse**, aucune ne cherche le libellé — changer la présentation n'en casse
donc aucune, et **c'est justement le risque** : rien ne se plaindra si l'action
devient introuvable au doigt. Prendre une capture (`CLAUDE.md` §5) et rejouer
`test-rien-de-recouvert-e2e` — la suite qui mesure ce que le mobilier fixe
recouvre, et la seule qui verrait le défaut de la proposition E.

**Trois réserves à ne pas perdre.** La pastille flottante (E) entre en conflit
avec la bulle de l'assistant, qui occupe déjà ce coin — la maquette le montre
plutôt qu'elle ne le tait. Le cinquième onglet (J) **supprime** cette bulle :
c'est une décision à prendre avec lui, pas un détail de mise en page. Et le
geste de traction (K) ne doit jamais partir seul : un geste caché est élégant le
premier jour et coûteux le trentième, quand un remplaçant prend le téléphone.

### 0 duodecies. `test-devis-papier-e2e` échoue sur le banc local

`TypeError: Cannot read properties of undefined (reading 'id')` — la suite
cherche une ligne dans `devis` pour son chantier et n'en trouve aucune.

**Ce n'est PAS la refonte** : vérifié en remisant les modifications et en
rejouant la suite sur le code d'avant — même échec, à la même ligne. Le défaut
lui est antérieur. Reste à savoir s'il tient au harnais (`run-e2e-tests` monte
son propre serveur et son propre jeu de données) ou à la suite elle-même. À
reproduire d'abord par `npm run test:e2e` complet avant de conclure.

### 0 bis. L'agent qui apprend — LA SUITE, demandée explicitement

**Consigne du patron, le 6 août 2026, après la fusion de la mémoire des
corrections :** *« Ok, garde ça en mémoire et on fera ça après. N'oublie pas de
le faire. »*

C'est donc **le prochain travail**, pas une liste d'idées. Une conversation qui
reprend à froid enchaîne sur (b), puis (c), puis (d) — sans reposer la question.
C'est la deuxième fois qu'il demande expressément qu'un point soit consigné
plutôt que retenu (la première : la sauvegarde, §0) ; le lui faire répéter une
troisième serait une défaillance de ce fichier.

Le tapis roulant (dictée → devis, d'un seul geste) est en place, l'arrêt
d'avant-chiffrage aussi (§0 ter), et la mémoire des corrections également
(§0 quater). Reste, dans l'ordre décidé avec lui le 5 août 2026 :

| | Quoi | Pourquoi maintenant |
|---|---|---|
| a | ~~**Mémoire des corrections.**~~ **Fait le 6 août 2026** — voir §0 quater. | |
| a bis | ~~**Le découpage des lignes, et la grille de fendage.**~~ **Fait le 8 août 2026** — voir §0 quinquies. | |
| b | **Entretien de départ.** Il n'a aucun ancien devis à donner en référence — c'est donc l'agent qui l'interroge une fois et écrit ses règles. | Sans ça, l'agent démarre en ne sachant rien et apprend aux frais du patron. |
| c | **Écart devis / facture.** Les données existent déjà des deux côtés. | La meilleure leçon qui soit : ce qui avait été mal estimé s'y voit tout seul. |
| d | **Photos ↔ prix.** Conserver le lien entre les photos d'un chantier et le devis qui a suivi. | Objectif du patron : « à force de comparer les photos des arbres et les devis, il devra proposer un prix juste ». Impossible aujourd'hui — mais **l'accumulation doit commencer maintenant**, sinon dans six mois il n'y aura toujours rien à apprendre. |

**Et un cinquième point, né du lot du 6 août :** le **rapport entre techniques**
(×1,67, ×2,33 — `docs/EXEMPLE-DICTEE.md` §9a). Il ne s'écrit pas en dur : c'est
une moyenne mobile, recalculée sur les devis réellement faits. Il ne peut donc
exister qu'à partir de plusieurs chantiers comparables — `lecons_prix` les
accumule depuis le 6 août. **À reprendre quand la mémoire est fournie**, pas
avant : un rapport tiré d'une seule observation serait une règle inventée.

**Réserve levée le 5 août 2026.** Un prix déduit d'une photo est une estimation,
ce que `docs/AGENT.md` §3 interdisait. Le patron a tranché : *« rien ne sera
jamais envoyé sans vérification du patron, ça restera qu'une proposition. »* La
règle est assouplie — l'estimation est permise **à condition d'être signalée
comme telle**, et c'est l'arrêt 1 qui porte la garantie. Voir `AGENT.md` §3.

**Et une contrainte de fond, soulevée par le patron le même jour :** *« si
l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ? »* Il a
raison, et ça conditionne (a) à (d). L'application a bien une mémoire — une base
PostgreSQL sur volume persistant — mais **celle du banc d'essai meurt avec
l'espace de travail**, qui est jetable par construction. Tout ce qui s'apprend
ne sera durable qu'une fois l'hébergement choisi (point 3 de `A-FAIRE.md`).
Construire l'apprentissage sur le banc reste utile pour l'éprouver ; ce qui s'y
accumule ne doit pas être présenté comme conservé.


### 1. Agenda Google — au choix de chaque artisan

> **Fait le 9 août 2026, sauf les identifiants.** L'écran « Mon agenda », le
> stockage chiffré, la fusion dans la disponibilité et les deux chemins du
> client sont écrits et éprouvés (`ARCHITECTURE.md` §39). **Ce qui reste tient
> en une chose, et elle n'est pas codable** : les identifiants OAuth, que seul
> le patron peut créer (`docs/A-FAIRE.md` §7). Tant qu'ils manquent, l'écran
> l'annonce et ne propose aucun bouton.
>
> **Et ce qui n'a pas pu être éprouvé ici** : l'aller-retour réel avec Google —
> autorisation, échange du code, renouvellement du jeton. Trois appels HTTP, pas
> davantage : tout ce qui décide en a été sorti exprès. À vérifier chez lui, le
> jour où les identifiants existent.

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable. Le point bloquant est détaillé
dans `docs/A-FAIRE.md` §7.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

**Décision du patron, le 9 août 2026** — *« ce qui serait bien, c'est que
l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à son
agenda Google »* — et elle contraint la conception :

- **C'est un choix par artisan, pas un réglage de l'application.** Chacun relie
  son agenda ou ne le relie pas. Celui qui ne relie rien garde exactement
  l'Atlas d'aujourd'hui : pas d'écran en plus, pas de compte à créer, aucun
  chemin de code nouveau à traverser.
- **Le jeton de raccordement appartient à l'entreprise**, donc il vit en base
  sous RLS, comme tout le reste — jamais dans une variable d'environnement
  partagée, qui vaudrait pour tout le monde à la fois.
- **Atlas ne lit que les créneaux occupés.** Jamais l'intitulé, jamais les
  participants. Un agenda personnel porte les rendez-vous médicaux et les
  vacances de la famille ; Atlas n'en a pas besoin pour savoir qu'une journée
  est prise. Même règle qu'à la page du client, qui reçoit des dates et rien
  d'autre (`docs/AGENT.md` §2.2 bis).
- **Une seule fonction de disponibilité**, jamais deux. La fusion des créneaux
  Google et des chantiers Atlas se fait *dans* `src/server/disponibilites.ts`.
  Un second calcul à côté finirait par diverger du premier — c'est exactement le
  défaut qui a produit, le 9 août, un chantier rangé dans deux onglets à la fois
  (`ARCHITECTURE.md` §33).

À faire une fois les identifiants disponibles : le bouton « Relier mon agenda »
dans les réglages, le raccordement du compte, la lecture des créneaux sur la
fenêtre de proposition, la fusion ci-dessus, et l'écriture de l'intervention
après acceptation.

**Ce qui ne pourra pas être éprouvé ici :** sans compte Google raccordé, aucun
contrôle local ne parcourt le vrai chemin. La partie fusion, elle, est une
fonction pure et s'éprouve entièrement (`CLAUDE.md` §5).

### 2. Code SMS en renfort de l'acceptation

L'acceptation conserve déjà l'empreinte du PDF, l'horodatage, l'adresse IP et le
canal (`docs/AGENT.md` §5, ligne « Acceptation tracée »). Ce qui manque est un
code à usage unique envoyé au client au moment où il accepte.

**Sans objet en l'état** : le patron a écarté tout fournisseur d'envoi
(`ARCHITECTURE.md` §13), et un code qu'il devrait transmettre lui-même
n'apporterait rien. À rouvrir seulement si un fournisseur est un jour souscrit.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. **Sans objet en l'état**, pour la même raison qu'au point 2 : la relance
part de la messagerie du patron, comme l'envoi.

### 4. L'assistant répond en JSON brut

Interrogé « Comment a été envoyé le devis ? », il a répondu :
`D'après LireDevis, voici ce que j'ai trouvé : {"existe":true,"numeroCommercial":"2026-0003",…}`.
Le patron n'a pas à lire du JSON. L'assistant doit répondre en français, ou dire
qu'il ne sait pas — et jamais recracher la sortie d'un outil telle quelle.

### 5. ~~Les équipes nommées~~ — fait le 10 août 2026

**Demandé par le patron le 10 août** : *« il faut que dans le fichier réglages
on puisse mettre le nom des équipes — soit équipe A équipe B, soit des noms et
prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas qu'il y
ait quand même écrit équipe A équipe B. »*

Table `equipes` (`nom` **nullable**), colonne `chantiers.equipe_id`, et une
seule fonction pure qui décide du libellé (`src/lib/equipes.ts`). Le planning se
lit désormais au mois, avec une ligne par équipe sous chaque demi-journée.
Détail et pièges dans `ARCHITECTURE.md` §51 et §52.

**Ce qui n'a PAS bougé, et qu'il ne faut pas « corriger » :**

- **`entreprises.nombre_equipes` fait toujours autorité sur le NOMBRE.** La
  table ne porte que des noms. Un `COUNT(*)` ferait dépendre le calcul des
  disponibilités de lignes qu'aucun écran n'oblige à créer.
- **Aucun nom n'est écrit en base au moment de l'insertion.** Le repli
  « Équipe A » est un affichage — l'écrire en donnée le rendrait indiscernable
  d'un nom choisi, et un retour à une seule équipe le ferait parler.

Écarté aussi, et volontairement : les **heures réelles** (« la demi-journée
suffit ») et la **capacité en hommes** — `taille_equipe` est du texte libre, il
faudrait le fiabiliser avant d'en faire une contrainte. Voir `ARCHITECTURE.md`
§22 pour les arbitrages.

### 5 bis. ~~« Terminés » et le parcours de facturation~~ — fait le 10 août 2026

Le §6 quinquies de `docs/INTEGRER-ORIGINE.md` : l'écran devient un **fil par
mois**, l'encart « à facturer » se pose **dans le mois** plutôt qu'à côté, et le
relevé de TVA cesse d'être un pavé pour devenir une ligne au pied.
`ARCHITECTURE.md` §53.

**Trois décisions du patron, prises le 10 août et à ne pas rouvrir :**

1. **« Fin de chantier » devient « Créer la facture »**, sur les trois écrans
   qui portaient le mot (fiche, planning, écran de facture). Le nom dit
   désormais ce que la touche fabrique.
2. **Une facture à 0,00 € s'affiche telle quelle**, sans mention ni
   avertissement. Il en a une dans ses données réelles (F2026-0001) : un
   montant nul se lit, il ne se commente pas.
3. **La bulle de l'assistant s'écarte du bandeau** — elle venait toucher la
   dernière ligne de l'écran.

**Ce qui a été vérifié et qui n'était PAS un défaut :** `listerChantiersTermines`
compte bien un chantier du 20 comme terminé **le 21**, jamais le 20 à minuit
(`ongletDepuisJalons` : `datePlanifiee < aujourdHui`). La journée entière reste
au planning — c'est de là que le patron clôture en rentrant.

### 7 bis. ~~Le retrait, partout~~ — fait le 10 août 2026

Le cinquième choix du patron sur les maquettes : « le tiroir des retirés »,
appliqué aux **huit** endroits qui suppriment (le recensement de
`docs/INTEGRER-ORIGINE.md` §4 bis en annonçait sept — le planning manquait).
Détail et pièges dans `ARCHITECTURE.md` §48.

**Ce qui reste de la fiche `docs/INTEGRER-ORIGINE.md` :** son §6, l'ouverture
de « Nouveau chantier » — et il porte un point de PRODUIT non tranché, à poser
au patron avant de coder : cet écran est aujourd'hui une page avec sa flèche de
retour, quand l'ouverture retenue raconte une feuille modale.

**Deux choses laissées telles quelles, et dites plutôt que tues :**

- **Les maquettes `/design/prix`** montrent encore l'ancienne croix nue et le
  bandeau flottant (`AnimatedRow`, `UndoToast`, qui ne servent plus qu'à
  elles). Elles sont découplées du produit depuis le 1er août ; les reprendre
  ou les retirer reste à décider, mais elles contredisent l'application.
- **Le geste en diagonale n'a pas pu être éprouvé ici** : le glissement
  horizontal du texte et l'accroche verticale du fil ne portent pas sur le même
  axe, mais un pouce, lui, bouge en biais. Un navigateur piloté ne le
  reproduit pas — à essayer sur un vrai téléphone.

### 7 ter. ~~L'anneau muet et la pellicule~~ — fait le 10 août 2026, au soir

Le §6 bis de `docs/INTEGRER-ORIGINE.md` : sur la fiche chantier, un **anneau
muet** remplace la ligne « Note vocale » comme accès direct — on le touche, la
note se lit ; on le pousse vers le haut, « Retirer » se découvre. Les photos
deviennent une **pellicule** dans le tiroir du bas, case « + » en tête, et la
ligne « Photos · 6 photos » disparaît. Détail et pièges dans
`ARCHITECTURE.md` §49.

**L'en-tête de la fiche ne bouge pas — ~~à trancher~~ TRANCHÉ le 10 août 2026.**

La maquette `atlas-note-vocale.html` raconte en plus de l'anneau une **scène**
entière : grand titre serif, phrase de situation (« Intervention prévue vendredi
15 août »), à la place de l'en-tête commun. La question lui a été posée en
image ; sa réponse : **« N'y touche pas. »**

**Ne pas la rouvrir en découvrant l'écart avec la maquette.** L'écart est connu
et voulu. `EnTeteEcran` est **une seule pièce partagée** par la fiche, le
planning, les terminés, les réglages et les six écrans d'étape : la refaire
pour la seule fiche désaccorderait cet écran de tous les autres, et la refaire
partout serait un lot en soi, touchant l'accueil — que le patron a arrêté et
qu'il ne veut pas revoir.

Si le sujet revient, c'est **lui** qui le rouvre, et alors c'est « partout »
ou rien.

### ~~9. La ligne sous le nom, dans la liste des chantiers~~ — **tranché et codé le 13 août 2026 : le D, avec la date d'envoi**

**Le patron, le 13 août 2026 :** *« le devis a été envoyé et il n'a toujours pas
eu de réponse […] tu marques quelque chose du style devis envoyé, attente de
réponse, je te laisse libre de choisir et de proposer des alternatives si tu
penses qu'il faudrait rajouter d'autres informations à ce niveau-là. »*

**Il a retenu D**, en remplaçant le délai par la date : « DEVIS ENVOYÉ · SANS
RÉPONSE » en or, et dessous « Envoyé le jeudi 13 août. » La règle vit dans
`ligneEtatChantier` (`src/lib/chantier-etat.ts`), éprouvée sans base ni
navigateur. `ARCHITECTURE.md` §79.

**Les quatre autres restent dans la planche** — `docs/maquettes/41-la-ligne-sous-le-nom.html`,
engendrée par `scripts/engendrer-maquette-ligne-chantier.mts`. Si le sujet se
rouvre, repartir de là :

| | Libellé | Ce qu'elle apprend |
|---|---|---|
| A | « Devis envoyé · en attente de réponse » | ses mots, au plus court |
| B | « Envoyé il y a 3 jours · sans réponse » | **le délai — la seule chose qui décide une relance** |
| C | « Envoyé le 10 août · valable jusqu'au 24 » | quand le devis cessera d'être ouvrable |
| D | deux lignes, la seconde en clair | ce qu'il y a à faire, en toutes lettres |
| E | avec le montant | lequel rappeler en premier |

**Ce qui contraint le choix, et qui a été MESURÉ sur l'écran** (`ARCHITECTURE.md`
§78) : le libellé actuel tient sur une ligne à 430 px — la largeur de son
téléphone — et déborde à 390. A et B tiennent chez lui ; C et E débordent
partout.

**Deux points à lui redire quand il tranchera :**

- la mention « sans photo » n'a plus d'utilité une fois le devis parti : elle
  disparaît dans toutes les propositions ;
- l'or est réservé à ce qui **attend un geste de lui**. Un devis parti sans
  réponse n'attend rien de lui, d'où le gris. **D est la seule qui rouvre ce
  choix**, et c'est délibéré.

E est la seule qui coûte une sous-requête de plus (le montant n'est pas chargé
par l'écran d'accueil).

### 8. L'écran Facture — trois manques signalés par le patron le 10 août 2026

Constatés par lui sur son banc, capture à l'appui. Aucun n'est corrigé.

1. **Impossible d'enregistrer la facture.** Sous « Voir la facture en PDF », il
   veut **un petit lien pour la télécharger** sur son téléphone ou son
   ordinateur. Aujourd'hui il ne peut que l'ouvrir. Un `<a download>` vers la
   route du PDF suffit, avec un nom de fichier qui porte le numéro de facture —
   « F2026-0001.pdf », pas « facture.pdf » : il en aura des centaines.
2. **« Ouvrir le SMS tout prêt » est carré**, alors qu'il le veut **ovale comme
   tous les autres**. À éclaircir avant de coder : depuis le 10 août tous les
   boutons sont à 5 px de rayon (`radius.button`). Lui montrer deux variantes
   plutôt que deviner — et si c'est bien un bouton en gélule qu'il veut,
   **c'est la charte entière qui change**, pas ce bouton-là.
3. **On ne propose que le SMS.** Il veut pouvoir **envoyer la facture par
   e-mail**. `composerMessageFacture` et `lienTransmission` savent déjà faire
   les deux (`src/lib/message-client.ts`, canal `"email"`) : c'est l'écran de
   la facture qui n'offre pas le choix. Voir comment l'écran du devis propose
   SMS **ou** e-mail, et faire pareil.

Le troisième est le plus important : une facture qu'on ne peut pas envoyer par
courriel, c'est un client sur deux qu'on ne peut pas facturer.
Constatés par lui sur son banc, capture à l'appui.

**⚠ Ce point avait été consigné sur `claude/migrate-app-atlas-zz31ac` et n'a
jamais rejoint `main`** : cette branche est restée deux commits derrière une
après-midi de travail, et le point était donc invisible de toute conversation
qui lisait `TODO.md`. Il a fallu qu'il le redemande. **La leçon est celle de
`CLAUDE.md` §6 : rien n'est livré tant que ce n'est pas sur `main`** — pas même
une ligne de mémoire.

1. ~~**Impossible d'enregistrer la facture.**~~ — **fait le 12 août 2026.**
   Sous « Voir la facture en PDF », un lien « Télécharger (F2026-0001.pdf) ».
   Le nom porte le numéro — il en aura des centaines — et dit « brouillon »
   tant que la facture n'est pas arrêtée. **C'est le SERVEUR qui range le
   fichier** (`Content-Disposition: attachment` sur `?telecharger=1`) : le seul
   attribut `download` du lien est ignoré par certaines versions d'iOS, et le
   PDF s'ouvrait alors dans un onglet sans rien enregistrer.
2. ~~**« Ouvrir le SMS tout prêt » est carré**, alors qu'il le veut **ovale
   comme tous les autres**.~~ — **tranché et codé le 12 août 2026 : « code la
   A », la capsule.** Le bouton passe par `PrimaryButton`, jamais par un dessin
   recopié sur place : c'est le défaut même qu'on répare (§0 octies), et le
   repeindre à la main le ferait revenir au prochain changement de charte.

   **Deux réglages facultatifs ont été ajoutés à `PrimaryButton`**, sans
   toucher au dessin : `onClick` est désormais honoré sur la variante `href`
   (elle le perdait en silence — le départ vers la messagerie n'aurait plus été
   retenu), et `repere` pose un `data-atlas` pour que les suites désignent ce
   lien autrement que par son texte.

   *Les planches restent, elles racontent le chemin :*

   - `docs/maquettes/38-le-bouton-de-la-facture.html` — deux dessins immobiles :
     **A**, la capsule exacte des dix-sept autres écrans ; **B**, la même
     capsule cernée d'un filet ;
   - `docs/maquettes/39-le-bouton-de-la-facture-a-lessai.html` — **cinq gestes
     qui se pressent pour de vrai**, demandés le 12 août : *« plusieurs versions
     cliquables et dynamiques […] une appli hyper luxe et moderne »*. A la
     capsule nue, B la lueur qui traverse la laque, C le cachet qui tourne et
     sème l'or, D l'encre qui remplit, E le trait qui s'ouvre. Éprouvée au doigt
     par `scripts/verifier-maquette-bouton-facture.mjs`.

   **Il a retenu A**, la capsule nue — la retenue, encore une fois, comme à
   chaque tournée depuis le 11 août. Les quatre gestes écartés (la lueur, le
   cachet, l'encre, le trait) restent dans la maquette : s'il rouvre le sujet,
   c'est là qu'il faut repartir, et non les redessiner.

   **Ce qu'il faut lui dire, et qui a changé depuis sa demande :** le 10 août,
   tous les boutons étaient à 5 px de rayon et « ovale » aurait voulu dire
   changer la charte entière. Le 11 août au soir il a choisi la capsule, et
   « partout » — ce bouton-là est simplement passé au travers, parce qu'il est
   **peint à la main dans l'écran** (`TODO.md` §0 octies, même défaut que la
   feuille d'envoi du devis). **Choisir A ne rouvre donc aucune décision.**

   *Une capsule pleine largeur avait été dessinée d'abord : mesurée, elle est
   indiscernable de A — le libellé remplit la carte à deux pixels près. Deux
   dessins identiques ne font pas un choix, d'où le changement d'axe.*
3. ~~**On ne propose que le SMS.**~~ — **fait le 12 août 2026, et c'était le
   plus grave.** Une facture qu'on ne peut pas envoyer par courriel, c'est un
   client sur deux qu'on ne peut pas facturer. L'écran offre désormais les deux
   voies (`src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx`), et **la coordonnée manquante se
   saisit sur place** — il n'existe aucun écran de fiche client où l'envoyer.
   `ARCHITECTURE.md` §73.

### 7. Finir la refonte — l'ordre, les pièges, les valeurs

**Ce point existe pour qu'une conversation neuve puisse reprendre le travail
sans rien redemander.** Le CSS n'est pas recopié ici : il est dans la maquette
publiée, `docs/maquettes/13-le-fil-quatre-couleurs.html`, qui est du HTML pur —
ouvrez-la, lisez la feuille de style, elle fait foi pour le dessin.

#### L'ordre, et où l'on en est

| | Écran | État |
|---|---|---|
| — | Accueil, Planning, Terminés, Réglages, relevé de TVA | **fait** le 10 août 2026 |
| — | Fiche chantier, entièrement | **fait** |
| — | En-tête + boutons des six écrans d'étape | **fait**, par remplacement de motif |
| — | Corps de Photos | **fait** |
| ~~1~~ | ~~Corps de **Note vocale**~~ | **fait** le 10 août 2026 |
| ~~2~~ | ~~Corps d'**Informations** puis de **Prix**~~ | **fait** le 10 août 2026 |
| — | Fiche chantier : **l'anneau muet** et **la pellicule** | **fait** le 10 août 2026, au soir |
| **3** | Corps de **Devis**, **Export**, **Facture** | à faire |

**Ce que l'étape 2 a appris, et qui sert à l'étape 3.**

- **Les deux voix sont désormais des jetons** : `libelleCaps` et
  `texteSituation` dans `src/lib/design-tokens.ts`. Ne plus les retaper à la
  main. `smallCaps`, l'ancienne voix, ne sert plus qu'aux maquettes
  `/design/*` — un écran qui l'importe encore n'est pas refait.
- **L'écran Informations n'était pas dans « les six »** : son en-tête avait été
  oublié le 10 août au matin, et il est passé à `EnTeteEcran` avec son corps.
  Vérifier que **Transcription** ne dort pas dans le même angle mort.
- **Une action en capitales prend deux fois la place.** « Voir la
  transcription » à droite du titre repliait le nom du chantier sur deux
  lignes ; une flèche de plus faisait passer « Aller jusqu'au devis d'un seul
  geste » à deux lignes, la flèche seule sur la seconde. Mesurer avant, ou
  déplacer l'action.
- **Une plage occupe la largeur ; une action en toutes lettres s'aligne à
  gauche.** Sans `self-start`, un bouton texte s'étire et se centre tout seul.
- **`innerText` rend le texte TEL QU'IL S'AFFICHE.** Trois contrôles cherchaient
  « Prix Calculé » ou « Déjà au détail » ; les capitales les ont cassés sans
  qu'aucun défaut n'existe. Le réflexe utile : avant de corriger le produit,
  regarder si le contrôle lit du rendu ou de la donnée.
- **Prendre la capture d'abord, et à deux endroits** :
  `npx tsx scripts/capture-etape.mts <dossier> <chantierId> <étape…>` écrit le
  haut ET le bas de chaque écran. Les deux défauts réels de l'étape 2 — une
  croix hors de l'écran, la bulle sur le bouton — n'étaient visibles que là.
- **Le jeu de démonstration ne pose ni brouillon ni dictée analysable ici** :
  pour regarder un écran plein, insérer soi-même une ligne dans
  `brouillons_informations`. Sans cela on juge un écran vide.

Il n'y a plus de motif commun à remplacer : chacun a sa structure, donc plus de
codemod possible. C'est du cas par cas, **et chaque écran se regarde en capture
avant d'être déclaré fait** — trois défauts réels de cette refonte n'ont été
trouvés que là (`CLAUDE.md` §5).

#### Les valeurs de la grammaire

Elles ne s'inventent pas écran par écran : elles viennent des trois pièces
partagées — `EnTeteEcran`, `PrimaryButton`, `src/lib/design-tokens.ts`.

| Quoi | Valeur |
|---|---|
| Marge horizontale | **26 px** partout (`px-[26px]`), jamais 24 |
| Rayon | **4 px** pour une plage, **5 px** pour une action. Rien au-delà |
| Ombre | **aucune** (`cardShadow` vaut `"none"`) |
| Titre d'écran | serif, **36 px**, `letter-spacing: -0.018em` |
| Nom d'un chantier, intitulé d'étape | serif, **19 px** |
| Libellé, état, action secondaire | capitales, **9,5 px**, `letter-spacing: 0.28em` |
| Texte de situation (adresse, meta) | **11,5 px**, en `colors.muted` |
| Séparateur | un cheveu d'1 px, `colors.line` |
| Couleur d'attente | l'or, **et uniquement sur ce qui réclame un geste du patron** |

#### Les pièges, tous rencontrés une fois

1. **`npm run banc` ne rebâtit que si le commit a changé.** Tant que le travail
   n'est pas commité, il ressert la version d'avant : on mesure du code qui
   n'est pas sur le disque. `rm .next/atlas-version-batie.txt` force le rebâti.
2. **`npm test` abîme le jeu de démonstration.** Après la batterie, la connexion
   `demo@atlas.local` échoue jusqu'à un nouveau
   `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed`.
3. **Un bandeau posé dans l'en-tête écrase la liste.** Tout ce qui peut
   apparaître (notifications, annonces) va DANS la zone qui défile.
4. **`CarteGlissante` repeint ce qui est dessous** : sa couche porte le fond de
   la page. Un trait dessiné sous une liste glissante disparaît — le dessiner
   ligne par ligne.
5. **`position: sticky` est borné par le PARENT**, pas par le conteneur qui
   défile. Un élément collant enfermé dans un `div` d'une ligne ne colle que sur
   cette ligne : utiliser un fragment.
6. **Une feuille en `absolute` passe SOUS le bandeau et la bulle**, tous deux
   fixés. Une feuille modale se pose en `fixed`, au-dessus de `z-40`.
7. **Le navigateur d'essai** : `chromium.launch({ executablePath:
   "/opt/pw-browsers/chromium" })`, sinon Playwright réclame une installation
   qui est pourtant là (voir §0).

#### Les deux réserves — ce qui ne doit PAS suivre

- **Les maquettes `/design/*`** : découplées du produit depuis le 1er août,
  elles ne sont pas des écrans du patron.
- **Les pages que le CLIENT reçoit** — `devis/[jeton]`, `factures/[jeton]`, et
  le PDF. Un devis n'est pas un écran : c'est la pièce que le client garde,
  imprime et signe, et le patron a choisi sa terre cuite le 3 août **en
  connaissance de cause**, puis l'a maintenue.

**~~Question ouverte~~ — tranchée par le patron le 10 août 2026 :** *« il faut
que toutes les écritures de l'appli changent de police, on harmonise le tout. »*
Le devis et la facture suivent donc l'écran, et il n'y a plus d'exception de
typographie nulle part.

**Et la couleur suit aussi**, tranchée dans la foulée : *« oui, harmonise aussi
le devis »*. La terre cuite disparaît, l'accent des documents devient l'or.
`couleursDocument` reste néanmoins un jeton à part — papier et encre d'une
pièce imprimée ne suivront pas forcément un futur écran sombre.

Le **PDF**, lui, n'a jamais chargé Playfair ni Inter : il embarque Times et
Helvetica, les polices standard du format — il était déjà d'accord avec ce que
l'écran est devenu.

### 6. Rien ne mène le patron d'un écran au suivant

**Le tronçon principal est réglé** (2026-08-04) : depuis la transcription, un
seul appui va jusqu'au devis chiffré. Restent les marches d'à côté — après une
photo, après un tarif enregistré, après une facture émise, rien n'indique où
l'on va. Un écran qui ne dit pas la suite se lit comme une application en panne,
et c'est déjà arrivé.

---

## Terminé

- ~~Reprendre l'application Arborea sans le site vitrine, et la publier~~ — 2026-07-31
- ~~Vérifier le site publié à son adresse publique~~ — 2026-07-31
- ~~Cadrer l'agent (`docs/AGENT.md`) et la conformité (`docs/RGPD.md`)~~ — 2026-08-01
- ~~Acceptation des documents légaux avec empreinte~~ — 2026-08-01
- ~~Page publique de réponse du client, jeton, expiration, contre-proposition~~ — 2026-08-01
- ~~Purge de l'audio, export et effacement d'un client~~ — 2026-08-01
- ~~Envoi du devis au client, canal recueilli à la création~~ — 2026-08-01
- ~~Onglet « Terminés », fin de chantier, facture, relevé de TVA~~ — 2026-08-01
- ~~Suivi du devis parti : cinq états, notification, reprise~~ — 2026-08-01
- ~~Mémoire permanente du dépôt (ces fichiers)~~ — 2026-08-01
- ~~Caducité distincte du refus, et remontée à l'accueil~~ — 2026-08-01
- ~~Compteur d'accueil : ne plus compter les chantiers facturés~~ — 2026-08-01
- ~~Découpler les maquettes `/design/*` du type de statut vivant~~ — 2026-08-01
- ~~Le devis PDF reprend le modèle d'Arborea, et se pagine~~ — 2026-08-03
- ~~`test-reglages-e2e.ts` : attendre l'enregistrement, pas un délai fixe~~ — 2026-08-03
- ~~Document PDF pour la facture, sur le moteur partagé avec le devis~~ — 2026-08-03
- ~~Le devis à 0 € : bouton grisé, marche à suivre, et refus côté serveur~~ — 2026-08-03
- ~~Navigation : la barre du bas reste (décidé) ; l'action principale prend la carte d'Arborea~~ — 2026-08-03
- ~~La dictée arrivait amputée à l'écran : découpage, durée, vocabulaire, déchets~~ — 2026-08-03
- ~~Écrire le devis soi-même depuis l'écran Informations~~ — 2026-08-03
- ~~Le devis doublait au retour arrière du navigateur (4 017,60 € au lieu de 2 008,80 €)~~ — 2026-08-03
- ~~« Fin de chantier » injoignable sur un chantier planifié~~ — 2026-08-03
- ~~Planifier en demi-journées, et compter les équipes (le client ne voit que la date)~~ — 2026-08-03
- ~~Le client peut demander une correction, et son message parvient au patron~~ — 2026-08-03
- ~~La durée du chantier se choisit à la molette (½ journée à 100 jours)~~ — 2026-08-03
- ~~La durée dictée n'entrait pas dans la planification : un chantier de 2 jours n'en bloquait qu'un~~ — 2026-08-03
- ~~Le SMS s'ouvrait sans destinataire ; le canal se change désormais, et la coordonnée manquante se saisit sur place~~ — 2026-08-04
- ~~De la dictée au devis en un seul geste, et plus aucun écran mort quand le fournisseur répond à côté~~ — 2026-08-04
- ~~L'espace d'essai récupère le code neuf à chaque allumage, et l'application annonce sa version~~ — 2026-08-04
- ~~La date des documents s'écrit jour/mois/année~~ — 2026-08-04
- ~~La bande des durées est aussi sur l'écran Informations, là où il la cherchait~~ — 2026-08-04
- ~~Rédiger le devis entièrement à la main, depuis la fiche du chantier~~ — 2026-08-04
- ~~Retirer la case « Nom du chantier » : plus rien n'est obligatoire à la création~~ — 2026-08-05
- ~~« Rédiger à la main » ouvre le devis ENTIER, à l'image du modèle, et il reste dans Atlas~~ — 2026-08-05
