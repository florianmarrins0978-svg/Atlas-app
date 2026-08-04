# Historique des changements qui comptent

Ce qui a changé, et **ce que ça évite**. Les corrections de forme et les
ajustements de test ne figurent pas ici : `git log` les porte déjà.

Format : le plus récent en tête.

---

## 2026-08-04

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
