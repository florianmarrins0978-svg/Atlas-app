# Historique des changements qui comptent

Ce qui a changé, et **ce que ça évite**. Les corrections de forme et les
ajustements de test ne figurent pas ici : `git log` les porte déjà.

Format : le plus récent en tête.

---

## 2026-08-03

### Deux concurrents directs, trouvés en cherchant un nom

Le patron a demandé quel nom donner à l'application. « Atlas » n'avait jamais
été choisi ni vérifié — c'était un nom de travail, et le mot s'est révélé
massivement occupé dans les classes de marque du logiciel.

En vérifiant l'occupation des candidats, deux **concurrents directs** sont
apparus : `ouvra.app`, qui a pris un métier (plombiers-chauffagistes, catalogue
et TVA du secteur pré-remplis), et `fabro.app`, qui a pris l'absence de réseau
(100 % hors ligne, données sur le téléphone).

Consigné dans `PROJECT_STATE.md` parce que ce n'est pas une anecdote de
recherche de nom : une conversation qui croit le créneau vierge se trompera
d'arbitrage. Notre angle — la dictée et l'agent — reste distinct des deux, mais
il n'est plus une évidence qu'on peut laisser sans défense.

Le nom définitif n'est pas tranché : rien n'a été renommé.

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
