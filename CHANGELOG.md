# Historique des changements qui comptent

Ce qui a changé, et **ce que ça évite**. Les corrections de forme et les
ajustements de test ne figurent pas ici : `git log` les porte déjà.

Format : le plus récent en tête.

---

## 2026-08-09

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
