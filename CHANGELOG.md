# Historique des changements qui comptent

Ce qui a changé, et **ce que ça évite**. Les corrections de forme et les
ajustements de test ne figurent pas ici : `git log` les porte déjà.

Format : le plus récent en tête.

---

## 2026-08-12

### Relier l'agenda iCloud : la maquette, la réponse, et rien dans `src/`

**Sa question, capture du Calendrier d'Apple à l'appui :** *« je peux connecter
ce calendrier à mon appli ? »* — puis, aux deux questions posées : le compte
derrière la vitrine est **iCloud**, et il veut **les deux sens** (Atlas lit ses
rendez-vous, Atlas y écrit ses chantiers).

**Le Calendrier d'Apple n'est qu'une vitrine**, et c'est la distinction qui
commande tout : il affiche aussi bien iCloud que Gmail ou Exchange. Derrière du
Google, il n'y aurait rien eu à écrire — le raccordement existe
(`src/server/agenda/google.ts`). Derrière de l'iCloud, c'est un fournisseur en
plus, et un parcours moins confortable : Apple n'offre **aucun** équivalent au
bouton « accepter » de Google pour l'agenda. Reste CalDAV et un **mot de passe
spécifique à l'app**, recopié à la main.

**Ce qui est livré : une maquette, pas du code** (`maquettes/atlas-agenda-apple.html`,
22 contrôles). Sa règle du 11 août — dessiner avant de toucher à `src/`. Elle
tient deux règles qu'un écran de raccordement peut rater sans que rien ne
proteste :

- **on prévient avant de faire taper.** Ce mot de passe ouvre *tout* l'iCloud —
  mail, contacts, fichiers — et Apple ne sait pas le restreindre à l'agenda. Le
  contrôle vérifie l'avertissement **par sa position**, pas par sa présence :
  une phrase juste placée sous le champ est une phrase lue trop tard ;
- **écrire est une décision.** L'interrupteur est éteint au départ, et le choix
  du calendrier n'existe pas tant qu'il l'est. Le repli est un calendrier
  « Atlas » séparé : ce qu'Atlas a posé se retire alors d'un geste, là où des
  chantiers semés dans « Perso » se reprennent un par un.

**Deux défauts trouvés par les contrôles, pas à l'œil :** `font:400 16px/1.4
inherit` est une déclaration **invalide** — `inherit` n'est pas admis dans le
raccourci `font` — donc entièrement ignorée. Les champs retombaient à 13,3 px,
soit exactement le zoom de Safari que la ligne prétendait éviter, et les boutons
à 43 px, sous les 44 px du doigt. À l'écran, rien ne se voyait.

**Ce qui n'a pas pu être vérifié, et qui est écrit comme tel :** le réseau de
cet environnement refuse `caldav.icloud.com` (essayé, connexion refusée). Le
comportement réel d'Apple ne s'éprouvera que sur son banc. Réponse complète,
avec ce que ça coûte et ce que ça expose, dans `docs/QUESTIONS.md` §14.

### Le chevron doré du planning : l'adresse jusqu'au GPS en un doigt

**Sa demande :** *« lorsque je vais sur planning et qu'il y a un chantier
planifié, en cliquant dessus je puisse avoir un petit truc genre accéder à
l'adresse, et en cliquant dessus ça met l'adresse toute seule dans le GPS, soit
Maps, soit Waze »*.

Au bout de chaque chantier planifié, un **chevron doré** ouvre une feuille :
Plans, Google Maps, Waze, copier l'adresse, appeler le client. Sans quitter le
planning. Retenu après **quatre maquettes** (`docs/maquettes/29` à `32`), sa
règle de montrer avant de faire.

**Des liens universels, jamais `waze://`.** Un schéma propre échoue *en silence*
quand l'application n'est pas installée : le doigt appuie, rien ne bouge. Sur un
chantier, c'est une adresse qu'on n'a plus. Détail qui ne se devine pas :
`encodeURIComponent` et non `encodeURI`, sans quoi la virgule d'une adresse
sépare deux paramètres chez Waze et tronque la destination au numéro de rue.

**Sans adresse, rien ne s'invente** : les trois destinations disparaissent et la
feuille dit où la saisir.

**Trouvé en regardant la capture, pas par un test :** les 44 px du chevron
rognaient le nom du chantier — « Chez M. Bernard » devenait « Chez M. … ». Ils
sont désormais pris sur les marges. Les huit contrôles étaient verts : le nom
était bien là.

**Puis, sur la capture, il a tranché l'encombrement :** *« il faut que le créer
la facture, tu le mettes dans le chevron »*. « Créer la facture » a donc quitté
la ligne pour la feuille. Le nom du chantier passe d'environ 110 px à plus de
250. Le chemin du planning vers la facture, ouvert le 8 août parce que l'écran
était un cul-de-sac, coûte un appui de plus — **et trois suites le parcourent
en entier**, dont une qui vérifie qu'il a bien quitté la ligne.

**Vu sur la même capture, et corrigé :** la feuille affichait « M. Bernard —
Chez M. Bernard ». Elle collait le client devant un nom que l'application
fabrique justement à partir du client — le cas le plus courant du produit était
le plus laid. Aucun test ne pouvait le voir : les deux textes étaient exacts,
c'est leur mise bout à bout qui ne l'était pas.

`ARCHITECTURE.md` §70.

### La CI était rouge depuis des heures, et personne ne regardait

**Trouvé en allant voir**, après une poussée sur `main` : les exécutions
échouaient les unes après les autres, 56 suites sur 58. Deux pannes, aucune
visible depuis la machine de l'agent — c'est précisément pour cela qu'une CI
existe, et précisément pourquoi il faut la lire.

**1. Une suite lançait un navigateur qui n'existe que chez l'agent.**
`test-session-perimee-e2e.ts` codait en dur `/opt/pw-browsers/chromium`. En CI,
Playwright installe le sien ailleurs : « executable doesn't exist », à chaque
exécution, pendant que la suite passait ici. Elle emprunte désormais le lanceur
commun, qui sait retomber sur le navigateur installé.

**2. Le badge de développement de Next faisait virer six contrôles au rouge.**
`test-rien-de-recouvert-e2e.ts` voyait l'onglet « CHANTIERS » recouvert par un
`<nextjs-portal>` — le badge « 1 Issue », posé en bas à gauche, exactement
dessus. Il n'apparaît que lorsqu'il a quelque chose à signaler : d'où une CI
rouge par intermittence et une suite verte ici.

Ce badge **n'est pas le produit** — il n'existe pas dans la version bâtie. La
suite l'écarte donc nommément, et un témoin vérifie que l'exclusion reste
étroite : un vrai recouvrement au même endroit est toujours attrapé (éprouvé en
posant les deux voleurs à la même place). **Un contrôle qui échoue au hasard est
pire qu'aucun contrôle** : il apprend à ignorer le rouge, et l'on perd alors la
seule suite qui sache voir un bouton devenu inatteignable.

**Ce que cela ne règle pas, et qui est dans `TODO.md` :** sur le banc du patron,
qui sert le mode développement, ce badge recouvre bel et bien son onglet
« Chantiers ». Les quatre coins ont été mesurés — aucun n'est libre — et
l'éteindre lui ferait perdre le « 1 Issue » par lequel il a justement signalé
l'erreur d'hydratation de Safari. La bonne réponse est probablement de servir
une version bâtie sur son banc ; elle n'est pas prise ici.

---

### La fiche d'état ne partait pas — et personne n'avait jamais essayé de l'envoyer

**Le patron, après avoir redémarré son espace deux fois :** *« normalement tu es
censé voir la machine maintenant. Là je viens de le refaire une deuxième fois. »*
La fiche était toujours introuvable. Zéro fiche dans le dépôt.

**Le code était juste ; c'est le chemin qui ne l'était pas.** La publication
s'en remettait à `gh`, absent de son conteneur — il n'arrive que par une
fonctionnalité déclarée dans `devcontainer.json`, et **une déclaration ne répare
pas un espace déjà né**. Le sien est plus ancien que la ligne : redémarrer
récupère le code, jamais les outils. Quatrième fois que ce piège coûte une
soirée à ce dépôt, et cette fois il a coûté deux redémarrages **au patron**.

Trois choses corrigées, et la troisième est la seule qui empêche la récidive :

1. **La publication ne dépend plus de rien.** Codespaces pose un jeton GitHub
   dans chaque terminal ; l'API suffit. `gh` reste en second recours. L'ordre
   compte et il est gardé par un contrôle : `gh` d'abord, c'est ne rien publier
   chez la seule personne pour qui cette fiche existe.
2. **La fiche part AVANT que le serveur ait répondu**, plus seulement après. La
   version d'origine attendait jusqu'à dix minutes que l'application réponde —
   or le cas pour lequel cette fiche existe est précisément celui où elle ne
   répond pas. Elle se taisait exactement quand elle servait.
3. **Quelqu'un joue enfin l'envoi pour de bon.** Les contrôles éprouvaient la
   censure des secrets et la forme du corps ; **aucun n'avait jamais publié**.
   `scripts/eprouver-publication-fiche.mjs` crée une fiche jetable, vérifie que
   le second passage la met à jour au lieu d'en ouvrir une seconde, puis la
   referme — y compris quand l'épreuve échoue.

**Elle ne peut pas tourner sur la machine de l'agent** : le jeton qu'elle expose
est un substitut de son mandataire réseau, et GitHub le refuse (401 « Bad
credentials » — constaté, pas supposé). Elle tourne donc en CI, dans un travail
séparé, où le jeton est réel. C'est le déplacement que `CLAUDE.md` §5 prescrit.

**Et le journal de démarrage n'y figure plus — décidé par le patron.** En
regardant son dépôt, un détail est apparu qui change tout : **il est public.**
Une fiche y est lisible par n'importe qui, et indexée. La censure automatique
était faite au jugé — acceptable dans un dépôt fermé, pas quand le prix d'un
oubli passe d'une gêne de lecture à une clé publiée sur la place. Mis devant le
choix, il a tranché : retirer le journal.

Ce qu'on y perd, et qui est écrit pour qu'on ne le redécouvre pas : devant un
serveur qui refuse de démarrer, la fiche dira qu'il ne répond pas, **pas
pourquoi**. Ce qui reste répond à la question qui a coûté le plus cher — *sur
quelle version est-il, et son serveur tourne-t-il ?* Si la cause exacte devient
nécessaire, il faudra une extraction **structurée** (le nom de l'erreur, pas les
lignes autour), jamais un retour du journal brut.

`ARCHITECTURE.md` §69.

---

### Safari fabriquait des liens d'appel dans les pages du client

**Sur son iPhone :** la page publique d'une facture rend « Hydration failed ».
Le diff de React désignait le coupable sans ambiguïté — le DOM portait
`<a href="tel:2026-0003">` là où le composant ne rend que le texte `2026-0003`.

Aucune page du dépôt n'écrit de `tel:` sur un numéro de facture : le lien venait
du navigateur. iOS reconnaît d'office ce qui ressemble à un téléphone, une
adresse ou un courriel, et **réécrit le HTML avant que React ne s'installe
dessus**. Un numéro de facture lui ressemble assez.

**Ce n'était pas qu'une alerte de développement.** Le numéro devenait un lien
d'appel sous le doigt du client de l'artisan — sur la facture comme sur le
devis, qui le portent tous deux en titre. Un client dont le téléphone propose
d'appeler « 2026-0003 » n'a pas affaire à un outil sérieux.

Une ligne d'en-tête coupe la détection automatique, sur toutes les pages. **Les
trois formes, pas seulement le téléphone** : les deux autres cassent de la même
façon, et attendre la suivante coûterait un aller-retour de plus. **Rien n'est
perdu au passage** — les `tel:` qu'Atlas écrit lui-même (« appeler » sur la fiche
du client) et le bouton « Y aller » continuent de fonctionner, et c'est éprouvé.

**Ce qui n'a PAS pu être éprouvé ici, et il faut le savoir :** la détection est
propre à Safari, cet environnement n'a que Chromium. La panne d'origine ne peut
pas être rejouée, donc le correctif ne peut pas être vu la faire disparaître.
`scripts/test-detection-automatique-e2e.ts` garde ce qui peut l'être — l'en-tête
sur les deux écrans du client, un témoin qui vérifie qu'ils posent toujours un
numéro nu, et la survie d'un `tel:` explicite. Confronté au correctif retiré :
quatre cas au rouge, avec le bon coupable nommé. **Le verdict, lui, est sur son
téléphone.**

`ARCHITECTURE.md` §68.

---

### « Ça ne marche pas » va désormais chercher la fiche tout seul

**Sa demande :** *« Il faudrait que si j'écris ça ne marche pas, d'elle-même
elle aille regarder la fiche. »*

La consigne existait déjà en toutes lettres (`CLAUDE.md` §1 bis, écrit le matin
même). Elle ne suffisait pas, et pour une raison qui n'a rien à voir avec la
bonne volonté : **une consigne en prose se lit au début d'une conversation et
s'oublie au bout de trois heures** — or c'est au bout de trois heures qu'il
signale une panne, jamais au début.

`.claude/settings.json` branche donc `scripts/rappel-panne.mjs` sur chaque
message reçu. Dès qu'une tournure comme « ça ne marche pas » apparaît, le rappel
est remis sous les yeux de la session **au moment exact où il sert** : lire la
fiche d'état de son espace, regarder sa date d'abord, ne supposer qu'ensuite, et
lui faire lancer `claude` chez lui plutôt que de lui dicter dix commandes depuis
un téléphone.

**Il vaut pour ses trois ou quatre sessions à la fois**, et sans qu'aucune ait
rien à retenir : le fichier est dans le dépôt, donc chacune l'applique. C'est ce
qu'il demandait la veille — *« je veux que si je leur dis ça ne marche pas,
qu'elles se débrouillent »*.

**Il n'interdit rien et ne bloque rien** : il ajoute du contexte, et devant le
moindre doute il se tait. Ce n'est pas de la prudence de façade — un rappel qui
parle à tort s'apprend à être ignoré, et le garde-fou se perd alors sans que
personne s'en aperçoive. D'où deux garde-fous symétriques dans
`scripts/test-rappel-panne.ts` : les tournures qu'il a **réellement écrites**
les 11 et 12 août déclenchent (aucune n'est inventée), et les demandes
ordinaires — « corrige l'erreur de type », « est-ce que la CI est passée ? »,
« ça fonctionne ? » — ne déclenchent rien. Le câblage lui-même est vérifié : un
script juste que rien n'appelle ne protège personne, et son absence ne se voit
nulle part.

Confronté à l'état dégradé : réglages vidés de leur crochet, le contrôle passe
au rouge en nommant le bon coupable. Une entrée illisible, elle, laisse le
déclencheur muet et en succès — il gêne chaque message du patron ou il ne gêne
rien.

### L'espace du patron raconte son état là où l'agent sait lire

**Sa demande :** *« Faut trouver un moyen pour que tu aies accès à mon espace,
trouve. »*

Il n'y en a pas, et il ne fallait pas en fabriquer un. Aucune route ne relie la
machine de l'agent à son Codespace. Et la solution qui « marcherait » — une
boucle qui lirait des ordres dans le dépôt et les exécuterait chez lui — serait
une porte dérobée sur une machine qui porte ses identifiants GitHub et ses clés
d'IA : quiconque obtiendrait le dépôt commanderait son ordinateur. **Refusé, et
écrit ici pour que la question ne se repose pas.**

Le sens inverse est sans danger : **il pousse, l'agent lit.** À chaque allumage,
son espace publie son état sur une fiche GitHub dédiée — toujours la même, mise
à jour au lieu d'être multipliée : le commit récupéré, le commit réellement
SERVI, les services debout ou non, et les quarante dernières lignes du
démarrage. L'agent lit les fiches du dépôt ; il voit donc la machine du patron
sans y toucher, et sans lui faire recopier un terminal depuis un téléphone — ce
qui a coûté quatre allers-retours dans la seule nuit du 11 au 12 août.

**Ce qui ne sort jamais, et c'est éprouvé :** aucune variable d'environnement,
aucune clé. Le journal est recopié mais toute ligne qui ressemble à un secret est
remplacée par une mention. La censure est volontairement grossière — une ligne
innocente retirée ne coûte qu'une gêne de lecture, une clé publiée coûte une
clé. `scripts/test-rapport-espace.ts` tient les deux bouts : clé d'IA, adresse de
base et jeton GitHub disparaissent, le compte de démonstration reste lisible
puisqu'il est public. Confronté : sans la censure, les trois premiers passent.

**Best-effort, et jamais bloquant.** Sans `gh`, ou sans réseau, le script le dit
et rend la main — il ne peut pas empêcher le banc de servir. Vérifié ici, où
`gh` n'existe pas : « ⚠ Rapport non publié », code de sortie 0.

**Et cela vaut pour ses TROIS OU QUATRE sessions à la fois**, puisqu'il en fait
tourner plusieurs en parallèle. Deux choses ont été posées pour ça, sans quoi le
canal n'aurait servi qu'à celle qui l'a construit :

- la consigne vit dans **`CLAUDE.md` §1 bis**, lu au début de CHAQUE
  conversation — pas seulement dans `HANDOVER.md`. Devant un « ça ne marche
  pas » : lire la fiche, regarder sa date, n'avancer une hypothèse qu'ensuite,
  et lui faire lancer `claude` si un geste est nécessaire chez lui ;
- **le veilleur republie la fiche tous les quarts d'heure.** Écrite au seul
  allumage, elle décrivait l'état d'il y a six heures — et une session qui s'y
  fie conclut de travers, exactement comme d'une documentation périmée.

Deux contrôles de plus refusent que l'un ou l'autre disparaisse à la prochaine
réécriture.

Ce que cela ne donne toujours pas : l'écran du patron, et le pouvoir d'agir.
L'agent verra qu'un service est tombé ; c'est `claude`, installé dans l'espace,
qui pourra le relever.

---

### La porte est refaite, et l'adresse ne s'efface plus à chaque erreur

**Sa décision, en trois maquettes :** la ligne d'imprimé de la 32 sans son titre,
le tour de la 33, la rose des vents de la 34. `src/app/login/page.tsx` porte les
trois, plus les corrections qui ne dépendaient d'aucun choix : champs à **16 px**
(en dessous, iOS agrandit la page dès qu'on tape), refus dans le rouge de la
charte, place du message réservée en permanence.

**Et un défaut trouvé en regardant l'écran, antérieur à la refonte :** sur un
mot de passe faux, l'adresse était effacée. Toute à retaper, sur un téléphone,
pour un caractère raté ailleurs. Personne ne l'avait vu parce qu'aucune suite ne
se trompe de mot de passe — elles entrent toutes par une session fabriquée.
`scripts/test-porte-e2e.ts` est la première à passer par où il passe.

**Quatre correctifs sont tombés avant le bon** : la remise à zéro de React
arrive *après* le rendu qui suit l'action, et ni un champ contrôlé, ni un effet,
ni `defaultValue` n'y survivent. Détail dans `ARCHITECTURE.md` §71.

**Une réserve mesurée, pas supposée :** dans cet environnement, `next dev`
n'hydrate pas cet écran (sa liaison de rechargement à chaud est refusée par le
mandataire réseau) et le formulaire part en HTML pur. La suite le détecte et
annonce les contrôles concernés « non concluants » plutôt que rouges. Sur la
version bâtie — celle du banc — le sceau tourne, le bouton se désactive et
l'adresse survit.

**Le tour n'a pas de plancher**, et c'est un arbitrage écrit : il se répète tant
que la vérification n'a pas répondu, mais un serveur très rapide le coupe en son
milieu. Le tenir supposerait de retarder la navigation pour une question
d'allure.

### Huit gravures pour le sceau, et la bande qui en a fait jeter trois

**Sa réponse à la maquette 36 :** *« j'aime bien le 3. Maintenant propose avec
d'autres motifs dans le rond doré, change que le motif à l'intérieur. »* Le tour
est donc **acquis** ; `docs/maquettes/37-le-motif-du-sceau.html` ne fait varier
que la gravure — la feuille d'aujourd'hui (en témoin), la feuille seule, le A,
les cernes et la fente, le conifère, la rose des vents, l'arbre au trait, la
ligne de crête.

**La bande en tête de page n'est pas une décoration**, c'est le contrôle : les
huit motifs à leur **taille réelle**, côte à côte. Trois propositions y sont
mortes — deux brins d'eucalyptus et une branche penchée — parce qu'à six
millimètres, une tige et trois ovales se rejoignent en pâté quel que soit
l'écartement. **Aucune ne se voyait fausse sur le dessin agrandi.** C'est la
troisième fois que ce projet retrouve la même leçon : regarder l'écran, à la
taille de l'écran.

**Une remarque qui change le classement**, écrite sur la maquette : le tour
**impose** quelque chose au motif. La rose des vents tourne parfaitement ; les
cernes ne montreraient rien sans leur trait de fente, un rond concentrique qui
tourne étant un rond immobile ; et le A est le seul qui passe la tête en bas au
milieu du geste.

**Et un défaut du générateur, corrigé au passage.** `fusionner-maquettes.mjs`
préfixait une liste d'identifiants **écrite à la main** : deux maquettes portant
chacune un `entrer-1` donnaient une page unique où le libellé de la seconde
cochait la case de la première. Les familles numérotées sont désormais
reconnues d'elles-mêmes — un oubli de cette sorte ne se voit pas, la page
s'affiche parfaitement et ne répond à rien.

### L'entrée dans Atlas : six façons d'animer la marque, et un libellé qui ne cochait plus rien

**Sa demande, après la maquette 35 :** *« je veux la 4 sans le Connexion et vos
id. Tu rajoutes le nom Atlas comme sur le modèle 3, et tu me mets un logo
dynamique qui s'enclenche au moment où on valide l'adresse et le mdp, pendant
0,5 s avant d'entrer dans l'appli. […] le reste tu touches pas, que le logo qui
change. »*

`docs/maquettes/36-le-logo-qui-sanime.html` — **l'écran est identique sur les
six**, seule l'animation change : le cercle qui se ferme, la feuille qui pousse,
le tour, le battement et l'onde, l'or qui monte, le sceau qui s'imprime. Elle
**s'essaie** : on tape, on appuie, on entre, « ↺ Recommencer » remet l'écran —
et **sans un seul script**, la capsule étant un `<label>` qui coche une case.

**Ce qu'il faudra trancher avec lui avant de coder**, et qui est écrit sur la
maquette : la demi-seconde est un *plancher*, pas une durée d'attente. Le
serveur répond quand il répond, et l'animation doit pouvoir continuer au-delà —
une marque figée deux secondes ressemble à une application plantée. Les six
bouclent, exprès, pour qu'il en juge aussi.

**Deux défauts trouvés par le contrôle, aucun visible à l'œil :**

1. **L'écran de connexion effacé continuait d'intercepter le doigt.** Les deux
   écrans occupent la même case ; sans `pointer-events:none`, « Recommencer »
   ne répondait pas — l'appui allait dans la page invisible. C'est la famille
   des trois seuls défauts que ce dépôt n'a jamais su attraper autrement.
2. **`fusionner-maquettes.mjs` préfixait les `id` sans préfixer les `for`.** Un
   `<label for="g1">` restait donc orphelin dans la page unique : la page
   s'affichait parfaitement et ne répondait à rien. Corrigé pour toutes les
   maquettes, présentes et futures.

`scripts/verifier-maquette-logo.mjs` tient les trois promesses — ça s'anime, on
entre, on recommence — sur les douze écrans (fichier seul **et** page unique),
JavaScript coupé. Éprouvé rouge en retirant l'animation de la proposition 3.

### L'écran de connexion : une maquette avant/après, et un défaut trouvé en la dessinant

**Sa réponse à l'offre de la veille :** *« oui, fais-moi une maquette »*.
`docs/maquettes/35-l-ecran-de-connexion.html` reproduit l'écran d'aujourd'hui,
puis en propose quatre : la carte gardée, sans carte, le sceau, la ligne
d'imprimé. **Rien n'est posé dans `src/`** — c'est sa règle du 11 août, et la
maquette existe précisément pour qu'on n'ait rien à défaire.

**Pourquoi cet écran avait été oublié**, et ce n'est pas un hasard : c'est le
seul qu'on voit **avant** d'être connecté. Chaque refonte s'est faite en
parcourant l'application, donc en partant d'un écran déjà passé. La porte ne
fait pas partie du couloir.

**Le défaut trouvé en dessinant, et il compte plus que le choix esthétique :**
ses champs sont en **15 px**. En dessous de 16, iOS agrandit la page dès qu'un
champ prend le focus — il tape son adresse et l'écran lui saute au visage.
`design-tokens.ts` l'interdit depuis le 10 août ; l'écran de connexion ne s'est
jamais servi du jeton. Le refus de connexion, lui, est peint en rouge vif de
bibliothèque au lieu du rouge sombre de la charte. Les deux se corrigent quelle
que soit la proposition retenue — c'est écrit sur la maquette.

**La maquette a été REGARDÉE, pas seulement engendrée** : une capture au format
de son téléphone a montré un débordement horizontal que la vue au large ne
laissait pas voir. Le bouton « montrer le refus » est une case à cocher native,
éprouvée JavaScript coupé, dans la page seule **et** dans la page unique.

`TODO.md` §0 nonies · `docs/QUESTIONS.md` question 13.

---

## 2026-08-12

### Tous les boutons arrondis, et un contrôle pour que ça le reste

**Sa demande, en une ligne :** *« remplace tous les boutons rectangulaires par
les boutons arrondis »*. Seize boutons du produit portaient encore un rayon de
4 px — tous **dessinés à la main**, donc invisibles à la décision prise la
veille sur le composant partagé.

**Seul le rayon change.** Ni la couleur, ni la taille, ni le composant : deux de
ces boutons sont des boutons de formulaire (connexion, documents légaux) et les
faire passer par le composant partagé aurait cassé leur envoi sans qu'aucun type
ne s'en aperçoive. La connexion a été jouée pour de vrai après coup, dans un
navigateur.

**Et un garde-fou, parce qu'un balayage ne tient pas tout seul** :
`scripts/test-boutons-arrondis.ts` nomme le fichier et la ligne. Il porte un
témoin — un bouton rectangulaire écrit en dur — pour qu'un motif devenu aveugle
ne passe pas pour une application propre.

**Vu en capture, et non demandé :** l'écran de connexion est le seul resté dans
l'ancienne identité — bouton terre cuite, carte blanche, aucune serif. C'est le
premier écran qu'il voit. Rien n'a été touché ; c'est dans `TODO.md`.

`ARCHITECTURE.md` §67.

### Le client recevait sa facture avec les onglets de l'outil du patron dessous

**Le patron, capture à l'appui :** *« lorsque le client reçoit le lien cliquable
de la facture, s'il clique en dessous sur planning ou chantier, il a accès à mon
application. Ce n'est pas du tout ce que je veux. »*

**D'abord ce qui est rassurant, parce qu'il ne pouvait pas le savoir : il n'y a
jamais eu de fuite.** Vérifié dans un navigateur sans session — un appui sur
« Planning » mène à la page de connexion, et aucune de ses données n'est
lisible. Le contrôle qui le prouve était d'ailleurs déjà vert AVANT le
correctif, et il reste en place.

Ce qui était vrai, en revanche : **son client voyait « Chantiers · Planning ·
Terminés · Réglages » au bas de sa facture.** Une facture n'est pas un écran
d'application, et une barre de navigation inopérante est pire qu'absente.

**La cause n'était pas un oubli isolé, c'était une duplication.** Deux listes
tenaient la même vérité, chacune de son côté :

- le middleware savait `/factures` public — il le disait depuis le 6 août ;
- la mise en page tenait sa **propre** liste d'écrans sans navigation, où
  `/devis` figurait et `/factures` avait été oublié.

Un écran public ajouté plus tard n'entrait donc que dans l'une des deux. C'est
mot pour mot le défaut des barres de défilement de la veille : trois zones
portaient la règle, la quatrième l'avait perdue. **Deux copies de la même règle
finissent toujours par diverger** (`CLAUDE.md` §3).

La liste vit désormais à un seul endroit (`src/lib/chemins-publics.ts`), lue par
le contrôle d'accès ET par la mise en page. L'invariant tient par construction :
**ce qui s'atteint sans compte ne porte jamais la navigation du patron.**

`test-pages-publiques-sans-navigation-e2e.ts` balaie tous les chemins publics
**déclarés à leur source** — un nouveau chemin y entre et il est éprouvé le jour
même. Il visite de vraies adresses, avec de vrais jetons : un jeton inventé
rendrait « lien inconnu », dont la mise en page peut différer, et le contrôle
serait vert sur du vide. Il vérifie aussi la porte, pas seulement l'enseigne —
sans compte, les écrans du patron restent fermés. Confronté au code livré : un
seul rouge, sur la facture, exactement.

### « Mon devis » pouvait attendre indéfiniment une réponse déjà perdue

**Le patron :** *« entre le moment où je clique mon devis et le moment où le
devis apparaît, la première fois il s'est passé plus de six minutes et j'ai dû
recharger la page pour que le devis arrive. »*

**Le serveur, lui, avait fini depuis longtemps.** Mesuré ici : la chaîne met
**96 ms et 42 ms** sans modèle raccordé, et chaque appel à un modèle est borné à
trente secondes — elle ne peut pas durer six minutes. Ce qui a duré six minutes,
c'est **son attente** : la réponse de l'action n'est jamais revenue jusqu'à sa
page, et le bouton est resté sur « Atlas prépare le devis… », indéfiniment. Son
rechargement n'a rien réparé — il a montré un devis déjà écrit.

C'est la même famille que les deux défauts de la veille (`ARCHITECTURE.md` §63
et §65) : **un long aller-retour tenu ouvert est fragile par nature.** Un
mandataire qui coupe suffit à le perdre, et le travail continue sans personne
pour en recueillir le résultat.

**On cesse d'en dépendre.** Quand la réponse se perd, l'écran demande
périodiquement si le devis est là (`/api/chantiers/<id>/devis-pret`, sur le
témoin `devisGenereAt` posé quand le devis ET ses lignes sont écrits) et y va
dès qu'il l'est. Recharger la page n'est plus le travail du patron.

Trois précautions, chacune contre un défaut vécu :

- **l'attente sait renoncer.** Une attente sans fin est le défaut qu'on répare,
  pas celui qu'on déplace : passé cinq minutes, l'écran dit quoi faire ;
- **le compteur monte à l'écran.** « Atlas prépare toujours le devis… (48 s) » —
  un écran qui répète la même chose se lit comme un écran figé, et c'est ce qui
  l'a poussé à recharger ;
- **une réponse qui n'est pas du JSON ne passe pas pour un « prêt »**. Derrière
  un mandataire, une session expirée rend une page HTML, parfois avec un code
  200 : l'emmener alors sur un devis inexistant serait pire que l'attente.

**Et la chaîne dit maintenant sa durée au journal**, avec le statut obtenu. Le
raisonnement disait « six minutes, impossible » — mais personne ne l'avait
mesuré chez lui, et raisonner à distance sur une machine qu'on ne voit pas a
déjà coûté cher à ce dépôt. La prochaine fois, le journal tranchera.

### Deux chantiers pour que l'agent n'ait plus besoin du patron pour diagnostiquer

**Sa question, le 12 août 2026 :** *« comment on peut faire pour que tu aies
accès à mon espace, pour que tu sois autonome ? »* Elle vient de deux journées
perdues sur des pannes qui n'étaient PAS dans le code — services couchés, restes
de construction périmés, message qui accusait son mot de passe. Chacune a coûté
un aller-retour, parfois trois, parce qu'il fallait lui faire taper une commande
et recopier ce qu'elle affichait, depuis un téléphone.

**1. Un agent dans son espace.** `preparer.sh` installe Claude Code, et le
message d'accueil le dit : `claude` confie l'espace à l'agent, qui lit les
journaux, relance les services et rebâtit. Installation *best-effort* et jamais
bloquante — le patron ne doit pas perdre son banc parce qu'un registre npm a
hoqueté ; en cas d'échec, un message dit quoi retaper plus tard.

**2. Le contrôle du banc SE CONNECTE, pour de vrai.** Il s'arrêtait à « l'écran
de connexion s'affiche ». Or le 12 août, cet écran s'affichait parfaitement :
c'est ce qui se passait APRÈS l'appui qui était cassé. Un formulaire rendu ne
prouve rien d'une connexion, comme une page de santé ne prouve rien d'un écran.
`.devcontainer/verifier.sh` joue désormais `verifier-connexion.mjs` contre le
banc **déjà en écoute** — donc contre la version bâtie, celle que le patron
ouvre vraiment — avec une origine étrangère.

Trois trous bouchés au passage :

- **le navigateur manquait au conteneur** (`TODO.md` le signalait depuis le
  9 août) : il s'installe dans la commande du workflow, pas dans l'image ;
- **le workflow ne se déclenchait pas sur le code de connexion.** Deux
  correctifs de connexion sont partis sur `main` le 12 août sans qu'il s'en
  aperçoive : ses déclencheurs ne regardaient que l'outillage du banc, jamais ce
  qui laisse entrer ;
- **le nettoyage des types périmés n'avait aucun garde-fou.** Posé après la
  construction, il ne protégerait plus de rien — un contrôle lit maintenant
  l'ordre dans le fichier, et rougit si on l'inverse. Confronté.

Ce que cela ne donne pas, et qu'il faut dire : **l'agent n'a toujours pas son
écran.** Ce qui a été trouvé en regardant une capture — la perle en bas, le
bandeau coupé — restera trouvé par lui.

### Le devis repart, et le bouton de l'envoi devient enfin le bon

**Deux défauts sur une seule capture**, signalés le 12 août au matin.

**Le bloquant :** « je ne peux pas envoyer mon devis, ni par SMS ni par mail ».
La feuille d'envoi affichait *« Stockage local sélectionné en production —
configuration refusée »*. Sa configuration était juste : la barrière ne regardait
que `NODE_ENV`, or son banc sert une version BÂTIE et `next start` impose
`NODE_ENV=production` sans que rien ne soit déployé. La configuration connaissait
cette distinction depuis le 10 août ; cette barrière-là l'ignorait, et se croyait
redondante alors qu'elle était devenue plus stricte. Un déploiement réel exige
toujours S3 — rien n'est relâché de ce côté.

**Le second :** « le bouton, ce n'est pas le même ». Exact. La feuille d'envoi
dessinait son bouton à la main au lieu d'employer le composant partagé. Une
action principale dessinée sur place échappe à toute décision d'ensemble : elle
ne change que si quelqu'un pense à elle.

**Et pourquoi la planche de la veille ne l'avait pas vu :** elle parcourt des
adresses, et une feuille qui monte sur un geste n'en a pas. Le compte
« dix-sept écrans » ne comptait que ce qu'elle savait atteindre.

`ARCHITECTURE.md` §66.

---

### L'écran de connexion accusait le patron pendant qu'un service était couché

**Le 12 août 2026 :** *« Ça ne marche pas, je n'arrive pas à me connecter.
Occupe-toi-en, moi je ne peux pas le faire. »*

Deux défauts distincts, tous deux trouvés en coupant les services pour de bon
plutôt qu'en raisonnant dessus.

**1. La base arrêtée lui répondait « Email ou mot de passe incorrect ».** La
requête qui cherche son compte échouait, Auth.js l'emballait dans une
`AuthError`, et l'écran les traitait toutes pareil. Il pouvait retaper son mot
de passe toute la nuit : le message lui disait de recommencer, et recommencer ne
pouvait rien donner. C'est le défaut que l'en-tête de `src/app/login/actions.ts`
interdit depuis le 6 août — *ne jamais répondre « mot de passe incorrect » à
quelqu'un dont le mot de passe est bon* — sous sa **troisième** forme. Un seul
type d'erreur veut dire « ces identifiants sont faux » ; tous les autres veulent
dire « on n'a pas pu vérifier », et se rendent désormais par une phrase qui dit
les deux choses qui comptent : **ce n'est pas vous**, et ça se répare du côté du
service. Le journal, lui, nomme la cause.

**2. Redis tombé l'enfermait dehors, sans un mot.** `verifierLimite` levait
`MaxRetriesPerRequestError`, l'action de connexion mourait avec, et la page ne
bougeait pas. Un limiteur protège d'un ABUS : refuser tout le monde quand son
magasin tombe, ce n'est pas protéger, c'est infliger soi-même la panne dont on
se protégeait — et la première victime est celui qui a le droit d'entrer. La
demande passe donc, et le journal le dit fort. **Ce que ça coûte, franchement :**
pendant la panne du magasin, la protection contre les essais en rafale n'existe
plus. Risque accepté et borné à la durée de la panne, contre la certitude
d'enfermer l'artisan dehors.

**Ce qui manquait vraiment, et qui existe maintenant :**
`scripts/test-connexion-service-en-panne-e2e.ts` **coupe les services pour de
bon** — Redis, puis PostgreSQL — et regarde ce que l'écran répond, dans un vrai
navigateur. C'est le seul contrôle du dépôt qui fasse cela ; tous les autres
supposent l'environnement debout, et c'est exactement pour cela qu'aucun n'avait
jamais vu ce message mentir. Il remet chaque service en marche derrière lui, et
saute proprement le volet base s'il n'a pas de quoi la remonter — le dire plutôt
que de risquer de la laisser à terre pour les autres suites.

Confronté : en rétablissant l'ancien traitement, deux contrôles rougissent en
citant l'écran mot pour mot — « Email ou mot de passe incorrect » pendant que la
base est arrêtée.

### La note vocale ne partait pas — TROUVÉ : la page vieillissait sous le patron

**Trois signalements, la même phrase, et un défaut qui ne se reproduisait
jamais ici.** *« L'enregistrement n'a pas pu être transmis — la connexion a été
interrompue. »* La dictée passait pourtant à chaque essai : en développement,
sur la version bâtie, derrière une origine étrangère, avec un micro simulé.

**Ce qui manquait à mes essais, c'était le temps.** Les suites ouvrent une page
et agissent dans la seconde. Lui ouvre la fiche, regarde, réfléchit — et pendant
ce temps son banc se met à jour tout seul, comme il est fait pour.

Or **une action serveur n'a pas d'adresse** : elle porte un identifiant fabriqué
à la construction et inscrit dans la page. Après une reconstruction, la page
déjà ouverte appelle un identifiant que le nouveau serveur ne connaît plus.
L'envoi échoue **sans jamais l'atteindre** — d'où l'absence de trace au journal,
l'absence de refus à l'écran, et une phrase de secours qui accusait le réseau
alors que le serveur allait très bien.

Cela explique tout ce qui rendait le défaut insaisissable :

- **il ne se reproduisait pas ici** — l'identifiant était toujours frais ;
- **le reste de l'application marchait** — naviguer recharge la page, donc les
  identifiants. La fiche du chantier est justement l'écran où l'on STATIONNE ;
- **aucun message ne disait rien** — rien n'atteignait le serveur.

**Ce n'est plus une hypothèse : c'est reproduit.**
`scripts/eprouver-page-vieillie.mts` ouvre la fiche, redémarre le serveur, puis
dicte. Sur le code d'avant, il rend un `500` et **le message du patron, mot pour
mot**, avec la base vide. Par la route, un `200` et la note rangée.

L'enregistrement passe donc par une **URL** — `/api/notes-vocales/<chantier>` —
qui, elle, ne vieillit pas. Trois bénéfices s'ajoutent, qui vaudraient à eux
seuls le changement : le client reçoit un vrai code HTTP (401, 409, 500 se
distinguent), la limite de corps des actions serveur ne s'applique plus, et
l'envoi survit à une reconstruction. La règle est écrite une fois, dans
`note-vocale-entrante.ts`, et partagée par les trois écrans qui envoient une
note.

`test-note-vocale-par-url-e2e.ts` (voir `ARCHITECTURE.md` §65) tient l'invariant en continu : ramener
l'enregistrement dans une action serveur le fait rougir.

**Deux contrôles qui accusaient à tort, corrigés au passage.** Ils piochaient
« un chantier sans note » au hasard et tombaient parfois sur celui d'une autre
entreprise ; l'isolation le refusait à très juste titre, et le rouge désignait
l'application. Ils créent désormais leur chantier par l'écran. C'est le message
« étape : base » ajouté le matin même qui a permis de le voir en une lecture.

### La note vocale accusait le réseau d'une panne qui était au serveur

**Le patron, capture à l'appui :** *« L'enregistrement n'a pas pu être transmis
— la connexion a été interrompue. »*

C'était la branche de secours de l'écran, et **c'était le correctif de la veille
laissé à moitié fait**. Les refus ATTENDUS avaient été rendus bavards — format,
taille, cadence, enregistrement vide — mais les pannes IMPRÉVUES continuaient de
lever. La catégorie muette était précisément celle qui se produisait.

**Et sa phrase désignait le mauvais coupable.** Elle parlait de connexion alors
que l'aller-retour avait peut-être parfaitement eu lieu : une session expirée,
un disque plein, un service absent produisaient tous cette même phrase. Le
patron cherchait du côté de son réseau pendant que la panne était ailleurs. Une
erreur qui envoie chercher au mauvais endroit coûte plus cher que pas d'erreur
du tout — c'est écrit dans `AGENTS.md`, et c'est cette ligne-là qui a été
enfreinte.

**Deux changements, et le second est le plus important.**

*L'action ne lève plus rien.* Chaque panne rend une phrase qui **nomme le
maillon** — session, cadence, lecture, stockage, base. Le disque plein, le droit
d'écriture refusé et le service injoignable ont leur propre phrase, parce qu'ils
appellent chacun un geste différent : libérer de la place, corriger des droits,
relancer l'espace. « Le serveur n'a pas pu écrire » aurait fait chercher un
défaut dans le code, là où il n'y en a aucun. Le détail technique reste au
journal : le 11 août, une erreur de base non traduite avait affiché **la requête
SQL entière**, noms de tables et identifiant d'entreprise compris.

*L'écran ne conclut plus, il demande.* Quand l'appel lui-même échoue, il
interroge le serveur avant de parler. S'il répond, ce n'était pas la connexion —
c'est presque toujours une **page vieillie** : l'espace de travail se
reconstruit, les actions serveur changent d'identifiant, et une page ouverte
avant appelle une action qui n'existe plus. Le serveur va très bien, et un
rechargement suffit. Impossible à deviner, trivial à vérifier.

Douze cas éprouvent les deux règles sans base ni navigateur, et le contrôle a
été confronté à une traduction neutralisée : les huit premiers rougissent, y
compris celui qui interdit à la tuyauterie de fuir à l'écran.

**Ce qui n'est PAS corrigé, et qu'il faut dire :** la panne du patron n'a
toujours pas été reproduite ici — la dictée passe, avec un micro simulé, en
développement comme sur la version bâtie derrière une origine étrangère. Ce lot
ne répare pas la panne : il fait qu'elle se désigne. Et la note captée reste
**perdue** quand l'envoi échoue (`TODO.md` §0).

---
### Un contrôle qui s'effaçait lui-même son témoin

`test-detection-automatique-e2e` échouait sur « les `tel:` écrits par Atlas
restent des liens » — quarante-cinq secondes d'attente sur un `#temoin`
introuvable.

**Vérifié sur `main` seul avant de rien conclure : il échouait pareil.** Ce
n'était donc pas le lot en cours — et c'est la deuxième fois de la journée que
cette vérification évite d'accuser à tort.

La cause, reproduite puis comprise : le cas écrivait son témoin par `setContent`
dans la page qui venait de servir `/login`. Or `setContent` ne réécrit que le
document — **l'application, elle, tourne toujours**. Next réinjectait son
`<title>Atlas</title>` dans le `<head>` fraîchement écrit, et emportait tantôt
le témoin avec. Le contrôle accusait la détection automatique là où le fautif
était son propre décor.

Le témoin vit maintenant sur une page neuve, où aucune application ne tourne.

### Le contrôle des boutons ronds ne voyait presque rien

**Trouvé en lui livrant un bouton carré de plus.** `test-boutons-arrondis.ts`,
écrit le 12 août après sa demande — *« remplace tous les boutons rectangulaires
par les boutons arrondis »* —, cherchait la forme avec une classe niée `[^>]`.

Or **la flèche d'une fonction porte un chevron**. Tout bouton écrit
`onClick={() => …}` — c'est-à-dire l'immense majorité — passait donc sous le
radar. Le contrôle avait rougi une fois, sur le seul bouton dépourvu de
`onClick`, et en laissait passer **douze** à côté : quatre dans le devis dicté,
**trois sur la feuille d'envoi elle-même** — l'écran précis où il avait vu « un
bouton carré à côté d'une capsule » —, un sur la facture, un sur la note
vocale, deux sur l'assistant, un sur le calendrier.

Un contrôle qui attrape le cas rare et manque le cas courant est pire
qu'aucun : il fait croire que c'est propre. Le motif accepte désormais `=>`, et
les treize boutons portent la capsule. Sa règle du 12 août n'était appliquée
qu'à moitié ; elle l'est maintenant.

Le contrôle a été confronté à l'état qu'il prétend détecter — un bouton
rectangulaire témoin, avec et sans flèche.

### L'écran du devis parti est codé — « le signet d'or »

*« Code le 5. »* Retenu après onze blocs mesurés et cinq propositions
(`docs/maquettes/34-le-devis-sur-sa-base.html`).

**Ce que l'écran devient**, une fois le devis chez le client : un filet d'or pour
l'état, le nom du devis et le montant seuls au centre (46 px), « Modifier mon
devis » sous le total, et en bas sous le pouce le geste, le destinataire, puis
les trois actions en encre foncée — PDF · Copier le lien · Partager. Les lignes
de prestations n'y sont plus. **Elles restent AVANT l'envoi** : c'est là qu'on
vérifie ce qui part, et ce sont donc deux écrans distincts, pas un avec des
variantes.

**« Modifier mon devis » prévient, et ce n'est pas un ornement.** Vérifié dans le
dépôt avant d'écrire une ligne : rouvrir un devis parti crée une nouvelle version
mais **n'annule pas l'envoi** — la page publique sert `envoi.devis`, la version
reçue. Le client continue donc de la voir et peut l'accepter **au prix d'avant**.
Une feuille le dit en trois lignes, une seule fois, et se refuse. Refuser ne crée
aucune version : la suite le vérifie, parce que c'est exactement le genre de chose
qu'un correctif de confort casse sans bruit (`CLAUDE.md` §4).

**Trois défauts trouvés en éprouvant, et aucun n'était visible dans le code.**

1. **La hauteur, deux fois fausse.** D'abord `min-height: calc(100vh - 232px)` —
   232 étant l'en-tête « mesuré » ; l'écran débordait de 100 px. Puis
   `min-h-screen` + `pb-16`, qui comptait **deux fois** la barre du bas,
   `main.atlas-contenu` la réservant déjà : 68 px de trop. La bonne réponse
   existait depuis toujours — `atlas-ecran`, la classe de l'écran des chantiers.
   Un nombre magique décrivant la hauteur d'un en-tête devient faux au premier
   mot ajouté à un titre.
2. **Deux boutons nommés « Annuler »** dans la feuille — le voile et le vrai. Qui
   ne voit pas l'écran en entendait deux, sans savoir lequel choisir. Le voile est
   désormais `aria-hidden`, comme celui de l'écran des chantiers.
3. **« Plutôt par e-mail » manquait à mes cinq maquettes.** Personne ne l'avait
   remarqué, moi compris. Le livrer ainsi aurait défait sa demande du 4 août —
   *« si je veux l'envoyer par e-mail, je ne peux pas revenir le choisir »*. Il
   reprend sa place sous la ligne du destinataire, qui nomme déjà le canal.

**Deux détails qui viennent de sa capture du 12 août.** Le numéro s'écrit espacé
(`src/lib/numero-lisible.ts`) : collé, il ne se vérifiait pas d'un coup d'œil, et
c'est pourtant la dernière occasion de voir qu'on s'adresse au mauvais client —
son devis n'est pas parti ce jour-là à cause d'une adresse fausse. La fonction
**refuse de grouper** tout ce qui n'est pas un numéro français à dix chiffres :
un numéro étranger découpé par paires aurait l'air juste sans l'être, ce qui est
pire que rien sur une ligne de vérification. Et le bouton dit « Relancer par
SMS » quand le devis est déjà parti, « Ouvrir le SMS tout prêt » au premier envoi.

Éprouvé par `scripts/test-devis-parti-signet-e2e.ts` (huit points, dont le
débordement mesuré sur sa dalle) et `scripts/test-numero-lisible.ts`.
109/109 suites base, 55/55 suites navigateur, connexion réelle comprise.

**Deux suites tombaient, et elles avaient tort.** `test-suivi-devis-e2e` et
`test-envoi-client-e2e` lisaient le jeton du devis **dans l'adresse affichée à
l'écran** — celle-là même qu'il fait retirer. Six contrôles de suivi
dépendaient donc d'un détail d'affichage qui ne les concernait pas, et sont
tombés d'un coup. Ils prennent désormais le jeton là où il compte : dans la base
pour l'un, **dans le message que le patron va envoyer** pour l'autre. Le second
est un meilleur contrôle que l'ancien — il éprouve le lien que le CLIENT
recevra, et non celui qui était affiché à côté.

Un troisième exigeait la phrase « Le lien est toujours actif », et s'appelait
« un devis en attente affiche son lien ». Ce qu'il avait à défendre n'était pas
l'affichage mais le fait que **relancer réutilise le même lien** : il s'appelle
maintenant ainsi, et le vérifie sur le geste de relance et sur le nombre de
versions en base.

### Le devis parti, sur sa base — cinq façons de tenir ce qu'il a arrêté

Après la maquette 33, il tranche le **contenu** : ne garder que le nom du devis
et le total, retirer les lignes de prestations, poser sous le total un lien
**« Modifier mon devis »** qui ramène au devis, et passer « Télécharger le PDF »
et les deux autres **en encre foncée**, visiblement cliquables.

`docs/maquettes/34-le-devis-sur-sa-base.html` : sa base au mot près, puis quatre
façons de la tenir à contenu identique — le montant à même la page (52 px, sans
carte), le montant monté dans le titre, les trois actions empilées, et le signet
d'or. Ce qui se choisit n'est donc plus quoi montrer, mais comment le poser.

**Deux choses réglées en dessinant, et elles ne sont pas décoratives.**
« Partager autrement (WhatsApp…) » ne tient pas à trois sur une ligne : il
devient « Partager », ou bien les trois s'empilent (idée 4), ce qui rend chaque
cible large comme le pouce. Et l'idée 4 débordait de 23 px — resserrée à 11 px
de hauteur de ligne plutôt qu'en retirant « Parti il y a 2 jours », qui est la
seule chose de l'écran disant depuis quand on attend.

**Une question posée, pas tranchée :** reprendre un devis déjà parti en crée une
nouvelle version et rend l'ancien lien caduc. Faut-il le prévenir au clic ?

`src/` n'est toujours pas touché.

### « Trop d'infos sur cette page » — quatre façons de retrancher, dessinées

Le patron, capture à l'appui : *« je trouve qu'il y a trop d'infos sur cette
page, crée moi une maquette optimisée »*, puis : *« fabrique-moi la maquette et
montre-la-moi avant de coder quoi que ce soit »*. `src/` n'est pas touché
(`CLAUDE.md` §3 bis).

**Mesuré avant d'être dessiné.** L'écran du devis parti porte **onze blocs** et
déborde de **382 px** — il faut défiler, et c'est exactement ce qu'il signale.
La carte d'état porte à elle seule six choses, dont l'adresse complète du lien
sur trois lignes illisibles.

`docs/maquettes/33-le-devis-parti-allege.html` propose quatre retranchements qui
ne portent pas au même endroit — l'adresse effacée (6 blocs), l'état monté dans
le titre (4), le devis replié derrière une ligne (5), le geste seul sous le
pouce (3). Chacune dit **ce qu'elle coûte**, parce que c'est cela qui se choisit.

**Un contrôle qui a servi tout de suite.** La proposition A annonçait « tout
tient sans défiler » et débordait de 84 px : le texte était faux, et l'œil ne le
voyait pas. Il a fallu retirer aussi la carte « Chantier / Client », qui redisait
le numéro affiché deux blocs plus bas. Deux autres défauts n'ont été vus que sur
la capture — cinquante pixels de vide sous le total (les jambages d'une serif de
21 px), et quatre vignettes de bouton **vides**, leurs teintes n'existant que
dans le cadre du téléphone.

### Le bouton « carré » : il est déjà au rayon des cartes

*« Le bouton est toujours carré, pas arrondi comme tous les autres. »* Mesuré
avant de corriger : ce bouton porte **exactement le rayon des cartes**, 4 px
(`radius.card`), posé le 10 août à sa demande — *« un rectangle presque droit se
lit comme une pièce imprimée »*.

Il a pourtant raison de le voir carré, et la raison n'est pas dans le code :
**sur un aplat vert foncé, un rayon de 4 px ne se voit pas**, le contraste est
franc et l'œil lit un angle droit ; sur une carte crème posée sur un fond crème,
le même rayon se lit, parce que le coin fond dans la page. Pour *paraître* aussi
arrondi qu'une carte, un bouton plein doit être *plus* arrondi qu'elle.

La maquette montre donc le même bouton à 4, 8, 12 px et en pilule, chacun
au-dessus d'une carte au même rayon. Le choix lui revient — et il vaudra pour
**vingt-sept écrans** (`PrimaryButton`), ce qui est écrit noir sur blanc sur la
page.

### L'envoi du devis n'est pas en panne — et il ne faut pas le « réparer »

Signalé d'abord comme un défaut : *« lorsque le mail est parti je n'ai pas de
message qui prouve qu'il est bien parti, la page reste figée »*. Puis, de
lui-même : *« en fait le mail n'était pas parti […] il y avait une faute sur
l'adresse mail, c'est pour ça »*.

**Sa messagerie s'est bien ouverte. Le message n'est pas parti parce que
l'adresse était fausse.** Rien n'a donc été modifié, et c'est délibéré : la CSP
a été relue (elle ne régit pas la navigation `mailto:`), et l'adresse construite
pour son cas exact a été fabriquée et mesurée — 574 caractères, très en deçà de
toute limite. Écrit ici pour qu'une prochaine conversation ne parte pas réparer
une panne qui n'a pas eu lieu (`TODO.md`, 0 sexdecies).
## 2026-08-11

### Le serveur fantôme du port 3000 : un gardien juste, posé trop tard

Quatre batteries de suite ont fini sur « ❌ Le port 3000 est déjà pris », et
l'une d'elles a fait accuser le calcul du prix — `'0.00' == '34.50'`, un
enregistrement qui n'avait pas eu le temps de partir pendant que l'occupant
compilait. Le prix n'y était pour rien.

**Ce n'était pas une suite oublieuse** — l'hypothèse écrite en premier, et
fausse. Une sentinelle a noté ce qui tournait au moment où le serveur
apparaissait : parent déjà mort, aucune suite en cours, le verrou du banc à la
même minute. Le lanceur était `verifier-connexion-avec-serveur.mts`, qui monte
un vrai banc puis tue son groupe dès la connexion éprouvée.

`banc.mjs` **sert d'abord et bâtit ensuite** ; ses gestionnaires de `SIGTERM`
vivaient en fin de fichier, donc **après** la construction. Entre le lancement du
serveur et leur installation, plusieurs minutes : un signal reçu là tuait le
script net, et le serveur — détaché, pour d'excellentes raisons — survivait sur
le port. Le code était juste ; il arrivait en retard.

Ils sont désormais posés ligne suivante après le lancement. Et la batterie
navigateur **refuse** un port déjà pris au lieu de se rabattre en silence sur
l'occupant : c'était le plus grave, car cinquante suites avaient travaillé une
fois sur un serveur qu'elle n'avait pas lancé, sans un mot. Un résultat obtenu
d'un serveur inconnu ne prouve rien — vert ou rouge, c'est le pire des deux
états.

**Les deux contrôles savent échouer**, et l'un d'eux a dû être renforcé pour
cela : sa première version cherchait le nom de la fonction dans le fichier et
restait verte quand la garde était neutralisée d'un `if (false && …)`. Un
contrôle qui se contente de trouver un mot ne protège que du mot.

### Un chantier dicté ne pouvait plus jamais être envoyé au client

**Le patron, capture à l'appui :** *« l'encart qui permet d'envoyer aux clients
par SMS, par e-mail, a disparu. »* La feuille d'envoi était réduite à une
phrase — « Indiquez d'abord comment joindre ce client — sur sa fiche » — et un
bouton grisé.

**L'encart n'avait pas disparu ; la porte qu'on lui désignait, si.** L'écran
« Informations », seul endroit où saisir un téléphone ou un e-mail, avait quitté
le tiroir de la fiche **quelques heures plus tôt, à sa demande** — c'est donc un
défaut créé le soir même, en allégeant cet écran. Résultat : un chantier né d'une
dictée, dont le client reste « non renseigné », ne pouvait plus jamais partir.

Les deux canaux et le champ sont désormais offerts **là où ça bloque**, et la
coordonnée est écrite sur le client — pas retenue pour ce seul envoi.

**Ce que ça apprend dépasse cet écran, et c'est le vrai enseignement.** Le dépôt
avait déjà tranché ce point exact le 4 août, pour l'écran d'APRÈS l'envoi :
*« si la coordonnée manque, elle se saisit sur place — il n'existe aucun autre
écran pour la renseigner, et renvoyer le patron sur la fiche du client
l'enverrait vers une porte qui n'existe pas »*. La règle était juste, écrite, et
n'avait été appliquée qu'à un seul des deux écrans. Une semaine plus tard, le
second l'a payée. Elle est maintenant générale (`ARCHITECTURE.md` §62) : **un
écran qui refuse d'avancer offre de lever ce qui l'arrête, ou nomme un endroit
qui existe** — jamais l'un sans l'autre. Un renvoi écrit dans une phrase se
périme dès que la navigation bouge, et aucun test ne suit un lien écrit en
français.

**Pourquoi aucune suite ne l'avait vu :** toutes créaient leur chantier AVEC un
numéro. Le chemin le plus courant chez lui — créer, laisser le contact vide,
envoyer — n'était emprunté par personne. Il l'est maintenant, par l'écran, et le
contrôle va jusqu'à vérifier que la coordonnée est rangée en base : un écran qui
accepterait la saisie sans la ranger serait vert à l'œil et faux. Confronté au
code livré : trois rouges.

### Ajouter une photo ne fait plus changer de page — et l'écran Photos disparaît

**Le patron, capture à l'appui :** *« lorsque je suis sur la page chantier et que
je clique sur l'encadré doré avec le petit plus doré pour ajouter des photos, je
veux que ça arrête de me faire changer de page […] et que tu me supprimes toutes
les autres étapes »*.

Ajouter une photo coûtait **quatre gestes et un changement d'écran** : le « + »,
la page Photos, le bouton « Ajouter une photo », notre feuille « Prendre une
photo / Choisir dans ma bibliothèque », et **enfin** le menu du téléphone. Il en
coûte deux : le « + », puis le menu du téléphone.

**Notre feuille maison a disparu parce que le système fait mieux.** Un champ
`accept="image/*"` **sans `capture`** fait afficher par iOS un menu qui porte
déjà les trois entrées — *Photothèque*, *Prendre une photo*, *Choisir les
fichiers*. Les deux chemins que le patron exigeait le 6 août y sont, au même
endroit, un geste plus tôt. `capture` reste interdit : sur un iPhone il n'exprime
pas une préférence, il **impose** l'appareil photo et retire l'accès à la
photothèque.

**L'écran `/chantiers/[id]/photos` n'existe plus** — décision prise avec le
patron le même jour. Ajouter, regarder et retirer se font désormais dans la
pellicule du tiroir de la fiche. La route répond 404, et une suite le vérifie :
un écran à moitié supprimé est un chemin mort qu'on retrouve trois mois plus
tard sans savoir s'il compte encore. Deux choses ont été supprimées avec lui, à
dessein : le décompte « 6 photos » (il comptait ce qu'on a sous les yeux) et le
lien « Passer à la note vocale » (l'anneau est au centre de la fiche depuis la
veille).

**Deux défauts que le déménagement crée, et qu'aucune relecture n'aurait
vus** — détail dans `ARCHITECTURE.md` §60 :

- la visionneuse plein écran, rendue **dans** le tiroir, passait **sous** la
  barre de navigation : le tiroir porte un `z-index` et plafonne ses enfants.
  Elle sort par un portail, et une suite mesure que la barre est bien couverte ;
- le tiroir mesurait sa hauteur sur `[photos.length, etapes.length]`. La
  pellicule ne passant plus par ses propriétés, la mesure ne voyait plus rien :
  le tiroir des retirés apparaissait **derrière le bord**, « Annuler » hors
  d'atteinte. Il observe désormais son corps (`ResizeObserver`).

**Ce que la suite tient :** l'adresse **avant et après** l'ajout — c'est la
demande elle-même, et tout le reste peut être vert pendant que le patron change
d'écran.

### La ligne « Version » ne disait pas la BRANCHE — et il a cru avoir le bouton

**Le patron :** *« la modification du bouton nouveau chantier n'est pas
effectuée. Corrige ça. Et pourtant, j'ai la nouvelle dernière mise à jour, celle
de dix-neuf heures et quelques. »*

**Les deux affirmations étaient vraies, et c'est tout le problème.** Le bouton
est bien codé, poussé, éprouvé — sur la branche
`claude/nouveau-chantier-button-design-2vuu9h`. Son espace de travail, lui, suit
`main`, où il n'a jamais été fusionné. Et `main` avançait ce soir-là en
parallèle : `19:02`, `19:11`, `19:13`, `19:37`. Il a ouvert Réglages, lu
« 11/08/2026 19:37 · b45cd5d », et conclu qu'il avait la livraison de dix-neuf
heures. Il l'avait — ce n'était simplement pas celle-là.

**Rien à l'écran ne pouvait l'arbitrer.** Deux branches vivantes le même soir
portent la même heure, et sept caractères d'empreinte ne se comparent pas de
tête sur six pouces. La ligne Version existait précisément pour répondre à
« est-ce que j'ai les corrections ? » (7 août) ; elle a répondu **oui** à une
question à laquelle la réponse était **non**.

Elle nomme désormais la branche suivie — `… · b45cd5d · main` — et l'écran dit
en toutes lettres qu'un correctif livré sur une autre branche n'arrivera jamais
là, quelle que soit la date et quel que soit le nombre de fois qu'on presse
« Chercher les dernières corrections ». Ce bouton suit la branche courante : il
répondra fidèlement « vous étiez déjà à jour » jusqu'à la fin des temps.

**Un second mensonge, trouvé en chemin, dans `.devcontainer/demarrer.sh`.**
`ATLAS_VERSION` était calculée à la ligne 108 et la mise à jour arrivait à la
ligne 155 : le bandeau du terminal annonçait donc « Le code a été mis à jour au
démarrage » puis « Version exécutée : *celle d'avant* ». Elle est relue après la
mise à jour, avant que le veilleur ne reparte — sans quoi le serveur neuf
héritait lui aussi de la variable périmée.

Les trois états sont éprouvés, y compris ceux où l'on n'invente rien : hors
dépôt git (« inconnue »), et tête détachée (la ligne perd son dernier mot
plutôt que d'affirmer une branche fausse). Confronté à l'ancien code, le
contrôle rougit et nomme la branche manquante.

**Et le bouton est parti chez lui.** Sur son accord — *« fusionne dans main »* —
la branche est fusionnée dans `main` en avance rapide (`6059641`), batterie
complète au vert sur la fusion, 54/54 suites navigateur et connexion réelle
derrière une origine étrangère. Son espace le prendra au prochain allumage, ou
tout de suite par « Chercher les dernières corrections ».

### Six façons d'ouvrir un chantier, pour remplacer l'aplat vert

*« J'aime pas le gros bouton nouveau chantier […] ce gros bouton en plein
milieu, ça ne fait pas très luxe »*, le 11 août 2026, capture à l'appui.

`docs/maquettes/14-le-geste-nouveau-chantier.html` propose six remplaçants au
même endroit, l'écran restant identique par ailleurs — même en-tête, même fil,
même perle : **le filet** qui se trace, **le sceau**, **le premier brin**, **le
cartouche gravé**, **la pastille au pouce**, **la légende sur le trait**.
Rien n'est codé : l'application porte toujours l'aplat (`TODO.md`, 0 terdecies).

**Trois choix de fabrication qui ont compté.**

1. **Les écrans font 390 × 664**, la dalle réelle du patron (`ECRAN_DU_PATRON`),
   et non les 852 px d'une fiche technique. C'est ce qui rend le reproche
   mesurable : l'aplat coûte quatre-vingts pixels, soit **un chantier de moins**
   visible. L'écran d'aujourd'hui figure sur la page, à côté du constat — on ne
   compare pas à un souvenir.
2. **Tout ce qui bouge, bouge sans qu'on le survole.** Le patron regarde depuis
   un téléphone : un état qui n'existe qu'au survol n'existe pas pour lui. Les
   six propositions s'animent seules, en CSS, et l'état « doigt posé » est
   montré en fixe à côté du repos.
3. **Aucun script**, comme les treize maquettes précédentes : son lecteur n'en
   exécute pas, et une page engendrée en JavaScript lui arrive vide.

### Un rouge d'enchaînement qui n'en était pas un

`test-devis-e2e` — le total TTC d'un devis — est tombé **une fois** dans un
balayage complet, puis a repassé au vert sur les trois vérifications suivantes :
seule, sur `main` seul, et dans un second balayage complet de la même branche
(51/51). Il n'y avait donc rien à corriger, et c'est écrit ici pour que la
prochaine conversation ne reprenne pas la chasse.

**Ce que la chasse a quand même appris**, et qui vaut plus que le rouge :
`main` seul passe à 50/50, la branche à 51/51, et la suite fautive est **la
même** dans les deux cas quand on la joue isolément. Un balayage rouge une fois
sur quatre n'est pas une preuve : la machine porte alors un serveur, une base,
un navigateur et parfois un autre balayage — c'est la charge qui bouge, pas le
code. Rejouer AVANT d'accuser.

**Une seconde suite se comporte de même, et elle est nommée ici pour la même
raison** : `test-planning-vers-facture-e2e`, sur son dernier cas — *« clôturé
AVANT sa date : il quitte le planning pour les terminés »*. Deux balayages
complets l'ont vue rouge, deux exécutions isolées l'ont vue verte, sur le même
code. Elle porte déjà sa propre explication, et elle est juste : *« l'écran
Terminés n'a pas répondu en deux tentatives. C'est le serveur de développement
qui n'a pas suivi, pas l'écran. »* Un message qui désigne le bon coupable vaut
la moitié du diagnostic — ne pas le contredire sans preuve.

### L'aplat vert est remplacé — le bouton est CODÉ

Douze jours après le refus (*« ce gros bouton en plein milieu, ça ne fait pas
très luxe »*) et vingt-quatre maquettes plus tard, `src/app/EcranChantiers.tsx`
porte enfin le bouton qu'il a arrêté : **« Nouveau chantier » écrit, un anneau
d'un cheveu à sa droite qui BAT tant qu'on ne l'a pas touché**, et à l'appui
**trois tours avec onze grains d'or**, puis la feuille 520 ms plus tard.

**Les mesures viennent de la maquette, pas d'un souvenir.** Les onze grains
sont recopiés un à un depuis `docs/maquettes/24-le-bouton-retenu.html`, avec
leurs distances irrégulières — onze grains à la même distance dessinent une roue
de vélo, pas une gerbe. Les réinventer, c'était s'assurer que l'écran et la
maquette divergent au premier retour.

**Ce que le geste protège, et qui n'est pas décoratif :**

- **l'appui s'enfonce en 140 ms**, bien avant la fin du tour — une demi-seconde
  sans réponse se lit comme une panne, et on appuie deux fois ;
- **un second appui pendant le geste est ignoré** — sans quoi deux chantiers
  naissent là où il n'en voulait qu'un ;
- **sous « mouvement réduit », la feuille monte tout de suite**, sans battement
  ni gerbe : attendre une animation qui ne joue pas ferait passer un réglage
  d'accessibilité pour une lenteur ;
- **le lien garde son `href`** : sans JavaScript, ou avant l'hydratation, il
  mène à l'écran entier. C'est le repli, et il est voulu.

`scripts/test-bouton-nouveau-chantier-e2e.ts` mesure la demi-seconde et le
double appui ; `scripts/capture-bouton-nouveau-chantier.mts` prend les trois
états — l'attente, le geste figé à mi-course, la feuille — parce que trois
défauts de ces maquettes n'ont été trouvés que par une capture.

**Une variable de plus dans la palette** : `--or`, le second accent, qui
n'existait que dans `design-tokens.ts` et pas en CSS.

### Le bouton est arrêté : le mot, le rond qui bat, resserré

Il a retenu la première disposition — *« j'aime bien le premier »* — et demandé
quatre réglages : une onde d'attente qui va moins loin, un ensemble plus petit,
un rond plus petit, moins de grains.
`docs/maquettes/24-le-bouton-retenu.html` ne montre que celui-là, et chiffre
chaque écart pour qu'il puisse être refait à l'identique dans l'application :

| | avant | après |
|---|---|---|
| portée de l'onde | 1,85 × le rond | **1,42 ×** |
| diamètre du rond | 46 px | **38 px** |
| taille du « + » | 24 px | **20 px** |
| écart mot ↔ rond | 16 px | **13 px** |
| corps du libellé | 9,5 px | **9 px** |
| nombre de grains | 16 | **11** |
| portée des grains | 58 px | **46 px** |

Ce qui n'a pas bougé : les trois tours freinés en 560 ms, la demi-seconde avant
la page, l'arrêt net du battement dès l'appui.

**Le contrôle exigeait au moins trois boutons pressables par page** — une
habitude prise sur les pages de comparaison. Il refusait donc celle-ci, qui
n'en montre qu'un, et pour cette seule raison. Un contrôle qui encode une
habitude finit par refuser ce qui la rompt : le seuil est ramené à un.

### Le mot, le rond qui bat, et la poussière

Il a décrit le mixte pièce par pièce : *« nouveau chantier écrit, le plus à
droite qui clignote en attente qu'on clique dessus, et une fois qu'on clique,
il se met à tourner avec les éclats de poussière »*.

`docs/maquettes/23-le-mot-et-le-rond-qui-bat.html` tient le geste fixe — le
battement d'attente, le tour de trois tours, seize grains d'or, puis la page —
et ne fait varier que **la place du mot** : à droite du rond, coupé en deux par
lui (« Nouveau » | rond | « chantier »), en petit doré dessous, réduit à
**« Ajouter »**, accompagné des deux traits, posé au-dessus, ou **effacé par le
geste lui-même**.

**Le battement n'est pas un clignotement, et c'est délibéré.** Allumé/éteint,
c'est un signal d'alarme ; ici une onde d'or naît du bord de l'anneau toutes les
3,4 secondes et se dissout. Elle s'arrête NET dès l'appui : un objet qui
continue d'appeler alors qu'on l'a déjà pris n'écoute pas. Et le rythme est lent
à dessein — un écran qui alerte dix fois par jour finit par être ignoré, ou
éteint.

**Un défaut vu à la capture :** « le mot dessus » était la copie exacte de « le
mot dessous ». Le mot était déjà écrit avant le rond dans le balisage, et la
colonne était en plus inversée — deux inversions valent une identité. Les sept
contrôles étaient verts, et les deux cartes montraient la même chose.

### Le rond redescend au milieu, entre deux traits

*« Je ne veux pas qu'il soit en haut à droite, je veux qu'il soit vraiment
centré au milieu, et peut-être avec un petit trait de chaque côté du rond […]
et lorsqu'on clique, les traits qui s'écartent légèrement. »*

`docs/maquettes/22-le-rond-entre-deux-traits.html` reprend donc l'anneau et son
« + » — celui qu'il a retenu — mais **au centre**, à la place qu'occupait
l'aplat vert, flanqué de deux traits de 56 px. À l'appui : trois tours, les
traits s'écartent de douze pixels, puis la page.

Les six déclinaisons sont les mêmes qu'à la maquette 21, à une près : « le trait
aspiré » devient **« les traits qui rentrent »** — l'inverse du geste demandé,
gardé pour qu'il puisse comparer plutôt que me croire sur parole.

**Deux de plus, à sa demande, reprennent l'anneau de la note vocale** : un
cercle sombre à l'extérieur, un second à l'intérieur — et la dernière remplace
les traits par **les petits crans de la dictée**. L'argument n'est pas de goût :
les deux écrans cesseraient d'avoir chacun son vocabulaire. On dicte dans un
anneau, on ouvre un chantier dans le même, et le troisième geste rond, le jour
où il faudra, existera déjà.

Deux mesures qui ne se voient pas mais qui décident : le rond passe de 46 à
52 px quand il porte le second anneau — en dessous, deux cercles concentriques
se touchent presque et l'ensemble se lit comme un trait épais ; et les sept
crans ont des hauteurs inégales, parce qu'un peigne régulier se lit comme une
mire d'imprimeur, pas comme un son.

**Les traits sont DANS le lien, pas à côté.** La cible du doigt fait alors toute
la largeur du groupe au lieu des quarante-six pixels de l'anneau : sur un
téléphone, c'est la différence entre viser et toucher.

**Un défaut vu à la capture, invisible au contrôle :** le bloc du titre a perdu
ses marges en changeant de squelette — elles vivaient dans la grille de la
maquette précédente, où le « + » était dans l'en-tête. « Bonjour Florian » se
retrouvait collé au bord de l'écran, et les douze contrôles étaient verts.

### Le bouton est choisi : le « + » au bout du titre

Il l'a désigné sur une capture de la maquette 15 (proposition H) : *« le petit
plus là que tu vois en haut à droite, c'est celui-là que je veux »*. C'est
l'anneau d'un cheveu posé sur la ligne de base de « Vos chantiers » — celui qui
**ne coûte aucune ligne à l'écran**. Ce qu'il demande en plus : *« qu'il se
mette à tourner à fond et qu'ensuite ça ouvre la page »*.

`docs/maquettes/21-le-plus-du-titre.html` en donne six déclinaisons, toutes
bâties sur le même tour — trois tours rapides, freinés à la fin, puis la page :
**le tour franc** (rien d'autre), **le tour et la poussière** (seize grains
d'or), **l'anneau qui s'ouvre** (il s'agrandit jusqu'à devenir la page — et,
comme il est en haut à droite, la page naît du coin), **les deux sens** (l'anneau
contre le signe), **le trait aspiré** (le filet de l'en-tête se rétracte dans
l'anneau), **le tour appuyé** (l'écran recule d'un cheveu, comme il le fait déjà
quand une feuille monte).

**Un cercle qui tourne ne se voit pas tourner.** Celui du contre-tour porte donc
une encoche d'or. C'est exactement l'erreur qui avait rendu invisible la lunette
du cadran, quatre maquettes plus tôt — et elle serait passée une deuxième fois
sans la capture.

### Trois défauts du contrôle, dont deux qui accusaient la maquette

Éprouver des gestes de plus en plus vivants a fini par casser l'outil qui les
éprouve, et chaque fois en accusant le mauvais coupable :

- **Sa fenêtre de mesure partait de l'appui.** Quand le clic mettait cinq
  secondes à rendre la main, elle était close avant d'avoir commencé : il
  annonçait « la feuille n'est jamais montée » alors qu'elle l'était depuis
  longtemps.
- **Son clic attendait un bouton immobile.** Dès qu'un geste déplace son propre
  bouton — l'écran qui recule, les lettres qui s'écartent — Playwright rejouait
  son clic en boucle, et chaque rejeu relançait le geste. Le clic est désormais
  dispatché sans attendre (`force`).
- **Il jugeait « ça bouge » en cherchant un `<svg>`**, ce qui refusait toute
  proposition dont la matière n'a pas de dessin.

### Le rond éclate, et devient la page

*« Un rond avec un plus et lorsque j'appuie, une dynamique un peu style
explosion, de débris, avec le rond qui s'agrandit. »* Le squelette est donc fixé
par lui, et ne varie plus : disque plein (vert pin, ou or), « + », gerbe, puis
agrandissement jusqu'à remplir l'écran. **Aucun fond clair nulle part.**

`docs/maquettes/20-le-rond-qui-eclate.html` ne fait varier que **la nature des
débris** : la poussière d'or (vingt grains fins), les tessons (c'est le rond
lui-même qui se fend en six), la braise (treize étincelles qui **retombent**),
le souffle (aucun débris, trois ondes), l'or plein (disque d'or, gerbe sombre),
la croix éclatée (c'est le « + » qui se brise en quatre barres).

**La feuille ne monte plus du bas** : elle est posée sous le rond qui grandit et
se découvre à mesure. Deux mouvements l'un sur l'autre faisaient bégayer le
geste.

**Trois défauts vus à la capture, et aucun n'aurait été trouvé autrement.**
Le rond commençait à grandir en même temps que la gerbe : le disque de papier
recouvrait les débris avant qu'on ait pu les voir — l'explosion existait dans le
code et nulle part à l'écran. Les débris étaient posés **sous** le disque : on
ne voyait qu'une poussière collée sur le vert, de la saleté plutôt qu'une
explosion. Et ils partaient du centre au lieu du bord, si bien que les trois
quarts de la gerbe restaient cachés.

Les distances de projection sont donc étirées pour le grand format de la planche
(`--f`) : un débris qui naît au bord d'un disque de 76 px naîtrait au milieu
d'un disque de 104.

### Retour à la retenue : six gestes tenus

*« Tu as primé sur l'originalité au détriment de l'élégance. »* Le reproche est
juste, et il est daté : la maquette 18 faisait du spectacle.

`docs/maquettes/19-six-gestes-tenus.html` retire trois choses, et c'est tout le
sujet : **la gerbe d'éclats** (dix esquilles projetées), **les matières
simulées** (métal brossé, laque brillante, cire), et **les mouvements
simultanés** — désormais une seule chose bouge à la fois, le reste de l'écran ne
bronche pas. Restent la proportion, le cheveu d'or et le temps : les six gestes
durent entre 500 et 640 ms.

Les six : **le mot** (les lettres s'écartent, l'œil se referme), **la goutte
d'or** (vingt pixels, le seul aplat de couleur de l'écran), **le disque de
nuit** (galet mat, le cerceau vient s'y poser), **le cercle qui se ferme** (il
manque un arc ; l'appui le complète, puis le cercle devient la page), **le filet
traversé** (le trait qui ferme l'en-tête porte l'œil — rien ne s'ajoute), **les
deux volets** (la ligne s'écarte en deux, la feuille monte par l'ouverture).

**L'ouverture par agrandissement n'est gardée que sur une seule des six.**
Répétée partout, elle deviendrait un tic — et c'est exactement ce qui rendait la
maquette précédente bavarde.

**Un défaut né en cherchant l'élégance, et il en dit long.** L'écartement des
lettres élargissait le lien de vingt-huit pixels *pendant* le geste : le
contrôle automatique n'arrivait plus à le presser deux fois de suite. Une cible
qui grandit sous le doigt est une cible qui se dérobe — la boîte du bouton est
maintenant fixe, seules les lettres bougent dedans. Et sans `nowrap`, le libellé
passait sur deux lignes en plein geste.

**Le contrôle ne cherche plus une classe, mais un rôle.** Il visait
`.pastille`, puis `.geste` ; la maquette suivante l'aurait encore appelé
autrement, et il serait passé au vert **sans rien presser du tout**. Il vise
désormais ce que le bouton annonce à qui ne voit pas l'écran :
`[aria-label="Nouveau chantier"]`.

### Plus aucun fond clair : six matières, et deux boutons qui deviennent la page

*« On s'améliore, mais je n'aime toujours pas. […] J'ai l'impression que le fond
blanc me dérange. J'ai envie que tu sois innovant […] devancer tout le monde,
Apple, Amazon. »*

`docs/maquettes/18-six-matieres.html` change d'axe. Aucune des six ne pose de
disque de papier : **l'iris** (six lames de laque qui s'écartent sur une lumière
d'or), **l'or brossé** (un anneau de métal dont les stries tournent avec lui),
**la laque** (un galet profond où un reflet glisse même au repos), **le cachet
de cire** (bord irrégulier, A en relief, qui s'écrase à l'appui), **le vide**
(pas de disque du tout — un anneau, et le papier de l'écran au milieu), **le
noyau** (de l'encre et de l'or qui dérivent, sans aucune marque).

**Et surtout, deux d'entre elles n'ouvrent plus la feuille : elles la
deviennent.** Sur l'iris et le vide, le bouton s'agrandit jusqu'à remplir
l'écran, et la page est déjà là quand il a fini. Le geste et l'écran qui arrive
ne font qu'un seul mouvement — c'est là que se joue l'écart avec ce que font les
autres, pas dans la couleur.

Tout est fait à la main, sans image ni police : dégradés coniques pour le métal,
ombres internes pour le relief de la cire, six lames en SVG pour l'iris.

**Deux défauts vus à la capture, et un seul aurait suffi à tout gâcher.** Dans
un SVG, un « px » de transformation vaut **une unité de la vue** : les lames de
l'iris, écartées de « 4,2 px », partaient en réalité de treize pixels — le
disque devenait un carré à l'ouverture. Et le grain de lumière du centre,
déclaré avant les lames, passait dessous : en SVG c'est l'ordre du balisage qui
décide, pas l'intention.

**Si une matière est retenue**, la teinte de laque (#10150f → #263025) devra
entrer dans `src/lib/design-tokens.ts` : une couleur qui ne vit que dans une
maquette finit par diverger de l'écran.

### Le contrôle mesurait la demi-seconde à l'œil, il la chronomètre

`verifier-maquette-pastille.mjs` regardait « à 200 ms, la feuille est-elle
fermée ? ». Sur une machine chargée, ce regard arrivait parfois à 520 ms et
accusait un délai qui n'avait pas bougé — un contrôle qui échoue une fois sur
dix ne prouve rien et use la confiance de qui le lit. Il **mesure** désormais
l'instant où la feuille monte. Il ne cherche plus non plus de `<svg>` pour
juger que « ça bouge » : « le noyau » n'a aucun dessin, sa matière est une nappe
de dégradés — chercher une forme précise, c'est refuser la proposition suivante.

### Le sceau est retenu, six gravures le disputent

*« J'aime beaucoup la deuxième. Par contre, ce que je n'aime pas, c'est un peu
le design de la pastille. »*

Le **sceau clair** — disque de papier cerné d'un cheveu d'or — est donc acquis :
sa taille, sa place, la gerbe et la demi-seconde ne bougent plus.
`docs/maquettes/17-six-marques.html` ne fait varier que **la gravure** : le
cadran gradué, le trait pur, le monogramme d'Atlas, la facette, l'anneau et sa
bille, le point. Les six se pressent — côte à côte pour comparer la marque, puis
chacun dans l'écran pour le geste entier.

**Le cadran ne fait pas tourner son signe, mais sa lunette.** Une aiguille qui
tourne se lit comme un chargement ; une lunette qui tourne se lit comme un
mécanisme. C'est la seule des six où le mouvement veut dire quelque chose.

**Trois défauts vus à la capture, invisibles autrement :** la lunette tournait
sans que rien ne le montre — soixante graduations identiques sont immobiles quel
que soit l'angle, il a fallu leur donner un repère ; l'onde d'un grand sceau
débordait de sa carte et n'y laissait que quatre arcs dans les angles ; et la
corde horizontale de la facette brouillait la taille de la pierre.

Le contrôle éprouve désormais la **première et la dernière** pastille armée
d'une page : sur la page fusionnée, ce sont deux maquettes différentes, chacune
avec son script — n'en éprouver qu'une laissait l'autre silencieusement morte.

### La pastille qui tourne, éclate et ouvre — la première maquette qu'on presse

*« Je veux une sorte de pastille un peu ronde avec un design sympa à
l'intérieur. Lorsqu'on appuie dessus, je veux qu'elle se mette à tourner super
vite, qu'elle dégage comme une sorte d'onde ou de petits fragments et qu'au bout
d'une demi-seconde, ça ouvre la page nouveau chantier. »*

`docs/maquettes/16-la-pastille-qui-tourne.html`. Trois habillages du même
disque, tous pressables : jeton de vert pin, sceau clair, disque nu — plus le
même jeton posé sous le pouce. La marque gravée est une **rose des vents** :
Atlas est un nom de cartes, et les quatre branches longues d'une rose dessinent
déjà un « + ». Le signe de l'ajout est dans la marque, il n'a pas eu à s'y
coller.

**C'est la première des seize qui porte un script**, et c'est assumé : une page
qui ne répond pas au doigt ne prouve rien de ce qu'elle avance. Le geste est
donc aussi démonté image par image, pour les lecteurs qui n'exécutent rien.

**Ce qui a été trouvé en regardant, et jamais par un contrôle vert :** au
premier essai, les dix éclats partaient aux bons angles, à la bonne vitesse — et
restaient invisibles, parce qu'ils pâlissaient dès leur départ. Ils gardent
maintenant leur plein jusqu'à 64 % de leur course.

`scripts/verifier-maquette-pastille.mjs` presse la pastille pour de bon, dans
les deux pages (la maquette seule et la page fusionnée) et dans les deux
réglages de mouvement. Confronté à une demi-seconde supprimée, il refuse — avec
le bon coupable dans le message.

### Un script de maquette ne pouvait ni balayer sa section, ni échouer seul

La page unique donnait aux scripts un `document` réduit à `getElementById` : la
maquette 16, qui arme ses pastilles par leur classe, y mourait sur
« querySelectorAll is not a function ». Pire, l'exception emportait les scripts
des maquettes suivantes — une page à moitié morte, sans un mot pour dire
laquelle avait fauté. La portée sait maintenant balayer sa section, et chaque
script est enfermé dans son propre essai.

### Deuxième tournée : six gestes qui, cette fois, ne se ressemblent pas

*« Je ne suis pas encore hyper convaincu. Propose-moi d'autres choses. »*

Le défaut de la première tournée est nommé dans la page elle-même : six façons
d'**amincir le bouton** ne font pas six idées, elles font une idée déclinée six
fois. `docs/maquettes/15-encore-six-gestes.html` change donc de nature à chaque
fois — l'action prend une ligne d'écriture (**G**, une ligne réglée où bat un
curseur), se pose sur la ligne de base du titre sans occuper de rang (**H**),
devient une marque d'imprimeur (**I**), descend au milieu du bandeau (**J**),
disparaît au profit d'un geste de traction (**K**), ou se range en signet sur la
tranche droite (**L**).

**Deux réserves écrites dans la maquette plutôt que tues.** J supprime la bulle
de l'assistant — c'est une décision, pas un détail. Et K, le geste caché, garde
une porte visible (un « + » au bout de la ligne « En cours ») : élégant le
premier jour, un geste invisible coûte cher le trentième, quand un remplaçant
prend le téléphone.

### La page unique acceptait tout, sauf une maquette animée

`fusionner-maquettes.mjs` refusait la maquette 14 avec « sélecteur non confiné
« 0% » » : son contrôle prenait les pourcentages d'un `@keyframes` pour des
sélecteurs. Le message accusait la maquette là où le fautif était le contrôle —
exactement ce que `AGENTS.md` interdit.

**Et un vrai défaut dormait dessous, celui-là silencieux :** un nom d'animation
est **global**. Deux maquettes déclarant chacune un `@keyframes halo` se le
seraient disputé, la dernière lue gagnant pour toute la page — le confinement
par ancêtre ne protège que des sélecteurs. Les noms sont désormais préfixés par
section (`s14-halo`), comme le sont déjà les identifiants.

Le contrôle a été confronté à l'état qu'il prétend détecter : confinement
neutralisé, il refuse la fusion sur les quatorze maquettes.
### « Impossible d'enregistrer la note » ne disait pas pourquoi — et personne ne pouvait le savoir

**Le patron, capture de son téléphone :** *« Pb sur la note vocale, corrige
ça ! »* L'écran affichait *« Impossible d'enregistrer la note pour l'instant.
Réessayez. »*

**Ce défaut-ci n'a pas été reproduit ici, et il faut le dire tel quel.** La
dictée a été rejouée dans un vrai navigateur avec un micro simulé, deux fois :
en mode développement, puis sur la **version bâtie derrière une origine
étrangère** — les conditions de son banc. Les deux fois, la note s'est
enregistrée. Ce qui a donc été corrigé n'est pas la panne : c'est **ce qui
rendait la panne impossible à nommer**.

Deux choses s'y opposaient :

1. **`catch {}` sans variable**, dans l'anneau comme dans l'écran de dictée. Le
   message du serveur n'était même pas lu. Les quatre refus possibles — aucun
   fichier, fichier trop lourd, format non pris en charge, cadence dépassée —
   portaient chacun leur phrase, et l'écran les jetait toutes pour afficher la
   même formule creuse.
2. **Une exception ne traverse pas la version bâtie.** Next.js remplace en
   production le message d'une action serveur par un identifiant opaque. L'écran
   d'import de fichier croyait bien faire en affichant `err.message` : sur le
   banc, il ne pouvait montrer qu'un digest. La documentation du cadre le dit en
   toutes lettres — *« avoid using try/catch blocks and throw errors. Instead,
   model expected errors as return values »*.

Les refus attendus sont donc désormais des **valeurs de retour**, qui traversent
la version bâtie intactes ; les pannes imprévues continuent de lever, mais le
serveur les **écrit** avant, avec le chantier, le format et la taille. Sans
cette ligne, une panne chez lui ne laissait aucune trace nulle part.

**Le refus nomme le format reçu.** Si son iPhone produit un format que la liste
blanche ignore, le message le dit — sans quoi il resterait introuvable, et il
faudrait le lui demander.

**Trouvé en chemin, et plus grave que le reste :** un enregistrement de zéro
octet n'était pas refusé. Il descendait jusqu'à la base, qui le rejetait — et ce
qui remontait à l'écran n'était plus un refus mais **la requête SQL entière,
noms de tables et identifiant d'entreprise compris**. Il est maintenant arrêté à
l'entrée, avec une phrase qui dit quoi faire.

`test-note-vocale-refus-e2e.ts` éprouve les deux, par le chemin d'import qui
emprunte la même action serveur que l'anneau et que l'écran de dictée. Confronté
à l'ancien code : deux rouges.

**La leçon, puisqu'elle se répète.** Deux diagnostics à distance avaient déjà
coûté un aller-retour chacun ce jour-là. Cette fois, rien n'a été supposé : la
dictée a été rejouée dans les conditions du banc avant d'écrire une ligne, et la
configuration soupçonnée a été vérifiée dans la documentation du cadre — elle
était juste, l'hypothèse est morte là. Ce qui reste inconnu est écrit comme
inconnu.

### « Failed to type check » sur l'espace du patron — une course, pas un défaut

**Sur son espace, ce soir :**

> Failed to type check.
> `.next/dev/types/validator.ts:116:39`
> Type error: Cannot find module `.../chantiers/[id]/photos/page.js`

Le fichier existait, et la construction passait ici depuis un état propre. Le
message accusait le code alors que rien n'était cassé — exactement ce que
`AGENTS.md` interdit de laisser passer.

**La cause :** `npm run banc` sert la version de développement — qui écrit dans
`.next/dev/` — PENDANT qu'il bâtit la version rapide dans `.next-batie/`. Le
contrôle de types lisait donc les fichiers de travail d'un autre processus, en
train d'être réécrits : selon l'instant, ils désignent une route à moitié
engendrée. D'où une panne intermittente, sur son espace seulement, sur un code
parfaitement valable.

Ces fichiers sont désormais **exclus** du contrôle de types. Les types de route
restent vérifiés, par ceux qu'engendre la construction elle-même — qui ne
bougent pas pendant qu'on les lit.

**Et la réparation ne tenait pas où on l'aurait mise :** `next build` RÉÉCRIT
`tsconfig.json` et y remet `.next/dev/types/**/*.ts` de lui-même — constaté dans
l'heure. Retirer la ligne de `include` n'aurait tenu qu'une construction. C'est
`exclude` qui répare, parce que Next n'y touche pas et qu'il l'emporte.

**Next se protège pourtant de ce cas — son filtre vise simplement le mauvais
dossier ici.** Sa fonction `runTypeCheck` écarte `<distDir>/dev/types` avant de
vérifier, en disant explicitement pourquoi : « empêcher des types de
développement périmés de faire échouer la construction ». Mais le banc bâtit
dans `.next-batie`, donc le filtre écarte `.next-batie/dev` — pendant que le
serveur de développement écrit dans `.next/dev`. Ce dossier-là passe entre les
mailles, et c'est exactement celui que l'erreur du patron désigne. Le garde-fou
existait ; il visait à côté dès qu'on bâtit ailleurs que dans `.next`.

Reproduit **dans la configuration exacte du banc**, et non dans une approchante
— `ATLAS_DIST_DIR=.next-batie npx next build`, un reste périmé posé dans
`.next/dev/types` : rouge sans les exclusions, avec le message du patron au mot
près, vert avec, le reste périmé toujours en place. La première tentative de
reproduction, faite avec le dossier par défaut, passait au vert : elle aurait
fait croire le correctif inutile.
`scripts/test-tsconfig-sans-restes-dev.ts` refuse le retour en arrière — sans
lui, la prochaine construction rouvrirait la panne en silence, et elle ne se
reverrait que chez lui.

**Et il y avait une SECONDE forme du même piège, trouvée en vérifiant la
première.** `.next/types` — les types d'une construction faite dans le dossier
par défaut — n'est jamais régénéré ici, puisque le banc bâtit dans
`.next-batie`. Il ne peut donc qu'être périmé, et il décrit alors des routes
d'avant : l'écran des photos, supprimé le soir même par une autre session, en est
l'exemple exact. La construction du banc échouait dessus, au mot près comme sur
la première forme.

Celui-là ne s'ignore pas, il s'efface : `scripts/banc.mjs` le supprime avant de
bâtir. Confronté dans les deux sens — avec le reste, la construction échoue ;
après le nettoyage, elle passe.


### Le fil se bloquait à chaque chantier, et montrait sa barre grise

**Le patron, capture de son ordinateur et de son téléphone à l'appui :** *« je
trouve que ça manque de fluidité. Quand je slide en haut ou en bas, c'est
saccadé »*, et *« quand on slide, il y a une espèce de bande déroulante grise
qui apparaît sur le côté à droite. Supprime-moi ça, je ne veux pas voir ça du
tout, je veux juste que ça slide. »*

Deux causes, sans rapport l'une avec l'autre.

**Le saccadé venait de `scroll-snap-stop: always`**, posé la veille pour qu'un
geste vif n'avance que d'un chantier. Mais `always` ne ralentit pas l'élan : il
l'ARRÊTE au premier point rencontré. Le doigt lance la liste, la liste se
bloque, et il faut recommencer à chaque chantier. Retiré. Ce qui reste —
`proximity` sur le cadre, `center` sur la ligne — suffit à la perle : l'élan
court librement et la liste se recale sur un chantier en s'arrêtant. On perd
« un geste = un chantier », on gagne un défilement qui glisse.

**Le coût de rendu a été mis hors de cause AVANT de toucher à quoi que ce
soit** — c'est le point qui compte. Trois choses se superposaient sur ce
défilement, et deux d'entre elles étaient les suspects évidents : le masque en
dégradé posé sur le cadre, et l'animation d'opacité qui joue sur chaque ligne.
`scripts/mesurer-fluidite-fil.mts` relève la durée de chaque image rendue et
sait retirer une cause à la fois dans le navigateur seulement. Verdict : les
quatre combinaisons mesurent la même chose — 60 images par seconde, médiane
16,7 ms. Les retirer aurait abîmé l'écran sans rien gagner, et c'est très
exactement le correctif imaginé que ce dépôt a déjà payé trois fois.

**Et la mesure avait raison, le patron l'a confirmé sur son téléphone le soir
même** : *« la fluidité de l'iPhone, ça aussi, ça a été corrigé. »* Ce n'était
pas acquis — le navigateur sans tête ne produit pas l'élan d'un vrai doigt, et
le masque restait un suspect crédible **sur iOS**, où un cadre masqué se
recompose à chaque image. Le point était donc laissé ouvert par honnêteté
(`TODO.md` §0 bis), et il est clos par l'appareil lui-même. Il reste écrit
plutôt que supprimé : le masque est le suspect qui vient à l'esprit dès qu'on
parle d'un défilement qui accroche sur iOS, et savoir qu'il a été **innocenté
sur le vrai téléphone** évitera à quelqu'un de le déplacer pour rien.

**La barre grise, elle, n'était pas un choix : c'était un oubli.** Les trois
autres zones qui défilent la masquent depuis toujours ; `.atlas-fil-defile`,
**la plus vue de l'application**, avait été sautée. Rien ne pouvait le dire,
puisque chaque zone porte la règle chez elle et que personne ne comptait les
zones. `test-aucune-barre-de-defilement-e2e.ts` les compte désormais sur tout le
parcours — corriger une ligne aurait réparé ce jour-là, le balayage répare la
classe entière, y compris la zone qui n'existe pas encore.

### Le devis coupait le texte du patron, et c'est le balayage qui l'a vu

Trouvé par le contrôle précédent, alors qu'il cherchait tout autre chose : une
barre grise sur une zone de texte du devis. **La barre était le symptôme ; le
défaut était que le devis cachait ce qu'on venait d'y écrire.**

Les trois zones estimaient leur hauteur, et les trois estimaient mal :
l'adresse comptait les caractères (`ceil(longueur / 34)`), la description
comptait les retours à la ligne, les conditions ne comptaient rien (`rows={2}`).
Or un texte se coupe au MOT, quand il touche le bord : deux lignes estimées en
font trois à l'écran. Mesuré sur le jeu de démonstration : 46 px affichés pour
70 px de texte. C'est le défaut même que la zone d'adresse existait pour
corriger — *« le patron lit une adresse amputée sur son propre devis »* — revenu
par une autre porte.

Les trois passent par `ZoneQuiGrandit`, qui **mesure au lieu d'estimer**.

**Et un second contrôle est né du premier, parce que le premier pouvait être
satisfait de travers** : masquer la barre de cette zone aurait rendu le balayage
vert, et la coupure silencieuse — donc pire. `test-aucun-texte-coupe-e2e.ts`
écrit un texte long pour de bon et vérifie qu'il tient dans sa boîte. On ne peut
pas le contenter en cachant quoi que ce soit. Confronté à l'ancien code : il
nomme les deux zones fautives et le nombre de pixels perdus.

### La case « + » de la pellicule ajoute une photo, au lieu de changer d'écran

**Le patron, le 11 août 2026 :** *« quand je clique sur l'encadré avec le plus
là des photos, ça me ramène encore sur cette page-là. »*

Sa case était un simple lien vers l'écran Photos. Ajouter une photo depuis la
fiche demandait donc de changer d'écran d'abord, puis d'appuyer sur un second
bouton : deux appuis et une navigation pour un geste qu'on fait cent fois par
jour, sur un chantier, avec des gants.

Elle ouvre désormais le choix « prendre une photo / choisir dans ma
bibliothèque » **sur place**, et la photo apparaît dans la pellicule sans que
l'écran bouge. Elle **reste un lien** — sans JavaScript, ou ouverte dans un
nouvel onglet, elle mène toujours à l'écran Photos, comme « Nouveau chantier »
sur l'accueil.

Le mécanisme n'a pas été recopié : les deux champs de fichier (dont l'un impose
l'appareil photo), l'ordre de fermeture de la feuille et la boucle d'envoi
vivent dans un composant partagé — **AjoutDePhotos**, depuis supprimé (voir
plus bas) — que l'écran Photos et la fiche partagent. Deux copies auraient divergé au premier correctif
(`CLAUDE.md` §3).

Sa suite — **test-ajout-photo-fiche-e2e**, supprimée avec elle — éprouvait le
PARCOURS, pas la règle :
l'appui n'ouvre pas une page, le choix s'ouvre, la photo part, elle s'affiche
sans rechargement, elle survit au rechargement, et la porte de secours reste un
lien. Confronté en rétablissant l'ancien lien : rouge, avec la phrase du patron
— « on s'est retrouvé sur .../photos ».

**Remplacée le soir même, par arbitrage du patron.** Deux sessions ont traité
cette demande en parallèle, et leurs réponses divergeaient sur l'essentiel : ici,
le « + » ouvre **notre** feuille (« prendre une photo / choisir dans ma
bibliothèque ») ; dans l'autre, il ouvre **le menu du téléphone**, celui que le
patron avait photographié — *Photothèque · Prendre une photo · Choisir les
fichiers*. Sa demande disait les deux choses : ne plus changer d'écran, **et**
« supprime-moi toutes les autres étapes ».

Les deux ne pouvaient pas coexister : le menu du système n'apparaît que si aucun
champ ne porte `capture`, et c'est précisément ce que la feuille ci-dessus
suppose. Mis devant le choix, il a tranché pour le menu du téléphone. Ce qui
disparaît donc avec cette version : le composant **AjoutDePhotos**, la feuille, le second
champ, et l'écran Photos lui-même (voir l'entrée « Ajouter une photo ne fait plus
changer de page » ci-dessus). Ce qui en a été **gardé** : son contrôle de
persistance après rechargement, repris dans `scripts/test-photos-e2e.ts`.


### La perle plongeait avant le départ, sur une liste qui défile à peine

**Le patron, le soir, après la fusion :** *« la perle reste accolée en bas au
numéro dix-huit. »* Il avait raison, et deux fois plutôt qu'une.

La descente s'étalait sur les derniers pixels de défilement — sans vérifier
qu'il y en avait autant. Sur un écran haut, ou chez un artisan qui a trois
chantiers, la liste ne défile presque plus : la plongée commençait donc **avant
le départ**, et la perle arrivait déjà tombée. Et quand la liste tenait
entièrement dans l'écran, une règle écrite exprès la collait au dernier
chantier. Mesuré : 1100 px d'écran, 77 px à défiler pour 226 px de descente,
perle 148 px sous le milieu tout en haut de la liste.

La plongée occupe désormais les derniers pixels **au plus égaux au chemin
disponible**, et une liste qui ne défile pas laisse la perle au milieu.

**La leçon vaut plus que le correctif, et elle est écrite dans le dépôt :** les
deux contrôles étaient VERTS. La suite de cas ne donnait jamais une liste au
chemin trop court ; le contrôle au navigateur ne mesurait qu'un écran de 852 px,
où la liste de démonstration a quatre fois le chemin nécessaire. Un cas manquant
ne rougit pas. Quand une règle porte sur un rapport, il faut l'éprouver des deux
côtés — le contrôle mesure maintenant deux hauteurs d'écran, et la suite a gagné
la liste courte. Confronté : l'ancienne règle rétablie fait rougir le contrôle
en nommant le défaut du soir.


### La perle du fil était tout en bas de l'écran, à demeure

**Constaté par le patron, capture de son téléphone à l'appui :** *« Lorsqu'on
est tout en haut, elle devrait être au niveau du vingt-deux, donc bien centré
sur l'écran. Et en fait là, elle se retrouve constamment tout en bas. »*

La maquette retenue le 10 août fait suivre la perle : elle se tient à
mi-hauteur, et les chantiers défilent dessous. Le portage avait gardé
l'intention PRÉCÉDENTE — la perle posée devant le premier chantier « en
attente » — alors même que `docs/INTEGRER-ORIGINE.md` §3 signalait le
changement et disait de ne pas le « corriger ». Chez le patron, le chantier en
attente est le dernier de la liste : d'où un point de couleur immuablement en
bas, qui ne désignait rien de ce qu'il regardait.

La perle est désormais **premier enfant du fil** et ne bouge plus du milieu —
sauf tout en bas. Le patron a tranché la fin de liste dans le même échange :

> « Quand on arrive au dernier, là, elle descend et elle se met en face du
> dernier jour. »

C'est la seule chose que `position: sticky` ne sache pas faire : sur les
derniers pixels, la perle doit descendre PENDANT que le contenu monte, et une
accroche ne cloue que dans un sens. Trois montages purement CSS ont été essayés
avant de le reconnaître. La descente se calcule donc — `src/lib/perle-descente.ts`,
fonction pure, sept cas de suite — et l'écran ne fait que mesurer et appliquer.
Si ce calcul ne tourne pas, la perle reste au milieu : une dégradation qui reste
juste.

Ce que cela coûte, dit franchement : le chantier dont le devis est revenu n'a
plus de point de couleur. Il garde son libellé « Correction demandée » en
bronze — c'est le compromis de la maquette, assumé pour la troisième fois.

**Un défaut mérite d'être retenu :** la descente a d'abord été calculée juste et
**pas dessinée**. `.atlas-perle` est un `span`, donc une boîte en ligne, et une
transformation ne s'applique pas à une boîte en ligne. `getComputedStyle`
renvoyait pourtant la bonne matrice. Le contrôle disait « il manque 66 px » en
désignant le calcul, qui était innocent — il distingue désormais les deux pannes
et nomme la bonne.

`scripts/capture-accueil-perle.mts` mesure la perle à quatre positions de
défilement et refuse si elle quitte le milieu ailleurs qu'au bout, si elle
désigne du vide, si le dernier jour n'est pas atteint, ou si elle ne vise pas le
même endroit dans la ligne selon l'endroit où l'on est. Confronté trois fois :
perle déplacée à 20 % → rouge ; `display: block` retiré → rouge en nommant le
CSS et non le calcul ; descente supprimée dans la fonction pure → rouge.

L'ancienne règle — celle qui posait la perle sur le chantier en attente — et sa
suite disparaissent : une règle morte qui décrit une intention abandonnée est un
piège pour la conversation suivante.

### La capsule partout — une seule forme d'action dans toute l'application

**Il a répondu « partout ».** Le bouton principal est désormais une capsule sur
les dix-sept écrans, et la variante rectangulaire n'existe plus.

**Le chemin compte autant que la décision.** Il avait posé la règle : *« montre-moi
avant de faire, plutôt que de faire pour revenir en arrière »*. La capsule a donc
été posée dans une copie de travail, photographiée **sur ses vrais écrans** —
informations, photos, note vocale, devis, facture — retirée, puis posée pour de
bon une fois sa réponse reçue. `scripts/capture-bouton-partout.mjs` fait ce
travail et resservira ; il cherche les boutons par leur COULEUR d'action, pas par
une classe, pour qu'un bouton qui l'aurait perdue disparaisse de la planche.

**Aucune variante n'est conservée.** Garder le dessin d'avant « au cas où »
aurait laissé une seconde forme d'action que plus rien n'emploie, et qu'un écran
futur aurait reprise au hasard. Deux formes dans la même application se lisent
comme un travail inachevé.

**Un effet de bord heureux :** sur l'écran d'erreur, la bulle de l'assistant
mordait sur le bouton. Une capsule centrée ne l'atteint plus.

**Et une planche jetée.** La première comparaison avant/après cadrait chaque
bouton au plus près : à tailles différentes remises à la même largeur, la
capsule y paraissait **plus grosse** que le rectangle qu'elle remplace —
l'inverse exact de la vérité. Elle serait partie ainsi si personne ne l'avait
regardée. `ARCHITECTURE.md` §64.

---

### Appliqué : la bascule et la capsule sur l'écran de création

**Il a choisi**, maquettes en main : la bascule « le trait qui glisse » et le
bouton « la capsule ». C'est en place.

Ce qu'on voit maintenant sur l'écran de création : deux mots en serif — *Je
dicterai* · *Je l'écris* — un trait d'or qui glisse de l'un à l'autre, et
**un seul bouton** dont le libellé se fond de « Créer le chantier » à « Ouvrir le
devis ». Toucher « Je l'écris » puis le bouton mène **directement à la page du
devis entier**, avec le client déjà en en-tête.

**Ce qui n'a pas changé, et qui est le point :** il n'y a toujours qu'un seul
bouton à toucher. Deux boutons à égalité obligeraient tout le monde à trancher
avant d'avoir vu le chantier, alors que neuf fois sur dix la réponse est « je
dicterai ».

**La capsule n'allège pas par son rayon mais par sa largeur.** Un bouton qui
touche les deux marges n'est contenu par rien ; celui-ci est tenu par le blanc
autour de lui. L'aplat reste plein — c'est ce qui le sépare des formes sans fond,
plus élégantes mais qui se cherchent au lieu de se trouver. **Un seul écran s'en
sert** : `PrimaryButton` est sur vingt-sept écrans, et basculer la valeur par
défaut les changerait tous sans qu'il les ait vus.

**« Entrée » suit désormais la bascule.** Tant que le devis à la main était un
lien discret, valider un champ au clavier ne devait pas y mener — on serait tombé
dedans sans l'avoir choisi. Le choix étant maintenant explicite et affiché,
l'ignorer serait l'inverse du défaut.

**Et le piège de mesure, payé une seconde fois.** Les deux libellés vivent en
même temps dans le bouton, l'un à `opacity:0` : `innerText` les rend TOUJOURS
tous les deux, donc un contrôle écrit dessus passerait au vert même sur une
bascule morte. La suite lit le style calculé, et attend la fin du fondu.
Éprouvée en sabotant : un rouge, et un seul. `ARCHITECTURE.md` §64.

---

### Le bouton, huit façons — et une décision qu'il faut savoir qu'on rouvre

**Le patron :** *« j'aime bien le premier [le trait qui glisse], par contre le
bouton je le trouve un peu trop gros, carré, pas esthétique ».*

`docs/maquettes/28-le-bouton.html`. La bascule retenue est identique sur les
huit écrans — **seul le bouton change**, sinon on ne comparerait rien.

**D'où vient la masse, puisque c'est elle qu'il faut alléger.** Le bouton pèse
par trois choses à la fois, et chacune se traite séparément : la **hauteur**
(58 px, près d'un dixième de son écran), le **remplissage** (un aplat d'un bord
à l'autre) et la **pleine largeur** (il touche les deux marges, donc rien ne le
contient). Les huit n'attaquent pas les mêmes : 1, 6 et 7 enlèvent le
remplissage ; 2 et 3 rabattent la hauteur ; 5 lâche la pleine largeur ; 4 et 8
gardent la masse et travaillent le détail.

**La réserve, dite avant qu'il choisisse.** Le rayon de 5 px n'est pas un
défaut : il a été retenu le 10 août, et `PrimaryButton.tsx` dit pourquoi — « un
rectangle presque droit se lit comme une pièce imprimée ; le même arrondi à
16 px se lit comme un bouton d'application, c'est très exactement ce dont le
patron ne voulait plus ». La proposition 8 rouvre ce point. Elle est là parce
qu'il dit aujourd'hui « trop carré » et que c'est son écran ; elle est signalée
pour qu'il sache ce qu'il rouvre, pas pour l'en dissuader.

**Et un rappel qui dépasse l'écran :** ce bouton est sur vingt-sept écrans. Le
changer ici, c'est le changer partout.

---

### Un banc d'essai pour la bascule — qu'on utilise, au lieu de la regarder

**Sa demande :** *« créez-moi une maquette en HTML dynamique que je peux tester,
voir si ça me plaît ».* Les maquettes 25 et 26 se regardent ;
`docs/maquettes/27-banc-dessai-bascule.html` s'utilise : on change de
déclinaison en haut, on **tape** dans de vrais champs, on bascule, et le bouton
**mène vraiment quelque part** — à deux écrans différents selon le choix. Sur un
téléphone, le cadre s'efface et l'écran prend toute la place : c'est ainsi qu'il
faut juger.

**Toujours aucun script, et cette page va plus loin que les précédentes.** La
navigation entre écrans se fait par `:target` — de simples ancres. Et **le
bouton est deux liens superposés** : celui qu'on lit est le seul qui reçoive le
doigt. C'est le seul endroit qui méritait un contrôle à lui : si le lien
invisible gardait ses `pointer-events`, il continuerait d'intercepter l'appui et
le bouton mènerait toujours au même écran, **en silence**, pendant que son
libellé, lui, aurait changé. Un contrôle qui se contenterait de lire le libellé
passerait au vert sur exactement ce défaut. Le nôtre appuie pour de bon et
regarde où l'on arrive — douze appuis, six déclinaisons × deux destinations,
JavaScript coupé. Sabotée, la règle rend six rouges.

**Et un défaut trouvé en regardant l'écran, comme les trois autres de ce
projet.** `.champ` est un `<label>`, donc **inline** : ses marges latérales ne
s'appliquaient pas, et sur le téléphone les libellés et les plages partaient à
ras bord pendant que le bouton, lui, était bien en retrait. Invisible sur un
écran d'ordinateur, invisible pour tout contrôle — visible sur une capture au
format de son téléphone.

---

### La bascule retenue, puis affinée — six déclinaisons

**Le patron, dans la foulée :** *« pars sur l'idée de la proposition numéro
quatre, et modifie-la pour que ce soit beaucoup plus esthétique et élégant ».*

`docs/maquettes/26-la-bascule-affinee.html`. Ce qui est acquis et ne se
rediscute plus : les deux chemins se voient, et il n'y a qu'un bouton à toucher.
Ce qui change d'une déclinaison à l'autre, c'est la façon dont le choix se
dessine — le premier essai étant le plus bavard de tous, parce que
l'appareillage (deux onglets en capitales, un filet qui saute) se voyait plus
que le choix.

**Quatre gestes font l'élégance ici, et ils valent au-delà de cet écran :**
la serif remplace les capitales (un mot en capitales est un panneau, le même en
serif est une phrase) ; le repère **glisse** au lieu de sauter ; le mot du bouton
se **fond** au lieu de clignoter, deux libellés superposés dans la même case de
grille — le bouton ne change donc jamais de largeur sous le doigt ; et l'or ne
souligne que ce qui est retenu.

**Un piège de mesure, qui a fait accuser six maquettes justes.** Le contrôle
lisait le libellé du bouton juste après le clic : pendant la première moitié
d'un fondu de 260 ms, l'ancien mot est encore au-dessus de 0,5 d'opacité, et
deux lectures identiques d'affilée y sont la NORME, pas le signe que c'est fini.
Six rouges sur un comportement correct. Le contrôle exige désormais une valeur
tenue plus longtemps que la plus longue transition — et il est devenu générique
(il cherche les blocs marqués `data-bascule`), donc une septième déclinaison
serait éprouvée sans qu'on y touche.

---

### La phrase de pied part, et les deux portes se cherchent une place

**Le patron, capture à l'appui :** *« on ne voit que création de chantier, on ne
voit pas devis à la main. Donc il faut qu'on puisse voir les deux. »* Il a
raison : le lien en capitales d'or est sous le bouton, dans la zone où l'œil ne
revient pas une fois qu'il a trouvé ce qu'il cherchait — et sur son téléphone, la
barre du navigateur mange le bas.

**Retiré, à sa demande :** « Le nom crée la fiche du client. Le reste se corrige
ensuite, sur le devis. » La ligne reste dans la page mais ne parle qu'en cas
d'erreur, et **sa place reste réservée** : sans cela, l'apparition d'un message
ferait sauter la mise en page d'une ligne sous le doigt qui vient d'appuyer.

Ce qu'elle disait reste vrai et n'est plus écrit nulle part à l'écran : c'est le
NOM qui crée la fiche client. Le jour où ce cas doit se voir, c'est sur l'écran
du devis qu'il faudra le dire — pas en remettant une phrase permanente ici.

**Proposé, et pas encore tranché :** `docs/maquettes/25-les-deux-portes.html`,
six mises en page où les deux sorties se voient ensemble — la plaque partagée, les
plaques jumelles, le diptyque, la bascule d'or, le sceau, la balance.

**La bascule bouge sans une ligne de JavaScript**, par cases radio natives. Ce
n'est pas une coquetterie : les maquettes qui engendraient leurs écrans en script
lui rendaient une page blanche, et il a dit trois fois « Je ne peux pas ouvrir
ça ». `scripts/verifier-maquette-bascule.mjs` joue donc la bascule **JavaScript
coupé**, dans le fichier seul et dans la page unique — c'est la fusion, qui
réécrit les sélecteurs pour confiner les feuilles de style, qui pourrait la
casser en silence. Le contrôle sait échouer.

---

### « Réessayer » ne pouvait pas réparer un morceau de code disparu

**Le patron, 18 h 02, deux captures de son téléphone.** L'indicateur de Next.js
marqué **(stale)**, `ChunkLoadError`, « Failed to load chunk
/_next/static/chunks/src_06hhplf._.js » — et dessous l'écran d'Atlas, « Une
erreur — Cette page n'a pas pu s'afficher », avec un seul bouton : *Réessayer*.

**Ce bouton ne pouvait pas le sauver.** `reset()` refait le rendu du même arbre
React, avec les adresses de morceaux gravées dans le code déjà chargé — celui
d'une version que le serveur ne sert plus. Il redemande le même fichier absent,
obtient le même 404, retombe sur le même écran. Autant de fois qu'on appuie.

Son espace redémarre son serveur plusieurs fois par soirée (mise à jour,
bascule du banc, veilleur), et son onglet reste ouvert des heures — dix onglets
sur la capture. Aucune suite ne pouvait le voir : elles ouvrent une page et la
referment dans la minute, sur un serveur qui ne bouge pas. **C'est la durée de
vie de son onglet qui fabrique la panne, pas le code.**

**Désormais la page se recharge toute seule**, une fois par fenêtre de cinq
minutes. La borne n'est pas un détail : recharger sur une panne qui revient
donnerait un téléphone qui tourne en rond pour toujours — la pire des pannes,
puisqu'elle n'affiche jamais rien à lire. Passé la borne, le message nomme les
**deux** causes qui tiennent encore, mise à jour en cours ou connexion coupée,
plutôt que d'en désigner une au hasard.

Et la phrase propre à l'écran (« Impossible de charger le planning… ») s'efface
sur cette panne-là : le planning n'y est pour rien, c'est la page entière qui a
vieilli.

**Au passage, deux choses qui traînaient.** Les dix `error.tsx` portaient dix
copies du même corps — elles partagent maintenant `CorpsErreur`, sans quoi neuf
écrans sur dix n'auraient jamais appris à se relever. Et la cause n'était
affichée que sur l'écran racine, alors que le patron diagnostique depuis un
téléphone : les neuf autres la taisaient. En production, elle reste tue.

Éprouvé : `scripts/test-reprise-erreur.ts` (14 contrôles purs, dont son message
exact et les cinq formulations de navigateurs — Safari compris, c'est le sien) et
`scripts/test-reprise-morceau-e2e.ts` (la panne rejouée dans un vrai navigateur,
à l'écran du patron). Les deux savent échouer : neutraliser la reconnaissance
rend 8 rouges sur 14, et fait expirer le cas navigateur sur soixante secondes —
exactement ce qu'il a vécu. `ARCHITECTURE.md` §63.

---

## 2026-08-10

### Un diagnostic qui regarde l'espace du patron, au lieu de raisonner dessus

**Deux hypothèses avancées pour expliquer son « ça ne marche pas », et les deux
fausses.** D'abord un service de transcription absent — c'était mon
environnement, pas le sien. Puis une branche différente de celle où l'on
pousse — il était bien sur `main`. Chacune lui a coûté un aller-retour pour
rien.

Le défaut n'est pas de s'être trompé : c'est d'avoir raisonné **à distance** sur
une machine qu'on ne voit pas, alors que cette machine sait tout.

`npm run diagnostiquer:espace` ne devine rien, il regarde — et il montre la
seule chose que rien d'autre ne montrait : **le commit RÉELLEMENT SERVI**. La
ligne « Version » de Réglages lit le dépôt, donc le code *récupéré* ; la version
rapide est un dossier bâti et figé. Entre les deux il peut y avoir un monde, et
c'est précisément là que se logeait le malentendu.

Il rend six lignes — branche suivie, code récupéré, **code servi**, serveur,
veilleur, issue de la dernière mise à jour — puis un verdict dans ses mots :
retard, fichiers non enregistrés, historique divergé, version bâtie périmée,
serveur muet. Et quand tout concorde, il le dit aussi, en désignant alors le
produit plutôt que l'espace.

**Éprouvé dans ses états dégradés**, pas seulement au vert : dépôt sale, version
bâtie plus ancienne que le code, tête détachée (où « HEAD » ne serait qu'un
aveu incompréhensible), dépôt distant injoignable.

### « J'ai relancé le banc, ça ne marche pas » — la version rapide ne se recompile jamais

**Le patron, le 11 août 2026 au soir.** Le code neuf était bien tiré, la ligne
Version affichait le commit neuf, et l'écran servi restait l'ancien. Il pouvait
recharger cent fois.

**La cause tient en une phrase :** `next start` sert un dossier **bâti**, figé à
la seconde de sa construction. Tirer du code sous ses pieds n'y change rien. Or
le bouton « Chercher les dernières corrections » annonçait *« rechargez la page,
l'application se recompile »* — exact en développement, **impossible** sur la
version rapide.

C'est la **troisième fois** que ce dépôt paie le même malentendu : *le produit
paraît cassé alors qu'il est simplement vieux*. Les deux premières ont donné la
ligne Version, puis ce bouton. Celle-ci donne trois issues distinctes :

| Ce qui tourne | Ce qu'on annonce | Ce qu'on fait |
|---|---|---|
| développement | « l'application se recompile » | rien — c'est vrai |
| version bâtie, veilleur présent | « elle se reconstruit, injoignable une minute » | on coupe le serveur |
| version bâtie, **sans veilleur** | « arrêtez puis rouvrez l'espace » | **rien** |

**Le troisième cas est le plus important.** Couper sans personne pour relever le
serveur reviendrait à éteindre l'application du patron pour lui livrer un
correctif — le remède serait pire que le mal, et il resterait devant un écran
mort. Le veilleur est donc interrogé par son identifiant de processus, pas par
l'existence de son fichier verrou.

La règle vit dans `src/lib/issue-mise-a-jour.ts`, en fonction pure : une
décision qui peut couper le serveur du patron doit s'éprouver sans base, sans
serveur et sans banc. `scripts/test-issue-mise-a-jour.ts` la tient en cinq
contrôles, vérifiés rouges sur l'ancien comportement.

**Vérifié aussi, et c'est ce qui a permis de trancher :** le tiroir allégé
fonctionne bel et bien, sur les quatre états réels d'un chantier — neuf, avec
dictée, avec devis généré, avec devis envoyé. Ni « Informations » ni « Prix »
n'y figurent nulle part. Ce que le patron voyait était l'ancien code.

### De l'anneau au devis, en une touche

**Le patron, le 11 août 2026, après avoir essayé six formes du déclencheur :**
*« ok, j'aime bien le un »* — l'écriture nue sous l'anneau. Puis la question qui
décidait de tout : *« si je clique dessus, j'arrive directement à la page du
devis et je ne passe pas par une page intermédiaire ? »*

Oui. Un appui sur l'anneau démarre la dictée, un second l'arrête, et
**« MON DEVIS → »** naît dessous. Il transcrit, range les informations, cherche
les prix, rédige, et dépose sur `devis-complet` — la page où il n'y a que le
devis. Aucun écran entre les deux.

**Le maillon qui manquait était la transcription.** Toute cette chaîne existait
et était éprouvée depuis le 4 août, mais elle exigeait une transcription **déjà
faite** — si bien qu'elle ne pouvait vivre que sur l'écran Transcription, à
quatre écrans de l'endroit où l'on vient de parler. `preparerDevisDepuisDictee`
la lance désormais elle-même, une seule fois, et seulement s'il y a un son à
transcrire.

**L'écriture parle en OR, contre l'usage de la charte.** L'or est la voix de ce
qu'on lit, le vert pin celle de ce qu'on fait (`design-tokens.ts`). C'est la
seule action de l'application à déroger — et c'est délibéré : en vert, elle
faisait un second centre à côté de l'anneau, deux objets à regarder là où il
n'en faut qu'un.

**Trois lignes quittent le tiroir** — Informations, Prix, Devis — à sa demande.
Elles décrivaient un travail que la chaîne fait seule. Elles sont **déplacées,
pas supprimées** : les informations se corrigent sur le devis, le prix s'y pose
ligne à ligne, et les écrans restent joignables par leur adresse. Un contrôle
l'exige, parce qu'ôter une ligne d'une liste ne doit jamais condamner une page.

**Et le bandeau du tiroir se tait quand la dictée est là.** L'étape suivante
calculée valait souvent l'une des trois lignes retirées : l'annoncer aurait
envoyé chercher une porte qu'on venait de condamner.

### Ce que l'écran a dit, et que je n'aurais pas deviné

- **Sans service de transcription raccordé, le geste s'arrête — et il le dit.**
  C'est l'état réel de l'application (`TODO.md`, décision n°1) : aucun contrat
  n'est signé. En appuyant aujourd'hui, le patron lit *« aucun prestataire de
  transcription n'est encore raccordé »*. Un contrôle tient cette phrase :
  un geste qui ne fait rien **sans rien dire** se lit comme une panne.
- **L'arrêt d'avant-chiffrage s'ouvre bien sur la fiche.** La dictée d'essai ne
  disait ni la longueur de haie ni le diamètre du tronc : Atlas demande, sans
  changer d'écran, et repart de lui-même. C'est ce qui avait été promis.
- **L'écart sous l'anneau était de 50 px au lieu de 34.** Le compteur, invisible
  mais présent, en prend seize. Mesuré, pas estimé à l'œil — et resserré à 38,
  parce que c'est ce qui rattache le geste à l'anneau plutôt que de le laisser
  flotter : le défaut connu de la forme qu'il a choisie.

### Le devis à la main s'ouvre depuis la création du chantier

**Le patron, le 11 août 2026 :** *« si je clique sur "ou rédiger le devis à la
main", ça m'ouvre la page du devis complet, avec les informations du client qui
se seront ajoutées automatiquement ? C'est bien ça ? »* — oui, et il avait
raison de le demander avant de valider : c'était précisément le point qui
pouvait rendre la porte inutile.

Le lien est posé **sous** le bouton principal, en or, discret. Ce n'est pas un
choix cosmétique : deux boutons à égalité auraient obligé tout le monde à
trancher avant même d'avoir vu le chantier, alors que neuf fois sur dix la
réponse est « je dicterai ». Ici, « Créer le chantier » reste le geste évident.

**Une seule fonction crée le chantier, deux destinations en sortent.** Le
chantier est créé d'abord — c'est ce qui permet à `devis-complet` de relire le
client rattaché. Sauter la création pour « gagner du temps » aurait produit
exactement le devis orphelin qu'il redoutait.

**Elle ne remplace pas celle du tiroir, et ce n'est pas un doublon.** Ce sont
deux *moments*, pas deux chemins : ici, « je sais déjà que je l'écrirai
moi-même » ; sur la fiche, « j'ai commencé, finalement je l'écris ». Retirer la
seconde enfermerait un chantier créé la veille dont la dictée n'a rien donné.

### Deux défauts trouvés en regardant l'écran de création, aucun par un test

- **Une mise en garde devenue fausse.** « Ces informations ne sont plus
  modifiables ensuite » : c'était vrai quand la phrase a été écrite, plus depuis
  que le devis les rend toutes éditables (`majClientDuDevisAction`). Une mise en
  garde périmée est pire qu'aucune — elle fait remplir un formulaire par crainte,
  et elle apprend à se méfier d'un écran qui dit vrai ailleurs. Elle dit
  maintenant ce qui reste vrai, et c'est utile : **c'est le nom qui crée la fiche
  client**, et sans lui le devis n'offre pas d'en rattacher un.
- **La bulle de l'assistant recouvrait cette phrase**, et `finDePage: 0` —
  aucun défilement ne l'en dégageait. Illisible en permanence, sur la moitié de
  sa largeur. Quatrième défaut de cette famille sur ce dépôt.

**Et la réserve du bas d'écran ne vaut qu'EN PAGE.** La poser aussi sur la
feuille ajoutait quatre-vingts pixels de vide pour se protéger de quelque chose
qui n'y arrive pas : la feuille est `fixed` en `z-[50]` et recouvre déjà la
bulle. Vu en mesurant les deux formes, pas en supposant que la seconde
ressemblait à la première.

**Un contrôle qui a d'abord accusé à tort**, et c'est la partie qui a demandé le
plus d'attention : sa première version lisait le texte de la page et annonçait
que le client manquait sur le devis — c'est-à-dire exactement la panne que le
patron redoutait. L'en-tête du devis est fait de champs éditables, et
`innerText` ne rend jamais la valeur d'un `<input>`. Le nom était là, sous les
yeux. Le contrôle lit désormais la valeur des champs, et il a été vérifié rouge
en cassant la destination.

### Toutes les suites mesurent enfin l'écran que le patron a dans la main

*« Fais tout ce que tu penses qu'il faut faire pour que l'application
fonctionne »*, le 11 août 2026, après avoir appris qu'il restait trente-trois
suites cadrant un écran que personne ne possède.

**Le cadre était faux, et de la pire façon : trop grand.** Les suites posaient
393 × 852 — la dalle d'un iPhone 14, pas la place qui reste une fois la barre
d'adresse installée : **390 × 664**. Cent quatre-vingt-dix pixels de bas
d'écran que le patron n'a jamais eus, et où tout tenait donc confortablement.
C'est ce qui a laissé passer, la veille, une bulle d'assistant recouvrant « ou
rédiger le devis à la main ».

**L'écran est désormais posé à UN endroit** (`e2e-browser.ts`,
`ECRAN_DU_PATRON`), comme l'est déjà le délai d'attente et pour la même raison :
quarante sites d'appel, c'est quarante corrections et trente-neuf oublis. Une
suite qui a besoin d'autre chose — le devis complet s'ouvre aussi sur un écran
d'ordinateur — passe son propre cadre, et c'est alors un choix visible.
Quarante-et-une suites et vingt-neuf scripts de capture ont perdu leur cadre
écrit à la main.

**Deux tolérances inventées sont tombées avec.** Un contrôle mesurait le
débordement contre « 400 px » sur un écran de 393 : sept pixels de marge qu'on
s'accordait à soi-même. Il mesure maintenant contre la largeur **réelle** de la
fenêtre. Un autre cadrait 393 px de large là où le vrai téléphone en fait 390.

**Résultat, et il faut le dire tel quel : aucun écran n'a bronché.** 46 suites
sur 47, l'unique rouge étant un dépassement de délai du serveur de
développement — la suite rejouée seule passe. Le cadre honnête n'a donc révélé
aucun défaut caché.

**Mais « aucune suite n'a bronché » ne veut pas dire « rien n'est recouvert »**
— seulement qu'aucun contrôle existant ne l'aurait remarqué. Un seul écran
vérifiait ce genre de chose, et pour un seul bouton. D'où la suite qui suit.

### Un contrôle qui cherche partout ce qui est caché sous le mobilier fixe

`scripts/test-rien-de-recouvert-e2e.ts` parcourt **quatorze écrans** du parcours
et, sur chacun, demande au navigateur qui répondrait au doigt au centre de
chaque lien, bouton et champ. Ce que ça attrape n'a pas d'autre moyen d'être vu :
l'élément est dans le HTML, il répond au clic programmé, **et le doigt ne
l'atteint pas**. Trois défauts réels de ce dépôt sont de cette famille, tous
trouvés à l'œil, aucun par un test.

**Écrire ce contrôle a surtout consisté à l'empêcher de mentir.** Trois versions
successives accusaient des écrans parfaitement sains :

1. un bouton sous la barre du bas n'est pas hors d'atteinte — **il suffit de
   défiler**. On amène donc chaque cible au centre avant de juger : ce qui reste
   recouvert après ce geste l'est pour de bon ;
2. l'encart « à facturer », replié au repos, garde ses liens dans la page. Le
   navigateur les dit « visibles » — ils sont seulement **rognés** par un
   `overflow: hidden`. Onze accusations pour des éléments qui n'étaient pas à
   l'écran du tout ;
3. un lien dont le centre tombe sur son propre libellé se dénonçait lui-même.

**Et il sait échouer, sur les deux défauts qu'il vise.** Le défaut du 11 août a
été reconstitué dans la fiche : il le nomme par son propre libellé et désigne le
coupable, en restant muet sur les treize autres écrans. Son garde-fou — *« la
fenêtre est-elle bien celle d'un téléphone ? »* — rougit dès qu'on lui repose
l'ancien cadre. Sans lui, cette suite serait verte d'un bout à l'autre sans rien
avoir éprouvé : c'est exactement ce qui est arrivé au contrôle de la bulle.

### L'anneau de la dictée est au centre de la fiche, dès l'arrivée

**Le patron, le 11 août 2026, devant un chantier qu'il venait de créer :**
*« pourquoi on est encore sur cette page, il manque la note vocale au
milieu »*, puis *« l'anneau qui est en plein milieu et dès qu'on arrive sur la
page, il y est en fait, qu'on ait cliqué dessus ou non. C'est ça que je veux. »*

Il avait raison, et le défaut était plus profond qu'un anneau absent. L'anneau
n'apparaissait qu'**une fois la dictée faite** — c'était un lecteur — et la
dictée arrivait en **deuxième** action, derrière les photos
(`src/lib/chantier-etat.ts`). Sur un chantier neuf, c'est-à-dire au moment précis
où l'on veut parler, le cœur du produit était donc caché derrière autre chose.

L'anneau est désormais là dès l'arrivée, au centre, **au-dessus** de l'action
principale. Sans enregistrement il devient un micro : un appui dicte, un second
arrête et enregistre, la fiche se rafraîchit sur place et il redevient le
lecteur. Même objet, deux états — jamais deux boutons, jamais un écran de plus.

**Le magnétophone est écrit une seule fois** (`magnetophone.ts`) : l'écran de
dictée savait déjà capter le son, et recopier ces trente lignes dans l'anneau,
c'était s'assurer qu'un jour l'un corrige un défaut que l'autre garde.

**Deux défauts trouvés à l'écran, aucun par un contrôle :**

- Remonter l'anneau au centre a poussé « ou rédiger le devis à la main » **sous
  la bulle de l'assistant**. Le lien existait, il était touchable, il était
  illisible. Sans note, l'anneau réservait encore la place du glissement
  « Retirer », du compteur et du tiroir « note retirée » — trois choses qui
  n'existent pas encore.
- **Et le contrôle qui aurait dû le voir mesurait un écran que personne ne
  possède.** Les suites posaient un cadre de 393 × 852 ; la hauteur utile d'un
  vrai iPhone 13, barre du navigateur déduite, est de 390 × **664**. Sur ce
  cadre trop haut, la bulle tombait 190 px plus bas et ne recouvrait rien. La
  suite emploie maintenant le descripteur d'appareil réel — et elle échoue bien
  sur la mise en page d'avant, ce que l'ancien cadre ne faisait pas.

`scripts/test-anneau-dictee-e2e.ts` tient les quatre points, avec un micro
simulé : la note enregistrée depuis l'anneau existe vraiment en base.

### La fiche chantier suit la maquette, au pixel — et rien n'est perdu au passage

**Le patron, le 11 août, deux fois de suite :** *« ça ressemble toujours pas à
la maquette »*, puis *« exactement, respecte strictement ma maquette »*.

Il avait raison une seconde fois, et pour une raison qui vaut d'être écrite :
**j'avais supposé au lieu de comparer.** Rendre sa maquette
(`maquettes/atlas-note-vocale.html`) côte à côte avec l'écran a montré en une
capture ce que trois lectures n'avaient pas vu — l'anneau portait un point là où
le sien porte trois barres, et sa maquette **ne montre aucun bouton**. Regarder
l'écran n'est pas de la finition (`CLAUDE.md` §5) ; ici c'était le seul moyen.

Ce qui change sur la fiche :

- **Le corps ne porte que l'anneau.** Le pavé vert « Ajouter des photos »
  écrasait tout et faisait de la dictée un à-côté, alors qu'elle EST le produit.
- **L'en-tête suit la maquette** : le client en serif gris **avant** le titre, la
  pastille de facturation sur la ligne de la flèche, pas de trait de fermeture.
  La pastille à côté du titre lui prenait la moitié de la largeur et cassait
  « Intervention prévue vendredi 15 août. » en quatre lignes.
  `EnTeteEcran` reçoit trois réglages **facultatifs** (`precisionPlacee`,
  `cheveu`, `actionPlacee`) : les autres écrans gardent la grammaire commune du
  10 août sans être touchés.
- **Trois barres au repos dans TOUS les états**, le carré n'apparaissant que
  pendant l'enregistrement — comme sur sa maquette.

**Alléger un écran est facile ; le faire sans l'amputer l'est moins.** Vider le
corps a fait tomber **six suites d'un coup**, toutes sur la même phrase
manquante : le bouton portait la seule indication de la marche à suivre. Ce
n'était pas du bruit — un écran qui ne dit pas où l'on va se lit comme une
application en panne. L'étape suivante est donc passée dans le bandeau du
tiroir (« Ajouter des photos → »), et la rédaction à la main dans sa liste. Deux
demandes qu'il avait faites lui-même, les 3 et 4 août, et que ce lot aurait
défaites en silence.

Un contrôle garde cette frontière (`test-anneau-dictee-e2e.ts`) : *le corps ne
porte que l'anneau, et le tiroir garde tout le reste*. Il échoue aussi bien si
l'on remet un bouton dans le corps que si l'on oublie de descendre une entrée
dans le tiroir.

### `npm run essai` accusait la base pendant qu'Atlas démarrait déjà

**Constaté chez le patron, sur son espace de travail.** Il tape `npm run essai`,
et l'écran répond :

> ⚠️ Le serveur s'est arrêté avant de répondre.
> Cause fréquente : la base de données n'est pas montée.

La base n'y était pour rien. L'espace démarre Atlas tout seul à chaque
allumage ; pendant sa construction, **le banc ne répond pas encore** — le
garde-fou d'`essai.mjs`, qui demandait « quelqu'un répond-il ? », l'a donc
laissé passer. Un second serveur est parti, a trouvé le port pris, et est mort
sur « EADDRINUSE ». Le message affiché envoyait chercher au mauvais endroit, ce
qui coûte plus cher que pas de message du tout.

`banc.mjs` prend un verrou depuis le même jour, et sa documentation le disait
déjà : **ce n'est pas le port qu'il faut regarder, c'est l'existence d'un autre
banc.** `essai.mjs` ne le prenait pas — et c'est par là que le patron est passé.
Il le prend désormais, et refuse en disant quoi faire : combien de temps
attendre, quel journal suivre, et quelle ligne attendre.

Éprouvé en reproduisant la situation : un banc tient le verrou, `npm run essai`
arrive dessus, et refuse au lieu de démarrer.

### Refaire la démonstration n'efface plus ce que l'artisan a tapé à la main

**Le patron, le 11 août au matin :** *« On avait raccordé l'agenda Google.
Pourquoi il ne l'est plus ? »* Il l'avait bien relié la veille.

La cause est dans la migration 0032, et elle est sans détour :

```sql
"entreprise_id" ... REFERENCES "entreprises"("id") ON DELETE CASCADE
```

Ses identifiants Google vivent dans une ligne rattachée à son entreprise, et le
seed fait `TRUNCATE … entreprises … CASCADE`. **Un seul `seed` a donc causé les
deux pannes de la nuit** : la session fantôme, et la perte du raccordement.

Ces identifiants ne sont pas une donnée de démonstration — il est allé les créer
chez Google et les a recopiés lui-même. Le seed les conserve désormais et les
rattache à la nouvelle entreprise.

**Mais pas l'autorisation, et c'est délibéré.** Les jetons disent « cet artisan a
donné son accord pour CETTE entreprise » ; l'entreprise disparaît, l'accord tombe
avec elle. Les conserver ferait dire à l'écran « agenda relié » pour un
consentement qui ne vaut plus. Il lui reste **un seul appui** sur « Relier mon
agenda Google », sans repasser par la console de Google.

**Et le premier correctif ne conservait rien, en silence.** La RLS est en
`FORCE` : sans `app.entreprise_id`, la lecture rendait zéro ligne sans un mot, et
le contrôle passait au vert pour cette raison exacte. Le seed pose donc le
contexte de chaque entreprise avant de lire, comme le fait `withEntreprise` — on
ne contourne pas l'isolation pour se simplifier la vie.

`scripts/test-seed-conserve-identifiants.ts`, trois contrôles, chacun vu échouer
sur son état dégradé : le défaut d'origine remis, et le remède qui mentirait en
gardant l'autorisation.

### Le banc concluait à la panne trois secondes avant que l'application réponde

**Le journal du patron, dans cet ordre :**

    ⚠ L'application n'a pas répondu après trois minutes.
      Cause la plus fréquente : la base de données n'est pas montée.
    ✓ Finished filesystem cache database compaction in 15.4s
     GET /api/health/live 200 in 1415ms

Elle répondait **la seconde d'après**, et la base allait parfaitement bien. Deux
fautes que ce dépôt s'interdit explicitement, commises dans la même ligne :
conclure au chronomètre, et **désigner le mauvais coupable**.

Le bon critère n'est pas la montre, c'est **la vie du serveur** : tant qu'il
tourne, il travaille — ici une compaction de cache lui avait pris le disque
quinze secondes. Le banc l'attend donc, avec un signe de vie toutes les trente
secondes pour que l'écran ne paraisse pas figé, et ne renonce que s'il meurt.

Et le message ne suppose plus rien : serveur mort → « regardez les lignes
ci-dessus, et nulle part ailleurs » ; serveur vivant mais muet → la commande de
diagnostic, qui, elle, va voir. Un contrôle échoue si l'accusation de la base
réapparaît.

### Un refus qui n'informe pas ne vaut guère mieux qu'une panne

Le verrou du banc disait « Atlas est DÉJÀ en train de démarrer » et rien d'autre.
Le patron s'est retrouvé devant ce refus sans savoir s'il devait attendre trente
secondes ou cinq minutes, ni si l'application était déjà ouvrable.

Le banc interroge donc l'application avant de répondre :

- **elle sert déjà** → on donne l'adresse et de quoi s'y connecter ;
- **elle se construit encore** → on dit combien de temps compter, la commande
  pour suivre, et **la ligne exacte qu'il attend** (« Version rapide en place »).

### Un orphelin d'hier soir ne condamne plus le démarrage

Un `next-server` laissé par une exécution précédente tient le port et rend
`EADDRINUSE` **avant qu'on ait rien tenté**. Le patron a dû taper `pkill` à la
main plusieurs fois cette nuit-là — ce n'est pas son travail.

Le banc regarde donc le port au démarrage, et la distinction qui compte :

- **quelque chose répond à la santé** → c'est Atlas qui sert, on n'y touche pas ;
- **le port est pris sans que rien ne réponde** → c'est un orphelin, et lui seul.
  Il est délogé, et le banc le dit en une ligne.

Éprouvé en plantant un vrai orphelin sur le port : *« Un serveur d'une exécution
précédente tenait le port 4700 : délogé. »*, puis démarrage, construction,
bascule, `/login` en 183 ms.

### Le serveur est détaché, et c'est son GROUPE qu'on tue

**Quatre fois de suite, le même `EADDRINUSE` — et la vraie cause était plus
simple que tout ce que j'avais corrigé.**

`npx next dev` est une pile d'enveloppes. Le processus qui écoute vraiment se
renomme `next-server` et **survit à la mort de son père**. Tuer l'enfant qu'on
connaît ne libère donc pas le port. Le dépôt le savait, et s'en remettait à
`pkill -f "[n]ext-server"` : on ne visait pas des processus, on visait un
**motif** — ça marchait ici, et pas chez lui.

Le serveur est désormais lancé `detached: true` : il devient chef de son propre
groupe, et `process.kill(-pid)` emporte l'enveloppe **et** le serveur, sans
dépendre d'un nom ni de la présence de `pkill`.

**Mesuré en isolant le mécanisme, hors d'Atlas, en douze lignes :**

| | port pris avant | port libéré après |
|---|---|---|
| enfant tué seul (ce que faisait le banc) | oui | **non — l'orphelin tient le port** |
| groupe tué (le correctif) | oui | **oui** |

**Et cela répare une seconde chose, que personne n'avait reliée : chaque Ctrl+C
laissait un orphelin.** Le patron en a fait plusieurs au fil de la soirée ;
chacun laissait un `next-server` accroché au port 3000, qui condamnait la
tentative suivante. Le banc transmet maintenant le signal à son groupe, à la
sortie comme sur Ctrl+C — vérifié : port libéré, aucun orphelin.

Éprouvé de bout en bout : construction, bascule, « Version rapide en place »,
zéro `EADDRINUSE`, santé en 5 ms, `/login` en 177 ms, et les sept contrôles de
session au vert sur la version bâtie.

### La bascule déloge d'abord, vérifie ensuite, et réessaie

**Le journal du patron a montré ce qu'aucun raisonnement n'avait vu.** Après
« Construction terminée », `EADDRINUSE` **immédiat** — puis le serveur de
développement qui **continue de servir** :

    ⨯ Failed to start server
    Error: listen EADDRINUSE ... 0.0.0.0:3000
    GET / 307 in 95s

Il n'était donc pas mort du tout. `serveur.kill()` ne tue que l'enveloppe `npx` ;
le processus qui écoute se renomme `next-server` et lui survit. Le dépôt le
savait — c'est écrit noir sur blanc dans `veiller.sh` depuis le 9 août — mais le
banc n'appelait `pkill` qu'**en dernier recours**, après vingt secondes, et
seulement si le port semblait encore pris. Or il ne le semblait pas : la question
posée était « la santé répond-elle ? », et un serveur qu'on vient de tuer se tait
bien avant de rendre sa socket.

Trois changements, et l'ordre compte :

1. **On déloge d'abord, sans condition.** Ce serveur est de toute façon
   condamné : il n'y a rien à épargner.
2. **On demande au port**, pas à la santé — la seule question dont la réponse
   engage `next start`.
3. **On réessaie une fois**, et une naissance ratée se voit dans les huit
   secondes. Surtout, **le banc ne meurt plus** : si la reprise échoue, il
   relance un serveur de développement au lieu de laisser le patron sans rien.
   Un banc lent reste un banc ; un banc mort coûte une soirée.

Éprouvé de bout en bout : construction, délogement, reprise du port, « Version
rapide en place », zéro `EADDRINUSE`, `/login` servi en 206 ms.

### Le remède tournait en rond — et la bascule ratait encore le port

Deux défauts, dont **le premier est le mien, introduit le soir même.**

**1. Une boucle sans fin, pire que le défaut qu'elle réparait.** Le patron a vu
défiler, indéfiniment :

    GET /login?session=perimee  307 → /api/session-perimee
    GET /api/session-perimee    303 → /login?session=perimee

Il fallait **deux** causes, et elles se cachaient l'une l'autre :

- **`__Secure-` exige l'attribut `Secure`, sinon le navigateur REFUSE.**
  Derrière le relais de son espace, tout est en HTTPS : Auth.js nomme donc son
  cookie `__Secure-authjs.session-token`. L'effacement partait sans `Secure`, la
  règle des préfixes le faisait jeter, et le fantôme survivait à chaque tour.
  **Vu à `curl`, l'en-tête paraissait parfait** — c'est le navigateur qui
  refusait, pas le serveur qui oubliait, et aucun contrôle ne regardait
  l'attribut. L'inverse est vrai aussi : poser `Secure` sur les noms sans
  préfixe les rendrait inopérants en clair, donc sur le banc local. L'attribut
  suit désormais le NOM, jamais une supposition d'environnement.
- **`/login` était soumis au contrôle du compte.** C'est ce qui transformait une
  panne en boucle : renvoyée vers l'effacement, la page de connexion y
  retournait au tour suivant. Elle en est exemptée — il n'y a rien à y protéger,
  et la connexion remplace le cookie de toute façon.

**2. « EADDRINUSE » revenait, malgré le verrou et le drapeau.** Parce que
`portRendu` posait la mauvaise question : il interrogeait `/api/health/live` et
concluait « port rendu » dès qu'il ne répondait plus. Un serveur qu'on vient de
tuer cesse de répondre **bien avant** de rendre sa socket, et un processus qui
tient le port sans servir Atlas ne répond à cette route dans aucun cas. On
demande maintenant au système, en essayant d'**écouter** dessus — la seule
question dont la réponse engage `next start`. Éprouvé dans les trois états :
port vide, port occupé, port relâché.

Deux contrôles nouveaux, chacun vu échouer sur sa panne : le parcours du fantôme
échoue s'il **repasse deux fois au même endroit** (et le message affiche le
chemin exact du patron), et chaque cookie effacé doit porter l'attribut que son
nom exige — ni plus, ni moins.

### La construction mourait en rendant la main — « setRawMode EIO », segfault

**Après un « Compiled successfully in 62s » :**

    > Build error occurred
    Error: setRawMode EIO   (errno -5, syscall 'setRawMode')
    Segmentation fault (core dumped)

La construction avait **réussi**, et elle est morte en rendant la main. Quand
son entrée est un vrai terminal, Next.js tente d'en prendre le contrôle pour
écouter les touches ; dans un espace distant ce terminal peut disparaître sous
lui — une session rechargée, un onglet fermé — et l'appel échoue en `EIO`, que
la couche native ne rattrape pas : segmentation fault, une minute de travail
perdue.

`next build` ne lit rien au clavier. Ses enfants ne reçoivent donc plus d'entrée
du tout : `isTTY` devient faux et l'opération n'est même plus tentée. La sortie
reste héritée — le patron doit voir ce qui se passe — et **Ctrl+C continue de
fonctionner**, puisqu'il passe par le groupe de processus du terminal, jamais
par l'entrée de l'enfant. Même traitement dans `essai.mjs`.

**Le mécanisme a été mesuré, pas supposé** : un enfant lancé avec l'entrée
héritée depuis un vrai terminal voit `isTTY=true` et obtient `setRawMode` ;
entrée coupée, `isTTY=false` et l'appel n'est plus possible. Puis le banc a été
joué **dans un vrai terminal** (`script -qec`) : construction menée à son terme,
aucun `setRawMode`, aucune segmentation fault, application servie en 7 ms.

### Deux bancs se tuaient l'un l'autre — « EADDRINUSE », errno -98

**Ce que le patron a lu**, après une construction pourtant réussie :

    Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
    errno: -98, syscall: 'listen'

puis, juste dessous, une SECONDE construction qui démarrait. **Deux bancs
tournaient.** Deux causes distinctes, et aucune n'était visible d'un seul
fichier — chacun était juste séparément.

**1. Le veilleur prenait la bascule pour une mort.** Quand `banc.mjs` remplace
son serveur de développement par la version bâtie, il tue le premier avant de
lancer le second. Pendant ce battement, la santé ne répond plus **et** aucun
processus `next` ne tourne — c'est-à-dire, mot pour mot, les deux conditions que
`veiller.sh` exige pour conclure « le serveur est mort ». Il lançait donc un
second banc, qui prenait le port, et le `next start` du premier mourait.

Un drapeau (`.devcontainer/bascule-en-cours.sh`) le lui dit désormais. **Il
expire au bout de trois minutes, et c'est le point qui compte le plus** : un
banc tué au mauvais moment laisserait sinon un drapeau éternel, et le veilleur —
dont l'existence répare le 404 du 9 août — ne relèverait plus jamais rien, sans
un mot. Une bascule bousculée vaut mieux qu'un veilleur muet. Un drapeau
illisible ne vaut pas non plus « ne fais rien ».

**2. Rien n'empêchait d'en lancer un second à la main.** L'espace démarre un
banc tout seul à chaque allumage ; ne voyant rien venir, le patron en a lancé un
autre. `essai.mjs` refuse ce doublon depuis le 9 août — mais en regardant le
port, ce qui ne suffit pas ici : **pendant sa construction, un banc ne répond pas
encore**. C'est l'existence d'un autre banc qu'il faut voir, pas le port.
`scripts/verrou-banc.mjs` porte un identifiant de processus, jamais un simple
drapeau : un verrou laissé par un banc tué bloquerait sinon tout démarrage
ultérieur, pour toujours.

**Éprouvé en rejouant le geste exact du patron** : veilleur en place, un banc
lancé par lui, puis un second à la main. Le second est refusé avec un message
qui dit pourquoi ; le premier va au bout de sa bascule — « Version rapide en
place », zéro `EADDRINUSE`, `/login` en 68 ms. Douze contrôles tiennent le tout,
et chacun a été vu échouer sur l'état dégradé qu'il prétend détecter.

L'un d'eux a d'ailleurs commencé par rester **vert alors que la consultation du
drapeau avait été coupée** : il cherchait `$BASCULE` n'importe où dans le
fichier, et la ligne qui *déclare* le chemin le satisfaisait. Il vise maintenant
l'appel. C'est la deuxième fois ce soir qu'un contrôle regarde une mention au
lieu d'un geste.

### L'annonce cesse d'affirmer que l'adresse est joignable

**Le terminal lui affirmait le contraire de ce qu'il voyait.** À chaque
démarrage, l'annonce écrivait « Ouvrable depuis un téléphone, **telle quelle** »
et « cette adresse est **publique** ». Le 10 août 2026, elle l'a écrit alors que
le port était PRIVÉ : GitHub servait sa page de connexion, le téléphone du
patron ne montrait rien, et le seul message à l'écran disait que tout allait
bien. Il a cherché ailleurs pendant des heures.

Ce module ne **peut pas** savoir : il faudrait interroger l'adresse depuis le
dehors, ce que seul `diagnostiquer-banc.mjs` fait. Il n'affirme donc plus rien —
il décrit la panne (« une page de connexion GITHUB au lieu d'Atlas ») et sa
sortie (onglet PORTS, trois clics). Un message qui affirme sans savoir coûte
plus cher qu'un silence : il envoie chercher partout ailleurs.

Un contrôle échoue désormais si l'une de ces deux promesses réapparaît, ou si la
sortie n'est plus indiquée.

### L'atelier dit ce qu'il est, au lieu de faire attendre en silence

**Le patron a tapé `npm run essai` dans son espace GitHub** et regardé
« toujours en compilation » pendant plus de **trois minutes** — sur
`/api/health/live`, la plus petite route du dépôt. Rien n'était cassé : c'est
l'atelier, `next dev`, qui compile chaque écran au moment où on l'ouvre, sur un
disque distant lent (le journal l'écrit lui-même : « Slow filesystem detected »).
Chaque écran suivant lui aurait coûté la même attente.

**Troisième fois que cette lenteur lui coûte une soirée** — et les deux
premières avaient précisément produit `npm run banc`, qui bâtit une fois puis
sert des écrans immédiats. Le dépôt savait, et se taisait : une commande qui
laisse prendre le mauvais chemin sans un mot vaut un défaut.

`npm run essai` annonce donc, sur un espace distant seulement, ce qu'il est et
quelle commande sert vraiment à se servir d'Atlas. Il n'interdit rien :
l'atelier reste l'outil du développement, et le rechargement à chaud n'existe
que là. En local, où la compilation prend quelques centaines de millisecondes,
il ne dit rien — un mauvais conseil coûte plus cher que le silence.

Le texte vit dans `scripts/annonce-atelier.mjs`, pas enfoui dans `essai.mjs` :
un message enfoui n'est jamais vu échouer. `test-annonce-atelier.ts` vérifie
qu'il nomme la sortie, qu'il se tait en local, et qu'`essai.mjs` l'imprime
vraiment.

### Le port du banc s'ouvre à chaque allumage, au lieu d'être seulement déclaré

**Ce que le diagnostic du patron a rapporté**, le soir même : l'application
saine de l'intérieur — `200 · text/html` sur `/login` — et, à l'adresse
publique, une page `/pf-signin?...`. **C'est GitHub qui répondait, pas Atlas.**
Le port était privé ; depuis son téléphone, non connecté à GitHub, il n'y avait
rien à voir, et rien ne le disait.

Or `devcontainer.json` déclare `visibility: "public"` depuis le 6 août. La
déclaration n'était pas fausse, elle était **inerte** : ce fichier n'est appliqué
qu'à la **création** de l'espace de travail, et le sien est plus ancien que la
ligne. C'est très exactement le piège d'`ATLAS_BANC_ESSAI` dans
`docker-compose.yml` (`src/profil-banc.ts`) — **la troisième fois** qu'une
déclaration exacte et sans effet coûte une soirée. Une déclaration ne répare pas
un espace déjà né ; seul un geste rejoué à chaque allumage le fait.

`.devcontainer/ouvrir-port.sh` publie donc le port à chaque démarrage, et **dit
ce qu'il en advient** : le taire était la moitié du défaut. Sans `gh`, ou si
`gh` refuse, le démarrage affiche la commande de secours au lieu de laisser
croire que tout va bien.

**Et le remède indiqué était introuvable.** Première version, le démarrage et le
diagnostic donnaient `gh codespace ports visibility …` — le patron l'a tapée et
a reçu **« bash: gh: command not found »**. L'image de ce conteneur,
`mcr.microsoft.com/devcontainers/typescript-node:22`, n'embarque pas `gh` ;
l'image Codespaces par défaut si, d'où la méprise. Un remède introuvable coûte
plus cher que pas de remède. Les deux messages mettent donc en avant l'onglet
**PORTS** de l'éditeur — trois clics, rien à installer — et `gh` n'est plus
qu'une mention entre parenthèses. `devcontainer.json` réclame désormais `gh`
comme fonctionnalité, pour les espaces à naître.

Le diagnostic recopiait ce remède **quatre fois** : il est écrit une seule fois,
et un contrôle échoue s'il réapparaît en double.

`scripts/test-ouvrir-port.ts` l'éprouve avec un **faux `gh`** posé devant le
vrai — l'agent n'a pas d'espace GitHub, et un contrôle qu'on ne peut pas jouer
ne prouve rien. Il vérifie la commande exacte envoyée, les deux modes de panne,
et **que `demarrer.sh` l'appelle vraiment** : un script juste que personne
n'appelle ne répare rien, ce qui est le défaut d'origine. Ce dernier contrôle a
d'ailleurs commencé par rester vert alors que l'appel avait été supprimé — il
lisait le commentaire qui le surplombe. Les commentaires sont maintenant retirés
avant de regarder ; c'est le même piège que le test de l'annonce d'adresse.

### Le correctif de la session fantôme, éprouvé — et trois défauts qu'il cachait

Le remède posé quelques heures plus tôt **fonctionnait sur le papier et pas dans
un navigateur**. Le contrôle écrit pour le tenir a trouvé, l'un après l'autre,
trois défauts qu'aucun voyant vert ne montrait.

**1. La redirection n'était pas une redirection.** Le contrôle vivait dans
`src/app/documents-legaux/page.tsx`. Or une page rend sous la frontière de
`src/app/loading.tsx` : l'enveloppe HTML est déjà partie quand la page décide.
Next.js ne peut plus émettre de 307 — il rend **200**, avec un renvoi que le
navigateur joue *en JavaScript*. Mesuré, pas supposé : `curl` recevait 23 ko de
page et `NEXT_REDIRECT;replace;/api/session-perimee` enfoui dans la charge React.
Le contrôle est donc remonté dans le layout (`GardeDocumentsLegaux`), qui précède
le premier octet. Quatre écrans vérifiés — `/`, `/documents-legaux`, `/planning`,
`/login` — rendent désormais un vrai **307**, sans une ligne de JavaScript.

**2. Le remède renvoyait vers une adresse morte.** `NextResponse.redirect` exige
une adresse absolue, fabriquée depuis `request.url` — laquelle vaut l'adresse
d'ÉCOUTE. La route répondait `location: http://0.0.0.0:3000/login`. Derrière le
relais de son espace de travail, le patron aurait atterri nulle part : le
correctif l'aurait laissé devant une page blanche, exactement comme le défaut
qu'il répare. Le `Location` est maintenant **relatif** — aucun relais ne peut
tromper un chemin que le navigateur résout contre l'adresse qu'il a ouverte.

**3. Le premier correctif déconnectait un compte parfaitement valide.**
`resoudreEntrepriseId` envoyait vers l'effacement dès qu'il ne trouvait aucune
adhésion. Or « compte disparu » et « compte sans entreprise » sont deux choses :
le second se serait reconnecté, n'aurait toujours pas d'entreprise, et serait
reparti vers l'effacement — **une boucle sans sortie**. Les deux cas sont
désormais distingués par l'existence du compte ; l'anomalie de données lève de
nouveau `AucuneEntrepriseError`, ce que `test-auth-autorisation` exigeait depuis
toujours et que le correctif avait cassé (deux contrôles au rouge).

`scripts/test-session-perimee-e2e.ts` tient les cinq points, dont un parcours
dans un **vrai navigateur, JavaScript coupé** — le seul qui distingue un 307
d'un renvoi joué après coup. Chacun a été vu échouer sur l'état dégradé qu'il
prétend détecter, et sur lui seul.

### Un nom inventé arrête désormais la livraison

`scripts/banc.mjs` lisait une variable `bati` qui **n'existait pas**. Types au
vert, lint au vert : la panne n'apparaissait qu'à l'exécution — et pas n'importe
où, **après la construction**, une fois le banc annoncé prêt. Le patron perdait
son application au moment précis où elle venait d'arriver, sur un
`ReferenceError` suivi d'un `EADDRINUSE`.

Rien ne pouvait le voir : `no-undef` est éteint par défaut sur ces fichiers, et
TypeScript — qui joue ce rôle ailleurs — ne les regarde pas. La règle est
activée pour tout le JavaScript du dépôt, avec les globales lues **sur Node
lui-même** plutôt qu'énumérées à la main : une liste écrite à la main finit
toujours par accuser à tort un `structuredClone` ou un `fetch`. Éprouvé en
remettant le défaut d'origine : `banc.mjs 'bati' is not defined` — et le défaut
avait **survécu** à la réécriture de l'annonce entre-temps, sous une autre
forme, à une autre ligne.

**Et le dossier que le banc bâtit était lu par le lint.** `.next-batie` n'est
pas couvert par `.next/**` : une fois `npm run banc` joué, `npm run lint`
recrachait **1 271 erreurs** venues de code généré. Personne ne s'en apercevait
tant qu'on ne lançait pas le banc — et un contrôle noyé ne se lit plus.

**La panne qui a tenu la soirée entière.** Le jeu de démonstration avait été
refait, l'ancien compte supprimé, et le navigateur du patron portait toujours la
session de ce fantôme — `38befa76-e564-4751-9060-69ada52e720d`. Le cookie est
signé, donc valide : l'application le laissait entrer, puis **toute écriture
était refusée**. Il a vu « aucune adhésion d'entreprise », puis un `insert` en
échec sur les documents légaux, sans que rien ne relie ces messages à leur cause
commune. Reproduit ici, sous le rôle applicatif :
`new row violates row-level security policy`.

Lui demander de vider ses cookies n'est pas une réponse : c'est lui faire
réparer notre défaut, à vingt-deux heures, sur un téléphone.

`GET /api/session-perimee` efface les cookies de session — **les deux familles
de noms**, `authjs.*` et `__Secure-` / `__Host-`, sans quoi le défaut resterait
intact précisément derrière le relais où il le rencontre — et renvoie à l'écran
de connexion. Elle ne touche à aucune donnée : c'est le navigateur qu'elle
nettoie, jamais la base. Elle est publique dans le middleware, sinon le
garde-fou renverrait vers `/login` **avant** que le cookie soit effacé, et le
fantôme survivrait au remède.

Deux endroits y mènent, parce que le fantôme mord à deux moments : `getCurrentCtx`
quand il n'y a pas d'entreprise, et l'écran des documents légaux — qui précède
toute entreprise — quand le compte lui-même n'existe plus.

Éprouvé contre **son identifiant exact** : `utilisateurExiste` répond `true` pour
le compte réel et `false` pour le fantôme ; la route rend `303` avec les cookies
expirés au 1er janvier 1970.

### Préchauffer TOUS les écrans, et ne plus mourir en basculant

Deux suites au correctif précédent, la seconde trouvée à l'essai et sérieuse.

**Ouvrir la connexion ne suffisait pas.** Chaque écran suivant coûte le même
premier appel, et le relais coupe pareil : le patron se serait connecté pour
retomber sur une page blanche à l'écran d'après — le même défaut, déplacé d'un
cran. Le banc parcourt donc **les dix-sept écrans** avec une vraie session, y
compris ceux d'un chantier, qui sont les plus lourds. Mesuré : 26 s pour les
dix-sept, et chacun s'ouvre ensuite en quelques dizaines de millisecondes.

**La bascule tuait l'application.** `next dev` n'est qu'une enveloppe : le
processus qui ÉCOUTE se renomme `next-server` et **survit à la mort de son
père**. Trois secondes d'attente ne suffisaient pas ; `next start` tombait sur
`EADDRINUSE`, le script mourait, et le patron se retrouvait sans application —
**à cause du remède**. C'est le piège du 404 du 9 août (`veiller.sh`), déplacé
d'un cran.

On attend désormais que le port soit **vraiment** rendu, on le vérifie en
interrogeant la santé, on insiste sur `next-server` s'il le faut — et si le port
ne se libère pas, **on ne bascule pas** : mieux vaut un banc lent qu'un banc mort.

Vu rouge puis vert : `EADDRINUSE` avant, `Ready in 157ms` et `200 en 0,2 s`
après.

### La page blanche, enfin : le relais coupait avant la fin de la compilation

**Mesuré, pas supposé.** `next dev` ne compile un écran qu'au **premier appel** :
la route de santé répond en 0,5 s, mais `/login` coûte **6,8 s ici** — et
**trois minutes** sur le disque du patron, son propre journal le disait depuis
le début : `GET / 307 in 3.0min`. Or le relais de GitHub abandonne au bout d'une
minute.

Il ne pouvait donc **jamais** voir cette page, quoi qu'il fasse : elle n'était
pas encore compilée quand le relais coupait. Toutes les autres pistes — session,
port, protocole, adresse — étaient des symptômes ou des erreurs de ma part.

Le banc paie donc ce coût **de l'intérieur**, où rien n'abandonne, dès que le
serveur répond : il ouvre `/login` puis `/` pour lui. Mesuré de bout en bout :

| | |
|---|---|
| `/login` compilé de l'intérieur | 13 s |
| premier appel extérieur, ensuite | **0,043 s** |
| après bascule sur la version bâtie | 0,062 s |

Quinze minutes de patience accordées au préchauffage : abandonner là rendrait
exactement la page blanche qu'on cherche à épargner. Et un échec n'empêche
rien — ce n'est qu'une avance prise.

### Servir d'abord, bâtir ensuite — la page blanche n'était qu'une attente

Le patron ouvre son adresse : page blanche, encore. Le diagnostic dit
**« Application, vue de l'intérieur : injoignable »**. Rien n'était cassé : le
banc se rebâtissait, et `scripts/banc.mjs` **bâtissait AVANT de servir**. Sur son
disque — que Next.js mesure lui-même deux cents fois trop lent — cela veut dire
des dizaines de minutes sans rien du tout.

Désormais le serveur de développement part **tout de suite**, et la construction
se fait à côté ; on ne bascule qu'une fois qu'elle a abouti. **À aucun moment il
n'y a plus rien.**

Ce que ça exigeait : **deux dossiers de construction**, sinon les deux serveurs
se marchent dessus et le remède casse ce qu'il répare. `next.config.ts` lit donc
`ATLAS_DIST_DIR` — le développement garde `.next`, la version bâtie vit dans
`.next-batie`.

**Mesuré, pas supposé** : l'application répond en **20 secondes** au lieu
d'attendre la fin de la construction ; la bascule se fait ensuite sans coupure —
`200` avant, `200` après.

**Un défaut de mon banc d'essai à moi, au passage** : Turbopack refuse un
`node_modules` en lien symbolique hors du projet. Mon premier essai a donc
échoué sur ma propre installation, pas sur le correctif — et j'ai bien failli en
tirer la mauvaise conclusion.

### `pg_dump: command not found` — j'avais supposé un outil au lieu de le vérifier

La sauvegarde que je venais d'écrire pour protéger sa base a répondu au patron
`pg_dump: command not found`. **C'est encore lui qui l'a découvert**, sur une
machine que je ne peux pas voir, un soir où il essayait déjà de sauver ses
données.

`scripts/sauvegarder-banc.mjs` fait le même travail **sans `pg_dump`** : il
n'emploie que `pg`, déjà dépendance de l'application, et écrit toutes les lignes
de toutes les tables dans un seul JSON. Le script shell garde `pg_dump` quand il
existe — meilleure fidélité — et bascule sur ce chemin sinon, en le disant.

Ce qui est sauvegardé, dit franchement : **les données, pas le schéma**. Celui-ci
vit dans `drizzle/`, versionné, et se rejoue avec `npm run db:migrate`. Ce qui ne
se retrouve nulle part ailleurs, ce sont les chantiers, les clients, et ce que
l'agent a appris.

`ATLAS_SANS_PGDUMP=1` force le repli : un chemin de secours jamais joué ne
protège de rien. Les deux chemins ont été joués sur une vraie base — 39 tables.

### Le banc se diagnostique tout seul, et déclare le protocole de son port

Suite de la soirée du 10 août. Le patron a ouvert l'adresse de son banc dans
**deux navigateurs différents, en navigation privée** — donc sans le moindre
cookie — et les deux lui ont proposé de **télécharger un fichier**. Cela tue
l'hypothèse de la session périmée : ce n'est pas son compte, c'est la réponse
elle-même qui n'est pas une page.

Deux changements, et aucun ne lui demande de taper quoi que ce soit :

- **Le protocole du port est déclaré** dans `devcontainer.json` :
  `"protocol": "http"`. Un relais réglé sur HTTPS devant un serveur qui parle
  HTTP renvoie des octets illisibles — et un navigateur devant des octets sans
  type les prend pour un fichier. C'est la cause qui colle exactement au
  symptôme, et elle se règle par déclaration plutôt que par un panneau à
  trouver sur six pouces.
- **Le démarrage lance le diagnostic tout seul**, détaché : il attend que le
  serveur réponde, puis écrit son verdict dans `/tmp/verdict-banc.txt`. Le
  bandeau de démarrage donne la seule commande à taper si l'adresse ne s'ouvre
  pas — `cat /tmp/verdict-banc.txt` — et la réponse y est **déjà** quand il la
  demande, au lieu d'attendre trente secondes de plus.

Le bloc détaché a été joué pour de vrai, serveur absent : il patiente, puis
écrit « L'APPLICATION NE RÉPOND PAS, même de l'intérieur ».

### Un diagnostic qui dit QUI ment, en une commande

`npm run diagnostiquer:banc`.

**Pourquoi.** Le patron ouvre l'adresse de son banc depuis son téléphone :
Safari affiche `about:blank` et lui propose de **télécharger un fichier**. Pas
une page blanche — un téléchargement. J'ai reproduit l'application ici, base
montée, serveur lancé : elle répond `307 → /login` puis `200 text/html`, y
compris avec les en-têtes du mandataire de GitHub. **L'application est donc hors
de cause**, et je ne pouvais pas aller plus loin : le réseau de l'agent refuse
`*.app.github.dev`.

Ce qui manquait n'était pas une idée, c'était **un fait** : la réponse exacte
que reçoit son téléphone. Ce script va la chercher **depuis l'intérieur de
l'espace de travail**, seul endroit d'où l'adresse publique est joignable, et il
en tire un verdict en français : l'application est morte, l'application renvoie
un type illisible, le port n'est pas ouvert, c'est GitHub qui répond à sa place,
le relais abîme la réponse, ou tout est en ordre.

Il suit les redirections, parce qu'un `307` n'a pas de type de contenu et que
s'arrêter là ne prouverait rien ; et il annonce l'en-tête `accept` d'un
navigateur, sinon il éprouverait un cas que personne ne vit.

**Une erreur n'est pas un type de contenu abîmé.** La première version accusait
le protocole du port devant un `403` du relais — le mauvais coupable, ce que le
dépôt interdit. Les deux cas sont désormais distingués, et le message recopie
**mot pour mot** ce que le relais a répondu.

Les six verdicts ont été joués, chacun contre l'état qu'il prétend détecter.

### Le banc d'essai envoyait le patron chercher au mauvais endroit

Deux défauts trouvés en le regardant s'en servir, le 10 août au soir, et
**aucun dans l'application** — les deux dans `scripts/essai.mjs`.

**« Ok to proceed? »** Sans dépendances installées, `npx` ne trouve pas `next`
en local et **propose de le télécharger** : *« Need to install the following
packages: next@16.3.0 »*, quand le dépôt est figé sur **16.2.12**. Le patron a
lu une question sans rapport avec ce qu'il voulait faire, et accepter aurait
fait tourner l'application sur une version que personne n'a éprouvée. Le script
vérifie donc `node_modules/next` avant tout, et sort en nommant le vrai
coupable ; `npx --no-install` en renfort, pour qu'un cas non prévu **échoue** au
lieu de poser une question.

**« L'application n'a pas répondu après trois minutes »** — alors qu'elle
arrivait. Le journal disait tout, trois lignes plus haut : **`Slow filesystem
detected. The benchmark took 20605 ms`**, deux cents fois la normale. Le serveur
avait démarré en 486 ms et compilait encore. Trois corrections :

1. **Dix minutes au lieu de trois.** Abandonner trop tôt ne coûte pas une
   attente : ça fait croire à une panne.
2. **Un signe de vie toutes les trente secondes.** Un écran figé dix minutes se
   lit comme un plantage — et on ferme alors le terminal, ce qui tue le serveur
   au moment où il aboutit.
3. **Le message n'accuse plus la base de données par défaut.** Il regarde si le
   serveur est **encore en vie**, ce qui sépare les deux cas sans rien
   supposer : s'il tourne, il dit de ne pas fermer le terminal et donne la
   commande qui répond par oui ou non ; s'il est mort, alors seulement la base
   est citée.

**Un défaut trouvé en éprouvant le correctif :** la branche « le serveur s'est
arrêté » était **inatteignable**. `serveur.on("exit")` appelait `process.exit`
sur-le-champ, si bien que le script mourait avant de pouvoir expliquer quoi que
ce soit. La sortie est désormais retenue, traitée après le diagnostic, puis
rendue telle quelle.

Les quatre chemins ont été joués : dépendances absentes, serveur mort, serveur
vivant qui ne répond pas, et démarrage normal.

### « Terminés » : un fil par mois, et facturer en trois appuis

L'écran empilait trois sortes de pavés arrondis, dont **un seul plein** : le
relevé de TVA. L'œil allait donc d'abord sur ce qu'on consulte une fois par
trimestre. « Rien à facturer » s'affichait comme un titre de section suivi de
rien — l'écran avait l'air amputé au lieu d'avoir l'air calme. Et **il ne disait
jamais combien**, alors que c'est la seule question qu'on lui pose.

Il devient un **fil par mois**, le même que la liste des chantiers : deux écrans
qui se ressemblent s'apprennent une seule fois. Des filets, aucun pavé. Les
montants tiennent une colonne et rien ne s'ajoute après eux.

**L'encart « à facturer » se pose DANS le mois**, pas à côté : le chantier du
20 août est un chantier d'août, et le sortir casserait le fil. Une pastille
bronze sur le fil porte le nombre, une ligne l'annonce en toutes lettres, et
tout cela **reste replié au repos** — l'encart appelle, il n'occupe pas. **À
zéro, il n'existe pas** : jamais de « 0 », jamais de compte bancal.

Le montant vient du devis accepté, et l'écran le dit : « Montants prévus aux
devis », **jamais « à encaisser »**.

**« Fin de chantier » devient « Créer la facture »**, sur les trois écrans qui
portaient le mot. L'ancien nom ne disait pas ce que la touche fabrique. Et
**créer n'est toujours pas envoyer** : la facture naît d'un appui, elle part
d'un autre.

**Deux défauts que seule la capture a vus.** Une ligne trop longue déborde
toujours du côté de la fin de ligne, quel que soit `text-align` : « juillet »
passait sous la pastille, qui lui mangeait sa dernière lettre. Et un montant
inconnu s'écrivait « 0,00 € » — un chantier sans devis chiffré n'attend pas zéro
euro, on ne sait pas.

`ARCHITECTURE.md` §53.

### Le planning au mois, et les équipes qui portent un nom

*« Il faut que dans le fichier réglages on puisse mettre le nom des équipes —
soit équipe A équipe B, soit des noms et prénoms. Mais s'il n'a pas d'équipe et
qu'il ne met rien, il ne faut pas qu'il y ait quand même écrit équipe A équipe
B. »*

**La règle qui en découle n'est pas cosmétique :** on n'invente jamais un nom,
et on ne laisse jamais deux lignes indiscernables. À une seule équipe, le mot
« équipe » ne s'écrit **nulle part** — ni dans le planning, ni dans une phrase
d'explication, et Réglages ne propose même pas de champ : le patron y écrirait
un prénom qui n'apparaîtrait nulle part. À deux, chaque ligne porte le sien, et
un champ vide affiche déjà en gris ce qui sera écrit à sa place.

**Le repli est un affichage, jamais une donnée.** `equipes.nom` est nullable et
sans valeur par défaut ; une seule fonction pure décide du libellé, appelée par
l'écran comme par la revalidation serveur. Deux implémentations divergeraient, et
le jour où elles divergent l'écran promet une équipe que le serveur ne connaît
pas.

**Le planning devient un mois.** Sept colonnes, aucune bordure, un chiffre en
serif et un point de 5 px dessous. **Cinq marques et non quatre** : sans
l'anneau « il reste de la place », un jour à moitié pris se lisait comme un jour
libre dès qu'il y a plusieurs équipes. Toucher un jour ouvre sa journée
directement sous le calendrier et l'amène à l'écran — posée plus bas, elle
s'ouvrait hors du champ et le patron a écrit deux fois « rien ne s'ouvre quand
je touche un jour ».

**Poser, c'est dire à la fois quand et qui** : le bouton ne s'arme qu'une fois
l'équipe choisie, et il n'y en a qu'un — « Poser · matin · Théo → ». Le serveur
revalide le créneau, parce qu'entre l'affichage et l'appui un client a pu le
prendre.

**Un aller-retour sur le compteur ne perd aucun nom.** Redescendre de trois à
deux ne supprime rien en base : remonter rend le nom écrit pour la troisième.
Effacer aurait été une perte silencieuse sur une saisie que rien ne
reconstitue.

Détail et pièges dans `ARCHITECTURE.md` §51 et §52.

### Le banc d'essai reparle : deux phrases qui avaient divergé

Depuis le 9 août au soir, la vérification du banc échouait à chaque fois sur
« l'adresse à ouvrir n'est annoncée nulle part » — **et l'adresse était
annoncée**, mot pour mot, deux lignes plus haut dans le même journal.

Il y a deux façons de démarrer le banc. `npm run essai` écrivait
« L'application répond » ; `npm run banc` — celui que l'espace de travail
démarre tout seul depuis qu'il sert une version bâtie — écrivait « Atlas
répond ». Le contrôle cherchait la première phrase dans un journal produit par
le second.

Le message accusait donc le mauvais coupable, ce qui coûte plus cher que pas de
message du tout. L'annonce vient désormais d'un seul endroit
(`scripts/annonce-adresse.mjs`), et un test **lit le script du conteneur** pour
vérifier que la phrase qu'il cherche est celle que le module écrit. En cas
d'échec, la fin du journal de démarrage est recrachée.

### L'anneau muet et la pellicule — la fiche chantier

Sur la fiche, la ligne « Note vocale · 1 min 42 » devient un **anneau** : on le
touche, la note se lit ; on le pousse vers le haut, « Retirer » se découvre.
Elle annonçait une note sans la jouer — il fallait un écran de plus pour
entendre ce que le patron venait de dire. **La chose la plus fréquente devient
le geste le plus court.** Aucun libellé visible, mais un nom accessible :
« Écouter la note vocale ».

**Le compteur suit la lecture réelle, et l'onde le volume réellement
enregistré.** La maquette n'avait qu'une horloge CSS et une onde
vraisemblable ; les recopier aurait donné un écran qui ment. Un `AnalyserNode`
mesure le signal qui sort et pilote la hauteur des barreaux par une variable
CSS — sur le conteneur, jamais barreau par barreau.

**Les photos deviennent une pellicule** dans le tiroir du bas, **case « + » en
tête** : posée à la fin, il fallait faire défiler six photos pour ajouter la
septième. La ligne « Photos · 6 photos » disparaît — elle comptait ce qui est
désormais sous les yeux.

**Et le jeu de démonstration contient enfin des fichiers.** Il déclarait des
clés de stockage sans octets derrière : la lecture était refusée, les vignettes
vides, et rien ne le disait. `seed.ts` fabrique désormais de vraies photos PNG
et une vraie note WAV — une voix de synthèse à modulation syllabique, parce
qu'un signal plat donne une onde plate.

**Cinq pièges payés, tous vus à l'œil et aucun par un contrôle** : un contexte
audio qui mesure un silence qu'il a lui-même créé ; le raccourci `animation:`
qui remet `animation-play-state` à `running` et fait battre l'onde au repos ;
un `<button>` que `display: flex` n'étire pas, d'où « Retirer » collé au bord
gauche, visible et touchable, tous voyants au vert ; `--atlas-barre` qui est une
réserve de place (68 px) et non la hauteur dessinée (49 px), d'où une bande de
pellicule affleurant sous le résumé ; et l'écran de dessous qui doit reculer,
faute de quoi le tiroir tranche l'anneau par le milieu. Détail dans
`ARCHITECTURE.md` §49.

### Le tiroir des retirés — une seule façon de supprimer, partout

*« Je veux qu'il applique ce style à tout ce qu'on peut supprimer dans
l'appli. »* Le texte glisse vers la gauche, « Retirer » se découvre, la ligne
tombe, et un tiroir la retient en bas de l'écran : « Retiré à l'instant —
Annuler ».

**Ce que ce lot déplace, et c'est le cœur du geste :** la sécurité passait par
une confirmation AVANT (« Supprimer cette photo ? »), elle passe par une
réversibilité APRÈS. Les deux panneaux disparaissent — garder les deux ferait
demander deux fois.

**Rien n'est écrit tant que le tiroir est ouvert**, et c'est la promesse dont
tout dépend. La photo et la note vocale mettent leur fichier en file de purge
*dans la même transaction* que la suppression : appeler le serveur au moment du
geste aurait rendu « Annuler » menteur — la ligne serait revenue, le fichier
non. La ligne est donc seulement masquée, et l'écriture attend la fermeture.
Trois sorties la déclenchent : le minuteur, le départ de la page, le démontage.

**Trois mécaniques deviennent une**, sur **huit** endroits — le recensement en
annonçait sept, le planning et ses trois listes manquaient à l'appel.
`CarteGlissante` disparaît ; `AnimatedRow` ne sert plus qu'aux maquettes.

**Le glissement est désormais un défilement natif**, et non un suivi du doigt
en JavaScript. Cent lignes de calcul d'élan en moins, et quatre choses en plus
qui n'existaient pas : l'inertie de la plateforme, `prefers-reduced-motion`, la
molette, et un « Retirer » atteignable au clavier.

**Un seul des huit ne prend pas le glissement, à dessein :** les photos. Une
vignette carrée dans une grille de trois n'est pas une ligne. Elle garde tout
le reste du geste et se retire depuis la visionneuse, là où on la regarde.

**Deux défauts que seule l'exécution pouvait trouver.** Sur le devis complet,
les totaux lisaient le crochet déclaré plus bas : zone morte temporelle, écran
en 500, et ni `tsc` ni `eslint` ne la voient. Et sur le planning comme sur les
tarifs, la carte entière glissait avec son fond — rectangle tiré hors de
l'écran, bordure tranchée net. Vu en capture ; le fond est maintenant porté par
l'enveloppe, qui ne bouge pas.

**Une heure perdue sur un défaut qui n'existait pas**, et la leçon est écrite :
les captures visaient `127.0.0.1`, où Next **refuse de servir ses ressources de
développement**. La page arrivait rendue par le serveur et jamais hydratée — on
cliquait dans le vide, et tout accusait le retrait. C'est `localhost` qu'il
faut viser, et le contrôle attend désormais un marqueur posé après le premier
effet, en échouant s'il n'arrive pas.

### Le corps des écrans Informations et Prix

Étape 2 de la fin de refonte (`TODO.md` §7) : les deux écrans les plus chargés
du parcours. Marges à 26 px, libellés en capitales espacées, textes de
situation à 11,5 px, plages à 4 px sans une ombre.

**Trois choses ont changé de fond, pas seulement d'allure.**

1. **L'encart teinté d'Informations disparaît.** « Proposé à partir de votre
   dictée » vivait dans une plage vert pâle qui ne désignait aucun geste à
   faire. Une couleur qui ne veut rien dire est une couleur en trop — la règle
   née de la maquette 12. La phrase reste, en texte de situation.
2. **L'or ne se pose plus que sur ce qui attend le patron** : « à confirmer »,
   « à compléter », « prix à poser », la mention « recopiée mot à mot », et le
   motif qui grise « Préparer le devis ». Ces avertissements ne sont plus des
   boîtes teintées mais un cheveu d'or à gauche — l'« ourlet » de la maquette.
   Partout ailleurs (provenance d'un prix, « Confirmé »), le gris.
3. **Le total du Prix sort de sa boîte** : capitale, montant en serif de titre,
   phrase dessous. La plage centrée le remettait *au-dessus* de la page, ce que
   le patron a écarté en retenant un écran sans cartes ni ombres.

**Deux défauts trouvés en regardant l'écran, et qu'aucune suite ne pouvait
voir** — les deux étaient là avant ce lot :

- **La croix qui retire une ligne de prix sortait de l'écran.** Une ligne du
  détail porte deux champs ; le conteneur de `AnimatedRow` refusait de
  descendre sous leur largeur intrinsèque, faute d'un `min-w-0`. Le bouton
  existait dans la page — donc les contrôles le trouvaient — mais le doigt du
  patron ne pouvait pas l'atteindre. C'était la seule façon de retirer une
  ligne.
- **La bulle de l'assistant mordait sur « Préparer le devis ».** Soixante-quatre
  pixels de talon ne suffisaient pas.

**Deux voix partagées entrent dans `design-tokens.ts`** — `libelleCaps` et
`texteSituation`. Elles étaient recopiées à la main dans chaque écran refait,
six fois les mêmes quatre valeurs ; un `0.28em` mal retapé ne se voit pas en
relecture. `smallCaps` reste, et sert désormais les seules maquettes
`/design/*`, découplées du produit.

**Ce qui n'a PAS suivi, et pourquoi :** la variante mise en avant de
« Créer le devis à partir de ma dictée » vit sur l'écran Transcription, qui
n'est pas encore refait — lui donner cette voix seule y ferait une fausse note.

**Trois contrôles réparés, dont deux rouges depuis le 10 août au matin.**
`innerText` rend le texte **tel qu'il s'affiche** : depuis que les libellés sont
en capitales, `« Prix Calculé »` et `« Déjà au détail »` ne s'y trouvent plus
tels qu'écrits dans le code. Et le compteur de l'accueil était accusé à tort —
`a[href^="/chantiers/"]` comptait aussi le lien d'une notification, qui défile
avec la liste depuis le 10 août. Aucun de ces trois n'était un défaut du
produit, et le premier réflexe — croire le contrôle — aurait coûté une heure.

### Le devis rejoint la charte : la terre cuite s'efface

*« Oui, harmonise aussi le devis. »* La teinte terre cuite des documents, tenue
à part depuis le 3 août, disparaît. L'accent des intertitres « ÉMETTEUR » /
« CLIENT » devient **l'or**.

**Pourquoi l'or et pas le vert pin.** Le partage des rôles ne change pas : le
vert porte ce qu'on FAIT, l'or ce qu'on LIT. Sur un devis imprimé il n'y a rien
à faire — un intertitre est de la lecture pure.

**`couleursDocument` reste, alors qu'il ne diverge plus**, et ce n'est pas un
oubli : le papier et l'encre d'une pièce imprimée ne suivront pas forcément un
futur changement d'écran. Le jour où l'application passera au sombre, c'est là
qu'on empêchera le devis de partir en noir chez le client.

Le changement traverse d'un seul point : l'écran du devis, celui de la facture
et **les deux PDF** lisent tous ce jeton. Contrôles des deux PDF au vert.

### Une seule écriture pour toute l'application

*« Il faut que toutes les écritures de l'appli changent de police, on harmonise
le tout. »* La réserve laissée ouverte la veille est levée : le devis et la
facture suivent l'écran, et il n'y a plus d'exception de typographie nulle part.

**Rien à changer pour cela, et c'est le point intéressant** — vérifié plutôt
que supposé :

- les pages du client (`devis/[jeton]`, `factures/[jeton]`) et l'écran des
  documents légaux déclaraient déjà `ui-serif, Georgia, serif` en dur : la même
  pile que celle adoptée le 10 août ;
- le **PDF n'a jamais chargé Playfair ni Inter**. Il embarque Times et
  Helvetica, les polices standard du format. Il était donc déjà d'accord avec ce
  que l'écran est devenu.

Un commentaire mentait sur ce dernier point — il annonçait un héritage de
Playfair dans un fichier qui n'en a jamais vu. Corrigé : une documentation qui
décrit une version disparue est pire qu'absente.

**Ce qui ne change PAS, et qu'il ne faudra pas « corriger » :** la couleur terre
cuite des documents. Le patron l'a choisie le 3 août les deux versions sous les
yeux ; une police commune n'est pas une palette commune.

### Le plan de fin de refonte, et le corps de Note vocale

**`TODO.md` §7 existe désormais** : l'ordre des écrans restants, les valeurs
exactes de la grammaire, les sept pièges déjà rencontrés une fois chacun, et
les deux réserves — ce qui ne doit PAS suivre. Le CSS n'y est pas recopié : il
vit dans `docs/maquettes/13-le-fil-quatre-couleurs.html`, du HTML pur qui fait
foi. `PROJECT_STATE.md` dit où en est la refonte et renvoie là.

**Pourquoi ce point plutôt qu'un mot dans une conversation :** une conversation
neuve doit pouvoir reprendre le travail sur une seule ligne — « lis §7, fais
l'étape 1 » — sans rien redemander au patron. C'est la règle du dépôt
(`CLAUDE.md` §2), appliquée à ce chantier-ci.

**Étape 1 faite : le corps de Note vocale.** Marges à 26 px, prises de son en
serif 19 px avec leur situation en capitales, et les deux actions secondaires
— « Ajouter un fichier audio », « Lancer la transcription » — sorties du corps
de texte : à 14 px en graisse moyenne, elles étaient indiscernables d'une
phrase.

### La perle manquait, et le bandeau écrasait la liste

*« Il manque la perle dorée qui glisse. »* Deux causes, l'une derrière l'autre.

**La perle n'avait rien à désigner.** Le jeu de démonstration ne contenait
aucun chantier attendant un geste du patron : l'unique devis envoyé n'avait
jamais reçu de réponse. Or la perle ne se pose que sur ceux-là. Le seed fait
désormais répondre le client — une demande de correction, motivée, comme la
base l'exige (`envois_devis_correction_motivee_ck`). Une fonctionnalité qu'on
ne peut pas voir est une fonctionnalité qu'on croit cassée.

**Et le bandeau de notification écrasait la liste.** Placé dans l'en-tête, il
mangeait deux cents pixels dès qu'il apparaissait : la liste se réduisait à une
bande et la perle passait sous le bord. Les bandeaux défilent maintenant AVEC
la liste. **C'est le même défaut qu'en juillet**, à un autre endroit — et
comme en juillet, il n'était visible que sur une capture : la structure
semblait juste, et les suites étaient vertes.

Mesuré après correction : en-tête intact, liste de 463 px, et la perle qui
s'accroche — elle monte de 864 à 639 px quand la liste défile de 260.

### Les polices de l'artefact, puisque c'est ce qu'il a retenu

*« T'es sûr que t'as pas modifié la typographie ? »* Les caractères n'avaient
pas bougé — Playfair Display et Inter depuis le 3 août. Mais la maquette qu'il
a validée était une **page autonome** : elle ne pouvait charger aucune police
et empruntait donc celles de son iPhone. C'est ce dessin-là qu'il a choisi,
sans le savoir, et il l'a redemandé : *« exactement la même chose […] même
typographie ».*

L'application ne télécharge donc plus aucune police :
`ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", serif` pour les
titres, `ui-sans-serif, -apple-system, …` pour le texte — les piles exactes de
l'artefact. Mesuré sur le banc : **zéro fichier de police chargé**, contre deux
avant.

**Deux conséquences à connaître avant d'y revenir.** Plus de clignotement au
remplacement de police, l'écran s'affiche d'un coup. Mais le dessin dépend
désormais de l'appareil : Iowan Old Style sur iPhone, Georgia sur Windows, Noto
Serif sur Android — proches, jamais identiques. C'est le prix de ce qu'il a
choisi, et il est assumé.

Les titres repassent en graisse 400 : la serif du système est déjà dense, et la
forcer à 500 la fait synthétiser par le navigateur — un faux gras mou, là où la
maquette montre un trait net.

**Ce changement touche aussi le devis et la facture**, qui partagent ces deux
jetons. Signalé au patron plutôt que décidé pour lui.

### Le corps de l'écran Photos

Premier corps repris, dans l'ordre du parcours. Les marges passent à 26 px
comme partout — vingt-quatre contre vingt-six ne se voit pas seul, mais se voit
dès qu'on descend de l'en-tête à la grille. Le compte prend la voix des
libellés (« 6 PHOTOS », capitales espacées), les vignettes se resserrent de
12 px à 10, et « Passer à la note vocale » rejoint les autres actions
secondaires en capitales.

**Un manque du banc, constaté et non corrigé :** les vignettes s'affichent
cassées. Le jeu de démonstration insère des lignes de photos sans déposer les
fichiers, et `/api/fichiers/…` répond 308. Ce n'est pas la refonte — c'est le
seed. Noté ici pour que personne ne cherche du côté de l'affichage.

### Les six écrans d'étape suivent, et par un codemod plutôt qu'à la main

Photos, Note vocale, Prix, Devis, Export, Facture : les six portaient
exactement le même en-tête — flèche de retour dans son bloc, nom du chantier en
petites capitales vertes, titre à 32 px. Ils sont passés à `EnTeteEcran` d'un
seul coup, par un remplacement de motif.

**Pourquoi un codemod et pas six modifications.** Six retouches à la main, ce
sont six occasions de laisser un pixel derrière soi — et l'écart ne se voit
qu'en mettant les écrans côte à côte, ce que personne ne fait. Le motif a été
reconnu six fois et remplacé six fois par la même chose : il n'y a rien à
comparer.

Les cinq écrans ont été parcourus dans un navigateur, un par un : titre juste,
aucun débordement latéral, aucune erreur de script.

### La fiche chantier passe à la nouvelle grammaire

Le premier écran profond repris. Ce qui change tient en une idée : **la fiche
se lit maintenant comme le fil**.

- Le retour et « Fin de chantier » entrent dans l'en-tête commun. Ils vivaient
  dans un bloc séparé, à `px-6` quand l'en-tête est à `px-[26px]` : deux marges
  différentes sur le même écran, visibles dès qu'on les met côte à côte.
- « Fin de chantier » perd sa pilule pour un rectangle cerné d'un cheveu.
- Les étapes prennent la voix du fil : intitulé en serif 19 px, ligne du
  dessous en capitales espacées. C'est la même information qu'un état de
  chantier — elle doit se lire pareil, sinon l'œil réapprend à chaque écran.
- La sortie de secours « rédiger le devis à la main » passe en capitales : les
  libellés d'action secondaire ont désormais une seule voix.

### La grammaire de l'écran retenu, portée à toute l'application

*« Change le style complet de l'appli par ce style-là. »* Trois pièces
partagées font l'essentiel, et c'est délibéré : recopier une allure écran par
écran, c'est s'assurer qu'ils divergeront de nouveau au premier retouchage.

- **`PrimaryButton`** — présent sur vingt-sept écrans. Rayon de 16 px à 5,
  libellé en serif, hauteur resserrée. Un rectangle presque droit se lit comme
  une pièce imprimée ; le même arrondi à 16 px se lit comme un bouton
  d'application, et c'est ce dont le patron ne voulait plus.
- **`EnTeteEcran`** (nouveau) — surtitre en capitales d'or, titre serif 36 px,
  précision en capitales, et le cheveu qui FERME l'en-tête. Jamais de trait
  au-dessus du titre : il l'a refusé sur l'accueil, et un écran qui en porterait
  un jurerait avec les autres. Posé sur Planning, Terminés, Réglages, le relevé
  de TVA et la fiche chantier.
- **Les jetons** — `radius.card` 16 → 4, `radius.button` 20 → 5, et
  `cardShadow` vaut désormais « aucune ombre ». La constante reste plutôt que
  d'être retirée d'une soixantaine d'endroits : ce brassage aurait mêlé un
  changement d'identité à un changement mécanique, chacun masquant les erreurs
  de l'autre.

**Et un balayage :** 143 coins arrondis ramenés à 4 px dans les écrans du
patron. Deux familles en sont exclues, et ce n'est pas un oubli — les maquettes
`/design/*`, découplées du produit, et **les pages que le CLIENT reçoit**
(`devis/[jeton]`, `factures/[jeton]`). Un devis n'est pas un écran : c'est la
pièce que son client garde, imprime et signe, et elle porte sa propre teinte
depuis le 3 août.

**Ce qui reste dans l'ancienne grammaire :** l'intérieur des écrans profonds —
photos, dictée, prix, export, facture. Leur en-tête et leurs boutons ont suivi ;
leurs listes et leurs encarts non.

### L'écran des chantiers, tel qu'il l'a retenu

Après une soirée de maquettes, le patron s'est arrêté sur une version et l'a
donnée à coder. Elle est en place.

**Ce qui change, et ce que chaque changement évite :**

- **Le fil remplace les cartes.** Un trait vertical traverse la liste et porte
  les jours. Une liste de chantiers n'est pas un tableau de bord : ce qui doit
  se voir, c'est la suite des jours, pas le contenant. Quatre chantiers
  tiennent maintenant à l'écran là où il y en avait trois.
- **La perle, seul point de couleur.** Elle se colle à mi-hauteur et ne se pose
  que sur le PREMIER chantier qui attend un geste du patron. Règle de charte
  qui vaut désormais partout : *une couleur qui ne veut rien dire est une
  couleur en trop*.
- **Plus de cheveu sous ATLAS**, refusé explicitement. Seul reste celui qui
  FERME l'en-tête, au-dessus de « Nouveau chantier » — celui-là, il l'avait
  demandé.
- **Le bandeau du bas perd son aplat vert** au profit d'un trait d'or qui
  glisse d'un onglet à l'autre. Le vert plein était un second bloc de couleur
  sur un écran qui n'en veut qu'un.
- **« Nouveau chantier » monte en feuille** : la liste recule, s'assombrit, le
  formulaire arrive devant. La route `/chantiers/nouveau` reste — les suites y
  vont directement, et un lien profond doit continuer d'ouvrir un écran entier.
  Le formulaire est extrait une fois et servi aux deux endroits : deux copies
  auraient divergé au premier champ ajouté.

**Trois défauts trouvés en REGARDANT, pas en testant.**

1. **Le fil ne s'affichait pas.** Posé une seule fois sous la liste, il était
   repeint par la couche qui glisse pour découvrir la corbeille — celle-ci
   porte le fond de la page. Il est désormais dessiné ligne par ligne ; bout à
   bout, les segments n'en font qu'un.
2. **La perle n'aurait pas pu se coller.** Elle était fille d'un conteneur haut
   d'une seule ligne : `position: sticky` s'y serait arrêté au bout de 97 px.
   Un fragment à la place du conteneur la rend fille directe du fil.
3. **La feuille passait sous le bandeau et sous la bulle de l'assistant**, tous
   deux fixés au-dessus. Sa dernière ligne — celle qui prévient que les
   coordonnées ne seront plus modifiables — était cachée derrière les onglets.

**Et un piège du banc, à retenir.** `npm run banc` ne rebâtit que si le commit
a changé : tant que le travail n'est pas commité, il ressert la version
précédente. Une mesure a été prise sur du code qui n'était pas celui du disque,
et le fil « absent » l'était seulement parce qu'il n'avait jamais été bâti.
Supprimer `.next/atlas-version-batie.txt` force la reconstruction.

**Ce qui a disparu, et pourquoi ce n'est pas une perte.** La carte « Équipe »
au pied de la liste menait aux Réglages, qui sont un onglet du bandeau ; et la
cloche de l'en-tête n'avait jamais eu de comportement. Les notifications, elles,
restent affichées sous le titre.

**Éprouvé** : 99 suites base au vert, la suite bout en bout de l'accueil, et la
connexion réelle derrière une origine étrangère. Le compteur de l'accueil porte
désormais son nombre en attribut (`data-atlas="compteur"`) — un contrôle
accroché au libellé cassait à chaque refonte sans qu'aucun défaut n'existe.

---

## 2026-08-09

### Un sommaire de maquettes qui ne s'ouvrait pas, et la page unique qui le remplace

Les huit maquettes de l'écran Chantiers avaient été partagées comme huit
adresses séparées, avec un sommaire qui pointait dessus. **Le sommaire ne
s'ouvrait pas** : une page publiée s'exécute confinée et ne peut naviguer vers
aucune autre adresse. C'est le patron qui l'a découvert, en cliquant — encore
un parcours transmis sans avoir été parcouru.

`scripts/fusionner-maquettes.mjs` engendre désormais **une seule page** qui
porte les huit maquettes et un sommaire à ancres : cliquer un titre y descend,
sans jamais quitter la page. Les huit fichiers restent la source ; la page
unique est un produit qu'on régénère, donc elle ne peut pas diverger d'eux.

**Pourquoi un script et pas un copier-coller.** Les huit maquettes ont été
écrites séparément et partagent les mêmes noms de classes (`.ecran`, `.prop`,
`.nom`) et les mêmes identifiants (`#modele`, `#duo`). Concaténées, la charte
de l'une repeindrait l'autre. Chaque feuille est donc confinée sous un ancêtre
unique — `:root`, `html` et `body` deviennent `#s01` … `#s08` — et chaque
script d'origine reçoit un `document` restreint à sa section. Le code des
scripts n'a pas été réécrit : il ne peut donc pas s'écarter de l'original.

`scripts/verifier-maquettes-page-unique.mjs` **clique les huit titres** dans un
navigateur et vérifie qu'on arrive sur l'écran. Confronté à trois états
dégradés, il nomme le bon coupable à chaque fois : une ancre morte, un lien
vers l'extérieur — le défaut d'origine, précisément — et une feuille de style
qui ne s'applique plus.

### Le cheveu sous ATLAS tombe, et le fil part en quatre couleurs

Le patron garde l'écran aminci et tranche une chose : **plus de trait entre
ATLAS et « Bonjour Florian »**. Celui qui ferme l'en-tête, au-dessus de
« Nouveau chantier », reste — c'est lui qu'il avait demandé deux échanges plus
tôt. L'en-tête respire donc d'un seul tenant, du nom jusqu'à ce trait.

`scripts/engendrer-maquette-fil.mjs` écrit les douze écrans — trois formes de
liste × quatre chartes (Origine, Ivoire, Sylve, Océan) — **en HTML pur**. Le
contrôle les mesure JavaScript coupé : douze écrans, quatre fonds distincts,
aucun cheveu sous ATLAS, aucun pied hors du téléphone.

### Enlever la boîte : trois tentatives sur Origine

Le patron demande des encadrés *« plus fins, moins larges »*, et surtout de
**tenter quelque chose** pour que l'application soit moderne et unique — sur un
seul coloris.

Les encadrés passent de 16 à 26 px des bords et de 18 à 12 px de hauteur
intérieure : **quatre chantiers tiennent là où il y en avait trois**. Mais la
tentative est ailleurs. Une liste de chantiers n'est pas un tableau de bord :
ce qui doit se voir, c'est la suite des jours, pas le contenant. Les trois
variantes en enlèvent chacune un peu plus.

- **L'ourlet** — la plage devient un simple cheveu vertical, qui passe à l'or
  *uniquement* là où un geste est dû. La couleur cesse de décorer : elle
  désigne.
- **Le fil** — plus aucune boîte : un trait vertical traverse la liste et porte
  les jours, comme une tige. Une seule perle d'or s'y pose, sur le chantier qui
  attend une réponse.

Une règle en sort, qui vaudra pour tout l'écran : **une couleur qui ne veut
rien dire est une couleur en trop.**

### La vraie raison pour laquelle il ne pouvait rien ouvrir : le JavaScript

Trois fois : *« Je ne peux pas ouvrir ça. »* J'ai d'abord accusé la connexion
aux artefacts, puis la taille des écrans. C'était ni l'un ni l'autre.

**La maquette 09 s'est affichée du premier coup sur son téléphone** — il en a
renvoyé la capture. Les 06, 10 et 11, non. La seule différence entre elles :
09 est du HTML pur, les autres engendrent leurs écrans en JavaScript depuis un
gabarit cloné. Son lecteur n'exécute pas les scripts, et il recevait donc une
page vide.

La maquette 11 est réécrite **sans une ligne de script** :
`scripts/engendrer-maquette-couleurs.mjs` dépose les seize écrans en clair. La
promesse « rien ne change sauf la couleur » n'est pas abandonnée, elle change
de gardien — elle passe du navigateur au script qui écrit la page. Le contrôle
charge désormais la page **JavaScript coupé** : il reproduit ses conditions,
pas les miennes.

La leçon vaut au-delà des maquettes : trois correctifs de suite ont réparé une
panne imaginée parce que personne n'était allé chercher ce qui différait
vraiment entre le cas qui marche et celui qui échoue.

### L'écran retenu seul, et un contrôle qui accusait à tort

**Corrigé dans la foulée : la taille.** Le patron a renvoyé sa capture de la
maquette 09 — *« c'est ce modèle-là »*. Le dessin était le bon ; ce sont les
téléphones de 300 px sur une grille de quatre qui étaient illisibles sur son
écran. La maquette 11 reprend donc les mesures exactes de 09 (390 px, corps à
16 px, titre à 40 px) et lui part en **une image par coloris**, pas en
planches. Une maquette qu'il doit pincer pour lire n'a pas été montrée.

Le patron tranche entre les deux écrans : ce sera **le trait seul**. La
maquette 11 le montre dans les seize chartes, quatre par rangée — une seule
variante permet de comparer les couleurs d'un coup d'œil au lieu de faire
défiler.

Ses couleurs sont **recopiées de la maquette 10 par un script**, jamais à la
main : deux nuanciers écrits séparément finissent par diverger, et on ne sait
plus lequel fait foi.

**Un contrôle qui désignait le mauvais coupable.** La fusion refusait la
maquette 11 avec « script présent mais gabarit non préfixé », alors que tout
était préfixé — le contrôle supposait que tout gabarit s'appelle `modele`.
Il lit désormais les appels réels du script et vérifie que chaque identifiant
cherché existe, préfixé, dans le corps. Éprouvé dans les deux sens : un
identifiant absent de la liste de préfixage, et un gabarit renommé.

**Et il ne faut plus lui envoyer d'adresses.** Trois fois de suite il n'a pas
pu ouvrir un artefact. Ce qui marche, ce sont **les images** : elles
s'affichent dans la conversation, sans rien à ouvrir ni à quoi se connecter.
Les maquettes lui partent désormais en planches PNG, l'adresse seulement en
complément.

### Les deux écrans retenus, déclinés en seize chartes

Le patron valide les deux écrans de la maquette 09 et demande à les voir dans
toutes les couleurs déjà employées, plus des chartes franchement colorées :
*« tu peux même rajouter plus que trois couleurs »*.

Seize chartes, deux écrans chacune, engendrés depuis un gabarit unique — les
neuf du nuancier, plus sept nouvelles. Ces sept-là portent **cinq** teintes au
lieu de trois : la cinquième, `--e-attente`, ne colore que les états qui
réclament un geste de lui. C'est la seule couleur de l'écran qui veuille dire
quelque chose ; sans cette règle, ajouter des teintes rend l'écran bavard —
exactement le défaut qu'il reproche aux tableaux de bord.

Un contrôle mesure, pour chacun des trente-deux écrans, que la barre du bas
tient dans le téléphone. La leçon du 9 août : c'est en lisant une BOÎTE, pas
en regardant une image, qu'on avait trouvé la barre de 425 px sur 393.

### Le premier écran de « Le calme × Aman », avec deux emprunts

Le patron reprend le premier des deux écrans de la maquette 05 et demande deux
choses précises : le **pied d'Aman** (un cheveu au-dessus, l'onglet actif
souligné de bronze, plus de plage sous le texte) et le **trait qui ferme
l'en-tête**, comme dans les maquettes « colonne ».

Sa phrase ne tranchait pas si ce trait vient seul ou avec le chapeau entier de
la colonne — « En cours » et le compte sur une même ligne. Les deux sont
proposés côte à côte plutôt que d'en deviner un : `docs/maquettes/09`.

### Les maquettes redeviennent des fichiers qu'on ouvre sans se connecter

Le patron clique l'artefact : on lui demande de se connecter, il ne voit rien.
Une adresse publiée n'est pas un fichier — et un visuel qu'il ne peut pas
ouvrir n'existe pas.

Les maquettes du dépôt étaient de simples fragments : ni doctype, ni
déclaration d'encodage. Ouvertes depuis un disque ou un téléphone, leurs
accents pouvaient tomber. Ce sont désormais des **documents complets**, qu'on
lui envoie directement. La forme « fragment », nécessaire à la publication en
artefact, n'est plus qu'une sortie du script : `--fragment`.

### L'application ne pouvait pas être bâtie — donc personne ne connaissait sa vitesse

Le patron, inquiet : *« l'application là, elle est super lente. Les
utilisateurs, ils ne voudront jamais utiliser une application aussi lente. »*
Ce qu'il mesurait, c'était `next dev`, qui compile chaque écran à l'ouverture.
Mais l'affirmer sans chiffre ne valait rien — et bâtir la version optimisée
s'est révélé **impossible**.

`next build` se déclare `NODE_ENV=production` et importe chaque module ;
`src/auth.ts` lit le secret de session dès l'import. Tous les refus de
`src/server/env.ts` tombaient donc **pendant la compilation** : bâtir exigeait
une clé d'IA facturée, un compartiment S3, un secret de tâche planifiée. Ni la
CI ni le banc ne les ont, et personne n'avait donc jamais bâti Atlas.

Ces refus protègent une application qui **sert** des clients, pas un
compilateur. Ils sont suspendus pendant la construction, et pendant elle seule
(`NEXT_PHASE`) — ce que `scripts/test-env.ts` éprouve dans les deux sens :
construction acceptée sans aucun secret, exécution et démarrage du serveur bâti
toujours refusés.

**La mesure, enfin possible** : démarrage en 212 ms, écrans entre 50 et 100 ms,
et surtout la première ouverture au même prix que la deuxième. Contre 38,7 s
pour un seul écran sur son banc.

### Un serveur mort que personne ne relevait, et des écrans compilés sous ses yeux

Deux pages d'erreur coup sur coup, deux causes différentes, aucune lenteur.

**« HTTP ERROR 504 »** : `next dev` compilait `/reglages/agenda` pendant qu'il
attendait, et le mandataire de GitHub abandonnait avant la fin.

**« HTTP ERROR 404 »** : sur cette adresse, cela veut dire « plus rien
n'écoute ». Le démarrage lançait le serveur une fois et une seule ; mort, il le
restait jusqu'à ce que le patron s'en aperçoive.

Trois pièces : un **veilleur** qui relance (deux conditions avant de le faire,
sinon deux serveurs se disputeraient le port), une **garde** qui empêche une
commande tapée par erreur d'en lancer un second, et un **préchauffage** qui
compile seize écrans au démarrage — pendant que personne ne regarde.

Le préchauffage fabrique sa session directement plutôt que de se connecter : le
limiteur autorise cinq tentatives par quart d'heure et par adresse IP, et
quelques redémarrages auraient **verrouillé le patron hors de son application**.
Jamais en production.

Mesuré : à froid, seize écrans prêts en 43 s ; serveur tué, relevé en 16 s ;
écrans entre 125 et 680 ms ensuite.

### Et deux défauts trouvés en jouant le démarrage pour de bon

Un banc de simulation, volontairement resté en arrière, a servi à parcourir le
chemin exact du patron. Il a montré ce qu'aucune relecture n'avait vu :

**L'`exec` de `demarrer.sh` effaçait ses propres constats.** Le script se
relance dans sa version neuve après une mise à jour ; le second passage
recalcule tout et trouve « à jour ». Conséquence : le démarrage annonçait
« Déjà à jour » juste après avoir mis à jour, et surtout **l'avertissement
« LA BASE N'A PAS SUIVI LE CODE » ne pouvait plus jamais s'afficher** — il ne
se déclenche qu'après une mise à jour. Le correctif du matin même était
mort-né.

**Le préchauffage prenait « le compte le plus ancien ».** Sur une base ayant
servi aux tests, ce n'est pas celui du banc : 2 écrans compilés sur 11, et un
bilan qui disait « 9 en échec » sans dire pourquoi. Le compte est choisi
nommément, et l'obstacle est nommé.

Le contrôle du premier point a d'abord été un **faux vert** : écrit avec
`indexOf`, il trouvait la ligne mise en commentaire. Corrigé, puis éprouvé
rouge sur les deux moitiés.

### Et la cause première du 404, trouvée en dernier

`npx next dev` n'est qu'une pile d'enveloppes : le processus qui écoute
vraiment se **renomme** `next-server`. Le `pkill -f "next dev"` du démarrage —
présent depuis le début — tuait donc les enveloppes et laissait le vrai serveur
orphelin, **accroché au port 3000**. Le suivant ne pouvait plus s'y attacher, et
l'orphelin servait un cache périmé : toutes les pages en 404, y compris la
santé, ce qui rendait le diagnostic incompréhensible.

Trouvée en regardant les processus de la machine, et reproduite sans le vouloir
en éprouvant le veilleur.

Le veilleur traite en outre le cas qu'il ne voyait pas : un serveur **présent
mais muet**, que `pgrep` trouvait — donc aucune relance, et une boucle qui
tournait pour rien. Il est maintenant délogé après deux tours.

### Une page d'état, parce qu'il travaille au téléphone

*« Va regarder toi-même, je peux pas te l'envoyer. »* Trois minutes devant un
écran qui ne s'ouvre pas, et la seule chose capable de dire pourquoi était un
terminal qu'il ne pouvait pas photographier. Je n'ai aucun accès à son espace :
l'information devait venir à lui.

`/api/health/banc` s'ouvre sans se connecter, en quelques millisecondes, et dit
la version exécutée, où en est le préchauffage, et ce qui bloque. En HTML et non
en JSON — sur un téléphone, du JSON se lit sur une ligne minuscule. Sans aucune
requête en base : elle sert quand tout est mort.

En l'éprouvant, deux défauts de plus. **PostgreSQL était arrêté** et le
démarrage annonçait « Préchauffage impossible : pas de session » — ce qui
envoyait chercher du côté des comptes, alors que la base ne répondait pas et
qu'aucun écran ne pouvait fonctionner. Et la page écrivait `**…**` en croyant
faire du gras : le patron aurait lu des astérisques. Les deux sont corrigés, et
tenus par des contrôles éprouvés rouges.

### Le retour de Google renvoyait le téléphone vers le téléphone

Trouvé pendant qu'il autorisait Atlas chez Google — donc après avoir franchi
tout le difficile. Le retour construisait son adresse depuis `NEXTAUTH_URL`,
`ATLAS_URL_PUBLIQUE`, puis `http://localhost:3000`. **Aucune de ces variables
n'est posée sur le banc** : le navigateur du téléphone était renvoyé vers
lui-même.

Le pire n'était pas la page morte : **le raccordement aboutissait**. Les jetons
étaient enregistrés, l'agenda relié pour de bon — et rien ne le lui disait. Il
aurait conclu à un échec devant une réussite.

L'adresse vient désormais de ce que le navigateur a demandé
(`x-forwarded-host`), les variables ne servant plus que de secours. Même famille
de défaut que l'origine des actions serveur : une valeur devinée côté serveur là
où seule la requête fait foi.

### Le banc cesse d'être un atelier : il sert une version bâtie

*« On arrête de tourner en rond, corrige-moi ça une bonne fois pour toutes. »*
Il avait raison : les 504, les 404, les 502, les ports en conflit et les 38,7
secondes par écran avaient **tous la même cause** — le banc faisait tourner
`next dev`, qui ne compile rien d'avance.

Mesuré sur la version bâtie : **36 à 80 ms par écran, au premier accès**, contre
38,7 s. Plus rien ne se compile à l'ouverture.

Ce qui l'empêchait : `next start` impose `NODE_ENV=production`, et la
configuration refuse alors l'IA simulée et le stockage local — les deux seules
choses qu'un banc ne peut pas avoir. D'où un profil **déclaré, jamais deviné**
(`ATLAS_PROFIL=banc`), qui relâche exactement ces deux points. AUTH_SECRET,
CRON_SECRET, Redis restent exigés ; l'isolation entre entreprises ne bouge pas
d'un cran. La suite éprouve les deux sens, y compris les valeurs approchantes.

**Un défaut trouvé par le seul contrôle capable de le voir** : en production,
Auth.js refuse l'hôte transmis par un mandataire (`UntrustedHost`) et l'artisan
lit « Une erreur ». Même famille que « Invalid Server Actions request. ».
`verifier:connexion` monte désormais `npm run banc` — la version bâtie — au lieu
du serveur de développement : éprouver autre chose que ce qu'on livre, c'est ne
rien éprouver.

### Le lancement passait en dernier — donc il ne passait pas

Le journal du patron s'arrêtait net sur « migrations : faites », et
`localhost:3000` ne répondait rien. L'application n'était ni lente ni cassée :
**elle n'avait jamais été lancée.** Deux heures de pages blanches, de 502 et de
404 — et j'ai cherché du côté du mandataire, du port, du navigateur, partout
sauf au bon endroit.

`demarrer.sh` mettait à jour, installait, migrait, se relançait, **puis**
lançait le serveur. Joué par `postStartCommand`, que l'environnement peut
interrompre : le lancement venant en dernier, il ne survivait pas.

Le veilleur est désormais posé **en premier**. Le serveur monte avec le code du
disque, et n'est remplacé qu'une fois la mise à jour terminée. Éprouvé en tuant
le démarrage à cinq secondes : le serveur est debout vingt-six secondes plus
tard, en version bâtie.

### L'écran Chantiers refait d'après sa maquette

Le patron envoie une capture d'un écran redessiné et demande une reproduction,
pas une interprétation. La charte gagne un **second accent, l'or**, avec un
partage clair : le vert pin porte ce qu'on FAIT, l'or ce qu'on LIT — et, sur les
cartes, l'or signale les états qui attendent un geste de lui.

Tout s'est joué sur des chiffres : filets d'1 px, accents de bord de 2 px,
rayons ramenés de 22 à 14 px, ombres de 6 % à 4 %, cartes de 150 px à 94 px.
Le sceau et la branche sont dessinés au trait — aucune image, aucune dépendance.

**Un défaut qu'aucune capture ne montrait :** la branche débordait à droite et
élargissait le document — la barre basse mesurait 425 px sur un écran de 393, et
la page glissait latéralement. Trouvé en demandant au navigateur la BOÎTE de la
barre. Le script de capture l'imprime désormais à chaque passage.


### Une base restée en arrière, et rien pour le dire

Le patron met à jour son banc, lit « Mise à jour récupérée », ouvre le
Planning — l'écran tombe. Rien ne relie les deux.

**La cause était là depuis le début.** Les migrations du banc tournaient sous
`atlas_app`, le rôle applicatif, qui n'a délibérément aucun droit de créer une
table. Elles échouaient donc à chaque fois sur « permission denied for schema
public »… **et l'échec était avalé aux deux endroits qui les lancent**. Le code
neuf arrivait, la base restait vieille, et l'écran annonçait un succès.

La règle était pourtant écrite noir sur blanc dans `CLAUDE.md` §5, pour les
essais locaux. Le banc ne la suivait pas.

Désormais : un seul script, le rôle propriétaire, et **l'échec se voit** — au
démarrage de l'espace comme sur l'écran de mise à jour, qui écrit maintenant
« LA BASE N'A PAS SUIVI » plutôt que « récupérée ».

**Le message a dû être repris deux fois.** Le premier jet rendait
« échec : routine: 'aclcheck_error' » — le nom d'une fonction interne de
PostgreSQL, qui envoie chercher n'importe où. La vraie phrase se trouvait douze
lignes plus haut : c'est la première ligne parlante qu'il faut, pas la dernière.

Et un contrôle existant est passé au rouge en chemin, sans qu'aucune régression
n'ait eu lieu : il repérait la migration par une chaîne que le correctif
supprime. C'est le bon comportement — un repère qui disparaît doit faire du
bruit.


### L'agenda dit AUSSI ce qu'il y a, et les identifiants se collent dans l'appli

*« Si, il doit lire les intitulés aussi ! »* et *« dans planning il faut un
petit bouton connecter son agenda Google cliquable pour rentrer ses
identifiants. »*

**Les intitulés.** J'avais restreint la permission aux seuls créneaux occupés,
en me disant qu'une permission qu'on ne demande pas est une fuite qui ne peut
pas arriver. Le raisonnement tenait, mais il répondait à une question que
personne n'avait posée : une case grise apprend qu'on est pris, pas *pourquoi*
— et c'est ce pourquoi qui sert à décider. Le planning affiche désormais
« Élagage chez Mme Roux » et « Dentiste », avec leurs horaires.

**Ce qui n'a pas bougé, et qui ne bougera pas :** le client ne reçoit que des
dates. Ce n'est pas votre vie privée qui est en cause là, c'est celle de vos
autres clients.

**Les identifiants.** Ils s'attendaient jusqu'ici dans la configuration du
serveur — autrement dit, vous faisiez votre part chez Google et restiez bloqué
faute de pouvoir les poser. Trois cases dans l'écran « Mon agenda », et vous
n'avez plus besoin de personne. Le secret est masqué à la frappe, chiffré en
base, et vous pouvez le laisser vide pour corriger une adresse : Google ne le
remontre jamais, exiger de le ressaisir serait une impasse.

**Et le bouton est dans le Planning**, là où le manque se constate — pas au fond
des réglages. Il disparaît quand tout va bien : un bandeau permanent sur
l'écran le plus consulté devient du décor, et le jour où il annonce une panne,
personne ne le lit.


### La note vocale comprend un numéro sans qu'on l'annonce

*« Lorsque je remplis avec la note vocale, si je ne dis pas "numéro de téléphone
0670…", il ne comprend pas que c'est un numéro de téléphone. Pareil pour le
mail. Il faut qu'il capte même si je ne précise pas. »*

**Le défaut n'était pas là où il semblait.** L'annonce n'a jamais été exigée : le
vrai problème est que le service de transcription écrit parfois les chiffres
**en toutes lettres** — « zéro six douze trente-quatre cinquante-six
soixante-dix-huit » — et qu'aucune recherche de chiffres ne pouvait y voir un
numéro. Quand il annonçait, le modèle de langue rattrapait ; sans l'annonce,
plus rien ne rattrapait. Les mots-nombres sont maintenant rendus en chiffres
avant toute reconnaissance, quelle que soit la façon dont la transcription
découpe — avec traits d'union ou sans.

**Et deux défauts trouvés en cherchant le sien, tous deux du même genre : un
champ faux mais crédible, que personne ne relit.**

« 0033 6 12 34 56 78 » donnait **0336123456** — dix chiffres, l'air d'un numéro,
et pas celui du client. Le devis serait parti chez quelqu'un d'autre. Et
« florian tiret martins arobase gmail point com » donnait
**martins@gmail.com** : le prénom disparaissait en silence. Le tiret et le
souligné dictés sont désormais reconnus, sous leurs différents noms.

Un champ vide se voit et se corrige. Un champ faux et vraisemblable part avec le
devis.


### Relier son agenda Google, ou non — au choix de chaque artisan

*« Ce qui serait bien, c'est que l'utilisateur puisse, s'il le souhaite ou non,
connecter son planning à son agenda Google. »*

Jusqu'ici, Atlas ne connaissait que les chantiers qu'on lui avait dits. Un
rendez-vous noté ailleurs était **invisible** : il proposait ce jour-là, le
client le choisissait, et le doublon se découvrait le matin même — devis parti,
date acceptée, promesse faite. C'était le seul endroit du parcours où Atlas
engageait quelqu'un sur une information qu'il n'avait pas ; partout ailleurs,
quand il ne sait pas, il s'arrête et demande.

Un écran « Mon agenda » apparaît dans les réglages. **Celui qui ne relie rien
garde exactement l'Atlas d'avant** : pas de compte à créer, pas d'appel réseau,
rien qui change. C'est la moitié de la demande, et c'est la moitié qui se
respecte dans le code plutôt que dans une intention.

Ce qu'Atlas lit, quand un agenda est relié : **les créneaux occupés, et rien
d'autre**. Jamais le titre d'un rendez-vous, jamais les participants — la
permission demandée à Google ne le permet même pas, ce qui vaut mieux qu'une
promesse. Rien n'est stocké non plus : Atlas interroge au moment où il en a
besoin. Les jetons, eux, sont chiffrés en base et ne partent pas dans l'export
téléchargeable.

Et **la panne se voit**. Si la lecture cesse de fonctionner — accès révoqué,
quota —, Atlas revient à son comportement d'avant sans interrompre le parcours,
mais l'écran le dit. Un raccordement mort en silence est pire que pas de
raccordement : on se croit protégé du doublon et on ne l'est plus.

**Il manque une chose, et elle ne dépend pas de moi** : les identifiants Google
de l'application, qui se créent depuis un compte Google et engagent
l'acceptation de conditions. Tant qu'ils n'existent pas, l'écran l'annonce et ne
propose aucun bouton qui mènerait à une erreur (`docs/A-FAIRE.md` §7).

**Deux défauts trouvés en regardant l'écran, pas en lisant un test vert.** Un
module de Server Actions ne peut exporter que des fonctions : y avoir ajouté une
constante a fait perdre au fichier *tous* ses exports, types et lint verts. Et
le titre de l'écran annonçait « Atlas tient compte de votre agenda » trois
lignes au-dessus de « Atlas n'arrive plus à lire votre agenda » — le cas de
panne était traité après le cas nominal. Le titre est désormais une fonction
pure, et l'ordre des cas est tenu par un contrôle.


### Un vrai devis dément une définition écrite la veille — et le budget se mesure

Deux documents de plus du même confrère, une facture de débroussaillage et un
devis de frêne. Ils corrigent Atlas sur trois points, et **le premier est une
erreur que j'avais introduite la veille** : le vocabulaire affirmait que le gros
bois se débite « en 40 ou 50 cm ». Le devis du frêne dit **33**. Deux exemples
avaient suffi à me faire écrire une liste fermée — c'est exactement ce que le
dépôt s'interdit. Il n'y a pas de valeur par défaut, et la définition le dit
maintenant.

Les deux autres apports viennent des documents eux-mêmes : le bois a une
**destination** (« ramené sur l'arrière du jardin », « en tas rangé le long de
la haie ») et le portage se paie ; le débroussaillage a **deux machines**, et
c'est l'accessibilité du terrain qui décide du prix. Une règle de plus s'y
ajoute, écrite par le confrère sur un document qui part chez un client : *«
Hauteur du tronc à définir ensemble au moment de l'abattage »* — ce qui reste à
décider s'écrit sur le devis, au lieu d'être inventé ou tu.

**Et la consigne dépassait son budget.** Deux défauts, trouvés en mesurant :
le titre de chaque bloc était déduit *après* coup, si bien que trois blocs
faisaient dépasser de trois titres (6 020 pour 6 000) ; et le plafond lui-même,
posé à vide quand le vocabulaire tenait en dix termes, écartait désormais
**douze termes sur vingt-sept**. Ajouter du vocabulaire dont la moitié ne part
jamais, c'est faire semblant de l'ajouter. Le plafond passe à 9 000 — la
consigne générique qu'il vient corriger en fait déjà 7 300 à elle seule. Tout
part maintenant : 27 termes sur 27, 5 corrections sur 5.

Le contrôle qui affirmait que le budget était tenu était vert, **et pour une
mauvaise raison** : son scénario à deux cents termes épuisait tout dès le
premier bloc, si bien que les en-têtes suivants n'existaient pas. Un scénario
extrême cachait le cas ordinaire.


### Les grumes se facturent à la tonne

*« À la tonne »* — sa réponse à la question laissée ouverte la veille. La
réserve écrite à l'écran aura tenu moins de vingt-quatre heures, et c'est
exactement ce à quoi elle servait : posée dans un commentaire, elle aurait dormi
jusqu'à ce qu'un devis sorte faux.

Atlas lit désormais le tonnage dans la dictée — « 8 tonnes », « 3 t », « trois
tonnes » — et multiplie par son prix. Sans tonnage, il ne chiffre rien et dit ce
qui manque, plutôt qu'un chiffre qui aurait l'air d'un prix. Ce qu'il apprend
d'un devis se range **au poids**, jamais au montant de la ligne : c'est le piège
de la haie, en plus coûteux.

**L'ancien prix au forfait est effacé, pas converti.** 300 € pour un enlèvement
n'est pas 300 € la tonne, et on ne sait pas combien pesait le chantier qui a
produit ce forfait — il n'existe aucune conversion honnête. Une case vide est
une question posée ; une case fausse est un devis faux.

### Douze mois de jours pris sur son calendrier, trois pour son client

Sa réponse à la réserve posée la veille : *« tu peux aller jusqu'à douze mois
d'occupation. »* Son calendrier barre désormais ses journées complètes sur un
an — avant, au-delà de trois mois, un jour déjà pris s'affichait libre et le
serveur ne le refusait qu'après coup, au moment précis où il venait de le
choisir.

**Ce que voit son client n'a pas bougé**, et c'est le point à ne pas confondre :
deux nombres, deux personnes. Ce qui rend l'élargissement sûr n'est pas la
vigilance mais la séparation des chemins — la liste du patron et celle du client
sont calculées séparément et ne se rejoignent nulle part. Vérifié en mutant
l'une pour constater que l'autre ne bouge pas, plutôt qu'en le supposant.

La borne des douze mois est elle-même tenue par un contrôle : au-delà, c'est le
serveur qui tranche, et l'élargir en silence coûterait une requête plus lourde à
chaque ouverture d'écran.

### Un calendrier des deux côtés, où les jours pris ne se touchent pas

Sa demande : *« passe au calendrier pour le choix des dates à proposer au
client, mais également qu'il ait accès au calendrier pour pouvoir proposer une
date, avec un système pour qu'il n'ait pas accès aux dates déjà prises par un
autre client. »*

Les deux écrans employaient le sélecteur du téléphone. Il sait borner une
fenêtre — **il ne sait pas griser un jour au milieu**. Le client choisissait donc
un mardi déjà pris et ne l'apprenait qu'après coup, par un refus. Ce n'est pas
un détail d'affichage : un client qui bute sur un refus rappelle, ou renonce.

Le même composant sert les deux écrans, délibérément : deux calendriers écrits
séparément finiraient par ne pas griser les mêmes jours, et l'écart se verrait
chez le client. Il ne décide de rien — la grille, l'état d'un jour et la règle
« une ou deux dates » sont des fonctions pures, éprouvées sans navigateur.

**Un jour hors de la fenêtre du client ne lui dit jamais qu'il est « déjà
pris »** : lui apprendre qu'un jour de l'an prochain est occupé lui apprendrait
quelque chose du planning du patron, et sa page ne reçoit que des dates.

Côté patron, l'horizon va à dix-huit mois mais les jours occupés ne sont chargés
que sur la fenêtre proche : au-delà, c'est le serveur qui tranche, comme avant.
Le calendrier propose, il ne décide pas. Détail dans `ARCHITECTURE.md` §36.

Les deux contrôles navigateur regardaient `min` et `max` du champ natif —
la mauvaise question, puisqu'un champ bien borné laissait quand même choisir un
jour pris. Ils regardent maintenant ce que la personne peut toucher.

---

## 2026-08-08

### La souche et les grumes se détachent — l'évacuation non

Sa réponse à la question laissée ouverte la veille : *« le dessouchage oui, et
les grumes aussi »*. **Deux sur trois, et le troisième compte autant** :
l'évacuation seule reste avec l'abattage et le broyage, comme sur son devis du
5 août. Un contrôle tient les deux sens, parce qu'un jour quelqu'un trouvera
« logique » de détacher l'évacuation aussi.

La différence n'est pas de vocabulaire : une grume a de la valeur, le client
peut vouloir la garder ou la vendre. Les branches broyées, non.

Cinq grilles désormais, et trois formes : deux axes pour l'abattage et le
fendage, **un seul axe pour le dessouchage** (le diamètre de la souche — la
hauteur de l'arbre qui n'est plus là ne décide de rien), une case unique pour la
haie et les grumes. 82 cases au total.

**Une réserve, dite à l'écran et pas seulement dans le code :** il n'a pas
précisé à quoi se chiffrent les grumes — au mètre cube, à la tonne, au voyage.
Une case unique retient donc ce qu'il facture, et l'écran l'invite à trancher.
Inventer un axe aurait été inventer sa décision. Détail dans `ARCHITECTURE.md`
§35.

Deux détails qui ont failli passer : « enlèvement des grumes et dessouchage »
est une seule prestation que deux règles reconnaissent — sans ordre explicite
elle se serait facturée deux fois ; et « 40 à 50 cm » désigne maintenant deux
champs à l'écran, si bien que le nom accessible porte désormais la grille
entière.

### Le client ne pouvait ni voir sa facture ni télécharger son devis

**Le défaut le plus grave de la journée, et il a été trouvé par accident.** Une
suite navigateur a échoué parce que je l'avais lancée contre un serveur démarré
sous le rôle applicatif au lieu du rôle de test. L'erreur de manipulation a mis
au jour ce qu'aucun contrôle ne pouvait voir.

En production, le lien de facture envoyé au client répondait **« ce lien n'est
plus valable »** sur une facture parfaitement valide. Et le PDF du devis — le
document que son client lit — échouait de la même façon. La branche « envoi de
la facture » qu'il demandait ce jour-là était donc morte avant même d'être
atteinte.

La cause : `envois_devis` et `envois_factures` portent une politique de lecture
par jeton, `devis` et `factures` n'en portent pas. Retrouver l'envoi marchait,
lire le document derrière ne marchait pas. Le correctif pose le contexte
d'entreprise **déduit du jeton** — ce que la page du devis faisait déjà — sans
affaiblir l'isolation : l'entreprise vient de l'envoi, jamais du client.

**Ce qu'il faut en retenir dépasse le défaut.** Les suites navigateur démarrent
leur serveur sous un rôle qui **traverse la RLS**, parce qu'elles inspectent la
base. Elles ne peuvent donc pas, par construction, voir un défaut d'isolation —
et `test-facture-au-client-e2e.ts` parcourait ce chemin exact, vert depuis le
6 août. Tout chemin public par jeton doit désormais être éprouvé par une suite
base, sous le rôle applicatif : `scripts/test-facture-jeton-rls.ts`.
Détail dans `ARCHITECTURE.md` §34.

### Du planning à la facture, sans détour

Le patron : *« le client m'avait retourné la date validée, il se range dans les
chantiers planifiés, mais comment moi je fais pour avoir accès au devis ? Toute
cette branche-là n'est pas faite. »*

**La chaîne était construite — et injoignable depuis là où il se trouvait.**
Facture depuis le devis, arrêt 3, émission, relevé de TVA, message tout prêt :
tout existait. Mais sur le planning, toucher un chantier planifié n'ouvrait
qu'un sélecteur de date. Une chaîne qu'on ne peut pas atteindre vaut une chaîne
qu'on n'a pas écrite ; répondre « c'est déjà fait » aurait été exact et inutile.

La carte du planning mène désormais **au chantier**, porte un bouton **Fin de
chantier**, et garde le changement de date sur un lien discret.

**Deux défauts trouvés en reproduisant son écran**, tous deux issus de la même
cause : la règle de rangement était écrite trois fois. Le planning comparait
`< aujourd'hui` en TypeScript, le dépôt des terminés `<= aujourd'hui` en SQL.

- Un chantier prévu **aujourd'hui** figurait dans **deux onglets** — le défaut
  qu'il avait signalé le 6 août, revenu par la porte du signe.
- Un chantier **clôturé avant sa date** restait au planning comme si de rien
  n'était, absent des terminés, **sa facture en brouillon joignable seulement
  par son adresse**. Or clôturer plus tôt que prévu est autorisé à dessein
  depuis le 3 août.

Un seul cœur désormais, deux portes selon la donnée disponible, et le filtre du
planning **sorti du composant** — c'est le vrai correctif : tant qu'il vivait
dans l'écran, aucun contrôle ne pouvait constater qu'il contredisait la règle.
Détail dans `ARCHITECTURE.md` §33.

**Et un troisième défaut, vu sur une capture.** À l'arrêt 3, les travaux réunis
d'une même ligne s'affichaient « Abattage d'un chêne mort Br… ». La coupe venait
d'un `truncate` : le texte entier restait dans la page, donc **toute assertion
sur le contenu passait**. L'écran qui sert à vérifier avant que la facture parte
en cachait les deux tiers. Le contrôle mesure maintenant la hauteur rendue.

Le contrôle `test-planning-e2e.ts` a rougi, à juste titre : il verrouillait
l'ancien comportement de la carte. Corrigé dans le bon sens, et rendu rejouable
au passage — il visait « text=DÉC » globalement et échouait sur son propre passé
au deuxième passage.

### La facturation électronique : écrire ce qui était déjà décidé

Le patron a demandé : *« qu'est-ce que tu dois faire sur la plateforme de
facturation ? »* La réponse existait dans le dépôt — `docs/AGENT.md` §6, actée
le 31 juillet — mais **elle n'était écrite nulle part dans son langage**, et
c'est exactement le cas que `docs/QUESTIONS.md` sert à couvrir : une décision
expliquée une fois puis oubliée se repose trois mois plus tard.

Ce qui ne se rouvre pas : **Atlas prépare les factures, il ne les émet pas au
sens légal.** Ce qui reste ouvert : sur quel outil comptable se brancher — il
n'en a aucun à ce jour.

Deux points qu'il ne faut pas confondre, et qui sont désormais distingués noir
sur blanc : la conformité d'Atlas comme produit vendu à des artisans, et
l'obligation qui pèse sur **Eden Nature elle-même**, qu'Atlas existe ou non.
Les échéances annoncées — septembre 2026 pour la réception, septembre 2027 pour
l'émission des petites entreprises — sont écrites **avec leur réserve** : ce
calendrier a déjà été décalé deux fois et l'environnement de l'agent ne peut pas
le vérifier, son mandataire refusant les sites publics. À faire confirmer par un
comptable.

`docs/QUESTIONS.md` question 11 et `docs/A-FAIRE.md` point 6, ajoutés avec son
accord explicite. Rien à coder sur la facturation avant que l'outil soit
choisi.

**Au passage, un défaut vu sur une capture et pas par un contrôle :** les quatre
pages consultables affichaient leurs astérisques — `*« … »*` au lieu de
l'italique. Or dans ces documents l'italique porte **les paroles du patron**,
citées mot pour mot : une vingtaine de citations défigurées sur les pages qu'il
lit le plus. `scripts/md-en-page.mjs` connaît maintenant l'italique, après le
gras et jamais avant — l'inverse ferait de `**mot**` un italique contenant un
astérisque.

### Trois grilles de prix, et le devis du 5 août enfin juste

Le patron a répondu à trois questions posées avec leurs options : **on garde les
8 × 6 tranches** de la grille de fendage, **la haie prend sa propre ligne** avec
un prix au mètre linéaire, et **l'abattage a sa grille**, à la technique × le
diamètre.

Son devis de référence du 5 août — haie 350 €, abattage 600 €, fendage 300 €,
total 1 250 € — sort désormais **exactement comme il l'avait écrit**. Il en
comptait deux lignes le matin même.

**La bascule qui va avec, et qu'il faut connaître :** dès que la ligne
principale a un prix dans sa grille, Atlas cesse de chiffrer à la journée et
compte **poste par poste**. Le total devient la somme des grilles, et l'écran le
dit — un total qui change de méthode sans un mot se lit comme une erreur. Tant
que la grille d'abattage est vide, rien ne change, et en silence.

**La haie s'apprend au mètre, jamais au montant.** 350 € sur une haie de 20 ml
range 17,50 €/ml dans la grille. Retenir 350 € ferait facturer 350 € la haie
suivante, quelle que soit sa longueur. Sans longueur connue, on n'apprend rien
plutôt qu'un prix faux.

L'écran s'appelle maintenant `Réglages → Mes prix : abattre, fendre, tailler`.

Détail des choix dans `ARCHITECTURE.md` §32.

### Déposer sa liste de prix, au lieu de la retaper

Le patron : *« si l'utilisateur a déjà un fichier Excel ou un PDF avec ces
lignes de prix, il doit pouvoir le rentrer dans les réglages via une touche, et
que les prix s'ajoutent automatiquement. »*

`Réglages → J'ai déjà mes prix ailleurs → Choisir un fichier`. Atlas y lit les
désignations, les prix et les unités, et **montre ce qu'il ferait avant de le
faire** : ce qui s'ajoute, ce qui change — l'ancien prix barré à côté du nouveau
—, et ce qu'il n'a pas compris, ligne par ligne. Rien n'est enregistré avant
son appui.

**Ce n'est pas de la prudence de principe.** Ces tarifs commandent le prix de
ses devis. Un fichier mal lu écraserait sa grille sans qu'il l'ait vu passer, et
il ne s'en apercevrait que sur un devis déjà parti.

**Rien n'est deviné.** Une ligne de titre (« ABATTAGE »), un « sur devis », une
ligne sans désignation : écartées et signalées, jamais complétées par zéro — un
tarif à 0 € se proposerait ensuite comme « gratuit ». Un même intitulé deux fois
ne crée pas deux tarifs concurrents.

Lu sans aucune bibliothèque, comme l'archive de la sauvegarde : un `.xlsx` est
un ZIP de deux fichiers XML. Au passage, sept pièges de vraies feuilles ont été
traités — le BOM d'Excel, le point-virgule français, un vieux CSV en Latin-1,
un texte coupé en deux par Excel, une cellule vide qui décale les colonnes, une
colonne de numéros d'article prise pour les prix.

**Le PDF est refusé, et le refus dit quoi faire.** Un PDF n'est pas un tableau,
c'est une image de tableau : les colonnes n'y existent plus. Le message donne la
sortie — « Ouvrez la liste dans Excel puis Enregistrer sous → CSV ». Voir
`TODO.md` §0 sexies.

Détail des choix dans `ARCHITECTURE.md` §31.

### Proposer une date dans six mois — ce n'était pas possible

Le patron, en le voyant venir avant que ça ne lui coûte : *« la proposition des
dates au client, on a une visibilité que sur une semaine. Comment je fais si je
dois lui proposer une date dans six mois ? C'est un problème qui va se produire
à coup sûr. »*

L'écran suggérait les six prochains jours ouvrés, et **aucune autre porte
n'existait**. Il peut désormais choisir n'importe quelle date **jusqu'à
dix-huit mois** — l'élagage est saisonnier, une haie « à la fin de l'hiver
prochain », c'est quatorze mois. L'écran répond tout de suite : retenue, ou
pourquoi non, avec le jour libre le plus proche à portée de pouce.

**Ce que son client voit, lui, ne s'ouvre pas d'autant.** La page publique
reçoit la liste des jours occupés : lui donner dix-huit mois reviendrait à lui
donner le carnet de commandes. Elle montre donc trois semaines autour de la date
proposée — assez pour « plutôt la semaine d'après », pas assez pour lire le
planning. Sur « soit jeudi, soit à la Toussaint », les deux dates restent
retenables et **le semestre du milieu reste invisible**.

**Trois barrières se dressaient sur ce chemin**, et la troisième était la plus
chère : la revérification de la réponse. Elle se faisait contre une fenêtre
glissante de trois mois — le client aurait lu « date indisponible » **en
acceptant la date que le patron venait de lui proposer**, et le devis se serait
perdu là.

**Et un défaut latent que personne n'avait signalé :** la fenêtre était
recalculée à chaque ouverture du lien, depuis la date du jour. Un devis parti un
lundi et ouvert trois semaines plus tard n'offrait plus les mêmes jours. Elle
s'ancre maintenant au jour de l'envoi.

Dernier détail, qui n'en est pas un : **l'année s'affiche** quand la date n'est
pas dans l'année en cours. « Lundi 8 février » ne veut plus rien dire quand on
peut proposer à dix-huit mois.

Détail des choix dans `ARCHITECTURE.md` §30.

### Le devis se sépare en lignes vendables, et la fente a son prix

Le patron, pour la troisième fois en deux jours : *« l'agent ne comprend
toujours pas qu'il faut séparer les tâches. Tout ce que je dicte arrive sur la
même ligne du devis. »* Puis, apprenant qu'on l'avait diagnostiqué la veille sans
le corriger : *« on avait déjà travaillé sur ce défaut-là hier et je croyais que
tu l'avais corrigé. »* Il avait raison.

Le défaut tenait en une ligne — `join(" ; ")` — à deux endroits du chiffrage.

**Ce qui change sur son devis :**

- l'abattage, le broyage et l'évacuation sont réunis sur **une** ligne ;
- la fente du bois fait la **sienne**, parce que le client peut la refuser ou la
  confier à un autre ;
- **plus aucun point-virgule** : les travaux réunis s'empilent, un par ligne ;
- le billonnage (« on le coupe en 50 ») ne fait plus de ligne quand un abattage
  l'accompagne — il est compris dedans, comme il l'avait dit le 5 août. Ce qui
  est ainsi fondu est **signalé**, jamais escamoté.

Et la raison, dans ses mots, qui ne se devine pas : *« si le client ne veut pas
la fente, il va trouver le reste cher ; et s'il fait faire le reste par un autre
artisan et qu'il nous prend juste pour la fente, 100 € ce n'est pas assez
cher. »* D'où **850 + 250** au lieu de 1 000 + 100, à total égal.

### Une grille de prix pour la fente : hauteur × diamètre, 48 cases

*« Pour la fente, ils devraient demander la hauteur de l'arbre et son diamètre,
et on crée une liste de prix en fonction de la hauteur et du diamètre, comme ça
il n'invente rien. »* Puis, sur une première grille à 3 × 3 : *« par contre il
faut faire plus de tranche. »* Elle en compte donc **8 diamètres × 6 hauteurs**.

**Elle naît vide, et c'est le point entier.** Aucun prix n'est semé par le
dépôt, et aucune case ne se devine depuis ses voisines : une case vide est une
question posée, la ligne s'écrit à 0 € — visible comme un prix à poser — et
l'écran nomme la case qui manque.

**Elle se remplit toute seule.** Chaque prix de fente écrit sur un vrai devis
vient se ranger dans la bonne case. C'est son idée : *« le mieux, c'est que je
fasse plein de devis et que tu enregistres toutes mes modifications, et dans un
mois tu sauras les remplir tout seul. »* Il peut aussi poser un prix à l'avance,
dans `Réglages → Mes prix pour fendre le bois` — et une observation n'écrase
jamais une décision qu'il a prise lui-même.

Ses prix restent **les siens** : la grille est isolée par entreprise, à la
différence du vocabulaire du métier, qui part avec l'application
(`docs/QUESTIONS.md` §10).

### Deux défauts trouvés en construisant, et qui n'auraient rien dit

- **Une seconde écriture de la proposition au détail** dormait dans le code,
  exportée et appelée par personne. Elle ignorait le contrôle de doublon. Elle a
  été supprimée plutôt que mise à jour une fois de plus.
- **Le contrôle d'exhaustivité de l'export a fait son travail** : la nouvelle
  table portant une entreprise manquait dans la sauvegarde du patron. Sans lui,
  il aurait emporté ses données en y laissant ses prix de fendage.

### La batterie de tests ne finissait pas — et rien ne le disait

Trouvé en voulant simplement jouer `npm test` avant de livrer.

`test-ia-03-propositions.ts` affichait **« 8 test(s) réussi(s), 0 échoué(s) »**
puis restait là, pour toujours. La batterie s'arrêtait à cette suite, sans un
mot, et les cinquante suivantes n'étaient jamais jouées. Aucun test n'échouait :
c'est le pire des états, parce qu'une batterie qui ne finit pas ne dit pas
« rouge » — elle ne dit plus rien, et on croit vert ce qu'on n'a pas regardé.

**La cause :** le limiteur de débit ouvre une connexion Redis dès qu'une action
protégée est traversée, et personne ne la fermait. Le processus ne pouvait pas
s'arrêter.

**Pourquoi ça ne s'est jamais vu en CI :** l'étape `npm test` de la CI ne posait
pas `REDIS_URL` — alors que `CLAUDE.md` §5 la demande pour jouer la batterie en
local. La CI ne jouait donc pas ce que le dépôt dit de jouer, et l'écart cachait
le défaut. Les deux se jouent désormais dans les mêmes conditions.

**Trois corrections, pas une :**

1. `fermerLimiteur()` ferme la connexion, appelée en fin des neuf suites qui
   traversent une action limitée ;
2. la CI pose `REDIS_URL` sur `npm test` ;
3. le lanceur **tue toute suite qui n'a pas rendu la main en huit minutes**, avec
   un message qui désigne le bon coupable — « ses tests ont peut-être tous
   réussi ; c'est le processus qui ne s'arrête pas ». Éprouvé contre une suite
   volontairement bloquée : il la voit, et il ne se déclenche pas sur une suite
   saine.

**Et un quatrième, de la même famille :** `test-adresse-suggestions-e2e`
échouait en batterie et passait seule. Elle est la première dans l'ordre
alphabétique et attendait la toute première compilation des écrans — son message
accusait l'adresse, qui n'y était pour rien. Le lanceur préchauffe désormais les
écrans avant de commencer.

Détail des choix dans `ARCHITECTURE.md` §29.

---

## 2026-08-07

### L'adresse se propose pendant la frappe, et se choisit d'un doigt

Le patron : *« comme quand on passe une commande — on commence à taper
l'adresse et il nous propose tout un tas de listes, et plus on écrit, plus
l'adresse se réduit ; ensuite il n'y a plus qu'à cliquer sur notre adresse et ça
la valide. »*

**La source est la Base Adresse Nationale, pas celle de Google** — et ce choix
n'est pas technique. Google aurait demandé un compte de facturation, une clé, et
serait devenu un **sous-traitant de plus** à nommer dans les documents du
patron : exactement le contrat qui le bloque aujourd'hui (`docs/A-FAIRE.md`
point 2). Le service de l'État est public, français, sans compte ni clé.

**Ce qui part, et ce qui ne part pas.** Uniquement la rue en cours de frappe :
ni le nom du client, ni le chantier, rien qui permette de rattacher l'adresse à
quelqu'un. Un contrôle vérifie qu'aucun autre paramètre ne s'y ajoute — sans
lui, cette phrase serait rassurante plutôt que vraie.

**La requête part du serveur d'Atlas, jamais du navigateur.** La politique de
sécurité interdit à un écran de joindre un hôte extérieur, et c'est ce qui
garantit qu'aucun écran ne peut envoyer quoi que ce soit ailleurs sans qu'on
l'ait décidé. Un seul endroit à lire, à limiter et à couper.

**Le champ reste libre.** Un lieu-dit, un chemin de campagne, « derrière la
scierie » ne figurent dans aucune base — et c'est là qu'il travaille. Une liste
qui enfermerait le patron dans ce que la base connaît serait une régression.
De même, une panne du service laisse un champ ordinaire : le chantier se crée
quand même.

Trois contrôles, chacun sur ce qu'il peut réellement éprouver :
`test-suggestions-adresse.ts` (réponses illisibles, doublons, longueur minimale),
`test-recherche-adresse.ts` (service en panne, injoignable, muet — sur un vrai
service monté pour l'occasion), `test-adresse-suggestions-e2e.ts` (le geste
entier dans un navigateur). Et le **vrai** service est interrogé par une machine
qui peut le joindre : `.github/workflows/adresses.yml`, le mandataire réseau de
l'environnement de développement refusant `api-adresse.data.gouv.fr`.

Un détail vu sur une capture, jamais par un test : la bulle de l'assistant
recouvrait la troisième proposition, et le doigt touchait la bulle au lieu de
l'adresse.

### La sauvegarde arrive sous son nom, y compris sur un iPhone

Le patron touche « Télécharger mes données » depuis son téléphone, et Safari lui
propose un fichier nommé **`reglages`**, sans extension — le nom de la page. Il
arrive dans Fichiers illisible, donc inouvrable. **Une sauvegarde qui ne s'ouvre
pas ne sauvegarde rien**, et c'est la condition qu'il avait posée lui-même avant
de nourrir la mémoire de l'agent.

L'archive était pourtant complète et l'en-tête `Content-Disposition` correct :
un attribut `download` **vide** laisse Safari se rabattre sur le document
courant. Chrome, lui, lit l'en-tête — d'où un contrôle au vert sur un lien
pourtant muet. Contrôler l'un ne contrôlait pas l'autre.

Le nom est désormais porté par le lien **et** par l'en-tête, calculés par une
seule fonction (`src/lib/nom-sauvegarde.ts`) : deux implémentations finiraient
par diverger, et un fichier qui ne porte pas le nom annoncé est pire qu'un
fichier sans nom.

`scripts/test-mes-donnees-e2e.ts` lit maintenant l'attribut du lien lui-même.
Lien remis muet, il repasse au rouge : « Le lien annonce «  » : sur iPhone, la
sauvegarde arrivera sous le nom de la page, sans extension, et ne s'ouvrira
pas. »

### Le bouton de mise à jour n'accuse plus à tort, et son issue survit

**« La mise à jour n'a pas abouti. Redémarrez l'espace de travail. »** Le patron
a lu cette phrase, et elle désignait le mauvais coupable. Tirer le code neuf
remplace des centaines de fichiers **sous le serveur en train de tourner** :
celui-ci se recompile aussitôt, et la réponse en cours de route est coupée. Le
navigateur ne reçoit donc rien — **y compris quand la mise à jour a parfaitement
réussi**. Il est reparti redémarrer un espace qui n'en avait aucun besoin.

Trois changements, qui tiennent ensemble :

1. **L'issue est déposée dans un fichier** (`/tmp/atlas-mise-a-jour.txt`) avant
   que quoi que ce soit puisse couper la connexion, et l'écran la relit au rendu
   suivant. C'est elle qui donne la **raison** d'un refus — « des modifications
   non enregistrées sont présentes » n'appelle pas le même geste qu'« historique
   divergent », et personne ne peut la deviner.
2. **L'écran se rafraîchit tout seul** après l'appui. La ligne Version étant
   désormais lue dans le dépôt servi, elle répond d'elle-même à la seule question
   qui compte, sans qu'il faille recharger.
3. **Le message d'échec ne prétend plus savoir.** Il désigne l'endroit qui, lui,
   ne peut pas se tromper : « regardez la ligne Version juste au-dessus ».

Le journal vit dans `/tmp`, **jamais dans le dépôt** : un fichier déposé à la
racine rendrait l'arbre git sale, et `mettre-a-jour.sh` refuserait alors *toutes*
les mises à jour suivantes. Le remède aurait créé la panne, définitivement.
`scripts/test-issue-mise-a-jour.ts` le démontre sur un vrai dépôt git plutôt que
de le promettre.

### La version affichée vient du dépôt servi, plus d'une variable

Le 7 août au matin, sur un espace de travail **tout neuf**, l'écran Réglages
annonçait : « Version : inconnue — cette installation n'annonce pas sa version ».
L'écran ne pouvait donc plus répondre à la seule question que le patron sache
poser depuis un téléphone : *est-ce que j'ai les corrections ?*

La version venait de `ATLAS_VERSION`, posée par `.devcontainer/demarrer.sh` juste
avant de lancer le serveur. Une variable est **figée à la naissance du
processus**, et cela produisait deux mensonges :

- **absente** dès que le serveur n'avait pas été lancé par ce script précis ;
- **périmée** après « Chercher les dernières corrections » — ce bouton tire le
  code neuf *sans redémarrer*, donc l'écran continuait d'afficher l'ancien
  commit. Le bouton censé éteindre le malentendu l'alimentait.

La version est désormais lue **dans le dépôt réellement servi**, à chaque
affichage (`src/server/version-executee.ts`). Sur le banc d'essai seulement :
une application déployée n'a pas de dépôt sous la main, et sa version continue
de venir de sa chaîne de livraison. `safe.directory` est passé à l'appel — dans
un conteneur, le dossier appartient souvent à un autre compte, et git refuserait
en silence.

Le bouton de mise à jour **nomme aussi la version obtenue** : « Vous étiez déjà
à jour » ne prouvait rien tout seul — c'est précisément la phrase qu'affiche un
espace resté en arrière.

Éprouvé en retirant le correctif : la suite retombe sur « aucune version » et
sur « l'écran annonce 01/01/2020 alors que le code servi est … ».

### Rallumer un espace arrêté : le geste s'appelle « Open in Browser »

Le mode d'emploi disait « menu ⋯ → **Stop codespace**, puis rouvrez-le ». Devant
un espace **déjà éteint** — ce qui arrive tout seul au bout de trente minutes —
cette ligne envoie chercher une entrée de menu qui n'existe pas, et il n'y a
aucun bouton « Démarrer » ni « Réactiver » pour la remplacer. Le patron est resté
bloqué là : « je ne peux pas le réactiver ».

`docs/ESSAYER.md` nomme maintenant le geste, et dit ce que signifie l'absence de
« Stop codespace ».

---

## 2026-08-06

### Aller chercher les corrections sans quitter l'application

**Trois soirées perdues sur le même malentendu.** Le patron essaie des
correctifs livrés une heure plus tôt, ne voit rien changer, et conclut — à
raison, de son point de vue — que rien n'a été corrigé. Le 6 août au soir :
« en fait tu as corrigé aucun problème, ou alors j'ai quelque chose à faire pour
que le terminal ouvre la dernière mise à jour ? »

La question était juste, et la réponse était **oui** : l'espace de travail ne
récupère le code neuf qu'au DÉMARRAGE. Recharger la page du navigateur ne
redémarre pas l'espace, et rien ne le disait. Trois signes le prouvaient sur ses
captures — l'adresse encore mal placée, l'appareil photo sans accès à la
bibliothèque, un défaut réparé la veille toujours présent.

L'écran Réglages porte donc un bouton **« Chercher les dernières corrections »**,
qui va chercher le code, applique les migrations, et le dit. Banc d'essai
uniquement (`ATLAS_BANC_ESSAI`) : une application déployée qui tire son propre
code serait une porte d'entrée. Les prudences restent celles de
`mettre-a-jour.sh`, déjà éprouvé — jamais par-dessus du travail non enregistré,
jamais en forçant.

### La note vocale ne fait plus planter l'application

« Runtime NotSupportedError », en pleine page, en touchant « écouter ». Deux
fautes cumulées : `audio.play()` rend une promesse qui peut être rejetée — non
interceptée, elle remonte en erreur d'exécution et l'application entière paraît
cassée ; et la cause du rejet est presque toujours la même, Safari sur iPhone ne
sait pas décoder le WebM. L'écran dit maintenant, en français, que le téléphone
ne sait pas lire ce format — le fichier est intact et la transcription, elle,
n'en dépend pas.

### Ce qui tient à dix mille utilisateurs, et ce qui ne tiendra pas

Le patron : « l'application doit pouvoir supporter dix mille, voire cent mille
utilisateurs. Il ne faut pas qu'il y ait de problème si dix personnes rentrent
des mots de passe en même temps, créent des devis en même temps, font des
factures en même temps. »

**Éprouvé pour de vrai** (`scripts/test-concurrence.ts`) : trente numéros de
devis et trente numéros de facture demandés à la même seconde, deux entreprises
qui facturent en parallèle, vingt chantiers créés d'un coup, et quarante
lectures entrelacées entre deux entreprises.

**Ce qui tient :** la numérotation est atomique (`UPDATE … RETURNING`), aucun
doublon, aucun trou ; chaque entreprise garde sa propre suite ; et l'isolation
ne fuit pas sous charge — quarante lectures simultanées, aucune ligne d'une
entreprise vue par l'autre. Contrôle éprouvé en remplaçant la numérotation par
la version naïve (lire puis écrire) : **25 factures sur 30 portaient alors le
même numéro**. C'est exactement le défaut que ce contrôle existe pour attraper.

**Ce qui devient réglable :** le nombre de connexions à la base était écrit en
dur à 10 par instance. `DATABASE_POOL_MAX` permet de l'ajuster — au-delà de
quelques dizaines d'instances, c'est un répartiteur (PgBouncer) qu'il faudra,
pas un chiffre plus grand.

**Ce qui ne tiendra pas, mesuré :** la vérification d'un mot de passe prend
**80 ms** et ne se parallélise pas — dix connexions simultanées = 785 ms,
cinquante = 3,9 s, pendant lesquelles l'instance ne sert rien d'autre. La cause
est `bcryptjs`, une implémentation en JavaScript pur. Le remède est connu (une
implémentation native, qui rend la main entre deux calculs) mais engage une
dépendance compilée : soumis au patron avant d'être fait.

### La connexion refusait les bons identifiants, et trois écrans se marchaient dessus

**Ses parents ne pouvaient pas entrer.** Il leur donne l'adresse de
l'application ; ils saisissent les bons identifiants et lisent « Email ou mot de
passe incorrect ». Ils recommencent — ce que le message leur dit de faire — et
s'enfoncent. Deux causes cumulées :

- le compteur de tentatives était tenu **par email**, or le banc d'essai partage
  un compte unique : cinq essais en quinze minutes, tous visiteurs confondus, et
  tout le monde était bloqué, y compris ceux qui tapaient juste. Il est
  désormais tenu par email **et adresse IP** ;
- **le message mentait.** On taisait le blocage pour ne pas révéler qu'un email
  existe : protection dérisoire — celui qui martèle un compte le sait déjà —
  payée d'un prix total, puisque l'utilisateur légitime n'avait aucun moyen de
  comprendre. On lit maintenant « trop de tentatives, réessayez dans N minutes ».

**Un chantier n'apparaît plus que dans un seul onglet.** « Chez Martins »,
marqué FACTURÉ, figurait dans la liste des chantiers **et**, planifié le 12 août,
dans le planning. Désormais : planifié → au planning ; facturé, terminé, ou date
dépassée → aux terminés ; tout le reste → aux chantiers. Règle unique et
partagée (`src/lib/onglet-chantier.ts`), sans quoi elle se serait remise à
diverger d'un écran à l'autre.

**Un chantier planifié se supprime d'un glissement.** Vers la gauche, une
corbeille rouge se découvre ; un appui dessus, et il disparaît. Deux gestes,
jamais un — un bouton toujours visible finirait par être touché avec des gants.
Suppression douce (les traces restent), et **refusée dès qu'une facture est
émise** : une pièce comptable numérotée ne s'efface pas d'un mouvement du doigt,
elle se corrige par un avoir.

### Quatre points relevés en se servant vraiment de l'application

**Le PDF disait « Chantier : » là où on attend une adresse.** Le client
apparaissait sans adresse, et la rue des travaux figurait en dessous sous une
étiquette technique. Désormais : l'adresse du client — ou, à défaut, celle du
chantier — s'imprime nue, à sa place ; la ligne « Chantier : … » ne subsiste que
si les travaux ont lieu ailleurs, cas où l'étiquette est indispensable. Écran et
papier partagent la même fonction (`src/lib/adresses.ts`).

**Un seul bouton pour les photos, et le choix à l'appui.** Première version : deux
boutons côte à côte. « Ça fait trop de boutons » — il a raison, c'est une
décision imposée avant même qu'elle se pose. L'écran ne montre plus que
« Ajouter une photo » ; une feuille demande alors *prendre une photo* ou
*choisir dans ma bibliothèque*, et sait se refermer sans rien faire.

**Les photos : l'appareil photo, et rien d'autre.** « J'ai besoin de pouvoir
accéder aux photos que j'ai déjà prises. Il faut bien évidemment pouvoir faire
les deux. » L'attribut `capture` d'un champ de fichier n'est pas une
préférence : sur un iPhone, il **impose** l'appareil et retire l'accès à la
pellicule. Un artisan qui a photographié le chantier le matin ne pouvait rien
joindre l'après-midi. Deux champs, deux boutons : « Prendre une photo » et
« Choisir dans mes photos ».

**Le client recevait du JSON.** En touchant « voir le devis en PDF » depuis son
lien, il tombait sur `{"error":"Ce lien n'est plus valable"}` en pleine page.
Un client qui lit cela n'y comprend rien et appelle son artisan — quand il n'en
conclut pas que le devis est un piège. Il est renvoyé vers la page du devis, qui
sait s'expliquer en français.

**« La facture s'affiche partie, mais le client ne la reçoit pas. »** Exact au
mot près : l'écran annonçait « facture arrêtée » — vrai comptablement — et
**rien** ne portait la facture jusqu'au client. Le devis avait tout cela depuis
des semaines ; la facture, rien. Elle a désormais son lien public à jeton
(migration `0024_envois_factures.sql`), sa page client, son PDF archivé servi
tel quel, et le message tout prêt qui s'ouvre dans la messagerie du patron —
puisque aucun prestataire n'envoie à sa place (`docs/A-FAIRE.md` §5). L'écran ne
dit plus « arrêtée » sans ajouter « votre client ne l'a pas encore reçue », et
c'est l'envoi, non l'arrêt comptable, qui pose le jalon `facture_envoyee_at`.

### Le premier devis écrit à la main : trois défauts, trouvés par le patron

Il crée un chantier, saisit son client, ouvre « rédiger le devis à la main », et
rapporte trois choses. Toutes vraies, toutes reproduites avant correction.

**1. L'adresse au mauvais endroit, le téléphone au mauvais rang.** Il avait
rempli « adresse du chantier » et laissé vide « adresse du client — *si
différente de l'adresse du chantier* ». Le devis affichait donc un client sans
adresse, et la rue resurgissait tout en bas, nue, sans étiquette. Laissée vide,
l'adresse du client **est** celle du chantier : c'est ce que l'écran promet, ce
n'est donc pas une donnée inventée. Le bloc se lit désormais comme une lettre —
nom, adresse, e-mail, **puis** téléphone —, la même rue ne s'imprime pas deux
fois, et l'adresse des travaux ne réapparaît que si elle diffère, sous son
titre. Écran et PDF appliquent la **même** fonction (`src/lib/adresses.ts`).

**2. « Quand j'essaye de cliquer pour mettre un prix, ce n'est pas
cliquable. »** Il l'était. Mais vide, sans exemple, sans repère, et haut de
**24 pixels** — mesuré. Apple recommande 44. Un contrôle automatique répondait
« éditable : oui » et n'y voyait rien : c'est l'œil qui l'a vu, pas le test.
Le champ a maintenant la hauteur d'un doigt, un trait tant qu'il est vide, et
un exemple en gris.

**3. « Quand je fais aperçu en PDF, rien n'a été enregistré. »** Le plus grave,
et le mieux caché : ses lignes étaient bien en base — dans `lignes_prix`, celles
qu'il modifie — pendant que le PDF imprimait `lignes_devis`, l'instantané du
document, rafraîchi seulement au **chargement de la page**, donc avant qu'il
n'écrive quoi que ce soit. Deux lectures d'une même chose qui divergent, ce que
`CLAUDE.md` §3 interdit. L'instantané est désormais rafraîchi à l'instant de
l'impression. Un aperçu qui montre autre chose que l'écran fait douter de tout
ce qu'on vient de saisir.

`scripts/test-devis-papier-e2e.ts` parcourt son chemin exact sur un écran de six
pouces. Éprouvé en remettant chacun des trois défauts : chacun rougit le sien.
Piège rencontré en l'écrivant : `innerText` **ignore le contenu des champs de
saisie** — un contrôle qui l'interroge ne voit ni le nom, ni l'adresse, ni le
téléphone, et conclut à tort.

### Poser une clé suffit à brancher l'IA — elle ne l'était pas

Le patron : « J'ai déjà mis Anthropic et OpenAI. Les clés sont mises, je ne
comprends pas pourquoi l'IA n'est toujours pas branchée. Elle est censée
l'être. »

Elle ne l'était pas, et **trois causes se cumulaient** — chacune suffisant à
tout bloquer, aucune visible nulle part :

1. **`LLM_PROVIDER` valait `dev` par défaut**, et rien d'autre ne le changeait.
   Poser une clé ne branchait strictement rien. Désormais la présence d'une clé
   décide : Anthropic rédige, OpenAI transcrit. La variable explicite reste
   souveraine — `LLM_PROVIDER=dev` coupe l'IA sans retirer les clés.
2. **Le conteneur d'essai écrivait `dev` en dur et ne transmettait aucune clé.**
   Un secret d'espace de travail vit côté hôte ; ce qui ne figure pas dans
   `.devcontainer/docker-compose.yml` n'existe pas à l'intérieur. Le même piège
   avait déjà coûté une demi-journée avec `CODESPACE_NAME`.
3. **`src/server/ai/providers/llm/openai.ts` n'était qu'une ébauche** répondant
   « non implémenté » — une phrase que personne ne voyait jamais, puisqu'elle
   ressortait sous la forme d'un devis recopié mot à mot. Elle est maintenant
   implémentée pour de bon, appels d'outils compris.

**Deux pièges voisins, refermés au passage.** Une variable transmise à vide
(`${ANTHROPIC_API_KEY:-}`) passait pour renseignée : `?? défaut` ne rattrape
pas la chaîne vide. Et `LLM_PROVIDER=Anthropic`, avec sa majuscule, retombait
en mode déterministe sans un mot.

**Pour que la question ne se repose jamais sans réponse :**

- l'écran **Réglages** affiche les fournisseurs réellement actifs, et nomme la
  variable qui manque le cas échéant ;
- le bandeau de démarrage de l'espace d'essai le dit aussi ;
- `npm run verifier:ia` répond en une commande, et `-- --reseau` appelle
  réellement les fournisseurs. Ce contrôle **sait échouer** : clé absente, nom
  inconnu, ébauche déguisée en fournisseur, clé refusée.

**Un message qui accusait à tort.** Un HTTP 401 se traduisait par « fournisseur
indisponible » — soit une panne du prestataire, alors que la clé était
simplement mauvaise. Nouveau type d'erreur `cle_api_refusee`, qui nomme la
variable à corriger.

**Et pour qu'il n'ait rien à comprendre.** « Créez un fichier `.env.local` à la
racine du projet » n'a pas été compris — consigne mal posée : créer un fichier
caché, au bon endroit, avec le bon nom, sur six pouces. Le fichier est donc
**créé d'avance et vide** au premier démarrage de l'espace, avec une ligne par
clé et la marche à suivre en français. Il n'y a qu'à coller après le signe égal.

*Piège refermé en le construisant, et il aurait été grave :* charger ce fichier
naïvement aurait **écrasé avec du vide** des clés déjà présentes dans le
conteneur — le remède aurait causé la panne qu'il répare.
`.devcontainer/charger-cles.sh` ne ressort que ce qui apporte quelque chose, et
`scripts/test-charger-cles.ts` tient ce cas précis.

**Un espace de travail construit avant ce correctif garde l'ancien réglage**, et
aucune clé n'y servirait tant qu'il n'est pas reconstruit — geste introuvable sur
un téléphone. `.devcontainer/reglage-ia.sh` distingue « `dev` parce qu'on l'a
voulu » de « `dev` parce qu'un vieux fichier l'écrivait », et neutralise le
second. Éprouvé sur les quatre états par `scripts/test-reglage-ia-espace.ts`.

**Et un défaut de démarrage, découvert en préparant la livraison :** l'espace
récupère bien le code neuf, mais `demarrer.sh` continuait ensuite dans sa
version ancienne — le correctif du jour n'entrait en vigueur qu'au démarrage
suivant. Le script se rejoue désormais dans sa version neuve, une fois et une
seule.

**Ce que cela change pour les données.** La protection ne repose plus sur une
valeur par défaut mais sur **l'absence de clé** — voir `docs/RGPD.md` §3. La
batterie de contrôles retire donc les clés d'IA de toute étape qui exécute le
produit : une suite lancée dans l'espace du patron enverrait sinon les dictées
d'essai chez les fournisseurs, et les lui ferait payer.

### L'agent retient ce que le patron chiffre, et le lui rappelle

*« Si l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ?
Pour s'améliorer elle a besoin de mémoire. »* Il avait raison, et le dépôt lui
donnait raison plus qu'on ne le croyait.

**Ce que ça a révélé.** `historique_prix` existe depuis des mois, elle est lue
par le chiffrage, affichée au catalogue — et **jamais écrite par
l'application**. Seuls les tests l'alimentaient. Une mémoire que personne ne
remplit n'est pas une mémoire ; c'est une table.

Désormais : il chiffre une ligne de devis, l'agent retient. Sur le chantier
comparable suivant, il lit sous la ligne *« La dernière fois — « Abattage d'un
chêne mort — démontage avec rétention, ⌀ 70 cm », le 6 août — vous aviez retenu
1 400 € HT »*, et un lien reprend ce prix.

**Pourquoi une table neuve plutôt qu'`historique_prix`.** Celle-ci s'appuie sur
`catalogue_prestations`, catalogue **partagé** repéré par nom canonique. Elle ne
sait pas distinguer un abattage au pied d'un démontage avec rétention — les deux
seules choses qui font passer le même chêne de 600 à 1 400 €. Une mémoire
aveugle à cette distinction rappellerait un prix faux de 800 € **avec l'autorité
de l'expérience**. `lecons_prix` porte donc une signature de métier
(`abattage|retention|d70`) construite par une fonction pure.

**Quatre décisions, et leur pourquoi :**

- **Un rappel, jamais un calcul** (`docs/EXEMPLE-DICTEE.md` §9c). La phrase dit
  d'où vient le chiffre et de quel chantier. Rien ne s'applique tout seul : le
  patron appuie, ou ignore.
- **Une leçon par ligne de devis, jamais une de plus.** Il tape son prix chiffre
  par chiffre, et chaque champ quitté déclenche un enregistrement : compter
  chacun emplirait la mémoire de 1, puis 14, puis 140 en allant vers 1 400.
  Seule sa dernière décision subsiste.
- **Le rapprochement se trompe dans le bon sens.** Les diamètres sont groupés
  par tranche de dix centimètres — 68 et 70 cm sont le même arbre. Une frontière
  subsiste (64 contre 66), et elle fait **manquer** un rappel, jamais en
  fabriquer un faux. C'est écrit noir sur blanc, avec un contrôle qui interdit
  de l'« améliorer » en élargissant : ce serait échanger un manque contre une
  erreur.
- **L'apprentissage ne gêne jamais le travail.** Une ligne dont on ne sait rien
  tirer — « Déplacement », « Acompte » — s'enregistre quand même. Faire échouer
  son devis parce qu'on n'a pas su en tirer une leçon serait le comble.

Au passage, `src/lib/arrondi-prix.ts` applique enfin sa règle : *« en HT on fait
des prix ronds : 350, 400, 420, 560 »*. Un devis à 1 002,53 € trahit la machine.

**Un défaut de conception trouvé par un test**, et pas en relisant : découper
les diamètres en tronquant mettait 68 cm et 70 cm dans deux tranches distinctes
— la frontière tombait pile entre deux valeurs voisines et courantes, et le
rappel ne se serait affiché qu'au hasard. Arrondi au plus proche depuis.

### Trouvé en vérifiant : les clés du patron n'entraient jamais dans son espace d'essai

Le patron a demandé de vérifier moi-même si Atlas était branché à un fournisseur.
La réponse est **non**, et la cause n'était pas chez lui.

Sur `main`, `.devcontainer/docker-compose.yml` **fige** `LLM_PROVIDER: dev` et
`TRANSCRIPTION_PROVIDER: dev`, et ne transmet **aucune clé d'API**. Un espace de
travail créé depuis la branche par défaut écrase donc tout ce que les secrets de
Codespaces peuvent contenir : il a ouvert deux comptes, payé, posé quatre
secrets — et le conteneur les ignorait par construction.

Le correctif (`${VAR:-dev}` et les cinq clés) existe depuis le 5 août sur la
branche de travail. Il n'a simplement **jamais atteint `main`** : tant que la PR
n'est pas fusionnée, son espace reste en mode déterministe quoi qu'il fasse.

**Deux corrections apportées au passage, sur des défauts réels du correctif
lui-même :**

1. **Un second chemin pour les secrets** (`remoteEnv` dans `devcontainer.json`).
   L'interpolation `${VAR:-dev}` est faite par docker-compose au moment de bâtir
   le conteneur, et ne lit que ce que l'hôte lui présente alors — rien ne
   garantit qu'un secret de Codespaces y soit déjà. `remoteEnv` est appliqué à
   l'intérieur, là où les secrets sont posés. Deux chemins pour la même valeur,
   parce que le coût de l'échec est asymétrique : s'ils échouent tous les deux,
   il dicte et reçoit un texte fabriqué sans que rien ne le lui dise.
2. **Une variable vide vaut « absente »** (`src/server/env.ts`). C'est le cas
   ORDINAIRE quand une valeur ne traverse pas : `${VAR:-dev}` comme
   `${localEnv:VAR}` produisent la chaîne vide, jamais `undefined`. Avec `??`,
   cette chaîne passait pour un nom de fournisseur, et le message annonçait « le
   nom "" n'est pas reconnu » — il aurait cherché une faute de frappe là où il
   n'y avait qu'une variable non transmise. Une erreur qui accuse à tort coûte
   plus cher que pas d'erreur du tout.

Les deux contrôles ont été **confrontés à l'état dégradé** : en annulant le
correctif, ils rougissent tous les deux.

### Passer outre l'arrêt donnait un devis vide — réparé

Trouvé par la CI, sur une suite qui n'était pas la mienne. L'arrêt d'ajout de la
veille avait un défaut que le code seul ne montrait pas : **quand le patron
passait outre sans répondre, le chiffrage ne tournait jamais.** L'écran
l'emmenait bien au devis — un devis sans la moindre ligne.

Le pire des deux mondes : il choisissait de ne pas répondre, et cela lui coûtait
son devis.

**L'arrêt est une offre, jamais une barrière.** Appuyer sur « Continuer » EST sa
décision : la chaîne va désormais jusqu'au bout, répondu ou non. Et ce qu'il
laisse de côté **ressort signalé sur le devis** plutôt que de disparaître — la
seconde moitié de sa propre règle du 6 août.

**Et une suite qui abîmait les données d'une autre.** `test-questions-chiffrage-e2e`
récrivait la dictée du jeu de démonstration, dont `test-transcription-e2e`
vérifie le texte. Invisible ici, où chaque suite est jouée seule ; visible en CI,
sur une suite innocente. Elle crée maintenant son propre chantier.

### L'agent s'arrête et demande ce qui coûte de l'argent

**Choisi par le patron en QCM**, devant la mémoire des corrections et
l'entretien de départ. Et sa règle, confirmée le même jour : *« il demande si ça
change le prix, il signale sinon »* — ce qui réconcilie deux réponses qu'il avait
données à une heure d'intervalle, et qui ne portaient pas sur la même chose.

**Ce que ça évite, chiffré.** Il a dicté « un chêne mort à abattre, de vingt
mètres de haut ». Chez lui, l'abattage vaut 600 € au pied, 1 000 € en démontage,
1 400 € avec rétention. Ce qui décide, c'est la **technique** et le **diamètre du
tronc** : sa dictée donne la *hauteur*, qui ne décide de rien, et tait les deux
autres. L'agent chiffrait donc à l'aveugle, avec 800 € d'écart possible.

Il pose maintenant deux questions, boutons au pouce, et repart.

**Et il se tait partout ailleurs**, ce qui compte autant. `AGENT.md` §2 exige un
arrêt « franchissable en quelques secondes » : un arrêt devenu formulaire est un
arrêt contourné, et le contournement ici c'est le devis faux. Le billonnage, le
fendage, le matériel ne déclenchent rien. Une suite l'éprouve en comptant les
questions, pas seulement en vérifiant qu'elles sont là.

**Trois décisions de conception :**

- **Les réponses vivent dans leur propre table** (`precisions_chantier`), pas
  dans le brouillon. Le brouillon se régénère à chaque relecture de la dictée ;
  ses réponses, elles, ne viennent pas de la dictée. Rangées là, elles seraient
  effacées à chaque relecture et il serait questionné deux fois sur le même
  arbre — la meilleure façon de lui faire abandonner l'arrêt.
- **La reprise ne rappelle pas le modèle.** Repasser par la lecture de la dictée
  lui ferait payer une seconde analyse, et pourrait renuméroter les questions
  auxquelles il vient de répondre.
- **« Vingt mètres » n'est jamais cherché dans la transcription brute.** Le mot
  figure deux fois dans cette dictée, pour la haie et pour la hauteur du chêne
  (`docs/EXEMPLE-DICTEE.md` §3). Un filtre qui lirait le texte entier prendrait
  l'un pour l'autre et tairait une question qui vaut 800 €.

**Ce que ça ne fait pas, et qu'il ne faut pas croire acquis :** la réponse
n'change pas encore le *montant*. Par sa propre règle (§9c) : tant qu'aucun
rapport n'a été observé entre techniques et prix, l'agent demande le prix plutôt
que d'en fabriquer un. Il manque la mémoire, pas la question. `TODO.md` §0 ter
dit ce qui la débloque.

### Trois défauts de mes propres contrôles, trouvés en regardant l'écran

Aucun n'était dans le produit ; tous auraient laissé passer un vrai défaut.

1. **« Abattage » était pris pour une technique.** Le premier filtre cherchait le
   premier mot de chaque option — dont « Abattage ». « Abattage d'un chêne mort »
   comptait donc comme technique déclarée, et la question qui vaut 800 € n'était
   jamais posée : le défaut que ce module existe pour empêcher, dans le module
   lui-même. « Abattage » est le mot générique du métier ; la technique, c'est ce
   qui suit.
2. **La suite navigateur cliquait un paragraphe.** « démontage avec rétention »
   figure aussi dans la phrase qui explique la question. Le contrôle visait le
   texte, cliquait l'explication, aucune option n'était retenue — et il passait
   quand même. Vert sur une réponse jamais donnée.
3. **Elle lisait le texte de la page là où les prestations sont des champs de
   saisie.** `innerText` n'en rend pas la valeur : le contrôle accusait le
   produit d'un tort qui n'était qu'un mauvais sélecteur.

Aucun des trois ne se voyait en relisant le code. Les trois se sont vus en
ouvrant l'écran et en regardant la base.

---

## 2026-08-05

### Le patron peut emporter ses données, en un appui

**Ce qui l'exigeait.** Il a perdu ses chantiers une fois, en supprimant l'espace
de travail — sur mon conseil, donné deux fois. Puis il a posé la question qui
commande tout le reste : *« le jour où je mets ça en ligne, est-ce que je perds
toute la mémoire ? »* Tant que la réponse honnête restait « peut-être », il avait
raison de ne rien vouloir saisir. Sa consigne, mot pour mot : *« oublie pas de le
faire, note-le, enregistre-le ! »*

Réglages porte désormais **« Télécharger mes données »** : un fichier ZIP, sur
son téléphone, sans terminal ni compte. Dedans, `donnees.json` (les vingt-trois
tables de son entreprise), ses photos, ses enregistrements, ses PDF, et un mode
d'emploi qui dit ce que le fichier contient de sensible.

**Trois décisions, et leur pourquoi** (détail dans `ARCHITECTURE.md` §26) :

- **Ni `pg_dump`, ni privilège en plus.** L'export passe par `withEntreprise`,
  comme n'importe quelle lecture. Une sauvegarde n'est pas une raison d'ouvrir
  une brèche dans l'isolation — et c'est l'endroit où une fuite ne se verrait
  pas, personne ne relisant trois mille lignes de JSON.
- **Le ZIP est écrit à la main**, sans bibliothèque, méthode « stockage ». Le
  format est figé depuis 1989 ; une dépendance coûterait plus cher que les
  quatre-vingts lignes. Photos et PDF étant déjà compressés, la compression ne
  gagnerait que quelques pour cent contre un chemin de code capable de se
  tromper en silence.
- **Un fichier manquant n'interrompt pas la sauvegarde.** L'audio est purgé
  après transcription : l'absence est le cas *normal*. `fichiers-absents.txt`
  liste ce qui manque et dit lequel des deux cas s'applique — une photo absente,
  elle, signale un espace de travail supprimé.

**Ce qui le vérifie.** Une suite ouvre l'archive avec l'`unzip` du système, pas
avec notre propre lecteur : un décalage d'un octet ou un CRC faux ne se verraient
nulle part ailleurs. Une autre interroge `information_schema` et **échoue si une
table portant un `entreprise_id` n'est pas dans l'export** — une table ajoutée
demain et oubliée disparaîtrait sinon des sauvegardes sans un bruit. Et une
troisième appuie sur le bouton dans un vrai navigateur, récupère le fichier,
l'ouvre, et vérifie qu'aucun compte de connexion ni empreinte de mot de passe
n'y figure.

**Ce que ça ne fait pas** : la sauvegarde *automatique*. Elle reste bloquée sur
le choix d'un hébergeur, faute de destination extérieure — ni le dépôt (public),
ni le disque de l'espace de travail (c'est précisément ce dont on se protège).
Écrit dans `TODO.md` §0(b), et redit à l'écran sous le bouton.

### Un contrôle qui accusait le produit pour un tort de la machine

`test-archive-zip.ts` vérifiait qu'un nom accentué ressortait accentué **en
relisant le disque après `unzip`**. Vert ici, rouge en CI — le runner tourne en
locale C, où `unzip` translittère le nom en l'extrayant. L'archive était juste ;
c'est l'attente qui dépendait de la machine.

Le contrôle porte désormais sur la propriété qu'on maîtrise vraiment, et qui est
*dans l'archive* : les octets du nom sont de l'UTF-8, et le drapeau qui l'annonce
est levé — c'est ce qui fait qu'un téléphone ou un Windows affiche « chêne ». Le
contenu, lui, est relu quel que soit le nom que le système d'accueil écrit.

Rejoué en forçant `LC_ALL=C`, la condition du runner, plutôt qu'en supposant
qu'elle est réglée. **Un contrôle qui accuse à tort coûte plus cher que pas de
contrôle du tout** — la règle était écrite, elle s'applique aussi aux contrôles
que j'écris moi-même.

### Cet environnement peut faire tourner PostgreSQL et Redis

**Correction d'une croyance qui coûtait cher.** `CLAUDE.md` §5 et `AGENTS.md`
affirmaient que la batterie base de données ne pouvait pas tourner ici, faute de
Docker. C'est vrai pour Docker, et faux pour la conclusion : les binaires
PostgreSQL 16 (`/usr/lib/postgresql/16/bin`) et `redis-server` sont installés.
Un `initdb` sous l'utilisateur `postgres` — `root` ne peut pas — suffit.

La conséquence était réelle : « c'est la CI qui vérifiera » a été dit trois fois
alors que la CI n'avait jamais tourné, et les suites base restaient éprouvées
nulle part. `scripts/monter-base-locale.sh` monte désormais le tout en une
commande. À utiliser **avant** de livrer, pas à la place de la CI.

### Une leçon : j'ai reconstruit ce qui existait déjà

J'ai écrit un « tapis roulant » qui enchaînait la dictée jusqu'au devis — et
`main` le portait déjà, livré le matin même par la PR #18 sous le nom
`devis-depuis-dictee.ts`. Le doublon a été supprimé au moment de la fusion ;
c'est la version de `main` qui reste.

**Comment c'est arrivé, parce que la cause est plus utile que l'excuse.** Ma
branche datait de cinq commits en arrière. J'y ai lu `docs/AGENT.md` §5, qui
disait « Enchaînement complet — à faire », et j'ai construit d'après cette
phrase. Sur `main`, la même ligne était déjà corrigée.

C'est exactement le défaut que j'avais diagnostiqué deux heures plus tôt chez
une autre conversation : *le dépôt est la source de vérité, pas la
conversation* — encore faut-il lire le dépôt à jour. **Avant de construire :
`git fetch origin main` et vérifier ce que la branche n'a pas.**

### L'écran Réglages dit enfin qui écoute et qui rédige

Le patron a ouvert deux comptes, payé, posé quatre clés — puis dicté, et
l'application a continué à fabriquer ses réponses **sans rien dire**. Il a fallu
qu'il pose la question dans une autre conversation pour l'apprendre.

Le garde-fou ajouté deux jours plus tôt refuse ce mode en production, mais reste
muet sur le banc d'essai, où c'est justement le mode normal. Il manquait la
moitié de la règle du dépôt : *un contrôle doit savoir échouer, et son message
doit désigner le bon coupable.* Ici il n'y avait aucun message du tout.

`src/lib/etat-ia.ts` décrit l'état réel à partir des deux seules variables qui
décident — jamais de la présence d'une clé, qui n'a jamais rien choisi. L'écran
`Réglages` l'affiche. Trois états, et le troisième est celui qui coûtait le plus
cher :

- **branché** : le prestataire est nommé, et l'écran dit ce qui part chez lui ;
- **déterministe** : rien ne part, avec une explication propre à chaque rôle ;
- **nom non reconnu** : une faute de frappe donnait le mode simulé, exactement
  comme une configuration absente, et rien ne distinguait les deux à l'écran.

Un quatrième cas est signalé au passage : un fournisseur reconnu mais dont le
raccordement n'est pas écrit (Deepgram, Google, Gemini) affiche « raccordement
non écrit » plutôt qu'un nom rassurant suivi d'une panne à chaque dictée.

**Un défaut trouvé en regardant, pas en testant.** La première version servait
la même phrase aux deux rôles : la carte « Rédaction » annonçait donc des
transcriptions simulées, ce qui n'est pas son sujet. Les onze tests passaient au
vert. C'est une capture des trois états qui l'a montré — le quatrième défaut de
ce projet trouvé de cette façon.
### La dictée mène droit au devis, et le devis est seul sur sa page

Le patron, en précisant : « une fois qu'on valide la note vocale, cette page
s'ouvre — la page où il n'y a que le devis — et là je fais mes modifications
s'il y a besoin. **Je ne veux pas tous les autres trucs intermédiaires.** Et
sous la note vocale, un petit lien pour y accéder directement : si je n'ai pas
envie de dicter, que je puisse le rédiger à la main. »

**Ce qui change au parcours :**

- La dictée validée ouvre **le devis lui-même**. Le compte rendu qui
  s'affichait — ce qui a été retenu, à combien — était un écran de plus entre
  sa dictée et son devis. Ce qu'il disait se lit maintenant sur le document :
  les lignes y sont, le total aussi, et la mention « recopiée mot à mot »
  s'affiche en tête quand aucun modèle n'a compris la dictée.
- Sous l'enregistreur, **« Ou rédiger le devis à la main → »**, quel que soit
  l'état de la dictée.
- La page du devis ne porte plus **aucun décor d'application** : ni barre
  d'onglets, ni titre d'écran, ni phrase d'explication. Une feuille, pas un
  formulaire — les champs n'ont ni cadre ni fond tant qu'on n'y écrit pas.

**Deux défauts trouvés en le construisant, tous deux sur le devis du client :**

- La ligne de prix s'appelait **« Prestation (prix calculé) »**. C'est ce que le
  client lisait, et cela ne lui disait rien du travail. Elle nomme désormais ce
  qui a été dicté. Le prix, lui, reste global : il se calcule sur la durée et
  l'équipe, pas prestation par prestation.
- **Rejouer la dictée dupliquait les prestations** — la même taille de haie deux
  fois, et le prix calculé qui la comptait double. C'est le défaut du 3 août
  sous un autre visage : ce qui est déjà au chantier n'y entre plus une seconde
  fois, et la règle se lit dans les données (`ARCHITECTURE.md` §10).

### « Le fichier devis, le vrai ! Le document entier »

Sa demande : « je veux que lorsqu'on clique sur rédiger à la main, ça ouvre le
fichier devis, le vrai ! Celui qui se trouve dans modèle de devis, le fichier en
entier, pas juste les lignes pour remplir les infos et les prix. »

Il avait raison sur le fond. « Rédiger à la main » ouvrait l'écran Prix : des
lignes et des montants. Or ce qu'il envoie à son client est un **document** —
son en-tête, ses coordonnées, celles du client, le tableau, les totaux, ses
conditions, le cadre de signature.

**Le document entier, dans l'ordre de son modèle** (`appli/devis-modele.html`,
celui qu'il avait construit lui-même pour Arborea, et que le PDF reproduit
déjà) : émetteur — nom, adresse, téléphone, e-mail, SIRET, **IBAN** —, numéro,
date, validité, client, adresse du chantier, tableau avec quantité et prix
unitaire, totaux avec **le taux de TVA qu'il fixe**, notes et conditions, cadre
de signature.

**Pourquoi pas le fichier d'origine tel quel.** Il garde tout dans le navigateur
(`localStorage`) : ce qu'il y écrirait n'existerait pas pour Atlas — ni facture
de fin de chantier, ni TVA, ni suivi de l'envoi. Ici chaque champ part vers **sa
source** (l'entreprise, la fiche du client, le chantier, les lignes de prix), et
le devis se reconstruit à partir d'elles. Aucune seconde vérité.

**Deux choses qui manquaient, révélées en le construisant :**

- **Aucun écran ne demandait l'IBAN ni le SIRET.** Le modèle les imprime ; sans
  IBAN, le client reçoit un devis qu'il ne peut pas payer.
- **Modifier une quantité ou un prix unitaire ne recalculait pas le montant.**
  Trois tilleuls à 250 € affichaient 750 € à l'écran et **0,00 € en base** —
  donc un devis à zéro chez le client. L'invariant `montant = quantité × prix
  unitaire` ne tenait que dans un sens ; il tient maintenant dans les deux.

Et le taux de TVA appartient désormais au document : une ligne ajoutée n'efface
plus le 10 % choisi la veille.

### La case « Nom du chantier » a disparu

Sa demande, en une phrase : « dans la catégorie chantier, retire la case nom du
chantier ». C'était **le seul champ obligatoire** de la création, et le seul qui
lui demandait d'inventer quelque chose. Un élagueur ne baptise pas ses
chantiers : il dit « chez M. Bernard » ou « rue des Lilas ». Lui faire trouver
un titre avant de pouvoir commencer, c'était une porte fermée à clé devant une
maison ouverte.

**Plus rien n'est obligatoire.** Le nom se déduit de ce qu'il a donné, dans
l'ordre où il en parle :

| Ce qu'il saisit | Le chantier s'appelle |
|---|---|
| Un client | « Chez M. Bernard » |
| Une adresse seule | « 12 rue des Lilas, Nantes » |
| Rien du tout | « Chantier du mercredi 5 août » |

**Ce n'est pas inventer une donnée** (`CLAUDE.md` §4) : rien n'est fabriqué,
tout est repris de sa saisie — et la date, à défaut, reste vraie. Ce nom est une
**étiquette** (ce qui s'affiche en tête de la fiche et dans la liste), jamais
une information sur le chantier ; il ne figure pas sur le devis du client, qui
porte l'adresse. Un contrôle tient l'invariant : *aucun mot du nom qui n'ait été
saisi*.

La règle vit dans une fonction pure appliquée **côté serveur**, pour qu'un appel
direct produise le même nom que le formulaire. Les 32 suites qui remplissaient
ce champ ont été reprises : elles identifient désormais leur chantier par son
client.

---

## 2026-08-04 (soir)

### Il éprouvait le code de la veille — et rien ne le lui disait

**Le défaut le plus coûteux de toute la série, et il n'était pas dans
l'application.** Le patron signale deux correctifs qui « ne marchent toujours
pas » : la bande déroulante des durées « a disparu !!!! », le numéro du client
« ne se met toujours pas ». Les deux étaient corrigés, éprouvés et fusionnés la
veille.

Un espace de travail garde le code qu'il avait **le jour de sa création**. Il ne
récupère jamais rien tout seul. Trois échanges ont été perdus à chercher des
défauts déjà réparés.

Deux réponses :

- **L'espace se met à jour à chaque allumage** (`.devcontainer/mettre-a-jour.sh`),
  puis réinstalle les dépendances et joue les migrations — un code neuf sur une
  base ancienne serait une panne au lieu d'un correctif. Il ne touche à rien si
  du travail n'est pas enregistré, n'avance qu'en ligne droite, et **dit
  toujours ce qu'il a fait**. Éprouvé contre les quatre états qu'il distingue :
  à jour, en retard, sale, divergent (`scripts/test-mise-a-jour-espace.ts`).
- **L'application annonce sa version** (Réglages, en bas) : « 04/08/2026 21:12 ·
  b05e282 ». Une capture d'écran répond désormais à « quelle version
  essayez-vous ? » sans qu'il ait à se le demander.

### « La date est à l'envers » sur le devis

Le PDF imprimait `2026-08-04`, tel que la date est stockée. Ce format est
parfait en base — il se trie tout seul — et illisible sur une pièce présentée à
un client. Devis et facture écrivent maintenant **04/08/2026**, échéance
comprise.

### La bande déroulante des durées, là où il la cherchait

Elle n'avait pas disparu : elle n'existait que sur l'écran d'envoi, au bout du
parcours, alors que c'est sur l'écran Informations qu'on décrit le chantier.
Elle y est désormais aussi, avec **la même liste** — ½ journée, puis 1 à 100
jours. Une seule source, parce que deux molettes qui divergent, c'est le patron
qui fixe deux durées pour le même chantier sans savoir laquelle compte.

Elle affiche « Non précisé » tant que rien n'a été dit : montrer « 1 journée »
par défaut ferait entrer un chiffre que personne n'a donné, et il ressortirait
dans un prix.

### « Je ne peux toujours pas rédiger mon devis seulement à la main »

Il le pouvait — par un lien au bas de l'écran Informations, c'est-à-dire après
avoir traversé photos et dictée. Et sa fiche annonçait « Prix — en attente des
informations », qui se lit comme un verrou alors que rien n'a jamais été
verrouillé. **Un chemin qu'on ne trouve pas n'existe pas.**

- « Ou rédiger le devis à la main → », sous l'action principale de la fiche.
- Les étapes disent ce qui manque, plus ce qu'il faudrait attendre : « À
  remplir, ou à dicter », « À calculer, ou à écrire à la main ».

**Et un défaut trouvé en éprouvant ce chemin :** l'écran Devis listait les
*prestations* du chantier. Un devis écrit entièrement à la main n'en a aucune —
le patron y voyait un total, et rien qui dise ce qui partirait chez son client.
Il montre maintenant **les lignes du devis**, avec leurs montants : ce sont
elles qui sont imprimées, et elles seules.

---

## 2026-08-04

### « Toujours pas de devis créé tout seul à partir de la note vocale »

Sa phrase, avec sa capture : sous « Générer le brouillon », en rouge, **« Réponse
du fournisseur non conforme (JSON invalide). »** Et rien d'autre — pas de
brouillon, pas de prestations, pas de prix, pas de devis. « Problème qui traîne.
Je veux vraiment que tu te consacres à fond pour régler ce problème une bonne
fois pour toutes. »

**Deux défauts, de nature différente.**

#### 1. Une réponse mal emballée arrêtait tout

Le service faisait `JSON.parse(reponse)` sans filet. Un modèle qui encadre sa
réponse en ```` ```json ````, ou qui écrit « Voici : { … } », suffisait à tout
bloquer. Et quand plus rien ne répond — pas de clé, quota dépassé, réseau coupé
— le patron n'avait pas davantage : un écran mort, alors que sa dictée était là,
sous ses yeux.

Trois changements :

- **L'emballage est toléré, le fond ne l'est pas.** `lireObjetJson` isole le
  premier objet équilibré ; le schéma strict reste seul juge du contenu.
- **On dit ce qui s'est passé.** Le nom du fournisseur et le début de sa réponse
  partent au journal. L'incident du patron était indiagnosticable : rien, nulle
  part, ne disait qui avait mal répondu.
- **Il n'existe plus un seul chemin où il se retrouve sans rien.** Quoi que
  réponde le fournisseur, la dictée est au minimum lue **mot à mot** — sans
  réseau, sans clé, sans jamais rien inventer. Le brouillon porte alors la
  mention « recopiée mot à mot », persistée en base (migration 0021) pour
  qu'elle survive au rechargement : présenter une recopie comme une analyse
  serait lui mentir sur ce qu'il relit.

#### 2. Et surtout : la chaîne n'existait pas

Le vrai « problème qui traîne » n'était pas le message d'erreur. Même tout vert,
Atlas s'arrêtait au brouillon. Le patron devait ensuite enchaîner **« Confirmer »,
« Valider et calculer le prix », « Ajouter au détail », « Préparer le devis »** —
cinq gestes sur quatre écrans, dont aucun ne menait au suivant. S'il en oubliait
un, un devis à **0,00 €** l'attendait au bout.

Or `docs/AGENT.md` §2 décrit depuis le début l'agent qui « transcrit, structure,
cherche les tarifs, **rédige le devis** », avec **un seul arrêt** : le patron
vérifie et valide. Chaque maillon existait et était éprouvé ; c'est
l'enchaînement qui manquait, et aucun contrôle ne le parcourait à la file.

**Un bouton, sur l'écran de la dictée : « Créer le devis à partir de ma
dictée ».** Il fait tout — prestations, matériel, durée, équipe, tarif ou
chiffrage, ligne de prix, devis — puis montre ce qui a été retenu, à combien, et
ce qui reste à regarder. Sur la dictée du patron : **1 674,00 € HT**, ses six
lignes, « 2 jours · 2 hommes ».

**Ce qu'il ne fait pas :** envoyer. L'arrêt avant l'envoi est intact, et une
suite le vérifie explicitement. Il n'invente pas non plus de prix : sans tarif
correspondant et sans durée ni équipe, aucune ligne n'est écrite, et le rapport
dit pourquoi et quoi faire.

#### Au passage

« J'estime le temps de travaux à 2 jours » laissait la bribe « j'estime le temps
de travaux à » — **imprimée comme une prestation sur le devis du client**. La
phrase d'annonce est maintenant reconnue entière ; elle passe en remarque, donc
elle n'est pas perdue, mais elle ne va plus sur le devis.

### Le SMS partait sans destinataire, et le canal ne se rediscutait plus

Le patron, sur deux captures : « l'ajout automatique du numéro ne fonctionne
pas », et « si je change d'avis et que je veux l'envoyer par e-mail, je ne peux
pas revenir au choix SMS/e-mail ».

**Le premier défaut ne pouvait être vu par aucun contrôle existant.** Le bouton
« Ouvrir le SMS tout prêt » passait par `navigator.share`. Sur iPhone, la
feuille de partage transmet un **texte** — et rien d'autre : ni numéro, ni
adresse. Le patron arrivait donc dans Messages avec le message tout écrit et un
champ « À : » vide, à retaper un numéro qu'Atlas connaissait. La fonction qui
compose `sms:0679…` était juste et éprouvée ; c'est l'écran qui ne s'en servait
pas. *Une règle juste que personne n'applique ne protège personne.*

L'adresse est désormais portée par un **vrai lien** (`<a href="sms:…">`), donc
lisible dans la page — c'est ce qui la rend vérifiable, et c'est le seul moyen
qu'un contrôle voie ce que la messagerie du patron voyait seule, trop tard. Le
partage reste offert à part, pour WhatsApp ou Signal.

**Le second se corrige au même endroit.** Le canal venait de la fiche du client
et ne se rediscutait plus au moment d'envoyer. Les deux voies sont maintenant
offertes sur l'écran « Devis prêt », et si la coordonnée manque, elle **se
saisit sur place** puis est conservée sur la fiche : aucun autre écran ne
permet de la renseigner, et renvoyer le patron « sur la fiche du client »
l'enverrait vers une porte qui n'existe pas.

**Un troisième défaut est tombé au passage**, trouvé par le contrôle neuf :
l'écran lisait la coordonnée dans **l'instantané figé du devis**, si bien
qu'une adresse tout juste enregistrée n'apparaissait jamais. Il lit maintenant
la fiche vivante du client.

### « 1 journée », pas « 1 jour »

Le patron, sur capture : « ce chantier va durer **1 journée**, pas jour ». Il a
raison — on dit « ça prend une journée », jamais « ça prend un jour ». La
première entrée de la liste des durées est corrigée.

Une seconde faute dormait à côté, jamais vue à l'écran parce qu'elle ne
s'affiche que sur une journée et demie : `libelleDuree(3)` rendait « 1 jours et
demi » — deux fautes en trois mots. Elle dit maintenant « une journée et demie ».

### Le même défaut survivait sur un numéro tel qu'il est saisi

Corriger l'écran ne suffisait pas. La fiche du client enregistre le numéro **tel
qu'il est écrit** — « 06 12 34 56 78 », espaces compris, puisque c'est la forme
que propose le champ. Ces espaces partaient tels quels dans l'adresse `sms:`, où
ils deviennent `%20` : l'application de messagerie n'y reconnaissait plus un
numéro et rouvrait un message **sans destinataire**, exactement le défaut qu'on
venait de traiter.

Aucun contrôle ne pouvait le voir, ni les anciens ni le neuf : tous employaient
un numéro collé (« 0679984514 »), sur lequel il est invisible. Les nouveaux cas
emploient la forme réelle — espaces, points, tirets — et ont été confrontés au
défaut réintroduit pour vérifier qu'ils savent échouer.

*La leçon, à côté de celle du jour :* un contrôle qui n'emploie pas la donnée
**sous la forme où l'utilisateur la saisit** ne prouve rien de ce qui lui
arrive.

### Il n'y aura pas de fournisseur SMS ni d'e-mail — décision du patron

Ses mots : *« ça sera plus rassurant, même pour les patrons, de passer par leur
e-mail et par leur numéro de téléphone. »* Ce n'est donc plus un pis-aller en
attendant un prestataire : c'est le chemin retenu.

Le point 5 de `docs/A-FAIRE.md` cesse de bloquer — ne restent que des conforts
(relance automatique, accusé de réception, code SMS) — et la décision **allège**
les points 2 et 3 : aucune donnée de client ne transitant chez un tiers, il n'y
a aucun sous-traitant de plus à autoriser ni à faire contractualiser.

Écartée du même coup, et pour de bon : **joindre le PDF au message**. Ni `sms:`
ni `mailto:` ne portent de pièce jointe, et l'API de partage qui le peut n'a pas
de destinataire. Surtout, ce serait nuisible — chez Atlas le devis est **la
page**, pas le PDF : un client qui répond sur la pièce jointe ne choisit pas sa
date et ne laisse aucune trace d'acceptation. Voir `ARCHITECTURE.md` §13.


---

## 2026-08-03

### La production refuse enfin de démarrer avec l'IA simulée

`src/server/env.ts` refusait déjà le stockage local, un `CRON_SECRET` faible et
l'absence de Redis en production — au nom de la règle inscrite dans son propre
en-tête : jamais de repli silencieux vers un comportement de développement.
L'IA simulée était le seul oubli qui passait en silence.

Trois chemins y menaient, tous muets : laisser `LLM_PROVIDER` /
`TRANSCRIPTION_PROVIDER` à leur défaut, écrire « dev » explicitement, ou faire
une **faute de frappe** dans le nom du fournisseur — les fabriques retombent sur
`dev` par leur `default:`. Un quatrième cas restait ouvert : un fournisseur réel
sans sa clé, qui ne se découvrait qu'à la première dictée.

L'application refuse désormais de démarrer dans les quatre cas, avec un message
qui nomme la variable en cause et renvoie à `docs/A-FAIRE.md` §1. Ce que ça
évite : le patron dictant sur un vrai chantier et recevant
« [Transcription simulée — 48000 octets reçus] » au lieu de ses mots. En
développement et sur le banc d'essai, rien ne change : le mode simulé y reste le
fonctionnement normal, et un test le garde.

Le contrôle a été confronté à ce qu'il prétend détecter : les six tests de
`scripts/test-env.ts` qui le couvrent virent au rouge quand on retire le
garde-fou.

### Les tarifs d'IA se relèvent maintenant à leur source

`docs/TRANSCRIPTION.md` ne portait aucun chiffre, et le disait : le mandataire
réseau de l'environnement de développement répond `403 Forbidden` sur les pages
tarifaires de tous les prestataires. À la question « combien ça me coûterait ? »,
la seule réponse honnête était « je ne peux pas savoir ».

`.github/workflows/relever-tarifs-ia.yml` déplace la mesure vers une machine qui
a le réseau — le même remède que `pages.yml` pour le site publié,
`banc-essai.yml` pour l'espace de travail et `relever-palette.yml` pour les
modèles du patron. Le script ne devine rien : une page injoignable est rapportée
comme telle avec son adresse, et il sort en échec si aucune source n'a pu être
lue.

Deux sources passent déjà depuis l'environnement de développement (Anthropic via
`docs.claude.com` — la page commerciale, elle, reste refusée ; et Google Speech-
to-Text). De quoi chiffrer un mois d'Atlas au volume du patron : **2 à 8 $**,
transcription comprise. Le prix ne décidera donc pas — ce sont les trois
questions RGPD qui décident, et `TRANSCRIPTION.md` §7 le dit maintenant avec des
chiffres à l'appui plutôt qu'en s'en excusant.

### Le tableau des prestataires de transcription disait vrai pour un seul

`docs/TRANSCRIPTION.md` annonçait trois prestataires « déjà écrits et prêts à
être activés » : OpenAI, Deepgram, Google. En réalité seul OpenAI l'est.
`src/server/ai/providers/transcription/deepgram.ts` et son voisin `google.ts`
sont des coquilles de quatorze lignes qui répondent « fournisseur non
implémenté » à chaque appel.

Ce que ça évitait : le patron doit choisir un prestataire, ouvrir un compte et
faire rédiger un contrat de sous-traitance avant de brancher quoi que ce soit
(point 1 de `docs/A-FAIRE.md`). Un tableau qui coche Deepgram lui aurait fait
dépenser cet argent et ce temps pour découvrir la panne au premier essai — après
la signature, pas avant.

Le tableau dit maintenant lequel est écrit et lesquels ne le sont pas, avec la
demi-journée que coûte chacun des autres. La même correction vaut pour la liste
d'étapes du jour où il tranche : écrire le raccordement est devenu l'étape 1,
sautée seulement si le choix tombe sur OpenAI.
### Le message du client arrivait dans le vide — et il n'avait que deux boutons

Le patron : « si le client remarque une faute, il doit pouvoir avoir une ligne
pour écrire et renvoyer le devis pour correction ».

**Deux défauts, dont un invisible.**

1. Le client n'avait que deux issues : accepter, ou ne pas donner suite. Celui
   qui repère une coquille ne veut ni l'une ni l'autre. Il touchait donc « Je ne
   donne pas suite », et le patron lisait « Le client n'a pas donné suite » — un
   chantier perdu pour une faute de frappe.
2. **Le champ pour écrire existait déjà**, intitulé « Une précision ?
   (facultatif) ». Le client y écrivait — la capture du patron montre « Le devis
   comprend une fautes » — c'était enregistré dans `precision_client`… et
   **aucun écran ne l'affichait jamais**. Le message partait dans le vide. C'est
   le plus coûteux des deux, parce que rien ne le signale.

**Ce qui change.** Une troisième issue, « Une correction avant d'accepter »,
inactive tant que rien n'est écrit — une demande muette obligerait le patron à
rappeler, c'est-à-dire à refaire l'aller-retour que ce parcours supprime. Le
champ devient une zone de texte, s'intitule « Une erreur, une question, une
précision ? » et annonce que l'artisan lira le message tel quel.

**Et le message arrive.** Il s'affiche entre guillemets, dans la carte de
l'accueil et sur l'écran Devis — pas derrière une pastille : c'est la seule
chose qui dise au patron quoi faire, et un geste de plus pour la lire serait un
geste de trop. Il accompagne aussi les refus (« trop cher ») et les
acceptations (« plutôt le matin ») ; une acceptation muette sur une date
proposée, elle, continue de ne déranger personne.

Nouvel état `Correction demandée`, distinct de `Devis retourné` : le chantier
est presque acquis, il ne tient qu'à une reprise. Le bouton dit alors
« Corriger et renvoyer ».

La base tient sa part : une correction sans message y est refusée par contrainte
(migration 0020), indépendamment du code.

### La durée du chantier se choisit à la molette, jusqu'à 100 jours

Sa demande : « au lieu de rajouter des jours à chaque fois, mettre une bande
déroulante qui fait défiler le nombre de jours (100 max) — si un chantier dure
20 jours ce sera plus simple et prendra moins de place ».

Les quatre boutons deviennent une liste déroulante : ½ journée, puis 1 à
100 jours. Sur son téléphone, c'est exactement la molette qu'il décrit, elle
occupe une seule ligne, et elle répond au lecteur d'écran — ce qu'une bande
écrite à la main n'aurait pas fait. Au-delà de trois jours, une phrase annonce
combien de jours ouvrés seront réservés : un chantier long bloque beaucoup de
jours d'affilée, c'est juste mais invisible.

### Le planning compte en demi-journées, et le patron peut avoir plusieurs équipes

Sa question :

> « J'ai déjà un chantier le 6 août, donc pour mon nouveau client on ne propose
> pas le 6 août. Mais si mon 1er chantier du 6 ne dure que le matin, je ne peux
> pas caler une autre demi-journée l'après-midi. »
> « Si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers, voire plus,
> le 6 août. »

Trois pistes lui ont été présentées pour chaque moitié du problème. Il a retenu
la durée en demi-journées (« la demi-journée suffit ») et le compteur d'équipes,
et il a écarté les heures réelles. Le détail des choix est dans
`ARCHITECTURE.md` §22 — pour que personne ne rouvre le débat dans trois mois.

**Ce qui change.** Un jour porte deux demi-journées ; chacune tient autant de
chantiers que l'entreprise a d'équipes (réglable dans Réglages, une par défaut).
Un chantier occupe une suite de demi-journées à partir d'un départ que le
planning choisit — matin de préférence, après-midi sinon. L'écran d'envoi porte
désormais la durée du chantier, reprise de la dictée et corrigible d'un doigt :
elle commande les jours proposables.

**Un troisième défaut, que personne n'avait signalé.** La durée dictée
(« 2 jours ») n'entrait **nulle part** dans la planification : seul le chiffrage
la lisait. Un chantier de deux jours calé le 6 laissait donc le 7 proposable au
client suivant. Il bloque maintenant les deux.

**Ce que le client voit n'a pas bougé d'un iota**, et c'était sa consigne :
« mon client ne doit pas être informé de la demi-journée, seulement moi ; lui
verra le 6 août ». La page publique ne reçoit toujours que des dates. Un
contrôle inspecte le contenu sérialisé et échoue si « matin », « après-midi »,
« créneau » ou « durée » y apparaît.

**Le piège de la migration, et comment il est fermé.** Les chantiers déjà
planifiés n'ont ni créneau ni durée. Les lire comme « rien de réservé » aurait
libéré, du jour au lendemain, des après-midis déjà pris — et le patron se serait
retrouvé avec deux clients au même endroit. Ils sont donc traités comme une
journée entière, exactement ce qu'ils étaient.

**Ce que j'ai cassé en cours de route, et que la batterie a vu.** J'avais rendu
les samedis non retenables, alors que les autoriser était un choix délibéré :
on ne *propose* jamais le week-end, mais un client qui en demande un doit
pouvoir l'obtenir. Deux suites sans rapport ont viré au rouge sur des dates qui
tombaient un samedi. Corrigé, et écrit noir sur blanc dans le code.

### Le devis qui doublait tout seul

Le patron : « lorsque je clique sur la touche retour de mon navigateur et que je
reviens sur la page, ça me compte deux prestations, donc le prix du devis a fait
×2 tout seul ». Sa capture : **4 017,60 € TTC**, soit 3 348 € HT — deux fois
1 674 €.

Reproduit à l'identique, au centime près. La cause n'était pas un calcul faux,
c'était **un bouton sans mémoire** : « Ajouté au détail » vivait dans le
navigateur. Un retour arrière, un rechargement, un onglet rouvert, et l'écran
réaffichait « Ajouter au détail » alors que la ligne était déjà là. Un seul
appui suffisait. L'application avait invité l'erreur, puis l'avait exécutée sans
un mot — pire qu'un calcul faux, parce que rien ne le signale : le total paraît
simplement plus élevé que prévu, et ce total part au client.

L'état vient désormais **du détail lui-même** (`src/lib/proposition-au-detail.ts`),
plus du navigateur : le bouton dit « Déjà au détail », il est inerte, et une
phrase indique la sortie — modifier la ligne existante. Le serveur applique la
**même fonction** et refuse de son côté : une page laissée ouverte, deux appuis
pendant que le premier voyage, et l'écran ne protège plus rien.

Trois contrôles, à trois hauteurs : la règle (`test-proposition-au-detail.ts`),
le refus serveur (`test-prix-doublon-serveur.ts`), et **le geste exact du
patron rejoué dans un navigateur** (`test-devis-doublon-e2e.ts`). Les deux
premiers ont été confrontés au défaut d'origine : ils virent au rouge.

### « Fin de chantier » était injoignable sur un chantier planifié

« Le chantier est planifié mais je dois pouvoir retourner dessus une fois
terminé pour cliquer sur chantier fini — pourquoi n'y ai-je pas accès ??? »

Parce que la clôture n'existait que dans l'onglet **Terminés**, où un chantier
n'entre qu'une fois sa **date d'intervention passée**. Le sien était prévu deux
jours plus tard : la facture était donc réellement injoignable, et sa fiche
disait « rien à faire pour l'instant » sans indiquer ni où ni quand cela
changerait.

La fiche du chantier porte maintenant, en haut à droite comme il l'a demandé,
un bouton **« Fin de chantier → »** dès que le chantier est planifié. Aucune
barrière de date, délibérément : un chantier se finit parfois plus tôt, et c'est
le patron qui sait quand il est fait. Le geste reste sans danger — la fonction
appelée est idempotente, exige un devis réellement envoyé, et n'émet rien : elle
bâtit la facture qu'il vérifiera (arrêt 3). L'émission, elle, reste son geste,
et c'est elle qui alimente le relevé de TVA.

Le message d'attente dit enfin quelque chose d'utile : la date prévue, et le
geste suivant.

### La dictée arrive entière à l'écran

Le patron a écrit trois lignes et photographié ce qu'Atlas en avait fait :

    Taille de haie laurier 20 m linéaires
    Abattage chêne mort, couper le bois en 50 cm fendre laisser sur place
    Estimation 2 jours 2 hommes broyeur plus camion plus fendeuse

L'écran lui rendait **une** prestation au libellé collé (« Taille de haie
laurier 20 m linéaires⏎Abattage chêne mort »), « Rien de détecté dans la
dictée » en face du matériel, et « Non mentionné » en face des déchets. Son
verdict : « ça n'a rien à voir ».

Quatre fautes, toutes silencieuses :

1. **le découpage ignorait les retours à la ligne.** Une dictée met un élément
   par ligne ; deux prestations se retrouvaient dans un seul libellé ;
2. **un segment contenant la durée ou l'équipe était jeté en entier.** Sa
   troisième ligne portait tout son matériel — broyeur, camion, fendeuse — et
   elle a disparu sans laisser de trace ;
3. **le vocabulaire du matériel était celui d'un plaquiste** (plaque, rail,
   colle, enduit) dans une application faite pour un élagueur. Les unités (m²,
   kg) y figuraient aussi : « 20 m² de débroussaillage » finissait classé en
   matériel ;
4. **« bois » comptait comme un déchet.** Pour un élagueur, le bois est sa
   matière : « couper le bois en 50 cm, fendre, laisser sur place » — du travail
   facturable — basculait tout entier en gestion des déchets.

Les quatre sont corrigées. La même dictée rend maintenant trois prestations,
trois matériels, « laisser sur place » en gestion des déchets, la durée et
l'équipe — et ne réclame plus une information qu'il avait donnée.

**Ce qui empêchera la rechute.** Une heuristique ne comprendra jamais un
chantier ; ce qu'on peut exiger d'elle, c'est de ne rien perdre.
`scripts/test-analyse-dictee.ts` tient donc un invariant mot à mot : **aucun mot
dicté ne disparaît**, avec la liste explicite des mots de liaison qu'on
s'autorise à absorber. Il a été confronté aux deux défauts d'origine, qu'il
rattrape ; il en a aussi trouvé un troisième que personne ne cherchait —
`jours?` se déclenchait à l'intérieur de « journée », et « Une journée » laissait
une prestation nommée « née ».

**Ce que cela ne règle pas, et qu'il faut dire.** Ce découpage reste une
heuristique : il ne comprend rien, il se contente de ne rien jeter. La vraie
lecture d'une dictée demande un modèle de langage, et donc le choix de
prestataire qui attend le patron dans `docs/A-FAIRE.md`.

### Écrire le devis soi-même, depuis l'écran Informations

Demandé dans le même message : « je dois pouvoir cliquer sur mon devis et
pouvoir le remplir manuellement si je le souhaite ». L'écran Informations n'avait
qu'une sortie — « Valider et calculer le prix → » — qui passe par la proposition
automatique. Après une extraction ratée, c'était le seul chemin, et il menait au
même endroit.

Un second lien, « Ou écrire le devis moi-même → », mène directement à l'écran
Prix, qui **est** le devis en cours de rédaction. Il ne marque pas les
informations comme vérifiées — le patron quitte cet écran sans le trancher, et
la fiche du chantier ne doit pas prétendre le contraire. La proposition de prix
y arrive repliée, jamais supprimée : un lien la rappelle s'il change d'avis.

### L'adresse d'Atlas est écrite par la machine, plus recomposée par le patron

Le mode d'emploi lui donnait `https://<nom-de-l-espace>-3000.app.github.dev`.
Il a répondu : « Je comprends pas ce que je dois faire avec ça ». Il avait
raison — on lui demandait de deviner un morceau d'adresse, au doigt, sur six
pouces, alors que l'espace de travail connaît son propre nom.

`.devcontainer/demarrer.sh` compose désormais l'adresse complète à partir de
`CODESPACE_NAME` et `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`, l'affiche dans
un cadre au démarrage et la dépose dans `/tmp/adresse-atlas.txt` — le terminal
défile, pas le fichier. Hors Codespace, où ces variables n'existent pas, le
script n'annonce rien plutôt que d'inventer une adresse fausse ; les deux cas
ont été joués.

Le mode d'emploi ne porte plus aucun gabarit à remplir : une adresse
d'exemple complète, la consigne de la mettre en favori dès la première fois, et
— pour qui ne l'a pas fait — un tableau qui montre les deux caractères à ajouter
à l'adresse de l'éditeur, plutôt qu'une phrase à interpréter.

### « Déconnecté de codespace » ne veut pas dire « Atlas est en panne »

Le patron a envoyé une capture de son téléphone : *The workbench failed to
connect to the server (Error: deadline exceeded)*, et en bas **« Déconnecté de
codespace »**. Un seul mot avec : « Problème ».

Ce n'était pas Atlas — c'était l'éditeur qui n'avait pas réussi à joindre
l'espace de travail réveillé de sa veille. Mais rien dans `docs/ESSAYER.md` ne
le disait : la section de dépannage couvrait la page blanche, `Missing script`,
`EADDRINUSE`, le port pris — jamais l'éditeur lui-même. Le patron n'avait donc
aucun moyen de savoir que **l'éditeur ne lui sert à rien pour ouvrir Atlas** :
l'application démarre seule à chaque allumage, et son adresse est ouverte.

Le cas est écrit, en tête de la section de dépannage puisque c'est la première
chose qu'il voit : recharger, rouvrir depuis `github.com/codespaces`, et surtout
aller droit à `https://<nom-de-l-espace>-3000.app.github.dev` sans attendre
l'éditeur.

### Le devis est enfin celui du patron

Le patron a ouvert le PDF d'Atlas à côté de celui qu'il avait construit
lui-même pour Arborea : « le devis n'a rien à voir avec celui qu'on a fait pour
arborea, je veux exactement le même, et même à l'impression ce n'est pas le
même ». Il avait raison — Atlas alignait quelques lignes de texte là où son
modèle portait un en-tête, un titre centré, deux colonnes émetteur/client, un
tableau réglé, un bloc de totaux, ses conditions de paiement et un cadre de
signature.

`src/server/pdf/devis-pdf.ts` reproduit désormais `appli/devis-modele.html` :
même ordre, mêmes libellés, mêmes montants à la française — « 1 400,00 € » et
non « 1400.00 EUR ». Les accents ont été rendus aux intertitres (« ÉMETTEUR »,
« QTÉ », « MODALITÉS DE PAIEMENT ») et à la mention légale, qui reprend mot pour
mot celle du modèle. Les petites capitales sont espacées comme en CSS, lettre
par lettre : pdf-lib ne sait pas le faire autrement, et sans cela le document
perdait exactement ce qui le rendait reconnaissable.

**Le détail qui n'était pas demandé, et qu'il fallait quand même régler :** un
devis d'une vingtaine de lignes — un chantier sur plusieurs arbres, rien
d'extravagant — écrivait par-dessus la mention légale et le cadre de signature.
Le devis se pagine, chaque page du tableau reporte son en-tête de colonnes, et
la numérotation n'apparaît qu'à partir de deux pages : le modèle n'en porte pas,
mais une feuille de devis peut se perdre.

**Ce que ça a demandé pour être vérifiable.** Un PDF ne se relit pas, et un
intertitre écrit lettre par lettre ne se retrouve même pas dans son flux.
`composerDevisPdf` renvoie donc le PDF *et* la trace de ce qu'il a déposé —
textes, traits, cadres, avec leurs coordonnées et leur page.
`scripts/test-devis-pdf.ts` l'interroge, dix contrôles, dont celui qu'aucun coup
d'œil sur la première page ne remplace : aucune ligne ne descend sur le cadre de
signature. Chacun a été confronté au défaut qu'il prétend détecter avant d'être
acté ; le premier jet cherchait « EUR » n'importe où et accusait « ÉMETTEUR ».

### Le détail quitte la page du client, et le PDF devient accessible

Le patron a confirmé : plus de détail sur la page, « de toute façon le client
aura le détail dans le PDF joint au mail ». Le tableau est retiré — sa page
montre le numéro, le client, l'adresse et les trois totaux.

**Sa prémisse ne tenait pas, et c'était le point qui comptait.** Rien n'est
joint au message : le partage n'envoie que le titre et le texte
(`navigator.share` sans `files`), et un `mailto:` ne peut porter aucune pièce.
Le client ne reçoit qu'un **lien**. Retirer le détail sans rien d'autre l'aurait
laissé accepter un total sans pouvoir consulter ce qu'il paie nulle part.

Le devis complet est donc servi par son jeton — `/devis/<jeton>/pdf`, mêmes
garanties que la page : contexte RLS posé par le jeton, lien expiré sans effet,
et **seul le PDF archivé à l'envoi** est rendu, jamais une reconstruction. Un
jeton inconnu et un jeton expiré donnent le même 404.

**Un défaut du banc d'essai trouvé en parcourant le lien** : le devis de
démonstration était marqué « envoyé » sans qu'aucun PDF n'ait été archivé — le
lien renvoyait 404. Le seed archive désormais la pièce comme le fait `envoyerDevis`
en vrai. C'est la deuxième fois que ce même devis de démonstration se contredit ;
il fallait le corriger à la source plutôt que de l'expliquer.

### La page du client montre les totaux, le détail se déplie

Le patron a demandé de retirer le détail du devis pour n'afficher que Total HT,
TVA et Total TTC. C'est fait **sur la page que son client ouvre** : elle tient
désormais sur un écran, les trois totaux au premier regard.

**Le détail n'est pas supprimé, il est replié** derrière « Voir le détail des
prestations » — un `<details>` natif, qui s'ouvre sans JavaScript. Deux raisons,
et elles ne sont pas décoratives :

- Le client engage son accord sur **le contenu exact** : la mention au bas de la
  page le dit, et l'acceptation conserve l'empreinte du document. Lui demander
  d'accepter un total sans pouvoir consulter ce qu'il paie retournerait contre
  le patron le jour d'un litige.
- Un devis de travaux doit porter le **décompte détaillé** de chaque prestation,
  en quantité et prix unitaire (arrêté du 2 mars 1990). **Le PDF n'a donc pas
  été touché** — c'est lui, la pièce qui engage.

Le patron a été informé de cette limite avant que le travail ne soit fait, et
il peut demander la suppression complète en connaissance de cause.

### « Aucune des deux » quand il n'y en avait qu'une

Trouvé en sortant, à la demande du patron, le visuel de la page que son client
ouvre. La question des dates y proposait toujours « Aucune des deux — je
propose : », que le patron ait envoyé une date ou deux. Le libellé était écrit
en dur.

Or c'est exactement le choix qu'il fait avant l'envoi — l'arrêt 1 de
`docs/AGENT.md`, sa seule question avant que le devis parte. Avec une seule
date, son client lisait donc une phrase qui ne correspondait pas à ce qu'il
avait sous les yeux, sur la **seule** page qu'il voit.

Le libellé s'accorde désormais : une date, deux, davantage, ou aucune. La règle
est une fonction pure dans `src/lib/` — l'importer depuis l'écran entraînait
toute la chaîne de connexion à la base, ce qui la rendait intestable.

### L'accueil prend la carte d'Arborea, la barre du bas reste

Les deux formes ont été rendues au patron en photos, côte à côte, avec ce que
chacune coûte. Sa réponse : **la barre du bas reste** (elle se touche d'une main
sur un chantier, quand celle d'Arborea défile et sort de l'écran), et **l'action
principale prend la carte** — rond d'icône, titre en Playfair, sous-ligne,
flèche.

Le refus est écrit au même titre que le changement (`ARCHITECTURE.md` §21) :
sans cela, une prochaine conversation verrait une incohérence avec la charte
d'Arborea et « corrigerait » la barre, en défaisant un choix délibéré.

Deux écarts assumés avec le modèle : la sous-ligne décrit le parcours réel — « Le
client, l'adresse, puis la dictée sur place » — et l'icône est un `+`, pas un
micro. Chez Arborea la carte ouvre l'écran de dictée ; ici elle ouvre un
formulaire, et un micro y serait une petite tromperie répétée à chaque ouverture.

### Le devis à 0 € ne part plus, et l'écran dit par où sortir

Quand aucun tarif ne correspondait, l'écran Prix affichait « Aucun prix
proposable » puis « Aucune ligne pour l'instant » — et laissait « Préparer le
devis → » actif. Le patron pouvait valider un prix inexistant, arriver sur un
devis à **0,00 €** et l'envoyer à son client. Aucun garde-fou nulle part. Un
devis accepté étant immuable, le corriger aurait demandé une nouvelle version.

Le bouton est désormais grisé, et surtout **l'écran dit quoi faire** : ajouter
une ligne avec son montant, ou enregistrer un tarif — avec un lien direct vers
Réglages. Un bouton grisé sans explication se lit comme une panne, et le patron
l'avait déjà conclu sur l'écran de dictée.

La règle est une **fonction pure** employée par l'écran *et* par l'action
serveur (`CLAUDE.md` §3) : un écran ne protège rien seul, et une seconde
implémentation de la même règle aurait fini par diverger. Elle attrape aussi le
cas plus sournois des lignes qui existent mais totalisent zéro.

**Un défaut trouvé en lançant l'application, que types et lint ne voyaient
pas :** la classe d'erreur avait été exportée depuis un fichier `"use server"`,
ce qui annule **tous** les exports du module — l'application entière renvoyait
500. Consigné comme piège n° 7 dans `HANDOVER.md`.

### Les modèles du dépôt sont bien ceux du patron — vérifié, pas supposé

Le patron a demandé de récupérer exactement le modèle qui se trouve sur son
site Arborea-, plutôt qu'une reproduction. Avant de reprendre quoi que ce soit,
un contrôle est allé chercher les six fichiers publiés et les a comparés octet
par octet à ceux de `appli/`.

**Le modèle de facture est identique** — 26 445 octets de part et d'autre.
Celui dont le PDF vient d'être bâti est donc déjà exactement le sien : il n'y
avait rien à récupérer. Quatre autres modèles sont identiques eux aussi.

Le seul écart concerne le modèle de devis, et c'est une **avance** : la copie
d'ici contient 2 717 octets de plus, le message d'accompagnement de l'envoi
ajouté à dessein. Le reprendre en ligne le supprimerait.

Cela clôt une question qui a coûté deux explications fausses : elle se mesure
désormais au lieu de se supposer, et le contrôle se rejoue
(`ARCHITECTURE.md` §20).

### La facture a enfin son document

Le devis produisait un PDF ; la facture, non — seulement un écran de
confirmation. Le patron validait donc un montant sans avoir jamais vu la pièce
que son client recevrait, alors que c'est précisément ce que l'arrêt 3 lui
demande de vérifier.

La facture a maintenant son PDF, sur le modèle `appli/facture-modele.html` :
numéro, date d'émission, date d'échéance, rappel du devis d'origine, mentions
légales de retard de paiement — et **aucun cadre de signature**, une facture se
règle. Un lien « Voir la facture en PDF » l'ouvre depuis l'écran.

**Une seule mise en page pour les deux pièces.** Plutôt que de copier cinq cents
lignes, le moteur a été extrait dans `document-commun.ts`. La refonte a été
prouvée sans effet : le devis rendu avant et après est identique **au pixel
près**.

**Un piège évité, et il aurait été coûteux :** le modèle porte la mention « TVA
non applicable, art. 293 B du CGI » avec la consigne « à retirer si vous êtes
assujetti ». Elle ne s'imprime désormais que si le taux appliqué est nul — une
facture qui annonce « TVA (10 %) » et la franchise dans la même page est une
facture fausse.

Onze contrôles, chacun confronté au défaut qu'il prétend détecter : cadre de
signature ajouté, échéance inventée, franchise annoncée à tort, rappel du devis
retiré, mention de pénalité amputée. Chacun a rougi en désignant le bon coupable.

Détail dans `ARCHITECTURE.md` §19.

### L'application reprend la charte d'Arborea

Le patron a fourni l'adresse de son Arborea d'origine et posé la bonne
question : pourquoi le style de ce site ne correspond-il en rien à
l'application ? Réponse mesurée : deux chartes coexistaient sans que personne
l'ait décidé. Atlas s'était donné un accent terre cuite et les polices du
système ; les maquettes gardaient le vert pin, Playfair Display et Inter.

Sa décision : **l'application reprend Arborea, les documents gardent la terre
cuite.**

| | Avant | Après |
|---|---|---|
| Accent | terre cuite `#B25A2E` | **vert pin `#2f3b2f`** |
| Fond | `#F6F1E6` | `#f5f3ee` |
| Titres | Arial Narrow | **Playfair Display** |
| Texte | polices système | **Inter** |
| Devis, facture | terre cuite | **terre cuite, inchangée** |

Les valeurs viennent du relevé automatisé sur son site publié, pas d'une
approximation à l'œil. Les polices sont rapatriées au build : les charger chez
Google serait bloqué par la politique de sécurité, et l'artisan verrait les
polices de repli de son téléphone.

Détail des choix, et de ce qui n'a **pas** été aligné, dans `ARCHITECTURE.md` §18.

### Terre cuite : le patron a choisi, les deux versions sous les yeux

Les deux devis lui ont été rendus côte à côte, même contenu, seule la teinte des
intertitres changeant, avec l'origine de chacune — terre cuite de son Arborea
d'origine, vert de la page encore en ligne. Réponse : « je veux terre cuite ».

Rien à changer dans le code, c'était déjà en place. Mais la couleur cesse d'être
une déduction tirée d'une capture pour devenir une décision, et elle est écrite
comme telle : une prochaine conversation qui découvrirait le vert en ligne
n'aura pas à la reposer.

### La cause annoncée était fausse : correction

J'avais écrit que « la copie versée dans `appli/` avait divergé de son
original ». C'est faux, et je l'ai vérifié plutôt que de le supposer une
seconde fois.

Un relevé automatisé (`relever-palette.yml`) ouvre le devis publié dans un vrai
navigateur et rapporte ce qu'il calcule. Il dit trois choses :

| Ce qui a été vérifié | Résultat |
|---|---|
| La page publiée, `…/Atlas-app/devis-modele.html` | intertitres en **vert** `#2f3b2f` |
| La copie du dépôt, depuis son premier commit | **le même vert**, jamais modifiée |
| Une page de devis à la racine du site du patron | **404** — il n'y en a pas |

Donc : la copie n'a pas dérivé ici. C'est la capture du patron qui montre une
version **qui n'est plus en ligne nulle part** — son Arborea d'origine, dont la
copie s'était écartée avant même d'entrer dans ce dépôt.

**Le choix de couleur reste le bon** : la terre cuite est bien celle qu'il
désigne en disant « voilà mon devis », et c'est l'accent qu'Atlas emploie
partout ailleurs. Ce qui change, c'est ce qu'on a le droit d'en dire : elle
repose sur sa capture, pas sur une page vérifiable. Quand la référence n'est
plus joignable, on l'écrit.

**Ce que le relevé a rapporté en prime**, et qui n'était vérifiable d'aucune
autre façon : la moitié basse du devis, que la capture ne montrait pas. Mention
légale, légende de signature, total final, en-têtes de colonnes — le devis
d'Atlas s'y conformait déjà.

Le mandataire de l'environnement de développement refuse `github.io`
(`403 à CONNECT — policy denial`, essayé et non supposé) et la fenêtre
d'autorisation ne s'affiche pas chez le patron. C'est pourquoi la mesure est
faite par une machine qui, elle, a accès — comme `pages.yml` et
`banc-essai.yml` avant elle. Détail dans `ARCHITECTURE.md` §17.

### Et la couleur n'était pas la bonne — la copie avait divergé

Le patron a renvoyé une capture de son devis tel qu'il le voit en ligne :
« ce n'est pas le style du devis ». Mesure faite sur ses pixels plutôt que sur
une impression d'œil — ses intertitres « ÉMETTEUR » et « CLIENT » sont en
`#a95c35`, une terre cuite, quand `appli/devis-modele.html` de ce dépôt leur
donne un vert `#2f3b2f`. **La copie prise chez Arborea avait déjà divergé de
l'original**, et je l'avais reproduite fidèlement — écart compris.

Cette terre cuite est, à l'antialiasing près, le `rust` `#B25A2E` que toute
l'application Atlas emploie déjà. Le devis s'y aligne, et son papier redevient
crème (`#faf9f5`) plutôt que blanc. Les couleurs posées entrent dans la trace :
un contrôle les constate désormais, au lieu qu'on les répète.

**La règle qui en sort, et elle vaut au-delà du devis :** la référence est ce que
le patron a sous les yeux, jamais notre copie de sa référence.

Détail des choix dans `ARCHITECTURE.md` §16.

---

## 2026-08-02

### Le dernier mètre existe : le message s'ouvre tout prêt

Le patron a demandé pourquoi le site Arborea réussissait à envoyer des e-mails
sans hébergeur ni nom de domaine, alors qu'Atlas n'y arrive pas. La réponse
était dans son propre code (`appli/devis-modele.html`) : **Arborea n'envoyait
rien**. Il ouvrait la boîte mail du patron avec le message pré-rempli, et c'est
lui qui appuyait sur Envoyer. Cette possibilité ne lui avait jamais été
présentée — une omission.

Elle est reprise : « Ouvrir le message tout prêt » sur l'écran du devis. Sur
téléphone, le menu de partage laisse choisir SMS, e-mail ou messagerie ; sur
ordinateur, l'application par défaut s'ouvre.

**Ce que ça débloque, et c'est le patron qui l'a vu :** la réponse du client ne
passe pas par l'e-mail — il répond sur la page web, et Atlas la voit en base.
Acceptation, planification, fin de chantier, facture et relevé de TVA sont donc
éprouvables dès aujourd'hui, sans abonnement ni nom de domaine.

Ce que ça ne donne pas, et qui reste au point 5 : Atlas ignore que le message
est parti, donc pas de relance automatique à sept jours.

Le message est une fonction pure (`src/lib/message-client.ts`), éprouvée par
sept contrôles : aucun montant n'y est répété — le prix vit dans le devis, et
deux endroits finiraient par se contredire le jour d'une reprise.

### La démonstration se contredisait à l'écran

« Devis non envoyé — le client n'a rien reçu », affiché sur un devis marqué
comme émis. L'écran ne mentait pas : la donnée de démonstration marquait le
devis envoyé sans jamais créer l'envoi. Deux notions se télescopaient — le
document émis, immuable, et le fait de l'avoir transmis.

Elle porte désormais un vrai envoi en attente de réponse, avec un lien client
ouvrable : le parcours de réponse s'éprouve dès l'ouverture, sans monter un
chantier complet d'abord.

### Un contrôle qui sait voir un élément recouvert — après deux fausses pistes

`isVisible()` de Playwright considère visible un élément caché derrière un
autre. C'est le trou par lequel sont passés trois défauts de ce projet, tous
trouvés en regardant une capture.

Les deux premières versions du contrôle accusaient à tort : l'une mesurait un
élément hors champ, l'autre l'amenait au bord de la fenêtre — c'est-à-dire
exactement sous la barre de navigation. La mise en page n'avait rien.

La version retenue ne dépend plus du défilement : reste-t-il, sous cet élément,
au moins la hauteur de la barre ? Sinon, aucun défilement ne le dégagera, et le
message dit combien de pixels manquent.

**La leçon, encore la même :** un contrôle qui échoue sur le mauvais motif ne
vaut pas mieux qu'un contrôle qui n'échoue jamais. Il a fallu deux corrections
pour qu'il dise vrai — et sans elles, un écran aurait été rembourré pour rien.

### Le devis se remplissait de prestations que personne n'avait dictées

Le patron a dicté une note vocale et retrouvé ceci dans son devis :

```
[Transcription simulée — fournisseu
1137980 octets reçus]
```

Deux prestations, fabriquées de toutes pièces. Et au-dessus, l'écran affirmait
« Proposé à partir de votre dictée » — d'où sa conclusion : *elle ne comprend
pas ce que je dis*. En réalité elle ne l'avait pas entendu.

**La chaîne complète.** Aucun prestataire de transcription n'étant raccordé
(point 1 de `docs/A-FAIRE.md`), le fournisseur de développement renvoie un texte
de remplacement. Ce texte était enregistré comme une transcription ordinaire,
puis découpé en segments par l'extraction — et chaque segment devenait une
prestation.

C'est l'interdit le plus net de ce dépôt (`CLAUDE.md` §4) : **ne jamais inventer
une prestation**. Il a fallu qu'un artisan le voie dans son devis pour qu'on
s'en aperçoive.

**Ce qui change.** Le texte de remplacement porte désormais un préfixe constant,
exporté et importé là où il faut le reconnaître — jamais une heuristique sur du
texte quelconque. La génération refuse alors de s'exécuter et n'écrit rien.
L'écran dit la vérité : la dictée est enregistrée mais n'a pas été transcrite,
et les prestations sont à saisir à la main.

**La garde est resserrée sur le texte, pas sur la configuration.** Une première
version testait le prestataire configuré : elle aurait bloqué aussi une
transcription légitime, et cassé les suites existantes. Une garde qui protège
trop large est un bouchon, pas une protection.

Cinq contrôles de non-régression, dont **un qui constate le défaut** — sans lui,
rien ne prouverait que la garde sert à quelque chose — et un qui vérifie qu'une
vraie dictée continue d'être analysée normalement.

## 2026-08-01

### L'écart d'origine allait dans l'autre sens — trois correctifs pour rien

Le patron a fini par lancer `npm run essai` lui-même et par coller la ligne que
le serveur écrivait depuis le début :

```
x-forwarded-host … 'xxx-3000.app.github.dev' does not match
origin header with value 'localhost:3000'
```

**C'est l'HÔTE qui porte l'adresse publique, et l'ORIGINE qui vaut
`localhost:3000`.** L'inverse de ce qu'on suppose spontanément — et de ce qui a
été supposé trois fois.

Conséquence : chaque correctif autorisait `*.app.github.dev` *en tant
qu'origine*, et l'alignement du middleware ne s'activait que pour ce domaine. Or
l'origine du patron est `localhost:3000` : la fonction ressortait à sa première
ligne, sans rien faire, dans tous les environnements.

**Et les épreuves simulaient la panne à l'envers de la vraie.** Elles passaient
au vert en corrigeant un défaut qui n'existait pas. C'est là que le temps a été
perdu : pas dans le code, mais dans un contrôle qui prouvait autre chose que ce
qu'il prétendait.

Ce qui change : l'alignement ne présume plus rien — ni du domaine, ni du sens de
l'écart. Hors production, l'hôte vu par Next devient celui qu'annonce le
navigateur, point. Et `verifier-connexion.mjs` rejoue exactement la combinaison
réelle : `x-forwarded-host` public, `Origin: localhost:3000`. Éprouvé dans les
deux sens — il échoue correctif désactivé, il passe correctif actif.

**La leçon, au-delà de ce défaut :** un contrôle éprouvé contre une panne
*imaginée* ne vaut rien, même s'il sait échouer. Ce qu'il faut reproduire, c'est
le message du serveur — pas l'idée qu'on s'en fait. Ici, il suffisait de le lire.

### Le correctif ne dépend plus d'aucun fichier de configuration

Troisième tentative sur le même défaut, et la leçon est là : **deux correctifs
de suite ont échoué parce qu'ils reposaient sur une variable déclarée dans
`.devcontainer/docker-compose.yml`.** Une variable écrite là n'existe pas dans un
espace de travail créé avant qu'elle n'y soit — et le correctif reste alors
inerte, sans le moindre message. C'est ce qui était arrivé à `CODESPACE_NAME`,
puis à `ATLAS_BANC_ESSAI`.

La condition ne tient plus qu'à `NODE_ENV`, que `next dev` pose lui-même. Aucun
fichier du dépôt n'a besoin d'être à jour pour que la connexion passe.

Éprouvé en retirant tous les filets : `allowedOrigins` vidé, `ATLAS_BANC_ESSAI`
absent. Rien d'autre que le correctif ne pouvait faire passer cette connexion —
et elle passe.

**Le contrôle distingue désormais deux causes qu'il confondait** : « l'origine
est refusée » et « la base n'est pas amorcée » n'ont rien à voir, et le second
cas s'est présenté en cours de route sous le premier message. Une épreuve a
failli être lue comme un échec du correctif alors qu'il venait de fonctionner.

### La connexion refusée : supprimer l'écart au lieu de l'autoriser

`allowedOrigins` ne suffisait pas. Le patron a recréé un espace de travail avec
tout le correctif précédent et a retrouvé « Invalid Server Actions request. »
mot pour mot — c'était sa vingtième tentative de la journée.

La configuration est pourtant correcte : l'algorithme de comparaison de Next a
été relu ligne à ligne dans `node_modules`, le joker `*.app.github.dev` couvre
bien l'adresse, et le contrôle passe en local. Il ne passait pas dans un vrai
Codespace, sans qu'on puisse reproduire pourquoi.

**Plutôt que d'ajouter une hypothèse de plus, l'écart est supprimé à la
source.** Le middleware aligne l'hôte vu par Next sur l'origine du navigateur :
il n'y a plus de désaccord à autoriser. Cela ne s'applique que si
`ATLAS_BANC_ESSAI` vaut 1 — posé par le seul docker-compose du banc d'essai,
jamais en production — et seulement pour un domaine de Codespaces.

Éprouvé en reproduisant la panne à volonté : `allowedOrigins` neutralisé, le
contrôle affiche « Invalid Server Actions request » ; avec le correctif, la
connexion passe. La cause est donc rattrapée quelle qu'elle soit.

**Et une page pour ne plus chercher à l'aveugle.** `/api/health/diagnostic`
affiche ce que le serveur voit réellement — origine, hôte, hôte transmis,
origines autorisées, variables d'environnement — et conclut par oui ou non sur
la possibilité de se connecter. Accessible sans session, à dessein : c'est quand
on n'arrive pas à entrer qu'on en a besoin. Une journée a été perdue faute de
pouvoir lire ces trois valeurs depuis un téléphone.

### La connexion était refusée derrière le proxy — et rien ne le voyait

**Invalid Server Actions request.** Voilà ce que le patron avait sous les yeux
en essayant de se connecter, une demi-journée durant. L'application démarrait
parfaitement ; elle refusait simplement d'ouvrir sa porte.

Next.js compare l'en-tête `Origin` à l'hôte avant d'accepter une action serveur.
Derrière le proxy de Codespaces les deux diffèrent, et `allowedOrigins` doit
donc être rempli. Il l'était — à partir de `CODESPACE_NAME`.

Sauf que le conteneur de l'application est décrit par un **docker-compose avec
une liste d'environnement explicite**, et que `CODESPACE_NAME` n'y figurait pas.
Une variable ne traverse pas cette frontière toute seule. À l'intérieur, elle
n'existait pas ; `allowedOrigins` restait vide ; toute action était refusée, à
commencer par le formulaire de connexion.

Deux corrections, parce qu'une seule ne suffit pas :

- La variable est désormais transmise au conteneur.
- **Et la connexion n'en dépend plus** : en développement, `allowedOrigins`
  accepte le domaine de redirection de façon générique. Le domaine de Codespaces
  varie, et une variable manquante ne doit plus pouvoir tout bloquer. En
  production, la liste reste vide — la protection est entière.

**Pourquoi aucune suite ne l'a vu.** Elles interrogent toutes `127.0.0.1`, où
l'origine et l'hôte coïncident : le défaut n'existait que derrière un autre nom
de domaine, c'est-à-dire uniquement chez le patron. `verifier-connexion.mjs`
comble ce trou — il se connecte dans un vrai navigateur en posant délibérément
une origine étrangère, et sans `CODESPACE_NAME`, l'état exact du conteneur en
panne. Éprouvé contre le défaut avant d'être ajouté : il échoue avec l'ancienne
configuration, il passe avec la nouvelle.

### L'application démarre seule : plus rien à taper

Quatre tentatives d'ouverture ont échoué d'affilée, **toutes sur le terminal, et
aucune sur l'application** : une commande tapée deux fois, un serveur arrêté
sans qu'on le sache, un espace endormi, un `Ctrl+C` demandé à quelqu'un qui n'a
pas de touche `Ctrl`. Le banc d'essai sert à essayer Atlas depuis un téléphone —
et on y faisait piloter un terminal au doigt.

`postStartCommand` lance désormais l'application à chaque allumage de l'espace,
veille comprise. Le patron n'a plus qu'une adresse à ouvrir.

Le contrôle du banc d'essai ne démarre plus rien de lui-même : il vérifie que
l'application répond **sans qu'aucune commande ait été tapée**. S'il échoue,
c'est qu'il resterait un geste à faire — précisément ce qu'on ne veut plus.

Un défaut trouvé en le lançant, pas en le relisant : `pkill -f "next dev"`
compare la ligne de commande entière de chaque processus, y compris celle du
shell qui joue le script. Le motif se trouvait lui-même et le script se tuait
avant d'avoir rien démarré. Les crochets de `[n]ext dev` l'évitent.

### Rien n'est acté valide sans avoir été éprouvé

Règle posée par le patron après trois bancs d'essai livrés « prêts » qui ont
échoué chez lui — script absent, application pas encore prête, port fermé. À
chaque fois le code était juste ; c'est le parcours qui ne l'était pas, et c'est
lui qui a fait le test.

Elle est désormais en tête d'`AGENTS.md`, lu à chaque conversation, et rappelée
dans `HANDOVER.md` — pas seulement dans `CLAUDE.md` §5, qu'on atteint après avoir
déjà commencé à travailler.

Appliquée à elle-même : le contrôle du banc d'essai a été confronté aux deux
états dégradés qu'il prétend détecter — base vide, puis schéma appliqué sans
données. Il échoue dans les deux cas, sort en erreur, et nomme la bonne cause.
Un contrôle qui n'a jamais échoué ne prouve rien.

Corrigé au passage : le message de fin de préparation promettait encore une
adresse joignable « tant que vous êtes connecté au même compte GitHub ». Le port
est public depuis, et cette phrase envoyait chercher un problème de compte là où
il n'y en avait plus. Il dit maintenant d'attendre la ligne « L'application
répond », et pourquoi n'y saisir que des données inventées.

### Installable sur un téléphone, et correcte une fois installée

Le patron a demandé si ce qu'il voyait pendant ses essais serait le design
final. Oui — même code, mêmes écrans. Mais la question a mis au jour deux
défauts et un manque, tous invisibles depuis un navigateur d'ordinateur.

**Les bords de l'écran.** Ajoutée à l'écran d'accueil, l'application s'ouvre en
plein écran : plus de barre d'adresse, mais plus de marges non plus. La barre
d'état recouvrait le titre « VOS CHANTIERS », et l'indicateur d'accueil mangeait
les libellés de la navigation. `viewport-fit=cover` et `env(safe-area-inset-*)`
règlent les deux ; posés sur `body`, ils servent aussi la page publique du
client, qui ne passe pas par la même mise en page. Vérifiés en simulant un
iPhone à encoche, pas en relisant le code.

**L'icône n'existait pas** — `"icons": []`. Un artisan qui aurait installé
l'application aurait vu une vignette grise. Elle est provisoire et assumée comme
telle : une icône provisoire qui cherche à bien faire donne l'illusion d'une
décision prise, et personne ne la remplace jamais. Toutes les tailles se
régénèrent d'un trait depuis une source unique (`npm run icones`) — un jeu
d'icônes retouché taille par taille finit toujours par diverger, et c'est la
moins regardée qui se retrouve fausse.

**Ce qui était relié à l'outil de fabrication iOS, c'étaient les maquettes
d'Arborea**, pas l'application. Le chemin « Ajouter à l'écran d'accueil » est
désormais prêt : il donne le même rendu qu'une application téléchargée, sans
compte Apple, sans Mac et sans validation. Il ne manque que l'hébergement.

### Le site public dit enfin ce qu'il est

Le patron a ouvert l'adresse publiée et demandé où étaient passées les autres
rubriques. Réponse : elles n'y ont jamais été. Ce site est la coque statique
reprise d'Arborea — cinq maquettes sans base ni serveur — et il en porte encore
le nom, tandis que l'application réelle n'est hébergée nulle part.

Un bandeau en tête de chaque écran le dit maintenant. Ce n'est pas un détail de
présentation : un site public qui se présente mal ne trompe pas les inconnus, il
trompe d'abord ceux qui savent ce qu'il devrait être — ici, celui qui le
finance.

La batterie de la coque accepte par ailleurs `PLAYWRIGHT_EXECUTABLE_PATH`, comme
le fait déjà `scripts/e2e-browser.ts` : elle était injouable dans les
environnements où le navigateur ne vit pas là où Playwright l'attend, ce qui
revenait à ne pas la jouer du tout.

### Caducité, compteur d'accueil, maquettes découplées

**Un lien périmé n'est pas un refus.** L'écran affichait « Devis retourné » dans
les deux cas — laissant croire à un refus qui n'avait jamais eu lieu, ce qui
décourage précisément de relancer. Les deux situations ont désormais leur état,
leur icône et leur phrase. Et un devis périmé **remonte à l'accueil** : sans
cela, le patron ne l'apprenait qu'en ouvrant la fiche du chantier, c'est-à-dire
jamais, puisque rien ne l'y ramenait.

**Le compteur d'accueil mentait doucement.** « N chantiers en cours » comptait
tout, y compris les chantiers réalisés et facturés — qui restaient d'ailleurs
affichés « planifié », un état qu'ils avaient quitté depuis longtemps. Deux
jalons de fin (`termine`, `facture`) et un compteur qui les exclut.

**Les maquettes `/design/*` sont découplées du produit.** Elles étaient typées
sur le `ChantierStatut` vivant : chaque nouvel état cassait cinq fichiers que
personne ne consulte. Pire, cette contrainte poussait insidieusement à ne pas
ajouter d'état pour s'éviter la corvée — un outil de conception ne doit jamais
peser sur les décisions du produit. Elles ont maintenant leur propre type, gelé.
`StatusIcon`, lui, est un vrai composant : il tire désormais son type de la
source vivante, dont il dépendait par accident via les données fictives.

### Suivi du devis parti — `07fa28c`

Le parcours savait tout et ne montrait rien. Un devis envoyé restait « devis
envoyé » indéfiniment : le patron voyait la même chose que le client réfléchisse
depuis une heure, qu'il soit sans nouvelles depuis trois semaines, ou qu'on lui
ait dit non. Le refus vivait en base et nulle part ailleurs.

- Cinq états, déduits par **une seule fonction pure** (`src/lib/etat-envoi.ts`) :
  en attente, à relancer (7 jours), caduc (lien expiré), retourné, accepté.
- Le planning ne propose plus de planifier soi-même un chantier dont le client
  choisit sa date — c'était préparer deux engagements sur le même jour. Il
  apparaît sous « En attente du client » plutôt que de disparaître.
- L'accueil annonce les refus, avec le **nom du chantier**. « J'ai vu » est un
  appui : une notification qui s'efface au premier coup d'œil se manque en
  faisant défiler l'écran.
- « Reprendre le devis » ouvre une nouvelle version sans toucher à celle qui est
  partie. Sans ce chemin, un chantier retourné l'était définitivement.

**Trois défauts corrigés au passage**, dont deux invisibles à la relecture :
l'adresse du lien était composée depuis le navigateur, donc différente de ce que
le serveur avait rendu (React régénérait tout l'arbre) ; l'état « envoyé » était
figé à l'ouverture de l'écran et survivait à une reprise de devis ; et une pile
de notifications repoussait les chantiers hors de l'écran.

### Lanceur de tests de bout en bout — `d54740f`, `4f15735`

Un passage de CI avait produit cinq suites en échec accusant chacune un écran
différent, alors qu'aucune n'avait pu charger la page de connexion : le serveur
était mort six minutes plus tôt et le lanceur ne le remarquait pas.

Le lanceur conserve désormais la sortie du serveur, l'interroge avant chaque
suite, et s'arrête net s'il ne répond plus. Le premier jet de ce contrôle
n'accordait que dix secondes et a déclaré mort un serveur simplement occupé à
compiler, faisant échouer un passage entier — corrigé à six tentatives réparties
sur une minute.

### Fin de chantier, facture et relevé de TVA — `d311752`

- Onglet « Terminés » : les chantiers dont la date d'intervention est **passée**,
  rangés par date. Le critère est cette date et non `termine_at` — sinon un
  chantier n'apparaîtrait qu'une fois déclaré terminé, c'est-à-dire jamais,
  puisque c'est là qu'on le déclare.
- « Fin de chantier » bâtit la facture depuis le devis et **s'arrête là**
  (arrêt 3). Idempotent : deux factures pour un chantier doubleraient la TVA.
- Le relevé de TVA se **calcule** à partir des factures émises, jamais stocké.
  Une table tenue en parallèle finirait par diverger de ce qui a été facturé.
- Immuabilité d'une facture émise posée par **trigger**, pas par convention —
  c'est ce qui rend le relevé stable.
- Migration `drizzle/0018_factures.sql`.

### Envoi du devis au client — `4c683f8`

La page publique de réponse existait, testée, mais **aucun chemin réel n'y
menait** : rien dans l'application ne créait le lien qu'elle attend.

- Bouton « Envoyer au client » et unique arrêt du parcours : *une date, ou deux
  au choix du client ?* Les jours proposés sont les jours réellement libres,
  relus à chaque ouverture.
- La chaîne était coupée un maillon plus tôt : aucun écran n'enregistrait le
  canal convenu avec le client. La création du chantier le recueille désormais,
  et le déduit quand une seule coordonnée est renseignée.

### Conformité RGPD — `6b8a8d1`

- Purge de l'audio sept jours après une transcription réussie, via la file
  `audios_a_purger`. Un balayage direct de `notes_vocales` aurait purgé **zéro**
  ligne, silencieusement : le planificateur n'a le contexte d'aucune entreprise.
- Export complet des données d'un client.
- Effacement qui **trie** au lieu de supprimer : les devis acceptés et le nom qui
  les rend valables survivent au titre de la conservation légale, tout le reste
  part, et le lien public est détruit dans tous les cas.
- Migrations `drizzle/0016_retention_et_effacement.sql`,
  `drizzle/0017_file_purge_audio.sql`.

### Documents tenus pour le patron — `9a461f0` → `a33201f`

`docs/QUESTIONS.md` (journal des questions et de leurs réponses) et
`docs/A-FAIRE.md` (points bloquants, avec leur propriétaire). Pages consultables
générées par `scripts/md-en-page.mjs`, sommaires cliquables. Règles de tenue
inscrites dans `AGENTS.md` pour survivre au changement de conversation.

### Page de réponse du client et cycle d'envoi — `ea815f2`

Seule surface publique du produit : devis et choix de date sur le même écran,
sans session. Jeton de 256 bits, expiration à 45 jours, calendrier borné aux
jours libres du patron, contre-proposition possible, case de rétractation quand
la date est proche. Migration `drizzle/0015_envois_devis.sql`.

**Correction critique du même lot :** le middleware remplaçait les en-têtes de la
requête par un objet vide, effaçant les cookies de session. Aucune erreur — 
l'application se comportait simplement comme déconnectée. 3 suites sur 19
passaient ; 19 sur 19 après correction.

### Cadrage de l'agent et documents légaux — `9ff1b16`

`docs/AGENT.md` (le parcours et ses arrêts), `docs/RGPD.md` (registre,
sous-traitants, conservation), et le mécanisme d'acceptation des documents
légaux avec empreinte SHA-256 du texte exact accepté.

## 2026-07-31

### Vérification du site publié — `bcd0e57`

Le workflow Pages vérifie le site **à son adresse publique** après déploiement :
chaque écran répond, la racine mène à l'application, et la batterie de tests est
rejouée contre l'adresse en ligne. L'environnement de développement ne peut pas
joindre `github.io` ; la vérification a donc été déplacée là où elle est
possible, plutôt que contournée.

### Reprise de l'application Arborea — `45b6d97`

Écrans, Capacitor et tests repris depuis `arborea-`, **sans le site vitrine**.
Publiée sur GitHub Pages.
