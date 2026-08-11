# Reprendre le travail

**À lire en premier, dans une nouvelle conversation.** Ce fichier suppose que
vous ne savez rien de ce qui précède — c'est exactement le cas de figure qu'il
sert.

**Point de reprise :** 2026-08-11 · `claude/migrate-app-atlas-zz31ac`
(l'historique fait foi : `git log --oneline -20`)

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

## Ce qui vient d'être terminé

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
3. **Ce qui n'a PAS pu être éprouvé ici, et qu'il faut dire** : l'élan d'un vrai
   doigt. Le navigateur sans tête ne produit pas de lancer avec inertie — la
   mesure porte sur le coût de rendu, pas sur la sensation du geste. Si le
   patron trouve encore que ça accroche, le suspect suivant est le masque **sur
   iOS**, où un cadre masqué se recompose à chaque image ; le déplacer sur
   `.atlas-ecran` en surimpression garderait le fondu sans masquer le cadre qui
   défile.
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
  pas d'en rattacher un — d'où la phrase de pied, qui dit exactement cela.
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

## Où reprendre

`TODO.md`, dans l'ordre. Le premier point codable seul aujourd'hui est
l'**agenda Google** — et encore, partiellement : la connexion du compte demande
des identifiants que le patron doit fournir.

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
